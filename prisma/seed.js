const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const timisoaraNeighborhoods = [
  {
    name: 'Cetate',
    city: 'Timișoara',
    slug: 'timisoara-cetate',
    description: 'Centrul istoric al Timișoarei, zona Pieței Victoriei',
    isActive: true,
  },
  {
    name: 'Fabric',
    city: 'Timișoara',
    slug: 'timisoara-fabric',
    description: 'Cartier tradițional în sud-estul orașului',
    isActive: true,
  },
  {
    name: 'Iosefin',
    city: 'Timișoara',
    slug: 'timisoara-iosefin',
    description: 'Cartier în nordul Timișoarei, zona Spitalului Județean',
    isActive: true,
  },
  {
    name: 'Elisabetin',
    city: 'Timișoara',
    slug: 'timisoara-elisabetin',
    description: 'Cartier central-vest, zona Parcului Rozelor',
    isActive: true,
  },
  {
    name: 'Girocului',
    city: 'Timișoara',
    slug: 'timisoara-girocului',
    description: 'Cartier rezidențial modern în estul orașului',
    isActive: true,
  },
  {
    name: 'Mehala',
    city: 'Timișoara',
    slug: 'timisoara-mehala',
    description: 'Cartier în nord-estul Timișoarei',
    isActive: true,
  },
  {
    name: 'Complexul Studențesc',
    city: 'Timișoara',
    slug: 'timisoara-complexul-studentesc',
    description: 'Zona universitară și studențească',
    isActive: true,
  },
  {
    name: 'Circumvalațiunii',
    city: 'Timișoara',
    slug: 'timisoara-circumvalatiunii',
    description: 'Cartier de-a lungul șoselei de centură',
    isActive: true,
  },
  {
    name: 'Plopi',
    city: 'Timișoara',
    slug: 'timisoara-plopi',
    description: 'Cartier rezidențial în sud-vestul orașului',
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding Timișoara neighborhoods...');

  for (const neighborhood of timisoaraNeighborhoods) {
    const created = await prisma.neighborhood.upsert({
      where: { slug: neighborhood.slug },
      update: {
        name: neighborhood.name,
        description: neighborhood.description,
        isActive: neighborhood.isActive,
      },
      create: neighborhood,
    });
    console.log(`✅ ${created.name} (${created.slug})`);
  }

  console.log('\n✨ Seeding completed! Total neighborhoods:', timisoaraNeighborhoods.length);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
