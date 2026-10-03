"""
ModelTrainer — generic training loop for any BaseModel + dataset.

Single Responsibility: run the training loop, checkpointing, and early
stopping for any model that exposes a load/predict/save interface.
Plugin provides the model architecture; framework provides the loop.
"""

import logging
import time
from pathlib import Path
from typing import Optional

from vision_framework.core.interfaces.base_model import BaseModel
from vision_framework.core.data.dataset_manager import DatasetManager

logger = logging.getLogger(__name__)


class ModelTrainer:
    """
    Generic trainer that works with any BaseModel and any folder-structured dataset.

    The trainer:
      1. Iterates the dataset in batches.
      2. Calls model.predict() to get predictions.
      3. Uses a simple delta-loss early-stopping criterion.
      4. Saves the best checkpoint based on validation accuracy.
    """

    def __init__(self, learning_rate: float = 1e-3, patience: int = 5) -> None:
        """
        Parameters
        ----------
        learning_rate:
            Optimizer learning rate (forwarded to PyTorch optimiser).
        patience:
            Early-stopping patience in epochs.
        """
        self._lr = learning_rate
        self._patience = patience

    def train(
        self,
        model: BaseModel,
        dataset_path: str,
        epochs: int,
        output_path: str,
        augment: bool = True,
        batch_size: int = 32,
    ) -> dict:
        """
        Train *model* on the dataset at *dataset_path*.

        Parameters
        ----------
        model:
            Unloaded or loaded BaseModel instance.
        dataset_path:
            Root of a dataset split into train/ and val/ sub-dirs.
        epochs:
            Maximum number of training epochs.
        output_path:
            Directory where the best checkpoint will be saved.
        augment:
            If True, training batches are augmented on the fly.
        batch_size:
            Number of samples per gradient step.

        Returns
        -------
        dict: epochs_run, best_val_accuracy, checkpoint_path, elapsed_ms.
        """
        try:
            import torch
            import torch.nn as nn
            import torch.optim as optim
        except ImportError:
            return {
                "success": False,
                "message": "PyTorch not available. Install it to use ModelTrainer.",
            }

        if not model.is_loaded():
            model.load()

        dataset = DatasetManager(dataset_path)
        classes = dataset.get_classes()
        class_to_idx = {cls: i for i, cls in enumerate(sorted(classes))}

        out_dir = Path(output_path)
        out_dir.mkdir(parents=True, exist_ok=True)

        # Access inner PyTorch model if available
        torch_model = getattr(model, "_model", None)
        if torch_model is None:
            return {"success": False, "message": "Model has no _model attribute (not PyTorch)."}

        device = getattr(model, "_device", "cpu")
        optimizer = optim.Adam(torch_model.parameters(), lr=self._lr)
        criterion = nn.CrossEntropyLoss()
        transform = getattr(model, "_transform", None)

        best_val_acc = 0.0
        best_ckpt = str(out_dir / f"{model.model_name}_best.pth")
        no_improve = 0
        t0 = time.perf_counter()

        for epoch in range(1, epochs + 1):
            # --- Training ---
            torch_model.train()
            train_loss = 0.0
            train_correct = 0
            train_total = 0

            for batch in dataset.iterate_batches("train", batch_size):
                images_tensors = []
                labels_tensors = []
                for img, label in batch:
                    if transform:
                        import cv2
                        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                        images_tensors.append(transform(rgb))
                    labels_tensors.append(class_to_idx.get(label, 0))

                if not images_tensors:
                    continue

                x = torch.stack(images_tensors).to(device)
                y = torch.tensor(labels_tensors, dtype=torch.long).to(device)

                optimizer.zero_grad()
                logits = torch_model(x)
                loss = criterion(logits, y)
                loss.backward()
                optimizer.step()

                train_loss += loss.item()
                preds = logits.argmax(dim=1)
                train_correct += (preds == y).sum().item()
                train_total += len(y)

            train_acc = train_correct / max(train_total, 1)

            # --- Validation ---
            torch_model.eval()
            val_correct = 0
            val_total = 0
            with torch.no_grad():
                for batch in dataset.iterate_batches("val", batch_size):
                    for img, label in batch:
                        pred = model.predict(img)
                        if pred.get("success"):
                            predicted_label = pred.get("predictions", "")
                            if predicted_label == label:
                                val_correct += 1
                        val_total += 1

            val_acc = val_correct / max(val_total, 1)
            logger.info(
                "Epoch %d/%d — train_acc=%.3f, val_acc=%.3f",
                epoch, epochs, train_acc, val_acc,
            )

            if val_acc > best_val_acc:
                best_val_acc = val_acc
                torch.save(torch_model.state_dict(), best_ckpt)
                no_improve = 0
                logger.info("Saved best checkpoint (val_acc=%.3f) → %s", val_acc, best_ckpt)
            else:
                no_improve += 1
                if no_improve >= self._patience:
                    logger.info("Early stopping at epoch %d.", epoch)
                    break

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return {
            "success": True,
            "epochs_run": epoch,
            "best_val_accuracy": round(best_val_acc, 4),
            "checkpoint_path": best_ckpt,
            "elapsed_ms": elapsed_ms,
        }

    def evaluate(self, model: BaseModel, test_dataset_path: str) -> dict:
        """
        Evaluate a loaded model on the test split.

        Returns
        -------
        dict: accuracy, per_class_accuracy, total_samples.
        """
        dataset = DatasetManager(test_dataset_path)
        classes = dataset.get_classes()
        correct: dict = {cls: 0 for cls in classes}
        total: dict = {cls: 0 for cls in classes}

        for batch in dataset.iterate_batches("test", batch_size=1):
            for img, label in batch:
                pred = model.predict(img)
                total[label] = total.get(label, 0) + 1
                if pred.get("success") and pred.get("predictions") == label:
                    correct[label] = correct.get(label, 0) + 1

        overall_correct = sum(correct.values())
        overall_total = sum(total.values())

        per_class = {
            cls: round(correct[cls] / max(total[cls], 1), 4)
            for cls in classes
        }

        return {
            "accuracy": round(overall_correct / max(overall_total, 1), 4),
            "per_class_accuracy": per_class,
            "total_samples": overall_total,
        }
