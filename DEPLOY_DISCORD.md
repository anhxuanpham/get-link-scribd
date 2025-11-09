# Cấu hình Discord Webhooks cho Server

## Vấn đề
File `.env` chứa credentials nên **KHÔNG được commit** vào Git. Khi pull code mới trên server, Discord webhooks sẽ **không tự động có**.

## Giải pháp

### Cách 1: Dùng script tự động (Khuyến nghị)

```bash
# Trên server
cd /path/to/scribd
git pull
bash update_env.sh
docker-compose restart
```

### Cách 2: Thêm thủ công

```bash
# SSH vào server
ssh user@your-server
cd /path/to/scribd

# Edit .env
nano .env

# Thêm 2 dòng này vào cuối file:
DISCORD_ALERT_WEBHOOK=https://discord.com/api/webhooks/1437108780557926512/bUfh1s3AkswY2UoWtTPxxSDr-raFH9XfGmUS65dsXr6pNacUwypfxtRqMpeo9E-m6HUJ
DISCORD_LOG_WEBHOOK=https://discord.com/api/webhooks/1437109393543139449/6Xp0ao9i0vLKEEMAwG04FBk9ncEI7QLJ7-7EvxsSj_AjGv8GzUIF9HQiVgZDsA3ivJ2v

# Lưu (Ctrl+O, Enter) và thoát (Ctrl+X)

# Restart container để apply changes
docker-compose restart
```

## Kiểm tra hoạt động

Sau khi restart, kiểm tra Discord channels:
- **Alert channel**: Sẽ nhận thông báo về cookies expired, login fail/success
- **Log channel**: Sẽ nhận log về server startup, download requests, errors

Nếu không thấy log, check Docker logs:
```bash
docker-compose logs -f
```

## Discord Webhooks đang dùng

- **Alert Webhook** (Critical issues): `...1437108780557926512/...`
- **Log Webhook** (General monitoring): `...1437109393543139449/...`
