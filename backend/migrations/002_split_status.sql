-- Migración: Separar status en payment_status y order_status
-- Ejecutar este script contra tu base de datos PostgreSQL

-- 1. Crear el enum de PaymentStatus
DO $$ BEGIN
    CREATE TYPE paymentstatus AS ENUM ('Pendiente', 'Pagado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Actualizar el enum de OrderStatus para incluir 'En Bodega'
-- PostgreSQL no permite ALTER TYPE ADD VALUE dentro de transacciones fácilmente,
-- así que lo hacemos de forma segura:
DO $$ BEGIN
    ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'En Bodega' AFTER 'Comprado';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Agregar la columna payment_status
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status paymentstatus NOT NULL DEFAULT 'Pendiente';

-- 4. Renombrar status a order_status
ALTER TABLE orders RENAME COLUMN status TO order_status;

-- Verificar los cambios
SELECT column_name, data_type, udf_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('payment_status', 'order_status');
