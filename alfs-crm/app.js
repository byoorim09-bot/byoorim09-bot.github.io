/* 알프스 원장님 비서 — ALFS Shop Assistant
   단일 파일 웹앱 · Firebase Realtime Database 동기화 · 오프라인 캐시 */
'use strict';

/* =========================================================
   0. 설정값
   ========================================================= */
const FB_BASE = 'https://alfs-shop-crm-default-rtdb.asia-southeast1.firebasedatabase.app';
const DEMO_CODE = 'ALFS-DEMO';
const LS_SHOP = 'alfs.crm.shop';
const LS_SHOPS = 'alfs.crm.shops';
const LS_CACHE = 'alfs.crm.cache.';
const LS_QUEUE = 'alfs.crm.queue.';

const SERVICES = ['유디아 미네랄 케어', '오륜 미네랄 케어', '알프스 미네랄 체험', '데톡스 바디 케어', '림프 순환 관리', '상담/재방문'];
const STAFFS = ['원장', '실장', '직원1', '직원2'];
const GRADES = [['vip', 'VIP'], ['regular', '단골'], ['new', '신규'], ['trial', '체험']];
const STATUS = { book: '예약', confirm: '확정', done: '방문완료', noshow: '노쇼', cancel: '취소' };
const STATUS_CLASS = { '예약': 'st-book', '확정': 'st-confirm', '방문완료': 'st-done', '노쇼': 'st-noshow', '취소': 'st-cancel' };
const METHODS = ['카드', '현금', '계좌이체', '회원권 차감'];
const INFLOW = ['지인 소개', '블로그·인스타', '간판·지나가다', '알프스 제휴 샵', '기타'];

/* =========================================================
   1. 유틸
   ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function pad(n) { return String(n).padStart(2, '0'); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayISO() { return iso(new Date()); }
function parseISO(s) { const [y, m, d] = String(s || '').split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function addDaysISO(n, from) {
  const base = from ? parseISO(from) : new Date();
  base.setDate(base.getDate() + n);
  return iso(base);
}
function diffDays(a, b) { // a-b in days
  const A = parseISO(a), B = parseISO(b);
  return Math.round((A - B) / 86400000);
}
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function dowKR(dateStr) { return DOW[parseISO(dateStr).getDay()]; }
function fmtDate(dateStr) {
  const d = parseISO(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}
function fmtDateShort(dateStr) {
  const d = parseISO(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtRange(a, b) {
  const f = (str) => { const d = parseISO(str); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
  if (!a && !b) return '기간 없음';
  if (!b) return `${f(a)} ~ 기간 없음`;
  return `${f(a)} ~ ${f(b)}`;
}
function won(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }
function wonShort(n) {
  n = Number(n || 0);
  if (n >= 10000) { const v = n / 10000; return (Number.isInteger(v) ? v : v.toFixed(1)) + '만'; }
  return n.toLocaleString('ko-KR');
}
function timeLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const am = h < 12;
  const hh = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${am ? '오전' : '오후'} ${hh}:${pad(m)}`;
}
function hhmm(t) { return t || ''; }
function gradeLabel(g) { const f = GRADES.find(x => x[0] === g); return f ? f[1] : '신규'; }
function gradeClass(g) { return ({ vip: 'vip', regular: 'regular', new: 'new', trial: 'trial' }[g] || 'new'); }
function statusClass(s) { return STATUS_CLASS[s] || 'st-book'; }

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function chosung(str) {
  return Array.from(String(str)).map(ch => {
    const c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) return CHO[Math.floor((c - 0xAC00) / 588)];
    return ch;
  }).join('');
}
function phoneDigits(p) { return String(p || '').replace(/[^0-9]/g, ''); }
function normQuery(q) { return String(q || '').replace(/\s+/g, '').toLowerCase(); }

/* 아이콘 */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6"/><path d="M16.6 5.2a3.2 3.2 0 0 1 0 6.2"/><path d="M18.2 14.8c1.8.6 3 2.2 3 4.4"/>',
  ticket: '<path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.2a2.4 2.4 0 0 0 0 4.6v1.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.2a2.4 2.4 0 0 0 0-4.6Z"/><path d="M14 8v8"/>',
  chart: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.2-2.9l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.9h.07a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.08"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone: '<path d="M6.6 3h3l1.5 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.5v3A2.6 2.6 0 0 1 18.4 20C10.5 19.4 4.6 13.5 4 5.6A2.6 2.6 0 0 1 6.6 3Z"/>',
  msg: '<path d="M21 12a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.4-.7L3 21l1.3-4.2A8.4 8.4 0 1 1 21 12Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.4"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  arrowL: '<path d="M15 18l-6-6 6-6"/>',
  arrowR: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 21c0-4 3.4-6.4 7.5-6.4s7.5 2.4 7.5 6.4"/>',
  switch: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M7 3v6h8V3M8 21v-6h8v6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.4-3.2 8-8 9-4.8-1-8-4.6-8-9V6Z"/><path d="M9 12l2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};
function ic(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* 오류 수집 (검증용) */
window.__alfsErrors = [];
window.addEventListener('error', (e) => { try { window.__alfsErrors.push(String(e.message || e.error)); } catch (_) { } });
window.addEventListener('unhandledrejection', (e) => { try { window.__alfsErrors.push('promise: ' + String(e.reason && e.reason.message || e.reason)); } catch (_) { } });

/* 토스트 */
let toastTimer = null;
function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.innerHTML = `<div class="toast-in">${esc(msg)}</div>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* 클립보드 */
async function copyText(text, doneMsg = '복사했어요. 카카오톡에 붙여넣기 하세요.') {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) { }
    ta.remove();
  }
  toast(doneMsg);
  return text;
}

/* =========================================================
   2. 상태 · 동기화
   ========================================================= */
const S = {
  code: null, meta: {}, data: blankData(), ready: false,
  online: navigator.onLine, sync: 'idle', lastSync: 0,
  route: { name: 'home', id: null }, es: null, retryTimer: null, pollTimer: null,
  queue: [], review: false,
  ui: {
    reserveMode: 'day', weekStart: null, monthCursor: null, calSel: null,
    custTab: 'chart', query: '', grade: 'all', salesMode: 'day', salesMonth: null
  }
};
function blankData() { return { meta: {}, customers: {}, appointments: {}, passes: {}, treatments: {}, sales: {}, minerals: {} }; }
function blankShop(meta) { return Object.assign(blankData(), { meta: Object.assign({ code: S.code, createdAt: Date.now() }, meta || {}) }); }

function cacheKey() { return LS_CACHE + S.code; }
function cacheNow() { try { localStorage.setItem(cacheKey(), JSON.stringify(S.data)); } catch (e) { } }
function rememberShop(code, name) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(LS_SHOPS) || '[]'); } catch (e) { }
  list = list.filter(x => x.code !== code);
  list.unshift({ code, name: name || code, at: Date.now() });
  try { localStorage.setItem(LS_SHOPS, JSON.stringify(list.slice(0, 8))); } catch (e) { }
}
function knownShops() { try { return JSON.parse(localStorage.getItem(LS_SHOPS) || '[]'); } catch (e) { return []; } }

function shopUrl(path) {
  const base = `${FB_BASE}/shops/${encodeURIComponent(S.code)}`;
  return path ? `${base}/${path}.json` : `${base}.json`;
}
async function api(method, path, body) {
  const opt = { method, cache: 'no-store' };
  if (body !== undefined) { opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(body); }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  opt.signal = ctrl.signal;
  let res;
  try { res = await fetch(shopUrl(path), opt); }
  finally { clearTimeout(t); }
  const txt = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + txt.slice(0, 140));
  return txt ? JSON.parse(txt) : null;
}

function setPath(obj, path, val) {
  const parts = String(path).split('/').filter(Boolean);
  if (!parts.length) return val;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (val === null || val === undefined) delete cur[last]; else cur[last] = val;
  return obj;
}
function deepMerge(dst, src) {
  Object.keys(src || {}).forEach(k => {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof dst[k] !== 'object' || dst[k] === null) dst[k] = {};
      deepMerge(dst[k], v);
    } else if (v === null) delete dst[k]; else dst[k] = v;
  });
  return dst;
}
function normalize(d) {
  const out = blankData();
  if (d && typeof d === 'object') {
    Object.keys(out).forEach(k => {
      if (k === 'meta') out.meta = d.meta && typeof d.meta === 'object' ? d.meta : {};
      else out[k] = d[k] && typeof d[k] === 'object' ? d[k] : {};
    });
  }
  return out;
}

/* --- 쓰기 (낙관적 반영 + 실패 큐) --- */
function syncBadge() {
  if (!S.online) return { cls: 'off', text: '오프라인 저장' };
  if (S.sync === 'busy') return { cls: 'busy', text: '저장 중' };
  if (S.sync === 'off') return { cls: 'off', text: '연결 대기' };
  return { cls: '', text: '자동 저장' };
}
function markSync() {
  const b = syncBadge();
  const dot = $('#syncDot'), txt = $('#syncText');
  if (dot) dot.className = 'sync-dot ' + b.cls;
  if (txt) txt.textContent = b.text;
}
function queueSave(item) {
  S.queue.push(item);
  try { localStorage.setItem(LS_QUEUE + S.code, JSON.stringify(S.queue)); } catch (e) { }
}
async function flushQueue() {
  if (!S.queue.length || !S.online) return;
  const rest = [];
  for (const item of S.queue) {
    try {
      await api(item.m, item.path, item.body);
    } catch (e) { rest.push(item); }
  }
  S.queue = rest;
  try { localStorage.setItem(LS_QUEUE + S.code, JSON.stringify(S.queue)); } catch (e) { }
  if (!rest.length) { S.sync = 'idle'; markSync(); }
}
async function put(path, value, opt = {}) {
  setPath(S.data, path, value);
  if (!opt.silent) { cacheNow(); render(); }
  try {
    S.sync = 'busy'; markSync();
    await api('PUT', path, value);
    S.sync = 'idle'; S.online = true; S.lastSync = Date.now();
  } catch (e) {
    queueSave({ m: 'PUT', path, body: value });
    S.sync = 'off'; S.online = false;
    toast('기기에 먼저 저장했어요 · 연결되면 자동 반영됩니다');
  }
  markSync();
  cacheNow();
}
async function patchRoot(obj, opt = {}) {
  // RTDB REST PATCH는 요청 경로의 바로 아래 키만 병합하므로, 컬렉션별로 나눠 보낸다.
  deepMerge(S.data, JSON.parse(JSON.stringify(obj)));
  if (!opt.silent) { cacheNow(); render(); }
  S.sync = 'busy'; markSync();
  let ok = true;
  for (const col of Object.keys(obj)) {
    try { await api('PATCH', col, obj[col]); }
    catch (e) { ok = false; queueSave({ m: 'PATCH', path: col, body: obj[col] }); }
  }
  if (ok) { S.sync = 'idle'; S.online = true; S.lastSync = Date.now(); }
  else { S.sync = 'off'; S.online = false; toast('기기에 먼저 저장했어요 · 연결되면 자동 반영됩니다'); }
  markSync(); cacheNow();
}
async function del(path) {
  setPath(S.data, path, null);
  cacheNow(); render();
  try { await api('DELETE', path); S.sync = 'idle'; }
  catch (e) { queueSave({ m: 'DELETE', path }); S.sync = 'off'; markSync(); }
}

/* --- 실시간 스트림 --- */
function stopStream() {
  if (S.es) { try { S.es.close(); } catch (e) { } S.es = null; }
  clearInterval(S.pollTimer); S.pollTimer = null;
}
function startStream() {
  stopStream();
  if (!S.code) return;
  try {
    const es = new EventSource(shopUrl(''));
    S.es = es;
    const handle = (kind) => (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.path === undefined) return;
      if (kind === 'patch') {
        Object.keys(msg.data || {}).forEach(k => setPath(S.data, (msg.path === '/' ? '' : msg.path) + '/' + k, msg.data[k]));
      } else {
        if (!msg.path || msg.path === '/') S.data = normalize(msg.data);
        else setPath(S.data, msg.path, msg.data);
      }
      S.online = true; S.lastSync = Date.now();
      cacheNow(); renderSoon();
    };
    es.addEventListener('put', handle('put'));
    es.addEventListener('patch', handle('patch'));
    es.onerror = () => { S.online = navigator.onLine; markSync(); };
  } catch (e) { startPolling(); }
  startPolling();
}
function startPolling() {
  clearInterval(S.pollTimer);
  S.pollTimer = setInterval(async () => {
    if (!S.code || !navigator.onLine) return;
    try {
      const d = await api('GET', '');
      if (d) { S.data = normalize(d); S.online = true; cacheNow(); renderSoon(); }
    } catch (e) { S.online = false; markSync(); }
  }, 25000);
}

let renderTimer = null;
function renderSoon() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest('main') && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    render(true);
  }, 260);
}

/* =========================================================
   3. 데모 샘플 데이터
   ========================================================= */
function seedDemo() {
  const t = todayISO();
  const T = Date.now();
  const now = T;
  const d = (n) => addDaysISO(n);
  const at = (date, hm) => Date.parse(`${date}T${hm || '10:00'}:00`);
  return {
    meta: {
      code: DEMO_CODE, name: '알프스 강남점 (체험)', ownerName: '박선영', staffName: '실장',
      phone: '02-555-0188', address: '서울 강남구 테헤란로 132, 3층', intro: '미네랄 케어 전문',
      createdAt: T, updatedAt: T, demo: true
    },
    customers: {
      c1: { id: 'c1', name: '김미숙', phone: '010-2345-6712', grade: 'vip', birth: '1968-03-12', inflow: '지인 소개', memo: '유디아 미네랄 3년째. 어깨 결림이 심해 압을 세게 해달라고 하심. 커피 대신 보리차 드심.', tags: ['유디아', '어깨'], createdAt: at(d(-430), '11:00') },
      c2: { id: 'c2', name: '박정희', phone: '010-8765-4321', grade: 'regular', birth: '1971-08-02', inflow: '간판·지나가다', memo: '오륜 미네랄 위주. 무릎이 안 좋아 오실 때 계단 안내 필요.', tags: ['오륜', '무릎'], createdAt: at(d(-300), '15:20') },
      c3: { id: 'c3', name: '이영자', phone: '010-3333-1122', grade: 'new', birth: '1975-01-19', inflow: '지인 소개', memo: '지인 소개로 처음 방문. 체험 후 상담 예정.', tags: ['신규'], createdAt: at(d(-46), '10:10') },
      c4: { id: 'c4', name: '최순자', phone: '010-5555-7788', grade: 'regular', birth: '1965-11-30', inflow: '블로그·인스타', memo: '정액권 사용 중. 손 목 마사지 선호.', tags: ['정액권'], createdAt: at(d(-210), '13:00') },
      c5: { id: 'c5', name: '정명숙', phone: '010-9999-1010', grade: 'trial', birth: '1972-06-08', inflow: '블로그·인스타', memo: '인스타 보고 문의. 미네랄 체험 예약.', tags: ['체험'], createdAt: at(d(-12), '18:30') },
      c6: { id: 'c6', name: '한지영', phone: '010-7777-2020', grade: 'vip', birth: '1979-04-25', inflow: '지인 소개', memo: '피부 건조. 데톡스와 미네랄 병행.', tags: ['데톡스'], createdAt: at(d(-160), '12:40') }
    },
    appointments: {
      a1: { id: 'a1', customerId: 'c1', name: '김미숙', phone: '010-2345-6712', date: t, time: '09:30', service: '유디아 미네랄 케어', staff: '원장', status: '방문완료', passId: 'p1', price: 120000, memo: '어깨 위주로 부탁', createdAt: at(t, '08:10') },
      a2: { id: 'a2', customerId: 'c2', name: '박정희', phone: '010-8765-4321', date: t, time: '11:30', service: '오륜 미네랄 케어', staff: '원장', status: '확정', passId: 'p2', price: 90000, memo: '', createdAt: at(d(-2), '16:00') },
      a3: { id: 'a3', customerId: 'c4', name: '최순자', phone: '010-5555-7788', date: t, time: '14:00', service: '데톡스 바디 케어', staff: '실장', status: '확정', passId: 'p3', price: 80000, memo: '손 목 위주', createdAt: at(d(-1), '11:20') },
      a4: { id: 'a4', customerId: 'c5', name: '정명숙', phone: '010-9999-1010', date: t, time: '16:30', service: '알프스 미네랄 체험', staff: '원장', status: '예약', passId: '', price: 0, memo: '체험 후 상담 연결', createdAt: at(d(-3), '19:00') },
      a5: { id: 'a5', customerId: 'c6', name: '한지영', phone: '010-7777-2020', date: d(1), time: '10:00', service: '유디아 미네랄 케어', staff: '원장', status: '예약', passId: '', price: 120000, memo: '', createdAt: at(t, '07:50') },
      a6: { id: 'a6', customerId: 'c3', name: '이영자', phone: '010-3333-1122', date: d(1), time: '15:00', service: '상담/재방문', staff: '원장', status: '예약', passId: '', price: 0, memo: '체험 후 상담', createdAt: at(t, '09:30') },
      a7: { id: 'a7', customerId: 'c1', name: '김미숙', phone: '010-2345-6712', date: d(2), time: '11:00', service: '유디아 미네랄 케어', staff: '원장', status: '확정', passId: 'p1', price: 120000, memo: '', createdAt: at(t, '08:15') }
    },
    passes: {
      p1: { id: 'p1', customerId: 'c1', customerName: '김미숙', type: '횟수권', name: '유디아 30회권', total: 30, remaining: 8, amount: 1500000, startDate: d(-300), expireDate: d(65), memo: '', active: true, createdAt: at(d(-300), '11:00'), history: {} },
      p2: { id: 'p2', customerId: 'c2', customerName: '박정희', type: '횟수권', name: '오륜 20회권', total: 20, remaining: 3, amount: 900000, startDate: d(-250), expireDate: d(40), memo: '', active: true, createdAt: at(d(-250), '15:00'), history: {} },
      p3: { id: 'p3', customerId: 'c4', customerName: '최순자', type: '정액권', name: '알프스 정액권 50만', total: 500000, remaining: 185000, amount: 500000, startDate: d(-120), expireDate: d(120), memo: '잔액 소진 시 재충전 안내', active: true, createdAt: at(d(-120), '13:00'), history: {} }
    },
    treatments: {
      t1: { id: 't1', customerId: 'c1', date: t, service: '유디아 미네랄 케어', staff: '원장', memo: '어깨 상부 위주. 시술 후 많이 편해하심.', createdAt: at(t, '10:20') },
      t2: { id: 't2', customerId: 'c1', date: d(-29), service: '유디아 미네랄 케어', staff: '원장', memo: '어깨 결림 완화. 다음 방문 시 승모근 위주.', createdAt: at(d(-29), '10:30') },
      t3: { id: 't3', customerId: 'c1', date: d(-59), service: '유디아 미네랄 케어', staff: '원장', memo: '수면 개선되었다고 하심.', createdAt: at(d(-59), '10:30') },
      t4: { id: 't4', customerId: 'c2', date: d(-33), service: '오륜 미네랄 케어', staff: '원장', memo: '무릎 주변 부기 감소.', createdAt: at(d(-33), '11:40') },
      t5: { id: 't5', customerId: 'c4', date: d(-38), service: '데톡스 바디 케어', staff: '실장', memo: '종아리 붓기 완화. 집에서 스트레칭 안내.', createdAt: at(d(-38), '14:20') },
      t6: { id: 't6', customerId: 'c6', date: d(-41), service: '유디아 미네랄 케어', staff: '원장', memo: '피부 건조. 보습 크림 함께 안내.', createdAt: at(d(-41), '10:50') },
      t7: { id: 't7', customerId: 'c3', date: t, service: '상담/재방문', staff: '원장', memo: '체험 후 상담. 다음 주 재방문 예약.', createdAt: at(t, '08:50') }
    },
    sales: {
      s1: { id: 's1', date: t, at: at(t, '09:30'), amount: 120000, method: '카드', customerId: 'c1', customerName: '김미숙', items: '유디아 미네랄 케어', passId: 'p1', appointmentId: 'a1', memo: '' },
      s2: { id: 's2', date: t, at: at(t, '08:50'), amount: 80000, method: '현금', customerId: 'c3', customerName: '이영자', items: '부분 관리', passId: '', appointmentId: '', memo: '' },
      s3: { id: 's3', date: t, at: at(t, '10:40'), amount: 150000, method: '카드', customerId: 'c5', customerName: '정명숙', items: '홈케어 제품', passId: '', appointmentId: '', memo: '체험 전 상담 중 구매' },
      s4: { id: 's4', date: d(-1), at: at(d(-1), '11:00'), amount: 120000, method: '카드', customerId: 'c1', customerName: '김미숙', items: '유디아 미네랄 케어', passId: 'p1', appointmentId: '', memo: '' },
      s5: { id: 's5', date: d(-2), at: at(d(-2), '10:20'), amount: 210000, method: '카드', customerId: 'c3', customerName: '이영자', items: '유디아 미네랄 + 데톡스', passId: '', appointmentId: '', memo: '' },
      s6: { id: 's6', date: d(-4), at: at(d(-4), '11:10'), amount: 120000, method: '카드', customerId: 'c1', customerName: '김미숙', items: '유디아 미네랄 케어', passId: 'p1', appointmentId: '', memo: '' },
      s7: { id: 's7', date: d(-5), at: at(d(-5), '16:10'), amount: 90000, method: '계좌이체', customerId: 'c5', customerName: '정명숙', items: '오륜 미네랄 케어', passId: '', appointmentId: '', memo: '' },
      s8: { id: 's8', date: d(-7), at: at(d(-7), '10:00'), amount: 150000, method: '카드', customerId: 'c3', customerName: '이영자', items: '체험 + 홈케어', passId: '', appointmentId: '', memo: '' },
      s9: { id: 's9', date: d(-9), at: at(d(-9), '13:30'), amount: 240000, method: '카드', customerId: 'c1', customerName: '김미숙', items: '유디아 2회분', passId: 'p1', appointmentId: '', memo: '' },
      s10: { id: 's10', date: d(-11), at: at(d(-11), '11:20'), amount: 120000, method: '현금', customerId: 'c5', customerName: '정명숙', items: '데톡스 바디 케어', passId: '', appointmentId: '', memo: '' },
      s11: { id: 's11', date: d(-14), at: at(d(-14), '10:40'), amount: 120000, method: '카드', customerId: 'c1', customerName: '김미숙', items: '유디아 미네랄 케어', passId: 'p1', appointmentId: '', memo: '' },
      s12: { id: 's12', date: d(-16), at: at(d(-16), '15:10'), amount: 80000, method: '카드', customerId: '', customerName: '현장 방문 고객', items: '부분 관리', passId: '', appointmentId: '', memo: '' },
      s13: { id: 's13', date: d(-18), at: at(d(-18), '11:50'), amount: 90000, method: '카드', customerId: 'c3', customerName: '이영자', items: '오륜 미네랄 케어', passId: '', appointmentId: '', memo: '' },
      s14: { id: 's14', date: d(-20), at: at(d(-20), '14:30'), amount: 150000, method: '카드', customerId: 'c5', customerName: '정명숙', items: '데톡스 + 케어', passId: '', appointmentId: '', memo: '' }
    },
    minerals: {
      m1: { id: 'm1', customerId: 'c2', customerName: '박정희', product: '오륜 미네랄', type: '구매', date: d(-33), dueDate: d(-3), status: '대기', memo: '20회권 잔여 3회 · 재구매 상담', createdAt: at(d(-33), '11:40') },
      m2: { id: 'm2', customerId: 'c6', customerName: '한지영', product: '유디아 미네랄', type: '체험', date: d(-31), dueDate: d(-1), status: '대기', memo: '체험 후 첫 구매 전환 대상', createdAt: at(d(-31), '10:50') }
    }
  };
}

/* =========================================================
   4. 계산 도우미
   ========================================================= */
function customersArr() { return Object.values(S.data.customers || {}).filter(c => c && c.id); }
function apptsArr() { return Object.values(S.data.appointments || {}).filter(a => a && a.id); }
function passesArr() { return Object.values(S.data.passes || {}).filter(p => p && p.id); }
function salesArr() { return Object.values(S.data.sales || {}).filter(x => x && x.id); }
function treatmentsArr() { return Object.values(S.data.treatments || {}).filter(x => x && x.id); }
function mineralsArr() { return Object.values(S.data.minerals || {}).filter(x => x && x.id); }

function customer(id) { return (S.data.customers || {})[id] || null; }
function apptsOn(date) {
  return apptsArr().filter(a => a.date === date && a.status !== '취소')
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}
function passLeft(p) {
  if (!p) return '';
  return p.type === '정액권' ? won(p.remaining) : `${p.remaining}/${p.total}회`;
}
function passesOf(cid, activeOnly = true) {
  return passesArr().filter(p => p.customerId === cid && (!activeOnly || p.active !== false))
    .sort((a, b) => (a.expireDate || '').localeCompare(b.expireDate || ''));
}
function lastVisit(c) {
  if (!c) return null;
  const dates = [];
  treatmentsArr().filter(t => t.customerId === c.id).forEach(t => dates.push(t.date));
  apptsArr().filter(a => a.customerId === c.id && a.status === '방문완료').forEach(a => dates.push(a.date));
  salesArr().filter(s => s.customerId === c.id).forEach(s => dates.push(s.date));
  if (!dates.length) return null;
  return dates.sort().pop();
}
function regDate(c) { return c && c.createdAt ? iso(new Date(c.createdAt)) : null; }
function lastTouch(c) { return lastVisit(c) || regDate(c); }
function daysSince(dateStr) { return dateStr ? diffDays(todayISO(), dateStr) : null; }
function monthKey(dateStr) { return String(dateStr || '').slice(0, 7); }
function salesOn(date) { return salesArr().filter(s => s.date === date); }
function sumSales(list) { return list.reduce((n, s) => n + (Number(s.amount) || 0), 0); }
function salesInMonth(ym) { return salesArr().filter(s => monthKey(s.date) === ym); }
function ym(d) { d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthTitle(ymStr) { const [y, m] = ymStr.split('-'); return `${y}년 ${Number(m)}월`; }

function refillDue() {
  return mineralsArr()
    .filter(m => m.status !== '완료' && m.dueDate && m.dueDate <= todayISO())
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
}
function churnRisk() {
  return customersArr()
    .map(c => ({ c, last: lastTouch(c) }))
    .filter(x => x.last && daysSince(x.last) >= 30)
    .sort((a, b) => (a.last || '').localeCompare(b.last || ''));
}
function activePassesSoon() {
  return passesArr().filter(p => p.active !== false && (p.type === '횟수권' ? p.remaining <= 3 : p.remaining <= (Number(p.total || 1) * 0.15)))
    .sort((a, b) => (a.type === '횟수권' ? a.remaining - b.remaining : a.remaining - b.remaining));
}
function shopName() { return (S.data.meta && S.data.meta.name) || S.meta.name || '알프스 샵'; }
function ownerName() { return (S.data.meta && S.data.meta.ownerName) || ''; }

/* =========================================================
   5. 안내 문구
   ========================================================= */
function msgRemind(a, when) {
  const c = customer(a.customerId) || {};
  const nm = shopName();
  const tel = (S.data.meta && S.data.meta.phone) || '';
  const addr = (S.data.meta && S.data.meta.address) || '';
  if (when === 'today') {
    return `[${nm}] ${a.name} 고객님, 오늘 ${timeLabel(a.time)} ${a.service} 예약되어 있습니다.\n편하게 오실 수 있도록 시간 확인 부탁드려요 :)\n${addr ? '· 위치: ' + addr + '\n' : ''}변경이나 취소는 ${tel || '샵으로'} 연락 주세요.`;
  }
  return `[${nm}] ${a.name} 고객님, 내일 ${fmtDate(a.date)} ${timeLabel(a.time)}에 ${a.service} 예약되어 있습니다.\n오늘 물 충분히 드시고 편하게 오세요 :)\n${addr ? '· 위치: ' + addr + '\n' : ''}변경/취소는 ${tel || '샵으로'} 연락 주세요.`;
}
function msgRefill(m) {
  const c = customer(m.customerId) || {};
  const days = m.date ? daysSince(m.date) : 30;
  return `[${shopName()}] ${m.customerName} 고객님, ${m.product} 드신 지 ${days}일 되었어요.\n요즘 컨디션 어떠세요? 지금 시기에 한 번 더 챙겨 드시면 좋을 것 같아 연락드렸습니다 :)\n이번 주 원하시는 시간으로 예약 잡아드릴게요.`;
}
function msgMiss(c, last) {
  const d = daysSince(last);
  return `[${shopName()}] ${c.name} 고객님, 요즘 잘 지내시죠?\n마지막 방문이 ${d}일 전이네요. 그동안 몸 상태는 어떠셨는지 궁금합니다 :)\n이번 주 편하신 시간에 들러 주시면 미네랄 케어로 리프레시해 드릴게요.`;
}
function msgPassRenew(p) {
  return `[${shopName()}] ${p.customerName || ''} 고객님, ${p.name} 잔여가 ${passLeft(p)} 남았습니다.\n다음 방문 때 이어서 사용하실 수 있게 준비해 두겠습니다 :)\n재등록이나 연장 관련해서 궁금하신 점 편하게 물어봐 주세요.`;
}
function msgThanks(a) {
  return `[${shopName()}] ${a.name} 고객님, 오늘 ${a.service} 잘 받으셨죠?\n집에서도 물 자주 드시고 푹 쉬세요 :)\n다음 방문 때 더 좋은 컨디션으로 뵙겠습니다.`;
}

/* =========================================================
   6. 셸 · 라우팅
   ========================================================= */
const ROUTES = { home: '홈', reserve: '예약', customers: '고객', passes: '회원권', sales: '매출', settings: '설정', customer: '고객 상세' };
function go(hash) {
  if (location.hash === hash) { routeFromHash(); return; }
  location.hash = hash;
}
function routeFromHash() {
  const h = (location.hash || '#/home').replace(/^#\/?/, '');
  const [name, id] = h.split('/');
  S.route = { name: ROUTES[name] ? name : 'home', id: id || null };
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}
window.addEventListener('hashchange', routeFromHash);

function render(keepScroll) {
  const app = $('#app');
  if (!S.ready || !S.code) { return; }
  const y = keepScroll ? window.scrollY : 0;
  const activeTab = S.route.name === 'customer' ? 'customers' : S.route.name;
  const badge = syncBadge();
  const header = `
  <header class="topbar">
    <div class="topbar-in">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">A</div>
        <div class="brand-txt">
          <div class="brand-title">알프스 원장님 비서</div>
          <div class="brand-sub">
            <span id="syncDot" class="sync-dot ${badge.cls}"></span>
            <span id="syncText">${esc(badge.text)}</span>
            <span aria-hidden="true">·</span>
            <span style="max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(shopName())}</span>
          </div>
        </div>
      </div>
      <div class="topbar-spacer"></div>
      <button class="icon-btn" data-act="goto" data-to="#/settings" aria-label="설정">${ic('gear')}</button>
    </div>
  </header>`;
  const navItems = [['home', 'home', '홈'], ['reserve', 'cal', '예약'], ['customers', 'users', '고객'], ['passes', 'ticket', '회원권'], ['sales', 'chart', '매출']];
  const nav = `
  <nav class="nav" aria-label="주요 메뉴">
    <div class="nav-in">
      ${navItems.map(([r, i, t]) => `<button class="nav-btn ${activeTab === r ? 'on' : ''}" data-act="goto" data-to="#/${r}" ${activeTab === r ? 'aria-current="page"' : ''}>${ic(i)}<span>${t}</span></button>`).join('')}
    </div>
  </nav>`;
  let body = '';
  switch (S.route.name) {
    case 'home': body = viewHome(); break;
    case 'reserve': body = viewReserve(); break;
    case 'customers': body = viewCustomers(); break;
    case 'customer': body = viewCustomer(S.route.id); break;
    case 'passes': body = viewPasses(); break;
    case 'sales': body = viewSales(); break;
    case 'settings': body = viewSettings(); break;
    default: body = viewHome();
  }
  app.innerHTML = `<div class="app-shell">${header}${nav}<main id="main">${body}</main></div>`;
  if (keepScroll) window.scrollTo({ top: y, behavior: 'auto' });
  markSync();
}
function renderLoading() {
  $('#app').innerHTML = `<div class="loading-wrap"><div class="spin"></div><div>${esc('샵 데이터를 불러오고 있어요')}</div></div>`;
}

/* =========================================================
   7. 홈
   ========================================================= */
function viewHome() {
  const t = todayISO();
  const todayAppts = apptsOn(t).filter(a => a.status !== '노쇼');
  const todays = salesOn(t);
  const monthS = salesInMonth(ym());
  const refills = refillDue();
  const risks = churnRisk();
  const remain = todayAppts.filter(a => a.status !== '방문완료');
  const hero = `
  <section class="hero">
    <div class="hero-date">${new Date().getFullYear()}년 ${fmtDate(t)}</div>
    <div class="hero-title">${ownerName() ? esc(ownerName()) + ' 원장님' : '원장님'}, 오늘도 반갑습니다</div>
    <div class="hero-sub">${esc(shopName())} · 오늘 예약 ${todayAppts.length}건 · 남은 예약 ${remain.length}건</div>
    <div class="hero-stats">
      <div class="hero-stat"><b>${todayAppts.length}<small style="font-size:13px">건</small></b><span>오늘 예약</span></div>
      <div class="hero-stat gold"><b>${wonShort(sumSales(todays))}<small style="font-size:13px">원</small></b><span>오늘 매출</span></div>
      <div class="hero-stat"><b>${wonShort(sumSales(monthS))}<small style="font-size:13px">원</small></b><span>이번 달</span></div>
      <div class="hero-stat"><b>${refills.length + risks.length}<small style="font-size:13px">명</small></b><span>관리 필요</span></div>
    </div>
  </section>`;

  const quick = `
  <section class="section">
    <div class="quick-grid">
      <button class="quick-btn" data-act="new-appt">${ic('cal')}<span>예약 등록</span></button>
      <button class="quick-btn" data-act="new-cust">${ic('users')}<span>고객 등록</span></button>
      <button class="quick-btn" data-act="new-sale">${ic('money')}<span>매출 등록</span></button>
      <button class="quick-btn" data-act="new-pass">${ic('ticket')}<span>회원권 등록</span></button>
    </div>
  </section>`;

  const apptList = todayAppts.length
    ? todayAppts.map(a => apptCard(a)).join('')
    : `<div class="empty"><b>오늘 예약이 없어요</b>예약 등록을 눌러 첫 예약을 잡아 보세요.</div>`;

  const refillCards = refills.length ? refills.map(m => {
    const over = daysSince(m.dueDate);
    const c = customer(m.customerId);
    return `
    <div class="card alert">
      <div class="row wrap">
        <div class="li-main">
          <div class="li-title">${esc(m.customerName)} <span class="chip warn">${over > 0 ? `D+${over}` : '오늘'}</span></div>
          <div class="li-sub">${esc(m.product)} · ${m.type || '구매'} ${m.date ? fmtDateShort(m.date) : ''} · 리필 주기 30일</div>
        </div>
      </div>
      <div class="appt-actions">
        <button class="btn gold sm" data-act="copy-refill" data-id="${m.id}">${ic('copy')}리필 멘트 복사</button>
        ${c ? `<button class="btn sm" data-act="appt-for" data-id="${c.id}">${ic('cal')}예약 잡기</button>` : ''}
      </div>
    </div>`;
  }).join('') : `<div class="empty"><b>리필 안내 대상이 없어요</b>미네랄 구매 고객은 30일 뒤 자동으로 알려드려요.</div>`;

  const riskCards = risks.length ? risks.slice(0, 4).map(({ c, last }) => `
    <div class="list-card">
      <div class="avatar ${['', 'g2', 'g3', 'g4'][customersArr().indexOf(c) % 4]}">${esc(String(c.name || '?').slice(0, 1))}</div>
      <div class="li-main">
        <div class="li-title">${esc(c.name)} <span class="chip ${gradeClass(c.grade)}">${gradeLabel(c.grade)}</span></div>
        <div class="li-sub">마지막 방문 ${daysSince(last)}일 전 · ${esc(c.phone || '')}</div>
      </div>
      <div class="li-right">
        <button class="btn sm gold" data-act="copy-miss" data-id="${c.id}">안부 문자</button>
      </div>
    </div>`).join('') : `<div class="empty"><b>모두 잘 오고 계세요</b>30일 넘게 안 오신 고객이 없습니다.</div>`;

  const monthAvg = monthS.length ? Math.round(sumSales(monthS) / monthS.length) : 0;
  return `
  ${hero}
  ${quick}
  <section class="section">
    <div class="section-head">
      <h2 class="section-title">오늘 예약 <span class="cnt">${todayAppts.length}</span></h2>
      <button class="link-btn" data-act="goto" data-to="#/reserve">전체 보기</button>
    </div>
    ${apptList}
  </section>

  <div class="two-col">
    <div>
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">${ic('bell')} 미네랄 리필 도래 <span class="cnt">${refills.length}</span></h2>
        </div>
        ${refillCards}
      </section>
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">${ic('heart')} 30일 넘게 안 오신 고객 <span class="cnt">${risks.length}</span></h2>
        </div>
        ${riskCards}
      </section>
    </div>
    <div>
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">이번 달 매출</h2>
          <button class="link-btn" data-act="goto" data-to="#/sales">자세히</button>
        </div>
        <div class="card">
          <div class="kv"><span class="k">이번 달 합계</span><b>${won(sumSales(monthS))}</b></div>
          <div class="kv"><span class="k">오늘 합계</span><b>${won(sumSales(todays))} <span class="tiny muted">${todays.length}건</span></b></div>
          <div class="kv"><span class="k">객단가</span><b>${won(monthAvg)}</b></div>
          <div class="kv"><span class="k">회원권 잔여</span><b>${passesArr().filter(p => p.active !== false).length}건</b></div>
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="section-title">회원권 잔여 알림</h2></div>
        ${activePassesSoon().length ? activePassesSoon().slice(0, 3).map(p => `
          <div class="card tight">
            <div class="row">
              <div class="li-main">
                <div class="li-title">${esc(p.customerName || customer(p.customerId)?.name || '')} <span class="chip gold">${esc(p.type)}</span></div>
                <div class="li-sub">${esc(p.name)} · 잔여 ${passLeft(p)}</div>
              </div>
              <button class="btn sm" data-act="copy-pass" data-id="${p.id}" aria-label="재등록 안내 문구 복사">${ic('copy')}</button>
            </div>
          </div>`).join('') : `<div class="empty"><b>잔여가 넉넉해요</b>잔여 2회 이하일 때 알려드려요.</div>`}
      </section>
    </div>
  </div>`;
}

function apptCard(a) {
  const st = a.status || '예약';
  const cls = st === '방문완료' ? 'done' : (st === '노쇼' ? 'noshow' : '');
  const actions = [];
  if (st === '예약') actions.push(`<button class="btn emerald sm" data-act="appt-confirm" data-id="${a.id}">${ic('check')}예약 확정</button>`);
  if (st === '예약' || st === '확정') {
    actions.push(`<button class="btn primary sm" data-act="appt-done" data-id="${a.id}">${ic('check')}방문 완료</button>`);
    actions.push(`<button class="btn sm" data-act="copy-remind" data-id="${a.id}" data-when="${a.date === todayISO() ? 'today' : 'tomorrow'}">${ic('copy')}안내문</button>`);
    actions.push(`<button class="btn danger sm" data-act="appt-noshow" data-id="${a.id}">노쇼·취소</button>`);
  } else {
    actions.push(`<button class="btn sm" data-act="appt-detail" data-id="${a.id}">${ic('info')}기록 보기</button>`);
    actions.push(`<button class="btn sm" data-act="copy-thanks" data-id="${a.id}">${ic('copy')}감사 문자</button>`);
  }
  const p = a.passId ? (S.data.passes || {})[a.passId] : null;
  return `
  <div class="card">
    <div class="appt">
      <div class="appt-time ${cls}"><b>${esc((a.time || '').slice(0, 5))}</b><span>${esc(timeLabel(a.time).split(' ')[0])}</span></div>
      <div class="appt-main">
        <div class="appt-name">${esc(a.name || '이름 없음')} <span class="chip ${statusClass(st)}">${esc(st)}</span></div>
        <div class="appt-meta">${esc(a.service || '')} · 담당 ${esc(a.staff || '원장')}${p ? ` · 회원권 ${esc(passLeft(p))}` : ''}</div>
        ${a.memo ? `<div class="appt-meta">메모: ${esc(a.memo)}</div>` : ''}
        <div class="appt-actions">${actions.join('')}</div>
      </div>
    </div>
  </div>`;
}

/* =========================================================
   8. 예약
   ========================================================= */
function weekStartISO(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  return iso(monday);
}
function viewReserve() {
  const mode = S.ui.reserveMode;
  const t = todayISO();
  let content = '';
  if (mode === 'day') content = reserveDay(S.ui.calSel && S.ui.calSel.length === 10 ? S.ui.calSel : t);
  else if (mode === 'week') content = reserveWeek();
  else content = reserveMonth();
  return `
  <div class="page-head">
    <div>
      <h1 class="page-title">예약</h1>
      <div class="page-sub">예약 등록 · 확정 · 방문 완료를 한 화면에서</div>
    </div>
    <button class="btn gold" data-act="new-appt">${ic('plus')}예약</button>
  </div>
  <div class="seg" role="tablist">
    ${[['day', '오늘'], ['week', '주간'], ['month', '월간']].map(([m, l]) =>
    `<button class="${mode === m ? 'on' : ''}" data-act="reserve-mode" data-mode="${m}" role="tab" aria-selected="${mode === m}">${l}</button>`).join('')}
  </div>
  ${content}`;
}
function reserveDay(date) {
  const list = apptsOn(date);
  const head = `
  <div class="row" style="justify-content:space-between;margin-bottom:10px">
    <button class="btn sm" data-act="day-shift" data-d="-1">${ic('arrowL')}이전</button>
    <div style="text-align:center">
      <div style="font-weight:900;font-size:18px">${fmtDate(date)}</div>
      <div class="tiny muted">${date === todayISO() ? '오늘' : diffDays(date, todayISO()) > 0 ? `${diffDays(date, todayISO())}일 뒤` : `${-diffDays(date, todayISO())}일 전`} · ${list.length}건</div>
    </div>
    <button class="btn sm" data-act="day-shift" data-d="1">다음${ic('arrowR')}</button>
  </div>
  ${list.length ? `<button class="btn block gold sm" data-act="copy-day-remind" data-date="${date}" style="margin-bottom:10px">${ic('copy')}이 날 예약 ${list.length}건 안내문 한 번에 복사</button>` : ''}`;
  const body = list.length ? list.map(a => apptCard(a)).join('')
    : `<div class="empty"><b>이 날은 예약이 없습니다</b>예약 등록으로 새 예약을 잡아 보세요.</div>`;
  return head + body;
}
function reserveWeek() {
  const start = S.ui.weekStart || weekStartISO(0);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(i, start));
  const total = days.reduce((n, d) => n + apptsOn(d).length, 0);
  const groups = days.map(d => {
    const list = apptsOn(d);
    if (!list.length) return '';
    return `<div class="day-group"><h4>${fmtDate(d)} <span class="chip ${d === todayISO() ? 'gold' : ''}">${list.length}건</span></h4>${list.map(a => apptCard(a)).join('')}</div>`;
  }).join('');
  return `
  <div class="row" style="justify-content:space-between;margin-bottom:12px">
    <button class="btn sm" data-act="week-shift" data-d="-1">${ic('arrowL')}지난주</button>
    <div style="text-align:center"><div style="font-weight:900">${fmtDateShort(start)} ~ ${fmtDateShort(days[6])}</div><div class="tiny muted">이번 주 ${total}건</div></div>
    <button class="btn sm" data-act="week-shift" data-d="1">다음주${ic('arrowR')}</button>
  </div>
  ${groups || `<div class="empty"><b>이번 주는 예약이 없습니다</b>예약 등록으로 새 예약을 잡아 보세요.</div>`}`;
}
function reserveMonth() {
  const cur = S.ui.monthCursor || ym();
  const [y, m] = cur.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const offset = first.getDay();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(`<div class="cal-cell out"></div>`);
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${y}-${pad(m)}-${pad(d)}`;
    const list = apptsOn(ds);
    const sel = S.ui.calSel === ds;
    const cls = ['cal-cell', ds === todayISO() ? 'today' : '', sel ? 'sel' : ''].join(' ');
    const dots = list.slice(0, 4).map(a => `<i class="dot ${a.status === '방문완료' ? 'done' : a.status === '노쇼' ? 'n' : ''}"></i>`).join('');
    cells.push(`<button class="${cls}" data-act="cal-select" data-date="${ds}" aria-label="${fmtDate(ds)} 예약 ${list.length}건">
      <span class="d">${d}</span>
      ${list.length ? `<span class="dots">${dots}</span><span class="cnt">${list.length}</span>` : '<span class="cnt"> </span>'}
    </button>`);
  }
  const selDate = S.ui.calSel;
  const selList = selDate ? apptsOn(selDate) : [];
  return `
  <div class="row" style="justify-content:space-between;margin-bottom:12px">
    <button class="btn sm" data-act="month-shift" data-d="-1">${ic('arrowL')}</button>
    <div style="font-weight:900;font-size:18px">${monthTitle(cur)}</div>
    <button class="btn sm" data-act="month-shift" data-d="1">${ic('arrowR')}</button>
  </div>
  <div class="card">
    <div class="cal-grid" style="margin-bottom:5px">${['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    <div class="tiny muted mt8">날짜를 누르면 그날 예약이 아래에 나옵니다.</div>
  </div>
  ${selDate ? `<div class="section"><div class="section-head"><h2 class="section-title">${fmtDate(selDate)}</h2><button class="btn sm" data-act="new-appt" data-date="${selDate}">${ic('plus')}예약 추가</button></div>
    ${selList.length ? selList.map(a => apptCard(a)).join('') : `<div class="empty"><b>이 날은 예약이 없습니다</b>예약 추가를 눌러 잡아 보세요.</div>`}</div>` : ''}`;
}

/* =========================================================
   9. 고객
   ========================================================= */
function matchCustomer(c, q) {
  if (!q) return true;
  const nq = normQuery(q);
  const name = normQuery(c.name);
  const phone = phoneDigits(c.phone);
  return name.includes(nq) || chosung(c.name).includes(nq) || (nq && phone.includes(phoneDigits(nq)));
}
function viewCustomers() {
  const q = S.ui.query;
  let list = customersArr().filter(c => matchCustomer(c, q));
  if (S.ui.grade !== 'all') list = list.filter(c => (c.grade || 'new') === S.ui.grade);
  list.sort((a, b) => {
    const la = lastVisit(a) || '', lb = lastVisit(b) || '';
    return lb.localeCompare(la);
  });
  return `
  <div class="page-head">
    <div><h1 class="page-title">고객</h1><div class="page-sub">이름·전화번호·초성으로 검색</div></div>
    <button class="btn gold" data-act="new-cust">${ic('plus')}고객</button>
  </div>
  <div class="field" style="margin-bottom:10px">
    <label class="sr" for="q">고객 검색</label>
    <input id="q" class="input" type="search" inputmode="search" placeholder="이름 또는 전화번호 (예: 김미, 2345, ㄱㅁ)" value="${esc(q)}" data-act="search" autocomplete="off">
  </div>
  <div class="seg" style="margin-bottom:12px">
    ${[['all', '전체'], ...GRADES].map(([g, l]) => `<button class="${S.ui.grade === g ? 'on' : ''}" data-act="grade" data-grade="${g}">${l}</button>`).join('')}
  </div>
  <div class="tiny muted" style="margin:0 2px 8px">${list.length}명</div>
  ${list.length ? list.map(c => {
    const last = lastVisit(c);
    const p = passesOf(c.id)[0];
    const idx = customersArr().indexOf(c) % 4;
    return `<div class="list-card clickable" data-act="cust-open" data-id="${c.id}">
      <div class="avatar ${idx ? 'g' + (idx + 1) : ''}">${esc(String(c.name || '?').slice(0, 1))}</div>
      <div class="li-main">
        <div class="li-title">${esc(c.name)} <span class="chip ${gradeClass(c.grade)}">${gradeLabel(c.grade)}</span></div>
        <div class="li-sub">${esc(c.phone || '연락처 없음')}</div>
        <div class="li-sub tiny">${last ? (daysSince(last) === 0 ? '오늘 방문' : `최근 방문 ${daysSince(last)}일 전`) : (regDate(c) ? `등록 ${daysSince(regDate(c))}일 전` : '방문 기록 없음')}${p ? ` · 회원권 ${passLeft(p)}` : ''}</div>
      </div>
      <div class="li-right"><span class="chip">${ic('arrowR')}</span></div>
    </div>`;
  }).join('') : `<div class="empty"><b>찾는 고객이 없어요</b>검색어를 바꾸거나 새 고객을 등록해 보세요.</div>`}`;
}

function viewCustomer(id) {
  const c = customer(id);
  if (!c) return `<div class="empty"><b>고객을 찾을 수 없습니다</b>목록에서 다시 선택해 주세요.</div>
    <div class="mt16"><button class="btn block" data-act="goto" data-to="#/customers">고객 목록으로</button></div>`;
  const last = lastVisit(c);
  const pases = passesOf(c.id);
  const txs = treatmentsArr().filter(t => t.customerId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const apps = apptsArr().filter(a => a.customerId === c.id).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const pays = salesArr().filter(s => s.customerId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const idx = customersArr().indexOf(c) % 4;
  const tabs = [['chart', '상담 기록'], ['appt', '예약'], ['pass', '회원권'], ['pay', '결제']];
  let tabBody = '';
  if (S.ui.custTab === 'chart') {
    tabBody = txs.length ? `<div class="timeline">${txs.map(t => `
      <div class="tl-item">
        <div class="tl-date">${fmtDate(t.date)} · ${esc(t.service || '')} · ${esc(t.staff || '')}</div>
        <div class="tl-memo">${esc(t.memo || '메모 없음')}</div>
        ${t.photo ? `<div class="photo-grid"><img src="${t.photo}" alt="상담 사진" loading="lazy"></div>` : ''}
      </div>`).join('')}</div>`
      : `<div class="empty"><b>상담 기록이 없습니다</b>첫 상담을 기록해 두면 다음 방문 때 이어서 볼 수 있어요.</div>`;
  } else if (S.ui.custTab === 'appt') {
    tabBody = apps.length ? apps.map(a => apptCard(a)).join('') : `<div class="empty"><b>예약 기록이 없습니다</b></div>`;
  } else if (S.ui.custTab === 'pass') {
    tabBody = pases.length ? pases.map(p => passCard(p)).join('') : `<div class="empty"><b>보유 회원권이 없습니다</b>회원권을 등록해 두면 방문 완료 때 자동으로 차감돼요.</div>`;
  } else {
    tabBody = pays.length ? pays.map(s => `
      <div class="list-card">
        <div class="li-main">
          <div class="li-title">${won(s.amount)} <span class="chip">${esc(s.method || '')}</span></div>
          <div class="li-sub">${fmtDate(s.date)} · ${esc(s.items || '')}</div>
        </div>
      </div>`).join('') : `<div class="empty"><b>결제 기록이 없습니다</b></div>`;
  }
  return `
  <button class="btn sm" data-act="goto" data-to="#/customers" style="margin-bottom:12px">${ic('arrowL')}고객 목록</button>
  <div class="card">
    <div class="profile">
      <div class="avatar ${idx ? 'g' + (idx + 1) : ''}">${esc(String(c.name).slice(0, 1))}</div>
      <div style="min-width:0">
        <h2>${esc(c.name)} <span class="chip ${gradeClass(c.grade)}">${gradeLabel(c.grade)}</span></h2>
        <div class="li-sub">${esc(c.phone || '연락처 없음')}${c.birth ? ` · ${esc(c.birth)}` : ''}</div>
        <div class="li-sub tiny">${last ? (daysSince(last) === 0 ? '오늘 방문' : `최근 방문 ${daysSince(last)}일 전 (${fmtDate(last)})`) : (regDate(c) ? `등록 ${daysSince(regDate(c))}일 전` : '방문 기록 없음')} · 방문 ${apps.filter(a => a.status === '방문완료').length}회</div>
      </div>
    </div>
    ${c.memo ? `<div class="badge-note mt12">${esc(c.memo)}</div>` : ''}
    <div class="appt-actions mt12">
      ${c.phone ? `<a class="btn sm" href="tel:${esc(phoneDigits(c.phone))}">${ic('phone')}전화</a>
      <a class="btn sm" href="sms:${esc(phoneDigits(c.phone))}">${ic('msg')}문자</a>` : ''}
      <button class="btn sm gold" data-act="appt-for" data-id="${c.id}">${ic('cal')}예약</button>
      <button class="btn sm" data-act="cust-edit" data-id="${c.id}">${ic('pen')}수정</button>
    </div>
  </div>
  <div class="card mt12">
    <div class="row" style="justify-content:space-between">
      <div class="section-title" style="font-size:17px">${ic('ticket')} 회원권</div>
      <button class="btn sm" data-act="new-pass" data-id="${c.id}">${ic('plus')}등록</button>
    </div>
    ${pases.length ? pases.map(p => `<div class="mt12">${passCard(p, true)}</div>`).join('') : `<div class="tiny muted mt8">보유 회원권이 없습니다.</div>`}
  </div>
  <div class="card mt12">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div class="section-title" style="font-size:17px">${ic('pen')} 전자 서명</div>
      <button class="btn sm" data-act="cust-consent" data-id="${c.id}">${ic('pen')}서명 받기</button>
    </div>
    ${c.sig ? `<div class="mt8"><img class="sig-photo" src="${c.sig}" alt="${esc(c.name)} 고객 서명"><div class="tiny muted">${c.consentAt ? fmtDate(iso(new Date(c.consentAt))) + ' 서명' : '서명 저장됨'} · ${esc(c.consentText || '개인정보 수집·이용 및 관리 동의')}</div></div>`
      : `<div class="tiny muted mt8">서명이 없습니다. 처음 방문 시 서명을 받아 차트에 보관하세요.</div>`}
  </div>
  <div class="tabs" role="tablist">
    ${tabs.map(([k, l]) => `<button class="${S.ui.custTab === k ? 'on' : ''}" data-act="cust-tab" data-tab="${k}" role="tab">${l}</button>`).join('')}
  </div>
  ${S.ui.custTab === 'chart' ? `<div class="btn-row" style="margin-bottom:12px">
      <button class="btn primary" data-act="cust-treatment" data-id="${c.id}">${ic('plus')}상담 기록 추가</button>
    </div>` : ''}
  ${tabBody}`;
}

function passCard(p, compact) {
  const isCount = p.type === '횟수권';
  const pct = isCount ? Math.round((p.remaining / (p.total || 1)) * 100) : Math.round((p.remaining / (p.total || 1)) * 100);
  const low = pct <= 20;
  const empty = p.remaining <= 0;
  const expSoon = p.expireDate && diffDays(p.expireDate, todayISO()) <= 30;
  return `
  <div class="card tight">
    <div class="row" style="align-items:flex-start">
      <div class="li-main">
        <div class="li-title">${esc(p.name || p.type)} <span class="chip ${isCount ? 'new' : 'regular'}">${esc(p.type)}</span>
          ${empty ? '<span class="chip warn">소진</span>' : low ? '<span class="chip warn">잔여 적음</span>' : ''}
          ${expSoon ? `<span class="chip gold">만료 ${diffDays(p.expireDate, todayISO())}일 전</span>` : ''}</div>
        <div class="li-sub">${esc(p.customerName || (customer(p.customerId) || {}).name || '')} · 잔여 <b>${passLeft(p)}</b> / 결제 ${won(p.amount)}</div>
        <div class="li-sub tiny">${fmtRange(p.startDate, p.expireDate)}${p.memo ? ' · ' + esc(p.memo) : ''}</div>
      </div>
      ${compact ? '' : `<div class="li-right"><span class="chip ${empty ? 'warn' : low ? 'gold' : 'regular'}">${pct}%</span></div>`}
    </div>
    <div class="progress ${empty ? 'empty' : low ? 'low' : ''}"><i style="width:${Math.max(2, Math.min(100, pct))}%"></i></div>
    ${compact ? '' : `<div class="appt-actions">
      ${!empty ? `<button class="btn sm primary" data-act="pass-use" data-id="${p.id}">${ic('check')}${isCount ? '1회 차감' : '금액 차감'}</button>` : ''}
      <button class="btn sm" data-act="copy-pass" data-id="${p.id}">${ic('copy')}재등록 안내</button>
      <button class="btn sm danger" data-act="pass-del" data-id="${p.id}">삭제</button>
    </div>`}
  </div>`;
}

/* =========================================================
   10. 회원권
   ========================================================= */
function viewPasses() {
  const list = passesArr().sort((a, b) => (a.expireDate || '').localeCompare(b.expireDate || ''));
  const active = list.filter(p => p.active !== false && p.remaining > 0);
  const totalAmt = active.reduce((n, p) => n + (Number(p.remaining) || 0), 0);
  const countTotal = active.reduce((n, p) => n + (p.type === '횟수권' ? (Number(p.remaining) || 0) : 0), 0);
  const balance = active.filter(p => p.type === '정액권').reduce((n, p) => n + (Number(p.remaining) || 0), 0);
  return `
  <div class="page-head">
    <div><h1 class="page-title">회원권</h1><div class="page-sub">방문 완료 때 자동 차감 · 잔여 실시간 표시</div></div>
    <button class="btn gold" data-act="new-pass">${ic('plus')}회원권</button>
  </div>
  <div class="stat-grid">
    <div class="stat"><label>이용 중인 회원권</label><b>${active.length}<small>건</small></b></div>
    <div class="stat"><label>남은 횟수 합계</label><b>${countTotal}<small>회</small></b></div>
    <div class="stat"><label>정액권 잔액</label><b>${wonShort(balance)}<small>원</small></b></div>
    <div class="stat"><label>소진 임박</label><b>${activePassesSoon().length}<small>건</small></b></div>
  </div>
  <section class="section">
    <div class="section-head"><h2 class="section-title">잔여 현황</h2></div>
    ${list.length ? list.map(p => passCard(p)).join('') : `<div class="empty"><b>등록된 회원권이 없습니다</b>횟수권·정액권을 등록하면 방문 완료 때 자동으로 차감돼요.</div>`}
  </section>`;
}

/* =========================================================
   11. 매출
   ========================================================= */
function viewSales() {
  const mode = S.ui.salesMode;
  const t = todayISO();
  const cur = S.ui.salesMonth || ym();
  const inMonth = salesInMonth(cur);
  const todays = salesOn(t);
  const todayTotal = sumSales(todays);
  const monthTotal = sumSales(inMonth);
  const avg = inMonth.length ? Math.round(monthTotal / inMonth.length) : 0;
  const byMethod = {};
  inMonth.forEach(s => { byMethod[s.method || '기타'] = (byMethod[s.method || '기타'] || 0) + (Number(s.amount) || 0); });
  const rows = mode === 'day'
    ? salesArr().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 60)
    : inMonth.sort((a, b) => (b.date + (b.at || '')).localeCompare(a.date + (a.at || '')));
  const dayTotals = (() => {
    const map = {};
    inMonth.forEach(s => { map[s.date] = (map[s.date] || 0) + (Number(s.amount) || 0); });
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map(d => ({ d, n: map[d] }));
  })();
  const [y, m] = cur.split('-').map(Number);
  const mFirst = new Date(y, m - 1, 1);
  const mLen = new Date(y, m, 0).getDate();
  const mOffset = mFirst.getDay();
  const cells = [];
  for (let i = 0; i < mOffset; i++) cells.push('<div class="cal-cell out"></div>');
  const dayMap = {}; inMonth.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + (Number(s.amount) || 0); });
  for (let dd = 1; dd <= mLen; dd++) {
    const ds = `${y}-${pad(m)}-${pad(dd)}`;
    const v = dayMap[ds] || 0;
    cells.push(`<div class="cal-cell ${ds === t ? 'today' : ''}" style="min-height:58px"><span class="d">${dd}</span>${v ? `<span class="tiny" style="font-weight:800;color:#0B6A4C">${wonShort(v)}</span>` : '<span class="cnt"> </span>'}</div>`);
  }
  return `
  <div class="page-head">
    <div><h1 class="page-title">매출</h1><div class="page-sub">일·월 매출과 객단가를 바로 확인</div></div>
    <button class="btn gold" data-act="new-sale">${ic('plus')}매출</button>
  </div>
  <div class="stat-grid">
    <div class="stat"><label>오늘 매출</label><b>${wonShort(todayTotal)}<small>원</small></b></div>
    <div class="stat"><label>이번 달 매출</label><b>${wonShort(monthTotal)}<small>원</small></b></div>
    <div class="stat"><label>건수 (이번 달)</label><b>${inMonth.length}<small>건</small></b></div>
    <div class="stat"><label>객단가</label><b>${wonShort(avg)}<small>원</small></b></div>
  </div>
  <div class="seg mt16" role="tablist">
    ${[['day', '일별'], ['month', '월별']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="sales-mode" data-mode="${k}" role="tab">${l}</button>`).join('')}
  </div>
  ${mode === 'month' ? `
  <div class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <button class="btn sm" data-act="sales-month" data-d="-1">${ic('arrowL')}</button>
      <b style="font-size:17px">${monthTitle(cur)}</b>
      <button class="btn sm" data-act="sales-month" data-d="1">${ic('arrowR')}</button>
    </div>
    <div class="cal-grid" style="margin-bottom:5px">${['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    <div class="divider"></div>
    <div class="section-title" style="font-size:16px;margin-bottom:6px">결제수단별</div>
    ${Object.keys(byMethod).length ? Object.keys(byMethod).map(k => `<div class="kv"><span class="k">${esc(k)}</span><b>${won(byMethod[k])}</b></div>`).join('') : '<div class="tiny muted">이 달 매출이 없습니다.</div>'}
    <div class="divider"></div>
    <div class="section-title" style="font-size:16px;margin-bottom:6px">날짜별 합계</div>
    ${dayTotals.length ? dayTotals.map(x => `<div class="kv"><span class="k">${fmtDate(x.d)}</span><b>${won(x.n)}</b></div>`).join('') : '<div class="tiny muted">이 달 매출이 없습니다.</div>'}
  </div>` : `
  <div class="card" style="padding:0;overflow:hidden">
    ${rows.length ? rows.map(s => `
      <div style="display:flex;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);align-items:center">
        <div style="flex:0 0 58px;text-align:center">
          <div class="tiny muted" style="font-weight:800">${fmtDateShort(s.date)}</div>
          <div class="tiny muted">${s.at ? new Date(s.at).toTimeString().slice(0, 5) : ''}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:16.5px">${esc(s.customerName || (customer(s.customerId) || {}).name || '고객')} <span class="chip">${esc(s.method || '카드')}</span></div>
          <div class="tiny muted">${esc(s.items || '')}</div>
        </div>
        <div style="text-align:right;font-weight:900;white-space:nowrap">${won(s.amount)}</div>
        <button class="icon-btn" style="width:38px;height:38px;min-width:38px;border-color:var(--line);background:#F7F9FC;color:var(--muted)" data-act="sale-del" data-id="${s.id}" aria-label="매출 삭제">${ic('x')}</button>
      </div>`).join('') : `<div class="empty" style="border:0"><b>매출 기록이 없습니다</b>방문 완료 처리하거나 매출 등록을 눌러 주세요.</div>`}
  </div>`}`;
}

/* =========================================================
   12. 설정
   ========================================================= */
function viewSettings() {
  const meta = S.data.meta || {};
  const shops = knownShops();
  return `
  <div class="page-head"><div><h1 class="page-title">설정</h1><div class="page-sub">${esc(shopName())}</div></div></div>
  <div class="card">
    <div class="section-title" style="font-size:17px">${ic('shield')} 샵 코드</div>
    <div class="shop-code mt12"><span>${esc(S.code || '')}</span>
      <button class="btn sm" data-act="shop-copy">${ic('copy')}복사</button></div>
    <div class="badge-note mt12">샵 코드를 아는 기기에서 같은 데이터를 이어서 씁니다. 폰과 PC에서 같은 코드로 접속해 보세요. 코드를 다른 사람에게 알리면 그 사람도 이 샵 데이터를 볼 수 있으니 주의해 주세요.</div>
    <div class="appt-actions mt12">
      <button class="btn" data-act="shop-switch">${ic('switch')}다른 샵 열기</button>
      <button class="btn" data-act="shop-create">${ic('plus')}새 샵 만들기</button>
    </div>
  </div>
  <div class="card mt12">
    <div class="section-title" style="font-size:17px">${ic('user')} 샵 정보</div>
    <div class="kv"><span class="k">샵 이름</span><b>${esc(meta.name || '-')}</b></div>
    <div class="kv"><span class="k">원장님</span><b>${esc(meta.ownerName || '-')}</b></div>
    <div class="kv"><span class="k">연락처</span><b>${esc(meta.phone || '-')}</b></div>
    <div class="kv"><span class="k">주소</span><b style="text-align:right">${esc(meta.address || '-')}</b></div>
    <button class="btn block mt12" data-act="shop-edit">${ic('pen')}샵 정보 수정</button>
  </div>
  <div class="card mt12">
    <div class="section-title" style="font-size:17px">${ic('info')} 데이터</div>
    <div class="kv"><span class="k">저장 상태</span><b>${S.online ? '클라우드 연결됨' : '기기 저장 (연결 대기)'}</b></div>
    <div class="kv"><span class="k">마지막 동기화</span><b>${S.lastSync ? new Date(S.lastSync).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</b></div>
    <div class="kv"><span class="k">고객 / 예약</span><b>${customersArr().length}명 / ${apptsArr().length}건</b></div>
    <div class="appt-actions mt12">
      <button class="btn" data-act="export">${ic('save')}백업 내보내기</button>
      <button class="btn" data-act="reload">${ic('switch')}새로고침</button>
    </div>
    ${S.code === DEMO_CODE ? `<button class="btn danger block mt12" data-act="demo-reset">체험 데이터 처음 상태로 되돌리기</button>` : ''}
  </div>
  <div class="card mt12">
    <div class="section-title" style="font-size:17px">${ic('info')} 사용 안내</div>
    <div class="small mt8" style="color:#3C4C63;line-height:1.7">
      ① 홈에서 오늘 예약·매출·리필/이탈 알림을 한눈에 봅니다.<br>
      ② 예약 → 방문 완료를 누르면 결제와 회원권 차감이 한 번에 기록됩니다.<br>
      ③ 고객 차트에서 상담 기록과 전자 서명을 남깁니다.<br>
      ④ 30일이 지난 미네랄 고객과 오래 안 오신 고객은 홈에서 바로 문자 문구를 복사할 수 있습니다.
    </div>
    <div class="badge-note mt12">고객 이름·연락처 같은 개인정보가 담기므로 이 주소는 검색에 노출되지 않게 설정되어 있습니다. 기기 잠금과 샵 코드 관리를 부탁드려요.</div>
  </div>`;
}
/* =========================================================
   13. 모달 공통
   ========================================================= */
function openModal(html, opts = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-backdrop="1"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  const bd = root.querySelector('[data-backdrop]');
  bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(); });
  return root.querySelector('.modal');
}
function modalShell(title, body, foot) {
  return `
  <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x" data-act="close-modal" aria-label="닫기">${ic('x')}</button></div>
  <div class="modal-body">${body}</div>
  <div class="modal-foot">${foot}</div>`;
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  document.body.style.overflow = '';
}
function confirmDo({ title = '확인', text = '', ok = '확인', danger = false, onOk }) {
  const m = openModal(modalShell(title, `<p class="small" style="color:#3C4C63;line-height:1.6">${esc(text)}</p>`,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn ${danger ? 'danger' : 'primary'}" id="okBtn">${esc(ok)}</button>`));
  $('#okBtn', m).onclick = () => { closeModal(); onOk && onOk(); };
}

/* 서명 패드 */
function mountSigPad(canvas) {
  let dirty = false, drawing = false, last = null;
  const ctx = canvas.getContext('2d');
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12233B';
  };
  fit();
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault(); drawing = true; last = pos(e);
    ctx.beginPath(); ctx.arc(last.x, last.y, 1.3, 0, Math.PI * 2); ctx.fillStyle = '#12233B'; ctx.fill();
    dirty = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; dirty = true;
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => canvas.addEventListener(k, () => { drawing = false; }));
  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
    isEmpty: () => !dirty,
    data: () => (dirty ? canvas.toDataURL('image/png') : '')
  };
}

/* 사진 압축 */
function readPhoto(file, max = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* 셀렉트 옵션 도우미 */
function optCustomers(selected) {
  return customersArr().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'))
    .map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)} (${esc(c.phone || '연락처 없음')})</option>`).join('');
}
function timeOptions(selected) {
  const out = [];
  for (let h = 8; h <= 21; h++) {
    for (const m of [0, 30]) {
      const v = `${pad(h)}:${pad(m)}`;
      out.push(`<option value="${v}" ${v === selected ? 'selected' : ''}>${timeLabel(v)}</option>`);
    }
  }
  return out.join('');
}
const SERVICE_PRICE = { '유디아 미네랄 케어': 120000, '오륜 미네랄 케어': 90000, '알프스 미네랄 체험': 0, '데톡스 바디 케어': 80000, '림프 순환 관리': 70000, '상담/재방문': 0 };

/* =========================================================
   14. 예약 모달
   ========================================================= */
function modalApptNew(prefill = {}) {
  const first = prefill.customerId || (customersArr()[0] || {}).id || '';
  const body = `
    <div class="field">
      <label for="f_cust">고객</label>
      <select id="f_cust" class="select">
        ${optCustomers(first)}
        <option value="__new">+ 새 고객으로 등록 (이름·연락처 직접 입력)</option>
      </select>
    </div>
    <div id="newCustBox" class="hide">
      <div class="grid2">
        <div class="field"><label for="f_name">고객 이름</label><input id="f_name" class="input" placeholder="예: 김미숙"></div>
        <div class="field"><label for="f_phone">연락처</label><input id="f_phone" class="input" type="tel" inputmode="tel" placeholder="010-0000-0000"></div>
      </div>
    </div>
    <div class="grid2">
      <div class="field"><label for="f_date">날짜</label><input id="f_date" class="input" type="date" value="${esc(prefill.date || todayISO())}"></div>
      <div class="field"><label for="f_time">시간</label><select id="f_time" class="select">${timeOptions(prefill.time || '10:00')}</select></div>
    </div>
    <div class="field"><label for="f_service">관리 항목</label><select id="f_service" class="select">${SERVICES.map(s => `<option ${s === '유디아 미네랄 케어' ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="grid2">
      <div class="field"><label for="f_staff">담당</label><select id="f_staff" class="select">${STAFFS.map(s => `<option>${s}</option>`).join('')}</select></div>
      <div class="field"><label for="f_pass">회원권 사용</label><select id="f_pass" class="select"></select></div>
    </div>
    <div class="field"><label for="f_memo">메모 (선택)</label><textarea id="f_memo" class="textarea" placeholder="예: 어깨 위주로, 주차 필요"></textarea></div>
    <div class="badge-note">저장하면 오늘 예약에 바로 표시됩니다. 확정·안내문은 예약 카드에서 한 번에 보낼 수 있어요.</div>`;
  const m = openModal(modalShell('새 예약 등록', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveAppt">${ic('check')}예약 저장</button>`));
  const sel = $('#f_cust', m), box = $('#newCustBox', m), passSel = $('#f_pass', m), svc = $('#f_service', m);
  const refreshPass = () => {
    const cid = sel.value;
    const list = cid && cid !== '__new' ? passesOf(cid) : [];
    passSel.innerHTML = `<option value="">사용 안 함</option>` + list.map(p => `<option value="${p.id}">${esc(p.name)} (${passLeft(p)})</option>`).join('');
  };
  sel.onchange = () => {
    box.classList.toggle('hide', sel.value !== '__new');
    refreshPass();
  };
  refreshPass();
  $('#saveAppt', m).onclick = async () => {
    const date = $('#f_date', m).value || todayISO();
    const time = $('#f_time', m).value;
    let cid = sel.value, name = '', phone = '';
    if (!cid) { toast('고객을 선택해 주세요'); return; }
    if (cid === '__new') {
      name = $('#f_name', m).value.trim();
      phone = $('#f_phone', m).value.trim();
      if (!name) { toast('고객 이름을 입력해 주세요'); $('#f_name', m).focus(); return; }
      cid = 'c' + uid();
      await put('customers/' + cid, { id: cid, name, phone, grade: 'new', birth: '', inflow: '', memo: '', tags: [], createdAt: Date.now() }, { silent: true });
    } else {
      const c = customer(cid); name = c ? c.name : ''; phone = c ? c.phone : '';
    }
    const id = 'a' + uid();
    const service = svc.value;
    await put('appointments/' + id, {
      id, customerId: cid, name, phone, date, time, service,
      staff: $('#f_staff', m).value, status: '예약',
      passId: passSel.value || '', price: SERVICE_PRICE[service] || 0,
      memo: $('#f_memo', m).value.trim(), createdAt: Date.now()
    });
    closeModal();
    toast(`${fmtDate(date)} ${timeLabel(time)} 예약을 저장했어요`);
    if (S.route.name === 'customer' && S.route.id !== cid) go('#/customer/' + cid);
    else render();
  };
}

function modalApptComplete(a) {
  const c = customer(a.customerId) || {};
  const passes = passesOf(a.customerId);
  const svcPrice = Number(a.price) || SERVICE_PRICE[a.service] || 0;
  const body = `
    <div class="badge-note" style="margin-bottom:14px">
      <b>${esc(a.name)}</b> · ${esc(a.service)} · ${fmtDate(a.date)} ${timeLabel(a.time)}<br>
      저장하면 매출 기록 + 회원권 자동 차감 + 상담 기록이 함께 남습니다.
    </div>
    <div class="grid2">
      <div class="field"><label for="f_amount">결제 금액</label><input id="f_amount" class="input" type="number" inputmode="numeric" step="1000" value="${svcPrice}"></div>
      <div class="field"><label for="f_method">결제 수단</label><select id="f_method" class="select">${METHODS.map(x => `<option>${x}</option>`).join('')}</select></div>
    </div>
    ${passes.length ? `
    <div class="field">
      <label for="f_usepass">회원권 차감</label>
      <select id="f_usepass" class="select">
        <option value="">차감 안 함</option>
        ${passes.map(p => `<option value="${p.id}" ${p.id === a.passId ? 'selected' : ''}>${esc(p.name)} · 잔여 ${passLeft(p)}</option>`).join('')}
      </select>
    </div>
    <div class="field" id="passAmtBox" style="display:none">
      <label for="f_passamt">정액권 사용 금액</label>
      <input id="f_passamt" class="input" type="number" inputmode="numeric" step="1000" value="${svcPrice}">
      <div class="hint">정액권에서 빠지는 금액입니다. 결제 금액과 같게 두면 됩니다.</div>
    </div>` : ''}
    <div class="field"><label for="f_note">상담 메모 (선택)</label><textarea id="f_note" class="textarea" placeholder="오늘 컨디션, 다음 방문 시 참고할 점"></textarea></div>
    ${/미네랄|유디아|오륜/.test(a.service) ? `<div class="badge-note">미네랄 케어로 기록되어 <b>30일 뒤 리필 알림</b>에 자동으로 올라갑니다.</div>` : ''}`;
  const m = openModal(modalShell('방문 완료 · 결제 기록', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveDone">${ic('check')}방문 완료 저장</button>`));
  const usePass = $('#f_usepass', m), amtBox = $('#passAmtBox', m);
  if (usePass) {
    const sync = () => {
      const p = (S.data.passes || {})[usePass.value];
      const show = !!p && p.type === '정액권';
      if (amtBox) amtBox.style.display = show ? '' : 'none';
      const met = $('#f_method', m);
      if (p) met.value = '회원권 차감';
    };
    usePass.onchange = sync; sync();
  }
  $('#saveDone', m).onclick = async () => {
    const amount = Number($('#f_amount', m).value) || 0;
    const method = $('#f_method', m).value;
    const passId = usePass ? usePass.value : '';
    const pass = passId ? (S.data.passes || {})[passId] : null;
    const note = $('#f_note', m).value.trim();
    const patch = {};
    const sid = 's' + uid();
    patch.sales = { [sid]: { id: sid, date: a.date, at: Date.now(), amount, method, customerId: a.customerId || '', customerName: a.name, items: a.service, passId, appointmentId: a.id, memo: note } };
    if (pass) {
      const qty = pass.type === '정액권' ? (Number($('#f_passamt', m).value) || amount) : 1;
      const rem = Math.max(0, (Number(pass.remaining) || 0) - qty);
      patch.passes = { [pass.id]: Object.assign({}, pass, {
        remaining: rem,
        history: Object.assign({}, pass.history || {}, { [sid]: { date: a.date, type: '차감', qty, remainingAfter: rem, note: a.service } })
      }) };
    }
    patch.appointments = { [a.id]: Object.assign({}, a, { status: '방문완료', price: amount, payId: sid }) };
    const tid = 't' + uid();
    patch.treatments = { [tid]: { id: tid, customerId: a.customerId || '', date: a.date, service: a.service, staff: a.staff || '원장', memo: note, createdAt: Date.now() } };
    if (/미네랄|유디아|오륜/.test(a.service) && a.customerId) {
      const mid = 'm' + uid();
      const product = /유디아/.test(a.service) ? '유디아 미네랄' : (/오륜/.test(a.service) ? '오륜 미네랄' : '알프스 미네랄');
      patch.minerals = { [mid]: { id: mid, customerId: a.customerId, customerName: a.name, product, type: '케어', date: a.date, dueDate: addDaysISO(30, a.date), status: '대기', memo: '', createdAt: Date.now() } };
    }
    await patchRoot(patch);
    closeModal();
    toast(`방문 완료 · 매출 ${won(amount)}${pass ? ' · 회원권 차감' : ''}`);
  };
}

function modalApptNoshow(a) {
  const body = `<p class="small" style="color:#3C4C63">${esc(a.name)} 고객님의 ${fmtDate(a.date)} ${timeLabel(a.time)} 예약입니다. 어떻게 처리할까요?</p>
  <div class="badge-note mt12">노쇼로 남기면 홈의 '노쇼·취소' 기록에 남고, 안내 문자를 보낼 수 있어요.</div>`;
  const m = openModal(modalShell('노쇼·취소 처리', body,
    `<button class="btn" id="setCancel">예약 취소</button><button class="btn danger" id="setNoshow">노쇼 기록</button>`));
  $('#setNoshow', m).onclick = () => finishNoshow(a, '노쇼');
  $('#setCancel', m).onclick = () => finishNoshow(a, '취소');
}
async function finishNoshow(a, status) {
  await put('appointments/' + a.id, Object.assign({}, a, { status }));
  closeModal();
  toast(status === '노쇼' ? '노쇼로 기록했어요' : '예약을 취소했어요');
}

function modalApptDetail(a) {
  const c = customer(a.customerId);
  const sale = a.payId ? (S.data.sales || {})[a.payId] : null;
  const body = `
  <div class="kv"><span class="k">고객</span><b>${esc(a.name)}</b></div>
  <div class="kv"><span class="k">일시</span><b>${fmtDate(a.date)} ${timeLabel(a.time)}</b></div>
  <div class="kv"><span class="k">관리</span><b>${esc(a.service)} · ${esc(a.staff || '')}</b></div>
  <div class="kv"><span class="k">상태</span><b><span class="chip ${statusClass(a.status)}">${esc(a.status)}</span></b></div>
  ${sale ? `<div class="kv"><span class="k">결제</span><b>${won(sale.amount)} · ${esc(sale.method)}</b></div>` : ''}
  ${a.memo ? `<div class="kv"><span class="k">메모</span><b style="text-align:right">${esc(a.memo)}</b></div>` : ''}
  <div class="appt-actions mt16">
    ${c ? `<button class="btn sm" data-act="cust-open" data-id="${c.id}">${ic('user')}고객 차트</button>` : ''}
    ${a.status === '방문완료' ? `<button class="btn sm danger" id="undoDone">방문 완료 취소</button>` : ''}
    ${a.status === '노쇼' || a.status === '취소' ? `<button class="btn sm" id="reopen">예약으로 되돌리기</button>` : ''}
  </div>`;
  const m = openModal(modalShell('예약 상세', body, `<button class="btn primary" data-act="close-modal">닫기</button>`));
  const undo = $('#undoDone', m), re = $('#reopen', m);
  if (undo) undo.onclick = async () => {
    await put('appointments/' + a.id, Object.assign({}, a, { status: '확정' }));
    closeModal(); toast('방문 완료를 취소했어요. 매출·차감 기록은 그대로 남아 있습니다.');
  };
  if (re) re.onclick = async () => {
    await put('appointments/' + a.id, Object.assign({}, a, { status: '예약' }));
    closeModal(); toast('예약 상태로 되돌렸어요');
  };
}

/* =========================================================
   15. 고객 모달
   ========================================================= */
function modalCustomer(id) {
  const c = id ? customer(id) : null;
  const body = `
    <div class="grid2">
      <div class="field"><label for="f_name">고객 이름 *</label><input id="f_name" class="input" value="${esc(c ? c.name : '')}" placeholder="예: 김미숙"></div>
      <div class="field"><label for="f_phone">연락처 *</label><input id="f_phone" class="input" type="tel" inputmode="tel" value="${esc(c ? c.phone : '')}" placeholder="010-0000-0000"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="f_grade">등급</label><select id="f_grade" class="select">${GRADES.map(([v, l]) => `<option value="${v}" ${(c ? c.grade === v : v === 'new') ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="f_birth">생년월일</label><input id="f_birth" class="input" type="date" value="${esc(c && c.birth ? c.birth : '')}"></div>
    </div>
    <div class="field"><label for="f_inflow">알게 된 경로</label><select id="f_inflow" class="select"><option value="">선택 안 함</option>${INFLOW.map(x => `<option ${c && c.inflow === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div class="field"><label for="f_memo">특이사항 · 취향 메모</label><textarea id="f_memo" class="textarea" placeholder="예: 어깨 결림 심함, 압 세게, 보리차 드심">${esc(c ? c.memo : '')}</textarea></div>
    ${c ? '' : `
    <div class="field">
      <label>개인정보 수집·이용 동의 (전자 서명)</label>
      <div class="sig-wrap"><canvas class="sig-canvas" id="sigPad"></canvas></div>
      <div class="sig-hint">고객님께 화면을 드리고 손가락으로 서명받으세요. (선택)</div>
      <button class="btn sm mt8" id="sigClear" type="button">서명 지우기</button>
    </div>`}`;
  const m = openModal(modalShell(c ? '고객 정보 수정' : '새 고객 등록', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveCust">${ic('check')}저장</button>`));
  let pad = null;
  if (!c && $('#sigPad', m)) {
    pad = mountSigPad($('#sigPad', m));
    $('#sigClear', m).onclick = () => pad.clear();
  }
  $('#saveCust', m).onclick = async () => {
    const name = $('#f_name', m).value.trim();
    const phone = $('#f_phone', m).value.trim();
    if (!name) { toast('이름을 입력해 주세요'); $('#f_name', m).focus(); return; }
    if (!phone) { toast('연락처를 입력해 주세요'); $('#f_phone', m).focus(); return; }
    const cid = c ? c.id : 'c' + uid();
    const obj = Object.assign({}, c || {}, {
      id: cid, name, phone,
      grade: $('#f_grade', m).value,
      birth: $('#f_birth', m).value,
      inflow: $('#f_inflow', m).value,
      memo: $('#f_memo', m).value.trim(),
      createdAt: (c && c.createdAt) || Date.now(),
      updatedAt: Date.now()
    });
    if (pad && !pad.isEmpty()) {
      obj.sig = pad.data(); obj.consentAt = new Date().toISOString();
      obj.consentText = '개인정보 수집·이용 및 관리 동의';
    }
    await put('customers/' + cid, obj);
    closeModal();
    toast(c ? '고객 정보를 저장했어요' : '새 고객을 등록했어요');
    if (!c) go('#/customer/' + cid);
  };
}

function modalConsent(id) {
  const c = customer(id);
  if (!c) return;
  const body = `
  <div class="badge-note" style="line-height:1.65">
    <b>개인정보 수집·이용 동의</b><br>
    · 수집 항목: 이름, 연락처, 방문·상담 기록, 서명<br>
    · 이용 목적: 예약 관리, 관리 이력 확인, 리필·안부 안내<br>
    · 보관 기간: 회원 탈퇴 또는 요청 시까지<br>
    위 내용에 동의하며 서명합니다.
  </div>
  <div class="sig-wrap mt12"><canvas class="sig-canvas" id="sigPad"></canvas></div>
  <div class="sig-hint">고객님께 화면을 드리고 서명받아 주세요.</div>
  <button class="btn sm mt8" id="sigClear" type="button">서명 지우기</button>`;
  const m = openModal(modalShell(c.name + ' 님 전자 서명', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveSig">${ic('save')}서명 저장</button>`));
  const pad = mountSigPad($('#sigPad', m));
  $('#sigClear', m).onclick = () => pad.clear();
  $('#saveSig', m).onclick = async () => {
    if (pad.isEmpty()) { toast('먼저 서명을 받아 주세요'); return; }
    await put('customers/' + id, Object.assign({}, c, {
      sig: pad.data(), consentAt: new Date().toISOString(), consentText: '개인정보 수집·이용 및 관리 동의'
    }));
    closeModal(); toast('서명을 차트에 저장했어요');
  };
}

function modalTreatment(cid) {
  const c = customer(cid);
  const body = `
    <div class="grid2">
      <div class="field"><label for="f_date">날짜</label><input id="f_date" class="input" type="date" value="${todayISO()}"></div>
      <div class="field"><label for="f_staff">담당</label><select id="f_staff" class="select">${STAFFS.map(s => `<option>${s}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="f_service">관리 항목</label><select id="f_service" class="select">${SERVICES.map(s => `<option>${s}</option>`).join('')}</select></div>
    <div class="field"><label for="f_memo">상담 · 관리 메모</label><textarea id="f_memo" class="textarea" placeholder="오늘 컨디션, 관리 부위, 다음 방문 시 참고할 점"></textarea></div>
    <div class="field">
      <label for="f_photo">사진 첨부 (선택)</label>
      <input id="f_photo" class="input" type="file" accept="image/*">
      <div class="hint">관리 전후 사진을 남겨 두면 다음 상담 때 비교할 수 있어요.</div>
      <div id="photoPrev" class="photo-grid"></div>
    </div>`;
  const m = openModal(modalShell((c ? c.name + ' 님 ' : '') + '상담 기록 추가', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveTx">${ic('check')}기록 저장</button>`));
  let photo = '';
  $('#f_photo', m).onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      photo = await readPhoto(f);
      $('#photoPrev', m).innerHTML = `<img src="${photo}" alt="첨부 사진">`;
    } catch (err) { toast('사진을 읽지 못했어요'); }
  };
  $('#saveTx', m).onclick = async () => {
    const tid = 't' + uid();
    await put('treatments/' + tid, {
      id: tid, customerId: cid, date: $('#f_date', m).value || todayISO(),
      service: $('#f_service', m).value, staff: $('#f_staff', m).value,
      memo: $('#f_memo', m).value.trim(), photo, createdAt: Date.now()
    });
    closeModal(); toast('상담 기록을 저장했어요');
  };
}

/* =========================================================
   16. 회원권 · 매출 모달
   ========================================================= */
function modalPassNew(cid) {
  const body = `
    <div class="field"><label for="f_cust">고객</label><select id="f_cust" class="select">${optCustomers(cid)}</select></div>
    <div class="seg" id="typeSeg">
      <button class="on" data-t="횟수권" type="button">횟수권</button>
      <button data-t="정액권" type="button">정액권</button>
    </div>
    <div class="field"><label for="f_pname">회원권 이름</label><input id="f_pname" class="input" value="유디아 20회권" placeholder="예: 유디아 20회권"></div>
    <div class="grid2">
      <div class="field"><label for="f_total" id="totalLbl">총 횟수</label><input id="f_total" class="input" type="number" inputmode="numeric" value="20" step="1"></div>
      <div class="field"><label for="f_amount">결제 금액</label><input id="f_amount" class="input" type="number" inputmode="numeric" value="900000" step="10000"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="f_start">시작일</label><input id="f_start" class="input" type="date" value="${todayISO()}"></div>
      <div class="field"><label for="f_months">유효 기간</label><select id="f_months" class="select">
        <option value="3">3개월</option><option value="6">6개월</option><option value="12" selected>12개월</option><option value="24">24개월</option><option value="0">기간 없음</option>
      </select></div>
    </div>
    <div class="field"><label for="f_memo">메모 (선택)</label><input id="f_memo" class="input" placeholder="예: 잔액 소진 시 재충전 안내"></div>`;
  const m = openModal(modalShell('회원권 등록', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="savePass">${ic('check')}등록</button>`));
  let type = '횟수권';
  $$('#typeSeg button', m).forEach(b => b.onclick = () => {
    $$('#typeSeg button', m).forEach(x => x.classList.remove('on'));
    b.classList.add('on'); type = b.dataset.t;
    $('#totalLbl', m).textContent = type === '횟수권' ? '총 횟수' : '충전 금액';
    $('#f_total', m).value = type === '횟수권' ? 20 : 500000;
    $('#f_total', m).step = type === '횟수권' ? 1 : 10000;
  });
  $('#savePass', m).onclick = async () => {
    const cidv = $('#f_cust', m).value;
    if (!cidv) { toast('고객을 먼저 선택해 주세요'); return; }
    const total = Number($('#f_total', m).value) || 0;
    if (!total) { toast(type === '횟수권' ? '총 횟수를 입력해 주세요' : '충전 금액을 입력해 주세요'); return; }
    const c = customer(cidv);
    const months = Number($('#f_months', m).value) || 0;
    const start = $('#f_start', m).value || todayISO();
    const expire = months ? (() => { const d = parseISO(start); d.setMonth(d.getMonth() + months); return iso(d); })() : '';
    const id = 'p' + uid();
    await put('passes/' + id, {
      id, customerId: cidv, customerName: c ? c.name : '',
      type, name: $('#f_pname', m).value.trim() || type,
      total, remaining: total, amount: Number($('#f_amount', m).value) || 0,
      startDate: start, expireDate: expire, memo: $('#f_memo', m).value.trim(),
      active: true, createdAt: Date.now(), history: {}
    });
    closeModal(); toast('회원권을 등록했어요');
  };
}

function modalPassUse(id) {
  const p = (S.data.passes || {})[id];
  if (!p) return;
  const isCount = p.type === '횟수권';
  const body = `
    <div class="badge-note" style="margin-bottom:14px"><b>${esc(p.customerName || '')}</b> · ${esc(p.name)}<br>현재 잔여 <b>${passLeft(p)}</b></div>
    ${isCount ? `<div class="field"><label for="f_qty">차감 횟수</label><input id="f_qty" class="input" type="number" inputmode="numeric" value="1" step="1"></div>`
      : `<div class="field"><label for="f_qty">사용 금액</label><input id="f_qty" class="input" type="number" inputmode="numeric" step="1000" value="80000"></div>`}
    <div class="field"><label for="f_note">메모</label><input id="f_note" class="input" placeholder="예: 방문 관리 1회"></div>`;
  const m = openModal(modalShell('회원권 차감', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="doUse">${ic('check')}차감하기</button>`));
  $('#doUse', m).onclick = async () => {
    const qty = Number($('#f_qty', m).value) || 0;
    if (qty <= 0) { toast('차감할 수량을 입력해 주세요'); return; }
    const rem = Math.max(0, (Number(p.remaining) || 0) - qty);
    const key = 'h' + uid();
    await put('passes/' + id, Object.assign({}, p, {
      remaining: rem,
      history: Object.assign({}, p.history || {}, { [key]: { date: todayISO(), type: '차감', qty, remainingAfter: rem, note: $('#f_note', m).value.trim() } })
    }));
    closeModal(); toast(`차감 완료 · 잔여 ${isCount ? rem + '회' : won(rem)}`);
  };
}

function modalSaleNew(cid) {
  const body = `
    <div class="field"><label for="f_cust">고객</label><select id="f_cust" class="select"><option value="">고객 없음 (지나가다 결제)</option>${optCustomers(cid)}</select></div>
    <div class="grid2">
      <div class="field"><label for="f_date">날짜</label><input id="f_date" class="input" type="date" value="${todayISO()}"></div>
      <div class="field"><label for="f_amount">금액</label><input id="f_amount" class="input" type="number" inputmode="numeric" step="1000" value="120000"></div>
    </div>
    <div class="grid2">
      <div class="field"><label for="f_method">결제 수단</label><select id="f_method" class="select">${METHODS.map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="f_items">항목</label><select id="f_items" class="select">${SERVICES.map(s => `<option>${s}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="f_pass">회원권 차감</label><select id="f_pass" class="select"><option value="">차감 안 함</option></select></div>
    <div class="field"><label for="f_memo">메모</label><input id="f_memo" class="input" placeholder="예: 홈케어 제품 포함"></div>`;
  const m = openModal(modalShell('매출 등록', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveSale">${ic('check')}저장</button>`));
  const sel = $('#f_cust', m), ps = $('#f_pass', m);
  const refresh = () => {
    ps.innerHTML = `<option value="">차감 안 함</option>` + (sel.value ? passesOf(sel.value).map(p => `<option value="${p.id}">${esc(p.name)} (${passLeft(p)})</option>`).join('') : '');
  };
  sel.onchange = refresh; refresh();
  $('#saveSale', m).onclick = async () => {
    const amount = Number($('#f_amount', m).value) || 0;
    if (!amount) { toast('금액을 입력해 주세요'); return; }
    const cidv = sel.value;
    const c = cidv ? customer(cidv) : null;
    const pid = ps.value;
    const p = pid ? (S.data.passes || {})[pid] : null;
    const date = $('#f_date', m).value || todayISO();
    const sid = 's' + uid();
    const patch = { sales: { [sid]: { id: sid, date, at: Date.now(), amount, method: $('#f_method', m).value, customerId: cidv, customerName: c ? c.name : '', items: $('#f_items', m).value, passId: pid, appointmentId: '', memo: $('#f_memo', m).value.trim() } } };
    if (p) {
      const qty = p.type === '정액권' ? amount : 1;
      const rem = Math.max(0, (Number(p.remaining) || 0) - qty);
      patch.passes = { [p.id]: Object.assign({}, p, { remaining: rem, history: Object.assign({}, p.history || {}, { [sid]: { date, type: '차감', qty, remainingAfter: rem, note: '매출 등록' } }) }) };
    }
    await patchRoot(patch);
    closeModal(); toast('매출을 저장했어요');
  };
}

/* =========================================================
   17. 샵 코드 모달
   ========================================================= */
function modalShopEnter() {
  const body = `
    <div class="field"><label for="f_code">샵 코드</label>
      <input id="f_code" class="input" placeholder="예: ALFS-8K2M-7QXD" autocapitalize="characters" autocomplete="off" style="letter-spacing:.06em;font-weight:800">
      <div class="hint">원장님께 받은 샵 코드를 입력하세요. 체험은 <b>ALFS-DEMO</b> 입니다.</div>
    </div>`;
  const m = openModal(modalShell('샵 코드로 열기', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="doEnter">${ic('check')}열기</button>`));
  const go2 = () => { const v = $('#f_code', m).value.trim().toUpperCase(); if (!v) { toast('샵 코드를 입력해 주세요'); return; } closeModal(); enterShop(v); };
  $('#doEnter', m).onclick = go2;
  $('#f_code', m).onkeydown = (e) => { if (e.key === 'Enter') go2(); };
  setTimeout(() => { const el = $('#f_code', m); if (el) el.focus(); }, 120);
}

function modalShopCreate() {
  const body = `
    <div class="field"><label for="f_sname">샵 이름 *</label><input id="f_sname" class="input" placeholder="예: 알프스 강남점"></div>
    <div class="grid2">
      <div class="field"><label for="f_owner">원장님 성함</label><input id="f_owner" class="input" placeholder="예: 박선영"></div>
      <div class="field"><label for="f_tel">샵 연락처</label><input id="f_tel" class="input" type="tel" inputmode="tel" placeholder="02-000-0000"></div>
    </div>
    <div class="field"><label for="f_addr">주소 (안내 문자에 들어갑니다)</label><input id="f_addr" class="input" placeholder="예: 서울 강남구 테헤란로 132, 3층"></div>
    <div class="badge-note">새 샵 코드가 자동으로 만들어집니다. 폰과 PC에서 그 코드로 접속하면 같은 데이터를 이어서 씁니다.</div>`;
  const m = openModal(modalShell('새 샵 만들기', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="doCreate">${ic('check')}만들기</button>`));
  $('#doCreate', m).onclick = () => {
    const name = $('#f_sname', m).value.trim();
    if (!name) { toast('샵 이름을 입력해 주세요'); $('#f_sname', m).focus(); return; }
    const code = newShopCode();
    closeModal();
    enterShop(code, { create: true, meta: { name, ownerName: $('#f_owner', m).value.trim(), phone: $('#f_tel', m).value.trim(), address: $('#f_addr', m).value.trim() } });
  };
}
function newShopCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = (n) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join('');
  return `ALFS-${r(4)}-${r(4)}`;
}

function modalShopEdit() {
  const meta = S.data.meta || {};
  const body = `
    <div class="field"><label for="f_sname">샵 이름</label><input id="f_sname" class="input" value="${esc(meta.name || '')}"></div>
    <div class="grid2">
      <div class="field"><label for="f_owner">원장님 성함</label><input id="f_owner" class="input" value="${esc(meta.ownerName || '')}"></div>
      <div class="field"><label for="f_tel">샵 연락처</label><input id="f_tel" class="input" type="tel" inputmode="tel" value="${esc(meta.phone || '')}"></div>
    </div>
    <div class="field"><label for="f_addr">주소</label><input id="f_addr" class="input" value="${esc(meta.address || '')}"></div>
    <div class="field"><label for="f_intro">한 줄 소개</label><input id="f_intro" class="input" value="${esc(meta.intro || '')}" placeholder="예: 미네랄 케어 전문"></div>`;
  const m = openModal(modalShell('샵 정보 수정', body,
    `<button class="btn" data-act="close-modal">취소</button><button class="btn primary" id="saveMeta">${ic('save')}저장</button>`));
  $('#saveMeta', m).onclick = async () => {
    await put('meta', Object.assign({}, meta, {
      name: $('#f_sname', m).value.trim() || meta.name,
      ownerName: $('#f_owner', m).value.trim(),
      phone: $('#f_tel', m).value.trim(),
      address: $('#f_addr', m).value.trim(),
      intro: $('#f_intro', m).value.trim(),
      updatedAt: Date.now()
    }));
    closeModal(); toast('샵 정보를 저장했어요');
  };
}

function modalShopSwitch() {
  const list = knownShops();
  const body = `
    <div class="field"><label for="f_code">샵 코드로 바로 열기</label>
      <div class="row"><input id="f_code" class="input" placeholder="ALFS-XXXX-XXXX" style="letter-spacing:.05em;font-weight:800" autocapitalize="characters">
      <button class="btn primary" id="doEnter" style="flex:0 0 auto">열기</button></div>
    </div>
    <div class="divider"></div>
    <div class="section-title" style="font-size:16px;margin-bottom:8px">이 기기에서 연 샵</div>
    ${list.length ? list.map(s => `<button class="list-card clickable" style="width:100%;text-align:left;border:1px solid var(--line);background:#fff" data-act="shop-pick" data-code="${esc(s.code)}">
        <div class="avatar">${esc(String(s.name || '?').slice(0, 1))}</div>
        <div class="li-main"><div class="li-title">${esc(s.name || s.code)}</div><div class="li-sub">${esc(s.code)}</div></div>
        <div class="li-right">${s.code === S.code ? '<span class="chip gold">사용 중</span>' : ic('arrowR')}</div>
      </button>`).join('') : '<div class="tiny muted">아직 없습니다.</div>'}
    <button class="btn block mt12" data-act="shop-create">${ic('plus')}새 샵 만들기</button>`;
  openModal(modalShell('샵 전환', body, `<button class="btn" data-act="close-modal">닫기</button>`));
  const enter = () => { const v = $('#f_code').value.trim().toUpperCase(); if (!v) return; closeModal(); enterShop(v); };
  $('#doEnter').onclick = enter;
  $('#f_code').onkeydown = (e) => { if (e.key === 'Enter') enter(); };
}

function askCreateShop(code) {
  confirmDo({
    title: '새 샵으로 시작할까요?',
    text: `샵 코드 ${code}에 아직 데이터가 없습니다. 이 코드로 새 샵을 만들면 이 기기에서 처음부터 기록을 시작합니다.`,
    ok: '새 샵으로 시작',
    onOk: () => enterShop(code, { create: true, meta: { name: '알프스 샵', ownerName: '' } })
  });
}

/* =========================================================
   18. 샵 열기
   ========================================================= */
async function enterShop(code, opts = {}) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  S.code = code;
  const cachedRaw = localStorage.getItem(LS_CACHE + code);
  let cached = null;
  if (cachedRaw) { try { cached = JSON.parse(cachedRaw); } catch (e) { } }
  S.queue = (() => { try { return JSON.parse(localStorage.getItem(LS_QUEUE + code) || '[]'); } catch (e) { return []; } })();
  if (cached) {
    // 저장본이 있으면 먼저 바로 보여 주고, 서버에서 최신본을 받아 갱신한다.
    S.data = normalize(cached);
    S.ready = true;
    rememberShop(code, shopName());
    routeFromHash();
  } else {
    S.data = blankData();
    S.ready = false;
    renderLoading();
  }
  let remote, err = null;
  try { remote = await api('GET', ''); } catch (e) { err = e; }
  if (err) {
    if (cached) {
      S.online = false;
      localStorage.setItem(LS_SHOP, code);
      startStream(); flushQueue(); markSync();
      toast('연결이 약해 기기 저장본으로 열었어요');
      return;
    }
    renderWelcome('샵 데이터를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
    return;
  }
  S.online = true;
  const seeded = !!(remote && remote.meta && remote.meta.code);
  if (!seeded) {
    if (code === DEMO_CODE) {
      S.data = seedDemo();
      try { await api('PUT', '', S.data); } catch (e) { }
    } else if (opts.create) {
      S.data = blankShop(opts.meta || {});
      S.data.meta.code = code;
      try { await api('PUT', '', S.data); } catch (e) { }
    } else {
      S.ready = false;
      renderWelcome();
      askCreateShop(code);
      return;
    }
  } else {
    S.data = normalize(remote);
  }
  S.ready = true;
  S.sync = 'idle'; S.lastSync = Date.now();
  rememberShop(code, shopName());
  localStorage.setItem(LS_SHOP, code);
  cacheNow();
  startStream();
  closeModal();
  flushQueue();
  routeFromHash();
}

/* =========================================================
   19. 환영화면
   ========================================================= */
function renderWelcome(msg) {
  const shops = knownShops();
  const last = shops[0];
  $('#app').innerHTML = `
  <div class="welcome">
    <div class="welcome-mark">A</div>
    <h1>알프스 원장님 비서</h1>
    <p>예약·고객 차트·회원권·매출을<br>큰 글씨와 세 번의 터치로 관리하세요.</p>
    ${msg ? `<div class="badge-note mt16" style="border:1px solid #F0CFCA;background:#FBEAE8;color:#9E2F23">${esc(msg)}</div>` : ''}
    <div class="welcome-card">
      <div class="feat">${ic('cal')}<div><b>오늘·주간·월간 예약</b><span class="tiny muted">예약 확정 → 방문 완료 → 매출까지 한 번에</span></div></div>
      <div class="feat">${ic('users')}<div><b>고객 차트 + 전자 서명</b><span class="tiny muted">상담 기록·사진·동의 서명을 차트에 보관</span></div></div>
      <div class="feat">${ic('ticket')}<div><b>회원권 자동 차감</b><span class="tiny muted">횟수권·정액권 잔여가 실시간으로 보여요</span></div></div>
      <div class="feat">${ic('bell')}<div><b>리필·이탈 알림</b><span class="tiny muted">30일 주기 미네랄 리필, 오래 안 오신 고객 안내</span></div></div>
    </div>
    <div class="mt24">
      ${last && last.code !== DEMO_CODE ? `<button class="btn primary block" data-act="welcome-last" data-code="${esc(last.code)}">${ic('arrowR')}${esc(last.name || last.code)} 이어서 열기</button>` : ''}
      <button class="btn gold block mt12" data-act="welcome-demo">${ic('check')}체험 샵으로 바로 시작 (${DEMO_CODE})</button>
      <div class="btn-row mt12">
        <button class="btn" data-act="shop-enter">샵 코드 입력</button>
        <button class="btn" data-act="shop-create">새 샵 만들기</button>
      </div>
    </div>
    <div class="badge-note mt24" style="text-align:center">영업 현장에서 원장님께 그대로 보여 주세요.<br>체험 데이터로 모든 기능을 눌러볼 수 있습니다.</div>
  </div>`;
}

/* =========================================================
   20. 액션
   ========================================================= */
function copyByKind(kind, id, when) {
  if (kind === 'remind') {
    const a = (S.data.appointments || {})[id];
    if (a) copyText(msgRemind(a, when || 'tomorrow'));
  } else if (kind === 'thanks') {
    const a = (S.data.appointments || {})[id];
    if (a) copyText(msgThanks(a));
  } else if (kind === 'refill') {
    const m = (S.data.minerals || {})[id];
    if (m) copyText(msgRefill(m));
  } else if (kind === 'miss') {
    const c = customer(id);
    if (c) copyText(msgMiss(c, lastVisit(c)));
  } else if (kind === 'pass') {
    const p = (S.data.passes || {})[id];
    if (p) copyText(msgPassRenew(p));
  }
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  switch (act) {
    case 'goto': go(el.dataset.to || '#/home'); break;
    case 'close-modal': closeModal(); break;
    case 'new-appt': modalApptNew({ customerId: el.dataset.id || '', date: el.dataset.date || '' }); break;
    case 'appt-for': modalApptNew({ customerId: id }); break;
    case 'appt-open':
    case 'appt-detail': modalApptDetail((S.data.appointments || {})[id]); break;
    case 'appt-confirm': {
      const a = (S.data.appointments || {})[id];
      if (!a) break;
      await put('appointments/' + id, Object.assign({}, a, { status: '확정' }));
      toast('예약을 확정했어요');
      break;
    }
    case 'appt-done': {
      const a = (S.data.appointments || {})[id];
      if (a) modalApptComplete(a);
      break;
    }
    case 'appt-noshow': {
      const a = (S.data.appointments || {})[id];
      if (a) modalApptNoshow(a);
      break;
    }
    case 'copy-remind': copyByKind('remind', id, el.dataset.when); break;
    case 'copy-thanks': copyByKind('thanks', id); break;
    case 'copy-refill': copyByKind('refill', id); break;
    case 'copy-miss': copyByKind('miss', id); break;
    case 'copy-pass': copyByKind('pass', id); break;
    case 'copy-day-remind': {
      const date = el.dataset.date;
      const list = apptsOn(date).filter(a => a.status === '예약' || a.status === '확정');
      if (!list.length) { toast('안내문을 보낼 예약이 없어요'); break; }
      const text = list.map(a => msgRemind(a, date === todayISO() ? 'today' : 'tomorrow')).join('\n\n──────────\n\n');
      copyText(text, `예약 ${list.length}건 안내문을 복사했어요. 카톡에 붙여넣으세요.`);
      break;
    }
    case 'new-cust': modalCustomer(null); break;
    case 'cust-open': {
      closeModal();
      if (id) go('#/customer/' + id);
      break;
    }
    case 'cust-edit': modalCustomer(id); break;
    case 'cust-consent': modalConsent(id); break;
    case 'cust-treatment': modalTreatment(id); break;
    case 'cust-tab': S.ui.custTab = el.dataset.tab; render(true); break;
    case 'new-pass': modalPassNew(el.dataset.id || ''); break;
    case 'pass-use': modalPassUse(id); break;
    case 'pass-del': {
      const p = (S.data.passes || {})[id];
      if (!p) break;
      confirmDo({
        title: '회원권 삭제', text: `${p.customerName || ''} ${p.name} 회원권을 삭제할까요? 차감 기록도 함께 사라집니다.`, ok: '삭제', danger: true,
        onOk: async () => { await del('passes/' + id); toast('회원권을 삭제했어요'); }
      });
      break;
    }
    case 'new-sale': modalSaleNew(el.dataset.id || ''); break;
    case 'sale-del': {
      const s = (S.data.sales || {})[id];
      if (!s) break;
      confirmDo({
        title: '매출 삭제', text: `${fmtDate(s.date)} ${won(s.amount)} 매출 기록을 삭제할까요?`, ok: '삭제', danger: true,
        onOk: async () => { await del('sales/' + id); toast('매출 기록을 삭제했어요'); }
      });
      break;
    }
    case 'reserve-mode':
      S.ui.reserveMode = el.dataset.mode;
      if (S.ui.reserveMode === 'day') S.ui.calSel = todayISO();
      render(); break;
    case 'day-shift': {
      const base = (S.ui.calSel && S.ui.calSel.length === 10) ? S.ui.calSel : todayISO();
      S.ui.calSel = addDaysISO(Number(el.dataset.d), base);
      render(); break;
    }
    case 'week-shift': {
      const cur = S.ui.weekStart || weekStartISO(0);
      S.ui.weekStart = addDaysISO(Number(el.dataset.d) * 7, cur);
      render(); break;
    }
    case 'month-shift': {
      const cur = S.ui.monthCursor || ym();
      const [y, m] = cur.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
      S.ui.monthCursor = ym(d);
      S.ui.calSel = null;
      render(); break;
    }
    case 'cal-select': S.ui.calSel = el.dataset.date; render(true); break;
    case 'sales-mode': S.ui.salesMode = el.dataset.mode; render(); break;
    case 'sales-month': {
      const cur = S.ui.salesMonth || ym();
      const [y, m] = cur.split('-').map(Number);
      S.ui.salesMonth = ym(new Date(y, m - 1 + Number(el.dataset.d), 1));
      render(); break;
    }
    case 'grade': S.ui.grade = el.dataset.grade; render(true); break;
    case 'shop-copy': copyText(S.code, '샵 코드를 복사했어요. 다른 기기에서 붙여넣으세요.'); break;
    case 'shop-switch': modalShopSwitch(); break;
    case 'shop-create': modalShopCreate(); break;
    case 'shop-edit': modalShopEdit(); break;
    case 'shop-enter': modalShopEnter(); break;
    case 'shop-pick': {
      const code = el.dataset.code;
      closeModal();
      enterShop(code);
      break;
    }
    case 'welcome-demo': enterShop(DEMO_CODE); break;
    case 'welcome-last': enterShop(el.dataset.code); break;
    case 'demo-reset': {
      confirmDo({
        title: '체험 데이터 초기화', text: '체험 샵의 고객·예약·매출 데이터를 처음 샘플 상태로 되돌립니다. 지금 입력한 내용은 사라집니다.', ok: '초기화', danger: true,
        onOk: async () => {
          S.data = seedDemo();
          try { await api('PUT', '', S.data); } catch (e) { toast('초기화를 서버에 저장하지 못했어요'); }
          cacheNow(); render(); toast('체험 데이터를 처음 상태로 되돌렸어요');
        }
      });
      break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alfs-crm-${S.code}-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      toast('백업 파일을 내려받았어요');
      break;
    }
    case 'reload': location.reload(); break;
    default: break;
  }
});

/* 검색 입력 */
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t && t.dataset && t.dataset.act === 'search') {
    S.ui.query = t.value;
    const scrollY = window.scrollY;
    const active = document.activeElement;
    // 목록만 다시 그리기 위해 전체 렌더 후 포커스 복원
    render(true);
    const q = $('#q');
    if (q) { q.value = S.ui.query; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    window.scrollTo({ top: scrollY });
  }
});

/* 뒤로가기: 모달 열려 있으면 닫기 */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#modal-root').innerHTML) closeModal();
});

/* =========================================================
   21. 시작
   ========================================================= */
(async function boot() {
  window.addEventListener('online', () => { S.online = true; markSync(); flushQueue(); });
  window.addEventListener('offline', () => { S.online = false; markSync(); });
  const last = localStorage.getItem(LS_SHOP);
  if (last) {
    try { await enterShop(last); } catch (e) { renderWelcome('앱을 시작하지 못했어요. 새로고침해 주세요.'); }
  } else {
    S.ready = false;
    renderWelcome();
  }
})();
