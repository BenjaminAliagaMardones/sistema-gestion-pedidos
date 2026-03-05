"""
Script de migracion: simplificar order_status a solo en_bodega y enviado.
Migra los pedidos existentes con estados viejos.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")


def run_migration():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("[1/2] Migrando pedidos con estados viejos a 'en_bodega'...")
    # Mover todos los estados que ya no existen a 'en_bodega'
    # (pendiente, comprado, entregado, cancelado -> en_bodega)
    cur.execute(
        "UPDATE orders SET order_status = 'en_bodega' "
        "WHERE order_status NOT IN ('en_bodega', 'enviado')"
    )
    migrated = cur.rowcount
    print(f"  -> {migrated} pedidos migrados a 'en_bodega'")

    print("[2/2] Verificando estados actuales...")
    cur.execute("SELECT order_status, COUNT(*) FROM orders GROUP BY order_status")
    rows = cur.fetchall()
    if rows:
        for row in rows:
            print(f"  - {row[0]}: {row[1]} pedidos")
    else:
        print("  - No hay pedidos en la base de datos")

    cur.close()
    conn.close()
    print("")
    print("Migracion completada!")


if __name__ == "__main__":
    run_migration()
