/* Делоскоп — «Папка проверок» в кабинете (claude/Экосистема_удержание_02.10.md, разд. 3: [Ночные-3]).
 * Было: «Мои проверки» — плоский список, каждая проверка отдельной строкой, а счётчик «компаний проверено» считал проверки.
 * Стало: одна строка на компанию (по последней проверке), под ней — все проверки по датам с досье на ту дату;
 * строка «Итог изменился: было … · ДД.ММ.ГГГГ», если две последние проверки разошлись; старше 30 дней — «перед платежом перепроверьте»;
 * поиск по названию и ИНН (больше 5 компаний); «Скачать список (CSV)» — для папки сделки у бухгалтера.
 * Данные — только ответ /api/me/checks, который кабинет уже получает ({inn, name, created_at, risk_level, report_id}); новых запросов нет.
 * Даты — по Москве (UTC+3, без перехода на летнее время). Чистые функции — без DOM, их проверяет tests/papka_proverok.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PapkaProverok = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0';
  var DEN = 864e5, MSK = 3 * 3600e3, STARYJ_DNEJ = 30, POISK_OT = 6, POKAZ = 20;
  var INN_RE = /^\d{10}(\d{2})?$/;
  // те же слова уровня, что в кабинете и в отчёте (222-ФЗ; короткое «Серьёзные сигналы» в кабинете — [Арт-директор] 02.10 20:55)
  var UR = { low: 'Без серьёзных сигналов', medium: 'Есть вопросы', high: 'Серьёзные сигналы' };
  var UR_POLN = { low: 'Без серьёзных сигналов', medium: 'Есть вопросы', high: 'Есть серьёзные сигналы' };
  var PORYADOK = ['high', 'medium', 'low'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mn(n, f1, f2, f5) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f5;
    if (b > 1 && b < 5) return f2;
    if (b === 1) return f1;
    return f5;
  }
  function vremya(s) {
    var t = typeof s === 'number' ? s : Date.parse(String(s || ''));
    return isFinite(t) && t > 0 ? t : NaN;
  }
  // ДД.ММ.ГГГГ по Москве
  function data(t) {
    var d = new Date(t + MSK);
    return ('0' + d.getUTCDate()).slice(-2) + '.' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '.' + d.getUTCFullYear();
  }
  function dnej(t, now) {
    var a = Math.floor((t + MSK) / DEN), b = Math.floor((now + MSK) / DEN);
    return Math.max(0, b - a);
  }

  // rows — ответ /api/me/checks. → [{inn, nm, vse:[{t, lvl, id}] (новые сверху), izm:{bylo, t}|null}], новые компании сверху
  function sobrat(rows) {
    var po = {};
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r) return;
      var inn = String(r.inn || '').trim(), t = vremya(r.created_at);
      if (!INN_RE.test(inn) || /^0+$/.test(inn) || !isFinite(t)) return;
      var b = po[inn] || (po[inn] = { inn: inn, nm: '', vse: [] });
      var nm = String(r.name || '').trim().slice(0, 160);
      b.vse.push({ t: t, lvl: UR[r.risk_level] ? r.risk_level : '', id: r.report_id ? String(r.report_id) : '', nm: nm });
    });
    return Object.keys(po).map(function (k) {
      var b = po[k];
      b.vse.sort(function (x, y) { return y.t - x.t; });
      for (var i = 0; i < b.vse.length && !b.nm; i++) b.nm = b.vse[i].nm;
      b.vse.forEach(function (x) { delete x.nm; });
      // изменение итога — только между двумя последними проверками, у которых итог известен
      var izv = b.vse.filter(function (x) { return x.lvl; });
      b.izm = izv.length > 1 && b.vse[0].lvl && izv[0] === b.vse[0] && izv[1].lvl !== izv[0].lvl ? { bylo: izv[1].lvl, t: izv[1].t } : null;
      return b;
    }).sort(function (a, b) { return b.vse[0].t - a.vse[0].t; });
  }

  // {t, staryj, pred}: «последняя — сегодня · 02.10.2026» | «последняя — 12.08.2026» + отдельной строкой «Сведения на 12.08.2026 — перед платежом перепроверьте»
  function kogda(t, now) {
    var n = dnej(t, now), d = data(t);
    if (n > STARYJ_DNEJ) return { staryj: true, t: 'последняя — ' + d, pred: 'Сведения на' + NB + d + ' — перед платежом перепроверьте' };
    return { staryj: false, t: 'последняя — ' + (n === 0 ? 'сегодня' : n === 1 ? 'вчера' : n + NB + mn(n, 'день', 'дня', 'дней') + ' назад') + ' · ' + d };
  }

  function najti(gruppy, q) {
    q = String(q || '').trim().toLowerCase().replace(/ё/g, 'е');
    if (!q) return gruppy;
    var cif = q.replace(/\D/g, '');
    return gruppy.filter(function (g) {
      return (cif && cif.length >= 3 && g.inn.indexOf(cif) >= 0) || g.nm.toLowerCase().replace(/ё/g, 'е').indexOf(q) >= 0;
    });
  }

  function svetofor(gruppy) {
    var c = { high: 0, medium: 0, low: 0 };
    gruppy.forEach(function (g) { var l = g.vse[0].lvl; if (l) c[l]++; });
    return PORYADOK.filter(function (k) { return c[k]; }).map(function (k) {
      return '<span class="pp__s pp__s--' + k + '"><b class="n">' + c[k] + '</b>' + NB + '— ' + UR_POLN[k].toLowerCase() + '</span>';
    }).join(' · ');
  }

  function pill(l) { return '<span class="pill ' + (UR[l] ? l : 'none') + '">' + (UR[l] || 'Итог не сохранён') + '</span>'; }
  function dosje(id, tekst) { return id ? '<a href="/report.html?id=' + encodeURIComponent(id) + '">' + tekst + '</a>' : ''; }

  function stroka(g, now) {
    var p = g.vse[0], k = kogda(p.t, now), n = g.vse.length;
    var izm = g.izm ? '<p class="pp__izm">Итог изменился: было «' + UR_POLN[g.izm.bylo] + '» · ' + data(g.izm.t) + '</p>' : '';
    var ist = n > 1 ? '<details class="pp__ist"><summary>Все проверки — ' + n + '</summary><ol>' + g.vse.map(function (x) {
      return '<li><span class="n">' + data(x.t) + '</span>' + pill(x.lvl) + (x.id ? dosje(x.id, 'Досье на' + NB + data(x.t)) : '<span class="pp__bez">досье не сохранено</span>') + '</li>';
    }).join('') + '</ol></details>' : '';
    return '<li class="pp__r" data-inn="' + g.inn + '"><div class="nm"><b>' + esc(g.nm || ('ИНН ' + g.inn)) + '</b>' +
      '<span>ИНН' + NB + '<span class="n">' + g.inn + '</span> · ' + n + NB + mn(n, 'проверка', 'проверки', 'проверок') + ', ' +
      '<span class="n">' + k.t + '</span></span>' + (k.staryj ? '<p class="pp__star">' + k.pred + '</p>' : '') + izm + '</div>' + pill(p.lvl) +
      '<div class="acts">' + dosje(p.id, 'Досье') + '<a href="/?inn=' + encodeURIComponent(g.inn) + '">Проверить снова</a></div>' + ist + '</li>';
  }

  // Шапка блока (светофор, поиск, CSV) — один раз; список — отдельно, чтобы поиск не сбрасывал фокус поля.
  function shapka(gruppy) {
    var n = gruppy.length;
    if (!n) return '';
    var sv = svetofor(gruppy);
    return (sv ? '<p class="pp__sv">' + sv + '</p><p class="pp__nb">По последней проверке каждой компании, а' + NB + 'не' + NB + 'на' + NB + 'сегодня.</p>' : '') +
      '<div class="pp__inst">' + (n >= POISK_OT ? '<input type="search" class="pp__q" data-pp-q placeholder="Название или ИНН" aria-label="Найти в папке проверок">' : '') +
      '<button type="button" class="btn pp__csv" data-pp-csv>Скачать список (CSV)</button></div>';
  }
  function spisok(gruppy, now, opt) {
    opt = opt || {};
    var vid = opt.vse ? gruppy : gruppy.slice(0, POKAZ);
    if (!gruppy.length) return opt.q ? '<p class="pp__pusto">Ничего не нашли. Проверьте название или первые цифры ИНН.</p>' : '';
    return '<ul class="list pp__list">' + vid.map(function (g) { return stroka(g, now); }).join('') + '</ul>' +
      (gruppy.length > vid.length ? '<button type="button" class="btn pp__vse" data-pp-vse>Показать все ' + gruppy.length + '</button>' : '');
  }

  // CSV для Excel: «;», BOM, по одной строке на проверку, новые сверху. Ссылка на досье — полным адресом.
  function csv(gruppy, origin) {
    function pole(s) { s = String(s == null ? '' : s); if (/^[=+\-@]/.test(s)) s = "'" + s; // формулы Excel из названия — текстом
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
    var vse = [];
    gruppy.forEach(function (g) { g.vse.forEach(function (x) { vse.push({ g: g, x: x }); }); });
    vse.sort(function (a, b) { return b.x.t - a.x.t; });
    var o = String(origin || 'https://deloskop.ru').replace(/\/+$/, '');
    return '\ufeff' + ['Дата проверки (МСК)', 'Компания', 'ИНН', 'Итог проверки', 'Досье'].join(';') + '\r\n' +
      vse.map(function (v) {
        // ИНН — как текст (="…"), иначе Excel съест ведущий ноль и покажет 7,7E+09
        return [data(v.x.t), pole(v.g.nm), '="' + v.g.inn + '"', pole(UR_POLN[v.x.lvl] || 'Итог не сохранён'),
          v.x.id ? o + '/report.html?id=' + encodeURIComponent(v.x.id) : ''].join(';');
      }).join('\r\n') + '\r\n';
  }
  function imyaFajla(now) { return 'deloskop-proverki-' + data(now).split('.').reverse().join('-') + '.csv'; }

  var CSS = '.pp__sv{margin:14px 0 0;font-size:14px;color:var(--ink2)}.pp__s .n{font-weight:600}' +
    '.pp__s--high .n{color:var(--bad)}.pp__s--medium .n{color:var(--warn)}.pp__s--low .n{color:var(--ok)}' +
    '.pp__nb{margin:2px 0 0;font-size:12.5px;color:var(--muted)}' +
    '.pp__inst{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.pp__q{flex:1 1 220px;min-height:44px;border:1px solid #D9D9D4;border-radius:12px;padding:0 14px;font:inherit;font-size:16px;background:#fff;color:var(--ink)}' +
    '.pp__q:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}' +
    '.pp__sv .n,.pp__r .n,.pp__ist .n{font-variant-numeric:tabular-nums}.pp__r{align-items:flex-start!important}.pp__r>.pill{margin-top:2px}.pp__r .acts{margin-top:2px}' +
    '.pp__star{margin:4px 0 0;font-size:13px;color:var(--warn)}.pp__izm{margin:4px 0 0;font-size:13px;color:var(--warn)}' +
    'ul.list .pp__r{flex-wrap:wrap}.pp__ist{flex:1 1 100%;margin-top:-6px;font-size:13px}.pp__ist summary{cursor:pointer;color:var(--accent);min-height:28px;display:inline-flex;align-items:center}' +
    '.pp__ist ol{list-style:none;margin:6px 0 0;padding:0}.pp__ist li{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}' +
    '.pp__ist li .pill{font-size:12px;padding:2px 8px}.pp__bez{color:var(--muted)}' +
    '.pp__vse{margin-top:12px}.pp__pusto{color:var(--muted);padding:14px 0 2px;border-top:1px solid var(--line);margin-top:14px}' +
    '@media (max-width:560px){ul.list.pp__list .pp__r .nm{flex:1 1 100%}ul.list.pp__list .nm b{white-space:normal}.pp__r>.pill{margin-top:0}}';

  // Браузер: el — контейнер секции «Папка проверок». rows — ответ /api/me/checks.
  function mount(el, rows, opt) {
    opt = opt || {};
    if (!el) return [];
    var doc = el.ownerDocument || document, now = opt.now || Date.now();
    if (!doc.getElementById('pp-css')) { var s = doc.createElement('style'); s.id = 'pp-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s); }
    var gruppy = sobrat(rows), st = { q: '', vse: false };
    el.innerHTML = '<div data-pp-shapka>' + shapka(gruppy) + '</div><div data-pp-spisok></div>';
    var sp = el.querySelector('[data-pp-spisok]');
    function ris() { sp.innerHTML = spisok(najti(gruppy, st.q), now, st); }
    ris();
    var q = el.querySelector('[data-pp-q]');
    if (q) q.addEventListener('input', function () { st.q = q.value; ris(); });
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-pp-vse]')) { st.vse = true; ris(); return; }
      if (!e.target.closest('[data-pp-csv]')) return;
      try {
        var blob = new Blob([csv(najti(gruppy, st.q), location.origin)], { type: 'text/csv;charset=utf-8' });
        var a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = imyaFajla(Date.now());
        doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        if (window.dlkGoal) window.dlkGoal('papka_csv', { n: gruppy.length });
      } catch (err) {}
    });
    return gruppy;
  }

  return { sobrat: sobrat, kogda: kogda, data: data, najti: najti, svetofor: svetofor, shapka: shapka, spisok: spisok, csv: csv, imyaFajla: imyaFajla, mount: mount, UR: UR, CSS: CSS };
});
