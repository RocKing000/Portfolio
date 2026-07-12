"""
utils/errors.py

Custom exception types for the DIRE-X backend.
Each exception maps cleanly to a specific HTTP status code in the route layer.
"""


class ValidationFailedError(Exception):
    """
    Raised when a scenario fails validation hard enough to block scoring.
    Signals HTTP 422.
    """
    def __init__(self, flags: list, validation_score: float,
                 message: str = "Scenario failed validation."):
        self.flags            = flags
        self.validation_score = validation_score
        self.message          = message
        super().__init__(message)


class ScoringError(Exception):
    """
    Raised when the scoring engine is unavailable or returns an error.
    Signals HTTP 500.
    """


class ScenarioNotFoundError(Exception):
    """
    Raised when a requested scenario_id does not exist in the database.
    Signals HTTP 404.
    """


class DatabaseError(Exception):
    """
    Raised for unexpected database-level failures.
    Signals HTTP 500.
    """
