# Generates Python gRPC stubs from the shared proto file.
# Run from the src/agents/ directory before starting agent containers.
# Requires: pip install grpcio-tools

$protoFile = "..\..\proto\sdlc_agents.proto"
$protoPath  = "..\..\proto"
$outDir     = ".\generated"

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

python -m grpc_tools.protoc `
    --proto_path=$protoPath `
    --python_out=$outDir `
    --grpc_python_out=$outDir `
    $protoFile

# Fix imports: grpc_tools generates absolute imports; make them relative-friendly
(Get-Content "$outDir\sdlc_agents_pb2_grpc.py") `
    -replace "import sdlc_agents_pb2", "from . import sdlc_agents_pb2" |
    Set-Content "$outDir\sdlc_agents_pb2_grpc.py"

if (-not (Test-Path "$outDir\__init__.py")) {
    New-Item -ItemType File "$outDir\__init__.py" | Out-Null
}

Write-Host "Proto stubs generated in $outDir" -ForegroundColor Green
