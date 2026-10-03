"""
ModelEvaluator — comprehensive model evaluation with metrics reporting.

Single Responsibility: compute accuracy, precision, recall, F1, and
confusion matrix for any BaseModel on any test dataset.
"""

import logging
from typing import Dict, List, Optional

from vision_framework.core.interfaces.base_model import BaseModel
from vision_framework.core.data.dataset_manager import DatasetManager

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """
    Evaluates a BaseModel against a labelled test dataset.

    Produces a detailed report including per-class precision, recall, and F1.
    The evaluator is fully generic — it works with any model and any dataset.
    """

    def evaluate(
        self,
        model: BaseModel,
        dataset_path: str,
        split: str = "test",
        batch_size: int = 32,
    ) -> dict:
        """
        Run evaluation on the *split* of the dataset.

        Parameters
        ----------
        model:
            Loaded BaseModel instance.
        dataset_path:
            Root directory of the dataset.
        split:
            Dataset split to evaluate against ('test', 'val', 'train').
        batch_size:
            Number of samples per batch.

        Returns
        -------
        dict: accuracy, per_class_metrics, confusion_matrix, total_samples.
        """
        dataset = DatasetManager(dataset_path)
        classes = sorted(dataset.get_classes())
        class_to_idx = {cls: i for i, cls in enumerate(classes)}
        num_classes = len(classes)

        # Confusion matrix [true][pred]
        confusion: List[List[int]] = [[0] * num_classes for _ in range(num_classes)]

        total = 0
        correct = 0

        for batch in dataset.iterate_batches(split, batch_size):
            for img, true_label in batch:
                pred = model.predict(img)
                pred_label = pred.get("predictions", "unknown")

                true_idx = class_to_idx.get(true_label, -1)
                pred_idx = class_to_idx.get(pred_label, -1)

                if true_idx >= 0 and pred_idx >= 0:
                    confusion[true_idx][pred_idx] += 1
                    if true_idx == pred_idx:
                        correct += 1
                total += 1

        accuracy = round(correct / max(total, 1), 4)

        # Per-class metrics
        per_class = {}
        for i, cls in enumerate(classes):
            tp = confusion[i][i]
            fp = sum(confusion[j][i] for j in range(num_classes)) - tp
            fn = sum(confusion[i][j] for j in range(num_classes)) - tp
            precision = tp / max(tp + fp, 1)
            recall = tp / max(tp + fn, 1)
            f1 = 2 * precision * recall / max(precision + recall, 1e-9)
            per_class[cls] = {
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "support": sum(confusion[i]),
            }

        logger.info(
            "ModelEvaluator: accuracy=%.4f on %d samples.", accuracy, total
        )

        return {
            "accuracy": accuracy,
            "total_samples": total,
            "per_class_metrics": per_class,
            "confusion_matrix": confusion,
            "class_names": classes,
        }

    def generate_report(self, evaluation_result: dict) -> str:
        """
        Format an evaluation result dict as a human-readable text report.

        Parameters
        ----------
        evaluation_result:
            Dict returned by evaluate().

        Returns
        -------
        str — Multi-line text report.
        """
        lines = [
            "=" * 60,
            "MODEL EVALUATION REPORT",
            "=" * 60,
            f"Overall Accuracy : {evaluation_result['accuracy'] * 100:.2f}%",
            f"Total Samples    : {evaluation_result['total_samples']}",
            "",
            f"{'Class':<25} {'Precision':>10} {'Recall':>10} {'F1':>10} {'Support':>10}",
            "-" * 65,
        ]
        for cls, metrics in evaluation_result.get("per_class_metrics", {}).items():
            lines.append(
                f"{cls:<25} {metrics['precision']:>10.4f} {metrics['recall']:>10.4f} "
                f"{metrics['f1']:>10.4f} {metrics['support']:>10}"
            )
        lines.append("=" * 60)
        return "\n".join(lines)
