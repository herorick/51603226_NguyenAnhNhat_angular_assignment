namespace FamilyFinance.Api.DTOs;

public sealed record MonthlyExpensesResponse(
    int Year,
    int Month,
    string Currency,
    IReadOnlyList<SavedExpenseResponse> Expenses);
