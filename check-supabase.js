// Supabase Connection Diagnostic Tool
const fs = require('fs');
const path = require('path');

// Manually load .env.local
try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  console.log('⚠️  Could not load .env.local');
}

console.log('=== Supabase Connection Diagnostic ===\n');

// Check environment variables
console.log('1. Environment Variables:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');

if (process.env.DATABASE_URL) {
  console.log('\n2. Database URL Format:');
  const dbUrl = process.env.DATABASE_URL;

  // Parse connection string
  const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

  if (match) {
    const [, user, password, host, port, database] = match;
    console.log('   User:', user);
    console.log('   Password:', password.length > 0 ? `✅ ${password.length} chars` : '❌ Empty');
    console.log('   Host:', host);
    console.log('   Port:', port);
    console.log('   Database:', database);

    if (port === '6543') {
      console.log('   ✅ Using Session Pooler (port 6543) - Correct for Next.js');
    } else if (port === '5432') {
      console.log('   ⚠️  Using Direct Connection (port 5432) - Not recommended for Next.js');
      console.log('   💡 Change to port 6543 (Session Pooler)');
    } else {
      console.log('   ❌ Unexpected port:', port);
    }

    if (host.includes('pooler.supabase.com')) {
      console.log('   ✅ Host format looks correct');
    } else if (host.includes('supabase.co')) {
      console.log('   ⚠️  Host might be for direct connection, not pooler');
    } else {
      console.log('   ❌ Host format doesn\'t look like Supabase');
    }
  } else {
    console.log('   ❌ Could not parse DATABASE_URL format');
    console.log('   Current value:', dbUrl);
    console.log('\n   Expected format:');
    console.log('   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres');
  }
}

console.log('\n3. Testing Supabase Auth Connection:');
const { createClient } = require('@supabase/supabase-js');

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('   ✅ Supabase client created');
  console.log('   💡 You can test auth by registering a user');
} else {
  console.log('   ❌ Cannot create Supabase client - missing credentials');
}

console.log('\n4. Testing Database Connection:');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.count()
  .then(count => {
    console.log(`   ✅ Database connected! Found ${count} users`);
    return prisma.user.findMany({
      select: { id: true, email: true, fullName: true, createdAt: true }
    });
  })
  .then(users => {
    if (users.length > 0) {
      console.log('\n   Users in database:');
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.fullName})`);
      });
    }
  })
  .catch(error => {
    console.log('   ❌ Database connection failed');
    console.log('   Error:', error.message);

    if (error.message.includes('Tenant or user not found')) {
      console.log('\n   💡 FIX: Your connection string format is incorrect');
      console.log('   Go to: Supabase Dashboard > Settings > Database > Connection string');
      console.log('   Select: "Session pooler"');
      console.log('   Copy the connection string and update .env.local');
      console.log('\n   Expected format:');
      console.log('   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres');
      console.log('\n   Note: Replace [PASSWORD] with your actual database password');
    }
  })
  .finally(() => {
    prisma.$disconnect();
  });
