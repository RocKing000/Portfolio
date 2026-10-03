"""
dataset_builder.py — Orchestrates complete KYC synthetic dataset generation.

Generates clean template images + augmented variants for:
  - Document classifier  (train/val/test split)
  - OCR annotation       (COCO-format JSON)
  - Face matcher pairs   (CSV with match labels)

Usage:
    from training.data_generation.dataset_builder import DatasetBuilder
    builder = DatasetBuilder("D:/kyc_dataset", config)
    stats = builder.generate_full_dataset(samples_per_class=1000, augmentations_per_sample=5)
"""

import json
import os
import random
import time
from datetime import datetime, timedelta
from typing import Optional

import cv2
import numpy as np

from .templates.aadhaar_template import AadhaarTemplate
from .templates.pan_template import PANTemplate
from .templates.passport_template import PassportTemplate
from .templates.dl_template import DrivingLicenseTemplate
from .augmentation.geometric import apply_geometric
from .augmentation.photometric import apply_photometric
from .augmentation.environmental import add_background, add_shadow, add_glare
from .augmentation.camera import apply_camera_effects
from .fake_data.name_generator import NameGenerator
from .fake_data.number_generator import NumberGenerator
from .fake_data.address_generator import AddressGenerator
from .fake_data.face_generator import FaceGenerator
from .config.aadhaar_config import AADHAAR_CONFIG
from .config.pan_config import PAN_CONFIG
from .config.passport_config import PASSPORT_CONFIG
from .config.dl_config import DL_CONFIG


class DatasetBuilder:
    """
    Orchestrates complete KYC dataset generation for all three models.

    Output structure:
        output_dir/
        ├── classifier/
        │   ├── train/{aadhaar,pan,passport,driving_license,unknown}/
        │   ├── val/{...}/
        │   └── test/{...}/
        ├── ocr/
        │   ├── images/
        │   └── annotations.json
        └── face/
            ├── pairs/
            └── annotations.csv
    """

    CLASSES = ["aadhaar", "pan", "passport", "driving_license"]
    TARGET_SIZE = (640, 400)  # (width, height) — all saved images normalised to this

    def __init__(self, output_dir: str, config: dict) -> None:
        self.output_dir = output_dir
        self.config = config
        self.jpg_quality = config.get("jpg_quality", 92)

        # Templates
        self._templates = {
            "aadhaar":          AadhaarTemplate(AADHAAR_CONFIG),
            "pan":              PANTemplate(PAN_CONFIG),
            "passport":         PassportTemplate(PASSPORT_CONFIG),
            "driving_license":  DrivingLicenseTemplate(DL_CONFIG),
        }

        # Generators
        self._name_gen    = NameGenerator()
        self._num_gen     = NumberGenerator()
        self._addr_gen    = AddressGenerator()
        self._face_gen    = FaceGenerator()

        # OCR annotation state
        self._ocr_image_id  = 0
        self._ocr_ann_id    = 0
        self._ocr_images    = []
        self._ocr_anns      = []

        self._setup_dirs()

    # ── public API ────────────────────────────────────────────────────────────

    def generate_full_dataset(
        self,
        samples_per_class: int = 1000,
        augmentations_per_sample: int = 5,
    ) -> dict:
        """
        Generate the complete training dataset.

        Default: 1000 × 4 classes × 5 augments = 20 000 images.

        Returns a stats dict: class → count.
        """
        stats = {}
        t0 = time.time()

        for class_name in self.CLASSES:
            print(f"\n[DatasetBuilder] Generating '{class_name}' "
                  f"({samples_per_class} samples × {augmentations_per_sample} augments)…")
            class_stats = self._generate_class(
                class_name,
                self._templates[class_name],
                samples_per_class,
                augmentations_per_sample,
            )
            stats[class_name] = class_stats

        # Negative / unknown samples
        n_negatives = max(50, samples_per_class // 5)
        print(f"\n[DatasetBuilder] Generating {n_negatives} negative samples…")
        self._generate_negatives(n_negatives, augmentations_per_sample)

        # Write OCR annotations
        self._write_ocr_annotations()

        elapsed = time.time() - t0
        total = sum(s.get("total", 0) for s in stats.values())
        print(f"\n[DatasetBuilder] Done — {total} images in {elapsed / 60:.1f} min")
        return stats

    # ── per-class generation ──────────────────────────────────────────────────

    def _generate_class(
        self,
        class_name: str,
        template,
        n_samples: int,
        n_augments: int,
    ) -> dict:
        generated = 0
        for i in range(n_samples):
            fake_data = self._generate_fake_data(class_name)

            # 1. Generate clean template image
            try:
                clean = template.generate(fake_data)
            except Exception as exc:
                print(f"  [WARN] template.generate failed at sample {i}: {exc}")
                continue

            # 2. Save clean image (raw, not split)
            raw_dir = os.path.join(self.output_dir, "classifier", "raw", class_name)
            os.makedirs(raw_dir, exist_ok=True)
            raw_path = os.path.join(raw_dir, f"{class_name}_{i:05d}_clean.jpg")
            self._save_jpg(clean, raw_path)

            # 3. Register for OCR annotation (use clean image)
            self._register_ocr_sample(
                clean, raw_path, class_name,
                template.get_field_bounding_boxes(), fake_data,
            )

            # 4. Augmented versions → classifier split
            split = self._get_split(i, n_samples)
            out_dir = os.path.join(
                self.output_dir, "classifier", split, class_name
            )
            os.makedirs(out_dir, exist_ok=True)

            for aug_idx in range(n_augments):
                try:
                    aug = self._augment(clean.copy())
                except Exception:
                    aug = clean.copy()
                # Normalise to consistent classifier input size
                aug = cv2.resize(aug, self.TARGET_SIZE, interpolation=cv2.INTER_AREA)
                aug_path = os.path.join(
                    out_dir, f"{class_name}_{i:05d}_aug{aug_idx}.jpg"
                )
                self._save_jpg(aug, aug_path)
                generated += 1

            if i > 0 and i % 100 == 0:
                print(f"  {class_name}: {i}/{n_samples}")

        return {"total": generated, "class": class_name}

    # ── negative (unknown) samples ────────────────────────────────────────────

    def _generate_negatives(self, n: int, n_augments: int) -> None:
        """Generate non-document images for the 'unknown' class."""
        for i in range(n):
            img = self._random_non_document()
            split = self._get_split(i, n)
            out_dir = os.path.join(self.output_dir, "classifier", split, "unknown")
            os.makedirs(out_dir, exist_ok=True)
            for aug_idx in range(max(1, n_augments // 2)):
                try:
                    aug = apply_photometric(img.copy())
                except Exception:
                    aug = img.copy()
                self._save_jpg(
                    aug,
                    os.path.join(out_dir, f"unknown_{i:05d}_aug{aug_idx}.jpg"),
                )

    def _random_non_document(self) -> np.ndarray:
        """Generate a random non-document image (noise, gradient, or text)."""
        h, w = 480, 640
        choice = random.randint(0, 3)
        if choice == 0:
            img = np.random.randint(0, 256, (h, w, 3), dtype=np.uint8)
            img = cv2.GaussianBlur(img, (11, 11), 0)
        elif choice == 1:
            img = np.zeros((h, w, 3), dtype=np.uint8)
            for c in range(3):
                img[:, :, c] = np.linspace(
                    random.randint(0, 100),
                    random.randint(150, 255), w,
                ).astype(np.uint8)
        elif choice == 2:
            val = random.randint(180, 240)
            img = np.full((h, w, 3), val, dtype=np.uint8)
            for _ in range(random.randint(5, 20)):
                x, y = random.randint(0, w), random.randint(0, h)
                cv2.putText(
                    img, "Lorem ipsum",
                    (x, y), cv2.FONT_HERSHEY_SIMPLEX,
                    random.uniform(0.5, 1.5),
                    (random.randint(0, 100),) * 3, 1,
                )
        else:
            base = random.randint(30, 200)
            img = np.full((h, w, 3), base, dtype=np.uint8)
            for _ in range(random.randint(3, 10)):
                x1, y1 = random.randint(0, w), random.randint(0, h)
                x2 = min(w, x1 + random.randint(50, 300))
                y2 = min(h, y1 + random.randint(30, 200))
                color = tuple(random.randint(0, 255) for _ in range(3))
                cv2.rectangle(img, (x1, y1), (x2, y2), color, -1)
        return img

    # ── OCR annotation ────────────────────────────────────────────────────────

    def _register_ocr_sample(
        self,
        image: np.ndarray,
        image_path: str,
        class_name: str,
        bboxes: dict,
        fake_data: dict,
    ) -> None:
        h, w = image.shape[:2]
        self._ocr_image_id += 1
        self._ocr_images.append({
            "id": self._ocr_image_id,
            "file_name": os.path.basename(image_path),
            "width": w,
            "height": h,
            "doc_type": class_name,
        })

        # Field name → category id mapping
        cat_map = {
            "aadhaar_number": 1, "name": 2, "name_english": 2,
            "dob": 3, "pan_number": 4, "mrz_line1": 5,
            "mrz_line2": 5, "father_name": 6, "dl_number": 7,
            "passport_number": 8, "gender": 9, "valid_till": 10,
        }

        for field_name, bbox in bboxes.items():
            self._ocr_ann_id += 1
            x, y, bw, bh = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
            # Get field text value
            text_val = str(fake_data.get(
                field_name,
                fake_data.get("name_english", ""),
            ))
            self._ocr_anns.append({
                "id": self._ocr_ann_id,
                "image_id": self._ocr_image_id,
                "category_id": cat_map.get(field_name, 99),
                "bbox": [x, y, bw, bh],
                "area": bw * bh,
                "segmentation": [],
                "iscrowd": 0,
                "text": text_val,
                "field_name": field_name,
            })

    def _write_ocr_annotations(self) -> None:
        ocr_dir = os.path.join(self.output_dir, "ocr")
        os.makedirs(ocr_dir, exist_ok=True)
        annotations = {
            "info": {
                "description": "KYC OCR dataset",
                "version": "1.0",
                "date_created": datetime.now().isoformat(),
            },
            "categories": [
                {"id": 1,  "name": "aadhaar_number"},
                {"id": 2,  "name": "name"},
                {"id": 3,  "name": "dob"},
                {"id": 4,  "name": "pan_number"},
                {"id": 5,  "name": "mrz"},
                {"id": 6,  "name": "father_name"},
                {"id": 7,  "name": "dl_number"},
                {"id": 8,  "name": "passport_number"},
                {"id": 9,  "name": "gender"},
                {"id": 10, "name": "valid_till"},
            ],
            "images": self._ocr_images,
            "annotations": self._ocr_anns,
        }
        ann_path = os.path.join(ocr_dir, "annotations.json")
        with open(ann_path, "w", encoding="utf-8") as f:
            json.dump(annotations, f, ensure_ascii=False, indent=2)
        print(f"[DatasetBuilder] OCR annotations: {ann_path} "
              f"({len(self._ocr_anns)} entries)")

    # ── fake data generation ──────────────────────────────────────────────────

    def _generate_fake_data(self, doc_type: str) -> dict:
        gender = random.choice(["M", "F"])
        name = self._name_gen.generate(gender)
        dob = self._random_dob()
        addr = self._addr_gen.generate()
        face = self._face_gen.generate(120, 150)

        base = {
            "name_hindi":   name["full_hi"],
            "name_english": name["full_en"],
            "dob":          dob,
            "gender":       "Male" if gender == "M" else "Female",
            "address":      addr,
            "face_image":   face,
        }

        if doc_type == "aadhaar":
            base["aadhaar_number"] = self._num_gen.generate_aadhaar()
        elif doc_type == "pan":
            base["pan_number"]  = self._num_gen.generate_pan()
            father               = self._name_gen.generate("M")
            base["father_name"] = father["full_en"]
            base["name"]        = name["full_en"]
        elif doc_type == "passport":
            base["passport_number"] = self._num_gen.generate_passport_number()
            base["expiry_date"]     = self._future_date(10)
            base["issue_date"]      = self._past_date(5)
            base["place_of_birth"]  = random.choice(
                ["Delhi", "Mumbai", "Chennai", "Kolkata", "Bangalore"]
            )
        elif doc_type == "driving_license":
            base["dl_number"]   = self._num_gen.generate_dl_number()
            base["valid_till"]  = self._future_date(20)
            father               = self._name_gen.generate("M")
            base["father_name"] = father["full_en"]
            base["cov"]         = random.choice(
                ["LMV", "MCWG", "LMV, MCWG", "HMV", "LMV, HMV"]
            )

        return base

    # ── augmentation pipeline ─────────────────────────────────────────────────

    def _augment(self, image: np.ndarray) -> np.ndarray:
        image = apply_photometric(image)
        if random.random() < 0.70:
            image = add_background(image)
        if random.random() < 0.30:
            image = add_shadow(image)
        if random.random() < 0.15:
            image = add_glare(image)
        if random.random() < 0.30:
            image = apply_camera_effects(image)
        image = apply_geometric(image)
        return image

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _get_split(idx: int, total: int) -> str:
        r = idx / max(total, 1)
        if r < 0.70:
            return "train"
        elif r < 0.85:
            return "val"
        else:
            return "test"

    @staticmethod
    def _random_dob(min_age: int = 18, max_age: int = 80) -> str:
        days_back = random.randint(min_age * 365, max_age * 365)
        dob = datetime.now() - timedelta(days=days_back)
        return dob.strftime("%d/%m/%Y")

    @staticmethod
    def _future_date(years: int = 10) -> str:
        dt = datetime.now() + timedelta(days=years * 365 + random.randint(-180, 180))
        return dt.strftime("%d %b %Y").upper()

    @staticmethod
    def _past_date(years: int = 5) -> str:
        dt = datetime.now() - timedelta(days=years * 365 + random.randint(-180, 180))
        return dt.strftime("%d %b %Y").upper()

    def _save_jpg(self, image: np.ndarray, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        cv2.imwrite(path, image, [cv2.IMWRITE_JPEG_QUALITY, self.jpg_quality])

    def _setup_dirs(self) -> None:
        splits = ["train", "val", "test"]
        classes = self.CLASSES + ["unknown"]
        for split in splits:
            for cls in classes:
                os.makedirs(
                    os.path.join(self.output_dir, "classifier", split, cls),
                    exist_ok=True,
                )
        os.makedirs(os.path.join(self.output_dir, "ocr", "images"), exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "face", "pairs"), exist_ok=True)
