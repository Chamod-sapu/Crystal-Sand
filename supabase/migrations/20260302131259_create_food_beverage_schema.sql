/*
  # Food & Beverage Management Schema

  1. New Tables
    - `fb_categories`
      - `id` (uuid, primary key)
      - `name` (text) - Category name (Restaurant, Bar, Minibar, Room Service, etc.)
      - `created_at` (timestamptz)
    
    - `fb_menu_items`
      - `id` (uuid, primary key)
      - `category_id` (uuid, foreign key to fb_categories)
      - `item_name` (text) - Name of the menu item
      - `unit_price` (decimal) - Default price
      - `is_active` (boolean) - Whether item is available
      - `created_at` (timestamptz)
    
    - `fb_consumption`
      - `id` (uuid, primary key)
      - `room_id` (uuid, foreign key to rooms)
      - `guest_id` (uuid, foreign key to guests)
      - `item_id` (uuid, foreign key to fb_menu_items)
      - `item_name` (text) - Snapshot of item name
      - `category` (text) - Snapshot of category
      - `quantity` (integer) - Number of items
      - `unit_price` (decimal) - Price at time of order
      - `total_price` (decimal) - quantity * unit_price
      - `consumed_at` (timestamptz) - When item was ordered
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `fb_settings`
      - `id` (uuid, primary key)
      - `service_charge_percentage` (decimal) - Service charge %
      - `vat_percentage` (decimal) - VAT/Tax %
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
*/

-- Create fb_categories table
CREATE TABLE IF NOT EXISTS fb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Create fb_menu_items table
CREATE TABLE IF NOT EXISTS fb_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES fb_categories(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create fb_consumption table
CREATE TABLE IF NOT EXISTS fb_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  item_id uuid REFERENCES fb_menu_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  consumed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create fb_settings table
CREATE TABLE IF NOT EXISTS fb_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_charge_percentage decimal(5,2) DEFAULT 10,
  vat_percentage decimal(5,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE fb_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_settings ENABLE ROW LEVEL SECURITY;

-- Policies for fb_categories
CREATE POLICY "Allow all operations on fb_categories"
  ON fb_categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for fb_menu_items
CREATE POLICY "Allow all operations on fb_menu_items"
  ON fb_menu_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for fb_consumption
CREATE POLICY "Allow all operations on fb_consumption"
  ON fb_consumption
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for fb_settings
CREATE POLICY "Allow all operations on fb_settings"
  ON fb_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default categories
INSERT INTO fb_categories (name) VALUES
  ('Restaurant'),
  ('Bar'),
  ('Minibar'),
  ('Room Service'),
  ('Custom')
ON CONFLICT (name) DO NOTHING;

-- Insert default settings
INSERT INTO fb_settings (service_charge_percentage, vat_percentage)
SELECT 10, 0
WHERE NOT EXISTS (SELECT 1 FROM fb_settings LIMIT 1);

-- Insert sample menu items
INSERT INTO fb_menu_items (category_id, item_name, unit_price) 
SELECT 
  (SELECT id FROM fb_categories WHERE name = 'Restaurant'),
  item.name,
  item.price
FROM (VALUES
  ('Fried Rice', 1200.00),
  ('Kottu', 1500.00),
  ('Noodles', 1300.00),
  ('Club Sandwich', 1000.00),
  ('Pizza', 2000.00),
  ('Pasta', 1800.00),
  ('Burger', 1600.00),
  ('Grilled Chicken', 2200.00),
  ('Fish & Chips', 2500.00),
  ('Seafood Platter', 3500.00)
) AS item(name, price)
ON CONFLICT DO NOTHING;

INSERT INTO fb_menu_items (category_id, item_name, unit_price)
SELECT 
  (SELECT id FROM fb_categories WHERE name = 'Bar'),
  item.name,
  item.price
FROM (VALUES
  ('Beer', 500.00),
  ('Wine Glass', 800.00),
  ('Wine Bottle', 4000.00),
  ('Whiskey', 1200.00),
  ('Vodka', 1000.00),
  ('Rum', 900.00),
  ('Cocktail', 1500.00),
  ('Soft Drink', 200.00),
  ('Fresh Juice', 400.00),
  ('Coffee', 300.00)
) AS item(name, price)
ON CONFLICT DO NOTHING;

INSERT INTO fb_menu_items (category_id, item_name, unit_price)
SELECT 
  (SELECT id FROM fb_categories WHERE name = 'Minibar'),
  item.name,
  item.price
FROM (VALUES
  ('Water Bottle', 150.00),
  ('Soft Drink Can', 250.00),
  ('Energy Drink', 400.00),
  ('Chips', 300.00),
  ('Chocolate Bar', 350.00),
  ('Nuts', 500.00),
  ('Beer Can', 600.00),
  ('Wine Mini', 1200.00)
) AS item(name, price)
ON CONFLICT DO NOTHING;

INSERT INTO fb_menu_items (category_id, item_name, unit_price)
SELECT 
  (SELECT id FROM fb_categories WHERE name = 'Room Service'),
  item.name,
  item.price
FROM (VALUES
  ('Breakfast Set', 1500.00),
  ('Lunch Set', 2000.00),
  ('Dinner Set', 2500.00),
  ('Snack Platter', 1200.00),
  ('Fruit Basket', 1000.00),
  ('Tea/Coffee Set', 500.00)
) AS item(name, price)
ON CONFLICT DO NOTHING;