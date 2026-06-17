const prisma = require('../backend/src/config/prisma');

async function main() {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({ take: 1 });
    if (rawMaterials.length === 0) {
      console.log('No raw materials found. Creating one...');
      const newItem = await prisma.rawMaterial.create({
        data: { name: 'Test Raw', unit: 'kg', stockQuantity: 10 }
      });
      rawMaterials.push(newItem);
    }
    const raw = rawMaterials[0];
    console.log('Testing procurement for raw material:', raw.name);

    const invoiceNo = 'INV-' + Date.now();
    const items = [{
      rawMaterialId: raw.id,
      rawMaterialName: raw.name,
      quantity: 5,
      price: 100,
      total: 500
    }];

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase Entry
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          invoiceNo,
          supplierName: 'Test Supplier',
          totalAmount: 500,
          items: {
            create: items.map(i => ({
              rawMaterialId: i.rawMaterialId,
              rawMaterialName: i.rawMaterialName,
              quantity: parseFloat(i.quantity),
              price: parseFloat(i.price),
              total: parseFloat(i.total)
            }))
          }
        },
        include: {
          items: true
        }
      });

      // 2. Update stock for each raw material
      for (const item of items) {
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: {
            stockQuantity: { increment: parseFloat(item.quantity) }
          }
        });
      }

      return purchase;
    });

    console.log('Success! Created purchase:', JSON.stringify(result, null, 2));
    
    // Check raw material stock after procurement
    const updatedRaw = await prisma.rawMaterial.findUnique({ where: { id: raw.id } });
    console.log('New stock quantity:', updatedRaw.stockQuantity);
  } catch (error) {
    console.error('Error in procurement test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
