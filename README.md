# HoaDonXeNang

Ứng dụng Windows quản lý hóa đơn, phiếu thu và công nợ ngoại tuyến. Dữ liệu lưu trong SQLite ở thư mục do người dùng chọn. App không dùng WPS khi vận hành.

## Phát hành cho người dùng

Chạy `release/HoaDonXeNang_Setup.exe` để cài đặt hoặc `release/HoaDonXeNang_Portable.exe` để chạy bản portable. Máy sử dụng không cần Node.js. Lần đầu mở, app dùng thư mục dữ liệu riêng của Windows; vào **Cài đặt → Chọn thư mục dữ liệu** để chuyển sang vị trí mong muốn, ví dụ `G:\Xe_Nang_Data`. Nên chọn thư mục trống nếu tạo dữ liệu mới. Nếu chọn thư mục đã có `hoadon_xenang.db`, app mở dữ liệu ở đó.

## Dành cho lập trình viên

Yêu cầu Node.js LTS, npm, Windows và công cụ build native phù hợp với Electron. Từ thư mục repo:

```powershell
npm install
npm run dev
npm test
npm run dist
```

`npm run build` tạo bản app chưa đóng gói. `npm run dist:portable` và `npm run dist:installer` tạo từng loại. File hoàn chỉnh ở `release/`.

## Cách dùng

1. Ở **Tạo hóa đơn**, tìm tên hoặc số điện thoại để chọn khách cũ. Thông tin khách tự điền; có thể sao chép mặt hàng từ hóa đơn gần nhất. Nếu khách còn nợ, app hiển thị cảnh báo. Bấm **Lưu hóa đơn** hoặc **Lưu & tạo tiếp cho khách này**.
2. Ở **Hóa đơn**, tìm, lọc theo trạng thái, xem chi tiết, sửa hoặc xóa hóa đơn chưa có phiếu thu. Bấm **Thu tiền** để ghi nhiều đợt thanh toán; app chặn thu vượt nợ.
3. Ở **Khách hàng**, mở hồ sơ để xem tổng quan, lịch sử hóa đơn và phiếu thu cùng số dư lũy kế, tuổi nợ và các bộ lọc. Có thể lập hóa đơn mới, thu tiền hàng loạt theo hóa đơn cũ nhất, xuất PDF đối chiếu và Excel riêng cho khách.
4. Ở **Nhập / Xuất**, chọn file `.xlsx`, `.xls` hoặc `.csv` UTF-8, chọn sheet và ánh xạ cột, kiểm tra trước, chọn cách xử lý trùng rồi xác nhận. App sao lưu trước khi ghi, hiển thị nhật ký và cho hoàn tác lần nhập gần nhất. Nút **Tải file mẫu** tạo workbook mẫu trong thư mục xuất.
5. Ở **Báo cáo**, chọn năm và chế độ theo tháng/năm. Doanh thu dựa trên ngày lập hóa đơn; đã thu kỳ dựa trên ngày phiếu thu; nợ cuối kỳ là lũy kế đến cuối kỳ.
6. Ở **Cài đặt**, nhập thông tin người bán và logo, chọn thư mục xuất file, bật chế độ tối. Ở **Sao lưu**, tạo hoặc khôi phục bản sao SQLite.

App xuất PDF hóa đơn/đối chiếu/báo cáo; Excel chứa sáu sheet (hóa đơn, chi tiết, thu tiền, công nợ, báo cáo theo bộ lọc tháng/năm, thông tin phiên bản/ngày xuất/bộ lọc). CSV có BOM UTF-8 và bảo vệ ô bắt đầu bằng ký tự công thức. File xuất mặc định nằm trong `exports` dưới thư mục dữ liệu.

## Sao lưu và khôi phục

App tự sao lưu hằng ngày khi mở và khi đọc dữ liệu, vào `backup` dưới thư mục dữ liệu; giữ 30 file `.db` gần nhất. **Sao lưu ngay** tạo bản thủ công. **Khôi phục từ backup** yêu cầu xác nhận và sao lưu dữ liệu hiện tại trước khi thay thế. Nên đóng mọi bản app khác đang mở cùng database trước khi khôi phục.
