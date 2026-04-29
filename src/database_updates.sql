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

CREATE POLICY "Allow read access to all authenticated users on room_pricing"
ON room_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all actions for authenticated users on room_pricing"
ON room_pricing FOR ALL TO authenticated USING (true);

-- 5. Add columns to guests table to store per-room guest assignments and stay type
ALTER TABLE guests ADD COLUMN IF NOT EXISTS room_occupancies jsonb DEFAULT '{}'::jsonb;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS stay_type text DEFAULT 'night';
