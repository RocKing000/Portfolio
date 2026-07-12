"""
generate_dataset.py — Run locally to generate the complete KYC training dataset.

Usage:
    cd "d:/Documentation Recognition"
    python -m vision_framework.training.scripts.generate_dataset \\
        --output D:/kyc_dataset \\
        --samples 1000 \\
        --augments 5

Quick test (600 images, ~2-3 min):
    python -m vision_framework.training.scripts.generate_dataset --quick
"""

import argparse
import os
import sys
import time

# Allow running from either:
#   cd "d:/Documentation Recognition" && python -m vision_framework.training.scripts.generate_dataset
#   cd "d:/Documentation Recognition/vision_framework" && python training/scripts/generate_dataset.py
_HERE = os.path.dirname(os.path.abspath(__file__))
for _candidate in [
    os.path.join(_HERE, "..", "..", ".."),  # .../vision_framework/training/scripts -> project root
    os.path.join(_HERE, "..", ".."),        # fallback
]:
    _candidate = os.path.normpath(_candidate)
    if _candidate not in sys.path:
        sys.path.insert(0, _candidate)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic KYC document dataset for model training."
    )
    parser.add_argument(
        "--output", default="D:/kyc_dataset",
        help="Output directory (default: D:/kyc_dataset)",
    )
    parser.add_argument(
        "--samples", type=int, default=1000,
        help="Number of clean samples per document class (default: 1000)",
    )
    parser.add_argument(
        "--augments", type=int, default=5,
        help="Augmented versions per clean sample (default: 5)",
    )
    parser.add_argument(
        "--quick", action="store_true",
        help="Quick test mode: 50 samples × 3 augments = 600 images",
    )
    parser.add_argument(
        "--quality", type=int, default=92,
        help="JPEG quality 1-100 (default: 92)",
    )
    args = parser.parse_args()

    if args.quick:
        args.samples = 50
        args.augments = 3
        print("[generate_dataset] Quick mode: 50 samples × 3 augments × 4 classes = 600 images")

    config = {
        "samples_per_class":         args.samples,
        "augmentations_per_sample":  args.augments,
        "image_size":                (1012, 638),
        "output_format":             "jpg",
        "jpg_quality":               args.quality,
    }

    total_estimate = args.samples * 4 * args.augments
    print(f"[generate_dataset] Output directory : {args.output}")
    print(f"[generate_dataset] Samples per class: {args.samples}")
    print(f"[generate_dataset] Augments per sample: {args.augments}")
    print(f"[generate_dataset] Estimated total images: ~{total_estimate:,}")
    print(f"[generate_dataset] Estimated size: ~{total_estimate * 150 // 1024} MB")
    print()

    # Late import so we only need the package when actually running
    try:
        from vision_framework.training.data_generation.dataset_builder import DatasetBuilder
    except ImportError as exc:
        print(f"[ERROR] Could not import DatasetBuilder: {exc}")
        print("Make sure you are running from 'd:/Documentation Recognition'")
        sys.exit(1)

    t0 = time.time()
    builder = DatasetBuilder(args.output, config)
    stats = builder.generate_full_dataset(
        samples_per_class=args.samples,
        augmentations_per_sample=args.augments,
    )

    elapsed = time.time() - t0
    print(f"\n[generate_dataset] Complete in {elapsed / 60:.1f} minutes")
    print(f"[generate_dataset] Stats: {stats}")
    print(f"\nNext steps:")
    print(f"  1. Validate:  python -m vision_framework.training.scripts.validate_dataset --dataset {args.output}")
    print(f"  2. Upload:    python -m vision_framework.training.scripts.upload_to_drive --dataset {args.output}")


if __name__ == "__main__":
    main()
