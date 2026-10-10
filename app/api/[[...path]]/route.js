export const dynamic = 'force-dynamic'
import { getUnifiedDb } from '@/lib/db'
import { getBaseUrl } from '@/lib/utils/baseUrl'
import { purgeCloudflareCache } from '@/lib/cdn-purge'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import webPush from 'web-push'

function getVapidConfig() {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BIcdPCZmFC9l9UivZ7avsx0-inl9NJfY6r78XoqD5nA-LqJC3PIZIW4BGZ_tKTnLjHcrYyR_H8Q6mOK-3sE9-FA').trim()
  const privateKey = (process.env.VAPID_PRIVATE_KEY || 'Nl7VIlsRljB5gK3Os9WR75Q4iU00X2r4Dfj_cowpvLQ').trim()
  const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@shindoranesub.my.id').trim()
  return { publicKey, privateKey, subject }
}

let isCategoryMigrationDone = false;

async function sendNativeWebPushNotification(db, video, request = null) {
  try {
    const settings = await db.collection("settings").findOne({ id: "site_settings" })
    if (settings && settings.webPushEnabled === false) {
      console.log("[WebPush Info]: Web Push is disabled in site settings.")
      return { success: false, reason: 'disabled' }
    }

    const { publicKey, privateKey, subject } = getVapidConfig()
    if (!publicKey || !privateKey) {
      console.warn("[WebPush Info]: VAPID public or private key not configured in environment.")
      return { success: false, reason: 'no_keys' }
    }

    webPush.setVapidDetails(subject, publicKey, privateKey)

    const animeTitle = video.animeTitle || video.title || "Anime"
    const videoTitle = video.title || animeTitle || "Episode Baru"
    const episode = video.episode || "Eps 1"
    const watchUrl = video.slug ? `/watch/${video.slug}` : (video.id ? `/watch/${video.id}` : '/watch/shindora-push')

    const payloadObj = {
      title: `Episode Baru: ${animeTitle} 🎬`,
      body: `Tonton ${videoTitle} (${episode}) sekarang!`,
      url: watchUrl,
      tag: `shindora-video-${video.id || video.slug || Date.now()}`,
      renotify: true
    }

    if (video.thumbnailUrl && typeof video.thumbnailUrl === 'string' && video.thumbnailUrl.trim() !== '') {
      payloadObj.image = video.thumbnailUrl.trim()
    }

    const payloadString = JSON.stringify(payloadObj)
    const subscribers = await db.collection("push_subscriptions").find({}).toArray()
    console.log(`[WebPush Info]: Sending Web Push for "${videoTitle}" to ${subscribers.length} subscribers...`)

    if (!subscribers || subscribers.length === 0) {
      console.log("[WebPush Info]: No subscribers to send push notification.")
      return { success: true, count: 0, total: 0 }
    }

    const deadEndpoints = []
    let sentCount = 0
    await Promise.allSettled(
      subscribers.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }
          await webPush.sendNotification(pushSubscription, payloadString)
          sentCount++
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            deadEndpoints.push(sub.endpoint)
          } else {
            console.error(`[WebPush Send Error for ${sub.endpoint}]:`, err.message || err)
          }
        }
      })
    )

    if (deadEndpoints.length > 0) {
      for (const endpoint of deadEndpoints) {
        await db.collection("push_subscriptions").deleteOne({ endpoint })
      }
      console.log(`[WebPush Info]: Cleaned up ${deadEndpoints.length} inactive subscriptions.`)
    }
    return { success: true, count: sentCount, total: subscribers.length }
  } catch (err) {
    console.error("[WebPush Error]:", err)
    return { success: false, error: err.message }
  }
}

// connectToMongo removed - using getUnifiedDb instead

function generateSlug(text) {
  if (!text) return ''
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Helper pembersih karakter prefix indentasi (seperti ↳)
function cleanCatName(text) {
  if (!text) return ''
  return text.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
}

async function deleteImageKitFileByUrl(url, privateKey) {
  if (!url || !url.includes('ik.imagekit.io') || !privateKey) return

  try {
    const urlParts = url.split('/')
    const fileName = urlParts[urlParts.length - 1]
    if (!fileName) return

    const authHeader = 'Basic ' + Buffer.from(privateKey + ':').toString('base64')

    const searchRes = await fetch(`https://api.imagekit.io/v1/files?searchQuery=name="${fileName}"`, {
      headers: { 'Authorization': authHeader }
    })

    if (!searchRes.ok) return

    const files = await searchRes.json()
    if (Array.isArray(files) && files.length > 0) {
      const fileId = files[0].fileId
      await fetch(`https://api.api.imagekit.io/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader }
      })
    }
  } catch (err) {
    console.error('[deleteImageKitFileByUrl Error]:', err)
  }
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  response.headers.set('Surrogate-Control', 'no-store')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function resolveCategoryIdsForVideo(db, video) {
  const updatedVideo = { ...video };

  // 1. Resolve category_id (Kategori Utama - Level 1)
  let mainCat = null;
  const rawMainId = video.categoryId || video.category_id;
  if (rawMainId) {
    mainCat = await db.collection('categories').findOne({
      $or: [{ id: String(rawMainId) }, { _id: String(rawMainId) }]
    });
  }
  if (!mainCat && video.animeTitle) {
    const cleanMain = cleanCatName(video.animeTitle);
    mainCat = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^.*${cleanMain}.*$`, 'i') },
      parent_id: { $in: [null, 'none'] }
    });
  }
  if (mainCat) {
    updatedVideo.category_id = String(mainCat.id || mainCat._id);
    updatedVideo.categoryId = updatedVideo.category_id;
    updatedVideo.animeTitle = mainCat.name;
    updatedVideo.mainCategory = {
      id: updatedVideo.categoryId,
      name: mainCat.name,
      slug: generateSlug(mainCat.name)
    };
  } else if (video.animeTitle) {
    updatedVideo.mainCategory = {
      id: updatedVideo.categoryId || null,
      name: video.animeTitle,
      slug: generateSlug(video.animeTitle)
    };
  }

  // 2. Resolve sub_category_1_id (Sub-Kategori 1 - Level 2)
  let sub1Cat = null;
  const rawSub1Id = video.subCategory1Id || video.subCategoryId || video.sub_category_1_id || video.sub_category_id;
  if (rawSub1Id) {
    sub1Cat = await db.collection('categories').findOne({
      $or: [{ id: String(rawSub1Id) }, { _id: String(rawSub1Id) }]
    });
  }
  if (!sub1Cat && video.subCategory && updatedVideo.categoryId) {
    const cleanSub1 = cleanCatName(video.subCategory);
    sub1Cat = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^.*${cleanSub1}.*$`, 'i') },
      parent_id: updatedVideo.categoryId
    });
  }
  if (sub1Cat) {
    updatedVideo.sub_category_1_id = String(sub1Cat.id || sub1Cat._id);
    updatedVideo.subCategory1Id = updatedVideo.sub_category_1_id;
    updatedVideo.subCategoryId = updatedVideo.sub_category_1_id;
    updatedVideo.sub_category_id = updatedVideo.sub_category_1_id;
    updatedVideo.subCategory = sub1Cat.name;
    updatedVideo.subCategory1 = {
      id: updatedVideo.subCategoryId,
      name: sub1Cat.name,
      slug: generateSlug(sub1Cat.name)
    };
  } else if (video.subCategory) {
    updatedVideo.subCategory1 = {
      id: updatedVideo.subCategoryId || null,
      name: video.subCategory,
      slug: generateSlug(video.subCategory)
    };
  }

  // 3. Resolve sub_category_2_id (Sub-Kategori 2 - Level 3)
  let sub2Cat = null;
  const rawSub2Id = video.subCategory2Id || video.sub_category_2_id;
  if (rawSub2Id) {
    sub2Cat = await db.collection('categories').findOne({
      $or: [{ id: String(rawSub2Id) }, { _id: String(rawSub2Id) }]
    });
  }
  if (!sub2Cat && video.subCategory2 && updatedVideo.subCategoryId) {
    const cleanSub2 = cleanCatName(video.subCategory2);
    sub2Cat = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^.*${cleanSub2}.*$`, 'i') },
      parent_id: updatedVideo.subCategoryId
    });
  }
  if (sub2Cat) {
    updatedVideo.sub_category_2_id = String(sub2Cat.id || sub2Cat._id);
    updatedVideo.subCategory2Id = updatedVideo.sub_category_2_id;
    updatedVideo.subCategory2 = sub2Cat.name;
    updatedVideo.subCategory2Obj = {
      id: updatedVideo.subCategory2Id,
      name: sub2Cat.name,
      slug: generateSlug(sub2Cat.name)
    };
  } else if (video.subCategory2) {
    updatedVideo.subCategory2Obj = {
      id: updatedVideo.subCategory2Id || null,
      name: video.subCategory2,
      slug: generateSlug(video.subCategory2)
    };
  } else {
    updatedVideo.subCategory2Id = null;
    updatedVideo.sub_category_2_id = null;
    updatedVideo.subCategory2 = '';
    updatedVideo.subCategory2Obj = null;
  }

  // 4. Resolve sub_category_3_id (Sub-Kategori 3 - Level 4)
  let sub3Cat = null;
  const rawSub3Id = video.subCategory3Id || video.sub_category_3_id;
  if (rawSub3Id) {
    sub3Cat = await db.collection('categories').findOne({
      $or: [{ id: String(rawSub3Id) }, { _id: String(rawSub3Id) }]
    });
  }
  if (!sub3Cat && video.subCategory3 && updatedVideo.subCategory2Id) {
    const cleanSub3 = cleanCatName(video.subCategory3);
    sub3Cat = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^.*${cleanSub3}.*$`, 'i') },
      parent_id: updatedVideo.subCategory2Id
    });
  }
  if (sub3Cat) {
    updatedVideo.sub_category_3_id = String(sub3Cat.id || sub3Cat._id);
    updatedVideo.subCategory3Id = updatedVideo.sub_category_3_id;
    updatedVideo.subCategory3 = sub3Cat.name;
    updatedVideo.subCategory3Obj = {
      id: updatedVideo.subCategory3Id,
      name: sub3Cat.name,
      slug: generateSlug(sub3Cat.name)
    };
  } else if (video.subCategory3) {
    updatedVideo.subCategory3Obj = {
      id: updatedVideo.subCategory3Id || null,
      name: video.subCategory3,
      slug: generateSlug(video.subCategory3)
    };
  } else {
    updatedVideo.subCategory3Id = null;
    updatedVideo.sub_category_3_id = null;
    updatedVideo.subCategory3 = '';
    updatedVideo.subCategory3Obj = null;
  }

  return updatedVideo;
}

// Catch-all API handler
async function handleRoute(request, context) {
  const params = context?.params ? await context.params : {};
  const rawPath = params?.path || [];
  const path = Array.isArray(rawPath) ? rawPath : (rawPath ? [rawPath] : []);
  const route = path.length > 0 ? `/${path.join('/')}` : '/';
  const method = request.method;

  try {
    const db = await getUnifiedDb(request?.env || request?.context?.env || request)

    // 1. AUTH ROUTES
    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      const { name, email, password } = body

      if (!name || !email || !password) {
        return handleCORS(NextResponse.json({ error: 'Nama, Email, dan Password wajib diisi!' }, { status: 400 }))
      }

      const existingUser = await db.collection('users').findOne({ email })
      if (existingUser) {
        return handleCORS(NextResponse.json({ error: 'Email sudah terdaftar!' }, { status: 400 }))
      }

      const DEFAULT_AVATARS = [
        "https://ik.imagekit.io/shindoranesub/c11d825a820d5a3fc725c0c02fb1d637.jpg",
        "https://ik.imagekit.io/shindoranesub/b109036f0bf49f236b934a70d115fdfc.jpg",
        "https://ik.imagekit.io/shindoranesub/pngegg.png",
        "https://ik.imagekit.io/shindoranesub/sorry.png"
      ];
      const randomAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];

      const newUser = {
        id: uuidv4(),
        name,
        email,
        password,
        role: 'user',
        avatarUrl: randomAvatar,
        isBanned: false,
        createdAt: new Date()
      }

      await db.collection('users').insertOne(newUser)
      const { password: _, ...userWithoutPassword } = newUser
      return handleCORS(NextResponse.json(userWithoutPassword))
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const { email, password, isStaffOnly } = body

      if (!email || !password) {
        return handleCORS(NextResponse.json({ error: 'Email dan password wajib diisi!' }, { status: 400 }))
      }

      const user = await db.collection('users').findOne({ email, password })
      if (!user) {
        return handleCORS(NextResponse.json({ error: 'Email atau password salah!' }, { status: 401 }))
      }

      if (user.isBanned) {
        return handleCORS(NextResponse.json({ error: 'Akun Anda telah dibanned oleh Admin!' }, { status: 403 }))
      }

      if (isStaffOnly && user.role !== 'admin' && user.role !== 'moderator') {
        return handleCORS(NextResponse.json({ error: 'Akses ditolak! Anda bukan Staf/Moderator/Admin.' }, { status: 403 }))
      }

      const { password: _, ...userWithoutPassword } = user
      return handleCORS(NextResponse.json({
        ...userWithoutPassword,
        token: userWithoutPassword.id || userWithoutPassword._id || 'shindora-session-token',
        user: userWithoutPassword
      }))
    }

    if (route === '/auth/forgot-password' && method === 'POST') {
      const body = await request.json()
      const { email } = body

      if (!email) {
        return handleCORS(NextResponse.json({ error: 'Email wajib diisi!' }, { status: 400 }))
      }

      const user = await db.collection('users').findOne({ email })
      if (!user) {
        return handleCORS(NextResponse.json({ error: 'Email tidak ditemukan!' }, { status: 404 }))
      }

      const settings = await db.collection('settings').findOne({ id: 'site_settings' })
      const credentials = settings?.emailProviderCredentials
      const smtpHost = credentials?.smtpHost || 'mail.shindoranesub.my.id'
      const smtpPort = Number(credentials?.smtpPort || 465)
      const smtpUser = credentials?.smtpUser || 'resend@shindoranesub.my.id'
      const smtpPass = credentials?.smtpPass

      const pinCode = Math.floor(100000 + Math.random() * 900000)

      try {
        await db.collection('users').updateOne(
          { email },
          {
            $set: {
              resetPinCode: pinCode.toString(),
              resetPinExpires: new Date(Date.now() + 15 * 60 * 1000)
            }
          }
        )

        if (!smtpPass) {
          return handleCORS(NextResponse.json({
            success: true,
            message: 'Kode PIN verifikasi telah disimulasikan.',
            pinCode
          }))
        }

        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false }
        })

        const mailOptions = {
          from: `"ShinDora Nesub" <${smtpUser}>`,
          to: email,
          subject: 'Kode Verifikasi Reset Password - ShinDora Nesub',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                  background-color: #0b0f19;
                  margin: 0;
                  padding: 30px 15px;
                  -webkit-font-smoothing: antialiased;
                }
                .wrapper {
                  max-width: 520px;
                  margin: 0 auto;
                  background: #111827;
                  border: 1px solid #1e293b;
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                }
                .header {
                  background: linear-gradient(135deg, #06b6d4 0%, #ec4899 50%, #8b5cf6 100%);
                  padding: 30px 20px;
                  text-align: center;
                }
                .brand-title {
                  color: #ffffff;
                  font-size: 24px;
                  font-weight: 900;
                  letter-spacing: 2px;
                  margin: 0;
                  text-transform: uppercase;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                .brand-subtitle {
                  color: rgba(255, 255, 255, 0.9);
                  font-size: 11px;
                  font-weight: 600;
                  letter-spacing: 1px;
                  margin-top: 4px;
                  text-transform: uppercase;
                }
                .content {
                  padding: 32px 28px;
                  color: #cbd5e1;
                  font-size: 14px;
                  line-height: 1.6;
                }
                .greeting {
                  font-size: 16px;
                  color: #f8fafc;
                  margin-bottom: 12px;
                }
                .pin-container {
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 12px;
                  padding: 20px;
                  text-align: center;
                  margin: 24px 0;
                }
                .pin-label {
                  font-size: 11px;
                  text-transform: uppercase;
                  letter-spacing: 1.5px;
                  color: #94a3b8;
                  font-weight: 700;
                  margin-bottom: 10px;
                }
                .pin-code {
                  font-family: 'Courier New', Courier, monospace;
                  font-size: 36px;
                  font-weight: 800;
                  letter-spacing: 8px;
                  color: #38bdf8;
                  text-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
                  margin: 0;
                  padding-left: 8px;
                }
                .alert-box {
                  background: rgba(239, 68, 68, 0.1);
                  border-left: 4px solid #ef4444;
                  padding: 12px 16px;
                  border-radius: 6px;
                  font-size: 12px;
                  color: #fca5a5;
                  margin-bottom: 24px;
                }
                .footer {
                  background: #0f172a;
                  padding: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #64748b;
                  border-top: 1px solid #1e293b;
                }
              </style>
            </head>
            <body>
              <div class="wrapper">
                <div class="header">
                  <h1 class="brand-title">SHINDORA NESUB</h1>
                  <div class="brand-subtitle">Retro Anime Streaming Platform</div>
                </div>
                <div class="content">
                  <div class="greeting">Halo, <strong>${user.name || 'Kohae'}</strong> 👋</div>
                  <p>Kami menerima permintaan untuk melakukan pengubahan kata sandi akun Anda. Gunakan kode PIN verifikasi di bawah ini untuk melanjutkan:</p>
                  <div class="pin-container">
                    <div class="pin-label">Kode Verifikasi Reset</div>
                    <div class="pin-code">${pinCode}</div>
                  </div>
                  <div class="alert-box">
                    <strong>PENTING:</strong> Kode ini hanya berlaku selama <strong>15 menit</strong>. Jangan berikan kode ini kepada siapa pun demi keamanan akun Anda.
                  </div>
                  <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Jika Anda tidak merasa meminta reset kata sandi, silakan abaikan email ini secara aman.</p>
                </div>
                <div class="footer">
                  &copy; 2026 <strong>ShinDora Nesub</strong>. All rights reserved.
                </div>
              </div>
            </body>
            </html>
          `
        }

        await transporter.sendMail(mailOptions)

        return handleCORS(NextResponse.json({
          success: true,
          message: 'Kode PIN verifikasi telah dikirim ke email Anda.',
          pinCode
        }))
      } catch (err) {
        console.error('[SMTP Send Error]:', err)
        return handleCORS(NextResponse.json({
          success: true,
          message: 'Kode PIN verifikasi disimulasikan karena masalah SMTP.',
          pinCode
        }))
      }
    }

    if (route === '/auth/reset-password' && method === 'POST') {
      const body = await request.json()
      const { email, pinCode, newPassword } = body

      if (!email || !pinCode || !newPassword) {
        return handleCORS(NextResponse.json({ error: 'Data wajib diisi lengkap!' }, { status: 400 }))
      }

      const user = await db.collection('users').findOne({ email })
      if (!user) {
        return handleCORS(NextResponse.json({ error: 'Email tidak ditemukan!' }, { status: 404 }))
      }

      if (!user.resetPinCode || user.resetPinCode !== pinCode.toString()) {
        return handleCORS(NextResponse.json({ error: 'Kode PIN verifikasi salah!' }, { status: 400 }))
      }

      if (!user.resetPinExpires || new Date() > new Date(user.resetPinExpires)) {
        return handleCORS(NextResponse.json({ error: 'Kode PIN telah kadaluarsa!' }, { status: 400 }))
      }

      await db.collection('users').updateOne(
        { email },
        { 
          $set: { password: newPassword },
          $unset: { resetPinCode: "", resetPinExpires: "" }
        }
      )

      return handleCORS(NextResponse.json({ 
        success: true, 
        message: 'Kata sandi Anda berhasil diperbarui!' 
      }))
    }

    if (route === '/auth/update-avatar' && method === 'POST') {
      const body = await request.json()
      const { userId, avatarUrl } = body

      if (!userId || !avatarUrl) {
        return handleCORS(NextResponse.json({ error: 'ID Pengguna dan Data Avatar wajib dikirim!' }, { status: 400 }))
      }

      await db.collection('users').updateOne({ id: userId }, { $set: { avatarUrl } })
      const updatedUser = await db.collection('users').findOne({ id: userId })
      if (updatedUser) {
        const { password: _, ...userWithoutPassword } = updatedUser
        return handleCORS(NextResponse.json(userWithoutPassword))
      }
      return handleCORS(NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 }))
    }

    // 2. SETTINGS ROUTES
    const SENSITIVE_KEYS = [
      'saweriaStreamKey',
      'trakteerStreamKey',
      'takoStreamKey',
      'imagekitPrivateKey',
      'onesignalRestApiKey',
      'turnstileSecretKey',
      'smtpPass'
    ];

    function maskSettings(settings) {
      if (!settings) return {};
      const masked = { ...settings };
      SENSITIVE_KEYS.forEach(key => {
        if (masked[key]) {
          masked[key] = '••••••••';
        }
      });
      if (masked.emailProviderCredentials && masked.emailProviderCredentials.smtpPass) {
        masked.emailProviderCredentials = {
          ...masked.emailProviderCredentials,
          smtpPass: '••••••••'
        };
      }
      return masked;
    }

    if (route === '/settings' && method === 'GET') {
      const settings = await db.collection('settings').findOne({ id: 'site_settings' })
      const isOverlay = settings?.is_overlay_active !== undefined 
        ? Boolean(settings.is_overlay_active) 
        : (settings?.donationOverlayActive !== undefined ? Boolean(settings.donationOverlayActive) : true)
      const isRunning = settings?.is_running_text_active !== undefined 
        ? Boolean(settings.is_running_text_active) 
        : (settings?.donationOverlayActive !== undefined ? Boolean(settings.donationOverlayActive) : true)

      // Environment overrides for stream keys and SMTP credentials
      const saweriaStreamKey = (process.env.SAWERIA_STREAM_KEY || settings?.saweriaStreamKey || '').trim()
      const trakteerStreamKey = (process.env.TRAKTEER_STREAM_KEY || settings?.trakteerStreamKey || '').trim()
      const takoStreamKey = (process.env.TAKO_STREAM_KEY || settings?.takoStreamKey || '').trim()
      const smtpHost = (process.env.SMTP_HOST || settings?.emailProviderCredentials?.smtpHost || '').trim()
      const smtpPort = (process.env.SMTP_PORT || settings?.emailProviderCredentials?.smtpPort || '').trim()
      const smtpUser = (process.env.SMTP_USER || settings?.emailProviderCredentials?.smtpUser || '').trim()
      const smtpPass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || settings?.emailProviderCredentials?.smtpPass || '').trim()

      const normalized = {
        id: 'site_settings',
        is_overlay_active: isOverlay,
        is_running_text_active: isRunning,
        ...(settings || {}),
        saweriaStreamKey,
        trakteerStreamKey,
        takoStreamKey,
        emailProviderCredentials: {
          ...(settings?.emailProviderCredentials || {}),
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass
        },
        envStreamKeysLocked: true,
        envSmtpLocked: true
      }
      normalized.is_overlay_active = isOverlay
      normalized.is_running_text_active = isRunning
      return handleCORS(NextResponse.json(maskSettings(normalized)))
    }

    if (route === '/settings' && method === 'POST') {
      const body = await request.json()
      const { _id, ...cleanBody } = body
      
      const existingSettings = await db.collection('settings').findOne({ id: 'site_settings' })
      if (existingSettings) {
        SENSITIVE_KEYS.forEach(key => {
          if (cleanBody[key] === '••••••••' || cleanBody[key] === '********') {
            cleanBody[key] = existingSettings[key];
          }
        });
        if (cleanBody.emailProviderCredentials && 
            (cleanBody.emailProviderCredentials.smtpPass === '••••••••' || 
             cleanBody.emailProviderCredentials.smtpPass === '********')) {
          cleanBody.emailProviderCredentials.smtpPass = existingSettings.emailProviderCredentials?.smtpPass;
        }
      }

      await db.collection('settings').updateOne(
        { id: 'site_settings' },
        { $set: cleanBody },
        { upsert: true }
      )
      const settings = await db.collection('settings').findOne({ id: 'site_settings' })
      const isOverlay = settings?.is_overlay_active !== undefined 
        ? Boolean(settings.is_overlay_active) 
        : true
      const isRunning = settings?.is_running_text_active !== undefined 
        ? Boolean(settings.is_running_text_active) 
        : true
      const normalized = {
        id: 'site_settings',
        is_overlay_active: isOverlay,
        is_running_text_active: isRunning,
        ...(settings || {})
      }
      normalized.is_overlay_active = isOverlay
      normalized.is_running_text_active = isRunning
      return handleCORS(NextResponse.json(maskSettings(normalized)))
    }

    if (route === '/imagekit/auth' && method === 'GET') {
      const settings = await db.collection('settings').findOne({ id: 'site_settings' })
      const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || settings?.imagekitPrivateKey || '').trim()
      const publicKey = (process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || settings?.imagekitPublicKey || '').trim()
      const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || settings?.imagekitUrlEndpoint || '').trim()

      if (!privateKey || !publicKey) {
        return handleCORS(NextResponse.json({ error: 'Kredensial ImageKit belum dikonfigurasi!' }, { status: 400 }))
      }

      const token = uuidv4()
      const expire = Math.floor(Date.now() / 1000) + 1800

      const crypto = require('crypto')
      const signature = crypto
        .createHmac('sha1', privateKey)
        .update(token + expire.toString())
        .digest('hex')

      return handleCORS(NextResponse.json({
        token,
        expire,
        signature,
        publicKey,
        urlEndpoint
      }))
    }

    // 3. VIDEOS ROUTES
    if (route === '/videos' && method === 'GET') {
      const url = new URL(request.url)
      const search = url.searchParams.get('search') || ''
      let category = url.searchParams.get('category') || ''
      const showAll = url.searchParams.get('showAll') === 'true'
      if (category) {
        category = cleanCatName(category)
      }

      // Migration check for video category references (run once)
      if (!isCategoryMigrationDone) {
        try {
          const unmigratedVideos = await db.collection('videos').find({
            animeTitle: { $exists: true, $ne: '' },
            category_id: { $exists: false }
          }).toArray();
          if (unmigratedVideos.length > 0) {
            for (const video of unmigratedVideos) {
              const resolved = await resolveCategoryIdsForVideo(db, video);
              const setObj = {};
              if (resolved.category_id) {
                setObj.category_id = resolved.category_id;
                setObj.categoryId = resolved.categoryId;
              }
              if (resolved.sub_category_1_id) {
                setObj.sub_category_1_id = resolved.sub_category_1_id;
                setObj.subCategoryId = resolved.subCategoryId;
                setObj.sub_category_id = resolved.sub_category_id;
              }
              if (resolved.sub_category_2_id) {
                setObj.sub_category_2_id = resolved.sub_category_2_id;
                setObj.subCategory2Id = resolved.subCategory2Id;
              }
              if (Object.keys(setObj).length > 0) {
                await db.collection('videos').updateOne({ id: video.id }, { $set: setObj });
              }
            }
          }
          isCategoryMigrationDone = true;
        } catch (migrateErr) {
          console.error('[Category Migration Error]:', migrateErr);
        }
      }

      const query = {}
      const andConditions = []

      const categoryIdParam = url.searchParams.get('category_id') || url.searchParams.get('categoryId')
      const subCategory1IdParam = url.searchParams.get('sub_category_1_id') || url.searchParams.get('subCategory1Id') || url.searchParams.get('sub_category_id') || url.searchParams.get('subCategoryId')
      const subCategory2IdParam = url.searchParams.get('sub_category_2_id') || url.searchParams.get('subCategory2Id')
      const subCategory3IdParam = url.searchParams.get('sub_category_3_id') || url.searchParams.get('subCategory3Id')

      if (categoryIdParam) {
        andConditions.push({
          $or: [
            { categoryId: categoryIdParam },
            { category_id: categoryIdParam }
          ]
        })
      }
      if (subCategory1IdParam) {
        andConditions.push({
          $or: [
            { subCategoryId: subCategory1IdParam },
            { sub_category_id: subCategory1IdParam },
            { sub_category_1_id: subCategory1IdParam },
            { subCategory1Id: subCategory1IdParam }
          ]
        })
      }
      if (subCategory2IdParam) {
        andConditions.push({
          $or: [
            { subCategory2Id: subCategory2IdParam },
            { sub_category_2_id: subCategory2IdParam }
          ]
        })
      }
      if (subCategory3IdParam) {
        andConditions.push({
          $or: [
            { subCategory3Id: subCategory3IdParam },
            { sub_category_3_id: subCategory3IdParam },
            { subCategory3: subCategory3IdParam }
          ]
        })
      }

      if (category && category !== 'SEMUA') {
        const cleanCat = cleanCatName(category)
        andConditions.push({
          $or: [
            { animeTitle: { $regex: cleanCat, $options: 'i' } },
            { subCategory: { $regex: cleanCat, $options: 'i' } },
            { sub_category: { $regex: cleanCat, $options: 'i' } },
            { subCategory1: { $regex: cleanCat, $options: 'i' } },
            { sub_category_1: { $regex: cleanCat, $options: 'i' } },
            { subCategory2: { $regex: cleanCat, $options: 'i' } },
            { sub_category_2: { $regex: cleanCat, $options: 'i' } },
            { subCategory3: { $regex: cleanCat, $options: 'i' } },
            { sub_category_3: { $regex: cleanCat, $options: 'i' } },
            { id: cleanCat },
            { categoryId: cleanCat },
            { category_id: cleanCat },
            { subCategoryId: cleanCat },
            { sub_category_id: cleanCat },
            { subCategory2Id: cleanCat },
            { sub_category_2_id: cleanCat },
            { subCategory3Id: cleanCat },
            { sub_category_3_id: cleanCat }
          ]
        })
      }

      if (search) {
        const regexSearch = { $regex: new RegExp(search, 'i') }
        andConditions.push({
          $or: [
            { title: regexSearch },
            { slug: regexSearch },
            { animeTitle: regexSearch },
            { episode: regexSearch },
            { id: regexSearch },
            { subCategory: regexSearch },
            { subCategory2: regexSearch }
          ]
        })
      }

      if (andConditions.length > 0) {
        query.$and = andConditions
      }

      if (!showAll) {
        const now = new Date()
        const nowStr = now.toISOString()
        const publicFilter = {
          $or: [
            { status: { $exists: false } },
            { status: "published" },
            { 
              $and: [
                { status: "scheduled" },
                { 
                  $or: [
                    { scheduledAt: { $lte: nowStr } },
                    { scheduledAt: { $lte: now } }
                  ]
                }
              ]
            }
          ]
        }
        
        if (query.$or) {
          const existingOr = query.$or
          delete query.$or
          query.$and = [
            { $or: existingOr },
            publicFilter
          ]
        } else {
          query.$and = query.$and ? [...query.$and, publicFilter] : [publicFilter]
        }
      }

      const videos = await db.collection('videos').find(query).sort({ createdAt: -1 }).toArray()
      return handleCORS(NextResponse.json(videos))
    }

    if (route === '/videos' && method === 'POST') {
      const body = await request.json()
      
      const computedSlug = body.slug && body.slug.trim() !== '' 
        ? generateSlug(body.slug) 
        : generateSlug(body.title)

      let newVideo = {
        ...body,
        id: uuidv4(),
        title: body.title?.trim() || body.title,
        animeTitle: body.animeTitle?.trim() || body.animeTitle,
        episode: body.episode?.trim() || body.episode,
        description: body.description?.trim() || body.description,
        thumbnailUrl: body.thumbnailUrl?.trim() || body.thumbnailUrl,
        videoUrl: body.videoUrl?.trim() || body.videoUrl,
        videoUrl2: body.videoUrl2?.trim() || body.videoUrl2,
        videoUrl3: body.videoUrl3?.trim() || body.videoUrl3,
        slug: computedSlug,
        status: body.status || 'published',
        scheduledAt: body.scheduledAt || null,
        download_links: Array.isArray(body.download_links) ? body.download_links : [],
        views: Number(body.views || 0),
        likes: Number(body.likes || 0),
        createdAt: new Date()
      }
      
      newVideo = await resolveCategoryIdsForVideo(db, newVideo)
      await db.collection('videos').insertOne(newVideo)

      // Add to playlist if optional playlistId provided
      if (body.playlistId && typeof body.playlistId === 'string' && body.playlistId.trim() !== '') {
        const targetPlaylist = await db.collection('playlists').findOne({ id: body.playlistId.trim() })
        if (targetPlaylist) {
          const currentVideoIds = Array.isArray(targetPlaylist.videoIds) ? targetPlaylist.videoIds : []
          if (!currentVideoIds.includes(newVideo.id)) {
            await db.collection('playlists').updateOne(
              { id: targetPlaylist.id },
              { $set: { videoIds: [...currentVideoIds, newVideo.id] } }
            )
          }
        }
      }

      if (newVideo.status === 'published') {
        await sendNativeWebPushNotification(db, newVideo, request)
      }
      return handleCORS(NextResponse.json(newVideo))
    }

    if (route === '/videos/toggle-like' && method === 'POST') {
      const body = await request.json()
      const { id, action } = body
      if (!action || (action !== 'like' && action !== 'unlike')) {
        return handleCORS(NextResponse.json({ error: 'Aksi tidak valid! Harus "like" atau "unlike"' }, { status: 400 }))
      }
      const incVal = action === 'like' ? 1 : -1
      const video = await db.collection('videos').findOne({ $or: [{ id }, { slug: id }] })
      if (video) {
        const newLikes = Math.max(0, (video.likes || 0) + incVal)
        await db.collection('videos').updateOne({ id: video.id }, { $set: { likes: newLikes } })
        const updated = await db.collection('videos').findOne({ id: video.id })
        return handleCORS(NextResponse.json(updated))
      }
      return handleCORS(NextResponse.json({ error: 'Video tidak ditemukan!' }, { status: 404 }))
    }

    if (route === '/videos/increment-views' && method === 'POST') {
      const body = await request.json()
      const { id } = body
      const video = await db.collection('videos').findOne({ $or: [{ id }, { slug: id }] })
      if (video) {
        await db.collection('videos').updateOne({ id: video.id }, { $inc: { views: 1 } })
        const updated = await db.collection('videos').findOne({ id: video.id })
        return handleCORS(NextResponse.json(updated))
      }
      return handleCORS(NextResponse.json({ error: 'Video tidak ditemukan!' }, { status: 404 }))
    }

    if (route === '/videos' && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body

      const existingVideo = await db.collection('videos').findOne({ id })

      if (updateData.slug || updateData.title) {
        updateData.slug = updateData.slug && updateData.slug.trim() !== '' 
          ? generateSlug(updateData.slug) 
          : generateSlug(updateData.title)
      }

      const resolvedData = await resolveCategoryIdsForVideo(db, updateData)
      await db.collection('videos').updateOne({ id }, { $set: resolvedData })

      // Update playlist assignment if optional playlistId provided
      if (body.playlistId !== undefined) {
        const selectedPlId = typeof body.playlistId === 'string' ? body.playlistId.trim() : ''
        const allPlaylists = await db.collection('playlists').find({}).toArray()
        for (const pl of allPlaylists) {
          const vIds = Array.isArray(pl.videoIds) ? pl.videoIds : []
          if (pl.id === selectedPlId) {
            if (!vIds.includes(id)) {
              await db.collection('playlists').updateOne(
                { id: pl.id },
                { $set: { videoIds: [...vIds, id] } }
              )
            }
          } else if (vIds.includes(id)) {
            await db.collection('playlists').updateOne(
              { id: pl.id },
              { $set: { videoIds: vIds.filter(vId => vId !== id) } }
            )
          }
        }
      }

      const updated = await db.collection('videos').findOne({ id })
      
      // Kirim notifikasi VAPID hanya jika video baru dipublikasikan (sebelumnya bukan published) atau jika admin meminta secara eksplisit
      const wasNotPublished = existingVideo && existingVideo.status !== 'published'
      const isNowPublished = updated && updated.status === 'published'
      const explicitPush = Boolean(body.sendPushNotification || body.notifySubscribers)

      if ((wasNotPublished && isNowPublished) || explicitPush) {
        await sendNativeWebPushNotification(db, updated, request)
      }
      return handleCORS(NextResponse.json(updated))
    }

    if (route === '/videos/notify' && method === 'POST') {
      const body = await request.json()
      const { id } = body
      if (!id) {
        return handleCORS(NextResponse.json({ error: 'ID Video wajib diisi!' }, { status: 400 }))
      }
      const video = await db.collection('videos').findOne({ $or: [{ id }, { slug: id }] })
      if (!video) {
        return handleCORS(NextResponse.json({ error: 'Video tidak ditemukan!' }, { status: 404 }))
      }
      const result = await sendNativeWebPushNotification(db, video, request)
      return handleCORS(NextResponse.json({ success: true, message: 'Notifikasi VAPID berhasil dikirim!', ...result }))
    }

    if (route === '/videos' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')

      const video = await db.collection('videos').findOne({ id })
      if (video && video.thumbnailUrl) {
        const settings = await db.collection('settings').findOne({ id: 'site_settings' })
        const ikPrivateKey = (process.env.IMAGEKIT_PRIVATE_KEY || settings?.imagekitPrivateKey || '').trim()
        if (ikPrivateKey) {
          await deleteImageKitFileByUrl(video.thumbnailUrl, ikPrivateKey)
        }
      }

      await db.collection('videos').deleteOne({ id })

      // Remove deleted video id from all playlists
      if (id) {
        const allPlaylists = await db.collection('playlists').find({}).toArray()
        for (const pl of allPlaylists) {
          const vIds = Array.isArray(pl.videoIds) ? pl.videoIds : []
          if (vIds.includes(id)) {
            await db.collection('playlists').updateOne(
              { id: pl.id },
              { $set: { videoIds: vIds.filter(vId => vId !== id) } }
            )
          }
        }
      }

      return handleCORS(NextResponse.json({ success: true }))
    }

    if (route === '/videos/bulk-csv' && method === 'POST') {
      const body = await request.json()
      const { csvData } = body
      if (!csvData) {
        return handleCORS(NextResponse.json({ error: 'Data CSV kosong!' }, { status: 400 }))
      }

      const lines = csvData.split('\n')
      const imported = []
      for (const line of lines) {
        if (!line.trim()) continue
        const parts = line.split(',')
        if (parts.length < 5) continue

        const [title, animeTitle, episode, thumbnailUrl, videoUrl, ...descParts] = parts
        const description = descParts.join(',') || ''

        const cleanTitle = title.trim()
        let newVideo = {
          id: uuidv4(),
          title: cleanTitle,
          slug: generateSlug(cleanTitle),
          animeTitle: animeTitle.trim(),
          episode: episode.trim(),
          thumbnailUrl: thumbnailUrl.trim(),
          videoUrl: videoUrl.trim(),
          description: description.trim(),
          download_links: [],
          views: 0,
          likes: 0,
          createdAt: new Date()
        }
        newVideo = await resolveCategoryIdsForVideo(db, newVideo)
        await db.collection('videos').insertOne(newVideo)
        imported.push(newVideo)
      }

      return handleCORS(NextResponse.json({ success: true, count: imported.length, imported }))
    }

    if ((route === '/videos/bulk-categories' || route === '/videos/bulk-edit-categories') && (method === 'PUT' || method === 'POST')) {
      const body = await request.json().catch(() => ({}));
      const { videoIds, animeTitle, subCategory, subCategory2, subCategory3, categoryId, subCategory1Id, subCategory2Id, subCategory3Id } = body;

      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return handleCORS(NextResponse.json({ error: 'Daftar ID video (videoIds) tidak boleh kosong!' }, { status: 400 }));
      }

      if (!animeTitle && !categoryId) {
        return handleCORS(NextResponse.json({ error: 'Kategori utama wajib dipilih!' }, { status: 400 }));
      }

      // Resolve category hierarchy via database
      const dummyVideo = {
        animeTitle: animeTitle || '',
        categoryId: categoryId || '',
        subCategory: subCategory || '',
        subCategory1Id: subCategory1Id || '',
        subCategory2: subCategory2 || '',
        subCategory2Id: subCategory2Id || '',
        subCategory3: subCategory3 || '',
        subCategory3Id: subCategory3Id || ''
      };

      const resolved = await resolveCategoryIdsForVideo(db, dummyVideo);

      const updatePayload = {
        category_id: resolved.category_id || null,
        categoryId: resolved.categoryId || null,
        animeTitle: resolved.animeTitle || '',
        mainCategory: resolved.mainCategory || null,
        sub_category_1_id: resolved.sub_category_1_id || null,
        sub_category_id: resolved.sub_category_id || null,
        subCategory1Id: resolved.subCategory1Id || null,
        subCategoryId: resolved.subCategoryId || null,
        subCategory: resolved.subCategory || '',
        subCategory1: resolved.subCategory1 || null,
        sub_category_2_id: resolved.sub_category_2_id || null,
        subCategory2Id: resolved.subCategory2Id || null,
        subCategory2: resolved.subCategory2 || '',
        subCategory2Obj: resolved.subCategory2Obj || null,
        sub_category_3_id: resolved.sub_category_3_id || null,
        subCategory3Id: resolved.subCategory3Id || null,
        subCategory3: resolved.subCategory3 || '',
        subCategory3Obj: resolved.subCategory3Obj || null,
        updatedAt: new Date().toISOString()
      };

      // Perform atomic batch update
      await db.collection('videos').updateMany(
        { id: { $in: videoIds } },
        { $set: updatePayload }
      );

      // Invalidate Cloudflare CDN Cache for public listings
      purgeCloudflareCache(['/api/videos', '/api/categories', '/', '/tv', '/putar-manual']).catch(() => {});

      return handleCORS(NextResponse.json({
        success: true,
        count: videoIds.length,
        message: `${videoIds.length} video berhasil diperbarui kategorinya.`,
        updatedFields: updatePayload
      }));
    }

    // 4. CATEGORIES ROUTES
    if (route === '/categories' && method === 'GET') {
      const categories = await db.collection('categories').find({}).toArray()
      return handleCORS(NextResponse.json(categories))
    }

    if (route === '/categories' && method === 'POST') {
      const body = await request.json()
      const newCategory = {
        name: body.name ? body.name.trim() : '',
        parent_id: body.parent_id === 'none' || !body.parent_id ? null : String(body.parent_id),
        id: uuidv4(),
        createdAt: new Date()
      }
      await db.collection('categories').insertOne(newCategory)
      return handleCORS(NextResponse.json(newCategory))
    }

    if (route === '/categories' && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body
      if (updateData.parent_id === 'none' || !updateData.parent_id) {
        updateData.parent_id = null
      } else {
        updateData.parent_id = String(updateData.parent_id)
      }
      if (updateData.name) {
        updateData.name = updateData.name.trim()
      }
      await db.collection('categories').updateOne({ id }, { $set: updateData })
      const updated = await db.collection('categories').findOne({ id })
      return handleCORS(NextResponse.json(updated))
    }

    if (route === '/categories' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      if (id) {
        await db.collection('categories').deleteOne({ id })
        // Hapus atau reset relasi anak (Sub-Kategori 1 / Sub-Kategori 2) yang menggunakan ID ini sebagai parent
        await db.collection('categories').updateMany({ parent_id: String(id) }, { $set: { parent_id: null } })
      }
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 5. USERS MANAGEMENT ROUTES
    if (route === '/users' && method === 'GET') {
      const url = new URL(request.url)
      const search = url.searchParams.get('search') || ''
      const query = {}
      if (search) {
        query.$or = [
          { name: { $regex: new RegExp(search, 'i') } },
          { email: { $regex: new RegExp(search, 'i') } }
        ]
      }
      const users = await db.collection('users').find(query).toArray()
      const safeUsers = users.map(({ password, ...rest }) => rest)
      return handleCORS(NextResponse.json(safeUsers))
    }

    if (route === '/users' && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body
      await db.collection('users').updateOne({ id }, { $set: updateData })
      const updated = await db.collection('users').findOne({ id })
      return handleCORS(NextResponse.json(updated))
    }

    if (route === '/users' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      await db.collection('users').deleteOne({ id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 6. PLAYLISTS ROUTES
    if (route === '/playlists' && method === 'GET') {
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      const search = url.searchParams.get('search') || ''

      const query = {
        $or: [
          { ownerId: null },
          ...(userId ? [{ ownerId: userId }] : [])
        ]
      }

      if (search) {
        query.title = { $regex: new RegExp(search, 'i') }
      }

      const playlists = await db.collection('playlists').find(query).toArray()
      return handleCORS(NextResponse.json(playlists))
    }

    if (route === '/playlists' && method === 'POST') {
      const body = await request.json()
      const newPlaylist = {
        id: uuidv4(),
        title: body.title,
        ownerId: body.ownerId || null,
        videoIds: body.videoIds || [],
        isPrivate: body.isPrivate === undefined ? true : body.isPrivate,
        createdAt: new Date()
      }
      await db.collection('playlists').insertOne(newPlaylist)
      return handleCORS(NextResponse.json(newPlaylist))
    }

    if (route === '/playlists' && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body
      await db.collection('playlists').updateOne({ id }, { $set: updateData })
      const updated = await db.collection('playlists').findOne({ id })
      return handleCORS(NextResponse.json(updated))
    }

    if (route === '/playlists' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      await db.collection('playlists').deleteOne({ id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 7. COMMENTS & NOTIFICATIONS ROUTES
    if (route === '/comments' && method === 'GET') {
      const url = new URL(request.url)
      const videoId = url.searchParams.get('videoId')
      const search = url.searchParams.get('search') || ''
      const filterEpisode = url.searchParams.get('filterEpisode') || ''

      const query = {}
      if (videoId) {
        const video = await db.collection('videos').findOne({ $or: [{ id: videoId }, { slug: videoId }] })
        if (video) {
          query.videoId = video.id
        } else {
          query.videoId = videoId
        }
      }
      if (search) {
        query.content = { $regex: new RegExp(search, 'i') }
      }

      let comments = await db.collection('comments').find(query).toArray()

      if (filterEpisode && filterEpisode !== 'ALL') {
        comments = comments.filter(c => c.videoId === filterEpisode)
      }

      return handleCORS(NextResponse.json(comments))
    }

    if (route === '/comments' && method === 'POST') {
      const body = await request.json()
      const newComment = {
        id: uuidv4(),
        videoId: body.videoId,
        userId: String(body.userId || body._id || ''),
        userEmail: body.userEmail || '',
        userRole: body.userRole || 'user',
        userName: body.userName || 'Pengguna',
        userAvatar: body.userAvatar || 'https://ik.imagekit.io/shindoranesub/c11d825a820d5a3fc725c0c02fb1d637.jpg',
        content: body.content,
        parentId: body.parentId || null,
        createdAt: new Date()
      }
      await db.collection('comments').insertOne(newComment)

      if (body.parentId) {
        const parentComment = await db.collection('comments').findOne({ id: body.parentId })
        if (parentComment) {
          const isSameUser = (
            (parentComment.userId && String(parentComment.userId) === String(body.userId)) ||
            (parentComment.userEmail && body.userEmail && parentComment.userEmail === body.userEmail) ||
            (parentComment.userName && parentComment.userName === body.userName && !body.userId)
          )

          if (!isSameUser) {
            const parentUser = await db.collection('users').findOne({
              $or: [
                { id: parentComment.userId },
                { _id: parentComment.userId },
                ...(parentComment.userEmail ? [{ email: parentComment.userEmail }] : []),
                { name: parentComment.userName }
              ]
            })

            const video = await db.collection('videos').findOne({ $or: [{ id: body.videoId }, { slug: body.videoId }] })

            const targetUserId = parentUser?.id || parentComment.userId || 'unknown-user'
            const targetUser_id = parentUser?._id ? String(parentUser._id) : null
            const targetEmail = parentUser?.email || parentComment.userEmail || null
            const targetRole = parentUser?.role || parentComment.userRole || 'user'

            const targetIds = [
              targetUserId,
              targetUser_id,
              targetEmail,
              parentComment.userId,
              parentComment.userName
            ].filter(Boolean)

            const notification = {
              id: uuidv4(),
              userId: targetUserId,
              targetUserId,
              targetUser_id,
              userEmail: targetEmail,
              userRole: targetRole,
              targetUserIds: Array.from(new Set(targetIds)),
              senderName: body.userName || 'Pengguna',
              senderAvatar: body.userAvatar || '',
              senderRole: body.userRole || 'user',
              contentSnippet: body.content.length > 60 ? body.content.substring(0, 60) + '...' : body.content,
              parentContentSnippet: parentComment.content ? (parentComment.content.length > 50 ? parentComment.content.substring(0, 50) + '...' : parentComment.content) : '',
              animeTitle: video ? (video.animeTitle || video.title) : 'Anime',
              episodeTitle: video ? (video.episode || video.title) : 'Episode',
              videoId: body.videoId,
              videoSlug: video?.slug || body.videoId,
              isRead: false,
              createdAt: new Date()
            }
            await db.collection('notifications').insertOne(notification)
          }
        }
      }

      return handleCORS(NextResponse.json(newComment))
    }

    if (route === '/comments' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')

      if (!id) {
        return handleCORS(NextResponse.json({ error: 'Comment ID is required' }, { status: 400 }))
      }

      const allComments = await db.collection('comments').find({}).toArray()
      
      const idsToDelete = [id]
      const getChildrenIds = (parentId) => {
        allComments.forEach(c => {
          if (c.parentId === parentId) {
            idsToDelete.push(c.id)
            getChildrenIds(c.id)
          }
        })
      }
      
      getChildrenIds(id)

      await db.collection('comments').deleteMany({ id: { $in: idsToDelete } })
      return handleCORS(NextResponse.json({ success: true, deletedCount: idsToDelete.length }))
    }

    if (route === '/notifications' && method === 'GET') {
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      if (!userId) {
        return handleCORS(NextResponse.json([]))
      }

      const user = await db.collection('users').findOne({
        $or: [
          { id: userId },
          { _id: userId },
          { email: userId },
          { name: userId }
        ]
      })

      const idList = [userId]
      if (user) {
        if (user.id) idList.push(user.id)
        if (user._id) idList.push(String(user._id))
        if (user.email) idList.push(user.email)
        if (user.name) idList.push(user.name)
      }

      const query = {
        $or: [
          { userId: { $in: idList } },
          { targetUserId: { $in: idList } },
          { targetUser_id: { $in: idList } },
          { userEmail: { $in: idList } },
          { targetUserIds: { $in: idList } }
        ]
      }

      const notifications = await db.collection('notifications')
        .find(query)
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray()

      return handleCORS(NextResponse.json(notifications))
    }

    if (route === '/notifications' && method === 'PUT') {
      const body = await request.json()
      const { id, userId, markAll } = body

      if (markAll && userId) {
        const user = await db.collection('users').findOne({
          $or: [{ id: userId }, { _id: userId }, { email: userId }]
        })
        const idList = [userId]
        if (user) {
          if (user.id) idList.push(user.id)
          if (user._id) idList.push(String(user._id))
          if (user.email) idList.push(user.email)
        }

        await db.collection('notifications').updateMany(
          {
            $or: [
              { userId: { $in: idList } },
              { targetUserId: { $in: idList } },
              { targetUser_id: { $in: idList } },
              { userEmail: { $in: idList } },
              { targetUserIds: { $in: idList } }
            ]
          },
          { $set: { isRead: true } }
        )
        return handleCORS(NextResponse.json({ success: true }))
      }

      if (id) {
        await db.collection('notifications').updateOne({ id }, { $set: { isRead: true } })
        return handleCORS(NextResponse.json({ success: true }))
      }

      return handleCORS(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }))
    }

    if (route === '/notifications' && method === 'DELETE') {
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      if (!userId) {
        return handleCORS(NextResponse.json({ error: 'User ID required' }, { status: 400 }))
      }

      const user = await db.collection('users').findOne({
        $or: [{ id: userId }, { _id: userId }, { email: userId }]
      })
      const idList = [userId]
      if (user) {
        if (user.id) idList.push(user.id)
        if (user._id) idList.push(String(user._id))
        if (user.email) idList.push(user.email)
      }

      await db.collection('notifications').deleteMany({
        $or: [
          { userId: { $in: idList } },
          { targetUserId: { $in: idList } },
          { targetUser_id: { $in: idList } },
          { userEmail: { $in: idList } },
          { targetUserIds: { $in: idList } }
        ]
      })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 7.5 WEB PUSH SUBSCRIPTION ROUTES
    if (route === '/push/subscribe' && method === 'POST') {
      const body = await request.json()
      const endpoint = body.endpoint
      const p256dh = body.p256dh || body.keys?.p256dh
      const auth = body.auth || body.keys?.auth
      const userId = body.userId || null

      if (!endpoint || !p256dh || !auth) {
        return handleCORS(NextResponse.json({ error: 'Endpoint, p256dh, dan auth wajib diisi!' }, { status: 400 }))
      }

      const now = new Date().toISOString()
      const existing = await db.collection('push_subscriptions').findOne({ endpoint })

      if (existing) {
        await db.collection('push_subscriptions').updateOne(
          { endpoint },
          {
            $set: {
              p256dh,
              auth,
              userId: userId || existing.userId || null,
              updatedAt: now
            }
          }
        )
        const updated = await db.collection('push_subscriptions').findOne({ endpoint })
        return handleCORS(NextResponse.json({ success: true, message: 'Subscription diperbarui', subscription: updated }))
      } else {
        const newSub = {
          id: uuidv4(),
          endpoint,
          p256dh,
          auth,
          userId: userId || null,
          createdAt: now,
          updatedAt: now
        }
        await db.collection('push_subscriptions').insertOne(newSub)
        return handleCORS(NextResponse.json({ success: true, message: 'Subscription berhasil disimpan', subscription: newSub }, { status: 201 }))
      }
    }

    if (route === '/push/unsubscribe' && method === 'POST') {
      const body = await request.json()
      const { endpoint } = body
      if (!endpoint) {
        return handleCORS(NextResponse.json({ error: 'Endpoint wajib diisi!' }, { status: 400 }))
      }
      await db.collection('push_subscriptions').deleteOne({ endpoint })
      return handleCORS(NextResponse.json({ success: true, message: 'Subscription berhasil dihapus' }))
    }

    if (route === '/push/status' && method === 'GET') {
      const count = (await db.collection('push_subscriptions').find({}).toArray()).length
      const { publicKey } = getVapidConfig()
      const settings = await db.collection('settings').findOne({ id: 'site_settings' })
      return handleCORS(NextResponse.json({
        subscribersCount: count,
        vapidConfigured: Boolean(publicKey),
        webPushEnabled: settings?.webPushEnabled !== false
      }))
    }

    if (route === '/push/test' && method === 'POST') {
      try {
        const { publicKey, privateKey, subject } = getVapidConfig()

        if (!publicKey || !privateKey) {
          return handleCORS(
            NextResponse.json(
              {
                success: false,
                error: 'Kunci VAPID belum dikonfigurasi di environment!'
              },
              { status: 400 }
            )
          )
        }

        webPush.setVapidDetails(
          subject,
          publicKey,
          privateKey
        )

        const testPayload = JSON.stringify({
          title: 'Episode Baru: Doraemon Retro 🎬',
          body: 'Tonton Petualangan Nobita dan Doraemon (Eps 100) sekarang!',
          url: '/watch/shindora-push',
          icon: '/apple-icon.png',
          badge: '/favicon.ico',
          image: 'https://ik.imagekit.io/shindoranesub/bell-7-removebg-preview.png',
          tag: `test-push-${Date.now()}`,
          renotify: true
        })

        const subscribers = await db
          .collection('push_subscriptions')
          .find({})
          .toArray()

        console.log(
          `[WebPush Test] Total subscribers: ${subscribers.length}`
        )

        if (subscribers.length === 0) {
          return handleCORS(
            NextResponse.json(
              {
                success: false,
                error: 'Belum ada subscriber Web Push di database.',
                sentCount: 0,
                totalSubscribers: 0
              },
              { status: 400 }
            )
          )
        }

        let sentCount = 0
        const failed = []
        const deadEndpoints = []

        await Promise.all(
          subscribers.map(async (sub) => {
            try {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              }

              console.log(
                '[WebPush Test] Sending to:',
                sub.endpoint
              )

              await webPush.sendNotification(
                pushSubscription,
                testPayload
              )

              sentCount += 1

              console.log(
                '[WebPush Test] SUCCESS:',
                sub.endpoint
              )
            } catch (err) {
              const status =
                err?.statusCode ||
                err?.status ||
                null

              const message =
                err?.body ||
                err?.message ||
                String(err)

              console.error(
                '[WebPush Test] FAILED:',
                {
                  endpoint: sub.endpoint,
                  status,
                  message
                }
              )

              if (status === 404 || status === 410) {
                deadEndpoints.push(sub.endpoint)
              }

              failed.push({
                endpoint: sub.endpoint,
                status,
                message
              })
            }
          })
        )

        if (deadEndpoints.length > 0) {
          for (const endpoint of deadEndpoints) {
            try {
              await db
                .collection('push_subscriptions')
                .deleteOne({ endpoint })
            } catch (deleteError) {
              console.error(
                '[WebPush Test] Failed deleting dead subscription:',
                deleteError
              )
            }
          }
        }

        if (sentCount === 0) {
          return handleCORS(
            NextResponse.json(
              {
                success: false,
                error: 'Tidak ada subscriber yang berhasil menerima push.',
                sentCount,
                totalSubscribers: subscribers.length,
                failed,
                failedCount: failed.length,
                removedDeadSubscriptions: deadEndpoints.length
              },
              { status: 200 }
            )
          )
        }

        return handleCORS(
          NextResponse.json({
            success: true,
            message: 'Web Push berhasil dikirim.',
            sentCount,
            totalSubscribers: subscribers.length,
            failedCount: failed.length,
            failed,
            removedDeadSubscriptions: deadEndpoints.length
          })
        )
      } catch (error) {
        console.error(
          '[WebPush Test Fatal Error]:',
          error
        )

        return handleCORS(
          NextResponse.json(
            {
              success: false,
              error: error?.message || 'Gagal mengirim test Web Push.'
            },
            { status: 500 }
          )
        )
      }
    }

    // 8. ADS ROUTES
    if ((route === '/ads' || route === '/promo' || route === '/promotions') && method === 'GET') {
      const ads = await db.collection('ads').find({}).toArray()
      return handleCORS(NextResponse.json(ads))
    }

    if ((route === '/ads' || route === '/promo' || route === '/promotions') && method === 'POST') {
      const body = await request.json()
      const rawCodeVal = String(body.rawCode || body.html || body.content || body.script || body.code || '').trim()
      const isRawVal = Boolean(body.isRaw || (rawCodeVal && rawCodeVal.length > 0))
      
      const newAd = {
        ...body,
        id: uuidv4(),
        isRaw: isRawVal,
        rawCode: rawCodeVal,
        html: rawCodeVal,
        content: rawCodeVal,
        isActive: body.isActive === undefined ? true : body.isActive
      }
      await db.collection('ads').insertOne(newAd)
      return handleCORS(NextResponse.json(newAd))
    }

    if ((route === '/ads' || route === '/promo' || route === '/promotions') && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body
      if (updateData.rawCode !== undefined || updateData.html !== undefined || updateData.content !== undefined) {
        const rawCodeVal = String(updateData.rawCode || updateData.html || updateData.content || updateData.script || updateData.code || '').trim()
        updateData.rawCode = rawCodeVal
        updateData.html = rawCodeVal
        updateData.content = rawCodeVal
        if (updateData.isRaw === undefined) {
          updateData.isRaw = Boolean(rawCodeVal && rawCodeVal.length > 0)
        }
      }
      await db.collection('ads').updateOne({ id }, { $set: updateData })
      const updated = await db.collection('ads').findOne({ id })
      return handleCORS(NextResponse.json(updated))
    }

    if ((route === '/ads' || route === '/promo' || route === '/promotions') && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      await db.collection('ads').deleteOne({ id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 9. PAGES ROUTES
    if (route === '/pages' && method === 'GET') {
      const pages = await db.collection('pages').find({}).toArray()
      return handleCORS(NextResponse.json(pages))
    }

    if (route === '/pages' && method === 'POST') {
      const body = await request.json()
      const newPage = {
        ...body,
        id: uuidv4(),
        createdAt: new Date()
      }
      await db.collection('pages').insertOne(newPage)
      return handleCORS(NextResponse.json(newPage))
    }

    if (route === '/pages' && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body
      await db.collection('pages').updateOne({ id }, { $set: updateData })
      const updated = await db.collection('pages').findOne({ id })
      return handleCORS(NextResponse.json(updated))
    }

    if (route === '/pages' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      await db.collection('pages').deleteOne({ id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 10. DONATIONS & WEBHOOKS ROUTES
    if (route === '/donations' && method === 'GET') {
      const donations = await db.collection('donations').find({}).sort({ createdAt: -1 }).toArray()
      return handleCORS(NextResponse.json(donations))
    }

    if (route === '/donations' && method === 'POST') {
      const body = await request.json()
      const newDonation = {
        id: uuidv4(),
        name: body.name || body.donatorName || 'Donatur',
        amount: body.amount || 'Rp 0',
        message: body.message || '',
        platform: body.platform || 'Saweria',
        createdAt: new Date()
      }
      await db.collection('donations').insertOne(newDonation)
      return handleCORS(NextResponse.json(newDonation))
    }

    if (route === '/donations' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      await db.collection('donations').deleteOne({ id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    if (route === '/webhooks/poll' && method === 'GET') {
      const latestDonations = await db.collection('donations').find({}).sort({ createdAt: -1 }).limit(5).toArray()
      return handleCORS(NextResponse.json(latestDonations))
    }

    if (route === '/webhooks/saweria' && method === 'POST') {
      const body = await request.json()
      const rawAmount = body.amount || 0
      const amountStr = typeof rawAmount === 'number'
        ? `Rp ${rawAmount.toLocaleString('id-ID')}`
        : rawAmount
      
      const newDonation = {
        id: uuidv4(),
        name: body.donator_name || body.name || 'Donatur Saweria',
        amount: amountStr,
        message: body.message || '',
        platform: 'Saweria',
        createdAt: new Date()
      }
      await db.collection('donations').insertOne(newDonation)
      return handleCORS(NextResponse.json({ success: true, donation: newDonation }))
    }

    if (route === '/webhooks/trakteer' && method === 'POST') {
      const body = await request.json()
      const rawAmount = body.amount || 0
      const amountStr = typeof rawAmount === 'number'
        ? `Rp ${rawAmount.toLocaleString('id-ID')}`
        : rawAmount

      const newDonation = {
        id: uuidv4(),
        name: body.donator_name || body.name || 'Donatur Trakteer',
        amount: amountStr,
        message: body.message || '',
        platform: 'Trakteer',
        createdAt: new Date()
      }
      await db.collection('donations').insertOne(newDonation)
      return handleCORS(NextResponse.json({ success: true, donation: newDonation }))
    }

    if (route === '/webhooks/tako' && method === 'POST') {
      const body = await request.json()
      const rawAmount = body.amount || 0
      const amountStr = typeof rawAmount === 'number'
        ? `Rp ${rawAmount.toLocaleString('id-ID')}`
        : rawAmount

      const newDonation = {
        id: uuidv4(),
        name: body.donator_name || body.name || 'Donatur Tako.id',
        amount: amountStr,
        message: body.message || '',
        platform: 'Tako.id',
        createdAt: new Date()
      }
      await db.collection('donations').insertOne(newDonation)
      return handleCORS(NextResponse.json({ success: true, donation: newDonation }))
    }

    // 11. POLLING & VOTING ROUTES
    if (route === '/polling' && method === 'GET') {
      const polling = await db.collection('polling').find({}).toArray()
      return handleCORS(NextResponse.json(polling))
    }

    if (route === '/polling' && method === 'POST') {
      const body = await request.json()
      const newPoll = {
        id: uuidv4(),
        title: body.title || 'Vote Terbaru',
        options: body.options || [],
        ownerId: body.ownerId || null,
        isActive: body.isActive === undefined ? true : body.isActive,
        createdAt: new Date()
      }
      await db.collection('polling').insertOne(newPoll)
      return handleCORS(NextResponse.json(newPoll))
    }

    if (route === '/polling/vote' && method === 'POST') {
      const body = await request.json()
      const { pollId, optionId, userId } = body

      if (!pollId || !optionId) {
        return handleCORS(NextResponse.json({ error: 'Poll ID dan Option ID wajib dikirim!' }, { status: 400 }))
      }

      if (userId) {
        const existingVote = await db.collection('user_votes').findOne({ pollId, userId })
        if (existingVote) {
          return handleCORS(NextResponse.json({ error: 'Anda sudah memberikan suara untuk polling ini!' }, { status: 400 }))
        }
      }

      const poll = await db.collection('polling').findOne({ id: pollId })
      if (!poll) {
        return handleCORS(NextResponse.json({ error: 'Polling tidak ditemukan' }, { status: 404 }))
      }

      const updatedOptions = poll.options.map(opt => {
        if (opt.id === optionId) {
          return { ...opt, votes: (opt.votes || 0) + 1 }
        }
        return opt
      })

      if (userId) {
        await db.collection('user_votes').insertOne({
          id: uuidv4(),
          pollId,
          userId,
          optionId,
          createdAt: new Date()
        })
      }

      await db.collection('polling').updateOne({ id: pollId }, { $set: { options: updatedOptions } })
      const updatedPoll = await db.collection('polling').findOne({ id: pollId })
      return handleCORS(NextResponse.json(updatedPoll))
    }

    if (route === '/polling' && method === 'PUT') {
      const body = await request.json()
      const { id, _id, ...updateData } = body
      await db.collection('polling').updateOne({ id }, { $set: updateData })
      const updated = await db.collection('polling').findOne({ id })
      return handleCORS(NextResponse.json(updated))
    }

    if (route === '/polling' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      await db.collection('polling').deleteOne({ id })
      return handleCORS(NextResponse.json({ success: true }))
    }

    // 12. GLOBAL PUBLIC CHAT ROUTES
    if (route === '/chat' && method === 'GET') {
      const messages = await db.collection('global_chat')
        .find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray()
      
      return handleCORS(NextResponse.json(messages.reverse()))
    }

    if (route === '/chat' && method === 'POST') {
      const body = await request.json()
      const { userName, userAvatar, content } = body

      if (!content || !content.trim()) {
        return handleCORS(NextResponse.json({ error: 'Konten pesan wajib diisi!' }, { status: 400 }))
      }

      const settingsObj = await db.collection('settings').findOne({ id: 'site_settings' })
      const blockedWordsStr = settingsObj?.blocked_words || settingsObj?.blockedWords || "anjing, babi, bangsat, anjrit, fuck, shit, kontol, memek, asu, bajingan"
      
      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      const censorText = (text, listStr) => {
        if (!text) return ''
        const words = listStr.split(',').map(w => w.trim()).filter(Boolean)
        let censored = text
        words.forEach(word => {
          const escaped = escapeRegExp(word)
          const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gi')
          censored = censored.replace(regex, '*'.repeat(word.length))
        })
        return censored
      }

      const cleanContent = censorText(content, blockedWordsStr)

      const newMsg = {
        id: uuidv4(),
        userName: userName || 'Pengguna',
        userAvatar: userAvatar || 'https://ik.imagekit.io/shindoranesub/c11d825a820d5a3fc725c0c02fb1d637.jpg',
        content: cleanContent.trim(),
        createdAt: new Date()
      }

      await db.collection('global_chat').insertOne(newMsg)
      return handleCORS(NextResponse.json(newMsg))
    }

    // 13. EMOTES (Disabled & Cleaned)
    if (route === "/emotes" && method === "GET") {
      return handleCORS(NextResponse.json([]))
    }

    // 14. CLOUDFLARE WORKER & CDN MANAGEMENT
    if (route === '/cdn/test' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const targetCdn = body.cdnDomain || body.cdnUrl;
        const originUrl = body.originUrl;

        if (!targetCdn || !targetCdn.trim()) {
          return handleCORS(NextResponse.json({
            success: false,
            error: 'Domain CDN / URL Worker belum diisi!'
          }, { status: 400 }));
        }

        let formattedUrl = targetCdn.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = 'https://' + formattedUrl;
        }

        // Loop detection check
        if (originUrl && typeof originUrl === 'string' && originUrl.trim() !== '') {
          try {
            const cdnHost = new URL(formattedUrl).hostname.toLowerCase();
            const originHost = new URL(originUrl.startsWith('http') ? originUrl.trim() : `https://${originUrl.trim()}`).hostname.toLowerCase();
            if (cdnHost === originHost && cdnHost !== 'localhost' && cdnHost !== '127.0.0.1') {
              return handleCORS(NextResponse.json({
                success: false,
                isLoop: true,
                error: 'ERROR LOOP: Domain CDN terdeteksi sama dengan Origin URL (Vercel Backend)! Konfigurasi ini akan menyebabkan Redirect / Proxy Loop. Gunakan domain Vercel asli sebagai ORIGIN URL (contoh: https://project.vercel.app).'
              }, { status: 400 }));
            }
          } catch(e) {}
        }

        // Test connectivity to the Worker health check or root
        const start = Date.now();
        let isConnected = false;
        let isWorkerActive = false;
        let statusMsg = '';
        let latency = 0;

        try {
          const testUrl = new URL('/api/cdn/worker-health?pingOrigin=1', formattedUrl).toString();
          const testRes = await fetch(testUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'ShinDora-CDN-Tester/1.0' },
            signal: AbortSignal.timeout(5000)
          });

          latency = Date.now() - start;
          const workerHeader = testRes.headers.get('x-shindora-worker');
          const cacheHeader = testRes.headers.get('x-shindora-cdn') || testRes.headers.get('x-shindora-cache') || testRes.headers.get('cf-cache-status');

          let workerData = {};
          try {
            workerData = await testRes.json();
          } catch(e) {}

          if (testRes.ok) {
            isConnected = true;
            isWorkerActive = workerHeader === 'active' || workerData.worker === 'shindora-cdn-worker' || testRes.headers.has('cf-ray') || Boolean(workerHeader);
            if (isWorkerActive) {
              if (workerData.originStatus === 'connected') {
                statusMsg = `SUCCESS: CDN Worker aktif dan origin Vercel (${latency}ms) dapat dijangkau.`;
              } else {
                statusMsg = `SUCCESS: CDN Worker aktif (${latency}ms).`;
              }
            } else {
              statusMsg = `SUCCESS: Domain dapat dijangkau (${latency}ms).`;
            }
          } else {
            isConnected = true;
            statusMsg = `Domain dapat dijangkau (Status: ${testRes.status})`;
          }

          return handleCORS(NextResponse.json({
            success: true,
            connected: isConnected,
            workerActive: isWorkerActive,
            latency: latency,
            latencyMs: latency,
            status: statusMsg,
            message: statusMsg,
            cdnDomain: formattedUrl
          }));
        } catch (fetchErr) {
          latency = Date.now() - start;
          return handleCORS(NextResponse.json({
            success: false,
            connected: false,
            error: `ERROR: CDN Worker (${formattedUrl}) tidak dapat menjangkau origin / timeout: ${fetchErr.message || 'Koneksi gagal'}`,
            latencyMs: latency
          }, { status: 502 }));
        }
      } catch (err) {
        return handleCORS(NextResponse.json({
          success: false,
          error: err.message
        }, { status: 500 }));
      }
    }

    if (route === '/cdn/status' && method === 'GET') {
      const settings = await db.collection('settings').findOne({ id: 'site_settings' });
      return handleCORS(NextResponse.json({
        cdnDomain: settings?.cdnDomain || '',
        originUrl: settings?.originUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://shindoranesub.my.id',
        cdnEnabled: settings?.cdnEnabled !== undefined ? settings.cdnEnabled : false,
        vercelCpuSaverMode: settings?.vercelCpuSaverMode || 'max',
        bypassMiddlewareRateLimit: settings?.bypassMiddlewareRateLimit !== undefined ? settings.bypassMiddlewareRateLimit : true,
        workerScript: 'cloudflare-worker.js',
        edgeCpuSaving: 'active (99% saved)'
      }));
    }

    if (route === '/cdn/purge' && method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const purgeType = body.purgeType || 'everything';
        const settings = await db.collection('settings').findOne({ id: 'site_settings' });
        
        const zoneId = (process.env.CLOUDFLARE_ZONE_ID || settings?.cloudflareZoneId || '').trim();
        const apiToken = (process.env.CLOUDFLARE_API_TOKEN || settings?.cloudflareApiToken || '').trim();

        if (zoneId && apiToken) {
          try {
            const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(purgeType === 'everything' ? { purge_everything: true } : { files: body.files || [] })
            });
            const cfData = await cfRes.json();
            if (cfData.success) {
              return handleCORS(NextResponse.json({
                success: true,
                message: 'Cache Cloudflare CDN berhasil di-purge secara global via API Cloudflare!',
                data: cfData
              }));
            }
          } catch (cfErr) {
            console.error('Cloudflare Purge API Error:', cfErr);
          }
        }

        return handleCORS(NextResponse.json({
          success: true,
          message: 'Instruksi Purge Cache dikirim. Edge cache Cloudflare akan diperbarui secara otomatis sesuai kebijakan Stale-While-Revalidate.',
          manualPurgeUrl: 'https://dash.cloudflare.com/'
        }));
      } catch (err) {
        return handleCORS(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
      }
    }

    if (route === '/cdn/worker-script' && method === 'GET') {
      const settings = await db.collection('settings').findOne({ id: 'site_settings' });
      const originUrl = settings?.originUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://shindoranesub.my.id';
      
      const scriptContent = `/**
 * ShinDora Nesub - Cloudflare Worker Reverse Proxy & CDN Cache Layer
 * ORIGIN_URL Configured: ${originUrl}
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originUrlString = env.ORIGIN_URL || '${originUrl}';
    const origin = new URL(originUrlString);

    const path = url.pathname;
    const method = request.method.toUpperCase();

    const isMutation = method !== 'GET' && method !== 'HEAD';
    const isAuthHeaderPresent = request.headers.has('Authorization') || request.headers.has('x-user-id');
    const isCookiePresent = request.headers.has('Cookie') && (
      request.headers.get('Cookie').includes('token') ||
      request.headers.get('Cookie').includes('session') ||
      request.headers.get('Cookie').includes('auth')
    );

    const isBypassPath = (
      path.startsWith('/admin') ||
      path.startsWith('/login') ||
      path.startsWith('/moderator') ||
      path.startsWith('/api/auth') ||
      path.startsWith('/api/push') ||
      path.startsWith('/api/chat') ||
      path.startsWith('/api/settings') ||
      path.startsWith('/api/webhooks') ||
      path.startsWith('/api/user') ||
      path.startsWith('/socket') ||
      path.startsWith('/ws')
    );

    const isPurgeRequest = request.headers.get('x-purge-cache') === 'true' || url.searchParams.get('purge') === '1';
    const shouldBypassCache = isMutation || isAuthHeaderPresent || isCookiePresent || isBypassPath || isPurgeRequest;

    if (path === '/cdn-health' || path === '/api/cdn/worker-health') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'shindora-cdn-worker',
        version: '1.2.0',
        origin: originUrlString,
        region: request.cf?.colo || 'GLOBAL',
        country: request.cf?.country || 'ID',
        edgeCpuSaving: 'enabled (99%)',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-ShinDora-Cache': 'HIT',
          'X-ShinDora-Worker': 'active',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      });
    }

    if (shouldBypassCache) {
      return proxyToOrigin(request, origin, {
        cacheControl: 'no-store, no-cache, must-revalidate',
        cacheTag: 'BYPASS'
      });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), {
      method: 'GET',
      headers: request.headers
    });

    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const hitHeaders = new Headers(cachedResponse.headers);
      hitHeaders.set('X-ShinDora-Cache', 'HIT');
      hitHeaders.set('X-ShinDora-Worker', 'active');
      hitHeaders.set('X-Vercel-CPU-Saved', 'true');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: hitHeaders
      });
    }

    let cacheTTL = 0;
    let cacheControlHeader = '';

    const isStaticAsset = (
      path.startsWith('/_next/static/') ||
      path.startsWith('/assets/') ||
      path.startsWith('/images/') ||
      path === '/favicon.ico' ||
      path === '/apple-icon.png' ||
      path === '/icon.png' ||
      path === '/manifest.webmanifest' ||
      path === '/ads.txt' ||
      path === '/robots.txt' ||
      path.endsWith('.png') ||
      path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.webp') ||
      path.endsWith('.svg') ||
      path.endsWith('.css') ||
      path.endsWith('.js') ||
      path.endsWith('.woff2') ||
      path.endsWith('.woff')
    );

    const isPublicReadApi = (
      path === '/api/categories' ||
      path === '/api/promo' ||
      path === '/api/pages' ||
      path === '/api/polling' ||
      path === '/sitemap.xml' ||
      (path === '/api/videos' && !url.searchParams.has('showAll'))
    );

    const isPublicPage = (
      path === '/' ||
      path.startsWith('/watch/') ||
      path.startsWith('/page/') ||
      path.startsWith('/tv') ||
      path.startsWith('/putar-manual')
    );

    if (isStaticAsset) {
      cacheTTL = 31536000;
      cacheControlHeader = 'public, max-age=31536000, immutable';
    } else if (isPublicReadApi) {
      cacheTTL = 300;
      cacheControlHeader = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';
    } else if (isPublicPage) {
      cacheTTL = 600;
      cacheControlHeader = 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400';
    } else {
      cacheTTL = 60;
      cacheControlHeader = 'public, max-age=60, s-maxage=60';
    }

    try {
      const originResponse = await proxyToOrigin(request, origin, {
        cacheControl: cacheControlHeader,
        cacheTag: 'MISS'
      });

      if (originResponse.status === 200 && cacheTTL > 0) {
        const responseToCache = originResponse.clone();
        const headersToCache = new Headers(responseToCache.headers);
        headersToCache.set('Cache-Control', cacheControlHeader);
        headersToCache.set('X-ShinDora-Cache', 'HIT');
        headersToCache.set('X-ShinDora-Worker', 'active');
        headersToCache.set('X-Vercel-CPU-Saved', 'true');

        const cacheEntry = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headersToCache
        });

        ctx.waitUntil(cache.put(cacheKey, cacheEntry));
      }

      return originResponse;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Origin server temporarily unreachable.',
        status: 502,
        timestamp: new Date().toISOString()
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'X-ShinDora-Cache': 'ERROR',
          'X-ShinDora-Worker': 'active'
        }
      });
    }
  }
};

async function proxyToOrigin(request, origin, { cacheControl = null, cacheTag = 'PROXY' } = {}) {
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, origin);

  const headers = new Headers(request.headers);
  headers.set('Host', origin.host);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-ShinDora-Worker', 'active');

  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for');
  if (clientIp) {
    headers.set('X-Forwarded-For', clientIp);
  }

  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');

  const fetchOptions = {
    method: request.method,
    headers: headers,
    redirect: 'follow'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOptions.body = request.body;
  }

  const response = await fetch(targetUrl.toString(), fetchOptions);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-ShinDora-Cache', cacheTag);
  responseHeaders.set('X-ShinDora-Worker', 'active');

  if (cacheControl) {
    responseHeaders.set('Cache-Control', cacheControl);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}`;

      return handleCORS(NextResponse.json({
        success: true,
        filename: 'cloudflare-worker.js',
        originUrl,
        code: scriptContent,
        content: scriptContent
      }));
    }

    if (route === '/cdn/wrangler-config' && method === 'GET') {
      const settings = await db.collection('settings').findOne({ id: 'site_settings' });
      const originUrl = settings?.originUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://shindoranesub.my.id';
      const tomlContent = `name = "shindora-cdn-worker"
main = "cloudflare-worker.js"
compatibility_date = "2026-06-01"
workers_dev = true

[vars]
ORIGIN_URL = "${originUrl}"
`;
      return handleCORS(NextResponse.json({
        success: true,
        filename: 'wrangler.toml',
        originUrl,
        content: tomlContent
      }));
    }

    if (route === '/cdn/worker-health' && method === 'GET') {
      return handleCORS(NextResponse.json({
        status: 'ok',
        service: 'ShinDora Origin API',
        workerHeader: request.headers.get('x-shindora-worker') || 'direct-origin',
        edgeCpuSaving: 'active',
        timestamp: new Date().toISOString()
      }));
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
