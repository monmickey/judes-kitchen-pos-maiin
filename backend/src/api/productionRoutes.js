const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// 1. Fetch only products that have recipes defined in the recipe matrix
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        is_active: true
      },
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });

    const rawMaterials = await prisma.rawMaterial.findMany();
    const rawMap = new Map(rawMaterials.map(rm => [rm.id, rm]));

    const productsWithRecipes = products.map(p => {
      let recipeArray = p.recipe;
      if (typeof recipeArray === 'string') {
        try {
          recipeArray = JSON.parse(recipeArray);
        } catch (e) {
          recipeArray = null;
        }
      }

      if (!Array.isArray(recipeArray) || recipeArray.length === 0) {
        return null; // Skip products without recipe mappings
      }

      // Map raw material names & units
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

    res.json(productsWithRecipes);
  } catch (error) {
    console.error('Error in GET /api/production/products:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Perform kitchen entry / finished product production with recipe stock deduction
router.post('/produce', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required for production' });
    }

    // Execute everything in a single transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      const rawMaterialsNeed = {};
      const productsMap = {};

      for (const item of items) {
        if (!item.productId || !item.quantity || Number(item.quantity) <= 0) {
          throw new Error('Invalid item product ID or quantity specified');
        }

        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (!prod) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        productsMap[item.productId] = prod;

        let recipe = item.customRecipe || prod.recipe;
        if (typeof recipe === 'string') {
          recipe = JSON.parse(recipe);
        }

        if (!Array.isArray(recipe) || recipe.length === 0) {
          throw new Error(`Product "${prod.name}" has no recipe mapping defined`);
        }

        for (const ing of recipe) {
          const totalQty = (Number(ing.quantity) || 0) * Number(item.quantity);
          rawMaterialsNeed[ing.rawMaterialId] = (rawMaterialsNeed[ing.rawMaterialId] || 0) + totalQty;
        }
      }

      // Check current stocks in database
      const errors = [];
      for (const [rawId, qtyNeeded] of Object.entries(rawMaterialsNeed)) {
        const raw = await tx.rawMaterial.findUnique({ where: { id: rawId } });
        if (!raw) {
          errors.push(`Raw material ID ${rawId} not found in database.`);
          continue;
        }
        if (raw.stockQuantity < qtyNeeded) {
          errors.push(`Insufficient stock for ${raw.name}. Required: ${qtyNeeded.toFixed(2)} ${raw.unit}, Available: ${raw.stockQuantity.toFixed(2)} ${raw.unit}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(' | '));
      }

      // Perform updates
      const batchesCreated = [];

      for (const [idx, item] of items.entries()) {
        const prod = productsMap[item.productId];

        // 1. Increment Finished Product Stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: Number(item.quantity) }
          }
        });

        // 2. Log finished product addition to InventoryLog
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: Number(item.quantity),
            reason: 'Production (Kitchen Entry)'
          }
        });

        // 3. Create ProductionBatch
        const batchNo = `PB-${Date.now().toString().slice(-6)}-${idx}`;
        const batch = await tx.productionBatch.create({
          data: {
            batchNo,
            finishedProductId: item.productId,
            quantityProduced: Number(item.quantity),
            createdBy: 'Kitchen Staff'
          }
        });

        // 4. Process ingredients and deduct raw materials
        let recipe = item.customRecipe || prod.recipe;
        if (typeof recipe === 'string') {
          recipe = JSON.parse(recipe);
        }

        for (const ing of recipe) {
          const deduct = (Number(ing.quantity) || 0) * Number(item.quantity);
          const raw = await tx.rawMaterial.findUnique({ where: { id: ing.rawMaterialId } });
          const rawName = raw ? raw.name : 'Unknown Raw Material';

          // Decrement raw material stock
          await tx.rawMaterial.update({
            where: { id: ing.rawMaterialId },
            data: {
              stockQuantity: { decrement: deduct }
            }
          });

          // Create wastage/consumption entry
          await tx.wastageEntry.create({
            data: {
              rawMaterialId: ing.rawMaterialId,
              rawMaterialName: rawName,
              quantity: deduct,
              reason: `Production: consumed for ${prod.name} x ${item.quantity}`
            }
          });

          // Create production batch item
          await tx.productionBatchItem.create({
            data: {
              batchId: batch.id,
              rawMaterialId: ing.rawMaterialId,
              quantityConsumed: deduct
            }
          });
        }

        batchesCreated.push(batch);
      }

      return batchesCreated;
    });

    // 5. Emit real-time updates via Socket.io
    const io = req.app.get('io');
    if (io) {
      // Emit update with the finished product stock increases
      io.emit('INVENTORY_UPDATE', { 
        items: items.map(i => ({ id: i.productId, quantity: i.quantity }))
      });
      // Also emit a production completion event
      io.emit('PRODUCTION_COMPLETED', { batches: result });
    }

    res.status(201).json({ success: true, message: 'Production batch logged successfully!', batches: result });
  } catch (error) {
    console.error('Error in POST /api/production/produce:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
