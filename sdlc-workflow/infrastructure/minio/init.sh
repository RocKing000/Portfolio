#!/bin/sh
# MinIO bucket initialization — SDLC Automation Suite

set -e

echo "Waiting for MinIO to be ready..."
until mc alias set sdlc http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  sleep 2
done

echo "Creating buckets..."

for BUCKET in "$MINIO_BUCKET_PLANS" "$MINIO_BUCKET_DOCUMENTS" "$MINIO_BUCKET_CODE" "$MINIO_BUCKET_AUDIT"; do
  if mc ls "sdlc/$BUCKET" > /dev/null 2>&1; then
    echo "Bucket '$BUCKET' already exists, skipping."
  else
    mc mb "sdlc/$BUCKET"
    echo "Created bucket: $BUCKET"
  fi
done

# Versioning on plans and documents (full history required)
mc version enable "sdlc/$MINIO_BUCKET_PLANS"
mc version enable "sdlc/$MINIO_BUCKET_DOCUMENTS"
mc version enable "sdlc/$MINIO_BUCKET_CODE"

# Audit bucket: lock-protected, immutable
mc version enable "sdlc/$MINIO_BUCKET_AUDIT"

echo "MinIO initialization complete."
