# Kiến trúc InventoryPro

## Mục tiêu

InventoryPro là ứng dụng desktop/web online-first cho một công ty có nhiều kho. Server là
nguồn dữ liệu chuẩn; client không tự quyết định tồn kho hợp lệ.

## Sơ đồ hệ thống

```mermaid
flowchart LR
    subgraph Desktop
      React["React renderer"]
      Preload["Preload allow-list"]
      Main["Electron main"]
      React --> Preload --> Main
    end

    Scanner["Barcode scanner"] -->|"Keyboard HID"| React
    Camera["Camera barcode"] --> React
    Web["GitHub Pages web app"] -->|"HTTPS / JSON"| API
    Main --> Printer["Máy in"]
    React -->|"HTTPS / JSON"| API["NestJS modular monolith"]
    API --> DB[("PostgreSQL")]
```

## Module backend

```mermaid
flowchart TB
    Auth["Auth + RBAC"]
    Products["Products"]
    Warehouses["Warehouses"]
    Inventory["Inventory"]
    Documents["Stock documents"]
    Sales["Sales / POS"]
    Audit["Audit log"]
    DB[("PostgreSQL")]

    Auth --> DB
    Products --> DB
    Warehouses --> DB
    Documents --> Inventory
    Sales --> Inventory
    Sales --> Documents
    Inventory --> DB
    Documents --> Audit
    Audit --> DB
```

Đây là modular monolith: mỗi module sở hữu controller, service và quy tắc nghiệp vụ của
mình, nhưng được deploy trong một process. Chỉ tách microservice khi có nhu cầu scale hoặc
ownership độc lập đã được chứng minh.

## Quy tắc tồn kho

1. `StockLedger` là lịch sử bất biến.
2. `StockBalance` là projection để đọc nhanh.
3. Chỉ phiếu `APPROVED` mới được post.
4. Ghi ledger, cập nhật balance, đổi trạng thái và ghi audit chạy trong cùng transaction
   `SERIALIZABLE`.
5. Phiếu đã `POSTED` không được sửa hoặc xóa. Việc hiệu chỉnh phải sinh chứng từ đảo.
6. `idempotencyKey` chặn yêu cầu tạo phiếu bị gửi lặp.
7. Xuất kho dùng conditional update để không thể âm kho do concurrent request.
8. POS tạo `Sale`, phiếu `ISSUE`, ledger và balance trong cùng transaction.
9. Giá bán được đọc lại từ server khi checkout; client không thể tự sửa giá.

## Ranh giới bảo mật Electron

- Renderer không có Node.js.
- `contextIsolation` và sandbox được bật.
- Chỉ API native đã định nghĩa trong preload được expose.
- Refresh token được mã hóa bằng `safeStorage`.
- Access token chỉ nằm trong memory của renderer.
- Mọi dữ liệu từ renderer vẫn phải được backend xác thực và phân quyền.

## Quyết định chưa đưa vào MVP

- Offline write và đồng bộ hai chiều.
- Kế toán và hóa đơn điện tử.
- Quản lý lô, hạn sử dụng và serial.
- Microservices, Kafka hoặc Kubernetes.

Các mục này cần ADR riêng trước khi triển khai vì làm thay đổi đáng kể mô hình dữ liệu.
