# KYC Document Classification

A research prototype for multi-class document type recognition. The dataset is structured across three tasks — document classification, face verification, and OCR — each with independent train/validation/test splits. The intent was to explore how accurately a classifier can distinguish between document types from image input alone, without relying on the text content.

---

## Tasks

| Task | What It Does |
|---|---|
| Classifier | Multi-class document type recognition across five classes |
| Face | Face pair matching for identity verification |
| OCR | Document image to text extraction |

---

## Dataset Structure

```
classifier/
    raw/            ← Unsplit source images before preprocessing
    train/          ← Training set (weight updates)
    val/            ← Validation set (hyperparameter tuning, early stopping)
    test/           ← Held-out evaluation set; not used during training
    [each split contains class_a/ class_b/ class_c/ class_d/ unknown/]

face/
    pairs/          ← Face pair image sets for verification

ocr/
    images/         ← Document images for OCR training
```

---

## Document Classes

| Class | Description |
|---|---|
| class_a | Single-sided card format identity document |
| class_b | Government-issued card format credential |
| class_c | Tax authority-issued card format document |
| class_d | Booklet format travel document with data page |
| unknown | Rejected, ambiguous, or out-of-scope documents |

---

## Notes

This was a prototype built to understand the classification problem structure and data requirements. No production deployment was intended or built.
