"""
download_weights.py — Download trained model weights from Google Drive.

After training on Colab, run this script to pull weights into
vision_framework/models/ so the framework picks them up on next start.

Usage:
    python -m vision_framework.training.scripts.download_weights \\
        --drive-folder YOUR_FOLDER_ID \\
        --output vision_framework/models/

Requires: pip install gdown
"""

import argparse
import os
import sys


EXPECTED_WEIGHTS = [
    ("classifier_best.pth",         "Document classifier (PyTorch)"),
    ("classifier.onnx",              "Document classifier (ONNX — used by framework)"),
    ("ocr_craft_finetuned.pth",      "OCR / text detector weights"),
    ("face_arcface_finetuned.pth",   "Face verification weights"),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Download trained KYC model weights.")
    parser.add_argument("--drive-folder", required=True,
                        help="Google Drive folder ID containing weights")
    parser.add_argument("--output", default="vision_framework/models/",
                        help="Local directory to save weights (default: vision_framework/models/)")
    parser.add_argument("--file", default=None,
                        help="Download only this specific filename (optional)")
    args = parser.parse_args()

    try:
        import gdown
    except ImportError:
        print("[ERROR] gdown not installed.  Run: pip install gdown")
        sys.exit(1)

    os.makedirs(args.output, exist_ok=True)

    targets = [(args.file, "specified file")] if args.file else EXPECTED_WEIGHTS

    for filename, description in targets:
        out_path = os.path.join(args.output, filename)
        if os.path.exists(out_path):
            print(f"  [skip] {filename} already exists at {out_path}")
            continue
        print(f"  Downloading {description} ({filename})...")
        url = f"https://drive.google.com/drive/folders/{args.drive_folder}"
        try:
            gdown.download_folder(url, output=args.output, quiet=False, use_cookies=False)
            break   # folder download gets everything at once
        except Exception as exc:
            print(f"  [WARN] Folder download failed: {exc}")
            # Fall back to individual file download
            file_url = f"https://drive.google.com/uc?id={args.drive_folder}"
            try:
                gdown.download(file_url, out_path, quiet=False)
            except Exception as exc2:
                print(f"  [ERROR] Could not download {filename}: {exc2}")

    print(f"\n[download_weights] Weights saved to {args.output}")
    print("[download_weights] Restart the FastAPI server to load new weights.")

    # Verify
    missing = []
    for filename, _ in EXPECTED_WEIGHTS:
        path = os.path.join(args.output, filename)
        if os.path.exists(path):
            size_kb = os.path.getsize(path) // 1024
            print(f"  OK {filename} ({size_kb} KB)")
        else:
            missing.append(filename)
            print(f"  MISSING {filename} — NOT FOUND")

    if missing:
        print(f"\n[WARN] {len(missing)} weight files missing. "
              "Check your Drive folder ID and re-run.")


if __name__ == "__main__":
    main()
