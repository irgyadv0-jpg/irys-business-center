/* ================================================
   Business Center — App Logic
   Auth, Multi-business, Charts, Data
   ================================================ */

// ---- Auth Config ----
const USERS = [
    { email: 'owner@irys.com', password: 'owner123', name: 'Owner', role: 'owner', avatar: 'O' },
    { email: 'admin@irys.com', password: 'admin123', name: 'Admin', role: 'admin', avatar: 'A' },
    { email: 'cs@irys.com', password: 'cs123', name: 'Customer Service', role: 'cs', avatar: 'C' },
    { email: 'kreator@irys.com', password: 'kreator123', name: 'Konten Kreator', role: 'kreator', avatar: 'K' },
];

const ROLE_ACCESS = {
    owner:   { label: 'Full Access', canEdit: true, seeHPP: true, isAdmin: true },
    admin:   { label: 'Admin', canEdit: true, seeHPP: true, isAdmin: false },
    cs:      { label: 'Customer Service', canEdit: false, seeHPP: false, isAdmin: false },
    kreator: { label: 'Konten Kreator', canEdit: false, seeHPP: false, isAdmin: false },
};

// ---- Business Config with per-business nav ----
const EMPTY_BIZ = { overview: { revenue:0,expense:0,profit:0,roas:0,cogs:0,adSpend:0,stock:0,assetValue:0 }, channels:[], spendDetail:[], stock:[], products:[], assets:[], transactions:[], chartRevExp:{ labels:[], revenue:[], expense:[] } };

const BUSINESSES = {
    irys: {
        name: 'IRYS Fragrance', color: '#7C3AED', colorSoft: 'rgba(124,58,237,0.08)', accent: '#A78BFA', fontClass: 'theme-irys', tagline: 'Parfum & Body Care', type: 'fragrance',
        pages: [
            { id: 'overview', label: 'Overview', icon: 'grid' },
            { id: 'spend', label: 'Ad Spend', icon: 'trending' },
            { id: 'stock', label: 'Stok & Inventori', icon: 'box' },
            { id: 'product', label: 'Produk & Konten', icon: 'bag' },
            { id: 'integrations', label: 'Integrasi Hub', icon: 'link' },
        ],
        integrations: ['meta_ads','tiktok_ads','google_ads','shopee','tiktokshop'],
        ...EMPTY_BIZ,
    },
    dropship: {
        name: 'Dropship Marketplace', color: '#2563EB', colorSoft: 'rgba(37,99,235,0.08)', accent: '#60A5FA', fontClass: 'theme-dropship', tagline: 'Reseller & Dropship', type: 'marketplace',
        pages: [
            { id: 'overview', label: 'Overview', icon: 'grid' },
            { id: 'spend', label: 'Ad Spend', icon: 'trending' },
            { id: 'stock', label: 'Stok & Inventori', icon: 'box' },
            { id: 'product', label: 'Produk & Konten', icon: 'bag' },
            { id: 'integrations', label: 'Integrasi Hub', icon: 'link' },
        ],
        integrations: ['meta_ads','tiktok_ads','google_ads','shopee'],
        ...EMPTY_BIZ,
    },
    matcha: {
        name: 'Toko Matcha', color: '#059669', colorSoft: 'rgba(5,150,105,0.08)', accent: '#34D399', fontClass: 'theme-matcha', tagline: 'F&B Matcha', type: 'fnb',
        pages: [
            { id: 'overview', label: 'Overview', icon: 'grid' },
            { id: 'spend', label: 'Data Penjualan', icon: 'trending' },
            { id: 'stock', label: 'Stok & Modal', icon: 'box' },
            { id: 'opasset', label: 'Asset Operasional', icon: 'asset' },
            { id: 'integrations', label: 'Integrasi Hub', icon: 'link' },
        ],
        integrations: ['shopeefood','grabfood','gojek'],
        ...EMPTY_BIZ,
    },
};

// Dynamic user management (localStorage-backed)
function getUsers() {
    const saved = localStorage.getItem('bc-users');
    if (saved) return JSON.parse(saved);
    const defaults = [
        { email: 'owner@irys.com', password: 'owner123', name: 'Owner', role: 'owner', avatar: 'O', businesses: ['irys','dropship','matcha'] },
        { email: 'admin@irys.com', password: 'admin123', name: 'Admin', role: 'admin', avatar: 'A', businesses: ['irys','dropship','matcha'] },
        { email: 'cs@irys.com', password: 'cs123', name: 'Customer Service', role: 'cs', avatar: 'C', businesses: ['irys'] },
        { email: 'kreator@irys.com', password: 'kreator123', name: 'Konten Kreator', role: 'kreator', avatar: 'K', businesses: ['irys'] },
    ];
    localStorage.setItem('bc-users', JSON.stringify(defaults));
    return defaults;
}

function saveUsers(users) { localStorage.setItem('bc-users', JSON.stringify(users)); }

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
    const defaults = { transactions: [], spendDetail: [], stockChanges: [], opAssets: [], products: [], integrations: [] };
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
}

function saveManualData(bizKey, data) {
    localStorage.setItem(`bc-data-${bizKey}`, JSON.stringify(data));
}

function getMergedTransactions(biz, bizKey) {
    const manual = getManualData(bizKey);
    const liveSpend = (state.liveSpendByBiz && state.liveSpendByBiz[bizKey]) || [];
    const liveTx = liveSpend.map(d => ({
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
    const live = (state.liveSpendByBiz && state.liveSpendByBiz[bizKey]) || [];
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
        const user = getUsers().find(u => u.email === email && u.password === pass);

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
    const avatarEl = document.getElementById('userAvatar');
    if (state.user.photo) {
        avatarEl.innerHTML = `<img src="${state.user.photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
        avatarEl.textContent = state.user.avatar;
    }

    applyRoleAccess();
    initSidebar();
    initNav();
    initDateRange();
    initBizSelector();
    rebuildBizDropdown();
    initRefresh();
    initModal();
    initAssetModal();
    initProductModal();
    initAdminPanel();
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
    const role = ROLE_ACCESS[state.user.role] || ROLE_ACCESS.cs;
    document.getElementById('userRole').textContent = role.label;
    rebuildNav();
}

const NAV_ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    trending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 2 9 4.5v11L12 22l-9-4.5v-11L12 2z"/><path d="M12 22V12"/><path d="m3 6.5 9 5.5 9-5.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>',
    asset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 20h20"/><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M12 8V4"/><path d="M8 4h8"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

function rebuildNav() {
    const nav = document.querySelector('.sidebar-nav');
    const biz = BUSINESSES[state.currentBiz];
    const role = ROLE_ACCESS[state.user.role] || ROLE_ACCESS.cs;
    const bizPages = biz.pages || [];

    // Role-based page filtering
    const rolePageFilter = {
        owner: null,
        admin: ['overview','spend','stock','opasset'],
        cs: ['overview','product','stock'],
        kreator: ['product'],
    };
    const allowed = rolePageFilter[state.user.role];

    let html = '';
    bizPages.forEach(p => {
        if (allowed && !allowed.includes(p.id)) return;
        const isActive = p.id === state.currentPage ? ' active' : '';
        html += `<button class="nav-btn${isActive}" data-page="${p.id}">${NAV_ICONS[p.icon] || NAV_ICONS.grid}<span>${p.label}</span></button>`;
    });

    // Admin Panel (owner only)
    if (role.isAdmin) {
        html += '<div style="height:1px;background:var(--border);margin:8px 0"></div>';
        const isActive = state.currentPage === 'adminpanel' ? ' active' : '';
        html += `<button class="nav-btn${isActive}" data-page="adminpanel">${NAV_ICONS.admin}<span>Admin Panel</span></button>`;
    }

    nav.innerHTML = html;

    // Re-attach click handlers
    nav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentPage = btn.dataset.page;
            nav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCurrentPage();
            closeSidebar();
        });
    });

    // Validate current page
    const allPageIds = [...bizPages.map(p => p.id), 'adminpanel'];
    if (!allPageIds.includes(state.currentPage)) {
        state.currentPage = bizPages[0]?.id || 'overview';
    }

    // Hide add buttons for non-edit roles
    setTimeout(() => {
        document.querySelectorAll('.btn-add, .btn-add-sm, #addDataBtn').forEach(btn => {
            btn.style.display = role.canEdit ? '' : 'none';
        });
    }, 100);
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
    const dropdown = document.getElementById('bizDropdown');

    current.addEventListener('click', () => selector.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) selector.classList.remove('open');
    });

    rebuildBizDropdown();
}

function rebuildBizDropdown() {
    const dropdown = document.getElementById('bizDropdown');
    const userBizList = (state.user && state.user.businesses) || Object.keys(BUSINESSES);
    const role = ROLE_ACCESS[state.user?.role] || {};

    // Owner sees all
    const accessibleBiz = role.isAdmin ? Object.keys(BUSINESSES) : userBizList;

    dropdown.innerHTML = accessibleBiz.map(key => {
        const biz = BUSINESSES[key];
        if (!biz) return '';
        const isActive = key === state.currentBiz ? ' active' : '';
        return `<button class="biz-option${isActive}" data-biz="${key}">
            <span class="biz-dot" style="background:${biz.color}"></span>
            <div><strong>${biz.name}</strong><small>${biz.tagline}</small></div>
        </button>`;
    }).join('');

    // If current biz not in accessible list, switch to first available
    if (!accessibleBiz.includes(state.currentBiz)) {
        state.currentBiz = accessibleBiz[0] || 'irys';
        const biz = BUSINESSES[state.currentBiz];
        document.querySelector('#bizCurrent .biz-name').textContent = biz.name;
        document.querySelector('#bizCurrent .biz-dot').style.background = biz.color;
    }

    // Attach click handlers
    dropdown.querySelectorAll('.biz-option').forEach(opt => {
        opt.addEventListener('click', () => {
            state.currentBiz = opt.dataset.biz;
            const biz = BUSINESSES[state.currentBiz];

            dropdown.querySelectorAll('.biz-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            document.querySelector('#bizCurrent .biz-name').textContent = biz.name;
            document.querySelector('#bizCurrent .biz-dot').style.background = biz.color;

            document.getElementById('bizSelector').classList.remove('open');
            state.currentPage = biz.pages[0]?.id || 'overview';
            rebuildNav();
            renderCurrentPage();
            toast(`Beralih ke ${biz.name}`);
        });
    });

    // Hide selector entirely if only 1 business
    document.getElementById('bizSelector').style.display = accessibleBiz.length <= 1 ? 'none' : '';
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
        const metaTokens = getAllTokensForIntegration('meta_ads');
        const tokenParam = metaTokens['META_ACCESS_TOKEN'] ? `&token=${encodeURIComponent(metaTokens['META_ACCESS_TOKEN'])}` : '';
        const bmParam = metaTokens['META_BUSINESS_ID atau META_AD_ACCOUNT_ID'] ? `&bm_id=${encodeURIComponent(metaTokens['META_BUSINESS_ID atau META_AD_ACCOUNT_ID'])}` : '';
        const res = await fetch(`/api/meta-ads?action=insights&date_from=${dateFrom}&date_to=${dateTo}${tokenParam}${bmParam}`);
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
            if (!state.liveSpendByBiz) state.liveSpendByBiz = {};
            state.liveSpendByBiz[state.currentBiz] = liveSpend;
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
            if (tab.dataset.mtab === 'stok') populateStockProductDropdown();
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
            populateStockProductDropdown();
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

function populateStockProductDropdown() {
    const select = document.getElementById('inStkProduct');
    if (!select) return;
    const data = getManualData(state.currentBiz);
    const products = data.products || [];
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- Pilih produk --</option>';
    if (products.length === 0) {
        select.innerHTML = '<option value="">Belum ada produk — buat dulu di Produk & Konten</option>';
        return;
    }
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = `${p.name}${p.sku ? ' (' + p.sku + ')' : ''}`;
        select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
}

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

    // Get title from current business page config
    const bizPages = BUSINESSES[state.currentBiz].pages || [];
    const currentPageConfig = bizPages.find(p => p.id === state.currentPage);
    const fallbackTitles = { overview: 'Overview', spend: 'Ad Spend', stock: 'Stok & Inventori', product: 'Produk & Konten', opasset: 'Asset Operasional', integrations: 'Integrasi Hub', adminpanel: 'Admin Panel' };
    const titles = fallbackTitles;
    document.getElementById('pageTitle').textContent = (currentPageConfig && currentPageConfig.label) || titles[state.currentPage] || 'Overview';

    const biz = BUSINESSES[state.currentBiz];
    document.documentElement.style.setProperty('--purple', biz.color);
    document.documentElement.style.setProperty('--purple-soft', biz.colorSoft || 'rgba(124,58,237,0.08)');
    document.body.className = biz.fontClass || '';

    switch (state.currentPage) {
        case 'overview': renderOverview(biz); break;
        case 'spend': renderSpend(biz); break;
        case 'stock': renderStock(biz); break;
        case 'product': renderProduct(biz); break;
        case 'opasset': renderOpAssets(); break;
        case 'integrations': renderIntegrations(); break;
        case 'adminpanel': renderAdminPanel(); break;
    }
}

// ================================================
//  PAGE: OVERVIEW
// ================================================

function renderOverview(biz) {
    const allTx = getMergedTransactions(biz, state.currentBiz);
    const filtered = filterByDateRange(allTx, 'date');
    const data = getManualData(state.currentBiz);

    const revenue = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const profit = revenue - expense;
    const adSpend = filtered.filter(t => t.cat === 'Ads').reduce((s, t) => s + Math.abs(t.amount), 0);
    const cogs = filtered.filter(t => t.cat === 'COGS').reduce((s, t) => s + Math.abs(t.amount), 0);
    const roas = adSpend > 0 ? (revenue / adSpend).toFixed(1) : '0';

    // Stock from manual products
    const products = data.products || [];
    const totalStock = products.reduce((s, p) => s + (p.qty || 0), 0);
    const assetValue = products.reduce((s, p) => s + ((p.sell || 0) * (p.qty || 0)), 0);

    // Op assets value
    const opAssetValue = (data.opAssets || []).reduce((s, a) => s + ((a.price || 0) * (a.qty || 1)), 0);

    document.getElementById('kpi-revenue').textContent = rupiah(revenue);
    document.getElementById('kpi-expense').textContent = rupiah(expense);
    document.getElementById('kpi-profit').textContent = rupiah(profit);
    document.getElementById('kpi-roas').textContent = roas + 'x';
    const ops = filtered.filter(t => t.cat === 'Ops' || t.cat === 'Sewa').reduce((s, t) => s + Math.abs(t.amount), 0);
    const gaji = filtered.filter(t => t.cat === 'Gaji' || t.cat === 'Prive').reduce((s, t) => s + Math.abs(t.amount), 0);
    const packaging = filtered.filter(t => t.cat === 'Packaging').reduce((s, t) => s + Math.abs(t.amount), 0);
    const other = filtered.filter(t => t.amount < 0 && !['COGS','Ads','Ops','Sewa','Gaji','Prive','Packaging','Legal'].includes(t.cat)).reduce((s, t) => s + Math.abs(t.amount), 0);

    document.getElementById('kpi-cogs').textContent = rupiah(cogs);
    document.getElementById('kpi-adspend').textContent = rupiah(adSpend);
    document.getElementById('kpi-ops').textContent = rupiah(ops);
    document.getElementById('kpi-gaji').textContent = rupiah(gaji);
    document.getElementById('kpi-stock').textContent = (products.length || 0) + ' SKU';
    document.getElementById('kpi-asset').textContent = rupiah(assetValue + opAssetValue);
    document.getElementById('kpi-packaging').textContent = rupiah(packaging);
    document.getElementById('kpi-other').textContent = rupiah(other);

    renderChannelGrid(biz);
    renderBizCustomSection(biz, data, filtered);
    renderRecentTable(biz);
    renderOverviewCharts(biz);
}

function renderChannelGrid(biz) {
    const grid = document.getElementById('channelGrid');
    const allSpend = getMergedSpend(biz, state.currentBiz);
    const filtered = filterByDateRange(allSpend, 'date');

    // Build channel data from actual spend data
    const byPlatform = {};
    filtered.forEach(s => {
        const p = s.platform || 'Other';
        if (!byPlatform[p]) byPlatform[p] = { name: p, spend: 0 };
        byPlatform[p].spend += (s.spend || 0);
    });

    const platformColors = { Instagram: '#E4405F', TikTok: '#FF004F', Facebook: '#1877F2', Meta: '#1877F2', Google: '#4285F4', Shopee: '#EE4D2D', Tokopedia: '#42B549', GrabFood: '#00B14F' };
    const platformIcons = { Instagram: 'ig', TikTok: 'tt', Facebook: 'fb', Meta: 'fb', Google: 'google', Shopee: 'shopee', Tokopedia: 'tokped', GrabFood: 'grab' };

    const channels = Object.values(byPlatform).sort((a, b) => b.spend - a.spend);

    if (channels.length === 0) {
        grid.innerHTML = '<div style="padding:16px;color:var(--text-3);font-size:0.85rem">Belum ada data spend. Input via Ad Spend atau connect Meta Ads API.</div>';
        return;
    }

    grid.innerHTML = channels.map(ch => {
        const color = platformColors[ch.name] || '#7C3AED';
        const icon = platformIcons[ch.name] || 'fb';
        return `<div class="channel-card">
            <div class="ch-icon" style="background:${color}15">${channelIcon(icon, color)}</div>
            <div class="ch-info">
                <div class="ch-name">${esc(ch.name)} Ads</div>
                <div class="ch-value">${rupiah(ch.spend)}</div>
            </div>
        </div>`;
    }).join('');
}

// ================================================
//  BUSINESS-SPECIFIC SECTIONS
// ================================================

function renderBizCustomSection(biz, data, transactions) {
    const el = document.getElementById('bizCustomSection');
    if (!el) return;

    if (biz.type === 'marketplace') {
        el.innerHTML = renderMarketplaceSection(data, transactions);
    } else if (biz.type === 'fnb') {
        el.innerHTML = renderFnbSection(data, transactions);
    } else {
        el.innerHTML = '';
    }
}

function renderMarketplaceSection(data, transactions) {
    const revenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const gmv = revenue;
    const ppn = Math.round(gmv * 0.11);
    const adminFee = Math.round(gmv * 0.06);
    const hpp = transactions.filter(t => t.cat === 'COGS').reduce((s, t) => s + Math.abs(t.amount), 0);
    const adSpend = transactions.filter(t => t.cat === 'Ads').reduce((s, t) => s + Math.abs(t.amount), 0);
    const ongkir = transactions.filter(t => t.cat === 'Ops').reduce((s, t) => s + Math.abs(t.amount), 0);
    const netProfit = gmv - ppn - adminFee - hpp - adSpend - ongkir;

    return `
    <div class="card" style="margin-bottom:20px">
        <div class="card-head"><h3>Marketplace Performance</h3><span class="tag tag-blue">Dropship</span></div>
        <div style="padding:20px">
            <div class="kpi-row" style="margin-bottom:16px">
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">GMV (Penjualan)</span></div><div class="kpi-value">${rupiah(gmv)}</div></div>
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">PPN 11%</span></div><div class="kpi-value" style="color:var(--red)">-${rupiah(ppn)}</div></div>
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Admin Fee ~6%</span></div><div class="kpi-value" style="color:var(--red)">-${rupiah(adminFee)}</div></div>
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Net Profit</span></div><div class="kpi-value" style="color:${netProfit>=0?'var(--green)':'var(--red)'}">${rupiah(netProfit)}</div></div>
            </div>
            <div class="table-wrap">
                <table class="tbl">
                    <thead><tr><th>Item</th><th class="r">Nominal</th><th class="r">%</th></tr></thead>
                    <tbody>
                        <tr><td style="font-weight:600">GMV (Total Penjualan)</td><td class="r" style="font-weight:700;color:var(--green)">${rupiah(gmv)}</td><td class="r">100%</td></tr>
                        <tr><td>PPN 11%</td><td class="r" style="color:var(--red)">-${rupiah(ppn)}</td><td class="r">11%</td></tr>
                        <tr><td>Admin Fee Marketplace</td><td class="r" style="color:var(--red)">-${rupiah(adminFee)}</td><td class="r">~6%</td></tr>
                        <tr><td>HPP Produk</td><td class="r" style="color:var(--red)">-${rupiah(hpp)}</td><td class="r">${gmv>0?Math.round(hpp/gmv*100):0}%</td></tr>
                        <tr><td>Ad Spend</td><td class="r" style="color:var(--red)">-${rupiah(adSpend)}</td><td class="r">${gmv>0?Math.round(adSpend/gmv*100):0}%</td></tr>
                        <tr><td>Ongkir & Ops</td><td class="r" style="color:var(--red)">-${rupiah(ongkir)}</td><td class="r">${gmv>0?Math.round(ongkir/gmv*100):0}%</td></tr>
                        <tr style="border-top:2px solid var(--border)"><td style="font-weight:800">NET PROFIT</td><td class="r" style="font-weight:800;color:${netProfit>=0?'var(--green)':'var(--red)'}">${rupiah(netProfit)}</td><td class="r" style="font-weight:700">${gmv>0?Math.round(netProfit/gmv*100):0}%</td></tr>
                    </tbody>
                </table>
            </div>
            <p style="font-size:0.75rem;color:var(--text-3);margin-top:12px">* Admin fee bervariasi per marketplace. Sesuaikan di input transaksi untuk akurasi.</p>
        </div>
    </div>`;
}

function renderFnbSection(data, transactions) {
    const bahanBaku = (data.stockChanges || []).filter(s => s.type === 'in');
    const totalBahanBaku = bahanBaku.reduce((s, b) => s + ((b.hpp || 0) * (b.qty || 0)), 0);

    const revenue = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const hpp = transactions.filter(t => t.cat === 'COGS').reduce((s, t) => s + Math.abs(t.amount), 0);
    const ops = transactions.filter(t => t.cat === 'Ops' || t.cat === 'Other').reduce((s, t) => s + Math.abs(t.amount), 0);
    const grossProfit = revenue - hpp;
    const netProfit = grossProfit - ops;

    const onlineCommission = 0.30;
    const offlineMargin = hpp > 0 ? Math.round(((revenue - hpp) / revenue) * 100) : 0;
    const onlineRevAfterComm = Math.round(revenue * (1 - onlineCommission));
    const onlineMargin = onlineRevAfterComm > 0 ? Math.round(((onlineRevAfterComm - hpp) / onlineRevAfterComm) * 100) : 0;

    const products = data.products || [];
    const recipeHtml = products.length > 0 ? products.map(p => {
        const margin = p.sell > 0 ? Math.round(((p.sell - p.hpp) / p.sell) * 100) : 0;
        const onlineSell = Math.round(p.sell * (1 - onlineCommission));
        const onlineMarginP = onlineSell > 0 ? Math.round(((onlineSell - p.hpp) / onlineSell) * 100) : 0;
        return `<tr>
            <td style="font-weight:500">${esc(p.name)}</td>
            <td class="r">${rupiah(p.hpp)}</td>
            <td class="r">${rupiah(p.sell)}</td>
            <td class="r" style="font-weight:600;color:${margin>40?'var(--green)':'var(--amber)'}"><span>${margin}%</span></td>
            <td class="r">${rupiah(onlineSell)}</td>
            <td class="r" style="color:${onlineMarginP>20?'var(--green)':'var(--red)'}">${onlineMarginP}%</td>
        </tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:16px">Tambahkan produk untuk lihat kalkulasi margin</td></tr>';

    return `
    <div class="grid-2" style="margin-bottom:20px">
        <div class="card">
            <div class="card-head"><h3>Laba Rugi F&B</h3><span class="tag tag-green">Matcha</span></div>
            <div style="padding:20px">
                <table class="tbl">
                    <tbody>
                        <tr><td style="font-weight:600">Pendapatan</td><td class="r" style="font-weight:700;color:var(--green)">${rupiah(revenue)}</td></tr>
                        <tr><td>HPP / Bahan Baku</td><td class="r" style="color:var(--red)">-${rupiah(hpp)}</td></tr>
                        <tr style="border-top:2px solid var(--border)"><td style="font-weight:700">Laba Kotor</td><td class="r" style="font-weight:700">${rupiah(grossProfit)}</td></tr>
                        <tr><td>Biaya Operasional</td><td class="r" style="color:var(--red)">-${rupiah(ops)}</td></tr>
                        <tr style="border-top:2px solid var(--border)"><td style="font-weight:800">Laba Bersih</td><td class="r" style="font-weight:800;color:${netProfit>=0?'var(--green)':'var(--red)'}">${rupiah(netProfit)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card">
            <div class="card-head"><h3>Stok Bahan Baku</h3></div>
            <div style="padding:20px">
                <div class="kpi-row">
                    <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Total Pembelian Bahan</span></div><div class="kpi-value">${rupiah(totalBahanBaku)}</div></div>
                    <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Item Bahan Baku</span></div><div class="kpi-value">${bahanBaku.length}</div></div>
                </div>
                <p style="font-size:0.78rem;color:var(--text-3);margin-top:12px">Input bahan baku via Stok & Inventori → Input Stok</p>
            </div>
        </div>
    </div>
    <div class="card" style="margin-bottom:20px">
        <div class="card-head"><h3>Margin Jual: Offline vs Online (GrabFood/GoFood)</h3></div>
        <div style="padding:20px">
            <div class="kpi-row" style="margin-bottom:16px">
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Margin Offline</span></div><div class="kpi-value" style="color:var(--green)">${offlineMargin}%</div></div>
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Margin Online (-30% komisi)</span></div><div class="kpi-value" style="color:${onlineMargin>20?'var(--green)':'var(--red)'}">${onlineMargin}%</div></div>
                <div class="kpi kpi-sm"><div class="kpi-top"><span class="kpi-label">Komisi Merchant</span></div><div class="kpi-value">30%</div></div>
            </div>
            <div class="table-wrap">
                <table class="tbl">
                    <thead><tr><th>Produk</th><th class="r">HPP</th><th class="r">Harga Jual</th><th class="r">Margin Offline</th><th class="r">Harga Setelah Komisi</th><th class="r">Margin Online</th></tr></thead>
                    <tbody>${recipeHtml}</tbody>
                </table>
            </div>
            <p style="font-size:0.75rem;color:var(--text-3);margin-top:12px">* Komisi merchant online food rata-rata 30%. Sesuaikan harga online agar margin tetap sehat.</p>
        </div>
    </div>`;
}

function renderRecentTable(biz) {
    const tbody = document.querySelector('#tblRecent tbody');
    const allTx = getMergedTransactions(biz, state.currentBiz);
    const filtered = filterByDateRange(allTx, 'date');
    const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tbody.innerHTML = sorted.slice(0, 8).map(t => {
        const isIncome = t.amount > 0;
        const catColorMap = { Revenue: 'tag-green', COGS: 'tag-purple', Ads: 'tag-pink', Ops: 'tag-blue', Gaji: 'tag-amber', Sewa: 'tag-amber', Legal: 'tag-amber', Prive: 'tag-red', Packaging: 'tag-blue', Other: 'tag-purple' };
        const catClass = catColorMap[t.cat] || 'tag-purple';
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

    const textMuted = getCSSVar('--text-3');
    const allTx = getMergedTransactions(biz, state.currentBiz);
    const filtered = filterByDateRange(allTx, 'date');

    // Build daily revenue vs expense from real data
    const byDate = {};
    filtered.forEach(t => {
        if (!t.date) return;
        if (!byDate[t.date]) byDate[t.date] = { rev: 0, exp: 0 };
        if (t.amount > 0) byDate[t.date].rev += t.amount;
        else byDate[t.date].exp += Math.abs(t.amount);
    });

    const sortedDates = Object.keys(byDate).sort();
    const labels = sortedDates.map(d => formatDateShort(d));
    const revData = sortedDates.map(d => byDate[d].rev);
    const expData = sortedDates.map(d => byDate[d].exp);

    if (labels.length > 0) {
        state.charts.revexp = new Chart(document.getElementById('chartRevExp'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Revenue', data: revData, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.08)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#059669', borderWidth: 2 },
                    { label: 'Expense', data: expData, borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.05)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#DC2626', borderWidth: 2 },
                ]
            },
            options: chartOpts(textMuted),
        });
    }

    // Breakdown from real transactions
    const cats = {};
    filtered.forEach(t => {
        if (t.amount < 0) cats[t.cat || 'Other'] = (cats[t.cat || 'Other'] || 0) + Math.abs(t.amount);
    });

    const catColors = { COGS: '#7C3AED', Ads: '#DB2777', Ops: '#2563EB', Gaji: '#D97706', Sewa: '#92400E', Legal: '#CA8A04', Prive: '#DC2626', Packaging: '#0891B2', Revenue: '#059669', Other: '#A1A1AA' };

    if (Object.keys(cats).length > 0) {
        state.charts.breakdown = new Chart(document.getElementById('chartBreakdown'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(cats),
                datasets: [{ data: Object.values(cats), backgroundColor: Object.keys(cats).map(k => catColors[k] || '#A1A1AA'), borderWidth: 0, spacing: 2, borderRadius: 3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8, color: textMuted, font: { family: 'Inter', size: 11 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${rupiah(ctx.raw)}` } } } },
        });
    }

    function formatDateShort(d) {
        try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); }
        catch { return d; }
    }
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
    const manual = getManualData(state.currentBiz);
    const products = manual.products || [];

    // Build inventory from products + stock changes
    const inventory = products.filter(p => p.sell > 0).map(p => ({
        product: p.name, qty: p.qty || 0, hpp: p.hpp || 0, sellPrice: p.sell || 0,
        status: (p.qty || 0) === 0 ? 'out' : (p.qty || 0) < 20 ? 'low' : 'ok'
    }));

    // Merge with hardcoded biz.stock if any
    const allStock = [...biz.stock, ...inventory];

    const sellable = allStock.filter(i => i.sellPrice > 0);
    const totalQty = allStock.reduce((s, i) => s + (i.qty || 0), 0);
    const totalBuyVal = allStock.reduce((s, i) => s + ((i.qty || 0) * (i.hpp || 0)), 0);
    const totalSellVal = sellable.reduce((s, i) => s + ((i.qty || 0) * (i.sellPrice || 0)), 0);
    const avgMargin = totalSellVal > 0 ? Math.round(((totalSellVal - totalBuyVal) / totalSellVal) * 100) : 0;
    const lowStock = sellable.filter(i => (i.qty || 0) > 0 && (i.qty || 0) < 20).length;

    const filteredChanges = filterByDateRange(manual.stockChanges, 'date');
    const stockIn = filteredChanges.filter(s => s.type === 'in').reduce((sum, s) => sum + (s.qty || 0), 0);
    const stockOut = filteredChanges.filter(s => s.type === 'out').reduce((sum, s) => sum + (s.qty || 0), 0);

    document.getElementById('kpi-stk-sku').textContent = sellable.length;
    document.getElementById('kpi-stk-total').textContent = num(totalQty);
    document.getElementById('kpi-stk-buy').textContent = rupiah(totalBuyVal);
    document.getElementById('kpi-stk-val').textContent = rupiah(totalSellVal);
    document.getElementById('kpi-stk-margin').textContent = avgMargin + '%';
    document.getElementById('kpi-stk-in').textContent = stockIn + ' unit';
    document.getElementById('kpi-stk-out').textContent = stockOut + ' unit';
    document.getElementById('kpi-stk-low').textContent = lowStock;

    // Override biz.stock with merged data for chart rendering
    const stockForCharts = { ...biz, stock: allStock };
    renderStockCharts(stockForCharts);
    renderStockTable(stockForCharts);
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
    const data = getManualData(state.currentBiz);
    const products = data.products || [];
    const grid = document.getElementById('productGrid');
    const isOwner = state.user && (ROLE_ACCESS[state.user.role] || {}).seeHPP;

    if (products.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3)"><p style="font-size:0.95rem">Belum ada produk. Klik "Tambah Produk" untuk mulai.</p></div>';
    } else {
        grid.innerHTML = products.map((p, i) => {
            const imgHtml = p.image
                ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover">`
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>';
            const margin = p.sell > 0 ? Math.round(((p.sell - p.hpp) / p.sell) * 100) : 0;
            return `<div class="prod-card" style="cursor:pointer" onclick="showProductDetail(${i})">
                <div class="prod-img">${imgHtml}${p.badge ? `<span class="prod-badge">${esc(p.badge)}</span>` : ''}</div>
                <div class="prod-body">
                    ${p.sku ? `<div style="font-size:0.7rem;color:var(--text-3);font-weight:600;letter-spacing:0.05em;text-transform:uppercase">${esc(p.sku)}</div>` : ''}
                    <div class="prod-name">${esc(p.name)}</div>
                    <div class="prod-desc">${esc(p.desc)}</div>
                    <div class="prod-prices">
                        ${isOwner ? `<div class="prod-hpp">HPP: <span>${rupiah(p.hpp)}</span> <span style="color:${margin>50?'var(--green)':'var(--text-2)'};font-size:0.75rem">(${margin}%)</span></div>` : ''}
                        <div class="prod-sell">${rupiah(p.sell)}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('productDetail').style.display = 'none';
}

function showProductDetail(idx) {
    const data = getManualData(state.currentBiz);
    const p = (data.products || [])[idx];
    if (!p) return;

    const isOwner = state.user && (ROLE_ACCESS[state.user.role] || {}).seeHPP;
    const panel = document.getElementById('productDetail');
    const body = document.getElementById('pdBody');

    document.getElementById('pdTitle').textContent = p.name || 'Detail Produk';

    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">';

    // Left: Info
    html += '<div>';
    if (p.image) html += `<img src="${esc(p.image)}" style="width:100%;border-radius:var(--radius-sm);margin-bottom:12px;max-height:240px;object-fit:cover">`;
    if (p.sku) html += `<div style="font-size:0.75rem;color:var(--text-3);font-weight:600;letter-spacing:0.05em;margin-bottom:4px">SKU: ${esc(p.sku)}</div>`;
    if (p.desc) html += `<p style="color:var(--text-2);margin-bottom:8px">${esc(p.desc)}</p>`;
    if (p.detail) html += `<pre style="font-size:0.82rem;color:var(--text-2);white-space:pre-wrap;line-height:1.5;background:var(--bg-2);padding:12px;border-radius:var(--radius-xs)">${esc(p.detail)}</pre>`;
    html += '<div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">';
    html += `<div><span style="font-size:0.72rem;color:var(--text-3)">Harga Jual</span><div style="font-size:1.15rem;font-weight:800;color:var(--purple)">${rupiah(p.sell)}</div></div>`;
    if (p.reseller) html += `<div><span style="font-size:0.72rem;color:var(--text-3)">Harga Reseller</span><div style="font-size:1.15rem;font-weight:800;color:var(--green)">${rupiah(p.reseller)}</div></div>`;
    if (isOwner) html += `<div><span style="font-size:0.72rem;color:var(--text-3)">HPP</span><div style="font-size:1.15rem;font-weight:800;color:var(--red)">${rupiah(p.hpp)}</div></div>`;
    html += '</div></div>';

    // Right: Marketing Kit + Knowledge
    html += '<div>';
    if (p.knowledge) {
        html += `<div style="margin-bottom:16px"><h4 style="font-size:0.85rem;font-weight:700;margin-bottom:6px">Product Knowledge</h4><pre style="font-size:0.82rem;color:var(--text-2);white-space:pre-wrap;line-height:1.5;background:var(--bg-2);padding:12px;border-radius:var(--radius-xs)">${esc(p.knowledge)}</pre></div>`;
    }

    if (p.landing) {
        html += `<div style="margin-bottom:16px"><h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px">Landing Page</h4><a href="${esc(p.landing)}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:var(--purple);color:#fff;border-radius:var(--radius-xs);font-size:0.85rem;font-weight:600;text-decoration:none">Buka Landing Page &rarr;</a></div>`;
    }

    const hasKit = p.photos || p.content || p.video;
    if (hasKit) {
        html += '<h4 style="font-size:0.85rem;font-weight:700;margin-bottom:8px">Marketing Kit</h4>';
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        if (p.photos) html += `<a href="${esc(p.photos)}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-2);border-radius:var(--radius-xs);color:var(--purple);font-size:0.82rem;font-weight:500;text-decoration:none">Foto Produk</a>`;
        if (p.content) html += `<a href="${esc(p.content)}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-2);border-radius:var(--radius-xs);color:var(--purple);font-size:0.82rem;font-weight:500;text-decoration:none">Konten Foto</a>`;
        if (p.video) html += `<a href="${esc(p.video)}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-2);border-radius:var(--radius-xs);color:var(--purple);font-size:0.82rem;font-weight:500;text-decoration:none">Video Produk</a>`;
        html += '</div>';
    }

    // Edit/Delete buttons (roles with canEdit)
    const canEdit = state.user && (ROLE_ACCESS[state.user.role] || {}).canEdit;
    if (canEdit) {
        html += `<div style="margin-top:20px;display:flex;gap:8px">
            <button onclick="editProduct(${idx})" class="btn-add-sm">Edit</button>
            <button onclick="deleteProduct(${idx})" class="btn-add-sm" style="background:var(--red)">Hapus</button>
        </div>`;
    }
    html += '</div></div>';

    body.innerHTML = html;
    panel.style.display = '';
    panel.scrollIntoView({ behavior: 'smooth' });
}

function editProduct(idx) {
    const data = getManualData(state.currentBiz);
    const p = (data.products || [])[idx];
    if (!p) return;

    const overlay = document.getElementById('productModalOverlay');
    document.getElementById('productModalTitle').textContent = 'Edit Produk';
    document.getElementById('prodSubmitBtn').textContent = 'Update Produk';
    document.getElementById('inProdEditId').value = idx;
    document.getElementById('inProdName').value = p.name || '';
    document.getElementById('inProdSku').value = p.sku || '';
    document.getElementById('inProdDesc').value = p.desc || '';
    document.getElementById('inProdDetail').value = p.detail || '';
    document.getElementById('inProdHpp').value = p.hpp || '';
    document.getElementById('inProdSell').value = p.sell || '';
    document.getElementById('inProdQty').value = p.qty || 0;
    document.getElementById('inProdReseller').value = p.reseller || '';
    document.getElementById('inProdBadge').value = p.badge || '';
    document.getElementById('inProdImage').value = p.image || '';
    const preview = document.getElementById('prodImagePreview');
    if (p.image) {
        preview.innerHTML = `<img src="${p.image}" style="max-height:100px;border-radius:var(--radius-xs);border:1px solid var(--border)" onerror="this.style.display='none'">`;
    } else {
        preview.innerHTML = '';
    }
    document.getElementById('inProdPhotos').value = p.photos || '';
    document.getElementById('inProdContent').value = p.content || '';
    document.getElementById('inProdVideo').value = p.video || '';
    document.getElementById('inProdLanding').value = p.landing || '';
    document.getElementById('inProdKnowledge').value = p.knowledge || '';
    overlay.classList.add('show');
}

function deleteProduct(idx) {
    if (!confirm('Hapus produk ini?')) return;
    const data = getManualData(state.currentBiz);
    data.products.splice(idx, 1);
    saveManualData(state.currentBiz, data);
    renderCurrentPage();
    toast('Produk dihapus');
}

function initProductModal() {
    const overlay = document.getElementById('productModalOverlay');
    if (!overlay) return;

    document.getElementById('productModalClose').addEventListener('click', () => { overlay.classList.remove('show'); resetProductForm(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('show'); resetProductForm(); } });

    document.getElementById('addProductBtn').addEventListener('click', () => {
        resetProductForm();
        document.getElementById('productModalTitle').textContent = 'Tambah Produk';
        document.getElementById('prodSubmitBtn').textContent = 'Simpan Produk';
        overlay.classList.add('show');
    });

    // Image upload handler
    document.getElementById('inProdFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) {
            toast('Gambar terlalu besar (maks 500KB). Compress dulu.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('inProdImage').value = ev.target.result;
            document.getElementById('prodImagePreview').innerHTML = `<img src="${ev.target.result}" style="max-height:100px;border-radius:var(--radius-xs);border:1px solid var(--border)">`;
            toast('Foto berhasil di-upload');
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('inProdImage').addEventListener('input', (e) => {
        const url = e.target.value;
        if (url && (url.startsWith('http') || url.startsWith('data:'))) {
            document.getElementById('prodImagePreview').innerHTML = `<img src="${url}" style="max-height:100px;border-radius:var(--radius-xs);border:1px solid var(--border)" onerror="this.style.display='none'">`;
        }
    });

    document.getElementById('pdClose').addEventListener('click', () => {
        document.getElementById('productDetail').style.display = 'none';
    });

    document.getElementById('shareCatalogBtn').addEventListener('click', () => {
        const url = window.location.origin + '/catalog.html?biz=' + state.currentBiz;
        navigator.clipboard.writeText(url).then(() => toast('Link katalog disalin!')).catch(() => {
            prompt('Copy link katalog:', url);
        });
    });

    document.getElementById('formProduct').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = getManualData(state.currentBiz);
        if (!data.products) data.products = [];

        const product = {
            name: document.getElementById('inProdName').value,
            sku: document.getElementById('inProdSku').value,
            desc: document.getElementById('inProdDesc').value,
            detail: document.getElementById('inProdDetail').value,
            hpp: parseInt(document.getElementById('inProdHpp').value) || 0,
            sell: parseInt(document.getElementById('inProdSell').value) || 0,
            qty: parseInt(document.getElementById('inProdQty').value) || 0,
            reseller: parseInt(document.getElementById('inProdReseller').value) || 0,
            badge: document.getElementById('inProdBadge').value,
            image: document.getElementById('inProdImage').value,
            photos: document.getElementById('inProdPhotos').value,
            content: document.getElementById('inProdContent').value,
            video: document.getElementById('inProdVideo').value,
            landing: document.getElementById('inProdLanding').value,
            knowledge: document.getElementById('inProdKnowledge').value,
        };

        const editId = document.getElementById('inProdEditId').value;
        if (editId !== '') {
            data.products[parseInt(editId)] = product;
            toast('Produk berhasil diupdate');
        } else {
            product.id = Date.now().toString(36);
            data.products.push(product);
            toast('Produk berhasil ditambahkan');
        }

        saveManualData(state.currentBiz, data);
        overlay.classList.remove('show');
        resetProductForm();
        renderCurrentPage();
    });
}

function resetProductForm() {
    document.getElementById('formProduct').reset();
    document.getElementById('inProdEditId').value = '';
    document.getElementById('productModalTitle').textContent = 'Tambah Produk';
    document.getElementById('prodSubmitBtn').textContent = 'Simpan Produk';
    document.getElementById('prodImagePreview').innerHTML = '';
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

// ================================================
//  PAGE: ADMIN PANEL
// ================================================

function renderAdminPanel() {
    const users = getUsers();
    const tbody = document.querySelector('#tblUsers tbody');

    const roleLabels = { owner: 'Owner', admin: 'Admin', cs: 'Customer Service', kreator: 'Konten Kreator' };
    const roleColors = { owner: '#8B6914', admin: '#1E5FAF', cs: '#2D7A3A', kreator: '#D97706' };
    const roleBgColors = { owner: 'rgba(139,105,20,0.08)', admin: 'rgba(30,95,175,0.08)', cs: 'rgba(45,122,58,0.08)', kreator: 'rgba(217,119,6,0.08)' };
    const bizNames = { irys: 'IRYS Fragrance', dropship: 'Dropship MP', matcha: 'Toko Matcha' };
    const bizDots = { irys: '#8B6914', dropship: '#1E5FAF', matcha: '#2D7A3A' };

    // Render as user cards instead of table
    const cardGrid = document.getElementById('userCardGrid');
    if (cardGrid) {
        cardGrid.innerHTML = users.map((u, i) => {
            const bizList = (u.businesses || Object.keys(BUSINESSES));
            const bizTags = bizList.map(b => `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:600;background:${bizDots[b] || '#888'}18;color:${bizDots[b] || '#888'}">${bizNames[b] || b}</span>`).join(' ');
            const photoHtml = u.photo
                ? `<img src="${u.photo}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid ${roleColors[u.role] || '#888'}">`
                : `<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,${roleColors[u.role] || '#888'},${roleColors[u.role] || '#888'}cc);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:700;border:2px solid ${roleColors[u.role] || '#888'}30">${esc(u.avatar || u.name?.charAt(0) || '?')}</div>`;

            return `<div class="prod-card" style="cursor:default">
                <div style="padding:20px;display:flex;gap:14px;align-items:center">
                    ${photoHtml}
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:700;font-size:1rem">${esc(u.name)}</div>
                        <div style="display:flex;align-items:center;gap:6px;margin:4px 0">
                            <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:0.72rem;font-weight:700;background:${roleBgColors[u.role] || '#eee'};color:${roleColors[u.role] || '#888'}">${roleLabels[u.role] || u.role}</span>
                        </div>
                        <div style="font-size:0.78rem;color:var(--text-3)">${esc(u.email)}</div>
                    </div>
                </div>
                <div style="padding:0 20px 12px;display:flex;gap:4px;flex-wrap:wrap">${bizTags}</div>
                <div style="padding:8px 20px 14px;border-top:1px solid var(--border-subtle);display:flex;gap:6px">
                    ${u.role !== 'owner' ? `
                        <button class="btn-add-sm" style="padding:4px 10px;font-size:0.72rem" onclick="editUser(${i})">Edit</button>
                        <button class="btn-add-sm" style="padding:4px 10px;font-size:0.72rem;background:var(--red)" onclick="deleteUser(${i})">Hapus</button>
                    ` : '<span style="font-size:0.72rem;color:var(--text-3);padding:4px 0">Owner — Protected</span>'}
                </div>
            </div>`;
        }).join('');
    }

    // Also render table for quick view
    const roleTagColors = { owner: 'tag-purple', admin: 'tag-blue', cs: 'tag-green', kreator: 'tag-amber' };
    tbody.innerHTML = users.map((u, i) => {
        const bizList = (u.businesses || []).map(b => (bizNames[b] || b).split(' ')[0]).join(', ') || 'Semua';
        return `<tr>
        <td style="font-weight:500">${esc(u.name)}</td>
        <td>${esc(u.email)}</td>
        <td><span class="tag ${roleTagColors[u.role] || 'tag-purple'}">${roleLabels[u.role] || u.role}</span></td>
        <td style="font-size:0.78rem;color:var(--text-3)">${bizList}</td>
        <td>${u.role !== 'owner' ? `<button class="btn-add-sm" style="padding:3px 8px;font-size:0.72rem" onclick="editUser(${i})">Edit</button> <button class="btn-add-sm" style="padding:3px 8px;font-size:0.72rem;background:var(--red)" onclick="deleteUser(${i})">Hapus</button>` : '<span style="font-size:0.72rem;color:var(--text-3)">Protected</span>'}</td>
    </tr>`;
    }).join('');

    // API status
    const statusEl = document.getElementById('adminApiStatus');
    if (statusEl) {
        fetch('/api/health').then(r => r.json()).then(d => {
            const items = Object.entries(d.integrations || {}).map(([k, v]) => `${k}: ${v ? 'Active' : 'Inactive'}`).join(', ');
            statusEl.textContent = `API: ${items || 'No integrations'}`;
        }).catch(() => { statusEl.textContent = 'API: Offline'; });
    }
}

function initAdminPanel() {
    const overlay = document.getElementById('userModalOverlay');
    if (!overlay) return;

    document.getElementById('userModalClose').addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });

    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('formUser').reset();
        document.getElementById('inUserEditIdx').value = '';
        document.getElementById('inUserPhotoData').value = '';
        document.getElementById('userPhotoPreview').innerHTML = '<span style="color:var(--text-3);font-size:1.2rem;font-weight:700">?</span>';
        document.getElementById('userModalTitle').textContent = 'Tambah User';
        document.getElementById('userSubmitBtn').textContent = 'Simpan User';
        document.querySelectorAll('.biz-check').forEach(cb => { cb.checked = false; });
        overlay.classList.add('show');
    });

    document.getElementById('inUserPhoto').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 300000) { toast('Foto maks 300KB'); e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('inUserPhotoData').value = ev.target.result;
            document.getElementById('userPhotoPreview').innerHTML = `<img src="${ev.target.result}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">`;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('formUser').addEventListener('submit', (e) => {
        e.preventDefault();
        const users = getUsers();
        const checkedBiz = [...document.querySelectorAll('.biz-check:checked')].map(cb => cb.value);
        const photoData = document.getElementById('inUserPhotoData').value;
        const userData = {
            name: document.getElementById('inUserName').value,
            email: document.getElementById('inUserEmail').value,
            password: document.getElementById('inUserPass').value,
            role: document.getElementById('inUserRole').value,
            avatar: document.getElementById('inUserName').value.charAt(0).toUpperCase(),
            photo: photoData || (editIdx !== '' ? users[parseInt(editIdx)]?.photo : undefined),
            businesses: checkedBiz.length > 0 ? checkedBiz : ['irys'],
        };

        const editIdx = document.getElementById('inUserEditIdx').value;
        if (editIdx !== '') {
            users[parseInt(editIdx)] = { ...users[parseInt(editIdx)], ...userData };
            toast('User berhasil diupdate');
        } else {
            if (users.find(u => u.email === userData.email)) {
                toast('Email sudah digunakan');
                return;
            }
            users.push(userData);
            toast('User berhasil ditambahkan');
        }

        saveUsers(users);
        overlay.classList.remove('show');
        renderAdminPanel();
    });
}

function editUser(idx) {
    const users = getUsers();
    const u = users[idx];
    if (!u || u.role === 'owner') return;

    document.getElementById('inUserEditIdx').value = idx;
    document.getElementById('inUserName').value = u.name;
    document.getElementById('inUserEmail').value = u.email;
    document.getElementById('inUserPass').value = u.password;
    document.getElementById('inUserRole').value = u.role;

    const userBiz = u.businesses || [];
    document.querySelectorAll('.biz-check').forEach(cb => {
        cb.checked = userBiz.includes(cb.value);
    });

    document.getElementById('inUserPhotoData').value = u.photo || '';
    const preview = document.getElementById('userPhotoPreview');
    if (u.photo) {
        preview.innerHTML = `<img src="${u.photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">`;
    } else {
        preview.innerHTML = `<span style="color:var(--text-3);font-size:1.2rem;font-weight:700">${esc(u.avatar || '?')}</span>`;
    }

    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('userSubmitBtn').textContent = 'Update User';
    document.getElementById('userModalOverlay').classList.add('show');
}

function deleteUser(idx) {
    const users = getUsers();
    if (users[idx]?.role === 'owner') return;
    if (!confirm(`Hapus user ${users[idx]?.name}?`)) return;
    users.splice(idx, 1);
    saveUsers(users);
    renderAdminPanel();
    toast('User dihapus');
}

// ================================================
//  PAGE: INTEGRATIONS HUB
// ================================================

const INTEGRATIONS = [
    {
        id: 'meta_ads', name: 'Meta Ads', desc: 'Facebook & Instagram Ads', color: '#1877F2',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.39H7.08V12h3.04V9.41c0-3 1.79-4.66 4.53-4.66 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.33l-.53 3.46h-2.8v8.39A12 12 0 0 0 24 12z"/></svg>',
        envKeys: ['META_ACCESS_TOKEN', 'META_BUSINESS_ID atau META_AD_ACCOUNT_ID'],
        apiCheck: '/api/meta-ads?action=accounts',
        bizTypes: ['fragrance', 'marketplace', 'fnb'],
        guide: '1. Buka developers.facebook.com → Buat App\n2. Tambahkan Marketing API\n3. Generate Access Token (ads_read permission)\n4. Set META_ACCESS_TOKEN + META_BUSINESS_ID di Vercel'
    },
    {
        id: 'tiktok_ads', name: 'TikTok Ads', desc: 'TikTok for Business', color: '#FF004F',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><path fill="#FF004F" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 4.16-3.56V10.2a6.37 6.37 0 0 0-1-.08A6.27 6.27 0 0 0 5 16.4a6.27 6.27 0 0 0 10.91 4.23A6.22 6.22 0 0 0 18 16.4V9.08a8.22 8.22 0 0 0 4.83 1.56V7.19a4.85 4.85 0 0 1-3.24-0.5z"/></svg>',
        envKeys: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'],
        apiCheck: '/api/tiktok-ads?date_from=2026-01-01&date_to=2026-01-02',
        bizTypes: ['fragrance', 'marketplace', 'fnb'],
        guide: '1. Buka business.tiktok.com → Business Center\n2. Buat App di TikTok for Developers\n3. Dapatkan Access Token + Advertiser ID\n4. Set TIKTOK_ACCESS_TOKEN + TIKTOK_ADVERTISER_ID di Vercel'
    },
    {
        id: 'google_ads', name: 'Google Ads', desc: 'Search, Display, YouTube', color: '#4285F4',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
        envKeys: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID'],
        apiCheck: null,
        bizTypes: ['fragrance', 'marketplace', 'fnb'],
        guide: '1. Buka console.cloud.google.com → Buat Project\n2. Enable Google Ads API\n3. Setup OAuth 2.0 credentials\n4. Dapatkan Developer Token dari Google Ads\n5. Set env vars di Vercel\n\n(Coming soon — butuh backend OAuth flow)'
    },
    {
        id: 'shopee', name: 'Shopee', desc: 'Shopee Open Platform', color: '#EE4D2D',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#EE4D2D"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">S</text></svg>',
        envKeys: ['SHOPEE_PARTNER_ID', 'SHOPEE_PARTNER_KEY', 'SHOPEE_SHOP_ID', 'SHOPEE_ACCESS_TOKEN'],
        apiCheck: '/api/shopee?action=products',
        bizTypes: ['marketplace', 'fragrance'],
        guide: '1. Daftar di open.shopee.com → Partner Console\n2. Buat App → dapatkan Partner ID + Key\n3. Authorization flow → dapatkan Shop ID + Token\n4. Set 4 env vars di Vercel\n\nApproval Shopee: 1-2 minggu'
    },
    {
        id: 'tokopedia', name: 'Tokopedia', desc: 'Tokopedia Seller API', color: '#42B549',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#42B549"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">T</text></svg>',
        envKeys: ['TOKOPEDIA_CLIENT_ID', 'TOKOPEDIA_CLIENT_SECRET'],
        apiCheck: null,
        bizTypes: ['marketplace'],
        guide: 'Coming soon — Tokopedia API sedang dalam pengembangan'
    },
    {
        id: 'tiktokshop', name: 'TikTok Shop', desc: 'TikTok Shop Seller', color: '#25F4EE',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#25F4EE"/><text x="12" y="16" text-anchor="middle" fill="#000" font-size="9" font-weight="bold">TTS</text></svg>',
        envKeys: ['TIKTOKSHOP_APP_KEY', 'TIKTOKSHOP_APP_SECRET'],
        apiCheck: null,
        bizTypes: ['marketplace', 'fragrance'],
        guide: 'Coming soon — TikTok Shop Seller API\n1. Daftar di partner.tiktokshop.com\n2. Buat App → dapatkan App Key + Secret\n3. Authorization flow\n4. Set env vars di Vercel'
    },
    {
        id: 'shopeefood', name: 'ShopeeFood', desc: 'ShopeeFood Merchant', color: '#EE4D2D',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#EE4D2D"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">SF</text></svg>',
        envKeys: [],
        apiCheck: null,
        bizTypes: ['fnb'],
        guide: 'Coming soon — ShopeeFood Merchant API\nSementara input manual via menu transaksi'
    },
    {
        id: 'grabfood', name: 'GrabFood', desc: 'GrabFood Merchant', color: '#00B14F',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#00B14F"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">G</text></svg>',
        envKeys: [],
        apiCheck: null,
        bizTypes: ['fnb'],
        guide: 'Coming soon — GrabFood Merchant API\nSementara input manual via menu transaksi'
    },
    {
        id: 'gojek', name: 'GoJek / GoFood', desc: 'GoFood Merchant', color: '#00AA13',
        icon: '<svg width="28" height="28" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#00AA13"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">GF</text></svg>',
        envKeys: [],
        apiCheck: null,
        bizTypes: ['fnb'],
        guide: 'Coming soon — GoFood Merchant API\nSementara input manual via menu transaksi'
    },
];

async function renderIntegrations() {
    const grid = document.getElementById('integrationGrid');
    const guideEl = document.getElementById('integrationGuide');
    const bizType = BUSINESSES[state.currentBiz].type;
    const bizName = BUSINESSES[state.currentBiz].name;

    const bizIntegrations = BUSINESSES[state.currentBiz].integrations || [];
    const relevant = INTEGRATIONS.filter(ig => bizIntegrations.includes(ig.id));
    const data = getManualData(state.currentBiz);
    const enabledIds = data.integrations || [];

    let healthData = {};
    try {
        const res = await fetch('/api/health');
        healthData = (await res.json()).integrations || {};
    } catch (e) {}

    grid.innerHTML = relevant.map(ig => {
        const isApiConfigured = healthData[ig.id] || false;
        const isEnabled = enabledIds.includes(ig.id);
        const statusText = isApiConfigured ? 'Terhubung' : 'Belum Terhubung';
        const statusClass = isApiConfigured ? 'stk-ok' : 'stk-low';
        const toggleLabel = isEnabled ? 'Nonaktifkan' : 'Aktifkan';
        const toggleStyle = isEnabled ? 'background:var(--red)' : 'background:var(--green)';

        return `<div class="prod-card" style="cursor:default">
            <div style="padding:20px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border-subtle)">
                <div style="width:44px;height:44px;border-radius:10px;background:${ig.color}10;display:flex;align-items:center;justify-content:center">${ig.icon}</div>
                <div style="flex:1">
                    <div style="font-weight:700;font-size:0.95rem">${ig.name}</div>
                    <div style="font-size:0.78rem;color:var(--text-3)">${ig.desc}</div>
                </div>
                <span class="${statusClass}" style="font-size:0.78rem">${statusText}</span>
            </div>
            <div style="padding:14px 20px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <button class="btn-add-sm" style="${toggleStyle}" onclick="toggleIntegration('${ig.id}')">${toggleLabel}</button>
                <button class="btn-add-sm" style="background:var(--blue)" onclick="checkIntegration('${ig.id}')">Cek Koneksi</button>
                <button class="btn-add-sm" style="background:var(--text-2)" onclick="showIntegrationGuide('${ig.id}')">Setup</button>
                ${ig.envKeys.length > 0 ? `<button class="btn-add-sm" style="background:var(--amber)" onclick="showTokenInput('${ig.id}')">Input Token</button>` : ''}
            </div>
            <div id="tokenPanel-${ig.id}" style="display:none;padding:0 20px 14px">
                ${ig.envKeys.map(k => {
                    const savedVal = getIntegrationToken(ig.id, k) ? '***tersimpan***' : '';
                    return `<div style="margin-bottom:8px">
                        <label style="font-size:0.72rem;font-weight:600;color:var(--text-3);display:block;margin-bottom:3px">${k}</label>
                        <div style="display:flex;gap:6px">
                            <input type="text" class="token-input" data-ig="${ig.id}" data-key="${k}" placeholder="${savedVal || 'Paste token/ID disini...'}" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg-0);color:var(--text-0);font-size:0.82rem;font-family:monospace">
                            <button class="btn-add-sm" style="padding:5px 10px;font-size:0.72rem" onclick="saveToken('${ig.id}','${k}',this)">Simpan</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');

    guideEl.innerHTML = `<p>Klik <strong>"Input Token"</strong> untuk memasukkan API key langsung di dashboard — tidak perlu setting Vercel.</p>`;
}

function toggleIntegration(id) {
    const data = getManualData(state.currentBiz);
    if (!data.integrations) data.integrations = [];
    const idx = data.integrations.indexOf(id);
    if (idx >= 0) {
        data.integrations.splice(idx, 1);
        toast(`${id} dinonaktifkan untuk bisnis ini`);
    } else {
        data.integrations.push(id);
        toast(`${id} diaktifkan untuk bisnis ini`);
    }
    saveManualData(state.currentBiz, data);
    renderIntegrations();
}

async function checkIntegration(id) {
    const ig = INTEGRATIONS.find(i => i.id === id);
    if (!ig || !ig.apiCheck) {
        toast(`${ig ? ig.name : id}: Belum ada API endpoint (coming soon)`);
        return;
    }

    toast(`Mengecek koneksi ${ig.name}...`);
    try {
        const res = await fetch(ig.apiCheck);
        const json = await res.json();
        if (json.configured) {
            toast(`${ig.name}: Terhubung! Data tersedia.`);
        } else {
            toast(`${ig.name}: Belum terkonfigurasi. ${json.message || ''}`);
        }
    } catch (e) {
        toast(`${ig.name}: Gagal menghubungi API`);
    }
    renderIntegrations();
}

function showTokenInput(id) {
    const panel = document.getElementById('tokenPanel-' + id);
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function saveToken(igId, key, btnEl) {
    const input = btnEl.parentElement.querySelector('.token-input');
    if (!input || !input.value.trim()) return;
    const tokens = JSON.parse(localStorage.getItem('bc-tokens') || '{}');
    if (!tokens[igId]) tokens[igId] = {};
    tokens[igId][key] = input.value.trim();
    localStorage.setItem('bc-tokens', JSON.stringify(tokens));
    input.value = '';
    input.placeholder = '***tersimpan***';
    toast(`${key} berhasil disimpan`);
}

function getIntegrationToken(igId, key) {
    const tokens = JSON.parse(localStorage.getItem('bc-tokens') || '{}');
    return tokens[igId]?.[key] || '';
}

function getAllTokensForIntegration(igId) {
    const tokens = JSON.parse(localStorage.getItem('bc-tokens') || '{}');
    return tokens[igId] || {};
}

function showIntegrationGuide(id) {
    const ig = INTEGRATIONS.find(i => i.id === id);
    if (!ig) return;

    const guideEl = document.getElementById('integrationGuide');
    let envHtml = ig.envKeys.length > 0
        ? '<div style="margin-top:12px"><strong>Environment Variables yang dibutuhkan:</strong><ul style="margin-top:6px;padding-left:20px">' + ig.envKeys.map(k => `<li><code style="background:var(--bg-2);padding:2px 6px;border-radius:4px;font-size:0.82rem">${k}</code></li>`).join('') + '</ul></div>'
        : '';

    guideEl.innerHTML = `
        <h4 style="margin-bottom:8px">Setup ${ig.name}</h4>
        <pre style="white-space:pre-wrap;background:var(--bg-2);padding:14px;border-radius:var(--radius-xs);font-size:0.82rem;line-height:1.6;color:var(--text-1)">${ig.guide}</pre>
        ${envHtml}
        <p style="margin-top:12px;font-size:0.78rem;color:var(--text-3)">Setelah set env vars di Vercel → Redeploy → Klik "Cek Koneksi" di atas.</p>
    `;
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
