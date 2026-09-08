# Example large request: checkout retry

This is a safe fixture for testing large-text intake, not a real project request or authorization. See [beginner cookbook](../../docs/COMMAND-COOKBOOK.md) for chat instructions. A real requester message may be much longer; the headings provide stable chunk boundaries. Replace identities and scope with actual requester-confirmed values before use.

## Requester and authority

- Requested by: Example product owner
- Requester authority: owner
- Decision owner: Example product owner
- Authority evidence: Confirmed in the fixture request.

## Requester objective

Allow a user to retry checkout after a network timeout without creating a duplicate order.

## Current symptom

The UI cannot distinguish an unknown server outcome from a confirmed failure. Some users click submit again and later see two orders.

## Required behavior

1. Keep the current order form and validation behavior.
2. Show a pending-verification state after a timeout.
3. Check the prior request outcome before allowing another create request.
4. Reuse existing shared status and action components when they are suitable.
5. Keep the controller thin and place business behavior in the existing use case/domain boundary.

## Non-goals

- Redesigning the whole checkout page.
- Replacing the HTTP client.
- Introducing a new event platform.
- Changing unrelated order states.

## Acceptance criteria

- A timeout never automatically means that order creation failed.
- Retry does not create a second order for the same idempotency key.
- Loading, pending-verification, success, recoverable failure, and terminal failure are observable.
- Existing successful checkout behavior remains covered.

## Authorized decision-owner decisions

- Correctness is more important than a cosmetic refactor.
- Material contract or logic changes require trade-off discussion.
- This example requests independent, verification-only QA because duplicate orders affect persisted outcomes. Product artifacts remain read-only for the reviewer. Record concise evidence in the existing task/result; a separate qa.md is optional for a real consumer. No heartbeat file or separate lifecycle is required by this example.

## References

- Visual flow: `examples/inputs/references/checkout-flow.svg`
- Supporting note: `examples/inputs/references/feature-note.md`
