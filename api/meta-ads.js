/**
 * Meta (Facebook/Instagram) Ads API Proxy — Multi-Account
 *
 * Setup (pilih salah satu mode):
 *
 * MODE 1 — Connect via Business Manager (recommended):
 *   Set META_ACCESS_TOKEN + META_BUSINESS_ID
 *   → Otomatis akses SEMUA ad account di BM tersebut
 *
 * MODE 2 — Connect specific ad accounts:
 *   Set META_ACCESS_TOKEN + META_AD_ACCOUNT_IDS (comma-separated)
 *   Contoh: act_111,act_222,act_333
 *
 * MODE 3 — Single account (legacy):
 *   Set META_ACCESS_TOKEN + META_AD_ACCOUNT_ID
 *
 * Endpoints:
 *   GET /api/meta-ads?action=accounts          → list semua ad accounts
 *   GET /api/meta-ads?action=insights           → insights semua account
 *   GET /api/meta-ads?action=insights&account=act_XXX  → insights 1 account
 *   GET /api/meta-ads?action=campaigns&account=act_XXX → campaigns 1 account
 *   Semua support: &date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 */

const META_API_BASE = 'https://graph.facebook.com/v21.0';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Accept tokens from query params (dashboard) or env vars (Vercel)
    const token = req.query.token || process.env.META_ACCESS_TOKEN;
    const businessId = req.query.bm_id || process.env.META_BUSINESS_ID;
    const multiIds = process.env.META_AD_ACCOUNT_IDS;
    const singleId = req.query.account || process.env.META_AD_ACCOUNT_ID;

    if (!token) {
        return res.status(200).json({
            configured: false,
            message: 'Meta Ads belum dikonfigurasi. Set META_ACCESS_TOKEN di Vercel.',
            demo_data: getDemoData(),
        });
    }

    try {
        const { action = 'insights', account, date_from, date_to, campaign_id } = req.query;

        // ---- Get all connected ad accounts ----
        if (action === 'accounts') {
            const accounts = await getAllAccounts(token, businessId, multiIds, singleId);
            return res.json({ configured: true, data: accounts });
        }

        // ---- Campaigns for a specific account ----
        if (action === 'campaigns') {
            const accId = account || singleId;
            if (!accId) return res.status(400).json({ error: 'Specify ?account=act_XXX' });

            const url = `${META_API_BASE}/${accId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=100&access_token=${token}`;
            const data = await fetchMeta(url);
            return res.json({ configured: true, data: data.data || [] });
        }

        // ---- Insights ----
        if (action === 'insights') {
            const timeRange = date_from && date_to
                ? `&time_range={"since":"${date_from}","until":"${date_to}"}`
                : '';
            const fields = 'campaign_name,objective,impressions,clicks,spend,cpc,cpm,ctr,reach,actions,action_values,cost_per_action_type';

            if (account) {
                const data = await fetchAccountInsights(account, fields, timeRange, token);
                return res.json({ configured: true, account, data });
            }

            // Fetch insights from ALL accounts
            const accounts = await getAllAccounts(token, businessId, multiIds, singleId);
            const allInsights = [];

            for (const acc of accounts) {
                try {
                    const insights = await fetchAccountInsights(acc.id, fields, timeRange, token);
                    insights.forEach(row => { row.account_name = acc.name; row.account_id = acc.id; });
                    allInsights.push(...insights);
                } catch (e) {
                    // Skip accounts with errors (e.g. no permission)
                }
            }

            return res.json({
                configured: true,
                accounts: accounts.length,
                data: allInsights,
            });
        }

        return res.status(400).json({ error: 'Invalid action. Use: accounts, campaigns, insights' });

    } catch (error) {
        console.error('Meta API error:', error.message);
        return res.status(500).json({ error: error.message, demo_data: getDemoData() });
    }
};

async function getAllAccounts(token, businessId, multiIds, singleId) {
    // Mode 1: Business Manager — fetch all ad accounts under this BM
    if (businessId) {
        const url = `${META_API_BASE}/${businessId}/owned_ad_accounts?fields=id,name,account_status,currency,timezone_name&limit=100&access_token=${token}`;
        const data = await fetchMeta(url);
        return (data.data || []).map(a => ({
            id: a.id,
            name: a.name,
            status: a.account_status === 1 ? 'active' : 'inactive',
            currency: a.currency,
            timezone: a.timezone_name,
        }));
    }

    // Mode 2: Multiple specific account IDs
    if (multiIds) {
        const ids = multiIds.split(',').map(s => s.trim());
        const accounts = [];
        for (const id of ids) {
            try {
                const url = `${META_API_BASE}/${id}?fields=id,name,account_status,currency&access_token=${token}`;
                const data = await fetchMeta(url);
                accounts.push({ id: data.id, name: data.name, status: data.account_status === 1 ? 'active' : 'inactive', currency: data.currency });
            } catch (e) { /* skip */ }
        }
        return accounts;
    }

    // Mode 3: Single account
    if (singleId) {
        try {
            const url = `${META_API_BASE}/${singleId}?fields=id,name,account_status,currency&access_token=${token}`;
            const data = await fetchMeta(url);
            return [{ id: data.id, name: data.name, status: data.account_status === 1 ? 'active' : 'inactive', currency: data.currency }];
        } catch (e) {
            return [{ id: singleId, name: singleId, status: 'unknown' }];
        }
    }

    // Fallback: fetch accounts from token owner
    const url = `${META_API_BASE}/me/adaccounts?fields=id,name,account_status,currency&limit=50&access_token=${token}`;
    const data = await fetchMeta(url);
    return (data.data || []).map(a => ({ id: a.id, name: a.name, status: a.account_status === 1 ? 'active' : 'inactive', currency: a.currency }));
}

async function fetchAccountInsights(accountId, fields, timeRange, token) {
    const url = `${META_API_BASE}/${accountId}/insights?fields=${fields}${timeRange}&level=campaign&time_increment=1&limit=500&access_token=${token}`;
    const data = await fetchMeta(url);
    return transformInsights(data);
}

async function fetchMeta(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
}

function transformInsights(raw) {
    if (!raw.data) return [];
    return raw.data.map(row => {
        const actions = row.actions || [];
        const costPerAction = row.cost_per_action_type || [];
        const actionValues = row.action_values || [];

        const purchases = actions.find(a => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
        const leads = actions.find(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped');
        const linkClicks = actions.find(a => a.action_type === 'link_click');
        const pageEngagement = actions.find(a => a.action_type === 'page_engagement' || a.action_type === 'post_engagement');
        const landingPageViews = actions.find(a => a.action_type === 'landing_page_view');

        const resultAction = purchases || leads || linkClicks || pageEngagement;
        const results = resultAction ? parseInt(resultAction.value || 0) : 0;

        const costPerResult = costPerAction.find(a => a.action_type === (resultAction?.action_type));
        const cpr = costPerResult ? parseFloat(costPerResult.value || 0) : (results > 0 ? parseFloat(row.spend || 0) / results : 0);

        const purchaseValue = actionValues.find(a => a.action_type === 'purchase' || a.action_type === 'omni_purchase');
        const roas = purchaseValue ? parseFloat(purchaseValue.value || 0) / Math.max(parseFloat(row.spend || 1), 1) : 0;

        const objective = row.objective || '';
        let objectiveGroup = 'awareness';
        if (objective.includes('CONVERSIONS') || objective.includes('OUTCOME_SALES') || objective.includes('PRODUCT_CATALOG_SALES')) {
            objectiveGroup = 'conversion';
        } else if (objective.includes('TRAFFIC') || objective.includes('LINK_CLICKS') || objective.includes('OUTCOME_TRAFFIC')) {
            objectiveGroup = 'traffic';
        } else if (objective.includes('ENGAGEMENT') || objective.includes('POST_ENGAGEMENT') || objective.includes('OUTCOME_ENGAGEMENT') || objective.includes('PAGE_LIKES')) {
            objectiveGroup = 'engagement';
        }

        return {
            date: row.date_start,
            campaign: row.campaign_name || 'Total',
            objective: objective,
            objectiveGroup,
            platform: 'Facebook / Meta',
            spend: parseFloat(row.spend || 0),
            impressions: parseInt(row.impressions || 0),
            clicks: parseInt(row.clicks || 0),
            results,
            costPerResult: Math.round(cpr),
            roas: Math.round(roas * 100) / 100,
            cpc: parseFloat(row.cpc || 0),
            cpm: parseFloat(row.cpm || 0),
            ctr: parseFloat(row.ctr || 0),
            reach: parseInt(row.reach || 0),
            landingPageViews: landingPageViews ? parseInt(landingPageViews.value || 0) : 0,
        };
    });
}

function getDemoData() {
    return [
        { date: '2026-06-16', campaign: 'Follower Growth', platform: 'Instagram', spend: 19716, impressions: 12400, clicks: 340, cpc: 58, cpm: 1590, ctr: 2.74 },
        { date: '2026-06-15', campaign: 'Follower Growth', platform: 'Instagram', spend: 32892, impressions: 18900, clicks: 520, cpc: 63, cpm: 1740, ctr: 2.75 },
    ];
}
