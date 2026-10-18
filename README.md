# Hóa đơn Xe nâng – ứng dụng Windows offline

Ứng dụng Electron lưu hóa đơn, khách hàng, phiếu thu và công nợ trong SQLite trên máy. Giao diện, font và biểu tượng được đóng gói cục bộ. Không cần kết nối mạng khi sử dụng.

## Chạy và đóng gói

Máy dùng để build cần Node.js, npm và Windows x64. Tại thư mục dự án:

```powershell
npm ci
npm test
npm run build
```

File phát hành: `release/HoaDonXeNang_Portable.exe`. Có thể chép file này sang máy Windows 10/11 x64 khác để chạy. Máy khách không cần cài Node.js hoặc .NET Runtime. Lần mở đầu, database được tạo trong `%LOCALAPPDATA%\HoaDonXeNang\data`. Bản sao lưu ở thư mục `backup` bên trong thư mục dữ liệu. File xuất mặc định ở thư mục `exports`.

## Sử dụng nhanh

1. Vào **Khách hàng** để thêm đối tác.
2. Vào **Tạo hóa đơn**, chọn khách, nhập từng mặt hàng, số lượng và đơn giá rồi lưu. Chọn **Lưu & Thu tiền ngay** nếu nhận tiền cùng lúc. Trong **Hóa đơn**, lọc theo trạng thái, tháng hoặc khách; chọn các hàng cần xuất PDF/Excel/CSV.
   Ứng dụng chỉ tạo hóa đơn sau khi bấm **Lưu** và xác nhận. Bấm **Danh sách hóa đơn** hoặc chuyển trang khi đang nhập dở sẽ hiện cảnh báo; chọn **Thoát và bỏ thay đổi** để hủy, dữ liệu chưa lưu sẽ không vào sổ.
3. Vào **Thu tiền** để lập phiếu thu theo hóa đơn, chọn thu đủ hoặc thu một phần, lọc theo tháng hoặc phương thức thu. Nút in trên mỗi dòng tạo PDF của chính phiếu thu đó. Vào **Công nợ** để xem dư nợ và thu gộp cho một khách; có thể phân bổ từ hóa đơn cũ nhất hoặc nhập số tiền cho từng hóa đơn.
4. Trên **Tổng quan**, chọn tháng bằng nút lịch, xem hóa đơn cần xử lý và xuất báo cáo tháng ra PDF/Excel. Nhấn **Ctrl+K** để tìm khách hàng; nhập mã hóa đơn rồi nhấn **Enter** để tìm hóa đơn.
5. Vào **Báo cáo** để xem doanh thu, tiền thu theo tháng/năm. Vào **Nhập / Xuất** để nhập `.xlsx` hoặc `.csv`: xem trước lỗi theo dòng, sửa hoặc bỏ qua dòng lỗi rồi mới lưu. Dòng chi tiết và phiếu thu phụ thuộc hóa đơn bị bỏ cũng được loại cùng; cảnh báo dữ liệu tùy chọn không chặn nhập.
6. Vào **Sao lưu** để tạo bản sao, khôi phục trực tiếp một bản trong lịch sử hoặc chọn file `.db`. Trước khi khôi phục, ứng dụng yêu cầu xác nhận và tạo bản dự phòng của dữ liệu hiện tại. Số bản lưu tối đa bằng 0 nghĩa là không tự dọn bản cũ. Trong **Cài đặt**, nhập thông tin đơn vị/logo dùng trên PDF, chỉnh tiền tố, độ dài và bộ đếm mã chứng từ; có thể đổi thư mục dữ liệu và thư mục xuất. Khi đổi thư mục dữ liệu, chọn thư mục trống; ứng dụng sao chép dữ liệu hiện tại và giữ lại bản ở vị trí cũ.

Tên đơn vị và logo đã lưu cũng hiển thị trên thanh thương hiệu của ứng dụng. Thay đổi tên có hiệu lực sau khi bấm **Lưu thay đổi cài đặt**; chọn hoặc xóa logo có hiệu lực ngay sau khi xác nhận. Tên và logo được giữ sau khi mở lại ứng dụng.

Số âm bị chặn ở biểu mẫu, IPC và database. Các lệnh ghi database đều nằm trong transaction; nếu một bước thất bại, cả nghiệp vụ sẽ rollback.
Các thao tác tạo, sửa, xóa và lưu có hộp xác nhận, thông báo kết quả và khóa nút trong lúc xử lý. Form đang nhập dở cũng được cảnh báo khi bấm Hủy, Esc, bấm nền hộp thoại, Back, tải lại hoặc đóng cửa sổ.

## Giới hạn hiện tại

Ứng dụng không gửi Zalo/SMS và không đồng bộ đám mây. Phiên bản này tạo database mới; không tự chuyển dữ liệu từ ứng dụng cũ.
