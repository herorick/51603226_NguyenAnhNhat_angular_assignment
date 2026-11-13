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

CORS allows `http://localhost:4200` (the `ng serve` default) and `http://localhost:4400`.
Override with `Cors:AllowedOrigins` (string array) in `appsettings.json`.

## Endpoints (`/api/v1/budget-plans`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/default-jars` | Default jar catalog and rates |
| GET | `/` | All monthly plans, newest first, with spent / remaining / percentage used |
| POST | `/` | Create a monthly plan |
| GET | `/{year}/{month}` | One monthly plan with its jar budgets |
| DELETE | `/{year}/{month}` | Delete the month's plan, jars and expenses (204; 404 if none) |
| GET | `/{year}/{month}/spending-by-jars` | Spent vs planned per jar |
| GET | `/{year}/{month}/expenses` | Expenses recorded in the month, newest first |
| GET | `/comparison?endYear=&endMonth=&months=` | Spent vs planned per jar for `months` (1-24, default 6) consecutive months ending at the given month, oldest first; months without a plan have `hasPlan: false` |
| POST | `/expenses` | Record an expense (month derived from `expenseDate`) |
| PUT | `/expenses/{id}` | Update an expense's date, jar, amount and description (same body as POST; 404 `EXPENSE_NOT_FOUND`) |
| DELETE | `/expenses/{id}` | Delete one expense (204; 404 `EXPENSE_NOT_FOUND`) |

### POST `/` example
```json
{"year":2026,"month":9,"monthlyIncomeVnd":"30000000"}
```
