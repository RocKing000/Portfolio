using System.Text;
using Dapper;
using EnterpriseChatbot.API.Data;
using EnterpriseChatbot.API.Middleware;
using EnterpriseChatbot.API.Services;
using StackExchange.Redis;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Events;

// Map snake_case SQL column names (layout_id, is_default…) to PascalCase C# properties
DefaultTypeMap.MatchNamesWithUnderscores = true;

// Bootstrap logger for startup errors
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("FedMithra V2 API starting — loading database configuration...");

    var builder = WebApplication.CreateBuilder(args);

    // ── 1. LOAD CONFIGURATION FROM DATABASE ───────────────────────────────────
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not set in appsettings.json");

    var configService = new ConfigurationService(connectionString);
    await configService.LoadConfigurationAsync();
    builder.Services.AddSingleton<IConfigurationService>(configService);

    var jwtConfig    = configService.GetJwtConfig();
    var corsConfig   = configService.GetCorsConfig();
    var serverConfig = configService.GetServerConfig();

    Log.Information("Database configuration loaded — env: {Env}, port: {Port}",
        serverConfig.Environment, serverConfig.Port);

    // ── 2. SERILOG ────────────────────────────────────────────────────────────
    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .MinimumLevel.Override("Microsoft",             LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.AspNetCore",  LogEventLevel.Warning)
        .MinimumLevel.Override("System",                LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .WriteTo.Console(outputTemplate:
            "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
        .WriteTo.File(
            path: "logs/fedmithra-.txt",
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 30,
            outputTemplate:
                "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"));

    // ── 3. JWT AUTHENTICATION ─────────────────────────────────────────────────
    if (string.IsNullOrEmpty(jwtConfig.Secret))
        throw new InvalidOperationException("jwt.secret is not configured in infrastructure.app_config");

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig.Secret)),
                ValidateIssuer           = false,
                ValidateAudience         = false,
                ValidateLifetime         = true,
                ClockSkew                = TimeSpan.Zero
            };
        });

    builder.Services.AddAuthorization();

    // ── 4. CORS ───────────────────────────────────────────────────────────────
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("FedMithraPolicy", policy =>
        {
            var p = policy.WithOrigins(corsConfig.AllowedOrigins)
                          .WithOrigins("http://localhost:4200", "https://localhost:4200")
                          .AllowAnyMethod()
                          .AllowAnyHeader();
            if (corsConfig.AllowCredentials)
                p.AllowCredentials();
        });
    });

    // ── 5. INFRASTRUCTURE ─────────────────────────────────────────────────────
    builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
    builder.Services.AddSingleton<IEncryptionService, EncryptionService>();
    builder.Services.AddSingleton<ILocalizationService, LocalizationService>();
    builder.Services.AddSingleton<ITranslationService, TranslationService>();

    // ── Two-Tier Cache (L1: Memory 5min, L2: Redis 30min — Redis optional) ────
    builder.Services.AddMemoryCache();
    var redisCs = builder.Configuration.GetConnectionString("Redis");
    if (!string.IsNullOrWhiteSpace(redisCs))
    {
        builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var opts = ConfigurationOptions.Parse(redisCs, ignoreUnknown: true);
            opts.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(opts);
        });
    }
    builder.Services.AddSingleton<ICacheService, CacheService>();

    // ── Connection Throttling (max 2 concurrent requests per user) ────────────
    builder.Services.Configure<ConnectionThrottlingOptions>(
        builder.Configuration.GetSection("ConnectionThrottling"));
    builder.Services.AddSingleton<UserConnectionTracker>();
    builder.Services.AddSingleton<IUserConnectionTracker>(sp =>
        sp.GetRequiredService<UserConnectionTracker>());
    builder.Services.AddHostedService<ConnectionTrackerCleanupService>();

    // ── 6. SERVICES ───────────────────────────────────────────────────────────
	builder.Services.AddHttpClient(); // Add this for AI Search service

	builder.Services.AddScoped<IAuthService>(sp =>
		new AuthService(
			connectionString,
			sp.GetRequiredService<IConfigurationService>(),
			sp.GetRequiredService<ILogger<AuthService>>()));

	builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
	builder.Services.AddScoped<IErrorIdentificationService, ErrorIdentificationService>();
	builder.Services.AddScoped<IHierarchyService, HierarchyService>();
	builder.Services.AddScoped<ISearchService, SearchService>(); // This will now use AI
	builder.Services.AddScoped<ITenantService, TenantService>();
	builder.Services.AddScoped<IAdminConfigService, AdminConfigService>();

    // ── Signal Dashboard Platform ─────────────────────────────────────────────
    builder.Services.AddHttpClient<ISignalService, SignalService>((sp, client) =>
    {
        var cfg = sp.GetRequiredService<IConfiguration>();
        client.BaseAddress = new Uri(cfg["MLService:BaseUrl"] ?? "http://localhost:8000");
        client.Timeout = TimeSpan.FromSeconds(cfg.GetValue<int>("MLService:TimeoutSeconds", 5));
    });
    builder.Services.AddScoped<IDashboardService, DashboardService>();

    // ── 7. CONTROLLERS + SWAGGER ──────────────────────────────────────────────

    // 10 MB max request body — prevents resource exhaustion from massive payloads
    builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 10_485_760);

    builder.Services.AddControllers()
        .ConfigureApiBehaviorOptions(options =>
        {
            // Return a consistent { success, message, errors } shape for validation failures
            // instead of the default RFC 7807 ProblemDetails format
            options.InvalidModelStateResponseFactory = ctx =>
            {
                var errors = ctx.ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage)
                    .ToList();

                return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new
                {
                    success = false,
                    message = "Validation failed",
                    errors,
                    data    = (object?)null
                });
            };
        });
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v2", new OpenApiInfo
        {
            Title       = "FedMithra V2 API",
            Version     = "v2",
            Description = "Multi-tenant analytics & error identification platform"
        });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name         = "Authorization",
            Type         = SecuritySchemeType.Http,
            Scheme       = "bearer",
            BearerFormat = "JWT",
            In           = ParameterLocation.Header,
            Description  = "Enter your JWT token (without 'Bearer ' prefix)"
        });

        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id   = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    });

    builder.Services.AddProblemDetails();

    // ── 8. BUILD ──────────────────────────────────────────────────────────────
    var app = builder.Build();

    // ── 9. MIDDLEWARE PIPELINE ────────────────────────────────────────────────
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v2/swagger.json", "FedMithra V2 API");
        c.RoutePrefix = "swagger";
    });

    app.UseSerilogRequestLogging(opts =>
    {
        opts.MessageTemplate =
            "HTTP {RequestMethod} {RequestPath} => {StatusCode} in {Elapsed:0.0000}ms";
    });

    app.UseCors("FedMithraPolicy");
    app.UseLanguageMiddleware();
    app.UseAuthentication();
    app.UseAuthorization();

    app.UseMiddleware<EncryptionMiddleware>();
    app.UseMiddleware<ExceptionMiddleware>();
    app.UseMiddleware<TenantIsolationMiddleware>();
    app.UseMiddleware<RequestLoggingMiddleware>();

    // ── 10. HEALTH + CONTROLLERS ──────────────────────────────────────────────
    app.MapGet("/health", () => Results.Ok(new
    {
        Status    = "Healthy",
        Service   = "FedMithra V2 API",
        Timestamp = DateTime.UtcNow
    })).WithName("Health").AllowAnonymous();

    app.MapControllers();

    Log.Information("FedMithra V2 API ready.");
    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "FedMithra V2 API failed to start");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
