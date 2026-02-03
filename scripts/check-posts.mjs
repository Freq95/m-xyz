import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const buyCount = await prisma.post.count({ where: { category: 'BUY' } });
  const activeCount = await prisma.post.count({ where: { category: 'BUY', status: 'active' } });

  console.log('Total BUY posts:', buyCount);
  console.log('Active BUY posts:', activeCount);

  // Get a sample post
  const sample = await prisma.post.findFirst({
    where: { category: 'BUY' },
    include: { neighborhood: true, author: true }
  });

  if (sample) {
    console.log('\nSample post:');
    console.log('- ID:', sample.id);
    console.log('- Category:', sample.category);
    console.log('- Status:', sample.status);
    console.log('- Neighborhood:', sample.neighborhood?.name);
    console.log('- Author:', sample.author?.email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
