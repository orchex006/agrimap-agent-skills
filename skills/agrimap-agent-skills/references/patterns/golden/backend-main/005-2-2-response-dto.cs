using System.Text.Json.Serialization;

public class UserResponseDto
{
    [JsonPropertyName("user_id")]
    public long UserId { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("title")]
    public int? Title { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("surname")]
    public string? Surname { get; set; }

    [JsonPropertyName("dept")]
    public string? Dept { get; set; }

    [JsonPropertyName("position")]
    public string? Position { get; set; }

    [JsonPropertyName("tel")]
    public string? Tel { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("id_card")]
    public string? IdCard { get; set; }

    [JsonPropertyName("status")]
    public int? Status { get; set; }

    [JsonPropertyName("status_name")]
    public string? StatusName { get; set; }

    [JsonPropertyName("image")]
    public string? Image { get; set; }

    [JsonPropertyName("date_created")]
    public DateTime? DateCreated { get; set; }

    [JsonPropertyName("user_created")]
    public long? UserCreated { get; set; }

    [JsonPropertyName("role_list")]
    public string? RoleList { get; set; }
}
