/* ================================================
   Business Center — App Logic
   Auth, Multi-business, Charts, Data
   ================================================ */

// ---- Auth Config ----
const USERS = [
    { email: 'owner@irys.com', password: 'owner123', name: 'Owner', role: 'owner', avatar: 'O' },
    { email: 'kreator@irys.com', password: 'kreator123', name: 'Konten Kreator', role: 'kreator', avatar: 'K' },
];

// ---- Business Config (clean — all data comes from manual input + API) ----
const BUSINESSES = {
    irys: {
        name: 'IRYS Fragrance',
        color: '#7C3AED',
        tagline: 'Parfum & Body Care',
        overview: { revenue: 0, expense: 0, profit: 0, roas: 0, cogs: 0, adSpend: 0, stock: 0, assetValue: 0 },
        channels: [],
        spendDetail: [],
        stock: [],
        products: [],
        assets: [],
        transactions: [],
        chartRevExp: { labels: [], revenue: [], expense: [] },
    },
    dropship: {
        name: 'Dropship Marketplace',
        color: '#2563EB',
        tagline: 'Reseller & Dropship',
        overview: { revenue: 0, expense: 0, profit: 0, roas: 0, cogs: 0, adSpend: 0, stock: 0, assetValue: 0 },
        channels: [],
        spendDetail: [],
        stock: [],
        products: [],
        assets: [],
        transactions: [],
        chartRevExp: { labels: [], revenue: [], expense: [] },
    },
    matcha: {
        name: 'Toko Matcha',
        color: '#059669',
        tagline: 'F&B Matcha',
        overview: { revenue: 0, expense: 0, profit: 0, roas: 0, cogs: 0, adSpend: 0, stock: 0, assetValue: 0 },
        channels: [],
        spendDetail: [],
        stock: [],
        products: [],
        assets: [],
        transactions: [],
        chartRevExp: { labels: [], revenue: [], expense: [] },
    },
};

// ---- App State ----
const state = {
    user: null,
    currentBiz: 'irys',
    currentPage: 'overview',
    dateRange: '7d',
    dateFrom: null,
    dateTo: null,
    charts: {},
};

// ---- localStorage Data ----
function getManualData(bizKey) {
    const raw = localStorage.getItem(`bc-data-${bizKey}`);
    const defaults = { transactions: [], spendDetail: [], stockChanges: [], opAssets: [] };
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
}

function saveManualData(bizKey, data) {
    localStorage.setItem(`bc-data-${bizKey}`, JSON.stringify(data));
}

function getMergedTransactions(biz, bizKey) {
    const manual = getManualData(bizKey);
    const liveTx = (state.liveSpendData || []).map(d => ({
        date: d.date,
        desc: `${d.platform} — ${d.campaign}`,
        cat: 'Ads',
        amount: -d.spend,
        source: 'api',
    }));
    return [...biz.transactions, ...manual.transactions, ...liveTx];
}

function getMergedSpend(biz, bizKey) {
    const manual = getManualData(bizKey);
    const live = state.liveSpendData || [];
    return [...biz.spendDetail, ...manual.spendDetail, ...live];
}

function filterByDateRange(items, dateField) {
    if (!items || items.length === 0) return items;
    const today = new Date().toISOString().slice(0, 10);

    if (state.dateRange === 'custom' && state.dateFrom && state.dateTo) {
        return items.filter(i => {
            const d = i[dateField];
            return d && d >= state.dateFrom && d <= state.dateTo;
        });
    }

    if (state.dateRange === 'today') {
        return items.filter(i => i[dateField] === today);
    }

    if (state.dateRange === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = y.toISOString().slice(0, 10);
        return items.filter(i => i[dateField] === yStr);
    }

    if (state.dateRange === 'lastmonth') {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        const last = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
        return items.filter(i => i[dateField] && i[dateField] >= first && i[dateField] <= last);
    }

    if (state.dateRange === 'all') return items;

    let daysBack = 7;
    if (state.dateRange === '30d') daysBack = 30;
    if (state.dateRange === 'month') {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        return items.filter(i => i[dateField] && i[dateField] >= firstOfMonth);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return items.filter(i => i[dateField] && i[dateField] >= cutoffStr);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('bc-user');
    if (saved) {
        state.user = JSON.parse(saved);
        showApp();
    }
    initLogin();
    initTheme();
});

// ================================================
//  AUTH
// ================================================

function initLogin() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPassword').value;
        const user = USERS.find(u => u.email === email && u.password === pass);

        if (!user) {
            document.getElementById('loginError').textContent = 'Email atau password salah';
            return;
        }

        state.user = { name: user.name, role: user.role, avatar: user.avatar, email: user.email };
        localStorage.setItem('bc-user', JSON.stringify(state.user));
        showApp();
    });
}

function showApp() {
    document.getElementById('viewLogin').classList.remove('active');
    document.getElementById('viewApp').classList.add('active');

    document.getElementById('userName').textContent = state.user.name;
    document.getElementById('userRole').textContent = state.user.role === 'owner' ? 'Full Access' : 'Konten Kreator';
    document.getElementById('userAvatar').textContent = state.user.avatar;

    applyRoleAccess();
    initSidebar();
    initNav();
    initDateRange();
    initBizSelector();
    initRefresh();
    initModal();
    initAssetModal();
    renderCurrentPage();
    checkApiStatus();
}

function logout() {
    localStorage.removeItem('bc-user');
    state.user = null;
    document.getElementById('viewApp').classList.remove('active');
    document.getElementById('viewLogin').classList.add('active');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
}

function applyRoleAccess() {
    if (state.user.role === 'kreator') {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.dataset.page !== 'product') btn.classList.add('hidden');
        });
        state.currentPage = 'product';
    } else {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('hidden'));
    }
}

// ================================================
//  SIDEBAR & NAV
// ================================================

function initSidebar() {
    document.getElementById('mobileMenu').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebarOverlay').classList.add('active');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentPage = btn.dataset.page;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCurrentPage();
            closeSidebar();
        });
    });
}

function initBizSelector() {
    const selector = document.getElementById('bizSelector');
    const current = document.getElementById('bizCurrent');

    current.addEventListener('click', () => selector.classList.toggle('open'));

    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) selector.classList.remove('open');
    });

    document.querySelectorAll('.biz-option').forEach(opt => {
        opt.addEventListener('click', () => {
            state.currentBiz = opt.dataset.biz;
            const biz = BUSINESSES[state.currentBiz];

            document.querySelectorAll('.biz-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            document.querySelector('#bizCurrent .biz-name').textContent = biz.name;
            document.querySelector('#bizCurrent .biz-dot').style.background = biz.color;

            selector.classList.remove('open');
            renderCurrentPage();
            toast(`Beralih ke ${biz.name}`);
        });
    });
}

function initDateRange() {
    const customPanel = document.getElementById('dateCustom');

    document.querySelectorAll('.dr-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dr-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.dateRange = btn.dataset.range;

            if (btn.dataset.range === 'custom') {
                customPanel.classList.add('show');
                return;
            }
            customPanel.classList.remove('show');
            state.dateFrom = null;
            state.dateTo = null;
            renderCurrentPage();
        });
    });

    document.getElementById('dateApply').addEventListener('click', () => {
        state.dateFrom = document.getElementById('dateFrom').value;
        state.dateTo = document.getElementById('dateTo').value;
        if (state.dateFrom && state.dateTo) {
            renderCurrentPage();
            toast(`Filter: ${formatDate(state.dateFrom)} — ${formatDate(state.dateTo)}`);
        }
    });

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('dateTo').value = today;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('dateFrom').value = weekAgo.toISOString().slice(0, 10);
}

function initRefresh() {
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const btn = document.getElementById('refreshBtn');
        btn.classList.add('spinning');
        await fetchLiveAdData();
        renderCurrentPage();
        btn.classList.remove('spinning');
        toast('Data diperbarui');
    });
}

async function fetchLiveAdData() {
    const dateFrom = state.dateFrom || '2026-01-01';
    const dateTo = state.dateTo || new Date().toISOString().slice(0, 10);

    try {
        const res = await fetch(`/api/meta-ads?action=insights&date_from=${dateFrom}&date_to=${dateTo}`);
        const json = await res.json();
        if (json.configured && json.data && json.data.length > 0) {
            state.liveAds = state.liveAds || {};
            state.liveAds.meta = json.data;

            // Merge live data into current business spend
            const biz = BUSINESSES[state.currentBiz];
            const manual = getManualData(state.currentBiz);
            const liveSpend = json.data.map(d => ({
                date: d.date,
                platform: d.platform || 'Meta',
                campaign: d.campaign || 'Meta Campaign',
                objective: d.objective || '',
                objectiveGroup: d.objectiveGroup || 'awareness',
                spend: Math.round(d.spend || 0),
                impressions: d.impressions || 0,
                clicks: d.clicks || 0,
                results: d.results || 0,
                costPerResult: d.costPerResult || 0,
                cpc: d.cpc || 0,
                cpm: d.cpm || 0,
                ctr: d.ctr || 0,
                reach: d.reach || 0,
                roas: d.roas || 0,
                source: 'api',
            }));
            state.liveSpendData = liveSpend;
            toast(`${json.data.length} data iklan Meta berhasil disync`);
        }
    } catch (e) {
        console.warn('Meta API fetch failed:', e.message);
    }

    try {
        const res = await fetch(`/api/tiktok-ads?date_from=${dateFrom}&date_to=${dateTo}`);
        const json = await res.json();
        if (json.configured && json.data && json.data.length > 0) {
            state.liveAds = state.liveAds || {};
            state.liveAds.tiktok = json.data;
        }
    } catch (e) {
        // TikTok API not available
    }
}

async function checkApiStatus() {
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.integrations?.meta_ads) {
            await fetchLiveAdData();
            renderCurrentPage();
        }
    } catch (e) {
        // API not deployed yet or offline
    }
}

// ================================================
//  MODAL — Manual Input
// ================================================

function initModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    const addBtn = document.getElementById('addDataBtn');

    addBtn.addEventListener('click', () => overlay.classList.add('show'));
    closeBtn.addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });

    document.querySelectorAll('.mtab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.modal-form').forEach(f => f.style.display = 'none');
            document.getElementById(`form${capitalize(tab.dataset.mtab)}`).style.display = '';
        });
    });

    // Form: Transaksi
    document.getElementById('formTransaksi').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = getManualData(state.currentBiz);
        const isExpense = document.getElementById('inTxType').value === 'expense';
        const amount = parseInt(document.getElementById('inTxAmount').value) || 0;
        data.transactions.push({
            date: document.getElementById('inTxDate').value,
            desc: document.getElementById('inTxDesc').value,
            cat: document.getElementById('inTxCat').value,
            amount: isExpense ? -amount : amount,
        });
        saveManualData(state.currentBiz, data);
        e.target.reset();
        document.getElementById('inTxDate').value = new Date().toISOString().slice(0, 10);
        overlay.classList.remove('show');
        renderCurrentPage();
        toast('Transaksi berhasil ditambahkan');
    });

    // Form: Ad Spend
    document.getElementById('formAdspend').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = getManualData(state.currentBiz);
        data.spendDetail.push({
            date: document.getElementById('inAdDate').value,
            platform: document.getElementById('inAdPlatform').value,
            campaign: document.getElementById('inAdCampaign').value,
            spend: parseInt(document.getElementById('inAdSpend').value) || 0,
            impressions: parseInt(document.getElementById('inAdImpr').value) || 0,
            clicks: parseInt(document.getElementById('inAdClicks').value) || 0,
        });
        data.transactions.push({
            date: document.getElementById('inAdDate').value,
            desc: `${document.getElementById('inAdPlatform').value} — ${document.getElementById('inAdCampaign').value}`,
            cat: 'Ads',
            amount: -(parseInt(document.getElementById('inAdSpend').value) || 0),
        });
        saveManualData(state.currentBiz, data);
        e.target.reset();
        document.getElementById('inAdDate').value = new Date().toISOString().slice(0, 10);
        overlay.classList.remove('show');
        renderCurrentPage();
        toast('Ad Spend berhasil ditambahkan');
    });

    // Form: Stok
    document.getElementById('formStok').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = getManualData(state.currentBiz);
        data.stockChanges.push({
            date: document.getElementById('inStkDate').value,
            product: document.getElementById('inStkProduct').value,
            qty: parseInt(document.getElementById('inStkQty').value) || 0,
            type: document.getElementById('inStkType').value,
            hpp: parseInt(document.getElementById('inStkHpp').value) || 0,
            sell: parseInt(document.getElementById('inStkSell').value) || 0,
        });
        saveManualData(state.currentBiz, data);
        e.target.reset();
        document.getElementById('inStkDate').value = new Date().toISOString().slice(0, 10);
        overlay.classList.remove('show');
        renderCurrentPage();
        toast('Perubahan stok berhasil disimpan');
    });

    // Wire stock log button
    const stockLogBtn = document.getElementById('addStockLogBtn');
    if (stockLogBtn) {
        stockLogBtn.addEventListener('click', () => {
            overlay.classList.add('show');
            document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-mtab="stok"]').classList.add('active');
            document.querySelectorAll('.modal-form').forEach(f => f.style.display = 'none');
            document.getElementById('formStok').style.display = '';
        });
    }

    // Wire expense button
    const expenseBtn = document.getElementById('addExpenseBtn');
    if (expenseBtn) {
        expenseBtn.addEventListener('click', () => {
            overlay.classList.add('show');
            document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-mtab="transaksi"]').classList.add('active');
            document.querySelectorAll('.modal-form').forEach(f => f.style.display = 'none');
            document.getElementById('formTransaksi').style.display = '';
            document.getElementById('inTxType').value = 'expense';
        });
    }

    // Set default dates
    const today = new Date().toISOString().slice(0, 10);
    ['inTxDate', 'inAdDate', 'inStkDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ================================================
//  RENDER ROUTER
// ================================================

function renderCurrentPage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const page = document.getElementById(`page-${state.currentPage}`);
    if (page) {
        page.classList.add('active');
        page.style.animation = 'none';
        page.offsetHeight;
        page.style.animation = '';
    }

    const titles = { overview: 'Overview', spend: 'Ad Spend', stock: 'Stok & Inventori', product: 'Produk & Konten', opasset: 'Asset Operasional' };
    document.getElementById('pageTitle').textContent = titles[state.currentPage] || 'Overview';

    const biz = BUSINESSES[state.currentBiz];
    document.documentElement.style.setProperty('--biz-color', biz.color);

    switch (state.currentPage) {
        case 'overview': renderOverview(biz); break;
        case 'spend': renderSpend(biz); break;
        case 'stock': renderStock(biz); break;
        case 'product': renderProduct(biz); break;
        case 'opasset': renderOpAssets(); break;
    }
}

// ================================================
//  PAGE: OVERVIEW
// ================================================

function renderOverview(biz) {
    const allTx = getMergedTransactions(biz, state.currentBiz);
    const filtered = filterByDateRange(allTx, 'date');

    const revenue = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const profit = revenue - expense;
    const adSpend = filtered.filter(t => t.cat === 'Ads').reduce((s, t) => s + Math.abs(t.amount), 0);
    const cogs = filtered.filter(t => t.cat === 'COGS').reduce((s, t) => s + Math.abs(t.amount), 0);
    const roas = adSpend > 0 ? (revenue / adSpend).toFixed(1) : biz.overview.roas;

    document.getElementById('kpi-revenue').textContent = rupiah(revenue || biz.overview.revenue);
    document.getElementById('kpi-expense').textContent = rupiah(expense || biz.overview.expense);
    document.getElementById('kpi-profit').textContent = rupiah(filtered.length > 0 ? profit : biz.overview.profit);
    document.getElementById('kpi-roas').textContent = roas + 'x';
    document.getElementById('kpi-cogs').textContent = rupiah(cogs || biz.overview.cogs);
    document.getElementById('kpi-adspend').textContent = rupiah(adSpend || biz.overview.adSpend);
    document.getElementById('kpi-stock').textContent = biz.overview.stock + ' unit';
    document.getElementById('kpi-asset').textContent = rupiah(biz.overview.assetValue);

    renderChannelGrid(biz);
    renderRecentTable(biz);
    renderOverviewCharts(biz);
}

function renderChannelGrid(biz) {
    const grid = document.getElementById('channelGrid');
    grid.innerHTML = biz.channels.map(ch => `
        <div class="channel-card">
            <div class="ch-icon" style="background:${ch.color}15">
                ${channelIcon(ch.icon, ch.color)}
            </div>
            <div class="ch-info">
                <div class="ch-name">${esc(ch.name)}</div>
                <div class="ch-value">${rupiah(ch.spend)}</div>
            </div>
        </div>
    `).join('');
}

function renderRecentTable(biz) {
    const tbody = document.querySelector('#tblRecent tbody');
    const allTx = getMergedTransactions(biz, state.currentBiz);
    const filtered = filterByDateRange(allTx, 'date');
    const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tbody.innerHTML = sorted.slice(0, 8).map(t => {
        const isIncome = t.amount > 0;
        const catClass = t.cat === 'Revenue' ? 'tag-green' : t.cat === 'Ads' ? 'tag-pink' : 'tag-amber';
        return `<tr>
            <td>${formatDate(t.date)}</td>
            <td>${esc(t.desc)}</td>
            <td><span class="tag ${catClass}">${esc(t.cat)}</span></td>
            <td class="r" style="font-weight:600;color:${isIncome ? 'var(--green)' : 'var(--red)'}">${isIncome ? '+' : ''}${rupiah(t.amount)}</td>
        </tr>`;
    }).join('');
}

function renderOverviewCharts(biz) {
    destroyChart('revexp');
    destroyChart('breakdown');

    const d = biz.chartRevExp;
    const textMuted = getCSSVar('--text-3');

    state.charts.revexp = new Chart(document.getElementById('chartRevExp'), {
        type: 'line',
        data: {
            labels: d.labels,
            datasets: [
                { label: 'Revenue', data: d.revenue, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#059669', borderWidth: 2 },
                { label: 'Expense', data: d.expense, borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.05)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#DC2626', borderWidth: 2 },
            ]
        },
        options: chartOpts(textMuted),
    });

    const cats = {};
    biz.transactions.forEach(t => {
        if (t.amount < 0) cats[t.cat] = (cats[t.cat] || 0) + Math.abs(t.amount);
    });

    const catColors = { COGS: '#7C3AED', Ads: '#DB2777', Ops: '#2563EB', Legal: '#D97706' };

    state.charts.breakdown = new Chart(document.getElementById('chartBreakdown'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: Object.keys(cats).map(k => catColors[k] || '#A1A1AA'), borderWidth: 0, spacing: 2, borderRadius: 3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8, color: textMuted, font: { family: 'Inter', size: 11 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${rupiah(ctx.raw)}` } } } },
    });
}

// ================================================
//  PAGE: SPEND
// ================================================

function renderSpend(biz) {
    const allSpend = getMergedSpend(biz, state.currentBiz);
    const filtered = filterByDateRange(allSpend, 'date');

    const totalSpend = filtered.reduce((s, c) => s + (c.spend || 0), 0);
    const totalClicks = filtered.reduce((s, c) => s + (c.clicks || 0), 0);
    const totalImpr = filtered.reduce((s, c) => s + (c.impressions || 0), 0);
    const totalReach = filtered.reduce((s, c) => s + (c.reach || 0), 0);
    const totalResults = filtered.reduce((s, c) => s + (c.results || c.clicks || 0), 0);
    const campaigns = [...new Set(filtered.map(s => s.campaign))];
    const avgCtr = totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : '0';
    const avgCpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;
    const avgCpm = totalImpr > 0 ? Math.round((totalSpend / totalImpr) * 1000) : 0;
    const costPerResult = totalResults > 0 ? Math.round(totalSpend / totalResults) : 0;

    document.getElementById('kpi-spend-total').textContent = rupiah(totalSpend || biz.channels.reduce((s, c) => s + c.spend, 0));
    document.getElementById('kpi-spend-campaigns').textContent = campaigns.length + ' campaigns';
    document.getElementById('kpi-spend-results').textContent = num(totalResults);
    document.getElementById('kpi-spend-cpr').textContent = rupiah(costPerResult);
    document.getElementById('kpi-spend-ctr').textContent = avgCtr + '%';
    document.getElementById('kpi-spend-reach').textContent = compactNum(totalReach);
    document.getElementById('kpi-spend-impr').textContent = compactNum(totalImpr);
    document.getElementById('kpi-spend-cpc').textContent = rupiah(avgCpc);
    document.getElementById('kpi-spend-cpm').textContent = rupiah(avgCpm);

    renderSpendCharts(biz);
    renderSpendTable(biz);
    renderObjectiveTables(filtered);
    renderExpenses();
}

function renderSpendCharts(biz) {
    destroyChart('spendTrend');
    destroyChart('spendDist');

    const textMuted = getCSSVar('--text-3');
    const allSpend = getMergedSpend(biz, state.currentBiz);
    const filteredSpend = filterByDateRange(allSpend, 'date');

    const dates = [...new Set(filteredSpend.map(s => s.date))].sort();
    const dailySpend = dates.map(d => filteredSpend.filter(s => s.date === d).reduce((sum, s) => sum + s.spend, 0));

    state.charts.spendTrend = new Chart(document.getElementById('chartSpendTrend'), {
        type: 'bar',
        data: {
            labels: dates.map(d => formatDate(d)),
            datasets: [{ label: 'Ad Spend', data: dailySpend, backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 5, borderSkipped: false }]
        },
        options: { ...chartOpts(textMuted), plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${rupiah(ctx.raw)}` } } } },
    });

    const byObjective = {};
    filteredSpend.forEach(s => {
        const g = s.objectiveGroup || 'awareness';
        const label = { conversion: 'Konversi', engagement: 'Engagement', traffic: 'Traffic', awareness: 'Awareness' }[g] || g;
        byObjective[label] = (byObjective[label] || 0) + (s.spend || 0);
    });
    const objColors = { 'Konversi': '#059669', 'Engagement': '#2563EB', 'Traffic': '#D97706', 'Awareness': '#7C3AED' };

    state.charts.spendDist = new Chart(document.getElementById('chartSpendDist'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(byObjective),
            datasets: [{ data: Object.values(byObjective), backgroundColor: Object.keys(byObjective).map(k => objColors[k] || '#A1A1AA'), borderWidth: 0, spacing: 2, borderRadius: 3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8, color: textMuted, font: { family: 'Inter', size: 11 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${rupiah(ctx.raw)}` } } } },
    });
}

function renderSpendTable(biz) {
    const tbody = document.querySelector('#tblSpend tbody');
    const allSpend = getMergedSpend(biz, state.currentBiz);
    const filtered = filterByDateRange(allSpend, 'date');
    const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const objLabels = { conversion: 'Konversi', engagement: 'Engagement', traffic: 'Traffic', awareness: 'Awareness' };

    tbody.innerHTML = sorted.map(s => {
        const results = s.results || s.clicks || 0;
        const cpr = results > 0 ? Math.round((s.spend || 0) / results) : 0;
        const ctr = s.ctr ? parseFloat(s.ctr).toFixed(2) : (s.impressions > 0 ? ((s.clicks || 0) / s.impressions * 100).toFixed(2) : '0');
        const objGroup = s.objectiveGroup || 'awareness';
        const objClass = objGroup === 'conversion' ? 'tag-green' : objGroup === 'engagement' ? 'tag-blue' : objGroup === 'traffic' ? 'tag-amber' : 'tag-purple';

        return `<tr>
            <td>${formatDate(s.date)}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.campaign)}">${esc(s.campaign)}</td>
            <td><span class="tag ${objClass}">${objLabels[objGroup] || objGroup}</span></td>
            <td class="r" style="font-weight:600">${rupiah(s.spend)}</td>
            <td class="r">${num(s.impressions)}</td>
            <td class="r">${num(s.clicks)}</td>
            <td class="r" style="font-weight:600">${num(results)}</td>
            <td class="r">${rupiah(cpr)}</td>
            <td class="r">${ctr}%</td>
        </tr>`;
    }).join('');
}

function renderObjectiveTables(filtered) {
    // Group by campaign, then by objective
    const byCampaign = {};
    filtered.forEach(s => {
        const key = s.campaign || 'Unknown';
        if (!byCampaign[key]) byCampaign[key] = { campaign: key, objectiveGroup: s.objectiveGroup || 'awareness', spend: 0, results: 0, clicks: 0, impressions: 0 };
        byCampaign[key].spend += (s.spend || 0);
        byCampaign[key].results += (s.results || 0);
        byCampaign[key].clicks += (s.clicks || 0);
        byCampaign[key].impressions += (s.impressions || 0);
    });

    const campaigns = Object.values(byCampaign);
    const conversions = campaigns.filter(c => c.objectiveGroup === 'conversion' || c.objectiveGroup === 'traffic');
    const engagements = campaigns.filter(c => c.objectiveGroup === 'engagement' || c.objectiveGroup === 'awareness');

    document.getElementById('tagConversion').textContent = conversions.length + ' campaign';
    document.getElementById('tagEngagement').textContent = engagements.length + ' campaign';

    renderObjTable('#tblConversion tbody', conversions);
    renderObjTable('#tblEngagement tbody', engagements);
}

function renderObjTable(selector, campaigns) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;

    if (campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:20px">Tidak ada data</td></tr>';
        return;
    }

    const sorted = [...campaigns].sort((a, b) => b.spend - a.spend);
    tbody.innerHTML = sorted.map(c => {
        const results = c.results || c.clicks || 0;
        const cpr = results > 0 ? Math.round(c.spend / results) : 0;
        const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0';
        return `<tr>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.campaign)}">${esc(c.campaign)}</td>
            <td class="r" style="font-weight:600">${rupiah(c.spend)}</td>
            <td class="r" style="font-weight:600">${num(results)}</td>
            <td class="r">${rupiah(cpr)}</td>
            <td class="r">${ctr}%</td>
        </tr>`;
    }).join('');
}

function renderExpenses() {
    const tbody = document.querySelector('#tblExpenses tbody');
    if (!tbody) return;

    const allTx = getMergedTransactions(BUSINESSES[state.currentBiz], state.currentBiz);
    const filtered = filterByDateRange(allTx, 'date');
    const expenses = filtered.filter(t => t.amount < 0 && t.cat !== 'Ads');
    const sorted = [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:20px">Belum ada pengeluaran non-iklan</td></tr>';
        return;
    }

    const catColors = { COGS: 'tag-purple', Ops: 'tag-blue', Legal: 'tag-amber', Other: 'tag-pink' };
    tbody.innerHTML = sorted.map(t => `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td>${esc(t.desc)}</td>
            <td><span class="tag ${catColors[t.cat] || 'tag-purple'}">${esc(t.cat)}</span></td>
            <td class="r" style="font-weight:600;color:var(--red)">${rupiah(t.amount)}</td>
        </tr>
    `).join('');
}

// ================================================
//  PAGE: STOCK
// ================================================

function renderStock(biz) {
    const sellableStock = biz.stock.filter(i => i.sellPrice > 0);
    const totalQty = biz.stock.reduce((s, i) => s + i.qty, 0);
    const totalBuyVal = biz.stock.reduce((s, i) => s + (i.qty * i.hpp), 0);
    const totalSellVal = sellableStock.reduce((s, i) => s + (i.qty * i.sellPrice), 0);
    const avgMargin = totalBuyVal > 0 ? Math.round(((totalSellVal - totalBuyVal) / totalSellVal) * 100) : 0;
    const lowStock = sellableStock.filter(i => i.qty > 0 && i.qty < 20).length;
    const manual = getManualData(state.currentBiz);
    const stockIn = manual.stockChanges.filter(s => s.type === 'in').reduce((sum, s) => sum + s.qty, 0);
    const stockOut = manual.stockChanges.filter(s => s.type === 'out').reduce((sum, s) => sum + s.qty, 0);

    document.getElementById('kpi-stk-sku').textContent = sellableStock.length;
    document.getElementById('kpi-stk-total').textContent = num(totalQty);
    document.getElementById('kpi-stk-buy').textContent = rupiah(totalBuyVal);
    document.getElementById('kpi-stk-val').textContent = rupiah(totalSellVal);
    document.getElementById('kpi-stk-margin').textContent = avgMargin + '%';
    document.getElementById('kpi-stk-in').textContent = stockIn + ' unit';
    document.getElementById('kpi-stk-out').textContent = stockOut + ' unit';
    document.getElementById('kpi-stk-low').textContent = lowStock;

    renderStockCharts(biz);
    renderStockTable(biz);
    renderStockLog();
}

function renderStockCharts(biz) {
    destroyChart('stockMove');
    destroyChart('assetVal');

    const textMuted = getCSSVar('--text-3');
    const labels = biz.stock.filter(i => i.sellPrice > 0).map(i => i.product.length > 15 ? i.product.slice(0, 15) + '..' : i.product);
    const qtys = biz.stock.filter(i => i.sellPrice > 0).map(i => i.qty);

    state.charts.stockMove = new Chart(document.getElementById('chartStockMove'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Stok', data: qtys, backgroundColor: 'rgba(37,99,235,0.6)', borderRadius: 5, borderSkipped: false }]
        },
        options: { ...chartOpts(textMuted), indexAxis: 'y', plugins: { legend: { display: false } } },
    });

    const buyVals = biz.stock.filter(i => i.sellPrice > 0).map(i => i.qty * i.hpp);
    const sellVals = biz.stock.filter(i => i.sellPrice > 0).map(i => i.qty * i.sellPrice);

    state.charts.assetVal = new Chart(document.getElementById('chartAssetVal'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Nilai Beli', data: buyVals, backgroundColor: 'rgba(217,119,6,0.6)', borderRadius: 4, borderSkipped: false },
                { label: 'Nilai Jual', data: sellVals, backgroundColor: 'rgba(5,150,105,0.6)', borderRadius: 4, borderSkipped: false },
            ]
        },
        options: chartOpts(textMuted),
    });
}

function renderStockTable(biz) {
    const tbody = document.querySelector('#tblStock tbody');
    tbody.innerHTML = biz.stock.map(i => {
        const statusClass = i.status === 'ok' ? 'stk-ok' : i.status === 'low' ? 'stk-low' : 'stk-out';
        const statusText = i.status === 'ok' ? 'Tersedia' : i.status === 'low' ? 'Stok Rendah' : i.status === 'dropship' ? 'Dropship' : 'Habis';
        const margin = i.sellPrice > 0 ? Math.round(((i.sellPrice - i.hpp) / i.sellPrice) * 100) : 0;
        return `<tr>
            <td style="font-weight:500">${esc(i.product)}</td>
            <td class="r">${i.qty}</td>
            <td class="r">${rupiah(i.hpp)}</td>
            <td class="r">${i.sellPrice ? rupiah(i.sellPrice) : '—'}</td>
            <td class="r" style="font-weight:600;color:${margin > 50 ? 'var(--green)' : 'var(--text-1)'}">${margin}%</td>
            <td class="r">${rupiah(i.qty * i.hpp)}</td>
            <td class="r">${i.sellPrice ? rupiah(i.qty * i.sellPrice) : '—'}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
        </tr>`;
    }).join('');
}

function renderStockLog() {
    const tbody = document.querySelector('#tblStockLog tbody');
    const manual = getManualData(state.currentBiz);
    const logs = [...manual.stockChanges].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:20px">Belum ada log. Klik "Input Stok" untuk mulai.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(s => {
        const total = s.qty * (s.hpp || 0);
        return `<tr>
            <td>${formatDate(s.date)}</td>
            <td style="font-weight:500">${esc(s.product)}</td>
            <td><span class="${s.type === 'in' ? 'stk-in' : 'stk-out-tag'}">${s.type === 'in' ? 'Masuk' : 'Keluar'}</span></td>
            <td class="r">${s.type === 'in' ? '+' : '-'}${s.qty}</td>
            <td class="r">${rupiah(s.hpp)}</td>
            <td class="r" style="font-weight:600">${rupiah(total)}</td>
        </tr>`;
    }).join('');
}

// ================================================
//  PAGE: PRODUCT
// ================================================

function renderProduct(biz) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = biz.products.map(p => `
        <div class="prod-card">
            <div class="prod-img">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
                ${p.badge ? `<span class="prod-badge">${esc(p.badge)}</span>` : ''}
            </div>
            <div class="prod-body">
                <div class="prod-name">${esc(p.name)}</div>
                <div class="prod-desc">${esc(p.desc)}</div>
                <div class="prod-prices">
                    <div class="prod-hpp">HPP: <span>${rupiah(p.hpp)}</span></div>
                    <div class="prod-sell">${rupiah(p.sell)}</div>
                </div>
            </div>
        </div>
    `).join('');

    const assetGrid = document.getElementById('assetGrid');
    assetGrid.innerHTML = biz.assets.map(a => `
        <div class="asset-card">
            <div class="asset-icon">${assetIcon(a.icon)}</div>
            <div class="asset-name">${esc(a.name)}</div>
            <div class="asset-type">${esc(a.type)}</div>
        </div>
    `).join('');
}

// ================================================
//  THEME
// ================================================

function initTheme() {
    const saved = localStorage.getItem('bc-theme') || 'light';
    applyTheme(saved);

    document.getElementById('themeToggle').addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('bc-theme', next);
        if (state.user) renderCurrentPage();
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const moon = document.querySelector('.icon-moon');
    const sun = document.querySelector('.icon-sun');
    if (theme === 'dark') {
        moon.style.display = 'none'; sun.style.display = '';
    } else {
        moon.style.display = ''; sun.style.display = 'none';
    }
}

// ================================================
//  UTILITIES
// ================================================

function rupiah(n) {
    if (n == null) return 'Rp0';
    const abs = Math.abs(Math.round(n));
    const formatted = 'Rp' + abs.toLocaleString('id-ID');
    return n < 0 ? '-' + formatted : formatted;
}

function num(n) { return (n || 0).toLocaleString('id-ID'); }

function formatDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
}

function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function destroyChart(key) {
    if (state.charts[key]) { state.charts[key].destroy(); state.charts[key] = null; }
}

function chartOpts(textMuted) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { position: 'top', align: 'end', labels: { usePointStyle: true, pointStyleWidth: 8, padding: 16, color: textMuted, font: { family: 'Inter', size: 11 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${rupiah(ctx.raw)}` } },
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' }, ticks: { callback: v => compact(v), color: textMuted, font: { family: 'Inter', size: 10 } } },
            x: { grid: { display: false }, ticks: { color: textMuted, font: { family: 'Inter', size: 10 } } },
        },
    };
}

function compact(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + ' Jt';
    if (n >= 1000) return (n / 1000).toFixed(0) + ' Rb';
    return n.toString();
}

function compactNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function toast(msg) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, 2500);
}

function channelIcon(type, color) {
    const icons = {
        ig: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="${color}" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.86 3.9 2.31 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 6.87A5.13 5.13 0 1 0 17.13 12 5.13 5.13 0 0 0 12 6.87zM12 15.33A3.33 3.33 0 1 1 15.33 12 3.33 3.33 0 0 1 12 15.33zM17.34 5.46a1.2 1.2 0 1 0 1.2 1.2 1.2 1.2 0 0 0-1.2-1.2z"/></svg>`,
        fb: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="${color}" d="M24 12a12 12 0 1 0-13.88 11.85v-8.39H7.08V12h3.04V9.41c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.33l-.53 3.46h-2.8v8.39A12 12 0 0 0 24 12z"/></svg>`,
        tt: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="${color}" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 4.16-3.56V10.2a6.37 6.37 0 0 0-1-.08A6.27 6.27 0 0 0 5 16.4a6.27 6.27 0 0 0 10.91 4.23A6.22 6.22 0 0 0 18 16.4V9.08a8.22 8.22 0 0 0 4.83 1.56V7.19a4.85 4.85 0 0 1-3.24-0.5z"/></svg>`,
        google: `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="${color}" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`,
        shopee: `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">S</text></svg>`,
        tokped: `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">T</text></svg>`,
        grab: `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">G</text></svg>`,
    };
    return icons[type] || `<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}"/></svg>`;
}

// ================================================
//  PAGE: ASSET OPERASIONAL
// ================================================

function renderOpAssets() {
    const data = getManualData(state.currentBiz);
    const assets = data.opAssets || [];

    const totalItems = assets.length;
    const totalCost = assets.reduce((s, a) => s + ((a.price || 0) * (a.qty || 1)), 0);
    const active = assets.filter(a => a.condition === 'Baik').length;
    const needReplace = assets.filter(a => a.condition === 'Rusak' || a.condition === 'Perlu Perbaikan').length;

    document.getElementById('kpi-oa-total').textContent = totalItems;
    document.getElementById('kpi-oa-cost').textContent = rupiah(totalCost);
    document.getElementById('kpi-oa-active').textContent = active;
    document.getElementById('kpi-oa-replace').textContent = needReplace;

    // Assets table
    const tbody = document.querySelector('#tblAssets tbody');
    if (assets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:24px">Belum ada aset. Klik "Tambah Aset" untuk mulai pencatatan.</td></tr>';
    } else {
        const sorted = [...assets].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        tbody.innerHTML = sorted.map(a => {
            const condClass = a.condition === 'Baik' ? 'stk-ok' : a.condition === 'Rusak' ? 'stk-out' : 'stk-low';
            const catColors = { Peralatan: 'tag-purple', Elektronik: 'tag-blue', Furniture: 'tag-amber', Kendaraan: 'tag-green', Perlengkapan: 'tag-pink', Lainnya: 'tag-purple' };
            return `<tr>
                <td style="font-weight:500">${esc(a.name)}</td>
                <td><span class="tag ${catColors[a.category] || 'tag-purple'}">${esc(a.category)}</span></td>
                <td>${formatDate(a.date)}</td>
                <td class="r" style="font-weight:600">${rupiah(a.price)}</td>
                <td class="r">${a.qty || 1}</td>
                <td><span class="${condClass}">${esc(a.condition)}</span></td>
                <td style="color:var(--text-3);font-size:0.82rem">${esc(a.note || '—')}</td>
            </tr>`;
        }).join('');
    }

    // Op expenses table
    const allTx = getMergedTransactions(BUSINESSES[state.currentBiz], state.currentBiz);
    const opExpenses = allTx.filter(t => t.amount < 0 && (t.cat === 'Ops' || t.cat === 'Other'));
    const filtered = filterByDateRange(opExpenses, 'date');
    const tbodyOp = document.querySelector('#tblOpExpenses tbody');

    if (filtered.length === 0) {
        tbodyOp.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:20px">Belum ada pengeluaran operasional</td></tr>';
    } else {
        const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        tbodyOp.innerHTML = sorted.map(t => `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td>${esc(t.desc)}</td>
                <td><span class="tag tag-blue">${esc(t.cat)}</span></td>
                <td class="r" style="font-weight:600;color:var(--red)">${rupiah(t.amount)}</td>
            </tr>
        `).join('');
    }
}

function initAssetModal() {
    const overlay = document.getElementById('assetModalOverlay');
    if (!overlay) return;

    const closeBtn = document.getElementById('assetModalClose');
    const addBtn = document.getElementById('addAssetBtn');

    if (addBtn) addBtn.addEventListener('click', () => overlay.classList.add('show'));
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });

    document.getElementById('inAssetDate').value = new Date().toISOString().slice(0, 10);

    document.getElementById('formAsset').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = getManualData(state.currentBiz);
        data.opAssets.push({
            id: Date.now().toString(36),
            name: document.getElementById('inAssetName').value,
            category: document.getElementById('inAssetCat').value,
            condition: document.getElementById('inAssetCondition').value,
            date: document.getElementById('inAssetDate').value,
            price: parseInt(document.getElementById('inAssetPrice').value) || 0,
            qty: parseInt(document.getElementById('inAssetQty').value) || 1,
            note: document.getElementById('inAssetNote').value,
        });
        saveManualData(state.currentBiz, data);
        e.target.reset();
        document.getElementById('inAssetDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('inAssetQty').value = '1';
        overlay.classList.remove('show');
        renderCurrentPage();
        toast('Aset operasional berhasil ditambahkan');
    });
}

function assetIcon(type) {
    const icons = {
        file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
        image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
        palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12" r="0.5" fill="currentColor"/><path d="M12 2a10 10 0 0 0-1 19.8c1 .1 1.5-.8 1.5-1.5 0-.5 0-1.8 0-3.5-1.3.3-2-.3-2.5-1-.2-.3-.8-1-1.3-1.2-.5-.3-1.2-.9 0-.9s1.1 1 1.2 1.4c.7 1.2 1.9.8 2.3.6.1-.5.4-.9.7-1.1-2.4-.3-5-1.2-5-5.4 0-1.2.4-2.2 1-3-.1-.3-.5-1.4.1-3 0 0 .8-.3 2.8 1.2.8-.2 1.7-.3 2.6-.3s1.7.1 2.5.3c2-1.4 2.8-1.1 2.8-1.1.6 1.5.2 2.7.1 3 .7.8 1 1.8 1 3 0 4.3-2.6 5.1-5 5.4.4.3.7 1 .7 2v3c0 .7.5 1.5 1.4 1.3A10 10 0 0 0 12 2z"/></svg>',
        book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    };
    return icons[type] || icons.file;
}
