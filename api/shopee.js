/**
 * Shopee Open Platform API Proxy
 *
 * Cara setup:
 * 1. Daftar di https://open.shopee.com → Partner Console
 * 2. Buat App → dapatkan Partner ID + Partner Key
 * 3. Authorization: Redirect seller ke Shopee auth URL → dapatkan Shop ID + Access Token
 * 4. Set di Vercel Environment Variables:
 *    - SHOPEE_PARTNER_ID = partner ID kamu
 *    - SHOPEE_PARTNER_KEY = partner key (secret)
 *    - SHOPEE_SHOP_ID = shop ID seller
 *    - SHOPEE_ACCESS_TOKEN = access token dari auth flow
 *
 * Endpoints:
 *   GET /api/shopee?action=orders&date_from=2026-06-01&date_to=2026-06-28
 *   GET /api/shopee?action=income&date_from=...&date_to=...
 *   GET /api/shopee?action=products
 *
 * Catatan:
 *   Shopee API butuh signature per request (HMAC-SHA256).
 *   Token harus di-refresh setiap 4 jam via refresh_token.
 *   Approval dari Shopee bisa 1-2 minggu.
 */

const crypto = require('crypto');

const SHOPEE_HOST = 'https://partner.shopeemobile.com';
const API_PATH_PREFIX = '/api/v2';

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const partnerId = parseInt(process.env.SHOPEE_PARTNER_ID);
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const shopId = parseInt(process.env.SHOPEE_SHOP_ID);
    const accessToken = process.env.SHOPEE_ACCESS_TOKEN;

    if (!partnerId || !partnerKey || !shopId || !accessToken) {
        return res.status(200).json({
            configured: false,
            message: 'Shopee belum dikonfigurasi. Butuh: SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, SHOPEE_SHOP_ID, SHOPEE_ACCESS_TOKEN',
            setup_guide: {
                step1: 'Daftar di https://open.shopee.com',
                step2: 'Buat App di Partner Console',
                step3: 'Authorization flow untuk dapatkan shop_id + access_token',
                step4: 'Set 4 env vars di Vercel',
                note: 'Approval dari Shopee biasanya 1-2 minggu'
            },
            demo_data: getDemoData(),
        });
    }

    try {
        const { action = 'orders', date_from, date_to } = req.query;
        const fromTs = date_from ? Math.floor(new Date(date_from).getTime() / 1000) : Math.floor(Date.now() / 1000) - 7 * 86400;
        const toTs = date_to ? Math.floor(new Date(date_to + 'T23:59:59').getTime() / 1000) : Math.floor(Date.now() / 1000);

        if (action === 'orders') {
            const path = `${API_PATH_PREFIX}/order/get_order_list`;
            const params = {
                time_range_field: 'create_time',
                time_from: fromTs,
                time_to: toTs,
                page_size: 100,
                order_status: 'COMPLETED',
            };
            const data = await shopeeRequest(path, params, partnerId, partnerKey, shopId, accessToken);
            const orders = data.response?.order_list || [];

            const orderDetails = [];
            for (let i = 0; i < orders.length; i += 50) {
                const batch = orders.slice(i, i + 50).map(o => o.order_sn).join(',');
                const detailPath = `${API_PATH_PREFIX}/order/get_order_detail`;
                const detail = await shopeeRequest(detailPath, { order_sn_list: batch }, partnerId, partnerKey, shopId, accessToken);
                orderDetails.push(...(detail.response?.order_list || []));
            }

            return res.json({
                configured: true,
                data: transformOrders(orderDetails),
                summary: summarizeOrders(orderDetails),
            });
        }

        if (action === 'income') {
            const results = [];
            let cursor = '';
            let hasMore = true;

            while (hasMore) {
                const path = `${API_PATH_PREFIX}/payment/get_escrow_list`;
                const params = { release_time_from: fromTs, release_time_to: toTs, page_size: 100 };
                if (cursor) params.cursor = cursor;

                const data = await shopeeRequest(path, params, partnerId, partnerKey, shopId, accessToken);
                const escrows = data.response?.escrow_list || [];
                results.push(...escrows);
                hasMore = data.response?.more || false;
                cursor = data.response?.next_cursor || '';
            }

            return res.json({
                configured: true,
                data: transformIncome(results),
            });
        }

        if (action === 'products') {
            const path = `${API_PATH_PREFIX}/product/get_item_list`;
            const params = { offset: 0, page_size: 100, item_status: 'NORMAL' };
            const data = await shopeeRequest(path, params, partnerId, partnerKey, shopId, accessToken);
            return res.json({ configured: true, data: data.response?.item || [] });
        }

        return res.status(400).json({ error: 'Invalid action. Use: orders, income, products' });

    } catch (error) {
        console.error('Shopee API error:', error.message);
        return res.status(500).json({ error: error.message, demo_data: getDemoData() });
    }
};

async function shopeeRequest(path, params, partnerId, partnerKey, shopId, accessToken) {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');

    const queryParams = new URLSearchParams({
        partner_id: partnerId,
        timestamp,
        access_token: accessToken,
        shop_id: shopId,
        sign,
        ...params,
    });

    const url = `${SHOPEE_HOST}${path}?${queryParams.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Shopee HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.message || data.error);
    return data;
}

function transformOrders(orders) {
    return orders.map(o => ({
        orderSn: o.order_sn,
        status: o.order_status,
        createTime: new Date(o.create_time * 1000).toISOString().slice(0, 10),
        totalAmount: parseFloat(o.total_amount || 0),
        buyerPaid: parseFloat(o.buyer_total_amount || 0),
        sellerIncome: parseFloat(o.escrow_amount || 0),
        shippingFee: parseFloat(o.actual_shipping_fee || 0),
        items: (o.item_list || []).map(i => ({
            name: i.item_name,
            sku: i.item_sku,
            qty: i.model_quantity_purchased,
            price: parseFloat(i.model_discounted_price || i.model_original_price || 0),
        })),
    }));
}

function summarizeOrders(orders) {
    const totalOrders = orders.length;
    const gmv = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
    const totalItems = orders.reduce((s, o) => s + (o.item_list || []).reduce((ss, i) => ss + (i.model_quantity_purchased || 0), 0), 0);
    const sellerIncome = orders.reduce((s, o) => s + parseFloat(o.escrow_amount || 0), 0);
    const shippingTotal = orders.reduce((s, o) => s + parseFloat(o.actual_shipping_fee || 0), 0);
    const ppn = Math.round(gmv * 0.11);
    const adminFee = Math.round(gmv - sellerIncome - shippingTotal);

    return {
        totalOrders,
        totalItems,
        gmv: Math.round(gmv),
        ppn,
        adminFee: Math.max(adminFee, 0),
        shippingFee: Math.round(shippingTotal),
        sellerIncome: Math.round(sellerIncome),
    };
}

function transformIncome(escrows) {
    return escrows.map(e => ({
        orderSn: e.order_sn,
        releaseDate: e.payout_time ? new Date(e.payout_time * 1000).toISOString().slice(0, 10) : null,
        orderIncome: parseFloat(e.order_income || 0),
        buyerPayment: parseFloat(e.buyer_total_amount || 0),
        sellerDiscount: parseFloat(e.voucher_from_seller || 0),
        serviceFee: parseFloat(e.service_fee || 0),
        commissionFee: parseFloat(e.commission_fee || 0),
        transactionFee: parseFloat(e.transaction_fee || 0),
    }));
}

function getDemoData() {
    return {
        orders: [
            { orderSn: 'DEMO001', status: 'COMPLETED', createTime: '2026-06-15', totalAmount: 178000, sellerIncome: 142400, items: [{ name: 'Contoh Produk', qty: 2, price: 89000 }] },
            { orderSn: 'DEMO002', status: 'COMPLETED', createTime: '2026-06-14', totalAmount: 89000, sellerIncome: 71200, items: [{ name: 'Contoh Produk 2', qty: 1, price: 89000 }] },
        ],
        summary: { totalOrders: 2, totalItems: 3, gmv: 267000, ppn: 29370, adminFee: 16020, sellerIncome: 213600 },
    };
}
