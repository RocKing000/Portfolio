using DocumentService.Endpoints;
using DocumentService.Infrastructure;
using DocumentService.Services;
using Prometheus;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc
    .MinimumLevel.Information()
    .WriteTo.Console()
    .Enrich.WithProperty("Service", "DocumentService"));

builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();

// Infrastructure factories
builder.Services.AddSingleton<IDbConnectionFactory>(
    new SqlConnectionFactory(builder.Configuration.GetConnectionString("SqlServer")!));

builder.Services.AddSingleton<IMinioClientFactory>(new MinioClientFactory(
    endpoint:  builder.Configuration["Minio:Endpoint"]!,
    accessKey: builder.Configuration["Minio:AccessKey"]!,
    secretKey: builder.Configuration["Minio:SecretKey"]!,
    useSSL:    builder.Configuration.GetValue<bool>("Minio:UseSSL")));

// Services
builder.Services.AddScoped<IPlanVersionRepository, PlanVersionRepository>();
builder.Services.AddScoped<IDocumentStore, MinioDocumentStore>();
builder.Services.AddScoped<IDocxGenerator, DocxGenerator>();
builder.Services.AddScoped<IDiffEngine, DiffEngine>();
builder.Services.AddScoped<IDocumentService, DocumentService.Services.DocumentService>();

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

app.MapDocumentEndpoints();

app.Run();
