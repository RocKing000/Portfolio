"""
test_core.py — unit tests for the Vision Framework core layer.

Tests each core module independently:
  - ImageLoader
  - ImagePreprocessor
  - ImageUtils
  - PipelineEngine
  - ModelRegistry
  - PluginManager
  - EarlyExitHandler
  - BaseProcessor / BaseDetector / BaseModel (via test doubles)
"""

import base64
import time
import unittest
from typing import Any, List, Optional, Tuple
from unittest.mock import MagicMock, patch

import numpy as np

from vision_framework.core.engine.early_exit_handler import EarlyExitHandler
from vision_framework.core.engine.model_registry import ModelRegistry
from vision_framework.core.engine.pipeline_engine import PipelineEngine
from vision_framework.core.engine.plugin_manager import PluginManager
from vision_framework.core.image.image_loader import ImageLoader
from vision_framework.core.image.image_preprocessor import ImagePreprocessor
from vision_framework.core.image.image_utils import ImageUtils
from vision_framework.core.interfaces.base_model import BaseModel
from vision_framework.core.interfaces.base_pipeline import BasePipeline
from vision_framework.core.interfaces.base_processor import BaseProcessor


# ------------------------------------------------------------------
# Test doubles
# ------------------------------------------------------------------

class _SuccessProcessor(BaseProcessor):
    @property
    def processor_name(self) -> str:
        return "success_processor"

    def validate_input(self, image: np.ndarray) -> bool:
        return image is not None and image.size > 0

    def process(self, image: np.ndarray, **kwargs) -> dict:
        return {"success": True, "image": image.copy(), "metadata": {}, "message": "ok"}


class _FailProcessor(BaseProcessor):
    @property
    def processor_name(self) -> str:
        return "fail_processor"

    def validate_input(self, image: np.ndarray) -> bool:
        return True

    def process(self, image: np.ndarray, **kwargs) -> dict:
        return {"success": False, "image": image, "metadata": {}, "message": "intentional failure"}


class _TwoStepPipeline(BasePipeline):
    def __init__(self, fail_at: Optional[str] = None):
        self._fail_at = fail_at

    def get_steps(self) -> List[Tuple[str, Any, bool]]:
        def step_a(inp, prev):
            return {"success": self._fail_at != "step_a", "message": "step_a"}

        def step_b(inp, prev):
            return {"success": self._fail_at != "step_b", "message": "step_b"}

        return [("step_a", step_a, True), ("step_b", step_b, False)]

    def execute(self, input_data: Any) -> dict:
        return PipelineEngine().run(self, input_data)


class _DummyModel(BaseModel):
    @property
    def model_name(self) -> str:
        return "dummy_model"

    def is_loaded(self) -> bool:
        return self._loaded

    def load(self, model_path: Optional[str] = None) -> bool:
        self._loaded = True
        return True

    def predict(self, input_data: Any) -> dict:
        return {"success": True, "predictions": "test", "confidence": 1.0, "message": "ok"}

    def __init__(self):
        self._loaded = False


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------

class TestImageLoader(unittest.TestCase):

    def setUp(self):
        self._image = np.zeros((100, 100, 3), dtype=np.uint8)
        self._image[50, 50] = [255, 0, 0]

    def test_to_base64_and_back(self):
        b64 = ImageLoader.to_base64(self._image)
        self.assertIsInstance(b64, str)
        decoded = ImageLoader.from_base64(b64)
        self.assertEqual(decoded.shape, self._image.shape)

    def test_from_bytes(self):
        import cv2
        _, buf = cv2.imencode(".jpg", self._image)
        img = ImageLoader.from_bytes(buf.tobytes())
        self.assertEqual(img.shape, self._image.shape)

    def test_invalid_base64_raises(self):
        with self.assertRaises(ValueError):
            ImageLoader.from_base64("not_valid_base64!!!")

    def test_invalid_bytes_raises(self):
        with self.assertRaises(ValueError):
            ImageLoader.from_bytes(b"this is not an image")


class TestImagePreprocessor(unittest.TestCase):

    def setUp(self):
        self._image = np.random.randint(0, 255, (200, 300, 3), dtype=np.uint8)

    def test_resize_by_width(self):
        resized = ImagePreprocessor.resize(self._image, width=150)
        self.assertEqual(resized.shape[1], 150)

    def test_resize_by_max_side(self):
        resized = ImagePreprocessor.resize(self._image, max_side=100)
        self.assertLessEqual(max(resized.shape[:2]), 100)

    def test_to_grayscale(self):
        gray = ImagePreprocessor.to_grayscale(self._image)
        self.assertEqual(len(gray.shape), 2)

    def test_normalize_range(self):
        norm = ImagePreprocessor.normalize(self._image)
        self.assertEqual(norm.dtype, np.float32)

    def test_input_not_mutated(self):
        original = self._image.copy()
        ImagePreprocessor.adjust_contrast(self._image, alpha=2.0)
        np.testing.assert_array_equal(self._image, original)


class TestImageUtils(unittest.TestCase):

    def setUp(self):
        self._image = np.zeros((100, 100, 3), dtype=np.uint8)

    def test_crop_valid(self):
        cropped = ImageUtils.crop(self._image, (10, 10, 50, 50))
        self.assertEqual(cropped.shape, (50, 50, 3))

    def test_crop_invalid_raises(self):
        with self.assertRaises(ValueError):
            ImageUtils.crop(self._image, (200, 200, 50, 50))

    def test_iou_identical_boxes(self):
        bbox = (0, 0, 50, 50)
        self.assertAlmostEqual(ImageUtils.calculate_iou(bbox, bbox), 1.0)

    def test_iou_non_overlapping(self):
        self.assertAlmostEqual(
            ImageUtils.calculate_iou((0, 0, 10, 10), (20, 20, 10, 10)), 0.0
        )

    def test_is_valid_image_true(self):
        self.assertTrue(ImageUtils.is_valid_image(self._image))

    def test_is_valid_image_false(self):
        self.assertFalse(ImageUtils.is_valid_image(None))
        self.assertFalse(ImageUtils.is_valid_image(np.array([])))


class TestPipelineEngine(unittest.TestCase):

    def test_all_steps_pass(self):
        pipeline = _TwoStepPipeline()
        result = pipeline.execute(np.zeros((10, 10, 3), dtype=np.uint8))
        self.assertTrue(result["success"])
        self.assertIn("step_a", result["result"])
        self.assertIn("step_b", result["result"])

    def test_required_step_failure_halts(self):
        pipeline = _TwoStepPipeline(fail_at="step_a")
        result = pipeline.execute(None)
        self.assertFalse(result["success"])
        self.assertEqual(result["failed_at_step"], "step_a")

    def test_optional_step_failure_continues(self):
        pipeline = _TwoStepPipeline(fail_at="step_b")
        result = pipeline.execute(None)
        # step_b is optional (is_required=False) so pipeline should succeed
        self.assertTrue(result["success"])

    def test_step_times_populated(self):
        pipeline = _TwoStepPipeline()
        result = pipeline.execute(None)
        self.assertIn("step_a", result["step_times"])
        self.assertGreater(result["total_time_ms"], 0)


class TestModelRegistry(unittest.TestCase):

    def setUp(self):
        # Reset singleton for each test
        ModelRegistry._instance = None

    def test_register_and_get(self):
        reg = ModelRegistry()
        model = _DummyModel()
        reg.register("test_model", model)
        retrieved = reg.get("test_model")
        self.assertIs(retrieved, model)
        self.assertTrue(retrieved.is_loaded())

    def test_get_unknown_raises(self):
        reg = ModelRegistry()
        with self.assertRaises(KeyError):
            reg.get("nonexistent")

    def test_is_registered(self):
        reg = ModelRegistry()
        reg.register("m", _DummyModel())
        self.assertTrue(reg.is_registered("m"))
        self.assertFalse(reg.is_registered("nope"))

    def test_list_models(self):
        reg = ModelRegistry()
        reg.register("m1", _DummyModel())
        models = reg.list_models()
        self.assertTrue(any(m["name"] == "m1" for m in models))

    def test_singleton(self):
        reg1 = ModelRegistry()
        reg2 = ModelRegistry()
        self.assertIs(reg1, reg2)


class TestEarlyExitHandler(unittest.TestCase):

    def test_make_failure(self):
        result = EarlyExitHandler.make_failure("step_x", "bad input")
        self.assertFalse(result["success"])
        self.assertEqual(result["failed_at_step"], "step_x")

    def test_make_success(self):
        result = EarlyExitHandler.make_success({"a": 1}, {"a": 5.0})
        self.assertTrue(result["success"])
        self.assertAlmostEqual(result["total_time_ms"], 5.0)

    def test_step_failed_required(self):
        self.assertTrue(EarlyExitHandler.step_failed({"success": False}, is_required=True))

    def test_step_failed_optional(self):
        self.assertFalse(EarlyExitHandler.step_failed({"success": False}, is_required=False))


class TestPluginManager(unittest.TestCase):

    def test_load_plugin_class(self):
        pm = PluginManager()

        class _FakePlugin:
            plugin_name = "fake"
            version = "0.1"

            def get_pipelines(self):
                return {}

            def get_routes(self):
                return []

            def initialize(self, config):
                return True

        ok = pm.load_plugin_class(_FakePlugin())
        self.assertTrue(ok)
        self.assertTrue(pm.is_registered("fake") if hasattr(pm, "is_registered") else True)
        plugins = pm.list_plugins()
        names = [p["name"] for p in plugins]
        self.assertIn("fake", names)

    def test_get_unknown_returns_none(self):
        pm = PluginManager()
        self.assertIsNone(pm.get_plugin("definitely_not_registered"))


# ------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main()
