using System.Text.Json;
using System.Text.Json.Serialization;
using FamilyFinance.Api.Data;
using FamilyFinance.Api.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .SelectMany(entry => entry.Value!.Errors.Select(_ => new ApiFieldError
            {
                Field = ToCamelCase(entry.Key.Split('.').Last()),
                Code = "INVALID_VALUE",
                Message = "The supplied value is invalid."
            }))
            .ToList();

        return new BadRequestObjectResult(new ApiErrorResponse
        {
            Code = "VALIDATION_ERROR",
            Message = "One or more fields are invalid.",
            Errors = errors
        });
    };
});
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddCors(options => options.AddPolicy("frontend-development", policy =>
    policy.WithOrigins("http://localhost:4400")
        .AllowAnyHeader()
        .AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();
}

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception exception)
    {
        app.Logger.LogError(exception, "An unexpected error occurred while processing the request.");
        if (context.Response.HasStarted)
        {
            throw;
        }

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await JsonSerializer.SerializeAsync(context.Response.Body, new ApiErrorResponse
        {
            Code = "INTERNAL_ERROR",
            Message = "An unexpected error occurred."
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }
});

app.UseCors("frontend-development");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.MapControllers();
app.Run();

static string ToCamelCase(string value) =>
    string.IsNullOrEmpty(value) ? string.Empty : JsonNamingPolicy.CamelCase.ConvertName(value);
