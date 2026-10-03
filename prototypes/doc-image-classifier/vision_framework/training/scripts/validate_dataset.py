"""
validate_dataset.py — Verify dataset quality after generation.

Checks:
  1. Image counts per class per split
  2. Consistent image dimensions
  3. OCR annotations file exists and is valid JSON
  4. Class balance (warns if off by >10%)
  5. Saves 5 random sample images to D:/vision_logs/dataset_samples/

Usage:
    python -m vision_framework.training.scripts.validate_dataset \\
        --dataset D:/kyc_dataset
"""

import argparse
import json
import os
import random
import sys

import cv2
import numpy as np


CLASSES    = ["aadhaar", "pan", "passport", "driving_license", "unknown"]
SPLITS     = ["train", "val", "test"]
SAMPLE_DIR = "D:/vision_logs/dataset_samples"
DEFAULT_DATASET = "D:/kyc_dataset"


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate generated KYC dataset.")
    parser.add_argument("--dataset", default=DEFAULT_DATASET,
                        help=f"Dataset root directory (default: {DEFAULT_DATASET})")
    parser.add_argument("--samples-out", default=SAMPLE_DIR,
                        help=f"Directory to save sample images (default: {SAMPLE_DIR})")
    args = parser.parse_args()

    if not os.path.isdir(args.dataset):
        print(f"[ERROR] Dataset directory not found: {args.dataset}")
        sys.exit(1)

    print("\nDataset Validation Report")
    print("-" * 50)

    counts = {}
    all_ok = True
    all_paths = []

    # ── 1. Count images per split / class ─────────────────────────────────────
    for split in SPLITS:
        counts[split] = {}
        for cls in CLASSES:
            cls_dir = os.path.join(args.dataset, "classifier", split, cls)
            if not os.path.isdir(cls_dir):
                counts[split][cls] = 0
                continue
            imgs = [f for f in os.listdir(cls_dir)
                    if f.lower().endswith((".jpg", ".jpeg", ".png"))]
            counts[split][cls] = len(imgs)
            all_paths.extend([os.path.join(cls_dir, f) for f in imgs])
            status = "OK" if imgs else "EMPTY"
            print(f"  classifier/{split}/{cls:<20} {len(imgs):>6} images  {status}")

    # ── 2. Check image dimensions ─────────────────────────────────────────────
    print()
    if all_paths:
        sample_paths = random.sample(all_paths, min(20, len(all_paths)))
        shapes = set()
        for p in sample_paths:
            img = cv2.imread(p)
            if img is not None:
                shapes.add(img.shape[:2])
        if len(shapes) <= 3:
            print(f"  Image dimensions: {shapes}  OK")
        else:
            print(f"  Image dimensions: {len(shapes)} different shapes — check augmentation")
            all_ok = False

    # ── 3. OCR annotations ────────────────────────────────────────────────────
    ann_path = os.path.join(args.dataset, "ocr", "annotations.json")
    if os.path.exists(ann_path):
        try:
            with open(ann_path, "r", encoding="utf-8") as f:
                ann = json.load(f)
            n_imgs = len(ann.get("images", []))
            n_anns = len(ann.get("annotations", []))
            print(f"  OCR annotations:  {n_imgs} images, {n_anns} annotations  OK")
        except json.JSONDecodeError as exc:
            print(f"  OCR annotations:  INVALID JSON — {exc}  FAIL")
            all_ok = False
    else:
        print(f"  OCR annotations:  NOT FOUND at {ann_path}  FAIL")
        all_ok = False

    # ── 4. Class balance ──────────────────────────────────────────────────────
    print()
    train_counts = counts.get("train", {})
    non_zero = {k: v for k, v in train_counts.items() if v > 0}
    if non_zero:
        avg = sum(non_zero.values()) / len(non_zero)
        imbalanced = [
            k for k, v in non_zero.items()
            if abs(v - avg) / avg > 0.10
        ]
        if imbalanced:
            print(f"  Class balance:    IMBALANCED ({', '.join(imbalanced)} off >10%)  WARN")
        else:
            print(f"  Class balance:    BALANCED  OK")

    # ── 5. Save sample images ─────────────────────────────────────────────────
    os.makedirs(args.samples_out, exist_ok=True)
    if all_paths:
        samples = random.sample(all_paths, min(5, len(all_paths)))
        for i, src in enumerate(samples):
            img = cv2.imread(src)
            if img is not None:
                dst = os.path.join(args.samples_out, f"sample_{i:02d}.jpg")
                cv2.imwrite(dst, img)
        print(f"\n  Sample images saved to: {args.samples_out}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("-" * 50)
    total_train = sum(counts.get("train", {}).values())
    total_val   = sum(counts.get("val",   {}).values())
    total_test  = sum(counts.get("test",  {}).values())
    print(f"  Total train: {total_train:,}  |  val: {total_val:,}  |  test: {total_test:,}")
    if all_ok:
        print("\n  Dataset ready for training")
    else:
        print("\n  Dataset has issues — see above")
        sys.exit(1)


if __name__ == "__main__":
    main()
