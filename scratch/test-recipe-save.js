const prisma = require('../backend/src/config/prisma');

async function main() {
  try {
    const products = await prisma.product.findMany({
      take: 1
    });
    if (products.length === 0) {
      console.log('No products found to test.');
      return;
    }
    const p = products[0];
    console.log('Testing update on product ID:', p.id);
    console.log('Product details:', JSON.stringify(p, null, 2));

    const recipe = [{ rawMaterialId: 'some-raw-id', quantity: 1.5 }];
    const updated = await prisma.product.update({
      where: { id: p.id },
      data: {
        recipe: recipe
      }
    });
    console.log('Success! Updated product recipe:', updated.recipe);
  } catch (error) {
    console.error('Error updating product recipe:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
