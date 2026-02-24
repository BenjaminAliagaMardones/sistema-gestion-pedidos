from typing import List
from app.schemas.order import OrderItemCreate
from app.models.order import OrderItem


def calculate_item(item: OrderItemCreate, exchange_rate: float) -> dict:
    """
    Calcula todos los valores financieros para un producto.
    
    tax_amount = base_price * (tax_percent / 100)
    commission_amount = (base_price + tax_amount) * (commission_percent / 100)
    final_price_usd = (base_price + tax_amount + commission_amount) * quantity
    final_price_clp = final_price_usd * exchange_rate
    profit_usd = commission_amount * quantity
    """
    base = item.base_price_usd
    tax_amount = base * (item.tax_percent / 100)
    commission_amount = (base + tax_amount) * (item.commission_percent / 100)
    unit_final = base + tax_amount + commission_amount
    final_price_usd = unit_final * item.quantity
    final_price_clp = final_price_usd * exchange_rate
    profit_usd = commission_amount * item.quantity

    return {
        "name": item.name,
        "base_price_usd": base,
        "tax_percent": item.tax_percent,
        "commission_percent": item.commission_percent,
        "quantity": item.quantity,
        "tax_amount_usd": round(tax_amount, 4),
        "commission_amount_usd": round(commission_amount, 4),
        "final_price_usd": round(final_price_usd, 4),
        "final_price_clp": round(final_price_clp, 2),
        "profit_usd": round(profit_usd, 4),
    }


def calculate_order_totals(items_data: List[dict]) -> dict:
    """Calcula totales agregados del pedido desde la lista de items calculados."""
    total_tax = sum(i["tax_amount_usd"] * i["quantity"] for i in items_data)
    total_commission = sum(i["commission_amount_usd"] * i["quantity"] for i in items_data)
    total_profit = sum(i["profit_usd"] for i in items_data)
    total_usd = sum(i["final_price_usd"] for i in items_data)
    # total_clp is sum of each item's clp total
    total_clp = sum(i["final_price_clp"] for i in items_data)

    return {
        "total_tax_usd": round(total_tax, 4),
        "total_commission_usd": round(total_commission, 4),
        "total_profit_usd": round(total_profit, 4),
        "total_usd": round(total_usd, 4),
        "total_clp": round(total_clp, 2),
    }
