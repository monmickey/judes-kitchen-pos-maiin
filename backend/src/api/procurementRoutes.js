const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Workspace data consolidator to optimize page loading times (single roundtrip)
router.get('/workspace-data', async (req, res) => {
  try {
    const [vendors, rawMaterials, allProducts, categories] = await Promise.all([
      prisma.supplier.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      }),
      prisma.rawMaterial.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      }),
      prisma.product.findMany({
        where: { is_active: true },
        include: { category: true },
        orderBy: { name: 'asc' }
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' }
      })
    ]);

    // Format raw materials
    const formattedRawMaterials = rawMaterials.map(rm => ({
      id: rm.id,
      productName: rm.name,
      category: 'Raw Materials',
      unit: rm.unit,
      stockQuantity: rm.stockQuantity,
      defaultPrice: 0.0
    }));

    // Format products with recipes
    const rawMap = new Map(rawMaterials.map(rm => [rm.id, rm]));
    const productionProducts = allProducts.map(p => {
      let recipeArray = p.recipe;
      if (typeof recipeArray === 'string') {
        try {
          recipeArray = JSON.parse(recipeArray);
        } catch (e) {
          recipeArray = null;
        }
      }

      if (!Array.isArray(recipeArray) || recipeArray.length === 0) {
        return null;
      }

      const enrichedRecipe = recipeArray.map(ing => {
        const raw = rawMap.get(ing.rawMaterialId);
        return {
          rawMaterialId: ing.rawMaterialId,
          quantity: Number(ing.quantity) || 0,
          name: raw ? raw.name : 'Unknown Raw Material',
          unit: raw ? raw.unit : 'pcs'
        };
      });

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stockQuantity: p.stockQuantity,
        recipe: enrichedRecipe
      };
    }).filter(Boolean);

    res.json({
      vendors,
      rawMaterials: formattedRawMaterials,
      productionProducts,
      allFinishedProducts: allProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        stockQuantity: p.stockQuantity,
        recipe: p.recipe
      })),
      categories
    });
  } catch (error) {
    console.error('Error in GET /api/procurements/workspace-data:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1. Get all suppliers (vendors) from the existing supply registry
router.get('/vendors', async (req, res) => {
  try {
    const vendors = await prisma.supplier.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });
    res.json(vendors);
  } catch (error) {
    console.error('Error in GET /api/procurements/vendors:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a new vendor directly in the supply registry
router.post('/vendors', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        openingBalance: 0,
        is_active: true
      }
    });
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error in POST /api/procurements/vendors:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Get all raw materials from the raw material inventory registry
router.get('/products', async (req, res) => {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });
    // Map to productName to keep frontend components compatible
    const formatted = rawMaterials.map(rm => ({
      id: rm.id,
      productName: rm.name,
      category: 'Raw Materials',
      unit: rm.unit,
      stockQuantity: rm.stockQuantity,
      defaultPrice: 0.0 // RawMaterial model has no default price column; resolved via vendor_products
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error in GET /api/procurements/products:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Create a new raw material directly in the inventory registry
router.post('/products', async (req, res) => {
  try {
    const { productName, category, unit } = req.body;
    if (!productName) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const existing = await prisma.rawMaterial.findUnique({
      where: { name: productName }
    });

    let rawMaterial;
    if (existing) {
      if (existing.is_active) {
        return res.status(400).json({ error: 'Raw material with this name already exists' });
      } else {
        // Reactivate soft-deleted raw material
        rawMaterial = await prisma.rawMaterial.update({
          where: { id: existing.id },
          data: {
            is_active: true,
            unit: unit || existing.unit
          }
        });
      }
    } else {
      rawMaterial = await prisma.rawMaterial.create({
        data: {
          name: productName,
          unit: unit || 'kg',
          stockQuantity: 0.0,
          lowStockThreshold: 0.0
        }
      });
    }

    res.status(201).json({
      id: rawMaterial.id,
      productName: rawMaterial.name,
      category: 'Raw Materials',
      unit: rawMaterial.unit,
      stockQuantity: rawMaterial.stockQuantity,
      defaultPrice: 0.0
    });
  } catch (error) {
    console.error('Error in POST /api/procurements/products:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get raw materials previously associated with a supplier
router.get('/vendors/:vendorId/products', async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendorProducts = await prisma.vendorProduct.findMany({
      where: { vendorId },
      include: {
        rawMaterial: true
      },
      orderBy: {
        rawMaterial: {
          name: 'asc'
        }
      }
    });

    // Map to return just the products with defaultPrice added
    const formattedProducts = vendorProducts.map(vp => ({
      id: vp.rawMaterial.id,
      productName: vp.rawMaterial.name,
      category: 'Raw Materials',
      unit: vp.rawMaterial.unit,
      stockQuantity: vp.rawMaterial.stockQuantity,
      defaultPrice: vp.defaultPrice
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('Error in GET /api/procurements/vendors/:vendorId/products:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Save procurement to the database (supports both raw materials and finished products)
router.post('/', async (req, res) => {
  try {
    const { vendorId, invoiceNumber, totalAmount, items } = req.body;

    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor ID is required' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: vendorId } });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found in registry' });
    }

    // Execute in a transaction to guarantee data integrity
    const result = await prisma.$transaction(async (tx) => {
      const rawItems = items.filter(i => !i.isFinishedProduct);
      const finishedItems = items.filter(i => i.isFinishedProduct);

      let rawPurchase = null;
      const rawCreatedItems = [];
      let finishedPurchase = null;
      const finishedCreatedItems = [];

      // 1. Save Raw Materials if any
      if (rawItems.length > 0) {
        const rawTotal = rawItems.reduce((acc, item) => acc + parseFloat(item.totalPrice), 0);
        rawPurchase = await tx.rawMaterialPurchase.create({
          data: {
            invoiceNo: invoiceNumber || `PROC-${Date.now().toString().slice(-6)}`,
            supplierName: supplier.name,
            totalAmount: rawTotal
          }
        });

        for (const item of rawItems) {
          let name = item.productName;
          if (!name) {
            const rm = await tx.rawMaterial.findUnique({ where: { id: item.productId } });
            name = rm ? rm.name : 'Unknown Raw Material';
          }

          const pItem = await tx.rawMaterialPurchaseItem.create({
            data: {
              purchaseId: rawPurchase.id,
              rawMaterialId: item.productId,
              rawMaterialName: name,
              quantity: parseFloat(item.quantity),
              price: parseFloat(item.unitPrice),
              total: parseFloat(item.totalPrice)
            }
          });
          rawCreatedItems.push(pItem);

          // Update the rawMaterial's stockQuantity in inventory!
          await tx.rawMaterial.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                increment: parseFloat(item.quantity)
              }
            }
          });

          // Upsert vendor-product relationship
          const existingAssoc = await tx.vendorProduct.findFirst({
            where: {
              vendorId,
              productId: item.productId
            }
          });

          if (existingAssoc) {
            await tx.vendorProduct.update({
              where: { id: existingAssoc.id },
              data: { defaultPrice: parseFloat(item.unitPrice) }
            });
          } else {
            await tx.vendorProduct.create({
              data: {
                vendorId,
                productId: item.productId,
                defaultPrice: parseFloat(item.unitPrice)
              }
            });
          }
        }
      }

      // 2. Save Finished Products if any (treated as Production / Kitchen Entry)
      if (finishedItems.length > 0) {
        for (const item of finishedItems) {
          // Fetch product recipe details
          const p = await tx.product.findUnique({
            where: { id: item.productId }
          });

          if (!p) {
            throw new Error(`Product ${item.productName || item.productId} not found`);
          }

          // Increment Product Stock (Finished Product)
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { increment: parseFloat(item.quantity) },
              purchasePrice: parseFloat(item.unitPrice)
            }
          });

          // Log finished product addition to InventoryLog
          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              type: 'IN',
              quantity: parseFloat(item.quantity),
              reason: 'Production (Kitchen Entry)'
            }
          });

          // Process recipe and deduct raw materials
          let recipe = p.recipe;
          if (recipe) {
            if (typeof recipe === 'string') {
              try {
                recipe = JSON.parse(recipe);
              } catch (e) {
                console.error("Failed to parse recipe JSON:", e);
                recipe = [];
              }
            }
            if (Array.isArray(recipe)) {
              for (const ingredient of recipe) {
                const rawId = ingredient.rawMaterialId;
                const ingredientQty = Number(ingredient.quantity) || 0;
                const totalDeduct = ingredientQty * parseFloat(item.quantity);
                if (rawId && totalDeduct > 0) {
                  // Fetch raw material to get its name
                  const rawMat = await tx.rawMaterial.findUnique({ where: { id: rawId } });
                  const rawMatName = rawMat ? rawMat.name : 'Unknown Raw Material';

                  // Decrement raw material stock in inventory
                  await tx.rawMaterial.update({
                    where: { id: rawId },
                    data: {
                      stockQuantity: { decrement: totalDeduct }
                    }
                  });

                  // Log wastage/consumption
                  await tx.wastageEntry.create({
                    data: {
                      rawMaterialId: rawId,
                      rawMaterialName: rawMatName,
                      quantity: totalDeduct,
                      reason: `Production: consumed for ${p.name} x ${item.quantity}`
                    }
                  });
                }
              }
            }
          }
        }
      }

      // Emit real-time events for finished products if any
      const io = req.app.get('io');
      if (io && finishedItems.length > 0) {
        io.emit('INVENTORY_UPDATE', { items: finishedItems.map(pi => ({ id: pi.productId, quantity: pi.quantity })) });
      }

      return { 
        raw: rawPurchase ? { purchase: rawPurchase, items: rawCreatedItems } : null,
        finished: finishedItems.length > 0 ? { message: 'Production logged successfully', items: finishedItems } : null
      };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error in POST /api/procurements:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
