"""
upload_to_drive.py — Upload the generated dataset to Google Drive for Colab training.

Requires:
    pip install google-auth google-auth-oauthlib google-api-python-client tqdm

Usage:
    py -m vision_framework.training.scripts.upload_to_drive ^
        --dataset D:/kyc_dataset ^
        --folder kyc_training_data

On first run, a browser window opens for Google OAuth consent.
Credentials are saved to training/scripts/.gdrive_token.json for subsequent runs.

At the end, the script prints the Google Drive folder ID.
Paste this ID into Cell 1 of 01_classifier_training.ipynb.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Token is stored next to this script so it travels with the project.
_SCRIPT_DIR = Path(__file__).resolve().parent
TOKEN_PATH   = _SCRIPT_DIR / ".gdrive_token.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
DATA_EXTS  = {".json", ".csv", ".txt"}
UPLOAD_EXTS = IMAGE_EXTS | DATA_EXTS


def _import_google_libs():
    """Import Google API packages or exit with a helpful message."""
    try:
        from googleapiclient.discovery import build                     # noqa: F401
        from googleapiclient.http import MediaFileUpload                # noqa: F401
        from googleapiclient.errors import HttpError                    # noqa: F401
        from google_auth_oauthlib.flow import InstalledAppFlow          # noqa: F401
        from google.auth.transport.requests import Request              # noqa: F401
        from google.oauth2.credentials import Credentials               # noqa: F401
    except ImportError:
        print(
            "[ERROR] Google API packages not installed.\n"
            "Run: pip install google-auth google-auth-oauthlib "
            "google-api-python-client tqdm"
        )
        sys.exit(1)


def _authenticate(credentials_path: str):
    """Return valid Google Drive credentials, triggering OAuth if needed."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow

    creds: Optional[Credentials] = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("[auth] Refreshing expired token...")
            creds.refresh(Request())
        else:
            if not os.path.exists(credentials_path):
                print(
                    f"[ERROR] OAuth credentials file not found: {credentials_path}\n"
                    "Download it from:\n"
                    "  Google Cloud Console → APIs & Services → Credentials\n"
                    "  → Create Credentials → OAuth 2.0 Client ID → Desktop App\n"
                    "  → Download JSON → save as credentials.json"
                )
                sys.exit(1)
            print("[auth] Opening browser for Google OAuth consent...")
            flow = InstalledAppFlow.from_client_secrets_file(
                credentials_path, SCOPES
            )
            creds = flow.run_local_server(port=0)

        # Save token for next run
        TOKEN_PATH.write_text(creds.to_json())
        print(f"[auth] Token saved → {TOKEN_PATH}")

    return creds


def _get_or_create_folder(service, name: str, parent_id: Optional[str] = None) -> str:
    """Return the Drive folder ID for `name`, creating it if it doesn't exist."""
    query = (
        f"name='{name}' and mimeType='application/vnd.google-apps.folder' "
        f"and trashed=false"
    )
    if parent_id:
        query += f" and '{parent_id}' in parents"

    resp = service.files().list(q=query, fields="files(id,name)", pageSize=1).execute()
    files = resp.get("files", [])
    if files:
        return files[0]["id"]

    meta = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    if parent_id:
        meta["parents"] = [parent_id]
    folder = service.files().create(body=meta, fields="id").execute()
    return folder["id"]


def _list_existing_filenames(service, folder_id: str) -> set[str]:
    """Return the set of filenames already present in a Drive folder."""
    names: set[str] = set()
    page_token = None
    while True:
        kwargs = dict(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="nextPageToken, files(name)",
            pageSize=1000,
        )
        if page_token:
            kwargs["pageToken"] = page_token
        resp = service.files().list(**kwargs).execute()
        for f in resp.get("files", []):
            names.add(f["name"])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return names


# ---------------------------------------------------------------------------
# Core upload logic
# ---------------------------------------------------------------------------

def _upload_directory(
    service,
    local_dir: str,
    parent_id: str,
    counters: dict,
    pbar_factory,
) -> None:
    """
    Recursively upload `local_dir` into Drive folder `parent_id`.

    counters dict keys: uploaded, skipped, failed
    pbar_factory: callable(desc, total) → tqdm context manager
    """
    from googleapiclient.http import MediaFileUpload
    from googleapiclient.errors import HttpError

    local_path = Path(local_dir)

    # Collect uploadable files in this directory
    files_here = [
        f for f in local_path.iterdir()
        if f.is_file() and f.suffix.lower() in UPLOAD_EXTS
    ]
    subdirs = [d for d in local_path.iterdir() if d.is_dir()]

    # Fetch existing filenames once per folder to power skip logic
    existing = _list_existing_filenames(service, parent_id)

    folder_label = local_path.name
    with pbar_factory(
        desc=f"  {folder_label:<30}",
        total=len(files_here),
    ) as pbar:
        for file_path in sorted(files_here):
            fname = file_path.name
            pbar.set_postfix_str(fname[:30])

            if fname in existing:
                counters["skipped"] += 1
                pbar.update(1)
                continue

            # Determine MIME type
            ext = file_path.suffix.lower()
            if ext in {".jpg", ".jpeg"}:
                mime = "image/jpeg"
            elif ext == ".png":
                mime = "image/png"
            elif ext == ".json":
                mime = "application/json"
            else:
                mime = "application/octet-stream"

            try:
                meta  = {"name": fname, "parents": [parent_id]}
                media = MediaFileUpload(str(file_path), mimetype=mime, resumable=True)
                request = service.files().create(
                    body=meta, media_body=media, fields="id"
                )
                # Execute resumable upload with retry on transient errors
                response = None
                for attempt in range(3):
                    try:
                        response = request.execute()
                        break
                    except HttpError as exc:
                        if exc.resp.status in (429, 500, 502, 503, 504) and attempt < 2:
                            time.sleep(2 ** attempt)
                        else:
                            raise
                if response:
                    counters["uploaded"] += 1
                else:
                    counters["failed"] += 1
            except Exception as exc:
                counters["failed"] += 1
                print(f"\n  [WARN] Failed to upload {fname}: {exc}")

            pbar.update(1)

    # Recurse into subdirectories
    for subdir in sorted(subdirs):
        sub_drive_id = _get_or_create_folder(service, subdir.name, parent_id)
        _upload_directory(service, str(subdir), sub_drive_id, counters, pbar_factory)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upload KYC dataset to Google Drive.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--dataset", required=True,
        help="Local dataset root directory (e.g. D:/kyc_dataset)"
    )
    parser.add_argument(
        "--folder", default="kyc_training_data",
        help="Google Drive folder name to create/use (default: kyc_training_data)"
    )
    parser.add_argument(
        "--credentials", default="credentials.json",
        help="Path to Google OAuth 2.0 credentials JSON (default: credentials.json)"
    )
    args = parser.parse_args()

    if not os.path.isdir(args.dataset):
        print(f"[ERROR] Dataset directory not found: {args.dataset}")
        sys.exit(1)

    _import_google_libs()

    # Count total files to upload for the opening summary
    total_local = sum(
        1 for _, _, fnames in os.walk(args.dataset)
        for f in fnames
        if Path(f).suffix.lower() in UPLOAD_EXTS
    )
    print(f"[scan]  Found {total_local:,} uploadable files in {args.dataset}")
    print(f"[drive] Target folder: '{args.folder}'")
    print()

    # Authenticate
    creds   = _authenticate(args.credentials)
    from googleapiclient.discovery import build
    service = build("drive", "v3", credentials=creds)

    # Get/create top-level Drive folder
    root_id = _get_or_create_folder(service, args.folder)
    print(f"[drive] Folder ID: {root_id}")
    print()

    # Upload with per-folder progress bars
    try:
        from tqdm import tqdm
        def pbar_factory(desc, total):
            return tqdm(desc=desc, total=total, unit="file", ncols=80)
    except ImportError:
        import contextlib
        class _DummyPbar:
            def update(self, n=1): pass
            def set_postfix_str(self, s): pass
            def __enter__(self): return self
            def __exit__(self, *a): pass
        def pbar_factory(desc, total):
            print(f"{desc} ({total} files)")
            return _DummyPbar()

    counters = {"uploaded": 0, "skipped": 0, "failed": 0}

    print("Uploading...")
    _upload_directory(service, args.dataset, root_id, counters, pbar_factory)
    print()

    # Summary
    total_processed = counters["uploaded"] + counters["skipped"] + counters["failed"]
    print("=" * 50)
    print(f"Uploaded : {counters['uploaded']:>6,} files")
    print(f"Skipped  : {counters['skipped']:>6,} files  (already on Drive)")
    print(f"Failed   : {counters['failed']:>6,} files")
    print(f"Total    : {total_processed:>6,} files processed")
    print("=" * 50)
    print(f"\nDrive folder: https://drive.google.com/drive/folders/{root_id}")
    print()
    print("╔══════════════════════════════════════════════════════╗")
    print(f"║  FOLDER ID (paste into Colab Cell 1):               ║")
    print(f"║  {root_id:<52}  ║")
    print("╚══════════════════════════════════════════════════════╝")

    if counters["failed"]:
        print(f"\n[WARN] {counters['failed']} file(s) failed — re-run to retry (skips already-uploaded files).")


if __name__ == "__main__":
    main()
