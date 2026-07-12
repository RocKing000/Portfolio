# =============================================================================
# SDLC Automation Suite — Start Infrastructure
# Starts all shared services (no application containers)
# =============================================================================

param(
    [switch]$WithApp,         # Also start application containers
    [switch]$Reset,           # Tear down volumes and start fresh
    [switch]$Monitoring       # Include ELK + Prometheus + Grafana
)

$ErrorActionPreference = "Stop"

Write-Host "=== SDLC Automation Suite ===" -ForegroundColor Cyan
Write-Host "Starting infrastructure..." -ForegroundColor Yellow

# Validate .env exists
if (-not (Test-Path ".env")) {
    Write-Error ".env file not found. Copy .env to .env and fill in your values."
    exit 1
}

if ($Reset) {
    Write-Host "Resetting — removing all volumes..." -ForegroundColor Red
    docker compose down -v --remove-orphans
}

# Core services always started
$CoreServices = @(
    "sqlserver", "sqlserver-init",
    "rabbitmq",
    "redis",
    "minio", "minio-init",
    "keycloak"
)

if ($Monitoring) {
    $CoreServices += @("elasticsearch", "logstash", "kibana", "prometheus", "grafana")
    Write-Host "Including monitoring stack (ELK + Prometheus + Grafana)" -ForegroundColor Cyan
}

$ServiceArgs = $CoreServices -join " "

Write-Host "Starting: $ServiceArgs" -ForegroundColor Green
Invoke-Expression "docker compose up -d $ServiceArgs"

Write-Host ""
Write-Host "Waiting for services to become healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Health check
$HealthChecks = @{
    "SQL Server"  = "docker compose exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P `$env:SQLSERVER_SA_PASSWORD -Q 'SELECT 1' -C -b"
    "RabbitMQ"    = "docker compose exec rabbitmq rabbitmq-diagnostics ping"
    "Redis"       = "docker compose exec redis redis-cli ping"
    "MinIO"       = "docker compose exec minio curl -sf http://localhost:9000/minio/health/live"
}

foreach ($svc in $HealthChecks.Keys) {
    Write-Host -NoNewline "  Checking $svc... "
    try {
        Invoke-Expression $HealthChecks[$svc] | Out-Null
        Write-Host "OK" -ForegroundColor Green
    } catch {
        Write-Host "NOT READY (check 'docker compose logs $($svc.ToLower())')" -ForegroundColor Yellow
    }
}

if ($WithApp) {
    Write-Host ""
    Write-Host "Starting application containers..." -ForegroundColor Green
    docker compose --profile app up -d
}

Write-Host ""
Write-Host "=== Service URLs ===" -ForegroundColor Cyan
Write-Host "  RabbitMQ Management : http://localhost:15672"
Write-Host "  MinIO Console       : http://localhost:9001"
Write-Host "  Keycloak Admin      : http://localhost:8080"
if ($Monitoring) {
    Write-Host "  Kibana              : http://localhost:5601"
    Write-Host "  Grafana             : http://localhost:3000"
    Write-Host "  Prometheus          : http://localhost:9090"
}
if ($WithApp) {
    Write-Host "  API Gateway         : http://localhost:5000"
}
Write-Host ""
Write-Host "Default credentials are in .env" -ForegroundColor DarkGray
Write-Host "Done." -ForegroundColor Green
