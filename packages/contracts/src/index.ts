import { z } from 'zod';

export const DocumentTypeSchema = z.enum(['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT']);
export const DocumentStatusSchema = z.enum([
  'DRAFT',
  'APPROVED',
  'POSTED',
  'REVERSED',
  'CANCELLED',
]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const LoginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(32),
});

export const LogoutSchema = RefreshSchema;

export const ProductCreateSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(255),
  unit: z.string().trim().min(1).max(32).default('cái'),
  barcode: z.string().trim().min(4).max(64).optional(),
  reorderPoint: z.coerce.number().min(0).default(0),
  standardCost: z.coerce.number().min(0).default(0),
  salePrice: z.coerce.number().min(0).default(0),
  category: z.string().trim().min(1).max(100).default('Khác'),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export const WarehouseCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(128),
  address: z.string().trim().max(500).optional(),
});

const StockLineSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().refine((value) => value !== 0, 'Số lượng phải khác 0'),
  unitCost: z.coerce.number().min(0).default(0),
});

export const StockDocumentCreateSchema = z
  .object({
    type: DocumentTypeSchema,
    warehouseId: z.uuid(),
    destinationWarehouseId: z.uuid().optional(),
    reference: z.string().trim().max(100).optional(),
    note: z.string().trim().max(1000).optional(),
    idempotencyKey: z.uuid(),
    lines: z.array(StockLineSchema).min(1).max(500),
  })
  .superRefine((value, ctx) => {
    if (value.type !== 'ADJUSTMENT' && value.lines.some((line) => line.quantity <= 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Số lượng phải lớn hơn 0 với phiếu nhập, xuất và chuyển kho',
      });
    }
    if (value.type === 'TRANSFER' && !value.destinationWarehouseId) {
      ctx.addIssue({
        code: 'custom',
        path: ['destinationWarehouseId'],
        message: 'Kho đích là bắt buộc với phiếu chuyển kho',
      });
    }
    if (value.type !== 'TRANSFER' && value.destinationWarehouseId) {
      ctx.addIssue({
        code: 'custom',
        path: ['destinationWarehouseId'],
        message: 'Kho đích chỉ được dùng với phiếu chuyển kho',
      });
    }
    if (value.destinationWarehouseId === value.warehouseId) {
      ctx.addIssue({
        code: 'custom',
        path: ['destinationWarehouseId'],
        message: 'Kho nguồn và kho đích phải khác nhau',
      });
    }
  });

export interface AuthUser {
  id: string;
  companyId: string;
  email: string;
  fullName: string;
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  unit: string;
  barcode?: string;
  reorderPoint: number;
  standardCost: number;
  salePrice: number;
  category: string;
  stockTotal: number;
  active: boolean;
}

export interface WarehouseSummary {
  id: string;
  code: string;
  name: string;
  address?: string;
  active: boolean;
}

export interface DashboardSummary {
  totalProducts: number;
  totalQuantity: number;
  lowStockProducts: number;
  inventoryValue: number;
  draftDocuments: number;
  recentDocuments: Array<{
    id: string;
    number: string;
    type: DocumentType;
    status: DocumentStatus;
    warehouseName: string;
    createdAt: string;
  }>;
}

export interface StockDocumentSummary {
  id: string;
  number: string;
  type: DocumentType;
  status: DocumentStatus;
  warehouseName: string;
  destinationWarehouseName?: string;
  reference?: string;
  createdByName: string;
  lineCount: number;
  createdAt: string;
  postedAt?: string;
}

export const PaymentMethodSchema = z.enum(['CASH', 'CARD', 'BANK_TRANSFER']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const SaleCheckoutSchema = z.object({
  warehouseId: z.uuid(),
  customerName: z.string().trim().max(255).optional(),
  customerPhone: z.string().trim().max(32).optional(),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  paymentMethod: PaymentMethodSchema.default('CASH'),
  idempotencyKey: z.uuid(),
  lines: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.coerce.number().positive().max(99999),
      }),
    )
    .min(1)
    .max(200),
});

export interface PosCatalogItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  barcode?: string;
  category: string;
  salePrice: number;
  stockQuantity: number;
  reorderPoint: number;
}

export interface SaleReceipt {
  id: string;
  number: string;
  warehouseName: string;
  status: 'COMPLETED' | 'VOIDED';
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  soldByName: string;
  soldAt: string;
  lines: Array<{
    productId: string;
    sku: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}
