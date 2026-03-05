import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cur = conn.cursor()

# Check enum values
cur.execute("""
    SELECT e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'paymentstatus'
    ORDER BY e.enumsortorder
""")
print("paymentstatus values:")
for row in cur.fetchall():
    print(f"  - '{row[0]}'")

cur.execute("""
    SELECT e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'orderstatus'
    ORDER BY e.enumsortorder
""")
print("orderstatus values:")
for row in cur.fetchall():
    print(f"  - '{row[0]}'")

# Check columns
cur.execute(
    "SELECT column_name, udt_name FROM information_schema.columns "
    "WHERE table_name = 'orders' ORDER BY ordinal_position"
)
print("orders columns:")
for row in cur.fetchall():
    print(f"  - {row[0]}: {row[1]}")

cur.close()
conn.close()
