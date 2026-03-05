"""
Migracion: Agregar indices a las tablas para mejorar rendimiento.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")

INDEXES = [
    ("idx_orders_user_id", "orders", "user_id"),
    ("idx_orders_client_id", "orders", "client_id"),
    ("idx_orders_order_date", "orders", "order_date"),
    ("idx_orders_payment_status", "orders", "payment_status"),
    ("idx_orders_order_status", "orders", "order_status"),
    ("idx_clients_user_id", "clients", "user_id"),
    ("idx_order_items_order_id", "order_items", "order_id"),
]

def run():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    for idx_name, table, column in INDEXES:
        try:
            cur.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({column})")
            print(f"  [OK] {idx_name} en {table}({column})")
        except Exception as e:
            print(f"  [SKIP] {idx_name}: {e}")

    cur.close()
    conn.close()
    print("\nIndices creados!")

if __name__ == "__main__":
    run()
