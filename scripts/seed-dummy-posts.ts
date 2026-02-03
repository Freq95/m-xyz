/**
 * Seed script to generate 1000 dummy "Cumpăr" (BUY) posts
 * Usage: npx tsx scripts/seed-dummy-posts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_TITLES = [
  'Caut frigider second hand',
  'Cumpăr mașină de spălat',
  'Interesat de bicicletă pentru copii',
  'Caut canapea extensibilă',
  'Doresc să cumpăr laptop folosit',
  'Cumpăr televizor Smart TV',
  'Interesat de telefon mobil',
  'Caut mobilă de grădină',
  'Cumpăr cărți pentru copii',
  'Interesat de aparat foto',
  'Caut scaun birou ergonomic',
  'Cumpăr masă de bucătărie',
  'Interesat de aragaz pe gaz',
  'Caut scuter electric',
  'Cumpăr jucării pentru copii',
  'Interesat de instrumente muzicale',
  'Caut echipament sportiv',
  'Cumpăr cărucior pentru bebeluș',
  'Interesat de pat rabatabil',
  'Caut aspirator robot',
];

const SAMPLE_BODIES = [
  'Sunt interesat să cumpăr acest produs. Aștept oferte serioase. Răspund rapid la mesaje.',
  'Căut în stare bună de funcționare. Buget rezonabil. Contact preferabil în weekend.',
  'Dacă aveți ceva de vânzare la un preț decent, vă rog să mă contactați. Mulțumesc!',
  'Cumpăr urgent. Ofer preț bun pentru produs în stare foarte bună.',
  'Sunt din zona Timișoara. Caut oferte avantajoase. Plata cash.',
  'Interesat de variante second hand în stare bună. Aștept detalii și prețuri.',
  'Caut pentru familie. Aștept propuneri. Răspund la toate mesajele.',
  'Doresc să cumpăr cât mai repede. Ofer un preț corect. Contact telefonic preferat.',
  'Sunt flexibil la preț în funcție de starea produsului. Aștept fotografii și detalii.',
  'Cumpăr doar dacă este în stare foarte bună. Fără defecte. Mulțumesc!',
];

async function main() {
  console.log('🚀 Starting dummy posts generation...\n');

  // Get first user and neighborhood
  const user = await prisma.user.findFirst({
    include: {
      neighborhood: true,
    },
  });

  if (!user || !user.neighborhood) {
    console.error('❌ No user or neighborhood found. Please create a user first.');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email}`);
  console.log(`✅ Found neighborhood: ${user.neighborhood.name}\n`);

  // Generate 1000 posts
  const posts = [];
  for (let i = 0; i < 1000; i++) {
    const title = SAMPLE_TITLES[Math.floor(Math.random() * SAMPLE_TITLES.length)];
    const body = SAMPLE_BODIES[Math.floor(Math.random() * SAMPLE_BODIES.length)];
    const priceCents = Math.floor(Math.random() * 500000) + 10000; // 100 RON to 5000 RON

    posts.push({
      title,
      body,
      category: 'BUY',
      priceCents,
      currency: 'RON',
      isFree: false,
      isPinned: false,
      status: 'active',
      authorId: user.id,
      neighborhoodId: user.neighborhoodId!,
      viewCount: Math.floor(Math.random() * 100),
    });

    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`📝 Generated ${i + 1}/1000 posts...`);
    }
  }

  console.log('\n💾 Inserting posts into database...');

  // Insert in batches of 100 to avoid timeout
  const batchSize = 100;
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    await prisma.post.createMany({
      data: batch,
    });
    console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(posts.length / batchSize)}`);
  }

  console.log(`\n🎉 Successfully created 1000 dummy "Cumpăr" posts!`);
  console.log(`📊 Category: BUY`);
  console.log(`👤 Author: ${user.email}`);
  console.log(`📍 Neighborhood: ${user.neighborhood.name}`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
