# Nghiệm thu bản Windows offline

## Đối chiếu giao diện Stitch

Ảnh gốc nằm trong `..\stitch_hoadonxenang_desktop_ui_redesign\stitch_hoadonxenang_desktop_ui_redesign\<tên màn>\screen.png`.
Smoke tạo ảnh thực tế trong `%TEMP%\HoaDonXeNang-smoke-<PID>`. Nội dung tiền, ngày và số dòng phụ thuộc dữ liệu kiểm thử nên cần đối chiếu bố cục, nhãn và thao tác.

| Màn Stitch | Giao diện ứng dụng | Ảnh smoke |
| --- | --- | --- |
| `t_ng_quan` | Tổng quan | `dashboard.png` |
| `h_a_n` | Danh sách hóa đơn | `route-invoices.png` |
| `t_o_h_a_n` | Tạo/sửa hóa đơn | `invoiceForm.png` |
| `c_ng_n` | Hồ sơ công nợ dạng ngăn | `debtProfile.png` |
| `kh_ch_h_ng` | Danh sách khách hàng | `route-customers.png` |
| `h_s_kh_ch_h_ng_c_ng_ty_tnhh_v_n_t_i_h_a_ph_t` | Hồ sơ khách hàng | `customerProfile.png` |
| `thu_g_p_c_ng_ty_tnhh_v_n_t_i_h_a_ph_t` | Thu gộp công nợ | `bulkPayment.png` |
| `thu_ti_n` | Danh sách phiếu thu | `route-payments.png` |
| `thu_ti_n_thu_m_t_ph_n` | Hộp thu một phần | `paymentPartial.png`, `paymentPartialBottom.png` |
| `thu_ti_n_thu_tr_h_t_1_l_n` | Hộp thu đủ | `paymentDialog.png` |
| `b_o_c_o_theo_th_ng` | Báo cáo tháng | `route-reports.png`, `reportsMonthBottom.png` |
| `b_o_c_o_theo_n_m` | Báo cáo năm | `reportsYear.png`, `reportsYearBottom.png` |
| `chi_ti_t_th_ng_10_2026` | Chi tiết một tháng | `reportDetail.png`, `reportDetailBottom.png` |
| `nh_p_xu_t` | Nhập/Xuất dữ liệu | `route-imports.png`, `importPreviewErrors.png`, `importPreviewReady.png` |
| `sao_l_u` | Sao lưu và khôi phục | `route-backups.png` |
| `c_i_t` | Cài đặt | `route-settings.png`, `settingsDark.png` |

## Thử trên máy sạch (chưa thực hiện trong môi trường phát triển)

1. Dùng Windows 10/11 x64 không cài Node.js hay .NET Runtime. Ngắt Wi-Fi và Ethernet; chép duy nhất `release\HoaDonXeNang_Portable.exe` vào máy.
2. Mở `.exe`. Tạo khách hàng, hóa đơn có nhiều dòng hàng và phiếu thu một phần; đóng rồi mở lại để kiểm tra dữ liệu còn nguyên.
3. Thử gõ, dán số âm vào tất cả ô số trên hóa đơn, phiếu thu, thu gộp, cài đặt và sửa dòng nhập. Giá trị âm phải bị chặn. Số lượng mặt hàng phải lớn hơn 0; tiền thu không vượt dư nợ.
4. Thử thu đủ, thu gộp tự động và phân bổ thủ công cho nhiều hóa đơn. Kiểm tra số dư sau thu và các phiếu thu đã tạo.
5. Xuất PDF, Excel và CSV; mở file bằng phần mềm có sẵn. Nhập lại Excel sau bước xem trước; thử dòng lỗi số âm rồi hoàn tác lần nhập.
6. Sao lưu, sửa dữ liệu, khôi phục bản trước và kiểm tra dữ liệu. Đổi thư mục dữ liệu sang thư mục trống; xác nhận dữ liệu cũ còn ở vị trí cũ và ứng dụng dùng bản sao mới.
7. Mở từng màn hình ở kích thước thiết kế để đối chiếu ảnh Stitch; thử cuộn hộp thoại ở màn hình thấp, bật giao diện tối và đổi cỡ chữ 13/14/15 px.

Chạy `HoaDonXeNang_Portable.exe --smoke` để tạo dữ liệu và ảnh kiểm tra tạm, không ảnh hưởng dữ liệu sử dụng thật. Kết quả đầu ra nằm trong `%TEMP%\HoaDonXeNang-smoke-<PID>`.

Smoke tự động kiểm tra bộ lọc quý, tìm tháng, mở chi tiết năm/tháng và chụp thêm phần cuối trang báo cáo. Ảnh smoke là mẫu đối chiếu thủ công; kiểm tra trên Windows sạch, ngắt mạng vẫn cần thực hiện trên một máy độc lập.

Smoke cũng kiểm tra nút khôi phục từng bản sao lưu, luồng hủy/xác nhận khôi phục qua IPC và PDF được tạo từ nút in phiếu thu. Kiểm thử nghiệp vụ bao gồm trường hợp bản sao cũ bị dọn trong lúc khôi phục và file sao lưu bị hỏng.
Kiểm thử còn mô phỏng gián đoạn sau khi database chính được đổi tên sang `.previous`; lần khởi động tiếp theo phải tự nhận lại dữ liệu cũ.

Smoke kiểm tra thêm: mở form tạo không ghi dữ liệu; hủy xác nhận lưu, thoát bằng nút quay lại, Esc, bấm nền, Back và tải lại không tạo bản ghi; xác nhận tạo/sửa/xóa cập nhật đúng dữ liệu. Ảnh `confirmation-mobile.png` và `mobile-*.png` dùng để rà hộp thoại cùng 13 màn hình ở viewport 390 px; không màn nào được tràn ngang.

Smoke khởi động xác nhận renderer đã dựng trang đầu trước khi cửa sổ hiện. Khi giả lập truy vấn khách hàng chậm, trang cũ vẫn hiển thị cho đến khi trang mới sẵn sàng; sidebar không bị dựng lại và không hiện trang tải trung gian.
