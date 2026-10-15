"""
RecallAI Health Route
GET /health endpoint verifying database connectivity and LLM configuration state.
"""
from fastapi import APIRouter, Response, status
from backend.app.schemas import HealthResponse
from backend.app.database import db_manager
from backend.app.config import settings

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health(response: Response) -> HealthResponse:
    """
    Checks database connectivity and LLM configuration without making paid API calls.
    Returns 200 OK when database is connected, or 503 Service Unavailable when disconnected.
    """
    db_connected = db_manager.check_health()
    llm_ready = settings.is_llm_configured

    if db_connected:
        return HealthResponse(
            status="ok",
            database="connected",
            llm_configured=llm_ready
        )
    else:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="degraded",
            database="disconnected",
            llm_configured=llm_ready
        )
