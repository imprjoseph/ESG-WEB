/**
 * GreenStep ESG Gamification Platform
 * Global Configuration File
 * 
 * 部署說明：
 * 1. 將 GAS 部署為網頁應用程式後，複製 URL 到 GAS_API_URL
 * 2. 若有 Google Maps API Key，填入 MAPS_API_KEY
 * 3. LINE Notify Token 由後台設定頁面設定
 */

const CONFIG = {
  // ─── 版本資訊 ───────────────────────────────────────────
  VERSION: '1.0.0',
  APP_NAME: 'GreenStep',
  APP_SUBTITLE: 'ESG Gamification Platform',

  // ─── Google Apps Script API ──────────────────────────────
  // 部署後請將此 URL 替換為您的 GAS 網頁應用程式 URL
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbwLkm1yGV3IJ8k7gyia0qJOgBgDmVreyBID-Mg7P9Myqd8SvOnm-kPUygvMmkex2un8/exec',

  // ─── Google Services ────────────────────────────────────
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',

  // ─── 平台設定 ────────────────────────────────────────────
  PLATFORM: {
    DEFAULT_LANG: 'zh-TW',
    TIMEZONE: 'Asia/Taipei',
    CURRENCY: 'NT$',
    POINTS_NAME: 'GreenPoints',
    CARBON_UNIT: 'kg CO₂e',
  },

  // ─── 遊戲化設定 ──────────────────────────────────────────
  GAMIFICATION: {
    DAILY_CHECKIN_POINTS: 10,
    MISSION_BONUS_MULTIPLIER: 1.5,   // 連續完成加成
    STREAK_MILESTONE: [7, 14, 30],   // 連續天數里程碑
    LEVEL_THRESHOLDS: [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5000],
    LEVEL_NAMES: ['新手', '入門', '進階', '熟練', '精英', '大師', '宗師', '傳奇', '榮耀', 'ESG先鋒'],
  },

  // ─── ESG 設定 ────────────────────────────────────────────
  ESG: {
    TREE_EQUIVALENT_KG: 21.8,         // 每棵樹吸收 CO₂ kg/年
    CAR_KM_EMISSION: 0.196,           // 每公里 kg CO₂
    FLIGHT_HOUR_EMISSION: 89,         // 每小時 kg CO₂
    DEFAULT_CATEGORIES: ['交通', '飲食', '能源', '廢棄物', '用水'],
  },

  // ─── 分頁導航 ────────────────────────────────────────────
  PAGES: {
    LOGIN:      'index.html',
    DASHBOARD:  'dashboard.html',
    EVENTS:     'events.html',
    MISSIONS:   'missions.html',
    LEADERBOARD:'leaderboard.html',
    ESG:        'esg.html',
    REWARDS:    'rewards.html',
    PROFILE:    'profile.html',
    ADMIN:      'admin/index.html',
  },

  // ─── UI 設定 ─────────────────────────────────────────────
  UI: {
    ANIMATION_DURATION: 300,
    TOAST_DURATION: 3000,
    PAGINATION_SIZE: 20,
    IMAGE_PLACEHOLDER: 'https://placehold.co/400x200/0a2e1a/22c55e?text=GreenStep',
  },

  // ─── 快取設定 ────────────────────────────────────────────
  CACHE: {
    USER_TTL: 5 * 60 * 1000,         // 5 分鐘
    LEADERBOARD_TTL: 2 * 60 * 1000,  // 2 分鐘
    EVENTS_TTL: 10 * 60 * 1000,      // 10 分鐘
    MISSIONS_TTL: 5 * 60 * 1000,     // 5 分鐘
  },

  // ─── 角色權限 ────────────────────────────────────────────
  ROLES: {
    SUPER_ADMIN:   'super_admin',
    EVENT_ADMIN:   'event_admin',
    ESG_MANAGER:   'esg_manager',
    HR:            'hr',
    USER:          'user',
    STAFF:         'staff',
  },

  // ─── Admin 角色（可進入後台）────────────────────────────
  ADMIN_ROLES: ['super_admin', 'event_admin', 'esg_manager', 'hr'],

  // ─── Demo 模式 ──────────────────────────────────────────
  // 設為 true 時使用 Demo 資料（不連接 GAS API）
  DEMO_MODE: false,

  // ─── 功能開關 ────────────────────────────────────────────
  FEATURES: {
    LINE_NOTIFY:     false,
    PUSH_NOTIFY:     false,
    GOOGLE_MAPS:     false,
    QR_CHECKIN:      true,
    GPS_CHECKIN:     true,
    PHOTO_MISSION:   true,
    TEAM_MISSIONS:   true,
    REWARDS_STORE:   true,
  },
};

/**
 * API 請求工具函數
 */
const API = {
  /**
   * GET 請求
   * @param {string} action - API action name
   * @param {object} params - 查詢參數
   */
  async get(action, params = {}) {
    if (CONFIG.DEMO_MODE) {
      return DEMO_DATA[action] || { success: false, message: 'Demo data not found' };
    }
    try {
      const query = new URLSearchParams({ action, ...params }).toString();
      const res = await fetch(`${CONFIG.GAS_API_URL}?${query}`, { redirect: 'follow' });
      return await res.json();
    } catch (err) {
      console.error(`API GET [${action}] failed:`, err);
      return { success: false, message: err.message };
    }
  },

  /**
   * POST 請求
   * @param {string} action - API action name
   * @param {object} body - 請求內容
   */
  async post(action, body = {}) {
    if (CONFIG.DEMO_MODE) {
      console.log(`[Demo] POST ${action}:`, body);
      return { success: true, message: 'Demo mode - action simulated' };
    }
    try {
      const res = await fetch(CONFIG.GAS_API_URL, {
        method: 'POST',
        // 注意：不設 Content-Type 以避免 CORS preflight
        body: JSON.stringify({ action, ...body }),
        redirect: 'follow',
      });
      return await res.json();
    } catch (err) {
      console.error(`API POST [${action}] failed:`, err);
      return { success: false, message: err.message };
    }
  },
};

/**
 * 本地快取工具
 */
const Cache = {
  set(key, data, ttl = 60000) {
    localStorage.setItem(key, JSON.stringify({ data, expires: Date.now() + ttl }));
  },
  get(key) {
    try {
      const item = JSON.parse(localStorage.getItem(key));
      if (!item || Date.now() > item.expires) return null;
      return item.data;
    } catch { return null; }
  },
  clear(key) { localStorage.removeItem(key); },
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('gs_'))
      .forEach(k => localStorage.removeItem(k));
  },
};

/**
 * Session 管理
 */
const Session = {
  KEY: 'gs_user',
  set(user) { localStorage.setItem(this.KEY, JSON.stringify(user)); },
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)); }
    catch { return null; }
  },
  clear() { localStorage.removeItem(this.KEY); },
  isLoggedIn() { return !!this.get(); },
  isAdmin() {
    const user = this.get();
    return user && CONFIG.ADMIN_ROLES.includes(user.role);
  },
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = CONFIG.PAGES.LOGIN;
      return false;
    }
    return true;
  },
  requireAdmin() {
    if (!this.isAdmin()) {
      window.location.href = CONFIG.PAGES.DASHBOARD;
      return false;
    }
    return true;
  },
};

/**
 * Toast 通知
 */
const Toast = {
  show(message, type = 'success', duration = CONFIG.UI.TOAST_DURATION) {
    const existing = document.getElementById('gs-toast');
    if (existing) existing.remove();

    const colors = {
      success: '#22c55e',
      error:   '#ef4444',
      warning: '#ffd60a',
      info:    '#0ff4c6',
    };
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    const el = document.createElement('div');
    el.id = 'gs-toast';
    el.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:rgba(13,61,35,.95); color:#fff; padding:12px 24px;
      border-radius:12px; border-left:4px solid ${colors[type]};
      font-size:14px; z-index:9999; display:flex; align-items:center; gap:8px;
      box-shadow:0 8px 32px rgba(0,0,0,.4); backdrop-filter:blur(12px);
      animation:slideUp .3s ease; max-width:90vw;
    `;
    el.innerHTML = `<span style="color:${colors[type]};font-weight:700">${icons[type]}</span>${message}`;
    document.body.appendChild(el);

    const style = document.createElement('style');
    style.textContent = '@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(style);

    setTimeout(() => el.remove(), duration);
  },
};

/**
 * 格式化工具
 */
const Format = {
  number: n => new Intl.NumberFormat('zh-TW').format(n),
  date: d => new Date(d).toLocaleDateString('zh-TW'),
  datetime: d => new Date(d).toLocaleString('zh-TW'),
  carbon: kg => kg >= 1000 ? `${(kg/1000).toFixed(2)} t` : `${kg.toFixed(1)} kg`,
  points: n => `${Format.number(n)} pts`,
  level(pts) {
    const t = CONFIG.GAMIFICATION.LEVEL_THRESHOLDS;
    const n = CONFIG.GAMIFICATION.LEVEL_NAMES;
    for (let i = t.length - 1; i >= 0; i--) {
      if (pts >= t[i]) return { level: i + 1, name: n[i], next: t[i+1] || null };
    }
    return { level: 1, name: n[0], next: t[1] };
  },
};

// Demo 資料（開發期間使用）
const DEMO_DATA = {
  getDashboardStats: {
    success: true,
    data: {
      totalPoints: 2450, todayPoints: 80, weekPoints: 420,
      totalCarbon: 187.5, todayCarbon: 4.2, weekCarbon: 28.6,
      rank: 3, totalUsers: 128,
      activeMissions: 4, completedMissions: 47,
      activeEvents: 3, joinedEvents: 8,
    }
  },
  getUser: {
    success: true,
    data: {
      id: 'u001', name: '王志明', email: 'joseph@impr.com.tw',
      role: 'super_admin', company: 'imPR 新動力公關',
      department: '數位創新部', avatar: '',
      points: 2450, level: 5, carbonTotal: 187.5,
      joinedAt: '2024-01-15',
    }
  },
};

console.log(`%c🌱 GreenStep v${CONFIG.VERSION} loaded`, 'color:#22c55e;font-weight:bold;font-size:14px');
