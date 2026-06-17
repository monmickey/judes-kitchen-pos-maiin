const sqlite3 = require('sqlite3').verbose();
const postgres = require('postgres');
const path = require('path');
const fs = require('fs');

// Load environment variables from the root .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ Error: DATABASE_URL not found in root .env file");
  process.exit(1);
}

const sqlitePath = path.join(__dirname, '../../prisma/dev.db');
if (!fs.existsSync(sqlitePath)) {
  console.error(`❌ Error: SQLite database not found at ${sqlitePath}`);
  process.exit(1);
}

console.log("Connecting to SQLite database...");
const localDb = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY);

console.log("Connecting to Supabase database...");
const sql = postgres(dbUrl, {
  ssl: 'require' // recommended for Supabase
});

// Helper to run query in SQLite returning Promise
function all(query, params = []) {
  return new Promise((resolve, reject) => {
    localDb.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Parse helper for JSON columns
function parseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

async function migrate() {
  try {
    console.log("Cleaning up default placeholder data in Supabase...");
    
    // Delete tables in correct foreign key order
    await sql`DELETE FROM "UserActivity"`;
    await sql`DELETE FROM "InventoryLog"`;
    await sql`DELETE FROM "WastageEntry"`;
    await sql`DELETE FROM "RawMaterialPurchaseItem"`;
    await sql`DELETE FROM "RawMaterialPurchase"`;
    await sql`DELETE FROM "RawMaterial"`;
    await sql`DELETE FROM "OrderItem"`;
    await sql`DELETE FROM "KOTItem"`;
    await sql`DELETE FROM "KOT"`;
    await sql`DELETE FROM "Payment"`;
    await sql`DELETE FROM "Order"`;
    await sql`DELETE FROM "Product"`;
    await sql`DELETE FROM "Category"`;
    await sql`DELETE FROM "Supplier"`;
    await sql`DELETE FROM "Table"`;
    await sql`DELETE FROM "TableSection"`;
    await sql`DELETE FROM "RestaurantSettings"`;
    await sql`DELETE FROM "User"`;
    
    console.log("Supabase database cleared. Starting migration of master data...");

    // 1. Migrate Users
    console.log("\n--- 👥 Migrating Users ---");
    const users = await all("SELECT * FROM User");
    console.log(`Found ${users.length} users in SQLite.`);
    for (const u of users) {
      await sql`
        INSERT INTO "User" (
          id, name, username, email, password, role, permissions, "licenseId", "createdAt", "updatedAt"
        ) VALUES (
          ${u.id}, ${u.name}, ${u.username}, ${u.email}, ${u.password}, ${u.role}, ${parseJson(u.permissions)}, ${u.licenseId}, ${new Date(u.createdAt)}, ${new Date(u.updatedAt)}
        ) ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Users migrated.");

    // 2. Migrate Categories
    console.log("\n--- 🏷️ Migrating Categories ---");
    const categories = await all("SELECT * FROM Category");
    console.log(`Found ${categories.length} categories in SQLite.`);
    for (const c of categories) {
      await sql`
        INSERT INTO "Category" (id, name)
        VALUES (${c.id}, ${c.name})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Categories migrated.");

    // 3. Migrate Suppliers
    console.log("\n--- 🤝 Migrating Suppliers ---");
    const suppliers = await all("SELECT * FROM Supplier");
    console.log(`Found ${suppliers.length} suppliers in SQLite.`);
    for (const s of suppliers) {
      await sql`
        INSERT INTO "Supplier" (
          id, name, phone, email, "gstNo", address, "openingBalance", is_active, "createdAt", "updatedAt"
        ) VALUES (
          ${s.id}, ${s.name}, ${s.phone}, ${s.email}, ${s.gstNo}, ${s.address}, ${s.openingBalance}, ${s.is_active === 1 || s.is_active === true}, ${new Date(s.createdAt)}, ${new Date(s.updatedAt)}
        ) ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Suppliers migrated.");

    // 4. Migrate Products (Food Items)
    console.log("\n--- 🍔 Migrating Products (Food Items) ---");
    const products = await all("SELECT * FROM Product");
    console.log(`Found ${products.length} products in SQLite.`);
    for (const p of products) {
      await sql`
        INSERT INTO "Product" (
          id, name, barcode, "categoryId", brand, "purchasePrice", "sellingPrice", mrp, "gstRate", "stockQuantity", unit, supplier, "supplierId", is_active, "foodType", availability, variants, addons, "preparationTime", "kitchenDept", recipe, "createdAt", "updatedAt"
        ) VALUES (
          ${p.id}, ${p.name}, ${p.barcode}, ${p.categoryId}, ${p.brand}, ${p.purchasePrice}, ${p.sellingPrice}, ${p.mrp}, ${p.gstRate}, ${p.stockQuantity}, ${p.unit}, ${p.supplier}, ${p.supplierId}, ${p.is_active === 1 || p.is_active === true}, ${p.foodType}, ${p.availability === 1 || p.availability === true}, ${parseJson(p.variants)}, ${parseJson(p.addons)}, ${p.preparationTime}, ${p.kitchenDept}, ${parseJson(p.recipe)}, ${new Date(p.createdAt)}, ${new Date(p.updatedAt)}
        ) ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Products migrated.");

    // 5. Migrate TableSections
    console.log("\n--- 📍 Migrating Table Sections ---");
    const sections = await all("SELECT * FROM TableSection");
    console.log(`Found ${sections.length} table sections in SQLite.`);
    for (const sec of sections) {
      await sql`
        INSERT INTO "TableSection" (id, name, "createdAt", "updatedAt")
        VALUES (${sec.id}, ${sec.name}, ${new Date(sec.createdAt)}, ${new Date(sec.updatedAt)})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Table Sections migrated.");

    // 6. Migrate Tables
    console.log("\n--- 🪑 Migrating Tables ---");
    const tables = await all("SELECT * FROM \"Table\"");
    console.log(`Found ${tables.length} tables in SQLite.`);
    for (const t of tables) {
      await sql`
        INSERT INTO "Table" (
          id, number, capacity, status, "sectionId", "currentOrderId", "runningOrderAmount", "occupiedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${t.id}, ${t.number}, ${t.capacity}, ${t.status}, ${t.sectionId}, ${t.currentOrderId}, ${t.runningOrderAmount}, ${t.occupiedAt ? new Date(t.occupiedAt) : null}, ${new Date(t.createdAt)}, ${new Date(t.updatedAt)}
        ) ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Tables migrated.");

    // 7. Migrate RestaurantSettings
    console.log("\n--- ⚙️ Migrating Restaurant Settings ---");
    const settings = await all("SELECT * FROM RestaurantSettings");
    console.log(`Found ${settings.length} settings records in SQLite.`);
    for (const set of settings) {
      await sql`
        INSERT INTO "RestaurantSettings" (
          id, name, logo, address, phone, gstin, currency, "gstRate", "parcelCharge", "deliveryCharge", "printerSize", "maxDiscountPercent", "createdAt", "updatedAt"
        ) VALUES (
          ${set.id}, ${set.name}, ${set.logo}, ${set.address}, ${set.phone}, ${set.gstin}, ${set.currency}, ${set.gstRate}, ${set.parcelCharge}, ${set.deliveryCharge}, ${set.printerSize}, ${set.maxDiscountPercent}, ${new Date(set.createdAt)}, ${new Date(set.updatedAt)}
        ) ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Restaurant Settings migrated.");

    // 8. Migrate Raw Materials
    console.log("\n--- 📦 Migrating Raw Materials ---");
    const rawMaterials = await all("SELECT * FROM RawMaterial");
    console.log(`Found ${rawMaterials.length} raw materials in SQLite.`);
    for (const r of rawMaterials) {
      await sql`
        INSERT INTO "RawMaterial" (
          id, name, unit, "stockQuantity", "lowStockThreshold", "createdAt", "updatedAt"
        ) VALUES (
          ${r.id}, ${r.name}, ${r.unit}, ${r.stockQuantity}, ${r.lowStockThreshold}, ${new Date(r.createdAt)}, ${new Date(r.updatedAt)}
        ) ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Raw Materials migrated.");

    console.log("\n🎉 ALL MASTER DATA MIGRATED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    localDb.close();
    await sql.end();
  }
}

migrate();
