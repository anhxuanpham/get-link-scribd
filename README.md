# GetPDF - Scribd Premium Downloader

Professional Scribd document downloader with bot protection and modern UI.

## ⚠️ DISCLAIMER

**Use at your own risk.**

This tool helps you get direct download links from Scribd documents.

- I am NOT responsible for any legal consequences arising from the use of this tool
- Users are solely responsible for how they use this service
- This is provided AS-IS without any warranties

## Features

- **Automated Login**: Login to Scribd with 2FA/OTP support via Zoho email
- **Cookie Persistence**: Saves session cookies to avoid repeated logins
- **Bot Protection**: Cloudflare Turnstile CAPTCHA integration
- **Rate Limiting**: 10 requests per minute per IP
- **Smart Caching**: 5-minute cache for download links
- **Modern UI**: Clean, responsive design with dark mode toggle
- **Download Tracking**: Local storage counter for download statistics
- **Copy to Clipboard**: Easy link copying functionality
- **Professional Favicon**: Custom SVG favicon with gradient
- **Docker Support**: Production-ready containerization

## Prerequisites

- Node.js 20+ (for local development)
- Docker & Docker Compose (for production deployment)
- Scribd Premium account
- Zoho email account (for OTP if 2FA is enabled)
- Cloudflare Turnstile keys (free)

## Quick Start (Local Development)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd scribd-downloader
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Get Cloudflare Turnstile keys**
   - Go to https://dash.cloudflare.com/
   - Navigate to Turnstile
   - Create a new site
   - Copy Site Key and Secret Key to .env

5. **First-time setup (get cookies)**
   ```bash
   npm start
   # Visit http://localhost:5099/setup
   # Login to Scribd manually
   # Click "Save cookies" button
   ```

6. **Run the application**
   ```bash
   npm run dev  # Development with auto-reload
   # or
   npm start    # Production mode
   ```

7. **Visit http://localhost:5099**

## Docker Deployment

See [DIGITALOCEAN.md](./DIGITALOCEAN.md) for comprehensive deployment guide.

**Quick Docker start:**
```bash
# Create .env file with your credentials
cp .env.example .env
nano .env

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SCRIBD_EMAIL` | Your Scribd account email | Yes |
| `SCRIBD_PASSWORD` | Your Scribd account password | Yes |
| `ZOHO_EMAIL` | Zoho email for OTP | If 2FA enabled |
| `ZOHO_PASSWORD` | Zoho email password | If 2FA enabled |
| `ZOHO_IMAP_SERVER` | Usually `imap.zoho.com` | If 2FA enabled |
| `ZOHO_IMAP_PORT` | Usually `993` | If 2FA enabled |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | Yes |
| `NODE_ENV` | `production` or `development` | Optional |

## Project Structure

```
.
├── app.js                    # Main application server
├── package.json              # Node dependencies
├── Dockerfile               # Docker container config
├── docker-compose.yml       # Docker orchestration
├── .env.example            # Environment variables template
├── templates/
│   └── index_v2.html       # Enhanced UI with all features
├── public/
│   └── favicon.svg         # Professional favicon
├── cookies.json            # Saved Scribd session (auto-generated)
├── DIGITALOCEAN.md         # Deployment guide
└── README.md              # This file
```

## Features Breakdown

### 1. Bot Protection (Cloudflare Turnstile)
- CAPTCHA verification on every download request
- Free alternative to reCAPTCHA
- Privacy-friendly
- Backend verification for security

### 2. Rate Limiting
- In-memory rate limiting per IP
- 10 requests per minute maximum
- Automatic reset after 60 seconds
- Prevents abuse

### 3. Smart Caching
- 5-minute TTL for download links
- Reduces load on Scribd
- Faster response for repeated requests
- Automatic cache cleanup

### 4. Cookie-based Authentication
- Saves session cookies to `cookies.json`
- Avoids repeated logins
- 1-hour session TTL
- Automatic re-login when expired

### 5. Modern UI Features
- Dark mode toggle (button in top-right)
- Download counter (localStorage)
- Copy to clipboard functionality
- Responsive design (mobile-friendly)
- Loading animations
- Professional color scheme

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main page |
| `/` | POST | Submit Scribd URL for download |
| `/setup` | GET | Manual login page (first-time setup) |
| `/setup/save` | POST | Save cookies after manual login |

## Security Features

- **Docker Security**: Non-root user, dropped capabilities
- **Rate Limiting**: Prevents abuse
- **CAPTCHA**: Bot protection
- **Input Validation**: URL validation
- **No Secrets in Code**: Environment variables for credentials
- **HTTPS Support**: SSL via Nginx reverse proxy

## Deployment Options

1. **Digital Ocean App Platform** ($5/month)
   - Easiest deployment
   - Auto-scaling available
   - See DIGITALOCEAN.md

2. **Docker on Digital Ocean Droplet** ($6/month)
   - Full control
   - Docker containerization
   - See DIGITALOCEAN.md

3. **Traditional VPS** ($6/month)
   - PM2 process manager
   - Nginx reverse proxy
   - See DIGITALOCEAN.md

## Troubleshooting

### Login Failed
- Check SCRIBD_EMAIL and SCRIBD_PASSWORD in .env
- Delete cookies.json and visit /setup for manual login
- Check screenshots: `login_page.png`, `before_submit.png`, `login_failed.png`

### CAPTCHA Not Working
- Verify TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY
- Check domain matches Turnstile config
- Check browser console for errors

### Docker Build Fails
- Ensure Docker and docker-compose are installed
- Check .env file exists and has all variables
- Run `docker-compose logs` to see errors

### Rate Limited
- Wait 60 seconds before trying again
- Contact admin to adjust rate limits

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# Run in production mode
npm start

# View logs
tail -f logs/app.log  # (if logging to file)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - AS-IS, no warranties. Use at your own risk.

## Credits

- UI Design: Modern gradient-based design
- CAPTCHA: Cloudflare Turnstile
- Automation: Puppeteer with Stealth plugin
- Icons: Custom SVG favicon

## Support

For issues or questions:
1. Check DIGITALOCEAN.md for deployment help
2. Check app.js logs for debugging
3. Open an issue on GitHub

---

Made with ❤️ for DevFest
