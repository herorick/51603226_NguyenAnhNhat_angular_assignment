namespace FamilyFinance.Api.DTOs;

public class CreateExpenseResponse
{
    public SavedExpenseResponse Expense { get; set; } = new();
    public ExpenseJarSummaryResponse JarSummary { get; set; } = new();
}

public class SavedExpenseResponse
{
    public int Id { get; set; }
    public string ExpenseDate { get; set; } = string.Empty;
    public string JarType { get; set; } = string.Empty;
    public string JarName { get; set; } = string.Empty;
    public string AmountVnd { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class ExpenseJarSummaryResponse
{
    public string JarType { get; set; } = string.Empty;
    public string JarName { get; set; } = string.Empty;
    public int Percentage { get; set; }
    public string BudgetVnd { get; set; } = string.Empty;
    public string SpentVnd { get; set; } = string.Empty;
    public string RemainingVnd { get; set; } = string.Empty;
}
