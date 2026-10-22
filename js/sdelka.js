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
  var VERSIYA = 'Досье сделки v3';
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
  function mskVremya(t) { var d = new Date(+new Date(t) + 3 * 3600e3); if (isNaN(d)) return ''; return mskData(t) + ' в ' + z2(d.getUTCHours()) + ':' + z2(d.getUTCMinutes()) + NB + 'МСК'; }

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

  // ---------- «Реальность контрагента» (dosje-sdelki-v2, задача владельца 22.10: «самые важные факторы — в самом начале») ----------
  // Признаки, по которым налоговая и банк судят, существует ли бизнес на самом деле: налоги, долги, штат, достоверность записей,
  // отчётность, руководитель, возраст, счета. Слова и числа — из ответа проверки (js/sushchestvennoe.js — тот же список фактов,
  // что в отчёте; разделы досье; блоки реестров). Своих выводов не добавляем; нет сведений — «не проверяли», серым, со ссылкой.
  var RE_YUR = /^(ООО|АО|ПАО|ЗАО|ОАО|НАО|АНО|ФГУП|МУП|ГУП|ОБЩЕСТВО|АКЦИОНЕРНОЕ|ПУБЛИЧНОЕ|НЕПУБЛИЧНОЕ|ЗАКРЫТОЕ|ОТКРЫТОЕ|ФЕДЕРАЛЬН|ГОСУДАРСТВЕНН|МУНИЦИПАЛЬН|ФОНД|ТОВАРИЩЕСТВО|КООПЕРАТИВ|АССОЦИАЦИЯ|СОЮЗ|ПАРТНЕРСТВО|УЧРЕЖДЕНИЕ|КОМПАНИЯ|РОССИЙСКАЯ ФЕДЕРАЦИЯ|СУБЪЕКТ|ДЕПАРТАМЕНТ|МИНИСТЕРСТВО|КОМИТЕТ|АДМИНИСТРАЦИЯ)(\s|\b|«|")/i;
  function str(v) { return v == null ? '' : String(v).trim(); }
  function dmyIso(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v)); return m ? m[3] + '.' + m[2] + '.' + m[1] : str(v); }
  function sekcii(r) { var o = {}; ((r && r.dossier || {}).sections || []).forEach(function (s) { if (s && s.id) o[s.id] = s.rows || []; }); return o; }
  function stroka(rows, re) { var x = (rows || []).filter(function (z) { return z && re.test(str(z[0])) && str(z[1]); })[0]; return x ? str(x[1]) : ''; }
  var SAM = { nalogi: 'https://service.nalog.ru/zd.do', fssp: 'https://fssp.gov.ru/iss/ip/', sudy: 'https://kad.arbitr.ru/', shtat: 'https://pb.nalog.ru/',
    dostovernost: 'https://egrul.nalog.ru/', otchetnost: 'https://bo.nalog.gov.ru/', scheta: 'https://service.nalog.ru/bi.do', svyazi: 'https://pb.nalog.ru/' };
  function realnost(r) {
    r = r || {};
    var SU = modul('Sushchestvennoe', './sushchestvennoe.js'), F = {}, c = r.company || {}, sec = sekcii(r), dm = r.damia || {};
    try { var fx = SU ? SU.fakty(r) : null; if (fx) fx.spisok.concat(fx.eshche).forEach(function (f) { F[f.k] = f; }); } catch (e) { F = {}; }
    function b(k) { var x = dm[k]; return x && typeof x === 'object' ? x : null; }
    function ok(x) { return x && (x.status === 'found' || x.status === 'not_found' || x.sostoyanie === 'found' || x.sostoyanie === 'not_found'); }
    function naiden(x) { return x && (x.status === 'found' || x.sostoyanie === 'found'); }
    var T = [];
    function plitka(k, nazv, f, dop) {
      var t = { k: k, nazv: nazv, znach: '', pod: '', ton: 'off', ist: '', data: '', sam: SAM[k] || '' };
      if (f) { t.znach = f.znach; t.ton = f.ton === 'neutral' ? 'info' : f.ton; t.ist = f.ist || ''; t.data = f.data || ''; t.pod = f.pod || ''; t.spravka = f.spravka ? { t: f.spravkaT || 'справка', u: f.spravka } : null; }
      if (dop) for (var z in dop) if (dop[z] != null && dop[z] !== '') t[z] = dop[z];
      if (!t.znach) { t.znach = 'Не проверяли'; t.ton = 'off'; }
      if (/^Не проверяли/.test(t.znach)) t.ton = 'off';
      T.push(t);
    }
    // 1. Налоги: долг по открытым данным ФНС + сколько уплачено за год
    var upl = stroka(sec.finance, /^Уплачено налогов/i), fin = stroka(sec.finance, /^Данные на/i);
    plitka('nalogi', 'Налоги', F.tax_debt, { pod: upl ? 'Уплачено налогов и взносов за год: ' + upl + (fin ? ' (на ' + fin + ')' : '') : '' });
    // 2. Долги и суды: приставы (ФССП) + незавершённые дела, где компания — ответчик
    var fs = b('fssp'), su = b('sudy'), dl = { ton: 'off', znach: '', pod: '', ist: [], data: '' }, ne = [];
    if (ok(fs)) {
      var fd = fs.dannye || {};
      if (naiden(fs) && +fd.otkryto > 0) { dl.znach = 'У приставов ' + fd.otkryto + ' ' + plural(+fd.otkryto, 'открытое производство', 'открытых производства', 'открытых производств') + (fd.ostatok ? ' · остаток ' + money(+fd.ostatok) : ''); dl.ton = 'bad'; }
      else if (naiden(fs)) { dl.znach = 'Есть сведения у приставов'; dl.ton = 'warn'; }
      else { dl.znach = 'У приставов — нет открытых производств'; dl.ton = 'ok'; }
      dl.ist.push('ФССП'); dl.data = dmyIso(fs.data_svedeniy);
    } else ne.push('приставов');
    if (ok(su)) {
      var sd = su.dannye || {}, nz = +sd.otvetchik_nezaversheno || 0;
      var t2 = nz > 0 ? nz + ' ' + plural(nz, 'незавершённое дело', 'незавершённых дела', 'незавершённых дел') + ' ответчиком' + (+sd.otvetchik_summa_nezaversheno ? ' на ' + money(+sd.otvetchik_summa_nezaversheno) : '') : 'Незавершённых дел ответчиком нет';
      if (dl.znach) dl.pod = 'Арбитраж: ' + t2.charAt(0).toLowerCase() + t2.slice(1); else { dl.znach = 'Арбитраж: ' + t2.charAt(0).toLowerCase() + t2.slice(1); dl.ton = 'ok'; }
      if (nz > 0 && dl.ton === 'ok') dl.ton = 'warn';
      dl.ist.push('картотека арбитражных дел'); dl.data = dl.data || dmyIso(su.data_svedeniy);
    } else ne.push('арбитражные суды');
    if (ne.length && dl.znach) { dl.pod = (dl.pod ? dl.pod + '. ' : '') + 'Не проверяли: ' + ne.join(', '); if (dl.ton === 'ok') dl.ton = 'warn'; }
    plitka('dolgi', 'Долги и суды', null, dl.znach ? { znach: dl.znach, pod: dl.pod, ton: dl.ton, ist: dl.ist.join(', '), data: dl.data, sam: ne.length ? (ne[0] === 'приставов' ? SAM.fssp : SAM.sudy) : '' } : { pod: 'Приставы и арбитражные суды — источник не ответил', sam: SAM.fssp });
    // 3. Сотрудники: среднесписочная численность (ФНС) + доход на сотрудника
    var dns = stroka(sec.finance, /^Доход на одного сотрудника/i);
    plitka('shtat', 'Сотрудники', F.employees || F.staff, { pod: dns ? 'Доход на сотрудника: ' + dns : '' });
    // 4. Достоверность записей ЕГРЮЛ
    var mass = (r.signals || []).filter(function (s) { return s && /^Массов/i.test(str(s.title)) && (s.status === 'bad' || s.status === 'warn'); });
    if (F.address && /^Нет$/.test(str(F.address.znach))) F.address.znach = 'Отметок о недостоверности нет';
    plitka('dostovernost', 'Достоверность ЕГРЮЛ', F.address, mass.length ? { pod: mass.map(function (s) { return str(s.title) + (s.detail ? ': ' + str(s.detail) : ''); }).join('; '), ton: 'warn' } : null);
    // 5. Статус
    plitka('status', 'Статус', F.status);
    // 6. Отчётность и выручка
    plitka('otchetnost', 'Отчётность', F.otchetnost, F.kapital ? { pod: F.kapital.znach, ton: 'warn' } : null);
    // 7. Руководитель (управляющая компания — отдельной строкой)
    var ruk = (sec.management || []).filter(function (x) { return x && str(x[1]) && !/^(Руководит с|Уставный капитал)/i.test(str(x[0])) && !/учредит|участник|акционер|собственник/i.test(str(x[0])); })[0];
    plitka('rukovoditel', 'Руководитель', F.rukovoditel, ruk && RE_YUR.test(str(ruk[1])) ? { pod: 'Управляет другое юрлицо — ' + kratko(ruk[1]) + '. Подробнее — в «Связях»' } : null);
    // 8. На рынке
    plitka('vozrast', 'На рынке', F.age);
    // 9. Счета: решения ФНС о приостановке операций
    var pr = b('priostanovki');
    plitka('scheta', 'Счета', null, ok(pr) ? (naiden(pr) ? { znach: 'Есть решения ФНС о приостановке операций', ton: 'bad', ist: pr.istochnik || 'ФНС', data: dmyIso(pr.data_svedeniy) }
      : { znach: 'Решений ФНС о приостановке нет', ton: 'ok', ist: 'ФНС', data: dmyIso(pr.data_svedeniy) }) : { pod: 'Решения ФНС о приостановке операций — проверьте по ИНН и БИК' });
    // 10. Опыт: госконтракты (справочно — отсутствие нормально для многих)
    var kt = b('kontrakty');
    if (ok(kt)) { var kd = kt.dannye || {}; plitka('opyt', 'Госконтракты', null, { znach: +kd.za_3_goda > 0 ? kd.za_3_goda + ' ' + plural(+kd.za_3_goda, 'контракт', 'контракта', 'контрактов') + ' за 3 года' + (+kd.summa_3_goda ? ' · ' + money(+kd.summa_3_goda) : '') : 'За 3 года не найдено — для многих компаний это нормально', ton: 'info', ist: 'ЕИС', data: dmyIso(kt.data_svedeniy) }); }
    var I = { ok: 0, warn: 0, bad: 0, off: 0, info: 0 };
    T.forEach(function (t) { I[t.ton] = (I[t.ton] || 0) + 1; });
    return { plitki: T, itogo: I, vsego: T.length };
  }

  // ---------- «Связи и группа компаний» (связи — факт ЕГРЮЛ, без квалификаций: tests/slovar_222.test.js) ----------
  // Из ЕГРЮЛ в ответе проверки: руководитель (или управляющая компания), учредители с долями, адрес, филиалы; признаки массовости.
  // Юрлица из связей — с кнопкой «Найти ИНН»: страница спрашивает подсказки API по названию (бесплатно, без траты проверок).
  // Взаимозависимость — только как признак по доле (ст. 105.1 НК РФ), без выводов: решение — у юриста.
  function dolyaIz(t) { var m = /—\s*([\d.,]+)\s*%/.exec(str(t)); return m ? parseFloat(m[1].replace(',', '.')) : null; }
  function bezDoli(t) { return str(t).replace(/\s*—\s*[\d.,]+\s*%\s*$/, ''); }
  // Короткое имя юрлица: «ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "РОМАШКА"» → ООО «Ромашка»-стиль без смены регистра
  var KR = [[/ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО/i, 'ПАО'], [/НЕПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО/i, 'АО'], [/ЗАКРЫТОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО/i, 'ЗАО'], [/ОТКРЫТОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО/i, 'ОАО'],
    [/АКЦИОНЕРНОЕ ОБЩЕСТВО/i, 'АО'], [/ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ/i, 'ООО'], [/УПРАВЛЯЮЩАЯ КОМПАНИЯ/i, 'УК'], [/АВТОНОМНАЯ НЕКОММЕРЧЕСКАЯ ОРГАНИЗАЦИЯ/i, 'АНО']];
  function kratko(t) {
    var x = str(t); KR.forEach(function (p) { x = x.replace(p[0], p[1]); });
    return x.replace(/"([^"]+)"/g, '«$1»').replace(/\s{2,}/g, ' ');
  }
  // Запрос для подсказок API: название в кавычках (ядро) или короткое имя
  function zaprosImeni(t) { var m = /"([^"]{3,})"/.exec(str(t)) || /«([^»]{3,})»/.exec(str(t)); return m ? m[1] : kratko(t); }
  function svyazi(r) {
    r = r || {};
    var c = r.company || {}, sec = sekcii(r), uzly = [], flagi = [];
    if (c.kind && c.kind !== 'LEGAL') return null;
    var rows = sec.management || [];
    var ruk = rows.filter(function (x) { return x && str(x[1]) && !/^(Руководит с|Уставный капитал)/i.test(str(x[0])) && !/учредит|участник|акционер|собственник/i.test(str(x[0])); })[0];
    var s1 = stroka(rows, /^Руководит с/i), kap = stroka(rows, /^Уставный капитал/i);
    var massRuk = (r.signals || []).filter(function (s) { return s && /^Массовый руководитель/i.test(str(s.title)) && (s.status === 'bad' || s.status === 'warn'); })[0];
    var massUchr = (r.signals || []).filter(function (s) { return s && /^Массов\S* учредит/i.test(str(s.title)) && (s.status === 'bad' || s.status === 'warn'); })[0];
    var massAdr = (r.signals || []).filter(function (s) { return s && /^Массовый адрес/i.test(str(s.title)) && (s.status === 'bad' || s.status === 'warn'); })[0];
    var rukImya = ruk ? str(ruk[1]) : str(c.director_name);
    if (rukImya) {
      var yur = RE_YUR.test(rukImya);
      uzly.push({ k: 'rukovoditel', rol: yur ? 'Управляющая компания' : str(ruk && ruk[0]) || str(c.director_post) || 'Руководитель', imya: yur ? kratko(rukImya) : rukImya, polnoe: rukImya, yur: yur,
        pod: (s1 ? 'с ' + s1 : '') + (massRuk ? (s1 ? ' · ' : '') + str(massRuk.title) + (massRuk.detail ? ': ' + str(massRuk.detail) : '') : ''), ton: massRuk ? 'warn' : 'neutral' });
      if (yur) flagi.push({ t: 'Компанией управляет другое юрлицо — управляющая компания', pod: 'У неё полномочия единоличного исполнительного органа: она подписывает договоры и распоряжается деньгами. Проверьте и её.', ton: 'info' });
    }
    var uchr = rows.filter(function (x) { return x && /учредит|участник|акционер|собственник/i.test(str(x[0])) && str(x[1]); });
    uchr.slice(0, 8).forEach(function (x) {
      var d = dolyaIz(x[1]), imya = bezDoli(x[1]), yur = RE_YUR.test(imya);
      uzly.push({ k: 'uchreditel', rol: yur ? 'Учредитель — юрлицо' : 'Учредитель', imya: yur ? kratko(imya) : imya, polnoe: imya, dolya: d, yur: yur, pod: d != null ? 'доля ' + String(d).replace('.', ',') + NB + '%' : '', ton: 'neutral' });
    });
    var bolshe25 = uzly.filter(function (u) { return u.k === 'uchreditel' && u.dolya != null && u.dolya > 25; });
    if (bolshe25.length) flagi.push({ t: bolshe25.length === 1 ? 'Один учредитель с долей больше 25 %' : bolshe25.length + ' учредителя с долей больше 25 %', pod: bolshe25.map(function (u) { return u.imya + ' — ' + String(u.dolya).replace('.', ',') + NB + '%'; }).join('; ') + '. Доля больше 25 % — признак взаимозависимости (ст. 105.1 НК РФ).', ton: 'info' });
    var yurU = uzly.filter(function (u) { return u.k === 'uchreditel' && u.yur; });
    if (yurU.length) flagi.push({ t: 'Среди учредителей — ' + (yurU.length === 1 ? 'юрлицо' : yurU.length + ' юрлица'), pod: 'Компания — часть группы. Найдите ИНН учредителя и проверьте его так же, как контрагента.', ton: 'info' });
    // руководитель — он же учредитель (совпадение ФИО в ЕГРЮЛ)
    var sovp = rukImya && !RE_YUR.test(rukImya) ? uzly.filter(function (u) { return u.k === 'uchreditel' && u.imya.toUpperCase() === rukImya.toUpperCase(); })[0] : null;
    if (sovp) flagi.push({ t: 'Руководитель — и учредитель', pod: sovp.dolya != null ? 'Доля руководителя — ' + String(sovp.dolya).replace('.', ',') + NB + '%.' : '', ton: 'info' });
    if (uchr.length === 1 && dolyaIz(uchr[0][1]) === 100) flagi.push({ t: 'Единственный учредитель', pod: bezDoli(uchr[0][1]) + ' — 100 %', ton: 'info' });
    if (massUchr) flagi.push({ t: str(massUchr.title), pod: str(massUchr.detail), ton: 'warn' });
    if (massAdr) flagi.push({ t: str(massAdr.title), pod: str(massAdr.detail), ton: 'warn' });
    var adr = stroka(sec.profile, /^Юридический адрес/i) || str(c.address), fil = stroka(sec.profile, /^Филиалы/i);
    if (adr) uzly.push({ k: 'adres', rol: 'Юридический адрес', imya: adr, pod: massAdr ? str(massAdr.title) : '', ton: massAdr ? 'warn' : 'neutral', adres: true });
    if (fil && !/^(нет|0)$/i.test(fil)) uzly.push({ k: 'filialy', rol: 'Филиалы и представительства', imya: fil, pod: '', ton: 'neutral' });
    if (kap) uzly.push({ k: 'kapital', rol: 'Уставный капитал', imya: kap, pod: '', ton: 'neutral' });
    if (!uzly.length) return null;
    var dt = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(c.fetched_at || r.checked_at));
    return { uzly: uzly, flagi: flagi, adres: adr, ist: 'ЕГРЮЛ' + (dt ? ' на ' + dt[3] + '.' + dt[2] + '.' + dt[1] : ''),
      ne: 'Другие компании руководителя и учредителей по всей базе ЕГРЮЛ покажем, когда загрузим её целиком: неполную картину за полную не выдаём. Сейчас — проверьте сами в сервисе ФНС «Прозрачный бизнес».' };
  }
  // Совпадение адресов (без квартиры, офиса, помещения): найденный по названию учредитель или УК по тому же адресу — общий адрес
  function adresKlyuch(a) {
    return str(a).toUpperCase().replace(/Ё/g, 'Е').replace(/\b\d{6}\b,?/g, '').replace(/,?\s*(ПОМЕЩ|ПОМ|ОФ|ОФИС|КВ|КОМН|КАБ|ЭТАЖ)\.?\s*[\w\/-]+.*$/i, '')
      .replace(/(ОБЛ|Г|УЛ|Д|ПР-КТ|ПР|ПЕР|Ш|НАБ|ПЛ|Б-Р)\.?\s/g, '').replace(/[^А-ЯA-Z0-9\/]+/g, ' ').trim();
  }
  function obshchijAdres(a, b) { var x = adresKlyuch(a), y = adresKlyuch(b); if (!x || !y) return false; var tx = x.split(' ').slice(-3).join(' '), ty = y.split(' ').slice(-3).join(' '); return tx.length > 4 && tx === ty; }

  // Найденные по названию юрлица связей: общий адрес между ними или с контрагентом — факт из сведений ФНС (адрес в подсказке API)
  function svyaziDop(S, rez) {
    if (!S || !rez) return [];
    var out = [], gr = {};
    Object.keys(rez).forEach(function (i) { var n = rez[i], u = S.uzly[+i]; if (!n || !n.inn || !u) return; if (n.obshchij) out.push({ t: u.imya + ' — по тому же адресу, что и контрагент', pod: 'Общий адрес — признак связанности компаний. Узнайте, кто фактически занимает помещение.', ton: 'warn' });
      var k = adresKlyuch(n.adres || ''); k = k.split(' ').slice(-3).join(' '); if (k.length > 4) (gr[k] = gr[k] || []).push(u.imya); });
    Object.keys(gr).forEach(function (k) { if (gr[k].length > 1) out.push({ t: gr[k].join(' и ') + ' — по одному адресу', pod: 'Общий адрес регистрации — признак группы компаний. Адреса — по сведениям ЕГРЮЛ в поиске по названию.', ton: 'info' }); });
    return out;
  }
  // Подпись узла на 3D-орбите: человек — «Фамилия И. О.», адрес — улица и дом, юрлицо — короткое имя
  function kratkoGraf(u) {
    var t = str(u.imya);
    if (u.adres) { var ch = t.split(',').map(str).filter(function (x) { return x && !/^\d{6}$/.test(x) && !/^(помещ|пом|оф|кв|комн)/i.test(x); }); return ch.slice(-2).join(', '); }
    if (!u.yur && /^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ][а-яё-]+(\s+[А-ЯЁ][а-яё-]+)?$/.test(t)) { var p = t.split(/\s+/); return p[0] + ' ' + p.slice(1).map(function (x) { return x.charAt(0) + '.'; }).join(' '); }
    if (u.yur) { var m = /«([^»]+)»/.exec(t); if (m) return '«' + m[1] + '»'; }
    return t.length > 40 ? t.slice(0, 38) + '…' : t;
  }
  // ---------- «Деньги компании» (dosje-sdelki-v3, задача владельца 22.10: «графики наложенные друг на друга — доход, расход, прибыль, НДС, УСН») ----------
  // Один график, где ряды наложены: выручка (площадь, ГИР БО), расходы = выручка − чистая прибыль (линия, ◆ расчёт Делоскопа),
  // столбик между ними — прибыль или убыток года, налоги и взносы (ФНС, открытые данные) — тонкий столбик в своём году.
  // Ниже: структура последнего года (выручка → расходы и прибыль, доля налогов), налоги по видам (НДС, УСН, прибыль, взносы…),
  // нагрузка против отрасли (js/nagruzka-proverka.js — тот же расчёт, что в отчёте). Чисел от себя не добавляем.
  var NALOG_VIDY = [
    ['nds', 'НДС', /добавленную стоимость/i], ['pribyl', 'Налог на прибыль', /прибыль организаций|налог на прибыль/i],
    ['usn', 'УСН', /упрощ[её]нн/i], ['envd', 'ЕНВД', /вмен[её]нн/i], ['eshn', 'ЕСХН', /сельскохозяйственн/i], ['patent', 'Патент', /патент/i],
    ['vznosy', 'Страховые взносы', /страхов|пенсионн|медицинск|социальн|травматизм/i], ['ndfl', 'НДФЛ', /доходы физических лиц/i],
    ['imushchestvo', 'Налог на имущество', /имущество организаций/i], ['transport', 'Транспортный налог', /транспортн/i],
    ['zemlya', 'Земельный налог', /земельн/i], ['peni', 'Пени и штрафы', /(^|\s)пен(и|ей|я)(\s|$)|штраф/i], ['poshlina', 'Госпошлина', /пошлин/i]];
  var NALOG_CVET = { nds: '#0B63E5', pribyl: '#16723F', usn: '#7A4FD6', envd: '#7A4FD6', eshn: '#7A4FD6', patent: '#7A4FD6', vznosy: '#2FA3B5', ndfl: '#C27A00', imushchestvo: '#8A6D3B', transport: '#8A6D3B', zemlya: '#8A6D3B', peni: '#B3261E', poshlina: '#8E8E93', drugoe: '#B5B5AE' };
  function rubIz(t) { // «39,1 млн ₽» → 39100000; «4 125 161 ₽» → 4125161
    var m = /(-|−|\+)?\s*([\d\s ]+(?:[.,]\d+)?)\s*(трлн|млрд|млн|тыс)?/i.exec(str(t)); if (!m) return null;
    var v = parseFloat(m[2].replace(/[\s ]/g, '').replace(',', '.')); if (!isFinite(v)) return null;
    var k = { 'трлн': 1e12, 'млрд': 1e9, 'млн': 1e6, 'тыс': 1e3 }[String(m[3] || '').toLowerCase()] || 1;
    return (m[1] === '-' || m[1] === '−' ? -1 : 1) * v * k;
  }
  function krupno(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), z = v < 0 ? '−' : '';
    function f(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
    if (a >= 1e9) return z + f(a / 1e9) + NB + 'млрд' + NB + '₽';
    if (a >= 1e6) return z + f(a / 1e6) + NB + 'млн' + NB + '₽';
    if (a >= 1e3) return z + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
    return z + Math.round(a) + NB + '₽';
  }
  function os(v) { var a = Math.abs(v); return a >= 1e9 ? (Math.round(v / 1e8) / 10).toString().replace('.', ',') + ' млрд' : a >= 1e6 ? (Math.round(v / 1e5) / 10).toString().replace('.', ',') + ' млн' : a >= 1e3 ? Math.round(v / 1e3) + ' тыс.' : String(Math.round(v)); }
  function dengi(r) {
    r = r || {};
    var c = r.company || {}, D = r.dossier || {}, ch = D.charts || {}, sec = sekcii(r);
    if (c.kind === 'INDIVIDUAL' || String(c.inn || '').length === 12) return null;    // данные ИП не показываем
    function ryad(a) { var o = {}; (Array.isArray(a) ? a : []).forEach(function (x) { var g = parseInt(x && x.year, 10), v = Number(x && x.value); if (isFinite(g) && isFinite(v)) o[g] = v; }); return o; }
    var V = ryad(ch.revenue), P = ryad(ch.profit), N = ryad(ch.taxes_paid);
    var gody = Object.keys(V).concat(Object.keys(P)).map(Number).filter(function (g, i, a) { return a.indexOf(g) === i; }).sort().slice(-6);
    var data = /доходы и расходы — на (\d{2})\.(\d{2})\.(\d{4})/.exec(str(D.data_dates)), dataN = /уплаченные налоги — на (\d{2})\.(\d{2})\.(\d{4})/.exec(str(D.data_dates));
    var godF = data ? +data[3] : null, godN = dataN ? +dataN[3] : godF;
    var fd = rubIz(stroka(sec.finance, /^Доходы за год/i)), fr = rubIz(stroka(sec.finance, /^Расходы за год/i)), upl = rubIz(stroka(sec.finance, /^Уплачено налогов/i));
    if (godN && upl != null && N[godN] == null) N[godN] = upl;
    // налоги по видам за последний год набора ФНС
    var vidy = {}, vsego = 0;
    (Array.isArray(ch.taxes) ? ch.taxes : []).forEach(function (x) {
      var v = Number(x && x.value); if (!isFinite(v) || v <= 0) return;
      var n = str(x.name), m = NALOG_VIDY.filter(function (q) { return q[2].test(n); })[0], k = m ? m[0] : 'drugoe';
      if (!vidy[k]) vidy[k] = { k: k, nazv: m ? m[1] : 'Другие платежи', summa: 0, cvet: NALOG_CVET[k] };
      vidy[k].summa += v; vsego += v;
    });
    if (godN && vsego > 0) N[godN] = vsego;                // точнее, чем «4,1 млн ₽» из строки раздела
    var stroki = gody.map(function (g) {
      var v = V[g] != null ? V[g] : null, p = P[g] != null ? P[g] : null;
      return { god: g, vyruchka: v, pribyl: p, rashody: v != null && p != null ? v - p : null, nalogi: N[g] != null ? N[g] : null,
        fnsDohody: g === godF ? fd : null, fnsRashody: g === godF ? fr : null };
    });
    var nalogiVidy = Object.keys(vidy).map(function (k) { return vidy[k]; }).sort(function (a, b) { return b.summa - a.summa; });
    var dyn = sec.dynamics || [];
    var K = [];
    function kp(nazv, t, pod) { if (str(t)) K.push({ nazv: nazv, znach: str(t), pod: pod || '' }); }
    kp('Рост выручки в год', stroka(dyn, /^Средний рост выручки/i), 'в среднем, ГИР БО');
    kp('Рентабельность', stroka(sec.finance, /^Рентабельность/i), 'прибыль ÷ доходы, ФНС');
    kp('Доля заёмных средств', stroka(dyn, /^Доля заёмных/i), 'в пассивах, ГИР БО');
    kp('Деньги на счетах', stroka(dyn, /^Деньги на счетах/i), 'на конец года, ГИР БО');
    kp('Должна поставщикам', stroka(dyn, /кредиторская задолженность/i), 'кредиторка, ГИР БО');
    kp('Кредиты и займы', stroka(dyn, /^Кредиты и займы/i), 'ГИР БО');
    var NP = modul('NagruzkaProverka', './nagruzka-proverka.js'), rezh = null;
    try { rezh = NP && NP.rezhim ? NP.rezhim(r) : null; } catch (e) { rezh = null; }
    if (!stroki.length && !nalogiVidy.length) return null;
    return { stroki: stroki, nalogiVidy: nalogiVidy, nalogiVsego: vsego, godN: godN, godF: godF, kpi: K, rezhim: rezh,
      ist: { vyruchka: 'ГИР БО ФНС, бухотчётность', nalogi: 'ФНС, открытые данные' + (godN ? ' за ' + godN : ''), fns: 'ФНС, открытые данные' + (godF ? ' за ' + godF : '') } };
  }
  // SVG графика (ширина — по экрану): верхняя панель — выручка и расходы наложены, заливка между ними — прибыль (зелёная) или убыток (красный);
  // нижняя панель — столбики года: чистая прибыль и уплаченные налоги и взносы, своя шкала от нуля. vis — какие ряды показаны.
  function shkala(lo, hi, n) { var d = (hi - lo) / n || 1, p = Math.pow(10, Math.floor(Math.log10(d))), k = [1, 2, 2.5, 5, 10].filter(function (q) { return q * p >= d; })[0] * p; return { lo: Math.floor(lo / k) * k, hi: Math.ceil(hi / k) * k, shag: k }; }
  function dengiSvg(M, vis, shirina) {
    vis = vis || { vyruchka: 1, rashody: 1, pribyl: 1, nalogi: 1 };
    var S = M.stroki, n = S.length; if (!n) return '';
    var uz = shirina && shirina < 560, W0 = shirina ? Math.max(300, Math.round(shirina)) : 720, H0 = uz ? 300 : 360, L = uz ? 48 : 64, R = uz ? 8 : 18, T = 14, B = 30, G = 40;
    var w = W0 - L - R, hAll = H0 - T - B - G, h1 = Math.round(hAll * 0.62), h2 = hAll - h1, T2 = T + h1 + G;
    var vals = []; S.forEach(function (s) { if (s.vyruchka != null) vals.push(s.vyruchka); if (s.rashody != null) vals.push(s.rashody); });
    var mx = vals.length ? Math.max.apply(null, vals) : 1, mn = vals.length ? Math.min.apply(null, vals) : 0;
    var lo0 = mn - (mx - mn) * 0.25; if (lo0 < mx * 0.3 || lo0 < 0) lo0 = Math.min(0, mn);
    var sk = shkala(lo0, mx + (mx - mn) * 0.08 || mx * 1.1, 3);
    function x(i) { return L + w * (i + 0.5) / n; }
    function y(v) { return T + h1 - (v - sk.lo) / (sk.hi - sk.lo) * h1; }
    var b2 = 0; S.forEach(function (s) { if (s.pribyl != null) b2 = Math.max(b2, Math.abs(s.pribyl)); if (s.nalogi != null) b2 = Math.max(b2, s.nalogi); }); if (!b2) b2 = 1;
    var est_minus = S.some(function (s) { return s.pribyl != null && s.pribyl < 0; });
    var z2 = est_minus ? T2 + h2 * 0.62 : T2 + h2, kv = (est_minus ? h2 * 0.62 : h2) / b2;
    var o = '<svg class="sdf-svg" viewBox="0 0 ' + W0 + ' ' + H0 + '" width="' + W0 + '" height="' + H0 + '" role="img" aria-label="График: выручка и расходы по годам, заливка между ними — прибыль или убыток; ниже — прибыль и налоги">' +
      '<defs><linearGradient id="sdfV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B63E5" stop-opacity=".16"/><stop offset="1" stop-color="#0B63E5" stop-opacity="0"/></linearGradient>' +
      '<filter id="sdfTen" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0B63E5" flood-opacity=".28"/></filter></defs>';
    for (var t = sk.lo; t <= sk.hi + 1e-9; t += sk.shag) o += '<line class="sdf-set" x1="' + L + '" x2="' + (W0 - R) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/><text class="sdf-ox" x="' + (L - 8) + '" y="' + (y(t) + 4).toFixed(1) + '" text-anchor="end">' + esc(os(t)) + '</text>';
    o += '<text class="sdf-pod" x="' + (W0 - R) + '" y="' + (T2 - 18) + '" text-anchor="end">Прибыль и налоги года</text><line class="sdf-nol" x1="' + L + '" x2="' + (W0 - R) + '" y1="' + z2.toFixed(1) + '" y2="' + z2.toFixed(1) + '"/>' +
      '<text class="sdf-ox" x="' + (L - 8) + '" y="' + (z2 + 4).toFixed(1) + '" text-anchor="end">0</text><text class="sdf-ox" x="' + (L - 8) + '" y="' + (z2 - b2 * kv + 4).toFixed(1) + '" text-anchor="end">' + esc(os(b2)) + '</text>';
    S.forEach(function (s, i) { o += '<text class="sdf-ox sdf-ox--g" x="' + x(i).toFixed(1) + '" y="' + (H0 - 10) + '" text-anchor="middle">' + s.god + '</text>'; });
    var V = S.map(function (s, i) { return s.vyruchka != null ? [x(i), y(s.vyruchka), s] : null; }), Rr = S.map(function (s, i) { return s.rashody != null ? [x(i), y(s.rashody), s] : null; });
    o += '<g class="sdf-ris">';
    // заливка между линиями по отрезкам; в точке пересечения — делим отрезок
    if (vis.pribyl) for (var i = 0; i < n - 1; i++) {
      var a1 = V[i], a2 = V[i + 1], b1 = Rr[i], c2 = Rr[i + 1]; if (!a1 || !a2 || !b1 || !c2) continue;
      var d1 = a1[1] - b1[1], d2 = a2[1] - c2[1];  // < 0 — выручка выше расходов (прибыль)
      if (d1 * d2 >= 0) o += '<polygon class="sdf-zl ' + (d1 + d2 <= 0 ? 'plus' : 'minus') + '" points="' + [a1, a2, c2, b1].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
      else { var tt = d1 / (d1 - d2), xm = a1[0] + (a2[0] - a1[0]) * tt, ym = a1[1] + (a2[1] - a1[1]) * tt;
        o += '<polygon class="sdf-zl ' + (d1 < 0 ? 'plus' : 'minus') + '" points="' + [a1, [xm, ym], b1].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>' +
          '<polygon class="sdf-zl ' + (d2 < 0 ? 'plus' : 'minus') + '" points="' + [[xm, ym], a2, c2].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>'; }
    }
    var pv = V.filter(Boolean), pr = Rr.filter(Boolean);
    function put(a) { return 'M' + a.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L'); }
    if (vis.vyruchka && pv.length) o += '<path class="sdf-area" d="' + put(pv) + ' L' + pv[pv.length - 1][0].toFixed(1) + ',' + (T + h1) + ' L' + pv[0][0].toFixed(1) + ',' + (T + h1) + ' Z" fill="url(#sdfV)"/>';
    if (vis.rashody && pr.length > 1) o += '<path class="sdf-l sdf-l--r" d="' + put(pr) + '"/>';
    if (vis.vyruchka && pv.length > 1) o += '<path class="sdf-l sdf-l--v" d="' + put(pv) + '" filter="url(#sdfTen)"/>';
    o += '</g>';
    S.forEach(function (s, i) {
      var bw = uz ? 9 : 14, gap = 3;
      if (vis.pribyl && s.pribyl != null) { var hp = Math.max(1.5, Math.abs(s.pribyl) * kv); o += '<rect class="sdf-p ' + (s.pribyl >= 0 ? 'plus' : 'minus') + '" x="' + (x(i) - bw - gap / 2).toFixed(1) + '" y="' + (s.pribyl >= 0 ? z2 - hp : z2).toFixed(1) + '" width="' + bw + '" height="' + hp.toFixed(1) + '" rx="2" style="--i:' + i + '"/>'; }
      if (vis.nalogi && s.nalogi != null) { var hn = Math.max(1.5, s.nalogi * kv); o += '<rect class="sdf-n" x="' + (x(i) + gap / 2).toFixed(1) + '" y="' + (z2 - hn).toFixed(1) + '" width="' + bw + '" height="' + hn.toFixed(1) + '" rx="2" style="--i:' + i + '"/>'; }
      if (vis.rashody && s.rashody != null) o += '<circle class="sdf-t sdf-t--r" cx="' + x(i).toFixed(1) + '" cy="' + y(s.rashody).toFixed(1) + '" r="3.5"/>';
      if (vis.vyruchka && s.vyruchka != null) o += '<circle class="sdf-t sdf-t--v" cx="' + x(i).toFixed(1) + '" cy="' + y(s.vyruchka).toFixed(1) + '" r="4.5"/>';
      o += '<rect class="sdf-hit" data-sdf-god="' + i + '" x="' + (x(i) - w / n / 2).toFixed(1) + '" y="' + T + '" width="' + (w / n).toFixed(1) + '" height="' + (H0 - T - B + 4) + '"/>';
    });
    return o + '</svg>';
  }
  function dengiGod(M, i) { // карточка года под графиком
    var s = M.stroki[i]; if (!s) return '';
    function str2(nazv, v, cls, ist) { return v == null ? '' : '<li class="' + cls + '"><i aria-hidden="true"></i><span>' + esc(nazv) + '</span><b>' + esc(krupno(v)) + '</b>' + (ist ? '<small>' + esc(ist) + '</small>' : '') + '</li>'; }
    return '<div class="sdf-god"><b class="sdf-god__g">' + s.god + '</b><ul>' +
      str2('Выручка', s.vyruchka, 'v', 'ГИР БО') + str2('Расходы', s.rashody, 'r', 'выручка − чистая прибыль, расчёт') +
      str2(s.pribyl != null && s.pribyl < 0 ? 'Убыток' : 'Чистая прибыль', s.pribyl, s.pribyl != null && s.pribyl < 0 ? 'm' : 'p', 'ГИР БО') +
      str2('Налоги и взносы', s.nalogi, 'n', 'ФНС, уплачено') +
      (s.fnsDohody != null ? str2('Доходы по данным ФНС', s.fnsDohody, 'f', 'все доходы, не только выручка') : '') + (s.fnsRashody != null ? str2('Расходы по данным ФНС', s.fnsRashody, 'f', '') : '') +
      '</ul></div>';
  }
  // ---------- «Против отрасли» (dosje-sdelki-v4): нагрузка и рентабельность активов против средних ФНС по ОКВЭД ----------
  // NG = { nagruzka: NagruzkaProverka.raschet, rentab: Rentabelnost.raschet + tekst, vsego: {god, n, sv} — строка «ВСЕГО» ФНС, okved, okvedNazv }.
  // Шкала: компания — точка, средняя по отрасли — черта, зона «ниже средней» (для рентабельности — на 10 % и более, критерий 11) — штриховкой.
  function pcx(v) { return (Math.round(v * 10) / 10).toString().replace('.', ',') + NB + '%'; }
  function shkalaHtml(k, o, zona, podK, podO, ref) {
    var mx = Math.max(k || 0, o || 0, ref ? ref.v : 0, 1) * 1.3, l = function (v) { return Math.max(0, Math.min(100, v / mx * 100)).toFixed(1); };
    return '<div class="sdo-sk" role="img" aria-label="' + esc((k != null ? podK + ' ' + pcx(k) : '') + (o != null ? ', ' + podO + ' ' + pcx(o) : '')) + '">' +
      (zona != null ? '<i class="sdo-sk__z" style="width:' + l(zona) + '%"></i>' : '') + (k != null ? '<i class="sdo-sk__f" style="width:' + l(k) + '%"></i>' : '') +
      (o != null ? '<span class="sdo-sk__o" style="left:' + l(o) + '%"><b>' + pcx(o) + '</b><small>' + esc(podO) + '</small></span>' : '') +
      (ref ? '<span class="sdo-sk__o ref" style="left:' + l(ref.v) + '%"><b>' + pcx(ref.v) + '</b><small>' + esc(ref.t) + '</small></span>' : '') +
      (k != null ? '<span class="sdo-sk__k" style="left:' + l(k) + '%"><b>' + pcx(k) + '</b><small>' + esc(podK) + '</small></span>' : '') + '</div>';
  }
  var OTR_ST = { 'ne-nizhe': ['ok', 'Не ниже средней по отрасли'], 'ne-nizhe-10': ['ok', 'Не ниже средней по отрасли'], 'nizhe': ['warn', 'Ниже средней по отрасли'], 'nizhe-vdvoe': ['warn', 'Ниже средней более чем вдвое'],
    'chut-nizhe': ['info', 'Чуть ниже средней — меньше чем на 10 %'], 'usn': ['info', 'Упрощёнка — с общей нормой не сравниваем'], 'spec': ['info', 'Спецрежим — с общей нормой не сравниваем'],
    'net-normy': ['info', 'ФНС не публикует норму для этой отрасли'], 'otr': ['info', 'Отрасль в целом убыточна'], 'neyasno': ['info', 'Точно сравнить нельзя'] };
  function otraslHtml(NG) {
    if (!NG || (!NG.nagruzka && !NG.rentab && !NG.nagruzkaOtr)) return '';
    var h = '<div class="sdo"><div class="sdf-str__h"><b>Против отрасли</b><span>средние показатели ФНС для самостоятельной оценки рисков (приказ № ММ-3-06/333@)</span></div>' +
      (NG.okved ? '<p class="sdo-okved">Основной ОКВЭД <b>' + esc(NG.okved) + '</b>' + (NG.okvedNazv ? ' — ' + esc(NG.okvedNazv) : '') + '</p>' : '') + '<div class="sdo-g2">';
    var A = NG.nagruzka;
    if (A && A.n != null) {
      var st = OTR_ST[A.st] || ['info', ''], sr = A.norma != null;
      h += '<div class="sdo-g ' + st[0] + '"><div class="sdo-g__h"><b>' + (A.sVznosami ? 'Налоги и взносы' : 'Налоговая нагрузка') + ' к ' + (A.vid === 'dohody' ? 'доходам' : 'выручке') + ' · ' + A.god + '</b><span class="sdo-chip ' + st[0] + '">' + esc(st[1]) + '</span></div>' +
        shkalaHtml(A.n, sr ? A.norma : null, sr ? A.norma : null, 'компания', 'отрасль', !sr && NG.vsego ? { v: A.sVznosami ? NG.vsego.n + NG.vsego.sv : NG.vsego.n, t: 'Россия, справочно' } : null) +
        (sr ? '<p class="sdo-s">Сравниваем с: ' + esc(A.stroka ? (A.stroka.kod && /^[A-Z]$/.test(A.stroka.kod) ? 'раздел ' + A.stroka.kod + ' «' + A.stroka.nazvanie.replace(/\s*-\s*всего$/i, '') + '»' : 'ОКВЭД ' + A.stroka.kod + ' «' + A.stroka.nazvanie + '»') : '') + (A.sVznosami ? '; норма = налоги ' + pcx(A.normaN) + ' + взносы ' + pcx(A.normaSv) : '') + '.</p>'
          : ('<p class="sdo-s">По этой отрасли ФНС среднюю нагрузку не публикует' + (NG.vsego ? '. Серая черта — среднее по всем отраслям России за ' + NG.vsego.god + ' (налоги ' + pcx(NG.vsego.n) + ' + взносы ' + pcx(NG.vsego.sv) + '): только для масштаба, не норма для этой компании' : '') + '.</p>')) +
        (A.st === 'nizhe' || A.st === 'nizhe-vdvoe' || A.st === 'usn' || A.st === 'spec' ? '<p class="sdo-s">' + esc(A.tekst || '') + '</p>' : '') + '</div>';
    }
    var O = !A && NG.nagruzkaOtr;
    if (O) {
      h += '<div class="sdo-g info"><div class="sdo-g__h"><b>Налоговая нагрузка отрасли · ' + O.god + '</b><span class="sdo-chip info">Уплаченных налогов компании в открытых данных ФНС нет</span></div>' +
        shkalaHtml(null, O.n + O.sv, null, '', 'отрасль: налоги + взносы') +
        '<p class="sdo-s">Средняя по ' + (/^[A-Z]$/.test(O.stroka.kod) ? 'разделу ' + esc(O.stroka.kod) : 'ОКВЭД ' + esc(O.stroka.kod)) + ' «' + esc(O.stroka.nazvanie.replace(/\s*-\s*всего$/i, '')) + '»: налоги ' + pcx(O.n) + ' + взносы ' + pcx(O.sv) + ' от оборота. ' +
        'Сравнить с компанией нельзя: ФНС не раскрыла её уплаченные налоги за год. Запросите у контрагента справку о расчётах с бюджетом или декларации.</p></div>';
    }
    var B = NG.rentab;
    if (B && B.n != null) {
      var st2 = OTR_ST[B.st] || ['info', ''], sr2 = typeof B.norma === 'number';
      h += '<div class="sdo-g ' + st2[0] + '"><div class="sdo-g__h"><b>Рентабельность активов · ' + B.god + '</b><span class="sdo-chip ' + st2[0] + '">' + esc(st2[1]) + '</span></div>' +
        shkalaHtml(B.n, sr2 ? B.norma : null, sr2 ? B.norma * 0.9 : null, 'компания', 'отрасль') +
        (sr2 && B.stroka ? '<p class="sdo-s">Сравниваем с: ' + (/^[A-Z]$/.test(B.stroka.kod) ? 'раздел ' + esc(B.stroka.kod) : 'ОКВЭД ' + esc(B.stroka.kod)) + ' «' + esc(B.stroka.nazvanie) + '». Штриховка — «ниже средней на 10 % и более»: этот признак ФНС учитывает при отборе на выездную проверку.</p>' : '') +
        (B.st === 'nizhe' || B.st === 'neyasno' || B.st === 'otr' ? '<p class="sdo-s">' + esc(B.tekst || '') + '</p>' : '') + '<p class="sdo-s">Прибыль ' + (B.sNalogom ? 'до налогообложения' : '(чистая)') + ' ' + esc(krupno(B.rez)) + ' ÷ активы ' + esc(krupno(B.aktivy)) + ' на 31.12.' + B.god + ' — оценка по ГИР БО.</p></div>';
    }
    return h + '</div><p class="sd-s">Средние ФНС — ориентир, а не порог: само по себе отклонение не нарушение. Нормы по всем отраслям — <a href="/nalogi/nagruzka-po-otraslyam-2025/">справочник</a>.</p></div>';
  }
  function dengiKoroche(M) { // одна строка «Коротко» — только числа из ответа
    var S = M.stroki, p = S[S.length - 1], q = S[S.length - 2];
    if (!p || p.vyruchka == null) return '';
    var t = 'Выручка за ' + p.god + ' — ' + krupno(p.vyruchka);
    if (q && q.vyruchka > 0) { var d = Math.round((p.vyruchka / q.vyruchka - 1) * 100); t += ' (' + (d >= 0 ? '+' : '−') + Math.abs(d) + NB + '% к ' + q.god + ')'; }
    if (p.pribyl != null) t += ', ' + (p.pribyl < 0 ? 'убыток ' + krupno(-p.pribyl) : 'прибыль ' + krupno(p.pribyl));
    if (p.nalogi != null && p.vyruchka > 0) t += '; налоги и взносы — ' + pcx(p.nalogi / p.vyruchka * 100) + ' выручки';
    var ub = S.filter(function (x) { return x.pribyl != null && x.pribyl < 0; }).map(function (x) { return x.god; });
    if (ub.length) t += '. Убыточн' + (ub.length > 1 ? 'ые годы: ' : 'ый год: ') + ub.join(', ');
    return t + '.';
  }
  function dengiHtml(M, NG) {
    if (!M) return '';
    var S = M.stroki, posl = S.length ? S[S.length - 1] : null, h = '';
    h += '<section class="sdf" aria-labelledby="sdf-h"><div class="sd-sec-h"><h3 id="sdf-h">Деньги компании</h3>' + (dengiKoroche(M) ? '<p class="sd-koroche"><b>Коротко.</b> ' + nb(dengiKoroche(M)) + '</p>' : '') + '<p>Выручка и расходы — линии на одном графике, заливка между ними — прибыль (зелёная) или убыток (красный). Внизу — прибыль и уплаченные налоги каждого года. Нажмите на год — покажем все суммы.</p></div>';
    if (S.length) {
      h += '<div class="sdf-leg" role="group" aria-label="Что показать на графике">' +
        [['vyruchka', 'Выручка'], ['rashody', 'Расходы'], ['pribyl', 'Прибыль / убыток'], ['nalogi', 'Налоги и взносы']].map(function (q) {
          return '<button type="button" class="sdf-chip sdf-chip--' + q[0] + '" data-sdf-ryad="' + q[0] + '" aria-pressed="true"><i aria-hidden="true"></i>' + q[1] + '</button>'; }).join('') + '</div>' +
        '<div class="sdf-kanva" data-sdf>' + dengiSvg(M) + '</div>' +
        '<div class="sdf-gody" role="tablist" aria-label="Годы">' + S.map(function (s, i) { return '<button type="button" role="tab" data-sdf-god="' + i + '" aria-selected="' + (i === S.length - 1) + '">' + s.god + '</button>'; }).join('') + '</div>' +
        '<div data-sdf-karta aria-live="polite">' + dengiGod(M, S.length - 1) + '</div>';
    }
    // структура последнего года: выручка = расходы + прибыль; налоги — доля выручки (наложены поверх)
    if (posl && posl.vyruchka > 0 && posl.rashody != null) {
      var pr = Math.max(0, Math.min(100, posl.rashody / posl.vyruchka * 100)), pp = Math.max(0, 100 - pr), pn = posl.nalogi != null ? Math.min(100, posl.nalogi / posl.vyruchka * 100) : null;
      function p1(v) { return (Math.round(v * 10) / 10).toString().replace('.', ',') + NB + '%'; }
      h += '<div class="sdf-str"><div class="sdf-str__h"><b>Из каждых 100 ₽ выручки за ' + posl.god + '</b><span>' + esc(M.ist.vyruchka) + (pn != null ? '; налоги — ' + esc(M.ist.nalogi) : '') + '</span></div>' +
        '<div class="sdf-bar" role="img" aria-label="Расходы ' + p1(pr) + ', прибыль ' + p1(pp) + (pn != null ? ', налоги и взносы ' + p1(pn) : '') + '"><i class="r" style="width:' + pr.toFixed(2) + '%"></i><i class="' + (posl.pribyl < 0 ? 'm' : 'p') + '" style="width:' + (posl.pribyl < 0 ? 0 : pp).toFixed(2) + '%"></i>' +
          (pn != null ? '<em style="width:' + pn.toFixed(2) + '%"></em>' : '') + '</div>' +
        '<ul class="sdf-str__l"><li class="r"><i></i>Расходы <b>' + p1(pr) + '</b></li><li class="' + (posl.pribyl < 0 ? 'm' : 'p') + '"><i></i>' + (posl.pribyl < 0 ? 'Убыток <b>' + esc(krupno(posl.pribyl)) + '</b>' : 'Прибыль <b>' + p1(pp) + '</b>') + '</li>' +
          (pn != null ? '<li class="n"><i></i>Налоги и взносы <b>' + p1(pn) + '</b> <small>входят в расходы</small></li>' : '') + '</ul></div>';
    }
    // налоги по видам
    if (M.nalogiVidy.length) {
      h += '<div class="sdf-nv"><div class="sdf-str__h"><b>Налоги и взносы по видам' + (M.godN ? ' за ' + M.godN : '') + ': ' + esc(krupno(M.nalogiVsego)) + '</b><span>' + esc(M.ist.nalogi) + ', уплачено; НДФЛ за работников в наборе может не быть</span></div>' +
        '<div class="sdf-bar sdf-bar--nv">' + M.nalogiVidy.map(function (q) { return '<i style="width:' + (q.summa / M.nalogiVsego * 100).toFixed(2) + '%;background:' + q.cvet + '"></i>'; }).join('') + '</div>' +
        '<ul class="sdf-nv__l">' + M.nalogiVidy.map(function (q) { return '<li><i style="background:' + q.cvet + '"></i><span>' + esc(q.nazv) + '</span><b>' + esc(krupno(q.summa)) + '</b><small>' + (Math.round(q.summa / M.nalogiVsego * 1000) / 10).toString().replace('.', ',') + NB + '%</small></li>'; }).join('') + '</ul>' +
        (M.rezhim === 'usn' && !M.nalogiVidy.some(function (q) { return q.k === 'usn'; }) ? '<p class="sd-s">Режим — упрощённая система, а платежа УСН в наборе ФНС нет: он мог быть зачтён из единого налогового платежа позже.</p>' : '') +
        (!M.nalogiVidy.some(function (q) { return q.k === 'nds'; }) && M.rezhim !== 'usn' ? '<p class="sd-s">НДС в наборе ФНС за этот год нет: бывает у освобождённых от НДС операций (ст. 149 НК РФ) или при вычетах, равных начисленному. Спросите контрагента, выставит ли он счёт-фактуру.</p>' : '') + '</div>';
    }
    h += otraslHtml(NG);
    if (M.kpi.length) h += '<ul class="sdf-kpi">' + M.kpi.map(function (q) { return '<li><span>' + esc(q.nazv) + '</span><b>' + nb(q.znach) + '</b><small>' + esc(q.pod) + '</small></li>'; }).join('') + '</ul>';
    return h + '<p class="sd-s">Годы — по бухгалтерской отчётности (ГИР БО ФНС, строки 2110 и 2400). Расходы — выручка минус чистая прибыль: все расходы вместе с налогом на прибыль, расчёт Делоскопа. Налоги — то, что компания уплатила по открытым данным ФНС.</p></section>';
  }
  // ---------- «Источники и даты» — последняя страница досье: откуда каждая цифра и на какую дату ----------
  function istochniki(r) {
    r = r || {};
    var out = [], D = r.dossier || {}, dm = r.damia || {};
    str(D.data_dates).split(';').map(str).filter(Boolean).forEach(function (t) {
      var m = /^(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})$/.exec(t); if (!m) return;
      var k = m[1], nazv = /ЕГРЮЛ|ЕГРИП/.test(k) ? (/изменение/.test(k) ? 'ЕГРЮЛ — последнее изменение записи' : 'ЕГРЮЛ') : 'ФНС, открытые данные: ' + k;
      out.push({ nazv: nazv, data: m[2], st: 'ok' });
    });
    var gv = ((D.charts || {}).revenue || []).map(function (x) { return +x.year; }).filter(isFinite).sort().pop();
    if (gv) out.push({ nazv: 'ГИР БО ФНС — бухгалтерская отчётность', data: 'за ' + gv + ' год', st: 'ok' });
    Object.keys(dm).forEach(function (k) {
      var b = dm[k]; if (!b || typeof b !== 'object' || !b.nazvanie) return;
      var st = b.status === 'found' || b.status === 'not_found' || b.sostoyanie === 'found' || b.sostoyanie === 'not_found' ? 'ok' : b.status === 'not_applicable' ? 'na' : 'ne';
      var ik = str(b.istochnik).replace(/\s*\(через DaMIA\)/, '').split(':')[0];
      out.push({ nazv: b.nazvanie + (ik && ik.toLowerCase() !== str(b.nazvanie).toLowerCase() ? ' — ' + ik : ''), data: dmyIso(b.data_svedeniy), st: st, sam: st === 'ne' ? b.proverit_samim || '' : '' });
    });
    return out;
  }
  function istochnikiHtml(r) {
    var a = istochniki(r); if (!a.length) return '';
    return '<section class="sd-ist" aria-labelledby="sd-ist-h"><div class="sd-sec-h"><h3 id="sd-ist-h">Источники и даты</h3><p>Откуда сведения этого досье и на какую дату. «Не ответил» — значит не проверяли, а не «ничего нет».</p></div><ul>' +
      a.map(function (x) { return '<li class="' + x.st + '"><i aria-hidden="true"></i><span>' + esc(x.nazv) + '</span><b>' + (x.st === 'ok' ? esc(x.data || '—') : x.st === 'na' ? 'не применяется' : 'не ответил' + (x.sam ? ' · <a href="' + esc(x.sam) + '" target="_blank" rel="noopener nofollow">проверить самим</a>' : '')) + '</b></li>'; }).join('') + '</ul></section>';
  }
  // ---------- разметка блока (страница Паспорта) ----------
  // Только строки с экранированием: ни одного текста из счёта или ответа API без esc.
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nb(t) { return esc(t).replace(/(\d) (?=\d{3}\b)/g, '$1&nbsp;').replace(/(\d) (₽|%)/g, '$1&nbsp;$2'); }
  var MARK = { 'is-fact': ['m-ist', 'подтверждено источником'], 'is-calc': ['m-ras', 'наш расчёт'], 'is-none': ['m-net', 'не проверено'], 'is-bad': ['m-bad', 'ошибка'], 'is-high': ['m-bad', 'найдено'] };
  var TON_SLOVO = { ok: 'норма', warn: 'есть вопросы', bad: 'риск', off: 'не проверяли', info: 'справочно' };
  var IKONKI = { // линейные знаки 24×24, одна толщина штриха, без заливки — в духе дизайн-системы
    nalogi: '<path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>',
    dolgi: '<path d="M4 7h16v10H4z"/><path d="M4 11h16"/><path d="M8 15h3"/>',
    shtat: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 19"/>',
    dostovernost: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8.5 12l2.4 2.4 4.6-4.8"/>',
    status: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>',
    otchetnost: '<path d="M5 19V5"/><path d="M5 19h14"/><path d="M9 16v-4"/><path d="M13 16V9"/><path d="M17 16v-6"/>',
    rukovoditel: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    vozrast: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    scheta: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    opyt: '<path d="M8 4h8l1 4H7z"/><path d="M5 8h14v12H5z"/><path d="M9 13h6"/>'
  };
  function ikonka(k) { return '<svg class="sd-ik" viewBox="0 0 24 24" aria-hidden="true">' + (IKONKI[k] || IKONKI.status) + '</svg>'; }
  function galka(name, on, tekst) {
    return '<label class="sd-g"><input type="checkbox" name="' + esc(name) + '"' + (on ? ' checked' : '') + '><span class="sd-g__b" aria-hidden="true"></span><span class="sd-g__t">' + esc(tekst) + '</span>' +
      '<span class="sd-gp pechat">' + (on ? '☑' : '☐') + '</span></label>';
  }
  function shag(n, id, h, gotov, telo, kratko) {
    return '<li class="sd-sh' + (gotov ? ' gotov' : '') + '" id="' + id + '"><span class="sd-n" aria-hidden="true">' + (gotov ? '<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg>' : n) + '</span><div class="sd-b"><h4>' + esc(h) +
      '<span class="sd-st">' + (gotov ? 'готово' : esc(kratko || 'не закрыто')) + '</span></h4>' + telo + '</div></li>';
  }
  // Кольцо готовности: 6 сегментов (шаги досье), закрытые — цветом итога; вид — объёмный диск (наклон CSS, тень)
  function kolco(gotovo, vsego, kod) {
    var R = 46, C = 2 * Math.PI * R, seg = C / vsego, zaz = 3.2, h = '';
    for (var i = 0; i < vsego; i++) h += '<circle class="sd-ring__s' + (i < gotovo ? ' on' : '') + '" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + (seg - zaz).toFixed(2) + ' ' + (C - seg + zaz).toFixed(2) + '" stroke-dashoffset="' + (-i * seg).toFixed(2) + '" style="--i:' + i + '"/>';
    return '<div class="sd-ring ' + esc(kod) + '" role="img" aria-label="Готово ' + gotovo + ' из ' + vsego + ' шагов досье"><div class="sd-ring__disk"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="sd-ring__t" cx="60" cy="60" r="' + R + '"/>' + h + '</svg>' +
      '<div class="sd-ring__c"><b>' + gotovo + '<i>/' + vsego + '</i></b><small>шагов</small></div></div></div>';
  }
  // Пульс на обложке: пять признаков реальности, которые решают первыми, — цветом и словом
  var PULS = ['nalogi', 'dolgi', 'shtat', 'dostovernost', 'scheta'];
  function pulsHtml(R) {
    if (!R) return '';
    var x = PULS.map(function (k) { return R.plitki.filter(function (t) { return t.k === k; })[0]; }).filter(Boolean);
    if (!x.length) return '';
    return '<ul class="sd-puls" aria-label="Главные признаки реальности">' + x.map(function (t) {
      return '<li class="' + esc(t.ton) + '"><a href="#sd-real-h"><i aria-hidden="true"></i>' + esc(t.nazv) + '<span>' + esc(TON_SLOVO[t.ton] || '') + '</span></a></li>'; }).join('') + '</ul>';
  }
  function realnostKoroche(R) {
    var I = R.itogo, zam = R.plitki.filter(function (t) { return t.ton === 'warn' || t.ton === 'bad'; }).map(function (t) { return t.nazv.toLowerCase(); }),
      ne = R.plitki.filter(function (t) { return t.ton === 'off'; }).map(function (t) { return t.nazv.toLowerCase(); });
    var t = (I.ok || 0) + ' из ' + R.vsego + ' признаков в норме' + (zam.length ? '; есть вопросы: ' + zam.join(', ') : '') + (ne.length ? '; не проверяли: ' + ne.join(', ') : '') + '.';
    return '<p class="sd-koroche"><b>Коротко.</b> ' + esc(t.charAt(0).toUpperCase() + t.slice(1)) + '</p>';
  }
  function realnostHtml(R) {
    if (!R || !R.plitki.length) return '';
    var I = R.itogo, v = R.vsego;
    function pol(k, cls) { return I[k] ? '<i class="sd-bar__' + cls + '" style="flex:' + I[k] + '"></i>' : ''; }
    return '<section class="sd-real" aria-labelledby="sd-real-h"><div class="sd-sec-h"><h3 id="sd-real-h">Реальность контрагента</h3>' +
      '<p>То, по чему налоговая и банк судят, есть ли у компании настоящий бизнес: налоги, долги, люди, достоверность записей, отчётность. У каждого признака — источник и дата.</p></div>' +
      realnostKoroche(R) +
      '<div class="sd-bar" role="img" aria-label="' + esc((I.ok || 0) + ' в норме, ' + ((I.warn || 0) + (I.bad || 0)) + ' с замечаниями, ' + (I.off || 0) + ' не проверяли, ' + (I.info || 0) + ' справочно') + '">' +
        pol('ok', 'ok') + pol('info', 'info') + pol('warn', 'warn') + pol('bad', 'bad') + pol('off', 'off') + '</div>' +
      '<p class="sd-bar__l"><span class="ok">' + (I.ok || 0) + ' в норме</span>' + ((I.warn || 0) + (I.bad || 0) ? '<span class="warn">' + ((I.warn || 0) + (I.bad || 0)) + ' с замечаниями</span>' : '') +
        (I.off ? '<span class="off">' + I.off + ' не проверяли</span>' : '') + (I.info ? '<span class="info">' + I.info + ' справочно</span>' : '') + '<span class="vsego">из ' + v + '</span></p>' +
      '<ul class="sd-tiles">' + R.plitki.map(function (t, i) {
        return '<li class="sd-tile ' + esc(t.ton) + '" style="--i:' + i + '"><div class="sd-tile__h">' + ikonka(t.k) + '<span class="sd-tile__k">' + esc(t.nazv) + '</span><span class="sd-tile__t">' + esc(TON_SLOVO[t.ton] || '') + '</span></div>' +
          '<b class="sd-tile__v">' + nb(t.znach) + '</b>' + (t.pod ? '<span class="sd-tile__p">' + nb(t.pod) + '</span>' : '') +
          '<span class="sd-tile__s">' + (t.ist ? esc(t.ist) + (t.data ? ' · ' + esc(t.data) : '') : 'источник не ответил') +
            (t.ton === 'off' && t.sam ? ' · <a href="' + esc(t.sam) + '" target="_blank" rel="noopener nofollow">проверить самим</a>' : t.spravka ? ' · <a href="' + esc(t.spravka.u) + '">' + esc(t.spravka.t) + '</a>' : '') + '</span></li>';
      }).join('') + '</ul></section>';
  }
  function svyaziKoroche(S) {
    var r = S.uzly.filter(function (u) { return u.k === 'rukovoditel'; })[0], u = S.uzly.filter(function (x) { return x.k === 'uchreditel'; }), y = u.filter(function (x) { return x.yur; });
    var t = (r ? (r.yur ? 'Управляет управляющая компания ' + r.imya : r.rol + ' — ' + r.imya) : '') + (u.length ? (r ? '; ' : '') + 'учредителей: ' + u.length + (y.length ? ', из них юрлиц: ' + y.length : '') : '');
    return t ? '<p class="sd-koroche"><b>Коротко.</b> ' + nb(t) + '.</p>' : '';
  }
  function svyaziHtml(S, rez, dop) {
    if (!S) return '';
    rez = rez || {};
    var flagi = (dop || []).concat(S.flagi);
    return '<section class="sd-svz" aria-labelledby="sd-svz-h"><div class="sd-sec-h"><h3 id="sd-svz-h">Связи и группа компаний</h3>' +
      '<p>Кто управляет компанией и кому она принадлежит — по ЕГРЮЛ. Юрлица из связей можно найти по названию и проверить так же, как контрагента.</p></div>' +
      svyaziKoroche(S) +
      (flagi.length ? '<ul class="sd-flagi">' + flagi.map(function (f) { return '<li class="' + esc(f.ton) + '"><b>' + nb(f.t) + '</b>' + (f.pod ? '<span>' + nb(f.pod) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="sd-orbit" data-sd-orbit><canvas class="sd-orbit__cv" aria-hidden="true"></canvas></div>' +
      '<ul class="sd-uzly">' + S.uzly.map(function (u, i) {
        var nr = rez[i];
        return '<li class="sd-uzel ' + esc(u.ton) + (u.yur ? ' yur' : '') + '" data-uzel="' + i + '"><span class="sd-uzel__r">' + esc(u.rol) + '</span><b class="sd-uzel__i">' + nb(u.imya) + '</b>' +
          (u.pod ? '<span class="sd-uzel__p">' + nb(u.pod) + '</span>' : '') +
          (u.yur ? (nr ? (nr.inn ? '<span class="sd-uzel__n">ИНН ' + esc(nr.inn) + (nr.status && nr.status !== 'ACTIVE' ? ' · ' + esc(ST[nr.status] || nr.status) : '') + (nr.obshchij ? ' · <em>тот же адрес, что у контрагента</em>' : '') +
              ' <a href="/?inn=' + esc(nr.inn) + '" class="noprint">Проверить&nbsp;→</a></span>' : '<span class="sd-uzel__n">По названию не нашли — проверьте в ЕГРЮЛ</span>')
            : '<button type="button" class="sd-uzel__b noprint" data-sd-najti="' + i + '">Найти ИНН</button>') : '') + '</li>';
      }).join('') + '</ul>' +
      '<p class="sd-s">Источник: ' + esc(S.ist) + '. ' + esc(S.ne) + ' <a href="' + SAM.svyazi + '" target="_blank" rel="noopener nofollow">pb.nalog.ru</a></p></section>';
  }
  // Навигация по досье — липкая строка разделов (подсветку текущего ставит страница)
  function navHtml(o) {
    var p = [];
    if (o.realnost && o.realnost.plitki.length) p.push(['sd-real-h', 'Реальность']);
    if (o.dengi) p.push(['sdf-h', 'Деньги']);
    if (o.svyazi) p.push(['sd-svz-h', 'Связи']);
    p.push(['sd-shagi-h', 'Шаги до оплаты']);
    if (o.r && istochniki(o.r).length) p.push(['sd-ist-h', 'Источники']);
    return '<nav class="sd-nav noprint" aria-label="Разделы досье">' + p.map(function (x) { return '<a href="#' + x[0] + '" data-sd-nav="' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</nav>';
  }
  function html(o) {
    o = o || {};
    var it = o.it || {}, ned = o.ned || [], pr = o.pr || [], rk = o.rekv || {}, g = o.galki || {}, dg = g.docs || {}, U = modul('Usloviya', './usloviya.js');
    var po = {}; ned.forEach(function (x) { (po[x.gruppa] = po[x.gruppa] || []).push(x); });
    var docs = o.docs || [], s = o.sohraneno;
    var G = [o.summa > 0, !(po.fakty || []).length, rk.vvedeny && !rk.oshibka && !rk.priostanovka && !(po.rekvizity || []).length, !ned.length && !pr.length,
      !(po.dokumenty || []).length && !ned.some(function (x) { return x.k === 'vyruchka'; }), !!s && !(o.izm && o.izm.length) && !(o.svezh && o.svezh.staroe)];
    var gotovo = G.filter(Boolean).length, kod = it.kod || 'predv';
    var h = '<section class="sd" id="sd" aria-labelledby="sd-h">' +
      // обложка: вердикт, кольцо готовности, реквизиты документа
      '<header class="sd-cover ' + esc(kod) + '" data-sd-tilt><div class="sd-cover__fon" aria-hidden="true"><i class="sd-cover__setka"></i><i class="sd-cover__blik"></i></div>' +
        '<div class="sd-cover__in"><div class="sd-cover__top"><span class="sd-eyebrow">Досье сделки</span><span class="sd-stamp">' + (o.nomer ? 'Проверка № ' + esc(o.nomer) + ' · ' : '') + 'собрано ' + esc(o.sobrano || '') + '</span></div>' +
        '<h2 id="sd-h" class="sd-cover__name">' + esc(o.nazvanie || '') + '</h2>' +
        '<div class="sd-chips"><span>ИНН ' + esc(o.inn || '') + '</span>' + (o.summa > 0 ? '<span>Сделка ' + nb(money(o.summa, U)) + '</span>' : '<a href="#sd-summa">Указать сумму</a>') + '<span>Сведения на ' + esc(o.svedeniyaNa || '') + '</span></div>' +
        '<div class="sd-cover__main">' + kolco(gotovo, 6, kod) +
          '<div class="sd-verdict" role="status" aria-live="polite"><span class="sd-verdict__l">Итог досье</span><b>' + nb(it.zagolovok) + '</b><p>' + nb(it.tekst) + '</p></div></div>' +
        pulsHtml(o.realnost) +
        (o.svezh && o.svezh.tekst ? '<p class="sd-cover__w">' + esc(o.svezh.tekst) + '</p>' : '') + '</div></header>' +
      navHtml(o) + realnostHtml(o.realnost) + dengiHtml(o.dengi, o.nagruzka) + svyaziHtml(o.svyazi, o.svyaziNajdeno, svyaziDop(o.svyazi, o.svyaziNajdeno)) +
      '<div class="sd-sec-h sd-sec-h--shagi"><h3 id="sd-shagi-h">Шесть шагов до оплаты</h3><p>Закрывайте по порядку: каждый шаг — с отметкой и датой, всё попадёт в PDF.</p></div><ol class="sd-shagi">';
    // 1. ИНН и сумма
    h += shag(1, 'sd-summa', 'Контрагент и сумма', G[0],
      '<form class="sd-f" data-sd="summa" onsubmit="return false"><label>Сумма сделки, ₽<input type="text" name="sd_summa" inputmode="numeric" autocomplete="off" placeholder="например, 500 000" value="' +
        (o.summa > 0 ? esc(money(o.summa, U).replace(/\s?₽$/, '')) : '') + '"></label><button class="btn noprint" type="submit">Пересчитать</button></form>', 'нужна сумма');
    // 2. Факты, источники, даты
    var fk = o.fakty || [];
    h += shag(2, 'sd-fakty', 'Факты, источники и даты', G[1],
      '<ul class="sd-l">' + fk.map(function (x) {
        return '<li><span class="m ' + esc(x.mark) + '" aria-hidden="true"></span><div><a href="#r' + esc(x.n) + '">' + esc(x.n + '. ' + x.title) + '</a><span>' + esc(x.tekst) + '</span></div></li>';
      }).join('') + '</ul><p class="sd-s">Раздел «не проверяли» закрывается вашей отметкой самопроверки в нём — со ссылкой на первоисточник и временем.</p>', (po.fakty || []).length + ' не проверено');
    // 3. Реквизиты
    var rRows = (rk.stroki || []).map(function (x) {
      var mk = MARK[x.cls] || MARK['is-none'];
      return '<li class="' + esc(x.cls) + '"><span class="m ' + mk[0] + '" role="img" aria-label="' + esc(mk[1]) + '"></span><div><b>' + nb(x.nazv) + '</b> <span class="sd-v">' + nb(x.verdikt) + '</span>' +
        '<small>' + nb(x.meta) + (x.ssylka ? ' <a href="' + esc(x.ssylka.href) + '" target="_blank" rel="noopener nofollow">' + esc(x.ssylka.text) + '</a>' : '') + '</small></div></li>';
    }).join('');
    h += shag(3, 'sd-rekv', 'Реквизиты для оплаты', G[2],
      '<form class="sd-f noprint" data-sd="rekv" onsubmit="return false"><label class="sd-w100">Реквизиты из счёта или письма<textarea name="sd_rekv" rows="3" autocomplete="off" spellcheck="false" placeholder="ИНН 7700000000, р/с 40702…, БИК 04…">' + esc(o.rekvTekst || '') + '</textarea></label>' +
        '<button class="btn" type="submit">Сверить реквизиты</button><small>Сверяем в вашем браузере — реквизиты никуда не отправляются. Счёт целиком (PDF) — в <a href="/proverit-schet/">«Проверь счёт»</a>.</small></form>' +
      (rk.vvedeny ? '<p class="sd-p">ИНН ' + esc(rk.vvod.inn || '—') + ' · БИК ' + esc(rk.vvod.bik || '—') + ' · счёт ' + esc(rk.vvod.acc || '—') + ' — сверено ' + esc(o.rekvKogda || o.sobrano || '') + '</p><ul class="sd-acc">' + rRows + '</ul>' +
        galka('svereny', g.svereny, 'Сверили банк, БИК и номер счёта с договором или карточкой за подписью директора') +
        galka('telefon', g.telefon, 'Подтвердили реквизиты у поставщика по телефону из договора или с сайта — не из письма со счётом') : ''),
      rk.oshibka ? 'ошибка в реквизитах' : rk.vvedeny ? 'нужны отметки' : 'не сверены');
    // 4. Чего не хватает
    h += shag(4, 'sd-ned', 'Чего не хватает', G[3],
      (pr.length ? '<ul class="sd-pr">' + pr.map(function (x) { return '<li><b>' + nb(x.t) + '</b>' + (x.kak ? '<small>' + nb(x.kak) + '</small>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      (ned.length ? '<ul class="sd-ned">' + ned.map(function (x) {
        return '<li class="g-' + esc(x.gruppa) + '"><b>' + nb(x.t) + '</b><small>' + nb(x.kak || '') + (x.ssylka ? ' <a href="' + esc(x.ssylka.u) + '"' + (/^https:/.test(x.ssylka.u) ? ' target="_blank" rel="noopener nofollow"' : '') + '>' + esc(x.ssylka.t) + '</a>' : '') +
          (x.do ? ' <a class="noprint sd-k" href="' + esc(x.do) + '">к пункту</a>' : '') + '</small></li>';
      }).join('') + '</ul>' : (pr.length ? '' : '<p class="sd-p">Открытых пунктов нет.</p>')), (ned.length + pr.length) + ' ' + plural(ned.length + pr.length, 'пункт', 'пункта', 'пунктов'));
    // 5. Договор и документы
    h += shag(5, 'sd-dok', 'Договор и документы', G[4],
      '<p class="sd-s">Что запросить — соразмерно сумме (п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@). Отметьте, что получили.</p><div class="sd-gs">' +
      docs.map(function (d) { return galka('doc_' + d.id, !!dg[d.id], d.title); }).join('') +
      (o.pvBaza && !docs.some(function (d) { return d.id === 'otchetnost'; }) ? galka('doc_otchetnost', !!dg.otchetnost, 'Бухгалтерская отчётность за последний год с квитанцией о сдаче') : '') +
      galka('dogovor', g.dogovor, 'Договор подписан обеими сторонами') + '</div>' +
      '<a class="sd-cta noprint" href="' + esc(o.delopis || '/delopis/') + '"><b>Собрать договор в Делописи</b><span>реквизиты из ЕГРЮЛ и защитные пункты под найденные риски' + (it.kod === 'sobrano' ? '' : '; пока досье не закрыто — с оплатой по факту') + '</span></a>', 'документы не получены');
    // 6. Сохранение и повторная проверка
    h += shag(6, 'sd-hran', 'Сохранение и повторная проверка', G[5],
      (s ? '<p class="sd-p">Сохранено на этом устройстве ' + esc(mskVremya(s.t)) + (s.snimok && s.snimok.checked_at ? ' · проверка от ' + esc(mskData(s.snimok.checked_at)) : '') + '.</p>' : '<p class="sd-p">Пока не сохранено.</p>') +
      (o.izm ? (o.izm.length ? '<div class="sd-izm"><b>С сохранения изменилось:</b><ul>' + o.izm.map(function (x) { return '<li>' + nb(x) + '</li>'; }).join('') + '</ul></div>'
        : '<p class="sd-p">С сохранения статус, итог и замечания не изменились.</p>') : '') +
      '<div class="sd-btns noprint"><button class="btn primary" type="button" data-sd-act="save">' + (s ? 'Обновить сохранённое' : 'Сохранить на этом устройстве') + '</button>' +
        '<button class="btn" type="button" data-sd-act="povtor">Проверить заново</button>' + (s ? '<button class="btn sd-del" type="button" data-sd-act="del">Удалить с устройства</button>' : '') + '</div>' +
      '<p class="sd-s noprint" data-sd-msg role="status" aria-live="polite">Сохраняем только в этом браузере — Делоскоп досье не получает. Повторная проверка — одна из бесплатных проверок дня: сравним с сохранённым.</p>', s ? 'есть изменения' : 'не сохранено');
    h += '</ol>' + istochnikiHtml(o.r) + '<p class="stroka">' + esc(OGOVORKA) + ' ' + esc(OGOVORKA_OTM) + ' ' + esc(VERSIYA) + '.</p></section>';
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
    mskData: mskData, mskVremya: mskVremya, html: html, spisokHtml: spisokHtml, esc: esc, realnost: realnost, svyazi: svyazi, obshchijAdres: obshchijAdres, adresKlyuch: adresKlyuch, kratko: kratko, zaprosImeni: zaprosImeni, kratkoGraf: kratkoGraf, svyaziDop: svyaziDop, dengi: dengi, dengiSvg: dengiSvg, dengiGod: dengiGod, dengiHtml: dengiHtml, rubIz: rubIz, krupno: krupno, istochniki: istochniki
  };
});
