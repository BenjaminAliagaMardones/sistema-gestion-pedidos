"""
Script de migración para eliminar las columnas de CLP del sistema.
Ejecutar una sola vez después de actualizar el código.

Uso: python migrate_remove_clp.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine
from sqlalchemy import text

COLUMNS_TO_DROP = [
    ("orders", "exchange_rate"),
    ("orders", "total_clp"),
    ("order_items", "final_price_clp"),
    ("business_config", "default_exchange_rate"),
]


def migrate():
    print("🔄 Iniciando migración: Eliminar columnas CLP...")
    
    with engine.connect() as conn:
        for table, column in COLUMNS_TO_DROP:
            try:
                # Check if column exists first
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = :table AND column_name = :column"
                ), {"table": table, "column": column})
                
                if result.fetchone():
                    conn.execute(text(f'ALTER TABLE "{table}" DROP COLUMN "{column}"'))
                    print(f"  ✅ Eliminada columna: {table}.{column}")
                else:
                    print(f"  ⏭️  Columna ya no existe: {table}.{column}")
            except Exception as e:
                print(f"  ❌ Error al eliminar {table}.{column}: {e}")
        
        conn.commit()
    
    print("\n✅ Migración completada. El sistema ahora opera solo en USD.")


if __name__ == "__main__":
    migrate()
