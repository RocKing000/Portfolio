"""Fake data generators for synthetic KYC documents."""
from .name_generator import NameGenerator
from .number_generator import NumberGenerator
from .address_generator import AddressGenerator
from .face_generator import FaceGenerator

__all__ = ["NameGenerator", "NumberGenerator", "AddressGenerator", "FaceGenerator"]
