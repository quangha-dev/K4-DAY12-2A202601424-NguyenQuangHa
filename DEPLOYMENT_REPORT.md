# Báo Cáo Kiểm Tra Và Khắc Phục Deployment

## Phạm vi

- Repository: `K4-DAY12-2A202601424-NguyenQuangHa`
- Platform: Render, region Singapore
- Public URL: <https://k4-day12-2a202601424-nguyenquangha.onrender.com>
- Ngày kiểm tra: 2026-08-10
- Nguyên tắc: không sửa bất kỳ file nào trong `tests/`.

## Trạng thái ban đầu

`python grade.py` cho thấy CP1-CP4 đã xanh, nhưng CP5 còn ba lỗi live:

```text
/healthz -> 404
/readyz  -> 404
/chat không token -> 404 thay vì 401
```

Nguyên nhân ban đầu là URL đã được ghi vào tài liệu nhưng Web Service chưa có
một deployment hoạt động tại URL đó. Bonus còn lỗi badge 404 vì workflow chưa
có lần chạy thành công trên repository public.

## Cấu hình cloud đã thực hiện

1. Tạo Render Blueprint từ `render.yaml`.
2. Tạo Web Service Docker và Render Key Value cùng region Singapore.
3. Khai báo `API_TOKEN`, nối `REDIS_URL` qua service reference và giữ các biến
   rate-limit/budget/log theo cấu hình repository.
4. Đặt health check path là `/healthz`; Uvicorn đọc cổng động từ `PORT` và bind
   `0.0.0.0:10000` trên Render.
5. Lưu deploy hook dưới dạng GitHub Actions secret
   `RENDER_DEPLOY_HOOK_URL`; lưu URL public dưới dạng repository variable
   `PUBLIC_URL`. Không ghi giá trị secret vào repository hay báo cáo.

## Sự cố deploy và chẩn đoán

Lần deploy đầu build image thành công nhưng kết thúc với lỗi:

```text
Timed out after waiting for internal health check to return a successful
response code at ...:10000/healthz
```

Log cho thấy instance đầu tiên mất hơn 11 phút mới chạy process. Uvicorn đã
bind đúng `0.0.0.0:10000`, nhưng Render không chuyển được request probe nội bộ
tới instance đó trước mốc timeout 15 phút. Để phân biệt lỗi hạ tầng với lỗi
ứng dụng, chính Docker image production được chạy local với `PORT=10000` và
`/healthz` trả 200 ngay lập tức.

Biện pháp xử lý là redeploy đúng commit, không thay đổi image hay endpoint.
Instance mới khởi động sau khoảng 16 giây, log xuất hiện liên tiếp:

```text
GET /healthz HTTP/1.1 200 OK
Your service is live
```

Điều này xác nhận lần thất bại đầu là sự cố cấp/routing instance tạm thời.

## Kết quả endpoint live

| Kiểm tra | Kết quả |
|---|---|
| `GET /healthz` | 200, `status=ok` |
| `GET /readyz` | 200, `redis=true` |
| `POST /chat` không token | 401, `WWW-Authenticate: Bearer` |
| `POST /chat` với token hợp lệ | 200, có `reply` và `usage` |

## Bằng chứng

- `screenshots/dashboard.png`: Render hiển thị deployment `live`.
- `screenshots/healthz.png`: endpoint public trả JSON `status=ok`.
- `DEPLOYMENT.md`: URL, tên biến môi trường và output kiểm tra đã được ghi lại.

## Ghi chú cảnh báo

Pytest có thể in `StarletteDeprecationWarning` từ tổ hợp phiên bản
`fastapi.testclient`/`httpx`. Đây là cảnh báo dependency, không làm test thất
bại và không ảnh hưởng endpoint production; không chỉnh test để che cảnh báo.
