namespace AgriMap.Web.Service.Presentation.DTOs.Requests;

public class UserCreateRequestDto
{
    [Required]
    [StringLength(20)]
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [StringLength(250)]
    [JsonPropertyName("password")]
    public string? Password { get; set; }

    [JsonPropertyName("title")]
    public int? Title { get; set; }

    [Required]
    [StringLength(50)]
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    [JsonPropertyName("surname")]
    public string Surname { get; set; } = string.Empty;

    [JsonPropertyName("dept")]
    public int? Dept { get; set; }

    [JsonPropertyName("position")]
    public int? Position { get; set; }

    [StringLength(1000)]
    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [StringLength(10)]
    [JsonPropertyName("tel")]
    public string? Tel { get; set; }

    [EmailAddress]
    [StringLength(100)]
    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [StringLength(13)]
    [JsonPropertyName("id_card")]
    public string? IdCard { get; set; }

    [JsonPropertyName("status")]
    public int? Status { get; set; }

    [StringLength(250)]
    [JsonPropertyName("image")]
    public string? Image { get; set; }

    [JsonPropertyName("source")]
    public int? Source { get; set; }

    [JsonPropertyName("role_list")]
    public string? RoleList { get; set; }

    [JsonPropertyName("permission_function_list")]
    public string? PermissionFunctionList { get; set; }
}
