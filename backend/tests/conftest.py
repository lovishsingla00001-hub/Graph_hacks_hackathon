"""
Pytest configuration and shared fixtures for RecallAI tests.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

@pytest.fixture
def client():
    """Returns a TestClient instance for FastAPI application testing."""
    return TestClient(app)
