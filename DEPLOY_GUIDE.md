# Hướng dẫn Deploy lên Digital Ocean - getpdf.org

## BƯỚC 1: Lấy Cloudflare Turnstile Keys (BẮT BUỘC)

1. Vào https://dash.cloudflare.com/
2. Chọn account của bạn
3. Vào **Turnstile** trong menu bên trái
4. Click **"Add site"**
5. Điền thông tin:
   ```
   Site name: GetPDF Scribd Downloader
   Domain: getpdf.org
   Widget Mode: Managed
   ```
6. Click **"Create"**
7. **LƯU LẠI 2 KEYS NÀY** (sẽ cần cho bước 4):
   - `Site Key` (dạng: 0x4AAAA...)
   - `Secret Key` (dạng: 0x4AAAA...)

---

## BƯỚC 2: Tạo GitHub Repository

1. Vào https://github.com/new
2. Tạo repo mới:
   ```
   Repository name: scribd-downloader
   Visibility: Private (recommended) hoặc Public
   ```
3. Click **"Create repository"**
4. **LƯU LẠI URL** của repo (dạng: `https://github.com/YOUR_USERNAME/scribd-downloader.git`)

---

## BƯỚC 3: Push Code lên GitHub

Mở Git Bash hoặc Terminal, chạy lệnh sau:

```bash
cd D:\DevFest\Scribd

# Add all files
git add .

# Commit
git commit -m "Initial commit - GetPDF Scribd Downloader"

# Add remote (THAY YOUR_USERNAME bằng username GitHub của bạn)
git remote add origin https://github.com/YOUR_USERNAME/scribd-downloader.git

# Push
git branch -M main
git push -u origin main
```

**Lưu ý**: Nếu GitHub yêu cầu authentication, dùng Personal Access Token thay vì password.

---

## BƯỚC 4: Deploy lên Digital Ocean (Docker Method - RECOMMENDED)

### 4.1. Tạo Droplet

1. Đăng nhập Digital Ocean: https://cloud.digitalocean.com/
2. Click **"Create"** → **"Droplets"**
3. Chọn:
   ```
   Image: Marketplace → Docker on Ubuntu 24.04
   Plan: Basic → $6/month (1GB RAM, 25GB SSD)
   Region: Singapore (SG1) - gần VN nhất
   Authentication: SSH key (recommended) hoặc Password
   Hostname: getpdf-org
   ```
4. Click **"Create Droplet"**
5. **LƯU LẠI IP ADDRESS** của droplet (ví dụ: 159.89.xxx.xxx)

### 4.2. SSH vào Server

```bash
ssh root@YOUR_DROPLET_IP
```

### 4.3. Clone Code và Setup

```bash
# Clone repository (THAY YOUR_USERNAME)
git clone https://github.com/YOUR_USERNAME/scribd-downloader.git
cd scribd-downloader

# Tạo file .env
nano .env
```

**Paste nội dung sau vào .env** (nhấn Ctrl+O để save, Ctrl+X để thoát):

```env
# Scribd Account
SCRIBD_EMAIL=your_scribd_email@example.com
SCRIBD_PASSWORD=your_scribd_password

# Zoho Email (nếu có 2FA)
ZOHO_EMAIL=your_zoho@example.com
ZOHO_PASSWORD=your_zoho_password
ZOHO_IMAP_SERVER=imap.zoho.com
ZOHO_IMAP_PORT=993

# Cloudflare Turnstile (ĐIỀN 2 KEYS TỪ BƯỚC 1)
TURNSTILE_SITE_KEY=0x4AAAA...
TURNSTILE_SECRET_KEY=0x4AAAA...

# Production mode (BẮT BUỘC)
NODE_ENV=production
```

### 4.4. Build và Chạy Docker

```bash
# Build image
docker-compose build

# Start container
docker-compose up -d

# Xem logs (để check có lỗi không)
docker-compose logs -f
```

**Nếu thấy**: `WEB CHẠY TẠI: http://localhost:5099` → Thành công!

Nhấn Ctrl+C để thoát logs.

### 4.5. Setup Nginx Reverse Proxy

```bash
# Install Nginx
apt update
apt install -y nginx

# Tạo config
nano /etc/nginx/sites-available/getpdf.org
```

**Paste nội dung sau:**

```nginx
server {
    listen 80;
    server_name getpdf.org www.getpdf.org;

    location / {
        proxy_pass http://localhost:5099;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save (Ctrl+O, Enter, Ctrl+X), sau đó:

```bash
# Enable site
ln -s /etc/nginx/sites-available/getpdf.org /etc/nginx/sites-enabled/

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx

# Enable firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## BƯỚC 5: Point Domain về Server

### Option A: Sử dụng Cloudflare DNS (RECOMMENDED)

1. Vào https://dash.cloudflare.com/
2. Click vào domain **getpdf.org**
3. Vào tab **DNS** → **Records**
4. Thêm 2 records:

```
Type: A
Name: @
IPv4 address: YOUR_DROPLET_IP
Proxy status: Proxied (orange cloud)
TTL: Auto

Type: A
Name: www
IPv4 address: YOUR_DROPLET_IP
Proxy status: Proxied (orange cloud)
TTL: Auto
```

5. Đợi 1-5 phút để DNS propagate

### Option B: DNS Provider khác

Tại DNS provider của bạn, thêm:

```
Type: A
Name: @
Value: YOUR_DROPLET_IP
TTL: 3600

Type: A
Name: www
Value: YOUR_DROPLET_IP
TTL: 3600
```

---

## BƯỚC 6: Setup SSL (HTTPS)

Đợi 5-10 phút sau khi point domain, sau đó SSH vào server:

```bash
ssh root@YOUR_DROPLET_IP

# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d getpdf.org -d www.getpdf.org
```

Nhập email của bạn, đồng ý ToS, chọn **2** (Redirect HTTP to HTTPS).

**XONG!** Bây giờ vào https://getpdf.org để kiểm tra!

---

## BƯỚC 7: Login lần đầu (Setup Cookies)

1. Vào https://getpdf.org/setup
2. Browser sẽ mở, login vào Scribd bằng tay
3. Hoàn thành 2FA nếu có
4. Click button **"Đã login xong - Lưu cookies"**
5. Xong! Giờ vào https://getpdf.org để dùng

---

## Maintenance & Monitoring

### Xem logs:
```bash
ssh root@YOUR_DROPLET_IP
cd scribd-downloader
docker-compose logs -f
```

### Restart app:
```bash
docker-compose restart
```

### Update code:
```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### Check status:
```bash
docker-compose ps
systemctl status nginx
```

---

## Troubleshooting

### App không chạy?
```bash
docker-compose logs
# Check xem có error gì
```

### Domain không truy cập được?
```bash
# Check DNS
nslookup getpdf.org

# Check Nginx
nginx -t
systemctl status nginx
```

### CAPTCHA không work?
- Kiểm tra TURNSTILE_SITE_KEY và TURNSTILE_SECRET_KEY trong .env
- Kiểm tra domain trong Cloudflare Turnstile settings phải là getpdf.org

### Cookies hết hạn?
- Vào lại https://getpdf.org/setup để login lại

---

## Chi phí ước tính:

- Droplet: $6/month
- Domain getpdf.org: ~$10-15/year (~$1/month)
- **Total: ~$7/month**

---

## Bảo mật:

App đã được config với:
- ✅ Cloudflare Turnstile CAPTCHA
- ✅ Rate limiting (10 requests/phút)
- ✅ Docker security (non-root user)
- ✅ Nginx reverse proxy
- ✅ SSL/HTTPS (Let's Encrypt)
- ✅ Firewall (UFW)

---

**Nếu cần support, liên hệ hoặc check logs!**
