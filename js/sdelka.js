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

  // ---------- разметка блока (страница Паспорта) ----------
  // Только строки с экранированием: ни одного текста из счёта или ответа API без esc.
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nb(t) { return esc(t).replace(/(\d) (?=\d{3}\b)/g, '$1&nbsp;').replace(/(\d) (₽|%)/g, '$1&nbsp;$2'); }
  var MARK = { 'is-fact': ['m-ist', 'подтверждено источником'], 'is-calc': ['m-ras', 'наш расчёт'], 'is-none': ['m-net', 'не проверено'], 'is-bad': ['m-bad', 'ошибка'], 'is-high': ['m-bad', 'найдено'] };
  function galka(name, on, tekst, data) {
    return '<label class="sd-g"><input type="checkbox" name="' + esc(name) + '"' + (on ? ' checked' : '') + '><span>' + esc(tekst) + '</span>' +
      '<span class="sd-gp pechat">' + (on ? '☑' : '☐') + '</span></label>';
  }
  function shag(n, id, h, gotov, telo) {
    return '<li class="sd-sh' + (gotov ? ' gotov' : '') + '" id="' + id + '"><span class="sd-n" aria-hidden="true">' + (gotov ? '✓' : n) + '</span><div class="sd-b"><h3>' + n + '. ' + esc(h) +
      '<span class="sd-st">' + (gotov ? 'готово' : 'не закрыто') + '</span></h3>' + telo + '</div></li>';
  }
  function html(o) {
    o = o || {};
    var it = o.it || {}, ned = o.ned || [], pr = o.pr || [], rk = o.rekv || {}, g = o.galki || {}, dg = g.docs || {}, U = modul('Usloviya', './usloviya.js');
    var po = {}; ned.forEach(function (x) { (po[x.gruppa] = po[x.gruppa] || []).push(x); });
    var h = '<section class="sd" id="sd" aria-labelledby="sd-h"><div class="sd-top"><h2 id="sd-h">Досье сделки</h2>' +
      '<p class="sd-kogda">Сведения о компании — на ' + esc(o.svedeniyaNa || '') + '. Досье собрано ' + esc(o.sobrano || '') + '.</p></div>' +
      '<div class="sd-itog ' + esc(it.kod || 'predv') + '" role="status" aria-live="polite"><b>' + nb(it.zagolovok) + '</b><span>' + nb(it.tekst) + '</span></div>' +
      (o.svezh && o.svezh.tekst ? '<p class="sd-w">' + esc(o.svezh.tekst) + '</p>' : '') +
      '<ol class="sd-shagi">';
    // 1. ИНН и сумма
    h += shag(1, 'sd-summa', 'Контрагент и сумма', o.summa > 0,
      '<p class="sd-p">' + esc(o.nazvanie || '') + ' · ИНН ' + esc(o.inn || '') + '</p>' +
      '<form class="sd-f" data-sd="summa" onsubmit="return false"><label>Сумма сделки, ₽<input type="text" name="sd_summa" inputmode="numeric" autocomplete="off" placeholder="например, 500 000" value="' +
        (o.summa > 0 ? esc(money(o.summa, U).replace(/\s?₽$/, '')) : '') + '"></label><button class="btn noprint" type="submit">Пересчитать</button></form>');
    // 2. Факты, источники, даты
    var fk = o.fakty || [];
    h += shag(2, 'sd-fakty', 'Факты, источники и даты', !(po.fakty || []).length,
      '<ul class="sd-l">' + fk.map(function (x) {
        return '<li><span class="m ' + esc(x.mark) + '" aria-hidden="true"></span><a href="#r' + esc(x.n) + '">' + esc(x.n + '. ' + x.title) + '</a> — ' + esc(x.tekst) + '</li>';
      }).join('') + '</ul><p class="sd-s">Каждый раздел Паспорта ниже — с источником и датой сведений. Раздел «не проверяли» закрывается вашей отметкой самопроверки в нём.</p>');
    // 3. Реквизиты
    var rRows = (rk.stroki || []).map(function (x) {
      var mk = MARK[x.cls] || MARK['is-none'];
      return '<li class="' + esc(x.cls) + '"><span class="m ' + mk[0] + '" role="img" aria-label="' + esc(mk[1]) + '"></span><div><b>' + nb(x.nazv) + '</b> <span class="sd-v">' + nb(x.verdikt) + '</span>' +
        '<small>' + nb(x.meta) + (x.ssylka ? ' <a href="' + esc(x.ssylka.href) + '" target="_blank" rel="noopener nofollow">' + esc(x.ssylka.text) + '</a>' : '') + '</small></div></li>';
    }).join('');
    h += shag(3, 'sd-rekv', 'Реквизиты для оплаты', rk.vvedeny && !rk.oshibka && !rk.priostanovka && !(po.rekvizity || []).length,
      '<form class="sd-f noprint" data-sd="rekv" onsubmit="return false"><label class="sd-w100">Реквизиты из счёта или письма<textarea name="sd_rekv" rows="3" autocomplete="off" spellcheck="false" placeholder="ИНН 7700000000, р/с 40702…, БИК 04…">' + esc(o.rekvTekst || '') + '</textarea></label>' +
        '<button class="btn" type="submit">Сверить реквизиты</button><small>Сверяем в вашем браузере — реквизиты никуда не отправляются. Счёт целиком (PDF) — в <a href="/proverit-schet/">«Проверь счёт»</a>.</small></form>' +
      (rk.vvedeny ? '<p class="sd-p">ИНН ' + esc(rk.vvod.inn || '—') + ' · БИК ' + esc(rk.vvod.bik || '—') + ' · счёт ' + esc(rk.vvod.acc || '—') + ' — сверено ' + esc(o.rekvKogda || o.sobrano || '') + '</p><ul class="sd-acc">' + rRows + '</ul>' +
        galka('svereny', g.svereny, 'Сверили банк, БИК и номер счёта с договором или карточкой за подписью директора') +
        galka('telefon', g.telefon, 'Подтвердили реквизиты у поставщика по телефону из договора или с сайта — не из письма со счётом') : ''));
    // 4. Чего не хватает
    h += shag(4, 'sd-ned', 'Чего не хватает', !ned.length && !pr.length,
      (pr.length ? '<ul class="sd-pr">' + pr.map(function (x) { return '<li><b>' + nb(x.t) + '</b>' + (x.kak ? '<small>' + nb(x.kak) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      (ned.length ? '<ul class="sd-ned">' + ned.map(function (x) {
        return '<li><b>' + nb(x.t) + '</b><small>' + nb(x.kak || '') + (x.ssylka ? ' <a href="' + esc(x.ssylka.u) + '"' + (/^https:/.test(x.ssylka.u) ? ' target="_blank" rel="noopener nofollow"' : '') + '>' + esc(x.ssylka.t) + '</a>' : '') +
          (x.do ? ' <a class="noprint" href="' + esc(x.do) + '">Перейти&nbsp;↓</a>' : '') + '</small></li>';
      }).join('') + '</ul>' : (pr.length ? '' : '<p class="sd-p">Открытых пунктов нет.</p>')));
    // 5. Договор и документы
    var docs = o.docs || [];
    h += shag(5, 'sd-dok', 'Договор и документы', !(po.dokumenty || []).length && !ned.some(function (x) { return x.k === 'vyruchka'; }),
      '<p class="sd-s">Что запросить — соразмерно сумме (п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@). Отметьте, что получили.</p>' +
      docs.map(function (d) { return galka('doc_' + d.id, !!dg[d.id], d.title); }).join('') +
      (o.pvBaza && !docs.some(function (d) { return d.id === 'otchetnost'; }) ? galka('doc_otchetnost', !!dg.otchetnost, 'Бухгалтерская отчётность за последний год с квитанцией о сдаче') : '') +
      galka('dogovor', g.dogovor, 'Договор подписан обеими сторонами') +
      '<p class="sd-s noprint"><a href="' + esc(o.delopis || '/delopis/') + '">Собрать договор в Делописи</a> — с реквизитами из ЕГРЮЛ и защитными пунктами под найденные риски' +
        (it.kod === 'sobrano' ? '' : '; пока досье не закрыто, договор соберётся с оплатой по факту') + '. Опись приложений — кнопка «Папка к договору» наверху.</p>');
    // 6. Сохранение и повторная проверка
    var s = o.sohraneno;
    h += shag(6, 'sd-hran', 'Сохранение и повторная проверка', !!s && !(o.izm && o.izm.length) && !(o.svezh && o.svezh.staroe),
      (s ? '<p class="sd-p">Сохранено на этом устройстве ' + esc(mskVremya(s.t)) + (s.snimok && s.snimok.checked_at ? ' · проверка от ' + esc(mskData(s.snimok.checked_at)) : '') + '.</p>' : '<p class="sd-p">Пока не сохранено.</p>') +
      (o.izm ? (o.izm.length ? '<div class="sd-izm"><b>С сохранения изменилось:</b><ul>' + o.izm.map(function (x) { return '<li>' + nb(x) + '</li>'; }).join('') + '</ul></div>'
        : '<p class="sd-p">С сохранения статус, итог и замечания не изменились.</p>') : '') +
      '<div class="sd-btns noprint"><button class="btn" type="button" data-sd-act="save">' + (s ? 'Обновить сохранённое' : 'Сохранить на этом устройстве') + '</button>' +
        '<button class="btn" type="button" data-sd-act="povtor">Проверить заново</button>' + (s ? '<button class="btn sd-del" type="button" data-sd-act="del">Удалить с устройства</button>' : '') + '</div>' +
      '<p class="sd-s noprint" data-sd-msg role="status" aria-live="polite">Сохраняем только в этом браузере — Делоскоп досье не получает. Повторная проверка — одна из бесплатных проверок дня: сравним с сохранённым.</p>');
    h += '</ol><p class="stroka">' + esc(OGOVORKA) + ' ' + esc(OGOVORKA_OTM) + ' ' + esc(VERSIYA) + '.</p></section>';
    return h;
  }
  // Сохранённые досье — список для страницы без номера проверки
  function spisokHtml(a) {
    a = a || [];
    if (!a.length) return '';
    return '<div class="sd-spisok"><b>Сохранённые досье на этом устройстве</b><ul>' + a.slice(0, 10).map(function (x) {
      return '<li>' + (x.id ? '<a href="/pasport/kontragent/?id=' + encodeURIComponent(x.id) + (x.summa ? '&amp;summa=' + x.summa : '') + '#sd">' : '') + esc(x.nazvanie || ('ИНН ' + x.inn)) + (x.id ? '</a>' : '') +
        ' <small>ИНН ' + esc(x.inn) + (x.summa ? ' · ' + nb(money(x.summa)) : '') + ' · сохранено ' + esc(mskData(x.t)) + '</small></li>';
    }).join('') + '</ul></div>';
  }

  return {
    VERSIYA: VERSIYA, KEY: KEY, MAX: MAX, KLYUCH: KLYUCH, OGOVORKA: OGOVORKA, OGOVORKA_OTM: OGOVORKA_OTM, STARYJ_DNEJ: STARYJ_DNEJ,
    rekvizity: rekvizity, nedostaet: nedostaet, problemy: problemy, itog: itog, delopisSsylka: delopisSsylka,
    snimok: snimok, sravnit: sravnit, svezhest: svezhest, spisok: spisok, najti: najti, sohranit: sohranit, udalit: udalit,
    mskData: mskData, mskVremya: mskVremya, html: html, spisokHtml: spisokHtml, esc: esc
  };
});
