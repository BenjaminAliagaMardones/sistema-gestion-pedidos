import uuid
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class BusinessConfig(Base):
    __tablename__ = "business_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    business_name = Column(String(200), default="Mi Negocio")
    logo_path = Column(String(500), nullable=True)

    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
