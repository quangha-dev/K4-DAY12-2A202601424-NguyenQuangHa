# Phiếu Phản Ánh — K4 Ngày 12

> **Bài làm cá nhân.** Trả lời bằng lời của chính bạn, dựa trên những gì bạn
> quan sát được khi chạy code — không sao chép đáp án của người khác.
>
> Cách trả lời: thay dòng `> *Câu trả lời của bạn*` bằng câu trả lời.
> `grade.py` đếm số câu đã trả lời (15 điểm cho 10 câu).
>
> Họ và tên: ..........................  Mã học viên: ..........................

---

### Câu 1 — Fail fast (CP1)

Trong `Settings`, `api_token` không có giá trị mặc định nên app chết ngay khi
khởi động nếu thiếu biến môi trường. Hãy mô tả một tình huống cụ thể mà việc
"chết sớm" này cứu bạn, so với việc để mặc định `"changeme"`.

Khi deploy lên cloud, nếu tôi quên khai báo `API_TOKEN`, fail-fast làm tiến
trình dừng ngay và dashboard báo lỗi cấu hình. Nhờ vậy endpoint `/chat` chưa
bao giờ được public trong trạng thái dùng một token mặc định mà người ngoài có
thể đoán. Nếu dùng `"changeme"`, health check vẫn có thể xanh và lỗi bảo mật
chỉ bị phát hiện sau khi API đã bị gọi hoặc phát sinh chi phí.

---

### Câu 2 — Log cho máy đọc (CP1)

Chạy service và gọi `/chat` vài lần. Dán một dòng log JSON bạn thu được, rồi
nêu **hai** việc bạn làm được với dòng log đó mà `print("đã trả lời xong")`
không làm được.

Một dòng tôi thu được khi chạy code:

```json
{"event":"chat_completed","severity":"INFO","ts":"2026-08-10T08:01:01.992973+00:00","client_id":"sv01","prompt_tokens":3,"completion_tokens":37,"usd_cost":0.0000226}
```

Từ dòng này tôi có thể nhóm và cộng `usd_cost` theo `client_id` để tìm client
tiêu nhiều nhất, đồng thời lọc/đếm event theo `severity` và khoảng thời gian để
tạo cảnh báo. Chuỗi `print("đã trả lời xong")` không có các trường ổn định để
máy thực hiện hai phép phân tích đó.

---

### Câu 3 — Kích thước image (CP2)

Build cả hai phiên bản và ghi lại số đo thật:

```bash
docker build -f <Dockerfile-1-stage> -t chat:single .
docker build -t chat:multi .
docker images | grep chat
```

| Bản | Dung lượng |
|-----|-----------|
| 1 stage (bản đầu) | khoảng 1.8 GB theo image starter |
| Multi-stage | 270 MB (`docker images`), 63.7 MB compressed |

Giải thích: phần dung lượng chênh lệch đó là những gì?

Image multi-stage tôi build thực tế hiện là 270 MB theo `docker images` và
63.714.410 byte compressed theo `docker image inspect`, thấp hơn ngưỡng 400 MB.
Bản starter một stage mang theo base image Python đầy đủ, toàn bộ build context,
pip cache và công cụ phục vụ cài đặt. Bản multi-stage chỉ copy thư viện đã cài
từ builder sang `python:3.11-slim` runtime cùng `app/` và `utils/`, nên không
mang compiler, cache, test hay tài liệu vào image chạy thật.

---

### Câu 4 — Thứ tự lệnh trong Dockerfile (CP2)

Sửa một ký tự trong `app/main.py` rồi build lại. Với Dockerfile của bạn, những
layer nào được dùng lại từ cache, layer nào phải chạy lại? Nếu bạn đặt
`COPY . .` lên trước `RUN pip install` thì kết quả khác thế nào?

Khi chỉ sửa `app/main.py`, các layer base image, `COPY requirements.txt` và
`RUN pip install` vẫn được lấy từ cache; chỉ layer copy source và các layer sau
nó phải tạo lại. Nếu đặt `COPY . .` trước `RUN pip install`, checksum source
đổi chỉ vì một ký tự, làm layer copy mất cache và kéo theo việc cài lại toàn bộ
dependency dù `requirements.txt` không thay đổi.

---

### Câu 5 — Vì sao không chạy bằng root (CP2)

Container mặc định chạy bằng root. Mô tả chuỗi sự kiện dẫn từ "một lỗ hổng
trong code Python của bạn" tới "kẻ tấn công có quyền cao trên máy host", và
lệnh `USER` cắt đứt chuỗi đó ở chỗ nào.

Một lỗ hổng thực thi lệnh trong ứng dụng có thể cho kẻ tấn công chạy shell bên
trong container. Nếu process là root, mã độc có toàn quyền với filesystem và
thiết bị/container capability được cấp; một cấu hình mount hoặc capability sai
có thể trở thành đường leo thang sang host. `USER appuser` làm process bị khai
thác chỉ có UID thường ngay từ bước chạy lệnh, nên không có quyền sửa file hệ
thống hay thực hiện các thao tác đặc quyền đó.

---

### Câu 6 — Bearer token (CP3)

Vì sao 401 phải kèm header `WWW-Authenticate: Bearer`? Và vì sao ta trả **cùng
một** thông báo lỗi cho cả ba trường hợp (thiếu header, sai scheme, sai token)
thay vì nói rõ sai ở đâu cho người dùng dễ sửa?

`WWW-Authenticate: Bearer` cho client biết cơ chế xác thực mà tài nguyên yêu
cầu, đúng ngữ nghĩa của HTTP 401 và giúp thư viện HTTP xử lý/chẩn đoán chuẩn.
Tôi dùng cùng thông báo `invalid or missing bearer token` cho thiếu header, sai
scheme và sai token để không biến API thành công cụ dò: người tấn công không
biết mình đã đoán đúng cấu trúc hay đúng một phần credential hay chưa.

---

### Câu 7 — Token bucket (CP3)

Với `capacity=10`, `refill_per_minute=10`: một client im lặng 10 phút rồi gửi
liên tiếp. Nó gửi được bao nhiêu request trước khi bị 429? Nếu bỏ đoạn
`min(capacity, ...)` trong `available()` thì con số đó thành bao nhiêu, và tại sao?

Xô chỉ chứa tối đa 10 token nên sau 10 phút im lặng client vẫn chỉ gửi liên tiếp
được 10 request; request thứ 11 nhận 429. Nếu bỏ `min(capacity, ...)`, 10 token
mỗi phút trong 10 phút tích thành 100 token, cho phép bắn 100 request liên tiếp
và làm mất ý nghĩa giới hạn burst của `capacity`.

---

### Câu 8 — Ngân sách theo ngày (CP3)

So sánh hạn mức $30/tháng với hạn mức $1/ngày cho cùng một client. Giả sử có sự
cố khiến một client gọi liên tục từ 2h sáng. Với mỗi cách, thiệt hại tối đa là
bao nhiêu và service tự hồi phục khi nào?

Với hạn mức 30 USD/tháng, sự cố từ 2 giờ sáng có thể tiêu gần hết 30 USD trước
khi bị chặn và service chỉ tự có quota lại khi sang tháng UTC mới. Với hạn mức
1 USD/ngày, thiệt hại của ngày xảy ra sự cố bị giới hạn quanh 1 USD (có thể lệch
một request theo soft quota) và service tự có quota lại vào ngày UTC kế tiếp.
Hạn mức ngày vì thế thu hẹp blast radius và thời gian tự phục hồi.

---

### Câu 9 — /healthz khác /readyz (CP4)

Nếu gộp hai endpoint làm một và cho nó kiểm tra Redis, chuyện gì xảy ra với cụm
3 container khi Redis mất kết nối 30 giây? Trả lời theo đúng thứ tự sự kiện.

Nếu endpoint duy nhất kiểm tra Redis, khi Redis mất 30 giây thì cả ba container
cùng trả 503. Orchestrator hiểu nhầm cả ba process đã chết và restart đồng loạt,
cắt các request đang chạy. Container mới khởi động khi Redis vẫn lỗi lại tiếp
tục fail probe, tạo vòng restart và làm sự cố Redis lan thành outage toàn dịch
vụ. Tách probe giúp `/healthz` vẫn 200 để process không bị restart oan, còn
`/readyz` 503 để load balancer chỉ tạm rút instance khỏi traffic.

---

### Câu 10 — Deploy thật (CP5)

Ghi lại **một** lỗi bạn gặp khi deploy lên cloud (build fail, health check
timeout, sai REDIS_URL, app không đọc `$PORT`...): thông báo lỗi là gì, bạn
tìm ra nguyên nhân bằng cách nào, và sửa ra sao?

> *Câu trả lời của bạn*
