import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { InventoryModule } from './inventory/inventory.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { ReportsModule } from './reports/reports.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    WarehousesModule,
    InventoryModule,
    SalesModule,
    SettingsModule,
    ReportsModule,
    AssistantModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
