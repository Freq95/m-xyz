// Migration script: Add username column
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Starting migration: Adding username column...');

    // Add username column (nullable, unique)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
    `);
    console.log('✓ Added username column');

    // Create index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    console.log('✓ Created index on username');

    console.log('\n✅ Migration completed successfully!');
    console.log('Users can now set their username through /settings');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
