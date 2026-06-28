/**
 * Meta (Facebook/Instagram) Ads API Proxy
 *
 * Cara setup:
 * 1. Buka https://developers.facebook.com → buat App
 * 2. Tambahkan product "Marketing API"
 * 3. Dapatkan Access Token (System User Token untuk long-lived)
 * 4. Catat Ad Account ID (format: act_XXXXXXXXX)
 * 5. Set di Vercel Environment Variables:
 *    - META_ACCESS_TOKEN = token kamu
 *    - META_AD_ACCOUNT_ID = act_XXXXXXXXX
 *
 * Endpoint ini dipanggil dari frontend:
 *   GET /api/meta-ads?date_from=2026-06-01&date_to=2026-06-28
 *   GET /api/meta-ads?action=campaigns
 *   GET /api/meta-ads?action=insights&campaign_id=123
 */

const META_API_BASE = 'https://graph.facebook.com/v21.0';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (!token || !adAccountId) {
        return res.status(200).json({
            configured: false,
            message: 'Meta Ads belum dikonfigurasi. Set META_ACCESS_TOKEN dan META_AD_ACCOUNT_ID di Vercel Environment Variables.',
            demo_data: getDemoData(),
        });
    }

    try {
        const { action = 'insights', date_from, date_to, campaign_id } = req.query;

        if (action === 'campaigns') {
            const url = `${META_API_BASE}/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&access_token=${token}`;
            const data = await fetchMeta(url);
            return res.json({ configured: true, data });
        }

        if (action === 'insights') {
            let url;
            const fields = 'impressions,clicks,spend,cpc,cpm,ctr,reach,actions';
            const timeRange = date_from && date_to
                ? `&time_range={"since":"${date_from}","until":"${date_to}"}`
                : '';

            if (campaign_id) {
                url = `${META_API_BASE}/${campaign_id}/insights?fields=${fields}${timeRange}&access_token=${token}`;
            } else {
                url = `${META_API_BASE}/${adAccountId}/insights?fields=${fields}${timeRange}&level=campaign&time_increment=1&access_token=${token}`;
            }

            const data = await fetchMeta(url);
            return res.json({
                configured: true,
                data: transformInsights(data),
            });
        }

        return res.status(400).json({ error: 'Invalid action. Use: campaigns, insights' });

    } catch (error) {
        console.error('Meta API error:', error.message);
        return res.status(500).json({ error: error.message, demo_data: getDemoData() });
    }
};

async function fetchMeta(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
}

function transformInsights(raw) {
    if (!raw.data) return [];
    return raw.data.map(row => ({
        date: row.date_start,
        campaign: row.campaign_name || 'Total',
        platform: 'Meta',
        spend: parseFloat(row.spend || 0),
        impressions: parseInt(row.impressions || 0),
        clicks: parseInt(row.clicks || 0),
        cpc: parseFloat(row.cpc || 0),
        cpm: parseFloat(row.cpm || 0),
        ctr: parseFloat(row.ctr || 0),
        reach: parseInt(row.reach || 0),
    }));
}

function getDemoData() {
    return [
        { date: '2026-06-16', campaign: 'Follower Growth', platform: 'Instagram', spend: 19716, impressions: 12400, clicks: 340, cpc: 58, cpm: 1590, ctr: 2.74 },
        { date: '2026-06-15', campaign: 'Follower Growth', platform: 'Instagram', spend: 32892, impressions: 18900, clicks: 520, cpc: 63, cpm: 1740, ctr: 2.75 },
        { date: '2026-06-14', campaign: 'Follower Growth', platform: 'Instagram', spend: 21105, impressions: 14200, clicks: 380, cpc: 56, cpm: 1486, ctr: 2.68 },
        { date: '2026-06-13', campaign: 'Follower Growth', platform: 'Instagram', spend: 22908, impressions: 15100, clicks: 410, cpc: 56, cpm: 1517, ctr: 2.72 },
    ];
}
