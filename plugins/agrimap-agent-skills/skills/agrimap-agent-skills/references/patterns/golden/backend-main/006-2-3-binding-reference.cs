[FromQuery]  // GET/DELETE
[FromRoute]  // Route parameter
[FromHeader] // Header parameter
[FromForm]   // Form-data / Url-encoded
[FromBody]   // POST/PUT/PATCH

[JsonPropertyName("your_field_name_from_frontend")]
public string YourFieldNameFromFrontend { get; set; } = string.Empty;

[BindProperty(Name = "your_field_name_from_frontend")]
public string YourFieldNameFromFrontend { get; set; } = string.Empty;
