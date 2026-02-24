from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.order import Order
from app.models.client import Client

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """KPIs principales del dashboard."""
    orders = db.query(Order).filter(Order.user_id == current_user.id).all()
    active_orders = [o for o in orders if o.status.value not in ["Cancelado"]]

    total_revenue = sum(o.total_usd for o in active_orders if o.total_usd)
    total_profit = sum(o.total_profit_usd for o in active_orders if o.total_profit_usd)
    total_orders = len(active_orders)
    avg_ticket = (total_revenue / total_orders) if total_orders > 0 else 0
    total_clients = db.query(Client).filter(Client.user_id == current_user.id).count()

    # Pedidos del mes actual
    now = datetime.utcnow()
    monthly_orders = [
        o for o in active_orders
        if o.order_date and o.order_date.year == now.year and o.order_date.month == now.month
    ]
    monthly_revenue = sum(o.total_usd for o in monthly_orders if o.total_usd)
    monthly_profit = sum(o.total_profit_usd for o in monthly_orders if o.total_profit_usd)

    return {
        "total_revenue_usd": round(total_revenue, 2),
        "total_profit_usd": round(total_profit, 2),
        "total_orders": total_orders,
        "avg_ticket_usd": round(avg_ticket, 2),
        "total_clients": total_clients,
        "monthly_revenue_usd": round(monthly_revenue, 2),
        "monthly_profit_usd": round(monthly_profit, 2),
        "monthly_orders": len(monthly_orders),
    }


@router.get("/monthly")
def get_monthly_data(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datos mensuales para gráficos (12 meses del año seleccionado)."""
    if year is None:
        year = datetime.utcnow().year

    orders = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.status != "Cancelado",
    ).all()

    monthly = {}
    months_es = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    for m in range(1, 13):
        monthly[m] = {"month": months_es[m-1], "revenue": 0.0, "profit": 0.0, "orders": 0}

    for order in orders:
        if order.order_date and order.order_date.year == year:
            m = order.order_date.month
            monthly[m]["revenue"] += order.total_usd or 0
            monthly[m]["profit"] += order.total_profit_usd or 0
            monthly[m]["orders"] += 1

    result = []
    for m in range(1, 13):
        d = monthly[m]
        result.append({
            "month": d["month"],
            "revenue": round(d["revenue"], 2),
            "profit": round(d["profit"], 2),
            "orders": d["orders"],
        })
    return result


@router.get("/top-clients")
def get_top_clients(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top clientes por gasto total."""
    clients = db.query(Client).filter(Client.user_id == current_user.id).all()
    result = []
    for client in clients:
        orders = db.query(Order).filter(
            Order.client_id == client.id,
            Order.status != "Cancelado",
        ).all()
        total_spent = sum(o.total_usd for o in orders if o.total_usd)
        result.append({
            "id": str(client.id),
            "name": client.name,
            "phone": client.phone,
            "total_orders": len(orders),
            "total_spent_usd": round(total_spent, 2),
        })

    result.sort(key=lambda x: x["total_spent_usd"], reverse=True)
    return result[:limit]
