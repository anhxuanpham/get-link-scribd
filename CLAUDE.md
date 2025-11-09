# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Scribd Premium document downloader that automates the login process and PDF retrieval. It uses Puppeteer with stealth plugins to bypass bot detection, handles 2FA via IMAP email monitoring, and provides a simple web interface.

## Architecture

**Core Components:**

- **Express Server** (`app.js`): Single-file application serving both frontend and handling download requests
- **Puppeteer + Stealth**: Automated browser with anti-detection measures to interact with Scribd
- **IMAP Client**: Monitors Zoho email inbox for 2FA OTP codes from Scribd
- **Session Management**: Browser sessions cached for 1 hour (SESSION_TTL) to avoid repeated logins

**Request Flow:**
1. User submits Scribd document URL via web form
2. Server extracts document ID from URL pattern `/document/(\d+)`
3. `loginScribd()` establishes authenticated browser session (or reuses existing)
4. If 2FA required, `getOTP()` fetches latest OTP from email via IMAP
5. `getPDFUrl()` navigates to document, clicks download button, extracts PDF link
6. Download URL returned to user (expires in 1-2 hours per Scribd's behavior)

## Development Commands

**Install dependencies:**
```bash
npm install
```

**Run the application:**
```bash
npm start
# Or directly:
node app.js
```

**Server runs on:** `http://localhost:5000`

## Environment Configuration

Create `.env` file with:
```
SCRIBD_EMAIL=your-scribd-email
SCRIBD_PASSWORD=your-scribd-password
ZOHO_EMAIL=email-for-2fa-codes
ZOHO_PASSWORD=zoho-password
ZOHO_IMAP_SERVER=imap.zoho.com
ZOHO_IMAP_PORT=993
```

**IMPORTANT:** Never commit `.env` file. Contains sensitive credentials for both Scribd and email accounts.

## Key Implementation Details

**Browser Session Management:**
- Browser instance persists for 1 hour (`SESSION_TTL = 3600 * 1000`)
- `lastLogin` timestamp tracks session freshness
- Headless mode with `--no-sandbox` flags for container compatibility

**2FA OTP Retrieval:**
- Searches INBOX for emails with subject containing "Scribd"
- Fetches last 3 matching emails
- Extracts 6-digit code via regex `/\d{6}/`
- Connection auto-closes after OTP found

**Puppeteer Selectors:**
- Login form: `input[name="user[login]"]`, `input[name="user[password]"]`
- CSRF token: `meta[name="csrf-token"]`
- 2FA input: `input[name="mfa_code"]`
- Download button: `button:has-text("Download")`
- PDF link: `a[href*="/download/"]`

**Template Rendering:**
- HTML template (`templates/index.html`) uses `{{result}}` and `{{download_url}}` placeholders
- Simple string replacement (no template engine) in route handlers

## Error Handling

- Invalid URL format returns error message to UI
- Failed login throws error if URL doesn't redirect to dashboard
- OTP retrieval fails if no Scribd emails found in INBOX
- All errors logged with timestamps via `log()` function
