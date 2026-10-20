namespace FamilyFinance.Api.DTOs;

public class BudgetPlanResponse
{
    public int Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public string MonthlyIncomeVnd { get; set; } = string.Empty;
    public string Currency { get; set; } = "VND";
    public DateTime CreatedAtUtc { get; set; }
    public List<BudgetJarResponse> Jars { get; set; } = [];
}

public class BudgetJarResponse
{
    public string JarType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Percentage { get; set; }
    public string BudgetVnd { get; set; } = string.Empty;
}
