namespace FamilyFinance.Api.Models;

public class BudgetPlan
{
    public int Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public long MonthlyIncomeVnd { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public List<BudgetAllocation> Allocations { get; set; } = [];
}
