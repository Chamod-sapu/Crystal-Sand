-- 1. Add Late Check-in flag to guests table
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_late_checkin boolean DEFAULT false;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_monthly_rate boolean DEFAULT false;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS monthly_rate_months integer DEFAULT 1;

-- 2. Create other_items table for catalog management
CREATE TABLE IF NOT EXISTS other_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  description text,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set RLS policies for other_items
ALTER TABLE other_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all authenticated users on other_items" ON other_items;
CREATE POLICY "Allow read access to all authenticated users on other_items"
ON other_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all actions for authenticated users on other_items" ON other_items;
CREATE POLICY "Allow all actions for authenticated users on other_items"
ON other_items FOR ALL TO authenticated USING (true);

-- 3. Create other_item_sales table for sales records
CREATE TABLE IF NOT EXISTS other_item_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  item_id uuid REFERENCES other_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit_price numeric NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_price numeric NOT NULL,
  sold_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set RLS policies for other_item_sales
ALTER TABLE other_item_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all authenticated users on other_item_sales" ON other_item_sales;
CREATE POLICY "Allow read access to all authenticated users on other_item_sales"
ON other_item_sales FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all actions for authenticated users on other_item_sales" ON other_item_sales;
CREATE POLICY "Allow all actions for authenticated users on other_item_sales"
ON other_item_sales FOR ALL TO authenticated USING (true);
