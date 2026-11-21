/* 영앤클래식 관리자(YC Manager) 서비스 워커
   - 설치 조건(매니페스트 + fetch 핸들러 있는 SW) 충족용
   - 화면(index.html)은 네트워크 우선 → 최신 통계 화면이 바로 반영되고, 끊겼을 때만 마지막 화면
   - 아이콘·매니페스트는 캐시 우선. Firebase RTDB 등 외부 요청은 그대로 통과시킨다(통계는 항상 실시간). */
var VERSION = 'yc-admin-v1.0.0';
var SHELL = [
  '/yc-admin/',
  '/yc-admin/index.html',
  '/yc-admin/manifest.webmanifest',
  '/yc-admin/yc-admin-icon-192.png',
  '/yc-admin/yc-admin-icon-512.png',
  '/yc-admin/yc-admin-apple-touch-icon.png',
  '/yc-admin/yc-admin-favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // 외부(Firebase RTDB 등)는 건드리지 않는다.
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/yc-admin/') !== 0) return;

  // 화면 이동: 네트워크 우선, 실패 시 캐시
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('/yc-admin/index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('/yc-admin/index.html').then(function (hit) {
          return hit || caches.match('/yc-admin/');
        });
      })
    );
    return;
  }

  // 정적 자산: 캐시 우선
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
