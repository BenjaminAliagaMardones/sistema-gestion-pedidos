from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, extract, case
from datetime import datetime
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
    """KPIs principales — single SQL query with conditional aggregation."""
    now = datetime.utcnow()

    # All-time metrics in a single query
    all_time = db.query(
        sqlfunc.coalesce(sqlfunc.sum(Order.total_usd), 0).label("revenue"),
        sqlfunc.coalesce(sqlfunc.sum(Order.total_profit_usd), 0).label("profit"),
        sqlfunc.count(Order.id).label("total_orders"),
    ).filter(Order.user_id == current_user.id).first()

    total_revenue = float(all_time.revenue)
    total_profit = float(all_time.profit)
    total_orders = all_time.total_orders
    avg_ticket = (total_revenue / total_orders) if total_orders > 0 else 0

    # Monthly metrics in a single query
    monthly = db.query(
        sqlfunc.coalesce(sqlfunc.sum(Order.total_usd), 0).label("revenue"),
        sqlfunc.coalesce(sqlfunc.sum(Order.total_profit_usd), 0).label("profit"),
        sqlfunc.count(Order.id).label("total_orders"),
    ).filter(
        Order.user_id == current_user.id,
        extract("year", Order.order_date) == now.year,
        extract("month", Order.order_date) == now.month,
    ).first()

    total_clients = db.query(sqlfunc.count(Client.id)).filter(
        Client.user_id == current_user.id
    ).scalar()

    return {
        "total_revenue_usd": round(total_revenue, 2),
        "total_profit_usd": round(total_profit, 2),
        "total_orders": total_orders,
        "avg_ticket_usd": round(avg_ticket, 2),
        "total_clients": total_clients,
        "monthly_revenue_usd": round(float(monthly.revenue), 2),
        "monthly_profit_usd": round(float(monthly.profit), 2),
        "monthly_orders": monthly.total_orders,
    }


@router.get("/monthly")
def get_monthly_data(
    year: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Datos mensuales — single query with GROUP BY month."""
    if year is None:
        year = datetime.utcnow().year

    results = (
        db.query(
            extract("month", Order.order_date).label("month"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total_usd), 0).label("revenue"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total_profit_usd), 0).label("profit"),
            sqlfunc.count(Order.id).label("orders"),
        )
        .filter(
            Order.user_id == current_user.id,
            extract("year", Order.order_date) == year,
        )
        .group_by(extract("month", Order.order_date))
        .all()
    )

    months_es = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    monthly = {m: {"month": months_es[m - 1], "revenue": 0.0, "profit": 0.0, "orders": 0} for m in range(1, 13)}

    for row in results:
        m = int(row.month)
        monthly[m]["revenue"] = round(float(row.revenue), 2)
        monthly[m]["profit"] = round(float(row.profit), 2)
        monthly[m]["orders"] = row.orders

    return [monthly[m] for m in range(1, 13)]


@router.get("/top-clients")
def get_top_clients(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top clientes — single JOIN + GROUP BY query."""
    results = (
        db.query(
            Client.id,
            Client.name,
            Client.phone,
            sqlfunc.count(Order.id).label("total_orders"),
            sqlfunc.coalesce(sqlfunc.sum(Order.total_usd), 0).label("total_spent"),
        )
        .outerjoin(Order, Order.client_id == Client.id)
        .filter(Client.user_id == current_user.id)
        .group_by(Client.id)
        .order_by(sqlfunc.coalesce(sqlfunc.sum(Order.total_usd), 0).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(row.id),
            "name": row.name,
            "phone": row.phone,
            "total_orders": row.total_orders,
            "total_spent_usd": round(float(row.total_spent), 2),
        }
        for row in results
    ]
