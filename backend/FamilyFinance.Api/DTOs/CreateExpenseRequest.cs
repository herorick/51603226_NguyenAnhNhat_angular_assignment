namespace FamilyFinance.Api.DTOs;

public class CreateExpenseRequest
{
    public string? ExpenseDate { get; set; }
    public string? JarType { get; set; }
    public string? AmountVnd { get; set; }
    public string? Description { get; set; }
}
