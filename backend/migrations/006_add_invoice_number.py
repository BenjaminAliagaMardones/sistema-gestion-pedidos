"""
Migracion: Agregar invoice_number a orders y asignar numeros correlativos a pedidos existentes.
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

    # Add invoice_number column
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='orders' AND column_name='invoice_number'"
    )
    if not cur.fetchone():
        cur.execute("ALTER TABLE orders ADD COLUMN invoice_number INTEGER")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number)")
        print("  [OK] invoice_number column added")
    else:
        print("  [SKIP] invoice_number already exists")

    # Assign correlative numbers to existing orders (ordered by creation date)
    cur.execute(
        "SELECT id FROM orders WHERE invoice_number IS NULL ORDER BY created_at ASC"
    )
    rows = cur.fetchall()
    if rows:
        # Get current max
        cur.execute("SELECT COALESCE(MAX(invoice_number), 0) FROM orders")
        current_max = cur.fetchone()[0]
        
        for i, (order_id,) in enumerate(rows, start=current_max + 1):
            cur.execute("UPDATE orders SET invoice_number = %s WHERE id = %s", (i, order_id))
        print(f"  [OK] Assigned invoice numbers {current_max + 1} to {current_max + len(rows)} to {len(rows)} existing orders")
    else:
        print("  [SKIP] All orders already have invoice numbers")

    cur.close()
    conn.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    run()
