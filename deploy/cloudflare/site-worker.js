// Cloudflare Worker (Static Assets) — phục vụ bản web tĩnh IDTP dưới subpath của site chính:
//   https://hoantrantdh.com/digital-twin-factory
// Worker chỉ nhận request khớp route /digital-twin-factory* (khai trong wrangler.toml), bóc tiền tố,
// rồi trả file tĩnh tương ứng qua binding ASSETS (apps/web-static/dist). Site chính KHÔNG bị đụng.
const PREFIX = '/digital-twin-factory';

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (req: Request) => Promise<Response> } }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    // /digital-twin-factory (không dấu /) → thêm / để base href + đường dẫn tương đối hoạt động.
    if (url.pathname === PREFIX) {
      return Response.redirect(url.origin + PREFIX + '/', 301);
    }

    // Bóc tiền tố → path của asset (assets nằm ở gốc: /index.html, /hmi.html, /idtp-local.js, /screen/<id>).
    let assetPath = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : url.pathname;
    if (assetPath === '' || assetPath === '/') assetPath = '/index.html';

    const assetReq = new Request(url.origin + assetPath + url.search, request);
    const res = await env.ASSETS.fetch(assetReq);
    // 404 → về landing (tránh trắng trang khi gõ path lạ dưới subpath).
    if (res.status === 404 && assetPath !== '/index.html') {
      return env.ASSETS.fetch(new Request(url.origin + '/index.html', request));
    }
    return res;
  },
};
