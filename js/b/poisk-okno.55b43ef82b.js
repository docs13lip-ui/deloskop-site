/* Делоскоп · пакет «poisk-okno» — собран tests/sobrat_js.py из 2 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/poisk.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.DlkPoisk = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = ' ';
var PRIMER_INN = '2309085638';
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
function kluchOk(bik, acc) {
var s = bik.slice(-3) + acc, w = [7, 1, 3], sum = 0;
for (var i = 0; i < 23; i++) sum += (+s[i]) * w[i % 3] % 10;
return sum % 10 === 0;
}
var TIP = { '40702': 'счёт коммерческой организации', '40802': 'счёт ИП', '40817': 'счёт физического лица',
'40703': 'счёт некоммерческой организации', '40701': 'счёт финансовой организации' };
var VAL = { '810': 'рубли', '840': 'доллары США', '978': 'евро', '156': 'юани' };
var EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
function vRus(s) { var o = ''; for (var i = 0; i < s.length; i++) { var c = s[i].toLowerCase(), j = EN.indexOf(c); o += j >= 0 ? RU[j] : s[i]; } return o; }
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').trim(); }
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
function razobrat(raw, razdely) {
var t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
var R = { vid: '', chip: '', hint: '', err: false, exact: false, rows: [], nazvanie: '' };
if (!t) return R;
var d = cif(t), bukv = /[a-zа-яё]/i.test(t.replace(/инн|кпп|огрнип|огрн|бик|р\/с|к\/с|сч[её]т|№/gi, ''));
function row(g, title, sub, o) { o = o || {}; R.rows.push({ g: g, t: title, s: sub, inn: o.inn || '', href: o.href || '', tag: o.tag || '' }); }
function otchet(inn) { row('Действие', inn.length === 10 ? 'Проверить компанию' : 'Проверить ИП', 'Отчёт по ИНН ' + inn + ' — статус, долги, суды, Индекс', { inn: inn }); }
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
R.vid = 'schet_bik'; R.exact = ok; R.err = !ok; R.bik = bik;
R.chip = ok ? 'Счёт и БИК: ключ сходится' : 'Счёт и БИК: ключ не сходится';
R.hint = tip + ' · ' + val + (ok ? '' : '. В номере счёта или БИК опечатка' + NB + '— платёж не пройдёт');
row('Действие', 'Проверить счёт перед оплатой', (inn ? 'ИНН ' + inn + ' · ' : '') + 'счёт ' + acc.slice(0, 5) + '…' + acc.slice(-4) + ' · БИК ' + bik, { href: '/proverit-schet/' });
if (inn) otchet(inn);
row('Важно', 'Принадлежность счёта поставщику не подтверждается', 'Ни один открытый источник не связывает номер счёта с ИНН. Сверьте счёт с договором', { tag: 'правило' });
return R;
}
if (!bukv && inn && kpp) { R.vid = 'inn_kpp'; R.exact = true; R.chip = 'ИНН и КПП'; R.hint = 'ИНН ' + inn + ' · КПП ' + kpp + NB + '— контрольная цифра ИНН верна'; otchet(inn); return R; }
if (/^\d{2}(\.\d{1,2}){1,2}$/.test(t)) { R.vid = 'okved'; R.exact = true; R.chip = 'Код ОКВЭД'; R.hint = 'Вид деятельности ' + t; row('Действие', 'Рейтинг компаний', 'По регионам и отраслям', { href: '/reyting/' }); return R; }
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
if (d.length === 9 && /^04/.test(d)) { R.vid = 'bik'; R.bik = d; R.exact = true; R.chip = 'БИК банка'; R.hint = 'Добавьте номер счёта через пробел' + NB + '— сверим ключ'; row('Действие', 'Проверить счёт перед оплатой', 'Банк по БИК, ключ счёта, поставщик', { href: '/proverit-schet/' }); return R; }
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
if (inn && /инн|огрн|кпп/i.test(t)) { R.vid = 'rekvizity'; R.exact = true; R.chip = 'Реквизиты'; R.hint = 'Нашли ИНН ' + inn + (kpp ? ' и КПП ' + kpp : ''); otchet(inn); return R; }
if (/^[аa]\s?\d{1,3}\s?-\s?\d{1,7}\s?\/\s?(\d{2}|\d{4})$/i.test(t)) { R.vid = 'delo'; R.exact = true; R.chip = 'Арбитражное дело'; R.hint = 'Стороны-организации и сумма требований' + NB + '— скоро'; row('Скоро', 'Дело ' + t.toUpperCase().replace(/A/, 'А').replace(/\s/g, ''), 'Стороны-организации, сумма требований, стадия', { tag: 'скоро' }); return R; }
var mail = t.match(/^[^\s@]+@([a-z0-9а-яё\-]+\.[a-zа-яё.\-]{2,})$/i), dom = t.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9а-яё\-]+(?:\.[a-zа-яё0-9\-]+)*\.[a-zа-яё]{2,})(?:\/\S*)?$/i);
if (mail || dom) { R.vid = mail ? 'pochta' : 'sajt'; R.exact = true; R.chip = mail ? 'Почта' : 'Сайт'; R.hint = 'Поиск организации по ' + (mail ? 'почте из ЕГРЮЛ' : 'сайту') + NB + '— скоро'; row('Скоро', mail ? 'Организация по почте' : 'Организация по сайту', mail ? 'Только адрес, который указан в ЕГРЮЛ' : 'Только если организация сама указала сайт', { tag: 'скоро' }); return R; }
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
var ST = { LIQUIDATING: 'ликвидируется', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
function gorod(adr) {
var ch = String(adr || '').split(',').map(function (x) { return x.trim(); });
for (var i = 0; i < ch.length; i++) if (/^(г|город)\.?\s/i.test(ch[i])) return ch[i].replace(/^(г|город)\.?\s+/i, '');
return '';
}
var WARN = { LIQUIDATING: 1, LIQUIDATED: 1, BANKRUPT: 1 };
function kavychki(n) { n = String(n == null ? '' : n); return (n.match(/"/g) || []).length === 2 ? n.replace(/"([^"]+)"/, '«$1»') : n; }
function zakryta(it) { return it.status === 'LIQUIDATED' || !!it.god_po; }
function stroki(items, imya, gruppa) {
var a = (items || []).filter(function (it) { return it && /^\d{10}$/.test(String(it.inn || '')); });
a = a.map(function (it, i) { return [zakryta(it) ? 2 : it.filial ? 1 : 0, i, it]; })
.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; }).map(function (x) { return x[2]; });
return a.slice(0, 7).map(function (it) {
var c = [], g = it.gorod || gorod(it.address), ok = String(it.okved_tekst || '');
if (g) c.push(g);
if (it.god_s) c.push(it.god_po ? it.god_s + '–' + it.god_po : 'с ' + it.god_s);
if (ok) c.push(ok.length > 38 ? ok.slice(0, 37) + '…' : ok);
else if (/^\d{2}(\.\d{1,2}){0,2}$/.test(String(it.okved || ''))) c.push('ОКВЭД ' + it.okved);
c.push('ИНН ' + it.inn);
var n = imya ? imya(it.name) : kavychki(it.name);
return { g: gruppa || 'Компании', t: n, s: c.join(NB + '· '), inn: String(it.inn), href: '', tag: ST[it.status] || (it.filial ? 'филиал' : ''), warn: !!WARN[it.status], imya: n };
});
}
function chtoSprosit(R, q) {
if (!R) return '';
if (R.bik) return R.bik;
if (R.vid === 'okved') return String(q || '').trim();
return R.nazvanie && String(q || '').trim().length >= 3 && !/^\d+$/.test(String(q).trim()) ? R.nazvanie : '';
}
var GRUPPA = { adres: 'Компании по адресу', okved: 'Компании с этим видом деятельности' };
function data(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
function bankStroka(b) {
if (!b || !/^\d{9}$/.test(String(b.bik || '')) || !b.nazvanie) return null;
var s = 'БИК ' + b.bik + (/^\d{20}$/.test(String(b.korschet || '')) ? NB + '· к/с ' + b.korschet : '') + (data(b.data_spravochnika) ? NB + '· справочник Банка России на ' + data(b.data_spravochnika) : '');
var tag = b.licenziya_deystvuet === true ? '' : b.licenziya_deystvuet === false ? 'проверьте лицензию' : 'лицензию не проверяли';
return { g: 'Банк по БИК', t: String(b.nazvanie), s: s, inn: '', href: '', tag: tag, warn: b.licenziya_deystvuet === false };
}
function otvet(R, j, imya, q) {
j = j || {};
var po = j.ponyal || {}, out = [];
if (po.ispravleno && R && R.vid !== 'raskladka')
out.push({ g: 'Раскладка', t: 'Ищем «' + po.ispravleno + '»', s: 'Вы печатали в английской раскладке' + NB + '— исправили сами', inn: '', href: '', tag: 'исправлено' });
var b = bankStroka(j.bank);
if (b) out.push(b);
var spisok = j.kompanii || j.items || [], k = stroki(spisok, imya, GRUPPA[po.tip]);
out = out.concat(k);
var slova = norm(q).split(/\s+/).filter(Boolean), imena = {};
spisok.forEach(function (it) { if (it && it.name) { var n = norm(it.name).replace(/^(ооо|ао|пао|зао|оао)\s+/, ''); imena[n] = (imena[n] || 0) + 1; } });
var max = 0; for (var n in imena) if (imena[n] > max) max = imena[n];
if (k.length >= 5 && max >= 5 && slova.length === 1 && (!po.tip || po.tip === 'nazvanie'))
out.push({ g: k.length ? k[0].g : 'Компании', t: 'Много компаний с таким названием', s: 'Допишите город через пробел' + NB + '— найдём точнее', inn: '', href: '', tag: '', q: String(q).trim() + ' ', dopisat: true });
return out;
}
function zapros(api, q, f) {
var u = encodeURIComponent(q), nazv = !/^\d/.test(q);
function zapas() {
if (!nazv) return { kompanii: [] };
return f(api + '/api/suggest?q=' + u).then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (j) { return { kompanii: (j && j.items) || [] }; });
}
return f(api + '/api/poisk?q=' + u).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
.then(function (j) { if (!j || typeof j !== 'object') throw 0; return j; }).catch(zapas);
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function deystvie(r) { return !!(r && (r.inn || r.href || r.q)); }
function sobrat(R, kompanii) {
var a = (R && R.rows) || [];
var k = kompanii || [];
var est = k.some(function (r) { return r.inn; });
return a.filter(function (r) { return !r.razdel && !(r.q && est); }).concat(k, a.filter(function (r) { return r.razdel; }));
}
function pervoe(rows) { for (var i = 0; i < rows.length; i++) if (deystvie(rows[i])) return i; return -1; }
function html(R, rows, sel) {
var h = '';
if (R && R.chip) h += '<li class="ps-seen' + (R.err ? ' ps-seen--err' : '') + '" role="presentation"><span class="ps-chip"><i></i>' + esc(R.chip) + '</span> <span>' + esc(R.hint) + '</span></li>';
var g = '';
rows.forEach(function (r, i) {
if (r.g !== g) { g = r.g; h += '<li class="ps-gh" role="presentation">' + esc(g) + '</li>'; }
var on = i === sel;
h += '<li role="option" id="ps' + i + '" data-i="' + i + '" class="ps-row' + (deystvie(r) ? '' : ' ps-row--info') + '" aria-selected="' + on + '"' + (deystvie(r) ? '' : ' aria-disabled="true"') + '>' +
'<b>' + esc(r.t) + '</b><span>' + esc(r.s) + '</span>' +
(r.tag ? '<em class="ps-tag' + (r.warn ? ' ps-tag--warn' : '') + (r.tag.length > 13 ? ' ps-tag--niz' : '') + '">' + esc(r.tag) + '</em>' : on && deystvie(r) ? '<em class="ps-tag ps-tag--ent">Enter ↵</em>' : '') + '</li>';
});
return h;
}
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
function vstavka(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300); }
return { PRIMER_INN: PRIMER_INN, PRIMERY: PRIMERY, cif: cif, innOk: innOk, ogrnOk: ogrnOk, kluchOk: kluchOk, vRus: vRus, norm: norm,
ischiRazdely: ischiRazdely, razobrat: razobrat, stroki: stroki, chtoSprosit: chtoSprosit, otvet: otvet, zapros: zapros, bankStroka: bankStroka, gorod: gorod, html: html, htmlPusto: htmlPusto,
deystvie: deystvie, pervoe: pervoe, sobrat: sobrat, vstavka: vstavka, sdelatSchet: sdelatSchet };
});
;
/* --- /js/poisk-okno.js --- */
(function () {
'use strict';
var P = window.DlkPoisk;
if (!P || window.DlkPoiskOkno) return;
var API = /(^|\.)deloskop\.ru$/.test(location.hostname) ? 'https://api.deloskop.ru' : '';
var CSS = '' +
'dialog.pso{position:fixed;inset:0;margin:0;width:100vw;max-width:100vw;height:100vh;height:100dvh;max-height:100dvh;padding:0;border:0;border-radius:0;overflow:hidden;display:block;color:var(--ink,#1D1D1F);font-family:var(--font,system-ui,sans-serif);' +
'background:radial-gradient(60% 46% at 50% 18%,rgba(91,155,255,.20),transparent 70%),radial-gradient(40% 34% at 14% 78%,rgba(91,155,255,.10),transparent 70%),radial-gradient(38% 32% at 88% 70%,rgba(22,114,63,.08),transparent 70%),var(--bg,#F5F5F2)}' +
'dialog.pso:not([open]){display:none}' +
'dialog.pso::backdrop{background:var(--bg,#F5F5F2)}' +
'.pso__gl{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;transition:opacity .6s ease}' +
'.pso--gl .pso__gl{opacity:1}' +
'.pso__sc{position:relative;z-index:1;height:100%;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;padding:clamp(16px,5vh,56px) 16px 24px;box-sizing:border-box}' +
'.pso__zn{flex:none;position:relative;display:flex;align-items:center;justify-content:space-between;width:min(560px,100%);height:clamp(120px,24vh,240px);pointer-events:none}' +
'.pso__zn::before,.pso__zn::after{content:"";position:absolute;top:50%;left:50%;height:46%;aspect-ratio:1;border-radius:50%;border:max(4px,.5vh) solid var(--ink,#1D1D1F);transform:translate(-80%,-50%)}' +
'.pso__zn::after{border-color:var(--accent,#0B63E5);transform:translate(-20%,-50%)}' +
'.pso--gl .pso__zn::before,.pso--gl .pso__zn::after{visibility:hidden}' +
'.pso__m{flex:none;width:clamp(72px,20vw,120px);aspect-ratio:1}' +
'.pso__h{flex:none;margin:4px 0 20px;font:700 clamp(28px,4.2vw,46px)/1.08 var(--font-display,var(--font,system-ui));letter-spacing:-.02em;text-align:center;text-wrap:balance}' +
'.pso__ryad{flex:none;position:relative;width:min(760px,100%)}' +
'.pso__b{position:absolute;top:50%;width:clamp(160px,17vw,250px);aspect-ratio:1;transform:translateY(-50%);pointer-events:none}' +
'.pso__b--lu{right:calc(100% + 3.5vw)}.pso__b--sh{left:calc(100% + 3.5vw)}' +
'.pso__f{display:flex;align-items:center;gap:12px;margin:0;padding:10px 10px 10px 22px;border-radius:28px;border:1px solid var(--line,#E6E6E1);background:var(--card,#fff);box-shadow:0 18px 60px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.35)}' +
'.pso__f:focus-within{border-color:var(--accent,#0B63E5);box-shadow:0 18px 60px rgba(0,0,0,.16),0 0 0 4px rgba(91,155,255,.22),inset 0 1px 0 rgba(255,255,255,.35)}' +
'.pso__f svg{flex:none;color:var(--ink-2,#55555A)}' +
'.pso__i{flex:1;min-width:0;border:0;outline:0;background:none;color:inherit;font:500 20px/1.3 var(--font,system-ui);padding:12px 0}' +
'.pso__i::placeholder{color:var(--muted,#86868B)}' +
'.pso__x{flex:none;border:1px solid var(--line,#E6E6E1);background:none;color:var(--ink-2,#55555A);border-radius:10px;padding:6px 10px;font:500 12px/1 var(--font,system-ui);cursor:pointer;min-height:36px}' +
'.pso__x:hover{color:var(--ink,#1D1D1F);border-color:var(--ink-2,#55555A)}' +
'.pso__x:focus-visible,.pso .ps-ex button:focus-visible{outline:3px solid var(--accent,#0B63E5);outline-offset:2px}' +
'.pso .sugg{position:static;flex:0 1 auto;width:min(760px,100%);box-sizing:border-box;margin:12px 0 0;padding:6px;list-style:none;overflow:visible;max-height:none;border-radius:28px;border:1px solid var(--line,#E6E6E1);background:var(--card,#fff);box-shadow:0 18px 60px rgba(0,0,0,.12)}' +
'.pso .sugg:empty{display:none}' +
'@supports ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))){.pso--gl .pso__f,.pso--gl .sugg{background:color-mix(in srgb,var(--card,#fff) 74%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.35);backdrop-filter:blur(22px) saturate(1.35)}}' +
'.pso .sugg li{padding:10px 14px;border-radius:16px;cursor:pointer;display:flex;flex-direction:column;gap:2px}' +
'.pso .sugg li[aria-selected="true"],.pso .sugg li.ps-row:hover{background:var(--bg,#F5F5F2)}' +
'.pso .sugg b{font-weight:600;font-size:17px;color:var(--ink,#1D1D1F)}.pso .sugg span{font-size:13px;color:var(--ink-2,#55555A)}' +
'.pso .sugg li.ps-row{position:relative;padding-right:84px}.pso .sugg li.ps-row--info{cursor:default}.pso .sugg li.ps-row--info b{font-weight:500}' +
'.pso .sugg li.ps-seen{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 8px;cursor:default;padding:8px 12px 6px;font-size:13px;color:var(--ink-2,#55555A)}' +
'.pso .ps-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-weight:600;font-size:13px;background:var(--accent-soft,#EAF1FD);color:var(--accent,#0B63E5)}' +
'.pso .ps-chip i{width:7px;height:7px;border-radius:50%;background:currentColor}' +
'.pso .ps-seen--err .ps-chip{background:var(--warn-bg,#FFF4E0);color:var(--warn,#9A5B00)}' +
'.pso .sugg li.ps-gh{cursor:default;padding:10px 12px 2px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#66666B)}' +
'.pso .ps-tag{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-style:normal;font-size:12px;color:var(--muted,#66666B);border:1px solid var(--line,#E6E6E1);border-radius:999px;padding:2px 8px;white-space:nowrap}' +
'.pso .ps-tag--ent{color:var(--ink,#1D1D1F);border-color:var(--accent,#0B63E5)}' +
'.pso .ps-tag--warn{color:var(--warn,#9A5B00);border-color:currentColor}.pso .ps-tag--niz{position:static;transform:none;align-self:flex-start;margin-top:4px}' +
'.pso .sugg li.ps-ex{flex-direction:row;flex-wrap:wrap;gap:8px;cursor:default;padding:6px 12px 10px}' +
'.pso .ps-ex button{border:1px solid var(--line,#E6E6E1);background:transparent;color:var(--ink-2,#55555A);border-radius:999px;padding:7px 13px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}' +
'.pso .ps-ex button:hover{color:var(--ink,#1D1D1F);border-color:var(--accent,#0B63E5)}' +
'.pso__n{flex:none;margin:14px 0 0;padding:0 8px;font-size:12px;color:var(--muted,#66666B);text-align:center}' +
'.pso__n kbd{font:inherit;border:1px solid var(--line,#E6E6E1);border-radius:6px;padding:1px 6px;margin-right:4px}' +
'@media (min-width:1180px){.pso__m{display:none}.pso__zn{justify-content:center}}' +
'@media (max-width:1179px){.pso__b{display:none}}' +
'@media (max-width:640px){.pso__sc{padding:calc(10px + env(safe-area-inset-top)) 12px 16px}.pso__zn{height:104px}.pso__h{margin:0 0 14px}.pso__f{gap:10px;padding:6px 6px 6px 14px;border-radius:16px}.pso__i{font-size:17px}.pso__n{display:none}' +
'.pso__x{font-size:0;width:40px;min-height:40px;padding:0;border-color:transparent}.pso__x::before{content:"\\00D7";font-size:24px;line-height:1}' +
'.pso .sugg{border-radius:16px}.pso .sugg li{border-radius:10px}.pso .sugg li.ps-row{padding-right:12px}.pso .ps-tag--ent{display:none}.pso .ps-tag{position:static;transform:none;align-self:flex-start;margin-top:4px}}' +
'@media (max-height:560px){.pso__zn{height:76px}.pso__h{font-size:24px;margin-bottom:10px}}' +
'@media (prefers-reduced-motion:no-preference){dialog.pso[open] .pso__h,dialog.pso[open] .pso__ryad,dialog.pso[open] .sugg{animation:pso-v .32s cubic-bezier(.2,.7,.2,1) both}dialog.pso[open] .pso__ryad{animation-delay:.05s}dialog.pso[open] .sugg{animation-delay:.1s}@keyframes pso-v{from{opacity:0;transform:translateY(10px)}}}' +
'@media (prefers-reduced-motion:reduce){.pso__gl{transition:none}}';
var dlg, form, input, list, sc, SC = null, scZhdet = false, SOST = { focus: 0, exact: false, err: false }, rows = [], items = [], sel = -1, PR = null, razdely = null, pustoe = false, tmr = 0, lastQ = '', tipByl = '', kto = null;
function goal(c, p) { if (window.dlkGoal) try { window.dlkGoal(c, p); } catch (e) {} }
function nedavnie() { try { return window.Nedavnie ? window.Nedavnie.list() : JSON.parse(localStorage.getItem('dlk_nedavnie') || '[]'); } catch (e) { return []; } }
function razd() {
if (razdely) return;
razdely = [];
fetch('/data/poisk-razdely.json').then(function (r) { return r.ok ? r.json() : {}; })
.then(function (j) { razdely = j.razdely || []; if (input.value.trim()) risovat(); }).catch(function () {});
}
function otmetit() {
[].forEach.call(list.querySelectorAll('[role=option]'), function (li) {
var on = +li.dataset.i === sel;
li.setAttribute('aria-selected', on);
var t = li.querySelector('.ps-tag--ent');
if (t && !on) t.remove();
if (on) {
input.setAttribute('aria-activedescendant', li.id);
if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
if (!pustoe && !li.querySelector('.ps-tag') && P.deystvie(rows[sel])) { var e = document.createElement('em'); e.className = 'ps-tag ps-tag--ent'; e.textContent = 'Enter ↵'; li.appendChild(e); }
}
});
if (sel < 0) input.removeAttribute('aria-activedescendant');
}
function risovat() {
var q = input.value;
if (!q.trim()) {
PR = null; pustoe = true; SOST.focus = 0; SOST.exact = false; SOST.err = false;
var nd = nedavnie().filter(function (x) { return x && /^\d{10}$/.test(x.inn); }).slice(0, 3);
rows = nd.map(function (x) { return { inn: x.inn, imya: x.name || x.inn, t: x.name, s: '' }; });
items = rows; sel = -1; list.innerHTML = P.htmlPusto(nd); otmetit(); return;
}
pustoe = false;
PR = P.razobrat(q, razdely || []);
SOST.exact = !!PR.exact; SOST.err = !!PR.err; SOST.focus = PR.exact ? 1 : .6;
rows = P.sobrat(PR, items); sel = P.pervoe(rows);
list.innerHTML = P.html(PR, rows, sel); otmetit();
if (PR.vid && PR.vid !== tipByl && PR.exact) { tipByl = PR.vid; goal('poisk_tip', { vid: PR.vid, mesto: 'okno' }); }
}
function kuda(r) {
if (!r) return '';
if (r.inn) return '/?inn=' + encodeURIComponent(r.inn);
if (r.q) return '/?inn=' + encodeURIComponent(r.q) + '#poisk';
if (r.href && /^\/(?!\/)/.test(r.href)) return r.href;
return '';
}
function vidVybora(r) { return r.inn ? (r.imya ? 'kompaniya' : 'inn') : r.q ? 'nazvanie' : r.razdel ? 'razdel' : 'instrument'; }
function vybrat(i, sposob) {
var r = rows[i];
if (r && r.dopisat) { goal('poisk_vybor', { vid: 'dopisat', mesto: 'okno', sposob: sposob, nomer: i }); input.value = r.q; input.focus(); input.dispatchEvent(new Event('input')); return true; }
var u = kuda(r);
if (!u) return false;
goal('poisk_vybor', { vid: pustoe ? 'nedavnie' : vidVybora(r), mesto: 'okno', sposob: sposob, nomer: i });
zakryt(true);
location.href = u;
return true;
}
function podskazki() {
clearTimeout(tmr);
var q = input.value.trim(), qs = P.chtoSprosit ? P.chtoSprosit(PR, q) : '';
items = [];
if (!API || !qs) return;
tmr = setTimeout(function () {
lastQ = q;
P.zapros(API, qs, fetch.bind(window))
.then(function (j) {
if (lastQ !== input.value.trim() || !dlg.open) return;
items = P.otvet(PR, j, window.DlkImya ? window.DlkImya.kavychki : null, q);
rows = P.sobrat(PR, items); sel = P.pervoe(rows); list.innerHTML = P.html(PR, rows, sel); otmetit();
}).catch(function () {});
}, 250);
}
function stroit() {
var st = document.createElement('style');
st.textContent = CSS;
document.head.appendChild(st);
dlg = document.createElement('dialog');
dlg.className = 'pso';
dlg.setAttribute('aria-label', 'Поиск по Делоскопу');
dlg.innerHTML =
'<canvas class="pso__gl" aria-hidden="true"></canvas>' +
'<div class="pso__sc">' +
'<div class="pso__zn" aria-hidden="true"><i class="pso__m pso__m--lu"></i><i class="pso__m pso__m--sh"></i></div>' +
'<p class="pso__h" id="pso-h">Что проверяем?</p>' +
'<div class="pso__ryad"><i class="pso__b pso__b--lu" aria-hidden="true"></i>' +
'<form class="pso__f" role="search" method="dialog">' +
'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>' +
'<input class="pso__i" type="text" name="q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" maxlength="300"' +
' placeholder="ИНН, название, счёт или вопрос" aria-label="ИНН, название, счёт или вопрос" role="combobox" aria-controls="pso-l" aria-autocomplete="list" aria-expanded="true">' +
'<button class="pso__x" type="button" aria-label="Закрыть поиск">Esc</button></form>' +
'<i class="pso__b pso__b--sh" aria-hidden="true"></i></div>' +
'<ul class="sugg" id="pso-l" role="listbox" aria-label="Что нашлось"></ul>' +
'<p class="pso__n"><kbd>Enter</kbd>первое действие · <kbd>↑</kbd><kbd>↓</kbd>выбрать · <kbd>Esc</kbd>закрыть</p>' +
'</div>';
document.body.appendChild(dlg);
form = dlg.querySelector('form'); input = dlg.querySelector('input'); list = dlg.querySelector('ul'); sc = dlg.querySelector('.pso__sc');
dlg.querySelector('.pso__x').addEventListener('click', function () { zakryt(); });
dlg.addEventListener('close', function () { clearTimeout(tmr); if (SC) SC.vkl(false); if (kto && kto.focus) try { kto.focus(); } catch (e) {} });
dlg.addEventListener('mousedown', function (e) { if (e.target === dlg || e.target === sc) zakryt(); });
form.addEventListener('submit', function (e) { e.preventDefault(); if (sel >= 0) vybrat(sel, 'enter'); });
list.addEventListener('mousedown', function (e) {
var b = e.target.closest('button[data-q]');
if (b) { e.preventDefault(); input.value = b.getAttribute('data-q'); input.dispatchEvent(new Event('input')); input.focus(); return; }
var li = e.target.closest('[role=option]');
if (li) { e.preventDefault(); vybrat(+li.dataset.i, 'klik'); }
});
input.addEventListener('paste', function (e) {
var cd = e.clipboardData, s = cd && cd.getData('text');
if (!s || !/[\r\n\t]/.test(s)) return;
e.preventDefault(); input.value = P.vstavka(input.value + ' ' + s); input.dispatchEvent(new Event('input'));
});
input.addEventListener('input', function () { razd(); items = []; risovat(); podskazki(); });
input.addEventListener('keydown', function (e) {
if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
if (!rows.length) return;
e.preventDefault();
var n = rows.length, k = 0;
do { sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; k++; } while (k < n && !pustoe && !P.deystvie(rows[sel]));
otmetit();
} else if (e.key === 'Enter') {
e.preventDefault();
if (sel >= 0) vybrat(sel, 'enter');
}
});
}
function scena() {
if (SC) { SC.vkl(true); return; }
if (scZhdet || !window.WebGLRenderingContext) return;
var kn = document.querySelector('[data-scena-src]'), src = kn && kn.getAttribute('data-scena-src');
if (!src || !/^\/js\/b\/scena\.[0-9a-f]+\.js$/.test(src)) return;
scZhdet = true;
var s = document.createElement('script');
s.src = src; s.async = true;
s.onload = function () {
if (!window.DlkScena || SC) return;
try {
SC = window.DlkScena({ cv: dlg.querySelector('.pso__gl'), mark: dlg.querySelector('.pso__zn'), box: form, pole: input,
lupa: [dlg.querySelector('.pso__b--lu'), dlg.querySelector('.pso__m--lu')], shit: [dlg.querySelector('.pso__b--sh'), dlg.querySelector('.pso__m--sh')],
sost: function () { return SOST; }, netGL: function () { dlg.classList.remove('pso--gl'); } });
if (SC.est()) { dlg.classList.add('pso--gl'); SC.vkl(dlg.open); }
} catch (e) {}
};
document.head.appendChild(s);
}
function otkryt(otkuda) {
if (!dlg) stroit();
kto = otkuda || document.activeElement;
if (dlg.open) { input.focus(); input.select(); return; }
input.value = ''; items = []; tipByl = '';
risovat();
try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
input.focus();
razd();
scena();
goal('poisk_okno');
}
function zakryt(uhod) { if (!dlg || !dlg.open) return; if (uhod) kto = null; try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }
window.DlkPoiskOkno = { otkryt: otkryt, zakryt: zakryt, kuda: kuda, vidVybora: vidVybora, zamer: function () { return SC ? SC.zamer() : ''; } };
var zhdet = window.__dlkPoiskZhdet;
window.__dlkPoiskZhdet = null;
if (typeof zhdet === 'function') zhdet();
})();
;
