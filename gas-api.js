/**
 * ============================================================
 * GreenStep ESG Gamification Platform
 * Google Apps Script REST API
 * Version: 1.0.0
 * ============================================================
 *
 * 部署方式：
 * 1. 建立 Google Apps Script 專案
 * 2. 貼上此程式碼
 * 3. 部署 → 新增部署 → 網頁應用程式
 * 4. 設定「以我的身份執行」，存取權「所有人」
 * 5. 複製部署 URL 填入前端 config.js
 *
 * Google Sheet 需建立以下工作表（Sheet tabs）：
 * users, companies, departments, events, event_sessions,
 * event_checkins, missions, mission_logs, point_logs,
 * rewards, redeem_logs, badges, user_badges,
 * notifications, carbon_actions, leaderboards
 * ============================================================
 */

// ============================================================
// 設定區
// ============================================================
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_GOOGLE_SHEET_ID_HERE', // ← 填入你的 Sheet ID
  ADMIN_EMAIL: 'admin@greenstep.tw',
  SALT: 'GreenStep2025!', // 密碼 Hash 用 salt
  VERSION: '1.0.0',
  CORS_ORIGIN: '*',
};

// Sheet 名稱對應
const SHEETS = {
  USERS: 'users',
  COMPANIES: 'companies',
  DEPARTMENTS: 'departments',
  EVENTS: 'events',
  EVENT_SESSIONS: 'event_sessions',
  CHECKINS: 'event_checkins',
  MISSIONS: 'missions',
  MISSION_LOGS: 'mission_logs',
  POINT_LOGS: 'point_logs',
  REWARDS: 'rewards',
  REDEEM_LOGS: 'redeem_logs',
  BADGES: 'badges',
  USER_BADGES: 'user_badges',
  NOTIFICATIONS: 'notifications',
  CARBON_ACTIONS: 'carbon_actions',
  LEADERBOARDS: 'leaderboards',
};

// ============================================================
// MAIN ROUTER — doGet / doPost
// ============================================================

/**
 * GET 路由處理
 * 支援 ?action=xxx&params
 */
function doGet(e) {
  const params = e.parameter;
  const action = params.action || '';
  let result;

  try {
    switch (action) {
      // 使用者
      case 'getUser':           result = getUser(params.userId); break;
      case 'getUserProfile':    result = getUserProfile(params.userId); break;

      // 活動
      case 'getEvents':         result = getEvents(params); break;
      case 'getEvent':          result = getEvent(params.eventId); break;
      case 'getEventSessions':  result = getEventSessions(params.eventId); break;

      // 任務
      case 'getMissions':       result = getMissions(params); break;
      case 'getMission':        result = getMission(params.missionId); break;
      case 'getUserMissions':   result = getUserMissions(params.userId); break;

      // 排行榜
      case 'getLeaderboard':    result = getLeaderboard(params); break;
      case 'getDeptLeaderboard':result = getDeptLeaderboard(params); break;

      // 點數
      case 'getPointHistory':   result = getPointHistory(params.userId); break;
      case 'getUserPoints':     result = getUserPoints(params.userId); break;

      // ESG
      case 'getCarbonActions':  result = getCarbonActions(); break;
      case 'getUserCarbon':     result = getUserCarbon(params.userId); break;
      case 'getCarbonStats':    result = getCarbonStats(params); break;

      // 獎勵
      case 'getRewards':        result = getRewards(); break;
      case 'getUserRedeems':    result = getUserRedeems(params.userId); break;

      // 徽章
      case 'getBadges':         result = getBadges(); break;
      case 'getUserBadges':     result = getUserBadges(params.userId); break;

      // 通知
      case 'getNotifications':  result = getNotifications(params.userId); break;

      // 統計 (管理後台)
      case 'getDashboardStats': result = getDashboardStats(); break;

      // Ping / Health
      case 'ping':              result = { status: 'ok', version: CONFIG.VERSION, time: new Date().toISOString() }; break;

      default:
        result = apiError('Unknown action: ' + action, 404);
    }
  } catch (err) {
    result = apiError('Server error: ' + err.message, 500);
  }

  return buildResponse(result);
}

/**
 * POST 路由處理
 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (ex) {
    body = e.parameter || {};
  }

  const action = body.action || e.parameter.action || '';
  let result;

  try {
    switch (action) {
      // 認證
      case 'login':             result = loginUser(body); break;
      case 'register':          result = registerUser(body); break;
      case 'googleLogin':       result = googleLoginUser(body); break;

      // 活動
      case 'createEvent':       result = createEvent(body); break;
      case 'registerEvent':     result = registerEvent(body); break;
      case 'checkinEvent':      result = checkinEvent(body); break;

      // 任務
      case 'completeMission':   result = completeMission(body); break;
      case 'submitMissionProof':result = submitMissionProof(body); break;
      case 'approveMission':    result = approveMission(body); break;

      // 點數
      case 'addPoints':         result = addPoints(body); break;

      // ESG
      case 'logCarbonAction':   result = logCarbonAction(body); break;

      // 獎勵
      case 'redeemReward':      result = redeemReward(body); break;

      // 通知
      case 'sendNotification':  result = sendNotification(body); break;
      case 'markNotifRead':     result = markNotifRead(body); break;

      default:
        result = apiError('Unknown action: ' + action, 404);
    }
  } catch (err) {
    result = apiError('Server error: ' + err.message, 500);
  }

  return buildResponse(result);
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiSuccess(data, message = 'OK') {
  return { success: true, message, data };
}

function apiError(message, code = 400) {
  return { success: false, message, code };
}

// ============================================================
// SHEET HELPERS
// ============================================================

function getSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Auto-create sheet if not exists
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function sheetToJSON(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function findRow(sheet, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) return { rowIndex: i + 1, data: data[i] };
  }
  return null;
}

function generateId(prefix = 'ID') {
  return prefix + '_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function now() { return new Date().toISOString(); }

// ============================================================
// USER FUNCTIONS
// ============================================================

function getUser(userId) {
  if (!userId) return apiError('userId required');
  const sheet = getSheet(SHEETS.USERS);
  const rows = sheetToJSON(sheet);
  const user = rows.find(r => r.user_id === userId);
  if (!user) return apiError('User not found', 404);
  delete user.password_hash; // 安全：不回傳密碼
  return apiSuccess(user);
}

function getUserProfile(userId) {
  const userResult = getUser(userId);
  if (!userResult.success) return userResult;
  const user = userResult.data;

  // 附加：點數、徽章、任務統計
  const pts = getUserPoints(userId).data || { total: 0 };
  const carbon = getUserCarbon(userId).data || { total: 0 };
  const badges = getUserBadges(userId).data || [];

  return apiSuccess({
    ...user,
    points_total: pts.total,
    carbon_total: carbon.total,
    badges_count: badges.length,
  });
}

function loginUser(body) {
  const { email, password } = body;
  if (!email || !password) return apiError('email and password required');

  const sheet = getSheet(SHEETS.USERS);
  const rows = sheetToJSON(sheet);
  const hash = hashPassword(password);
  const user = rows.find(r => r.email === email && r.password_hash === hash);

  if (!user) return apiError('Invalid credentials', 401);
  if (user.status !== 'active') return apiError('Account is not active', 403);

  delete user.password_hash;
  const token = generateToken(user.user_id);
  return apiSuccess({ user, token });
}

function registerUser(body) {
  const { name, email, password, company_id, dept_id, role = 'user' } = body;
  if (!name || !email || !password) return apiError('name, email, password required');

  const sheet = getSheet(SHEETS.USERS);
  const rows = sheetToJSON(sheet);
  if (rows.find(r => r.email === email)) return apiError('Email already registered', 409);

  const userId = generateId('USR');
  const newUser = [
    userId, name, email, hashPassword(password),
    role, company_id || '', dept_id || '',
    '', // avatar_url
    0,  // points_total
    0,  // carbon_total
    'active',
    now(), now()
  ];

  sheet.appendRow(newUser);
  return apiSuccess({ user_id: userId, name, email }, 'Registration successful');
}

function googleLoginUser(body) {
  const { google_id, email, name, avatar_url } = body;
  if (!google_id || !email) return apiError('google_id and email required');

  const sheet = getSheet(SHEETS.USERS);
  const rows = sheetToJSON(sheet);
  let user = rows.find(r => r.google_id === google_id || r.email === email);

  if (!user) {
    // Auto register
    const userId = generateId('USR');
    sheet.appendRow([userId, name, email, '', 'user', '', '', avatar_url || '', 0, 0, 'active', now(), now(), google_id]);
    user = { user_id: userId, name, email, role: 'user' };
  }

  const token = generateToken(user.user_id);
  delete user.password_hash;
  return apiSuccess({ user, token });
}

// ============================================================
// EVENT FUNCTIONS
// ============================================================

function getEvents(params) {
  const sheet = getSheet(SHEETS.EVENTS);
  let rows = sheetToJSON(sheet);

  // 篩選
  if (params.type) rows = rows.filter(r => r.event_type === params.type);
  if (params.status) rows = rows.filter(r => r.status === params.status);

  // 排序：按開始時間
  rows.sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));

  return apiSuccess({ events: rows, total: rows.length });
}

function getEvent(eventId) {
  const sheet = getSheet(SHEETS.EVENTS);
  const rows = sheetToJSON(sheet);
  const event = rows.find(r => r.event_id === eventId);
  if (!event) return apiError('Event not found', 404);
  return apiSuccess(event);
}

function createEvent(body) {
  const { title, description, event_type, start_datetime, end_datetime, location, organizer_id, banner_url, max_attendees } = body;
  if (!title || !event_type) return apiError('title and event_type required');

  const sheet = getSheet(SHEETS.EVENTS);
  const eventId = generateId('EVT');
  sheet.appendRow([
    eventId, title, description, event_type,
    start_datetime, end_datetime, location,
    organizer_id, banner_url || '', max_attendees || 0,
    0, // current_attendees
    'active', now(), now()
  ]);
  return apiSuccess({ event_id: eventId }, 'Event created');
}

function registerEvent(body) {
  const { user_id, event_id } = body;
  if (!user_id || !event_id) return apiError('user_id and event_id required');

  // Check existing
  const sheet = getSheet('event_registrations');
  const rows = sheetToJSON(sheet);
  if (rows.find(r => r.user_id === user_id && r.event_id === event_id)) {
    return apiError('Already registered', 409);
  }

  sheet.appendRow([generateId('REG'), user_id, event_id, 'registered', now()]);
  return apiSuccess({}, 'Registration successful');
}

function checkinEvent(body) {
  const { user_id, event_id, session_id, qr_code, gps_lat, gps_lng } = body;
  if (!user_id || !event_id) return apiError('user_id and event_id required');

  const sheet = getSheet(SHEETS.CHECKINS);
  const checkinId = generateId('CHK');
  sheet.appendRow([
    checkinId, user_id, event_id, session_id || '',
    'qr', qr_code || '', gps_lat || '', gps_lng || '',
    now()
  ]);

  // 給予簽到點數
  addPoints({ user_id, points: 50, source: 'event_checkin', ref_id: event_id });

  return apiSuccess({ checkin_id: checkinId }, 'Checkin successful');
}

// ============================================================
// MISSION FUNCTIONS
// ============================================================

function getMissions(params) {
  const sheet = getSheet(SHEETS.MISSIONS);
  let rows = sheetToJSON(sheet);
  if (params.type) rows = rows.filter(r => r.mission_type === params.type);
  if (params.status) rows = rows.filter(r => r.status === params.status);
  return apiSuccess({ missions: rows, total: rows.length });
}

function getMission(missionId) {
  const sheet = getSheet(SHEETS.MISSIONS);
  const rows = sheetToJSON(sheet);
  const m = rows.find(r => r.mission_id === missionId);
  if (!m) return apiError('Mission not found', 404);
  return apiSuccess(m);
}

function getUserMissions(userId) {
  const logSheet = getSheet(SHEETS.MISSION_LOGS);
  const logs = sheetToJSON(logSheet).filter(r => r.user_id === userId);
  return apiSuccess({ logs, total: logs.length });
}

function completeMission(body) {
  const { user_id, mission_id, verify_method, proof_url, qr_data, gps_lat, gps_lng } = body;
  if (!user_id || !mission_id) return apiError('user_id and mission_id required');

  // 防止重複完成（每日任務可每日完成，其他只能一次）
  const logSheet = getSheet(SHEETS.MISSION_LOGS);
  const logs = sheetToJSON(logSheet);
  const today = new Date().toDateString();
  const existing = logs.find(r =>
    r.user_id === user_id &&
    r.mission_id === mission_id &&
    (r.mission_type !== 'daily' || new Date(r.completed_at).toDateString() === today)
  );
  if (existing) return apiError('Mission already completed', 409);

  // 取得任務資料
  const mResult = getMission(mission_id);
  if (!mResult.success) return mResult;
  const mission = mResult.data;

  // 決定狀態 (photo 需審核)
  const status = ['photo', 'manual_review'].includes(verify_method) ? 'pending' : 'approved';

  // 記錄完成
  const logId = generateId('LOG');
  logSheet.appendRow([
    logId, user_id, mission_id, mission.mission_type,
    verify_method, proof_url || '', qr_data || '',
    gps_lat || '', gps_lng || '',
    status, now()
  ]);

  // 立即給予點數（審核通過的）
  if (status === 'approved') {
    addPoints({ user_id, points: Number(mission.points), source: 'mission', ref_id: mission_id });
    if (Number(mission.carbon_reduction) > 0) {
      logCarbonAction({ user_id, carbon_amount: mission.carbon_reduction, action_id: mission_id, source: 'mission' });
    }
    checkAndAwardBadges(user_id);
  }

  return apiSuccess({ log_id: logId, status }, status === 'pending' ? '已提交審核' : '任務完成！');
}

function approveMission(body) {
  const { log_id, approved_by, approved } = body;
  if (!log_id) return apiError('log_id required');

  const sheet = getSheet(SHEETS.MISSION_LOGS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const logIdIdx = headers.indexOf('log_id');
  const statusIdx = headers.indexOf('status');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][logIdIdx] === log_id) {
      sheet.getRange(i + 1, statusIdx + 1).setValue(approved ? 'approved' : 'rejected');
      // 若核准，給予點數
      if (approved) {
        const userId = rows[i][headers.indexOf('user_id')];
        const missionId = rows[i][headers.indexOf('mission_id')];
        const mResult = getMission(missionId);
        if (mResult.success) {
          addPoints({ user_id: userId, points: Number(mResult.data.points), source: 'mission', ref_id: missionId });
        }
      }
      return apiSuccess({ log_id }, approved ? '已核准' : '已拒絕');
    }
  }
  return apiError('Log not found', 404);
}

// ============================================================
// POINTS FUNCTIONS
// ============================================================

function getUserPoints(userId) {
  const sheet = getSheet(SHEETS.POINT_LOGS);
  const logs = sheetToJSON(sheet).filter(r => r.user_id === userId && r.status === 'active');
  const total = logs.reduce((sum, r) => sum + Number(r.points), 0);
  return apiSuccess({ total, logs });
}

function addPoints(body) {
  const { user_id, points, source, ref_id } = body;
  if (!user_id || !points) return apiError('user_id and points required');

  const sheet = getSheet(SHEETS.POINT_LOGS);
  const logId = generateId('PTS');
  sheet.appendRow([logId, user_id, Number(points), source || 'manual', ref_id || '', 'active', now()]);

  // 更新 users 表的 points_total
  updateUserStat(user_id, 'points_total', Number(points));

  return apiSuccess({ log_id: logId, points_added: points });
}

// ============================================================
// ESG / CARBON FUNCTIONS
// ============================================================

function getCarbonActions() {
  const sheet = getSheet(SHEETS.CARBON_ACTIONS);
  const rows = sheetToJSON(sheet);
  return apiSuccess({ actions: rows, total: rows.length });
}

function getUserCarbon(userId) {
  const sheet = getSheet(SHEETS.MISSION_LOGS);
  const logs = sheetToJSON(sheet).filter(r => r.user_id === userId && r.status === 'approved');
  // Sum from mission carbon
  // In real case: join with missions table
  const total = logs.reduce((sum, r) => sum + (Number(r.carbon_amount) || 0), 0);
  return apiSuccess({ total, logs_count: logs.length });
}

function getCarbonStats(params) {
  const sheet = getSheet(SHEETS.MISSION_LOGS);
  const logs = sheetToJSON(sheet).filter(r => r.status === 'approved');

  // Group by user
  const userMap = {};
  logs.forEach(r => {
    if (!userMap[r.user_id]) userMap[r.user_id] = 0;
    userMap[r.user_id] += Number(r.carbon_amount) || 0;
  });

  const totalCarbon = Object.values(userMap).reduce((a, b) => a + b, 0);
  return apiSuccess({ total_carbon: totalCarbon, users_count: Object.keys(userMap).length });
}

function logCarbonAction(body) {
  const { user_id, carbon_amount, action_id, source } = body;
  // Update user carbon_total
  updateUserStat(user_id, 'carbon_total', Number(carbon_amount));
  return apiSuccess({ carbon_logged: carbon_amount });
}

// ============================================================
// LEADERBOARD FUNCTIONS
// ============================================================

function getLeaderboard(params) {
  const { period = 'month', limit = 50 } = params;
  const userSheet = getSheet(SHEETS.USERS);
  const users = sheetToJSON(userSheet).filter(r => r.status === 'active');

  const ptSheet = getSheet(SHEETS.POINT_LOGS);
  const ptLogs = sheetToJSON(ptSheet).filter(r => r.status === 'active');

  // Calculate totals by period
  const now = new Date();
  const filtered = ptLogs.filter(r => {
    const d = new Date(r.created_at);
    if (period === 'week') return (now - d) <= 7 * 86400000;
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });

  const totals = {};
  filtered.forEach(r => {
    if (!totals[r.user_id]) totals[r.user_id] = 0;
    totals[r.user_id] += Number(r.points);
  });

  const lb = users
    .map(u => ({ user_id: u.user_id, name: u.name, dept_id: u.dept_id, company_id: u.company_id, avatar: u.avatar_url, points: totals[u.user_id] || 0 }))
    .sort((a, b) => b.points - a.points)
    .slice(0, Number(limit));

  lb.forEach((r, i) => { r.rank = i + 1; });
  return apiSuccess({ leaderboard: lb, period, total: lb.length });
}

function getDeptLeaderboard(params) {
  const { period = 'month' } = params;
  const deptSheet = getSheet(SHEETS.DEPARTMENTS);
  const depts = sheetToJSON(deptSheet);
  const ptSheet = getSheet(SHEETS.POINT_LOGS);
  const userSheet = getSheet(SHEETS.USERS);
  const users = sheetToJSON(userSheet);
  const ptLogs = sheetToJSON(ptSheet);

  // Sum by dept
  const deptTotals = {};
  ptLogs.forEach(r => {
    const u = users.find(u => u.user_id === r.user_id);
    if (!u) return;
    const dept = u.dept_id;
    if (!deptTotals[dept]) deptTotals[dept] = 0;
    deptTotals[dept] += Number(r.points);
  });

  const lb = depts.map(d => ({
    dept_id: d.dept_id, name: d.dept_name,
    points: deptTotals[d.dept_id] || 0,
    member_count: users.filter(u => u.dept_id === d.dept_id).length
  })).sort((a, b) => b.points - a.points);

  lb.forEach((r, i) => { r.rank = i + 1; });
  return apiSuccess({ leaderboard: lb });
}

// ============================================================
// REWARDS FUNCTIONS
// ============================================================

function getRewards() {
  const sheet = getSheet(SHEETS.REWARDS);
  const rows = sheetToJSON(sheet).filter(r => r.status === 'active');
  return apiSuccess({ rewards: rows, total: rows.length });
}

function getUserRedeems(userId) {
  const sheet = getSheet(SHEETS.REDEEM_LOGS);
  const rows = sheetToJSON(sheet).filter(r => r.user_id === userId);
  return apiSuccess({ redeems: rows });
}

function redeemReward(body) {
  const { user_id, reward_id } = body;
  if (!user_id || !reward_id) return apiError('user_id and reward_id required');

  // Check reward
  const rwSheet = getSheet(SHEETS.REWARDS);
  const rewards = sheetToJSON(rwSheet);
  const reward = rewards.find(r => r.reward_id === reward_id);
  if (!reward) return apiError('Reward not found', 404);
  if (Number(reward.stock) <= 0) return apiError('Out of stock', 400);

  // Check points
  const ptsResult = getUserPoints(user_id);
  if (!ptsResult.success) return ptsResult;
  if (ptsResult.data.total < Number(reward.points_required)) {
    return apiError(`Insufficient points. Required: ${reward.points_required}`, 400);
  }

  // Deduct points
  const ptSheet = getSheet(SHEETS.POINT_LOGS);
  ptSheet.appendRow([generateId('PTS'), user_id, -Number(reward.points_required), 'redeem', reward_id, 'active', now()]);

  // Record redeem
  const rlSheet = getSheet(SHEETS.REDEEM_LOGS);
  const redeemId = generateId('RDM');
  const voucherCode = 'VC' + Math.random().toString(36).substr(2, 8).toUpperCase();
  rlSheet.appendRow([redeemId, user_id, reward_id, voucherCode, 'active', now()]);

  // Decrease stock
  const rwRows = rwSheet.getDataRange().getValues();
  const headers = rwRows[0];
  const stockIdx = headers.indexOf('stock');
  const rewardIdIdx = headers.indexOf('reward_id');
  for (let i = 1; i < rwRows.length; i++) {
    if (rwRows[i][rewardIdIdx] === reward_id) {
      rwSheet.getRange(i + 1, stockIdx + 1).setValue(Number(rwRows[i][stockIdx]) - 1);
      break;
    }
  }

  return apiSuccess({ redeem_id: redeemId, voucher_code: voucherCode }, '兌換成功！');
}

// ============================================================
// BADGES FUNCTIONS
// ============================================================

function getBadges() {
  const sheet = getSheet(SHEETS.BADGES);
  return apiSuccess({ badges: sheetToJSON(sheet) });
}

function getUserBadges(userId) {
  const sheet = getSheet(SHEETS.USER_BADGES);
  const rows = sheetToJSON(sheet).filter(r => r.user_id === userId);
  return apiSuccess({ badges: rows });
}

function checkAndAwardBadges(userId) {
  const ptsResult = getUserPoints(userId);
  const pts = ptsResult.data?.total || 0;
  const missResult = getUserMissions(userId);
  const missionCount = missResult.data?.total || 0;

  const badgeRules = [
    { badge_id: 'BADGE_FIRST_MISSION', condition: () => missionCount >= 1, label: '初次完成任務' },
    { badge_id: 'BADGE_100PTS', condition: () => pts >= 100, label: '累積100點' },
    { badge_id: 'BADGE_1000PTS', condition: () => pts >= 1000, label: '累積1000點' },
    { badge_id: 'BADGE_10MISSIONS', condition: () => missionCount >= 10, label: '完成10個任務' },
  ];

  const ubSheet = getSheet(SHEETS.USER_BADGES);
  const existing = sheetToJSON(ubSheet).filter(r => r.user_id === userId).map(r => r.badge_id);

  badgeRules.forEach(rule => {
    if (!existing.includes(rule.badge_id) && rule.condition()) {
      ubSheet.appendRow([generateId('UBG'), userId, rule.badge_id, now()]);
      // Send notification
      sendNotification({ user_id: userId, title: '🏅 解鎖新徽章', message: `恭喜解鎖「${rule.label}」`, type: 'badge' });
    }
  });
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function getNotifications(userId) {
  const sheet = getSheet(SHEETS.NOTIFICATIONS);
  const rows = sheetToJSON(sheet).filter(r => r.user_id === userId || r.target === 'all');
  return apiSuccess({ notifications: rows.slice(0, 20) });
}

function sendNotification(body) {
  const { user_id, title, message, type = 'info', target = 'user' } = body;
  const sheet = getSheet(SHEETS.NOTIFICATIONS);
  const nid = generateId('NTF');
  sheet.appendRow([nid, user_id || '', target, title, message, type, 'unread', now()]);
  return apiSuccess({ notification_id: nid });
}

function markNotifRead(body) {
  const { notification_id } = body;
  const sheet = getSheet(SHEETS.NOTIFICATIONS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const nidIdx = headers.indexOf('notification_id');
  const statusIdx = headers.indexOf('status');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][nidIdx] === notification_id) {
      sheet.getRange(i + 1, statusIdx + 1).setValue('read');
      return apiSuccess({}, 'Marked as read');
    }
  }
  return apiError('Notification not found', 404);
}

// ============================================================
// ADMIN DASHBOARD STATS
// ============================================================

function getDashboardStats() {
  const userSheet = getSheet(SHEETS.USERS);
  const eventSheet = getSheet(SHEETS.EVENTS);
  const missionSheet = getSheet(SHEETS.MISSIONS);
  const ptSheet = getSheet(SHEETS.POINT_LOGS);

  const users = sheetToJSON(userSheet);
  const events = sheetToJSON(eventSheet);
  const missions = sheetToJSON(missionSheet);
  const pts = sheetToJSON(ptSheet);

  const totalPts = pts.filter(r=>r.status==='active').reduce((a,r)=>a+Number(r.points),0);

  return apiSuccess({
    total_users: users.filter(r => r.status === 'active').length,
    total_events: events.filter(r => r.status === 'active').length,
    total_missions: missions.filter(r => r.status === 'active').length,
    total_points_issued: totalPts,
    new_users_today: users.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
  });
}

// ============================================================
// SHEET SCHEMA INITIALIZERS
// ============================================================

function initSheetHeaders(sheet, name) {
  const HEADERS = {
    users:          ['user_id','name','email','password_hash','role','company_id','dept_id','avatar_url','points_total','carbon_total','status','created_at','updated_at','google_id'],
    companies:      ['company_id','company_name','industry','contact_email','status','created_at'],
    departments:    ['dept_id','dept_name','company_id','manager_id','created_at'],
    events:         ['event_id','title','description','event_type','start_datetime','end_datetime','location','organizer_id','banner_url','max_attendees','current_attendees','status','created_at','updated_at'],
    event_sessions: ['session_id','event_id','title','start_time','end_time','speaker','location','max_capacity','status'],
    event_checkins: ['checkin_id','user_id','event_id','session_id','verify_method','qr_data','gps_lat','gps_lng','checked_in_at'],
    event_registrations: ['reg_id','user_id','event_id','status','registered_at'],
    missions:       ['mission_id','title','description','mission_type','verify_method','points','carbon_reduction','target_value','deadline','status','created_at'],
    mission_logs:   ['log_id','user_id','mission_id','mission_type','verify_method','proof_url','qr_data','gps_lat','gps_lng','carbon_amount','status','completed_at'],
    point_logs:     ['log_id','user_id','points','source','ref_id','status','created_at'],
    rewards:        ['reward_id','title','description','points_required','stock','category','image_url','status','created_at'],
    redeem_logs:    ['redeem_id','user_id','reward_id','voucher_code','status','redeemed_at'],
    badges:         ['badge_id','name','description','icon','category','condition_type','condition_value','created_at'],
    user_badges:    ['ub_id','user_id','badge_id','earned_at'],
    notifications:  ['notification_id','user_id','target','title','message','type','status','created_at'],
    carbon_actions: ['action_id','name','description','carbon_reduction','esg_category','points','status'],
    leaderboards:   ['lb_id','user_id','dept_id','company_id','event_id','points','carbon','rank','period','updated_at'],
  };

  const headers = HEADERS[name];
  if (headers) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function hashPassword(password) {
  const combined = CONFIG.SALT + password;
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    combined
  ).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function generateToken(userId) {
  const payload = userId + ':' + new Date().getTime();
  return Utilities.base64Encode(payload);
}

function updateUserStat(userId, field, delta) {
  const sheet = getSheet(SHEETS.USERS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const userIdIdx = headers.indexOf('user_id');
  const fieldIdx = headers.indexOf(field);
  if (fieldIdx < 0) return;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][userIdIdx] === userId) {
      const current = Number(rows[i][fieldIdx]) || 0;
      sheet.getRange(i + 1, fieldIdx + 1).setValue(current + delta);
      break;
    }
  }
}

/**
 * ============================================================
 * 初始化所有 Sheet 結構（首次使用時執行一次）
 * ============================================================
 * 在 Apps Script 編輯器中手動執行此函數以建立所有工作表
 */
function initAllSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Object.values(SHEETS).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      initSheetHeaders(sheet, name);
      Logger.log('Created sheet: ' + name);
    }
  });
  // Also create event_registrations
  let regSheet = ss.getSheetByName('event_registrations');
  if (!regSheet) {
    regSheet = ss.insertSheet('event_registrations');
    initSheetHeaders(regSheet, 'event_registrations');
  }
  Logger.log('✅ All sheets initialized successfully!');
}

/**
 * ============================================================
 * 插入示範資料（開發測試用）
 * ============================================================
 */
function insertDemoData() {
  // Demo Carbon Actions
  const caSheet = getSheet(SHEETS.CARBON_ACTIONS);
  const demoActions = [
    ['CA001', '搭乘捷運', '搭乘捷運通勤（每趟）', 0.5, 'transport', 30, 'active'],
    ['CA002', '搭乘公車', '搭乘公車通勤（每趟）', 0.3, 'transport', 20, 'active'],
    ['CA003', '自備環保杯', '使用自備杯購買飲料', 0.1, 'waste', 20, 'active'],
    ['CA004', '步行通勤', '步行通勤（每公里）', 0.15, 'transport', 15, 'active'],
    ['CA005', '騎自行車', '騎自行車通勤（每公里）', 0.1, 'transport', 10, 'active'],
    ['CA006', '節能行為', '調高空調至26度', 0.8, 'energy', 40, 'active'],
    ['CA007', '無紙化辦公', '今日使用電子文件', 0.05, 'waste', 10, 'active'],
    ['CA008', '素食一餐', '午餐選擇蔬食餐', 1.2, 'food', 50, 'active'],
    ['CA009', '垃圾分類', '正確完成垃圾分類', 0.2, 'waste', 25, 'active'],
    ['CA010', '自備購物袋', '購物使用環保袋', 0.05, 'waste', 15, 'active'],
  ];
  demoActions.forEach(r => caSheet.appendRow(r));

  // Demo Badges
  const bdSheet = getSheet(SHEETS.BADGES);
  const demoBadges = [
    ['BADGE_FIRST', 'ESG先鋒', '完成第一個ESG任務', '🌱', 'esg', 'mission_count', 1, now()],
    ['BADGE_100PTS', '百點達人', '累積100點', '⭐', 'points', 'points_total', 100, now()],
    ['BADGE_1000PTS', '千點英雄', '累積1000點', '💎', 'points', 'points_total', 1000, now()],
    ['BADGE_5STREAK', '5天連續', '連續完成5天任務', '🔥', 'streak', 'streak_days', 5, now()],
    ['BADGE_GREEN', '綠色通勤', '10次搭乘大眾運輸', '🚇', 'esg', 'transport_count', 10, now()],
    ['BADGE_CARBON10', '10kg CO₂', '累積減碳達10kg', '🌍', 'carbon', 'carbon_total', 10, now()],
  ];
  demoBadges.forEach(r => bdSheet.appendRow(r));

  Logger.log('✅ Demo data inserted!');
}
