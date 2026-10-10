/**
 * ShinDora Nesub - Cloudflare Cache Purge Helper
 * 
 * Helper untuk melakukan invalidate/purge cache pada Cloudflare CDN Edge
 * saat data video, kategori, playlist, halaman, atau settings diperbarui oleh Admin.
 */

import { getUnifiedDb } from './db.js';

export async function purgeCloudflareCache(paths = []) {
  try {
    const db = await getUnifiedDb();
    const settings = await db.collection('settings').findOne({ id: 'site_settings' });

    const cdnDomain = (settings?.cdnDomain || settings?.cloudflareCdnDomain || '').trim();
    const zoneId = (process.env.CLOUDFLARE_ZONE_ID || settings?.cloudflareZoneId || '').trim();
    const apiToken = (process.env.CLOUDFLARE_API_TOKEN || settings?.cloudflareApiToken || '').trim();

    // If Cloudflare API Token & Zone ID are configured, purge via Cloudflare Client API
    if (zoneId && apiToken) {
      let purgePayload = {};

      if (!paths || paths.length === 0 || paths.includes('*') || paths.includes('everything')) {
        purgePayload = { purge_everything: true };
      } else {
        // Build full URLs for specific file purge
        const baseUrl = cdnDomain || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BASE_URL : '') || 'https://shindoranesub.my.id';
        const formattedBase = baseUrl.startsWith('http') ? baseUrl.replace(/\/+$/, '') : `https://${baseUrl.replace(/\/+$/, '')}`;
        
        const filesToPurge = paths.map(p => {
          const cleanPath = p.startsWith('/') ? p : `/${p}`;
          return `${formattedBase}${cleanPath}`;
        });

        purgePayload = { files: filesToPurge };
      }

      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(purgePayload),
        signal: AbortSignal.timeout(6000)
      });

      const cfData = await cfRes.json().catch(() => ({}));
      return {
        success: Boolean(cfData.success),
        method: 'cloudflare_api',
        data: cfData
      };
    }

    // Default: Soft Invalidation instruction logged
    return {
      success: true,
      method: 'swr_auto_refresh',
      message: 'Cache akan otomatis diperbarui pada request berikutnya via Stale-While-Revalidate'
    };
  } catch (err) {
    console.warn('[CDN Purge Warning]:', err.message);
    return { success: false, error: err.message };
  }
}
