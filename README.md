# Website Kho Ảnh & Văn Bản — bản sẵn sàng đưa lên Internet

Website dùng Node.js + Express + SQLite, có đăng ký/duyệt tài khoản, đăng bài, ảnh, bình luận và quản trị.

## Chạy trên máy tính
```bash
npm install
npm start
```
Mở `http://localhost:3000`.

## Đưa lên Internet bằng Render

1. Đưa toàn bộ thư mục này lên một repository GitHub.
2. Trên Render chọn **New → Web Service** và kết nối repository.
3. Có thể để Render đọc `render.yaml`, hoặc nhập:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Đặt `ADMIN_USER` và `ADMIN_PASS` trong Environment Variables.
5. Deploy.
6. Sau khi chạy xong, Render sẽ cấp một địa chỉ dạng `https://ten-app.onrender.com`.
7. Dùng chính địa chỉ đó để tạo QR code.

### Lưu ý quan trọng về dữ liệu
Website này dùng SQLite và lưu ảnh trên ổ đĩa. `render.yaml` đã cấu hình persistent disk 1 GB để dữ liệu/ảnh không mất khi service restart/redeploy. Persistent disk trên Render dành cho web service trả phí; nếu dùng service miễn phí mà không có disk, file SQLite và ảnh có thể mất khi filesystem bị thay mới.

## Tài khoản quản trị
Không nên dùng mật khẩu mặc định khi chạy thật. Hãy đặt:
- `ADMIN_USER`
- `ADMIN_PASS`
- `SESSION_SECRET`

## QR
Sau khi có URL `https://...onrender.com`, chỉ cần đưa URL đó vào trình tạo QR. Điện thoại quét QR sẽ mở trực tiếp website.
