/* Делоскоп · пакет «glavnaya-sinhr» — собран tests/sobrat_js.py из 2 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/limit.js --- */
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.dlkLimit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = ' ';
var KEY = 'dlk_otlozhennye', MAX = 5, DNEJ = 30;
var TARIFY_URL = '/tarify/tarify.json';
var LIMIT = 10;
var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function srokBety(d, sejchas) {
var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (!m) return null;
var k = Date.parse(d + 'T00:00:00+03:00') + 864e5;
if (isNaN(k) || (sejchas || Date.now()) >= k) return null;
return { kratko: m[3] + '.' + m[2], slovami: (+m[3]) + NB + MES[+m[2] - 1] };
}
var SSYLKI = [
{ kuda: 'schet', t: 'Проверить реквизиты счёта', href: '/proverit-schet/' },
{ kuda: 'skoraya', t: 'Скорая 115-ФЗ' + NB + '— план по' + NB + 'дням', href: '/skoraya-115-fz/' },
{ kuda: 'praktika', t: 'Разборы дел', href: '/praktika/' }
];
function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }
function innOrg(s) {
s = String(s == null ? '' : s).replace(/\D/g, '');
if (!/^\d{10}$/.test(s) || /^0+$/.test(s)) return '';
var k = [2, 4, 10, 3, 5, 9, 4, 6, 8], sum = 0;
for (var i = 0; i < 9; i++) sum += k[i] * +s[i];
return (sum % 11) % 10 === +s[9] ? s : '';
}
function iz(T) {
if (!T) return null;
var start = (T.tarify || []).filter(function (t) { return t && t.id === 'start'; })[0];
var p = T.pasport_razovyj || {};
var pro = (T.tarify || []).filter(function (t) { return t && t.id === 'pro'; })[0];
var P = T.ekran_limita_pravila || {};
return {
beta: T.beta === true,
ekran: T.ekran_limita === true,
pravila: { dni: P.dni_za_nedelyu > 0 ? Math.floor(P.dni_za_nedelyu) : 2, inn: P.inn_za_den > 0 ? Math.floor(P.inn_za_den) : 30 },
startGod: start && start.god > 0 ? { nazvanie: start.nazvanie || 'Старт', god: start.god, otchetov: start.otchetov || 0 } : null,
proGod: pro && pro.god > 0 ? { nazvanie: pro.nazvanie || 'Про', god: pro.god, otchetov: pro.otchetov || 0 } : null,
gost: T.gost_v_den > 0 ? Math.floor(T.gost_v_den) : null,
betaDo: T.beta_do || null,
start: start && start.mesyac > 0 ? { nazvanie: start.nazvanie || 'Старт', mesyac: start.mesyac } : null,
pasport: p.cena_rub > 0 ? { nazvanie: p.nazvanie || 'Паспорт контрагента на дату сделки', cena: p.cena_rub } : null
};
}
function tekst(o) {
o = o || {};
var T = o.tarify || null;
var beta = !!(o.beta || !T || T.beta || !T.start);
var inn = innOrg(o.inn);
var G = (T && T.gost) || LIMIT;
var r = {
beta: beta,
zag: 'На' + NB + 'сегодня бесплатные проверки закончились',
stroka: '',
sohr: o.sohranen && inn ? 'ИНН ' + inn + ' сохранили на' + NB + 'этом устройстве' + NB + '— завтра проверим одним нажатием.' : '',
ssylkiZag: 'Что можно сделать прямо сейчас:',
ssylki: SSYLKI.filter(function (s) { return s.kuda !== o.stranica; }),
knopki: []
};
if (beta) {
var srok = srokBety(T && T.betaDo, o.sejchas);
r.stroka = 'Завтра' + NB + '— снова ' + G + '. Пока идёт бета' + (srok ? ' (по' + NB + srok.slovami + ')' : '') + ', тарифы не' + NB + 'продаём и' + NB + 'счета не' + NB + 'выставляем.';
return r;
}
if (T.ekran) return ekranTekst(r, T, inn, G, o.povedenie);
r.stroka = 'Завтра' + NB + '— снова ' + G + '. Без лимита' + NB + '— в' + NB + 'тарифе «' + T.start.nazvanie + '» за' + NB + rub(T.start.mesyac) + ' в' + NB + 'месяц.';
r.knopki.push({ kuda: 'tarify', t: 'Тарифы', href: '/tarify/#start', primary: true });
if (inn && T.pasport) r.knopki.push({ kuda: 'pasport', t: T.pasport.nazvanie + NB + '— ' + rub(T.pasport.cena), href: '/schet/?produkt=pasport_razovyj' + (/^(\d{10}|\d{12})$/.test(String(inn)) ? '&inn=' + inn : ''), gost: true });
return r;
}
function razvernutyh(n) {
var m10 = n % 10, m100 = n % 100;
if (m10 === 1 && m100 !== 11) return n + NB + 'развёрнутая проверка';
if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + NB + 'развёрнутые проверки';
return n + NB + 'развёрнутых проверок';
}
function vybor(T, inn, pov) {
pov = pov || {};
if (T.proGod && (pov.inn || 0) >= T.pravila.inn) return 'pro';
if (T.startGod && (pov.dni || 0) >= T.pravila.dni) return 'start';
if (inn && T.pasport) return 'pasport';
return T.startGod ? 'start' : 'tarify';
}
function ekranTekst(r, T, inn, G, pov) {
var v = vybor(T, inn, pov);
r.vid = v;
r.chestno = 'Можно ничего не' + NB + 'покупать: завтра снова ' + G + NB + 'бесплатных проверок.';
if (v === 'pro') {
r.stroka = 'Сегодня вы' + NB + 'проверили много компаний. В' + NB + 'тарифе «' + T.proGod.nazvanie + '»' + NB + '— быстрые проверки без лимита и' + NB + razvernutyh(T.proGod.otchetov) + ' в' + NB + 'месяц; бухгалтерам и' + NB + 'консультантам есть партнёрская программа.';
r.knopki.push({ kuda: 'pro_god', t: '«' + T.proGod.nazvanie + '» на' + NB + 'год' + NB + '— ' + rub(T.proGod.god), href: '/schet/?tarif=pro&srok=god', primary: true });
r.ssylki.unshift({ kuda: 'partneram', t: 'Партнёрская программа', href: '/partneram/' });
} else if (v === 'start') {
r.stroka = ((pov && pov.dni >= T.pravila.dni) ? 'Бесплатные проверки заканчиваются у' + NB + 'вас не' + NB + 'первый день за' + NB + 'неделю. ' : '') +
'В' + NB + 'тарифе «' + T.startGod.nazvanie + '»' + NB + '— быстрые проверки без лимита и' + NB + razvernutyh(T.startGod.otchetov) + ' в' + NB + 'месяц.';
r.knopki.push({ kuda: 'start_god', t: '«' + T.startGod.nazvanie + '» на' + NB + 'год' + NB + '— ' + rub(T.startGod.god), href: '/schet/?tarif=start&srok=god', primary: true });
} else if (v === 'pasport') {
r.stroka = 'Если эта компания нужна сегодня, её можно проверить развёрнуто и' + NB + 'разово, без подписки: источник и' + NB + 'дата у' + NB + 'каждого факта.';
r.knopki.push({ kuda: 'pasport', t: T.pasport.nazvanie + NB + '— ' + rub(T.pasport.cena), href: '/schet/?produkt=pasport_razovyj&inn=' + inn, primary: true, gost: true });
} else {
r.stroka = 'Завтра' + NB + '— снова ' + G + '.';
r.chestno = '';
r.knopki.push({ kuda: 'tarify', t: 'Тарифы', href: '/tarify/', primary: true });
}
return r;
}
var DNI_KEY = 'dlk_limit_dni', DEN_KEY = 'dlk_limit_den', OTP_MAX = 200;
function otpechatok(inn) {
var h = 0x811c9dc5, s = String(inn);
for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
return (h >>> 12).toString(36);
}
function chitatJ(w, k, def) { var ls = hran(w); if (!ls) return def; try { var v = JSON.parse(ls.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } }
function pisatJ(w, k, v) { var ls = hran(w); if (!ls) return false; try { ls.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function povedenie(w, now) {
now = now || Date.now();
var d = denMsk(now);
var dni = chitatJ(w, DNI_KEY, []), den = chitatJ(w, DEN_KEY, null);
dni = Array.isArray(dni) ? dni.filter(function (x) { return typeof x === 'number' && x > d - 7 && x <= d; }) : [];
var h = den && den.d === d && Array.isArray(den.h) ? den.h : [];
return { dni: dni.length, inn: h.length };
}
function otmetitInn(w, inn, now) {
inn = String(inn == null ? '' : inn).replace(/\D/g, '');
if (!/^(\d{10}|\d{12})$/.test(inn)) return povedenie(w, now);
now = now || Date.now();
var d = denMsk(now), den = chitatJ(w, DEN_KEY, null), o = otpechatok(inn);
var h = den && den.d === d && Array.isArray(den.h) ? den.h.slice(0, OTP_MAX) : [];
if (h.indexOf(o) < 0 && h.length < OTP_MAX) h.push(o);
pisatJ(w, DEN_KEY, { d: d, h: h });
return povedenie(w, now);
}
function otmetitLimit(w, inn, now) {
now = now || Date.now();
var d = denMsk(now), dni = chitatJ(w, DNI_KEY, []);
dni = Array.isArray(dni) ? dni.filter(function (x) { return typeof x === 'number' && x > d - 7 && x <= d; }) : [];
if (dni.indexOf(d) < 0) dni.push(d);
pisatJ(w, DNI_KEY, dni);
return otmetitInn(w, inn, now);
}
function hran(w) { try { return w && w.localStorage ? w.localStorage : null; } catch (e) { return null; } }
function spisok(w, now) {
var ls = hran(w); if (!ls) return [];
now = now || Date.now();
try {
var a = JSON.parse(ls.getItem(KEY) || '[]');
if (!Array.isArray(a)) return [];
return a.filter(function (x) { return x && innOrg(x.inn) === x.inn && x.t > 0 && now - x.t < DNEJ * 864e5; }).slice(0, MAX);
} catch (e) { return []; }
}
function zapisat(w, a) { var ls = hran(w); if (!ls) return false; try { ls.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
function sohranit(w, inn, now) {
inn = innOrg(inn);
if (!inn) return false;
var a = spisok(w, now).filter(function (x) { return x.inn !== inn; });
a.unshift({ inn: inn, t: now || Date.now() });
return zapisat(w, a.slice(0, MAX));
}
function ubratInn(w, inn) {
var a = spisok(w), b = a.filter(function (x) { return x.inn !== String(inn); });
if (b.length !== a.length) zapisat(w, b);
}
function denMsk(t) { return Math.floor((t + 3 * 36e5) / 864e5); }
function kNapominaniyu(w, now) {
now = now || Date.now();
var d = denMsk(now);
var x = spisok(w, now).filter(function (x) { return denMsk(x.t) < d; })[0];
if (!x) return null;
var vchera = denMsk(x.t) === d - 1;
return { inn: x.inn, t: x.t, tekst: (vchera ? 'Вчера не' + NB + 'успели проверить: ' : 'Не' + NB + 'успели проверить: ') + x.inn };
}
var kesh = null;
function tarifyZagruzit(doc) {
if (kesh) return kesh;
var w = doc && doc.defaultView;
kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
return kesh;
}
function betaStranicy(doc) {
return !!(doc && doc.querySelector && doc.querySelector('meta[name="deloskop-rezhim"][content="beta"]'));
}
function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) {   } }
var CSS = '.limit{margin-top:12px;background:var(--surface,#F5F5F2);border:1px solid var(--line,#E6E6E1);border-radius:16px;padding:16px 18px;font-size:15px;line-height:1.5;color:var(--ink,#1D1D1F);text-align:left;max-width:100%;box-sizing:border-box}' +
'.limit__zag{font-size:17px;font-weight:600;line-height:1.35;margin:0 0 4px}' +
'.limit p{margin:0 0 6px;font-size:15px;line-height:1.5;color:var(--ink2,#3A3A3C)}' +
'.limit__sohr{color:var(--ink,#1D1D1F)}' +
'.limit__ss{display:flex;flex-wrap:wrap;gap:4px 18px;margin:2px 0 0;padding:0;list-style:none}' +
'.limit__ss a{color:var(--accent,#0B63E5);text-decoration:none}.limit__ss a:hover{text-decoration:underline}' +
'.limit__kn{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}' +
'.limit__kn a{display:inline-flex;align-items:center;min-height:44px;padding:10px 18px;border-radius:999px;font-weight:600;font-size:15px;text-decoration:none;box-sizing:border-box;max-width:100%}' +
'.limit__kn .gh{border-radius:16px}.limit__kn .pr{background:var(--accent,#0B63E5);color:#fff}.limit__kn .gh{border:1px solid var(--line,#E6E6E1);color:var(--accent,#0B63E5);background:#fff}' +
'.limit p.limit__chestno{margin:10px 0 0;font-size:15px;color:var(--ink3,#6E6E73)}' +
'.limit-vchera{margin-top:8px;font-size:15px;color:var(--ink2,#3A3A3C)}.limit-vchera button{font:inherit;border:0;background:none;padding:0;cursor:pointer}' +
'.limit-vchera .go{color:var(--accent,#0B63E5)}.limit-vchera .x{color:var(--ink3,#8A8A8E);margin-left:12px;font-size:15px}';
function stil(doc) {
if (!doc || doc.getElementById('dlk-limit-css')) return;
var s = doc.createElement('style'); s.id = 'dlk-limit-css'; s.textContent = CSS;
(doc.head || doc.documentElement).appendChild(s);
}
function mesto(uzel) {
if (!uzel) return null;
var doc = uzel.ownerDocument, d;
if (uzel.tagName === 'P') {
d = uzel.nextElementSibling;
if (d && d.getAttribute('data-limit') === '1') return d;
d = doc.createElement('div'); d.setAttribute('data-limit', '1');
uzel.parentNode.insertBefore(d, uzel.nextSibling);
return d;
}
uzel.innerHTML = '';
d = doc.createElement('div'); d.setAttribute('data-limit', '1');
uzel.appendChild(d);
return d;
}
function ubrat(uzel) {
if (!uzel) return;
var d = uzel.tagName === 'P' ? uzel.nextElementSibling : uzel.querySelector('[data-limit="1"]');
if (d && d.getAttribute('data-limit') === '1' && d.parentNode) d.parentNode.removeChild(d);
}
function el(doc, tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function narisovat(box, r, o) {
var doc = box.ownerDocument, w = doc.defaultView;
box.innerHTML = '';
box.className = 'limit';
box.setAttribute('role', 'status');
box.setAttribute('data-limit-beta', r.beta ? '1' : '0');
box.appendChild(el(doc, 'p', 'limit__zag', r.zag));
box.appendChild(el(doc, 'p', '', r.stroka));
if (r.sohr) box.appendChild(el(doc, 'p', 'limit__sohr', r.sohr));
if (o.dop) box.appendChild(el(doc, 'p', '', o.dop));
if (r.knopki.length) {
var kn = el(doc, 'div', 'limit__kn');
r.knopki.forEach(function (k) {
var a = el(doc, 'a', k.primary ? 'pr' : 'gh', k.t); a.href = k.href;
a.addEventListener('click', function (e) {
cel(w, 'limit_klik', { kuda: k.kuda });
if (k.gost && w.PasportOplata && !(e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0)) {
e.preventDefault();
w.PasportOplata.otkryt({ nazvanie: o.nazvanie || '', doc: doc }).then(function (ok) { if (!ok) w.location.href = k.href; });
}
});
kn.appendChild(a);
});
box.appendChild(kn);
}
if (r.chestno) box.appendChild(el(doc, 'p', 'limit__chestno', r.chestno));
if (r.ssylki.length) {
box.appendChild(el(doc, 'p', '', r.ssylkiZag));
var ul = el(doc, 'ul', 'limit__ss');
r.ssylki.forEach(function (s) {
var li = el(doc, 'li'), a = el(doc, 'a', '', s.t); a.href = s.href;
a.addEventListener('click', function () { cel(w, 'limit_klik', { kuda: s.kuda }); });
li.appendChild(a); ul.appendChild(li);
});
box.appendChild(ul);
}
}
function pokazat(uzel, o) {
o = o || {};
var box = mesto(uzel);
if (!box) return Promise.resolve(null);
var doc = box.ownerDocument, w = doc.defaultView;
stil(doc);
var sohranen = sohranit(w, o.inn);
var beta = betaStranicy(doc);
narisovat(box, tekst({ beta: true, inn: o.inn, stranica: o.stranica, sohranen: sohranen }), o);
return tarifyZagruzit(doc).then(function (T) {
var t = iz(T), pov = null;
if (t && t.ekran && !beta && !t.beta) pov = otmetitLimit(w, o.inn);
var r = tekst({ tarify: t, beta: beta, inn: o.inn, stranica: o.stranica, sohranen: sohranen, povedenie: pov });
if (!r.beta) narisovat(box, r, o);
var p = { stranica: o.stranica || '', beta: r.beta ? 1 : 0 };
if (r.vid) p.vid = r.vid;
cel(w, 'limit_pokaz', p);
return r;
}).catch(function () { return null; });
}
function napomnit(uzel, proverit) {
if (!uzel) return null;
var doc = uzel.ownerDocument, w = doc.defaultView;
var x = kNapominaniyu(w);
if (!x) return null;
stil(doc);
var p = el(doc, 'p', 'limit-vchera');
p.setAttribute('data-limit-vchera', '1');
var b = el(doc, 'button', 'go', x.tekst + NB + '›'); b.type = 'button';
b.addEventListener('click', function () { cel(w, 'limit_otlozhennyj'); if (p.parentNode) p.parentNode.removeChild(p); proverit(x.inn); });
var u = el(doc, 'button', 'x', 'Убрать'); u.type = 'button';
u.addEventListener('click', function () { ubratInn(w, x.inn); if (p.parentNode) p.parentNode.removeChild(p); });
p.appendChild(b); p.appendChild(u);
uzel.parentNode.insertBefore(p, uzel.nextSibling);
return x;
}
function proveren(inn, w) {
w = w || (typeof window !== 'undefined' ? window : null);
var x = String(inn || '').replace(/\D/g, '');
ubratInn(w, x);
var doc = w && w.document;
if (doc && !betaStranicy(doc)) tarifyZagruzit(doc).then(function (T) { var t = iz(T); if (t && t.ekran && !t.beta) otmetitInn(w, x); }).catch(function () {});
}
return {
tekst: tekst, iz: iz, innOrg: innOrg, rub: rub,
spisok: spisok, sohranit: sohranit, kNapominaniyu: kNapominaniyu, ubratInn: ubratInn,
pokazat: pokazat, napomnit: napomnit, proveren: proveren, ubrat: ubrat, mesto: mesto,
povedenie: povedenie, otmetitInn: otmetitInn, otmetitLimit: otmetitLimit, otpechatok: otpechatok, vybor: vybor,
DNI_KEY: DNI_KEY, DEN_KEY: DEN_KEY,
KEY: KEY, MAX: MAX, LIMIT: LIMIT
};
});
;
/* --- /js/inn.js --- */
(function (root) {
function cifry(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
function ok(s) {
s = cifry(s);
if (!/^(\d{10}|\d{12})$/.test(s)) return false;
var d = s.split("").map(Number);
function k(w) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return x % 11 % 10; }
if (d.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
}
var DLINA = "ИНН компании — 10 цифр, ИНН ИП или человека — 12.";
var OPECHATKA = "В этом ИНН опечатка: контрольная цифра не сходится. Сверьте цифры с договором или счётом.";
function oshibka(s) {
var d = cifry(s);
if (d.length !== 10 && d.length !== 12) return DLINA;
return ok(d) ? "" : OPECHATKA;
}
var SLOVA = /ОГРНИП|ОГРН|ИНН|КПП|OGRN|INN|KPP/gi, RAZD = /[\d\s\u00a0\-\u2010-\u2015\/\\.,:;№#()]/g;
function pohozh(s) {
s = String(s == null ? "" : s);
return /\d/.test(s) && !s.replace(SLOVA, "").replace(RAZD, "");
}
function izTeksta(s) {
if (!pohozh(s)) return "";
var g = String(s).match(/\d(?:[\s\u00a0\-\u2010-\u2015]*\d)*/g) || [], i, j, d, t;
for (i = 0; i < g.length; i++) {
d = cifry(g[i]);
if (d.length === 10 || d.length === 12) return d;
t = g[i].split(/[\s\u00a0]+/);
for (j = 0; j < t.length; j++) { d = cifry(t[j]); if (d.length === 10 || d.length === 12) return d; }
}
return "";
}
function vNazvanii(s) {
s = String(s == null ? "" : s);
if (!/[A-Za-zА-Яа-яЁё]/.test(s.replace(SLOVA, ""))) return "";
var m = s.match(/(?:ИНН|INN)(?:\s*[\/\\]\s*(?:КПП|KPP))?[\s\u00a0:№#.,\-–—]*(\d[\d\s\u00a0\-]*)/i), d;
if (m) { d = izTeksta(m[1]); if (d) return d; }
var g = s.match(/(?:^|[^\d])(\d{10}|\d{12})(?![\d])/g) || [], i;
for (i = 0; i < g.length; i++) { d = cifry(g[i]); if (ok(d)) return d; }
return "";
}
function vstavka(pole, strogo) {
if (!pole || !pole.addEventListener) return;
pole.addEventListener("paste", function (e) {
var b = e.clipboardData || (typeof window !== "undefined" && window.clipboardData), t = b && b.getData ? b.getData("text") : "";
if (!t) return;
var d = pohozh(t) ? (izTeksta(t) || (strogo ? cifry(t) : "")) : (strogo ? vNazvanii(t) : "");
if (!d) return;
e.preventDefault();
pole.value = d;
try { pole.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {}
});
}
var api = { ok: ok, oshibka: oshibka, cifry: cifry, pohozh: pohozh, izTeksta: izTeksta, vNazvanii: vNazvanii, vstavka: vstavka, DLINA: DLINA, OPECHATKA: OPECHATKA };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.DlkInn = api;
})(this);
;
