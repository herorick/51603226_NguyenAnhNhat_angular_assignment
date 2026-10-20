namespace FamilyFinance.Api.DTOs;

public class CreateBudgetPlanRequest
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string? MonthlyIncomeVnd { get; set; }
}
