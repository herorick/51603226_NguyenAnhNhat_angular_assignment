namespace FamilyFinance.Api.DTOs;

/// <summary>One row of the "all months" overview: the plan's income and what has been spent against it.</summary>
public sealed record BudgetPlanSummaryResponse(
    int Year,
    int Month,
    string Currency,
    string MonthlyIncomeVnd,
    string SpentVnd,
    string RemainingVnd,
    decimal PercentageUsed,
    int ExpenseCount,
    DateTime CreatedAtUtc);
