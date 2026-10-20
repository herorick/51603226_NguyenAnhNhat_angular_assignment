namespace FamilyFinance.Api.Models;

public class BudgetAllocation
{
    public int Id { get; set; }
    public int BudgetPlanId { get; set; }
    public JarType JarType { get; set; }
    public int PercentagePoints { get; set; }
    public long BudgetVnd { get; set; }
    public BudgetPlan BudgetPlan { get; set; } = null!;
    public List<Expense> Expenses { get; set; } = [];
}
