/*
 * Делоскоп — «Сравнить двух поставщиков» (sravnit-v1; ТЗ команды 23.10, Ф2).
 * Страница /sravnit/?a=ИНН&b=ИНН (и /?inn=A&vs=B — главная переадресует сюда).
 *
 * Две проверки /api/check — те же, что на главной (из 10 бесплатных в день уходят 2; говорим это до запроса).
 * Строки: Индекс, статус, возраст, выручка и её ход, недоимка, суды, прогноз ЗСК, предел предоплаты, вывод «Что делать».
 * Всё — из ответов API и тех же модулей отчёта (IndeksOtvet, Usloviya, StatusKod, Sushchestvennoe): ни одного нового
 * утверждения, которого нет в отчёте каждой компании. «Не проверяли» ≠ «не нашли» — пишем как есть.
 * Строки, где компании расходятся (разный тон или Индекс отличается на 10 и больше), подсвечены.
 * Итог — одна фраза-подсчёт отметок «внимание» и «серьёзно», без оценки «кто лучше».
 * ИП в сравнение не берём — сообщаем до запроса, проверки не тратим. Текст отказа — [команда] 23.10: «Сравнивать можно только организации.»
 * (без объяснения «не публикуем»: основной отчёт по ИНН ИП что-то показывает — объяснение стало бы неправдой).
 * «Не проверяли» в подсчёт не входит; рядом — сколько строк не проверено у каждой ([команда] 23.10, ✎ 08:55).
 *
 * Чистые функции (stroki, itog, proverit) проверяет tests/sravnenie.test.js; mount — только на странице.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkSravnenie = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var NB = ' ';
  var TON_USL = { go: 'ok', cap: 'warn', post: 'warn', stop: 'bad' };
  var ST = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  var IP_TEKST = 'Сравнивать можно только организации.';
  var DVE = 'Сравнение — это две проверки: из' + NB + '10 бесплатных в' + NB + 'день уйдут 2.';

  function m(name) { return root && root[name] ? root[name] : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (q) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[q]; }); }
  function zaglavnaya(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function cifry(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function skl(n, a, b, c) { var k = n % 100, d = n % 10; return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c; }
  function data(iso) { var x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return x ? x[3] + '.' + x[2] + '.' + x[1] : ''; }
  function dengi(v) {
    var S = m('Sushchestvennoe');
    if (S && S.dengi) return S.dengi(v);
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), s = v < 0 ? '−' : '', f = function (x) { return x.toFixed(1).replace('.', ','); };
    if (a >= 1e12) return s + f(a / 1e12) + NB + 'трлн' + NB + '₽';
    if (a >= 1e9) return s + f(a / 1e9) + NB + 'млрд' + NB + '₽';
    if (a >= 1e6) return s + f(a / 1e6) + NB + 'млн' + NB + '₽';
    if (a >= 1e3) return s + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
    return s + Math.round(a) + NB + '₽';
  }
  function sig(r) { return Array.isArray(r && r.signals) ? r.signals.filter(function (s) { return s && typeof s === 'object'; }) : []; }
  function ton(st) { return st === 'bad' ? 'bad' : st === 'warn' ? 'warn' : st === 'ok' ? 'ok' : 'neutral'; }
  function kpi(r, re) {
    var k = r && r.dossier && Array.isArray(r.dossier.kpi) ? r.dossier.kpi : [];
    for (var i = 0; i < k.length; i++) if (k[i] && re.test(String(k[i].label || ''))) return k[i];
    return null;
  }

  // ---------- проверка ввода (до запроса: проверки не тратим) ----------
  // proverit(a, b) → '' или текст ошибки
  function proverit(a, b) {
    a = cifry(a); b = cifry(b);
    if (!a || !b) return 'Введите ИНН обеих компаний.';
    if (a.length === 12 || b.length === 12) return IP_TEKST;
    var I = m('DlkInn');
    for (var i = 0, x; i < 2; i++) {
      x = i ? b : a;
      if (x.length !== 10) return 'ИНН компании — 10' + NB + 'цифр.';
      if (I && I.ok && !I.ok(x)) return (I.OPECHATKA || 'В ИНН опечатка: не сходится контрольная цифра.');
    }
    if (a === b) return 'Это один и тот же ИНН — введите вторую компанию.';
    return '';
  }

  // ---------- ячейки ----------
  function imya(r) { var c = (r && r.company) || {}; return c.name_short || c.name_full || ('ИНН ' + (c.inn || '')); }

  function yIndeks(r) {
    var IO = m('IndeksOtvet');
    if (r && r.indeks != null && r.indeks !== '') return { t: r.indeks + NB + '/' + NB + '99', ton: 'neutral', ball: +r.indeks };
    var v = IO && IO.vid ? IO.vid(r) : { rezhim: 'net' };
    if (v.rezhim === 'chislo') return { t: v.ball + NB + '/' + NB + '99', pod: v.uroven, ton: v.ton || 'neutral', ball: v.ball };
    if (v.rezhim === 'stop') return { t: 'Стоп-признак', pod: v.stop, ton: 'bad' };
    if (v.rezhim === 'sokr') return { t: 'Данных пока мало', pod: v.polnota != null ? 'собрано ' + v.polnota + NB + '% данных' : '', ton: 'neutral' };
    if (v.rezhim === 'neizv') return { t: 'Не считаем', pod: 'есть сигнал, который методика пока не оценивает', ton: 'neutral' };
    return { t: 'Считаем', pod: 'число — в полном отчёте', ton: 'neutral' };
  }
  function yStatus(r) {
    var c = (r && r.company) || {}, SK = m('StatusKod');
    var t = SK && SK.izOtveta ? SK.izOtveta(c) : (ST[c.status] || c.status || '');
    return { t: zaglavnaya(t) || 'Нет в ответе', ton: !c.status ? 'neutral' : c.status === 'ACTIVE' ? 'ok' : c.status === 'REORGANIZING' ? 'warn' : 'bad' };
  }
  function yVozrast(r, sejchas) {
    var c = (r && r.company) || {}, x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(c.reg_date || ''));
    if (!x) return { t: 'Нет в ответе', ton: 'neutral' };
    var d = new Date(sejchas || Date.now()), mes = (d.getFullYear() - +x[1]) * 12 + (d.getMonth() + 1 - +x[2]) - (d.getDate() < +x[3] ? 1 : 0);
    var g = Math.floor(mes / 12);
    var t = mes < 1 ? 'меньше месяца' : mes < 12 ? mes + NB + skl(mes, 'месяц', 'месяца', 'месяцев') : g + NB + skl(g, 'год', 'года', 'лет');
    return { t: zaglavnaya(t), pod: 'с' + NB + data(c.reg_date), ton: mes < 12 ? 'warn' : 'neutral', mes: mes };
  }
  function yVyruchka(r) {
    var k = kpi(r, /^Выручка за \d{4}/);
    if (!k || k.value == null || !isFinite(Number(k.value))) return { t: 'Нет в ответе', pod: 'бухотчётности за прошлый год нет', ton: 'neutral', net: true };
    var god = (/(\d{4})/.exec(k.label) || [])[1];
    var dl = k.delta != null && isFinite(Number(k.delta)) ? Number(k.delta) : null;
    var pod = (god ? 'за ' + god + NB + 'год' : '') + (dl != null ? (god ? ' · ' : '') + (dl > 0 ? '+' : dl < 0 ? '−' : '') + Math.abs(dl) + NB + '% к' + NB + 'прошлому' : '');
    return { t: dengi(Number(k.value)), pod: pod, ton: 'neutral' };
  }
  function yNedoimka(r) {
    var s = sig(r).filter(function (x) { return /задолженност.*налог|недоимк/i.test(String(x.title || '')); })[0];
    if (s) return { t: zaglavnaya(s.detail || (s.status === 'ok' ? 'Нет' : 'Есть')), ton: ton(s.status) };
    var k = kpi(r, /Долг перед бюджетом/);
    if (k) return k.value ? { t: dengi(Number(k.value)), ton: 'warn' } : { t: zaglavnaya(k.text || 'Нет'), ton: k.text === 'Нет' ? 'ok' : 'neutral' };
    return { t: 'Не проверяли', pod: 'свежего набора ФНС в ответе нет', ton: 'neutral', nepr: true };
  }
  function ySudy(r) {
    var s = r && r.damia && r.damia.sudy;
    if (!s || s.status !== 'polucheno' || !s.dannye) return { t: 'Не проверяли', pod: 'проверьте сами в картотеке kad.arbitr.ru', ton: 'neutral', nepr: true };
    var d = s.dannye, n = +d.otvetchik_nezaversheno || 0, v = +d.vsego || 0;
    var t = n ? 'Ответчик в' + NB + n + NB + skl(n, 'незавершённом деле', 'незавершённых делах', 'незавершённых делах') : 'Незавершённых дел ответчиком нет';
    return { t: t, pod: 'всего дел: ' + v + (s.data_svedeniy ? ' · на' + NB + data(s.data_svedeniy) : ''), ton: n ? 'warn' : 'ok' };
  }
  function yZsk(r) {
    var z = r && r.zsk;
    if (!z || !z.level) return { t: 'Не считали', ton: 'neutral', nepr: true };
    return { t: z.title || '', pod: 'наша оценка, не статус Банка России', ton: z.level === 'high' ? 'bad' : z.level === 'medium' ? 'warn' : 'ok' };
  }
  function yUsl(r) {
    var U = m('Usloviya');
    if (!U || !U.decide) return null;
    try { return U.decide(r, {}); } catch (e) { return null; }
  }
  function yPredoplata(u) {
    if (!u) return { t: 'В полном отчёте', ton: 'neutral' };
    if (u.cap > 0) return { t: 'До' + NB + dengi(u.cap), pod: u.capRule || '', ton: TON_USL[u.tone] || 'neutral' };
    return { t: zaglavnaya(u.capRule || 'Не считаем'), ton: TON_USL[u.tone] || 'neutral' };
  }
  function yVyvod(r, u) {
    if (u) return { t: u.headline || '', pod: u.advice || '', ton: TON_USL[u.tone] || 'neutral' };
    return { t: (r && r.verdict) || '', ton: r && r.risk_level === 'low' ? 'ok' : r && r.risk_level === 'high' ? 'bad' : 'warn' };
  }

  // stroki(rA, rB, {sejchas}) → [{k, zag, a:{t,pod,ton}, b:{…}, raznye}]
  function stroki(rA, rB, o) {
    o = o || {};
    var uA = yUsl(rA), uB = yUsl(rB);
    var R = [
      ['indeks', 'Индекс Делоскопа', yIndeks(rA), yIndeks(rB)],
      ['status', 'Статус в ЕГРЮЛ', yStatus(rA), yStatus(rB)],
      ['vozrast', 'Возраст', yVozrast(rA, o.sejchas), yVozrast(rB, o.sejchas)],
      ['vyruchka', 'Выручка и её ход', yVyruchka(rA), yVyruchka(rB)],
      ['nedoimka', 'Долги по налогам', yNedoimka(rA), yNedoimka(rB)],
      ['sudy', 'Арбитражные суды', ySudy(rA), ySudy(rB)],
      ['zsk', 'Прогноз ЗСК', yZsk(rA), yZsk(rB)],
      ['predoplata', 'Сколько платить вперёд', yPredoplata(uA), yPredoplata(uB)],
      ['vyvod', 'Что делать', yVyvod(rA, uA), yVyvod(rB, uB)]
    ];
    // «Расходятся» — только когда оба значения известны и говорят разное: разный тон (ok / warn / bad), Индекс на 10 и больше,
    // возраст по разные стороны года. «Не проверяли» или «нет в ответе» с одной стороны — не расхождение, а пробел в данных.
    return R.map(function (x) {
      var a = x[2], b = x[3], raz = a.ton !== 'neutral' && b.ton !== 'neutral' && a.ton !== b.ton;
      if (x[0] === 'indeks') raz = raz || (a.ball != null && b.ball != null && Math.abs(a.ball - b.ball) >= 10);
      if (x[0] === 'vozrast') raz = a.mes != null && b.mes != null && (a.mes < 12) !== (b.mes < 12);
      return { k: x[0], zag: x[1], a: a, b: b, raznye: raz };
    });
  }

  // отметки «внимание» и «серьёзно»: строки светофора отчёта + прогноз ЗСК не «низкий»
  function otmetki(r) {
    var n = sig(r).filter(function (s) { return s.status === 'warn' || s.status === 'bad'; }).length;
    if (r && r.zsk && (r.zsk.level === 'medium' || r.zsk.level === 'high')) n++;
    return n;
  }
  // itog(rA, rB) → одна фраза из данных, без оценки «лучше»
  function itog(rA, rB) {
    var a = otmetki(rA), b = otmetki(rB), nA = imya(rA), nB = imya(rB);
    var sl = function (n) { return skl(n, 'отметка', 'отметки', 'отметок'); };
    if (a === b) return a ? 'Отметок «внимание» и' + NB + '«серьёзно» поровну: ' + a + ' и' + NB + b + '.'
      : 'Ни в' + NB + 'одном отчёте нет отметок «внимание» и' + NB + '«серьёзно».';
    var men = a < b ? nA : nB, x = Math.min(a, b), y = Math.max(a, b);
    return 'У' + NB + men + ' меньше отметок «внимание» и' + NB + '«серьёзно»: ' + x + ' против ' + y + ' (' + y + NB + sl(y) + ' у' + NB + (a < b ? nB : nA) + ').';
  }

  // neproveno(rA, rB, S?) → '' или фраза: сколько строк сравнения не проверено у каждой компании.
  // Такие строки в подсчёт отметок не входят — «не проверяли» ≠ «не нашли» ([команда] 23.10).
  function neproveno(rA, rB, S) {
    S = S || stroki(rA, rB, {});
    var kA = 0, kB = 0;
    S.forEach(function (x) { if (x.a.nepr) kA++; if (x.b.nepr) kB++; });
    if (!kA && !kB) return '';
    var gl = function (n) { return skl(n, 'не' + NB + 'проверена', 'не' + NB + 'проверены', 'не' + NB + 'проверено'); };
    var st = function (n) { return n + NB + skl(n, 'строка', 'строки', 'строк'); };
    if (kA && kB) return 'Не' + NB + 'проверены строки: у' + NB + imya(rA) + ' — ' + kA + ', у' + NB + imya(rB) + ' — ' + kB + '. В' + NB + 'подсчёт они не' + NB + 'входят.';
    var k = kA || kB;
    return 'У' + NB + (kA ? imya(rA) : imya(rB)) + ' ' + gl(k) + ' ' + st(k) + ' — в' + NB + 'подсчёт они не' + NB + 'входят.';
  }
  // дата сведений для подписи: дата проверки из ответа API (у обеих — один день), иначе сегодня
  function dataSvedenij(rA, rB, o) {
    var d = data(rA && rA.checked_at) || data(rB && rB.checked_at);
    if (d) return d;
    var t = new Date((o && o.sejchas) || Date.now());
    return ('0' + t.getDate()).slice(-2) + '.' + ('0' + (t.getMonth() + 1)).slice(-2) + '.' + t.getFullYear();
  }

  // ---------- вёрстка ----------
  function yachejka(y, cls, n) {
    return '<td class="sv-y sv-y--' + y.ton + (cls ? ' ' + cls : '') + '" data-n="' + esc(n) + '"><b>' + esc(y.t) + '</b>' + (y.pod ? '<span>' + esc(y.pod) + '</span>' : '') + '</td>';
  }
  function html(rA, rB, o) {
    var S = stroki(rA, rB, o), nA = imya(rA), nB = imya(rB);
    var cA = (rA && rA.company) || {}, cB = (rB && rB.company) || {};
    var raz = S.filter(function (x) { return x.raznye; }).length;
    var h = '<div class="sv-tabs" role="tablist" aria-label="Что показать">' +
      '<button type="button" role="tab" aria-selected="false" data-sv-vid="a">' + esc(nA) + '</button>' +
      '<button type="button" role="tab" aria-selected="false" data-sv-vid="b">' + esc(nB) + '</button>' +
      '<button type="button" role="tab" aria-selected="false" data-sv-vid="r">Разница' + (raz ? ' · ' + raz : '') + '</button></div>';
    h += '<div class="sv-tw"><table class="sv-t" data-vid="r"><caption class="sv-cap">Сравнение «' + esc(nA) + '» и «' + esc(nB) + '» на ' + esc(new Date((o && o.sejchas) || Date.now()).toLocaleDateString('ru-RU')) + '</caption>' +
      '<thead><tr><th scope="col"><span class="sv-vh">Строка</span></th>' +
      '<th scope="col" class="sv-a"><a href="/?inn=' + esc(cA.inn) + '">' + esc(nA) + '</a><span>ИНН ' + esc(cA.inn) + '</span></th>' +
      '<th scope="col" class="sv-b"><a href="/?inn=' + esc(cB.inn) + '">' + esc(nB) + '</a><span>ИНН ' + esc(cB.inn) + '</span></th></tr></thead><tbody>';
    S.forEach(function (x) {
      h += '<tr class="sv-r' + (x.raznye ? ' sv-r--raz' : '') + '" data-k="' + x.k + '"><th scope="row">' + esc(x.zag) + (x.raznye ? '<span class="sv-metka">расходятся</span>' : '') + '</th>' +
        yachejka(x.a, 'sv-a', nA) + yachejka(x.b, 'sv-b', nB) + '</tr>';
    });
    if (!raz) h += '<tr class="sv-nol"><td colspan="3">По' + NB + 'этим строкам компании не' + NB + 'расходятся.</td></tr>';
    h += '</tbody></table></div>';
    var np = neproveno(rA, rB, S);
    h += '<p class="sv-itog">' + esc(itog(rA, rB)) + '</p>' + (np ? '<p class="sv-nepr">' + esc(np) + '</p>' : '') +
      '<p class="sv-pod">Считаем строки «внимание» и' + NB + '«серьёзно» в' + NB + 'отчёте каждой компании и' + NB + 'прогноз ЗСК выше «низкого». ' +
      'Это подсчёт отметок по' + NB + 'открытым сведениям на' + NB + esc(dataSvedenij(rA, rB, o)) + ', а' + NB + 'не' + NB + 'оценка компаний. С' + NB + 'кем работать — решаете вы.</p>' +
      '<p class="sv-dal"><a class="sv-btn" href="/?inn=' + esc(cA.inn) + '">Полный отчёт «' + esc(nA) + '»</a><a class="sv-btn" href="/?inn=' + esc(cB.inn) + '">Полный отчёт «' + esc(nB) + '»</a></p>';
    return h;
  }

  // ---------- страница ----------
  function mount(doc) {
    var w = doc.defaultView, form = doc.getElementById('sv-forma');
    if (!form) return;
    var iA = doc.getElementById('sv-a'), iB = doc.getElementById('sv-b'), note = doc.getElementById('sv-note'), out = doc.getElementById('sv-out');
    var CAPI = /(^|\.)deloskop\.ru$/.test(w.location.hostname) ? 'https://api.deloskop.ru' : '';
    var def = note.textContent;
    function cel(c, p) { if (w.dlkGoal) try { w.dlkGoal(c, p); } catch (e) {} }
    function vid(v) {
      var t = out.querySelector('.sv-t'); if (!t) return;
      t.setAttribute('data-vid', v);
      [].forEach.call(out.querySelectorAll('[data-sv-vid]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-sv-vid') === v)); });
    }
    function zapros(inn) {
      return w.fetch(CAPI + '/api/check?q=' + encodeURIComponent(inn), { credentials: 'include' })
        .then(function (res) { return res.json().then(function (j) { return { s: res.status, ok: res.ok, j: j }; }, function () { return { s: res.status, ok: false, j: {} }; }); });
    }
    function sravnit(a, b, izAdresa) {
      var o = proverit(a, b);
      if (o) { note.className = 'sv-note err'; note.textContent = o; return; }
      a = cifry(a); b = cifry(b);
      if (!CAPI) { note.className = 'sv-note'; note.textContent = 'Сравнение работает на deloskop.ru.'; return; }
      if (w.dlkLimit && w.dlkLimit.ubrat) try { w.dlkLimit.ubrat(note); } catch (e) {}
      note.className = 'sv-note'; note.textContent = 'Проверяем обе компании по реестрам…';
      out.setAttribute('aria-busy', 'true'); out.classList.add('sv-zhdu');
      cel('sravnit_start');
      Promise.all([zapros(a), zapros(b)]).then(function (x) {
        out.removeAttribute('aria-busy'); out.classList.remove('sv-zhdu');
        if (x[0].s === 429 || x[1].s === 429) {
          note.className = 'sv-note'; note.textContent = '';
          if (w.dlkLimit) w.dlkLimit.pokazat(note, { stranica: 'sravnit', inn: x[0].s === 429 ? a : b });
          else note.textContent = 'На сегодня бесплатные проверки закончились. Завтра — снова 10.';
          return;
        }
        if (!x[0].ok || !x[1].ok) { note.className = 'sv-note err'; note.textContent = 'Не получилось проверить ' + (!x[0].ok ? 'первую' : 'вторую') + ' компанию. Попробуйте ещё раз.'; return; }
        var rA = x[0].j, rB = x[1].j, I = w.DlkImya;
        if (I && I.ispravitOtvet) { I.ispravitOtvet(rA); I.ispravitOtvet(rB); }
        if (w.dlkLimit && w.dlkLimit.proveren) { w.dlkLimit.proveren(a); w.dlkLimit.proveren(b); }
        var IO = w.IndeksOtvet, gotovo = IO && IO.gotovo ? IO.gotovo : function (f) { f(); };
        gotovo(function () {
          out.innerHTML = html(rA, rB, {});
          // на телефоне — вкладки «A | B | Разница»: открываем «Разницу», если компании где-то расходятся, иначе первую
          vid(out.querySelector('.sv-r--raz') ? 'r' : 'a');
          [].forEach.call(out.querySelectorAll('[data-sv-vid]'), function (bt) { bt.addEventListener('click', function () { vid(bt.getAttribute('data-sv-vid')); }); });
          note.className = 'sv-note ok'; note.textContent = 'Готово. Сравнение — ниже.';
          if (!izAdresa && w.history && w.history.replaceState) try { w.history.replaceState(null, '', '/sravnit/?a=' + a + '&b=' + b); } catch (e) {}
          cel('sravnit_gotovo');
          if (w.innerWidth < 980 && out.scrollIntoView) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }).catch(function () {
        out.removeAttribute('aria-busy'); out.classList.remove('sv-zhdu');
        note.className = 'sv-note err'; note.textContent = 'Сервис не ответил. Проверьте интернет и попробуйте ещё раз.';
      });
    }
    [iA, iB].forEach(function (i) { i.addEventListener('input', function () { note.className = 'sv-note'; note.textContent = def; }); });
    form.addEventListener('submit', function (e) { e.preventDefault(); sravnit(iA.value, iB.value, false); });
    var q = new w.URLSearchParams(w.location.search), a = cifry(q.get('a')), b = cifry(q.get('b'));
    if (a) iA.value = a;
    if (b) iB.value = b;
    if (a && b) sravnit(a, b, true);
    else if (a) iB.focus();
  }
  if (root && root.document && root.addEventListener) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { mount(root.document); });
    else mount(root.document);
  }

  return { proverit: proverit, stroki: stroki, itog: itog, otmetki: otmetki, neproveno: neproveno, html: html, mount: mount, IP_TEKST: IP_TEKST, DVE: DVE };
});
