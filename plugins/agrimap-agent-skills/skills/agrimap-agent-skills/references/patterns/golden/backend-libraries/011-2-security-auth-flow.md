# Auth Flow Core Handoff For `agmws-identity-netcore`

This document is intended for the implementation agent working in `agmws-identity-netcore`.

Use `AgriMap.Platform.Security.Auth.Flow` as the neutral core for short-lived authentication artifacts. The identity service owns HTTP endpoints, redirects, provider API calls, session creation, token issuance, and business decisions.

## Core Boundary

The core DOES:

- create and cache authorize `state`
- validate and optionally consume `state`
- create and cache internal one-time `authorization_code`
- validate and optionally consume internal `authorization_code`
- validate PKCE `plain` and `S256`
- create and cache one-time `verification_grant`
- validate and consume `verification_grant`
- create and cache one-time `registration_grant`
- validate and consume `registration_grant`
- store provider/purpose/prompt/user metadata for later validation

The core DOES NOT:

- redirect to ThaID or any external provider
- call ThaID APIs or exchange provider tokens
- create AgmSession cookies
- create normal login access tokens
- decide whether a prompt means change password, delete account, or any other business action
- know frontend callback URLs beyond storing and matching `redirect_uri`

## Namespaces

```csharp
using AgriMap.Platform.Security.Auth.Flow;
using AgriMap.Platform.Security.Auth.Flow.Attributes;
using AgriMap.Platform.Security.Auth.Flow.Models;
```

## Required Registration

In `agmws-identity-netcore`, ensure the app registers cache and auth services:

```csharp
builder.Services.AddCacheService(builder.Configuration);
builder.Services.AddAuth();
```

`AddAuth()` registers the auth repositories and services used by the core:

```csharp
IUserTokenRepository -> UserTokenRepository
IUserInfoRepository -> UserInfoRepository
IAuthService -> AuthService
IAuthFlowCoreService -> AuthFlowCoreService
```

It also binds:

- `AuthenticationTokenResolverOptions` from `AuthenticationTokenResolver`
- `AuthFlowOptions` from `AuthFlow`
- `IHttpContextAccessor`

Configuration section:

```json
{
  "AuthFlow": {
    "StateKeyPrefix": "auth:state",
    "AuthorizationCodeKeyPrefix": "auth:code",
    "VerificationGrantKeyPrefix": "auth:vgr",
    "RegistrationGrantKeyPrefix": "auth:rgr",
    "StateExpiresMinutes": 5,
    "AuthorizationCodeExpiresMinutes": 5,
    "VerificationGrantExpiresMinutes": 5,
    "RegistrationGrantExpiresMinutes": 30,
    "VerificationGrantHeaderName": "agm-authorization-one-time",
    "RegistrationGrantHeaderName": "agm-registration-one-time"
  }
}
```

Redis is recommended for production because the flow depends on short TTL and one-time artifacts.

## Shared Flow Fields

Use these fields consistently across endpoints:

- `provider`: auth provider name, for example `thaid`, `email_otp`, `totp`, `passkey`
- `purpose`: high-level flow purpose, for example `login`, `authorize`, `register`
- `prompt`: business/action prompt, for example `verify_change_password`, `verify_change_email`, `delete_account`
- `redirect_uri`: frontend callback URI
- `code_challenge`: PKCE challenge from frontend
- `code_verifier`: PKCE verifier from frontend token exchange

The core treats `provider`, `purpose`, and `prompt` as plain strings. Only validate them when the endpoint supplies expected values.

## Endpoint 1: `/auth/authorize`

Goal: create an internal state, store it in cache, then the identity service redirects to the selected provider.

Typical request:

```http
GET /auth/authorize?provider=thaid&purpose=authorize&prompt=verify_change_password&redirect_uri=https://frontend/callback&code_challenge=xxx&code_challenge_method=S256&client_id=web
```

Implementation sketch:

```csharp
[HttpGet("/auth/authorize")]
public async Task<IActionResult> Authorize([FromQuery] AuthorizeRequest request)
{
    var state = await authFlow.CreateStateAsync(new AuthFlowStateCreateRequest
    {
        Provider = request.Provider,
        Purpose = request.Purpose,
        Prompt = request.Prompt,
        RedirectUri = request.RedirectUri,
        CodeChallenge = request.CodeChallenge,
        CodeChallengeMethod = request.CodeChallengeMethod ?? AuthFlowConstants.CodeChallengeMethods.S256,
        ClientId = request.ClientId,
        DeviceId = request.DeviceId,
        Metadata = new Dictionary<string, string>
        {
            ["return_uri"] = request.ReturnUri ?? string.Empty
        }
    });

    if (!state.Success)
        return BadRequest(ToError(state));

    var providerRedirectUrl = BuildProviderAuthorizeUrl(request.Provider, state.Value!.State, request);
    return Redirect(providerRedirectUrl);
}
```

Important:

- Provider redirect URL is built in `agmws-identity-netcore`, not in the platform core.
- For ThaID, this endpoint should build the DOPA authorize URL with `state.Value!.State`.
- Store any frontend return URL or correlation data in `Metadata`.

## Endpoint 2: Provider Callback, For Example `/auth/callback/thaid`

Goal: receive provider callback, validate state, exchange provider code/token, validate provider user, then create internal authorization code.

Typical provider callback:

```http
GET /auth/callback/thaid?code=provider_code&state=internal_state
```

Implementation sketch:

```csharp
[HttpGet("/auth/callback/thaid")]
public async Task<IActionResult> ThaIdCallback([FromQuery] ProviderCallbackRequest request)
{
    var state = await authFlow.ValidateStateAsync(new AuthFlowStateValidateRequest
    {
        State = request.State,
        ExpectedProvider = "thaid",
        ExpectedPurpose = null,
        ExpectedPrompts = null
    });

    if (!state.Success)
        return Redirect(BuildFrontendErrorUrl("state_invalid", state.Message));

    var providerToken = await thaIdClient.ExchangeCodeAsync(request.Code);
    var providerUser = await thaIdClient.GetUserInfoAsync(providerToken.AccessToken);

    var userId = await ResolveOrLinkUserAsync(providerUser);

    var code = await authFlow.CreateAuthorizationCodeAsync(new AuthFlowAuthorizationCodeCreateRequest
    {
        Provider = state.Value!.Provider,
        Purpose = state.Value.Purpose,
        Prompt = state.Value.Prompt,
        RedirectUri = state.Value.RedirectUri,
        CodeChallenge = state.Value.CodeChallenge,
        CodeChallengeMethod = state.Value.CodeChallengeMethod,
        UserId = userId,
        ExternalSubject = providerUser.Subject,
        ClientId = state.Value.ClientId,
        DeviceId = state.Value.DeviceId,
        Claims = new Dictionary<string, string>
        {
            ["provider"] = state.Value.Provider,
            ["citizen_id_hash"] = providerUser.CitizenIdHash
        }
    });

    if (!code.Success)
        return Redirect(BuildFrontendErrorUrl(code.Error, code.Message));

    return Redirect($"{state.Value.RedirectUri}?code={Uri.EscapeDataString(code.Value!.Code)}&state={Uri.EscapeDataString(state.Value.State)}&purpose={Uri.EscapeDataString(state.Value.Purpose)}&prompt={Uri.EscapeDataString(state.Value.Prompt ?? string.Empty)}");
}
```

Important:

- Do not store raw provider access tokens in the core payload.
- Store only safe metadata or hashes in `Claims`/`Metadata`.
- The internal authorization code should be short-lived and one-time.

## Endpoint 3: `/auth/token`

Goal: exchange internal authorization code for a normal login result, a verification grant, or a registration grant depending on `purpose`.

Typical request:

```json
{
  "grant_type": "authorization_code",
  "provider": "thaid",
  "purpose": "authorize",
  "prompt": "verify_change_password",
  "code": "internal_code",
  "redirect_uri": "https://frontend/callback",
  "code_verifier": "pkce_verifier"
}
```

Implementation sketch:

```csharp
[HttpPost("/auth/token")]
public async Task<IActionResult> Token([FromBody] TokenRequest request)
{
    var code = await authFlow.ValidateAuthorizationCodeAsync(new AuthFlowAuthorizationCodeValidateRequest
    {
        Code = request.Code,
        CodeVerifier = request.CodeVerifier,
        ExpectedProvider = request.Provider,
        ExpectedPurpose = request.Purpose,
        ExpectedPrompt = request.Prompt,
        ExpectedRedirectUri = request.RedirectUri
    });

    if (!code.Success)
        return Unauthorized(ToError(code));

    if (code.Value!.Purpose == AuthFlowConstants.Purposes.Login)
    {
        var loginResult = await CreateAgmSessionOrLoginTokenAsync(code.Value);
        return Ok(loginResult);
    }

    if (code.Value.Purpose == AuthFlowConstants.Purposes.Authorize)
    {
        var grant = await authFlow.CreateVerificationGrantAsync(new AuthFlowVerificationGrantCreateRequest
        {
            Provider = code.Value.Provider,
            Purpose = code.Value.Purpose,
            Prompt = code.Value.Prompt,
            UserId = code.Value.UserId,
            ExternalSubject = code.Value.ExternalSubject,
            ClientId = code.Value.ClientId,
            DeviceId = code.Value.DeviceId,
            Claims = code.Value.Claims,
            Metadata = code.Value.Metadata
        });

        if (!grant.Success)
            return Unauthorized(ToError(grant));

        return Ok(new
        {
            token_type = grant.Value!.TokenType,
            access_token = grant.Value.AccessToken,
            expires_in = grant.Value.ExpiresIn,
            message = (string?)null,
            data = new { },
            pin_code = (string?)null
        });
    }

    if (code.Value.Purpose == AuthFlowConstants.Purposes.Register)
    {
        var grant = await authFlow.CreateRegistrationGrantAsync(new AuthFlowRegistrationGrantCreateRequest
        {
            Provider = code.Value.Provider,
            Purpose = code.Value.Purpose,
            Prompt = code.Value.Prompt,
            UserId = code.Value.UserId,
            ExternalSubject = code.Value.ExternalSubject,
            ClientId = code.Value.ClientId,
            DeviceId = code.Value.DeviceId,
            Claims = code.Value.Claims,
            Metadata = code.Value.Metadata
        });

        if (!grant.Success)
            return Unauthorized(ToError(grant));

        return Ok(new
        {
            token_type = grant.Value!.TokenType,
            access_token = grant.Value.AccessToken,
            expires_in = grant.Value.ExpiresIn,
            message = (string?)null,
            data = new { },
            pin_code = (string?)null
        });
    }

    return BadRequest(new
    {
        error = "unsupported_purpose",
        message = $"Unsupported purpose: {code.Value.Purpose}"
    });
}
```

Important:

- `purpose=login` should create the existing AgmSession/login token flow.
- `purpose=authorize` should NOT create AgmSession.
- `purpose=authorize` should return only a one-time `verification_grant`.
- `purpose=register` should NOT create AgmSession unless the product explicitly wants auto-login.
- `purpose=register` should return a one-time `registration_grant`.

## Business API Protection With `verification_grant`

Use the attribute on endpoints that require a recent step-up verification.

```csharp
[VerificationGrant("verify_change_password", "verify_change_email")]
[HttpPost("/users/me/password")]
public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
{
    var grant = HttpContext.GetVerificationGrant();
    var userId = grant?.UserId;

    await ChangePasswordAsync(userId!, request.NewPassword);
    return Ok();
}
```

Client header:

```http
agm-authorization-one-time: {verification_grant_access_token}
```

Multiple prompts are supported:

```csharp
[VerificationGrant("verify_change_password", "verify_change_email")]
```

If no prompt is provided, the attribute validates only that the grant is a valid `verification_grant` with `purpose=authorize`:

```csharp
[VerificationGrant]
```

Optional attribute settings:

```csharp
[VerificationGrant(
    "verify_change_password",
    ExpectedProvider = "thaid",
    RequireAuthenticatedUser = true)]
```

Anonymous or service-to-service verification gates can opt out of session user matching:

```csharp
[VerificationGrant("delete_account", RequireAuthenticatedUser = false)]
```

## Registration API Protection With `registration_grant`

Use a separate grant type for registration/onboarding flows. Do not overload `verification_grant` for registration.

```csharp
[RegistrationGrant]
[HttpPost("/auth/register/complete")]
public async Task<IActionResult> CompleteRegistration(CompleteRegistrationRequest request)
{
    var grant = HttpContext.GetRegistrationGrant();

    await CompleteRegistrationAsync(
        externalSubject: grant!.ExternalSubject,
        provider: grant.Provider,
        request: request);

    return Ok();
}
```

Client header:

```http
agm-registration-one-time: {registration_grant_access_token}
```

`RegistrationGrantAttribute` defaults to `RequireAuthenticatedUser = false` because registration often happens before an AgmSession exists.

Registration prompt checks are optional. Use prompts only when the project needs multiple registration paths:

```csharp
[RegistrationGrant("register_thaid", "register_email")]
```

Optional attribute settings:

```csharp
[RegistrationGrant(
    "register_thaid",
    ExpectedProvider = "thaid",
    RequireAuthenticatedUser = false)]
```

## Recommended DTOs

```csharp
public sealed class AuthorizeRequest
{
    public string Provider { get; set; } = "thaid";
    public string Purpose { get; set; } = "login";
    public string? Prompt { get; set; }
    public required string RedirectUri { get; set; }
    public string? ReturnUri { get; set; }
    public string? CodeChallenge { get; set; }
    public string? CodeChallengeMethod { get; set; }
    public string? ClientId { get; set; }
    public string? DeviceId { get; set; }
}

public sealed class ProviderCallbackRequest
{
    public required string Code { get; set; }
    public required string State { get; set; }
    public string? Error { get; set; }
    public string? ErrorDescription { get; set; }
}

public sealed class TokenRequest
{
    public string GrantType { get; set; } = "authorization_code";
    public string? Provider { get; set; }
    public string? Purpose { get; set; }
    public string? Prompt { get; set; }
    public required string Code { get; set; }
    public required string RedirectUri { get; set; }
    public string? CodeVerifier { get; set; }
}
```

## Error Mapping

Core result errors are returned through `AuthFlowOperationResult<T>`.

Recommended HTTP mapping:

- `state_required`, `redirect_uri_required`, `purpose_required` -> `400`
- `state_invalid`, `code_invalid`, `verification_grant_invalid` -> `401`
- `registration_grant_invalid` -> `401`
- `provider_mismatch`, `purpose_mismatch`, `prompt_mismatch`, `redirect_uri_mismatch`, `pkce_invalid`, `user_mismatch` -> `401`
- provider callback errors -> redirect frontend with `error` and `error_description`

Example helper:

```csharp
private static object ToError<T>(AuthFlowOperationResult<T> result)
{
    return new
    {
        error = result.Error,
        message = result.Message
    };
}
```

## Security Checklist

- Require PKCE for browser/mobile clients.
- Validate `redirect_uri` against registered clients before creating state.
- Validate `ExpectedProvider`, `ExpectedPurpose`, `ExpectedPrompt` or `ExpectedPrompts` when exchanging code/token.
- Keep state, internal code, verification grant, and registration grant TTL short.
- Do not create AgmSession for `purpose=authorize`.
- Do not create AgmSession for `purpose=register` unless auto-login is an explicit product rule.
- Do not store raw ThaID/provider access tokens in cache payload.
- Do not reuse verification grants. The core consumes the grant after successful validation.
- Do not reuse registration grants. The core consumes the grant after successful validation.
- For strict concurrent replay protection, add an atomic Redis consume implementation later, for example `GETDEL` or Lua script.

## Implementation Tasks For `agmws-identity-netcore`

1. Add/confirm `AgriMap.Platform` package/reference that includes `AgriMap.Platform.Security.Auth.Flow`.
2. Register `AddCacheService(...)` and `AddAuth()`.
3. Add `AuthFlow` config section.
4. Implement `/auth/authorize`.
5. Implement provider callback endpoint, starting with ThaID.
6. Implement provider client for token exchange and user info outside this core.
7. Implement `/auth/token`.
8. Keep existing login/AgmSession behavior for `purpose=login`.
9. Return `verification_grant` for `purpose=authorize`.
10. Return `registration_grant` for `purpose=register`.
11. Protect sensitive APIs with `[VerificationGrant(...)]`.
12. Protect registration completion APIs with `[RegistrationGrant(...)]`.
13. Add tests for state TTL, state replay, code PKCE, code replay, verification grant replay, registration grant replay, prompt mismatch, and user mismatch.

## Key Rule

Keep provider-specific logic in `agmws-identity-netcore`. Keep `AgriMap.Platform.Security.Auth.Flow` neutral.
