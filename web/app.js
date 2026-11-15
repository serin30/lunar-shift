/* LUNAR//SHIFT - front end.
   AI disclosure: first draft written with an AI coding assistant (Claude) during the
   NASA Space Apps 2026 hackathon; reviewed, run and extended by the team.

   Everything shown comes from data/sites.js, which is built from NASA LOLA terrain
   and JPL Horizons positions by the Python scripts in this repository. */
(function () {
  'use strict';

  var SITES = (window.LUNAR && window.LUNAR.sites) || {};
  var wanted = null; try { wanted = new URLSearchParams(window.location.search).get('site'); } catch (err) { wanted = null; }
  var site = SITES[wanted] || SITES[Object.keys(SITES)[0]];
  if (!site) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:20px">No site data found. Run build_site_data.py first.</p>'); return; }

  var E = site.ephem, N = E.sun_el.length, T0 = Date.parse(site.t0);
  var DAYS = Math.floor((N - 1) / 24);
  var SUN_R = 0.2666, EARTH_R = 0.95;                 // angular radius in degrees, seen from the Moon
  var CAUTIOUS = { sun: 0.5, earth: 0.5 }, OPTIMISTIC = { sun: 0.1, earth: 0.0 };
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ language */
  var I18N = window.LS_I18N, lang = 'en';
  try { if (localStorage.getItem('ls-lang') === 'ko') lang = 'ko'; } catch (err) { lang = 'en'; }
  function t(key) {
    var v = I18N[lang][key]; if (v === undefined) v = I18N.en[key];
    return typeof v === 'function' ? v.apply(null, Array.prototype.slice.call(arguments, 1)) : v;
  }
  var staticEn = null, proofEn = null;
  function applyStatic() {
    if (!staticEn) {
      staticEn = I18N.staticKo.map(function (p) { var el = document.querySelector(p[0]); return el ? el.innerHTML : null; });
      proofEn = { head: all('#proof-table thead th').map(function (c) { return c.innerHTML; }),
                  rows: all('#proof-table tbody tr').map(function (r) { return [r.cells[0].innerHTML, r.cells[2].innerHTML]; }) };
    }
    I18N.staticKo.forEach(function (p, i) { var el = document.querySelector(p[0]); if (el && staticEn[i] !== null) el.innerHTML = lang === 'ko' ? p[1] : staticEn[i]; });
    var src = lang === 'ko' ? I18N.proofKo : proofEn;
    all('#proof-table thead th').forEach(function (c, i) { c.innerHTML = src.head[i]; });
    all('#proof-table tbody tr').forEach(function (r, i) { if (src.rows[i]) { r.cells[0].innerHTML = src.rows[i][0]; r.cells[2].innerHTML = src.rows[i][1]; } });
    document.documentElement.lang = lang;
    all('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }

  /* ------------------------------------------------------------ data helpers */
  function wrap360(a) { return ((a % 360) + 360) % 360; }
  function hzAt(p, az) {
    var h = p.horizon_deg, n = h.length, i = wrap360(az) / (360 / n), i0 = Math.floor(i) % n, f = i - Math.floor(i);
    return h[i0] * (1 - f) + h[(i0 + 1) % n] * f;
  }
  function hzDistAt(p, az) { var d = p.horizon_dist_km, n = d.length; return d[Math.round(wrap360(az) / (360 / n)) % n]; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function lerpAz(a, b, f) { var d = ((b - a + 540) % 360) - 180; return wrap360(a + d * f); }
  function sample(arr, hour, isAz) {
    var i = Math.max(0, Math.min(N - 1, hour)), i0 = Math.floor(i), i1 = Math.min(N - 1, i0 + 1), f = i - i0;
    return isAz ? lerpAz(arr[i0], arr[i1], f) : lerp(arr[i0], arr[i1], f);
  }
  function sunFraction(el, hz) {                      // share of the disc above a level terrain line
    var k = Math.max(-1, Math.min(1, (el - hz) / SUN_R));
    return 0.5 + (k * Math.sqrt(1 - k * k) + Math.asin(k)) / Math.PI;
  }
  function prepPoint(sx, p) {                         // how far Earth's centre clears the terrain, degrees
    if (p.earthClear) return;
    p.earthClear = new Float32Array(sx.ephem.sun_el.length);
    for (var i = 0; i < p.earthClear.length; i++) p.earthClear[i] = sx.ephem.earth_el[i] - hzAt(p, sx.ephem.earth_az[i]);
  }
  site.points.forEach(function (p) { prepPoint(site, p); });
  function dateOf(hour) { return new Date(T0 + hour * 3600000); }
  function fmtDay(d) { return t('day', dateOf(d * 24)); }
  function fmtShort(d) { return t('short', dateOf(d * 24)); }
  function fmtDur(h) { var d = Math.floor(h / 24), r = Math.round(h - d * 24); if (r === 24) { d++; r = 0; } return t('dur', d, r); }
  function ptLabel(p) { return p.id === 'best' ? t('pt_best', Math.round(Math.hypot(p.east_m, p.north_m))) : t('pt_target'); }

  /* ------------------------------------------------------------ state */
  var st = { pt: site.points[0], hour: 0, playing: false, speed: 24, stay: 6, dark: 0, earth: 8, day: 0, cam: 'orbit', zoom: false, verdicts: [], layer: site.map ? 'crew_go' : 'plain', light: 'survey' };

  /* ------------------------------------------------------------ verdict */
  function evalDay(p, d, thr) {
    var a = d * 24, b = a + st.stay * 24;
    if (b > N - 1) return null;
    var run = 0, longest = 0, minContact = 24, i, day;
    for (i = a; i < b; i++) { if (p.sun[i] <= thr.sun) { run++; if (run > longest) longest = run; } else run = 0; }
    for (day = 0; day < st.stay; day++) {
      var c = 0; for (i = a + day * 24; i < a + day * 24 + 24; i++) if (p.earthClear[i] > thr.earth) c++;
      if (c < minContact) minContact = c;
    }
    return { dark: longest, contact: minContact, darkOk: longest <= st.dark, contactOk: minContact >= st.earth,
             pass: longest <= st.dark && minContact >= st.earth };
  }
  function computeVerdicts() {
    var out = [];
    for (var d = 0; d < DAYS; d++) {
      var c = evalDay(st.pt, d, CAUTIOUS), o = evalDay(st.pt, d, OPTIMISTIC);
      out.push(!c ? { c: 'na' } : { c: c.pass ? 'go' : (o.pass ? 'hold' : 'no'), cautious: c, optimistic: o });
    }
    st.verdicts = out;
  }
  function firstGoodDay() {
    var i;
    for (i = 0; i < DAYS; i++) if (st.verdicts[i].c === 'go') return i;
    for (i = 0; i < DAYS; i++) if (st.verdicts[i].c === 'hold') return i;
    return 0;
  }
  function passes(c) { return c === 'go' || c === 'hold'; }
  function whySentence(v) {
    var c = v.cautious, o = v.optimistic, bits = [], lim = t('darklim', st.dark);
    if (v.c === 'na') return t('why_na');
    if (v.c === 'go') return t('why_go', c.dark, st.dark, st.earth, c.contact);
    if (v.c === 'hold') {
      if (!c.darkOk) bits.push(t('hold_dark', c.dark, lim));
      if (!c.contactOk) bits.push(t('hold_contact', c.contact, st.earth));
      return t('hold_wrap', bits.join('; '));
    }
    if (!o.darkOk) bits.push(t('no_dark', o.dark, lim));
    if (!o.contactOk) bits.push(t('no_contact', o.contact, st.earth));
    return t('no_wrap', bits.join('; '));
  }
  function slipInfo(d) {
    var v = st.verdicts, k;
    if (!passes(v[d].c)) {
      for (k = d + 1; k < DAYS; k++) if (passes(v[k].c)) return t('slip_next', fmtShort(k));
      return t('slip_never');
    }
    k = d; while (k + 1 < DAYS && passes(v[k + 1].c)) k++;
    return k === d ? t('slip_zero') : t('slip_n', k - d, fmtShort(k));
  }

  /* ------------------------------------------------------------ compare sites */
  function countFor(p) {
    var go = 0, hold = 0;
    for (var d = 0; d < DAYS; d++) { var c = evalDay(p, d, CAUTIOUS); if (!c) continue; if (c.pass) go++; else if (evalDay(p, d, OPTIMISTIC).pass) hold++; }
    return { go: go, hold: hold };
  }
  function longestDark(p) { var run = 0, best = 0; for (var i = 0; i < p.sun.length; i++) { if (p.sun[i] <= 0.1) { run++; if (run > best) best = run; } else run = 0; } return best; }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function refreshCompare() {
    var ids = Object.keys(SITES); if (ids.length < 2) { $('compare').hidden = true; return; }
    $('compare').hidden = false;
    var rows = ids.map(function (id) {
      var sx = SITES[id]; sx.points.forEach(function (p) { prepPoint(sx, p); });
      var a = sx.points[0], b = sx.points[1], ca = countFor(a), cb = b ? countFor(b) : null, up = 0;
      for (var i = 0; i < a.earthClear.length; i++) if (a.earthClear[i] > 0) up++;
      return '<tr class="' + (sx === site ? 'cur' : '') + '"><td>' + (sx === site ? sx.name : '<a href="?site=' + id + '">' + sx.name + '</a>') + '</td><td>' + t('cmp_cell', ca.go, ca.hold) + '</td><td>' +
        (cb ? t('cmp_cell', cb.go, cb.hold) : t('not_computed')) + '</td><td>' + Math.round(100 * mean(a.sun)) + '%' + (b ? ' / ' + Math.round(100 * mean(b.sun)) + '%' : '') + '</td><td>' +
        Math.round(100 * up / a.earthClear.length) + '%</td><td>' + fmtDur(longestDark(a)) + '</td></tr>';
    });
    $('compare-table').innerHTML = '<thead><tr>' + t('cmp_head').map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody>';
  }

  /* ------------------------------------------------------------ calendar */
  var calBtns = [], calLabels = [];
  function buildCalendar() {
    var cal = $('cal'), year = dateOf(0).getUTCFullYear();
    for (var m = 0; m < 12; m++) {
      var lab = document.createElement('div'); lab.className = 'm'; cal.appendChild(lab); calLabels.push(lab);
      for (var dom = 1; dom <= 31; dom++) {
        var ms = Date.UTC(year, m, dom), ok = new Date(ms).getUTCMonth() === m, d = Math.round((ms - T0) / 86400000);
        if (!ok || d < 0 || d >= DAYS) { var s = document.createElement('span'); s.className = 'blank'; cal.appendChild(s); continue; }
        var b = document.createElement('button'); b.type = 'button'; b.dataset.day = d;
        b.addEventListener('click', onCalClick);
        cal.appendChild(b); calBtns[d] = b;
      }
    }
  }
  function onCalClick(ev) { st.day = +ev.currentTarget.dataset.day; st.hour = st.day * 24; refreshVerdictUI(); redraw2D(); }
  function refreshVerdictUI() {
    var v = st.verdicts[st.day], counts = { go: 0, hold: 0, no: 0, na: 0 };
    calLabels.forEach(function (lab, m) { lab.textContent = t('month', m); });
    for (var d = 0; d < DAYS; d++) {
      var b = calBtns[d]; if (!b) continue;
      var c = st.verdicts[d].c; counts[c]++;
      b.className = c + (d === st.day ? ' sel' : '') + (d > st.day && d < st.day + st.stay ? ' stay' : '');
      b.title = fmtDay(d) + ': ' + t('n_' + c);
      b.setAttribute('aria-label', b.title);
    }
    $('light').className = 'light ' + v.c;
    $('verdict-card').className = 'verdict-card ' + v.c;
    $('v-label').textContent = t('v_' + v.c); $('v-mean').textContent = t('mean_' + v.c);
    $('v-date').textContent = t('v_date', fmtDay(st.day), t('days', st.stay), ptLabel(st.pt));
    $('v-why').textContent = whySentence(v);
    $('v-slip').textContent = slipInfo(st.day);
    $('v-count').textContent = t('count', counts.go, counts.hold, DAYS - counts.na);
    if (scene3d) scene3d.setVerdict(v.c);
    refreshCompare();
  }

  /* ------------------------------------------------------------ requirement controls */
  function showReq() {
    $('out-stay').textContent = t('days', st.stay);
    $('out-dark').textContent = st.dark === 0 ? t('none') : t('h', st.dark);
    $('out-earth').textContent = st.earth === 0 ? t('not_needed') : t('h', st.earth);
  }
  function setReq(stay, dark, earth) {
    st.stay = stay; st.dark = dark; st.earth = earth;
    $('in-stay').value = stay; $('in-dark').value = dark; $('in-earth').value = earth;
    showReq();
    $('preset-crew').setAttribute('aria-pressed', String(stay === 6 && dark === 0 && earth === 8));
    $('preset-robot').setAttribute('aria-pressed', String(stay === 14 && dark === 24 && earth === 0));
    computeVerdicts();
  }
  function onReqInput() { setReq(+$('in-stay').value, +$('in-dark').value, +$('in-earth').value); refreshVerdictUI(); redraw2D(); }

  /* ------------------------------------------------------------ canvases */
  function fit(canvas, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || 600, h = cssH || canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  var MONO = '"IBM Plex Mono", "Noto Sans KR", monospace';

  function drawTimeline() {
    var c = fit($('timeline'), 54), ctx = c.ctx, w = c.w, p = st.pt, x, i;
    ctx.fillStyle = '#0c1118'; ctx.fillRect(0, 0, w, 54);
    for (x = 0; x < w; x++) {
      var a = Math.floor(x / w * (N - 1)), b = Math.max(a + 1, Math.floor((x + 1) / w * (N - 1))), s = 0, e = 0;
      for (i = a; i < b; i++) { s += p.sun[i]; if (p.earthClear[i] > 0) e++; }
      s /= (b - a); e /= (b - a);
      ctx.fillStyle = 'rgba(255,194,74,' + (0.08 + 0.92 * s).toFixed(3) + ')'; ctx.fillRect(x, 5, 1, 19);
      ctx.fillStyle = 'rgba(88,166,255,' + (0.08 + 0.92 * e).toFixed(3) + ')'; ctx.fillRect(x, 29, 1, 19);
    }
    var year = dateOf(0).getUTCFullYear();
    ctx.fillStyle = 'rgba(147,160,178,.35)';
    for (var m = 0; m < 12; m++) ctx.fillRect((Date.UTC(year, m, 1) - T0) / 3600000 / (N - 1) * w, 0, 1, 54);
    var x0 = st.day * 24 / (N - 1) * w, x1 = (st.day + st.stay) * 24 / (N - 1) * w;
    ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, 2.5, Math.max(3, x1 - x0), 49);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(st.hour / (N - 1) * w - 1, 0, 2, 54);
  }

  function drawStrip() {
    var c = fit($('strip'), 320), ctx = c.ctx, w = c.w, h = c.h, p = st.pt;
    var top = 14, bot = h - 30, EL_MIN = -4.5, EL_MAX = 8;
    var sunAz = sample(E.sun_az, st.hour, true), sunEl = sample(E.sun_el, st.hour);
    var eAz = sample(E.earth_az, st.hour, true), eEl = sample(E.earth_el, st.hour);
    var half = 45, centre = sunAz, el, az;
    function X(a) { if (!st.zoom) return wrap360(a) / 360 * w; var d = ((a - centre + 540) % 360) - 180; return (d + half) / (2 * half) * w; }
    function Y(e) { return top + (EL_MAX - e) / (EL_MAX - EL_MIN) * (bot - top); }
    var ys = (bot - top) / (EL_MAX - EL_MIN);
    ctx.fillStyle = '#070a0f'; ctx.fillRect(0, 0, w, h);
    ctx.font = '11px ' + MONO; ctx.textBaseline = 'middle';
    for (el = -4; el <= 8; el += 2) {
      ctx.strokeStyle = el === 0 ? 'rgba(233,237,242,.5)' : 'rgba(147,160,178,.16)'; ctx.setLineDash(el === 0 ? [5, 5] : []);
      ctx.beginPath(); ctx.moveTo(0, Y(el)); ctx.lineTo(w, Y(el)); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,194,74,.55)';             // where the Sun goes during the stay
    for (var k = st.day * 24; k <= Math.min(N - 1, (st.day + st.stay) * 24); k += 3) {
      var tx = X(E.sun_az[k]); if (tx < -4 || tx > w + 4) continue;
      ctx.beginPath(); ctx.arc(tx, Y(E.sun_el[k]), 1.6, 0, 6.3); ctx.fill();
    }
    var ex = X(eAz), sx = X(sunAz), sr = Math.max(3, SUN_R * ys);    // Earth, then Sun, then terrain on top so terrain hides them
    var g = ctx.createRadialGradient(ex - 5, Y(eEl) - 5, 2, ex, Y(eEl), EARTH_R * ys);
    g.addColorStop(0, '#9cc9ff'); g.addColorStop(1, '#2f6fc0');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, Y(eEl), EARTH_R * ys, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#ffd77a'; ctx.shadowColor = '#ffc24a'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(sx, Y(sunEl), sr, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
    var a0 = st.zoom ? centre - half : 0, a1 = st.zoom ? centre + half : 360, step = st.zoom ? 0.25 : 0.5;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (az = a0; az <= a1 + 1e-6; az += step) ctx.lineTo((az - a0) / (a1 - a0) * w, Y(hzAt(p, az)));
    ctx.lineTo(w, h); ctx.closePath();
    var tg = ctx.createLinearGradient(0, top, 0, h); tg.addColorStop(0, '#2a3342'); tg.addColorStop(1, '#10151d');
    ctx.fillStyle = tg; ctx.fill();
    ctx.beginPath();
    for (az = a0; az <= a1 + 1e-6; az += step) { var lx = (az - a0) / (a1 - a0) * w, ly = Y(hzAt(p, az)); if (az === a0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly); }
    ctx.strokeStyle = '#8fa1b8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1;        // outlines so hidden bodies can still be found
    ctx.strokeStyle = 'rgba(255,194,74,.9)'; ctx.beginPath(); ctx.arc(sx, Y(sunEl), sr + 4, 0, 6.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(88,166,255,.9)'; ctx.beginPath(); ctx.arc(ex, Y(eEl), EARTH_R * ys + 3, 0, 6.3); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#93a0b2';
    for (el = -4; el <= 8; el += 2) ctx.fillText((el > 0 ? '+' : '') + el + '°', 6, Y(el) - 8);
    ctx.textAlign = 'center';
    var marks = st.zoom ? [-40, -20, 0, 20, 40].map(function (d) { return wrap360(Math.round((centre + d) / 10) * 10); }) : [0, 45, 90, 135, 180, 225, 270, 315];
    var names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    marks.forEach(function (m) { var mx = X(m); if (mx > 14 && mx < w - 14) ctx.fillText((names[m] ? names[m] + ' ' : '') + m + '°', mx, h - 13); });
    ctx.fillStyle = '#ffc24a'; if (sx > 20 && sx < w - 20) ctx.fillText(t('sun'), sx, Y(sunEl) - sr - 14);
    ctx.fillStyle = '#58a6ff'; if (ex > 24 && ex < w - 24) ctx.fillText(t('earth'), ex, Y(eEl) - EARTH_R * ys - 12);
    ctx.textAlign = 'left';
  }

  function sunColor(pct) {
    var u = Math.max(0, Math.min(1, pct / 100)), a = [35, 40, 52], b = [122, 90, 30], c = [255, 207, 90], f, p, q;
    if (u < 0.5) { f = u / 0.5; p = a; q = b; } else { f = (u - 0.5) / 0.5; p = b; q = c; }
    return 'rgb(' + Math.round(lerp(p[0], q[0], f)) + ',' + Math.round(lerp(p[1], q[1], f)) + ',' + Math.round(lerp(p[2], q[2], f)) + ')';
  }
  var scan = site.scan, scanPts = scan.points, missGeom = null;
  var targetPt = scanPts.filter(function (q) { return q.dist_m === 0; })[0] || scanPts[0];
  var bestPt = scanPts.reduce(function (a, b) { return b.sun_pct > a.sun_pct ? b : a; });
  var worstPt = scanPts.reduce(function (a, b) { return b.sun_pct < a.sun_pct ? b : a; });
  function drawMiss(hover) {
    var cv = $('missmap'), c = fit(cv, cv.clientWidth), ctx = c.ctx, w = c.w, ext = scan.radius_m + scan.spacing_m * 0.75;
    var s = w / (2 * ext), cell = scan.spacing_m * s;
    function X(e) { return w / 2 + e * s; } function Y(n) { return w / 2 - n * s; }
    function box(q, colour) { ctx.strokeStyle = colour; ctx.strokeRect(X(q.east_m) - cell / 2 + 1, Y(q.north_m) - cell / 2 + 1, cell - 2, cell - 2); }
    missGeom = { X: X, Y: Y, s: s };
    ctx.fillStyle = '#070a0f'; ctx.fillRect(0, 0, w, w);
    ctx.font = Math.max(9, Math.min(12, cell * 0.28)) + 'px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    scanPts.forEach(function (q) {
      ctx.fillStyle = sunColor(q.sun_pct); ctx.fillRect(X(q.east_m) - cell / 2 + 1, Y(q.north_m) - cell / 2 + 1, cell - 2, cell - 2);
      ctx.fillStyle = q.sun_pct > 58 ? '#1a1407' : '#d5dbe4'; ctx.fillText(Math.round(q.sun_pct), X(q.east_m), Y(q.north_m));
    });
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(X(0), Y(0), 250 * s, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.5; box(targetPt, '#ffffff'); box(bestPt, '#3ecf7a'); if (hover) box(hover, '#58a6ff');
    ctx.fillStyle = '#e9edf2'; ctx.font = '11px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('N ↑', 10, 14); ctx.fillText(t('map_ring'), 10, w - 12);
    ctx.textAlign = 'right'; ctx.fillText(t('map_key'), w - 10, w - 12); ctx.textAlign = 'left';
  }
  function missText() {
    var near = scanPts.filter(function (q) { return q.dist_m <= 250; }), lo = Infinity, hi = -Infinity;
    near.forEach(function (q) { lo = Math.min(lo, q.sun_pct); hi = Math.max(hi, q.sun_pct); });
    $('miss-lead').textContent = t('miss_lead', Math.round(bestPt.dist_m), targetPt.sun_pct, bestPt.sun_pct, scanPts.length, scan.spacing_m);
    var stats = [
      [targetPt.sun_pct + '<small>%</small>', t('stat_target')],
      [bestPt.sun_pct + '<small>%</small>', t('stat_best', Math.round(bestPt.dist_m))],
      [t('range', lo, hi) + '<small>%</small>', t('stat_range')],
      [worstPt.sun_pct + '<small>%</small>', t('stat_worst', Math.round(worstPt.dist_m))]
    ];
    $('miss-stats').innerHTML = stats.map(function (s) { return '<div class="stat"><div class="n">' + s[0] + '</div><div class="k">' + s[1] + '</div></div>'; }).join('');
    $('proof-best-v').textContent = t('proof_best', bestPt.sun_pct, Math.round(bestPt.dist_m));
  }
  function setupMiss() {
    var cv = $('missmap'), tip = $('miss-tip');
    cv.addEventListener('pointermove', function (ev) {
      var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, best = null, bd = 1e9;
      scanPts.forEach(function (q) { var d = Math.hypot(missGeom.X(q.east_m) - mx, missGeom.Y(q.north_m) - my); if (d < bd) { bd = d; best = q; } });
      if (!best || bd > scan.spacing_m * missGeom.s) { tip.hidden = true; drawMiss(); return; }
      tip.hidden = false; tip.innerHTML = t('tip', best.sun_pct, best.earth_pct, best.slope_deg, Math.round(best.dist_m));
      tip.style.left = Math.min(r.width - 170, mx + 14) + 'px'; tip.style.top = Math.max(6, my - 70) + 'px';
      drawMiss(best);
    });
    cv.addEventListener('pointerleave', function () { tip.hidden = true; drawMiss(); });
  }

  /* ------------------------------------------------------------ readout */
  function nextChange(isUp) {                         // when does it next rise or set, from the current time?
    var i0 = Math.floor(st.hour), cur = isUp(i0);
    for (var i = i0 + 1; i < N; i++) if (isUp(i) !== cur) return t(cur ? 'sets_in' : 'rises_in', fmtDur(i - st.hour), t('short', dateOf(i)));
    return t(cur ? 'stays_up' : 'stays_down');
  }
  function refreshReadout() {
    var p = st.pt, sAz = sample(E.sun_az, st.hour, true), sEl = sample(E.sun_el, st.hour), hz = hzAt(p, sAz), f = sunFraction(sEl, hz);
    var eAz = sample(E.earth_az, st.hour, true), eEl = sample(E.earth_el, st.hour), ec = eEl - hzAt(p, eAz);
    $('r-sun').textContent = f < 0.005 ? t('hidden') : Math.round(f * 100) + '%';
    $('r-earth').textContent = ec > 0 ? t('in_view') : t('hidden');
    $('r-sunel').textContent = (sEl >= 0 ? '+' : '') + sEl.toFixed(2) + '° @ ' + sAz.toFixed(0) + '°';
    $('r-terr').textContent = (hz >= 0 ? '+' : '') + hz.toFixed(2) + '°';
    $('r-dist').textContent = t('km_away', hzDistAt(p, sAz).toFixed(1));
    $('r-sunnext').textContent = nextChange(function (i) { return p.sun[i] > 0.005; });
    $('r-earthnext').textContent = nextChange(function (i) { return p.earthClear[i] > 0; });
    $('clock-date').textContent = t('clock', dateOf(st.hour));
  }
  function redraw2D() { drawTimeline(); drawStrip(); refreshReadout(); if (scene3d) scene3d.setTime(); }

  /* ------------------------------------------------------------ 3D scene */
  var scene3d = null;
  function initScene() {
    var T = window.THREE; if (!T) return null;
    var canvas = $('scene'), hero = $('hero'), renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, logarithmicDepthBuffer: true }); } catch (err) { $('scene-note').textContent = 'The 3D view needs WebGL, which this browser did not provide. Everything below still works.'; return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var scene = new T.Scene(); scene.background = new T.Color(0x05070b);
    var camera = new T.PerspectiveCamera(38, 2, 20, 3000000);
    var R_MOON = 1737400, polar = site.polar || null;
    function drop(east, north) { return polar ? (east * east + north * north) / (2 * R_MOON) : 0; }   // how far the round Moon falls away
    var terr = site.terrain, size = terr.size, half = terr.half_m, H = terr.heights_m, ground0 = site.points[0].ground_m;
    function W(east, up, north) { return new T.Vector3(east, up - drop(east, north), -north); }     // x east, y up, z south
    function V(east, up, north) { return new T.Vector3(east, up, -north); }                      // an offset, no curvature

    // terrain: the real elevation grid, true scale
    var geo = new T.PlaneGeometry(2 * half, 2 * half, size - 1, size - 1); geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, iy, ix, lowest = Infinity;
    for (iy = 0; iy < size; iy++) for (ix = 0; ix < size; ix++) {
      var hh = H[(size - 1 - iy) * size + ix] - ground0 - drop((ix - (size - 1) / 2) * terr.step_m, ((size - 1) / 2 - iy) * terr.step_m);
      pos.setY(iy * size + ix, hh); if (hh < lowest) lowest = hh;
    }
    geo.computeVertexNormals();
    var colours = new Float32Array(size * size * 3);
    geo.setAttribute('color', new T.BufferAttribute(colours, 3));
    var ground = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 }));
    ground.castShadow = true; ground.receiveShadow = true; scene.add(ground);

    // the wide landscape: real terrain out to 200 km, bent to the Moon's curvature
    if (polar) (function () {
      var ps = polar.size, ph = polar.half_m, PH = polar.heights_m, g = new T.PlaneGeometry(2 * ph, 2 * ph, ps - 1, ps - 1); g.rotateX(-Math.PI / 2);
      var pp = g.attributes.position, inner = half - polar.step_m;
      for (var jy = 0; jy < ps; jy++) for (var jx = 0; jx < ps; jx++) {
        var e = (jx - (ps - 1) / 2) * polar.step_m, n = ((ps - 1) / 2 - jy) * polar.step_m;
        var y = PH[(ps - 1 - jy) * ps + jx] - ground0 - drop(e, n);
        if (Math.abs(e) < inner && Math.abs(n) < inner) y -= 500;        // tuck it under the detailed tile
        pp.setY(jy * ps + jx, y);
      }
      g.computeVertexNormals();
      var wide = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x9c9992, roughness: 1, metalness: 0 }));
      wide.castShadow = true; wide.receiveShadow = true; scene.add(wide);
    })();

    // sides and base, so the terrain reads as a solid block when there is no wide landscape
    if (!polar) (function () {
      var base = lowest - 900, v = [], idx = [], n = 0;
      function edge(getIx, getIy) {
        for (var k = 0; k < size; k++) {
          var jx = getIx(k), jy = getIy(k), x = (jx - (size - 1) / 2) * terr.step_m, z = (jy - (size - 1) / 2) * terr.step_m;
          v.push(x, pos.getY(jy * size + jx), z, x, base, z);
          if (k < size - 1) { var a = n + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        n += size * 2;
      }
      edge(function (k) { return k; }, function () { return 0; });
      edge(function (k) { return k; }, function () { return size - 1; });
      edge(function () { return 0; }, function (k) { return k; });
      edge(function () { return size - 1; }, function (k) { return k; });
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
      scene.add(new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x3a3c42, roughness: 1, metalness: 0, side: T.DoubleSide })));
      var floor = new T.Mesh(new T.PlaneGeometry(2 * half, 2 * half), new T.MeshBasicMaterial({ color: 0x15171b, side: T.DoubleSide }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = base; scene.add(floor);
    })();

    var ambient = new T.AmbientLight(0x2a3550, 0.42); scene.add(ambient);
    var hemi = new T.HemisphereLight(0xe8eeff, 0x2c3038, 0.62); scene.add(hemi);
    var survey = new T.DirectionalLight(0xffffff, 1.25); survey.position.set(-0.72, 0.40, -0.56).multiplyScalar(40000); scene.add(survey);
    var sunLight = new T.DirectionalLight(0xfff0d2, 2.6); sunLight.castShadow = true;
    var SH = polar ? 46000 : 18000, SD = polar ? 160000 : 45000;
    var sc = sunLight.shadow.camera; sc.left = -SH; sc.right = SH; sc.top = SH; sc.bottom = -SH; sc.near = 1000; sc.far = SD * 2;
    sunLight.shadow.mapSize.set(4096, 4096); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = polar ? 34 : 14;
    scene.add(sunLight); scene.add(sunLight.target);

    var sg = new T.BufferGeometry(), sp = [], rnd = 7;
    function rand() { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; }
    for (var i = 0; i < 1400; i++) { var u1 = rand() * 2 - 1, th = rand() * 6.283, r = Math.sqrt(1 - u1 * u1); sp.push(r * Math.cos(th) * 2000000, u1 * 2000000, r * Math.sin(th) * 2000000); }
    sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    scene.add(new T.Points(sg, new T.PointsMaterial({ color: 0xcfd8e6, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.8 })));

    // skyline ring: the computed terrain horizon, shown only when standing at the site
    var RR = polar ? 330000 : 21000, RS = polar ? 420000 : 30000, ring = new T.Group(); ring.visible = false; scene.add(ring);
    function buildRing() {
      while (ring.children.length) { var o = ring.children.pop(); o.geometry.dispose(); }
      var p = st.pt, n = p.horizon_deg.length, v = [], idx = [], line = [];
      for (var k = 0; k <= n; k++) {
        var az = (k % n) * 360 / n * Math.PI / 180, x = Math.sin(az) * RR, z = -Math.cos(az) * RR, yTop = Math.tan(p.horizon_deg[k % n] * Math.PI / 180) * RR;
        v.push(x, -RR * 0.45, z, x, yTop, z); line.push(x, yTop, z);
        if (k < n) { var a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setIndex(idx);
      ring.add(new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x0e131b, side: T.DoubleSide })));
      var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(line, 3));
      ring.add(new T.Line(lg, new T.LineBasicMaterial({ color: 0x6f819b })));
    }
    function discTexture(inner, outer, glow) {
      var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
      var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      if (glow) { g.addColorStop(0, inner); g.addColorStop(0.5, inner); g.addColorStop(0.56, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); }
      else { g.addColorStop(0, inner); g.addColorStop(0.93, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); }
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
    }
    var sunSprite = new T.Sprite(new T.SpriteMaterial({ map: discTexture('#fff6dc', 'rgba(255,194,74,.35)', true), transparent: true, depthWrite: false }));
    var earthSprite = new T.Sprite(new T.SpriteMaterial({ map: discTexture('#9cc9ff', '#2f6fc0', false), transparent: true, depthWrite: false }));
    scene.add(sunSprite); scene.add(earthSprite);

    // landing-miss field: one marker per scanned point, standing on the real ground
    var markers = new T.Group(); scene.add(markers);
    scanPts.forEach(function (q) {
      var m = new T.Mesh(new T.CylinderGeometry(34, 34, 14, 20), new T.MeshBasicMaterial({ color: new T.Color(sunColor(q.sun_pct)) }));
      m.position.copy(W(q.east_m, q.ground_m - ground0 + 9, q.north_m)); markers.add(m);
    });
    var beamMat = new T.MeshBasicMaterial({ color: 0x3ecf7a, transparent: true, opacity: 0.9 });
    var beam = new T.Mesh(new T.CylinderGeometry(11, 11, 1400, 12), beamMat); scene.add(beam);
    var halo = new T.Mesh(new T.RingGeometry(70, 96, 48), new T.MeshBasicMaterial({ color: 0x3ecf7a, side: T.DoubleSide, transparent: true, opacity: 0.95 }));
    halo.rotation.x = -Math.PI / 2; scene.add(halo);

    var controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 600; controls.maxDistance = polar ? 600000 : 70000;
    controls.maxPolarAngle = Math.PI * 0.497; controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
    var HOME = V(-6400, 3900, -9800), FAR = polar ? V(-150000, 210000, -250000) : V(-21000, 19000, -33000);
    canvas.addEventListener('pointerdown', function () { controls.autoRotate = false; fly = null; });

    var eye = new T.Vector3(), look = { yaw: 0, pitch: 1.2, free: false }, drag = null, fly = null;
    canvas.addEventListener('pointerdown', function (ev) { if (st.cam === 'stand') { drag = { x: ev.clientX, y: ev.clientY }; look.free = true; } });
    window.addEventListener('pointermove', function (ev) {
      if (!drag || st.cam !== 'stand') return;
      look.yaw = wrap360(look.yaw - (ev.clientX - drag.x) * 0.08); look.pitch = Math.max(-12, Math.min(20, look.pitch + (ev.clientY - drag.y) * 0.05));
      drag = { x: ev.clientX, y: ev.clientY };
    });
    window.addEventListener('pointerup', function () { drag = null; });

    // paint the ground with a result layer from the decision map
    var LAYERS = {
      crew_go:   { lo: [0.10, 0.30, 0.20], hi: [0.56, 1.00, 0.70], zero: [0.25, 0.27, 0.32], dates: true },
      robot_go:  { lo: [0.10, 0.30, 0.20], hi: [0.56, 1.00, 0.70], zero: [0.25, 0.27, 0.32], dates: true },
      sun_pct:   { lo: [0.20, 0.19, 0.20], hi: [1.00, 0.80, 0.34], zero: [0.10, 0.11, 0.14], fixedMax: 100 },
      earth_pct: { lo: [0.16, 0.20, 0.28], hi: [0.42, 0.72, 1.00], zero: [0.10, 0.11, 0.14], fixedMax: 100 }
    };
    var PLAIN = [0.62, 0.61, 0.58], OUTSIDE = [0.40, 0.40, 0.41];
    function css(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }
    function mix(L, f) { return [lerp(L.lo[0], L.hi[0], f), lerp(L.lo[1], L.hi[1], f), lerp(L.lo[2], L.hi[2], f)]; }
    function setLayer(name) {
      st.layer = name;
      var map = site.map, L = LAYERS[name], arr = map && L ? map[name] : null, max = 1, k;
      if (arr) { max = L.fixedMax || 1; if (!L.fixedMax) for (k = 0; k < arr.length; k++) if (arr[k] > max) max = arr[k]; }
      for (var jy = 0; jy < size; jy++) for (var jx = 0; jx < size; jx++) {
        var c = PLAIN, east = (jx - (size - 1) / 2) * terr.step_m, north = ((size - 1) / 2 - jy) * terr.step_m;
        if (arr) {
          if (Math.abs(east) > map.half_m || Math.abs(north) > map.half_m) c = OUTSIDE;
          else {
            var v = arr[Math.round((north + map.half_m) / map.step_m) * map.size + Math.round((east + map.half_m) / map.step_m)];
            if (v === null || v === undefined) c = OUTSIDE; else if (v <= 0) c = L.zero; else c = mix(L, L.fixedMax ? v / max : Math.sqrt(v / max));
          }
        }
        var o = (jy * size + jx) * 3; colours[o] = c[0]; colours[o + 1] = c[1]; colours[o + 2] = c[2];
      }
      geo.attributes.color.needsUpdate = true;
      $('legend').hidden = !arr; if (!arr) return;
      $('legend-bar').style.background = 'linear-gradient(to right,' + css(L.zero) + ' 0 4%,' + css(L.lo) + ' 4%,' + css(mix(L, L.fixedMax ? 0.5 : 0.71)) + ' 52%,' + css(L.hi) + ')';
      $('legend-min').textContent = '0'; $('legend-max').textContent = max + (L.dates ? t('unit_dates') : '%');
      var some = 0; for (k = 0; k < arr.length; k++) if (arr[k] > 0) some++;
      $('legend-cap').textContent = t('legend_cap', t('cap_' + name), Math.round(100 * some / arr.length), 2 * map.half_m / 1000);
    }
    function applyLight() {
      var real = st.light === 'real' || st.cam === 'stand';
      sunLight.intensity = real ? 2.6 : 0; sunLight.castShadow = real;
      ambient.intensity = real ? (st.cam === 'stand' ? 0.6 : (polar ? 0.8 : 0.42)) : 0; hemi.intensity = real ? 0 : 0.62; survey.intensity = real ? 0 : 1.25;
    }
    function note() { $('scene-note').textContent = st.cam === 'stand' ? t('note_stand') : (st.light === 'real' ? t('note_real') : t('note_survey')); }
    function setLight(mode) { st.light = mode; applyLight(); note(); }

    function dirOf(azDeg, elDeg) { var a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180; return new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); }
    function setPoint() {
      var p = st.pt; eye.copy(W(p.east_m, p.ground_m - ground0 + p.mast_m, p.north_m));
      ring.position.copy(eye); buildRing();
      beam.position.copy(eye).add(new T.Vector3(0, 700, 0)); halo.position.copy(eye).add(new T.Vector3(0, 6, 0));
      sunLight.target.position.copy(eye);
      controls.target.copy(eye);
    }
    function setTime() {
      var sAz = sample(E.sun_az, st.hour, true), sEl = sample(E.sun_el, st.hour), eAz = sample(E.earth_az, st.hour, true), eEl = sample(E.earth_el, st.hour);
      var sd = dirOf(sAz, sEl), big = st.cam === 'orbit';
      sunLight.position.copy(eye).addScaledVector(sd, SD);
      sunSprite.position.copy(eye).addScaledVector(sd, RS);
      var sDia = 2 * Math.tan(SUN_R * Math.PI / 180) * RS * 2 * (big ? 5 : 1);      // the texture's disc fills half of the sprite
      sunSprite.scale.set(sDia, sDia, 1);
      earthSprite.position.copy(eye).addScaledVector(dirOf(eAz, eEl), RS);
      var eDia = 2 * Math.tan(EARTH_R * Math.PI / 180) * RS * 1.07 * (big ? 1.8 : 1);
      earthSprite.scale.set(eDia, eDia, 1);
      if (st.cam === 'stand' && !look.free) look.yaw = sAz;
    }
    function setCam(mode) {
      st.cam = mode; controls.enabled = mode === 'orbit'; look.free = false; look.pitch = 1.2; fly = null;
      markers.visible = mode === 'orbit'; beam.visible = mode === 'orbit'; halo.visible = mode === 'orbit'; ring.visible = mode === 'stand';
      camera.fov = mode === 'orbit' ? 38 : 30; camera.near = mode === 'orbit' ? 20 : 0.5; camera.updateProjectionMatrix();
      if (mode === 'orbit') camera.position.copy(eye).add(HOME);
      $('hud-right').style.visibility = mode === 'orbit' ? 'visible' : 'hidden';
      $('cam-orbit').setAttribute('aria-pressed', String(mode === 'orbit')); $('cam-stand').setAttribute('aria-pressed', String(mode === 'stand'));
      applyLight(); note(); setTime();
    }
    function flyIn(done) {                             // opening move: dive from high above the pole down to the site
      if (reduceMotion) { camera.position.copy(eye).add(HOME); if (done) done(); return; }
      fly = { u: 0, dur: polar ? 6500 : 3600, done: done || null };
    }
    function spin(on) { controls.autoRotate = on && !reduceMotion; }
    function setVerdict(c) { var col = c === 'go' ? 0x3ecf7a : c === 'hold' ? 0xf2c230 : c === 'no' ? 0xe5484d : 0x93a0b2; beamMat.color.setHex(col); halo.material.color.setHex(col); }
    function resize() { var w = hero.clientWidth, h = hero.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    var lastRender = 0;
    function render(now) {
      var step = Math.min(120, lastRender ? now - lastRender : 16); lastRender = now;   // a slow frame must not skip the dive
      if (st.cam === 'orbit') {
        if (fly) {
          fly.u = Math.min(1, fly.u + step / fly.dur);
          var u = fly.u, e = u * u * (3 - 2 * u);
          var k = Math.pow(e, 0.55);                               // most of the distance early, a slow arrival
          camera.position.copy(eye).add(FAR.clone().lerp(HOME, k)); if (u >= 1) { var cb = fly.done; fly = null; if (cb) cb(); }
        }
        controls.update();
      } else { camera.position.copy(eye); camera.lookAt(eye.clone().add(dirOf(look.yaw, look.pitch))); }
      renderer.render(scene, camera);
    }
    window.addEventListener('resize', resize);
    resize(); setPoint(); camera.position.copy(eye).add(reduceMotion ? HOME : FAR); setTime(); setLayer(st.layer); applyLight(); note();
    canvas.addEventListener('wheel', function () { fly = null; }, { passive: true });
    return { render: render, setTime: setTime, setPoint: setPoint, setCam: setCam, setVerdict: setVerdict, setLayer: setLayer, setLight: setLight, flyIn: flyIn, spin: spin, note: note };
  }

  /* ------------------------------------------------------------ wiring */
  function press(sel, on) { all(sel).forEach(function (b) { b.setAttribute('aria-pressed', String(on(b))); }); }
  function setPointById(id) {
    st.pt = site.points.filter(function (p) { return p.id === id; })[0] || site.points[0];
    all('#point-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pt === st.pt.id)); });
    $('site-coord').textContent = Math.abs(st.pt.lat).toFixed(4) + '° S, ' + st.pt.lon.toFixed(2) + '° E · ' + Math.round(st.pt.ground_m) + ' m';
    computeVerdicts(); if (scene3d) scene3d.setPoint(); refreshVerdictUI(); redraw2D();
  }
  function setLayerUI(name) { press('[data-layer]', function (b) { return b.dataset.layer === name; }); if (scene3d) scene3d.setLayer(name); }
  function setLightUI(mode) { $('light-survey').setAttribute('aria-pressed', String(mode === 'survey')); $('light-real').setAttribute('aria-pressed', String(mode === 'real')); if (scene3d) scene3d.setLight(mode); }
  function setPlaying(on) { st.playing = on; $('play').textContent = on ? '❚❚' : '▶'; $('play').setAttribute('aria-label', t(on ? 'pause' : 'play')); }
  function setSpeed(v) { st.speed = v; press('[data-speed]', function (b) { return +b.dataset.speed === v; }); }
  function setLang(l) {
    lang = l; try { localStorage.setItem('ls-lang', l); } catch (err) { /* private window: just keep it for this visit */ }
    applyStatic();
    all('#point-seg button').forEach(function (b) { b.textContent = ptLabel(site.points.filter(function (p) { return p.id === b.dataset.pt; })[0]); });
    showReq(); missText(); refreshVerdictUI(); redraw2D(); drawMiss();
    if (scene3d) { scene3d.setLayer(st.layer); scene3d.note(); }
    setPlaying(st.playing);
    if (tour.i >= 0) $('caption-text').textContent = t('tour')[tour.i];
  }

  /* ------------------------------------------------------------ opening screen and tour */
  var tour = { i: -1, timer: null };
  var STEPS = [
    { ms: 7000, run: function () { scene3d.setCam('orbit'); setLightUI('real'); setLayerUI('plain'); setPlaying(false); st.hour = st.day * 24; redraw2D(); scene3d.spin(true); scene3d.flyIn(); } },
    { ms: 6000, run: function () { setLightUI('survey'); setLayerUI(site.map ? 'crew_go' : 'plain'); } },
    { ms: 7000, run: function () { setLayerUI('plain'); st.hour = st.day * 24; scene3d.setCam('stand'); setSpeed(24); setPlaying(true); redraw2D(); } }
  ];
  function closeIntro() { $('intro').classList.add('out'); }
  function tourStep(i) {
    if (i >= STEPS.length) { endTour(true); return; }
    tour.i = i; STEPS[i].run();
    $('caption').hidden = false; $('caption-text').textContent = t('tour')[i];
    tour.timer = setTimeout(function () { tourStep(i + 1); }, STEPS[i].ms);
  }
  function startTour() {
    if (!scene3d) { closeIntro(); return; }
    closeIntro(); clearTimeout(tour.timer); $('hero').classList.add('touring'); window.scrollTo(0, 0); tourStep(0);
  }
  function endTour(finished) {
    clearTimeout(tour.timer); tour.i = -1; $('caption').hidden = true; $('hero').classList.remove('touring');
    if (scene3d) { scene3d.setCam('orbit'); setLightUI('survey'); setLayerUI(site.map ? 'crew_go' : 'plain'); }
    setPlaying(false); setSpeed(24); st.hour = st.day * 24; redraw2D();
    if (finished) { $('verdict').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); $('verdict-card').classList.add('flash'); setTimeout(function () { $('verdict-card').classList.remove('flash'); }, 3400); }
  }

  /* ------------------------------------------------------------ start */
  $('site-name').textContent = site.name;
  site.points.forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.dataset.pt = p.id;
    b.addEventListener('click', function () { setPointById(p.id); }); $('point-seg').appendChild(b);
  });
  if (site.points.length < 2) $('point-seg').hidden = true;
  if (!site.map) $('layer-seg').hidden = true;

  buildCalendar();
  setReq(6, 0, 8);
  st.day = firstGoodDay(); st.hour = st.day * 24;
  scene3d = initScene();
  setupMiss();
  setPointById(st.pt.id);
  setLang(lang);
  if (scene3d) {
    setLightUI('real'); setLayerUI('plain'); scene3d.spin(true);
    scene3d.flyIn(function () { if (tour.i < 0) { setLightUI('survey'); setLayerUI(site.map ? 'crew_go' : 'plain'); } });
  }

  $('preset-crew').addEventListener('click', function () { setReq(6, 0, 8); refreshVerdictUI(); redraw2D(); });
  $('preset-robot').addEventListener('click', function () { setReq(14, 24, 0); refreshVerdictUI(); redraw2D(); });
  ['in-stay', 'in-dark', 'in-earth'].forEach(function (id) { $(id).addEventListener('input', onReqInput); });
  $('cam-orbit').addEventListener('click', function () { if (scene3d) scene3d.setCam('orbit'); });
  $('cam-stand').addEventListener('click', function () { if (scene3d) scene3d.setCam('stand'); });
  $('strip-full').addEventListener('click', function () { st.zoom = false; $('strip-full').setAttribute('aria-pressed', 'true'); $('strip-zoom').setAttribute('aria-pressed', 'false'); drawStrip(); });
  $('strip-zoom').addEventListener('click', function () { st.zoom = true; $('strip-zoom').setAttribute('aria-pressed', 'true'); $('strip-full').setAttribute('aria-pressed', 'false'); drawStrip(); });
  $('play').addEventListener('click', function () { setPlaying(!st.playing); });
  all('[data-speed]').forEach(function (b) { b.addEventListener('click', function () { setSpeed(+b.dataset.speed); }); });
  all('[data-layer]').forEach(function (b) { b.addEventListener('click', function () { setLayerUI(b.dataset.layer); }); });
  all('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
  $('light-survey').addEventListener('click', function () { setLightUI('survey'); });
  $('light-real').addEventListener('click', function () { setLightUI('real'); });
  $('tour-start').addEventListener('click', startTour);
  $('help').addEventListener('click', startTour);
  $('tour-stop').addEventListener('click', function () { clearTimeout(tour.timer); tourStep(tour.i + 1); });
  $('intro-skip').addEventListener('click', function () { closeIntro(); });

  var tl = $('timeline'), scrub = false;
  function scrubTo(ev) { var r = tl.getBoundingClientRect(); st.hour = Math.max(0, Math.min(N - 1, (ev.clientX - r.left) / r.width * (N - 1))); redraw2D(); }
  tl.addEventListener('pointerdown', function (ev) { scrub = true; tl.setPointerCapture(ev.pointerId); scrubTo(ev); });
  tl.addEventListener('pointermove', function (ev) { if (scrub) scrubTo(ev); });
  tl.addEventListener('pointerup', function () { scrub = false; });
  window.addEventListener('resize', function () { redraw2D(); drawMiss(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { redraw2D(); drawMiss(); });

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (st.playing) { st.hour += dt * st.speed; if (st.hour >= N - 1) st.hour = 0; redraw2D(); }
    if (scene3d) scene3d.render(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__lunar = { st: st, site: site, redraw: redraw2D };                    // handy for checking values in the console
})();
