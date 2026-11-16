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
    // signal-id-v1: по коду признака (tax_debt), без кода — прежним выражением по заголовку
    var U = m('Usloviya') || (typeof module === 'object' && typeof require === 'function' ? (function () { try { return require('./usloviya.js'); } catch (e) { return null; } })() : null);
    var s = sig(r).filter(function (x) {
      var k = U && U.signalId ? U.signalId(x) : null;
      if (k && k.po !== 'tekst') return k.id === 'tax_debt';
      return /задолженност.*налог|недоимк/i.test(String(x.title || ''));
    })[0];
    if (s) return { t: zaglavnaya(s.detail || (s.status === 'ok' ? 'Нет' : 'Есть')), ton: ton(s.status) };
    var k = kpi(r, /Долг перед бюджетом/);
    if (k) return k.value ? { t: dengi(Number(k.value)), ton: 'warn' } : { t: zaglavnaya(k.text || 'Нет'), ton: k.text === 'Нет' ? 'ok' : 'neutral' };
    return { t: 'Не проверяли', pod: 'свежего набора ФНС в ответе нет', ton: 'neutral', nepr: true };
  }
  // doverie-2b (30.10): суды — по единому словарю источников (js/istochniki.js, его dopolnit теперь в пакете /sravnit/).
  // «Дел ответчиком нет» по сведениям старше срока источника (картотека — 7 дней) — не «чисто», а «данные устарели»;
  // найденные дела остаются видны с датой и «могли измениться». Сырой ответ API (polucheno) и дополненный (found / not_found / stale) — одинаково.
  var SUDY_DNEJ = 7;
  function sudyDnej() {
    var I = m('DlkIstochniki') || (typeof module === 'object' && typeof require === 'function' ? (function () { try { return require('./istochniki.js'); } catch (e) { return null; } })() : null);
    return I && I.REESTR && I.REESTR.kad && I.REESTR.kad.ustarelo_dney || SUDY_DNEJ;
  }
  function sudyStaroe(s, r) {
    if (s.ustarelo === true) return true;
    if (s.ustarelo != null) return false;
    var x = Date.parse(String(s.data_svedeniy || '').slice(0, 10)), y = Date.parse(String((r && r.checked_at) || '').slice(0, 10));
    return isFinite(x) && isFinite(y) && Math.floor((y - x) / 864e5) > sudyDnej();
  }
  function ySudy(r) {
    var s = r && r.damia && r.damia.sudy;
    var est = s && s.dannye && /^(polucheno|found|not_found|stale)$/.test(String(s.status || ''));
    if (!est) return { t: 'Не проверяли', pod: (s && s.zamorozhen ? 'источник сейчас не' + NB + 'обновляется — ' : s && s.oshibka ? 'источник не' + NB + 'ответил — ' : '') + 'проверьте сами в картотеке kad.arbitr.ru', ton: 'neutral', nepr: true };
    var d = s.dannye, n = +d.otvetchik_nezaversheno || 0, v = +d.vsego || 0, na = data(s.data_svedeniy), star = sudyStaroe(s, r);
    if (n) return { t: 'Ответчик в' + NB + n + NB + skl(n, 'незавершённом деле', 'незавершённых делах', 'незавершённых делах'),
      pod: 'всего дел: ' + v + (na ? ' · на' + NB + na : '') + (star ? ', могли измениться' : ''), ton: 'warn', ustarelo: star || undefined };
    if (star) return { t: 'Данные устарели', pod: 'сведения на' + NB + na + ' могли измениться — проверьте в' + NB + 'kad.arbitr.ru', ton: 'neutral', nepr: true, ustarelo: true };
    return { t: 'Незавершённых дел ответчиком нет', pod: 'всего дел: ' + v + (na ? ' · на' + NB + na : ''), ton: 'ok' };
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
    if (u.nedostatochno) return { t: 'Не считаем', pod: 'выручка и возраст компании неизвестны', ton: 'neutral', nepr: true };   // doverie-v1: неизвестное — нейтрально
    return { t: zaglavnaya(u.capRule || 'Не считаем'), ton: TON_USL[u.tone] || 'neutral' };
  }
  function yVyvod(r, u) {
    if (u) return { t: u.headline || '', pod: u.advice || '', ton: /^Проверили не всё/.test(u.headline || '') ? 'neutral' : TON_USL[u.tone] || 'neutral' };   // chestnyj-nol-v2
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
    h += '<div class="sv-tw"><table class="sv-t" data-vid="r"><caption class="sv-cap">Сравнение: ' + esc(nA) + ' и\u00a0' + esc(nB) + ' на\u00a0' + esc(new Date((o && o.sejchas) || Date.now()).toLocaleDateString('ru-RU')) + '</caption>' +
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

  // ---------- запрос: срок, повтор, «свежесть» (sravnenie-srok-v1, 16.11.2026) ----------
  // Как главная (skorost-otveta-v1): срок 40 с; обрыв сети или 502/503/504 (перезапуск сервера при выкладке) — один тихий
  // повтор через 1,5 с; после срока — без повтора. Новое сравнение отменяет оба прежних запроса, их ответ таблицу не перерисует.
  // Ошибка не роняет пару: каждый запрос отвечает {ok, s, j, n, tajmaut|set} — человеку говорим, какая компания и почему.
  var SROK_MS = 40000, DOLGO_MS = 12000, POVTOR_MS = 1500, STALO = { stalo: 1 };
  function sozdatZapros(w) {
    var nomer = 0, ac = [];
    function novaya() { ac.forEach(function (c) { try { c.abort(); } catch (e) {} }); ac = []; return ++nomer; }
    function svezhaya(moj) { return moj === nomer; }
    function zapros(u, moj) {
      var popytka = 0;
      function snova() {
        popytka++;
        return new Promise(function (r) { w.setTimeout(r, POVTOR_MS); }).then(function () { if (moj !== nomer) throw STALO; return raz(); });
      }
      function raz() {
        var c = w.AbortController ? new w.AbortController() : null, istek = false, opt = { credentials: 'include' };
        if (c) { ac.push(c); opt.signal = c.signal; }
        var t = c ? w.setTimeout(function () { istek = true; try { c.abort(); } catch (e) {} }, SROK_MS) : 0;
        return w.fetch(u, opt).then(function (res) {
          w.clearTimeout(t); if (moj !== nomer) throw STALO;
          if (/^50[234]$/.test(String(res.status)) && popytka < 1) return snova();
          return res.json().then(function (j) { return { s: res.status, ok: res.ok, j: j || {}, n: popytka }; },
            function () { return { s: res.status, ok: false, j: {}, n: popytka }; });
        }, function (e) {
          w.clearTimeout(t);
          if (e === STALO || moj !== nomer) throw STALO;
          if (istek) return { s: 0, ok: false, j: {}, n: popytka, tajmaut: true };
          if (popytka < 1) return snova();
          return { s: 0, ok: false, j: {}, n: popytka, set: true };
        });
      }
      return raz();
    }
    return { novaya: novaya, svezhaya: svezhaya, zapros: zapros };
  }
  // vid ошибки для цели check_oshibka (как на главной): tajmaut | set | server; 4xx — не ошибка связи, цели нет
  function vidOshibki(y) { return !y || y.ok ? '' : y.tajmaut ? 'tajmaut' : y.set ? 'set' : y.s >= 500 ? 'server' : ''; }
  function prichina(y) {
    var v = vidOshibki(y);
    if (v === 'tajmaut') return 'реестры не ответили за' + NB + Math.round(SROK_MS / 1000) + NB + 'секунд' + NB + '— так бывает, когда источник перегружен';
    if (v === 'set') return 'сервис не ответил, проверьте интернет';
    if (v === 'server') return 'сервер не смог собрать отчёт';
    var d = y && y.j && typeof y.j.detail === 'string' ? y.j.detail.replace(/[.\s]+$/, '') : '';
    return d ? d.charAt(0).toLowerCase() + d.slice(1) : 'сервер не принял запрос';
  }
  // Одна строка: какая компания не проверилась и почему; кнопка «Сравнить ещё раз» — когда повтор может помочь (срок, сеть, 5xx)
  function tekstOshibki(xA, xB) {
    var plA = !xA.ok, plB = !xB.ok, pA = plA ? prichina(xA) : '', pB = plB ? prichina(xB) : '';
    var t = plA && plB ? (pA === pB ? 'Не получилось проверить обе компании: ' + pA + '.' :
      'Не получилось проверить обе компании: первую — ' + pA + ', вторую — ' + pB + '.') :
      'Не получилось проверить ' + (plA ? 'первую' : 'вторую') + ' компанию: ' + (plA ? pA : pB) + '.';
    return { tekst: t, povtor: !!(vidOshibki(xA) || vidOshibki(xB)) };
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
    // sravnenie-srok-v1: обе проверки — со сроком, повтором и без «чужого» ответа (как главная, skorost-otveta-v1)
    var Z = sozdatZapros(w), dolgoT = 0;
    function povtor(a, b) {
      var bt = doc.createElement('button'); bt.type = 'button'; bt.className = 'sv-povtor'; bt.textContent = 'Сравнить ещё раз';
      bt.addEventListener('click', function () { sravnit(a, b, true); });
      note.appendChild(doc.createTextNode(' ')); note.appendChild(bt);
    }
    // таблица другой пары под ошибкой новой — читалась бы как ответ на новую: убираем; та же пара — оставляем
    function ubratChuzhuyu(a, b) {
      var sh = [].map.call(out.querySelectorAll('.sv-t thead a'), function (x) { return (x.getAttribute('href') || '').replace(/\D/g, ''); });
      if (sh.length && (sh[0] !== a || sh[1] !== b)) out.innerHTML = '';
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
      var moj = Z.novaya(); w.clearTimeout(dolgoT);
      dolgoT = w.setTimeout(function () { if (Z.svezhaya(moj) && out.classList.contains('sv-zhdu')) { note.className = 'sv-note'; note.textContent = 'Реестры отвечают дольше обычного…'; } }, DOLGO_MS);
      Promise.all([Z.zapros(CAPI + '/api/check?q=' + encodeURIComponent(a), moj), Z.zapros(CAPI + '/api/check?q=' + encodeURIComponent(b), moj)]).then(function (x) {
        if (!Z.svezhaya(moj)) return;
        w.clearTimeout(dolgoT);
        out.removeAttribute('aria-busy'); out.classList.remove('sv-zhdu');
        x.forEach(function (y) { if (y.ok && y.n) cel('check_oshibka', { stranica: 'sravnit', vid: 'set', sost: 'povtor_pomog' }); });
        if (x[0].s === 429 || x[1].s === 429) {
          note.className = 'sv-note'; note.textContent = '';
          if (w.dlkLimit) w.dlkLimit.pokazat(note, { stranica: 'sravnit', inn: x[0].s === 429 ? a : b });
          else note.textContent = 'На сегодня бесплатные проверки закончились. Завтра — снова 10.';
          return;
        }
        if (!x[0].ok || !x[1].ok) {
          x.forEach(function (y) { var v = vidOshibki(y); if (v) cel('check_oshibka', { stranica: 'sravnit', vid: v, kod: String(y.s || 0), n: String(y.n || 0) }); });
          ubratChuzhuyu(a, b);
          var t = tekstOshibki(x[0], x[1]);
          note.className = 'sv-note err'; note.textContent = t.tekst;
          if (t.povtor) povtor(a, b);
          return;
        }
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
      }).catch(function (e) {
        if (e === STALO || !Z.svezhaya(moj)) return;
        w.clearTimeout(dolgoT);
        out.removeAttribute('aria-busy'); out.classList.remove('sv-zhdu');
        ubratChuzhuyu(a, b);
        note.className = 'sv-note err'; note.textContent = 'Сервис не ответил. Проверьте интернет.';
        povtor(a, b);
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

  return { sozdatZapros: sozdatZapros, tekstOshibki: tekstOshibki, vidOshibki: vidOshibki, SROK_MS: SROK_MS, proverit: proverit, stroki: stroki, itog: itog, otmetki: otmetki, neproveno: neproveno, html: html, mount: mount, IP_TEKST: IP_TEKST, DVE: DVE };
});
