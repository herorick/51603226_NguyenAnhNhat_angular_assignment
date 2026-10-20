namespace FamilyFinance.Api.DTOs;

public class DefaultJarsResponse
{
    public string Currency { get; set; } = "VND";
    public int TotalPercentage { get; set; }
    public List<DefaultJarResponse> Jars { get; set; } = [];
}

public class DefaultJarResponse
{
    public string JarType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Percentage { get; set; }
    public string SuggestedLogic { get; set; } = string.Empty;
}
