"""
BloodBridge — Pydantic Schemas
================================
Request/response models for all API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Request Models ──

class MessageRequest(BaseModel):
    message: str = Field(..., description="Blood request message text")

class MatchRequest(BaseModel):
    blood_group: str = Field(..., description="Required blood group (e.g., O-, AB+)")
    hospital: str = Field("", description="Hospital name")
    city: str = Field("", description="City name")
    urgency: str = Field("P1_HIGH", description="Urgency level (P0-P3)")
    units_needed: int = Field(2, description="Number of units needed")
    top_k: int = Field(10, description="Number of top donors to return", ge=1, le=50)

class ForecastRequest(BaseModel):
    city: str = Field(..., description="City name")
    blood_group: str = Field(..., description="Blood group")
    days_ahead: int = Field(7, description="Days to forecast", ge=1, le=30)

class PipelineRequest(BaseModel):
    message: str = Field(..., description="Raw blood request message")
    top_k_donors: int = Field(10, description="Number of donors to return", ge=1, le=50)
