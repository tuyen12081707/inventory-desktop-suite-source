# InventoryPro

Monorepo ứng dụng quản lý kho desktop cho công ty:

- Electron + React + TypeScript + Ant Design
- NestJS modular monolith
- PostgreSQL + Prisma
- JWT access token, refresh rotation và RBAC
- Stock ledger bất biến, transaction serializable và idempotency
- Docker Compose, seed, test và CI

## Yêu cầu

- Node.js 22 hoặc 24 (`.nvmrc` đang chốt Node 22)
- npm 10+
- Docker Desktop hoặc PostgreSQL 17

## Chạy development

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Tài khoản seed:

```text
admin@company.local
Admin@123456
```

API chạy tại `http://localhost:3000/api/v1`, Swagger tại
`http://localhost:3000/api/docs`, renderer development tại `http://localhost:5173`.

## Lệnh chính

```bash
npm run typecheck
npm test
npm run build
npm run format:check
npm run db:migrate
npm run db:seed
npm run make -w @inventory/desktop
```

## Production backend

1. Tạo secret ngẫu nhiên tối thiểu 32 ký tự cho `JWT_ACCESS_SECRET`.
2. Không dùng password PostgreSQL trong file compose mẫu.
3. Đặt reverse proxy TLS phía trước API.
4. Chạy `prisma migrate deploy` trước khi start phiên bản mới.
5. Sao lưu PostgreSQL hằng ngày và kiểm tra restore định kỳ.

```bash
JWT_ACCESS_SECRET="replace-with-a-long-random-secret" docker compose up -d --build
```

## Đóng gói desktop

Chạy lệnh `make` trên đúng hệ điều hành đích. Với Windows, Electron Forge sinh bộ cài
Squirrel. Bản phát hành thật cần code-signing certificate và update feed nội bộ.

## Cấu trúc

```text
apps/api            NestJS API và Prisma schema
apps/desktop        Electron main/preload và React renderer
packages/contracts  Schema Zod và API types dùng chung
docs                Tài liệu kiến trúc và ERD
```

Đọc [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) trước khi mở rộng nghiệp vụ tồn kho.

> Electron Forge hiện nên chạy bằng Node 22/24. Node 26 chưa nằm trong dải engine của dự án.
