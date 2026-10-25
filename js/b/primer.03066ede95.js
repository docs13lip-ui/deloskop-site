/* Делоскоп · пакет «primer» — собран tests/sobrat_js.py из 3 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/sushchestvennoe.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Sushchestvennoe = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0', MAKS = 7;
var BANK_GIRBO = 'Организация сдаёт в' + NB + 'Банк России; в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)';
function nwFz(h) { return String(h).replace(/(\d+-ФЗ\)?)/g, '<span class="nw">$1</span>'); }
var VES = { bad: 0, warn: 1, ok: 2, neutral: 2 };
var PORYADOK = ['status', 'address', 'tax_debt', 'kapital', 'likvidnost', 'ubytki', 'skachok', 'otchetnost', 'rukovoditel', 'age', 'zsk', 'employees'];
var NAZV = { status: 'Статус', address: 'Отметки о недостоверности', age: 'На рынке', tax_debt: 'Долги по налогам' };
var SEKCII = { profile: 'reestr', history: 'reestr', management: 'reestr', activity: 'reestr', taxes: 'ФНС, открытые данные', dynamics: 'ГИР БО ФНС, годовая бухгалтерская отчётность' };
var KRATKO = { sudy: 'арбитражные суды', bankrotstvo: 'банкротство', fssp: 'приставы', priostanovki: 'приостановки счетов', mery: 'обеспечительные меры ФНС', rnp: 'РНП', kontrakty: 'госконтракты' };
var DAMIA_PORYADOK = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];
var POKA_NE = 'эти реестры мы пока не проверяем';
var OBESHCHANIE = /завтра|тариф|сегодн|запас|временно|позже/i;
var PLATNYJ = /[\s,;—-]*(?:или\s+)?(?:откройте|откроется)[^.;]*тариф[^.;]*/gi;
function prichinaReestra(b) {
if (!b) return '';
if (b.sostoyanie === 'not_checked' && (!b.prichina || OBESHCHANIE.test(b.prichina))) return POKA_NE;
return String(b.prichina || '').replace(PLATNYJ, '').replace(/\s+$/, '');
}
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function z(n) { return (n < 10 ? '0' : '') + n; }
function dmy(s) {
if (!s) return '';
if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s;
var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
if (m) return m[3] + '.' + m[2] + '.' + m[1];
var d = new Date(s);
return isNaN(d) ? '' : z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear();
}
function dataIz(s) {
var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s || '');
if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function mesyacev(ot, na) {
if (!ot || !na) return null;
var m = (na.getFullYear() - ot.getFullYear()) * 12 + na.getMonth() - ot.getMonth();
if (na.getDate() < ot.getDate()) m--;
return m < 0 ? null : m;
}
function skl(n, a, b, c) {
var k = n % 100, d = n % 10;
return k > 10 && k < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c;
}
function srok(m) {
if (m < 1) return 'меньше месяца';
if (m < 12) return m + NB + skl(m, 'месяц', 'месяца', 'месяцев');
var g = Math.floor(m / 12);
return g + NB + skl(g, 'год', 'года', 'лет');
}
function chislo(v, zn) { return v.toFixed(zn).replace('.', ','); }
function dengi(v) {
if (v == null || !isFinite(v)) return '—';
var a = Math.abs(v), s = v < 0 ? '−' : '';
if (a >= 1e12) return s + chislo(a / 1e12, 1) + NB + 'трлн' + NB + '₽';
if (a >= 1e9) return s + chislo(a / 1e9, 1) + NB + 'млрд' + NB + '₽';
if (a >= 1e6) return s + chislo(a / 1e6, 1) + NB + 'млн' + NB + '₽';
if (a >= 1e3) return s + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
return s + Math.round(a) + NB + '₽';
}
function ton(st) { return st === 'bad' ? 'bad' : st === 'warn' ? 'warn' : st === 'ok' ? 'ok' : 'neutral'; }
function poslednij(arr) {
var a = (Array.isArray(arr) ? arr : []).filter(function (x) { return x && isFinite(parseInt(x.year, 10)) && x.value !== null && x.value !== '' && isFinite(Number(x.value)); });
a.sort(function (p, q) { return p.year - q.year; });
return a.length ? { year: +a[a.length - 1].year, value: Number(a[a.length - 1].value) } : null;
}
var CBR_BANK = 'https://www.cbr.ru/finorg/foinfo/';
var SPRAVKA_STATUSY = '/nalogi/kody-statusa-egryul/';
var SPRAVKA_GIRBO = '/nalogi/net-otchetnosti-v-otkrytyh-dannyh/';
function bank(c) { return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || '')); }
function ip(r) { return String(((r || {}).company || {}).inn || '').length === 12; }
function otchetnost(r) {
var D = (r && r.dossier) || {}, ch = D.charts || {}, kpi = Array.isArray(D.kpi) ? D.kpi : [];
var v = poslednij(ch.revenue), p = null;
if (!v) kpi.forEach(function (k) {
var m = /^Выручка за (\d{4})$/.exec((k && k.label) || '');
if (m && k.value != null && isFinite(k.value)) v = { year: +m[1], value: Number(k.value) };
});
if (!v) return null;
(Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) { if (x && +x.year === v.year && x.value != null && isFinite(Number(x.value))) p = Number(x.value); });
if (p === null) kpi.forEach(function (k) {
if (k && k.label === 'Чистая прибыль за ' + v.year && k.value != null && isFinite(k.value)) p = Number(k.value);
});
return { god: v.year, vyruchka: v.value, pribyl: p };
}
function poslGodOtchetnosti(r) {
var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null;
function vz(y) { y = parseInt(y, 10); if (isFinite(y) && y > 1990 && y < 2200 && (g === null || y > g)) g = y; }
['revenue', 'profit', 'income_tax'].forEach(function (k) {
(Array.isArray(ch[k]) ? ch[k] : []).forEach(function (x) { if (x && x.value != null && x.value !== '' && isFinite(Number(x.value))) vz(x.year); });
});
['balance', 'debts'].forEach(function (k) { if (ch[k] && typeof ch[k] === 'object' && !Array.isArray(ch[k])) vz(ch[k].year); });
(Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
var m = /за (\d{4})$/.exec((k && k.label) || '');
if (m && k.value != null && isFinite(Number(k.value))) vz(m[1]);
});
return g;
}
function godProverki(r, segodnya) {
var t = Date.parse((r && r.checked_at) || '');
var ms = isFinite(t) ? t : (segodnya || new Date()).getTime();
return new Date(ms + 3 * 3600 * 1000).getUTCFullYear();
}
function staraya(r, segodnya) {
var g = poslGodOtchetnosti(r);
if (g === null || g >= godProverki(r, segodnya) - 2) return null;
return { god: g, tekst: 'Последняя открытая отчётность — за' + NB + g + NB + 'год. Более свежей в' + NB + 'открытых данных ГИР' + NB + 'БО нет — запросите отчётность у' + NB + 'компании.' };
}
function godBezVyruchki(r) {
var D = (r && r.dossier) || {}, ch = D.charts || {}, g = null;
function vzyat(y) { y = parseInt(y, 10); if (isFinite(y) && y > 1990 && (g === null || y > g)) g = y; }
if (ch.balance && typeof ch.balance === 'object') vzyat(ch.balance.year);
(Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) {
if (x && x.value != null && x.value !== '' && isFinite(Number(x.value)) && Number(x.value) !== 0) vzyat(x.year);
});
(Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
var m = /^Чистая прибыль за (\d{4})$/.exec((k && k.label) || '');
if (m && k.value != null && isFinite(k.value) && Number(k.value) !== 0) vzyat(m[1]);
});
if (g === null) return null;
var p = null;
(Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) { if (x && +x.year === g && x.value != null && isFinite(Number(x.value))) p = Number(x.value); });
if (p === null) (Array.isArray(D.kpi) ? D.kpi : []).forEach(function (k) {
if (k && k.label === 'Чистая прибыль за ' + g && k.value != null && isFinite(k.value)) p = Number(k.value);
});
return { god: g, pribyl: p };
}
function otchetGod(r) { var b = godBezVyruchki(r); return b ? b.god : null; }
function kapital(r) {
var b = r && r.dossier && r.dossier.charts && r.dossier.charts.balance;
if (!b || typeof b !== 'object') return null;
var g = parseInt(b.year, 10), e = b.equity;
if (!isFinite(g) || e === null || e === '' || typeof e === 'boolean' || !isFinite(Number(e))) return null;
return { god: g, znach: Number(e) };
}
function likvidnost(r) {
var D = (r && r.dossier) || {}, ch = D.charts || {}, v = null;
(Array.isArray(D.sections) ? D.sections : []).forEach(function (s) {
if (!s || s.id !== 'dynamics' || !Array.isArray(s.rows)) return;
s.rows.forEach(function (row) {
if (!Array.isArray(row) || !/^Текущая ликвидность$/i.test(String(row[0] || '').trim())) return;
var m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
if (m) v = Number(m[1].replace(',', '.'));
});
});
var g = parseInt(((ch.balance || {}).year) || ((ch.debts || {}).year), 10);
if (v === null || !isFinite(v) || !isFinite(g)) return null;
return { god: g, znach: v };
}
function ubytki(r) {
var ch = (r && r.dossier && r.dossier.charts) || {}, po = {};
(Array.isArray(ch.profit) ? ch.profit : []).forEach(function (x) {
var g = x ? parseInt(x.year, 10) : NaN;
if (isFinite(g) && x.value !== null && x.value !== '' && typeof x.value !== 'boolean' && isFinite(Number(x.value))) po[g] = Number(x.value);
});
var gody = Object.keys(po).map(Number).sort(function (a, b) { return a - b; });
if (!gody.length) return null;
var g1 = gody[gody.length - 1], n = 0;
while (po.hasOwnProperty(g1 - n) && po[g1 - n] < 0) n++;
return n >= 2 ? { god: g1, n: n, ot: g1 - n + 1 } : null;
}
function modDinamika(opt) {
if (opt && opt.Dinamika) return opt.Dinamika;
if (typeof self !== 'undefined' && self.Dinamika) return self.Dinamika;
if (typeof module === 'object' && module.exports && typeof require === 'function') { try { return require('./dinamika.js'); } catch (e) { return null; } }
return null;
}
function skachokVniz(r, opt) {
var D = modDinamika(opt), s = D && typeof D.skachok === 'function' ? D.skachok(r) : null;
if (!s) return null;
var vniz = (s.fakty || []).filter(function (f) { return f && f.kRaz <= 0.5; });
if (!vniz.length) return null;
var god = vniz.reduce(function (g, f) { return f.god > g ? f.god : g; }, 0);
return { god: god || null, tekst: vniz.map(function (f) { return f.tekst; }).join(' ') };
}
function godySerii(u) { return u.n === 2 ? u.ot + ' и ' + u.god : u.ot + '–' + u.god; }
function razryady(t) {
return String(t == null ? '' : t).replace(/(^|[^\d,.\u2116])(\d{5,})(?=[ \u00a0]?₽)/g, function (_, a, d) {
return a + d.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
});
}
function fakty(r, opt) {
opt = opt || {};
if (!r || !r.company) return { spisok: [], eshche: [], neProvereno: [] };
var c = r.company, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ';
var t = Date.parse(r.checked_at || ''), msk = new Date((isFinite(t) ? t : (opt.segodnya || new Date()).getTime()) + 3 * 3600 * 1000);
var na = new Date(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
var dataPr = z(msk.getUTCDate()) + '.' + z(msk.getUTCMonth() + 1) + '.' + msk.getUTCFullYear();
var vse = [], est = {};
function add(f) { if (f && !est[f.k]) { est[f.k] = 1; vse.push(f); } }
(r.signals || []).forEach(function (s, i) {
if (!s || !s.title) return;
var k = s.id || ('sig' + i), znach = razryady(s.detail || '');
var ist = s.source ? String(s.source).replace('ЕГРЮЛ/ЕГРИП', reestr) : reestr;
if (k === 'age' && c.reg_date) {
var m = mesyacev(dataIz(c.reg_date), na);
if (m != null) znach = srok(m) + ' · с' + NB + dmy(c.reg_date);
}
if (k === 'address' && fl) return;
if (k === 'address' && s.status === 'ok' && /^Отметок о недостоверности нет$/.test(znach)) znach = 'Нет';
var tn = ton(s.status);
if (k === 'tax_debt' && s.status === 'ok' && /^нет$/i.test(String(znach).trim())) {
var dn = dataIz(dmy(s.as_of)), mn = dn ? mesyacev(dn, na) : null;
if (!dn) { znach = 'Не проверяли — нет даты набора ФНС'; tn = 'neutral'; }
else if (mn > 3 || (mn === 3 && na.getDate() > dn.getDate())) { znach = 'Не проверяли — набор ФНС на' + NB + dmy(s.as_of) + ' старше 3' + NB + 'месяцев'; tn = 'neutral'; }
else znach = 'Нет в списке ФНС на' + NB + dmy(s.as_of);
}
var f = { k: k, nazv: NAZV[k] || s.title, znach: znach, ton: tn, ist: ist, data: dmy(s.as_of) || dataPr };
if (k === 'status' && !fl) {
var kd = String(c.state_code == null ? '' : c.state_code).trim();
if (/^\d{3}$/.test(kd)) { f.spravka = SPRAVKA_STATUSY + '#k' + kd; f.spravkaT = 'что значит код' + NB + kd; }
else if (s.status && s.status !== 'ok') { f.spravka = SPRAVKA_STATUSY; f.spravkaT = 'что значат коды статуса'; }
}
add(f);
});
var o = otchetnost(r), st = fl ? null : staraya(r, opt.segodnya);
function starayaFakt(f, s) {
if (!s) return f;
f.nazv += ' · последняя открытая'; f.ton = 'warn'; f.pod = s.tekst.replace(/^.*?год\. /, '');
f.spravka = SPRAVKA_GIRBO; f.spravkaT = 'почему так бывает'; f.spravkaCel = 'girbo_pochemu';
return f;
}
if (!fl) {
if (o) {
var pr = o.pribyl == null ? '' : o.pribyl < 0 ? ' · убыток ' + dengi(-o.pribyl) : ' · прибыль ' + dengi(o.pribyl);
add(starayaFakt({ k: 'otchetnost', nazv: 'Выручка за ' + o.god, znach: dengi(o.vyruchka) + pr, ton: 'neutral', ist: 'ГИР БО ФНС', data: '31.12.' + o.god }, st));
} else if (bank(c)) {
add({ k: 'otchetnost', nazv: 'Бухотчётность', znach: BANK_GIRBO, ton: 'neutral',
ist: reestr + ', ОКВЭД ' + c.okved, data: dataPr, ssylka: CBR_BANK + (/^\d{13}$/.test(String(c.ogrn || '')) ? '?ogrn=' + c.ogrn : '') });
} else if (godBezVyruchki(r)) {
var bv = godBezVyruchki(r);
var pv = bv.pribyl == null || bv.pribyl === 0 ? '' : bv.pribyl < 0 ? ' · убыток ' + dengi(-bv.pribyl) : ' · прибыль ' + dengi(bv.pribyl);
add(starayaFakt({ k: 'otchetnost', nazv: 'Выручка за ' + bv.god, znach: 'В' + NB + 'отчёте не' + NB + 'указана' + pv, ton: 'neutral',
ist: 'ГИР БО ФНС', data: '31.12.' + bv.god }, st));
} else {
add({ k: 'otchetnost', nazv: 'Бухотчётность', znach: 'Нет в ответе ГИР БО', ton: 'neutral', ist: 'ГИР БО ФНС', data: dataPr,
spravka: SPRAVKA_GIRBO, spravkaT: 'почему так бывает', spravkaCel: 'girbo_pochemu' });
}
var kp = kapital(r);
if (kp && kp.znach < 0) add({ k: 'kapital', nazv: 'Собственный капитал на' + NB + '31.12.' + kp.god, ton: 'warn',
znach: 'Минус ' + dengi(-kp.znach) + ': обязательства больше активов', ist: 'ГИР БО ФНС, баланс', data: '31.12.' + kp.god });
var lk = likvidnost(r);
if (lk && lk.znach > 0 && lk.znach < 1) add({ k: 'likvidnost', nazv: 'Текущая ликвидность', ton: 'warn',
znach: chislo(lk.znach, 2) + ': краткосрочные долги больше оборотных средств', ist: 'ГИР БО ФНС, баланс', data: '31.12.' + lk.god });
var ub = ubytki(r);
if (ub) add({ k: 'ubytki', nazv: 'Убыток ' + ub.n + NB + skl(ub.n, 'год', 'года', 'лет') + ' подряд', ton: 'warn',
znach: 'По годовой отчётности за ' + godySerii(ub), ist: 'ГИР БО ФНС, отчёт о финансовых результатах', data: '31.12.' + ub.god });
var sk = skachokVniz(r, opt);
if (sk) add({ k: 'skachok', nazv: 'Скачок в' + NB + 'отчётности', ton: 'warn', znach: sk.tekst,
pod: 'Перед авансом спросите компанию, что изменилось.', ist: 'ГИР БО ФНС', data: sk.god ? '31.12.' + sk.god : dataPr });
var estRuk = (r.signals || []).some(function (s) { return s && /director|rukovod/i.test(s.id || ''); });
var ot = dataIz(c.director_since);
if (!estRuk && ot) {
var mr = mesyacev(ot, na);
if (mr != null) add({ k: 'rukovoditel', nazv: c.director_org ? 'Управляющая организация' : 'Руководитель', ton: mr < 6 ? 'warn' : 'ok',
znach: (c.director_org ? (mr < 12 ? 'Сменилась ' + srok(mr) + ' назад' : 'Не менялась ' + srok(mr))
: (mr < 12 ? 'Сменился ' + srok(mr) + ' назад' : 'Не менялся ' + srok(mr))) + ' · с' + NB + dmy(c.director_since),
ist: 'ЕГРЮЛ', data: dataPr });
}
}
if (r.zsk && r.zsk.title) {
var zl = r.zsk.level;
add({ k: 'zsk', nazv: 'Прогноз ЗСК · наша оценка, не статус Банка России', znach: r.zsk.title,
ton: zl === 'high' ? 'bad' : zl === 'medium' ? 'warn' : 'ok', ist: 'Делоскоп по открытым данным', data: dataPr, ssylka: r.zsk.cbr_url || '' });
}
vse.sort(function (a, b) {
var d = VES[a.ton] - VES[b.ton];
if (d) return d;
var nz = a.ton === 'bad' || a.ton === 'warn' ? -1 : PORYADOK.length;
var pa = PORYADOK.indexOf(a.k), pb = PORYADOK.indexOf(b.k);
return (pa < 0 ? nz : pa) - (pb < 0 ? nz : pb);
});
var ne = [];
var dm = r.damia || {};
DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
var b = dm[k];
if (!b || typeof b !== 'object' || !b.nazvanie || !b.status) return;
if (b.status === 'found' && b.dubl_statusa && (r.company || {}).status === 'BANKRUPT') {
} else if (b.status === 'found') {
add({ k: 'damia_' + k, nazv: b.nazvanie, znach: bezDaty(b.itog, b.data_svedeniy) || b.znachenie || 'Сведения найдены',
ton: b.uroven === 'bad' || b.uroven === 'high' ? 'bad' : 'warn', ist: b.istochnik || '', data: dmy(b.data_svedeniy) || dataPr });
var f = vse.pop();
var i = 0; while (i < vse.length && VES[vse[i].ton] <= VES[f.ton]) i++;
vse.splice(i, 0, f);
} else if (b.status !== 'not_found' && b.status !== 'not_applicable') {
ne.push({ k: k, nazv: b.nazvanie, kratko: KRATKO[k] || b.nazvanie, prichina: prichinaReestra(b), sam: b.proverit_samim || '', nep: b.sostoyanie === 'not_checked' });
}
});
return { spisok: vse.slice(0, MAKS), eshche: vse.slice(MAKS), neProvereno: ne, dataPr: dataPr };
}
var LICHNOE = /адрес|паспорт|рожден|снилс|телефон|почт/i;
function glubina(r, f) {
f = f || fakty(r);
var D = (r && r.dossier) || {}, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ', out = [];
if (f.eshche.length) out.push({ zag: 'Ещё признаки', ist: 'по ответу проверки на ' + f.dataPr,
stroki: f.eshche.map(function (x) { return [x.nazv, x.znach, x.ton]; }) });
(Array.isArray(D.sections) ? D.sections : []).forEach(function (s) {
if (!s || !s.title || !Array.isArray(s.rows)) return;
var ist = SEKCII[s.id] === 'reestr' ? reestr + ', на ' + f.dataPr : (SEKCII[s.id] || '');
var st = [];
s.rows.forEach(function (row) {
if (!Array.isArray(row) || row.length < 2) return;
var k = String(row[0]), v = String(row[1] == null ? '' : row[1]);
if (k === 'Источник') { ist = v; return; }
if (fl && (LICHNOE.test(k) || s.id === 'management')) return;
if (v) st.push([k, v]);
});
if (st.length) out.push({ zag: s.title, ist: ist, stroki: st });
});
var dm = r && r.damia || {}, reestry = [];
DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
var b = dm[k];
if (!b || typeof b !== 'object' || !b.nazvanie || !b.status) return;
var v, t = 'neutral';
if (b.status === 'found') { v = b.itog || b.znachenie || 'Сведения найдены'; t = b.uroven === 'bad' || b.uroven === 'high' ? 'bad' : 'warn'; }
else if (b.status === 'not_found') { v = (b.itog || 'Сведений не найдено') + (b.data_svedeniy ? ' · на ' + dmy(b.data_svedeniy) : ''); t = 'ok'; }
else if (b.status === 'not_applicable') v = b.prichina || 'Не применяется к этой компании';
else if (b.sostoyanie === 'not_checked') v = 'Не проверяли: ' + prichinaReestra(b);
else v = 'Не ответили в' + NB + 'этот раз' + (prichinaReestra(b) ? ': ' + prichinaReestra(b) : '');
var nePoInn = b.tochnost && b.tochnost !== 'inn';
if (nePoInn && (b.status === 'found' || b.status === 'not_found')) v += ' · сопоставили по' + NB + 'названию и' + NB + 'адресу';
reestry.push([b.nazvanie, v, t, (b.status !== 'found' && b.status !== 'not_found') || b.iz_egryul || nePoInn ? (b.proverit_samim || '') : '', b.istochnik || '']);
});
if (reestry.length) out.push({ zag: 'Внешние реестры', ist: 'источник — у каждой строки', stroki: reestry });
var z = r && r.zsk;
if (z && Array.isArray(z.groups) && z.groups.length) {
out.push({ zag: 'Из чего сложился прогноз ЗСК', ist: 'Делоскоп по открытым данным; не статус Банка России',
stroki: z.groups.filter(function (g) { return g && g.typology; }).map(function (g) {
return [g.typology, (Array.isArray(g.items) ? g.items : []).join('; ')];
}) });
}
return { razdely: out, daty: D.data_dates ? String(D.data_dates) : '' };
}
function samiT(url) {
var I = typeof self !== 'undefined' && self.DlkIstochniki;
try { return I && I.samiTekst ? I.samiTekst(url) : 'проверьте сами'; } catch (e) { return 'проверьте сами'; }
}
function bezDaty(t, iso) {
if (!t) return t;
var d = dmy(iso);
if (!d) return t;
var x = String(t).replace(new RegExp('\\s*Сведения на\\s+' + d.replace(/\./g, '\\.') + '(?:,\\s*\\d{1,2}:\\d{2})?\\.?\\s*$'), '');
return x || t;
}
function rowHtml(x) {
var meta = [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ');
return '<div class="row sut__r" data-fakt="' + esc(x.k) + '"><span>' + esc(x.nazv) +
'<small>' + esc(meta) + (x.ssylka ? ' · <a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">проверить в' + NB + 'ЦБ</a>' : '') +
(x.spravka ? ' · <a href="' + esc(x.spravka) + '" data-goal="' + esc(x.spravkaCel || 'statusy_iz_proverki') + '">' + esc(x.spravkaT) + '</a>' : '') + '</small>' +
(x.pod ? '<small class="sut__pod">' + esc(x.pod) + '</small>' : '') + '</span>' +
'<b class="d ' + x.ton + '">' + nwFz(esc(x.znach)) + '</b></div>';
}
function glubinaHtml(g, podpis, dop) {
if (!g.razdely.length) return '';
var n = g.razdely.length;
return '<details class="sut__g"><summary><span>Все данные из реестров</span><small>' + (podpis || n + NB + skl(n, 'раздел', 'раздела', 'разделов')) + '</small></summary>' + (dop || '') +
g.razdely.map(function (s) {
return '<section class="sut__s"><h4>' + esc(s.zag) + '</h4><dl>' + s.stroki.map(function (row) {
var dop = row[4] ? '<small>' + esc(row[4]) + '</small>' : '';
var sam = row[3] ? ' <a href="' + esc(row[3]) + '" target="_blank" rel="noopener">' + esc(samiT(row[3])) + '</a>' : '';
return '<div><dt>' + esc(row[0]) + dop + '</dt><dd' + (row[2] && row[2] !== 'neutral' ? ' class="' + row[2] + '"' : '') + '>' + esc(row[1]) + sam + '</dd></div>';
}).join('') + '</dl>' + (s.ist ? '<p>Источник: ' + esc(s.ist) + '</p>' : '') + '</section>';
}).join('') +
(g.daty ? '<p class="sut__d">Даты наборов: ' + esc(g.daty) + '</p>' : '') + '</details>';
}
function neStroka(spisok, sPrichinoj, razdel, uzhe) {
var bylo = spisok.length;
if (uzhe && uzhe.length) spisok = spisok.filter(function (x) { return uzhe.indexOf(x.k) < 0; });
if (!spisok.length) return '';
function chast(xs) {
var pr = xs.map(function (x) { return x.prichina; });
var odna = sPrichinoj && pr[0] && pr.every(function (x) { return x === pr[0]; }) ? ' — ' + pr[0] : '';
return esc(xs.map(function (x) { return x.kratko; }).join(', ') + odna);
}
var poka = spisok.filter(function (x) { return x.nep; }), net = spisok.filter(function (x) { return !x.nep; });
var t = !net.length ? 'Не проверяли: ' + chast(poka) + '.'
: !poka.length ? 'Не ответили в' + NB + 'этот раз: ' + chast(net) + '.'
: 'Пока не проверяем: ' + chast(poka) + '. Не ответили в' + NB + 'этот раз: ' + chast(net) + '.';
if (spisok.length < bylo) t = 'Кроме того, ' + t.charAt(0).toLowerCase() + t.slice(1);
return '<p class="sut__ne">' + t + ' Не проверено — не значит «не обнаружено»; ссылки, где проверить самим, — в разделе «' + razdel + '».</p>';
}
function html(r, opt) {
var f = fakty(r);
if (!f.spisok.length) return '';
var ne = neStroka(f.neProvereno, true, 'Все данные из реестров', opt && opt.uzhe);
return '<div class="sut__h"><b>Существенные факты</b><span>' + (f.eshche.length ? 'ещё ' + f.eshche.length + ' — в' + NB + 'разделе «Все данные из реестров»' : 'у каждого — источник и дата') + '</span></div>' +
f.spisok.map(rowHtml).join('') + ne + glubinaHtml(glubina(r, f));
}
function htmlSvoj(r) {
var f = fakty(r);
var vse = f.spisok.concat(f.eshche);
if (!vse.length) return '';
var g = glubina(r, f);
var prizn = { zag: 'Признаки из проверки', ist: '',
stroki: vse.map(function (x) {
return [x.nazv, x.znach, x.ton, x.ssylka || '', [x.ist, x.data ? 'на' + NB + x.data : ''].filter(Boolean).join(' · ')];
}) };
var razdely = [prizn].concat(g.razdely.filter(function (s) { return s.zag !== 'Ещё признаки'; }));
var n = vse.length, m = razdely.length;
var ne = neStroka(f.neProvereno, false, 'Внешние реестры');
return glubinaHtml({ razdely: razdely, daty: g.daty },
n + NB + skl(n, 'признак', 'признака', 'признаков') + ' · ' + m + NB + skl(m, 'раздел', 'раздела', 'разделов'), ne);
}
var CSS = '.sut__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;padding-bottom:10px}' +
'.sut__h b{font-size:15px;font-weight:600}.sut__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
'.sut__r>span{display:block}.sut__r small{display:block;margin-top:2px;font-size:12px;color:var(--muted,#6B6B70);font-weight:400}' +
'.sut__r small a{color:inherit;text-decoration:underline}.sut__r small.sut__pod{color:var(--warn,#8A5A00)}' +
'.sut__ne{margin:0;padding:12px 0 0;border-top:1px solid #EFEFEA;font-size:13px;color:var(--ink2,#48484C)}' +
'.sut__g{margin-top:12px;border:1px solid var(--line,#E6E6E1);border-radius:16px;padding:0 16px}' +
'.sut__g summary{cursor:pointer;display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 0;font-size:15px;font-weight:600;list-style:none}' +
'.sut__g summary::-webkit-details-marker{display:none}' +
'.sut__g summary span::after{content:"";display:inline-block;width:7px;height:7px;margin-left:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-3px) rotate(45deg);transition:transform .2s}' +
'.sut__g[open] summary span::after{transform:translateY(0) rotate(225deg)}' +
'.sut__g summary small{font-size:13px;font-weight:400;color:var(--muted,#6B6B70)}' +
'.sut__s{padding:4px 0 14px;border-top:1px solid #EFEFEA}.sut__s h4{margin:12px 0 6px;font-size:15px;font-weight:600}' +
'.sut__s dl{margin:0;display:grid}.sut__s dl div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:12px;padding:6px 0;font-size:15px}' +
'.sut__s dt{color:var(--ink2,#48484C);display:grid}.sut__s dt small{font-size:12px;color:var(--muted,#6B6B70)}.sut__s dd{margin:0;overflow-wrap:anywhere}' +
'.sut__s dd.ok{color:var(--ok,#16723F)}.sut__s dd.warn{color:var(--warn,#8A5A00)}.sut__s dd.bad{color:#B3261E}' +
'.sut--svoj .sut__g{margin-top:0}.sut--svoj .sut__ne{border-top:1px solid #EFEFEA;padding:12px 0}' +
'.sut__s p,.sut__d{margin:6px 0 0;font-size:12px;color:var(--muted,#6B6B70)}.sut__d{padding-bottom:14px}' +
'@media (max-width:520px){.sut__s dl div{grid-template-columns:1fr;gap:2px}.sut__r{flex-direction:column;gap:4px}.sut__r b.d{text-align:left;max-width:none}}' +
'@media print{.sut__g{border:0}.sut__g:not([open])>*:not(summary){display:block}}';
function stil(doc) {
if (!doc || doc.getElementById('sut-css')) return;
var s = doc.createElement('style'); s.id = 'sut-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function mount(el, r, opt) {
if (!el) return false;
var h = '';
try { h = html(r, opt); } catch (e) { h = ''; }
if (!h) return false;
try { stil(el.ownerDocument || document); } catch (e) {}
el.innerHTML = h;
el.classList.add('sut');
try {
var g = el.querySelector('.sut__g'), din = el.parentNode && el.parentNode.querySelector('.din');
if (g && din) din.parentNode.insertBefore(g, din.nextSibling);
} catch (e) {}
return true;
}
function mountSvoj(el, r, posle) {
if (!el) return false;
var h = '';
try { h = htmlSvoj(r); } catch (e) { h = ''; }
if (!h) return false;
try { stil(el.ownerDocument || document); } catch (e) {}
el.innerHTML = h;
el.classList.add('sut', 'sut--svoj');
try {
if (posle && posle.parentNode) {
var par = el.parentNode, izm = par && par.querySelector(':scope > .izm'), din = par && par.querySelector('.din');
posle.parentNode.insertBefore(el, posle.nextSibling);
if (izm) posle.parentNode.insertBefore(izm, el);
if (din) posle.parentNode.insertBefore(din, el);
}
} catch (e) {}
return true;
}
return { prichinaReestra: prichinaReestra, POKA_NE: POKA_NE, razryady: razryady, fakty: fakty, godBezVyruchki: godBezVyruchki, otchetGod: otchetGod, bank: bank, kapital: kapital, likvidnost: likvidnost, ubytki: ubytki, skachokVniz: skachokVniz, glubina: glubina, otchetnost: otchetnost, poslGodOtchetnosti: poslGodOtchetnosti, staraya: staraya, html: html, mount: mount, htmlSvoj: htmlSvoj, mountSvoj: mountSvoj, dengi: dengi, srok: srok, MAKS: MAKS, CSS: CSS };
});
;
/* --- /js/status-kod.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.StatusKod = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = ' ';
var LIKV = { '101': 1, '102': 1 };
var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
var OBSHCHEE = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из' + NB + 'ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
var FRAZA = { LIQUIDATING: 'компания ликвидируется или ФНС готовит её исключение из' + NB + 'ЕГРЮЛ', LIQUIDATED: 'компания ликвидирована', BANKRUPT: 'идёт банкротство', REORGANIZING: 'идёт реорганизация' };
function kod(v) { var k = String(v == null ? '' : v).trim(); return /^\d{3}$/.test(k) ? k : ''; }
function vid(st, k) {
k = kod(k);
if (ISKLYUCHENA[k]) return 'isklyuchena';
if (st === 'LIQUIDATING' && ISKL[k]) return 'isklyuchenie';
if (st === 'LIQUIDATING' && LIKV[k]) return 'likvidaciya';
return '';
}
var REORG_FORMA = {
'121': 'преобразование', '122': 'слияние', '123': 'разделение', '124': 'присоединение к' + NB + 'другому юрлицу',
'125': 'разделение одновременно с' + NB + 'присоединением', '129': 'сочетание нескольких форм, после которого компания прекратит деятельность',
'131': 'выделение', '132': 'присоединение к' + NB + 'ней других юрлиц', '133': 'присоединение одновременно с' + NB + 'разделением',
'134': 'присоединение одновременно с' + NB + 'выделением', '136': 'выделение одновременно с' + NB + 'присоединением',
'139': 'сочетание нескольких форм, после которого компания продолжит деятельность'
};
function reorgForma(st, k) { k = kod(k); return st === 'REORGANIZING' && REORG_FORMA[k] ? REORG_FORMA[k] : ''; }
var KREDITORU = {
likvidaciya: { tekst: "Компания ликвидируется — после записи о ликвидации банк закроет счёт. Новые сделки — нет; по текущим — заявите требование ликвидатору в срок.", norma: "ст. 61–64 ГК РФ" },
isklyuchenie: { tekst: "Новых авансов не платите. Если компания вам должна — возражение в налоговую нужно подать в течение 3 месяцев со дня публикации в «Вестнике государственной регистрации», по коду 108 — 6 месяцев. Дату публикации проверьте на vestnik-gosreg.ru.", norma: "ст. 21.1 и 21.3 129-ФЗ" },
isklyuchena: { tekst: "Компания исключена из ЕГРЮЛ. Последствия — как при ликвидации (п. 2 ст. 64.2 ГК РФ): договор с ней не заключайте и не платите. Оспорить исключение в суде — в течение года (п. 8 ст. 22 129-ФЗ). Долг ООО можно требовать с директора или участников, если не оплачен по их вине (п. 3.1 ст. 3 14-ФЗ).", norma: "п. 2–3 ст. 64.2 ГК РФ; п. 3.1 ст. 3 14-ФЗ" }
};
function kreditoru(st, k) { var v = vid(st, k); return v && KREDITORU[v] ? { vid: v, tekst: KREDITORU[v].tekst, norma: KREDITORU[v].norma } : null; }
function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
function nazv(st, k, o) {
var v = vid(st, k);
var t = v === 'isklyuchena' ? 'исключена из' + NB + 'ЕГРЮЛ' : v === 'isklyuchenie' ? 'готовится исключение из' + NB + 'ЕГРЮЛ' : v === 'likvidaciya' ? 'ликвидируется' : (OBSHCHEE[st] || st || '');
return o && o.zaglavnaya ? cap(t) : t;
}
function fraza(st, k, o) {
var v = vid(st, k);
var t = v === 'isklyuchena' ? 'компания исключена из' + NB + 'ЕГРЮЛ' : v === 'isklyuchenie' ? 'ФНС готовит исключение компании из' + NB + 'ЕГРЮЛ' : v === 'likvidaciya' ? 'компания ликвидируется' : (FRAZA[st] || '');
return o && o.zaglavnaya ? cap(t) : t;
}
function izOtveta(c, o) { c = c || {}; return c.status ? nazv(c.status, c.state_code, o) : ''; }
return { nazv: nazv, fraza: fraza, izOtveta: izOtveta, vid: vid, kod: kod, reorgForma: reorgForma, REORG_FORMA: REORG_FORMA, kreditoru: kreditoru, KREDITORU: KREDITORU, LIKV: LIKV, ISKL: ISKL, ISKLYUCHENA: ISKLYUCHENA };
});
;
/* --- /js/usloviya.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Usloviya = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var VAT = 0.22;
var PROFIT = 0.25;
var USN_DR = 0.15;
var FINE_SOFT = 0.20;
var FINE_HARD = 0.40;
var REGIMES = [
{ id: 'osno', name: 'ОСН с НДС' },
{ id: 'usn_dr', name: 'УСН «доходы минус расходы»' },
{ id: 'usn_d', name: 'УСН «доходы», ПСН, НПД' }
];
function nbsp(s) { return String(s).replace(/ /g, ' '); }
function money(x) {
var n = Math.round(Math.max(0, x || 0));
return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
}
function moneyKrupno(x) {
var n = Math.max(0, x || 0);
if (n < 1e9) return money(n);
var ed = n >= 1e12 ? [1e12, 'трлн'] : [1e9, 'млрд'], v = n / ed[0], zn = v < 10 ? 2 : 1;
var t = v.toFixed(zn).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
return t + '\u00a0' + ed[1] + '\u00a0₽';
}
function niceFloor(x) {
if (!(x > 0)) return 0;
var step = x < 100000 ? 10000 : x < 1000000 ? 50000 : x < 10000000 ? 100000 : 1000000;
return Math.floor(x / step) * step;
}
function plural(n, one, few, many) {
var a = Math.abs(n) % 100, b = a % 10;
if (a > 10 && a < 20) return many;
if (b > 1 && b < 5) return few;
if (b === 1) return one;
return many;
}
function monthsBetween(from, to) {
var a = new Date(from), b = to ? new Date(to) : new Date();
if (isNaN(a)) return null;
var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
if (b.getDate() < a.getDate()) m -= 1;
return Math.max(0, m);
}
function ageText(m) {
if (m == null) return '';
if (m < 12) return m + ' ' + plural(m, 'месяц', 'месяца', 'месяцев');
var y = Math.floor(m / 12);
return y + ' ' + plural(y, 'год', 'года', 'лет');
}
function parseAmount(s) {
if (typeof s === 'number') return s > 0 ? s : 0;
var t = String(s || '').toLowerCase().replace(/\s| /g, '').replace(',', '.');
var k = 1;
if (/млн|m$/.test(t)) k = 1e6; else if (/тыс|к$|k$/.test(t)) k = 1e3;
var n = parseFloat(t.replace(/[^\d.]/g, ''));
return isFinite(n) && n > 0 ? Math.round(n * k) : 0;
}
var KINDS = [
['exit', /ликвидац|ликвидир|банкрот|реорганиз|прекращ/i],
['diskv', /дисквалиф/i],
['nedost', /недостоверн/i],
['block', /приостановл|блокировк[аи]? (операц|сч)|решени[ея] о приостан/i],
['mass', /массов/i],
['fssp', /пристав|исполнительн|фссп/i],
['rnp', /недобросовестн.*поставщ|\bрнп\b/i],
['dolg', /задолженн|недоимк|долг/i],
['director', /руководител|директор/i],
['staff', /численност|сотрудник|штат/i],
['report', /отч[её]тност|не сда/i],
['nagruzka', /нагрузк|налоги.*уплач|уплачен.*налог/i],
['fines', /правонаруш|штраф/i],
['young', /молод|зарегистрир|возраст/i]
];
function kindOf(title) {
for (var i = 0; i < KINDS.length; i++) if (KINDS[i][1].test(title || '')) return KINDS[i][0];
return 'other';
}
function num(v) { var n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d.,-]/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
function facts(r) {
r = r || {};
var c = r.company || {}, D = r.dossier || {};
var f = {
name: c.name_short || c.name_full || (c.inn ? 'ИНН ' + c.inn : 'компания'),
inn: c.inn || '', status: c.status || 'ACTIVE', kind: c.kind || (String(c.inn || '').length === 12 ? 'INDIVIDUAL' : 'LEGAL'),
ageMonths: c.reg_date ? monthsBetween(c.reg_date, r.checked_at) : null,
level: r.risk_level || 'low', zsk: r.zsk && r.zsk.level || null,
revenue: null, staff: null, bad: {}, warn: {}, list: []
};
if (c.state_code != null && String(c.state_code).trim()) f.kod = String(c.state_code).trim();
if (f.kind === 'LEGAL' && /^64\.1(\.|\d|$)/.test(String(c.okved || ''))) { f.kredit = true; f.okved = String(c.okved); if (/^\d{13}$/.test(String(c.ogrn || ''))) f.ogrn = String(c.ogrn); }
if (f.kind === 'LEGAL' && (f.kredit || /^65\.[12](\.|\d|$)/.test(String(c.okved || '')))) { f.finorg = true; f.okved = String(c.okved); if (/^\d{13}$/.test(String(c.ogrn || ''))) f.ogrn = String(c.ogrn); }
(r.signals || []).forEach(function (s) {
if (s.status !== 'bad' && s.status !== 'warn') {
if (/численност|сотрудник/i.test(s.title || '')) { var z = num(s.detail); if (z != null) f.staff = z; }
return;
}
var k = kindOf(s.title);
f[s.status][k] = (f[s.status][k] || 0) + 1;
f.list.push({ kind: k, status: s.status, title: s.title || '', detail: s.detail || '' });
if (k === 'staff') { var n = num(s.detail); if (n != null) f.staff = n; }
});
(D.kpi || []).forEach(function (x) {
if (/выручк/i.test(x.label || '') && typeof x.value === 'number' && x.value > 0) { f.revenue = x.value; var y = /(20\d\d)/.exec((x.label || '') + ' ' + (x.year || x.god || '')); if (y) f.revenueYear = y[1]; }
if (/сотрудник|численност|штат/i.test(x.label || '') && typeof x.value === 'number') f.staff = x.value;
});
if (f.ageMonths != null && f.ageMonths < 12) f.warn.young = (f.warn.young || 0) + 1;
var SU = modulSushch(), god = null, o = null;
try { god = SU && SU.otchetGod ? SU.otchetGod(r) : null; o = SU && SU.otchetnost ? SU.otchetnost(r) : null; } catch (e) { god = null; }
if (god != null) {
f.otchetGod = String(god);
f.vyruchkaNol = !(f.revenue > 0) && !(o && o.vyruchka > 0);
}
return f;
}
function modulSushch() {
if (typeof Sushchestvennoe !== 'undefined') return Sushchestvennoe;
if (typeof module === 'object' && typeof require === 'function') { try { return require('./sushchestvennoe.js'); } catch (e) {} }
return null;
}
var REORG_PREKRASHCHENIE = ['122', '123', '124', '125', '129'];
function reorgPrekr(f) { return !!f && f.status === 'REORGANIZING' && f.kod != null && REORG_PREKRASHCHENIE.indexOf(String(f.kod)) >= 0; }
var REORG_PR = 'компания реорганизуется и прекратит существование, правопреемника мы не проверяли';
var REORG_SDELAT = 'Узнайте, кто правопреемник, и проверьте его по ИНН: договоры и долги перейдут к нему.';
var REORG_DOLG = 'Если долг перед вами возник до первой публикации о реорганизации, в течение 30 дней после последней публикации можно через суд потребовать досрочного исполнения (п. 2 ст. 60 ГК РФ). Права нет, если обеспечение уже достаточное; суд учтёт, ухудшилось ли положение должника.';
function tone(f) {
var b = f.bad, w = f.warn;
if (f.status === 'LIQUIDATED') return 'stop';
if (f.status === 'BANKRUPT' || f.status === 'LIQUIDATING') return 'stop';
if (b.diskv || b.nedost || b.block || b.exit || f.zsk === 'high') return 'stop';
var heavy = (b.dolg || 0) + (b.mass || 0) + (b.fssp || 0) + (b.rnp || 0) + (b.other || 0) + (b.director || 0) + (b.staff || 0) + (b.report || 0);
var warns = 0; for (var k in w) warns += w[k];
if (reorgPrekr(f)) return 'post';
if (heavy || f.level === 'high' || warns >= 3) return 'post';
if (warns || f.level === 'medium' || f.zsk === 'medium' || f.status === 'REORGANIZING') return 'cap';
return 'go';
}
var OSTOROZHNO = false;
var DELITEL = 26;
var MINIMUM = 10000;
var POTOLKI = [[6, 100000], [12, 300000], [36, 1000000], [Infinity, 3000000]];
function potolok(m) { if (m == null) return 1000000; for (var i = 0; i < POTOLKI.length; i++) if (m < POTOLKI[i][0]) return POTOLKI[i][1]; return 3000000; }
function prepayCap(f, t, np) {
if (t === 'post' || t === 'stop') return { cap: 0, rule: t === 'stop' ? 'Вперёд не платить' : 'Оплата только по факту', raschet: { tone: t } };
if (f.finorg) return { cap: null, finorg: true, rule: 'предел не считаем — банк или страховая организация', raschet: { tone: t, base: 'finorg' } };
var byAge = potolok(f.ageMonths);
var cap, rule, R = { tone: t, byAge: byAge, ageMonths: f.ageMonths, revenue: f.revenue || null, revenueYear: f.revenueYear || null };
if (f.vyruchkaNol) {
R.base = 'nol'; R.otchetGod = f.otchetGod || null; R.malo = true; R.itog = 0;
return { cap: 0, malo: true, rule: 'отчёт сдан, выручки в нём нет — две недели нулевой выручки: 0 ₽, советуем платить по факту', raschet: R };
}
if (f.revenue) {
cap = f.revenue / DELITEL; rule = 'не больше двух недель выручки компании'; R.base = 'revenue'; R.dveNedeli = cap;
if (f.ageMonths != null && f.ageMonths < 12 && byAge < cap) { cap = byAge; rule = 'потолок для компании младше года'; R.ageCapped = true; }
} else { cap = byAge; R.base = f.ageMonths == null ? 'unknown' : 'age'; rule = f.ageMonths == null ? 'осторожный потолок — выручка и возраст неизвестны' : 'потолок по возрасту компании (выручка неизвестна)'; }
R.doPolovinu = cap;
var ostor = OSTOROZHNO && np && np.dolgiVse && t === 'go';
if (t === 'cap' || ostor) { cap = cap / 2; rule += ostor ? ', вдвое меньше: долги не проверены' : ', вдвое меньше из-за замечаний'; R.half = ostor ? 'ostorozhno' : 'zamechaniya'; }
if (cap < MINIMUM) { R.malo = true; R.itog = 0; return { cap: 0, malo: true, rule: rule + ' — меньше ' + money(MINIMUM) + ': советуем платить по факту', raschet: R }; }
R.itog = niceFloor(cap);
return { cap: R.itog, rule: rule, raschet: R };
}
var DOLGI = [
{ id: 'fssp', kind: 'fssp', title: 'долги у приставов', klyuchi: ['fssp'] },
{ id: 'nalogi', kind: 'dolg', title: 'долги по налогам', klyuchi: ['nalogi', 'fns_debt', 'nedoimki', 'dolgi_nalogi'] }
];
function statusIstochnika(r, klyuchi) {
var dm = r && r.damia || {}, spisok = r && r.istochniki || [];
for (var i = 0; i < klyuchi.length; i++) {
var b = dm[klyuchi[i]]; if (b && b.status) return b.status;
for (var j = 0; j < spisok.length; j++) if (spisok[j] && (spisok[j].kod === klyuchi[i] || spisok[j].id === klyuchi[i]) && spisok[j].status) return spisok[j].status;
}
return null;
}
var SVEZHEST_MES = 3;
function dataIzStroki(v) {
var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v || '');
if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
function dvaZnaka(n) { return (n < 10 ? '0' : '') + n; }
function nalogovyjNabor(r) {
var sig = (r && r.signals || []).filter(function (s) {
return s && (s.id === 'tax_debt' || (!s.id && /задолженн\S*\s+по\s+налог/i.test(s.title || '')));
})[0];
if (!sig || ['ok', 'warn', 'bad'].indexOf(sig.status) < 0) return null;
var d = dataIzStroki(sig.as_of);
if (!d) return { status: sig.status, data: null, svezhij: false };
var t = Date.parse(r.checked_at || ''), na = isFinite(t) ? new Date(t) : new Date();
var granica = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + SVEZHEST_MES, d.getUTCDate()));
return { status: sig.status, data: dvaZnaka(d.getUTCDate()) + '.' + dvaZnaka(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(), svezhij: na.getTime() < granica.getTime() + 24 * 3600 * 1000 };
}
function neProvereno(r, f) {
var net = [], nn = nalogovyjNabor(r), nalogiNa = null;
DOLGI.forEach(function (d) {
if (f.bad[d.kind] || f.warn[d.kind]) return;
var s = statusIstochnika(r, d.klyuchi);
if (s === 'found' || s === 'not_found' || s === 'not_applicable') return;
if (d.id === 'nalogi' && nn) {
if (nn.svezhij) { if (nn.status === 'ok') nalogiNa = nn.data; return; }
net.push(d.title + (nn.data ? ' (набор ФНС на\u00a0' + nn.data + ' старше ' + SVEZHEST_MES + '\u00a0месяцев)' : ''));
return;
}
net.push(d.title);
});
var p = r && r.damia && r.damia.polnota;
var bl = [];
if (r && r.damia) for (var k in r.damia) if (Object.prototype.hasOwnProperty.call(r.damia, k) && r.damia[k] && typeof r.damia[k] === 'object' && r.damia[k].nazvanie) bl.push(r.damia[k]);
if (bl.length && bl.every(function (b) { return b.sostoyanie === 'not_checked'; })) p = null;
return { spisok: net, dolgiVse: net.length === DOLGI.length, nalogiNa: nalogiNa, provereno: p && p.provereno != null ? p.provereno : null, iz: p && p.iz != null ? p.iz : null, data: r && (r.damia && r.damia.data_svedeniy || r.checked_at) || null };
}
function dataRu(s) { var t = String(s == null ? '' : s).trim(); if (/^\d{2}\.\d{2}\.\d{4}$/.test(t)) return t; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t); if (m) return m[3] + '.' + m[2] + '.' + m[1]; var d = new Date(s); if (isNaN(d)) return ''; function z(n) { return (n < 10 ? '0' : '') + n; } return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear(); }
function mesText(m) { return m < 12 ? m + '\u00a0мес.' : ageText(m); }
var CBR_FOINFO = 'https://www.cbr.ru/finorg/foinfo/';
function bankSsylka(f) { return { t: 'Карточка организации на сайте Банка России', u: CBR_FOINFO + (f.ogrn ? '?ogrn=' + f.ogrn : '') }; }
function FINORG_TEKST(otg) {
return 'Для банков и страховых организаций предел ' + (otg ? 'отсрочки' : 'предоплаты') + ' не считаем: за их устойчивостью следит Банк России.';
}
var FINORG_SSYLKA = 'Лицензию и отчётность — на сайте Банка России';
function kakPoschitali(f, t, pc, reasonsList, np, napr, pv) {
var R = pc.raschet || {}, kak = '', otg = napr === 'otgruzhaem', bankR = false;
if (t === 'post' || t === 'stop') {
var pr = f.status === 'LIQUIDATED' ? 'компания ликвидирована' : reorgPrekr(f) ? REORG_PR : (reasonsList[0] || (t === 'stop' ? 'стоп-признак в данных' : 'серьёзное замечание в данных'));
kak = otg ? 'В долг — 0\u00a0₽: ' + pr + ' — ' + (f.status === 'LIQUIDATED' ? 'сделку не заключать.' : 'отгружайте после оплаты.')
: 'Вперёд — 0\u00a0₽: ' + pr + ' — ' + (t === 'stop' ? 'не платите вперёд.' : 'платите после поставки или акта.');
} else {
var polovina = R.half ? ' · ' + (R.half === 'ostorozhno' ? 'долги не проверены' : zamechaniya(reasonsList)) + ' → половина: ' + money(R.itog) : '';
if (R.base === 'finorg') {
kak = FINORG_TEKST(otg); bankR = true;
} else if (R.base === 'nol') {
kak = 'Как посчитали: отчёт' + (R.otchetGod ? ' за ' + R.otchetGod : '') + ' в ГИР БО есть, но выручки в нём нет. Две недели нулевой выручки — 0 ₽, поэтому советуем ' + (otg ? 'отгружать после оплаты.' : 'платить по факту поставки.');
} else if (R.malo) {
kak = 'Как посчитали: выручка' + (R.revenueYear ? ' за ' + R.revenueYear : '') + ' — ' + moneyKrupno(R.revenue) + ' ÷ ' + DELITEL + ' = ' + money(R.dveNedeli) + (R.half ? ', половина — ' + money(R.doPolovinu / 2) : '') + '. ' + (otg ? MALO_OTG(R.half) : MALO_TEKST(R.half));
} else if (R.base === 'revenue' && R.ageCapped) {
kak = 'Как посчитали: две недели выручки — ' + moneyKrupno(R.dveNedeli) + ', но компании ' + mesText(R.ageMonths) + ' — не больше потолка для возраста до года: ' + money(R.byAge) + polovina + '.';
} else if (R.base === 'revenue') {
kak = 'Как посчитали: выручка' + (R.revenueYear ? ' за ' + R.revenueYear : '') + ' — ' + moneyKrupno(R.revenue) + ' ÷ ' + DELITEL + ' = ' + moneyKrupno(R.dveNedeli) + ' (две недели выручки)' + polovina + ', округлили вниз.';
} else if (R.base === 'age') {
kak = 'Как посчитали: выручки в отчётности нет — берём потолок по возрасту (' + ageText(R.ageMonths) + '): ' + money(R.byAge) + polovina + '.';
} else {
kak = 'Как посчитали: выручка и возраст неизвестны — берём осторожный потолок ' + money(R.byAge) + polovina + '.';
}
}
var ne = '';
if (pv) {
ne = predvTekst(pv, otg) +
(np && np.nalogiNa ? ' Долги по налогам — нет в списке ФНС на\u00a0' + np.nalogiNa + '.' : '') +
(np && np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
} else if (np && np.spisok.length && (t === 'go' || t === 'cap')) {
ne = 'Не проверяли: ' + np.spisok.join(', ') + '. Если они есть — ' + (otg ? 'в долг лучше не отгружать.' : 'вперёд лучше не платить.') +
(np.nalogiNa ? ' Долги по налогам — нет в списке ФНС на\u00a0' + np.nalogiNa + '.' : '') +
(np.provereno != null && np.iz ? ' Из внешних реестров ответили ' + np.provereno + ' из ' + np.iz + (np.data ? ' на ' + dataRu(np.data) : '') + '.' : '');
}
if (otg && R.base !== 'finorg') kak = OBA_NAPRAVLENIYA + ' ' + kak;
var out = { kak: kak, ne: ne,
podpis: 'Ориентир Делоскопа, не норма закона. Методика — в разборе «Сколько платить вперёд незнакомой компании».', url: STATYA };
if (bankR) out.ssylka = R.base === 'finorg' ? { t: FINORG_SSYLKA, u: bankSsylka(f).u } : bankSsylka(f);
return out;
}
function MALO_TEKST(half) {
return 'Вперёд — не больше ' + (half ? 'половины двух недель' : 'двух недель') + ' выручки компании, а это меньше ' + money(MINIMUM) + '. Советуем платить по факту поставки.';
}
var OBA_NAPRAVLENIYA = 'Предел — сколько денег разумно держать под риском у одной компании: и предоплатой, и отгрузкой в долг. Считаем одинаково.';
function MALO_OTG(half) {
return 'В долг — не больше ' + (half ? 'половины двух недель' : 'двух недель') + ' выручки компании, а это меньше ' + money(MINIMUM) + '. Советуем отгружать после оплаты.';
}
var STATYA = '/nalogi/skolko-platit-vpered-neznakomoj-kompanii/';
var FORMULA = '/indeks/#predoplata';
function zamechaniya(list) { var n = Math.max(1, list.length); return 'есть ' + n + ' ' + plural(n, 'замечание', 'замечания', 'замечаний'); }
function reasonText(x) {
var d = String(x.detail || '').trim();
var generic = !d || /^(да|есть|внимание|нет данных|—)$/i.test(d);
var s = generic ? x.title : x.title + ': ' + d.charAt(0).toLowerCase() + d.slice(1);
return s.replace(/(\d)\s(?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d)\s(?=(₽|%|млн|млрд|тыс\.))/g, '$1\u00a0');
}
function statusKod() {
if (typeof self !== 'undefined' && self.StatusKod) return self.StatusKod;
try { return typeof require === 'function' ? require('./status-kod.js') : null; } catch (e) { return null; }
}
function reasons(f) {
var out = [];
var SK = statusKod();
if (SK && SK.vid(f.status, f.kod)) out.push(SK.fraza(f.status, f.kod));
else if (f.status === 'LIQUIDATED') out.push('компания ликвидирована');
else if (f.status === 'LIQUIDATING') out.push('компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ');
else if (f.status === 'BANKRUPT') out.push('идёт банкротство');
else if (f.status === 'REORGANIZING') out.push('идёт реорганизация');
var order = ['diskv', 'nedost', 'block', 'exit', 'dolg', 'mass', 'fssp', 'rnp', 'director', 'staff', 'report', 'nagruzka', 'fines', 'other', 'young'];
var pick = f.list.slice().sort(function (a, b) {
return (a.status === b.status ? 0 : a.status === 'bad' ? -1 : 1) || order.indexOf(a.kind) - order.indexOf(b.kind);
});
if (f.zsk === 'high') out.push('высокий прогноз попадания в красную зону ЗСК');
var vzyali = {};
pick.forEach(function (x) { if (out.length < 3 && x.kind !== 'young') { vzyali[x.kind] = 1; out.push(reasonText(x).replace(/^./, function (c) { return c.toLowerCase(); })); } });
if (f.ageMonths != null && f.ageMonths < 12 && out.length < 3) out.push('компании ' + ageText(f.ageMonths));
if ((f.staff === 0 || f.staff === 1) && !vzyali.staff) { if (out.length < 3) out.push(f.staff ? 'в штате 1 человек' : 'в штате никого'); }
if (f.zsk === 'medium' && out.length < 3) out.push('средний прогноз ЗСК');
return out.slice(0, 3);
}
function headline(f, t, cap, malo, pv) {
if (pv && t === 'go') return 'Предварительно: серьёзного не нашли';
if (pv && t === 'cap' && !malo && cap != null) return 'Предварительно: есть замечания';
if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
if (t === 'stop') return 'Не платите вперёд';
if (t === 'post' && reorgPrekr(f)) return 'Только оплата по факту\u00a0— до проверки правопреемника';
if (t === 'post') return 'Только оплата по факту';
if (t === 'cap' && malo) return 'Можно, оплата — по факту поставки';
if (t === 'cap') return 'Можно, предоплата — до ' + money(cap);
return 'Работать можно';
}
function headlineOtg(f, t, cap, malo, pv) {
if (pv && t === 'go') return 'Предварительно: серьёзного не нашли';
if (pv && t === 'cap' && !malo && cap != null) return 'Предварительно: есть замечания';
if (f.status === 'LIQUIDATED') return 'Сделку не заключать';
if (t === 'stop') return 'Отгружайте только после оплаты';
if (t === 'post' && reorgPrekr(f)) return 'Только по предоплате\u00a0— до проверки правопреемника';
if (t === 'post') return 'Только по предоплате';
if (t === 'cap' && malo) return 'Можно, но без отсрочки';
if (t === 'cap' && cap == null) return 'Можно, но есть замечания';
if (t === 'cap') return 'Можно, отсрочка — до ' + money(cap);
return 'Работать можно';
}
function adviceOtg(f, t, malo) {
if (f.status === 'LIQUIDATED') return 'Компания прекратила существование — в ЕГРЮЛ есть запись о прекращении. Новый договор с ней заключить нельзя.';
if (f.status === 'BANKRUPT') return 'Новые отгрузки — только после оплаты и по согласованию с арбитражным управляющим.';
if (f.status === 'LIQUIDATING') return 'В долг не отгружайте: новые обязательства компания может не исполнить.' + advice(f, t, malo).replace(/^[^.]*\./, '');
if (t === 'post' && reorgPrekr(f)) return 'Отсрочку не давайте: отгрузка — после оплаты. ' + REORG_SDELAT + ' ' + REORG_DOLG;
if (t === 'stop' || t === 'post') return 'Отсрочку не давайте: отгрузка — после оплаты. Если без отсрочки сделки не будет — только под банковскую гарантию платежа или аккредитив.';
if (malo) return 'Отсрочку — только под банковскую гарантию платежа или аккредитив.';
if (t === 'cap' && !f.finorg) return 'Больше предела — под банковскую гарантию или аккредитив. Держите долг покупателя в пределе: следующая отгрузка — после оплаты предыдущей.';
return 'Сохраните досье с датой проверки: если покупатель задержит оплату, оно покажет, на каких данных вы дали отсрочку.';
}
function advice(f, t, malo) {
if (f.status === 'LIQUIDATED') return 'Компания прекратила существование — в ЕГРЮЛ есть запись о прекращении. Новый договор с ней заключить нельзя, платить по такому счёту некому: счёт не оплачивайте.';
if (f.status === 'BANKRUPT') return 'Платежи по новым сделкам — только по согласованию с арбитражным управляющим и после поставки.';
if (f.status === 'LIQUIDATING') return 'Вперёд не платите: новые обязательства компания может не исполнить. Если она вам должна — не ждите: при ликвидации заявите требование ликвидатору, при исключении из ЕГРЮЛ — подайте в налоговую возражение, пока не истёк срок: три месяца со дня публикации решения в «Вестнике государственной регистрации», а если основание — 115-ФЗ, шесть (п. 3, 4, 7 ст. 21.1, ст. 21.3 129-ФЗ). Возражение, поданное в срок, останавливает исключение.';
if (t === 'stop') return 'Если сделка нужна — платите после поставки или через аккредитив и сохраните это досье.';
if (t === 'post' && reorgPrekr(f)) return 'Платите после поставки или акта. ' + REORG_SDELAT + ' ' + REORG_DOLG;
if (t === 'post') return 'Платите после поставки или акта. Нужна предоплата — через аккредитив или под гарантию возврата аванса.';
if (malo) return 'Нужна предоплата — через аккредитив или под гарантию возврата аванса.';
if (t === 'cap' && !f.finorg) return 'Больше предела — частями по этапам, аккредитивом или под гарантию возврата аванса.';
return 'Сохраните досье с датой проверки — оно может стать частью доказательств должной осмотрительности.';
}
function atStake(amount, regime) {
amount = parseAmount(amount);
if (!amount) return null;
if (regime === 'usn_d') return { soft: 0, hard: 0, zero: true };
if (regime === 'usn_dr') { var t = amount * USN_DR; return { soft: 0, hard: t * (1 + FINE_HARD) }; }
var vat = amount * VAT / (1 + VAT), profit = (amount - vat) * PROFIT;
return { soft: vat * (1 + FINE_SOFT), hard: (vat + profit) * (1 + FINE_HARD), vat: vat };
}
function prepayAdvice(amount, cap, t, pv) {
amount = parseAmount(amount);
if (!amount) return '';
if (cap == null && (t === 'go' || t === 'cap')) return '';
if (t === 'stop' || t === 'post' || cap === 0) return 'Предоплату не вносите: ' + money(amount) + ' — после поставки или через аккредитив.';
if (pv) return 'Ориентир предварительный: пока не проверите то, чего мы не видели, — платите по факту поставки. После проверки — ' +
(amount <= cap ? 'сумма укладывается в ориентир.' : 'вперёд не больше ' + money(cap) + ' (' + Math.max(1, Math.floor(cap / amount * 100)) + '% суммы).');
if (t === 'go' && amount <= cap) return 'Сумма в пределах ориентира — обычные условия подойдут.';
if (amount <= cap) return 'Сумма в пределах ориентира: предоплата допустима.';
var p = Math.max(1, Math.floor(cap / amount * 100));
return 'Вперёд — не больше ' + money(cap) + ' (' + p + '% суммы), остальное — после поставки.';
}
function otgruzkaAdvice(amount, cap, t, pv) {
amount = parseAmount(amount);
if (!amount) return '';
if (cap == null && (t === 'go' || t === 'cap')) return '';
if (t === 'stop' || t === 'post' || cap === 0) return 'В долг не отгружайте: ' + money(amount) + ' — после оплаты.';
if (pv) return 'Ориентир предварительный: пока не проверите то, чего мы не видели, — отгружайте после оплаты. После проверки — ' +
(amount <= cap ? 'сумма укладывается в ориентир.' : 'в долг не больше ' + money(cap) + ' (' + Math.max(1, Math.floor(cap / amount * 100)) + '% суммы).');
if (amount <= cap) return 'Сумма в пределах ориентира — отсрочка допустима.';
var p = Math.max(1, Math.floor(cap / amount * 100));
return 'В долг — не больше ' + money(cap) + ' (' + p + '% суммы), остальное — предоплатой.';
}
var DOCS = {
power: { links: [{ t: 'проверить электронную доверенность (ФНС)', u: 'https://m4d.nalog.gov.ru/emchd/check-status' }, { t: 'нотариальную (ФНП)', u: 'https://www.reestr-dover.ru/' }], t: 'Документ о полномочиях подписанта', why: 'решение или протокол о назначении директора либо доверенность — чтобы договор подписал тот, кто вправе', ask: 'Документ о полномочиях подписанта договора: решение о назначении директора или доверенность' },
powerNew: { links: [{ t: 'проверить электронную доверенность (ФНС)', u: 'https://m4d.nalog.gov.ru/emchd/check-status' }, { t: 'нотариальную (ФНП)', u: 'https://www.reestr-dover.ru/' }], t: 'Решение о назначении нового директора и его подпись на договоре', why: 'руководитель сменился недавно — убедитесь, что подписывает именно он, и созвонитесь с ним', ask: 'Решение (протокол) о назначении действующего директора' },
card: { links: [{ t: 'проверить счёт в Делоскопе', u: '/proverit-schet/' }], t: 'Карточка с реквизитами за подписью директора', why: 'счёт для оплаты должен совпадать с карточкой — так вы защищаетесь от подмены реквизитов', ask: 'Карточка компании с банковскими реквизитами за подписью директора' },
premises: { t: 'Документ на помещение по юридическому адресу', why: 'договор аренды или право собственности — ответ на отметку о недостоверности или «массовый» адрес', ask: 'Документ на помещение по юридическому адресу (договор аренды или выписка о праве собственности)' },
fixRecord: { t: 'Подтверждение, что запись в ЕГРЮЛ исправлена', why: 'пока отметка о недостоверности стоит, банк может задержать ваш платёж', ask: 'Подтверждение исправления сведений в ЕГРЮЛ (лист записи)' },
taxCert: { t: 'Справка об исполнении обязанности по уплате налогов (КНД 1120101)', why: 'не старше 10 дней — показывает, погашен ли долг перед бюджетом', ask: 'Справка об исполнении обязанности по уплате налогов (КНД 1120101), не старше 10 дней' },
resources: { t: 'Подтверждение ресурсов: люди, склад, техника', why: 'штат, аренда склада, ПТС или договоры субподряда — кто и чем будет исполнять договор (п. 14–15 письма ФНС)', ask: 'Сведения о ресурсах для исполнения договора: штат, склад или техника либо договоры субподряда' },
experience: { t: '2–3 исполненных похожих договора или отзывы клиентов', why: 'опыт и деловая репутация — прямо названы ФНС среди признаков реальной компании', ask: 'Копии 2–3 исполненных договоров, похожих на наш (цены можно скрыть), или отзывы клиентов' },
regime: { t: 'Подтверждение режима налогообложения', why: 'для вычета НДС нужен счёт-фактура от плательщика НДС; на УСН — уведомление о переходе', ask: 'Подтверждение режима налогообложения (для УСН — уведомление о переходе)' },
fssp: { t: 'Пояснение по долгам у приставов', why: 'как и когда погасят: при аресте счёта ваша предоплата застрянет', ask: 'Информация о погашении исполнительных производств или план погашения' },
unblock: { t: 'Решение ФНС об отмене приостановления операций по счёту', why: 'пока счёт заблокирован налоговой, компания не сможет тратить ваши деньги', ask: 'Решение налоговой об отмене приостановления операций по счёту' },
bank: { t: 'Письмо о том, что счёт не ограничен банком, и реквизиты второго банка', why: 'прогноз ЗСК повышен — запасной счёт спасёт сделку, если банк остановит платёж', ask: 'Подтверждение, что расчётный счёт не ограничен, и реквизиты второго банка' },
license: { t: 'Лицензия или выписка из СРО, если работа этого требует', why: 'строительство, перевозки, медицина — без допуска сделку могут признать недействительной', ask: 'Лицензия или выписка из реестра СРО — если работы по договору этого требуют' },
otchetnostBank: { t: 'Бухгалтерская (финансовая) отчётность за последний год', why: 'у кредитной организации её раскрывает Банк России — в открытых данных ФНС её может не быть', ask: 'Ссылка на раскрытую бухгалтерскую (финансовую) отчётность за последний год — на сайте организации или Банка России', links: [{ t: 'cbr.ru', u: CBR_FOINFO }] },
otchetnost: { t: 'Бухгалтерская отчётность за последний год', why: 'в открытых данных её нет — без выручки предел отсрочки считается по возрасту компании, осторожно', ask: 'Бухгалтерская отчётность за последний год с квитанцией о сдаче в налоговую' },
poruchitel: { t: 'Поручительство директора или участника', why: 'если покупатель не оплатит, долг можно потребовать и с поручителя (ст. 361 ГК РФ) — работает, только если у поручителя есть имущество', ask: 'Согласие директора или участника подписать договор поручительства по оплате поставок' }
};
function docItem(id) { return { id: id, title: DOCS[id].t, why: DOCS[id].why, ask: DOCS[id].ask || DOCS[id].t, links: DOCS[id].links || [] }; }
function docs(f, t, amount, regime) {
amount = parseAmount(amount);
var ids = [];
function add(id) { if (ids.indexOf(id) < 0) ids.push(id); }
var big = !amount || amount >= 1000000, mid = !amount || amount >= 100000;
add(f.bad.director || f.warn.director ? 'powerNew' : 'power');
add('card');
if (f.bad.nedost || f.warn.nedost) { add('fixRecord'); add('premises'); }
if (f.bad.mass || f.warn.mass) add('premises');
if (f.bad.block || f.warn.block) add('unblock');
if (f.bad.dolg || f.warn.dolg) add('taxCert');
if (f.bad.fssp || f.warn.fssp) add('fssp');
if (f.zsk === 'medium' || f.zsk === 'high') add('bank');
if (f.bad.staff || f.warn.staff || f.staff === 0 || f.staff === 1 || f.warn.young || (mid && t !== 'go')) add('resources');
if (big || t === 'post' || t === 'stop') add('experience');
if (regime !== 'usn_d' && (f.bad.nagruzka || f.warn.nagruzka || big)) add('regime');
if (big) add('license');
return ids.slice(0, 7).map(docItem);
}
function docsOtg(f, t, amount, cap) {
amount = parseAmount(amount);
var ids = [];
function add(id) { if (ids.indexOf(id) < 0) ids.push(id); }
add(f.bad.director || f.warn.director ? 'powerNew' : 'power');
if (f.bad.fssp || f.warn.fssp) add('fssp');
if (f.bad.dolg || f.warn.dolg) add('taxCert');
if (f.bad.block || f.warn.block) add('unblock');
if (f.zsk === 'medium' || f.zsk === 'high') add('bank');
if (f.bad.nedost || f.warn.nedost) { add('fixRecord'); add('premises'); }
if (f.bad.mass || f.warn.mass) add('premises');
var neDejstvuet = f.status === 'LIQUIDATING' || f.status === 'LIQUIDATED' || f.status === 'BANKRUPT' || !!f.bad.exit;
if (!f.revenue && !f.vyruchkaNol && !neDejstvuet) add(f.kredit ? 'otchetnostBank' : 'otchetnost');
if (t !== 'stop' && cap !== null && (amount ? amount > (cap || 0) : t === 'cap')) add('poruchitel');
return ids.slice(0, 7).map(docItem);
}
function letter(f, list, amount) {
amount = parseAmount(amount);
var lines = list.map(function (d, i) { return (i + 1) + '. ' + (d.ask || d.title) + '.'; }).join('\n');
var subj = 'Документы для договора — ' + f.name;
var body = 'Добрый день!\n\n' +
'Готовимся заключить договор с ' + f.name + (f.inn ? ' (ИНН ' + f.inn + ')' : '') +
(amount ? ' на сумму ' + money(amount).replace(/ /g, ' ') : '') + '. ' +
'По нашим внутренним правилам проверки контрагентов просим прислать скан-копии:\n\n' + lines + '\n\n' +
'Это стандартная процедура должной осмотрительности (ст. 54.1 НК РФ, письмо ФНС России от 10.03.2021 № БВ-4-7/3060@) — ' +
'мы проходим её со всеми партнёрами. Будем благодарны за ответ в течение трёх рабочих дней.\n\n' +
'С уважением,\n[Имя, должность]\n[Компания, телефон]';
return { subject: subj, body: body };
}
function letterOtg(f, list, amount) {
amount = parseAmount(amount);
var lines = list.map(function (d, i) { return (i + 1) + '. ' + (d.ask || d.title) + '.'; }).join('\n');
var subj = 'Документы для отгрузки с отсрочкой платежа — ' + f.name;
var body = 'Добрый день!\n\n' +
'Готовимся отгрузить ' + f.name + (f.inn ? ' (ИНН ' + f.inn + ')' : '') + ' с отсрочкой платежа' +
(amount ? ' на сумму ' + money(amount).replace(/\u00a0/g, ' ') : '') + '. ' +
'По нашим внутренним правилам работы с покупателями просим прислать скан-копии:\n\n' + lines + '\n\n' +
'Мы проходим эту процедуру со всеми покупателями, которым даём отсрочку. Будем благодарны за ответ в течение трёх рабочих дней.\n\n' +
'С уважением,\n[Имя, должность]\n[Компания, телефон]';
return { subject: subj, body: body };
}
var PREDV_BAZA = { age: 'выручки в отчётности нет — предел посчитан по возрасту компании', unknown: 'выручка и возраст неизвестны — предел посчитан осторожным потолком' };
function predvaritelno(r, f, t, pc, np) {
if (t !== 'go' && t !== 'cap') return null;
if (pc.malo || pc.cap === 0) return null;
var R = pc.raschet || {}, baza = !pc.finorg && (R.base === 'age' || R.base === 'unknown') ? R.base : null, ne = [];
(np && np.spisok || []).forEach(function (x) { ne.push(x); });
neProverenyPodrobno(r).forEach(function (x) {
var t2 = x.k === 'fssp' ? 'долги у приставов' : x.t;
if (ne.some(function (y) { return y.indexOf(t2) === 0; })) return;
ne.push(t2);
});
if (!baza && !ne.length) return null;
return { baza: baza, prichina: baza ? PREDV_BAZA[baza] : '', ne: ne };
}
function predvTekst(pv, otg) {
var a = [];
if (pv.ne.length) a.push('не проверяли ' + pv.ne.join(', '));
if (pv.prichina) a.push(pv.prichina);
return 'Ориентир предварительный: ' + a.join('; ') + '. Не проверено — не значит «в порядке»: ' + (otg ? 'в долг не отгружайте' : 'вперёд не платите') + ', пока не проверите' + (pv.baza && !pv.ne.length ? ' отчётность' : '') + '.';
}
function decide(r, opts) {
opts = opts || {};
var f = facts(r), t = tone(f), np = neProvereno(r, f), pc = prepayCap(f, t, np), amount = parseAmount(opts.amount), regime = opts.regime || 'osno';
var pv = predvaritelno(r, f, t, pc, np);
var list = docs(f, t, amount, regime);
if (opts.napravlenie === 'otgruzhaem') {
list = docsOtg(f, t, amount, pc.cap);
return sFinorg(pc, {
napravlenie: 'otgruzhaem',
facts: f, tone: t, cap: pc.cap, malo: !!pc.malo, capRule: pc.rule, raschet: pc.raschet, neProvereno: np,
kak: kakPoschitali(f, t, pc, reasons(f), np, 'otgruzhaem', pv),
headline: headlineOtg(f, t, pc.cap, pc.malo, pv), reasons: reasons(f), advice: adviceOtg(f, t, pc.malo),
amount: amount, regime: regime, stake: null, prepay: otgruzkaAdvice(amount, pc.cap, t, pv),
docs: list, letter: letterOtg(f, list, amount)
}, pv);
}
return sFinorg(pc, {
facts: f, tone: t, cap: pc.cap, malo: !!pc.malo, capRule: pc.rule, raschet: pc.raschet, neProvereno: np,
kak: kakPoschitali(f, t, pc, reasons(f), np, null, pv),
headline: headline(f, t, pc.cap, pc.malo, pv), reasons: reasons(f), advice: advice(f, t, pc.malo),
amount: amount, regime: regime, stake: atStake(amount, regime), prepay: prepayAdvice(amount, pc.cap, t, pv),
docs: list, letter: letter(f, list, amount)
}, pv);
}
function sFinorg(pc, v, pv) { if (pc.finorg) v.finorg = true; if (pv) v.predvaritelno = pv; return v; }
var CSS = '' +
'.usl{border-radius:16px;background:var(--bg,#F5F5F2);padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;color:var(--ink,#1D1D1F)}' +
'.usl-h{display:flex;gap:12px;align-items:flex-start}' +
'.usl-mark{flex:none;width:12px;height:12px;border-radius:50%;margin-top:7px;box-shadow:0 0 0 4px rgba(22,114,63,.14);background:#16723F}' +
'.usl.cap .usl-mark{background:#C27A00;box-shadow:0 0 0 4px rgba(194,122,0,.16)}' +
'.usl.post .usl-mark,.usl.stop .usl-mark{background:#B3261E;box-shadow:0 0 0 4px rgba(179,38,30,.14)}' +
'.usl-t{font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
'.usl-r{margin:4px 0 0;font-size:15px;color:var(--ink2,#48484C)}' +
'.usl-a{margin:0;font-size:15px;color:var(--ink2,#48484C)}' +
'.usl-cap{font-size:13px;color:var(--muted,#6B6B70)}' +
'.usl-kak{display:flex;flex-direction:column;gap:6px;border-top:1px solid #E6E6E1;padding-top:10px}' +
'.usl-kak p{margin:0;font-size:15px;color:var(--ink2,#48484C);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
'.usl-kak .usl-ne{color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px}' +
'.usl-kak a{color:var(--accent,#0B63E5)}' +
'.usl-sum{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;border-top:1px solid #E6E6E1;padding-top:12px}' +
'.usl-sum label{font-size:13px;color:var(--muted,#6B6B70);grid-column:1/-1}' +
'.usl-in{display:flex;align-items:center;background:#fff;border:1px solid #DADAD4;border-radius:10px;padding:0 12px;min-width:0}' +
'.usl-in:focus-within{border-color:var(--accent,#0B63E5);box-shadow:0 0 0 3px rgba(11,99,229,.15)}' +
'.usl-in input{border:0;outline:0;font:inherit;font-size:17px;padding:10px 0;width:100%;min-width:0;background:transparent;font-variant-numeric:tabular-nums}' +
'.usl-in span{color:var(--muted,#6B6B70)}' +
'.usl select{font:inherit;font-size:15px;border:1px solid #DADAD4;border-radius:10px;padding:10px 30px 10px 12px;background:#fff;max-width:190px;color:inherit}' +
'.usl-out{display:flex;flex-direction:column;gap:6px;font-size:15px}' +
'.usl-out b{font-variant-numeric:tabular-nums}' +
'.usl-out .z{color:var(--ok,#16723F)}' +
'.usl details{border-top:1px solid #E6E6E1;padding-top:10px}' +
'.usl summary{cursor:pointer;font-weight:600;font-size:15px;list-style:none;display:flex;justify-content:space-between;gap:10px}' +
'.usl summary::-webkit-details-marker{display:none}' +
'.usl summary:after{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:5px 4px 0 0;transition:transform .2s}' +
'.usl details[open] summary:after{transform:rotate(-135deg);margin-top:9px}' +
'.usl summary small{font-weight:400;color:var(--muted,#6B6B70);font-size:13px;margin-left:6px}' +
'.usl ol{margin:10px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:15px}' +
'.usl ol span{display:block;color:var(--muted,#6B6B70);font-size:13px}' +
'.usl ol a{color:var(--accent,#0B63E5);text-decoration:none;overflow-wrap:anywhere}.usl ol a:hover{text-decoration:underline}' +
'.usl-note{font-size:13px;color:var(--muted,#6B6B70);margin:10px 0 0}' +
'.usl-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
'.usl-btns button,.usl-btns a{border:1px solid #D9D9D4;background:#fff;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:9px 14px;cursor:pointer;color:var(--ink,#1D1D1F);text-decoration:none}' +
'.usl-btns button:hover,.usl-btns a:hover{border-color:var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
'.usl-napr{display:flex;gap:0;padding:3px;margin:-2px 0 2px;background:rgba(0,0,0,.055);border-radius:10px;align-self:flex-start;max-width:100%}' +
'.usl-napr button{min-height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;font:inherit;font-size:15px;font-weight:500;line-height:1.15;color:var(--ink2,#48484C);cursor:pointer;white-space:nowrap}' +
'@media (max-width:640px),(pointer:coarse){.usl-napr button,.usl-btns button,.usl-btns a{min-height:44px}.usl-btns a{display:inline-flex;align-items:center}}' +
'.usl-napr button[aria-pressed=true]{background:#fff;color:var(--ink,#1D1D1F);box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
'.usl-napr button:focus-visible{outline:2px solid var(--accent,#0B63E5);outline-offset:1px}' +
'.usl-watch{align-self:flex-start;font-size:15px;line-height:1.35;color:var(--accent,#0B63E5);text-decoration:none;border:1px solid #D9D9D4;background:#fff;border-radius:10px;padding:8px 12px}' +
'.usl-watch:hover{border-color:var(--accent,#0B63E5)}' +
'@media (max-width:520px){.usl-napr{align-self:stretch}.usl-napr button{flex:1 1 0;padding:0 8px}}' +
'@media (max-width:520px){.usl{padding:16px 14px}.usl-t{font-size:17px}.usl-sum{grid-template-columns:1fr}.usl select{max-width:none;width:100%}}' +
'@media print{.usl .usl-napr,.usl .usl-watch,.usl .usl-sum,.usl .usl-btns,.usl summary:after{display:none!important}.usl details>*{display:block}.usl{background:none;border:1px solid #E6E6E1}}';
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
CSS += '.usl-rynok{margin:-4px 0 0;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70)}';
function injectCss(doc) {
if (doc.getElementById('usl-css')) return;
var s = doc.createElement('style'); s.id = 'usl-css'; s.textContent = CSS; doc.head.appendChild(s);
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }
function bezPovtora(verdict, zag) {
var t = String(verdict == null ? '' : verdict).replace(/^Вывод:\s*/i, '').trim();
var h = String(zag || '').trim();
if (h && t.toLowerCase().indexOf(h.toLowerCase()) === 0) t = t.slice(h.length).replace(/^[\s.,:;!—–-]+/, '');
return t.replace(/[.\s]+$/, '');
}
function rynokStroka(rynok, v, seichas) {
if (!rynok || !rynok.tekst || !v || (v.tone !== 'go' && v.tone !== 'cap') || !(v.cap > 0) || v.malo) return '';
var konec = Date.parse(String(rynok['do'] || '') + 'T00:00:00+03:00');
if (!isFinite(konec) || (seichas == null ? Date.now() : seichas) >= konec) return '';
return String(rynok.tekst);
}
var KLYUCHEVYE = [{ k: 'sudy', t: 'арбитражные суды' }, { k: 'bankrotstvo', t: 'банкротство' }, { k: 'fssp', t: 'приставы' }];
function neProverenyPodrobno(r) {
var dm = r && r.damia;
if (!dm || typeof dm !== 'object') return [];
var out = [];
KLYUCHEVYE.forEach(function (x) {
var b = dm[x.k];
if (!b || typeof b !== 'object') return;
if (b.sostoyanie) { if (b.sostoyanie === 'not_checked') out.push({ k: x.k, t: x.t, nep: true }); return; }
if (['found', 'not_found', 'not_applicable'].indexOf(b.status) < 0) out.push({ k: x.k, t: x.t, nep: false });
});
return out;
}
function neProverenyKlyuchevye(r) { return neProverenyPodrobno(r).map(function (x) { return x.t; }); }
function chestnoPoyasnenie(r, poyasnenie) {
var t = String(poyasnenie == null ? '' : poyasnenie), np = neProverenyPodrobno(r);
if (!np.length || !/(не\s+найден|не\s+обнаружен|признаков\s+(риска\s+)?нет|сигналов\s+нет)/i.test(t)) return t;
function sp(xs) { return xs.map(function (x) { return x.t; }).join(', '); }
var poka = np.filter(function (x) { return x.nep; }), net = np.filter(function (x) { return !x.nep; });
var nach = !net.length ? 'Не проверяли: ' + sp(poka)
: !poka.length ? 'Не ответили в\u00a0этот раз: ' + sp(net)
: 'Пока не проверяем: ' + sp(poka) + '. Не ответили в\u00a0этот раз: ' + sp(net);
return nach + '. Перед крупной оплатой посмотрите их сами';
}
function vVyvode(r) {
try {
var v = decide(r, {});
if (v.reasons.length) return [];
var baza = bezPovtora(r && r.verdict, v.headline);
if (chestnoPoyasnenie(r, baza) === String(baza == null ? '' : baza)) return [];
return neProverenyPodrobno(r).map(function (x) { return x.k; });
} catch (e) { return []; }
}
function cel(imya) { try { if (typeof window !== 'undefined' && window.dlkGoal) window.dlkGoal(imya); } catch (_) {   } }
var NAPR = [{ id: 'platim', t: 'Я плачу им' }, { id: 'otgruzhaem', t: 'Они платят мне' }];
function mount(el, r, o) {
o = o || {};
if (!r || !r.company || !r.company.inn) throw new Error('usloviya: нет данных о компании');
var doc = el.ownerDocument; injectCss(doc);
var uid = 'usl' + Math.random().toString(36).slice(2, 7);
var st = { amount: o.amount || 0, regime: store('usl.regime') || 'osno', napravlenie: store('usl.napr') === 'otgruzhaem' ? 'otgruzhaem' : 'platim' };
var celi = {};
var box = doc.createElement('section');
box.setAttribute('aria-label', 'Условия сделки');
el.innerHTML = ''; el.appendChild(box);
function draw(keepFocus) {
var v = decide(r, st), f = v.facts;
box.className = 'usl ' + v.tone;
var why = v.reasons.length ? v.reasons.join(', ') : chestnoPoyasnenie(r, bezPovtora(r && r.verdict, v.headline));
var stake = '';
if (v.stake) {
stake = v.stake.zero
? '<div class="z">На вашем режиме расходы не уменьшают налог — налоговый риск по этому поставщику нулевой. Остаются риск денег и 115-ФЗ.</div>'
: '<div>На кону при претензии налоговой: <b>' + (v.stake.soft ? money(v.stake.soft).replace(/\s₽$/, '') + '–' : 'до\u00a0') + money(v.stake.hard) + '</b> плюс пени. Досье Делоскопа — ваш довод, что поставщика проверили.</div>';
}
var sel = REGIMES.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.regime ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
var openAttr = o.open ? ' open' : '', otg = v.napravlenie === 'otgruzhaem';
var rynok = o.compact ? '' : rynokStroka(o.rynok, v);
var napr = (o.compact || o.bezNapr) ? '' : '<div class="usl-napr" role="group" aria-label="Кто кому платит">' + NAPR.map(function (x) {
return '<button type="button" data-napr="' + x.id + '" aria-pressed="' + (x.id === st.napravlenie) + '">' + esc(x.t) + '</button>'; }).join('') + '</div>';
var watch = otg && (v.tone === 'go' || v.tone === 'cap') && v.facts.status !== 'LIQUIDATED'
? '<a class="usl-watch" href="/cabinet.html#watch">Поставьте покупателя на слежение, пока за ним долг: при следующей проверке отчёт покажет, что изменилось</a>' : '';
box.innerHTML = napr +
'<div class="usl-h"><span class="usl-mark" aria-hidden="true"></span><div>' +
'<div class="usl-t">' + esc(v.headline) + '</div>' +
(why ? '<p class="usl-r">' + esc(why.charAt(0).toUpperCase() + why.slice(1)) + '.</p>' : '') +
'</div></div>' +
'<p class="usl-a">' + esc(v.advice) + '</p>' + (rynok ? '<p class="usl-rynok">' + esc(rynok) + '</p>' : '') + watch +
(o.compact ? '' :
'<div class="usl-sum"><label for="' + uid + 'a">' + (otg ? 'Сумма отгрузки' : 'Сумма сделки — посчитаем предоплату и деньги на кону') + '</label>' +
'<div class="usl-in"><input id="' + uid + 'a" inputmode="numeric" autocomplete="off" placeholder="например, 500 000" value="' + (st.amount ? esc(money(st.amount).replace(/ ₽$/, '')) : '') + '"><span>₽</span></div>' +
(otg ? '' : '<select aria-label="Ваш режим налогов">' + sel + '</select>') + '</div>' +
(v.amount && (v.prepay || stake) ? '<div class="usl-out" aria-live="polite">' + (v.prepay ? '<div>' + esc(v.prepay) + '</div>' : '') + stake + '</div>' : '')) +
'<div class="usl-kak" data-u="kak"><p>' + esc(v.kak.kak) + '</p>' +
(v.kak.ne ? '<p class="usl-ne">' + esc(v.kak.ne) + '</p>' : '') +
(v.kak.ssylka ? '<p class="usl-ne" data-u="bank"><a href="' + esc(v.kak.ssylka.u) + '" target="_blank" rel="noopener">' + esc(v.kak.ssylka.t) + ' →</a></p>' : '') +
'<p class="usl-cap">Ориентир Делоскопа, не норма закона. <a href="' + FORMULA + '">Открытая формула предела</a>; пример — в разборе <a href="' + STATYA + '">«Сколько платить вперёд незнакомой компании»</a>.</p>' +
'</div>' +
'<details' + openAttr + '><summary><span>Что запросить у них<small>' + v.docs.length + ' ' + plural(v.docs.length, 'документ', 'документа', 'документов') + '</small></span></summary>' +
'<ol>' + v.docs.map(function (d) { return '<li>' + esc(d.title) + '<span>' + esc(d.why) + (d.links.length ? ' · ' + d.links.map(function (l) { return '<a href="' + esc(l.u) + '"' + (/^https?:/.test(l.u) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.t) + '</a>'; }).join(', ') : '') + '</span></li>'; }).join('') + '</ol>' +
'<p class="usl-note">' + (otg ? 'Список зависит от суммы отгрузки и найденных признаков.' : 'Список соразмерен сумме сделки — так требует п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@.') + '</p>' +
'<div class="usl-btns"><button type="button" data-u="copy">Скопировать письмо</button>' +
'<a data-u="mail" href="mailto:?subject=' + encodeURIComponent(v.letter.subject) + '&body=' + encodeURIComponent(v.letter.body) + '">Открыть в почте</a></div>' +
'</details>';
if (window.DlkTipo) window.DlkTipo.uzly(box);
var inp = box.querySelector('input'), s = box.querySelector('select');
if (inp) {
inp.addEventListener('input', function () {
var pos = inp.value.length; st.amount = parseAmount(inp.value);
if (st.napravlenie === 'otgruzhaem' && st.amount && !celi.summa) { celi.summa = 1; cel('usl_otgruzhaem_summa'); }
clearTimeout(inp._t); inp._t = setTimeout(function () { draw(true); }, 350);
void pos;
});
if (keepFocus) { inp.focus(); var L = inp.value.length; try { inp.setSelectionRange(L, L); } catch (_) {} }
}
if (s) s.addEventListener('change', function () { st.regime = s.value; store('usl.regime', s.value); draw(); });
Array.prototype.forEach.call(box.querySelectorAll('[data-napr]'), function (b) {
b.addEventListener('click', function () {
var n = b.getAttribute('data-napr');
if (n === st.napravlenie) return;
st.napravlenie = n; store('usl.napr', n);
if (n === 'otgruzhaem' && !celi.otg) { celi.otg = 1; cel('usl_otgruzhaem'); }
draw();
var nb = box.querySelector('[data-napr="' + n + '"]'); if (nb) nb.focus();
});
});
var cp = box.querySelector('[data-u="copy"]');
if (cp) cp.addEventListener('click', function () {
var txt = 'Тема: ' + v.letter.subject + '\n\n' + v.letter.body;
var done = function () { cp.textContent = 'Письмо скопировано'; };
try { navigator.clipboard.writeText(txt).then(done, function () { window.prompt('Скопируйте письмо:', txt); }); } catch (_) { window.prompt('Скопируйте письмо:', txt); }
});
return v;
}
var last = draw();
return { update: function (a) { if (a != null) st.amount = parseAmount(a); last = draw(); return last; }, get result() { return last; } };
}
return {
decide: decide, mount: mount, rynokStroka: rynokStroka, facts: facts, tone: tone, reorgPrekr: reorgPrekr, REORG_PREKRASHCHENIE: REORG_PREKRASHCHENIE, REORG_SDELAT: REORG_SDELAT, REORG_DOLG: REORG_DOLG, prepayCap: prepayCap, atStake: atStake,
docs: docs, letter: letter, parseAmount: parseAmount, money: money, moneyKrupno: moneyKrupno, niceFloor: niceFloor, kindOf: kindOf,
neProvereno: neProvereno, kakPoschitali: kakPoschitali, otgruzkaAdvice: otgruzkaAdvice, NAPR: NAPR, bezPovtora: bezPovtora, chestnoPoyasnenie: chestnoPoyasnenie, neProverenyKlyuchevye: neProverenyKlyuchevye, vVyvode: vVyvode, STATYA: STATYA, FORMULA: FORMULA,
predvaritelno: predvaritelno, METODIKA: { DELITEL: DELITEL, POTOLKI: POTOLKI, OSTOROZHNO: OSTOROZHNO, MINIMUM: MINIMUM },
RATES: { VAT: VAT, PROFIT: PROFIT, USN_DR: USN_DR }
};
});
;
