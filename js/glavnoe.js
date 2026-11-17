/* Делоскоп — «Главное» на первом экране отчёта (pervyj-ekran-otcheta-v1; план команды 18.11, разд. 3 пп. 1–2 и разд. 4:
 * «ответ на первом экране телефона», «сумма с масштабом к выручке»).
 * Замер 18.11 (Магнит, 1280×800 и 390×844): «Плюсы и минусы» начинались на 2-м экране компьютера и на 3-м телефона —
 * на первом экране были название, реквизиты проверки и кольцо Индекса, но ни одного факта.
 * Что: под названием компании (на компьютере — в пустой левой половине шапки, рядом с реквизитами; на телефоне — под строкой
 * «Ответ») — до трёх главных фактов и, если есть, одна строка мелкого. Строки — те же слова, что в «Плюсах и минусах»
 * (js/plyusy-minusy.js, слова юриста 16–17.11), новых утверждений нет. К каждой сумме (иски, приставы, недоимка) — доля от
 * выручки последнего года ГИР БО, как в «Деньгах на кону» (правило юриста 12.11 п. 3: нет выручки, отчёт старше двух лет
 * или банк — доли нет).
 * Порядок — по весу, а не по порядку источников: статус, банкротство, приостановки, РНП, обеспечительные меры, недостоверность —
 * всегда первыми; суммы от 10 % выручки — тоже; суммы меньше 0,1 % выручки — не в главном, а одной строкой «мелкое» внизу;
 * свободные места — плюсы. Внизу — ссылка ко всем плюсам и минусам (их число).
 * Те же доли подписываются и в строках «Плюсов и минусов» (podpisatDoli).
 * Чистые функции sobrat и html — без DOM и сети, их проверяет tests/glavnoe.test.js. Своя компания (Щит) — без блока. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkGlavnoe = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var MAKS = 3;          // главных строк
  var MELKO = 0.001;     // меньше 0,1 % выручки — «мелкое» (план 18.11, разд. 3 п. 2)
  var KRUPNO = 0.1;      // от 10 % — вес как у статуса (порог «Денег на кону»: srednyaya)
  // минусы без суммы, которые решают про деньги сразу (как начало PORYADOK_M в js/plyusy-minusy.js)
  var TYAZHELYE = ['status', 'damia_bankrotstvo', 'damia_priostanovki', 'damia_rnp', 'damia_mery', 'address'];

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(v) { var n = Number(v); return v !== null && v !== '' && v !== undefined && isFinite(n) ? n : null; }
  function ip(r) { var c = (r && r.company) || {}; return c.kind === 'INDIVIDUAL' || String(c.inn || '').replace(/\D/g, '').length === 12; }
  function bank(r) { return /^64\.1(\.|\d|$)/.test(String(((r && r.company) || {}).okved || '')); }
  function godNa(r, segodnya) {
    var d = r && r.checked_at ? new Date(r.checked_at) : null;
    return (d && !isNaN(d) ? d : segodnya || new Date()).getFullYear();
  }

  // Выручка для масштаба — та же, что в «Деньгах на кону»: dengi.vyruchka (после сверки js/istochniki.js), не старше двух лет
  function vyruchka(r, segodnya) {
    if (!r || ip(r) || bank(r)) return null;
    var V = r.dengi && r.dengi.vyruchka, s = V && num(V.summa), g = V && num(V.god);
    if (!(s > 0) || !g || godNa(r, segodnya) - g > 2) return null;
    return { summa: s, god: g };
  }

  // Сумма за строкой «Плюсов и минусов» (только минусы с деньгами)
  function summa(r, k) {
    var dm = (r && r.damia) || {}, dn;
    if (k === 'damia_sudy') { dn = (dm.sudy && dm.sudy.dannye) || {}; return num(dn.otvetchik_summa_nezaversheno); }
    if (k === 'damia_fssp') { dn = (dm.fssp && dm.fssp.dannye) || {}; return num(dn.ostatok); }
    if (k === 'tax_debt') {
      var s = (r.dengi && Array.isArray(r.dengi.sostavlyayushchie) ? r.dengi.sostavlyayushchie : []).filter(function (x) { return x && x.vid === 'nedoimka'; })[0];
      return s ? num(s.summa) : null;
    }
    return null;
  }

  function procent(d) {
    var p = d * 100;
    if (p < 1) return (Math.round(p * 10) / 10).toFixed(1).replace('.', ',');
    return String(Math.round(p));
  }
  // «меньше 0,1 % выручки за 2024 год» · «0,6 % выручки за 2024 год» · «12 % выручки…» · «больше выручки за 2024 год»
  function dolyaTekst(d, god) {
    var za = ' выручки за' + NB + god + NB + 'год';
    if (d < MELKO) return 'меньше 0,1' + NB + '%' + za;
    if (d >= 1) return 'больше' + za;
    return procent(d) + NB + '%' + za;
  }

  // sobrat(r, segodnya, PM) → { glavnoe: [{znak, t, ist, data, k, dolya}], melkoe: [...], plyusov, minusov } или null
  function sobrat(r, segodnya, PM) {
    PM = PM || (typeof self !== 'undefined' ? self.PlyusyMinusy : null);
    if (!PM || !r || !r.company) return null;
    var S = PM.sobrat(r, segodnya);
    if (!S || (!S.plyusy.length && !S.minusy.length)) return null;
    var V = vyruchka(r, segodnya);
    var M = S.minusy.map(function (x, i) {
      var sm = summa(r, x.k), d = V && sm > 0 ? sm / V.summa : null;
      var ves = TYAZHELYE.indexOf(x.k) >= 0 ? 3 : d == null ? 2 : d >= KRUPNO ? 3 : d >= MELKO ? 2 : 0;
      return { znak: 'minus', k: x.k, t: x.t, ist: x.ist, data: x.data, dolya: d != null ? dolyaTekst(d, V.god) : '', ves: ves, i: i };
    }).sort(function (a, b) { return b.ves - a.ves || a.i - b.i; });
    var glavnoe = M.filter(function (x) { return x.ves > 0; }).slice(0, MAKS);
    var melkoe = M.filter(function (x) { return x.ves === 0; });
    S.plyusy.slice(0, Math.max(0, MAKS - glavnoe.length)).forEach(function (x) {
      glavnoe.push({ znak: 'plus', k: x.k, t: x.t, ist: x.ist, data: x.data, dolya: '' });
    });
    // «тяжёлых» минусов больше трёх — остальные не прячем: счётчик внизу ведёт ко всем
    glavnoe.forEach(function (x) { delete x.ves; delete x.i; });
    melkoe.forEach(function (x) { delete x.ves; delete x.i; });
    return { glavnoe: glavnoe, melkoe: melkoe, plyusov: S.plyusy.length, minusov: S.minusy.length };
  }

  function skl(n, a, b, c) { var k = Math.abs(n) % 100, d = k % 10; return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }
  // тире не переносится в начало строки: «компании — 180 млн ₽»
  function tire(t) { return esc(t).replace(/ — /g, NB + '— '); }
  function stroka(x) {
    var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
    return '<li class="gl1__s gl1__s--' + x.znak + '" data-gl="' + esc(x.k) + '"><span class="gl1__t">' + tire(x.t) +
      (x.dolya ? ' <span class="gl1__d">(' + esc(x.dolya) + ')</span>' : '') + '</span>' +
      (meta ? '<small>' + esc(meta) + '</small>' : '') + '</li>';
  }
  function html(G) {
    if (!G || (!G.glavnoe.length && !G.melkoe.length)) return '';
    var m = G.melkoe, ml = '';
    if (m.length) {
      ml = '<p class="gl1__m"><span>Мелкое к' + NB + 'выручке:</span> ' + tire(m[0].t) + (m[0].dolya ? ' (' + esc(m[0].dolya) + ')' : '') +
        (m.length > 1 ? ' и' + NB + 'ещё ' + (m.length - 1) : '') + '</p>';
    }
    var vse = 'Все плюсы и' + NB + 'минусы: ' + G.plyusov + NB + 'и' + NB + G.minusov + NB + '↓';
    return '<section class="gl1" aria-labelledby="gl1-h" data-glavnoe="' + G.glavnoe.length + '" data-melkoe="' + m.length + '">' +
      '<h2 id="gl1-h" class="gl1__h">Главное</h2>' +
      '<ul class="gl1__l">' + G.glavnoe.map(stroka).join('') + '</ul>' + ml +
      '<a class="gl1__vse" href="#pm-h" aria-label="' + esc('Все плюсы и минусы: ' + G.plyusov + ' ' + skl(G.plyusov, 'плюс', 'плюса', 'плюсов') +
        ' и ' + G.minusov + ' ' + skl(G.minusov, 'минус', 'минуса', 'минусов')) + '">' + vse + '</a>' +
      '</section>';
  }

  var CSS =
    '.gl1{margin:16px 0 0;padding:14px 0 0;border-top:1px solid var(--line,#E3DDCD);max-width:560px}' +
    '.gl1__h{margin:0 0 6px;font-size:13px;line-height:1.4;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#5B6783)}' +
    '.gl1__l{list-style:none;margin:0;padding:0}' +
    '.gl1__s{position:relative;padding:5px 0 5px 22px}' +
    '.gl1__s::before{position:absolute;left:2px;top:5px;font-weight:600;line-height:1.4;font-size:15px}' +
    '.gl1__s--plus::before{content:"+";color:var(--mat-zhdu,#7A5C14)}' +
    '.gl1__s--minus::before{content:"\\2212";color:var(--ink,#0B1B3A)}' +
    '[data-theme=dark] .gl1__s--plus::before{color:var(--mat-zhdu-t,#D9B45A)}' +
    '.gl1__t{display:block;font-size:15px;line-height:1.4}' +
    '.gl1__d{font-variant-numeric:tabular-nums;color:var(--ink-2,#3A4868)}' +
    '.gl1__s small{display:block;font-size:12px;line-height:1.4;color:var(--muted,#5B6783)}' +
    '.gl1__m{margin:4px 0 0;padding-left:22px;font-size:13px;line-height:1.5;color:var(--muted,#5B6783)}' +
    '.gl1__m span{font-weight:600;color:var(--ink-2,#3A4868)}' +
    '.gl1__vse{display:inline-block;margin:8px 0 0 22px;font-size:13px;line-height:1.4;color:var(--ink,#0B1B3A);text-decoration:underline;' +
      'text-decoration-color:var(--line,#E3DDCD);text-underline-offset:.2em}' +
    '.gl1__vse:hover{text-decoration-color:currentColor}' +
    '.pm__d{font-weight:400;font-variant-numeric:tabular-nums;color:var(--ink-2,#3A4868)}.pm{scroll-margin-top:96px}' +
    '@media (max-width:640px){.gl1{margin-top:12px;padding-top:12px}.gl1__vse{padding:12px 0;margin-top:0}}' +
    '@media print{.gl1__vse{display:none}}';

  function stil(doc) {
    if (!doc || doc.getElementById('gl1-css')) return;
    var s = doc.createElement('style'); s.id = 'gl1-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Доли — и в строках «Плюсов и минусов» (план 18.11, разд. 3 п. 2: «каждая сумма рядом с долей от выручки»)
  function podpisatDoli(report, r, segodnya) {
    var V = vyruchka(r, segodnya);
    if (!report || !V) return 0;
    var n = 0;
    ['damia_sudy', 'damia_fssp', 'tax_debt'].forEach(function (k) {
      var li = report.querySelector('.pm__k--minus li[data-pm="' + k + '"]'), sm = summa(r, k);
      if (!li || !(sm > 0) || li.querySelector('.pm__d')) return;
      var t = li.querySelector('.pm__t');
      if (!t) return;
      var b = report.ownerDocument.createElement('span');
      b.className = 'pm__d';
      b.textContent = ' (' + dolyaTekst(sm / V.summa, V.god) + ')';
      t.appendChild(b);
      n++;
    });
    return n;
  }

  // mount(report, r) — после PlyusyMinusy.mount: в шапку листа (.ot-who), под название и строку «Ответ»
  function mount(report, r, o) {
    o = o || {};
    if (!report || !r) return null;
    var who = report.querySelector('.ot-hd .ot-who'), star = report.querySelector('.gl1');
    if (star && star.parentNode) star.parentNode.removeChild(star);
    var doc = report.ownerDocument;
    try { stil(doc); podpisatDoli(report, r); } catch (e) {}
    var h = who ? html(sobrat(r)) : '';
    if (!h) return null;
    var t = doc.createElement('div');
    t.innerHTML = h;
    var nov = t.firstChild;
    who.appendChild(nov);
    var a = nov.querySelector('.gl1__vse'), pm = report.querySelector('.pm');
    if (a && !pm) a.parentNode.removeChild(a);
    else if (a) a.addEventListener('click', function (e) {
      e.preventDefault();
      try { pm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) { pm.scrollIntoView(); }
      try { if (self.dlkGoal) self.dlkGoal('glavnoe_vse'); } catch (x) {}
    });
    return nov;
  }

  return { sobrat: sobrat, html: html, mount: mount, stil: stil, podpisatDoli: podpisatDoli, dolyaTekst: dolyaTekst, vyruchka: vyruchka,
    summa: summa, CSS: CSS, MAKS: MAKS, MELKO: MELKO, KRUPNO: KRUPNO };
});
