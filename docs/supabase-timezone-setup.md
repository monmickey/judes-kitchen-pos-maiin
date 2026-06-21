# Supabase / PostgreSQL Timezone Configuration

To configure your Supabase PostgreSQL database to run in UTC and store all timestamps with correct timezone support, follow these SQL scripts and best practices.

---

## 1. Configure Database Default Timezone
By default, Supabase databases are configured to UTC. You can explicitly set it to ensure consistency:

```sql
-- Set the database default timezone to UTC
ALTER DATABASE postgres SET timezone TO 'UTC';

-- Verify the current database timezone setting
SHOW timezone;
```

---

## 2. Best Practices for Table Schemas
Always use `TIMESTAMPTZ` (Timestamp with Time Zone) instead of `TIMESTAMP`. 
* When PostgreSQL stores a `TIMESTAMPTZ` value, it converts the input value to UTC and saves it.
* When retrieving a `TIMESTAMPTZ` value, it displays the value in the configured timezone of the connection (which defaults to UTC).
* Using `TIMESTAMP` (without timezone) throws away offset information and makes timezone conversions extremely error-prone.

### Standard Table Definition:
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no VARCHAR(100) UNIQUE NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Timestamps with correct defaults and timezone details
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

---

## 3. Automatic `updated_at` Timestamp Updates
To update the `updated_at` timestamp automatically whenever a record is modified, create a reusable PostgreSQL trigger function and attach it to your tables.

### Step 3a: Create the trigger function
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW(); -- NOW() returns the current TIMESTAMPTZ (automatically in UTC)
    RETURN NEW;
END;
$$ language 'plpgsql';
```

### Step 3b: Attach trigger to your tables
Attach the trigger to every table that requires auto-updating timestamps.

```sql
-- Attach to 'orders' table
CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

## 4. Prisma Mapping (`schema.prisma`)
If you use Prisma to interact with Supabase, ensure that your `DateTime` fields are mapped correctly to `Timestamptz`:

```prisma
model Order {
  id          String   @id @default(uuid())
  invoiceNo   String   @unique
  subtotal    Float
  taxTotal    Float
  grandTotal  Float
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt       @db.Timestamptz(6)
}
```
* Using `@db.Timestamptz(6)` tells Prisma explicitly to use `TIMESTAMPTZ` in PostgreSQL.
* `@default(now())` maps directly to PostgreSQL's `DEFAULT NOW()`.
* `@updatedAt` tells Prisma client to automatically update this timestamp on update queries.

---

## 5. Vercel Server Environment Configuration

When deploying Serverless Functions (e.g., Node.js APIs or SSR handlers), the host's default timezone affects native JavaScript date instantiation (like `new Date().toString()`).

To guarantee that the Node.js runtime process executes strictly in UTC on Vercel, you can set the `TZ` environment variable.

### Option A: `vercel.json`
Configure the environment variable directly in your [vercel.json](file:///c:/Asif/projects/judes-kitchen-pos-main/vercel.json):
```json
{
  "version": 2,
  "env": {
    "TZ": "UTC"
  }
}
```
*(We have already configured this for you in the repository's [vercel.json](file:///c:/Asif/projects/judes-kitchen-pos-main/vercel.json)).*

### Option B: Vercel Dashboard Settings
Alternatively, add it manually in the Vercel Web Console:
1. Navigate to your project on **Vercel** > **Settings** > **Environment Variables**.
2. Add a new variable:
   - **Key**: `TZ`
   - **Value**: `UTC`
3. Click **Save** and trigger a redeployment.
