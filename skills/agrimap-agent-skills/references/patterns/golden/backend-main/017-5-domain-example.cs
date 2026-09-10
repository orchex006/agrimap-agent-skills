public class DashboardDetailInfo
{
    [JsonPropertyName("CONTENT_ID")]
    public string ContentId { get; set; } = string.Empty;

    [JsonPropertyName("NAME")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("DETAIL")]
    public string? Detail { get; set; }

    [JsonPropertyName("TEMPLATE_ID")]
    public int? TemplateId { get; set; }

    [JsonPropertyName("FAVORITE_FLAG")]
    public bool FavoriteFlag { get; set; }

    [JsonPropertyName("CLONE_FLAG")]
    public bool CloneFlag { get; set; }

    [JsonPropertyName("STATE_ID")]
    public int? StateId { get; set; }

    [JsonPropertyName("STATE_NAME")]
    public string? StateName { get; set; }

    [JsonPropertyName("DATE_CREATED")]
    public DateTime? DateCreated { get; set; }

    [JsonPropertyName("DATE_MODIFIED")]
    public DateTime? DateModified { get; set; }

    [JsonPropertyName("USER_CREATED")]
    public long? UserCreated { get; set; }
}
