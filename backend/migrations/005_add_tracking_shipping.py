"""
Migracion: Agregar tracking_number y shipping_cost_usd a orders.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")

def run():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # tracking_number
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='orders' AND column_name='tracking_number'"
    )
    if not cur.fetchone():
        cur.execute("ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100)")
        print("  [OK] tracking_number agregado")
    else:
        print("  [SKIP] tracking_number ya existe")

    # shipping_cost_usd
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='orders' AND column_name='shipping_cost_usd'"
    )
    if not cur.fetchone():
        cur.execute("ALTER TABLE orders ADD COLUMN shipping_cost_usd FLOAT DEFAULT 0.0")
        print("  [OK] shipping_cost_usd agregado")
    else:
        print("  [SKIP] shipping_cost_usd ya existe")

    cur.close()
    conn.close()
    print("\nMigracion completada!")

if __name__ == "__main__":
    run()
