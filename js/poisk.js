/* Делоскоп — строка, которая понимает (poisk-v2-a, 13.11.2026).
 *
 * Одна строка — вход во всё. Человек вводит то, что есть под рукой: ИНН, ОГРН, название, кусок счёта с ИНН, КПП,
 * счётом и БИК, номер счёта, вопрос словами. Строка сама говорит, что это («ИНН организации · контрольная цифра верна»),
 * и что будет по Enter. Распознавание и ошибки — в браузере, без запроса; сервер — только за подсказками ЕГРЮЛ.
 *
 * Правила: первая строка списка — действие, Enter всегда делает первое (или выбранное стрелками);
 * «скоро» пишем словами; у счёта всегда строка «принадлежность счёта поставщику не подтверждается»;
 * в списках — только организации (ИП — лишь по точному ИНН); текст запроса не храним и никуда не шлём,
 * кроме подсказок ЕГРЮЛ; в Метрику — только вид ввода (poisk_tip, {vid}), без текста.
 * Чистые функции — для автотестов (node): tests/poisk.test.js. Подключение на главной — index.html («подсказки»). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkPoisk = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  // Образец ИНН для примеров — тот же, что у «Посмотреть пример отчёта» (ответ юриста 13.11, п. 1.5)
  var PRIMER_INN = '2309085638';

  // ---------- контрольные цифры ----------
  function cif(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function innOk(s) {
    if (!/^(\d{10}|\d{12})$/.test(s)) return false;
    var d = s.split('').map(Number);
    function k(w) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return x % 11 % 10; }
    if (d.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
  }
  function modStr(s, m) { var r = 0; for (var i = 0; i < s.length; i++) r = (r * 10 + (+s[i])) % m; return r; }
  function ogrnOk(s) {
    if (s.length === 13) return modStr(s.slice(0, 12), 11) % 10 === +s[12];
    if (s.length === 15) return modStr(s.slice(0, 14), 13) % 10 === +s[14];
    return false;
  }
  // Ключ счёта по БИК (Положение Банка России № 579-П, прил.): три последние цифры БИК + 20 цифр счёта, веса 7-1-3
  function kluchOk(bik, acc) {
    var s = bik.slice(-3) + acc, w = [7, 1, 3], sum = 0;
    for (var i = 0; i < 23; i++) sum += (+s[i]) * w[i % 3] % 10;
    return sum % 10 === 0;
  }
  var TIP = { '40702': 'счёт коммерческой организации', '40802': 'счёт ИП', '40817': 'счёт физического лица',
    '40703': 'счёт некоммерческой организации', '40701': 'счёт финансовой организации' };
  var VAL = { '810': 'рубли', '840': 'доллары США', '978': 'евро', '156': 'юани' };

  // ---------- раскладка ----------
  var EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
  function vRus(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s[i].toLowerCase(), j = EN.indexOf(c); o += j >= 0 ? RU[j] : s[i]; } return o; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').trim(); }

  // ---------- разделы сайта (data/poisk-razdely.json: {u, t, s, k}) ----------
  var STOP = { как: 1, что: 1, где: 1, для: 1, или: 1, это: 1, мне: 1, нам: 1, вам: 1, если: 1, когда: 1, почему: 1, зачем: 1, можно: 1, нужно: 1, сколько: 1, ооо: 1, пао: 1, оао: 1, зао: 1 };
  function koren(w) { return w.length > 5 ? w.slice(0, 5) : w; }
  function ischiRazdely(t, razdely) {
    var ws = norm(t).split(/[^a-zа-я0-9.]+/).filter(function (w) { return w.length >= 3 && !STOP[w]; });
    if (!ws.length || !razdely || !razdely.length) return [];
    var out = [];
    razdely.forEach(function (r, n) {
      var hay = norm(r.t + ' ' + r.k).split(/\s+/), sc = 0;
      ws.forEach(function (w) {
        var k = koren(w);
        for (var i = 0; i < hay.length; i++) {
          if (hay[i].indexOf(k) === 0 || (hay[i].length >= 4 && w.indexOf(koren(hay[i])) === 0)) { sc += (i < 4 ? 2 : 1) * (w.length >= 6 ? 1.5 : 1); break; }
        }
      });
      if (sc > 0) out.push([sc, n, r]);
    });
    out.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    return out.slice(0, 4).map(function (x) { return x[2]; });
  }

  // ---------- разбор ввода ----------
  // → { vid, chip, hint, err, exact, rows: [{g, t, s, inn?, href?, tag?}], nazvanie: текст для подсказок ЕГРЮЛ | '' }
  // Строка с inn или href — действие; без них — пояснение (Enter её пропускает).
  function razobrat(raw, razdely) {
    var t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    var R = { vid: '', chip: '', hint: '', err: false, exact: false, rows: [], nazvanie: '' };
    if (!t) return R;
    var d = cif(t), bukv = /[a-zа-яё]/i.test(t.replace(/инн|кпп|огрнип|огрн|бик|р\/с|к\/с|сч[её]т|№/gi, ''));
    function row(g, title, sub, o) { o = o || {}; R.rows.push({ g: g, t: title, s: sub, inn: o.inn || '', href: o.href || '', tag: o.tag || '' }); }
    function otchet(inn) { row('Действие', inn.length === 10 ? 'Проверить компанию' : 'Проверить ИП', 'Отчёт по ИНН ' + inn + ' — статус, долги, суды, Индекс', { inn: inn }); }

    // реквизиты пачкой: счёт + БИК, ИНН + КПП, кусок счёта
    var acc = null, bik = null, inn = null, kpp = null, ogrn = null;
    var grp = (t.match(/\d[\d \-]{7,}\d/g) || []).map(cif).concat(t.match(/\d{9,20}/g) || []);
    grp.forEach(function (g) {
      if (g.length === 20 && !acc) acc = g;
      else if (g.length === 9 && /^04/.test(g) && !bik) bik = g;
      else if ((g.length === 10 || g.length === 12) && innOk(g) && !inn) inn = g;
      else if (g.length === 9 && !kpp && !/^04/.test(g)) kpp = g;
      else if ((g.length === 13 || g.length === 15) && ogrnOk(g) && !ogrn) ogrn = g;
    });
    if (acc && bik) {
      var ok = kluchOk(bik, acc), tip = TIP[acc.slice(0, 5)] || 'счёт', val = VAL[acc.slice(5, 8)] || 'валюта ' + acc.slice(5, 8);
      R.vid = 'schet_bik'; R.exact = ok; R.err = !ok;
      R.chip = ok ? 'Счёт и БИК: ключ сходится' : 'Счёт и БИК: ключ не сходится';
      R.hint = tip + ' · ' + val + (ok ? '' : '. В номере счёта или БИК опечатка' + NB + '— платёж не пройдёт');
      row('Действие', 'Проверить счёт перед оплатой', (inn ? 'ИНН ' + inn + ' · ' : '') + 'счёт ' + acc.slice(0, 5) + '…' + acc.slice(-4) + ' · БИК ' + bik, { href: '/proverit-schet/' });
      if (inn) otchet(inn);
      row('Важно', 'Принадлежность счёта поставщику не подтверждается', 'Ни один открытый источник не связывает номер счёта с ИНН. Сверьте счёт с договором', { tag: 'правило' });
      return R;
    }
    if (!bukv && inn && kpp) { R.vid = 'inn_kpp'; R.exact = true; R.chip = 'ИНН и КПП'; R.hint = 'ИНН ' + inn + ' · КПП ' + kpp + NB + '— контрольная цифра ИНН верна'; otchet(inn); return R; }

    // только цифры
    if (!bukv && d.length >= 1) {
      if (d.length === 10 || d.length === 12) {
        if (innOk(d)) {
          R.vid = d.length === 10 ? 'inn' : 'inn_ip'; R.exact = true;
          R.chip = d.length === 10 ? 'ИНН организации' : 'ИНН предпринимателя';
          R.hint = 'Контрольная цифра верна' + (d.length === 12 ? '. По ИП показываем только сведения реестра' : '');
          otchet(d);
          if (d.length === 10) row('Ещё', 'Паспорт контрагента', 'Одна страница о компании' + NB + '— переслать директору', { href: '/pasport/kontragent/?inn=' + d });
        } else {
          R.vid = 'inn_oshibka'; R.err = true; R.chip = 'ИНН с опечаткой'; R.hint = 'Контрольная цифра не сходится. Сверьте цифры с договором или счётом';
          row('Подсказка', 'Проверьте цифры ИНН', 'Цифр ' + d.length + ', как и нужно, но одна из них неверна', { tag: 'опечатка' });
        }
        return R;
      }
      if (d.length === 13 || d.length === 15) {
        if (ogrnOk(d)) { R.vid = 'ogrn'; R.exact = true; R.chip = d.length === 13 ? 'ОГРН' : 'ОГРНИП'; R.hint = 'Контрольная цифра верна. Проверка идёт по ИНН' + NB + '— введите ИНН из той же выписки'; row('Подсказка', 'Нужен ИНН', 'ИНН есть в выписке ЕГРЮЛ рядом с ОГРН', { tag: 'нужно ещё' }); }
        else { R.vid = 'ogrn_oshibka'; R.err = true; R.chip = 'ОГРН с опечаткой'; R.hint = 'Контрольная цифра не сходится'; row('Подсказка', 'Проверьте цифры ОГРН', 'В ОГРН 13 цифр, в ОГРНИП' + NB + '— 15', { tag: 'опечатка' }); }
        return R;
      }
      if (d.length === 9 && /^04/.test(d)) { R.vid = 'bik'; R.exact = true; R.chip = 'БИК банка'; R.hint = 'Добавьте номер счёта через пробел' + NB + '— сверим ключ'; row('Действие', 'Проверить счёт перед оплатой', 'Банк по БИК, ключ счёта, поставщик', { href: '/proverit-schet/' }); return R; }
      if (d.length === 9) { R.vid = 'kpp'; R.chip = 'Похоже на КПП'; R.hint = 'КПП сам компанию не определяет' + NB + '— добавьте ИНН'; row('Подсказка', 'Добавьте ИНН', 'ИНН и КПП стоят рядом в счёте и договоре', { tag: 'нужно ещё' }); return R; }
      if (d.length === 20) {
        R.vid = 'schet'; R.chip = 'Номер счёта'; R.hint = (TIP[d.slice(0, 5)] || 'счёт') + ' · ' + (VAL[d.slice(5, 8)] || 'валюта ' + d.slice(5, 8)) + '. Добавьте БИК' + NB + '— сверим ключ';
        row('Действие', 'Проверить счёт перед оплатой', 'Допишите БИК банка через пробел', { href: '/proverit-schet/' });
        row('Важно', 'Принадлежность счёта поставщику не подтверждается', 'Ни один открытый источник не связывает номер счёта с ИНН. Сверьте счёт с договором', { tag: 'правило' });
        return R;
      }
      if (d.length === 11 && /^[78]/.test(t.replace(/[\s()+\-]/g, '')) && /^[\s()+\-\d]+$/.test(t)) { R.vid = 'telefon'; R.chip = 'Телефон'; R.hint = 'Поиск по телефону' + NB + '— скоро'; row('Скоро', 'Компании по телефону', 'Только организации', { tag: 'скоро' }); return R; }
      if (d.length < 10) { R.vid = 'malo_cifr'; R.err = true; R.chip = 'Не хватает цифр'; R.hint = 'В ИНН компании 10 цифр' + NB + '— сейчас ' + d.length; row('Подсказка', 'Допишите ИНН', 'ИНН компании' + NB + '— 10 цифр, ИП' + NB + '— 12', { tag: 'ещё ' + (10 - d.length) }); return R; }
      R.vid = 'cifry'; R.err = true; R.chip = 'Не похоже на ИНН'; R.hint = 'Цифр ' + d.length + ': в ИНН 10 или 12, в ОГРН 13 или 15, в счёте 20';
      row('Подсказка', 'Проверьте, что скопировали', 'Возможно, в строку попали лишние цифры', { tag: 'опечатка' });
      return R;
    }
    // ИНН внутри текста: «ИНН 7707083893», «Поставщик ИНН … КПП …»
    if (inn && /инн|огрн|кпп/i.test(t)) { R.vid = 'rekvizity'; R.exact = true; R.chip = 'Реквизиты'; R.hint = 'Нашли ИНН ' + inn + (kpp ? ' и КПП ' + kpp : ''); otchet(inn); return R; }

    // номер арбитражного дела
    if (/^[аa]\s?\d{1,3}\s?-\s?\d{1,7}\s?\/\s?(\d{2}|\d{4})$/i.test(t)) { R.vid = 'delo'; R.exact = true; R.chip = 'Арбитражное дело'; R.hint = 'Стороны-организации и сумма требований' + NB + '— скоро'; row('Скоро', 'Дело ' + t.toUpperCase().replace(/A/, 'А').replace(/\s/g, ''), 'Стороны-организации, сумма требований, стадия', { tag: 'скоро' }); return R; }
    // почта и сайт
    var mail = t.match(/^[^\s@]+@([a-z0-9а-яё\-]+\.[a-zа-яё.\-]{2,})$/i), dom = t.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9а-яё\-]+(?:\.[a-zа-яё0-9\-]+)*\.[a-zа-яё]{2,})(?:\/\S*)?$/i);
    if (mail || dom) { R.vid = mail ? 'pochta' : 'sajt'; R.exact = true; R.chip = mail ? 'Почта' : 'Сайт'; R.hint = 'Поиск организации по ' + (mail ? 'почте из ЕГРЮЛ' : 'сайту') + NB + '— скоро'; row('Скоро', mail ? 'Организация по почте' : 'Организация по сайту', mail ? 'Только адрес, который указан в ЕГРЮЛ' : 'Только если организация сама указала сайт', { tag: 'скоро' }); return R; }
    // ОКВЭД
    if (/^\d{2}(\.\d{1,2}){1,2}$/.test(t)) { R.vid = 'okved'; R.exact = true; R.chip = 'Код ОКВЭД'; R.hint = 'Вид деятельности ' + t; row('Действие', 'Рейтинг компаний', 'По регионам и отраслям', { href: '/reyting/' }); return R; }

    // текст: раскладка → компании (подсказки ЕГРЮЛ с сервера) → разделы → руководитель
    var txt = t, popr = '';
    if (/^[a-z\[\];',.` ]+$/i.test(t) && /[a-z]/i.test(t)) {
      var ru = vRus(t);
      if (!ischiRazdely(t, razdely).length && /[а-я]{3}/.test(ru)) { popr = ru; txt = ru; }
    }
    if (popr) { R.rows.push({ g: 'Раскладка', t: 'Ищем «' + popr + '»', s: 'Вы печатали в английской раскладке' + NB + '— исправили сами', inn: '', href: '', tag: 'исправлено' }); }
    var razd = ischiRazdely(txt, razdely);
    var fio = /^[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+\s[А-ЯЁ][а-яё]+(вич|вна|ична|чна)$/.test(t);
    var vopros = /\?$|^(как|что|почему|зачем|можно|нужно|сколько|когда|где)\s/i.test(txt);
    R.nazvanie = norm(txt).length >= 3 && !vopros ? txt : '';
    if (R.nazvanie) R.rows.push({ g: 'Действие', t: 'Проверить «' + txt + '»', s: 'Найдём организацию в ЕГРЮЛ по названию', inn: '', href: '', tag: '', q: txt });
    if (fio) row('Скоро', 'Организации, где человек' + NB + '— руководитель', 'Только организации, по сведениям ЕГРЮЛ', { tag: 'скоро' });
    razd.forEach(function (r) { row(vopros ? 'Ответы и разделы' : 'Разделы', r.t, r.s, { href: r.u }); R.rows[R.rows.length - 1].razdel = true; });
    R.vid = popr ? 'raskladka' : fio ? 'rukovoditel' : vopros ? 'vopros' : 'nazvanie';
    R.chip = popr ? 'Другая раскладка' : fio ? 'Похоже на ФИО' : vopros ? 'Вопрос' : 'Название или вопрос';
    R.hint = vopros ? 'Нашли в разделах Делоскопа' : R.nazvanie ? 'Ищем в ЕГРЮЛ по названию' + (razd.length ? ' и в разделах Делоскопа' : '') : 'Допишите ещё пару букв';
    return R;
  }

  // ---------- подсказки ЕГРЮЛ → строки «Компании» ----------
  var ST = { LIQUIDATING: 'ликвидируется', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  function gorod(adr) {
    var ch = String(adr || '').split(',').map(function (x) { return x.trim(); });
    for (var i = 0; i < ch.length; i++) if (/^(г|город)\.?\s/i.test(ch[i])) return ch[i].replace(/^(г|город)\.?\s+/i, '');
    return '';
  }
  // Только организации (10 цифр); вторая строка — то, что отличает тёзок: город · с какого года · вид деятельности · ИНН
  function stroki(items, imya) {
    return (items || []).filter(function (it) { return it && /^\d{10}$/.test(String(it.inn || '')); }).slice(0, 7).map(function (it) {
      var c = [], g = it.gorod || gorod(it.address);
      if (g) c.push(g);
      if (it.god_s) c.push(it.god_po ? it.god_s + '–' + it.god_po : 'с ' + it.god_s);
      if (it.okved_tekst) c.push(String(it.okved_tekst).length > 38 ? String(it.okved_tekst).slice(0, 37) + '…' : it.okved_tekst);
      c.push('ИНН ' + it.inn);
      var n = imya ? imya(it.name) : it.name;
      return { g: 'Компании', t: n, s: c.join(NB + '· '), inn: String(it.inn), href: '', tag: ST[it.status] || (it.filial ? 'филиал' : ''), imya: n };
    });
  }

  // ---------- разметка списка ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function deystvie(r) { return !!(r && (r.inn || r.href || r.q)); }
  // Все строки по порядку: разбор (без разделов) → компании ЕГРЮЛ → разделы сайта
  function sobrat(R, kompanii) {
    var a = (R && R.rows) || [];
    var k = kompanii || [];
    // пришли подсказки ЕГРЮЛ — «Проверить «текст»» уже не нужна: первой встаёт компания
    return a.filter(function (r) { return !r.razdel && !(r.q && k.length); }).concat(k, a.filter(function (r) { return r.razdel; }));
  }
  function pervoe(rows) { for (var i = 0; i < rows.length; i++) if (deystvie(rows[i])) return i; return -1; }
  // R — разбор, rows — все строки (разбор + компании), sel — выбранная. → HTML для <ul role=listbox>
  function html(R, rows, sel) {
    var h = '';
    if (R && R.chip) h += '<li class="ps-seen' + (R.err ? ' ps-seen--err' : '') + '" role="presentation"><span class="ps-chip"><i></i>' + esc(R.chip) + '</span> <span>' + esc(R.hint) + '</span></li>';
    var g = '';
    rows.forEach(function (r, i) {
      if (r.g !== g) { g = r.g; h += '<li class="ps-gh" role="presentation">' + esc(g) + '</li>'; }
      var on = i === sel;
      h += '<li role="option" id="ps' + i + '" data-i="' + i + '" class="ps-row' + (deystvie(r) ? '' : ' ps-row--info') + '" aria-selected="' + on + '"' + (deystvie(r) ? '' : ' aria-disabled="true"') + '>' +
        '<b>' + esc(r.t) + '</b><span>' + esc(r.s) + '</span>' +
        (r.tag ? '<em class="ps-tag">' + esc(r.tag) + '</em>' : on && deystvie(r) ? '<em class="ps-tag ps-tag--ent">Enter ↵</em>' : '') + '</li>';
    });
    return h;
  }

  // ---------- пустая строка: недавние и примеры ----------
  // Номер счёта для примера — заведомо условный (одни нули), ключ подобран под БИК; названия в примере нет (правка Арт-директора 13.11 п. 7)
  function sdelatSchet(bik, nach, hvost) { for (var k = 0; k < 10; k++) { var a = nach + k + hvost; if (kluchOk(bik, a)) return a; } return nach + '0' + hvost; }
  var PRIMER_BIK = '044525225', PRIMER_SCHET = sdelatSchet(PRIMER_BIK, '40702810', '00000000001');
  var PRIMERY = [
    ['ИНН', PRIMER_INN],
    ['Название', 'магнит'],
    ['Не та раскладка', 'vfuybn'],
    ['Кусок счёта', 'Поставщик ИНН ' + PRIMER_INN + ' р/с ' + PRIMER_SCHET + ' БИК ' + PRIMER_BIK],
    ['ИНН с опечаткой', '2309085639'],
    ['Вопрос', 'банк запросил документы']
  ];
  function htmlPusto(nedavnie) {
    var h = '';
    var nd = (nedavnie || []).filter(function (x) { return x && /^\d{10}$/.test(String(x.inn || '')); }).slice(0, 3);
    if (nd.length) {
      h += '<li class="ps-gh" role="presentation">Недавние на этом устройстве</li>';
      nd.forEach(function (x, i) { h += '<li role="option" id="ps' + i + '" data-i="' + i + '" class="ps-row" aria-selected="false"><b>' + esc(x.name || 'ИНН ' + x.inn) + '</b><span>ИНН ' + esc(x.inn) + '</span></li>'; });
    }
    h += '<li class="ps-gh" role="presentation">Нажмите пример' + NB + '— увидите, как строка его понимает</li><li class="ps-ex" role="presentation">';
    PRIMERY.forEach(function (p) { h += '<button type="button" data-q="' + esc(p[1]) + '">' + esc(p[0]) + '</button>'; });
    return h + '</li>';
  }
  // Многострочная вставка (реквизиты из счёта) → одна строка до 300 знаков
  function vstavka(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300); }

  return { PRIMER_INN: PRIMER_INN, PRIMERY: PRIMERY, cif: cif, innOk: innOk, ogrnOk: ogrnOk, kluchOk: kluchOk, vRus: vRus, norm: norm,
    ischiRazdely: ischiRazdely, razobrat: razobrat, stroki: stroki, gorod: gorod, html: html, htmlPusto: htmlPusto,
    deystvie: deystvie, pervoe: pervoe, sobrat: sobrat, vstavka: vstavka, sdelatSchet: sdelatSchet };
});
