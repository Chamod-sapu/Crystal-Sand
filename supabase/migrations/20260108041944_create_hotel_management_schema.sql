/*
  # Crystal Sand Hotel Management System - Initial Schema

  ## Overview
  Creates the complete database schema for a hotel management system including guest registration, 
  room management, purchases, and billing.

  ## New Tables
  
  ### 1. `rooms`
  Room type definitions with pricing
  - `id` (uuid, primary key)
  - `room_number` (text, unique) - Physical room number
  - `room_type` (text) - SGL/DBL/TPL
  - `base_price` (decimal) - Price per night
  - `status` (text) - available/occupied/maintenance
  - `capacity_adults` (integer) - Max adults
  - `capacity_children` (integer) - Max children
  - `created_at` (timestamptz)

  ### 2. `guests`
  Complete guest registration information
  - `id` (uuid, primary key)
  - `grc_number` (text, unique, auto-generated) - Guest Registration Card Number
  - `name_with_initials` (text) - Guest name
  - `passport_nic` (text) - Passport or NIC number
  - `nationality` (text)
  - `mobile_number` (text)
  - `reservation_number` (text)
  - `voucher_number` (text)
  - `room_numbers` (text[]) - Array of room numbers
  - `room_type` (text) - SGL/DBL/TPL
  - `number_of_rooms` (integer)
  - `number_of_adults` (integer)
  - `number_of_children` (integer)
  - `children_ages` (integer[]) - Array of ages
  - `meal_plan` (text) - Meal plan type
  - `date_of_arrival` (date)
  - `date_of_departure` (date)
  - `time_of_arrival` (time) - Default 14:00
  - `time_of_departure` (time) - Default 12:00
  - `total_room_charge` (decimal) - Calculated room charges
  - `status` (text) - checked_in/checked_out/cancelled
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `purchases`
  Additional charges and purchases
  - `id` (uuid, primary key)
  - `guest_id` (uuid, foreign key) - References guests
  - `item_name` (text)
  - `category` (text) - restaurant/laundry/spa/minibar/transport/other
  - `quantity` (integer)
  - `unit_price` (decimal)
  - `total_price` (decimal) - Auto-calculated
  - `purchase_date` (timestamptz)
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 4. `settings`
  Hotel configuration and settings
  - `id` (uuid, primary key)
  - `hotel_name` (text)
  - `hotel_address` (text)
  - `hotel_phone` (text)
  - `hotel_email` (text)
  - `tax_percentage` (decimal)
  - `currency` (text) - Default LKR
  - `check_in_time` (time) - Default 14:00
  - `check_out_time` (time) - Default 12:00
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Public access policies for admin-only application (single-user system)

  ## Notes
  - GRC numbers are auto-generated with format: GRC-YYYYMMDD-XXXX
  - All monetary values use decimal type for precision
  - Timestamps use timestamptz for timezone support
  - Admin-only system: Policies allow all operations (no authentication required)
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number text UNIQUE NOT NULL,
  room_type text NOT NULL CHECK (room_type IN ('SGL', 'DBL', 'TPL')),
  base_price decimal(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  capacity_adults integer NOT NULL DEFAULT 2,
  capacity_children integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create guests table
CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grc_number text UNIQUE NOT NULL,
  name_with_initials text NOT NULL,
  passport_nic text NOT NULL,
  nationality text NOT NULL,
  mobile_number text NOT NULL,
  reservation_number text,
  voucher_number text,
  room_numbers text[] NOT NULL DEFAULT '{}',
  room_type text NOT NULL CHECK (room_type IN ('SGL', 'DBL', 'TPL')),
  number_of_rooms integer NOT NULL DEFAULT 1,
  number_of_adults integer NOT NULL DEFAULT 1,
  number_of_children integer NOT NULL DEFAULT 0,
  children_ages integer[] DEFAULT '{}',
  meal_plan text,
  date_of_arrival date NOT NULL,
  date_of_departure date NOT NULL,
  time_of_arrival time DEFAULT '14:00:00',
  time_of_departure time DEFAULT '12:00:00',
  total_room_charge decimal(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('restaurant', 'laundry', 'spa', 'minibar', 'transport', 'other')),
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  total_price decimal(10,2) NOT NULL DEFAULT 0,
  purchase_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_name text DEFAULT 'Crystal Sand Hotel',
  hotel_address text,
  hotel_phone text,
  hotel_email text,
  tax_percentage decimal(5,2) DEFAULT 10.00,
  currency text DEFAULT 'LKR',
  check_in_time time DEFAULT '14:00:00',
  check_out_time time DEFAULT '12:00:00',
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO settings (hotel_name, hotel_address, hotel_phone, hotel_email)
VALUES (
  'Crystal Sand Hotel',
  'Coastal Road, Bentota, Sri Lanka',
  '+94 34 227 5073',
  'info@crystalsandhotel.lk'
) ON CONFLICT DO NOTHING;

-- Insert sample rooms
INSERT INTO rooms (room_number, room_type, base_price, capacity_adults, capacity_children)
VALUES 
  ('101', 'SGL', 8500.00, 1, 0),
  ('102', 'SGL', 8500.00, 1, 0),
  ('201', 'DBL', 12000.00, 2, 1),
  ('202', 'DBL', 12000.00, 2, 1),
  ('203', 'DBL', 12000.00, 2, 1),
  ('301', 'TPL', 15500.00, 3, 2),
  ('302', 'TPL', 15500.00, 3, 2)
ON CONFLICT (room_number) DO NOTHING;

-- Create index on guest status for faster queries
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);
CREATE INDEX IF NOT EXISTS idx_guests_arrival_date ON guests(date_of_arrival);
CREATE INDEX IF NOT EXISTS idx_purchases_guest_id ON purchases(guest_id);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin-only access (no authentication required - single-user system)
-- All operations are allowed as this is an internal management system

CREATE POLICY "Allow all operations on rooms"
  ON rooms FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on guests"
  ON guests FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on purchases"
  ON purchases FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on settings"
  ON settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();