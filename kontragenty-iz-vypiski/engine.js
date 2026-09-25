/*! Делоскоп · «Кому вы платите» — движок разбора выписки 1С и расчёта «денег на кону».
 *  Работает целиком в браузере: выписка не покидает компьютер клиента.
 *  На сервер (по желанию) уходит только список ИНН поставщиков — без сумм и назначений.
 *  Этот же разборщик выписки рассчитан на повторное использование страницей «Наличные глазами банка».
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeloVypiska = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ставки и нормы (менять только здесь) ---------- */
  var NORMS = {
    vatMain: 22,          // НДС с 01.01.2026 (ст. 164 НК в ред. закона от 28.11.2025 № 425-ФЗ)
    profitTax: 25,        // налог на прибыль с 2025 г. (ст. 284 НК)
    usnDr: 15,            // УСН «доходы минус расходы»
    fineCareless: 20,     // п. 1 ст. 122 НК — неосторожность
    fineIntent: 40,       // п. 3 ст. 122 НК — умысел
    shareKey: 0.30,       // доля в расходах, с которой поставщик «ключевой»
    shareOneShot: 0.10    // разовый платёж крупнее этой доли — «разовый крупный»
  };

  /* ---------- режимы налогообложения клиента ---------- */
  // vat: теряется ли вычет НДС; base: ставка налога на расходы (снимаются при «технической» компании)
  var REGIMES = {
    osn:      { title: 'ОСН',                       vat: true,  base: NORMS.profitTax },
    usn15vat: { title: 'УСН 15% с НДС 22%',         vat: true,  base: NORMS.usnDr },
    usn15:    { title: 'УСН 15% без НДС или 5–7%',  vat: false, base: NORMS.usnDr },
    usn6:     { title: 'УСН 6%',                    vat: false, base: 0 }
  };

  /* ---------- контрольные числа ---------- */
  function innOk(s) {
    s = String(s || '');
    if (!/^\d{10}$|^\d{12}$/.test(s)) return false;
    var d = s.split('').map(Number);
    function k(w, n) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return (x % 11) % 10 === d[n]; }
    if (s.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8], 9);
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 10) && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 11);
  }

  /* ---------- чтение файла: кодировка ---------- */
  // 1С пишет выписку в Windows-1251 (Кодировка=Windows) или DOS (cp866); иногда банки отдают UTF-8.
  function decode(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
    var utf = null;
    try { utf = new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { utf = null; }
    if (utf !== null && /1CClientBankExchange|СекцияДокумент/.test(utf)) return utf;
    var head866 = new TextDecoder('ibm866').decode(u8.subarray(0, 600));
    if (/Кодировка\s*=\s*DOS/i.test(head866)) return new TextDecoder('ibm866').decode(u8);
    return new TextDecoder('windows-1251').decode(u8);
  }

  /* ---------- разбор формата 1CClientBankExchange ---------- */
  function num(s) {
    var v = parseFloat(String(s || '').replace(/[\s ]/g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
  }
  function parse(text) {
    var lines = String(text || '').split(/\r?\n/);
    var res = { ok: false, header: {}, accounts: [], docs: [], errors: [] };
    if (!/1CClientBankExchange/.test(lines.slice(0, 3).join('\n'))) {
      res.errors.push('not1c');
    }
    var cur = null, sect = null;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i].replace(/^﻿/, '').trim();
      if (!L) continue;
      var m = /^СекцияДокумент\s*=\s*(.*)$/.exec(L);
      if (m) { cur = { kind: m[1].trim() }; continue; }
      if (/^КонецДокумента$/.test(L)) { if (cur) res.docs.push(cur); cur = null; continue; }
      if (/^СекцияРасчСчет$/.test(L)) { sect = {}; continue; }
      if (/^КонецРасчСчет$/.test(L)) { if (sect) res.accounts.push(sect); sect = null; continue; }
      var eq = L.indexOf('=');
      if (eq < 1) continue;
      var key = L.slice(0, eq).trim(), val = L.slice(eq + 1).trim();
      if (cur) {
        if (/^НазначениеПлатежа\d$/.test(key)) cur.НазначениеПлатежа = ((cur.НазначениеПлатежа || '') + ' ' + val).trim();
        else if (!(key in cur)) cur[key] = val;
      } else if (sect) sect[key] = val;
      else res.header[key] = val;
    }
    res.ok = res.docs.length > 0;
    return res;
  }

  /* ---------- кто мы: свои счета и ИНН ---------- */
  function detectSelf(parsed) {
    var accs = {};
    parsed.accounts.forEach(function (a) { if (a.РасчСчет) accs[a.РасчСчет] = 1; });
    if (parsed.header.РасчСчет) accs[parsed.header.РасчСчет] = 1;
    if (!Object.keys(accs).length) {                    // нет секции счёта — берём самый частый счёт
      var cnt = {};
      parsed.docs.forEach(function (d) {
        [d.ПлательщикСчет, d.ПолучательСчет].forEach(function (a) { if (a) cnt[a] = (cnt[a] || 0) + 1; });
      });
      var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
      if (top) accs[top] = 1;
    }
    var innCnt = {};
    parsed.docs.forEach(function (d) {
      if (accs[d.ПлательщикСчет] && d.ПлательщикИНН) innCnt[d.ПлательщикИНН] = (innCnt[d.ПлательщикИНН] || 0) + 1;
      if (accs[d.ПолучательСчет] && d.ПолучательИНН) innCnt[d.ПолучательИНН] = (innCnt[d.ПолучательИНН] || 0) + 1;
    });
    var inn = Object.keys(innCnt).sort(function (a, b) { return innCnt[b] - innCnt[a]; })[0] || null;
    return { accounts: Object.keys(accs), inn: inn };
  }

  /* ---------- куда ушли деньги: категория исходящего платежа ---------- */
  function category(d, self) {
    var acc = d.ПолучательСчет || '', inn = d.ПолучательИНН || '', pur = (d.НазначениеПлатежа || '').toLowerCase();
    if (self.inn && inn === self.inn) return 'self';
    if (/^(03100|03212|03221|40101|40102)/.test(acc) || d.ПоказательКБК || d.СтатусСоставителя) return 'budget';
    if (/^(706|47422|47423|30102|30232|61301)/.test(acc) || /комисси[яи] банка|банковск[а-я]+ комисси|за обслуживание сч[её]та|за ведение сч[её]та/.test(pur)) return 'bank';
    if (/^(40817|40820|423\d\d|40803|40813)/.test(acc)) {
      if (/заработн|зарплат|аванс по з|отпускн|премия|больничн|пособи|под отч[её]т|подотч[её]т/.test(pur)) return 'salary';
      return 'person';
    }
    if (/заработн[а-я]* плат|зарплат[а-я]* |реестр[у]? .*зарплат|зачислени[ея] на карты сотрудник/.test(pur)) return 'salary';
    if (/выдача (займа|кредита)|погашени[ея] (кредита|займа)|проценты по (кредит|займ)/.test(pur)) return 'loan';
    return 'supplier';
  }

  /* ---------- НДС из назначения платежа ---------- */
  function vatOf(sum, purpose) {
    var p = String(purpose || '').replace(/ /g, ' ');
    if (/без\s*(налога\s*)?\(?\s*НДС|НДС\s*не\s*облагается|НДС\s*не\s*предусмотрен|НДС\s*нет|освобожд[а-я]*\s*от\s*НДС/i.test(p)) return { kind: 'none', amount: 0, rate: 0 };
    var m = /НДС[^0-9%]{0,12}(\d{1,2}(?:[.,]\d+)?)\s*%[^0-9]{0,12}?(?:[-–—=:]|\s)\s*(\d[\d\s]*(?:[.,-]\d{1,2})?)/i.exec(p);
    if (m) {
      var amt = num(m[2].replace(/-(\d{2})$/, '.$1'));
      var rate = num(m[1]);
      if (amt > 0 && amt < sum) return { kind: 'stated', amount: round2(amt), rate: rate };
      return { kind: 'rate', amount: round2(sum * rate / (100 + rate)), rate: rate };
    }
    m = /НДС[^0-9]{0,20}(\d[\d\s]*[.,-]\d{2})/i.exec(p);
    if (m) {
      var a = num(m[1].replace(/-(\d{2})$/, '.$1'));
      if (a > 0 && a < sum) return { kind: 'stated', amount: round2(a), rate: Math.round(a / (sum - a) * 100) };
    }
    m = /НДС[^0-9]{0,12}(\d{1,2})\s*%/i.exec(p);
    if (m) { var r = num(m[1]); return { kind: 'rate', amount: round2(sum * r / (100 + r)), rate: r }; }
    if (/НДС/i.test(p)) return { kind: 'mentioned', amount: 0, rate: null };
    return { kind: 'unknown', amount: 0, rate: null };
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  /* ---------- «размытое» назначение: не видно, за что платим ---------- */
  var SUBJECT = /(товар|материал|услуг|работ|аренд|поставк|оборудован|запчаст|топлив|гсм|продукц|транспорт|перевоз|доставк|монтаж|ремонт|консульт|лиценз|программ|реклам|связ|электроэнерг|тепло|вод[аоы]|коммунал|страхов|обучен|сырь|комплектующ|упаковк|канцтовар|сопровожден|разработк|хостинг|сервер|спецодежд|инструмент|стройматериал|бетон|металл|пиломатериал|щебень|песок|кабел|техник|автомобил|запасн|продукт|медикамент|мебел|оргтехник|картридж|бумаг|питани|клининг|уборк|охран|юридическ|бухгалтерск|аудит|маркетинг|дизайн|печать|типограф|сертификац|экспертиз|проект|изыскан|логистик|склад|хранени|погрузк|разгрузк|таможен|фрахт|агентск|комисси)/i;
  function vaguePurpose(p) {
    var s = String(p || '').replace(/НДС.*$/i, '').replace(/[«»"']/g, ' ');
    if (SUBJECT.test(s)) return false;
    return /(оплата|перечислен|предоплат|по сч[её]ту|по договору|за\s*$|согласно)/i.test(s) || s.trim().length < 12;
  }

  /* ---------- главный разбор: поставщики и сигналы ---------- */
  function analyze(parsedList, opts) {
    opts = opts || {};
    var regime = REGIMES[opts.regime] || REGIMES.osn;
    if (!Array.isArray(parsedList)) parsedList = [parsedList];
    var merged = { header: {}, accounts: [], docs: [] };
    parsedList.forEach(function (p) {
      merged.accounts = merged.accounts.concat(p.accounts);
      merged.docs = merged.docs.concat(p.docs);
      if (!merged.header.РасчСчет && p.header.РасчСчет) merged.header.РасчСчет = p.header.РасчСчет;
      ['ДатаНачала', 'ДатаКонца'].forEach(function (k) { if (p.header[k]) (merged.header[k] = merged.header[k] || []).push(p.header[k]); });
    });
    var self = detectSelf(merged);
    var accSet = {}; self.accounts.forEach(function (a) { accSet[a] = 1; });

    // одинаковый документ мог прийти в двух файлах — убираем дубли
    var seen = {}, docs = [];
    merged.docs.forEach(function (d) {
      var k = [d.Номер, d.Дата, d.Сумма, d.ПлательщикСчет, d.ПолучательСчет].join('|');
      if (!seen[k]) { seen[k] = 1; docs.push(d); }
    });

    var totals = { out: 0, in: 0, supplier: 0, budget: 0, salary: 0, person: 0, bank: 0, self: 0, loan: 0 };
    var counts = { out: 0, supplier: 0, person: 0 };
    var map = {}, dates = [];
    docs.forEach(function (d) {
      var sum = num(d.Сумма);
      if (!(sum > 0)) return;
      var date = d.ДатаСписано || d.ДатаПоступило || d.Дата || '';
      if (date) dates.push(toIso(date));
      var outgoing = accSet[d.ПлательщикСчет] || (!accSet[d.ПолучательСчет] && self.inn && d.ПлательщикИНН === self.inn);
      if (!outgoing) { totals.in += sum; return; }
      totals.out += sum; counts.out++;
      var cat = category(d, self);
      totals[cat] = (totals[cat] || 0) + sum;
      if (cat === 'person') counts.person++;
      if (cat !== 'supplier') return;
      counts.supplier++;
      var inn = (d.ПолучательИНН || '').replace(/\D/g, '');
      var key = inn || ('acc:' + (d.ПолучательСчет || '?'));
      var s = map[key] || (map[key] = {
        inn: inn || null, name: cleanName(d.Получатель1 || d.Получатель || ''), account: d.ПолучательСчет || '',
        sum: 0, vat: 0, vatKnown: 0, noVat: 0, count: 0, first: null, last: null, max: 0,
        purposes: [], vague: 0, round: 0
      });
      s.sum += sum; s.count++; s.max = Math.max(s.max, sum);
      var v = vatOf(sum, d.НазначениеПлатежа);
      if (v.kind === 'stated' || v.kind === 'rate') { s.vat += v.amount; s.vatKnown += sum; }
      if (v.kind === 'none') s.noVat += sum;
      if (vaguePurpose(d.НазначениеПлатежа)) s.vague++;
      if (sum >= 10000 && sum % 1000 === 0) s.round++;
      var iso = toIso(date);
      if (iso) { if (!s.first || iso < s.first) s.first = iso; if (!s.last || iso > s.last) s.last = iso; }
      if (s.purposes.length < 3 && d.НазначениеПлатежа && s.purposes.indexOf(d.НазначениеПлатежа) < 0) s.purposes.push(d.НазначениеПлатежа);
    });

    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.forEach(function (s) {
      s.sum = round2(s.sum); s.vat = round2(s.vat);
      s.share = totals.supplier ? s.sum / totals.supplier : 0;
      s.innValid = s.inn ? innOk(s.inn) : false;
      s.kind = s.inn && s.inn.length === 12 ? 'ip' : 'org';
      s.stake = stake(s, regime);
      s.signals = signals(s, regime);
    });
    list.sort(function (a, b) { return b.sum - a.sum; });

    dates.sort();
    var period = { from: dates[0] || null, to: dates[dates.length - 1] || null };
    var res = {
      self: self, period: period, regime: opts.regime || 'osn', totals: roundAll(totals), counts: counts,
      suppliers: list, docs: docs.length
    };
    res.flows = flowSignals(res);
    res.todo = todo(res);
    return res;
  }

  function cleanName(n) {
    n = String(n || '').replace(/^ИНН\s*\d{10,12}\s*/i, '').replace(/\s+/g, ' ').trim();
    n = n.replace(/^Общество с ограниченной ответственностью\s*/i, 'ООО ')
         .replace(/^Индивидуальный предприниматель\s*/i, 'ИП ')
         .replace(/^Акционерное общество\s*/i, 'АО ');
    return n;
  }
  function toIso(d) {
    var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(d || '').trim());
    return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
  }
  function roundAll(o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = round2(o[k]); }); return r; }

  /* ---------- «деньги на кону» по одному поставщику ---------- */
  // Что снимет налоговая, если признает поставщика «технической» компанией (ст. 54.1 НК).
  //  • мягкий сценарий — налоговая реконструкция (письмо ФНС от 10.03.2021 № БВ-4-7/3060@, п. 17, 19):
  //    снимают вычет НДС, расходы оставляют по рыночной цене, штраф 20% (п. 1 ст. 122);
  //  • жёсткий — умысел, реконструкции нет: снимают и НДС, и расходы, штраф 40% (п. 3 ст. 122).
  //  Пени считаются отдельно и зависят от срока — в сумму не включаем, но говорим о них.
  function stake(s, regime) {
    var vat = regime.vat ? s.vat : 0;
    var net = s.sum - (regime.vat ? s.vat : 0);
    var baseTax = round2(net * regime.base / 100);
    var soft = round2(vat * (1 + NORMS.fineCareless / 100));
    var hard = round2((vat + baseTax) * (1 + NORMS.fineIntent / 100));
    return { vat: round2(vat), tax: baseTax, soft: soft, hard: hard };
  }

  /* ---------- сигналы по поставщику (без реестров, только из выписки) ---------- */
  function signals(s, regime) {
    var out = [];
    function add(level, code, text) { out.push({ level: level, code: code, text: text }); }
    if (s.inn && !s.innValid) add('bad', 'inn_invalid', 'ИНН ' + s.inn + ' с ошибкой в контрольной цифре — такого ИНН не бывает. Проверьте, кому ушли деньги.');
    if (!s.inn) add('warn', 'inn_missing', 'В платёжке нет ИНН получателя. Для банка и налоговой это слепое пятно.');
    if (s.share >= NORMS.shareKey) add('warn', 'key', 'Ключевой поставщик: ' + pct(s.share) + ' всех расходов. Проверять в первую очередь и держать папку документов — договор, акты, переписку.');
    if (s.count === 1 && s.share >= NORMS.shareOneShot) add('warn', 'oneshot', 'Разовый крупный платёж. Такие сделки налоговая проверяет чаще — сохраните договор, акт и доказательства, что работа сделана.');
    if (s.vague >= Math.max(1, Math.ceil(s.count / 2))) add('info', 'vague', 'В назначении не видно, за что платите. Банк и налоговая читают назначение первым — пишите предмет: «за доставку бетона по договору № …».');
    if (regime.vat && s.noVat >= s.sum * 0.9 && s.kind === 'org' && s.sum >= 300000) add('info', 'novat', 'Поставщик работает без НДС — вычета по нему нет. Для ОСН это минус ' + money(round2(s.sum * NORMS.vatMain / (100 + NORMS.vatMain))) + ' ₽ к цене в сравнении с плательщиком НДС.');
    if (s.count >= 4 && s.round === s.count) add('info', 'round', 'Все платежи — круглые суммы. Само по себе не нарушение, но банк замечает, если за ними нет счетов и актов.');
    return out;
  }

  /* ---------- сигналы по потокам (что видит банк по 115-ФЗ) ---------- */
  function flowSignals(r) {
    var out = [], t = r.totals;
    if (!t.out) return out;
    var personShare = t.person / t.out;
    if (personShare >= 0.3) out.push({ level: 'warn', code: 'persons', text: 'На счета физлиц ушло ' + pct(personShare) + ' расходов (не зарплата). Банки смотрят на такие переводы по 115-ФЗ: укажите основание в назначении и держите договоры.' });
    var taxShare = t.budget / t.out;
    if (t.out >= 1000000 && taxShare < 0.009) out.push({ level: 'warn', code: 'lowtax', text: 'Налоги и взносы — ' + pct(taxShare) + ' от всех списаний. Банк сравнивает эту долю с 0,9% (методические рекомендации ЦБ № 18-МР): ниже — повод для вопросов.' });
    if (t.self / t.out >= 0.5) out.push({ level: 'info', code: 'self', text: 'Половина и больше расходов — переводы на ваши же счета. Банку понятнее, если основная выручка и платежи идут через один счёт.' });
    return out;
  }

  /* ---------- три дела на неделю ---------- */
  function todo(r) {
    var t = [];
    var bad = r.suppliers.filter(function (s) { return s.signals.some(function (x) { return x.level === 'bad'; }); });
    if (bad.length) t.push('Выяснить, кому ушли платежи с неверным ИНН: ' + bad.slice(0, 3).map(label).join(', ') + '.');
    var top = r.suppliers.filter(function (s) { return s.innValid; }).slice(0, 3);
    if (top.length) t.push('Проверить по реестрам трёх главных поставщиков — на них ' + pct(top.reduce(function (a, s) { return a + s.share; }, 0)) + ' расходов: ' + top.map(label).join(', ') + '.');
    var vague = r.suppliers.filter(function (s) { return s.signals.some(function (x) { return x.code === 'vague'; }); });
    if (vague.length) t.push('Дописать предмет в назначение платежей ' + (vague.length === 1 ? 'поставщику ' + label(vague[0]) : vague.length + ' поставщикам') + ' — с этого начинают банк и налоговая.');
    var key = r.suppliers.filter(function (s) { return s.signals.some(function (x) { return x.code === 'key' || x.code === 'oneshot'; }); });
    if (key.length && t.length < 3) t.push('Собрать папку по ' + label(key[0]) + ': договор, акты, переписка, фото или отчёт о результате.');
    r.flows.forEach(function (f) { if (t.length < 3 && f.level === 'warn') t.push(f.code === 'persons' ? 'Проверить переводы физлицам: у каждого должно быть основание в назначении.' : 'Сверить долю налогов с оборотом и подготовить пояснение для банка.'); });
    if (t.length < 3) t.push('Раз в месяц повторять разбор — новые поставщики появляются незаметно.');
    return t.slice(0, 3);
  }
  function label(s) { return s.name || s.inn || 'без названия'; }

  /* ---------- итог «деньги на кону» с учётом проверки по реестрам ---------- */
  // risk: { inn: 'high'|'medium'|'low' } — ответ API. Без ответа считаем «потенциал» по всем поставщикам.
  function exposure(r, risk) {
    var sum = { soft: 0, hard: 0, n: 0, checked: 0 };
    var watch = { soft: 0, hard: 0, n: 0 };
    r.suppliers.forEach(function (s) {
      var lvl = risk && s.inn ? risk[s.inn] : null;
      if (lvl) sum.checked++;
      if (lvl === 'high' || (s.inn && !s.innValid)) { sum.soft += s.stake.soft; sum.hard += s.stake.hard; sum.n++; }
      else if (lvl === 'medium') { watch.soft += s.stake.soft; watch.hard += s.stake.hard; watch.n++; }
    });
    return { risk: roundAll(sum), watch: roundAll(watch) };
  }

  /* ---------- формат ---------- */
  function money(n) { return Math.round(n).toLocaleString('ru-RU').replace(/ | /g, ' '); }
  // «Ководство»: знак процента пишется слитно с числом — «30%».
  function pct(x) { var v = x * 100; return (v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10)).toString().replace('.', ',') + '%'; }

  return {
    NORMS: NORMS, REGIMES: REGIMES, innOk: innOk, decode: decode, parse: parse, detectSelf: detectSelf,
    category: category, vatOf: vatOf, vaguePurpose: vaguePurpose, analyze: analyze, stake: stake,
    exposure: exposure, money: money, pct: pct, toIso: toIso
  };
});
