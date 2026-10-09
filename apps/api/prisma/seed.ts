import { PrismaClient } from '@prisma/client';
import { CryptoService } from '../src/infrastructure/security/crypto.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando Seeder de Base de Datos MikroManager...');

  // 1. Crear SuperAdmin
  const adminPasswordHash = await CryptoService.hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@mikromanager.local',
      passwordHash: adminPasswordHash,
      role: 'SUPERADMIN',
    },
  });
  console.log(`👤 SuperAdmin creado: ${admin.username} (admin123)`);

  // 2. Crear Vendedor / Operador para la App Android
  const vendedorPasswordHash = await CryptoService.hashPassword('vendedor123');
  const vendedor = await prisma.user.upsert({
    where: { username: 'vendedor' },
    update: {},
    create: {
      username: 'vendedor',
      email: 'vendedor@mikromanager.local',
      passwordHash: vendedorPasswordHash,
      role: 'OPERADOR',
    },
  });
  console.log(`📱 Vendedor móvil creado: ${vendedor.username} (vendedor123)`);

  // 3. Crear Router Predeterminado
  const encryptedCreds = CryptoService.encryptPassword('admin_mikrotik_2026');
  const existingRouter = await prisma.router.findFirst({
    where: { host: '192.168.88.1' },
  });

  const router =
    existingRouter ||
    (await prisma.router.create({
      data: {
        name: 'Nodo Principal Plaza',
        host: '192.168.88.1',
        apiPort: 8728,
        useSsl: false,
        username: 'mikromanager',
        encryptedPassword: encryptedCreds.encryptedText,
        iv: encryptedCreds.iv,
        authTag: encryptedCreds.authTag,
        rosVersion: '7.16.2',
        identity: 'MikroTik-Central',
        status: 'ONLINE',
      },
    }));
  console.log(`🌐 Router inicial registrado: ${router.name} (${router.host})`);

  // 4. Crear Planes Predeterminados
  const defaultPlans = [
    {
      name: '2 Horas',
      price: 10.0,
      durationSeconds: 7200,
      validityType: 'UPTIME_ACCUMULATED',
      downloadSpeedKbps: 5120, // 5 Mbps
      uploadSpeedKbps: 2048,   // 2 Mbps
      hotspotProfileName: 'PLAN_2H',
    },
    {
      name: '5 Horas',
      price: 20.0,
      durationSeconds: 18000,
      validityType: 'UPTIME_ACCUMULATED',
      downloadSpeedKbps: 8192, // 8 Mbps
      uploadSpeedKbps: 3072,   // 3 Mbps
      hotspotProfileName: 'PLAN_5H',
    },
    {
      name: '24 Horas (1 Día)',
      price: 30.0,
      durationSeconds: 86400,
      validityType: 'WALL_CLOCK_CALENDAR',
      downloadSpeedKbps: 10240, // 10 Mbps
      uploadSpeedKbps: 5120,    // 5 Mbps
      hotspotProfileName: 'PLAN_24H',
    },
  ];

  for (const p of defaultPlans) {
    const existingPlan = await prisma.plan.findFirst({
      where: { name: p.name, routerId: router.id },
    });

    if (!existingPlan) {
      const createdPlan = await prisma.plan.create({
        data: {
          ...p,
          routerId: router.id,
        },
      });

      // Crear 5 tickets de muestra por plan
      for (let i = 1; i <= 5; i++) {
        const pin = `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
        await prisma.ticket.create({
          data: {
            routerId: router.id,
            planId: createdPlan.id,
            username: pin,
            password: pin,
            status: 'AVAILABLE',
          },
        });
      }
      console.log(`📋 Plan creado: ${createdPlan.name} ($${createdPlan.price}) con 5 fichas de stock`);
    }
  }

  console.log('✅ Seeder completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
