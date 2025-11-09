# Deploy lên Digital Ocean

## Bước 0: Lấy Cloudflare Turnstile Keys

Trước khi deploy, bạn cần lấy CAPTCHA keys từ Cloudflare:

1. Vào https://dash.cloudflare.com/
2. Chọn account của bạn
3. Vào **Turnstile** trong menu bên trái (hoặc search "Turnstile")
4. Click **"Add site"**
5. Điền thông tin:
   - **Site name**: Scribd Downloader
   - **Domain**: `getdpf.org` (hoặc domain bạn sẽ dùng)
   - **Widget Mode**: Managed
6. Click **"Create"**
7. Copy **Site Key** và **Secret Key** - bạn sẽ cần 2 keys này cho environment variables

## Option 1: App Platform (Đơn giản nhất - Recommended)

### Bước 1: Push code lên GitHub

```bash
cd D:\DevFest\Scribd
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/scribd-downloader.git
git push -u origin main
```

### Bước 2: Deploy trên Digital Ocean App Platform

1. Đăng nhập [Digital Ocean](https://cloud.digitalocean.com/)
2. Click "Create" > "Apps"
3. Chọn GitHub repository vừa tạo
4. Config:
   - **Name**: `scribd-downloader`
   - **Branch**: `main`
   - **Source Directory**: `/`
   - **Build Command**: `npm install`
   - **Run Command**: `node app.js`
   - **HTTP Port**: `5099`

5. Environment Variables (Settings > App-Level Environment Variables):
   ```
   SCRIBD_EMAIL=your-email@example.com
   SCRIBD_PASSWORD=your-password
   ZOHO_EMAIL=your-zoho@example.com
   ZOHO_PASSWORD=your-zoho-password
   ZOHO_IMAP_SERVER=imap.zoho.com
   ZOHO_IMAP_PORT=993
   TURNSTILE_SITE_KEY=your_turnstile_site_key_here
   TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
   ```

6. Click "Next" > "Create Resources"

### Bước 3: Setup Custom Domain

1. Trong App Settings > "Domains"
2. Click "Add Domain"
3. Nhập `getdpf.org`
4. Thêm CNAME record tại DNS provider:
   ```
   Type: CNAME
   Name: @  (hoặc www)
   Value: your-app.ondigitalocean.app
   TTL: 3600
   ```

### Chi phí:
- **Basic plan**: $5/month
- **Professional**: $12/month (có auto-scaling)

---

## Option 2: Docker Deploy (Recommended cho production)

### Bước 1: Tạo Droplet với Docker

1. Vào Digital Ocean Dashboard
2. Create > Droplets
3. Chọn:
   - **Image**: Docker on Ubuntu 22.04 (trong Marketplace)
   - **Plan**: Basic - $6/month (1GB RAM)
   - **Region**: Singapore (gần VN nhất)

### Bước 2: SSH vào server

```bash
ssh root@YOUR_DROPLET_IP
```

### Bước 3: Clone code và setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/scribd-downloader.git
cd scribd-downloader

# Tạo .env file
nano .env
```

Paste nội dung từ `.env.example` và điền thông tin thật:
```
SCRIBD_EMAIL=your-email@example.com
SCRIBD_PASSWORD=your-password
ZOHO_EMAIL=your-zoho@example.com
ZOHO_PASSWORD=your-zoho-password
ZOHO_IMAP_SERVER=imap.zoho.com
ZOHO_IMAP_PORT=993
TURNSTILE_SITE_KEY=your_turnstile_site_key_here
TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
NODE_ENV=production
```

### Bước 4: Build và chạy Docker

```bash
# Build image
docker-compose build

# Start container
docker-compose up -d

# Xem logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Bước 5: Setup Nginx (nếu cần custom domain)

```bash
# Install Nginx
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/getdpf.org
```

Nội dung:
```nginx
server {
    listen 80;
    server_name getdpf.org www.getdpf.org;

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

```bash
# Enable site
ln -s /etc/nginx/sites-available/getdpf.org /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Bước 6: Setup SSL với Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d getdpf.org -d www.getdpf.org
```

### Docker Commands Cheat Sheet

```bash
# Restart container
docker-compose restart

# Stop container
docker-compose down

# Update code và rebuild
git pull
docker-compose down
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f app

# Access container shell
docker-compose exec app sh

# Check health
docker-compose ps
```

---

## Option 3: Droplet không dùng Docker (VPS - Linh hoạt hơn)

### Bước 1: Tạo Droplet

1. Vào Digital Ocean Dashboard
2. Create > Droplets
3. Chọn:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic - $6/month (1GB RAM)
   - **Region**: Singapore (gần VN nhất)
   - **Authentication**: SSH key hoặc password

### Bước 2: SSH vào server

```bash
ssh root@YOUR_DROPLET_IP
```

### Bước 3: Cài đặt Node.js

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node -v
npm -v
```

### Bước 4: Cài đặt dependencies cho Puppeteer

```bash
# Install Chrome dependencies
apt install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
```

### Bước 5: Upload code

```bash
# Tạo thư mục
mkdir -p /var/www/scribd-downloader
cd /var/www/scribd-downloader

# Clone từ GitHub (hoặc upload qua SFTP)
git clone https://github.com/YOUR_USERNAME/scribd-downloader.git .

# Install dependencies
npm install
```

### Bước 6: Tạo file .env

```bash
nano .env
```

Nội dung:
```
SCRIBD_EMAIL=your-email@example.com
SCRIBD_PASSWORD=your-password
ZOHO_EMAIL=your-zoho@example.com
ZOHO_PASSWORD=your-zoho-password
ZOHO_IMAP_SERVER=imap.zoho.com
ZOHO_IMAP_PORT=993
TURNSTILE_SITE_KEY=your_turnstile_site_key_here
TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
```

### Bước 7: Setup PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start app
pm2 start app.js --name scribd-downloader

# Auto-start on server reboot
pm2 startup
pm2 save

# View logs
pm2 logs scribd-downloader

# Monitor
pm2 monit
```

### Bước 8: Setup Nginx Reverse Proxy

```bash
# Install Nginx
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/getdpf.org
```

Nội dung:
```nginx
server {
    listen 80;
    server_name getdpf.org www.getdpf.org;

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

```bash
# Enable site
ln -s /etc/nginx/sites-available/getdpf.org /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Bước 9: Setup SSL với Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d getdpf.org -d www.getdpf.org

# Auto-renewal
certbot renew --dry-run
```

### Bước 10: Setup Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### Bước 11: Point domain to server

Tại DNS provider (Cloudflare, GoDaddy, etc):
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

## Maintenance Commands

### Update code
```bash
cd /var/www/scribd-downloader
git pull
npm install
pm2 restart scribd-downloader
```

### View logs
```bash
pm2 logs scribd-downloader
tail -f /var/log/nginx/error.log
```

### Monitor resources
```bash
pm2 monit
htop
```

### Backup cookies
```bash
cp cookies.json cookies.backup.json
```

---

## Troubleshooting

### Puppeteer không chạy được
```bash
# Check Chrome installation
which google-chrome-stable

# If not found, install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt install -y ./google-chrome-stable_current_amd64.deb
```

### Port 5099 already in use
```bash
# Find process using port
lsof -i :5099

# Kill process
kill -9 PID
```

### Out of memory
```bash
# Create swap file
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Performance Tips

1. **Enable caching**: Đã có sẵn trong code (5 phút cache)
2. **Use CDN**: Thêm Cloudflare CDN trước server
3. **Monitor**: Dùng PM2 Plus hoặc New Relic
4. **Auto-scaling**: Upgrade lên App Platform Professional

---

## Security Checklist

- [ ] Đổi SSH port mặc định (22)
- [ ] Disable root login
- [ ] Chỉ cho phép SSH key authentication
- [ ] Enable firewall (ufw)
- [ ] Cài fail2ban chống brute force
- [ ] Regular updates: `apt update && apt upgrade`
- [ ] Backup cookies.json hàng tuần
- [ ] Monitor logs định kỳ

---

## Cost Estimate

| Service | Plan | Cost/month |
|---------|------|------------|
| App Platform | Basic | $5 |
| Droplet + VPS | 1GB RAM | $6 |
| Domain | getdpf.org | $10-15/year |
| **Total** | | **~$6-7/month** |
