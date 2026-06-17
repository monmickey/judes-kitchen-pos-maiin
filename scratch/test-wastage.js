const prisma = require('../backend/src/config/prisma');

async function main() {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({ take: 1 });
    if (rawMaterials.length === 0) {
      console.log('No raw materials found.');
      return;
    }
    const raw = rawMaterials[0];
    console.log('Testing wastage for raw material:', raw.name);

    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.wastageEntry.create({
        data: {
          rawMaterialId: raw.id,
          rawMaterialName: raw.name,
          quantity: 2.5,
          reason: 'Spoiled'
        }
      });

      await tx.rawMaterial.update({
        where: { id: raw.id },
        data: {
          stockQuantity: { decrement: 2.5 }
        }
      });

      return log;
    });

    console.log('Success! Created wastage entry:', JSON.stringify(result, null, 2));

    const updatedRaw = await prisma.rawMaterial.findUnique({ where: { id: raw.id } });
    console.log('New stock quantity:', updatedRaw.stockQuantity);
  } catch (error) {
    console.error('Error in wastage test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
