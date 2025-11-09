// Cloudflare Worker version - No Puppeteer, using fetch with cookies
// Hardcoded cookies (update these when they expire)
const COOKIES = [
  { name: "ssuuid", value: "84DE3EDC-4264-4DF9-87CF-92BB38B7A3BA" },
  { name: "_scribd_user_id", value: "NzU3Njc3Mjkw--53c9a391a0fb84e4580069a3fab5a46e368973f2" },
  { name: "_li_ss", value: "CmwKBgj3ARCVHAoFCAoQlRwKBgjdARCVHAoGCKUBEJUcCgYI4QEQlRwKBgiBARCVHAoFCAwQnxwKBgj1ARCVHAoGCIcCEJUcCgUICxCVHAoGCKIBEJUcCgYI_wEQlRwKBgjSARCVHAoFCH4QlRw" },
  { name: "_uetvid", value: "798d4910bd3711f0b819cdea619fd359" },
  { name: "_uetsid", value: "798ce900bd3711f0af87affb587f4577" },
  { name: "_rdt_uuid", value: "1762670640868.5999769b-1eb4-4685-b9d0-8d9bcf9e1a2e" },
  { name: "IR_14808", value: "1762670663029%7C0%7C1762670663029%7C%7C" },
  { name: "_gcl_au", value: "1.1.2027201961.1762670640.2119596880.1762670647.1762670661" },
  { name: "_ga", value: "GA1.1.2035916843.1762670641" },
  { name: "IR_gbd", value: "scribd.com" },
  { name: "_ga_Z4ZC50DED6", value: "GS2.1.s1762670640$o1$g1$t1762670685$j15$l0$h0" },
  { name: "_ga_8KZ8BV0P5W", value: "GS2.1.s1762670641$o1$g1$t1762670685$j16$l0$h0" },
  { name: "scribd_ubtc", value: "u%3Dab426a89-4511-4f22-815e-76f52f61f50a%26h%3DxhADTho9kVM8Cc0edyHk%2FegNAdHEoa8LiQuDnMG5rGs%3D" },
  { name: "_lc2_fpi_js", value: "4b59e25de34b--01k9knpzsbg8hjmm3jkqkab1z6" },
  { name: "__CJ_nwt", value: "%7B%22nw2624%22%3A6648%7D" },
  { name: "_dc_gtm_UA-443684-29", value: "1" },
  { name: "t-ip", value: "1" },
  { name: "_lc2_fpi", value: "4b59e25de34b--01k9knpzsbg8hjmm3jkqkab1z6" },
  { name: "_scribd_session", value: "WlNIUmZUbU80a2pza1hreG9sSXhPMWt6NlVmRTdFYWxIUHcrVmpLU2NEVHNvQmdDWlgzR2pGaVBNRTdQTjNVOSswWjJSSm9ITTMrR0k3VHlJaEVybGVueDdDNXFFT3BnMDdkYzBYckhOaDNoMmFGMUhTT0hVWVNBU1gyMitjYmgxTkIxUU5OSENRcjJpZktyVW5IcDRFSjQ4UGRDODRENXNzZVUyQlhna2M0Y0hCTUxRSXpldS9zSWx1NkhBd3kxb3lSUjRaQWhxS3cvQWRzME42NVZKaEhhZ3AyUVprL1M4R1VMTGFjSmJwK0dkRzZVUTJadXRvNVUveHJNZWdySkwzQmFpVW1hclVTTTJ5WlNGMFdYcHlvV3hCbDVWM3FpbXRkVEx5emtWWkVQeFVwc28wY1Uza2UxMEJ6clk5VDlzT3NvU09wOWFBNEtwckc3anJtZllWOWRWdThFM0Ivd3d5UmExZk9pMTdjcWJ0MGplai9ocDl5QUE3bFc4QWJzUDhoRXE3NkZHUEtFN3FPbWFmdXdIYkFxQ0h4bWlHUmV5NG9QTjB1OWJ5NmM2eW9YN3FyeFJ6bzdldXNCUENPYlQ1U2Nrd1BnVFJhVGZoSlg0RjRTMVE9PS0tRDIxekVnek5zU3BJMWQxUUlrZmVxdz09--7bbe43b708721a83998c84a2cf2928209fd1ab39" },
  { name: "_gid", value: "GA1.2.19961280.1762670641" },
  { name: "_fbp", value: "fb.1.1762670641412.73855147411361321" },
  { name: "_li_dcdm_c", value: ".scribd.com" },
  { name: "tatari-session-cookie", value: "55fc317f-ab06-21c8-169c-4527f05dfa36" }
];

const TEMPLATE = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scribd Downloader</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .card {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            width: 100%;
            max-width: 500px;
            animation: fadeIn 0.5s ease;
        }

        h1 {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            margin-bottom: 30px;
        }

        .input-box {
            position: relative;
            margin-bottom: 20px;
        }

        input {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            font-size: 16px;
            transition: all 0.3s;
            background: #f9fafb;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 4px rgba(102,126,234,0.1);
        }

        button {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102,126,234,0.4);
        }

        button:active {
            transform: translateY(0);
        }

        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
            color: #667eea;
            font-weight: 500;
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #e5e7eb;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }

        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 12px;
            text-align: center;
            animation: slideUp 0.4s ease;
        }

        .success {
            background: #d1fae5;
            color: #065f46;
            border: 2px solid #a7f3d0;
        }

        .error {
            background: #fee2e2;
            color: #991b1b;
            border: 2px solid #fca5a5;
        }

        .download-btn {
            display: inline-block;
            margin-top: 15px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(16,185,129,0.3);
        }

        .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(16,185,129,0.4);
        }

        .note {
            display: block;
            margin-top: 10px;
            font-size: 13px;
            color: #6b7280;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 480px) {
            .card { padding: 30px 20px; }
            h1 { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>📚 Scribd Downloader</h1>

        <form id="form" method="POST">
            <div class="input-box">
                <input
                    type="text"
                    name="url"
                    placeholder="Nhập link Scribd..."
                    required
                    autocomplete="off"
                />
            </div>
            <button type="submit">Lấy Link Download</button>
        </form>

        <div class="loading" id="loading">
            <span class="spinner"></span>
            Đang xử lý...
        </div>

        {{result}}
        {{download_url}}
    </div>

    <script>
        document.getElementById('form').addEventListener('submit', function() {
            document.querySelector('button').style.display = 'none';
            document.getElementById('loading').style.display = 'block';
        });
    </script>
</body>
</html>`;

// Convert cookies array to cookie string
function getCookieString() {
    return COOKIES.map(c => `${c.name}=${c.value}`).join('; ');
}

// Get PDF download URL using fetch
async function getPDFUrl(docId) {
    const url = `https://www.scribd.com/document/${docId}/`;
    const cookieString = getCookieString();

    console.log(`Fetching: ${url}`);

    // Fetch the document page with cookies
    const response = await fetch(url, {
        headers: {
            'Cookie': cookieString,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': 'https://www.scribd.com/',
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`);
    }

    const html = await response.text();

    // Try to find download button/link in HTML
    // Look for download URLs in the page
    const downloadUrlMatch = html.match(/https:\/\/[^"']*(?:download|dl\.scribd)[^"']*/i);

    if (downloadUrlMatch) {
        console.log(`Found download URL: ${downloadUrlMatch[0]}`);
        return downloadUrlMatch[0];
    }

    // Alternative: trigger download via API endpoint
    const downloadResponse = await fetch(`https://www.scribd.com/document/${docId}/download`, {
        method: 'POST',
        headers: {
            'Cookie': cookieString,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': url,
        },
        redirect: 'manual' // Don't follow redirects, we want the URL
    });

    // Check for redirect location
    const location = downloadResponse.headers.get('Location');
    if (location) {
        console.log(`Got redirect URL: ${location}`);
        return location;
    }

    throw new Error('Không tìm thấy download link');
}

// Handle requests
async function handleRequest(request) {
    const url = new URL(request.url);

    // GET request - show form
    if (request.method === 'GET' && url.pathname === '/') {
        const html = TEMPLATE
            .replace(/\{\{result\}\}/g, '')
            .replace(/\{\{download_url\}\}/g, '');

        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    // POST request - process download
    if (request.method === 'POST' && url.pathname === '/') {
        const formData = await request.formData();
        const scribdUrl = formData.get('url')?.trim();

        let resultHtml = '';
        let downloadHtml = '';

        console.log(`Processing URL: ${scribdUrl}`);

        const match = scribdUrl?.match(/\/document\/(\d+)/);
        if (!match) {
            resultHtml = '<div class="result error">❌ Link không hợp lệ</div>';
        } else {
            try {
                const downloadUrl = await getPDFUrl(match[1]);
                resultHtml = '<div class="result success">✅ Thành công!</div>';
                downloadHtml = `<a href="${downloadUrl}" target="_blank" class="download-btn">📥 Tải PDF</a><span class="note">Link có hiệu lực 5 phút</span>`;
            } catch (e) {
                resultHtml = `<div class="result error">❌ ${e.message}</div>`;
                console.error(e);
            }
        }

        const html = TEMPLATE
            .replace(/\{\{result\}\}/g, resultHtml)
            .replace(/\{\{download_url\}\}/g, downloadHtml);

        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    return new Response('Not Found', { status: 404 });
}

// Cloudflare Worker export
export default {
    async fetch(request) {
        return handleRequest(request);
    }
};
