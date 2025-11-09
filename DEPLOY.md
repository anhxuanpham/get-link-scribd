# Deploy Scribd Downloader lên Cloudflare Workers

## Bước 1: Cài đặt Wrangler CLI

```bash
npm install -g wrangler
```

## Bước 2: Đăng nhập Cloudflare

```bash
wrangler login
```

Lệnh này sẽ mở browser để bạn đăng nhập vào Cloudflare account.

## Bước 3: Tạo Worker (lần đầu)

```bash
cd D:\DevFest\Scribd
wrangler deploy
```

## Bước 4: Setup Custom Domain (getdpf.org)

### 4.1. Thêm domain vào Cloudflare

1. Vào Cloudflare Dashboard
2. Click "Add a Site"
3. Nhập domain `getdpf.org`
4. Chọn Free plan
5. Update nameservers tại nhà cung cấp domain của bạn theo hướng dẫn

### 4.2. Kết nối Worker với Domain

Có 2 cách:

**Cách 1: Qua Dashboard (Dễ hơn)**

1. Vào Cloudflare Dashboard
2. Chọn Workers & Pages
3. Chọn worker `scribd-downloader`
4. Vào tab "Settings" > "Triggers"
5. Click "Add Custom Domain"
6. Nhập `getdpf.org` hoặc `www.getdpf.org`
7. Click "Add Custom Domain"

**Cách 2: Qua CLI**

```bash
wrangler route add "getdpf.org/*" scribd-downloader --zone-name getdpf.org
wrangler route add "www.getdpf.org/*" scribd-downloader --zone-name getdpf.org
```

## Bước 5: Update Code và Deploy lại

Mỗi khi sửa code, chạy:

```bash
wrangler deploy
```

## Bước 6: Xem Logs

```bash
wrangler tail
```

## Lưu ý quan trọng

### ⚠️ Vấn đề với Worker hiện tại

Code trong `worker.js` dùng `require('./cookies.json')` - điều này **KHÔNG hoạt động** trên Cloudflare Workers vì:
- Workers không hỗ trợ `require()`
- Workers không có filesystem

### ✅ Giải pháp

Bạn cần làm 1 trong 2 cách:

**Option 1: Hardcode cookies vào code (Đơn giản nhất)**

Sửa file `worker.js`:

```javascript
const COOKIES = [
  { name: "ssuuid", value: "84DE3EDC-4264-4DF9-87CF-92BB38B7A3BA" },
  { name: "_scribd_user_id", value: "NzU3Njc3Mjkw--53c9a391a0fb84e4580069a3fab5a46e368973f2" },
  // ... copy hết cookies từ cookies.json vào đây
];
```

**Option 2: Dùng Workers KV Storage**

1. Tạo KV namespace:
```bash
wrangler kv:namespace create "COOKIES"
```

2. Update `wrangler.toml`:
```toml
kv_namespaces = [
  { binding = "COOKIES", id = "your-kv-id-here" }
]
```

3. Upload cookies:
```bash
wrangler kv:key put --namespace-id=your-kv-id "cookies" --path=cookies.json
```

4. Sửa code trong `worker.js`:
```javascript
async function getCookies(env) {
  const cookies = await env.COOKIES.get('cookies', 'json');
  return cookies;
}
```

## Test Local trước khi deploy

```bash
wrangler dev
```

Mở http://localhost:8787 để test

## URLs sau khi deploy

- Worker URL: `https://scribd-downloader.your-subdomain.workers.dev`
- Custom Domain: `https://getdpf.org`

## Troubleshooting

### Lỗi "require is not defined"
→ Dùng Option 1 hoặc 2 ở trên để fix cookies

### Lỗi "Module not found"
→ Workers không hỗ trợ npm packages thông thường, chỉ có thể dùng Web APIs

### Domain không hoạt động
→ Kiểm tra:
1. Domain đã được add vào Cloudflare chưa?
2. Nameservers đã được update chưa?
3. Routes đã được cấu hình đúng chưa?

## Chi phí

- Cloudflare Workers Free Plan:
  - 100,000 requests/ngày
  - 10ms CPU time mỗi request
  - Miễn phí hoàn toàn

- Paid Plan ($5/tháng):
  - 10 triệu requests/tháng
  - 50ms CPU time mỗi request
