from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.models.order import OrderStatus, PaymentStatus


class OrderItemCreate(BaseModel):
    name: str
    base_price_usd: float
    tax_percent: float = 0.0
    commission_percent: float = 0.0
    quantity: int = 1


class OrderItemResponse(BaseModel):
    id: UUID
    name: str
    base_price_usd: float
    tax_percent: float
    commission_percent: float
    quantity: int
    tax_amount_usd: float
    commission_amount_usd: float
    final_price_usd: float
    profit_usd: float

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    client_id: UUID
    payment_status: PaymentStatus = PaymentStatus.pendiente
    order_status: OrderStatus = OrderStatus.en_bodega
    payment_bank: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    order_date: Optional[datetime] = None
    items: List[OrderItemCreate]


class OrderUpdate(BaseModel):
    client_id: Optional[UUID] = None
    payment_status: Optional[PaymentStatus] = None
    order_status: Optional[OrderStatus] = None
    payment_bank: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    order_date: Optional[datetime] = None
    items: Optional[List[OrderItemCreate]] = None


class ClientOrderInfo(BaseModel):
    id: UUID
    name: str
    phone: str

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: UUID
    invoice_number: Optional[int]
    client_id: UUID
    client: Optional[ClientOrderInfo]
    payment_status: PaymentStatus
    order_status: OrderStatus
    payment_bank: Optional[str]
    payment_method: Optional[str]
    notes: Optional[str]
    order_date: datetime
    created_at: datetime
    total_tax_usd: float
    total_commission_usd: float
    total_profit_usd: float
    total_usd: float
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True
