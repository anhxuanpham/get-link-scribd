require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { simpleParser } = require('mailparser');
const Imap = require('imap');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 5099;

app.use(express.urlencoded({ extended: true }));
// Serve static files (favicon, etc.)
app.use(express.static('public'));

const TEMPLATE = fs.readFileSync(path.join(__dirname, 'templates', 'index.html'), 'utf-8');

// Simple in-memory cache for download links (5 minutes TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Request Queue System
const requestQueue = [];
let isProcessing = false;
const queueStatus = new Map(); // requestId -> status

function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function addToQueue(requestId, docId, clientIp) {
    const queueItem = {
        requestId,
        docId,
        clientIp,
        addedAt: Date.now(),
        status: 'queued'
    };

    requestQueue.push(queueItem);
    queueStatus.set(requestId, {
        position: requestQueue.length,
        status: 'queued',
        addedAt: queueItem.addedAt
    });

    log(`[QUEUE] Added request ${requestId} for doc ${docId} (position: ${requestQueue.length})`, true);

    // Start processing if not already running
    if (!isProcessing) {
        processQueue();
    }

    return requestId;
}

async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;

    isProcessing = true;

    while (requestQueue.length > 0) {
        const item = requestQueue.shift();

        // Update positions for remaining items
        requestQueue.forEach((q, idx) => {
            queueStatus.set(q.requestId, {
                ...queueStatus.get(q.requestId),
                position: idx + 1
            });
        });

        try {
            log(`[QUEUE] Processing ${item.requestId} for doc ${item.docId}`, true);
            queueStatus.set(item.requestId, {
                ...queueStatus.get(item.requestId),
                status: 'processing',
                position: 0
            });

            const downloadUrl = await getPDFUrl(item.docId);

            queueStatus.set(item.requestId, {
                status: 'completed',
                downloadUrl,
                completedAt: Date.now()
            });

            log(`[QUEUE] Completed ${item.requestId}`, true);

        } catch (error) {
            log(`[QUEUE] Failed ${item.requestId}: ${error.message}`, true);
            queueStatus.set(item.requestId, {
                status: 'failed',
                error: error.message,
                failedAt: Date.now()
            });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    isProcessing = false;
}

// Rate limiting: max 10 requests per IP per minute
const rateLimits = new Map();
function checkRateLimit(ip) {
    const now = Date.now();
    const userLimits = rateLimits.get(ip) || { count: 0, resetTime: now + 60000 };

    if (now > userLimits.resetTime) {
        rateLimits.set(ip, { count: 1, resetTime: now + 60000 });
        return true;
    }

    if (userLimits.count >= 10) {
        return false;
    }

    userLimits.count++;
    return true;
}

// Verify Cloudflare Turnstile token
async function verifyTurnstile(token) {
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: TURNSTILE_SECRET_KEY,
                response: token
            })
        });
        const data = await response.json();
        return data.success;
    } catch (e) {
        log(`Turnstile verification error: ${e.message}`);
        return false;
    }
}

const {
    SCRIBD_EMAIL, SCRIBD_PASSWORD,
    ZOHO_EMAIL, ZOHO_PASSWORD, ZOHO_IMAP_SERVER, ZOHO_IMAP_PORT,
    TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY,
    DISCORD_ALERT_WEBHOOK, DISCORD_LOG_WEBHOOK
} = process.env;

// Debug: Log password length to verify it's loaded correctly
console.log(`[DEBUG] Password loaded: ${SCRIBD_PASSWORD ? SCRIBD_PASSWORD.length + ' characters' : 'NOT FOUND'}`);

let browser = null;
let lastLogin = 0;
const SESSION_TTL = 3600 * 1000;
const COOKIES_PATH = path.join(__dirname, 'cookies.json');
const STATS_PATH = path.join(__dirname, 'stats.json');

// Load/save download statistics
function loadStats() {
    // Fix if stats.json is a directory (Docker mount issue)
    if (fs.existsSync(STATS_PATH)) {
        const stat = fs.statSync(STATS_PATH);
        if (stat.isDirectory()) {
            console.log('[WARNING] stats.json is a directory, removing it...');
            fs.rmSync(STATS_PATH, { recursive: true, force: true });
        }
    }

    if (fs.existsSync(STATS_PATH) && fs.statSync(STATS_PATH).isFile()) {
        try {
            return JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
        } catch (e) {
            console.log('[WARNING] Failed to parse stats.json, resetting...');
            return { totalDownloads: 0, lastUpdated: new Date().toISOString() };
        }
    }
    return { totalDownloads: 0, lastUpdated: new Date().toISOString() };
}

function saveStats(stats) {
    stats.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

function incrementDownloadCount() {
    const stats = loadStats();
    stats.totalDownloads++;
    saveStats(stats);
    return stats.totalDownloads;
}

function log(msg, sendToDiscord = false) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[LOG ${timestamp}] ${msg}`);

    // Only send important logs to Discord to avoid spam
    if (sendToDiscord && DISCORD_LOG_WEBHOOK) {
        sendDiscordLog(msg).catch(err => console.error('Discord log failed:', err));
    }
}

// Send alert to Discord (for critical issues like cookie expiration)
async function sendDiscordAlert(message) {
    if (!DISCORD_ALERT_WEBHOOK) return;

    try {
        await fetch(DISCORD_ALERT_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: '🚨 SCRIBD ALERT',
                    description: message,
                    color: 15158332, // Red color
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Scribd Downloader' }
                }]
            })
        });
    } catch (e) {
        console.error(`Discord alert failed: ${e.message}`);
    }
}

// Send log to Discord (for general monitoring)
async function sendDiscordLog(message) {
    if (!DISCORD_LOG_WEBHOOK) return;

    try {
        await fetch(DISCORD_LOG_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    description: message,
                    color: 3447003, // Blue color
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch (e) {
        console.error(`Discord log failed: ${e.message}`);
    }
}

// === LẤY OTP TỪ ZOHO ===
function getOTP() {
    return new Promise((resolve, reject) => {
        log("Kết nối Zoho IMAP...");
        const imap = new Imap({
            user: ZOHO_EMAIL,
            password: ZOHO_PASSWORD,
            host: ZOHO_IMAP_SERVER,
            port: ZOHO_IMAP_PORT,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        imap.once('ready', () => {
            imap.openBox('INBOX', true, (err, box) => {
                if (err) return reject(err);
                imap.search([['SUBJECT', 'Scribd']], (err, results) => {
                    if (err || !results.length) return reject("Không tìm thấy email");
                    const f = imap.fetch(results.slice(-3), { bodies: '' });
                    f.on('message', msg => {
                        msg.on('body', stream => {
                            simpleParser(stream, (err, parsed) => {
                                if (err) return;
                                const match = parsed.subject.match(/\d{6}/);
                                if (match) {
                                    log(`OTP: ${match[0]}`);
                                    imap.end();
                                    resolve(match[0]);
                                }
                            });
                        });
                    });
                    f.once('error', reject);
                });
            });
        });

        imap.once('error', reject);
        imap.connect();
    });
}

// === SAVE/LOAD COOKIES ===
async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    log(`Đã lưu ${cookies.length} cookies vào ${COOKIES_PATH}`);
}

async function loadCookies(page) {
    if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
        await page.setCookie(...cookies);
        log(`Đã load ${cookies.length} cookies`);
        return true;
    }
    return false;
}

// === LOGIN SCRIBD ===
async function loginScribd() {
    if (browser && Date.now() - lastLogin < SESSION_TTL) {
        log("Dùng session cũ");
        return browser;
    }

    log("Khởi động Puppeteer + Stealth");

    const launchOptions = {
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-crash-reporter',
            '--disable-extensions'
        ]
    };

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // Set viewport như browser thật
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent realistic
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Override webdriver property
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    // Load cookies nếu có
    const hasCookies = await loadCookies(page);

    if (hasCookies) {
        log("Thử dùng cookies đã lưu...");
        await page.goto('https://www.scribd.com/account', { waitUntil: 'networkidle2' });

        // Check xem còn login không
        const isLoggedIn = !page.url().includes('login');
        if (isLoggedIn) {
            log("✅ Login thành công bằng cookies!");
            lastLogin = Date.now();
            return browser;
        } else {
            log("Cookies hết hạn, cần login lại");
            await sendDiscordAlert('⚠️ **Cookies đã hết hạn!**\n\nHệ thống đang thử login lại với email/password.\nNếu có 2FA, có thể cần can thiệp thủ công.');
        }
    }

    log("Vào trang login");
    await page.goto('https://www.scribd.com/login', { waitUntil: 'networkidle2' });

    // DEBUG: Chụp screenshot và log HTML để xem cấu trúc mới
    await page.screenshot({ path: 'login_page.png' });
    const html = await page.content();
    fs.writeFileSync('login_page.html', html);
    log("Đã lưu screenshot login_page.png và HTML login_page.html");

    // Chờ form load xong - thử nhiều selector khác nhau
    let loginInput = null;
    const possibleSelectors = [
        'input[name="user[login]"]',           // Cũ
        'input[name="email"]',                  // Thường gặp
        'input[type="email"]',                  // Generic
        'input[name="login"]',                  // Alternative
        'input[placeholder*="email" i]',        // By placeholder
        'input#email',                          // By ID
        'input#user_login',                     // Rails style
        'form input[type="text"]:first-of-type' // First text input in form
    ];

    for (const selector of possibleSelectors) {
        try {
            await page.waitForSelector(selector, { timeout: 2000 });
            loginInput = selector;
            log(`Tìm thấy login input với selector: ${selector}`);
            break;
        } catch (e) {
            // Try next selector
        }
    }

    if (!loginInput) {
        throw new Error("Không tìm thấy login form - Scribd có thể đã đổi UI");
    }

    // Thử lấy CSRF token từ nhiều nguồn
    let csrf = null;
    try {
        // Thử lấy từ meta tag trước
        csrf = await page.$eval('meta[name="csrf-token"]', el => el.content);
        log(`CSRF từ meta tag: ${csrf.substring(0, 30)}...`);
    } catch (e) {
        log("Không tìm thấy CSRF trong meta tag, thử lấy từ form...");
        try {
            // Thử lấy từ input hidden trong form
            csrf = await page.$eval('input[name="authenticity_token"]', el => el.value);
            log(`CSRF từ form input: ${csrf.substring(0, 30)}...`);
        } catch (e2) {
            log("Không tìm thấy CSRF token - thử login không cần CSRF");
        }
    }

    // Random delay trước khi điền form (human-like behavior)
    await page.waitForTimeout(500 + Math.random() * 1000);

    // Move mouse randomly trước khi click
    await page.mouse.move(Math.random() * 500, Math.random() * 500);
    await page.waitForTimeout(200);

    // Clear và type email
    await page.click(loginInput, { clickCount: 3 }); // Select all
    await page.waitForTimeout(100 + Math.random() * 200);
    await page.type(loginInput, SCRIBD_EMAIL, { delay: 80 + Math.random() * 40 });
    log(`Đã điền email: ${SCRIBD_EMAIL}`);
    await page.waitForTimeout(800 + Math.random() * 400);

    // Tìm password input
    const possiblePasswordSelectors = [
        'input[name="password"]',         // Auth0 mới
        'input[type="password"]',         // Generic
        'input[name="user[password]"]'   // Cũ
    ];

    let passwordInput = null;
    for (const selector of possiblePasswordSelectors) {
        if (await page.$(selector)) {
            passwordInput = selector;
            log(`Tìm thấy password input với selector: ${selector}`);
            break;
        }
    }

    if (!passwordInput) {
        throw new Error("Không tìm thấy password field");
    }

    // Click vào password field để focus
    await page.waitForTimeout(300 + Math.random() * 200);
    await page.click(passwordInput);
    await page.waitForTimeout(400 + Math.random() * 200);

    // Dùng keyboard.type() với random delay
    log("Typing password using keyboard API...");
    await page.keyboard.type(SCRIBD_PASSWORD, { delay: 60 + Math.random() * 40 });

    await page.waitForTimeout(1000 + Math.random() * 500);

    await page.waitForTimeout(500);

    // Verify password đã được điền
    const passwordValue = await page.$eval(passwordInput, el => el.value);
    log(`Đã điền password (${passwordValue.length} ký tự)`);

    // Screenshot NGAY sau khi type password để verify
    await page.screenshot({ path: 'after_password_typed.png' });
    log("Đã chụp screenshot sau khi type password");

    if (passwordValue.length !== SCRIBD_PASSWORD.length) {
        log(`CẢNH BÁO: Password length không khớp! Expected ${SCRIBD_PASSWORD.length}, got ${passwordValue.length}`);

        // Thử lại bằng cách inject trực tiếp
        log("Thử inject password trực tiếp vào DOM...");
        await page.evaluate((sel, pass) => {
            const input = document.querySelector(sel);
            if (input) {
                input.value = pass;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, passwordInput, SCRIBD_PASSWORD);

        await page.waitForTimeout(500);
        const retryValue = await page.$eval(passwordInput, el => el.value);
        log(`Sau khi inject: ${retryValue.length} ký tự`);

        // Screenshot sau retry
        await page.screenshot({ path: 'after_password_retry.png' });
    }

    await page.waitForTimeout(1000);

    // Click remember me nếu có
    const rememberMe = await page.$('input[name="user[remember_me]"]');
    if (rememberMe) {
        await page.click('input[name="user[remember_me]"]');
    }

    // Chỉ set CSRF nếu tìm thấy và field tồn tại
    if (csrf) {
        const hasAuthToken = await page.$('input[name="authenticity_token"]');
        if (hasAuthToken) {
            await page.evaluate((token) => {
                const field = document.querySelector('input[name="authenticity_token"]');
                if (field) field.value = token;
            }, csrf);
        }
    }

    // Screenshot trước khi submit để debug
    await page.screenshot({ path: 'before_submit.png' });
    log("Đã chụp screenshot trước submit");

    // Tìm submit button
    const submitButton = await page.$('button[type="submit"]') || await page.$('button[name="action"]');
    if (!submitButton) {
        throw new Error("Không tìm thấy submit button");
    }

    log("Đang click submit button...");
    await submitButton.click();

    // Đợi 2 giây để xem có error message không
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'after_submit_click.png' });
    log("Đã chụp screenshot sau khi click submit");

    // Đợi navigation
    try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch (e) {
        log("Navigation timeout, tiếp tục check URL...");
    }

    const currentUrl = page.url();
    log(`URL sau login: ${currentUrl}`);

    // Check 2FA
    if (currentUrl.includes('mfa') || currentUrl.includes('challenge') || currentUrl.includes('verify')) {
        log("Cần 2FA");
        const otp = await getOTP();

        // Tìm OTP input field
        const otpSelectors = ['input[name="mfa_code"]', 'input[name="code"]', 'input[type="text"]'];
        let otpInput = null;
        for (const selector of otpSelectors) {
            if (await page.$(selector)) {
                otpInput = selector;
                break;
            }
        }

        if (otpInput) {
            await page.type(otpInput, otp);
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }
    }

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    // Check login success - Scribd có thể redirect về nhiều nơi khác nhau
    if (finalUrl.includes('login') || finalUrl.includes('auth0.com') || finalUrl.includes('auth.scribd.com')) {
        // Vẫn ở trang login = login failed
        await page.screenshot({ path: 'login_failed.png' });
        await sendDiscordAlert('❌ **Login thất bại!**\n\nHệ thống không thể đăng nhập vào Scribd.\nVui lòng kiểm tra credentials hoặc login thủ công.');
        throw new Error("Login thất bại - vẫn ở trang login");
    }

    // Nếu không còn ở login page = success
    log("LOGIN THÀNH CÔNG!");
    await sendDiscordAlert('✅ **Login thành công!**\n\nHệ thống đã đăng nhập vào Scribd thành công.');
    lastLogin = Date.now();

    // Save cookies sau khi login thành công
    await saveCookies(page);

    return browser;
}

// === LẤY LINK PDF ===
async function getPDFUrl(docId) {
    const browser = await loginScribd();
    const page = await browser.newPage();

    // Thiết lập download path và bắt sự kiện download
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: __dirname
    });

    // Lắng nghe network requests để bắt download URL
    let downloadUrl = null;
    page.on('response', async (response) => {
        const url = response.url();
        const headers = response.headers();

        // Kiểm tra nếu đây là response download PDF
        if (
            (url.includes('download') || url.includes('.pdf') || url.includes('dl.scribd')) &&
            (headers['content-type']?.includes('pdf') || headers['content-disposition']?.includes('attachment'))
        ) {
            downloadUrl = url;
            log(`Bắt được download URL từ network: ${url}`);
        }
    });

    const url = `https://www.scribd.com/document/${docId}/`;
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Try direct download URL first (bypass modal completely)
    log("Thử truy cập download URL trực tiếp...");
    const directDownloadUrl = `https://www.scribd.com/document_downloads/${docId}?extension=pdf&from=download_page`;

    try {
        await page.goto(directDownloadUrl, { waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
        // ERR_ABORTED is OK - it means download started and network listener caught it
        if (e.message && e.message.includes('ERR_ABORTED')) {
            log("Download bắt đầu (ERR_ABORTED), kiểm tra downloadUrl...");
            await page.waitForTimeout(2000);

            if (downloadUrl) {
                log(`✅ Đã bắt được download URL từ network: ${downloadUrl}`);
                return downloadUrl;
            }
        }
    }

    // Check if we already have downloadUrl from network listener
    if (downloadUrl) {
        log(`✅ Direct download thành công: ${downloadUrl}`);
        return downloadUrl;
    }

    log("Direct download không work, quay lại trang document...");
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Remove ALL cookie consent popups from DOM
    log("Kiểm tra và xóa cookie popup...");
    try {
        await page.waitForTimeout(2000);

        // Remove Osano cookie consent completely from DOM
        await page.evaluate(() => {
            // Remove all osano elements
            const osanoElements = document.querySelectorAll('[class*="osano"]');
            osanoElements.forEach(el => el.remove());

            // Remove cookie consent containers
            const cookieContainers = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"]');
            cookieContainers.forEach(el => {
                if (el.textContent.toLowerCase().includes('cookie') ||
                    el.textContent.toLowerCase().includes('privacy')) {
                    el.remove();
                }
            });
        });

        log("Đã xóa cookie popup khỏi DOM");
        await page.waitForTimeout(1000);
    } catch (e) {
        log("Không có cookie popup hoặc đã xóa rồi");
    }

    // Tìm và click nút Download
    log("Tìm nút Download...");
    const downloadButtonXPath = '//button[contains(., "Download")] | //a[contains(., "Download")]';
    await page.waitForXPath(downloadButtonXPath, { timeout: 10000 });
    const downloadButtons = await page.$x(downloadButtonXPath);

    if (downloadButtons.length === 0) {
        throw new Error("Không tìm thấy nút Download");
    }

    log("Click nút Download...");
    await downloadButtons[0].click();

    // Chờ modal xuất hiện
    await page.waitForTimeout(3000);
    log("Modal download đã mở");

    // Try to extract download URL directly from page
    log("Tìm download URL trong page...");

    // Check if download modal opened with direct download link
    downloadUrl = await page.evaluate(() => {
        // Look for download links in modal, buttons, or anywhere on page
        const selectors = [
            'a[href*="/download/"]',
            'a[href*=".pdf"]',
            'a[href*="dl.scribd"]',
            'button[data-url*="download"]',
            '[data-download-url]'
        ];

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                const href = elements[0].getAttribute('href') ||
                           elements[0].getAttribute('data-url') ||
                           elements[0].getAttribute('data-download-url');
                if (href) return href;
            }
        }
        return null;
    });

    if (downloadUrl) {
        log(`Tìm thấy download URL từ DOM: ${downloadUrl}`);
    } else {
        // Fallback: Try clicking download button in modal if exists
        log("Không tìm thấy URL trực tiếp, thử click button trong modal...");

        const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, a, div[role="button"]'));

            // Find download button (more specific - avoid navigation buttons)
            const downloadBtn = elements.find(el => {
                const text = el.textContent.trim().toLowerCase();
                const isVisible = el.offsetParent !== null;
                return isVisible && text === 'download' && el.tagName !== 'NAV';
            });

            if (downloadBtn) {
                downloadBtn.click();
                return true;
            }
            return false;
        });

        if (clicked) {
            log("Đã click button download, chờ URL...");
            await page.waitForTimeout(5000);
        }
    }

    // Chờ một chút để download request được gửi đi
    await page.waitForTimeout(2000);

    // Fallback: Nếu không bắt được từ network, thử extract từ DOM
    if (!downloadUrl) {
        log("Không bắt được từ network, thử extract từ DOM...");

        downloadUrl = await page.evaluate(() => {
            // Tìm link có href chứa download hoặc pdf
            const links = Array.from(document.querySelectorAll('a[href*="download"], a[href*=".pdf"], a[href*="dl.scribd"]'));
            if (links.length > 0) {
                return links[0].href;
            }

            // Tìm trong các button/div có data attributes
            const elements = Array.from(document.querySelectorAll('[data-download-url], [data-href], [href]'));
            for (const el of elements) {
                const url = el.getAttribute('data-download-url') ||
                           el.getAttribute('data-href') ||
                           el.getAttribute('href') || '';
                if (url && (url.includes('download') || url.includes('.pdf') || url.includes('dl.scribd'))) {
                    return url.startsWith('http') ? url : 'https://www.scribd.com' + url;
                }
            }

            return null;
        });
    }

    if (!downloadUrl) {
        await page.screenshot({ path: 'no_download_url.png' });

        // Debug: Log HTML của modal
        const modalHtml = await page.evaluate(() => {
            const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]');
            return modal ? modal.innerHTML : 'No modal found';
        });
        log(`Modal HTML: ${modalHtml.substring(0, 500)}...`);

        throw new Error("Không bắt được download URL từ network và DOM");
    }

    log(`✅ PDF LINK: ${downloadUrl}`);
    await page.close();
    return downloadUrl;
}

// === ROUTE ===
// API endpoint to get statistics
app.get('/api/stats', (req, res) => {
    const stats = loadStats();
    res.json(stats);
});

// API endpoint to check queue status
app.get('/api/queue/:requestId', (req, res) => {
    const { requestId } = req.params;
    const status = queueStatus.get(requestId);

    if (!status) {
        return res.status(404).json({ error: 'Request not found' });
    }

    // Calculate ETA based on position
    let eta = null;
    if (status.status === 'queued' && status.position > 0) {
        // Estimate 30 seconds per request
        eta = status.position * 30;
    }

    res.json({
        ...status,
        eta,
        queueLength: requestQueue.length
    });
});

// GET route - removes placeholders for initial page load

app.get('/', (req, res) => {
    const html = TEMPLATE
        .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
        .replace(/\{\{result\}\}/g, '')
        .replace(/\{\{download_url\}\}/g, '');
    res.send(html);
});

app.post('/', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Verify Turnstile token first (skip in local development)
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        const turnstileToken = req.body['cf-turnstile-response'];
        if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
            const html = TEMPLATE
                .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
                .replace(/\{\{result\}\}/g, '<div class="result error">❌ CAPTCHA verification failed. Please try again.</div>')
                .replace(/\{\{download_url\}\}/g, '');
            return res.send(html);
        }
    } else {
        log("DEVELOPMENT MODE: Skipping Turnstile verification");
    }

    // Rate limiting
    if (!checkRateLimit(clientIp)) {
        const html = TEMPLATE
            .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
            .replace(/\{\{result\}\}/g, '<div class="result error">❌ Too many requests. Please wait a minute.</div>')
            .replace(/\{\{download_url\}\}/g, '');
        return res.send(html);
    }

    const url = req.body.url?.trim();
    log(`[${clientIp}] Link: ${url}`, true); // Send download requests to Discord

    const match = url.match(/\/document\/(\d+)/);
    if (!match) {
        const html = TEMPLATE
            .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
            .replace(/\{\{result\}\}/g, '<div class="result error">❌ Invalid Scribd URL</div>')
            .replace(/\{\{download_url\}\}/g, '');
        return res.send(html);
    }

    const docId = match[1];

    // Check cache first - if cached, return immediately
    const cached = cache.get(docId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        log(`[CACHE HIT] Document ${docId}`);

        // Increment download counter
        const totalDownloads = incrementDownloadCount();
        log(`Total downloads: ${totalDownloads}`, true);

        const html = TEMPLATE
            .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
            .replace(/\{\{result\}\}/g, '<div class="result success">✅ Success! (from cache)</div>')
            .replace(/\{\{download_url\}\}/g, `
                <div class="action-buttons">
                    <a href="${cached.url}" target="_blank" class="download-btn">📥 Download PDF</a>
                    <button class="copy-btn" onclick="copyToClipboard('${cached.url}')">📋 Copy Link</button>
                </div>
                <span class="note">Link expires in 5 minutes</span>
            `);
        return res.send(html);
    }

    // Not in cache - add to queue and return request ID for polling
    const requestId = generateRequestId();
    await addToQueue(requestId, docId, clientIp);

    // Return HTML with queue status checker
    const html = TEMPLATE
        .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
        .replace(/\{\{result\}\}/g, `
            <div class="result info" id="queueStatus">
                ⏳ Đang xử lý... Vui lòng chờ
                <div style="margin-top: 10px; font-size: 14px;">
                    <span id="queuePosition"></span>
                    <span id="queueEta" style="display: block; margin-top: 5px; opacity: 0.8;"></span>
                </div>
            </div>
        `)
        .replace(/\{\{download_url\}\}/g, `
            <script>
                const requestId = '${requestId}';
                let pollInterval;

                async function checkQueueStatus() {
                    try {
                        const res = await fetch('/api/queue/' + requestId);
                        const data = await res.json();

                        if (data.status === 'queued') {
                            document.getElementById('queuePosition').textContent =
                                'Vị trí trong hàng đợi: #' + data.position;
                            if (data.eta) {
                                document.getElementById('queueEta').textContent =
                                    'Ước tính: ~' + data.eta + ' giây';
                            }
                        } else if (data.status === 'processing') {
                            document.getElementById('queuePosition').textContent = 'Đang xử lý yêu cầu của bạn...';
                            document.getElementById('queueEta').textContent = '';
                        } else if (data.status === 'completed') {
                            clearInterval(pollInterval);
                            // Reload page to show result
                            window.location.href = '/result/' + requestId;
                        } else if (data.status === 'failed') {
                            clearInterval(pollInterval);
                            document.getElementById('queueStatus').innerHTML =
                                '<div class="result error">❌ Error: ' + data.error + '</div>';
                        }
                    } catch (e) {
                        console.error('Queue check failed:', e);
                    }
                }

                // Check immediately and then every 2 seconds
                checkQueueStatus();
                pollInterval = setInterval(checkQueueStatus, 2000);
            </script>
        `);

    res.send(html);
});

// Result page after queue completes
app.get('/result/:requestId', (req, res) => {
    const { requestId } = req.params;
    const status = queueStatus.get(requestId);

    if (!status || status.status !== 'completed') {
        return res.redirect('/');
    }

    // Increment download counter
    const totalDownloads = incrementDownloadCount();
    log(`Total downloads: ${totalDownloads}`, true);

    // Cache the result
    const match = status.downloadUrl.match(/\/document\/(\d+)/);
    if (match) {
        const docId = match[1];
        cache.set(docId, { url: status.downloadUrl, timestamp: Date.now() });
    }

    const html = TEMPLATE
        .replace(/\{\{TURNSTILE_SITE_KEY\}\}/g, TURNSTILE_SITE_KEY || '')
        .replace(/\{\{result\}\}/g, '<div class="result success">✅ Success!</div>')
        .replace(/\{\{download_url\}\}/g, `
            <div class="action-buttons">
                <a href="${status.downloadUrl}" target="_blank" class="download-btn">📥 Download PDF</a>
                <button class="copy-btn" onclick="copyToClipboard('${status.downloadUrl}')">📋 Copy Link</button>
            </div>
            <span class="note">Link expires in 5 minutes</span>
        `);

    // Clean up old queue status (keep for 5 minutes)
    setTimeout(() => queueStatus.delete(requestId), 5 * 60 * 1000);

    res.send(html);
});

// === ROUTE SETUP: Login thủ công để lấy cookies ===
app.get('/setup', async (req, res) => {
    try {
        log("Mở browser để bạn login thủ công...");

        const setupBrowser = await puppeteer.launch({
            headless: false,  // Hiện browser
            args: ['--no-sandbox', '--start-maximized']
        });

        const page = await setupBrowser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('https://www.scribd.com/login', { waitUntil: 'networkidle2' });

        res.send(`
            <h1>Setup Session</h1>
            <p>Browser đã mở! Login vào Scribd, sau đó:</p>
            <ol>
                <li>Đăng nhập với email/password của bạn</li>
                <li>Hoàn thành 2FA nếu có</li>
                <li>Khi đã vào dashboard, click button bên dưới:</li>
            </ol>
            <form method="POST" action="/setup/save">
                <button type="submit" style="padding: 10px 20px; font-size: 16px; background: green; color: white; border: none; cursor: pointer;">
                    ✅ Đã login xong - Lưu cookies
                </button>
            </form>
        `);

        // Lưu page reference để dùng ở POST route
        global.setupPage = page;
        global.setupBrowser = setupBrowser;

    } catch (e) {
        res.send(`Error: ${e.message}`);
    }
});

app.post('/setup/save', async (req, res) => {
    try {
        if (!global.setupPage) {
            return res.send(`
                <h1>❌ Lỗi</h1>
                <p>Không tìm thấy browser session. Có thể bạn đã đóng browser test.</p>
                <p><a href="/setup">← Thử lại</a></p>
            `);
        }

        try {
            await saveCookies(global.setupPage);

            if (global.setupBrowser) {
                await global.setupBrowser.close();
            }
        } catch (e) {
            log(`Warning khi đóng browser: ${e.message}`);
        }

        delete global.setupPage;
        delete global.setupBrowser;

        res.send(`
            <h1>✅ Thành công!</h1>
            <p>Cookies đã được lưu vào <code>cookies.json</code></p>
            <p>Giờ bạn có thể dùng app bình thường!</p>
            <a href="/">← Về trang chủ</a>
        `);

        log("Setup hoàn tất!");

    } catch (e) {
        res.send(`Error: ${e.message}`);
        log(`Setup error: ${e.message}`);
    }
});

app.listen(PORT, async () => {
    console.log(`\nWEB CHẠY TẠI: http://localhost:${PORT}`);
    console.log(`Lần đầu dùng? Vào http://localhost:${PORT}/setup để login`);
    console.log(`LOG SẼ HIỆN DƯỚI ĐÂY:\n`);

    // Send startup notification to Discord
    if (DISCORD_LOG_WEBHOOK) {
        await sendDiscordLog(`🚀 **Server khởi động thành công!**\n\nĐang chạy tại port ${PORT}\nTimestamp: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    }
});