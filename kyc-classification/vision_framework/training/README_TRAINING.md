# KYC Model Training Guide

This guide walks through generating synthetic training data locally,
uploading it to Google Drive, and training three models on Google Colab.

---

## Option A — VS Code with Colab Extension (Recommended)

### Setup
1. Install VS Code extension: **"Colab"** by Google
2. Open `training/notebooks/01_classifier_training.ipynb` in VS Code
3. Click **"Connect to Colab"** in the top-right corner
4. Select **Runtime → T4 GPU**
5. Run all cells (`Ctrl+F9`)

### Local training (no GPU)
1. Open `01_classifier_training.ipynb` in VS Code
2. Select the **local Python kernel**
3. Run all cells — training time: ~2–4 hours on CPU

### Verify setup first
Run `00_verify_setup.ipynb` before starting training.  
Takes ~2 minutes. Confirms dataset and model forward pass work correctly.

## Option B — Google Colab (browser)
1. Go to [colab.research.google.com](https://colab.research.google.com)
2. Upload `01_classifier_training.ipynb`
3. **Runtime → Change runtime type → T4 GPU**
4. Run all cells

> The notebook auto-detects whether it's running in Colab or VS Code
> and sets `DATASET_PATH` / `MODEL_SAVE_PATH` accordingly.

---

## Models Being Trained

| # | Model | Architecture | Task |
|---|-------|-------------|------|
| 1 | Document Classifier | EfficientNet-B0 | Aadhaar / PAN / Passport / DL / Unknown |
| 2 | OCR Text Detector | CRAFT (fine-tuned) | Locate and read document fields |
| 3 | Face Verifier | ArcFace (InsightFace) | Match selfie to document photo |

---

## Step 1 — Install Dependencies

```bash
pip install albumentations pillow faker opencv-python
pip install torch torchvision timm              # for local testing
pip install onnxruntime onnx gdown              # for deployment
```

---

## Step 2 — Generate Dataset (Local, ~45 min)

```bash
cd "d:/Documentation Recognition"

# Full dataset (~20 000 images, ~2–4 GB):
python -m vision_framework.training.scripts.generate_dataset \
    --output D:/kyc_dataset \
    --samples 1000 \
    --augments 5

# Quick test (600 images, ~2 min):
python -m vision_framework.training.scripts.generate_dataset --quick
```

**Output structure:**
```
D:/kyc_dataset/
├── classifier/
│   ├── train/  aadhaar/  pan/  passport/  driving_license/  unknown/
│   ├── val/    ...
│   └── test/   ...
└── ocr/
    ├── images/
    └── annotations.json
```

---

## Step 3 — Validate Dataset

```bash
python -m vision_framework.training.scripts.validate_dataset \
    --dataset D:/kyc_dataset
```

Checks counts, balance, dimensions, and annotation integrity.
Saves 5 sample images to `D:/vision_logs/dataset_samples/` for visual review.

---

## Step 4 — Upload to Google Drive

### Option A — Google Drive API (automated)
```bash
# 1. Create OAuth credentials at console.cloud.google.com
# 2. Download credentials.json
python -m vision_framework.training.scripts.upload_to_drive \
    --dataset D:/kyc_dataset \
    --folder kyc_training_data \
    --credentials credentials.json
```

### Option B — Manual upload (simpler)
1. Compress: `Compress-Archive D:/kyc_dataset kyc_dataset.zip`
2. Upload `kyc_dataset.zip` to Google Drive via browser
3. In Colab: `!unzip /content/drive/MyDrive/kyc_dataset.zip`

---

## Step 5 — Train on Google Colab

### Classifier (Notebook 01)
1. Open `training/notebooks/01_classifier_training.ipynb` in Colab
2. Runtime → Change runtime type → **T4 GPU** (free tier)
3. Mount Drive and set `DATASET_PATH`
4. Run all cells
5. Training: ~20–30 min on T4 GPU
6. Best weights saved to `kyc_models/classifier_best.pth` and `classifier.onnx`

### OCR Detector (Notebook 02)
1. Open `training/notebooks/02_ocr_training.ipynb`
2. Fine-tunes pretrained CRAFT on synthetic Indian documents
3. Training: ~45–60 min on T4 GPU

### Face Verifier (Notebook 03)
1. Open `training/notebooks/03_face_training.ipynb`
2. Fine-tunes InsightFace ArcFace on synthetic face pairs
3. Training: ~30–45 min on T4 GPU

---

## Step 6 — Download Weights

```bash
python -m vision_framework.training.scripts.download_weights \
    --drive-folder YOUR_DRIVE_FOLDER_ID \
    --output vision_framework/models/
```

Find your folder ID in the Google Drive URL:
`https://drive.google.com/drive/folders/THIS_IS_THE_ID`

---

## Step 7 — Restart Framework

```bash
# Kill and restart the FastAPI server
uvicorn vision_framework.api.fastapi_app:app \
    --host 127.0.0.1 --port 8080 --reload
```

The framework auto-detects `models/classifier.onnx` on startup
and switches from rule-based classification to the trained model.

---

## Expected Accuracy After Training

| Model | Metric | Expected |
|-------|--------|----------|
| Classifier | Test accuracy | 92–96% |
| OCR | Field extraction accuracy | 85–90% |
| Face match | AUC / verification accuracy | 94–97% |

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'albumentations'`**
```bash
pip install albumentations
```
The augmentation pipeline falls back to pure OpenCV if albumentations
is missing — data generation will still work, just with fewer augments.

**Template generates blank image**
Check that PIL/Pillow is >= 10.0.0: `pip install --upgrade pillow`

**Colab runs out of disk**
Use `--samples 500 --augments 3` for a smaller dataset (~5 000 images, ~600 MB).

**ONNX model not loading**
Ensure `onnxruntime` is installed: `pip install onnxruntime`
The framework logs `[MODEL] Loaded classifier from models/classifier.onnx` on success.
