// Check if neighborhoods were seeded
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkNeighborhoods() {
  try {
    const neighborhoods = await prisma.neighborhood.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`Found ${neighborhoods.length} neighborhoods:\n`);

    neighborhoods.forEach(n => {
      console.log(`✅ ${n.name} (${n.city})`);
      console.log(`   Slug: ${n.slug}`);
      console.log(`   Active: ${n.isActive}`);
      console.log(`   Members: ${n.memberCount}`);
      console.log();
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkNeighborhoods();
