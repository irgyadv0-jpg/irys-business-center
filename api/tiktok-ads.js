/**
 * TikTok Ads API Proxy
 *
 * Cara setup:
 * 1. Buka https://business.tiktok.com → Business Center
 * 2. Buat App di TikTok for Developers
 * 3. Dapatkan Access Token & Advertiser ID
 * 4. Set di Vercel Environment Variables:
 *    - TIKTOK_ACCESS_TOKEN = token kamu
 *    - TIKTOK_ADVERTISER_ID = advertiser ID
 *
 * Endpoint:
 *   GET /api/tiktok-ads?date_from=2026-06-01&date_to=2026-06-28
 */

const TT_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = process.env.TIKTOK_ACCESS_TOKEN;
    const advertiserId = process.env.TIKTOK_ADVERTISER_ID;

    if (!token || !advertiserId) {
        return res.status(200).json({
            configured: false,
            message: 'TikTok Ads belum dikonfigurasi.',
            demo_data: getDemoData(),
        });
    }

    try {
        const { date_from, date_to } = req.query;
        const startDate = date_from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const endDate = date_to || new Date().toISOString().slice(0, 10);

        const url = `${TT_API_BASE}/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&dimensions=["stat_time_day"]&data_level=AUCTION_AD&start_date=${startDate}&end_date=${endDate}&metrics=["spend","impressions","clicks","cpc","cpm","ctr","reach"]&page_size=100`;

        const response = await fetch(url, {
            headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (data.code !== 0) throw new Error(data.message || 'TikTok API error');

        const rows = (data.data?.list || []).map(row => ({
            date: row.dimensions?.stat_time_day,
            platform: 'TikTok',
            campaign: 'All Campaigns',
            spend: parseFloat(row.metrics?.spend || 0),
            impressions: parseInt(row.metrics?.impressions || 0),
            clicks: parseInt(row.metrics?.clicks || 0),
            cpc: parseFloat(row.metrics?.cpc || 0),
            cpm: parseFloat(row.metrics?.cpm || 0),
        }));

        return res.json({ configured: true, data: rows });

    } catch (error) {
        return res.status(500).json({ error: error.message, demo_data: getDemoData() });
    }
};

function getDemoData() {
    return [
        { date: '2026-06-11', platform: 'TikTok', campaign: 'Brand Awareness', spend: 48128, impressions: 35000, clicks: 890, cpc: 54, cpm: 1375 },
    ];
}
