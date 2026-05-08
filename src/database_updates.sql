-- SQL statements to create room pricing capabilities

-- 1. Create room_pricing table
CREATE TABLE IF NOT EXISTS room_pricing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_group text NOT NULL, -- 'A' for 1,2,3,5,6,7 and 'B' for 4,8
  occupancy integer NOT NULL, -- 1 to 6
  label text NOT NULL, -- 'Single', 'Double', 'Triple', etc.
  day_price numeric NOT NULL DEFAULT 6000,
  night_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(room_group, occupancy)
);

-- 2. Insert initial data for Group A (Rooms 1, 2, 3, 5, 6, 7)
INSERT INTO room_pricing (room_group, occupancy, label, day_price, night_price) VALUES
  ('A', 1, 'Single', 6000, 7750),
  ('A', 2, 'Double', 6000, 7750),
  ('A', 3, 'Triple', 6000, 11250),
  ('A', 4, 'Quad', 6000, 14750),
  ('A', 5, 'Five pax', 6000, 18250),
  ('A', 6, 'Six pax', 6000, 21750)
ON CONFLICT (room_group, occupancy) 
DO UPDATE SET label = EXCLUDED.label, day_price = EXCLUDED.day_price, night_price = EXCLUDED.night_price;

-- 3. Insert initial data for Group B (Rooms 4, 8)
INSERT INTO room_pricing (room_group, occupancy, label, day_price, night_price) VALUES
  ('B', 1, 'Single', 6000, 6000),
  ('B', 2, 'Double', 6000, 6000)
ON CONFLICT (room_group, occupancy) 
DO UPDATE SET label = EXCLUDED.label, day_price = EXCLUDED.day_price, night_price = EXCLUDED.night_price;

-- 4. Set RLS policies
ALTER TABLE room_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all authenticated users on room_pricing" ON room_pricing;
CREATE POLICY "Allow read access to all authenticated users on room_pricing"
ON room_pricing FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all actions for authenticated users on room_pricing" ON room_pricing;
CREATE POLICY "Allow all actions for authenticated users on room_pricing"
ON room_pricing FOR ALL TO authenticated USING (true);

-- 5. Add columns to guests table to store per-room guest assignments and stay type
ALTER TABLE guests ADD COLUMN IF NOT EXISTS room_occupancies jsonb DEFAULT '{}'::jsonb;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS stay_type text DEFAULT 'night';

-- 6. Add column to track when invoice was first downloaded (sale timestamp for reporting)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS first_invoice_downloaded_at timestamp with time zone DEFAULT NULL;

-- 7. Create pool_visits table for room guests using the pool
CREATE TABLE IF NOT EXISTS pool_visits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  number_of_persons integer NOT NULL DEFAULT 1,
  charge_per_person numeric NOT NULL DEFAULT 0,
  total_charge numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE pool_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on pool_visits" ON pool_visits;
CREATE POLICY "Allow all for authenticated on pool_visits"
ON pool_visits FOR ALL TO authenticated USING (true);

-- 8. Create pool_outside_visitors table for visitors not staying at the hotel
CREATE TABLE IF NOT EXISTS pool_outside_visitors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_name text NOT NULL,
  contact_number text,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  number_of_persons integer NOT NULL DEFAULT 1,
  charge_per_person numeric NOT NULL DEFAULT 0,
  total_charge numeric NOT NULL DEFAULT 0,
  notes text,
  first_bill_downloaded_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE pool_outside_visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on pool_outside_visitors" ON pool_outside_visitors;
CREATE POLICY "Allow all for authenticated on pool_outside_visitors"
ON pool_outside_visitors FOR ALL TO authenticated USING (true);

-- 9. Add pool pricing to settings and duration to pool tables
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pool_price numeric DEFAULT 600;
ALTER TABLE pool_visits ADD COLUMN IF NOT EXISTS number_of_hours integer DEFAULT 4;
ALTER TABLE pool_outside_visitors ADD COLUMN IF NOT EXISTS number_of_hours integer DEFAULT 4;

-- 10. Add currency conversion tracking columns for online booking payments (Booking.com/Agoda)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS original_currency text DEFAULT NULL;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS original_amount numeric DEFAULT NULL;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT NULL;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS booking_source text DEFAULT NULL;