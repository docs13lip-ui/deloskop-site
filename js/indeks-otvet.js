/*
 * Делоскоп — Индекс в проверке без ожидания API (комплект indeks-v-otchete-v1, Очередь п. 245;
 * ТЗ [Продукт · Данные и Индекс] 03.10 13:35 — claude/Продукт_Индекс_в_отчёте_без_API_03.10.md; Планёрка 03.10 (а) — да).
 *
 * Переводит ответ /api/check в факты и источники открытой методики v1.0 (indeks/metodika-v1.json)
 * и считает число тем же калькулятором, что страница /indeks/ (indeks/indeks.js = сервер indeks_v1.py).
 * Ворота честности («без данных не хвалим»):
 *   1) ИП — числа нет;  2) в ответе есть сигнал warn/bad, который методика v1 не оценивает, — числа нет;
 *   3) полнота < 60 % — только уровень и «оценка по сокращённым данным»;  4) есть r.indeks от сервера — берём его, не считаем;
 *   5) dossier.score — никогда.
 * Нагрузку против отрасли не берём: API считает её со взносами, методика — без (✎ 02:05, daty-api-v1).
 * Ничего не запрашивает, кроме самой методики (один JSON, в браузере — при загрузке скрипта).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IndeksOtvet = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var NB = ' ';
  var M = null, KALK = null, zhdut = [];
  var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
  var TON = { green: 'ok', yellow: 'warn', orange: 'warn', red: 'bad' };
  var NE_PODKL = { sudy: 'суды', fssp: 'приставы', fedresurs: 'банкротство', eis: 'закупки' };

  function gotov() { return !!(M && KALK); }
  function ustanovit(m, kalk) {
    M = m || M; KALK = kalk || KALK;
    if (gotov()) { var z = zhdut; zhdut = []; z.forEach(function (f) { try { f(); } catch (e) {} }); }
  }
  // gotovo(f): вызвать f, когда методика загружена (или сразу); не дождались за 4 с — всё равно вызываем (будет «считаем»)
  function gotovo(f) {
    if (gotov() || typeof setTimeout !== 'function') { f(); return; }
    var bylo = false, g = function () { if (!bylo) { bylo = true; f(); } };
    zhdut.push(g); setTimeout(g, 4000);
  }

  // ---------- разбор ответа ----------
  function sig(r) { return Array.isArray(r && r.signals) ? r.signals.filter(function (s) { return s && typeof s === 'object'; }) : []; }
  function t(s) { return String(s.title == null ? '' : s.title).replace(/ /g, ' ').trim(); }
  function d(s) { return String(s.detail == null ? '' : s.detail).replace(/ /g, ' ').trim(); }
  function plohoj(s) { return s.status === 'warn' || s.status === 'bad'; }

  // дата проверки по Москве → {g, m, d} (как «Существенные факты»)
  function naDatu(r) {
    var x = Date.parse((r && r.checked_at) || '');
    if (!isFinite(x)) x = Date.now();
    var q = new Date(x + 3 * 3600 * 1000);
    return { g: q.getUTCFullYear(), m: q.getUTCMonth() + 1, d: q.getUTCDate() };
  }
  function iso(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? { g: +m[1], m: +m[2], d: +m[3] } : null; }
  function ru(v) { var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(v || '').trim()); return m ? { g: +m[3], m: +m[2], d: +m[1] } : iso(v); }
  // полных месяцев от a до b
  function mesyacev(a, b) { var n = (b.g - a.g) * 12 + (b.m - a.m); if (b.d < a.d) n--; return n; }

  // «1,2 млн ₽», «410 000 ₽», «3,1 млрд ₽», «850 тыс. ₽» → рубли | null
  function rubli(s) {
    var m = /(\d[\d\s ]*(?:[.,]\d+)?)\s*(млрд|млн|тыс)?\.?\s*(?:₽|руб)/i.exec(String(s || ''));
    if (!m) return null;
    var v = parseFloat(m[1].replace(/[\s ]/g, '').replace(',', '.'));
    if (!isFinite(v)) return null;
    var k = (m[2] || '').toLowerCase();
    return v * (k === 'млрд' ? 1e9 : k === 'млн' ? 1e6 : k === 'тыс' ? 1e3 : 1);
  }
  function ryad(arr) {
    var po = {};
    (Array.isArray(arr) ? arr : []).forEach(function (x) {
      var g = x ? parseInt(x.year, 10) : NaN, v = x ? x.value : null;
      if (isFinite(g) && v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v))) po[g] = Number(v);
    });
    return Object.keys(po).map(Number).sort(function (a, b) { return a - b; }).map(function (g) { return { g: g, v: po[g] }; });
  }
  function vyruchka(r) {
    var a = ryad(((r.dossier || {}).charts || {}).revenue);
    return a.length && a[a.length - 1].v > 0 ? a[a.length - 1].v : null;
  }
  // текущая ликвидность — та же строка досье, что js/dinamika.js (likvidnost-izm-v1); своей формулы нет
  function likvidnost(r) {
    var D = (r && r.dossier) || {}, v = null;
    (Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
      if (!sk || sk.id !== 'dynamics' || !Array.isArray(sk.rows)) return;
      sk.rows.forEach(function (row) {
        if (!Array.isArray(row) || !/^Текущая ликвидность$/i.test(String(row[0] || '').trim())) return;
        var m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
        if (m) v = Number(m[1].replace(',', '.'));
      });
    });
    return v !== null && isFinite(v) && v > 0 ? v : null;
  }

  // r → { fakty, dostupno, neizvestnye[], neUchli[] }
  function izOtveta(r) {
    r = r || {};
    var c = r.company || {}, ch = (r.dossier && r.dossier.charts) || {}, na = naDatu(r);
    var fakty = {}, dostupno = {}, neizv = [], neUchli = [];
    var S = sig(r);
    var kod = String(c.state_code == null ? '' : c.state_code).trim();

    // --- источники (полнота) ---
    dostupno.egrul = !!(c.inn && S.some(function (s) { return t(s) === 'Статус'; }));
    dostupno.fns = S.some(function (s) {
      // v1.1 ([Продукт · Данные] 15:55, разд. 2.2): источник «ФНС» — только открытые наборы (не реестр дисквалифицированных, не «Сервис ФНС»)
      var src = String(s.source || '');
      if (!/ФНС/.test(src) || !/открыт/i.test(src)) return false;
      var a = ru(s.as_of);
      if (!a) return false;
      var n = mesyacev(a, na);
      return n >= 0 && n <= 3 && !(n === 3 && na.d > a.d) || n < 0;
    });
    var godMin = na.g - 1, rv = ryad(ch.revenue), bl = ch.balance && typeof ch.balance === 'object' ? ch.balance : null;
    var netOtch = S.some(function (s) { return /отч[её]тность за \d{4} год не (сдана|представлена)/i.test(d(s)); });
    dostupno.girbo = (rv.length && rv[rv.length - 1].g >= godMin) || (bl && parseInt(bl.year, 10) >= godMin) || netOtch;
    dostupno.girbo = !!dostupno.girbo;
    var dm = r.damia || {};
    [['sudy', 'sudy'], ['fssp', 'fssp'], ['fedresurs', 'bankrotstvo'], ['eis', 'rnp']].forEach(function (p) {
      dostupno[p[0]] = !!(dm[p[1]] && dm[p[1]].status === 'provereno');
    });

    // --- статус ЕГРЮЛ ---
    var st = c.status;
    if (st === 'LIQUIDATED' || ISKLYUCHENA[kod]) fakty.likvidirovana = true;
    if (st === 'BANKRUPT') fakty.bankrotstvo = true;
    if (st === 'REORGANIZING') fakty.reorganizaciya = true;
    if (st === 'LIQUIDATING') {
      if (ISKL[kod] || !kod) fakty.reshenie_ob_isklyuchenii = true; // без кода — двусмысленно: не «Стоп», потолок 25
      else fakty.likvidaciya = true;
    }

    // --- возраст (от даты регистрации до даты проверки) ---
    var rg = iso(c.reg_date), vozrastIzv = false;
    if (rg) {
      var mes = mesyacev(rg, na);
      if (mes >= 0) {
        vozrastIzv = true;
        if (mes < 6) fakty.vozrast_do_6m = true;
        else if (mes < 12) fakty.vozrast_6_12m = true;
        else if (mes < 36) fakty.vozrast_1_3g = true;
        else if (mes >= 120) fakty.vozrast_10g = true;
      }
    }

    // --- недостоверность по полям ---
    if (c.address_invalid === true) fakty.nedostovernyj_adres = true;
    if (c.invalid === true && c.address_invalid !== true) fakty.nedostovernyj_rukovoditel = true;

    // --- численность (по детали строки, любой статус) ---
    S.forEach(function (s) {
      if (!/^Среднесписочная численность/i.test(t(s))) return;
      var m = /(\d+)\s*человек/.exec(d(s));
      if (!m) { if (plohoj(s)) neizv.push(s); return; }
      var n = +m[1];
      if (n <= 1) fakty.shtat_0_1 = true; else if (n >= 10) fakty.shtat_10 = true;
    });

    // --- сигналы warn/bad ---
    var vyr = vyruchka(r);
    S.forEach(function (s) {
      if (!plohoj(s)) return;
      var T = t(s), D = d(s), TD = T + ' ' + D;
      if (/^Среднесписочная численность/i.test(T)) return; // разобрано выше
      if (T === 'Статус' || /исключ|ликвид|банкрот|реорганиз/i.test(T)) {
        if (/исключена из ЕГРЮЛ|исключено из ЕГРЮЛ|исключила компанию/i.test(TD)) { fakty.likvidirovana = true; return; }
        if (/^Ликвидирована$/i.test(D) || /прекратил[аи]? деятельность/i.test(D)) { fakty.likvidirovana = true; return; }
        if (/банкрот/i.test(TD)) { fakty.bankrotstvo = true; return; }
        if (/исключени|упрощ[её]нном порядке/i.test(TD)) { fakty.reshenie_ob_isklyuchenii = true; return; }
        if (/^Ликвидируется$|в процессе ликвидации/i.test(D) && !ISKL[kod]) { fakty.likvidaciya = true; return; }
        if (/реорганиз/i.test(TD)) { fakty.reorganizaciya = true; return; }
        neizv.push(s); return;
      }
      if (/недостоверн/i.test(TD)) {
        var a = /адрес/i.test(TD.replace(/^Недостоверность адреса или руководителя/, '')), ru_ = /руковод|учредит/i.test(TD.replace(/^Недостоверность адреса или руководителя/, ''));
        if (T === 'Адрес') a = true;
        if (!a && !ru_) { if (c.address_invalid === true) a = true; else if (c.invalid === true) ru_ = true; }
        if (a) fakty.nedostovernyj_adres = true;
        if (ru_) fakty.nedostovernyj_rukovoditel = true;
        if (!a && !ru_) neizv.push(s);
        return;
      }
      if (/^Массовый руководитель/i.test(T)) { fakty.massovyj_rukovoditel = true; return; }
      if (/^Массовый адрес/i.test(T) || (T === 'Адрес' && /массов/i.test(D))) { fakty.massovyj_adres = true; return; }
      if (/^Дисквалификац/i.test(T)) { if (s.status === 'bad') fakty.diskvalifikaciya = true; else neizv.push(s); return; }
      if (/^(Задолженность|Долги) по налогам/i.test(T)) {
        var sum = rubli(D);
        if (sum != null && vyr && sum > 0.05 * vyr) fakty.nedoimka_krupnaya = true; else fakty.nedoimka = true;
        return;
      }
      if (/^Приостановление операций/i.test(T)) { if (s.status === 'bad') fakty.blokirovka_fns = true; else neizv.push(s); return; }
      if (/штраф/i.test(T)) { fakty.nalogovye_shtrafy = true; return; }
      if (/^Возраст компании/i.test(T)) { if (!vozrastIzv) neizv.push(s); return; }
      if (/^Доходы и расходы/i.test(T)) {
        if (/не (сдана|представлена)/i.test(D)) fakty.net_buhotchetnosti = true;
        return; // убыток одного года — не фактор v1 (два года — по ряду ниже); «не раскрыта» — не «0»
      }
      if (/^Низкая налоговая нагрузка/i.test(T)) { neUchli.push('nagruzka'); return; }
      if (/^Прогноз ЗСК/i.test(T)) return; // наша оценка ЗСК — фактом рядом, не в балл (методика v2, разд. 2.2)
      if (/^(ФССП|Долг[иа]? у приставов|Исполнительн)/i.test(T)) {
        var p = rubli(D);
        if (dostupno.fssp && p != null && vyr && p > 0.05 * vyr) { fakty.pristavy_krupnye = true; return; }
        if (dostupno.fssp && p != null && vyr) return;
        neizv.push(s); return;
      }
      neizv.push(s);
    });

    // --- бухотчётность по рядам ---
    var pr = ryad(ch.profit);
    if (pr.length >= 2) {
      var p1 = pr[pr.length - 1], p0 = pr[pr.length - 2];
      if (p1.g - p0.g === 1 && p1.v < 0 && p0.v < 0) fakty.ubytok_2_goda = true;
    }
    if (bl && bl.equity !== null && bl.equity !== '' && typeof bl.equity !== 'boolean' && isFinite(Number(bl.equity)) && Number(bl.equity) < 0) fakty.chistye_aktivy_minus = true;
    var lk = likvidnost(r);
    if (lk !== null) { if (lk < 1) fakty.likvidnost_nizkaya = true; else if (lk > 2) fakty.likvidnost_vysokaya = true; }
    if (rv.length >= 2) {
      var v1 = rv[rv.length - 1], v0 = rv[rv.length - 2];
      if (v1.g - v0.g === 1 && v0.v > 0 && v1.v < 0.5 * v0.v) fakty.vyruchka_upala = true;
    }

    // минус из источника, который не учтён в полноте, калькулятор пропустит — число завысится: такой случай — как неизвестный сигнал
    if (M) M.faktory.forEach(function (f) {
      if (fakty[f.id] && f.vklad < 0 && !dostupno[f.istochnik]) neizv.push({ title: f.tekst, status: 'warn', faktor: f.id });
    });
    return { fakty: fakty, dostupno: dostupno, neizvestnye: neizv, neUchli: neUchli };
  }

  // ---------- что показать ----------
  function chisloServera(r) {
    var v = r && r.indeks;
    return v !== undefined && v !== null && v !== '';
  }
  // vid(r) → { rezhim: 'server'|'ip'|'net'|'neizv'|'sokr'|'stop'|'chislo', ball, uroven, ton, polnota, istochnikov, vklady, potolok, neUchityvali }
  function vid(r) {
    r = r || {};
    var c = r.company || {};
    if (chisloServera(r)) return { rezhim: 'server' };
    if (c.kind === 'INDIVIDUAL' || String(c.inn || '').replace(/\D/g, '').length === 12) return { rezhim: 'ip' };
    if (!gotov()) return { rezhim: 'net' };
    var x = izOtveta(r);
    var rez = KALK.rasschitat(M, x.fakty, x.dostupno);
    var n = 0, k;
    for (k in M.istochniki) if (x.dostupno[k]) n++;
    var out = { polnota: rez.polnota, istochnikov: n, vsego: Object.keys(M.istochniki).length, versiya: M.versiya, neUchityvali: neUchityvali(x) };
    if (rez.stop) { out.rezhim = 'stop'; out.stop = rez.stop.tekst; out.ton = 'bad'; return out; }
    if (rez.indeks == null) { out.rezhim = 'net'; return out; } // нет ЕГРЮЛ — не считаем
    if (x.neizvestnye.length) { out.rezhim = 'neizv'; out.signaly = x.neizvestnye.map(function (s) { return t(s); }); return out; }
    // v1.1: «сокращённые данные» — без уровня и тона: потолок 69 «без данных не хвалим» не должен читаться как «Есть вопросы»
    if (rez.polnota < M.polnota.porog_sokrashchennoj) { out.rezhim = 'sokr'; out.porog = M.polnota.porog_sokrashchennoj; return out; }
    out.uroven = rez.uroven.nazvanie; out.ton = TON[rez.uroven.ton] || 'warn';
    out.rezhim = 'chislo'; out.ball = rez.indeks; out.baza = M.shkala.baza; out.vklady = rez.vklady;
    out.potolok = rez.potolok; out.plyusy = rez.plyusy; out.plyusyUchteno = rez.plyusy_uchteno; out.plyusyMaks = M.plyusy_maksimum;
    return out;
  }
  function neUchityvali(x) {
    var a = [], b = [];
    Object.keys(NE_PODKL).forEach(function (k) { if (!x.dostupno[k]) a.push(NE_PODKL[k]); });
    if (a.length) b.push(a.join(', ') + ' — источник не' + NB + 'подключён');
    if (!x.dostupno.fns) b.push('налоги и штат — свежего набора ФНС в' + NB + 'ответе нет');
    if (!x.dostupno.girbo) b.push('бухотчётность — за' + NB + 'прошлый год в' + NB + 'ответе её нет');
    b.push('налоговая нагрузка — сравним с' + NB + 'отраслью, когда придут налоги без взносов');
    return b;
  }

  // ---------- вёрстка колонки Индекса листа отчёта (полоса B) ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (q) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[q]; }); }
  function zn(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
  function podpis(v) {
    return 'По открытой методике v' + esc(v.versiya) + ' · ' + v.istochnikov + NB + 'из' + NB + v.vsego + ' источников · полнота ' + v.polnota + NB + '%';
  }
  var NE_ZNACHIT = 'Не проверено — не значит «не обнаружено».';
  function strokaNe(v) { return 'Не учитывали в этот раз: ' + v.neUchityvali.join('; ') + '. ' + NE_ZNACHIT; }
  var TXT_NEIZV = 'Индекс — считаем: в' + NB + 'проверке есть сигнал, который методика v1 пока не' + NB + 'оценивает. Он показан в' + NB + 'фактах ниже.';
  function txtSokr(v) { return 'Собрано ' + v.polnota + NB + '% данных — число и' + NB + 'уровень покажем, когда наберётся ' + (v.porog || 60) + NB + '%'; }
  // первый пункт «Не учитывали», которого не хватает именно для полноты (без «не подключён» и «налоговой нагрузки»)
  function neHvataet(v) {
    var a = (v.neUchityvali || []).filter(function (x) { return !/не\s?подключён/.test(x) && !/^налоговая нагрузка/.test(x); });
    return a.length ? a[0] : '';
  }

  // html колонки для режимов, которые считает браузер; для остальных — '' (лист оставит свою строку «считаем»)
  function htmlKolonka(v) {
    var h = '<div class="ot-ix__lab">Индекс Делоскопа</div>';
    if (v.rezhim === 'chislo') {
      var li = '<li><span>База</span><b>' + v.baza + '</b></li>';
      v.vklady.forEach(function (x) { li += '<li class="' + (x.vklad < 0 ? 'm' : 'p') + '"><span>' + esc(x.tekst) + '</span><b>' + zn(x.vklad) + '</b></li>'; });
      if (v.plyusy > v.plyusyUchteno) li += '<li class="n"><span>Плюсов больше +' + v.plyusyMaks + ' не' + NB + 'засчитываем</span><b>' + zn(v.plyusyUchteno - v.plyusy) + '</b></li>';
      if (v.potolok) li += '<li class="n"><span>Потолок: ' + esc(String(v.potolok.prichina).toLowerCase()) + '</span><b>≤' + NB + v.potolok.znachenie + '</b></li>';
      li += '<li class="i"><span>Индекс</span><b>' + v.ball + '</b></li>';
      return h + '<div class="ot-ix__big n">' + v.ball + '<small>' + NB + '/' + NB + '99</small></div>' +
        '<div class="ot-ix__sh" aria-hidden="true"><i style="left:' + v.ball + '%"></i></div>' +
        '<div class="ot-ix__lv ot-ix__lv--' + v.ton + '">' + esc(v.uroven) + '</div>' +
        '<div class="ot-ix__po n">' + podpis(v) + ' · <a href="/indeks/">методика</a></div>' +
        '<details class="ot-ix__pch"><summary>Почему ' + v.ball + '</summary><ul class="ot-ix__rs n">' + li + '</ul>' +
        '<p class="ot-ix__ne-uch">' + strokaNe(v) + '</p></details>';
    }
    if (v.rezhim === 'sokr')
      return h + '<div class="ot-ix__ne">Индекс — по' + NB + 'сокращённым данным</div>' +
        '<div class="ot-ix__po n">' + esc(txtSokr(v)) + '.' + (neHvataet(v) ? ' Не хватает: ' + esc(neHvataet(v)) + '.' : '') + '</div>' +
        '<div class="ot-ix__po n">' + podpis(v) + ' · <a href="/indeks/">методика</a></div>';
    if (v.rezhim === 'neizv')
      return h + '<div class="ot-ix__ne">Индекс — считаем</div><div class="ot-ix__po">' + TXT_NEIZV.replace(/^Индекс — считаем: в/, 'В') + '</div>' +
        '<div class="ot-ix__lv"><a href="/indeks/">методика</a></div>';
    if (v.rezhim === 'stop')
      return h + '<div class="ot-ix__big ot-ix__lv--bad">Стоп</div><div class="ot-ix__lv ot-ix__lv--bad">' + esc(v.stop) + '</div>' +
        '<div class="ot-ix__po">По открытой методике v' + esc(v.versiya) + ' при этом факте число не' + NB + 'считаем · <a href="/indeks/">методика</a></div>';
    return '';
  }

  // Короткая строка для Паспорта и снимка: число или null
  function ball(r) {
    var v = vid(r);
    return v.rezhim === 'chislo' ? v.ball : null;
  }

  // ---------- загрузка методики ----------
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    try { ustanovit(require('../indeks/metodika-v1.json'), require('../indeks/indeks.js')); } catch (e) {}
  } else if (root && typeof root.fetch === 'function') {
    var kalk = function () { return root.DeloskopIndeks || null; };
    root.fetch('/indeks/metodika-v1.json').then(function (x) { return x.ok ? x.json() : null; }).then(function (m) {
      if (!m || !Array.isArray(m.faktory)) return;
      if (kalk()) ustanovit(m, kalk());
      else if (root.addEventListener) root.addEventListener('DOMContentLoaded', function () { ustanovit(m, kalk()); });
    }).catch(function () {});
  }

  return { izOtveta: izOtveta, vid: vid, ball: ball, htmlKolonka: htmlKolonka, gotov: gotov, gotovo: gotovo, ustanovit: ustanovit,
    rubli: rubli, TXT_NEIZV: TXT_NEIZV, txtSokr: txtSokr, neHvataet: neHvataet, strokaNe: strokaNe, podpis: podpis };
});
