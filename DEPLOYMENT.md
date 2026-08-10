# Thông Tin Deploy — Checkpoint 5

> File này ghi nhận bản deploy mà `pytest tests/test_cp5.py` gọi kiểm tra.
> để tìm địa chỉ service của bạn và gọi thử.
>
> **Chỉ ghi TÊN biến môi trường, tuyệt đối không dán giá trị token vào đây.**
> Repo này công khai — dán token vào là mất token.

## Thông Tin Học Viên

| Mục | Nội dung |
|-----|----------|
| Họ và tên | Nguyễn Quang Hà |
| Mã học viên | 2A202601424 |
| Repo | https://github.com/quangha-dev/K4-DAY12-2A202601424-NguyenQuangHa |

## Service

| Mục | Nội dung |
|-----|----------|
| Public URL | https://k4-day12-2a202601424-nguyenquangha.onrender.com |
| Platform | Render |
| Ngày deploy | 2026-08-10 |

## Biến Môi Trường Đã Set Trên Cloud

Ghi tên biến và **nguồn giá trị**, không ghi giá trị:

| Biến | Đã set | Ghi chú |
|------|--------|---------|
| `PORT` | ✅ | platform tự gán |
| `API_TOKEN` | ✅ | đặt trong dashboard, không nằm trong repo |
| `REDIS_URL` | ✅ | Render Key Value, lấy qua service reference |
| `BUCKET_CAPACITY` | ✅ | 10 |
| `REFILL_PER_MINUTE` | ✅ | 10 |
| `DAILY_BUDGET_USD` | ✅ | 1.0 |
| `LOG_LEVEL` | ✅ | INFO |

## Lệnh Kiểm Tra

Các lệnh dưới đây dùng Public URL ở trên:

```bash
# 1. Liveness — mong đợi 200 {"status":"ok"}
curl -i https://k4-day12-2a202601424-nguyenquangha.onrender.com/healthz

# 2. Readiness — mong đợi 200 {"status":"ready"} (đã nối được Redis)
curl -i https://k4-day12-2a202601424-nguyenquangha.onrender.com/readyz

# 3. Không có token — mong đợi 401 kèm header WWW-Authenticate
curl -i -X POST https://k4-day12-2a202601424-nguyenquangha.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'

# 4. Có token — mong đợi 200 kèm câu trả lời
curl -i -X POST https://k4-day12-2a202601424-nguyenquangha.onrender.com/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "X-Client-Id: sv-test" \
  -d '{"message":"Deploy là gì?"}'

# 5. Rate limit — gọi 15 lần, những lần cuối phải trả 429
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://k4-day12-2a202601424-nguyenquangha.onrender.com/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "X-Client-Id: sv-test" \
    -d '{"message":"test"}'
done; echo
```

## Kết Quả Chạy Thật

Dán output của các lệnh trên vào đây:

```text
[2026-08-10 15:33:15 +07:00]
GET /healthz
  -> 200 {"status":"ok","service":"day12-chat-service","version":"1.0.0"}

GET /readyz
  -> 200 {"status":"ready","redis":true}

POST /chat (không có Authorization)
  -> 401, WWW-Authenticate: Bearer
  -> {"detail":"invalid or missing bearer token"}

POST /chat (Bearer token hợp lệ, giá trị không ghi vào tài liệu)
  -> 200, response có reply, client_id, usd_cost và usage

pytest tests/test_cp5.py -v
  -> 9 passed, 4 skipped
  -> 4 test skipped thuộc nhánh LOCAL_FALLBACK, không áp dụng vì đang dùng cloud.
```

## Ảnh Chụp Màn Hình

Đặt ảnh trong thư mục `screenshots/`:

- `screenshots/dashboard.png` — trang quản lý service trên platform
- `screenshots/healthz.png` — kết quả gọi `/healthz` từ trình duyệt hoặc curl

## Bản Triển Khai VPS Bổ Sung

| Mục | Nội dung |
|-----|----------|
| Public URL | https://miraculum.duckdns.org |
| Nhà cung cấp | Contabo VPS |
| Hệ điều hành | Ubuntu 24.04 LTS |
| Reverse proxy | Nginx + HTTPS |
| Runtime | Docker Compose |
| Auto-deploy | GitHub Actions khi push vào `main` |

Kiến trúc VPS:

```text
Internet :443
    ↓
Nginx HTTPS
    ↓ 127.0.0.1:8000
FastAPI container
    ↓ Docker network
Redis container + persistent volume
```

Các secret `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY` và
`VPS_SSH_KNOWN_HOSTS` nằm trong GitHub Actions Secrets. Repository chỉ ghi tên
secret, không chứa giá trị. URL không nhạy cảm được lưu trong biến
`VPS_PUBLIC_URL`.

Kết quả kiểm tra sau khi chuyển traffic:

```text
GET https://miraculum.duckdns.org/healthz -> 200
GET https://miraculum.duckdns.org/readyz  -> 200
POST /chat không Bearer token             -> 401
```
