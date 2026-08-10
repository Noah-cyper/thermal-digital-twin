// Cloudflare Worker — chen IDTP digital twin vào SUBPATH của site chính:
//   https://hoantrantdh.com/digital-twin-factory
// Worker proxy request từ subpath sang Cloudflare Pages project (bóc tiền tố /digital-twin-factory).
// Site chính hoantrantdh.com KHÔNG bị đụng: Worker chỉ bắt đúng route /digital-twin-factory*.
//
// Cấu hình:
//   1) Deploy Pages project (xem DEPLOY.md) → lấy domain *.pages.dev.
//   2) Đổi PAGES_ORIGIN bên dưới thành domain Pages thật.
//   3) Gắn Worker vào route  hoantrantdh.com/digital-twin-factory*  (dashboard hoặc wrangler.toml).

const PAGES_ORIGIN = 'https://idtp-thermal.pages.dev'; // ⬅️ ĐỔI thành <project>.pages.dev của bạn
const PREFIX = '/digital-twin-factory';

export default {
  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);

    // /digital-twin-factory (không dấu /) → thêm dấu / để base href + đường dẫn tương đối hoạt động.
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/', 301);
    }
    // Ngoài phạm vi app → trả 404 (an toàn, không proxy bừa).
    if (!url.pathname.startsWith(PREFIX + '/')) {
      return new Response('Not found', { status: 404 });
    }

    // Bóc tiền tố: /digital-twin-factory/hmi.html → /hmi.html trên Pages origin.
    const rest = url.pathname.slice(PREFIX.length); // giữ nguyên '/....'
    const target = PAGES_ORIGIN + rest + url.search;

    const upstream = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    });
    // Trả nguyên response (giữ content-type/headers từ Pages, gồm _headers cho /screen/*).
    return new Response(upstream.body, upstream);
  },
};
