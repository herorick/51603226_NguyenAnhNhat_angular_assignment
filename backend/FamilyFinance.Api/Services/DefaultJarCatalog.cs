using FamilyFinance.Api.DTOs;
using FamilyFinance.Api.Models;

namespace FamilyFinance.Api.Services;

public sealed record JarDefinition(JarType JarType, string ApiValue, string Name, int Percentage, string SuggestedLogic);

public static class DefaultJarCatalog
{
    public static IReadOnlyList<JarDefinition> All { get; } =
    [
        new(JarType.LivingExpenses, "livingExpenses", "Living Expenses", 35, "Rent, electricity, water, internet, and insurance"),
        new(JarType.Food, "food", "Food", 20, "Groceries, market shopping, and household supplies"),
        new(JarType.Children, "children", "Children", 10, "Tuition, books, tutoring, and extracurricular activities"),
        new(JarType.EmergencyFund, "emergencyFund", "Emergency Fund", 10, "Unexpected expenses or the family emergency reserve"),
        new(JarType.Savings, "savings", "Savings", 10, "Long-term family savings"),
        new(JarType.Investment, "investment", "Investment", 10, "Regular investment contributions"),
        new(JarType.EntertainmentAndTravel, "entertainmentAndTravel", "Entertainment & Travel", 5, "Dining out, leisure activities, and travel")
    ];

    public static int TotalPercentage => All.Sum(jar => jar.Percentage);

    public static DefaultJarsResponse ToResponse() => new()
    {
        TotalPercentage = TotalPercentage,
        Jars = All.Select(jar => new DefaultJarResponse
        {
            JarType = jar.ApiValue,
            Name = jar.Name,
            Percentage = jar.Percentage,
            SuggestedLogic = jar.SuggestedLogic
        }).ToList()
    };

    public static JarDefinition Get(JarType jarType) => All.Single(jar => jar.JarType == jarType);
}
