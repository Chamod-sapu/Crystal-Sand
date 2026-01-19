/*
  # Hotel Management System - Advanced Features Enhancement

  ## Overview
  Adds advance payment tracking, guest remarks, room floor information,
  and new room types to support enhanced hotel operations.

  ## Changes
  - Add floor column to rooms
  - Add advance payment fields to guests
  - Add remarks field to guests
  - Extend room type check constraint to include QUAD and FAMILY
  - Create room_types reference table
  - Add availability cache for performance
*/

-- Drop the existing constraint on room_type to update it
ALTER TABLE rooms DROP CONSTRAINT rooms_room_type_check;

-- Add new constraint with additional room types
ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check 
  CHECK (room_type IN ('SGL', 'DBL', 'TPL', 'QUAD', 'FAMILY'));

-- Add floor column to rooms table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rooms' AND column_name = 'floor'
  ) THEN
    ALTER TABLE rooms ADD COLUMN floor integer DEFAULT 1;
  END IF;
END $$;

-- Add advance payment columns to guests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'advance_payment_amount'
  ) THEN
    ALTER TABLE guests ADD COLUMN advance_payment_amount decimal(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'advance_payment_date'
  ) THEN
    ALTER TABLE guests ADD COLUMN advance_payment_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'advance_payment_method'
  ) THEN
    ALTER TABLE guests ADD COLUMN advance_payment_method text CHECK (advance_payment_method IN ('cash', 'card', 'online'));
  END IF;
END $$;

-- Add remarks column to guests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guests' AND column_name = 'remarks'
  ) THEN
    ALTER TABLE guests ADD COLUMN remarks text;
  END IF;
END $$;

-- Update existing rooms with floor information
UPDATE rooms SET floor = 1 WHERE room_number IN ('101', '102');
UPDATE rooms SET floor = 2 WHERE room_number IN ('201', '202', '203');
UPDATE rooms SET floor = 3 WHERE room_number IN ('301', '302');

-- Insert new room types
INSERT INTO rooms (room_number, room_type, base_price, capacity_adults, capacity_children, floor, status)
VALUES 
  ('401', 'QUAD', 18000.00, 4, 2, 4, 'available'),
  ('402', 'FAMILY', 20000.00, 4, 3, 4, 'available')
ON CONFLICT (room_number) DO NOTHING;

-- Create room_types reference table for better management
CREATE TABLE IF NOT EXISTS room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  capacity_adults integer NOT NULL DEFAULT 1,
  capacity_children integer NOT NULL DEFAULT 0,
  base_price decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Insert room types
INSERT INTO room_types (code, name, description, capacity_adults, capacity_children, base_price)
VALUES 
  ('SGL', 'Single', 'Single room for one guest', 1, 0, 8500.00),
  ('DBL', 'Double', 'Double room for two guests', 2, 1, 12000.00),
  ('TPL', 'Triple', 'Triple room for three guests', 3, 2, 15500.00),
  ('QUAD', 'Quadruple', 'Quadruple room for four guests', 4, 2, 18000.00),
  ('FAMILY', 'Family', 'Family room for up to seven guests', 4, 3, 20000.00)
ON CONFLICT (code) DO NOTHING;

-- Enable RLS on room_types
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on room_types"
  ON room_types FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create availability_cache table for performance optimization
CREATE TABLE IF NOT EXISTS room_availability_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_date date NOT NULL,
  is_available boolean DEFAULT true,
  cached_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_cache_room_date 
  ON room_availability_cache(room_id, check_date);

-- Enable RLS on availability_cache
ALTER TABLE room_availability_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on room_availability_cache"
  ON room_availability_cache FOR ALL
  USING (true)
  WITH CHECK (true);