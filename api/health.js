/**
 * Health Check — cek status API dan konfigurasi
 * GET /api/health
 */
module.exports = (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        integrations: {
            meta_ads: !!process.env.META_ACCESS_TOKEN,
            tiktok_ads: !!process.env.TIKTOK_ACCESS_TOKEN,
            database: !!process.env.DATABASE_URL || !!process.env.VERCEL_KV_URL,
        },
        version: '1.1.0',
    });
};
