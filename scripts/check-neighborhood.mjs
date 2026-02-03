import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the user
  const user = await prisma.user.findFirst({
    where: { email: '95novac@gmail.com' },
    include: { neighborhood: true }
  });

  console.log('Current user:');
  console.log('- Email:', user?.email);
  console.log('- NeighborhoodId:', user?.neighborhoodId);
  console.log('- Neighborhood name:', user?.neighborhood?.name);

  // Count posts by this user
  const totalPosts = await prisma.post.count({
    where: { authorId: user?.id }
  });

  const buyPosts = await prisma.post.count({
    where: { authorId: user?.id, category: 'BUY' }
  });

  const buyPostsInNeighborhood = await prisma.post.count({
    where: {
      authorId: user?.id,
      category: 'BUY',
      neighborhoodId: user?.neighborhoodId
    }
  });

  console.log('\nPost counts:');
  console.log('- Total posts by user:', totalPosts);
  console.log('- BUY posts by user:', buyPosts);
  console.log('- BUY posts in user neighborhood:', buyPostsInNeighborhood);

  // Check if posts have different neighborhoodId
  const postsGrouped = await prisma.post.groupBy({
    by: ['neighborhoodId'],
    where: { authorId: user?.id, category: 'BUY' },
    _count: true
  });

  console.log('\nBUY posts grouped by neighborhood:');
  for (const group of postsGrouped) {
    const nbh = await prisma.neighborhood.findUnique({
      where: { id: group.neighborhoodId }
    });
    console.log(`- ${nbh?.name || 'Unknown'}: ${group._count} posts`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
