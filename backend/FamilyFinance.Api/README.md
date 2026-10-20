# Family Finance API

ASP.NET Core 8 + EF Core + SQLite demo.

## Run

```powershell
dotnet restore
dotnet build
dotnet ef database update
dotnet run
```

Open the Swagger URL printed in the terminal, normally `/swagger`.

### POST example
```json
{"year":2026,"month":9,"monthlyIncome":30000000,"allocations":[{"jarType":"FoodAndEssentials","percentage":40},{"jarType":"Transportation","percentage":10},{"jarType":"ShoppingAndEntertainment","percentage":10},{"jarType":"BillsAndUtilities","percentage":20},{"jarType":"SavingsAndEmergency","percentage":20}]}
```
