from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class ClientCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class ClientResponse(BaseModel):
    id: UUID
    name: str
    phone: str
    email: Optional[str]
    address: Optional[str]
    created_at: datetime
    total_orders: int = 0
    total_spent_usd: float = 0.0

    class Config:
        from_attributes = True
