/*! Делоскоп · «Финцентр-лайт» — спайк за флагом `fincentr` (data/fincentr.json; решение владельца 03.10.2026, 0о:
 *  до 14.10 — только спайк и тексты, MVP 15–28.10 в «Про»).
 *  Все ваши счета глазами банка: правило «пришло — ушло» по каждому счёту и по всем вместе, наличные и налоги
 *  от «расходов без переводов себе», экран одним листом (ТЗ [Продукт] 04.10 21:37,
 *  claude/Продукт_Финцентр_пришло-ушло_экран_ПП1277_04.10.md, разд. 3–4).
 *  Работает целиком в браузере на разборе движка «Кому вы платите» (engine.js) — выписки никуда не уходят.
 *  Пороги — ориентиры Делоскопа (публичных числовых порогов транзита у ЦБ нет), пересмотр 28.10.
 *  Чистые функции (sobytiya, tranzit, svodka, html) — без DOM и сети: tests/fincentr_tranzit.test.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.DeloFincentr = factory(root.DeloVypiska);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var NB = ' ';
  var FLAG_URL = '/data/fincentr.json';

  /* ---------- пороги (менять только здесь; пересмотр 28.10 по бета-разборам) ---------- */
  var POROG = {
    okno: 2,              // «ушло дальше» не позже чем через 2 календарных дня после прихода
    zapasDnej: 7,         // платёж, целиком покрытый остатком, пролежавшим на счёте 7 дней, — не транзит ([Данные] 04.10 22:37, ◐ ориентир)
    minPrihod: 1000000,   // меньше — «мало данных», без цвета
    minDnej: 28,          // период короче — «мало данных»
    warn: 0.8,            // ≥ 80 % — жёлтый
    info: 0.6,            // 60–80 % — информационный
    cashShare: 0.15,      // наличные в расходах — как в «Наличных» и engine.js NORMS.cashShare
    depositShare: 0.30,   // взносы наличных в поступлениях — как NORMS.depositShare
    taxShare: 0.009,      // доля налогов — внутренний ориентир, публично не называем ([Продукт] 04.10 разд. 2)
    taxMinOut: 1000000    // долю налогов оцениваем при расходах от 1 млн ₽ (как lowtax в engine.js)
  };
  var RANG = { malo: 0, ok: 0, info: 1, warn: 2 };

  // Что считается «ушло дальше»: по всем счетам — поставщики, физлица, наличные;
  // по одному счёту — ещё и перевод себе в другой банк (этот банк других ваших счетов не видит).
  var DALSHE_VSE = { supplier: 1, person: 1, cash: 1 };
  var DALSHE_SCHET = { supplier: 1, person: 1, cash: 1, self: 1 };

  function dni(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

  /* ---------- «пришло — ушло»: последним пришло — первым ушло ---------- */
  // ev: [{d:'ГГГГ-ММ-ДД', acc, dir:'in'|'out', sum, cat}]. FIFO не берём: хвосты по 5 % копятся,
  // и честный транзит 95 % выходит как 60 % ([Данные] 04.10, разд. 3).
  // «Запас 7 дней»: если платёж целиком покрывает минимальный остаток на конец дня за 7 прошлых дней
  // (минус уже взятое из запаса в этот день), слои приходов не трогаем. Остатки — по всем операциям,
  // начало — НачальныйОстаток выписки (нет поля — 0, правило вырождается в чистый LIFO).
  function addD(iso, k) { var t = new Date(Date.parse(iso) + k * 864e5); return t.toISOString().slice(0, 10); }
  function ostatki(ev, nach) {
    var kon = {}, ost = nach || 0;
    if (!ev.length) return kon;
    kon[addD(ev[0].d, -1)] = ost;
    var izm = {};
    ev.forEach(function (e) { izm[e.d] = (izm[e.d] || 0) + (e.dir === 'in' ? e.sum : -e.sum); });
    for (var d = ev[0].d, last = ev[ev.length - 1].d; d <= last; d = addD(d, 1)) { ost += izm[d] || 0; kon[d] = ost; }
    return kon;
  }
  function schitat(ev, prihodCat, dalshe, nach) {
    ev = ev.slice().sort(function (x, y) { return x.d < y.d ? -1 : x.d > y.d ? 1 : (x.dir === 'in' ? -1 : 1); });
    var q = [], prihod = 0, bystro = 0, izZapasa = 0, vzyato = {};
    var kon = ostatki(ev, nach);
    ev.forEach(function (e) {
      if (e.dir === 'in') { if (prihodCat[e.cat]) { q.push({ d: e.d, ost: e.sum }); prihod += e.sum; } return; }
      if (!dalshe[e.cat]) return;
      var m = Infinity;
      for (var k = 1; k <= POROG.zapasDnej; k++) { var dd = addD(e.d, -k); if (dd in kon) m = Math.min(m, kon[dd]); }
      if (m === Infinity) m = 0;
      if (m - (vzyato[e.d] || 0) >= e.sum) { vzyato[e.d] = (vzyato[e.d] || 0) + e.sum; izZapasa += e.sum; return; }
      var nado = e.sum;
      while (nado > 0 && q.length) {
        var h = q[q.length - 1], v = Math.min(h.ost, nado);
        if (dni(h.d, e.d) <= POROG.okno) bystro += v;
        h.ost -= v; nado -= v;
        if (h.ost <= 0.005) q.pop();
      }
    });
    return { prihod: r2(prihod), bystro: r2(bystro), dolya: prihod ? bystro / prihod : 0, izZapasa: r2(izZapasa) };
  }
  function uroven(r, dnej) {
    if (r.prihod < POROG.minPrihod || dnej < POROG.minDnej) return 'malo';
    return r.dolya >= POROG.warn ? 'warn' : r.dolya >= POROG.info ? 'info' : 'ok';
  }
  function dneyPerioda(ev) {
    if (!ev.length) return 0;
    var ds = ev.map(function (e) { return e.d; }).sort();
    return dni(ds[0], ds[ds.length - 1]) + 1;
  }
  function tranzit(ev, nach) {
    nach = nach || {};
    var dnej = dneyPerioda(ev);
    var nachVse = 0, est = {};
    ev.forEach(function (e) { est[e.acc] = 1; });
    Object.keys(est).forEach(function (a) { nachVse += nach[a] || 0; });
    var vse = schitat(ev, { ext: 1 }, DALSHE_VSE, nachVse); vse.uroven = uroven(vse, dnej);
    var po = {};
    ev.forEach(function (e) { (po[e.acc] = po[e.acc] || []).push(e); });
    return {
      vse: vse, dnej: dnej,
      scheta: Object.keys(po).map(function (a) {
        var r = schitat(po[a], { ext: 1, self: 1 }, DALSHE_SCHET, nach[a] || 0); r.acc = a; r.uroven = uroven(r, dnej); return r;
      })
    };
  }

  /* ---------- события из выписок: как в engine.js analyze(), но со счётом и датой ---------- */
  // Перевод между двумя загруженными своими счетами после удаления дублей — одна запись,
  // поэтому даём 2 события: out/self на счёте-плательщике и in/self на счёте-получателе.
  function bankKratko(n) {
    n = String(n || '').replace(/\s+/g, ' ').trim();
    n = n.replace(/\s+(г\.|г\s|город\s).*$/i, '').replace(/[,;]\s*$/, '').trim();
    return n;
  }
  function sobytiya(parsedList) {
    if (!Array.isArray(parsedList)) parsedList = [parsedList];
    var merged = { header: {}, accounts: [], docs: [] };
    parsedList.forEach(function (p) {
      merged.accounts = merged.accounts.concat(p.accounts || []);
      merged.docs = merged.docs.concat(p.docs || []);
      if (!merged.header.РасчСчет && p.header && p.header.РасчСчет) merged.header.РасчСчет = p.header.РасчСчет;
    });
    var self = E.detectSelf(merged);
    var accSet = {}; self.accounts.forEach(function (a) { accSet[a] = 1; });
    // Начальный остаток счёта — из самой ранней СекцияРасчСчет (выписки могут пересекаться)
    var nach = {}, nachOt = {};
    merged.accounts.forEach(function (a) {
      if (!a || !a.РасчСчет || !('НачальныйОстаток' in a)) return;
      var v = numSum(a.НачальныйОстаток), ot = E.toIso(a.ДатаНачала) || '9999';
      if (!isFinite(v)) return;
      if (!(a.РасчСчет in nach) || ot < nachOt[a.РасчСчет]) { nach[a.РасчСчет] = v; nachOt[a.РасчСчет] = ot; }
    });
    var seen = {}, docs = [];
    merged.docs.forEach(function (d) {
      var k = [d.Номер, d.Дата, d.Сумма, d.ПлательщикСчет, d.ПолучательСчет].join('|');
      if (!seen[k]) { seen[k] = 1; docs.push(d); }
    });
    var banki = {};
    function bank(acc, name, bik) {
      if (!acc || !accSet[acc]) return;
      var b = banki[acc] || (banki[acc] = { bank: '', bik: '' });
      if (!b.bank && name) b.bank = bankKratko(name);
      if (!b.bik && bik) b.bik = bik;
    }
    var ev = [];
    docs.forEach(function (d) {
      var sum = numSum(d.Сумма);
      if (!(sum > 0)) return;
      bank(d.ПлательщикСчет, d.ПлательщикБанк1 || d.ПлательщикБанк, d.ПлательщикБИК);
      bank(d.ПолучательСчет, d.ПолучательБанк1 || d.ПолучательБанк, d.ПолучательБИК);
      var dOut = E.toIso(d.ДатаСписано || d.Дата), dIn = E.toIso(d.ДатаПоступило || d.ДатаСписано || d.Дата);
      var platSvoj = !!accSet[d.ПлательщикСчет], poluchSvoj = !!accSet[d.ПолучательСчет];
      var outgoing = platSvoj || (!poluchSvoj && self.inn && d.ПлательщикИНН === self.inn);
      if (platSvoj && poluchSvoj) {                       // между двумя загруженными своими счетами
        if (dOut) ev.push({ d: dOut, acc: d.ПлательщикСчет, dir: 'out', sum: sum, cat: 'self' });
        if (dIn) ev.push({ d: dIn, acc: d.ПолучательСчет, dir: 'in', sum: sum, cat: 'self' });
        return;
      }
      if (outgoing) {
        if (!dOut) return;
        ev.push({ d: dOut, acc: d.ПлательщикСчет || self.accounts[0] || '?', dir: 'out', sum: sum, cat: E.category(d, self) });
        return;
      }
      if (!dIn) return;
      var izSvoego = self.inn && d.ПлательщикИНН === self.inn;   // с вашего счёта, выписку которого не загрузили
      ev.push({ d: dIn, acc: poluchSvoj ? d.ПолучательСчет : (self.accounts[0] || '?'), dir: 'in', sum: sum,
        cat: izSvoego ? 'self' : 'ext', cashIn: E.isCashIn(d) });
    });
    return { ev: ev, self: self, banki: banki, nach: nach };
  }
  function numSum(s) {
    var v = parseFloat(String(s || '').replace(/[\s ]/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* ---------- деньги по событиям: всего и по счёту ---------- */
  function dengi(ev) {
    var t = { prishlo: 0, prishloSebe: 0, vznos: 0, out: 0, self: 0, cash: 0, budget: 0 };
    ev.forEach(function (e) {
      if (e.dir === 'in') {
        if (e.cat === 'self') t.prishloSebe += e.sum;
        else { t.prishlo += e.sum; if (e.cashIn) t.vznos += e.sum; }
        return;
      }
      t.out += e.sum;
      if (e.cat === 'self') t.self += e.sum;
      if (e.cat === 'cash') t.cash += e.sum;
      if (e.cat === 'budget') t.budget += e.sum;
    });
    Object.keys(t).forEach(function (k) { t[k] = r2(t[k]); });
    return t;
  }
  // Доли: по одному счёту — от всех его списаний (так видит этот банк),
  // по всем счетам — от «списано без переводов себе» (иначе внутренние переводы раздувают знаменатель).
  function doli(t, sebeVychest) {
    var baza = sebeVychest ? t.out - t.self : t.out;
    return {
      baza: r2(baza),
      nal: baza > 0 ? t.cash / baza : 0,
      nalogi: baza > 0 ? t.budget / baza : 0,
      vznos: t.prishlo > 0 ? t.vznos / t.prishlo : 0,
      nalUroven: baza > 0 && t.cash / baza >= POROG.cashShare ? 'warn' : 'ok',
      nalogiUroven: baza >= POROG.taxMinOut && t.budget / baza < POROG.taxShare ? 'warn' : 'ok',
      vznosUroven: t.prishlo > 0 && t.vznos / t.prishlo >= POROG.depositShare ? 'info' : 'ok'
    };
  }

  /* ---------- сводка экрана ---------- */
  function svodka(parsedList) {
    var s = sobytiya(parsedList), ev = s.ev;
    var tr = tranzit(ev, s.nach);
    var vseT = dengi(ev), vseD = doli(vseT, true);
    var ds = ev.map(function (e) { return e.d; }).sort();
    var bankov = {};
    var scheta = tr.scheta.map(function (r) {
      var mine = ev.filter(function (e) { return e.acc === r.acc; });
      var t = dengi(mine), d = doli(t, false), b = s.banki[r.acc] || {};
      if (b.bik || b.bank) bankov[b.bik || b.bank] = 1;
      // Куда уходят переводы себе с этого счёта — чтобы назвать второй банк в выводе
      var kuda = {};
      ev.forEach(function (e) {
        if (e.dir === 'in' && e.cat === 'self' && e.acc !== r.acc) {
          var para = mine.some(function (o) { return o.dir === 'out' && o.cat === 'self' && o.sum === e.sum && Math.abs(dni(o.d, e.d)) <= 3; });
          if (para) kuda[e.acc] = (kuda[e.acc] || 0) + e.sum;
        }
      });
      var kudaAcc = Object.keys(kuda).sort(function (a, b2) { return kuda[b2] - kuda[a]; })[0] || null;
      return {
        acc: r.acc, hvost: hvost(r.acc), bank: b.bank || '', bik: b.bik || '',
        tranzit: { prihod: r.prihod, bystro: r.bystro, dolya: r.dolya, uroven: r.uroven },
        dengi: t, doli: d, kudaAcc: kudaAcc,
        huzhe: {
          tranzit: r.uroven !== 'malo' && RANG[r.uroven] > RANG[tr.vse.uroven],
          nal: d.nalUroven === 'warn' && vseD.nalUroven !== 'warn',
          nalogi: d.nalogiUroven === 'warn' && vseD.nalogiUroven !== 'warn'
        }
      };
    });
    scheta.sort(function (a, b2) { return b2.tranzit.prihod - a.tranzit.prihod; });
    var out = {
      period: { from: ds[0] || null, to: ds[ds.length - 1] || null }, dnej: tr.dnej,
      schetov: scheta.length, bankov: Object.keys(bankov).length || scheta.length,
      dengi: vseT, doli: vseD, tranzit: tr.vse, scheta: scheta
    };
    out.vyvod = vyvod(out);
    return out;
  }
  function hvost(acc) { acc = String(acc || ''); return acc.length > 4 ? '…' + acc.slice(-4) : acc; }

  /* ---------- вывод — одна строка (4 варианта Арт-директора + «есть сигналы») ---------- */
  function imyaBanka(sc) { return sc.bank ? '«' + sc.bank.replace(/[«»"]/g, '') + '»' : ''; }
  function vyvod(s) {
    if (s.tranzit.uroven === 'malo') return { kod: 'malo', tekst: 'Мало операций для вывода: нужен месяц и приход от 1' + NB + 'млн' + NB + '₽.' };
    var raznye = s.scheta.filter(function (sc) { return sc.huzhe.tranzit && sc.tranzit.uroven === 'warn'; })[0];
    if (raznye) {
      var kuda = raznye.kudaAcc && s.scheta.filter(function (sc) { return sc.acc === raznye.kudaAcc; })[0];
      var kto = raznye.bank ? 'Банк ' + imyaBanka(raznye) + ' по своему счёту' : 'Банк по счёту ' + raznye.hvost;
      var hvostK = kuda ? (kuda.bank && kuda.bank !== raznye.bank ? 'на ваш счёт в ' + imyaBanka(kuda) : 'на ваш счёт ' + kuda.hvost) : '';
      return { kod: 'raznye', acc: raznye.acc, tekst: kto + ' видит «пришло — ушло» ' + E.pct(raznye.tranzit.dolya) +
        (hvostK ? ': выручка сразу уходит ' + hvostK : '') + '. По всем счетам вместе — ' + E.pct(s.tranzit.dolya) + '.' };
    }
    if (s.tranzit.uroven === 'warn') return { kod: 'tranzit', tekst: 'По всем счетам вместе ' + E.pct(s.tranzit.dolya) +
      ' поступлений уходят дальше за 2' + NB + 'дня — об этом банки обычно спрашивают первым.' };
    var sig = signaly(s);
    if (!sig.length) return { kod: 'spokojno', tekst: 'По 4 признакам из 4 по всем счетам — сигналов нет.' };
    return { kod: 'signaly', tekst: 'По всем счетам вместе — ' + sig.length + ' ' + (sig.length === 1 ? 'признак' : 'признака') +
      ' из 4, о котор' + (sig.length === 1 ? 'ом' : 'ых') + ' может спросить банк: ' + sig.join(', ') + '.' };
  }
  function signaly(s) {
    var out = [];
    if (s.tranzit.uroven === 'info' || s.tranzit.uroven === 'warn') out.push('«пришло — ушло» ' + E.pct(s.tranzit.dolya));
    if (s.doli.nalUroven !== 'ok') out.push('наличные ' + E.pct(s.doli.nal));
    if (s.doli.vznosUroven !== 'ok') out.push('взносы наличных ' + E.pct(s.doli.vznos));
    if (s.doli.nalogiUroven !== 'ok') out.push('мало налогов');
    return out;
  }

  /* ---------- HTML одного листа ---------- */
  function kav(t) { var D = typeof window !== 'undefined' && window.DlkImya; return D && t ? D.kavychki(t) : t; } // kavychki-v1.1
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rub(n) { return E.money(n) + NB + '₽'; }
  function ru(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }
  function tochka(on, podskazka) { return on ? ' <i class="fc-t" title="' + esc(podskazka) + '" aria-label="' + esc(podskazka) + '"></i>' : ''; }
  var NE_VIDIT = 'Этот банк не видит ваши другие счета';

  function html(s, res) {
    var r = res || { suppliers: [], todo: [] };
    var eyebrow = 'Все ваши счета глазами банка' +
      (s.period.from ? ' · ' + ru(s.period.from) + '–' + ru(s.period.to) : '') +
      ' · ' + s.bankov + NB + plural(s.bankov, 'банк', 'банка', 'банков');
    var d = s.dengi;
    var cifry = '<div class="fc-cifry">' +
      cifra(rub(d.prishlo), 'Пришло') +
      cifra(rub(r2(d.out - d.self)), 'Ушло') +
      cifra(rub(d.budget), 'Налоги и взносы') +
      cifra(rub(d.self), 'Между своими счетами', 'не считаем расходом') + '</div>';
    var tabl = '<div class="fc-tabl" role="region" aria-label="Глазами каждого банка" tabindex="0"><table><thead><tr>' +
      '<th>Банк · счёт</th><th>Пришло — ушло</th><th>Наличные</th><th>Налоги</th></tr></thead><tbody>' +
      s.scheta.map(function (sc) {
        return '<tr><td>' + (sc.bank ? esc(sc.bank) + ' · ' : '') + '<span class="fc-n">' + esc(sc.hvost) + '</span></td>' +
          '<td data-k="Пришло — ушло">' + (sc.tranzit.uroven === 'malo' ? '<span class="fc-m">мало данных</span>' : E.pct(sc.tranzit.dolya)) + tochka(sc.huzhe.tranzit, NE_VIDIT) + '</td>' +
          '<td data-k="Наличные">' + E.pct(sc.doli.nal) + tochka(sc.huzhe.nal, NE_VIDIT) + '</td>' +
          '<td data-k="Налоги">' + E.pct(sc.doli.nalogi) + tochka(sc.huzhe.nalogi, NE_VIDIT) + '</td></tr>';
      }).join('') +
      '<tr class="fc-vse"><td>Все счета вместе</td><td data-k="Пришло — ушло">' + (s.tranzit.uroven === 'malo' ? '<span class="fc-m">мало данных</span>' : E.pct(s.tranzit.dolya)) +
      '</td><td data-k="Наличные">' + E.pct(s.doli.nal) + '</td><td data-k="Налоги">' + E.pct(s.doli.nalogi) + '</td></tr></tbody></table></div>' +
      '<p class="fc-pr">«Пришло — ушло» — какая доля поступлений ушла поставщикам, физлицам или наличными не позже чем через 2' + NB + 'дня. ' +
      'Для одного банка перевод на ваш счёт в другом банке — тоже «ушло»: других ваших счетов он не видит. ' +
      'Платежи, которые покрывал остаток, пролежавший на счёте неделю, транзитом не считаем.</p>';
    var top = (r.suppliers || []).slice(0, 5);
    var komu = top.length ? '<ol class="fc-komu">' + top.map(function (x) {
      return '<li><span>' + esc(kav(x.name) || x.inn || 'без названия') + '</span><b>' + E.pct(x.share || 0) + '</b></li>';
    }).join('') + '</ol><a class="fc-vse-pol" href="#postavshchiki">Все получатели' + NB + '→</a>' : '<p class="fc-m">Платежей поставщикам нет.</p>';
    var dela = (r.todo || []).length ? '<ol class="fc-dela">' + r.todo.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '';
    return '<section class="fc" data-fincentr="' + esc(s.vyvod.kod) + '" aria-label="Все ваши счета глазами банка">' +
      '<p class="fc-eyebrow">' + esc(eyebrow) + '</p>' +
      '<p class="fc-vyvod">' + esc(s.vyvod.tekst) + '</p>' +
      '<div class="fc-blok"><h3>Деньги</h3>' + cifry + '</div>' +
      '<div class="fc-blok"><h3>Глазами каждого банка</h3>' + tabl + '</div>' +
      '<div class="fc-blok"><h3>Кому вы платите</h3>' + komu + '</div>' +
      (dela ? '<div class="fc-blok"><h3>Что сделать</h3>' + dela + '</div>' : '') +
      '<a class="fc-akt" href="/tarify/#pro" data-goal="fincentr_sohranit">Сохранить разбор и сравнить через месяц</a>' +
      '<p class="fc-og">Ориентиры Делоскопа, а не решение банка. Выписки разобраны в вашем браузере; на сервер уходят только ИНН организаций-получателей — чтобы показать Индекс.</p>' +
      '</section>';
  }
  function cifra(v, k, pod) {
    return '<div class="fc-c' + (pod ? ' fc-c--svoi' : '') + '"><b>' + v + '</b><span>' + esc(k) + (pod ? ' · ' + esc(pod) : '') + '</span></div>';
  }

  var CSS = '.fc{background:#fff;border-radius:22px;padding:24px;margin:0 0 26px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 16px 40px rgba(0,0,0,.05)}' +
    '.fc-eyebrow{font-size:13px;color:#6B6B70;letter-spacing:.01em;margin:0 0 6px}' +
    '.fc-vyvod{font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.02em;margin:0 0 18px;color:#1D1D1F}' +
    '.fc-blok{margin:18px 0 0}.fc-blok h3{font-size:15px;font-weight:600;margin:0 0 8px;color:#1D1D1F}' +
    '.fc-cifry{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}' +
    '.fc-c{background:#F5F5F2;border-radius:14px;padding:12px 14px}.fc-c b{display:block;font-size:18px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}' +
    '.fc-c span{display:block;font-size:13px;color:#6B6B70;line-height:1.35}.fc-c--svoi b{color:#6B6B70}' +
    '@media (max-width:640px){.fc{padding:18px}.fc-cifry{grid-template-columns:repeat(2,1fr)}.fc-vyvod{font-size:19px}.fc-tabl table{font-size:13px}.fc-tabl td,.fc-tabl th{padding-right:6px}.fc-t{margin-left:4px}}' +
    '.fc-tabl{overflow-x:auto}.fc-tabl table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}' +
    '.fc-tabl th{text-align:left;font-weight:500;font-size:12px;color:#6B6B70;padding:0 8px 6px 0;border-bottom:1px solid #E6E6E1}' +
    '.fc-tabl td{padding:8px 8px 8px 0;border-bottom:1px solid #E6E6E1;vertical-align:top}.fc-tabl td+td,.fc-tabl th+th{text-align:right;white-space:nowrap}' +
    '.fc-vse td{font-weight:600;border-bottom:0}.fc-n{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}' +
    '.fc-t{display:inline-block;width:8px;height:8px;border-radius:50%;background:#E0A100;margin-left:6px;vertical-align:middle;cursor:help}' +
    '.fc-m{color:#6B6B70}.fc-pr{font-size:13px;color:#6B6B70;margin:8px 0 0;line-height:1.45}' +
    '.fc-komu,.fc-dela{margin:0;padding:0 0 0 20px;font-size:15px}.fc-komu li{padding:3px 0}.fc-komu li span{display:inline}.fc-komu li b{float:right;font-weight:600;font-variant-numeric:tabular-nums;margin-left:12px}' +
    '.fc-dela li{padding:3px 0;color:#48484C}.fc-vse-pol{display:inline-block;font-size:14px;margin-top:6px}' +
    '.fc-akt{display:inline-flex;align-items:center;min-height:46px;margin:20px 0 0;padding:0 18px;border-radius:12px;background:#0B63E5;color:#fff!important;font-weight:600;font-size:16px}' +
    '.fc-akt:hover{background:#084BB0}.fc-og{font-size:12.5px;color:#6B6B70;margin:12px 0 0;line-height:1.45}' +
    // 390 px — карточка на каждый банк вместо таблицы ([Продукт · Арт-директор] 04.10 22:55, разд. 2)
    '@media (max-width:600px){.fc-tabl{overflow:visible}.fc-tabl thead{display:none}.fc-tabl table,.fc-tabl tbody{display:block}' +
    '.fc-tabl tr{display:block;background:#FAFAF8;border-radius:14px;padding:10px 14px;margin:0 0 8px}.fc-tabl tr.fc-vse{background:#F0F0EC}' +
    '.fc-tabl td,.fc-tabl td+td{display:flex;align-items:center;gap:4px;padding:5px 0;border:0;text-align:left;white-space:normal}' +
    '.fc-tabl td:first-child{font-weight:600;padding-bottom:7px}.fc-tabl td[data-k]::before{content:attr(data-k);color:#6B6B70;font-weight:400;margin-right:auto}}' +
    '@media print{.fc-akt{display:none}}';

  /* ---------- браузер: показать лист, только если в data/fincentr.json `vklyuchen: true` ---------- */
  var flagP = null;
  function flag() {
    if (flagP) return flagP;
    if (typeof fetch !== 'function') return (flagP = Promise.resolve(false));
    flagP = fetch(FLAG_URL, { credentials: 'same-origin' })
      .then(function (x) { return x.ok ? x.json() : {}; })
      .then(function (j) { return !!(j && j.vklyuchen === true); })
      .catch(function () { return false; });
    return flagP;
  }
  function pokazat(out, parsedList, res) {
    if (!out || !parsedList || !E) return Promise.resolve(false);
    return flag().then(function (on) {
      if (!on) return false;
      var s;
      try { s = svodka(parsedList); } catch (e) { return false; }   // ошибка — экран «Кому вы платите» остаётся как был
      if (!s.scheta.length) return false;
      if (typeof document !== 'undefined' && !document.getElementById('fc-css')) {
        var st = document.createElement('style'); st.id = 'fc-css'; st.textContent = CSS; document.head.appendChild(st);
      }
      var old = out.querySelector('section.fc'); if (old) old.parentNode.removeChild(old);
      var h2 = [].filter.call(out.querySelectorAll('.block h2'), function (h) { return /^Поставщики/.test(h.textContent); })[0];
      if (h2 && !h2.id) h2.id = 'postavshchiki';
      out.insertAdjacentHTML('afterbegin', html(s, res));
      if (typeof window !== 'undefined' && window.dlkGoal) {
        try { window.dlkGoal('fincentr_razbor', { scheta: s.schetov, uroven: s.vyvod.kod }); } catch (e) { /* без цели */ }
      }
      return true;
    });
  }

  return { POROG: POROG, schitat: schitat, uroven: uroven, tranzit: tranzit, sobytiya: sobytiya, dengi: dengi, doli: doli,
    svodka: svodka, vyvod: vyvod, html: html, pokazat: pokazat, CSS: CSS };
});
