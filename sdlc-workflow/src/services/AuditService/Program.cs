using AuditService.Consumers;
using AuditService.Endpoints;
using AuditService.Infrastructure;
using Prometheus;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc
    .MinimumLevel.Information()
    .WriteTo.Console()
    .Enrich.WithProperty("Service", "AuditService"));

builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();

builder.Services.AddSingleton<IDbConnectionFactory>(
    new SqlConnectionFactory(builder.Configuration.GetConnectionString("SqlServer")!));
builder.Services.AddSingleton<IRabbitMQConsumerFactory>(
    new RabbitMQConsumerFactory(builder.Configuration["RabbitMQ:Url"]!));

builder.Services.AddScoped<IAuditRepository, AuditRepository>();
builder.Services.AddScoped<IAuditQueryService, AuditQueryService>();

// Background consumer: listens on audit.events queue and writes to SQL
builder.Services.AddHostedService<AuditEventConsumer>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

var app = builder.Build();

if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }

app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();
app.UseMetricServer("/metrics");
app.UseHttpMetrics();
app.MapHealthChecks("/health");

app.MapAuditEndpoints();

app.Run();
