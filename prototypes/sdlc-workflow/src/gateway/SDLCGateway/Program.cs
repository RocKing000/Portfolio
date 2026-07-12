using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Ocelot.DependencyInjection;
using Ocelot.Middleware;
using Prometheus;
using Serilog;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Logging — Serilog → Elasticsearch (ELK stack)
// ---------------------------------------------------------------------------
builder.Host.UseSerilog((ctx, lc) => lc
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.Elasticsearch(new Serilog.Sinks.Elasticsearch.ElasticsearchSinkOptions(
        new Uri(ctx.Configuration["Logging:ElasticsearchUrl"] ?? "http://elasticsearch:9200"))
    {
        IndexFormat = "sdlc-logs-{0:yyyy.MM.dd}",
        AutoRegisterTemplate = true,
    })
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithProperty("Service", "SDLCGateway")
);

// ---------------------------------------------------------------------------
// Authentication — Keycloak OIDC
// ---------------------------------------------------------------------------
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        options.Authority = builder.Configuration["Keycloak:Authority"];
        options.Audience  = builder.Configuration["Keycloak:Audience"] ?? "sdlc-gateway";
        options.RequireHttpsMetadata = false;   // dev only
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
        };
    });

builder.Services.AddAuthorization();

// ---------------------------------------------------------------------------
// Health Checks
// ---------------------------------------------------------------------------
builder.Services.AddHealthChecks()
    .AddSqlServer(
        builder.Configuration.GetConnectionString("SqlServer") ?? "",
        name: "sqlserver", tags: ["db"])
    .AddRedis(
        builder.Configuration["Redis:Url"] ?? "redis://redis:6379",
        name: "redis", tags: ["cache"])
    .AddRabbitMQ(
        rabbitConnectionString: builder.Configuration["RabbitMQ:Url"] ?? "amqp://rabbitmq",
        name: "rabbitmq", tags: ["messaging"]);

// ---------------------------------------------------------------------------
// Ocelot API Gateway
// ---------------------------------------------------------------------------
builder.Configuration
    .AddJsonFile("ocelot.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"ocelot.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Services.AddOcelot(builder.Configuration);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                    ?? ["http://localhost:4200"])
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Prometheus metrics endpoint
app.UseMetricServer("/metrics");
app.UseHttpMetrics();

// Health check endpoints
app.MapHealthChecks("/health",     new() { ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse });
app.MapHealthChecks("/health/live",  new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("db") });

await app.UseOcelot();
await app.RunAsync();
