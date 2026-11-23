/* 투자 첫걸음 — 초보자용 학습·계산 도우미
   모든 계산은 브라우저 안에서만 이루어지고, 입력값은 이 브라우저(localStorage)에만 저장됩니다. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- 숫자 표기 ---------------- */
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function fmt(v) {
    var x = Math.round(n(v));
    return (x < 0 ? "-" : "") + Math.abs(x).toLocaleString("ko-KR");
  }
  function won(v) { return fmt(v) + "원"; }
  function pct(v, d) {
    d = d === undefined ? 1 : d;
    var x = n(v);
    var s = Math.abs(x).toFixed(d);
    if (d > 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return (x < 0 ? "-" : "") + s + "%";
  }
  /* 억·만원 단위로 읽기 쉽게 */
  function kwon(v) {
    var x = Math.round(n(v));
    var sign = x < 0 ? "-" : "";
    x = Math.abs(x);
    if (x >= 100000000) {
      var eok = Math.floor(x / 100000000);
      var man = Math.round((x % 100000000) / 10000);
      return sign + fmt(eok) + "억" + (man > 0 ? " " + fmt(man) + "만원" : "원");
    }
    if (x >= 10000) return sign + fmt(Math.round(x / 10000)) + "만원";
    return sign + fmt(x) + "원";
  }
  function short(v) { /* 결과 카드 안에서 길이를 줄인 표기 */
    var x = Math.round(n(v));
    return Math.abs(x) >= 100000000 ? kwon(x) : won(x);
  }

  /* ---------------- 상태 저장 ---------------- */
  var KEY = "invest-guide.state.v1";
  var DEFAULT = {
    tab: "start",
    diag: { monthly: 300000, emergency: "none", style: "balanced" },
    alloc: { amount: 1000000, stock: 45, coin: 5, realestate: 25, cash: 25 },
    sim: { initial: 1000000, monthly: 300000, rate: 5, years: 10 },
    avg: { qty: 10, price: 50000, addAmount: 300000, addPrice: 30000 },
    sell: { preset: "kr", qty: 10, price: 60000, buy: 50000, fee: 0.015, tax: 0.2, deduct: 0 },
    fund: { price: 400000000, loan: 240000000, acqRate: 1.1, broker: 0.4, etc: 5000000 },
    loan: { amt: 240000000, rate: 4.2, years: 30, type: "even" },
    jeonse: { price: 400000000, deposit: 280000000, senior: 60000000 },
    practice: { ptab: "stock", done: {} },
    chk: {}
  };
  var state = load();

  function load() {
    var s = JSON.parse(JSON.stringify(DEFAULT));
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        Object.keys(s).forEach(function (k) {
          if (saved[k] === undefined || saved[k] === null) return;
          if (typeof s[k] === "object" && !Array.isArray(s[k]) && k !== "chk") {
            Object.keys(s[k]).forEach(function (kk) {
              if (saved[k][kk] !== undefined) s[k][kk] = saved[k][kk];
            });
          } else if (k === "chk") {
            s.chk = saved.chk && typeof saved.chk === "object" ? saved.chk : {};
          } else {
            s[k] = saved[k];
          }
        });
      }
    } catch (e) { /* 저장값이 깨져 있으면 기본값 사용 */ }
    return s;
  }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
    }, 120);
  }

  /* ---------------- 탭 ---------------- */
  var TABS = ["start", "assets", "calc", "practice", "learn"];
  function showTab(name) {
    if (TABS.indexOf(name) < 0) name = "start";
    TABS.forEach(function (t) {
      var p = $("#panel-" + t);
      if (p) p.classList.toggle("on", t === name);
    });
    $$(".tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === name;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    state.tab = name;
    save();
  }
  $$(".tab").forEach(function (b) {
    b.addEventListener("click", function () {
      showTab(b.getAttribute("data-tab"));
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  });

  /* ---------------- 공통 입력 바인딩 ---------------- */
  function bind(obj, key, id, after, asInt) {
    var el = $("#" + id);
    if (!el) return;
    el.value = obj[key] === "" || obj[key] === null ? "" : obj[key];
    el.addEventListener("input", function () {
      var raw = el.value;
      obj[key] = raw === "" ? "" : (asInt ? Math.round(n(raw)) : n(raw));
      save();
      if (after) after();
    });
  }
  function bindSeg(container, obj, key, after) {
    var box = $("#" + container);
    if (!box) return;
    function paint() {
      $$("button", box).forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-v") === obj[key]);
        b.setAttribute("aria-pressed", b.getAttribute("data-v") === obj[key] ? "true" : "false");
      });
    }
    $$("button", box).forEach(function (b) {
      b.addEventListener("click", function () {
        obj[key] = b.getAttribute("data-v");
        paint(); save();
        if (after) after();
      });
    });
    paint();
  }
  function bindChips(container, onPick) {
    var box = $("#" + container);
    if (!box) return;
    $$("button", box).forEach(function (b) {
      b.addEventListener("click", function () {
        onPick(n(b.getAttribute("data-v")));
        $$("button", box).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
      });
    });
  }
  function row(k, v, cls, sub) {
    return '<div class="kv"><span class="k">' + k + (sub ? "<small>" + sub + "</small>" : "") +
      '</span><span class="v ' + (cls || "") + '">' + v + "</span></div>";
  }
  function bigOut(label, value, note, unit) {
    return '<div class="big-out"><div class="lbl">' + label + '</div><div class="val">' + value +
      (unit ? "<small>" + unit + "</small>" : "") + "</div>" +
      (note ? '<div class="note">' + note + "</div>" : "") + "</div>";
  }

  /* =========================================================
     1. 시작 진단
     ========================================================= */
  var STYLE_NAME = { safe: "안정", balanced: "균형", active: "적극" };
  var STYLE_MIX = {
    safe: { stock: 25, coin: 5, realestate: 20, cash: 50 },
    balanced: { stock: 45, coin: 5, realestate: 25, cash: 25 },
    active: { stock: 60, coin: 15, realestate: 15, cash: 10 }
  };

  function renderDiag() {
    var d = state.diag;
    var m = n(d.monthly);
    var mix = STYLE_MIX[d.style] || STYLE_MIX.balanced;
    var out = $("#diagResult");
    if (!out) return;

    var stage, stageTxt, html = "";

    if (d.emergency === "none") { stage = "1단계"; stageTxt = "비상금부터 만드는 단계"; }
    else if (d.emergency === "short") { stage = "1단계 마무리"; stageTxt = "비상금을 채우며 시작하는 단계"; }
    else if (m < 100000) { stage = "2단계"; stageTxt = "소액으로 습관을 만드는 단계"; }
    else { stage = "2단계"; stageTxt = "계획을 세워 분산 적립하는 단계"; }

    html += '<div class="stage-badge"><span class="dot"></span>지금은 ' + stage + " · " + stageTxt + "</div>";
    html += '<div class="hint">월 여유자금 <b>' + won(m) + "</b> · 성향 <b>" + STYLE_NAME[d.style] +
      "</b> · 비상금 " + (d.emergency === "none" ? "없음" : d.emergency === "short" ? "3개월 미만" : "3개월 이상") + "</div>";

    /* --- 1단계 --- */
    if (d.emergency === "none") {
      html += '<div class="step"><div class="bubble">1</div>' +
        '<div class="st-title">비상금 통장부터 따로 만든다</div>' +
        '<div class="st-body">투자보다 먼저입니다. 생활비 3개월치가 없으면, 급한 일이 생겼을 때 투자금을 손해 보고 팔아야 합니다. 그 한 번의 손실이 몇 년치 수익보다 큽니다. 파킹통장처럼 하루만 맡겨도 이자가 붙고 바로 꺼낼 수 있는 곳이 적당합니다.</div>' +
        '<div class="st-do"><b>이번 달에 할 일</b> · 여유자금 ' + won(m) + ' 전액을 비상금 통장으로 자동이체하고, 생활비 3개월치를 목표로 채우기<br>(목표 = 월 생활비 × 3~6배)</div></div>';
    } else if (d.emergency === "short") {
      html += '<div class="step"><div class="bubble">1</div>' +
        '<div class="st-title">비상금을 3개월치까지 채우면서 시작한다</div>' +
        '<div class="st-body">이미 비상금이 있다면 투자를 시작해도 됩니다. 다만 3개월치가 될 때까지는 속도를 늦추세요. 남은 비상금은 건드리지 않는 별도 통장에 두고, 투자금과 섞지 않습니다.</div>' +
        '<div class="st-do"><b>이번 달에 할 일</b> · 여유자금의 70%(약 ' + won(m * 0.7) + ')는 비상금으로, 30%(약 ' + won(m * 0.3) + ')만 학습용으로</div></div>';
    } else {
      html += '<div class="step"><div class="bubble">1</div>' +
        '<div class="st-title">비상금은 "절대 안 쓰는 돈"으로 확정한다</div>' +
        '<div class="st-body">비상금이 준비되어 있다면 기초는 갖춰졌습니다. 이제 중요한 것은 그 돈을 투자금으로 끌어다 쓰지 않는 것입니다. 비상금 계좌는 앱에서 숨기거나 이름을 "비상금"으로 바꿔 두면 실수로 쓰는 일이 줄어듭니다.</div>' +
        '<div class="st-do"><b>이번 달에 할 일</b> · 비상금 계좌 이름을 "비상금"으로 바꾸고, 투자금은 별도 계좌로 분리</div></div>';
    }

    /* --- 2단계 --- */
    var mixTxt = "주식 " + mix.stock + "% · 코인 " + mix.coin + "% · 부동산(리츠 포함) " + mix.realestate + "% · 예금·채권 " + mix.cash + "%";
    html += '<div class="step"><div class="bubble">2</div>' +
      '<div class="st-title">내 성향에 맞는 비중을 숫자로 정한다</div>' +
      '<div class="st-body">비중(%)을 정하는 것이 투자의 거의 전부입니다. 어떤 종목을 고를지보다, <b>얼마를 어디에 둘지</b>가 결과를 더 크게 좌우합니다. '
      + (d.style === "safe" ? "안정형은 원금이 크게 흔들리지 않는 쪽에 무게를 둡니다." : d.style === "active" ? "적극형은 변동을 감수하지만, 그만큼 '잃어도 되는 돈'으로만 채워야 합니다." : "균형형은 오르내림을 견디면서 장기 수익을 노리는 구성입니다.")
      + '</div>' +
      '<div class="st-do"><b>참고 예시 비중</b> · ' + mixTxt + '<br>월 ' + won(m) + " 기준이면 주식 쪽 약 " + won(m * mix.stock / 100) + ", 예금·채권 약 " + won(m * mix.cash / 100) + " (추천이 아닌 학습용 예시)</div></div>";

    /* --- 3단계 --- */
    html += '<div class="step"><div class="bubble">3</div>' +
      '<div class="st-title">한 달에 한 번, 30분 점검 루틴</div>' +
      '<div class="st-body">사고 나서 잊으면 계획이 아니라 감정이 됩니다. 매수할 때는 이유를 한 줄 적고, 한 달에 한 번 비중이 흐트러졌는지 확인하세요. 오르면 팔고 내리면 사는 것이 아니라, <b>원래 정한 비중으로 되돌리는 것</b>이 점검입니다.</div>' +
      '<div class="st-do"><b>이번 달에 할 일</b> · 매수 이유·목표·손실 한도를 메모에 적고, 4번 탭 체크리스트를 처음부터 훑어보기</div></div>';

    if (m > 0 && m < 100000) {
      html += '<div class="tip">월 ' + won(m) + "은 적은 돈이 아닙니다. 수수료와 최소 매수 금액을 확인하고, 매달 같은 날 자동으로 사는 방식(적립식)이 가장 꾸준합니다.</div>";
    } else if (m >= 500000) {
      html += '<div class="tip">월 ' + won(m) + "이면 세금 혜택이 있는 계좌(ISA·연금저축 등)를 먼저 확인하세요. 같은 수익이라도 계좌에 따라 세후 금액이 달라집니다. 가입 조건은 금융사 공식 안내를 확인하세요.</div>";
    }

    /* --- 주의점 --- */
    var warns = [];
    if (d.emergency === "none") warns.push("<b>비상금 없이 시작하는 것</b>이 가장 큰 위험입니다. 급할 때 손실을 확정하고 파는 일이 반복되면 원금이 줄어듭니다.");
    if (d.style === "active") warns.push("<b>적극 성향</b>일수록 '오를 것 같아서'가 아니라 '잃어도 생활이 무너지지 않는 돈'으로만 채우세요. 코인 비중은 0%여도 괜찮습니다.");
    warns.push("<b>빚투(대출·카드론으로 투자)는 하지 마세요.</b> 대출 이자는 확정이고 수익은 불확실합니다. 연 5% 이자를 내면서 5% 수익을 기대하는 것은 이익이 나도 남는 게 거의 없는 구조입니다.");
    warns.push("<b>3년 안에 쓸 돈</b>(전세보증금·수술비·학자금)은 주식·코인에 넣지 마세요. 그 돈은 예금·파킹통장에 두는 것이 맞습니다.");
    warns.push("<b>리딩방·텔레그램·유튜브의 종목 추천은 사기일 수 있습니다.</b> '수익 인증'은 조작되고, 입금을 요구하면 100% 사기로 봐도 됩니다.");
    warns.push("<b>한 곳에 몰아넣지 마세요.</b> 한 종목·한 코인에 투자금의 20% 이상을 넣으면, 그 하나가 반토막 나는 것만으로 계획이 무너집니다.");

    html += '<div class="alert" style="display:block"><div style="font-weight:800;margin-bottom:2px">지금 시점의 주의점</div><ul class="warn-list">' +
      warns.map(function (w) { return "<li>" + w + "</li>"; }).join("") + "</ul></div>";

    out.innerHTML = html;
  }

  bind(state.diag, "monthly", "diagMonthly", renderDiag, true);
  bindChips("diagMonthlyChips", function (v) {
    state.diag.monthly = v;
    $("#diagMonthly").value = v;
    save(); renderDiag();
  });
  bindSeg("diagEmergency", state.diag, "emergency", renderDiag);
  bindSeg("diagStyle", state.diag, "style", renderDiag);

  /* =========================================================
     2. 배분 슬라이더
     ========================================================= */
  var ALLOC_DEF = [
    { k: "stock", name: "주식", color: "#1E5A96" },
    { k: "coin", name: "코인", color: "#7C4DBE" },
    { k: "realestate", name: "부동산(리츠 포함)", color: "#2C8A4B" },
    { k: "cash", name: "예금·채권", color: "#B3862B" }
  ];
  var ALLOC_KEYS = ALLOC_DEF.map(function (x) { return x.k; });

  function buildAllocSliders() {
    var box = $("#allocSliders");
    box.innerHTML = ALLOC_DEF.map(function (d) {
      return '<div class="slider-row" data-k="' + d.k + '">' +
        '<div class="sr-head"><span>' + d.name + ' <span class="amt" data-amt="' + d.k + '"></span></span>' +
        '<span class="pct" data-pct="' + d.k + '">0%</span></div>' +
        '<input type="range" min="0" max="100" step="1" value="0" aria-label="' + d.name + ' 비중" data-slider="' + d.k + '">' +
        "</div>";
    }).join("");

    $$("[data-slider]", box).forEach(function (sl) {
      sl.addEventListener("input", function () {
        setAlloc(sl.getAttribute("data-slider"), n(sl.value));
      });
    });
  }

  function setAlloc(key, val) {
    var a = state.alloc;
    val = Math.max(0, Math.min(100, Math.round(val)));
    var others = ALLOC_KEYS.filter(function (k) { return k !== key; });
    var rest = 100 - val;
    var sumOthers = others.reduce(function (s, k) { return s + n(a[k]); }, 0);
    if (sumOthers <= 0) {
      var base = Math.floor(rest / others.length);
      others.forEach(function (k, i) { a[k] = base + (i < rest - base * others.length ? 1 : 0); });
    } else {
      var raw = others.map(function (k) { return n(a[k]) / sumOthers * rest; });
      var rounded = raw.map(function (x) { return Math.floor(x); });
      var diff = rest - rounded.reduce(function (s, x) { return s + x; }, 0);
      /* 소수점 남는 몫은 소수부가 큰 쪽부터 */
      var order = raw.map(function (x, i) { return { i: i, frac: x - Math.floor(x) }; })
        .sort(function (p, q) { return q.frac - p.frac; });
      for (var j = 0; j < diff; j++) rounded[order[j % order.length].i] += 1;
      others.forEach(function (k, i) { a[k] = rounded[i]; });
    }
    a[key] = val;
    save();
    renderAlloc();
  }

  function applyPreset(name) {
    var m = STYLE_MIX[name];
    if (!m) return;
    state.alloc.stock = m.stock;
    state.alloc.coin = m.coin;
    state.alloc.realestate = m.realestate;
    state.alloc.cash = m.cash;
    save();
    renderAlloc();
  }

  function renderAlloc() {
    var a = state.alloc;
    var amount = n(a.amount);
    ALLOC_KEYS.forEach(function (k) {
      var sl = $('[data-slider="' + k + '"]');
      var pv = $('[data-pct="' + k + '"]');
      var am = $('[data-amt="' + k + '"]');
      if (sl) sl.value = a[k];
      if (pv) pv.textContent = Math.round(n(a[k])) + "%";
      if (am) am.textContent = amount > 0 ? "· " + kwon(amount * n(a[k]) / 100) : "";
    });
    var total = ALLOC_KEYS.reduce(function (s, k) { return s + n(a[k]); }, 0);
    $("#allocTotal").textContent = Math.round(total) + "% · " + won(amount);
  }

  bind(state.alloc, "amount", "allocAmount", renderAlloc, true);
  $$("[data-preset]").forEach(function (b) {
    b.addEventListener("click", function () { applyPreset(b.getAttribute("data-preset")); });
  });

  /* =========================================================
     3. 복리·적립 시뮬레이터
     ========================================================= */
  function renderSim() {
    var s = state.sim;
    var initial = n(s.initial), monthly = n(s.monthly), rate = n(s.rate), years = Math.min(50, Math.max(1, Math.round(n(s.years)) || 1));
    var r = rate / 100 / 12;
    var bal = initial, balances = [], paid = initial;

    for (var y = 1; y <= years; y++) {
      for (var mth = 0; mth < 12; mth++) {
        bal = bal * (1 + r) + monthly;
        paid += monthly;
      }
      balances.push(bal);
    }
    var gain = bal - paid;
    var gainPct = paid > 0 ? gain / paid * 100 : 0;

    var html = bigOut("가정대로라면 " + years + "년 뒤",
      short(bal),
      "납입한 원금 " + won(paid) + " + 수익 " + won(gain));
    html += row("납입한 원금 합계", won(paid));
    html += row("수익금 (세전)", '<span class="' + (gain >= 0 ? "plus" : "minus") + '">' + (gain >= 0 ? "+" : "") + won(gain) + "</span>");
    html += row("원금 대비 증가율", '<span class="' + (gain >= 0 ? "plus" : "minus") + '">' + (gain >= 0 ? "+" : "") + pct(gainPct, 1) + "</span>");
    html += row("총 납입 횟수", (years * 12) + "회", "", "매달 " + won(monthly) + "씩");
    html += '<div class="chart">' + simChart(balances) + "</div>";
    html += '<div class="legend"><span><i style="background:#12876D"></i>매년 말 예상 잔액 (원금 + 수익)</span></div>';

    $("#simResult").innerHTML = html;
  }

  function simChart(balances) {
    var W = 300, H = 108, padL = 2, padR = 2, padT = 6, padB = 14;
    var max = Math.max.apply(null, balances.concat([1]));
    var count = balances.length;
    var bw = (W - padL - padR) / count;
    var barW = Math.max(2, Math.min(18, bw * 0.62));
    var bars = "";
    balances.forEach(function (v, i) {
      var h = Math.max(1, (v / max) * (H - padT - padB));
      var x = padL + i * bw + (bw - barW) / 2;
      var y = H - padB - h;
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
        '" height="' + h.toFixed(1) + '" rx="2" fill="url(#g1)"><title>' + (i + 1) + "년 " + won(v) + "</title></rect>";
    });
    var labels = "";
    var mark = [0, Math.floor((count - 1) / 2), count - 1].filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    mark.forEach(function (i) {
      var x = padL + i * bw + bw / 2;
      labels += '<text class="axis" x="' + x.toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle">' + (i + 1) + "년</text>";
    });
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="연도별 예상 잔액 막대 그래프">' +
      '<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#12876D"/><stop offset="1" stop-color="#8FD3C1"/></linearGradient></defs>' +
      '<line x1="0" y1="' + (H - padB) + '" x2="' + W + '" y2="' + (H - padB) + '" stroke="#E4E9EF" stroke-width="1"/>' +
      bars + labels + "</svg>";
  }

  bind(state.sim, "initial", "simInitial", renderSim, true);
  bind(state.sim, "monthly", "simMonthly", renderSim, true);
  bind(state.sim, "rate", "simRate", renderSim, false);
  bind(state.sim, "years", "simYears", renderSim, true);
  bindChips("simRateChips", function (v) { state.sim.rate = v; $("#simRate").value = v; save(); renderSim(); });
  bindChips("simYearChips", function (v) { state.sim.years = v; $("#simYears").value = v; save(); renderSim(); });

  /* =========================================================
     4. 물타기 계산기
     ========================================================= */
  function renderAvg() {
    var a = state.avg;
    var qty = n(a.qty), price = n(a.price), addAmt = n(a.addAmount), addPrice = n(a.addPrice);
    var out = $("#avgResult");

    if (qty <= 0 || price <= 0 || addAmt <= 0 || addPrice <= 0) {
      out.innerHTML = '<p class="hint mt12">보유 수량·평단가·추가 매수 금액·가격을 모두 입력하면 결과가 나옵니다.</p>';
      return;
    }
    var qtyAdd = addAmt / addPrice;
    var newQty = qty + qtyAdd;
    var cost = qty * price;
    var totalCost = cost + addAmt;
    var newAvg = totalCost / newQty;
    var diff = newAvg - price;
    var diffPct = price > 0 ? diff / price * 100 : 0;
    var needUp = newAvg > 0 ? (newAvg - addPrice) / addPrice * 100 : 0;
    var addShare = totalCost > 0 ? addAmt / totalCost * 100 : 0;

    var html = bigOut("새 평균 매입가", Math.round(newAvg).toLocaleString("ko-KR"), "지금 평단가 " + won(price) + " → 총 투자금 " + won(totalCost), "원");
    html += row("총 보유 수량", fmt(newQty) + "주·개", "", "추가 " + fmt(qtyAdd) + "주·개 매수");
    html += row("평단가 변화", '<span class="' + (diff < 0 ? "plus" : "minus") + '">' + (diff > 0 ? "+" : "") + fmt(diff) + "원 (" + (diff > 0 ? "+" : "") + pct(diffPct, 1) + ")</span>");
    html += row("총 투자금", won(totalCost), "", "원래 " + won(cost) + " + 추가 " + won(addAmt));
    html += row("추가 투입 비중", pct(addShare, 0), "", "내가 넣은 돈 중 새로 들어간 비율");
    html += row("본전까지 필요한 상승률", '<span class="' + (needUp > 0 ? "plus" : "minus") + '">' + (needUp > 0 ? "+" : "") + pct(needUp, 1) + "</span>", "", "추가 매수 가격 " + won(addPrice) + " 기준");

    var scenario = newQty * addPrice * 0.7 - totalCost;
    var scenarioPct = totalCost > 0 ? scenario / totalCost * 100 : 0;
    html += '<div class="divider"></div>';
    html += row("가격이 30% 더 떨어지면", '<span class="minus">' + won(scenario) + " (" + pct(scenarioPct, 1) + ")</span>", "", "추가 매수 가격에서 -30% 가정");

    var loseWarn = "";
    if (addShare >= 40) {
      loseWarn = '<div class="alert"><span class="ico">⚠️</span><div>이번 추가 매수로 내 돈의 <b>' + pct(addShare, 0) + "</b>가 한 종목에 더 들어갑니다. 평단가는 내려가지만 <b>잃을 수 있는 금액도 그만큼 커집니다.</b> '더 싸졌으니까'가 매수 이유라면, 그 종목이 왜 하락했는지 먼저 확인하세요.</div></div>";
    } else {
      loseWarn = '<div class="tip">물타기는 <b>평단가를 낮추는 것</b>이지 손실을 줄이는 것이 아닙니다. 하락 이유가 회사의 문제(실적 악화·상장폐지 위험)라면 물을 타지 말고 손절 기준을 확인하세요.</div>';
    }
    out.innerHTML = html + loseWarn;
  }

  bind(state.avg, "qty", "avgQty", renderAvg, false);
  bind(state.avg, "price", "avgPrice", renderAvg, false);
  bind(state.avg, "addAmount", "avgAddAmount", renderAvg, true);
  bind(state.avg, "addPrice", "avgAddPrice", renderAvg, false);

  /* =========================================================
     5. 매도 실수령액 계산기
     ========================================================= */
  var SELL_PRESETS = {
    kr: { fee: 0.015, tax: 0.20, base: "amount", deduct: 0, hint: "국내주식: 매도금액의 0.20% (2026년 거래세 기준)" },
    us: { fee: 0.25, tax: 22, base: "profit", deduct: 2500000, hint: "해외주식: 이익의 22%, 연 250만원 공제" },
    coin: { fee: 0.05, tax: 22, base: "profit", deduct: 2500000, hint: "코인: 2027년부터 이익의 22%, 연 250만원 공제(현행법)" },
    custom: { fee: 0.015, tax: 0, base: "amount", deduct: 0, hint: "직접 입력: 세율과 공제를 원하는 값으로" }
  };

  function applySellPreset(name) {
    var p = SELL_PRESETS[name] || SELL_PRESETS.custom;
    var s = state.sell;
    s.preset = name;
    s.fee = p.fee;
    s.tax = p.tax;
    s.deduct = p.deduct;
    $("#sellFee").value = p.fee;
    $("#sellTax").value = p.tax;
    $("#sellDeduct").value = p.deduct;
    $("#sellTaxHint").textContent = p.hint;
    $("#sellDeductWrap").style.display = p.base === "profit" ? "" : "none";
    save(); renderSell();
  }

  function renderSell() {
    var s = state.sell;
    var qty = n(s.qty), price = n(s.price), buy = n(s.buy);
    var feeRate = n(s.fee) / 100, taxRate = n(s.tax) / 100, deduct = n(s.deduct);
    var preset = SELL_PRESETS[s.preset] || SELL_PRESETS.custom;

    var gross = qty * price, cost = qty * buy;
    var buyFee = cost * feeRate, sellFee = gross * feeRate;
    var beforeTax = gross - cost - buyFee - sellFee;
    var taxable = preset.base === "amount" ? gross : Math.max(0, beforeTax - deduct);
    var tax = taxable * taxRate;
    var net = gross - sellFee - tax;
    var profit = net - cost - buyFee;
    var baseCost = cost + buyFee;
    var effRate = baseCost > 0 ? profit / baseCost * 100 : 0;

    var out = $("#sellResult");
    if (qty <= 0 || price <= 0) {
      out.innerHTML = '<p class="hint mt12">매도 수량과 가격을 입력하면 실수령액이 계산됩니다.</p>';
      return;
    }

    var html = bigOut("손에 들어오는 돈", short(net), "수수료·세금을 모두 뺀 금액", "");
    html += row("매도금액", won(gross), "", fmt(qty) + " × " + won(price));
    html += row("매수 원금", won(cost), "", fmt(qty) + " × " + won(buy));
    html += row("수수료 합계", "-" + won(buyFee + sellFee), "", "매수 " + won(buyFee) + " · 매도 " + won(sellFee));
    html += row("세금", tax > 0 ? '<span class="minus">-' + won(tax) + "</span>" : "0원", "",
      preset.base === "amount" ? "매도금액 기준" : "이익 " + won(Math.max(0, beforeTax)) + " 에서 " + won(deduct) + " 공제");
    html += '<div class="divider"></div>';
    html += row("실제로 남는 이익", '<span class="' + (profit >= 0 ? "plus" : "minus") + '">' + (profit >= 0 ? "+" : "") + won(profit) + "</span>", "", "수수료·세금 포함 계산");
    html += row("실효 수익률", '<span class="' + (profit >= 0 ? "plus" : "minus") + '">' + (profit >= 0 ? "+" : "") + pct(effRate, 2) + "</span>", "", "실제 투입금 " + won(baseCost) + " 대비");
    html += row("총 비용 부담", pct(baseCost > 0 ? (buyFee + sellFee + tax) / baseCost * 100 : 0, 2), "", "수수료+세금 ÷ 투입금");

    if (profit < 0 && tax > 0) {
      html += '<div class="alert"><span class="ico">⚠️</span><div>손실이 났는데도 세금이 계산되었습니다. 국내주식 거래세처럼 <b>이익과 상관없이 매도금액에 매기는 세금</b>이기 때문입니다.</div></div>';
    }
    out.innerHTML = html;
  }

  bindSeg("sellPreset", state.sell, "preset", function () { applySellPreset(state.sell.preset); });
  bind(state.sell, "qty", "sellQty", renderSell, false);
  bind(state.sell, "price", "sellPrice", renderSell, false);
  bind(state.sell, "buy", "sellBuy", renderSell, false);
  bind(state.sell, "fee", "sellFee", renderSell, false);
  bind(state.sell, "tax", "sellTax", renderSell, false);
  bind(state.sell, "deduct", "sellDeduct", renderSell, true);

  /* =========================================================
     6. 부동산 — 매매 자금
     ========================================================= */
  function autoAcqRate(price) {
    if (price <= 0) return 1.1;
    if (price <= 600000000) return 1.1;
    if (price <= 900000000) return 2.2;
    return 3.3;
  }

  function renderFund() {
    var f = state.fund;
    var price = n(f.price), loan = n(f.loan), acqRate = n(f.acqRate), brokerRate = n(f.broker), etc = n(f.etc);
    var acq = price * acqRate / 100;
    var broker = price * brokerRate / 100;
    var cash = price - loan + acq + broker + etc;
    var ltv = price > 0 ? loan / price * 100 : 0;

    var out = $("#hpFundResult");
    if (price <= 0) {
      out.innerHTML = '<p class="hint mt12">매매가를 입력하면 필요한 자기자금이 계산됩니다.</p>';
      return;
    }
    var html = bigOut("필요한 내 돈", short(cash), "집값 - 대출 + 취득세·중개보수·기타 비용", "");
    html += row("매매가", won(price));
    html += row("대출금", "-" + won(loan), "", "집값의 " + pct(ltv, 0) + " (LTV)");
    html += row("취득세 등", "+" + won(acq), "", "입력 세율 " + pct(acqRate, 1));
    html += row("중개보수", "+" + won(broker), "", "요율 " + pct(brokerRate, 2) + " (상한 안에서 협의)");
    html += row("이사·수리 등", "+" + won(etc));

    var tips = '<p class="hint mt12">취득세율은 <b>가격·주택 수·면적</b>에 따라 달라집니다(다주택은 더 높음). 정확한 금액은 위택스(wetax.go.kr)에서 모의계산해 보세요. 대출은 DSR 규제로 실제 한도가 계산보다 낮을 수 있습니다.</p>';
    if (ltv > 70) {
      tips += '<div class="alert"><span class="ico">⚠️</span><div>대출 비중이 <b>' + pct(ltv, 0) + "</b>입니다. 금리가 1%p 오르면 이자 부담이 크게 늘고, 집값이 내리면 내 지분이 먼저 사라집니다. 월 상환액을 아래에서 꼭 확인하세요.</div></div>";
    }
    out.innerHTML = html + tips;
  }

  ["price", "loan", "acqRate", "broker", "etc"].forEach(function (k) {
    var id = { price: "hpPrice", loan: "hpLoan", acqRate: "hpAcqRate", broker: "hpBroker", etc: "hpEtc" }[k];
    bind(state.fund, k, id, renderFund, k !== "acqRate" && k !== "broker" ? true : false);
  });
  $("#hpPrice").addEventListener("input", function () {
    var p = n(state.fund.price);
    if (p > 0) {
      state.fund.acqRate = autoAcqRate(p);
      $("#hpAcqRate").value = state.fund.acqRate;
    }
    renderFund();
  });

  /* =========================================================
     7. 부동산 — 대출 월 상환액
     ========================================================= */
  var LOAN_HINT = {
    even: "매달 같은 금액을 갚는 방식. 가장 흔하고 계획 세우기 쉽습니다.",
    principal: "매달 원금을 같은 금액씩 갚는 방식. 처음엔 많이 내고 갈수록 줄어 총 이자가 적습니다.",
    bullet: "이자만 내다가 만기에 원금을 한꺼번에 갚는 방식. 매달 부담은 적지만 만기에 큰돈이 필요합니다."
  };

  function renderLoan() {
    var l = state.loan;
    var P = n(l.amt), rate = n(l.rate), years = Math.max(1, Math.round(n(l.years)) || 1), type = l.type;
    var r = rate / 100 / 12, nMonths = years * 12;
    var out = $("#loanResult");
    if (P <= 0) {
      out.innerHTML = '<p class="hint mt12">대출 금액을 입력하면 월 상환액이 계산됩니다.</p>';
      return;
    }
    var first = 0, last = 0, totalInterest = 0, totalPay = 0, bigLabel = "매달 갚는 돈", bigVal = 0, bigNote = "";

    if (type === "even") {
      var pay = r === 0 ? P / nMonths : P * r * Math.pow(1 + r, nMonths) / (Math.pow(1 + r, nMonths) - 1);
      first = pay; last = pay; totalPay = pay * nMonths; totalInterest = totalPay - P;
      bigVal = pay; bigNote = "매달 같은 금액 · 총 " + won(totalPay);
    } else if (type === "principal") {
      var pp = P / nMonths;
      first = pp + P * r;
      last = pp + pp * r;
      totalInterest = P * r * (nMonths + 1) / 2;
      totalPay = P + totalInterest;
      bigVal = first; bigLabel = "첫 달 갚는 돈"; bigNote = "마지막 달 " + won(last) + " · 매달 조금씩 줄어듭니다";
    } else {
      first = P * r; last = P + P * r;
      totalInterest = P * r * nMonths;
      totalPay = P + totalInterest;
      bigVal = P * r; bigLabel = "매달 내는 이자"; bigNote = "만기에 원금 " + short(P) + "을 한꺼번에";
    }

    var html = bigOut(bigLabel, short(bigVal), bigNote, "");
    html += row("첫 달 납부액", won(first));
    if (type !== "even") html += row("마지막 달 납부액", won(last));
    if (type === "bullet") html += row("만기 일시 상환액", won(P + P * r));
    html += row("총 이자", '<span class="minus">' + won(totalInterest) + "</span>", "", "원금의 " + pct(P > 0 ? totalInterest / P * 100 : 0, 1));
    html += row("총 상환액", won(totalPay), "", won(P) + " + 이자");
    html += row("기간", years + "년 (" + nMonths + "회)", "", "연 " + pct(rate, 2) + " 고정 가정");
    html += '<p class="hint mt12">실제 대출은 <b>금리 변동(변동금리)·중도상환수수료·인지세</b> 등이 붙습니다. 은행 상환계산기와 차이가 있을 수 있으니 참고용으로만 쓰세요.</p>';
    out.innerHTML = html;

    var hint = $("#loanTypeHint");
    if (hint) hint.textContent = LOAN_HINT[type] || "";
  }

  bind(state.loan, "amt", "loanAmt", renderLoan, true);
  bind(state.loan, "rate", "loanRate", renderLoan, false);
  bind(state.loan, "years", "loanYears", renderLoan, true);
  bindSeg("loanType", state.loan, "type", renderLoan);

  /* =========================================================
     8. 부동산 — 전세가율
     ========================================================= */
  function renderJeonse() {
    var j = state.jeonse;
    var price = n(j.price), deposit = n(j.deposit), senior = n(j.senior);
    var out = $("#jsResult");
    if (price <= 0 || deposit <= 0) {
      out.innerHTML = '<p class="hint mt12">매매가와 전세보증금을 입력하면 전세가율이 계산됩니다.</p>';
      return;
    }
    var ratio = deposit / price * 100;
    var risk = (deposit + senior) / price * 100;
    var room = price - senior - deposit;

    var verdict, cls, advice;
    if (risk < 70) { verdict = "비교적 안전"; cls = "plus"; advice = "보증금과 집에 잡힌 빚을 합쳐도 집값의 70% 아래입니다. 다만 아래 네 가지 확인은 그대로 하세요."; }
    else if (risk < 80) { verdict = "주의"; cls = ""; advice = "집값의 70~80%가 이미 채워져 있습니다. 집값이 조금만 내려도 보증금을 돌려받기 어려워질 수 있는 구간입니다."; }
    else if (risk < 90) { verdict = "위험"; cls = "minus"; advice = "80%를 넘었습니다. '깡통전세' 위험이 있는 구간이니 이 조건이면 계약을 다시 생각해 보세요."; }
    else { verdict = "매우 위험"; cls = "minus"; advice = "90% 이상입니다. 집값이 조금만 떨어져도 보증금을 거의 돌려받지 못할 수 있습니다. 보증금 반환보증 가입이 안 되는 집은 계약하지 마세요."; }

    var html = bigOut("전세가율", pct(ratio, 1), "<b>" + verdict + "</b> · 보증금 " + kwon(deposit) + " ÷ 매매가 " + kwon(price));
    html += row("보증금 + 집에 잡힌 빚", kwon(deposit + senior), "", "집주인 대출(근저당) 포함");
    html += row("집값 대비 비율", '<span class="' + cls + '">' + pct(risk, 1) + "</span>", "", "이 비율이 80%를 넘으면 위험 구간");
    html += row("남는 담보 여력", '<span class="' + (room > 0 ? "plus" : "minus") + '">' + kwon(room) + "</span>", "", "집값 - 빚 - 내 보증금");
    html += row("담보가 부족해지는 집값", kwon(deposit + senior), "", "집값이 이 아래로 내려가면 위험");

    html += '<div class="alert"><span class="ico">⚠️</span><div><b>' + verdict + ':</b> ' + advice + "</div></div>";
    html += '<p class="hint mt12">전세가율은 <b>시세 기준</b>이라 실제 경매 낙찰가는 더 낮을 수 있습니다. 계약 전 ① 등기부등본 직접 발급 ② 집주인 신분증 대조 ③ 전입신고+확정일자 ④ 보증금 반환보증 가입 — 네 가지를 꼭 확인하세요.</p>';
    out.innerHTML = html;
  }

  bind(state.jeonse, "price", "jsPrice", renderJeonse, true);
  bind(state.jeonse, "deposit", "jsDeposit", renderJeonse, true);
  bind(state.jeonse, "senior", "jsSenior", renderJeonse, true);

  /* =========================================================
     9. 실전 따라하기 (주식·코인 첫 거래)
     ========================================================= */
  var PRACTICE = {
    stock: [
      {
        id: "stock1",
        t: "증권사 앱 고르고 계좌 만들기",
        b: "주식을 사려면 '증권 계좌'가 먼저 있어야 합니다. 은행 통장처럼 주식용 통장을 하나 만드는 것이고, 요즘은 은행에 가지 않고 폰으로 10분이면 끝납니다.",
        do: [
          "준비물 3가지: 신분증(주민등록증·운전면허증), 본인 명의 휴대폰, 본인 명의 은행 계좌",
          "증권사 앱 설치 → 첫 화면의 '비대면 계좌개설' 누르기",
          "휴대폰 본인인증 → 신분증 촬영 → 내 은행 계좌로 1원 받아 확인",
          "계좌가 만들어지면 앱에 '내 계좌번호'가 보입니다. 메모해 두세요"
        ],
        tip: "500만 원 미만 소액이면 수수료가 낮은 곳이 유리합니다. 다만 이벤트는 자주 바뀌니 가입 전에 앱 첫 화면에서 '국내주식 수수료'를 직접 확인하세요. 계좌는 1개면 충분합니다.",
        warn: "갓 만든 계좌는 '한도제한계좌'일 수 있습니다. 하루 이체 한도가 낮으니 큰돈을 넣기 전에 앱에서 한도를 확인하세요."
      },
      {
        id: "stock2",
        t: "내 은행에서 증권 계좌로 돈 보내기 (예수금)",
        b: "증권 계좌에 넣은 현금을 '예수금'이라고 합니다. 이 돈으로 주식을 삽니다. 처음에는 30만~50만 원만 넣어 보세요.",
        do: [
          "증권 앱 [입금] → 내 은행 선택 → 금액 입력 (또는 은행 앱에서 증권 계좌번호로 이체)",
          "넣은 금액이 '예수금'에 찍혔는지 확인",
          "주식을 사면 예수금이 줄고, 팔면 늘어납니다 (출금은 보통 2~3일 뒤)",
          "다음 날 앱을 다시 열어 예수금이 그대로 있는지 한 번 더 확인"
        ],
        tip: "500만 원을 한 번에 넣지 마세요. 5번에 나눠 넣으면 실수했을 때 되돌릴 여유가 생깁니다.",
        warn: "주말·공휴일 저녁에 넣은 돈은 다음 영업일에 들어갈 수 있습니다. 급할 때를 대비해 미리 넣어 두세요."
      },
      {
        id: "stock3",
        t: "원하는 주식·ETF 검색하기",
        b: "이 앱은 종목을 추천하지 않습니다. 대신 '어떻게 찾고, 화면에서 무엇을 보는지'만 알려 드립니다.",
        do: [
          "앱 위쪽 검색창에 회사 이름을 칩니다 (예: 삼성전자). 종목코드(005930)로도 찾힙니다",
          "ETF는 이름 앞에 만든 회사 이름이 붙습니다 (예: KODEX 200 = 코스피200 지수를 따라가는 ETF). 한 회사가 아니라 여러 회사에 나눠 담는 상품입니다",
          "종목 화면에서 3가지만 봅니다: ① 지금 가격 ② 오늘 거래량 ③ 시가총액(회사 몸값)",
          "이름이 낯선 '테마주', 하루에 20~30% 오른 종목은 초보에게 위험합니다"
        ],
        tip: "공식 확인은 '체크·용어' 탭의 DART 전자공시(회사 실적·공시)와 한국거래소(관리종목·거래정지) 링크에서 할 수 있습니다.",
        warn: "유튜브·텔레그램에서 '이거 사라'는 말은 추천이 아니라 광고이거나 사기일 수 있습니다."
      },
      {
        id: "stock4",
        t: "주문 넣기 — 시장가 vs 지정가",
        b: "주문 방식은 딱 두 가지입니다. 이 둘만 알면 첫 주문은 할 수 있습니다. 500만 원이면 한 번에 20만~30만 원어치만 사세요.",
        do: [
          "<b>지정가</b> = '내가 이 가격에 살게요' 하고 미리 적는 것. 마트에서 '이 가격이면 사겠다' 하고 기다리는 셈이고, 그 가격이 안 나오면 안 사집니다",
          "<b>시장가</b> = '지금 있는 가격에 바로 살게요'. 빨리 사지지만 내가 생각한 것보다 비싸게 사질 수 있습니다",
          "처음엔 지정가로, 현재 가격보다 1~2% 높게 적으면 대부분 바로 사집니다",
          "주문 버튼을 누르기 전에 '매수'인지 '매도'인지, 수량과 가격을 소리 내어 한 번 읽으세요"
        ],
        tip: "1주 가격이 비싼 종목은 '소수점 매수'가 되는지 앱에서 확인하세요. 되면 1만 원어치도 살 수 있습니다.",
        warn: "급등할 때 '시장가'로 따라 사는 것이 가장 흔한 초보 실수입니다. 그날 바로 떨어져 손실이 나기 쉽습니다."
      },
      {
        id: "stock5",
        t: "체결 확인 & 꼭 피할 실수",
        b: "주문이 실제로 성사된 것을 '체결'이라고 합니다. 체결되면 앱의 '보유 종목(잔고)'에 나타납니다.",
        do: [
          "[주문/미체결] 화면에서 내 주문 상태 확인. '미체결'이면 아직 안 산 것이니 취소하거나 가격을 고칩니다",
          "체결되면 수량과 평균 매입가(평단가)를 확인하고 메모합니다",
          "미수(외상)·신용융자는 신청하지 않습니다. 계좌는 '증거금 100%(현금만)' 상태로 두세요",
          "한 번에 다 사지 않기: 첫 매수는 계획한 금액의 20~30%만",
          "3년 안에 쓸 돈(전세보증금·수술비·학자금)은 넣지 않습니다"
        ],
        tip: "산 이유와 '언제 팔지'를 메모에 한 줄씩 적어 두세요. 나중에 흔들릴 때 기준이 됩니다.",
        warn: "미수·신용은 빌린 돈으로 사는 것입니다. 이자는 확정, 수익은 불확실 — 초보가 원금을 잃는 가장 빠른 길입니다."
      }
    ],
    coin: [
      {
        id: "coin1",
        t: "원화 거래소 가입 & 고객확인(신분증)",
        b: "코인은 '거래소'에서 삽니다. 원화로 사고팔 수 있는 곳(원화마켓)은 금융정보분석원(FIU)에 신고된 거래소만 이용하세요. 대표적으로 업비트·빗썸·코인원이 있습니다.",
        do: [
          "준비물: 신분증, 본인 명의 휴대폰, 본인 명의 은행 계좌",
          "거래소 앱 설치 → 휴대폰 본인인증 → 신분증 촬영 → 얼굴 인식",
          "'고객확인(KYC)'까지 마쳐야 입금과 거래가 됩니다",
          "해외 거래소는 원화 입출금·세금 신고·분쟁 대응이 어려워 초보에게 맞지 않습니다"
        ],
        tip: "FIU 신고 업체인지는 '체크·용어' 탭의 금융정보분석원(FIU) 링크에서 확인할 수 있습니다.",
        warn: "신분증·계좌·휴대폰 명의가 모두 같아야 합니다. 가족·지인 명의로는 가입도 거래도 안 됩니다."
      },
      {
        id: "coin2",
        t: "제휴 은행 계좌 연결 & 원화 입금",
        b: "거래소마다 돈을 넣고 뺄 수 있는 은행이 딱 하나로 정해져 있습니다. 이 계좌를 '실명확인 입출금계좌'라고 합니다.",
        do: [
          "현재 짝 (2026년 11월 기준): 업비트 → <b>케이뱅크</b> · 빗썸 → <b>KB국민은행</b> · 코인원 → <b>카카오뱅크</b>",
          "그 은행 계좌가 없으면 은행 앱에서 비대면으로 먼저 만듭니다",
          "거래소 앱 [입출금] → [원화 입금] → 계좌 연결 → 계좌번호 입력 → 1원 인증",
          "다른 은행에 있는 돈은 먼저 제휴 은행 계좌로 옮긴 뒤 거래소로 넣습니다",
          "처음엔 30만~50만 원만 넣어 보세요"
        ],
        tip: "은행은 재계약에 따라 바뀔 수 있습니다. 입금 전에 거래소 공지에서 '원화 입금 은행'을 한 번 더 확인하세요.",
        warn: "새로 연결한 계좌는 '한도계정'이라 1일 입금 500만 원으로 막혀 있을 수 있습니다. 한도는 거래 기간이 쌓이면 올라갑니다."
      },
      {
        id: "coin3",
        t: "코인 고르기 & 차트·호가창 보기",
        b: "이 앱은 어떤 코인을 사라고 말하지 않습니다. 화면에서 무엇을 봐야 하는지만 알려 드립니다.",
        do: [
          "'KRW' 표시가 있는 원화마켓 코인만 원화로 살 수 있습니다",
          "코인 화면에서 3가지: ① 현재가 ② 24시간 변동률 ③ 거래대금(얼마나 활발히 거래되는지)",
          "차트는 빨강·초록 막대(캔들)입니다. 초보는 '1시간'·'1일'만 봐도 충분합니다",
          "<b>호가창</b>: 위쪽은 팔겠다는 사람의 가격, 아래쪽은 사겠다는 사람의 가격입니다. 옆에 쌓인 숫자가 대기 중인 수량입니다",
          "시가총액이 아주 작은 '잡코인', 이름만 유행어인 코인은 상장폐지(거래지원 종료) 위험이 큽니다"
        ],
        tip: "거래대금이 너무 적은 코인은 사고 싶을 때 팔리지 않을 수 있습니다. 사는 것보다 파는 것이 어렵습니다.",
        warn: "거래소 공지의 '거래지원 종료(상장폐지)'를 꼭 확인하세요. 공지가 뜨면 그 코인은 팔 사람을 찾기 어려워집니다."
      },
      {
        id: "coin4",
        t: "소액 주문 넣기 (24시간 · 상하한가 없음)",
        b: "코인은 주식보다 훨씬 크게 흔들립니다. 그래서 '무엇을'보다 '얼마만'이 더 중요합니다.",
        do: [
          "<b>지정가</b> = 내가 정한 가격에만 사고팔기. <b>시장가</b> = 지금 바로 사고팔기",
          "처음엔 5만~10만 원 단위로, 시장가보다는 지정가로",
          "코인은 24시간·주말에도 거래됩니다. 주식과 달리 가격 제한폭(상하한가)이 없어 하루에 -30%도 가능합니다",
          "수수료는 거래소·등급마다 다릅니다(보통 0.05% 안팎). 주문 전에 앱에서 확인하세요",
          "'레버리지·선물·마진' 메뉴는 열지 마세요"
        ],
        tip: "시장가로 살 때는 '금액'으로 주문하면 편합니다. 5만 원어치를 넣으면 그만큼만 사집니다.",
        warn: "레버리지·선물은 빌린 돈으로 몇 배를 거래하는 것입니다. 초보가 하루 만에 원금을 잃는 가장 빠른 길입니다."
      },
      {
        id: "coin5",
        t: "보안(2차 인증) & 입출금·사기 주의",
        b: "코인은 은행 예금처럼 예금자보호가 되지 않습니다. 내가 직접 지켜야 합니다.",
        do: [
          "2차 인증(OTP) 켜기: 앱 [보안] 또는 [내 정보] → OTP·2단계 인증 등록",
          "비밀번호는 다른 사이트와 다르게, 출금 주소는 '허용 주소(화이트리스트)'로 묶어 두기",
          "큰 금액은 거래소에 오래 두지 말고 나눠 보관하기",
          "리딩방·텔레그램·유튜브의 '원금 보장 + 고수익'은 100% 사기입니다",
          "모르는 링크·앱 설치 요구·'대신 투자해 줄게'·선입금 요구는 모두 거절하세요"
        ],
        tip: "거래소 고객센터는 앱 안의 공식 메뉴로만 들어가세요. 검색해서 나온 전화번호로 전화하면 사기인 경우가 많습니다.",
        warn: "이미 돈을 보냈다면 바로 경찰 112, 금융감독원 1332에 신고하세요. 시간이 지나면 환급이 거의 불가능합니다."
      }
    ]
  };

  function renderPractice(kind) {
    var list = PRACTICE[kind];
    if (!list) return;
    var box = $("#pSteps-" + kind);
    if (!box) return;
    box.innerHTML = list.map(function (s, i) {
      var on = !!(state.practice.done && state.practice.done[s.id]);
      return '<div class="pstep' + (on ? " done" : "") + '" data-step="' + s.id + '">' +
        '<div class="phead"><div class="pnum">' + (i + 1) + '</div><h3>' + s.t + "</h3></div>" +
        '<div class="pbody-txt">' + s.b + "</div>" +
        '<ul class="pdo">' + s.do.map(function (d) { return "<li>" + d + "</li>"; }).join("") + "</ul>" +
        (s.tip ? '<div class="ptip">💡 ' + s.tip + "</div>" : "") +
        (s.warn ? '<div class="pwarn">⚠️ ' + s.warn + "</div>" : "") +
        '<label class="pcheck"><input type="checkbox" data-pchk="' + s.id + '"' + (on ? " checked" : "") + '><span>이 단계 다 했어요</span></label>' +
        "</div>";
    }).join("");

    $$("[data-pchk]", box).forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-pchk");
        if (cb.checked) state.practice.done[id] = true; else delete state.practice.done[id];
        var card = cb.closest(".pstep");
        if (card) card.classList.toggle("done", cb.checked);
        save();
        updatePracticeProgress();
      });
    });
    updatePracticeProgress();
  }

  function updatePracticeProgress() {
    ["stock", "coin"].forEach(function (kind) {
      var list = PRACTICE[kind] || [];
      var done = list.filter(function (s) { return state.practice.done && state.practice.done[s.id]; }).length;
      var pv = $("#pPv-" + kind), bar = $("#pBar-" + kind);
      if (pv) pv.textContent = done + " / " + list.length;
      if (bar) bar.style.width = (list.length ? done / list.length * 100 : 0) + "%";
    });
  }

  function showPractice(kind) {
    if (!PRACTICE[kind] && kind !== "terms") kind = "stock";
    $$(".ptab").forEach(function (b) {
      var on = b.getAttribute("data-ptab") === kind;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".pbody").forEach(function (p) {
      var on = p.getAttribute("data-pbody") === kind;
      if (on) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
    });
    state.practice.ptab = kind;
    save();
  }

  $$(".ptab").forEach(function (b) {
    b.addEventListener("click", function () { showPractice(b.getAttribute("data-ptab")); });
  });

  /* =========================================================
     10. 체크리스트
     ========================================================= */
  var CHECK = [
    {
      group: "시작 전 · 기본", items: [
        { id: "c1", t: "비상금 3~6개월치를 투자금과 분리했다", w: "생활비 계좌와 투자 계좌를 따로 두면 급할 때 손실 확정 매도를 피할 수 있습니다." },
        { id: "c2", t: "신용대출·카드론·마이너스통장 빚으로 투자하지 않는다", w: "이자는 확정, 수익은 불확실. 이자보다 높은 수익을 계속 내는 것은 거의 불가능합니다." },
        { id: "c3", t: "3년 안에 쓸 돈은 넣지 않았다", w: "전세보증금·수술비·학자금은 예금·파킹통장에 두는 것이 맞습니다." },
        { id: "c4", t: "잃어도 생활이 무너지지 않는 금액만 넣었다", w: "'전 재산'이 아니라 '없어져도 되는 돈'으로 시작합니다." },
        { id: "c5", t: "계좌 비밀번호·OTP를 나만 알고 있다", w: "가족·지인에게도 알려주지 마세요. 명의 도용 사고의 시작입니다." }
      ]
    },
    {
      group: "주식 · 코인 매수 전", items: [
        { id: "s1", t: "이 회사(코인)가 무엇으로 돈을 버는지 한 문장으로 말할 수 있다", w: "설명이 안 되면 사지 않는 것이 맞습니다." },
        { id: "s2", t: "매수 이유와 목표가·손실 한도를 적어 두었다", w: "'언제 팔지'를 정하지 않으면 손실을 오래 들고 가게 됩니다." },
        { id: "s3", t: "리딩방·텔레그램·유튜브 종목 추천은 무시한다", w: "'수익 인증'은 조작될 수 있고, 입금 요구는 사기입니다." },
        { id: "s4", t: "수수료·세금·환전 비용을 확인했다", w: "해외주식은 환전 스프레드까지 붙습니다." },
        { id: "s5", t: "상장폐지·거래정지 위험을 확인했다", w: "관리종목·투자경고종목, 코인은 거래지원 종료 공지까지 확인하세요." },
        { id: "s6", t: "한 종목·한 코인에 투자금의 20% 이상 넣지 않았다", w: "몰빵은 한 번의 실수로 계획 전체를 무너뜨립니다." },
        { id: "s7", t: "코인 거래소가 FIU에 신고된 곳이다", w: "미신고 업체는 출금이 막히거나 사라질 수 있습니다." },
        { id: "s8", t: "레버리지·선물·마진 거래는 하지 않는다", w: "초보 단계에서 가장 빨리 원금을 잃는 방법입니다." }
      ]
    },
    {
      group: "부동산 계약 전", items: [
        { id: "h1", t: "등기부등본을 직접 발급해 근저당·가압류를 확인했다", w: "중개사가 보여주는 화면이 아니라 내가 직접 발급한 최신본을 보세요." },
        { id: "h2", t: "등기부상 소유자와 계약 상대의 신분증이 일치한다", w: "대리인이라면 위임장·인감증명서가 필요합니다." },
        { id: "h3", t: "보증금 + 선순위 채무가 매매가의 80%를 넘지 않는다", w: "이 비율이 높으면 경매 시 보증금을 못 받습니다." },
        { id: "h4", t: "전세보증금 반환보증 가입 조건을 확인했다", w: "HUG·HF에서 가입 가능 여부를 먼저 확인하면 큰 위험을 줄일 수 있습니다." },
        { id: "h5", t: "계약서에 특약(잔금일·반환일·수리)을 적고 확정일자를 받았다", w: "구두 약속은 증명이 안 됩니다." },
        { id: "h6", t: "잔금일에 전입신고 + 확정일자를 같은 날 처리한다", w: "대항력과 우선변제권은 이 두 가지에서 나옵니다." },
        { id: "h7", t: "중개사 등록번호와 중개보수 요율을 확인했다", w: "법정 상한을 넘는 요구는 신고 대상입니다." }
      ]
    },
    {
      group: "세금 · 기록", items: [
        { id: "t1", t: "내게 맞는 절세 계좌(ISA·연금저축 등)를 확인했다", w: "같은 수익이라도 계좌에 따라 세후 금액이 달라집니다." },
        { id: "t2", t: "해외주식·코인은 연 250만 원 공제와 다음 해 5월 신고를 기억한다", w: "코인 과세는 2027년 1월 시행 예정(현행법)입니다." },
        { id: "t3", t: "금융소득(이자+배당) 2,000만 원 초과 시 종합과세 대상임을 안다", w: "예금 이자와 배당이 많으면 세율이 달라집니다." }
      ]
    }
  ];
  var ALL_CHK = [];
  CHECK.forEach(function (g) { g.items.forEach(function (it) { ALL_CHK.push(it.id); }); });

  function renderChecklist() {
    var box = $("#chkList");
    var html = "";
    CHECK.forEach(function (g) {
      var done = g.items.filter(function (it) { return state.chk[it.id]; }).length;
      html += '<div class="chk-group"><h4>' + g.group + ' <span class="cnt">' + done + "/" + g.items.length + "</span></h4>";
      g.items.forEach(function (it) {
        var on = !!state.chk[it.id];
        html += '<label class="chk"><input type="checkbox" data-chk="' + it.id + '"' + (on ? " checked" : "") + ">" +
          '<span class="txt">' + it.t + '<span class="why">' + it.w + "</span></span></label>";
      });
      html += "</div>";
    });
    box.innerHTML = html;
    $$("[data-chk]", box).forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-chk");
        if (cb.checked) state.chk[id] = true; else delete state.chk[id];
        save(); updateChkProgress();
        var group = cb.closest(".chk-group");
        if (group) {
          var g = CHECK.filter(function (x) { return x.items.some(function (i) { return i.id === id; }); })[0];
          if (g) {
            var done = g.items.filter(function (it) { return state.chk[it.id]; }).length;
            var cnt = group.querySelector(".cnt");
            if (cnt) cnt.textContent = done + "/" + g.items.length;
          }
        }
      });
    });
    updateChkProgress();
  }

  function updateChkProgress() {
    var done = ALL_CHK.filter(function (id) { return state.chk[id]; }).length;
    var total = ALL_CHK.length;
    $("#chkPv").textContent = done + " / " + total;
    $("#chkBar").style.width = (total ? done / total * 100 : 0) + "%";
  }

  $("#chkReset").addEventListener("click", function () {
    state.chk = {};
    save();
    renderChecklist();
  });

  /* =========================================================
     11. 용어사전
     ========================================================= */
  var GLOSSARY = [
    { t: "주식", tag: "주식", e: "회사의 지분을 조금 사는 것. 회사가 잘되면 가치가 오르고, 망하면 0원이 될 수 있습니다.", x: "빵집 지분 1%를 사면 빵집 이익의 1%를 나눠 받는 셈입니다." },
    { t: "배당", tag: "주식", e: "회사가 번 이익의 일부를 주주에게 나눠주는 돈.", x: "1주당 500원 배당이면 100주를 가진 사람은 5만 원을 받습니다." },
    { t: "시가총액", tag: "주식", e: "주가 × 발행 주식 수. 시장이 매기는 회사의 몸값입니다.", x: "주가 1만 원 × 1억 주 = 시가총액 1조 원." },
    { t: "PER (주가수익비율)", tag: "주식", e: "주가가 '회사가 버는 이익'의 몇 배인지 보여주는 숫자. 낮다고 무조건 싼 것은 아닙니다.", x: "주가 1만 원, 1주당 이익 1,000원이면 PER 10배. 성장 기대가 큰 회사는 PER이 높게 나옵니다." },
    { t: "PBR (주가순자산비율)", tag: "주식", e: "주가가 회사의 순자산(장부가치)의 몇 배인지. 1배 아래면 장부가치보다 싸게 거래된다는 뜻입니다.", x: "PBR 0.8배 = 회사 재산보다 주가가 20% 낮음." },
    { t: "ROE (자기자본이익률)", tag: "주식", e: "회사가 자기 돈으로 얼마나 효율적으로 이익을 내는지 나타내는 비율.", x: "ROE 15% = 100원으로 15원을 벌었다는 뜻." },
    { t: "ETF", tag: "주식", e: "여러 종목을 한 바구니에 담아 주식처럼 사고팔 수 있게 만든 상품. 한 번에 분산투자 효과가 있습니다.", x: "코스피200 ETF 1주를 사면 200개 기업에 조금씩 투자한 셈입니다." },
    { t: "지수 (인덱스)", tag: "주식", e: "시장 전체의 평균 성적표. 코스피, 코스닥, S&P500 등이 있습니다.", x: "코스피가 2,500에서 2,600이 되면 시장 전체가 약 4% 올랐다는 뜻." },
    { t: "코스피 · 코스닥", tag: "주식", e: "코스피는 대기업 위주의 유가증권시장, 코스닥은 중소·벤처기업 위주 시장입니다.", x: "코스닥 종목은 코스피보다 가격 변동이 큰 편입니다." },
    { t: "공모주 (IPO)", tag: "주식", e: "회사가 상장 전에 일반인에게 처음 주식을 파는 것. 상장 첫날 급등과 급락이 모두 가능합니다.", x: "공모가 1만 원으로 받아 상장 첫날 2만 원이 되기도, 7,000원이 되기도 합니다." },
    { t: "액면분할", tag: "주식", e: "1주를 여러 주로 쪼개는 것. 주가는 낮아지지만 전체 가치는 그대로입니다.", x: "'1주 100만 원'을 10대 1로 쪼개면 1주 10만 원이 되고, 10주를 가진 셈입니다." },
    { t: "유상증자", tag: "주식", e: "회사가 새 주식을 찍어 돈을 받는 것. 기존 주주의 지분이 희석될 수 있습니다.", x: "빚이 많은 회사가 유상증자를 하면 주가가 흔들리는 이유입니다." },
    { t: "관리종목", tag: "주식", e: "거래소가 '위험하다'고 지정한 종목. 거래 정지나 상장폐지로 이어질 수 있습니다.", x: "사기 전에 한국거래소에서 관리종목·투자경고 지정 여부를 확인하세요." },
    { t: "상장폐지", tag: "주식", e: "거래소에서 빼는 것. 주식·코인 모두 가치가 급락하고 팔 사람을 찾기 어려워집니다.", x: "코인은 '거래지원 종료' 공지가 나면 사실상 상장폐지입니다." },
    { t: "공매도", tag: "주식", e: "빌린 주식을 먼저 팔고 나중에 싸게 되사서 갚는 거래. 주가가 내려야 이득입니다.", x: "공매도 잔고가 많다는 뉴스는 '하락에 베팅한 돈이 많다'는 뜻입니다." },
    { t: "배당락", tag: "주식", e: "배당을 받을 권리가 사라지는 날, 주가가 배당금만큼 떨어지는 것.", x: "배당 1,000원을 받으면 그만큼 주가가 내려가므로 총 가치는 비슷합니다." },
    { t: "평단가", tag: "주식", e: "내가 산 주식의 평균 매입 가격. 물타기·불타기 계산의 기준입니다.", x: "1만 원에 10주, 8,000원에 10주를 사면 평단가는 9,000원." },
    { t: "물타기", tag: "주식", e: "가격이 떨어졌을 때 더 사서 평단가를 낮추는 것. 평단가는 내려가지만 손실 금액은 커집니다.", x: "평단 5만 원 10주에 3만 원어치를 더 사면 평단은 4만 원으로 내려갑니다." },
    { t: "불타기", tag: "주식", e: "가격이 오를 때 더 사서 보유량을 늘리는 것. 평단가가 높아집니다.", x: "오르는 종목에 추격 매수하면 평단가가 올라 하락 시 손실이 커집니다." },
    { t: "분할매수", tag: "주식", e: "한 번에 다 사지 않고 여러 번에 나눠 사는 것. 타이밍 실수 위험을 줄입니다.", x: "100만 원을 5번에 20만 원씩 나눠 사면 평균 단가가 완만해집니다." },
    { t: "적립식 투자", tag: "주식", e: "매달 같은 날 같은 금액을 사는 방식. 가격이 높을 때는 적게, 낮을 때는 많이 사게 됩니다.", x: "자동이체를 걸어 두면 감정이 개입할 여지가 줄어듭니다." },
    { t: "손절", tag: "주식", e: "더 큰 손실을 막으려고 손실을 확정하고 파는 것. 기준을 미리 정하는 것이 핵심입니다.", x: "'-10%면 판다'를 매수 전에 정해 두면 판단이 흔들리지 않습니다." },
    { t: "리밸런싱", tag: "주식", e: "오르고 내린 자산 비중을 원래 계획대로 되돌리는 것.", x: "주식이 올라 비중이 60%가 됐다면 일부 팔아 50%로 돌립니다." },
    { t: "변동성", tag: "주식", e: "가격이 오르내리는 폭. 클수록 하루 수익률이 크게 흔들립니다.", x: "하루 ±1% 움직이는 지수와 ±10% 움직이는 코인은 변동성이 다릅니다." },
    { t: "분산투자", tag: "주식", e: "여러 자산·종목에 나눠 담는 것. 하나가 망해도 전체가 무너지지 않게 합니다.", x: "같은 업종 5개보다 다른 업종·현금을 섞는 것이 분산입니다." },
    { t: "복리", tag: "세금·제도", e: "이자에 이자가 붙는 것. 기간이 길수록 차이가 크게 벌어집니다.", x: "연 5%로 30년이면 원금의 약 4.3배가 됩니다(세전)." },
    { t: "인플레이션", tag: "세금·제도", e: "물가가 오르는 것. 현금을 그냥 두면 살 수 있는 것이 줄어듭니다.", x: "연 3% 물가 상승이면 10년 뒤 100만 원은 지금의 약 74만 원 가치." },
    { t: "기준금리", tag: "세금·제도", e: "중앙은행(한국은행)이 정하는 정책금리. 예금·대출 금리의 기준이 되고, 오르면 주식·부동산에 부담이 됩니다.", x: "금리가 오르면 대출 이자가 늘고, 빚으로 산 자산 가격은 내려가는 경향이 있습니다." },
    { t: "채권", tag: "세금·제도", e: "돈을 빌려주고 이자를 받는 증서. 금리가 오르면 이미 발행된 채권 가격은 내려갑니다.", x: "국채·회사채가 있고, ETF로도 살 수 있습니다." },
    { t: "리츠 (REITs)", tag: "부동산", e: "부동산을 사서 임대수익을 나눠주는 상장 상품. 소액으로 부동산에 간접 투자합니다.", x: "오피스·물류센터 리츠를 사면 건물 임대료 일부를 배당으로 받습니다." },
    { t: "레버리지", tag: "세금·제도", e: "빌린 돈이나 파생상품으로 수익과 손실을 몇 배로 키우는 것.", x: "2배 레버리지는 지수가 10% 내리면 약 20% 손실이 납니다." },
    { t: "수익률", tag: "세금·제도", e: "번 돈의 비율. (평가금액 - 원금) ÷ 원금으로 계산합니다.", x: "100만 원이 110만 원이 되면 수익률 +10%." },
    { t: "예금자보호", tag: "세금·제도", e: "금융회사가 망해도 1인당 1억 원까지 돌려받는 제도(2025년 9월부터). 금융회사별로 각각 적용됩니다.", x: "A은행 9천만 원, B은행 8천만 원이면 각각 전액 보호됩니다. 펀드·CMA는 보호 대상이 아닙니다." },
    { t: "파킹통장", tag: "세금·제도", e: "하루만 맡겨도 이자가 붙고 언제든 꺼낼 수 있는 통장. 비상금 보관에 적합합니다.", x: "비상금 300만 원을 파킹통장에 두면 급할 때 바로 쓸 수 있습니다." },
    { t: "CMA", tag: "세금·제도", e: "증권사에서 하루만 맡겨도 이자를 주는 계좌. 예금자보호 대상이 아닙니다.", x: "RP형·MMF형 등이 있고, 수익률은 수시로 바뀝니다." },
    { t: "ISA", tag: "세금·제도", e: "한 계좌에 예금·펀드·주식을 담고 세금 혜택을 받는 계좌. 연 납입한도(2,000만 원)와 총 한도가 있습니다.", x: "순이익 일정 금액까지 비과세, 초과분은 낮은 세율로 분리과세됩니다." },
    { t: "연금저축 · IRP", tag: "세금·제도", e: "노후 준비 계좌. 납입액에 대해 연말정산 세액공제를 받습니다(연 600만/900만 원 한도).", x: "중도 인출이 제한되므로 '정말 오래 묶어둘 돈'으로 넣어야 합니다." },
    { t: "비상금", tag: "세금·제도", e: "생활비 3~6개월치. 투자금과 절대 섞지 않는 돈입니다.", x: "월 생활비 200만 원이면 600만~1,200만 원이 비상금 목표." },
    { t: "코인 (가상자산)", tag: "코인", e: "블록체인 위에서 거래되는 디지털 자산. 원금 보장이 없고 가격 변동이 매우 큽니다.", x: "하루에 10~20% 움직이는 일이 흔합니다." },
    { t: "스테이블코인", tag: "코인", e: "달러 등에 가치를 1:1로 맞추려는 코인(테더·USDC). '예금'이 아니라 발행사의 신용에 의존합니다.", x: "발행사가 지급을 못 하면 1달러가 유지되지 않을 수 있습니다." },
    { t: "김치프리미엄", tag: "코인", e: "국내 거래소 가격이 해외보다 높을 때 붙는 웃돈. 높다는 것은 국내 가격이 그만큼 비싸다는 뜻입니다.", x: "해외 1억 원짜리 비트코인이 국내에서 1억 500만 원이면 약 5% 프리미엄." },
    { t: "원화거래소", tag: "코인", e: "원화로 직접 코인을 사고팔 수 있는 국내 거래소(업비트·빗썸 등).", x: "FIU 신고 여부와 입출금 가능 여부를 꼭 확인하세요." },
    { t: "FIU 신고", tag: "코인", e: "가상자산사업자가 금융정보분석원에 신고해야 합법적으로 영업할 수 있습니다.", x: "미신고 업체는 언제 문을 닫을지 알 수 없어 출금이 막힐 수 있습니다." },
    { t: "콜드월렛 · 핫월렛", tag: "코인", e: "콜드월렛은 인터넷과 끊긴 지갑(하드웨어), 핫월렛은 앱·PC 지갑입니다.", x: "많은 양을 오래 보관할 때는 콜드월렛이 안전합니다." },
    { t: "스테이킹", tag: "코인", e: "코인을 맡기고 보상을 받는 것. 원금 손실·출금 제한이 있을 수 있습니다.", x: "연 5% 보상처럼 보여도 코인 가격이 30% 떨어지면 손실입니다." },
    { t: "전세", tag: "부동산", e: "집을 빌리며 큰 보증금을 맡기고 월세 없이 사는 것. 계약이 끝나면 보증금을 돌려받습니다.", x: "보증금을 못 돌려받는 것이 전세의 가장 큰 위험입니다." },
    { t: "전세가율", tag: "부동산", e: "전세보증금 ÷ 매매가. 80%를 넘으면 집값이 조금만 떨어져도 보증금을 못 받을 위험이 커집니다.", x: "매매가 4억, 보증금 3억 2천이면 전세가율 80%." },
    { t: "깡통전세", tag: "부동산", e: "전세가율이 매우 높고 집주인 빚(근저당)까지 많아, 경매로 넘어가면 보증금을 다 못 받는 집.", x: "보증금 + 근저당이 집값을 넘으면 사실상 담보가 없습니다." },
    { t: "역전세", tag: "부동산", e: "집값·전세가가 내려서 새 세입자의 보증금이 예전보다 낮아진 상황. 집주인이 보증금을 못 돌려주는 일이 생깁니다.", x: "내 보증금 3억인데 새 전세가 2억 5천이면 집주인이 5천만 원을 따로 마련해야 합니다." },
    { t: "LTV", tag: "부동산", e: "주택담보대출비율. 집값 대비 빌릴 수 있는 비율입니다.", x: "집값 4억, LTV 70%면 최대 2억 8천만 원." },
    { t: "DSR", tag: "부동산", e: "총부채원리금상환비율. 내 소득에서 모든 대출의 원리금 상환이 차지하는 비중입니다. 낮을수록 더 빌릴 수 있습니다.", x: "연소득 5천만 원, DSR 40%면 모든 대출 원리금이 연 2천만 원을 넘지 않아야 합니다." },
    { t: "근저당", tag: "부동산", e: "빚 담보로 집에 설정하는 권리. 경매 시 은행이 내 보증금보다 먼저 받아갑니다.", x: "등기부등본 갑구·을구에서 '근저당권 설정' 금액을 확인하세요." },
    { t: "등기부등본", tag: "부동산", e: "부동산의 소유자·근저당·가압류를 보여주는 공식 문서. 계약 전 반드시 직접 발급합니다.", x: "인터넷등기소(iros.go.kr)에서 1,000원 내외로 열람할 수 있습니다." },
    { t: "가압류 · 압류", tag: "부동산", e: "법원이나 세무서가 채권 확보를 위해 재산을 묶어둔 것. 계약하면 보증금이 위험합니다.", x: "등기부등본에 가압류가 있으면 계약을 멈추고 이유를 확인하세요." },
    { t: "확정일자", tag: "부동산", e: "계약서에 날짜 도장을 찍는 것. 보증금을 돌려받는 순위에서 유리해집니다.", x: "주민센터·인터넷등기소에서 받을 수 있고, 수수료가 있습니다." },
    { t: "전입신고", tag: "부동산", e: "실제로 들어가 산다고 신고하는 것. '대항력'이 생겨 집주인이 바뀌어도 살 수 있습니다.", x: "잔금일에 전입신고와 확정일자를 같은 날 처리하는 것이 안전합니다." },
    { t: "취득세", tag: "세금·제도", e: "집을 살 때 내는 지방세. 가격·주택 수에 따라 달라집니다(보통 1~3%, 다주택은 더 높음).", x: "6억 원 이하 1% 수준이지만 주택 수·면적에 따라 달라질 수 있습니다." },
    { t: "양도소득세", tag: "세금·제도", e: "집을 팔아 이익이 나면 내는 세금. 보유·거주 기간에 따라 크게 달라집니다.", x: "1세대 1주택은 일정 조건에서 비과세가 되지만, 요건이 자주 바뀝니다." },
    { t: "중개보수", tag: "부동산", e: "부동산 중개사 수수료. 법정 상한 요율 안에서 협의합니다.", x: "상한을 넘겨 요구하면 신고 대상입니다." },
    { t: "청약", tag: "부동산", e: "새로 짓는 아파트를 분양받기 위해 신청하는 것. 통장 가입 기간·납입 횟수가 중요합니다.", x: "당첨되면 계약금·중도금·잔금 일정이 정해집니다." },
    { t: "실거래가", tag: "부동산", e: "실제로 신고된 거래 가격. 국토부 실거래가 공개시스템에서 확인합니다.", x: "호가(부르는 가격)가 아니라 실제 신고된 가격을 보세요." },
    { t: "리딩방", tag: "사기주의", e: "'종목을 찍어준다'며 돈을 요구하는 단체 대화방. 대부분 사기입니다.", x: "수익 인증 사진은 조작될 수 있고, 입금 후에는 연락이 끊깁니다." },
    { t: "폰지사기", tag: "사기주의", e: "새 투자자의 돈으로 기존 투자자에게 이자를 주는 구조. 새 돈이 끊기면 무너집니다.", x: "원금보다 높은 확정 수익을 계속 준다면 이 구조를 의심하세요." },
    { t: "원금 보장", tag: "사기주의", e: "손실이 나도 원금을 돌려준다는 말. 합법적인 투자상품 중 원금을 보장하는 것은 예금·보험 등 일부뿐입니다.", x: "'주식·코인으로 원금 보장 + 월 5%'는 존재할 수 없는 조건입니다." }
  ];

  var glossFilter = "전체";

  function renderGloss() {
    var q = ($("#glossSearch").value || "").trim().toLowerCase();
    var list = GLOSSARY.filter(function (g) {
      var okTag = glossFilter === "전체" || g.tag === glossFilter;
      if (!okTag) return false;
      if (!q) return true;
      return g.t.toLowerCase().indexOf(q) >= 0 || g.e.toLowerCase().indexOf(q) >= 0 || (g.x || "").toLowerCase().indexOf(q) >= 0;
    });
    var box = $("#glossList");
    if (!list.length) {
      box.innerHTML = '<p class="empty">"' + ($("#glossSearch").value || "") + '" 에 해당하는 용어가 없습니다.<br>다른 말로 검색해 보세요.</p>';
      return;
    }
    box.innerHTML = list.map(function (g) {
      return '<div class="gterm"><div class="gh"><span class="name">' + g.t + '</span><span class="tag" data-t="' + g.tag + '">' + g.tag + "</span></div>" +
        '<div class="easy">' + g.e + "</div>" + (g.x ? '<div class="ex">예: ' + g.x + "</div>" : "") + "</div>";
    }).join("");
  }

  $("#glossSearch").addEventListener("input", renderGloss);
  $$("#glossFilter button").forEach(function (b) {
    b.addEventListener("click", function () {
      glossFilter = b.getAttribute("data-v");
      $$("#glossFilter button").forEach(function (x) { x.classList.toggle("on", x === b); });
      renderGloss();
    });
  });

  /* =========================================================
     초기화
     ========================================================= */
  buildAllocSliders();
  applySellPreset(state.sell.preset || "kr");
  renderDiag();
  renderAlloc();
  renderSim();
  renderAvg();
  renderSell();
  renderFund();
  renderLoan();
  renderJeonse();
  renderChecklist();
  renderGloss();
  renderPractice("stock");
  renderPractice("coin");
  showPractice((state.practice && state.practice.ptab) || "stock");
  showTab(state.tab || "start");
})();
