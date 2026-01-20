// Quick database connection test
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');

    // Try to count users
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected! User count: ${userCount}`);

    // Try to fetch all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        emailVerifiedAt: true
      }
    });

    console.log('\nUsers in database:');
    if (users.length === 0) {
      console.log('  No users found.');
    } else {
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.fullName})`);
        console.log(`    ID: ${user.id}`);
        console.log(`    Created: ${user.createdAt}`);
        console.log(`    Verified: ${user.emailVerifiedAt || 'Not verified'}`);
      });
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
