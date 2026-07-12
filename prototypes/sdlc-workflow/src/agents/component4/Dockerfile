FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ libffi-dev libssl-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_lg

COPY . /app/

COPY ../proto/sdlc_agents.proto /proto/sdlc_agents.proto
RUN python -m grpc_tools.protoc \
        --proto_path=/proto \
        --python_out=/app/generated \
        --grpc_python_out=/app/generated \
        /proto/sdlc_agents.proto && \
    sed -i 's/^import sdlc_agents_pb2/from . import sdlc_agents_pb2/' /app/generated/sdlc_agents_pb2_grpc.py && \
    touch /app/generated/__init__.py

EXPOSE 8000 50054

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENV PYTHONPATH=/app
ENV COMPONENT=4

CMD ["python", "-m", "component4.main"]
