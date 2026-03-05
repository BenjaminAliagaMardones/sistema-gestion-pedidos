"""
Script de migracion: separar status en payment_status + order_status
Los valores de enum en PostgreSQL estan en minusculas (pendiente, pagado, etc.)
porque SQLAlchemy usa los .name del enum Python.
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

    # Step 1: Create paymentstatus enum (already created, skip if exists)
    print("[1/4] Creando tipo paymentstatus...")
    cur.execute("SELECT 1 FROM pg_type WHERE typname = 'paymentstatus'")
    if not cur.fetchone():
        cur.execute("CREATE TYPE paymentstatus AS ENUM ('pendiente', 'pagado')")
        print("  -> Tipo 'paymentstatus' creado")
    else:
        print("  -> Tipo 'paymentstatus' ya existe, saltando...")

    # Step 2: Add 'en_bodega' to orderstatus
    print("[2/4] Agregando 'en_bodega' al tipo orderstatus...")
    cur.execute("""
        SELECT 1 FROM pg_enum e 
        JOIN pg_type t ON t.oid = e.enumtypid 
        WHERE t.typname = 'orderstatus' AND e.enumlabel = 'en_bodega'
    """)
    if not cur.fetchone():
        cur.execute("ALTER TYPE orderstatus ADD VALUE 'en_bodega' AFTER 'comprado'")
        print("  -> Valor 'en_bodega' agregado")
    else:
        print("  -> Valor 'en_bodega' ya existe, saltando...")

    # Step 3: Add payment_status column
    print("[3/4] Agregando columna payment_status...")
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'orders' AND column_name = 'payment_status'"
    )
    if not cur.fetchone():
        cur.execute(
            "ALTER TABLE orders ADD COLUMN payment_status paymentstatus NOT NULL DEFAULT 'pendiente'"
        )
        print("  -> Columna 'payment_status' creada (default: pendiente)")
    else:
        print("  -> Columna 'payment_status' ya existe, saltando...")

    # Step 4: Rename status -> order_status
    print("[4/4] Renombrando 'status' a 'order_status'...")
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'orders' AND column_name = 'status'"
    )
    has_old = cur.fetchone()
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'orders' AND column_name = 'order_status'"
    )
    has_new = cur.fetchone()

    if has_old and not has_new:
        cur.execute("ALTER TABLE orders RENAME COLUMN status TO order_status")
        print("  -> Columna 'status' renombrada a 'order_status'")
    elif has_new:
        print("  -> Columna 'order_status' ya existe, saltando...")
    else:
        print("  -> Estado inesperado de columnas")

    # Verify
    print("")
    print("Verificando resultado:")
    cur.execute(
        "SELECT column_name, udt_name FROM information_schema.columns "
        "WHERE table_name = 'orders' "
        "AND column_name IN ('payment_status', 'order_status')"
    )
    for row in cur.fetchall():
        print(f"  - {row[0]}: {row[1]}")

    cur.close()
    conn.close()
    print("")
    print("Migracion completada!")


if __name__ == "__main__":
    run_migration()
