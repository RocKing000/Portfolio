using Dapper;
using Microsoft.Data.SqlClient;
using Prometheus;
using Serilog;
using SessionService.Endpoints;
using SessionService.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc
    .MinimumLevel.Information()
    .WriteTo.Console()
    .Enrich.WithProperty("Service", "SessionService"));

builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();

// Infrastructure
builder.Services.AddSingleton<IDbConnectionFactory>(
    new SqlConnectionFactory(builder.Configuration.GetConnectionString("SqlServer")!));
builder.Services.AddSingleton<IRedisConnectionFactory>(
    new RedisConnectionFactory(builder.Configuration["Redis:Url"]!));
builder.Services.AddSingleton<IRabbitMQConnectionFactory>(
    new RabbitMQConnectionFactory(builder.Configuration["RabbitMQ:Url"]!));
builder.Services.AddSingleton<IMinioClientFactory>(
    new MinioClientFactory(
        builder.Configuration["Minio:Endpoint"]!,
        builder.Configuration["Minio:AccessKey"]!,
        builder.Configuration["Minio:SecretKey"]!));

// Application services
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<IReviewQueueRepository, ReviewQueueRepository>();
builder.Services.AddScoped<IApprovalGateRepository, ApprovalGateRepository>();
builder.Services.AddScoped<ISessionService, SessionService.Services.SessionService>();
builder.Services.AddScoped<IReviewQueueService, ReviewQueueService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
app.UseMetricServer("/metrics");
app.UseHttpMetrics();
app.MapHealthChecks("/health");

// Register minimal API endpoint groups
app.MapSessionEndpoints();
app.MapProjectEndpoints();
app.MapReviewQueueEndpoints();
app.MapApprovalGateEndpoints();

app.Run();
