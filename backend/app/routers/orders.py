from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import io
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.client import Client
from app.models.order import Order, OrderItem
from app.models.business_config import BusinessConfig
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse
from app.services.order_service import calculate_item, calculate_order_totals
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter(prefix="/api/orders", tags=["Pedidos"])


def _build_order_response(order: Order) -> OrderResponse:
    return OrderResponse.model_validate(order)


@router.get("/", response_model=List[OrderResponse])
def list_orders(
    client_id: Optional[UUID] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Order).filter(Order.user_id == current_user.id)
    if client_id:
        query = query.filter(Order.client_id == client_id)
    if status_filter:
        query = query.filter(Order.status == status_filter)
    orders = query.order_by(Order.created_at.desc()).all()
    return [OrderResponse.model_validate(o) for o in orders]


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.query(Client).filter(Client.id == data.client_id, Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Calcular items
    items_data = [calculate_item(item, data.exchange_rate) for item in data.items]
    totals = calculate_order_totals(items_data)

    order = Order(
        user_id=current_user.id,
        client_id=data.client_id,
        status=data.status,
        payment_bank=data.payment_bank,
        payment_method=data.payment_method,
        notes=data.notes,
        exchange_rate=data.exchange_rate,
        order_date=data.order_date or datetime.utcnow(),
        **totals,
    )
    db.add(order)
    db.flush()

    for item_data in items_data:
        order_item = OrderItem(order_id=order.id, **item_data)
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return OrderResponse.model_validate(order)


@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: UUID,
    data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # Update basic fields
    for field in ["status", "payment_bank", "payment_method", "notes", "order_date"]:
        value = getattr(data, field, None)
        if value is not None:
            setattr(order, field, value)

    exchange_rate = data.exchange_rate if data.exchange_rate is not None else order.exchange_rate

    # If items provided, recalculate
    if data.items is not None:
        # Delete existing items
        db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()
        items_data = [calculate_item(item, exchange_rate) for item in data.items]
        totals = calculate_order_totals(items_data)
        for key, val in totals.items():
            setattr(order, key, val)
        order.exchange_rate = exchange_rate
        for item_data in items_data:
            order_item = OrderItem(order_id=order.id, **item_data)
            db.add(order_item)

    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    db.delete(order)
    db.commit()


@router.get("/{order_id}/pdf")
def download_pdf(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    client = db.query(Client).filter(Client.id == order.client_id).first()
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    business_config = db.query(BusinessConfig).filter(BusinessConfig.user_id == current_user.id).first()

    pdf_bytes = generate_invoice_pdf(order, client, items, business_config)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="boleta-{str(order.id)[:8]}.pdf"'
        },
    )
