from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class BusinessConfigUpdate(BaseModel):
    business_name: Optional[str] = None


class BusinessConfigResponse(BaseModel):
    id: UUID
    business_name: str
    logo_path: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True
