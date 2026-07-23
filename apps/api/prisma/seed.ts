import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const permissionDefinitions = [
  ['products.read', 'Xem sản phẩm'],
  ['products.write', 'Tạo và cập nhật sản phẩm'],
  ['warehouses.read', 'Xem kho'],
  ['warehouses.write', 'Tạo và cập nhật kho'],
  ['inventory.read', 'Xem tồn kho và dashboard'],
  ['documents.read', 'Xem phiếu kho'],
  ['documents.write', 'Tạo phiếu kho'],
  ['documents.approve', 'Duyệt phiếu kho'],
  ['documents.post', 'Ghi sổ phiếu kho'],
] as const;

async function main(): Promise<void> {
  const company = await prisma.company.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: { code: 'DEMO', name: 'Công ty Demo' },
  });

  const permissions = await Promise.all(
    permissionDefinitions.map(([code, description]) =>
      prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      }),
    ),
  );

  const adminRole = await prisma.role.upsert({
    where: { companyId_code: { companyId: company.id, code: 'ADMIN' } },
    update: { name: 'Quản trị viên' },
    create: {
      companyId: company.id,
      code: 'ADMIN',
      name: 'Quản trị viên',
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const admin = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: 'admin@company.local',
      },
    },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@company.local',
      fullName: 'Quản trị hệ thống',
      passwordHash: await hash('Admin@123456', 12),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const mainWarehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: 'KHO-HCM' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'KHO-HCM',
      name: 'Kho Hồ Chí Minh',
      address: 'Thành phố Hồ Chí Minh',
    },
  });

  const products = [
    {
      sku: 'SP-001',
      name: 'Chuột không dây Pro',
      unit: 'cái',
      barcode: '893001000001',
      reorderPoint: 20,
      standardCost: 350000,
      openingQty: 120,
    },
    {
      sku: 'SP-002',
      name: 'Màn hình UltraWide 34 inch',
      unit: 'cái',
      barcode: '893001000002',
      reorderPoint: 5,
      standardCost: 8200000,
      openingQty: 8,
    },
    {
      sku: 'SP-003',
      name: 'Bàn phím cơ K2',
      unit: 'cái',
      barcode: '893001000003',
      reorderPoint: 10,
      standardCost: 1450000,
      openingQty: 24,
    },
  ];

  const seededProducts: Array<{
    id: string;
    openingQty: number;
    standardCost: number;
  }> = [];

  for (const item of products) {
    const product = await prisma.product.upsert({
      where: { companyId_sku: { companyId: company.id, sku: item.sku } },
      update: {},
      create: {
        companyId: company.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        reorderPoint: item.reorderPoint,
        standardCost: item.standardCost,
        barcodes: {
          create: {
            companyId: company.id,
            code: item.barcode,
            primary: true,
          },
        },
      },
    });
    seededProducts.push({
      id: product.id,
      openingQty: item.openingQty,
      standardCost: item.standardCost,
    });
  }

  const existingOpening = await prisma.stockDocument.findFirst({
    where: { companyId: company.id, reference: 'SEED-OPENING' },
  });

  if (!existingOpening) {
    await prisma.$transaction(async (tx) => {
      const document = await tx.stockDocument.create({
        data: {
          companyId: company.id,
          number: 'DC-OPENING-DEMO',
          type: 'ADJUSTMENT',
          status: 'POSTED',
          warehouseId: mainWarehouse.id,
          reference: 'SEED-OPENING',
          note: 'Số dư đầu kỳ do seed tạo',
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
          createdById: admin.id,
          approvedById: admin.id,
          approvedAt: new Date(),
          postedAt: new Date(),
          lines: {
            create: seededProducts.map((product) => ({
              productId: product.id,
              quantity: product.openingQty,
              unitCost: product.standardCost,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of document.lines) {
        const product = seededProducts.find((item) => item.id === line.productId);
        if (!product) throw new Error('Seed product not found');
        const balance = await tx.stockBalance.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: mainWarehouse.id,
              productId: product.id,
            },
          },
          update: {
            quantity: product.openingQty,
            averageCost: product.standardCost,
          },
          create: {
            warehouseId: mainWarehouse.id,
            productId: product.id,
            quantity: product.openingQty,
            averageCost: product.standardCost,
          },
        });
        await tx.stockLedger.create({
          data: {
            companyId: company.id,
            documentId: document.id,
            documentLineId: line.id,
            warehouseId: mainWarehouse.id,
            productId: product.id,
            quantityDelta: product.openingQty,
            unitCost: product.standardCost,
            balanceAfter: balance.quantity,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          actorId: admin.id,
          entityType: 'StockDocument',
          entityId: document.id,
          action: 'SEED_OPENING_BALANCE',
        },
      });
    });
  }
}

main()
  .then(() => {
    console.info('Seed completed. Login: admin@company.local / Admin@123456');
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
