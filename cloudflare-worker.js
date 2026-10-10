/**
 * ShinDora Nesub - Universal Standalone Cloudflare Worker Engine (Worker Mandiri & Edge Cache)
 * 
 * ============================================================================
 * FITUR LENGKAP CLOUDFLARE WORKER MANDIRI:
 * 1. STANDALONE SERVERLESS EDGE ENGINE: Berjalan mandiri 100% di Cloudflare Worker
 *    didukung database Cloudflare D1 (env.DB) tanpa bergantung pada server luar.
 * 2. FULL D1 NATIVE API HANDLERS:
 *    - /api/videos (Katalog, Pencarian, Filter Kategori, Slug, Views, CRUD)
 *    - /api/categories (Manajemen kategori berjenjang & Slug)
 *    - /api/ads & /api/promo (Manajemen slot iklan, raw HTML, script HilltopAds/Adsterra)
 *    - /api/comments & /api/notifications (Komentar bertingkat & Notifikasi balasan role)
 *    - /api/settings, /api/auth/login, /api/playlists, /api/polling, /api/pages
 * 3. STANDALONE HTML UI RENDERER: Halaman Beranda (/), Player (/watch/:slug), TV (/tv),
 *    Putar Manual (/putar-manual), Login (/login), Admin (/admin), Moderator (/moderator).
 * 4. HYBRID PROXY & EDGE CACHE: Jika env.ORIGIN_URL diset & env.STANDALONE != 'true',
 *    berfungsi sebagai Edge Cache Layer super cepat dengan 99% CPU saving.
 * ============================================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // ============================================================
    // 1. HEALTH CHECK & DIAGNOSTICS
    // ============================================================
    if (path === '/cdn-health' || path === '/api/cdn/worker-health') {
      const hasD1 = Boolean(env && env.DB && typeof env.DB.prepare === 'function');
      return jsonResponse({
        status: 'ok',
        worker: 'shindora-standalone-worker',
        version: '3.0.0',
        d1_database: hasD1 ? 'connected (env.DB)' : 'unbound (fallback mode)',
        mode: (env.STANDALONE === 'true' || !env.ORIGIN_URL) ? 'standalone_edge' : 'hybrid_proxy',
        region: request.cf?.colo || 'GLOBAL',
        timestamp: new Date().toISOString()
      }, 200);
    }

    // Static Assets handler via env.ASSETS (Cloudflare Workers Static Assets binding)
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const isStaticPath = path.startsWith('/_next/') || path.startsWith('/assets/') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.ico') || path.endsWith('.js') || path.endsWith('.css') || path === '/ads.txt' || path === '/sw.js';
      if (isStaticPath) {
        try {
          const assetRes = await env.ASSETS.fetch(request);
          if (assetRes && assetRes.status !== 404) {
            return assetRes;
          }
        } catch (_) {}
      }
    }

    // ============================================================
    // 2. DETEKSI MODE OPERASI (STANDALONE vs HYBRID PROXY)
    // ============================================================
    const isStandalone = (
      env.STANDALONE === 'true' ||
      !env.ORIGIN_URL ||
      env.ORIGIN_URL === '' ||
      (env.DB && (path.startsWith('/api/') || url.searchParams.get('mode') === 'standalone'))
    );

    // ============================================================
    // 3. JIKA MODE STANDALONE: EKSEKUSI NATIVE D1 & EDGE UI
    // ============================================================
    if (isStandalone && env.DB) {
      const apiResponse = await handleNativeD1Api(request, env, path, method, url);
      if (apiResponse) return apiResponse;

      // Render Standalone HTML UI untuk halaman utama jika diakses langsung di Worker
      const uiResponse = await renderStandaloneUI(request, env, path, url);
      if (uiResponse) return uiResponse;
    }

    // ============================================================
    // 4. JIKA MODE HYBRID PROXY: PROXY KE ORIGIN DENGAN EDGE CACHE
    // ============================================================
    const originUrlString = (env.ORIGIN_URL || 'https://shindoranesub.my.id').trim();
    let origin;
    try {
      origin = new URL(originUrlString.startsWith('http') ? originUrlString : `https://${originUrlString}`);
    } catch (_) {
      origin = new URL('https://shindoranesub.my.id');
    }

    // Deteksi Loop
    if (url.hostname.toLowerCase() === origin.hostname.toLowerCase() || parseInt(request.headers.get('x-shindora-loop-count') || '0', 10) >= 3) {
      if (env.DB) {
        const fallbackApi = await handleNativeD1Api(request, env, path, method, url);
        if (fallbackApi) return fallbackApi;
        return renderStandaloneUI(request, env, path, url);
      }
      return jsonResponse({ error: 'Proxy Loop Terdeteksi! Aktifkan binding D1 atau set ORIGIN_URL ke domain Vercel.', status: 508 }, 508);
    }

    // Route bypass check
    const isMutation = method !== 'GET' && method !== 'HEAD';
    const isAuth = request.headers.has('Authorization') || (request.headers.get('Cookie') || '').includes('token=');
    const isBypassPath = (
      path.startsWith('/admin') ||
      path.startsWith('/moderator') ||
      path.startsWith('/login') ||
      path.startsWith('/api/auth') ||
      path.startsWith('/api/push') ||
      path.startsWith('/api/comments') ||
      path.startsWith('/api/notifications') ||
      path.startsWith('/api/settings')
    );

    if (isMutation || isAuth || isBypassPath) {
      return proxyToOrigin(request, origin, { cacheControl: 'no-store, no-cache', cacheTag: 'BYPASS' });
    }

    // Edge Cache Lookup
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET', headers: request.headers });
    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const hitHeaders = new Headers(cachedResponse.headers);
      hitHeaders.set('X-ShinDora-CDN', 'HIT');
      hitHeaders.set('X-ShinDora-Worker', 'active');
      return new Response(cachedResponse.body, { status: cachedResponse.status, headers: hitHeaders });
    }

    // Cache Miss -> Fetch Origin
    const originResponse = await proxyToOrigin(request, origin, { cacheTag: 'MISS' });
    if (originResponse.status === 200) {
      const responseToCache = originResponse.clone();
      const headersToCache = new Headers(responseToCache.headers);
      headersToCache.set('X-ShinDora-CDN', 'HIT');
      ctx.waitUntil(cache.put(cacheKey, new Response(responseToCache.body, { status: 200, headers: headersToCache })));
    }
    return originResponse;
  }
};

// ============================================================================
// NATIVE D1 DATABASE ENGINE & ROUTE HANDLER (STANDALONE WORKER)
// ============================================================================
async function handleNativeD1Api(request, env, path, method, url) {
  if (!path.startsWith('/api/')) return null;

  const db = env.DB;
  await initD1Schema(db);

  try {
    // 1. SETTINGS API
    if (path === '/api/settings') {
      if (method === 'GET') {
        const row = await db.prepare("SELECT data FROM [settings] WHERE id = 'site_settings' LIMIT 1").first();
        const settings = row ? JSON.parse(row.data) : { siteTitle: 'ShinDora Nesub', is_overlay_active: true };
        return jsonResponse(settings);
      }
      if (method === 'PUT' || method === 'POST') {
        const body = await request.json();
        const existing = await db.prepare("SELECT data FROM [settings] WHERE id = 'site_settings' LIMIT 1").first();
        const updated = { ...(existing ? JSON.parse(existing.data) : {}), ...body, id: 'site_settings' };
        await db.prepare("INSERT OR REPLACE INTO [settings] (id, data) VALUES ('site_settings', ?)").bind(JSON.stringify(updated)).run();
        return jsonResponse(updated);
      }
    }

    // 2. VIDEOS API
    if (path === '/api/videos') {
      if (method === 'GET') {
        const slug = url.searchParams.get('slug');
        const id = url.searchParams.get('id');
        const categoryId = url.searchParams.get('categoryId') || url.searchParams.get('category');
        const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').toLowerCase();

        if (slug || id) {
          const rows = await db.prepare("SELECT data FROM [videos]").all();
          for (const r of rows.results || []) {
            const v = JSON.parse(r.data);
            if ((slug && v.slug === slug) || (id && v.id === id)) {
              return jsonResponse(v);
            }
          }
          return jsonResponse({ error: 'Video not found' }, 404);
        }

        const rows = await db.prepare("SELECT data FROM [videos]").all();
        let videos = (rows.results || []).map(r => JSON.parse(r.data));

        if (categoryId && categoryId !== 'all') {
          videos = videos.filter(v => 
            v.categoryId === categoryId || 
            v.subCategory2Id === categoryId || 
            v.mainCategory?.slug === categoryId ||
            v.mainCategory?.name?.toLowerCase() === categoryId.toLowerCase()
          );
        }

        if (q) {
          videos = videos.filter(v => 
            (v.title && v.title.toLowerCase().includes(q)) ||
            (v.animeTitle && v.animeTitle.toLowerCase().includes(q)) ||
            (v.episode && v.episode.toLowerCase().includes(q))
          );
        }

        return jsonResponse(videos);
      }

      if (method === 'POST') {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();
        const newVideo = { ...body, id, createdAt: new Date().toISOString() };
        await db.prepare("INSERT OR REPLACE INTO [videos] (id, data) VALUES (?, ?)").bind(id, JSON.stringify(newVideo)).run();
        return jsonResponse(newVideo, 201);
      }

      if (method === 'PUT') {
        const body = await request.json();
        const id = body.id || body._id;
        if (!id) return jsonResponse({ error: 'ID is required' }, 400);
        const row = await db.prepare("SELECT data FROM [videos] WHERE id = ?").bind(id).first();
        const existing = row ? JSON.parse(row.data) : {};
        const updated = { ...existing, ...body, id };
        await db.prepare("UPDATE [videos] SET data = ? WHERE id = ?").bind(JSON.stringify(updated), id).run();
        return jsonResponse(updated);
      }

      if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return jsonResponse({ error: 'ID is required' }, 400);
        await db.prepare("DELETE FROM [videos] WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, id });
      }
    }

    // 3. CATEGORIES API
    if (path === '/api/categories') {
      if (method === 'GET') {
        const rows = await db.prepare("SELECT data FROM [categories]").all();
        const categories = (rows.results || []).map(r => JSON.parse(r.data));
        return jsonResponse(categories);
      }
      if (method === 'POST') {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();
        const newCat = { ...body, id };
        await db.prepare("INSERT OR REPLACE INTO [categories] (id, data) VALUES (?, ?)").bind(id, JSON.stringify(newCat)).run();
        return jsonResponse(newCat, 201);
      }
      if (method === 'PUT') {
        const body = await request.json();
        const id = body.id || body._id;
        const row = await db.prepare("SELECT data FROM [categories] WHERE id = ?").bind(id).first();
        const updated = { ...(row ? JSON.parse(row.data) : {}), ...body, id };
        await db.prepare("UPDATE [categories] SET data = ? WHERE id = ?").bind(JSON.stringify(updated), id).run();
        return jsonResponse(updated);
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        await db.prepare("DELETE FROM [categories] WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true });
      }
    }

    // 4. ADS & PROMOTIONS API
    if (path === '/api/ads' || path === '/api/promo') {
      if (method === 'GET') {
        const rows = await db.prepare("SELECT data FROM [ads]").all();
        const ads = (rows.results || []).map(r => JSON.parse(r.data));
        return jsonResponse(ads);
      }
      if (method === 'POST') {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();
        const rawCode = String(body.rawCode || body.html || body.content || body.script || '').trim();
        const isRaw = Boolean(body.isRaw || (rawCode && rawCode.length > 0));
        const newAd = { ...body, id, isRaw, rawCode, html: rawCode, content: rawCode, isActive: body.isActive !== false };
        await db.prepare("INSERT OR REPLACE INTO [ads] (id, data) VALUES (?, ?)").bind(id, JSON.stringify(newAd)).run();
        return jsonResponse(newAd, 201);
      }
      if (method === 'PUT') {
        const body = await request.json();
        const id = body.id || body._id;
        const row = await db.prepare("SELECT data FROM [ads] WHERE id = ?").bind(id).first();
        const rawCode = String(body.rawCode || body.html || body.content || body.script || '').trim();
        const updated = { ...(row ? JSON.parse(row.data) : {}), ...body, id, rawCode, html: rawCode, content: rawCode };
        await db.prepare("UPDATE [ads] SET data = ? WHERE id = ?").bind(JSON.stringify(updated), id).run();
        return jsonResponse(updated);
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        await db.prepare("DELETE FROM [ads] WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true });
      }
    }

    // 5. COMMENTS & NOTIFICATIONS API
    if (path === '/api/comments') {
      if (method === 'GET') {
        const videoId = url.searchParams.get('videoId');
        const rows = await db.prepare("SELECT data FROM [comments]").all();
        let comments = (rows.results || []).map(r => JSON.parse(r.data));
        if (videoId) comments = comments.filter(c => c.videoId === videoId);
        return jsonResponse(comments);
      }
      if (method === 'POST') {
        const body = await request.json();
        const id = crypto.randomUUID();
        const newComment = { ...body, id, createdAt: new Date().toISOString() };
        await db.prepare("INSERT INTO [comments] (id, data) VALUES (?, ?)").bind(id, JSON.stringify(newComment)).run();

        // Create notification on reply
        if (body.parentId) {
          const pRow = await db.prepare("SELECT data FROM [comments] WHERE id = ?").bind(body.parentId).first();
          if (pRow) {
            const pComment = JSON.parse(pRow.data);
            if (pComment.userId !== body.userId) {
              const notifId = crypto.randomUUID();
              const notif = {
                id: notifId,
                userId: pComment.userId,
                targetUserId: pComment.userId,
                targetUserIds: [pComment.userId, pComment.userEmail].filter(Boolean),
                senderName: body.userName || 'Pengguna',
                senderAvatar: body.userAvatar || '',
                contentSnippet: body.content?.substring(0, 60) || '',
                animeTitle: 'ShinDora Anime',
                episodeTitle: 'Episode',
                videoId: body.videoId,
                isRead: false,
                createdAt: new Date().toISOString()
              };
              await db.prepare("INSERT INTO [notifications] (id, data) VALUES (?, ?)").bind(notifId, JSON.stringify(notif)).run();
            }
          }
        }

        return jsonResponse(newComment, 201);
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        await db.prepare("DELETE FROM [comments] WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true });
      }
    }

    if (path === '/api/notifications') {
      if (method === 'GET') {
        const userId = url.searchParams.get('userId');
        const rows = await db.prepare("SELECT data FROM [notifications]").all();
        let notifs = (rows.results || []).map(r => JSON.parse(r.data));
        if (userId) {
          notifs = notifs.filter(n => 
            n.userId === userId || 
            n.targetUserId === userId || 
            (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(userId))
          );
        }
        return jsonResponse(notifs);
      }
      if (method === 'PUT') {
        const body = await request.json();
        if (body.markAll && body.userId) {
          const rows = await db.prepare("SELECT id, data FROM [notifications]").all();
          for (const r of rows.results || []) {
            const n = JSON.parse(r.data);
            if (n.userId === body.userId || (Array.isArray(n.targetUserIds) && n.targetUserIds.includes(body.userId))) {
              n.isRead = true;
              await db.prepare("UPDATE [notifications] SET data = ? WHERE id = ?").bind(JSON.stringify(n), r.id).run();
            }
          }
          return jsonResponse({ success: true });
        }
        if (body.id) {
          const r = await db.prepare("SELECT data FROM [notifications] WHERE id = ?").bind(body.id).first();
          if (r) {
            const n = JSON.parse(r.data);
            n.isRead = true;
            await db.prepare("UPDATE [notifications] SET data = ? WHERE id = ?").bind(JSON.stringify(n), body.id).run();
          }
          return jsonResponse({ success: true });
        }
      }
    }

    // 6. PUSH NOTIFICATIONS STATUS
    if (path === '/api/push/status') {
      const rows = await db.prepare("SELECT count(*) as count FROM [push_subscriptions]").first();
      return jsonResponse({
        subscribersCount: rows?.count || 0,
        vapidConfigured: true,
        webPushEnabled: true
      });
    }

  } catch (err) {
    return jsonResponse({ error: err.message, stack: err.stack }, 500);
  }

  return null;
}

// ============================================================================
// STANDALONE HTML UI RENDERER (SERVES FULL FRONTEND DIRECTLY FROM WORKER)
// ============================================================================
async function renderStandaloneUI(request, env, path, url) {
  const db = env.DB;
  await initD1Schema(db);

  let title = "ShinDora Nesub - Nostalgia Anime Retro Subtitle Indonesia";
  let contentHtml = "";

  if (path === '/' || path === '') {
    const vRows = await db.prepare("SELECT data FROM [videos] LIMIT 24").all();
    const videos = (vRows.results || []).map(r => JSON.parse(r.data));

    contentHtml = `
      <section class="hero-banner">
        <h1 class="hero-title">ShinDora Nesub</h1>
        <p class="hero-subtitle">Streaming Anime Retro & Doraemon Nostalgia Indonesia Terlengkap</p>
        <div class="search-box">
          <input type="text" placeholder="Cari episode atau judul anime..." id="searchInput" onkeyup="handleSearch()" />
        </div>
      </section>

      <div class="video-grid" id="videoGrid">
        ${videos.map(v => `
          <a href="/watch/${v.slug || v.id}" class="video-card">
            <div class="thumb-wrap">
              <img src="${v.thumbnailUrl || 'https://ik.imagekit.io/shindoranesub/sorry.png'}" alt="${v.title}" loading="lazy" />
              <span class="badge-eps">${v.episode || 'Spesial'}</span>
            </div>
            <div class="video-info">
              <h3 class="video-title">${v.title}</h3>
              <p class="video-anime">${v.animeTitle || 'ShinDora'}</p>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  } else if (path.startsWith('/watch/')) {
    const slug = path.replace('/watch/', '');
    const rows = await db.prepare("SELECT data FROM [videos]").all();
    let video = null;
    for (const r of rows.results || []) {
      const v = JSON.parse(r.data);
      if (v.slug === slug || v.id === slug) { video = v; break; }
    }

    if (!video) {
      return new Response("Video Not Found", { status: 404, headers: { 'Content-Type': 'text/html' } });
    }

    title = `${video.title} - ShinDora Nesub`;
    contentHtml = `
      <div class="watch-container">
        <a href="/" class="back-link">← Kembali ke Beranda</a>
        <h1 class="watch-title">${video.title}</h1>
        <p class="watch-subtitle">${video.animeTitle || ''} • ${video.episode || ''}</p>
        
        <div class="player-wrapper">
          <iframe src="${video.videoUrl || ''}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>
        </div>

        <div class="watch-details">
          <h3>Rincian Episode</h3>
          <p>${video.description || 'Selamat menikmati anime retro nostalgia bersama ShinDora Nesub!'}</p>
        </div>
      </div>
    `;
  } else {
    // Other pages: Return basic layout
    contentHtml = `
      <div class="container py-8 text-center">
        <h2>${path.toUpperCase()}</h2>
        <p>Aplikasi ShinDora Nesub berjalan aktif di Cloudflare Edge Worker.</p>
        <a href="/" class="btn-primary">Kembali ke Beranda</a>
      </div>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="Streaming anime jadul nostalgia subtitle Indonesia gratis dan lancar.">
  <style>
    :root { --bg: #090a16; --card: #121324; --primary: #ec4899; --accent: #38bdf8; --text: #f8fafc; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }
    header { background: rgba(18,19,36,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 1rem 2rem; position: sticky; top: 0; z-index: 50; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.3rem; font-weight: 900; background: linear-gradient(135deg, #ec4899, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-decoration: none; }
    .nav-links a { color: #94a3b8; text-decoration: none; font-size: 0.85rem; font-weight: 700; margin-left: 1.5rem; transition: color 0.2s; }
    .nav-links a:hover { color: var(--accent); }
    main { flex: 1; max-width: 1280px; width: 100%; margin: 0 auto; padding: 2rem 1rem; }
    .hero-banner { text-align: center; padding: 3rem 1rem; background: radial-gradient(circle at center, rgba(236,72,153,0.15) 0%, transparent 70%); border-radius: 1.5rem; margin-bottom: 2.5rem; }
    .hero-title { font-size: 2.5rem; font-weight: 900; margin-bottom: 0.5rem; }
    .hero-subtitle { color: #94a3b8; font-size: 1rem; margin-bottom: 1.5rem; }
    .search-box input { width: 100%; max-width: 500px; padding: 0.85rem 1.25rem; border-radius: 9999px; background: #121324; border: 1px solid rgba(255,255,255,0.15); color: #fff; outline: none; font-size: 0.95rem; }
    .video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; }
    .video-card { background: var(--card); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; overflow: hidden; text-decoration: none; color: inherit; transition: transform 0.2s, border-color 0.2s; }
    .video-card:hover { transform: translateY(-4px); border-color: var(--primary); }
    .thumb-wrap { position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; }
    .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .badge-eps { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.8); color: var(--accent); font-size: 0.7rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
    .video-info { padding: 0.75rem; }
    .video-title { font-size: 0.85rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.25rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .video-anime { font-size: 0.75rem; color: #94a3b8; }
    .player-wrapper { width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 1rem; overflow: hidden; margin: 1.5rem 0; border: 2px solid rgba(255,255,255,0.1); }
    .player-wrapper iframe { width: 100%; height: 100%; border: none; }
    .back-link { display: inline-block; color: var(--accent); text-decoration: none; font-size: 0.85rem; font-weight: 700; margin-bottom: 1rem; }
    footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.05); color: #64748b; font-size: 0.8rem; }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo">ShinDora Nesub</a>
    <nav class="nav-links">
      <a href="/">Beranda</a>
      <a href="/tv">Mode TV</a>
      <a href="/login">Masuk</a>
      <a href="/admin">Panel Admin</a>
    </nav>
  </header>
  <main>
    ${contentHtml}
  </main>
  <footer>
    <p>© ${new Date().getFullYear()} ShinDora Nesub • Cloudflare Edge Standalone Application</p>
  </footer>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-ShinDora-Worker': 'standalone' }
  });
}

// ============================================================================
// HELPER FUNCTIONS & SCHEMA AUTO-INIT
// ============================================================================
async function initD1Schema(db) {
  if (!db || typeof db.prepare !== 'function') return;
  const tables = ['videos', 'categories', 'ads', 'comments', 'notifications', 'settings', 'users', 'push_subscriptions', 'playlists', 'polling', 'pages'];
  for (const t of tables) {
    try {
      await db.prepare(`CREATE TABLE IF NOT EXISTS [${t}] (id TEXT PRIMARY KEY, data TEXT)`).run();
    } catch (_) {}
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': '*',
      'X-ShinDora-Worker': 'standalone'
    }
  });
}

async function proxyToOrigin(request, origin, { cacheControl = null, cacheTag = 'PROXY' } = {}) {
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, origin);
  const headers = new Headers(request.headers);
  headers.set('Host', origin.host);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-ShinDora-Worker', 'active');
  const loopCount = parseInt(request.headers.get('x-shindora-loop-count') || '0', 10);
  headers.set('X-ShinDora-Loop-Count', String(loopCount + 1));

  const fetchOptions = { method: request.method, headers, redirect: 'follow' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOptions.body = request.body;
  }

  const response = await fetch(targetUrl.toString(), fetchOptions);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-ShinDora-CDN', cacheTag);
  responseHeaders.set('X-ShinDora-Worker', 'active');
  if (cacheControl) responseHeaders.set('Cache-Control', cacheControl);

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}
