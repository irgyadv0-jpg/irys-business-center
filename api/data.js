/**
 * Data Persistence API
 *
 * Saat ini menggunakan in-memory storage (reset saat cold start).
 * Untuk production, ganti dengan database:
 *   - Vercel KV (Redis) — set VERCEL_KV_URL di env
 *   - Supabase — set SUPABASE_URL + SUPABASE_KEY
 *   - PlanetScale — set DATABASE_URL
 *
 * Endpoints:
 *   GET  /api/data?biz=irys              → ambil data bisnis
 *   POST /api/data?biz=irys&type=tx      → tambah transaksi
 *   POST /api/data?biz=irys&type=spend   → tambah ad spend
 *   POST /api/data?biz=irys&type=stock   → tambah stok
 *   GET  /api/data?biz=irys&summary=true → ringkasan KPI
 */

const store = {};

function getStore(biz) {
    if (!store[biz]) {
        store[biz] = { transactions: [], spendDetail: [], stockChanges: [] };
    }
    return store[biz];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { biz = 'irys', type, summary } = req.query;

    if (req.method === 'GET') {
        const data = getStore(biz);

        if (summary === 'true') {
            const revenue = data.transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
            const expense = data.transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
            const adSpend = data.spendDetail.reduce((s, d) => s + d.spend, 0);
            return res.json({
                totalTransactions: data.transactions.length,
                totalSpendEntries: data.spendDetail.length,
                totalStockChanges: data.stockChanges.length,
                revenue, expense, adSpend,
                profit: revenue - expense,
            });
        }

        return res.json(data);
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const data = getStore(biz);

        if (type === 'tx' || type === 'transaction') {
            data.transactions.push({
                id: Date.now().toString(36),
                date: body.date,
                desc: body.desc,
                cat: body.cat,
                amount: body.amount,
                createdAt: new Date().toISOString(),
            });
            return res.json({ success: true, count: data.transactions.length });
        }

        if (type === 'spend') {
            data.spendDetail.push({
                id: Date.now().toString(36),
                date: body.date,
                platform: body.platform,
                campaign: body.campaign,
                spend: body.spend,
                impressions: body.impressions || 0,
                clicks: body.clicks || 0,
                createdAt: new Date().toISOString(),
            });
            return res.json({ success: true, count: data.spendDetail.length });
        }

        if (type === 'stock') {
            data.stockChanges.push({
                id: Date.now().toString(36),
                date: body.date,
                product: body.product,
                qty: body.qty,
                type: body.stockType,
                hpp: body.hpp || 0,
                sell: body.sell || 0,
                createdAt: new Date().toISOString(),
            });
            return res.json({ success: true, count: data.stockChanges.length });
        }

        return res.status(400).json({ error: 'Invalid type. Use: tx, spend, stock' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
