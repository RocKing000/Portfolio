#!/usr/bin/env bash
# Generates Python gRPC stubs from the shared proto file.
# Run inside the agent container or from src/agents/ on the host.
# Requires: pip install grpcio-tools

set -euo pipefail

PROTO_FILE="../../proto/sdlc_agents.proto"
PROTO_PATH="../../proto"
OUT_DIR="./generated"

mkdir -p "$OUT_DIR"

python -m grpc_tools.protoc \
    --proto_path="$PROTO_PATH" \
    --python_out="$OUT_DIR" \
    --grpc_python_out="$OUT_DIR" \
    "$PROTO_FILE"

# Fix import path: make pb2_grpc import relative so it works as a package
sed -i 's/^import sdlc_agents_pb2/from . import sdlc_agents_pb2/' \
    "$OUT_DIR/sdlc_agents_pb2_grpc.py"

touch "$OUT_DIR/__init__.py"
echo "Proto stubs generated in $OUT_DIR"
