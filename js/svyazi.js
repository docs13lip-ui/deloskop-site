/* Делоскоп — режим «Связи» в отчёте (vizual-v3.2, 18.10.2026; ТЗ v3 §7, волна 3.2).
   Третья вкладка рядом с «Глазами банка / Глазами налоговой» (таблетки строит js/vizual2.js): компания — узел в центре,
   вокруг — руководитель, учредители, адрес, инспекция, филиалы, основной вид деятельности.
   Только то, что уже пришло в ответе /api/check (company, dossier.sections, signals) — слова и числа берём из ответа как есть,
   своих утверждений не добавляем; новых запросов к API нет. ИП — без вкладки (данные ИП не показываем).
   Цвет нити — по признаку из ответа (signals: адрес, «Массовый адрес», «Массовый руководитель»), иначе нейтральный.
   Широкий экран — граф на canvas («камера» поворачивается вокруг компании при открытии и за мышью) + тот же список для
   экранного диктора; ≤ 600 px — список, граф по кнопке. prefers-reduced-motion: reduce — один кадр без поворота.
   Цвета — из --ink/--muted/--accent/--ok/--warn/--bad, при смене темы кадр рисуется заново. Без JS вкладки нет. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.Svyazi = factory(root);
})(typeof self !== 'undefined' ? self : this, function (W) {
  'use strict';
  var d = W && W.document;
  var tiho = !W || !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  var TON = { ok: 'ok', warn: 'warn', medium: 'warn', high: 'bad', bad: 'bad', critical: 'bad' };

  function str(v) { return v == null ? '' : String(v).trim(); }
  function ton(s) { return (s && TON[s.status]) || 'neutral'; }

  // модель из ответа /api/check: {centr:{zag, pod}, uzly:[{k, zag, znach, pod, ton}]}; null — вкладки нет
  function model(r) {
    var c = r && r.company;
    if (!c || c.kind !== 'LEGAL') return null;
    var sec = {};
    ((r.dossier || {}).sections || []).forEach(function (s) { sec[s.id] = s.rows || []; });
    function ryad(id, re) { return (sec[id] || []).filter(function (x) { return x && re.test(str(x[0])) && str(x[1]); }); }
    var sig = {}, massRuk = null, massAdr = null;
    (r.signals || []).forEach(function (s) {
      if (!s) return;
      sig[s.id] = s;
      if (/^Массовый руководитель/i.test(str(s.title))) massRuk = s;
      if (/^Массовый адрес/i.test(str(s.title))) massAdr = s;
    });
    var uzly = [];
    function dob(k, row, pod, s) {
      if (!row) return;
      uzly.push({ k: k, zag: str(row[0]), znach: str(row[1]), pod: str(pod), ton: s ? ton(s) : 'neutral' });
    }
    // руководство: первая строка — должность и имя (как в «Все данные из реестров»), «Руководит с» — подпись
    var ruk = (sec.management || []).filter(function (x) { return x && str(x[1]) && !/^(Руководит с|Уставный капитал)/i.test(str(x[0])) && !/учредит|участник|акционер|собственник/i.test(str(x[0])); })[0];
    var s1 = ryad('management', /^Руководит с/i)[0];
    if (ruk) dob('rukovoditel', ruk, massRuk ? str(massRuk.detail) : s1 ? s1[0] + ' ' + s1[1] : '', massRuk);
    ryad('management', /учредит|участник|акционер|собственник/i).slice(0, 6).forEach(function (x) { dob('uchreditel', x, '', null); });
    var adr = ryad('profile', /^Юридический адрес/i)[0];
    var sa = massAdr || sig.address;
    if (adr) dob('adres', adr, sa ? str(sa.detail) : '', sa);
    dob('inspekciya', ryad('profile', /^Налоговая инспекция/i)[0], '', null);
    dob('vid', ryad('activity', /^Основной вид деятельности/i)[0], '', null);
    dob('filialy', ryad('profile', /^Филиалы/i)[0], '', null);
    if (uzly.length < 2) return null;
    return { centr: { zag: str(c.name_short || c.name_full), pod: c.inn ? 'ИНН ' + c.inn : '' }, uzly: uzly };
  }

  // ---------- рисование ----------
  function cveta(el) {
    var cs = W.getComputedStyle(el);
    function v(n, z) { return (cs.getPropertyValue(n) || '').trim() || z; }
    return { ink: v('--ink', '#1D1D1F'), muted: v('--muted', '#6B6B70'), accent: v('--accent', '#0B63E5'),
      soft: v('--accent-soft', '#EAF1FD'), line: v('--line', '#E6E6E1'), surface: v('--surface', '#FFFFFF'),
      ok: v('--ok', '#16723F'), warn: v('--warn', '#9A5B00'), bad: v('--bad', '#B3261E'), font: cs.fontFamily || 'sans-serif' };
  }
  // строки подписи не шире w (не больше 2; длинное — с «…», полный текст — в списке)
  function stroki(cx, t, w) {
    var sl = t.split(/\s+/), out = [], cur = '';
    for (var i = 0; i < sl.length; i++) {
      var p = cur ? cur + ' ' + sl[i] : sl[i];
      if (cx.measureText(p).width <= w || !cur) cur = p; else { out.push(cur); cur = sl[i]; if (out.length === 2) break; }
    }
    if (out.length < 2 && cur) out.push(cur); else if (out.length === 2 && i < sl.length) out[1] += '…';
    return out.slice(0, 2);
  }
  // один кадр: phi — угол «камеры» вокруг компании (0 — фронт); w, h — CSS-пиксели
  function kadr(cx, m, w, h, phi, C) {
    cx.clearRect(0, 0, w, h);
    // подписи не выходят за холст: ширина подписи lw, кольцо — что осталось; название компании — строкой сверху
    var n = m.uzly.length, lw = Math.min(170, w * 0.3), ox = w / 2, oy = h / 2 + 14, rx = Math.max(24, Math.min(w / 2 - lw - 22, 300)), ry = Math.min(h * 0.34, 120);
    var P = m.uzly.map(function (u, i) {
      var a = phi + (i + 0.5) * 6.2832 / n, z = Math.cos(a); // z: 1 — ближе к зрителю
      return { u: u, x: ox + rx * Math.sin(a), y: oy + ry * z * 0.75, z: z, s: 0.8 + 0.2 * (z + 1) / 2 }; // ближние — ниже: камера чуть сверху
    });
    P.sort(function (a, b) { return a.z - b.z; });
    cx.lineWidth = 1.5;
    P.forEach(function (p) { // нити
      cx.globalAlpha = 0.35 + 0.45 * (p.z + 1) / 2;
      cx.strokeStyle = p.u.ton === 'neutral' ? C.muted : C[p.u.ton];
      cx.beginPath(); cx.moveTo(ox, oy); cx.lineTo(p.x, p.y); cx.stroke();
    });
    cx.globalAlpha = 1;
    // компания
    cx.fillStyle = C.surface; cx.strokeStyle = C.accent; cx.lineWidth = 2;
    cx.beginPath(); cx.arc(ox, oy, 22, 0, 6.2832); cx.fill(); cx.stroke();
    cx.textAlign = 'center'; cx.textBaseline = 'top';
    cx.font = '600 14px ' + C.font; cx.fillStyle = C.ink;
    stroki(cx, m.centr.zag, w - 32)[0] && cx.fillText(stroki(cx, m.centr.zag, w - 32)[0], ox, 10);
    P.forEach(function (p) {
      var al = 0.45 + 0.55 * (p.z + 1) / 2, lev = p.x < ox - 4, x = p.x + (lev ? -12 : 12) * p.s;
      cx.globalAlpha = al;
      cx.fillStyle = p.u.ton === 'neutral' ? C.muted : C[p.u.ton];
      cx.beginPath(); cx.arc(p.x, p.y, 6 * p.s, 0, 6.2832); cx.fill();
      cx.textAlign = lev ? 'right' : 'left'; cx.textBaseline = 'middle';
      cx.font = '500 11px ' + C.font; cx.fillStyle = C.muted;
      cx.fillText(stroki(cx, p.u.zag, lw)[0], x, p.y - 15);
      cx.font = '500 13px ' + C.font; cx.fillStyle = C.ink;
      stroki(cx, p.u.znach, lw).forEach(function (t, j) { cx.fillText(t, x, p.y + 1 + j * 15); });
    });
    cx.globalAlpha = 1;
  }

  // ---------- панель ----------
  function el(t, c, txt) { var e = d.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function spisok(m) {
    var ul = el('ul', 'svz__sp');
    m.uzly.forEach(function (u) {
      var li = el('li', 'svz__u svz__u--' + u.ton);
      li.appendChild(el('span', 'svz__zag', u.zag));
      li.appendChild(el('b', 'svz__zn', u.znach));
      if (u.pod) li.appendChild(el('small', 'svz__pod', u.pod));
      ul.appendChild(li);
    });
    return ul;
  }
  function panel(rep) {
    if (rep.dlkSvzPanel) return rep.dlkSvzPanel;
    var m = rep.dlkSvz, p = el('div', 'svz'), cv = el('canvas', 'svz__cv'), cx = cv.getContext && cv.getContext('2d');
    cv.setAttribute('aria-hidden', 'true');
    var kn = el('button', 'svz__kn', 'Показать граф'); kn.type = 'button'; kn.setAttribute('aria-expanded', 'false');
    p.appendChild(kn); if (cx) p.appendChild(cv); p.appendChild(spisok(m));
    if (!cx) kn.hidden = true;
    var phi = 0, cel = 0, idet = 0, C = null, w = 0, h = 0;
    function razmer() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2, W.devicePixelRatio || 1);
      w = Math.round(r.width); h = Math.round(r.height);
      if (!w || !h) return false;
      cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    function risovat() { if (cx && p.isConnected && (w || razmer())) { C = C || cveta(p); kadr(cx, m, w, h, phi, C); } }
    function petlya() {
      if (idet) return;
      idet = W.requestAnimationFrame(function shag() {
        var dl = cel - phi;
        phi += dl * 0.12;
        if (Math.abs(dl) < 0.002) phi = cel;
        risovat();
        idet = phi !== cel && p.isConnected ? W.requestAnimationFrame(shag) : 0;
      });
    }
    // открыть: камера поворачивается вокруг компании на четверть оборота к фронту
    p.svzPusk = function () {
      w = 0; C = null;
      if (!razmer()) return;
      if (tiho) { phi = cel = 0; risovat(); return; }
      phi = -1.5708; cel = 0; petlya();
    };
    p.svzKadr = risovat;
    kn.addEventListener('click', function () {
      var on = p.classList.toggle('svz--graf');
      kn.setAttribute('aria-expanded', on ? 'true' : 'false');
      kn.textContent = on ? 'Скрыть граф' : 'Показать граф';
      if (on) p.svzPusk();
    });
    if (!tiho && W.matchMedia && W.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      cv.addEventListener('pointermove', function (e) {
        var r = cv.getBoundingClientRect();
        cel = ((e.clientX - r.left) / r.width - 0.5) * 0.9; petlya();
      }, { passive: true });
      cv.addEventListener('pointerleave', function () { cel = 0; petlya(); });
    }
    W.addEventListener('resize', function () { if (p.isConnected) { w = 0; risovat(); } });
    if (W.MutationObserver) new W.MutationObserver(function () { C = null; risovat(); })
      .observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    rep.dlkSvzPanel = p;
    return p;
  }

  return {
    model: model,
    _kadr: kadr,
    // index.html: после отрисовки отчёта — модель на узел отчёта (повторная проверка — новая модель и новая панель)
    zapomnit: function (rep, r) { if (!rep) return; rep.dlkSvz = model(r); rep.dlkSvzPanel = null; },
    est: function (f) { var rep = f && f.closest && f.closest('.report'); return !!(rep && rep.dlkSvz); },
    // vizual2: оборот «Связи» — панель в оборот; zhivo — вкладку открыли (не замер высоты)
    pokazat: function (spis, f, zhivo) {
      var rep = f.closest('.report'); if (!rep || !rep.dlkSvz) return;
      var p = panel(rep);
      if (p.parentNode !== spis) spis.appendChild(p);
      if (zhivo) p.svzPusk(); else p.svzKadr();
    },
    ubrat: function (spis) { var p = spis.querySelector(':scope > .svz'); if (p) spis.removeChild(p); }
  };
});
