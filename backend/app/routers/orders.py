from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
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


@router.get("/")
def list_orders(
    client_id: Optional[UUID] = None,
    payment_status_filter: Optional[str] = None,
    order_status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Order).filter(Order.user_id == current_user.id)
    if client_id:
        query = query.filter(Order.client_id == client_id)
    if payment_status_filter:
        query = query.filter(Order.payment_status == payment_status_filter)
    if order_status_filter:
        query = query.filter(Order.order_status == order_status_filter)
    if search:
        search_term = f"%{search}%"
        query = query.join(Client, Order.client_id == Client.id).filter(
            Client.name.ilike(search_term)
        )

    total = query.count()
    offset = (page - 1) * page_size
    orders = query.order_by(Order.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": [OrderResponse.model_validate(o) for o in orders],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


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
    items_data = [calculate_item(item) for item in data.items]
    totals = calculate_order_totals(items_data)

    # Generate correlative invoice number
    max_invoice = db.query(sqlfunc.max(Order.invoice_number)).filter(
        Order.user_id == current_user.id
    ).scalar()
    next_invoice = (max_invoice or 0) + 1

    order = Order(
        user_id=current_user.id,
        client_id=data.client_id,
        invoice_number=next_invoice,
        payment_status=data.payment_status,
        order_status=data.order_status,
        payment_bank=data.payment_bank,
        payment_method=data.payment_method,
        notes=data.notes,
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
    for field in ["payment_status", "order_status", "payment_bank", "payment_method", "notes", "order_date"]:
        value = getattr(data, field, None)
        if value is not None:
            setattr(order, field, value)

    # If items provided, recalculate
    if data.items is not None:
        # Delete existing items
        db.query(OrderItem).filter(OrderItem.order_id == order.id).delete()
        items_data = [calculate_item(item) for item in data.items]
        totals = calculate_order_totals(items_data)
        for key, val in totals.items():
            setattr(order, key, val)
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
