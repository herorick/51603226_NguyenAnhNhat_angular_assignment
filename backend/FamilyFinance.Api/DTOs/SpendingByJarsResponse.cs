namespace FamilyFinance.Api.DTOs;

public sealed record SpendingByJarsResponse(
    int Year,
    int Month,
    string Currency,
    IReadOnlyList<SpendingByJarResponse> Jars);

public sealed record SpendingByJarResponse(
    string JarType,
    string JarName,
    decimal PercentageUsed,
    string PlannedBudgetVnd,
    string SpentBudgetVnd);
