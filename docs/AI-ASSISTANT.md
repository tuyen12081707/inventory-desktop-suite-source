# Trợ lý kho AI

## Mục tiêu

Trợ lý AI trả lời câu hỏi bằng tiếng Việt về dữ liệu và nghiệp vụ trong InventoryPro:

- tra sản phẩm theo tên, SKU hoặc barcode;
- trả tổng tồn và tồn theo từng kho;
- liệt kê sản phẩm hết hàng hoặc bằng/dưới ngưỡng cảnh báo;
- tóm tắt tồn kho hiện tại;
- hướng dẫn tạo sản phẩm, phiếu kho, bán hàng, báo cáo và cài đặt.

Chatbot là **read-only**. Nó không được tạo, sửa, duyệt, ghi sổ hoặc xóa dữ liệu.

## Kiến trúc

1. Web/desktop gửi lịch sử hội thoại tới `POST /api/v1/assistant/chat`.
2. Backend gọi Gemini với các function declaration.
3. Khi Gemini yêu cầu tool, backend tự truy vấn PostgreSQL với `companyId` của người đang đăng nhập.
4. Kết quả tool được gửi lại Gemini để tạo câu trả lời dễ đọc.
5. Gemini không có thông tin kết nối database và không thể gọi API nội bộ trực tiếp.

Các tool hiện có:

- `lookup_inventory`
- `get_low_stock_products`
- `get_inventory_overview`
- `get_app_guide`

## Bảo mật API key

- Chỉ quản trị viên có quyền `settings.manage` mới cấu hình được Gemini.
- API key không được trả lại frontend sau khi lưu.
- Tối đa 20 key được mã hóa AES-256-GCM trong database.
- Khóa mã hóa lấy từ `AI_SECRETS_ENCRYPTION_KEY`; nếu chưa cấu hình, backend dùng
  `JWT_ACCESS_SECRET` làm fallback để tránh mất khả năng giải mã khi nâng cấp.
- Audit log chỉ lưu trạng thái, model và số lượng key.
- Không ghi API key vào source code, log hoặc response.

Sau khi một key bị lỗi `401`, `403`, `429`, `500`, `502`, `503` hoặc `504`, backend thử key tiếp
theo. Gemini áp quota theo Google Cloud project, không theo từng key; nhiều key cùng một project
không làm tăng quota.

## Cấu hình

1. Vào **Cài đặt → Trợ lý kho AI**.
2. Bật **Thay danh sách API key**.
3. Nhập từ 1 đến 20 Gemini API key.
4. Chọn model stable, mặc định `gemini-3.6-flash`.
5. Bật chatbot và bấm **Lưu cấu hình AI**.
6. Bấm **Kiểm tra kết nối**.

Khi thay key, danh sách mới thay thế toàn bộ danh sách cũ. Khi tắt tùy chọn thay key, server giữ
nguyên key đang lưu.

## Vận hành và xử lý lỗi

- `Chatbot chưa được bật`: bật tại Cài đặt.
- `Chatbot chưa có API key`: nhập ít nhất một key.
- `Tất cả API key Gemini đang hết hạn mức`: chờ quota hồi phục hoặc dùng key thuộc project khác.
- `Gemini từ chối yêu cầu với mã 400`: kiểm tra tên model.
- `Không thể giải mã cấu hình AI`: cấu hình encryption secret đã đổi; nhập lại danh sách key.

Khi API key từng xuất hiện trong chat, ticket, ảnh hoặc source, nên thu hồi key đó trong Google AI
Studio và tạo key mới.
