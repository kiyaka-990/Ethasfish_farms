// One-off helper for manually testing the delivery flow against the real
// database (create/clean a clearly-marked test order + link a test driver
// to the signed-in admin so /driver works without a second Clerk account).
//
//   node scripts/test-delivery-setup.mjs create   -> prints test order id
//   node scripts/test-delivery-setup.mjs clean    -> removes test rows
//   node scripts/test-delivery-setup.mjs link-admin-driver
import { config } from 'dotenv';
import { createRequire } from 'node:module';
config({ path: '.env.local' });
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const mode = process.argv[2];
const TEST_TAG = 'TEST-DO-NOT-DELIVER';

async function linkAdminDriver() {
  const admin = await p.staffProfile.findFirst({ where: { role: 'admin', active: true }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('no admin staff row');
  const existing = await p.driver.findUnique({ where: { staffId: admin.id } });
  if (existing) { console.log('driver already linked:', existing.id, existing.name); return; }
  const d = await p.driver.create({
    data: { name: 'Test Rider', phone: '0700000000', plate: 'KTEST01', vehicle: 'motorcycle', staffId: admin.id }
  });
  console.log('linked test driver to admin', admin.email, '->', d.id);
}

async function create() {
  const v = await p.productVariant.findFirst({ where: { active: true, product: { active: true } }, include: { product: true } });
  if (!v) throw new Error('no active variant to build a test order from');
  const order = await p.order.create({
    data: {
      orderNumber: `EF-TEST-${Date.now().toString(36).toUpperCase()}`,
      customerName: TEST_TAG, customerPhone: '0700000000',
      deliveryAddress: 'Test Lane 1, Kisumu',
      subtotal: v.priceKsh, total: v.priceKsh, status: 'paid', paymentStatus: 'paid',
      channel: 'online',
      items: { create: { productId: v.productId, variantId: v.id, productName: v.product.name, variantLabel: v.label, unitPrice: v.priceKsh, quantity: 1, lineTotal: v.priceKsh } }
    }
  });
  console.log('created', order.id, order.orderNumber);
}

async function clean() {
  const orphans = await p.order.findMany({ where: { customerName: TEST_TAG }, select: { id: true, orderNumber: true } });
  for (const o of orphans) {
    const del = await p.delivery.findUnique({ where: { orderId: o.id } });
    if (del) {
      await p.driverPosition.deleteMany({ where: { deliveryId: del.id } });
      await p.delivery.delete({ where: { id: del.id } });
    }
    await p.order.delete({ where: { id: o.id } });
    console.log('removed test order', o.orderNumber);
  }
  // Test rider keeps its staff link only if you want /driver to stay usable;
  // comment the next two lines out to keep the driver row around.
  const drivers = await p.driver.findMany({ where: { phone: '0700000000' } });
  for (const d of drivers) {
    await p.driver.delete({ where: { id: d.id } });
    console.log('removed test driver', d.name);
  }
  console.log('clean done');
}

try {
  if (mode === 'create') await create();
  else if (mode === 'clean') await clean();
  else if (mode === 'link-admin-driver') await linkAdminDriver();
  else console.log('usage: create | clean | link-admin-driver');
} finally { await p.$disconnect(); }
