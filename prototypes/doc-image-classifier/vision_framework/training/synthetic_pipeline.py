"""
SyntheticTrainingPipeline — end-to-end: generate → split → train → evaluate.

Single Responsibility: orchestrate the full workflow for producing a trained
model from a reference dataset using synthetic augmentation.

Steps:
  1. Load reference dataset (e.g. MIDV-500 or any folder of labelled images)
  2. Analyse dataset distribution
  3. Generate synthetic samples using SyntheticGenerator
  4. Split into train/val/test (70/15/15)
  5. Train model with ModelTrainer
  6. Evaluate on test split with ModelEvaluator
  7. Save and register model if it meets the accuracy threshold
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Optional

from vision_framework.core.data.dataset_manager import DatasetManager
from vision_framework.core.data.synthetic_generator import SyntheticGenerator
from vision_framework.core.engine.model_registry import ModelRegistry
from vision_framework.core.interfaces.base_model import BaseModel
from vision_framework.training.trainer import ModelTrainer
from vision_framework.training.evaluator import ModelEvaluator

logger = logging.getLogger(__name__)


class SyntheticTrainingPipeline:
    """
    Orchestrates the complete synthetic data training workflow.

    Fully generic — pass any BaseModel and any dataset root.
    """

    def __init__(
        self,
        min_accuracy_threshold: float = 0.80,
        synthetic_count_per_class: int = 200,
    ) -> None:
        """
        Parameters
        ----------
        min_accuracy_threshold:
            Model must achieve this test accuracy to be registered.
        synthetic_count_per_class:
            Number of synthetic images to generate per class.
        """
        self._min_accuracy = min_accuracy_threshold
        self._synthetic_count = synthetic_count_per_class
        self._trainer = ModelTrainer()
        self._evaluator = ModelEvaluator()

    def run(
        self,
        model: BaseModel,
        reference_dataset_path: str,
        output_dir: str,
        epochs: int = 20,
        register_if_good: bool = True,
    ) -> dict:
        """
        Execute the full synthetic training pipeline.

        Parameters
        ----------
        model:
            Unloaded BaseModel to train.
        reference_dataset_path:
            Path to folder containing class sub-directories of reference images.
        output_dir:
            Working directory for generated data and checkpoints.
        epochs:
            Maximum training epochs.
        register_if_good:
            If True and test accuracy meets threshold, register in ModelRegistry.

        Returns
        -------
        dict: per-step results, final accuracy, model_registered.
        """
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        results = {}

        # Step 1 & 2: Inspect reference dataset
        logger.info("SyntheticPipeline: analysing reference dataset at %s", reference_dataset_path)
        dataset = DatasetManager(reference_dataset_path)
        counts = dataset.count_per_class()
        results["reference_counts"] = counts
        logger.info("Classes found: %s", counts)

        # Step 3: Generate synthetic data per class
        synthetic_root = out / "synthetic"
        for cls in dataset.get_classes():
            class_dir = Path(reference_dataset_path) / cls
            gen = SyntheticGenerator(template=self._load_first_image(class_dir))
            gen_result = gen.generate_from_dataset(
                reference_dataset_path=str(class_dir),
                count=self._synthetic_count,
                output_dir=str(synthetic_root / cls),
                class_label=cls,
            )
            logger.info("Generated %d samples for class '%s'.", gen_result["generated_count"], cls)

        results["synthetic_root"] = str(synthetic_root)

        # Step 4: Split synthetic data
        split_root = out / "splits"
        split_dataset = DatasetManager(str(synthetic_root))
        split_counts = split_dataset.create_splits(str(split_root))
        results["split_counts"] = split_counts

        # Step 5: Train
        logger.info("SyntheticPipeline: starting training...")
        train_result = self._trainer.train(
            model=model,
            dataset_path=str(split_root),
            epochs=epochs,
            output_path=str(out / "checkpoints"),
            augment=True,
        )
        results["training"] = train_result
        logger.info("Training complete: %s", train_result)

        # Step 6: Load best checkpoint and evaluate
        ckpt_path = train_result.get("checkpoint_path")
        if ckpt_path and Path(ckpt_path).exists():
            model.load(ckpt_path)

        eval_result = self._evaluator.evaluate(model, str(split_root), split="test")
        results["evaluation"] = eval_result
        accuracy = eval_result.get("accuracy", 0.0)
        logger.info("Test accuracy: %.4f", accuracy)

        # Step 7: Register if threshold met
        model_registered = False
        if register_if_good and accuracy >= self._min_accuracy:
            registry = ModelRegistry()
            registry.register(model.model_name, model, model_path=ckpt_path)
            model_registered = True
            logger.info(
                "SyntheticPipeline: model '%s' registered (accuracy=%.4f >= %.4f).",
                model.model_name, accuracy, self._min_accuracy,
            )
        elif accuracy < self._min_accuracy:
            logger.warning(
                "SyntheticPipeline: model accuracy %.4f < threshold %.4f; not registering.",
                accuracy, self._min_accuracy,
            )

        results["model_registered"] = model_registered
        results["final_accuracy"] = accuracy
        results["success"] = True
        return results

    @staticmethod
    def _load_first_image(class_dir: Path):
        """Load the first readable image from a class directory."""
        import cv2
        for ext in ("*.jpg", "*.jpeg", "*.png"):
            for p in class_dir.glob(ext):
                img = cv2.imread(str(p))
                if img is not None:
                    return img
        raise ValueError(f"No readable images in '{class_dir}'.")
