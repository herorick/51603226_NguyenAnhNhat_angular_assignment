namespace FamilyFinance.Api.DTOs;

/// <summary>Spending by jar for a run of consecutive months, oldest month first.</summary>
public sealed record MonthComparisonResponse(
    string Currency,
    IReadOnlyList<ComparisonJarResponse> Jars,
    IReadOnlyList<ComparisonMonthResponse> Months);

/// <summary>One jar of the catalog, in catalog order, so the client can draw a stable legend.</summary>
public sealed record ComparisonJarResponse(string JarType, string Name);

/// <summary>
/// One month of the range. A month without a plan is still listed (<c>HasPlan</c> false, zero amounts, no jars)
/// so the chart keeps one column per calendar month.
/// </summary>
public sealed record ComparisonMonthResponse(
    int Year,
    int Month,
    bool HasPlan,
    string MonthlyIncomeVnd,
    string SpentVnd,
    decimal PercentageUsed,
    IReadOnlyList<ComparisonMonthJarResponse> Jars);

public sealed record ComparisonMonthJarResponse(
    string JarType,
    string PlannedBudgetVnd,
    string SpentBudgetVnd,
    decimal PercentageUsed);
