/* ===========================================================
   AI 마케팅 통합 관리 · 시안 허브
   알프스 워크 — 샵별 4대 서비스 진행 관리 + 공유용 시안
   데이터: Cloud Firestore REST (무료 Spark, 익명 로그인)
   =========================================================== */
(function () {
'use strict';

/* ---------- Firestore REST ---------- */
var PROJECT = 'alfs-shop-crm';
var API_KEY = 'AIzaSyBBdrXw0ax7xw0p5OorUNG8aa-ohJ2mCNo';
var FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/default/documents';

var FS = {
  token: '',
  signing: null,
  signIn: function () {
    var self = this;
    if (self.token) return Promise.resolve(self.token);
    if (self.signing) return self.signing;
    self.signing = self._doSignIn().then(function (t) {
      self.signing = null; self.token = t; return t;
    }, function (e) {
      self.signing = null; throw e;
    });
    return self.signing;
  },
  _doSignIn: function () {
    var rt = '';
    try { rt = localStorage.getItem('aiMktRT') || ''; } catch (e) {}
    var url = rt
      ? 'https://securetoken.googleapis.com/v1/token?key=' + API_KEY
      : 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY;
    var headers = rt
      ? { 'Content-Type': 'application/x-www-form-urlencoded' }
      : { 'Content-Type': 'application/json' };
    var body = rt ? 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt) : '{"returnSecureToken":true}';
    return fetch(url, { method: 'POST', headers: headers, body: body }).then(function (r) {
      return r.json();
    }).then(function (j) {
      var t = j.id_token || j.idToken;
      if (!t) {
        if (rt) { try { localStorage.removeItem('aiMktRT'); } catch (e) {} return FS._doSignIn(); }
        throw new Error('로그인 실패: ' + ((j.error && j.error.message) || '알 수 없는 오류'));
      }
      var nrt = j.refresh_token || j.refreshToken || rt;
      if (nrt) { try { localStorage.setItem('aiMktRT', nrt); } catch (e) {} }
      return t;
    });
  }
};

function toFV(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFV) } };
  if (typeof v === 'object') {
    var f = {};
    Object.keys(v).forEach(function (k) { f[k] = toFV(v[k]); });
    return { mapValue: { fields: f } };
  }
  return { stringValue: String(v) };
}
function fromFV(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFV);
  if ('mapValue' in v) {
    var o = {}, f = v.mapValue.fields || {};
    Object.keys(f).forEach(function (k) { o[k] = fromFV(f[k]); });
    return o;
  }
  return null;
}
function docToObj(doc) {
  var o = { id: String(doc.name || '').split('/').pop() };
  var f = doc.fields || {};
  Object.keys(f).forEach(function (k) { o[k] = fromFV(f[k]); });
  return o;
}
function nest(fields) {
  var out = {};
  Object.keys(fields).forEach(function (k) {
    var parts = k.split('.'), o = out;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = fields[k];
  });
  return out;
}
function fsErrMsg(txt, status) {
  try {
    var j = JSON.parse(txt);
    var m = (j.error && j.error.message) || '';
    if (/PERMISSION_DENIED/.test(m)) return '권한이 없습니다. 잠시 후 다시 시도해 주세요.';
    if (/NOT_FOUND/.test(m)) return '찾을 수 없습니다.';
    return m || ('HTTP ' + status);
  } catch (e) { return 'HTTP ' + status; }
}

async function fsReq(path, opts) {
  opts = opts || {};
  var method = opts.method || 'GET';
  if (method !== 'GET') { await FS.signIn(); }
  var headers = { 'Content-Type': 'application/json' };
  if (FS.token) headers.Authorization = 'Bearer ' + FS.token;
  var res = await fetch(FS_BASE + path, { method: method, headers: headers, body: opts.body });
  if (res.status === 401 && !opts._retry) {
    FS.token = '';
    await FS.signIn();
    return fsReq(path, Object.assign({}, opts, { _retry: true }));
  }
  if (!res.ok) {
    var t = await res.text();
    var err = new Error(fsErrMsg(t, res.status));
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  var txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}
async function fsGetDoc(path) {
  try { return docToObj(await fsReq(path)); }
  catch (e) { if (e.status === 404) return null; throw e; }
}
async function fsList(path) {
  var out = [], token = '';
  do {
    var q = '?pageSize=100' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    var j = await fsReq(path + q);
    (j.documents || []).forEach(function (d) { out.push(docToObj(d)); });
    token = j.nextPageToken || '';
  } while (token);
  return out;
}
function fsPatch(path, fields) {
  var keys = Object.keys(fields);
  var mask = keys.map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  var body = { fields: {} };
  var nested = nest(fields);
  Object.keys(nested).forEach(function (k) { body.fields[k] = toFV(nested[k]); });
  return fsReq(path + '?' + mask, { method: 'PATCH', body: JSON.stringify(body) });
}
function fsDelete(path) { return fsReq(path, { method: 'DELETE' }); }
function fsCreate(path, id, fields) {
  var body = { fields: {} };
  Object.keys(fields).forEach(function (k) { body.fields[k] = toFV(fields[k]); });
  return fsReq(path + '?documentId=' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify(body) });
}

/* ---------- 상수 ---------- */
var DEFAULT_PIN = '0725';
var STATUSES = ['신규', '미팅', '진행', '완료', '보류'];
var SVC = [
  { k: 'web',    n: '01', title: '맞춤형 모바일 홍보 웹페이지', sub: '제작 · 호스팅' },
  { k: 'map',    n: '02', title: '네이버 · 카카오 · 구글 지도', sub: '3사 통합 세팅' },
  { k: 'place',  n: '03', title: '네이버 플레이스 최적화', sub: '메뉴 · 예약 · 소개글' },
  { k: 'shorts', n: '04', title: 'AI 홍보 쇼츠 · 진단 카드뉴스', sub: '영상 · 카드 제작' }
];
var CHK = [
  { k: 'web',    label: '홍보 웹페이지' },
  { k: 'diag',   label: '온라인 노출 진단' },
  { k: 'place',  label: '네이버 플레이스·예약' },
  { k: 'map',    label: '카카오·구글 등록' },
  { k: 'shorts', label: '쇼츠·릴스' },
  { k: 'etc',    label: '기타' }
];
var THEMES = [
  { k: 'navy',   label: '네이비 (기본)' },
  { k: 'forest', label: '포레스트 (건강·차·한방)' },
  { k: 'wine',   label: '와인 (식당·주점)' },
  { k: 'sand',   label: '샌드 (카페·베이커리)' }
];

/* ---------- 상태 ---------- */
var S = {
  view: 'hub', section: null,
  shops: [], shop: null, photos: [], editPhotos: [],
  query: '', filter: '전체',
  unlocked: false, loading: true, err: '', authWarn: false,
  curShopId: null, publicMode: false
};
var app = document.getElementById('app');
var modalRoot = document.getElementById('modal-root');
var shopsSig = '';
var pollTimer = null;

/* ---------- 유틸 ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^tel:/i.test(u)) return u;
  // 사이트 내 상대경로 (예: cards/pavis-diagnosis.jpg)
  if (/^[a-z0-9_\-./]+\.(png|jpe?g|webp|gif)$/i.test(u)) return u;
  if (/^[\w\-.~%]+(\/[\w\-.~%]+)*$/.test(u) && /\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u;
  return '';
}
function telHref(p) {
  var d = String(p || '').replace(/[^0-9+]/g, '');
  return d ? 'tel:' + d : '';
}
function toast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(function () { t.classList.remove('show'); }, 2400);
}
function copyText(txt) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(txt).catch(function () { return legacyCopy(txt); });
  }
  return Promise.resolve(legacyCopy(txt));
}
function legacyCopy(txt) {
  var ta = document.createElement('textarea');
  ta.value = txt;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  return true;
}
function shareUrl(id) {
  var base = location.origin + location.pathname.replace(/index\.html$/, '');
  return base + '?shop=' + encodeURIComponent(id);
}
function sha256hex(str) {
  if (window.crypto && crypto.subtle && window.isSecureContext) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }
  var h1 = 0x811c9dc5, h2 = 0x1000193;
  for (var i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i); h1 = (h1 * 16777619) >>> 0;
    h2 = ((h2 << 5) - h2 + str.charCodeAt(i)) >>> 0;
  }
  return Promise.resolve('f' + h1.toString(16) + h2.toString(16));
}
function pinHash(pin) { return sha256hex(pin + '|aiMktHub'); }
function fmtDate(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
}
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------- 이미지 압축 ---------- */
function loadImage(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했습니다. 휴대폰 사진은 JPG로 저장한 뒤 올려 주세요.'));
    };
    img.src = url;
  });
}
function canvasToDataUrl(img, maxW, q) {
  var scale = Math.min(1, maxW / img.width);
  var w = Math.max(1, Math.round(img.width * scale));
  var h = Math.max(1, Math.round(img.height * scale));
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q);
}
function dataUrlKB(u) { return Math.round((u.length * 0.75) / 1024); }
function compressPhoto(file) {
  return loadImage(file).then(function (img) {
    var maxW = 800, q = 0.82, out = canvasToDataUrl(img, maxW, q), guard = 0;
    while (dataUrlKB(out) > 100 && guard < 14) {
      guard++;
      if (q > 0.45) { q -= 0.08; } else { maxW = Math.round(maxW * 0.85); q = 0.7; }
      out = canvasToDataUrl(img, maxW, q);
    }
    return out;
  });
}
function compressCard(file) {
  return loadImage(file).then(function (img) {
    var maxW = 1000, q = 0.86, out = canvasToDataUrl(img, maxW, q), guard = 0;
    while (dataUrlKB(out) > 300 && guard < 12) {
      guard++;
      if (q > 0.5) { q -= 0.08; } else { maxW = Math.round(maxW * 0.85); q = 0.72; }
      out = canvasToDataUrl(img, maxW, q);
    }
    return out;
  });
}

/* ---------- 데이터 ---------- */
function normalize(id, d) {
  d = d || {};
  var chk = d.chk || {};
  var svc = d.svc || {
    web: !!chk.web,
    map: !!(chk.map || chk.place),
    place: !!chk.place,
    shorts: !!chk.shorts
  };
  return {
    id: id,
    name: d.name || '(이름 없음)',
    cat: d.cat || '',
    addr: d.addr || '',
    owner: d.owner || '',
    phone: d.phone || '',
    status: d.status || '신규',
    intro: d.intro || '',
    hours: d.hours || '',
    memo: d.memo || '',
    notes: Array.isArray(d.notes) ? d.notes : [],
    draft: d.draft !== false,
    hasDiag: !!d.hasDiag,
    theme: d.theme || 'navy',
    svc: svc, chk: chk, opt: d.opt || {},
    links: d.links || {},
    menu: Array.isArray(d.menu) ? d.menu : [],
    order: num(d.order),
    createdAt: num(d.createdAt),
    updatedAt: num(d.updatedAt)
  };
}
function sortShops(list) {
  return list.sort(function (a, b) {
    if (a.status === '완료' && b.status !== '완료') return 1;
    if (b.status === '완료' && a.status !== '완료') return -1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}
function statusBadge(st) {
  var cls = st === '완료' ? 'ok' : (st === '보류' ? 'no' : (st === '신규' ? 'wait' : 'navy'));
  return '<span class="badge ' + cls + '">' + esc(st) + '</span>';
}
function svcDone(chk, k) { return !!(chk && chk[k]); }

/* ---------- 라우팅 ---------- */
function setView(v) { S.view = v; S.section = null; render(); window.scrollTo(0, 0); }

function render() {
  if (S.publicMode) return;
  if (!S.unlocked) { app.innerHTML = lockView(); return; }
  if (S.loading) {
    app.innerHTML = shellTop('AI 마케팅 관리', '알프스 워크') +
      '<div class="loading" style="min-height:60vh"><div><div class="spin"></div>불러오는 중…</div></div>';
    return;
  }
  if (S.err) {
    app.innerHTML = shellTop('AI 마케팅 관리', '알프스 워크') +
      '<div class="wrap" style="padding-top:40px"><div class="empty"><div class="big">⚠️</div><b>데이터를 불러오지 못했습니다</b><p>' +
      esc(S.err) + '</p></div><button class="btn ghost block" onclick="location.reload()">다시 시도</button></div>';
    return;
  }
  if (S.view === 'detail') { app.innerHTML = detailView(); afterDetail(); return; }
  if (S.view === 'edit')   { app.innerHTML = (S.section ? sectionView() : editHubView()); return; }
  if (S.view === 'new')    { app.innerHTML = newView(); return; }
  if (S.view === 'settings') { app.innerHTML = settingsView(); return; }
  app.innerHTML = hubView();
}
function shellTop(title, sub) {
  return '<div class="topbar"><div class="topbar-in">' +
    '<div class="logo">A</div>' +
    '<div class="tt"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>' +
    '</div></div>';
}
function shellTopBack(title, sub, onback) {
  return '<div class="topbar"><div class="topbar-in">' +
    '<button class="backbtn" onclick="' + onback + '" aria-label="뒤로">‹</button>' +
    '<div class="tt"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>' +
    '</div></div>';
}

/* ---------- 잠금 ---------- */
var pinBuf = '';
function lockView() {
  return '<div class="lock"><div class="lock-inner">' +
    '<div class="lock-mark">A</div>' +
    '<h1>AI 마케팅 관리</h1>' +
    '<p class="sub">알프스 워크 · 샵별 시안·진행 관리</p>' +
    '<div class="pin-dots" id="dots"><i></i><i></i><i></i><i></i></div>' +
    '<p class="pin-msg" id="pinmsg"></p>' +
    '<div class="keypad">' + keys() + '</div>' +
    '<p class="lock-foot">관리자 4자리 비밀번호<br>알프스 워크 영업팀 전용</p>' +
  '</div></div>';
}
function keys() {
  var out = '';
  for (var i = 1; i <= 9; i++) out += '<button onclick="pinKey(\'' + i + '\')">' + i + '</button>';
  out += '<button class="fn" onclick="pinClear()">지우기</button>';
  out += '<button onclick="pinKey(\'0\')">0</button>';
  out += '<button class="fn" onclick="pinDel()">⌫</button>';
  return out;
}
function paintPin() {
  var dots = document.querySelectorAll('#dots i');
  for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < pinBuf.length);
}
function pinKey(d) {
  if (pinBuf.length >= 4) return;
  pinBuf += d;
  paintPin();
  if (pinBuf.length === 4) setTimeout(tryUnlock, 140);
}
function pinDel() { pinBuf = pinBuf.slice(0, -1); paintPin(); }
function pinClear() { pinBuf = ''; paintPin(); var m = document.getElementById('pinmsg'); if (m) m.textContent = ''; }

async function tryUnlock() {
  var msg = document.getElementById('pinmsg');
  if (msg) msg.textContent = '확인 중…';
  try {
    var cfg = await fsGetDoc('/aiMktConfig/main');
    var stored = cfg && cfg.pinHash;
    if (!stored) {
      stored = await pinHash(DEFAULT_PIN);
      FS.signIn().then(function () {
        fsPatch('/aiMktConfig/main', { pinHash: stored, updatedAt: Date.now() }).catch(function () {});
      }).catch(function () {});
    }
    var h = await pinHash(pinBuf);
    if (h === stored) {
      S.unlocked = true;
      try { sessionStorage.setItem('aiMktUnlocked', '1'); } catch (e) {}
      pinBuf = '';
      startData();
    } else {
      if (msg) msg.textContent = '비밀번호가 맞지 않습니다';
      pinBuf = '';
      paintPin();
    }
  } catch (e) {
    if (msg) msg.textContent = '연결 오류: ' + (e.message || e);
  }
}

function startData() {
  S.loading = true;
  render();
  FS.signIn().catch(function () { S.authWarn = true; });
  loadShops(false).then(function () {
    S.loading = false; render();
  }).catch(function (e) {
    S.loading = false; S.err = e.message || String(e); render();
  });
  clearInterval(pollTimer);
  pollTimer = setInterval(refreshShops, 12000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshShops();
  });
}
function refreshShops() {
  if (!S.unlocked || S.publicMode) return;
  if (S.view === 'edit' || S.view === 'new' || S.view === 'settings') return;
  loadShops(true);
}
async function loadShops(silent) {
  var docs = await fsList('/aiMktShops');
  var sig = docs.map(function (d) { return [d.id, d.updatedAt, d.status, d.name].join(':'); }).join('|');
  var changed = sig !== shopsSig;
  shopsSig = sig;
  S.shops = sortShops(docs.map(function (d) { return normalize(d.id, d); }));
  if (S.curShopId) {
    var f = S.shops.filter(function (s) { return s.id === S.curShopId; })[0];
    if (f && S.view === 'detail') S.shop = f;
  }
  S.err = '';
  if (!silent || (changed && (S.view === 'hub' || S.view === 'detail'))) render();
}

/* ---------- 허브 ---------- */
function hubView() {
  var counts = { all: S.shops.length, ing: 0, done: 0 };
  S.shops.forEach(function (s) {
    if (s.status === '완료') counts.done++;
    else if (s.status !== '보류') counts.ing++;
  });
  var list = filterShops(S.query.trim().toLowerCase());
  var cards = list.map(shopCard).join('');
  if (!list.length) {
    cards = '<div class="empty"><div class="big">🏪</div><b>' +
      (S.shops.length ? '조건에 맞는 샵이 없습니다' : '아직 등록된 샵이 없습니다') +
      '</b><p>' + (S.shops.length ? '검색어를 지우거나 다른 상태를 골라 보세요.' : '위 버튼으로 첫 샵을 등록하세요.') + '</p></div>';
  }
  return '<div class="topbar"><div class="topbar-in">' +
      '<div class="logo">A</div>' +
      '<div class="tt"><b>AI 마케팅 관리</b><span>알프스 워크 · 4대 서비스</span></div>' +
      '<button class="icon-btn" onclick="openSettings()" aria-label="설정">⚙</button>' +
    '</div></div>' +
    '<div class="wrap">' +
      '<div class="hub-stats" style="padding-top:16px">' +
        '<div class="stat"><b>' + counts.all + '</b><span>전체 샵</span></div>' +
        '<div class="stat"><b>' + counts.ing + '</b><span>진행 중</span></div>' +
        '<div class="stat"><b>' + counts.done + '</b><span>완료</span></div>' +
      '</div>' +
      '<div style="margin-top:14px">' +
        '<button class="btn primary block" style="min-height:56px;font-size:17.5px" onclick="openNew()">＋ 새 샵 등록</button>' +
      '</div>' +
      '<div style="margin-top:14px" class="search"><span>🔍</span>' +
        '<input id="q" type="text" placeholder="샵 이름·주소·업종 검색" value="' + esc(S.query) + '" oninput="onSearch(this.value)" autocomplete="off">' +
      '</div>' +
      '<div class="chips">' +
        ['전체', '진행중', '완료'].map(function (f) {
          return '<button class="chip ' + (S.filter === f ? 'on' : '') + '" onclick="setFilter(\'' + f + '\')">' + f + '</button>';
        }).join('') +
      '</div>' +
      '<div class="shop-list">' + cards + '</div>' +
      (S.authWarn ? '<p style="margin-top:16px;font-size:12.5px;color:#A86418;text-align:center">저장 권한 연결에 실패했습니다. 조회만 가능합니다.</p>' : '') +
    '</div>';
}
function filterShops(q) {
  return S.shops.filter(function (s) {
    if (S.filter === '진행중' && (s.status === '완료' || s.status === '보류')) return false;
    if (S.filter === '완료' && s.status !== '완료') return false;
    if (!q) return true;
    return (s.name + ' ' + s.addr + ' ' + s.cat + ' ' + s.owner).toLowerCase().indexOf(q) >= 0;
  });
}
function shopCard(s) {
  var dots = SVC.map(function (v) {
    var on = !!s.svc[v.k];
    return '<span class="dot ' + (on ? 'on' : '') + '">' + (on ? '✓ ' : '') + v.n + '</span>';
  }).join('');
  return '<div class="shop-card" onclick="openShop(\'' + s.id + '\')" role="button" tabindex="0">' +
    '<div class="sc-top">' +
      '<div class="sc-name"><b>' + esc(s.name) + '</b>' +
        '<span>' + esc([s.cat, s.addr].filter(Boolean).join(' · ') || '정보 없음') + '</span></div>' +
      statusBadge(s.status) +
    '</div>' +
    '<div class="sc-dots">' + dots + '</div>' +
    '<div class="sc-actions" onclick="event.stopPropagation()">' +
      '<button class="btn soft" onclick="openProposal(\'' + s.id + '\')">시안 열기 ↗</button>' +
      '<button class="btn ghost" onclick="copyShopLink(\'' + s.id + '\')">링크 복사</button>' +
      '<button class="btn ghost" onclick="openEdit(\'' + s.id + '\')">수정</button>' +
    '</div>' +
  '</div>';
}
function onSearch(v) {
  S.query = v;
  var list = document.querySelector('.shop-list');
  if (list) {
    var shows = filterShops(v.trim().toLowerCase());
    list.innerHTML = shows.length ? shows.map(shopCard).join('') :
      '<div class="empty"><div class="big">🔍</div><b>조건에 맞는 샵이 없습니다</b></div>';
  }
}
function setFilter(f) { S.filter = f; render(); }

/* ---------- 상세 ---------- */
function openShop(id) {
  S.curShopId = id;
  S.shop = S.shops.filter(function (s) { return s.id === id; })[0] || null;
  S.photos = [];
  S.view = 'detail'; S.section = null;
  render();
  loadPhotos(id);
}
async function loadPhotos(id) {
  try {
    var rows = await fsList('/aiMktShops/' + id + '/photos');
    S.photos = rows.sort(function (a, b) { return num(a.o) - num(b.o); });
    if (S.view === 'detail') render();
  } catch (e) {}
}
function svcStatus(ok, labelOk, labelNo) {
  return ok ? '<span class="badge ok">' + labelOk + '</span>' : '<span class="badge no">' + labelNo + '</span>';
}
function svcState(done, level, label) {
  if (done) return '<span class="badge ok">완료</span>';
  var cls = level === 2 ? 'ok' : (level === 1 ? 'wait' : 'no');
  return '<span class="badge ' + cls + '">' + label + '</span>';
}
function detailView() {
  var s = S.shop;
  if (!s) return shellTopBack('샵 정보', 'AI 마케팅 관리', 'setView(\'hub\')') + '<div class="wrap"><div class="empty"><b>샵을 찾을 수 없습니다</b></div></div>';
  var L = s.links || {};
  var share = shareUrl(s.id);
  var webUrl = safeUrl(L.web) || share;
  var webIsLegacy = !!safeUrl(L.web);
  var naverUrl = safeUrl(L.naver);
  var kakaoUrl = safeUrl(L.kakao);
  var googleUrl = safeUrl(L.google);
  var placeUrl = safeUrl(L.place || L.naver);
  var bookingUrl = safeUrl(L.booking);
  var shortsUrl = safeUrl(L.shorts);
  var cardUrl = safeUrl(L.card);
  var diagImg = s._diag || '';
  var notes = s.notes || [];

  return shellTopBack(s.name, s.cat || '샵 상세', 'setView(\'hub\')') +
  '<div class="page"><div class="wrap">' +
    '<div class="detail-head">' +
      '<h2>' + esc(s.name) + '</h2>' +
      '<div class="detail-meta">' +
        (s.addr ? '<p><i>📍</i><span>' + esc(s.addr) + '</span></p>' : '') +
        (s.phone ? '<p><i>☎</i><span>' + esc(s.phone) + '</span></p>' : '') +
        (s.owner ? '<p><i>👤</i><span>' + esc(s.owner) + '</span></p>' : '') +
      '</div>' +
      '<div class="status-row">' +
        '<select onchange="quickStatus(\'' + s.id + '\', this.value)">' +
          STATUSES.map(function (x) { return '<option ' + (x === s.status ? 'selected' : '') + '>' + x + '</option>'; }).join('') +
        '</select>' +
        '<button class="btn navy sm" onclick="openEdit(\'' + s.id + '\')">✏️ 수정하기</button>' +
      '</div>' +
      '<div class="share-box">' +
        '<div class="lb">고객·원장님께 보낼 시안 링크</div>' +
        '<div class="u">' + esc(share) + '</div>' +
        '<button class="btn" onclick="copyShopLink(\'' + s.id + '\')">📋 링크 복사</button>' +
      '</div>' +
    '</div>' +

    '<div class="sec-title"><b>4대 서비스</b><span>누르면 바로 열립니다</span></div>' +

    (!s.svc.web ? svcOff('web', 0) :
    '<div class="svc">' +
      '<div class="svc-h"><div class="svc-num">01</div>' +
        '<div class="t"><b>맞춤형 모바일 홍보 웹페이지</b><small>제작 · 호스팅</small></div>' +
        (svcDone(s.chk, 'web') ? '<span class="badge ok">완료</span>' : '<span class="badge navy">진행 중</span>') +
      '</div>' +
      '<div class="svc-body">' +
        '<div class="link-line"><span class="nm">' + (webIsLegacy ? '전용 시안' : '자동 시안') + '</span>' +
          '<span class="url">' + esc(webIsLegacy ? L.web : '사진·메뉴에서 자동 생성') + '</span>' +
          '<a class="btn primary" href="' + esc(webUrl) + '" target="_blank" rel="noopener">열기 ↗</a></div>' +
        '<div class="btn-row" style="margin-top:10px">' +
          '<button class="btn ghost" onclick="openSection(\'' + s.id + '\',\'photos\')">📷 사진 수정</button>' +
          '<button class="btn ghost" onclick="openSection(\'' + s.id + '\',\'menu\')">🍽 메뉴·가격 수정</button>' +
        '</div>' +
      '</div>' +
    '</div>') +

    (!s.svc.map ? svcOff('map', 1) :
    '<div class="svc">' +
      '<div class="svc-h"><div class="svc-num">02</div>' +
        '<div class="t"><b>네이버 · 카카오 · 구글 지도</b><small>3사 통합 세팅</small></div>' +
        svcState(svcDone(s.chk, 'map'), (naverUrl && kakaoUrl && googleUrl) ? 2 : ((naverUrl || kakaoUrl || googleUrl) ? 1 : 0),
          (naverUrl && kakaoUrl && googleUrl) ? '3사 등록' : ((naverUrl || kakaoUrl || googleUrl) ? '일부 등록' : '등록 전')) +
      '</div>' +
      '<div class="svc-body">' +
        mapLine('네이버 지도', naverUrl, '등록', Id(s.id), 'naver') +
        mapLine('카카오맵', kakaoUrl, '등록', Id(s.id), 'kakao') +
        mapLine('구글 지도', googleUrl, '등록', Id(s.id), 'google') +
      '</div>' +
    '</div>') +

    (!s.svc.place ? svcOff('place', 2) :
    '<div class="svc">' +
      '<div class="svc-h"><div class="svc-num">03</div>' +
        '<div class="t"><b>네이버 플레이스 최적화</b><small>메뉴 · 예약 · 소개글</small></div>' +
        svcState(svcDone(s.chk, 'place'), placeUrl ? 2 : 0, placeUrl ? '등록됨' : '등록 전') +
      '</div>' +
      '<div class="svc-body">' +
        mapLine('플레이스', placeUrl, '열기', Id(s.id), 'place') +
        mapLine('네이버 예약', bookingUrl, '열기', Id(s.id), 'booking') +
        '<div class="mini-checks">' +
          [['menu', '메뉴 정리'], ['review', '리뷰 답변'], ['news', '소식·공지']].map(function (o) {
            return '<span class="mchk ' + (s.opt && s.opt[o[0]] ? 'on' : '') + '">' + (s.opt && s.opt[o[0]] ? '✓ ' : '· ') + o[1] + '</span>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>') +

    (!s.svc.shorts ? svcOff('shorts', 3) :
    '<div class="svc">' +
      '<div class="svc-h"><div class="svc-num">04</div>' +
        '<div class="t"><b>AI 홍보 쇼츠 · 진단 카드뉴스</b><small>영상 · 카드 제작</small></div>' +
        svcState(svcDone(s.chk, 'shorts'), (shortsUrl || cardUrl || diagImg) ? 2 : 0, (shortsUrl || cardUrl || diagImg) ? '준비됨' : '준비 전') +
      '</div>' +
      '<div class="svc-body">' +
        mapLine('쇼츠·릴스', shortsUrl, '영상 열기', Id(s.id), 'shorts') +
        '<div class="link-line"><span class="nm">진단 카드</span>' +
          '<span class="url">' + (cardUrl ? esc(cardUrl) : (diagImg ? '업로드된 카드 이미지' : '아직 없음')) + '</span>' +
          (cardUrl || diagImg
            ? '<button class="btn primary" onclick="showCard(\'' + s.id + '\')">카드 보기</button>'
            : '<button class="btn ghost" onclick="openSection(\'' + s.id + '\',\'links\')">올리기</button>') +
        '</div>' +
      '</div>' +
    '</div>') +

    ((s.intro || s.hours) ? '<div class="memo-box" style="background:#fff;border-color:var(--line)">' +
      '<b>한 줄 소개 · 영업시간</b>' + nl2br(s.intro || '(소개 없음)') +
      (s.hours ? '<div style="margin-top:6px;font-size:13.5px;color:#6E6A60">🕘 ' + nl2br(s.hours) + '</div>' : '') +
      '<button class="btn ghost sm" style="margin-top:10px" onclick="openSection(\'' + s.id + '\',\'info\')">소개·기본정보 수정</button></div>' : '') +

    '<div class="req-box">' +
      '<div class="req-h"><b>요청사항 · 메모</b><span>' + (notes.length ? notes.length + '건' : '없음') + '</span></div>' +
      (s.memo ? '<div class="req-item"><div class="req-t">초기 메모</div><div class="req-x">' + nl2br(s.memo) + '</div></div>' : '') +
      notes.slice().reverse().slice(0, 3).map(function (n) {
        return '<div class="req-item"><div class="req-t">' + fmtDate(n.t) + '</div><div class="req-x">' + nl2br(n.text) + '</div></div>';
      }).join('') +
      (!s.memo && !notes.length ? '<p style="font-size:13.5px;color:var(--muted);margin:4px 0 0">원장님 요청·처리 내용을 기록해 두세요.</p>' : '') +
      '<button class="btn ghost block" style="margin-top:10px" onclick="openSection(\'' + s.id + '\',\'notes\')">📝 요청사항·메모 관리</button>' +
    '</div>' +

    '<div class="danger-zone"><button onclick="confirmDelete(\'' + s.id + '\')">이 샵 삭제</button></div>' +
  '</div></div>';
}
function Id(id) { return '\'' + id + '\''; }
function svcOff(k, idx) {
  var v = SVC[idx];
  return '<div class="svc off">' +
    '<div class="svc-h"><div class="svc-num">' + v.n + '</div>' +
      '<div class="t"><b>' + v.title + '</b><small>' + v.sub + '</small></div>' +
      '<span class="badge no">미선택</span>' +
    '</div>' +
    '<div class="svc-off"><span>아직 선택하지 않은 항목입니다 · 추가 가능</span>' +
      '<button class="btn soft sm" onclick="addSvc(\'' + S.shop.id + '\',\'' + k + '\')">＋ 추가하기</button></div>' +
  '</div>';
}
function addSvc(id, k) {
  var patch = { updatedAt: Date.now() };
  patch['svc.' + k] = true;
  patch['chk.' + k] = true;
  fsPatch('/aiMktShops/' + id, patch).then(function () {
    if (S.shop && S.shop.id === id) {
      S.shop.svc = Object.assign({}, S.shop.svc); S.shop.svc[k] = true;
      S.shop.chk = Object.assign({}, S.shop.chk); S.shop.chk[k] = true;
      render();
    }
    toast('「' + SVC.filter(function (v) { return v.k === k; })[0].title + '」을(를) 추가했습니다');
  }).catch(function (e) { toast('저장 실패: ' + e.message); });
}
function mapLine(name, url, okLabel, idArg, field) {
  if (url) {
    return '<div class="link-line"><span class="nm">' + name + '</span>' +
      '<span class="url">' + esc(url.replace(/^https?:\/\//, '').slice(0, 42)) + '</span>' +
      '<a class="btn primary" href="' + esc(url) + '" target="_blank" rel="noopener">' + okLabel + ' ↗</a></div>';
  }
  return '<div class="link-line"><span class="nm">' + name + '</span>' +
    '<span class="url" style="color:#B4483A">미등록</span>' +
    '<button class="btn ghost" onclick="openSection(' + idArg + ',\'links\')">등록</button></div>';
}
function afterDetail() {
  var s = S.shop;
  if (!s) return;
  if (!s.hasDiag) return;
  if (!s._diag && !s._diagTried) {
    s._diagTried = true;
    fsGetDoc('/aiMktShops/' + s.id + '/assets/diag').then(function (d) {
      if (d && d.d) {
        s._diag = d.d;
        if (S.view === 'detail') render();
      }
    }).catch(function () {});
  }
}
function quickStatus(id, st) {
  fsPatch('/aiMktShops/' + id, { status: st, updatedAt: Date.now() })
    .then(function () { toast('상태를 「' + st + '」(으)로 바꿨습니다'); })
    .catch(function (e) { toast('저장 실패: ' + e.message); });
}
function copyShopLink(id) {
  var u = shareUrl(id);
  copyText(u).then(function () { toast('시안 링크를 복사했습니다'); })
    .catch(function () { showLinkModal(u); });
}
function showLinkModal(u) {
  openModal('<h3>시안 링크</h3><p>아래 주소를 길게 눌러 복사하세요.</p>' +
    '<div class="share-box" style="margin-top:14px"><div class="u" style="user-select:all">' + esc(u) + '</div></div>' +
    '<div class="acts"><button class="btn ghost" onclick="closeModal()">닫기</button></div>');
}
function openProposal(id) {
  var s = S.shop && S.shop.id === id ? S.shop : S.shops.filter(function (x) { return x.id === id; })[0];
  var url = (s && s.links && safeUrl(s.links.web)) ? safeUrl(s.links.web) : shareUrl(id);
  window.open(url, '_blank', 'noopener');
}
function showCard(id) {
  var s = S.shop;
  var cardUrl = s && s.links ? safeUrl(s.links.card) : '';
  var apply = function (src) {
    openModal('<h3>진단 카드</h3><div class="lb-modal" style="margin-top:12px"><img src="' + esc(src) + '" alt="온라인 노출 진단 카드"></div>' +
      '<div class="acts"><a class="btn primary" href="' + esc(src) + '" target="_blank" rel="noopener">새 창에서 크게 보기 ↗</a>' +
      '<button class="btn ghost" onclick="closeModal()">닫기</button></div>');
  };
  if (s && s._diag) return apply(s._diag);
  if (s && !s.hasDiag) { if (cardUrl) apply(cardUrl); else toast('등록된 진단 카드가 없습니다'); return; }
  fsGetDoc('/aiMktShops/' + id + '/assets/diag').then(function (d) {
    if (d && d.d) { if (s) s._diag = d.d; apply(d.d); }
    else if (cardUrl) apply(cardUrl);
    else toast('등록된 진단 카드가 없습니다');
  }).catch(function () { if (cardUrl) apply(cardUrl); else toast('카드를 불러오지 못했습니다'); });
}

/* ---------- 새 샵 ---------- */
var newSvc = { web: true, map: false, place: false, shorts: false };
function openNew() {
  newSvc = { web: true, map: false, place: false, shorts: false };
  S.view = 'new'; S.section = null; render(); window.scrollTo(0, 0);
}
function newView() {
  return shellTopBack('새 샵 등록', '상호·주소만 넣어도 시작됩니다', 'setView(\'hub\')') +
  '<div class="page"><div class="wrap">' +
    '<div class="card">' +
      '<div class="field"><label>상호 <small>필수</small></label>' +
        '<input id="n_name" type="text" placeholder="예) 파비스애니원 부천소사점" autocomplete="off"></div>' +
      '<div class="field"><label>주소</label>' +
        '<input id="n_addr" type="text" placeholder="예) 경기도 부천시 소사구 은성로 78 2층" autocomplete="off"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>대표 전화</label><input id="n_phone" type="tel" placeholder="0507-0000-0000"></div>' +
        '<div class="field"><label>담당자·연락처</label><input id="n_owner" type="text" placeholder="원장 010-0000-0000"></div>' +
      '</div>' +
      '<div class="field"><label>업종</label>' +
        '<input id="n_cat" type="text" placeholder="예) 건강·웰니스 / 카페·펍 / 미용" autocomplete="off"></div>' +
    '</div>' +
    '<div class="card"><h3><em>진행</em> 하기로 한 서비스</h3>' +
      SVC.map(function (v) {
        return '<button class="svc-pick ' + (newSvc[v.k] ? 'on' : '') + '" data-k="' + v.k + '" onclick="toggleNewSvc(this)">' +
          '<span class="svc-pick-n">' + v.n + '</span>' +
          '<span class="svc-pick-t"><b>' + v.title + '</b><small>' + v.sub + '</small></span>' +
          '<span class="svc-pick-bx">' + (newSvc[v.k] ? '✓' : '') + '</span>' +
        '</button>';
      }).join('') +
      '<p class="hint" style="margin-top:10px">고른 항목만 상세 화면에서 활성화되고, 나머지는 「미선택 · 추가 가능」으로 표시됩니다. 나중에 언제든 바꿀 수 있습니다.</p>' +
    '</div>' +
    '<div class="savebar"><button class="btn primary" onclick="createShop()">이 샵 등록하고 시안 만들기</button></div>' +
  '</div></div>';
}
function toggleNewSvc(el) {
  var k = el.getAttribute('data-k');
  newSvc[k] = !newSvc[k];
  el.classList.toggle('on', newSvc[k]);
  el.querySelector('.svc-pick-bx').textContent = newSvc[k] ? '✓' : '';
}
function nextOrder() {
  var max = 0;
  S.shops.forEach(function (s) { max = Math.max(max, num(s.order)); });
  return max + 1;
}
async function createShop() {
  var name = val('n_name').trim();
  if (!name) { toast('상호를 입력해 주세요'); var e = document.getElementById('n_name'); if (e) e.focus(); return; }
  if (!newSvc.web && !newSvc.map && !newSvc.place && !newSvc.shorts) {
    toast('진행할 서비스를 하나 이상 골라 주세요'); return;
  }
  var now = Date.now();
  var id = 'shop' + now.toString(36);
  var doc = {
    name: name,
    addr: val('n_addr').trim(),
    phone: val('n_phone').trim(),
    owner: val('n_owner').trim(),
    cat: val('n_cat').trim(),
    status: '신규',
    draft: true,
    theme: 'navy',
    svc: { web: !!newSvc.web, map: !!newSvc.map, place: !!newSvc.place, shorts: !!newSvc.shorts },
    chk: {}, opt: {}, links: {}, menu: [], notes: [],
    intro: '', hours: '', memo: '',
    order: nextOrder(),
    createdAt: now,
    updatedAt: now
  };
  btnBusy(true, '등록 중…');
  try {
    await fsCreate('/aiMktShops', id, doc);
    toast('등록했습니다 · 시안 링크가 만들어졌습니다');
    S.curShopId = id;
    S.shop = normalize(id, doc);
    S.shops.unshift(S.shop);
    S.view = 'detail'; S.section = null;
    render();
    window.scrollTo(0, 0);
  } catch (e) {
    btnBusy(false);
    toast('저장 실패: ' + e.message);
  }
}

/* ---------- 수정 (영역 선택) ---------- */
function openEdit(id) {
  var s = S.shops.filter(function (x) { return x.id === id; })[0];
  if (!s) return;
  S.shop = s; S.curShopId = id;
  S.view = 'edit'; S.section = null;
  S.editPhotos = [];
  render(); window.scrollTo(0, 0);
  loadEditPhotos(id);
}
function openSection(id, sec) {
  var s = S.shops.filter(function (x) { return x.id === id; })[0] || S.shop;
  if (!s) return;
  S.shop = s; S.curShopId = id;
  S.view = 'edit'; S.section = sec;
  S.editPhotos = [];
  render(); window.scrollTo(0, 0);
  loadEditPhotos(id);
}
async function loadEditPhotos(id) {
  try {
    var rows = await fsList('/aiMktShops/' + id + '/photos');
    // 올리는 중이거나 지운 사진이 있으면 덮어쓰지 않는다
    if (S.editPhotos.some(function (p) { return p.isNew || p.del; })) return;
    S.editPhotos = rows.sort(function (a, b) { return num(a.o) - num(b.o); }).map(function (d) {
      return { id: d.id, d: d.d, o: num(d.o), isNew: false, del: false };
    });
    if (S.view === 'edit' && S.section === 'photos') rerenderPhotos();
    else if (S.view === 'edit' && !S.section) render();
  } catch (e) {}
}
function editHubView() {
  var s = S.shop;
  if (!s) return '';
  var menuN = (s.menu || []).length;
  var noteN = (s.notes || []).length;
  return shellTopBack('수정하기', s.name, 'openShop(\'' + s.id + '\')') +
  '<div class="page"><div class="wrap">' +
    '<p class="edit-lead">어느 부분을 고칠까요?<br><span>고친 뒤 저장하면 공유 시안에 바로 반영됩니다.</span></p>' +
    '<div class="edit-menu">' +
      emRow('photos', '📷', '사진(이미지) 관리', '대표·갤러리 사진 추가·교체·삭제', S.editPhotos.filter(function (p) { return !p.del; }).length + '장') +
      emRow('menu', '🍽', '메뉴·가격 관리', '메뉴 이름·가격·설명 수정, 추가·삭제', menuN + '개') +
      emRow('info', '🏪', '소개 글 · 기본 정보', '한 줄 소개·영업시간·연락처·상태', '') +
      emRow('links', '🔗', '서비스 선택 · 링크', '4대 서비스 링크와 진행 표시', svcCount(s) + '/4') +
      emRow('notes', '📝', '요청사항 · 메모', '원장님 요청과 처리 내용 기록', noteN + '건') +
    '</div>' +
    '<div class="card" style="margin-top:16px"><h3>바로 열기</h3>' +
      '<div class="btn-row">' +
        '<button class="btn ghost" onclick="openProposal(\'' + s.id + '\')">공유 시안 보기 ↗</button>' +
        '<button class="btn ghost" onclick="copyShopLink(\'' + s.id + '\')">링크 복사</button>' +
      '</div>' +
    '</div>' +
  '</div></div>';
}
function svcCount(s) {
  return ['web', 'map', 'place', 'shorts'].filter(function (k) { return s.svc[k]; }).length;
}
function emRow(sec, icon, title, sub, count) {
  return '<button class="em-row" onclick="openSection(\'' + S.shop.id + '\',\'' + sec + '\')">' +
    '<span class="em-ic">' + icon + '</span>' +
    '<span class="em-tx"><b>' + title + '</b><small>' + sub + '</small></span>' +
    (count ? '<span class="em-n">' + esc(count) + '</span>' : '') +
    '<span class="em-arrow">›</span>' +
  '</button>';
}
function sectionView() {
  var s = S.shop;
  if (!s) return '';
  if (S.section === 'photos') return photosSection(s);
  if (S.section === 'menu') return menuSection(s);
  if (S.section === 'info') return infoSection(s);
  if (S.section === 'links') return linksSection(s);
  if (S.section === 'notes') return notesSection(s);
  return editHubView();
}
function sectionTop(s, title) {
  return shellTopBack(title, s.name, 'backToEdit()');
}
function backToEdit() { S.section = null; render(); window.scrollTo(0, 0); }

/* --- 사진 --- */
function photosSection(s) {
  return sectionTop(s, '사진 관리') +
  '<div class="page"><div class="wrap">' +
    '<div class="card"><h3>대표 · 갤러리 사진</h3>' +
      '<p class="hint" style="margin-bottom:12px">첫 사진이 시안 대표 이미지로 크게 나옵니다. 올리는 사진은 가로 800px·100KB 이하로 자동 압축되어 무료로 저장됩니다.</p>' +
      '<div class="photos" id="photos">' + photoCells() + '</div>' +
      '<input id="photo_file" type="file" accept="image/*" multiple style="display:none" onchange="onPhotoFiles(this)">' +
      '<p class="hint" style="margin-top:10px">최대 6장 · 올린 순서대로 나옵니다.</p>' +
    '</div>' +
    '<div class="savebar"><button class="btn primary" onclick="savePhotos()">사진 저장 · 시안 반영</button></div>' +
  '</div></div>';
}
function photoCells() {
  var cells = S.editPhotos.filter(function (p) { return !p.del; }).map(function (p, i) {
    return '<div class="ph"><img src="' + p.d + '" alt="사진 ' + (i + 1) + '">' +
      (i === 0 ? '<span class="ph-tag">대표</span>' : '') +
      '<button class="del" onclick="delPhoto(\'' + (p.id || p._tmp) + '\')" aria-label="사진 삭제">✕</button></div>';
  }).join('');
  var n = S.editPhotos.filter(function (p) { return !p.del; }).length;
  if (n < 6) cells += '<button class="ph-add" onclick="document.getElementById(\'photo_file\').click()"><span>＋</span>사진 추가</button>';
  return cells;
}
function rerenderPhotos() {
  var box = document.getElementById('photos');
  if (box) box.innerHTML = photoCells();
}
function delPhoto(key) {
  S.editPhotos.forEach(function (p) { if ((p.id || p._tmp) === key) p.del = true; });
  rerenderPhotos();
}
function onPhotoFiles(input) {
  var files = Array.prototype.slice.call(input.files || []);
  input.value = '';
  if (!files.length) return;
  var room = 6 - S.editPhotos.filter(function (p) { return !p.del; }).length;
  files = files.slice(0, Math.max(0, room));
  if (!files.length) { toast('사진은 최대 6장까지입니다'); return; }
  toast('사진을 줄이는 중…');
  var chain = Promise.resolve();
  files.forEach(function (f) {
    chain = chain.then(function () {
      return compressPhoto(f).then(function (d) {
        S.editPhotos.push({ id: null, _tmp: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), d: d, isNew: true, del: false });
        rerenderPhotos();
        toast('사진 ' + dataUrlKB(d) + 'KB로 준비했습니다 · 저장을 눌러 반영하세요');
      }).catch(function (e) { toast(e.message); });
    });
  });
}
async function savePhotos() {
  var s = S.shop;
  var base = '/aiMktShops/' + s.id + '/photos';
  var jobs = [];
  var kept = S.editPhotos.filter(function (p) { return !p.del; });
  S.editPhotos.forEach(function (p) {
    if (p.del && p.id) jobs.push(fsDelete(base + '/' + p.id).catch(function () {}));
  });
  kept.forEach(function (p, i) {
    if (p.isNew) {
      var nid = uid('p');
      jobs.push(fsCreate(base, nid, { d: p.d, o: i, t: Date.now() }));
      p.id = nid; p.isNew = false;
    } else if (num(p.o) !== i && p.id) {
      jobs.push(fsPatch(base + '/' + p.id, { o: i }));
    }
  });
  btnBusy(true, '저장 중…');
  try {
    await Promise.all(jobs);
    await fsPatch('/aiMktShops/' + s.id, { updatedAt: Date.now() });
    btnBusy(false);
    toast('사진을 저장했습니다 · 시안에 바로 반영됩니다');
    S.editPhotos.forEach(function (p) { p.del = false; });
    backToEdit();
  } catch (e) {
    btnBusy(false);
    toast('저장 실패: ' + e.message);
  }
}

/* --- 메뉴 --- */
function menuSection(s) {
  var rows = (s.menu || []).map(menuRow).join('');
  return sectionTop(s, '메뉴 · 가격 관리') +
  '<div class="page"><div class="wrap">' +
    '<div class="card"><h3>메뉴 · 서비스</h3>' +
      '<p class="hint" style="margin-bottom:12px">시안의 메뉴 목록에 그대로 나옵니다. 이름·가격·설명을 고치거나 항목을 추가·삭제하세요.</p>' +
      '<div class="menu-edit" id="menu-edit">' + rows + '</div>' +
      '<button class="btn ghost block" style="margin-top:6px" onclick="addMenu()">＋ 메뉴 추가</button>' +
    '</div>' +
    '<div class="savebar"><button class="btn primary" onclick="saveMenu()">메뉴 저장 · 시안 반영</button></div>' +
  '</div></div>';
}
function menuRow(m) {
  return '<div class="menu-item"><button class="rm" onclick="rmMenu(this)">삭제</button>' +
    '<div class="row"><input class="mname" type="text" placeholder="메뉴·서비스 이름" value="' + esc(m.n || '') + '">' +
    '<input class="mprice" type="text" placeholder="가격" value="' + esc(m.p || '') + '"></div>' +
    '<div class="row"><input class="mdesc full" type="text" placeholder="짧은 설명 (선택)" value="' + esc(m.d || '') + '"></div>' +
  '</div>';
}
function addMenu() {
  var box = document.getElementById('menu-edit');
  if (!box) return;
  var div = document.createElement('div');
  div.className = 'menu-item';
  div.innerHTML = '<button class="rm" onclick="rmMenu(this)">삭제</button>' +
    '<div class="row"><input class="mname" type="text" placeholder="메뉴·서비스 이름">' +
    '<input class="mprice" type="text" placeholder="가격 (예: 80,000원)"></div>' +
    '<div class="row"><input class="mdesc full" type="text" placeholder="짧은 설명 (선택)"></div>';
  box.appendChild(div);
  var inp = div.querySelector('.mname');
  if (inp) inp.focus();
}
function rmMenu(btn) {
  var item = btn.closest('.menu-item');
  if (item) item.remove();
}
async function saveMenu() {
  var menu = [];
  [].forEach.call(document.querySelectorAll('#menu-edit .menu-item'), function (it) {
    var n = (it.querySelector('.mname').value || '').trim();
    var p = (it.querySelector('.mprice').value || '').trim();
    var d = (it.querySelector('.mdesc').value || '').trim();
    if (n || p) menu.push({ n: n, d: d, p: p });
  });
  btnBusy(true, '저장 중…');
  try {
    await fsPatch('/aiMktShops/' + S.shop.id, { menu: menu, updatedAt: Date.now() });
    btnBusy(false);
    S.shop.menu = menu;
    toast('메뉴를 저장했습니다 · 시안에 바로 반영됩니다');
    backToEdit();
  } catch (e) { btnBusy(false); toast('저장 실패: ' + e.message); }
}

/* --- 기본 정보 --- */
function infoSection(s) {
  var th = s.theme || 'navy';
  return sectionTop(s, '소개 글 · 기본 정보') +
  '<div class="page"><div class="wrap">' +
    '<div class="card">' +
      '<div class="field"><label>상호</label><input id="f_name" type="text" value="' + esc(s.name) + '"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>업종</label><input id="f_cat" type="text" value="' + esc(s.cat) + '"></div>' +
        '<div class="field"><label>진행 상태</label><select id="f_status">' +
          STATUSES.map(function (x) { return '<option ' + (x === s.status ? 'selected' : '') + '>' + x + '</option>'; }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>주소</label><input id="f_addr" type="text" value="' + esc(s.addr) + '"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>대표 전화</label><input id="f_phone" type="tel" value="' + esc(s.phone) + '"></div>' +
        '<div class="field"><label>담당자·연락처</label><input id="f_owner" type="text" value="' + esc(s.owner) + '"></div>' +
      '</div>' +
      '<div class="field"><label>한 줄 소개 <small>시안 상단 큰 문구</small></label>' +
        '<textarea id="f_intro" placeholder="예) 발효로 삭히고 비움으로 정돈합니다">' + esc(s.intro) + '</textarea></div>' +
      '<div class="field"><label>영업시간</label><input id="f_hours" type="text" placeholder="예) 매일 10:00 – 19:00 (일요일 휴무)" value="' + esc(s.hours) + '"></div>' +
      '<div class="field"><label>시안 색상</label><select id="f_theme">' +
        THEMES.map(function (t) { return '<option value="' + t.k + '" ' + (t.k === th ? 'selected' : '') + '>' + t.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field" style="margin-top:4px"><button class="tg ' + (s.draft ? 'on' : '') + '" id="f_draft" data-on="' + (s.draft ? '1' : '0') + '" onclick="toggleDraft(this)" style="width:100%;justify-content:flex-start">' +
        '<span class="bx">' + (s.draft ? '✓' : '') + '</span>시안 안내 문구 표시 (제작 시안 단계)</button></div>' +
    '</div>' +
    '<div class="savebar"><button class="btn primary" onclick="saveInfo()">저장 · 시안 반영</button></div>' +
  '</div></div>';
}
function toggleDraft(el) {
  el.classList.toggle('on');
  var on = el.classList.contains('on');
  el.setAttribute('data-on', on ? '1' : '0');
  el.querySelector('.bx').textContent = on ? '✓' : '';
}
async function saveInfo() {
  var name = val('f_name').trim();
  if (!name) { toast('상호를 입력해 주세요'); return; }
  var patch = {
    name: name,
    cat: val('f_cat').trim(),
    addr: val('f_addr').trim(),
    phone: val('f_phone').trim(),
    owner: val('f_owner').trim(),
    status: val('f_status'),
    intro: val('f_intro').trim(),
    hours: val('f_hours').trim(),
    theme: val('f_theme') || 'navy',
    draft: document.getElementById('f_draft').getAttribute('data-on') === '1',
    updatedAt: Date.now()
  };
  btnBusy(true, '저장 중…');
  try {
    await fsPatch('/aiMktShops/' + S.shop.id, patch);
    btnBusy(false);
    S.shop = Object.assign({}, S.shop, patch);
    toast('저장했습니다 · 시안에 바로 반영됩니다');
    backToEdit();
  } catch (e) { btnBusy(false); toast('저장 실패: ' + e.message); }
}

/* --- 서비스 링크 · 선택 --- */
function linksSection(s) {
  var L = s.links || {};
  var F = function (key, label, ph, hint) {
    return '<div class="field"><label>' + label + '</label>' +
      '<input id="f_' + key + '" type="url" inputmode="url" placeholder="' + esc(ph || 'https://') + '" value="' + esc(L[key] || '') + '" autocomplete="off">' +
      (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>';
  };
  return sectionTop(s, '서비스 선택 · 링크') +
  '<div class="page"><div class="wrap">' +
    '<div class="card"><h3>진행할 서비스</h3>' +
      SVC.map(function (v) {
        var on = !!s.svc[v.k];
        return '<button class="svc-pick ' + (on ? 'on' : '') + '" data-k="' + v.k + '" onclick="toggleSvcPick(this)">' +
          '<span class="svc-pick-n">' + v.n + '</span>' +
          '<span class="svc-pick-t"><b>' + v.title + '</b><small>' + v.sub + '</small></span>' +
          '<span class="svc-pick-bx">' + (on ? '✓' : '') + '</span></button>';
      }).join('') +
      '<p class="hint" style="margin-top:8px">끄면 상세 화면에서 「미선택 · 추가 가능」으로 표시됩니다.</p>' +
    '</div>' +

    '<div class="card"><h3><em>01</em> 홍보 웹페이지</h3>' +
      F('web', '전용 시안 주소', 'https://byoorim09-bot.github.io/…', '비워 두면 이 앱이 만드는 자동 시안(?shop=)이 열립니다.') +
    '</div>' +

    '<div class="card"><h3><em>02</em> 지도 3사</h3>' +
      F('naver', '네이버 지도 주소', 'https://map.naver.com/…') +
      F('kakao', '카카오맵 주소', 'https://place.map.kakao.com/…') +
      F('google', '구글 지도 주소', 'https://maps.google.com/…', '구글에 아직 없으면 비워 두세요. 시안에는 ‘미등록’으로 표시됩니다.') +
    '</div>' +

    '<div class="card"><h3><em>03</em> 네이버 플레이스 · 예약</h3>' +
      F('place', '네이버 플레이스 주소', '비우면 02의 네이버 지도 주소를 씁니다') +
      F('booking', '네이버 예약 주소', 'https://booking.naver.com/…') +
      '<div class="toggles" style="margin-top:2px">' +
        [['menu', '메뉴 정리'], ['review', '리뷰 답변'], ['news', '소식·공지']].map(function (o) {
          var on = !!(s.opt && s.opt[o[0]]);
          return '<button class="tg ' + (on ? 'on' : '') + '" data-o="' + o[0] + '" onclick="toggleChk(this)">' +
            '<span class="bx">' + (on ? '✓' : '') + '</span>' + o[1] + '</button>';
        }).join('') +
      '</div>' +
    '</div>' +

    '<div class="card"><h3><em>04</em> 쇼츠 · 진단 카드</h3>' +
      F('shorts', '쇼츠 / 릴스 / 클립 주소', 'https://www.instagram.com/reel/… 또는 YouTube') +
      '<div class="field"><label>진단 카드 이미지</label>' +
        '<div class="btn-row">' +
          '<button class="btn ghost" onclick="pickCard()">🖼 카드 이미지 올리기</button>' +
          '<button class="btn ghost" onclick="clearCard()">지우기</button>' +
        '</div>' +
        '<input id="card_file" type="file" accept="image/*" style="display:none" onchange="onCardFile(this)">' +
        '<p class="hint" id="card_state">' + (L.card ? '등록됨: ' + esc(L.card) : 'JPG·PNG 이미지를 올리면 1000px로 줄여 저장합니다.') + '</p>' +
      '</div>' +
      F('card', '또는 카드 이미지 주소(URL)', 'https://…/diagnosis.jpg', '이미지를 올리면 이 칸이 자동으로 비워지고, 업로드본이 우선 표시됩니다.') +
    '</div>' +

    '<div class="card"><h3>진행 완료 표시</h3>' +
      '<div class="toggles">' + CHK.map(function (c) {
        var on = !!(s.chk && s.chk[c.k]);
        return '<button class="tg ' + (on ? 'on' : '') + '" data-k="' + c.k + '" onclick="toggleChk(this)">' +
          '<span class="bx">' + (on ? '✓' : '') + '</span>' + c.label + '</button>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="savebar"><button class="btn primary" onclick="saveLinks()">저장 · 시안 반영</button></div>' +
  '</div></div>';
}
function toggleSvcPick(el) {
  el.classList.toggle('on');
  el.querySelector('.svc-pick-bx').textContent = el.classList.contains('on') ? '✓' : '';
}
function toggleChk(el) {
  el.classList.toggle('on');
  el.querySelector('.bx').textContent = el.classList.contains('on') ? '✓' : '';
}
async function saveLinks() {
  var svc = {}, chk = {}, opt = {};
  [].forEach.call(document.querySelectorAll('.svc-pick[data-k]'), function (el) {
    svc[el.getAttribute('data-k')] = el.classList.contains('on');
  });
  [].forEach.call(document.querySelectorAll('.tg[data-k]'), function (el) {
    chk[el.getAttribute('data-k')] = el.classList.contains('on');
  });
  [].forEach.call(document.querySelectorAll('.tg[data-o]'), function (el) {
    opt[el.getAttribute('data-o')] = el.classList.contains('on');
  });
  var links = {
    web: val('f_web').trim(), naver: val('f_naver').trim(), kakao: val('f_kakao').trim(),
    google: val('f_google').trim(), place: val('f_place').trim(), booking: val('f_booking').trim(),
    shorts: val('f_shorts').trim(), card: val('f_card').trim()
  };
  var patch = { svc: svc, chk: chk, opt: opt, links: links, updatedAt: Date.now() };
  if (cardData === 'CLEAR') patch.hasDiag = false;
  else if (cardData) patch.hasDiag = true;
  btnBusy(true, '저장 중…');
  try {
    await fsPatch('/aiMktShops/' + S.shop.id, patch);
    if (cardData === 'CLEAR') {
      cardData = null;
      await fsDelete('/aiMktShops/' + S.shop.id + '/assets/diag').catch(function () {});
    } else if (cardData) {
      var img = cardData; cardData = null;
      await fsPatch('/aiMktShops/' + S.shop.id + '/assets/diag', { d: img, t: Date.now() });
    }
    btnBusy(false);
    S.shop = Object.assign({}, S.shop, patch);
    S.shop._diag = '';
    toast('저장했습니다 · 시안에 바로 반영됩니다');
    backToEdit();
  } catch (e) { btnBusy(false); toast('저장 실패: ' + e.message); }
}
var cardData = null;
function pickCard() { document.getElementById('card_file').click(); }
function onCardFile(input) {
  var f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  toast('카드 이미지를 준비하는 중…');
  compressCard(f).then(function (d) {
    cardData = d;
    var c = document.getElementById('f_card'); if (c) c.value = '';
    var st = document.getElementById('card_state');
    if (st) st.textContent = '업로드 준비 완료 (' + dataUrlKB(d) + 'KB) — 저장을 누르면 반영됩니다.';
  }).catch(function (e) { toast(e.message); });
}
function clearCard() {
  cardData = 'CLEAR';
  var el = document.getElementById('f_card'); if (el) el.value = '';
  var st = document.getElementById('card_state'); if (st) st.textContent = '카드를 지웁니다 — 저장을 눌러 반영하세요.';
}

/* --- 요청사항 · 메모 --- */
function notesSection(s) {
  var rows = (s.notes || []).map(function (n) {
    return '<div class="note-item" data-t="' + num(n.t) + '">' +
      '<div class="ni-h"><span>' + fmtDate(n.t || Date.now()) + '</span>' +
      '<button class="rm" onclick="rmNote(this)">삭제</button></div>' +
      '<textarea class="ntext" rows="2" placeholder="요청 내용·처리 결과">' + esc(n.text || '') + '</textarea>' +
    '</div>';
  }).join('');
  return sectionTop(s, '요청사항 · 메모') +
  '<div class="page"><div class="wrap">' +
    '<div class="card"><h3>요청사항 · 처리 메모</h3>' +
      '<p class="hint" style="margin-bottom:12px">원장님·사장님이 요청한 수정 사항과 처리한 내용을 날짜별로 남겨 두세요. (공유 시안에는 나오지 않습니다)</p>' +
      (s.memo ? '<div class="memo-box" style="margin-bottom:12px"><b>초기 메모 (읽기 전용)</b>' + nl2br(s.memo) + '</div>' : '') +
      '<div id="notes">' + rows + '</div>' +
      '<button class="btn ghost block" style="margin-top:4px" onclick="addNote()">＋ 메모 추가</button>' +
    '</div>' +
    '<div class="savebar"><button class="btn primary" onclick="saveNotes()">메모 저장</button></div>' +
  '</div></div>';
}
function addNote() {
  var box = document.getElementById('notes');
  if (!box) return;
  var now = Date.now();
  var d = document.createElement('div');
  d.className = 'note-item';
  d.setAttribute('data-t', now);
  d.innerHTML = '<div class="ni-h"><span>' + fmtDate(now) + '</span>' +
    '<button class="rm" onclick="rmNote(this)">삭제</button></div>' +
    '<textarea class="ntext" rows="2" placeholder="요청 내용·처리 결과"></textarea>';
  box.appendChild(d);
  var ta = d.querySelector('.ntext');
  if (ta) ta.focus();
}
function rmNote(btn) {
  var item = btn.closest('.note-item');
  if (item) item.remove();
}
async function saveNotes() {
  var notes = [];
  [].forEach.call(document.querySelectorAll('#notes .note-item'), function (el) {
    var text = (el.querySelector('.ntext').value || '').trim();
    if (text) notes.push({ t: num(el.getAttribute('data-t')) || Date.now(), text: text });
  });
  notes.sort(function (a, b) { return a.t - b.t; });
  btnBusy(true, '저장 중…');
  try {
    await fsPatch('/aiMktShops/' + S.shop.id, { notes: notes, updatedAt: Date.now() });
    btnBusy(false);
    S.shop.notes = notes;
    toast('메모를 저장했습니다');
    backToEdit();
  } catch (e) { btnBusy(false); toast('저장 실패: ' + e.message); }
}

function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
function btnBusy(on, label) {
  var b = document.querySelector('.savebar .btn');
  if (!b) return;
  if (on) { b.disabled = true; if (!b._old) b._old = b.textContent; b.textContent = label || '저장 중…'; }
  else { b.disabled = false; b.textContent = b._old || '저장'; b._old = ''; }
}

/* ---------- 삭제 ---------- */
function confirmDelete(id) {
  openModal('<h3>샵을 삭제할까요?</h3><p>' + esc((S.shop && S.shop.name) || '') +
    ' 카드와 시안 링크가 사라집니다. 되돌릴 수 없습니다.</p>' +
    '<div class="acts cols"><button class="btn ghost" onclick="closeModal()">취소</button>' +
    '<button class="btn primary" style="background:#BC4B37" onclick="doDelete(\'' + id + '\')">삭제</button></div>');
}
async function doDelete(id) {
  closeModal();
  try {
    var subs = ['photos', 'assets'];
    for (var i = 0; i < subs.length; i++) {
      var rows = await fsList('/aiMktShops/' + id + '/' + subs[i]).catch(function () { return []; });
      for (var j = 0; j < rows.length; j++) {
        await fsDelete('/aiMktShops/' + id + '/' + subs[i] + '/' + rows[j].id).catch(function () {});
      }
    }
    await fsDelete('/aiMktShops/' + id);
    toast('삭제했습니다');
    S.shops = S.shops.filter(function (x) { return x.id !== id; });
    S.view = 'hub'; S.shop = null; S.curShopId = null; S.section = null;
    render();
  } catch (e) { toast('삭제 실패: ' + e.message); }
}

/* ---------- 설정(PIN) ---------- */
function openSettings() { S.view = 'settings'; S.section = null; render(); window.scrollTo(0, 0); }
function settingsView() {
  return shellTopBack('설정', '관리자 비밀번호', 'setView(\'hub\')') +
  '<div class="page"><div class="wrap">' +
    '<div class="card"><h3>비밀번호 변경</h3>' +
      '<div class="field"><label>현재 비밀번호</label><input id="p_cur" type="tel" inputmode="numeric" maxlength="4" placeholder="4자리"></div>' +
      '<div class="field"><label>새 비밀번호</label><input id="p_new" type="tel" inputmode="numeric" maxlength="4" placeholder="4자리"></div>' +
      '<div class="field"><label>새 비밀번호 확인</label><input id="p_new2" type="tel" inputmode="numeric" maxlength="4" placeholder="4자리"></div>' +
      '<p class="hint">처음 비밀번호는 0725입니다. 잊어버리면 마인에게 알려 주세요.</p>' +
      '<button class="btn primary block" style="margin-top:14px" onclick="changePin()">비밀번호 바꾸기</button>' +
    '</div>' +
    '<div class="card"><h3>안내</h3><p style="font-size:14.5px;line-height:1.8;color:#5A6070">' +
      '이 관리 화면은 알프스 워크 AI 마케팅 대행 업무용입니다. 시안 링크를 받은 고객은 로그인 없이 홍보 페이지를 볼 수 있습니다.</p>' +
      '<p style="font-size:14.5px;line-height:1.8;color:#5A6070;margin-top:8px">📲 휴대폰 Chrome에서 이 화면을 연 뒤 <b>메뉴(⋮) → 홈 화면에 추가</b>를 누르면 앱처럼 한 번에 열 수 있습니다.</p>' +
    '</div>' +
    '<button class="btn ghost block" onclick="lockNow()">🔒 잠그기</button>' +
  '</div></div>';
}
async function changePin() {
  var cur = val('p_cur').trim(), n1 = val('p_new').trim(), n2 = val('p_new2').trim();
  if (!/^\d{4}$/.test(n1)) return toast('새 비밀번호는 숫자 4자리로 정해 주세요');
  if (n1 !== n2) return toast('새 비밀번호가 서로 다릅니다');
  try {
    var cfg = await fsGetDoc('/aiMktConfig/main');
    if (cfg && cfg.pinHash) {
      var h0 = await pinHash(cur);
      if (h0 !== cfg.pinHash) throw new Error('현재 비밀번호가 맞지 않습니다');
    }
    var nh = await pinHash(n1);
    await fsPatch('/aiMktConfig/main', { pinHash: nh, pinUpdatedAt: Date.now() });
    toast('비밀번호를 바꿨습니다');
    S.view = 'hub'; render();
  } catch (e) { toast(e.message || '변경 실패'); }
}
function lockNow() {
  try { sessionStorage.removeItem('aiMktUnlocked'); } catch (e) {}
  S.unlocked = false; S.view = 'hub'; S.section = null; pinBuf = ''; render();
}

/* ---------- 모달 ---------- */
function openModal(html) {
  modalRoot.innerHTML = '<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog">' + html + '</div></div>';
}
function closeModal() { modalRoot.innerHTML = ''; }

/* ===========================================================
   공개 시안 (?shop=<id>)
   =========================================================== */
var pubSig = '', pubTimer = null;
function initPublic(id) {
  S.publicMode = true;
  S.pubId = id;
  app.innerHTML = '<div class="loading"><div><div class="spin"></div>시안을 불러오는 중…</div></div>';
  pubTick(true);
  clearInterval(pubTimer);
  pubTimer = setInterval(function () {
    if (document.visibilityState === 'visible') pubTick(false);
  }, 15000);
}
async function pubTick(first) {
  try {
    var data = await fsGetDoc('/aiMktShops/' + S.pubId);
    if (!data) { renderPubEmpty(); return; }
    var sig = JSON.stringify(data);
    if (!first && sig === pubSig) return;
    pubSig = sig;
    S.shop = normalize(S.pubId, data);
    if (first) document.title = S.shop.name + ' · ' + (S.shop.cat || '홍보 페이지');
    await loadPubAssets(S.pubId);
    renderPublic();
  } catch (e) {
    if (first) {
      app.innerHTML = '<div class="pub-empty"><div><div class="big">⚠️</div><b>시안을 불러오지 못했습니다</b><p>' + esc(e.message || '') + '</p></div></div>';
    }
  }
}
async function loadPubAssets(id) {
  var shop = S.shop;
  try {
    var rows = await fsList('/aiMktShops/' + id + '/photos');
    S.photos = rows.sort(function (a, b) { return num(a.o) - num(b.o); }).map(function (d) { return d.d; });
  } catch (e) { S.photos = []; }
  if (!shop.hasDiag) { shop._diag = ''; return; }
  try {
    var d = await fsGetDoc('/aiMktShops/' + id + '/assets/diag');
    shop._diag = d && d.d ? d.d : '';
  } catch (e) { shop._diag = ''; }
}
function renderPubEmpty() {
  app.innerHTML = '<div class="pub-empty"><div><div class="big">🔍</div><b>페이지를 찾을 수 없습니다</b>' +
    '<p>링크가 만료되었거나 삭제된 시안입니다.<br>담당자(010-6398-9872)에게 다시 요청해 주세요.</p></div></div>';
}
function renderPublic() {
  var s = S.shop;
  var L = s.links || {};
  var photos = S.photos || [];
  var heroImg = photos[0] || '';
  var phone = telHref(s.phone);
  var naver = safeUrl(L.naver || L.place);
  var kakao = safeUrl(L.kakao);
  var google = safeUrl(L.google);
  var booking = safeUrl(L.booking);
  var shorts = safeUrl(L.shorts);
  var card = safeUrl(L.card);
  var diagImg = s._diag || '';
  var mapSearch = 'https://map.naver.com/p/search/' + encodeURIComponent(s.addr || s.name);
  var dirUrl = naver || mapSearch;

  var gallery = '';
  var galPhotos = photos.slice(1);
  if (galPhotos.length) {
    gallery = '<div class="gallery">' + galPhotos.map(function (p, i) {
      return '<div class="g ' + (i === 0 ? 'g1' : '') + '"><img src="' + p + '" alt="' + esc(s.name) + ' 사진 ' + (i + 1) + '" loading="lazy"></div>';
    }).join('') + '</div>';
  }

  var menu = '';
  if ((s.menu || []).length) {
    menu = '<section class="pub-sec"><div class="pub-kicker">MENU · SERVICE</div><h2>메뉴 · 서비스</h2>' +
      '<ul class="menu-list">' + s.menu.map(function (m) {
        return '<li><span class="mn"><b>' + esc(m.n) + '</b>' + (m.d ? '<span>' + esc(m.d) + '</span>' : '') + '</span>' +
          (m.p ? '<span class="mp">' + esc(m.p) + '</span>' : '') + '</li>';
      }).join('') + '</ul></section>';
  }

  var infoRows = '';
  if (s.hours) infoRows += '<div class="info-row"><dt>영업시간</dt><dd>' + nl2br(s.hours) + '</dd></div>';
  if (s.phone) infoRows += '<div class="info-row"><dt>전화</dt><dd><a href="' + esc(phone) + '" style="color:inherit">' + esc(s.phone) + '</a></dd></div>';
  if (s.addr) infoRows += '<div class="info-row"><dt>주소</dt><dd>' + esc(s.addr) + '</dd></div>';
  if (s.owner) infoRows += '<div class="info-row"><dt>담당</dt><dd>' + esc(s.owner) + '</dd></div>';

  var mapBtns = '';
  mapBtns += '<a href="' + esc(naver || mapSearch) + '" target="_blank" rel="noopener">네이버 지도<small>' + (naver ? '길찾기' : '검색으로 열기') + '</small></a>';
  if (kakao) mapBtns += '<a href="' + esc(kakao) + '" target="_blank" rel="noopener">카카오맵<small>길찾기</small></a>';
  if (google) mapBtns += '<a href="' + esc(google) + '" target="_blank" rel="noopener">구글 지도<small>길찾기</small></a>';

  var maps = '';
  if (infoRows) {
    maps = '<section class="pub-sec"><div class="pub-kicker">' + ((kakao || google) ? 'LOCATION' : 'INFO') + '</div>' +
      '<h2>' + ((kakao || google) ? '오시는 길' : '영업 안내') + '</h2>' +
      '<dl class="info-rows">' + infoRows + '</dl><div class="map-btns">' + mapBtns + '</div></section>';
  }

  var media = '';
  if (shorts) {
    media += '<div class="video-card"><span class="play">▶</span><div><b>매장 영상 보기</b><span>쇼츠 · 릴스로 미리 만나보세요</span></div>' +
      '<a class="btn primary sm" style="margin-left:auto" href="' + esc(shorts) + '" target="_blank" rel="noopener">보기</a></div>';
  }
  if (card || diagImg) {
    media += '<div class="diag-card"><a href="' + esc(card || diagImg) + '" target="_blank" rel="noopener">' +
      '<img src="' + esc(card || diagImg) + '" alt="온라인 노출 진단 카드" loading="lazy"></a></div>';
  }
  if (media) media = '<section class="pub-sec"><div class="pub-kicker">CONTENT</div><h2>온라인 노출 진단 · 콘텐츠</h2>' + media + '</section>';

  var notice = (s.draft !== false)
    ? '<div class="pub-note">알프스 AI 마케팅이 제작한 <b>홍보 페이지 시안</b>입니다 · 예약·결제는 매장으로 문의해 주세요</div>'
    : '';

  var heroCtas = '';
  if (phone) heroCtas += '<a class="btn primary" href="' + esc(phone) + '">📞 전화하기</a>';
  heroCtas += '<a class="btn ghost" href="' + esc(dirUrl) + '" target="_blank" rel="noopener">📍 길찾기</a>';

  var dock = '<div class="dock"><div class="dock-in">' +
    (phone ? '<a class="btn primary" href="' + esc(phone) + '">📞 전화</a>' : '') +
    (booking ? '<a class="btn navy" href="' + esc(booking) + '" target="_blank" rel="noopener">예약하기</a>'
      : '<a class="btn navy" href="' + esc(dirUrl) + '" target="_blank" rel="noopener">길찾기</a>') +
    '</div></div>';

  var lines = String(s.intro || '').split('\n');
  var tagline = lines[0] || s.name;
  var restIntro = lines.slice(1).join('\n').trim();
  var showAbout = restIntro.length > 0;

  app.innerHTML =
    '<div class="pub" data-theme="' + esc(s.theme || 'navy') + '">' + notice + '<div class="pub-narrow">' +
      '<header class="hero">' +
        (heroImg ? '<img class="hero-img" src="' + heroImg + '" alt="" fetchpriority="high">' : '') +
        '<div class="hero-scrim"></div>' +
        '<div class="hero-top"><span class="hero-brand">' + esc(s.name.slice(0, 18)) + '</span>' +
          (s.draft !== false ? '<span class="hero-tag">시안</span>' : '<span class="hero-tag">' + esc(s.cat || 'STORE') + '</span>') + '</div>' +
        '<div class="hero-in">' +
          '<div class="hero-cat">' + esc(s.cat || 'STORE') + '</div>' +
          '<h1>' + nl2br(tagline) + '</h1>' +
          (s.addr ? '<div class="addr">📍 ' + esc(s.addr) + '</div>' : '') +
          '<div class="hero-cta">' + heroCtas + '</div>' +
        '</div>' +
      '</header>' +

      (gallery ? '<section class="pub-sec"><div class="pub-kicker">GALLERY</div><h2>매장 둘러보기</h2>' + gallery + '</section>' : '') +

      (showAbout ? '<section class="pub-sec"><div class="pub-kicker">ABOUT</div><h2>매장 소개</h2>' +
        '<p class="body">' + nl2br(restIntro) + '</p></section>' : '') +

      menu + maps + media +

      '<footer class="pub-foot">' +
        '<div class="fb">' + esc(s.name) + '</div>' +
        (s.addr ? '<p>' + esc(s.addr) + '</p>' : '') +
        (s.phone ? '<p>' + esc(s.phone) + '</p>' : '') +
        '<p class="fine">제작 · 알프스 워크 AI 마케팅 (010-6398-9872)</p>' +
      '</footer>' +
    '</div>' + dock + '</div>';
  window.scrollTo(0, 0);
}

/* ---------- 시작 ---------- */
try {
  var params = new URLSearchParams(location.search);
  var shopId = params.get('shop');
  if (shopId) { initPublic(shopId); }
  else {
    var unlocked = false;
    try { unlocked = sessionStorage.getItem('aiMktUnlocked') === '1'; } catch (e) {}
    S.unlocked = unlocked;
    if (unlocked) startData(); else render();
  }
} catch (e) {
  document.getElementById('app').innerHTML = '<div class="pub-empty"><div><b>스크립트 오류</b><p>' + esc(e.message) + '</p></div></div>';
}

/* 전역 노출 (인라인 핸들러용) */
window.setView = setView;
window.openShop = openShop;
window.openEdit = openEdit;
window.openSection = openSection;
window.openNew = openNew;
window.openProposal = openProposal;
window.copyShopLink = copyShopLink;
window.quickStatus = quickStatus;
window.confirmDelete = confirmDelete;
window.doDelete = doDelete;
window.openSettings = openSettings;
window.changePin = changePin;
window.lockNow = lockNow;
window.createShop = createShop;
window.addSvc = addSvc;
window.toggleNewSvc = toggleNewSvc;
window.toggleSvcPick = toggleSvcPick;
window.toggleChk = toggleChk;
window.toggleDraft = toggleDraft;
window.addMenu = addMenu;
window.rmMenu = rmMenu;
window.delPhoto = delPhoto;
window.onPhotoFiles = onPhotoFiles;
window.onCardFile = onCardFile;
window.pickCard = pickCard;
window.clearCard = clearCard;
window.showCard = showCard;
window.openModal = openModal;
window.closeModal = closeModal;
window.pinKey = pinKey;
window.pinDel = pinDel;
window.pinClear = pinClear;
window.setFilter = setFilter;
window.onSearch = onSearch;
window.backToEdit = backToEdit;
window.savePhotos = savePhotos;
window.saveMenu = saveMenu;
window.saveInfo = saveInfo;
window.saveLinks = saveLinks;
window.saveNotes = saveNotes;
window.addNote = addNote;
window.rmNote = rmNote;

})();
