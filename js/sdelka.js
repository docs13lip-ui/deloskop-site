/*!
 * Делоскоп · «Досье сделки» v1 (задача владельца 22.10.2026: «досье конкретной сделки», аудит 22.10, приоритет 2).
 * Не новый продукт, а связка того, что уже есть, вокруг одной сделки на странице Паспорта контрагента:
 *   1. ИНН и сумма          — ответ /api/report (тот же, что у PDF-досье) + сумма из «Условий сделки» или счёта;
 *   2. Факты, источники, даты — разделы Паспорта (js/pasport-kontragenta.js), «не проверяли» ≠ «не нашли»;
 *   3. Реквизиты             — разбор «Проверь счёт» (js/smena.js) и строки js/acc.js + сверка ИНН и вида счёта;
 *   4. Чего не хватает       — открытые пункты: непроверенные разделы (закрываются отметкой самопроверки Паспорта),
 *                              выручка, реквизиты, документы по сумме (js/usloviya.js docs), договор (Делопись);
 *   5. Договор и документы   — список «что запросить» с отметками «получен», ссылка в Делопись с ИНН и долей предоплаты;
 *   6. Сохранение и повтор   — localStorage этого браузера только по кнопке; повторная проверка — новый ответ API,
 *                              сравнение со снимком на дату сохранения.
 * Правила (держит tests/sdelka.test.js):
 *   • неизвестное не считается «в порядке»: непроверенный раздел, несверенные реквизиты, нет суммы — открытый пункт;
 *   • пока есть открытый пункт или проблема — итог «оплата по факту поставки», доля предоплаты для договора 0 %;
 *   • ни в одном итоге нет «можно платить»: даже закрытое досье говорит «решение принимает ваша компания»;
 *   • отметки заказчика подписаны как отметки заказчика, Делоскоп их не проверял.
 * Чистые функции — без DOM и сети; хранилище передаётся аргументом (в тестах — заглушка).
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Sdelka = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var NB = ' ';
  var VERSIYA = 'Досье сделки v1';
  var KEY = 'dlk_sdelki', MAX = 20, STARYJ_DNEJ = 30, DEN = 864e5;
  var BO = { t: 'bo.nalog.gov.ru — отчётность', u: 'https://bo.nalog.gov.ru/' };
  var BI_DO = { t: 'service.nalog.ru/bi.do — решения о приостановке', u: 'https://service.nalog.ru/bi.do' };
  var OGOVORKA_OTM = 'Отметки «сверили», «получен», «подписан» ставит заказчик. Делоскоп эти документы не получал и не проверял.';
  var OGOVORKA = 'Досье собрано по сведениям источников на даты, указанные в разделах Паспорта, и по отметкам заказчика. ' +
    'Это оценка признаков по открытым данным, а не заключение о компании и не гарантия исхода сделки. Решение принимает ваша компания.';

  // Разделы Паспорта, без которых сделку не закрыть: «не проверяли» — открытый пункт, пока заказчик не проверит сам.
  var KLYUCH = ['nalogi', 'sudy', 'scheta', 'pristavy', 'stoplisty'];

  function modul(imya, put) {
    if (root && root[imya]) return root[imya];
    if (typeof module === 'object' && typeof require === 'function') { try { return require(put); } catch (e) {} }
    return null;
  }
  function cifry(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function plural(n, a, b, c) { var d = n % 10, s = n % 100; return d === 1 && s !== 11 ? a : d >= 2 && d <= 4 && (s < 12 || s > 14) ? b : c; }
  function money(x, U) { U = U || modul('Usloviya', './usloviya.js'); return U ? U.money(x) : String(Math.round(x)) + NB + '₽'; }
  function z2(n) { return (n < 10 ? '0' : '') + n; }
  // Дата и время по Москве (UTC+3 круглый год) — как в js/papka-proverok.js
  function mskData(t) { var d = new Date(+new Date(t) + 3 * 3600e3); if (isNaN(d)) return ''; return z2(d.getUTCDate()) + '.' + z2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
  function mskVremya(t) { var d = new Date(+new Date(t) + 3 * 3600e3); if (isNaN(d)) return ''; return mskData(t) + ' в ' + z2(d.getUTCHours()) + ':' + z2(d.getUTCMinutes()) + ' МСК'; }

  // ---------- 3. Реквизиты ----------
  // vvod — текст счёта/письма или {inn, bik, acc}; r — ответ API. Строки — в формате js/acc.js (cls, nazv, verdikt, meta, ssylka).
  function rekvizity(vvod, r) {
    var S = modul('DlkSmena', './smena.js'), A = modul('DlkAcc', './acc.js');
    var c = r && r.company || {}, inn = cifry(c.inn), tekst = typeof vvod === 'string' ? vvod : '';
    var d = typeof vvod === 'string' ? (S ? S.razobrat(vvod) : {}) : (vvod || {});
    d = { inn: d.inn ? cifry(d.inn) : null, bik: d.bik ? cifry(d.bik) : null, acc: d.acc ? cifry(d.acc) : null, ks: d.ks || null };
    var vvedeny = !!(d.bik || d.acc);
    var out = { vvod: d, vvedeny: vvedeny, stroki: [], oshibka: false, priostanovka: false };
    if (!vvedeny) return out;
    // ИНН получателя: в счёте бывают оба ИНН (покупателя и поставщика) — ищем ИНН проверенной компании во всём тексте
    var vTekste = inn && tekst && cifry(tekst.replace(/(\d)\s+(?=\d)/g, '$1')).indexOf(inn) >= 0 && new RegExp('(^|\\D)' + inn + '(\\D|$)').test(tekst.replace(/(\d)\s+(?=\d)/g, '$1'));
    if ((d.inn && d.inn === inn) || vTekste) {
      out.stroki.push({ cls: 'is-calc', nazv: 'ИНН получателя — проверенной компании', verdikt: 'Совпадает',
        meta: 'Сравнили ИНН в реквизитах с ИНН ' + inn + ' из ЕГРЮЛ — наш расчёт.' });
    } else if (d.inn) {
      out.stroki.push({ cls: 'is-bad', nazv: 'ИНН получателя — другой компании', verdikt: 'Не' + NB + 'совпадает',
        meta: 'В реквизитах ИНН ' + d.inn + ', а проверяли компанию с ИНН ' + inn + '. Деньги уйдут не тому, кого проверяли: попросите счёт заново.' });
    } else {
      out.stroki.push({ cls: 'is-none', nazv: 'ИНН получателя', verdikt: 'Не' + NB + 'нашли',
        meta: 'В реквизитах нет ИНН — сверьте получателя с договором.' });
    }
    // Вид счёта по первым цифрам (план счетов, Положение Банка России № 809-П): организации платим на счёт организации
    var vid = S && S.vidScheta ? S.vidScheta(d.acc) : null, ip = inn.length === 12;
    if (vid === 'fiz') out.stroki.push({ cls: 'is-bad', nazv: 'Счёт — личный счёт человека', verdikt: 'Не' + NB + 'для' + NB + 'оплаты',
      meta: 'Номер начинается с ' + d.acc.slice(0, 5) + ' — это счёт физического лица. Оплата ' + (ip ? 'предпринимателю' : 'компании') + ' — на расчётный счёт, не на личный.' });
    else if (vid === 'ip' && !ip) out.stroki.push({ cls: 'is-bad', nazv: 'Счёт предпринимателя, а не организации', verdikt: 'Не' + NB + 'совпадает',
      meta: 'Номер начинается с 40802 — так открывают счета ИП. Проверяли организацию: попросите её расчётный счёт.' });
    else if (vid === 'org' && ip) out.stroki.push({ cls: 'is-bad', nazv: 'Счёт организации, а не предпринимателя', verdikt: 'Не' + NB + 'совпадает',
      meta: 'Номер начинается с ' + d.acc.slice(0, 5) + ' — счёт организации. Проверяли предпринимателя: уточните получателя.' });
    else if (vid) out.stroki.push({ cls: 'is-calc', nazv: vid === 'ip' ? 'Счёт предпринимателя' : 'Счёт организации', verdikt: 'По' + NB + 'номеру',
      meta: 'Первые цифры ' + d.acc.slice(0, 5) + ' — вид счёта по плану счетов Банка России. Чей именно это счёт — видит только банк.' });
    var dm = r && r.damia || {}, pr = dm.priostanovki || dm.nalogbi || null;
    var rows = A ? A.stroki({ bik: d.bik, acc: d.acc, inn: inn || d.inn, bank: r && r.bik_info || null, priostanovki: pr && pr.status ? pr : null }) : [];
    out.stroki = out.stroki.concat(rows);
    out.oshibka = out.stroki.some(function (x) { return x.cls === 'is-bad'; });
    out.priostanovka = out.stroki.some(function (x) { return x.cls === 'is-high'; });
    return out;
  }

  // ---------- 4. Чего не хватает ----------
  // o = { r, v (Usloviya.decide), p (PasportKontragenta.sobrat), summa, rekv (rekvizity()), otm {номер раздела: отметка}, galki {svereny, telefon, dogovor, docs:{id:true}}, delopis }
  function razdelyKlyuch(p) { return (p && p.razdely || []).filter(function (x) { return KLYUCH.indexOf(x.id) >= 0; }); }
  function nedostaet(o) {
    o = o || {};
    var out = [], g = o.galki || {}, docsG = g.docs || {}, otm = o.otm || {}, v = o.v || {};
    if (!(o.summa > 0)) out.push({ k: 'summa', gruppa: 'sdelka', t: 'Сумма сделки не указана', kak: 'Впишите сумму — от неё зависят ориентир предоплаты и список документов.', do: '#sd-summa' });
    razdelyKlyuch(o.p).forEach(function (x) {
      if (x.status !== 'not_checked') return;
      var m = otm[x.n];
      if (m && m.ok && (m.rez === 'net' || m.rez === 'est')) return;     // проверил сам; «есть сведения» — уже проблема, не пробел
      var s = x.sam && x.sam[0];
      out.push({ k: 'r_' + x.id, gruppa: 'fakty', t: 'Не проверяли: ' + x.title.charAt(0).toLowerCase() + x.title.slice(1),
        kak: (m && m.rez === 'ne_udalos' ? 'Проверить не удалось — вернитесь к этому до оплаты. ' : '') + 'Проверьте в первоисточнике и поставьте отметку в разделе ' + x.n + '.',
        ssylka: s ? { t: s.tekst || s[0], u: s.url || s[1] } : null, do: '#r' + x.n });
    });
    var pv = v.predvaritelno;
    if (pv && pv.baza && !docsG.otchetnost) out.push({ k: 'vyruchka', gruppa: 'fakty', t: 'Выручки нет в отчётности — ориентир посчитан по возрасту компании',
      kak: 'Запросите бухгалтерскую отчётность за последний год с квитанцией о сдаче и отметьте, когда получите.', ssylka: BO, do: '#sd-dok' });
    var rk = o.rekv || {};
    if (!rk.vvedeny) out.push({ k: 'rekv', gruppa: 'rekvizity', t: 'Реквизиты для оплаты не сверены', kak: 'Вставьте реквизиты из счёта — сверим ИНН получателя, вид счёта, БИК и контрольный ключ.', do: '#sd-rekv' });
    else {
      if (!g.svereny) out.push({ k: 'rekv_dogovor', gruppa: 'rekvizity', t: 'Реквизиты не сверены с договором или карточкой за подписью директора', kak: 'Сверьте банк, БИК и номер счёта и поставьте отметку.', do: '#sd-rekv' });
      if (!g.telefon) out.push({ k: 'rekv_tel', gruppa: 'rekvizity', t: 'Реквизиты не подтверждены у поставщика по телефону', kak: 'Позвоните по номеру из договора или с сайта компании — не из письма со счётом.', do: '#sd-rekv' });
      var schetaPunkt = out.some(function (x) { return x.k === 'r_scheta'; });
      var schetaOtm = razdelyKlyuch(o.p).some(function (x) { return x.id === 'scheta' && otm[x.n] && otm[x.n].ok && otm[x.n].rez !== 'ne_udalos'; });
      var priostNe = (rk.stroki || []).some(function (x) { return x.cls === 'is-none' && /приостановк/i.test(x.nazv); });
      if (priostNe && !schetaPunkt && !schetaOtm) out.push({ k: 'priost', gruppa: 'rekvizity', t: 'Решения ФНС о приостановке операций по счетам не проверяли', kak: 'Введите ИНН и БИК на сервисе ФНС — ответ увидите только вы.', ssylka: BI_DO, do: '#sd-rekv' });
    }
    (v.docs || []).forEach(function (d) {
      if (d.id === 'card' && g.svereny) return;                          // карточку с реквизитами уже сверили
      if (docsG[d.id]) return;
      out.push({ k: 'doc_' + d.id, gruppa: 'dokumenty', t: 'Не получено: ' + d.title.charAt(0).toLowerCase() + d.title.slice(1), kak: d.why, do: '#sd-dok' });
    });
    if (!g.dogovor) out.push({ k: 'dogovor', gruppa: 'dokumenty', t: 'Договор не подписан', kak: 'Соберите договор с защитными пунктами в Делописи или возьмите свой — и отметьте, когда подпишете.',
      ssylka: o.delopis ? { t: 'Собрать договор в Делописи', u: o.delopis } : null, do: '#sd-dok' });
    return out;
  }

  // Проблемы — найденное, а не пробелы: ошибка в реквизитах, приостановка, «есть сведения» по отметке заказчика.
  function problemy(o) {
    o = o || {};
    var out = [], otm = o.otm || {};
    (o.rekv && o.rekv.stroki || []).forEach(function (x) { if (x.cls === 'is-bad' || x.cls === 'is-high') out.push({ k: 'rekv', t: x.nazv + ' — ' + x.verdikt.replace(/ /g, ' ').toLowerCase(), kak: x.meta }); });
    razdelyKlyuch(o.p).forEach(function (x) { var m = otm[x.n]; if (m && m.ok && m.rez === 'est') out.push({ k: 'otm_' + x.id, t: 'По вашей проверке: ' + x.title.charAt(0).toLowerCase() + x.title.slice(1) + ' — есть сведения', kak: m.sovet || '' }); });
    return out;
  }

  // ---------- итог досье: никогда не «можно платить» ----------
  function itog(o) {
    o = o || {};
    var v = o.v || {}, f = v.facts || {}, U = modul('Usloviya', './usloviya.js');
    var ned = o.nedostaet || nedostaet(o), pr = o.problemy || problemy(o), summa = o.summa > 0 ? o.summa : null;
    var R = { kod: '', zagolovok: '', tekst: '', predoplata: 0, otkryto: ned.length, problem: pr.length };
    if (f.status === 'LIQUIDATED') { R.kod = 'stop'; R.zagolovok = 'Сделку не заключать'; R.tekst = 'Компания прекратила существование — новый договор с ней заключить нельзя.'; return R; }
    if (v.tone === 'stop' || pr.length) {
      R.kod = 'stop'; R.zagolovok = 'Не платите вперёд';
      R.tekst = (pr.length ? pr[0].t + '. ' : (v.reasons && v.reasons[0] ? v.reasons[0].charAt(0).toUpperCase() + v.reasons[0].slice(1) + '. ' : '')) + 'Если сделка нужна — оплата после поставки или через аккредитив.';
      return R;
    }
    if (v.tone === 'post') { R.kod = 'post'; R.zagolovok = 'Только оплата по факту'; R.tekst = (v.advice || 'Платите после поставки или акта.'); return R; }
    if (ned.length) {
      R.kod = 'predv'; R.zagolovok = 'Досье не закрыто: ' + ned.length + NB + plural(ned.length, 'пункт', 'пункта', 'пунктов');
      R.tekst = 'Пока пункты не закрыты — оплата по факту поставки. Не проверено — не значит «в порядке».';
      return R;
    }
    R.kod = 'sobrano'; R.zagolovok = 'Пункты досье закрыты';
    var cap = typeof v.cap === 'number' ? v.cap : null, t = '';
    if (v.finorg || cap == null) t = 'Предел предоплаты для банка или страховой организации не считаем. ';
    else if (cap === 0) t = 'Ориентир Делоскопа по предоплате — 0' + NB + '₽: оплата по факту поставки. ';
    else if (summa && summa <= cap) { t = 'Сумма в пределах ориентира Делоскопа (до ' + money(cap, U) + '). '; R.predoplata = 100; }
    else if (summa) { R.predoplata = Math.max(1, Math.floor(cap / summa * 100)); t = 'По ориентиру Делоскопа вперёд — не больше ' + money(cap, U) + ' (' + R.predoplata + '% суммы), остальное — после поставки. '; }
    if (v.predvaritelno && v.predvaritelno.baza) t += 'Ориентир посчитан по возрасту компании — сверьте его с выручкой из полученной отчётности: не больше двух недель выручки. ';
    R.tekst = t + 'Решение принимает ваша компания.';
    return R;
  }

  // ---------- 5. Ссылка в Делопись ----------
  // ИНН контрагента и доля предоплаты из итога: досье не закрыто — 0 %, договор соберётся «оплата по факту».
  function delopisSsylka(inn, it) {
    var p = it && it.kod === 'sobrano' ? Math.max(0, Math.min(100, it.predoplata | 0)) : 0;
    return '/delopis/?kontragent=' + cifry(inn) + '&predoplata=' + p;
  }

  // ---------- 6. Снимок, сравнение, хранилище ----------
  function snimok(r, v, it) {
    r = r || {}; v = v || {};
    var c = r.company || {};
    return {
      checked_at: r.checked_at || null, id: r.report_id || null, risk_level: r.risk_level || null, status: c.status || null,
      tone: v.tone || null, cap: typeof v.cap === 'number' ? v.cap : null, headline: v.headline || '', predv: !!v.predvaritelno,
      itog: it ? it.kod : null, otkryto: it ? it.otkryto : null,
      signaly: (r.signals || []).filter(function (s) { return s && (s.status === 'bad' || s.status === 'warn'); }).map(function (s) { return String(s.title || '').slice(0, 120); }).sort()
    };
  }
  var UR = { low: 'без серьёзных сигналов', medium: 'есть вопросы', high: 'есть серьёзные сигналы' };
  var ST = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  function sravnit(a, b, U) {
    if (!a || !b) return [];
    var out = [];
    if (a.status !== b.status) out.push('Статус: было «' + (ST[a.status] || a.status || '—') + '», стало «' + (ST[b.status] || b.status || '—') + '»');
    if (a.risk_level !== b.risk_level) out.push('Итог проверки: было «' + (UR[a.risk_level] || '—') + '», стало «' + (UR[b.risk_level] || '—') + '»');
    if (a.headline !== b.headline) out.push('Вывод: было «' + a.headline + '», стало «' + b.headline + '»');
    if (a.cap !== b.cap && a.cap != null && b.cap != null) out.push('Ориентир предоплаты: было ' + money(a.cap, U) + ', стало ' + money(b.cap, U));
    var nov = (b.signaly || []).filter(function (x) { return (a.signaly || []).indexOf(x) < 0; });
    var ushli = (a.signaly || []).filter(function (x) { return (b.signaly || []).indexOf(x) < 0; });
    if (nov.length) out.push('Новые замечания: ' + nov.join('; '));
    if (ushli.length) out.push('Ушли замечания: ' + ushli.join('; '));
    return out;
  }
  function dnej(t, seichas) { var x = Date.parse(t || ''); if (!isFinite(x)) return null; return Math.floor(((seichas == null ? Date.now() : +seichas) - x) / DEN); }
  function svezhest(t, seichas) {
    var n = dnej(t, seichas);
    if (n == null) return null;
    return { dnej: n, staroe: n > STARYJ_DNEJ, tekst: n > STARYJ_DNEJ ? 'Сведениям ' + n + NB + plural(n, 'день', 'дня', 'дней') + ' — перед оплатой проверьте заново.' : '' };
  }
  function chitat(ls) { try { var a = JSON.parse(ls && ls.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return x && /^\d{10}(\d{2})?$/.test(x.inn); }) : []; } catch (e) { return []; } }
  function pisat(ls, a) { try { ls.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function spisok(ls) { return chitat(ls).sort(function (a, b) { return (b.t || 0) - (a.t || 0); }); }
  function najti(ls, inn) { inn = cifry(inn); return chitat(ls).filter(function (x) { return x.inn === inn; })[0] || null; }
  // Сохраняем только то, что нужно для повтора: без названий файлов, без персональных данных подписантов.
  function sohranit(ls, d, seichas) {
    if (!ls || !d || !/^\d{10}(\d{2})?$/.test(cifry(d.inn))) return false;
    var z = {
      inn: cifry(d.inn), nazvanie: String(d.nazvanie || '').slice(0, 160), id: /^[A-Za-z0-9_-]{8,24}$/.test(d.id || '') ? d.id : '',
      summa: d.summa > 0 ? Math.round(d.summa) : null,
      rekv: d.rekv ? { inn: d.rekv.inn || null, bik: d.rekv.bik || null, acc: d.rekv.acc || null } : null,
      galki: { svereny: !!(d.galki && d.galki.svereny), telefon: !!(d.galki && d.galki.telefon), dogovor: !!(d.galki && d.galki.dogovor), docs: d.galki && d.galki.docs || {} },
      otm: (d.otm || []).filter(function (o) { return o && o.ok; }).slice(0, 20),
      snimok: d.snimok || null, t: seichas == null ? Date.now() : +seichas
    };
    var a = chitat(ls).filter(function (x) { return x.inn !== z.inn; });
    a.unshift(z);
    return pisat(ls, a.slice(0, MAX)) ? z : false;
  }
  function udalit(ls, inn) { inn = cifry(inn); return pisat(ls, chitat(ls).filter(function (x) { return x.inn !== inn; })); }

  return {
    VERSIYA: VERSIYA, KEY: KEY, MAX: MAX, KLYUCH: KLYUCH, OGOVORKA: OGOVORKA, OGOVORKA_OTM: OGOVORKA_OTM, STARYJ_DNEJ: STARYJ_DNEJ,
    rekvizity: rekvizity, nedostaet: nedostaet, problemy: problemy, itog: itog, delopisSsylka: delopisSsylka,
    snimok: snimok, sravnit: sravnit, svezhest: svezhest, spisok: spisok, najti: najti, sohranit: sohranit, udalit: udalit,
    mskData: mskData, mskVremya: mskVremya
  };
});
