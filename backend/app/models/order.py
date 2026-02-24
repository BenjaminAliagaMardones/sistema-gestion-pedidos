import uuid
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Float, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class OrderStatus(str, enum.Enum):
    pendiente = "Pendiente"
    comprado = "Comprado"
    enviado = "Enviado"
    entregado = "Entregado"
    cancelado = "Cancelado"


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.pendiente, nullable=False)
    payment_bank = Column(String(100), nullable=True)
    payment_method = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    exchange_rate = Column(Float, nullable=False, default=900.0)
    order_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Totales calculados
    total_tax_usd = Column(Float, default=0.0)
    total_commission_usd = Column(Float, default=0.0)
    total_profit_usd = Column(Float, default=0.0)
    total_usd = Column(Float, default=0.0)
    total_clp = Column(Float, default=0.0)

    client = relationship("Client", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    name = Column(String(200), nullable=False)
    base_price_usd = Column(Float, nullable=False)
    tax_percent = Column(Float, default=0.0)
    commission_percent = Column(Float, default=0.0)
    quantity = Column(Integer, default=1)

    # Calculados
    tax_amount_usd = Column(Float, default=0.0)
    commission_amount_usd = Column(Float, default=0.0)
    final_price_usd = Column(Float, default=0.0)
    final_price_clp = Column(Float, default=0.0)
    profit_usd = Column(Float, default=0.0)

    order = relationship("Order", back_populates="items")
