namespace FamilyFinance.Api.Models;

public class Expense
{
    public int Id { get; set; }
    public int BudgetAllocationId { get; set; }
    public DateOnly ExpenseDate { get; set; }
    public long AmountVnd { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public BudgetAllocation BudgetAllocation { get; set; } = null!;
}
