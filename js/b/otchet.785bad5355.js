/* Делоскоп · пакет «otchet» — собран tests/sobrat_js.py из 22 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/kommentarii.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === "object" && module.exports) module.exports = api;
else root.Kommentarii = api;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";
var TON = { ok: "zel", info: "zel", warn: "zhel", bad: "kras" };
var MAKS = 300;
function esc(t) {
return String(t == null ? "" : t).replace(/[&<>"]/g, function (x) {
return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x];
});
}
function dataRu(v) {
var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
return m ? m[3] + "." + m[2] + "." + m[1] : "";
}
function dlina(t) { return ["bank", "nalog", "sdelat"].reduce(function (s, k) { return s + String(t[k] || "").length; }, 0); }
function gotov(t) {
return !!(t && t.status === "utverzhdeno" && t.proveril && dataRu(t.data_proverki) &&
t.sdelat && (t.bank || t.nalog) && dlina(t) <= MAKS);
}
function rx(s) { try { return new RegExp(s, "i"); } catch (e) { return null; } }
function zapis(sprav, signal) {
var list = (sprav && sprav.signaly) || [];
var title = String((signal && signal.title) || "");
if (!title) return null;
var vse = title + " · " + String((signal && signal.detail) || "");
for (var i = 0; i < list.length; i++) {
var re = rx(list[i].re);
if (!re || !re.test(title)) continue;
if (list[i].uslovie) { var u = rx(list[i].uslovie); if (!u || !u.test(vse)) continue; }
if (!list[i].kak) return list[i];
for (var j = 0; j < list.length; j++) if (list[j].id === list[i].kak && !list[j].kak) return list[j];
return null;
}
return null;
}
var NE_OTVETIL = /не\s*провер|недоступ|не\s*ответ|нет\s*ответа|нет\s*данных|нет\s*сведений|не\s*получ|ошибк|временно|не\s*удалось/i;
function istochnikOtvetil(signal) {
if (!signal || signal.status !== "ok") return false;
return !NE_OTVETIL.test(String(signal.title || "") + " · " + String(signal.detail || ""));
}
function najti(sprav, signal) {
var z = zapis(sprav, signal);
var ton = TON[signal && signal.status];
if (!z || !ton || !z.tony) return null;
if (ton === "zel" && !istochnikOtvetil(signal)) return null;
var t = z.tony[ton];
if (!gotov(t)) return null;
if (t.uslovie) {
var ut = rx(t.uslovie);
if (!ut || !ut.test(String(signal.title || "") + " · " + String(signal.detail || ""))) return null;
}
var norma = t.norma != null ? t.norma : z.norma;
return { id: z.id, ton: ton, bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat,
norma: norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
}
function html(k) {
if (!k) return "";
var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
return '<div class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
'<div class="kom__h">Комментарий команды Делоскопа</div>' +
str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) +
'<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · нормы сверены " + esc(k.data) : "") + "</div></div>";
}
function nerazryv(uzel) {
try { var w = typeof window !== "undefined" ? window : null; if (uzel && w && w.dlkNerazryv) w.dlkNerazryv.obernut(uzel); } catch (e) {}
}
var obeshchanie = null;
function zagruzit(url) {
if (!obeshchanie) {
obeshchanie = (typeof fetch === "function" ? fetch(url || "/data/kommentarii.json", { cache: "no-cache" })
.then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
.catch(function () { return null; });
}
return obeshchanie;
}
function vstavit(tablica, signals, sprav) {
if (!tablica || !sprav) return 0;
var n = 0;
(signals || []).forEach(function (s, i) {
var k = najti(sprav, s);
var tr = tablica.querySelector('tr[data-sig="' + i + '"]');
if (!k || !tr || (tr.nextSibling && tr.nextSibling.className === "kom-tr")) return;
var nov = tr.ownerDocument.createElement("tr");
nov.className = "kom-tr";
nov.innerHTML = '<td colspan="2">' + html(k) + "</td>";
tr.parentNode.insertBefore(nov, tr.nextSibling);
nerazryv(nov);
n++;
});
if (tablica.querySelector(".kom-tr") && tablica.parentNode && tablica.parentNode.querySelector) postavitOgovorku(tablica.parentNode, tablica, "p");
return n;
}
var BEZ = { predel: 1, zaprosit: 1, ne_znaem: 1, podlinnost: 1, indeks: 1 };
var TON_FAKTA = { ok: "ok", warn: "warn", bad: "bad" };
function dlyaFaktov(razdely, signals, sprav) {
if (!sprav) return [];
var vzyat = {}, out = [];
(razdely || []).forEach(function (x) {
if (!x || BEZ[x.id] || x.vid === "sluzhebnyj") return;
(x.fakty || []).forEach(function (f, i) {
var t = String((f && f.tekst) || "");
if (!t) return;
for (var j = 0; j < (signals || []).length; j++) {
var s = signals[j];
if (vzyat[j] || String((s && s.title) || "") !== t || TON_FAKTA[s.status] !== f.ton) continue;
vzyat[j] = 1;
var k = najti(sprav, s);
if (k) out.push({ f: x.id + ":" + i, k: k });
return;
}
});
});
return out;
}
function vstavitFakty(koren, spisok) {
if (!koren || !spisok) return 0;
var n = 0, posl = null;
spisok.forEach(function (v) {
var tr = koren.querySelector('tr[data-f="' + v.f + '"]');
if (!tr) return;
if (tr.nextSibling && tr.nextSibling.className === "kom-tr") { posl = tr; return; }
var nov = tr.ownerDocument.createElement("tr");
nov.className = "kom-tr";
nov.innerHTML = '<td colspan="2">' + html(v.k) + "</td>";
tr.parentNode.insertBefore(nov, tr.nextSibling);
nerazryv(nov);
posl = tr; n++;
});
var t = posl;
while (t && t.tagName !== "TABLE") t = t.parentNode;
if (t) postavitOgovorku(koren, t, "p");
return n;
}
var OGOVORKA = "Комментарий команды — общий: он объясняет, как банки и налоговая смотрят на такой признак. Это не оценка этой компании или сделки и не юридическая консультация.";
function ogovorkaHtml() { return '<p class="kom-og">' + esc(OGOVORKA) + "</p>"; }
function postavitOgovorku(koren, posle, teg) {
if (!koren || !posle || !posle.parentNode || koren.querySelector(".kom-og")) return false;
var el = posle.ownerDocument.createElement(teg || "p");
el.className = "kom-og";
el.textContent = OGOVORKA;
posle.parentNode.insertBefore(el, posle.nextSibling);
return true;
}
var TON_EKRANA = { ok: "ok", info: "ok", warn: "warn", bad: "bad" };
var SVOI_FAKTY = { kapital: 1, likvidnost: 1 };
function dlyaSut(spisok, signals, sprav) {
if (!sprav) return [];
var out = [];
(spisok || []).forEach(function (f) {
if (!f || !f.k) return;
if (SVOI_FAKTY[f.k]) {
if (f.ton !== "warn") return;
var ks = najti(sprav, { title: String(f.nazv || ""), status: "warn", detail: String(f.znach || "") });
if (ks) out.push({ k: f.k, kom: ks });
return;
}
for (var j = 0; j < (signals || []).length; j++) {
var s = signals[j];
if (!s || !s.title || (s.id || "sig" + j) !== f.k) continue;
if (TON_EKRANA[s.status] !== f.ton) return;
var k = najti(sprav, s);
if (k) out.push({ k: f.k, kom: k });
return;
}
});
return out;
}
var CSS_EKRANA = ".sut .kom{margin:-4px 0 12px;padding:10px 14px;border-left:3px solid var(--line,#E5E5E0);background:#FAFAF8;" +
"border-radius:0 10px 10px 0;font-size:15px;line-height:1.5;color:var(--ink,#1D1D1F)}" +
".sut .kom--zel{border-left-color:var(--ok,#1E7F4F)}.sut .kom--zhel{border-left-color:var(--warn,#B26B00)}.sut .kom--kras{border-left-color:var(--bad,#C0362C)}" +
".sut .kom__h{font-weight:600;font-size:13px;letter-spacing:.02em;color:var(--ink2,#48484C);margin-bottom:4px}" +
".sut .kom p{margin:2px 0}.sut .kom__l{font-weight:600}.sut .kom__p{color:var(--muted,#6B6B70);font-size:12px;margin-top:6px}" +
".kom-og{margin:4px 0 12px;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70)}" +
"@media print{.sut .kom{background:none;break-inside:avoid}}";
function stil(doc) {
if (!doc || !doc.createElement || doc.getElementById("kom-css")) return;
var s = doc.createElement("style"); s.id = "kom-css"; s.textContent = CSS_EKRANA;
(doc.head || doc.documentElement).appendChild(s);
}
function vstavitSut(koren, spisok) {
if (!koren || !spisok || !spisok.length) return 0;
var n = 0, posl = null;
spisok.forEach(function (v) {
var row = koren.querySelector('.sut__r[data-fakt="' + String(v.k).replace(/["\\]/g, "") + '"]');
if (!row) return;
var sl = row.nextSibling;
if (sl && /(^| )kom( |$)/.test(sl.className || "")) { posl = sl; return; }
var w = row.ownerDocument.createElement("div");
w.innerHTML = html(v.kom);
var el = w.firstChild;
if (!el) return;
row.parentNode.insertBefore(el, row.nextSibling);
nerazryv(el);
posl = el; n++;
});
if (posl) {
try { stil(koren.ownerDocument); } catch (e) {}
var vse = koren.querySelectorAll ? koren.querySelectorAll(".sut__r") : [];
var kon = vse.length ? vse[vse.length - 1] : posl;
if (kon.nextSibling && /(^| )kom( |$)/.test(kon.nextSibling.className || "")) kon = kon.nextSibling;
postavitOgovorku(koren, kon, "p");
}
return n;
}
var TON_VYP = { bad: "kras", warn: "zhel", info: "sery" };
function dlyaOrg(o) {
return !!(o && o.tekst && o.proveril && dataRu(o.data_proverki) && String(o.tekst).length <= MAKS);
}
function vypiska(sprav, kod, klient) {
var list = (sprav && sprav.vypiska && sprav.vypiska.zapisi) || [];
for (var i = 0; i < list.length; i++) {
var z = list[i];
if (!z || z.kod !== kod) continue;
if (!TON_VYP[z.uroven] || !gotov(z.ton)) return null;
var t = z.ton, norma = t.norma != null ? t.norma : z.norma, org = "";
if (klient === "org" && dlyaOrg(t.dlya_organizacii)) {
org = t.dlya_organizacii.tekst;
var n2 = t.dlya_organizacii.norma || "";
if (n2 && String(norma || "").indexOf(n2) < 0) norma = norma ? norma + "; " + n2 : n2;
}
return { id: z.id, ton: TON_VYP[z.uroven], bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat, org: org,
norma: norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
}
return null;
}
function vypiskaHtml(sprav, kod, klient) {
var k = vypiska(sprav, kod, klient);
if (!k) return "";
var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
return '<details class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
'<summary class="kom__h">Комментарий команды Делоскопа</summary>' +
str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) + str("Компании:", k.org) +
'<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · нормы сверены " + esc(k.data) : "") + "</div></details>";
}
function estVypiska(sprav) {
var list = (sprav && sprav.vypiska && sprav.vypiska.zapisi) || [];
for (var i = 0; i < list.length; i++) if (list[i] && vypiska(sprav, list[i].kod)) return true;
return false;
}
return { TON: TON, MAKS: MAKS, OGOVORKA: OGOVORKA, ogovorkaHtml: ogovorkaHtml, postavitOgovorku: postavitOgovorku,
dlyaSut: dlyaSut, vstavitSut: vstavitSut, CSS_EKRANA: CSS_EKRANA, gotov: gotov, istochnikOtvetil: istochnikOtvetil, NE_OTVETIL: NE_OTVETIL, zapis: zapis, najti: najti, html: html, zagruzit: zagruzit, vstavit: vstavit, dlina: dlina,
dlyaFaktov: dlyaFaktov, vstavitFakty: vstavitFakty,
TON_VYP: TON_VYP, vypiska: vypiska, vypiskaHtml: vypiskaHtml, estVypiska: estVypiska };
});
;
/* --- /js/otkuda.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Otkuda = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var POKA_NE = 'эти реестры мы пока не проверяем';
var OBESHCHANIE = /завтра|тариф|сегодн|запас|временно|позже/i;
var PLATNYJ = /[\s,;—-]*(?:или\s+)?(?:откройте|откроется)[^.;]*тариф[^.;]*/gi;
var NB = '\u00a0';
var DAMIA_PORYADOK = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];
var DAMIA_CHTO = { sudy: 'дела, где компания — сторона', bankrotstvo: 'дела о банкротстве', fssp: 'исполнительные производства',
priostanovki: 'решения о приостановлении операций по счетам', mery: 'запрет распоряжаться имуществом',
rnp: 'записи о недобросовестном поставщике', kontrakty: 'контракты 44-ФЗ и 223-ФЗ' };
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
return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
}
function skl(n, a, b, c) {
var m10 = n % 10, m100 = n % 100;
return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
}
function ip(r) { return String(((r || {}).company || {}).inn || '').length === 12; }
function bank(c) { return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || '')); }
var BANK_GIRBO = 'организация сдаёт её в' + NB + 'Банк России; в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)';
var CBR_BANK = 'https://www.cbr.ru/finorg/foinfo/';
function nw(h) { return String(h).replace(/(\d+-ФЗ\))/g, '<span style="white-space:nowrap">$1</span>'); }
function chistyj(u) { return /^https:\/\/[^\s"<>]+$/.test(u || '') ? u : ''; }
function datyNaborov(s) {
return String(s || '').split(';').map(function (ch) {
var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
return m ? { metka: m[1], data: m[2] } : null;
}).filter(Boolean);
}
function godyRyada(ch) {
var g = {};
['revenue', 'profit', 'income_tax'].forEach(function (k) {
(Array.isArray((ch || {})[k]) ? ch[k] : []).forEach(function (x) {
if (x && isFinite(parseInt(x.year, 10)) && x.value != null && x.value !== '' && isFinite(Number(x.value))) g[parseInt(x.year, 10)] = 1;
});
});
return Object.keys(g).map(Number).sort(function (a, b) { return a - b; });
}
function istochniki(r, opt) {
opt = opt || {};
if (!r || !r.company) return { spisok: [], otvetili: 0, oprosheno: 0, dataPr: '' };
var c = r.company, fl = ip(r), reestr = fl ? 'ЕГРИП' : 'ЕГРЮЛ';
var t = Date.parse(r.checked_at || ''), msk = new Date((isFinite(t) ? t : (opt.segodnya || new Date()).getTime()) + 3 * 3600 * 1000);
var dataPr = z(msk.getUTCDate()) + '.' + z(msk.getUTCMonth() + 1) + '.' + msk.getUTCFullYear();
var D = r.dossier || {}, daty = datyNaborov(D.data_dates);
function dataPo(re) { for (var i = 0; i < daty.length; i++) if (re.test(daty[i].metka)) return daty[i].data; return ''; }
var spisok = [];
var dEgr = dataPo(/^ЕГР(ЮЛ|ИП)/i);
var chtoEgr = fl ? 'статус, дата регистрации, виды деятельности' : 'статус, адрес и отметки о недостоверности, руководитель, дата регистрации, виды деятельности';
spisok.push({ k: 'egrul', znak: '●', nazv: reestr + ' (ФНС)', chto: chtoEgr, data: dEgr ? 'на' + NB + dEgr : 'на' + NB + dataPr, status: 'ok' });
var dIzm = dataPo(/последнее изменение/i);
if (dIzm) spisok[0].dop = 'последнее изменение записи — ' + dIzm;
var gruppy = {}, poryadok = [];
(r.signals || []).forEach(function (s) {
if (!s || !s.source || /^ЕГР(ЮЛ|ИП)/.test(s.source)) return;
var key = String(s.source);
if (!gruppy[key]) { gruppy[key] = { chto: [], data: '' }; poryadok.push(key); }
if (s.title) gruppy[key].chto.push(String(s.title).toLowerCase());
if (s.as_of && !gruppy[key].data) gruppy[key].data = dmy(s.as_of);
});
var dPay = dataPo(/уплаченные налоги/i);
poryadok.forEach(function (key) {
var g = gruppy[key];
var dat = g.data || (/ФНС/.test(key) ? dataPo(/задолженность/i) : '');
spisok.push({ k: 'sig:' + key, znak: '●', nazv: key, chto: g.chto.join(', '), data: dat ? 'на' + NB + dat : '', status: 'ok' });
});
if (dPay && !poryadok.some(function (k) { return /ФНС/.test(k); })) {
spisok.push({ k: 'paytax', znak: '●', nazv: 'ФНС, открытые данные', chto: 'уплаченные налоги и взносы', data: 'на' + NB + dPay, status: 'ok' });
}
if (!fl) {
var gody = godyRyada(D.charts);
if (gody.length) {
var pos = gody[gody.length - 1];
spisok.push({ k: 'girbo', znak: '●', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность: выручка, прибыль, налог на прибыль',
data: gody.length > 1 ? 'за ' + gody[0] + '–' + pos + NB + 'гг.' : 'за ' + pos + NB + 'г.', status: 'ok' });
} else if (bank(c)) {
spisok.push({ k: 'girbo', znak: '○', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность', data: '', status: 'net',
prichina: BANK_GIRBO, ssylka: CBR_BANK + (/^\d{13}$/.test(String(c.ogrn || '')) ? '?ogrn=' + c.ogrn : '') });
} else {
spisok.push({ k: 'girbo', znak: '○', nazv: 'ГИР БО (ФНС)', chto: 'бухотчётность', data: '', status: 'net',
prichina: 'отчётности в ответе нет', ssylka: 'https://bo.nalog.gov.ru/' });
}
}
var dm = r.damia || {};
DAMIA_PORYADOK.concat(Object.keys(dm).filter(function (k) { return DAMIA_PORYADOK.indexOf(k) < 0; })).forEach(function (k) {
var b = dm[k];
if (!b || typeof b !== 'object' || !b.nazvanie || !b.status || b.status === 'not_applicable') return;
var otv = b.status === 'found' || b.status === 'not_found';
var nep = !otv && b.sostoyanie === 'not_checked';
spisok.push({ k: 'damia:' + k, znak: otv ? '●' : nep ? '–' : '○', nazv: b.nazvanie, chto: DAMIA_CHTO[k] || '',
dop: otv && b.iz_egryul ? 'по отметке в' + NB + 'ЕГРЮЛ, ' + (b.ogovorka || 'сообщения ЕФРСБ не проверяли') : otv && b.tochnost && b.tochnost !== 'inn' ? 'сопоставили по' + NB + 'названию и' + NB + 'адресу' : '',
data: otv ? 'на' + NB + (dmy(b.data_svedeniy) || dataPr) : '', status: otv ? 'ok' : nep ? 'nep' : 'net',
prichina: otv ? '' : nep ? (b.prichina && !OBESHCHANIE.test(b.prichina) ? b.prichina : POKA_NE) : (String(b.prichina || '').replace(PLATNYJ, '').replace(/\s+$/, '') || 'ответа нет'), ssylka: otv ? '' : chistyj(b.proverit_samim) });
});
var nep = spisok.filter(function (x) { return x.status === 'nep'; }).length;
var oprosheno = spisok.length - nep, otvetili = spisok.filter(function (x) { return x.status === 'ok'; }).length;
var rasch = [];
if (r.risk_title) rasch.push('светофор риска');
if (r.zsk && r.zsk.title) rasch.push('прогноз ЗСК — наша оценка, не статус Банка России');
if (rasch.length) spisok.push({ k: 'raschet', znak: '◆', nazv: 'Расчёт Делоскопа', chto: rasch.join('; '), data: dataPr, status: 'raschet', ssylka: '/indeks/' });
return { spisok: spisok, otvetili: otvetili, oprosheno: oprosheno, nep: nep, dataPr: dataPr };
}
function samiT(url) {
var I = typeof self !== 'undefined' && self.DlkIstochniki;
try { return I && I.samiTekst ? I.samiTekst(url) : 'проверьте сами'; } catch (e) { return 'проверьте сами'; }
}
function stroka(x) {
var st = x.status === 'ok' ? 'ответил' : x.status === 'net' ? 'не ответил' : x.status === 'nep' ? 'не проверяли' : 'рассчитано';
var hvost = x.status === 'net' || x.status === 'nep'
? (x.prichina ? nw(esc(x.prichina)) : '') + (x.ssylka ? (x.prichina ? ' · ' : '') + '<a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener">' + esc(samiT(x.ssylka)) + '</a>' : '') || (x.status === 'nep' ? 'не проверяли' : 'не ответил')
: x.status === 'raschet' ? '<a href="' + esc(x.ssylka) + '">методика</a>' : esc(x.data || '');
return '<li class="otk__r otk__r--' + x.status + '" data-ist="' + esc(x.k) + '">' +
'<span class="otk__z" aria-label="' + st + '">' + x.znak + '</span>' +
'<span class="otk__n"><b>' + esc(x.nazv) + '</b>' + (x.chto ? '<small>' + esc(x.chto) + (x.dop ? '; ' + esc(x.dop) : '') + '</small>' : '') + '</span>' +
'<span class="otk__d">' + hvost + '</span></li>';
}
function html(r, opt) {
var o = istochniki(r, opt);
if (!o.spisok.length) return '';
var net = o.spisok.filter(function (x) { return x.status === 'net'; }), obshchaya = '';
if (net.length > 1 && net.every(function (x) { return x.prichina && x.prichina === net[0].prichina; })) {
obshchaya = net[0].prichina;
o.spisok = o.spisok.map(function (x) { return x.status === 'net' ? Object.assign({}, x, { prichina: '' }) : x; });
}
var nepS = o.spisok.filter(function (x) { return x.status === 'nep'; }), obshchayaNep = '';
if (nepS.length > 1 && nepS.every(function (x) { return x.prichina && x.prichina === nepS[0].prichina; })) {
obshchayaNep = nepS[0].prichina;
o.spisok = o.spisok.map(function (x) { return x.status === 'nep' ? Object.assign({}, x, { prichina: '' }) : x; });
}
var tochki = o.spisok.filter(function (x) { return x.status !== 'raschet'; }).map(function (x) { return x.znak; }).join('');
var nepTekst = o.nep ? ' · ' + o.nep + NB + skl(o.nep, 'реестр', 'реестра', 'реестров') + ' не' + NB + 'проверяли' : '';
return '<details class="otk"><summary><span class="otk__t">Откуда данные</span>' +
'<span class="otk__s">' + skl(o.otvetili, 'ответил', 'ответили', 'ответили') + ' ' + o.otvetili + ' из ' + o.oprosheno + NB + skl(o.oprosheno, 'запрошенного', 'запрошенных', 'запрошенных') +
nepTekst + ' · проверка ' + o.dataPr + '</span><span class="otk__m" aria-hidden="true">' + tochki + '</span></summary>' +
'<ul>' + o.spisok.map(stroka).join('') + '</ul>' +
(obshchaya ? '<p class="otk__p otk__p--net">Не ответили ' + net.length + ' из ' + o.oprosheno + ': ' + nw(esc(obshchaya)) + '.</p>' : '') +
(obshchayaNep ? '<p class="otk__p otk__p--net">Не проверяли ' + nepS.length + NB + skl(nepS.length, 'реестр', 'реестра', 'реестров') + (obshchayaNep === POKA_NE ? ' — мы их пока не' + NB + 'проверяем' : ': ' + nw(esc(obshchayaNep))) + '. Ссылки «проверьте сами» — в строках выше.</p>' : '') +
'<p class="otk__p">● ответил' + (net.length || !o.nep ? ' · ○ не ответил' : '') + (o.nep ? ' · – не проверяли' : '') + ' — не значит «не нашли» · ◆ рассчитано Делоскопом. Это оценка риска, а не решение банка.</p></details>';
}
var CSS = '.otk{margin-top:12px;border-top:1px solid var(--line,#E6E6E1);font-size:13px;color:var(--ink2,#48484C)}' +
'.otk summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:12px 0}' +
'.otk summary::-webkit-details-marker{display:none}' +
'.otk__t{font-size:15px;font-weight:600;color:var(--ink,#1D1D1F)}' +
'.otk__t::after{content:"";display:inline-block;width:6px;height:6px;margin-left:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-3px) rotate(45deg);transition:transform .2s}' +
'.otk[open] .otk__t::after{transform:translateY(0) rotate(225deg)}' +
'.otk__s{font-variant-numeric:tabular-nums;color:var(--muted,#6B6B70)}' +
'.otk__m{margin-left:auto;letter-spacing:2px;color:var(--muted,#6B6B70);font-size:12px}' +
'.otk ul{list-style:none;margin:0;padding:0}' +
'.otk__r{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:4px 10px;padding:8px 0;border-top:1px solid #EFEFEA;align-items:baseline}' +
'.otk__z{color:var(--ok,#16723F)}.otk__r--net .otk__z,.otk__r--nep .otk__z{color:var(--muted,#6B6B70)}.otk__r--raschet .otk__z{color:var(--ink2,#48484C)}' +
'.otk__n{display:grid;gap:2px;min-width:0}.otk__n b{font-weight:500;color:var(--ink,#1D1D1F)}.otk__n small{font-size:12px;color:var(--muted,#6B6B70)}' +
'.otk__d{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.otk__d a{color:var(--accent,#0B63E5)}' +
'.otk__r--net .otk__d,.otk__r--nep .otk__d{white-space:normal;max-width:220px}' +
'.otk__p{margin:8px 0 0;font-size:12px;color:var(--muted,#6B6B70)}' +
'@media (max-width:520px){.otk__r{grid-template-columns:16px minmax(0,1fr)}.otk__d{grid-column:2;text-align:left;white-space:normal;max-width:none}.otk__m{display:none}}' +
'@media print{.otk:not([open])>*:not(summary){display:block}.otk__m{display:none}}';
function stil(doc) {
if (!doc || doc.getElementById('otk-css')) return;
var s = doc.createElement('style'); s.id = 'otk-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function mount(el, r, opt) {
if (!el) return false;
var h = '';
try { h = html(r, opt); } catch (e) { h = ''; }
if (!h) return false;
try { stil(el.ownerDocument || document); } catch (e) {}
var w = (el.ownerDocument || document).createElement('div');
w.innerHTML = h;
el.parentNode.replaceChild(w.firstChild, el);
return true;
}
return { istochniki: istochniki, datyNaborov: datyNaborov, html: html, mount: mount, CSS: CSS };
});
;
/* --- /js/reestry-sami.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.ReestrySami = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0';
var DOMENY = /^https:\/\/(www\.)?(reestr-zalogov\.ru|rmsp\.nalog\.ru|fips\.ru|fedresurs\.ru|pub\.fsa\.gov\.ru|reestr\.nostroy\.ru|reestr\.nopriz\.ru|mintrans\.gov\.ru|cbr\.ru|[a-z0-9-]+\.nalog\.(ru|gov\.ru))\//;
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function dmy(s) {
var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
}
function nb(t) {
return String(t).replace(/(^|\s)(п\.|ч\.|ст\.|пп\.) /g, '$1$2' + NB).replace(/(\d) (тыс\.|млн|млрд) ₽/g, '$1' + NB + '$2' + NB + '₽').replace(/ (\d+-ФЗ|ГК РФ)/g, NB + '$1').replace(/ГК РФ/g, 'ГК' + NB + 'РФ');
}
function kodOkved(r) {
var k = String((((r || {}).company) || {}).okved == null ? '' : r.company.okved).trim();
return /^\d{2}(\.\d{1,2}){0,2}$/.test(k) ? k : '';
}
function podPrefiks(kod, pr) {
pr = String(pr || '');
if (!pr || !kod) return false;
return kod === pr || kod.indexOf(/\.\d$/.test(pr) ? pr : pr + '.') === 0;
}
function poOkved(x, kod) {
if (!Array.isArray(x.okved)) return true;
if (!kod) return false;
var da = x.okved.some(function (p) { return podPrefiks(kod, p); });
var net = Array.isArray(x.okved_krome) && x.okved_krome.some(function (p) { return podPrefiks(kod, p); });
return da && !net;
}
function dlya(r, sprav) {
var inn = String((((r || {}).company) || {}).inn || '');
if (!/^\d{10}$/.test(inn) || !sprav || !Array.isArray(sprav.reestry)) return [];
var kod = kodOkved(r);
var vse = sprav.reestry.filter(function (x) {
return x && x.id && x.nazv && x.chto && x.norma && DOMENY.test(x.ssylka || '') && poOkved(x, kod);
}).map(function (x) {
return Array.isArray(x.okved) ? Object.assign({}, x, { okvedKod: kod }) : x;
});
return vse.filter(function (x) { return x.okvedKod; }).concat(vse.filter(function (x) { return !x.okvedKod; }));
}
function samiT(url) {
var I = typeof self !== 'undefined' && self.DlkIstochniki;
try { return I && I.samiTekst ? I.samiTekst(url) : 'проверьте сами'; } catch (e) { return 'проверьте сами'; }
}
function html(spisok, sprav) {
if (!spisok || !spisok.length) return '';
var d = dmy((sprav || {}).svereno);
return '<section class="sut__s rs" data-reestry-sami><h4>Что ещё проверить самим в открытых реестрах</h4><dl>' +
spisok.map(function (x) {
return '<div data-reestr="' + esc(x.id) + '"' + (x.okvedKod ? ' data-okved' : '') + '><dt>' + esc(nb(x.nazv)) + '<small>' + esc(nb(x.kogda || '')) + '</small></dt>' +
'<dd>' + esc(nb(x.chto)) + ' <a href="' + esc(x.ssylka) + '" target="_blank" rel="noopener"' +
(x.cel ? ' data-goal="' + esc(x.cel) + '"' : '') + '>' + esc(samiT(x.ssylka)) + '</a>' +
'<small class="rs__m">' + esc(nb([x.okvedKod ? 'по основному ОКВЭД' + NB + x.okvedKod : '', x.kto, x.obnovlenie ? 'обновление: ' + x.obnovlenie : '', x.norma,
x.okvedKod && dmy(x.svereno) ? 'сверено ' + dmy(x.svereno) : ''].filter(Boolean).join(' · '))) + '</small></dd></div>';
}).join('') + '</dl>' +
'<p>Эти реестры Делоскоп пока не опрашивает — результат проверки их не учитывает.' + (d ? ' Ссылки и нормы сверены ' + d + '.' : '') + '</p></section>';
}
var CSS = '.rs dt{align-content:start}.rs dt small{margin-top:2px}.rs dd .rs__m{display:block;margin-top:4px;font-size:12px;color:var(--muted,#6B6B70)}.rs dd a{color:inherit;text-decoration:underline}';
var obeshchanie = null;
function zagruzit(url) {
if (!obeshchanie) {
obeshchanie = (typeof fetch === 'function' ? fetch(url || '/data/reestry-sami.json', { cache: 'no-cache' })
.then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
.catch(function () { return null; });
}
return obeshchanie;
}
function vstavit(g, sprav, r) {
if (!g || g.querySelector('[data-reestry-sami]')) return false;
var h = html(dlya(r, sprav), sprav);
if (!h) return false;
var doc = g.ownerDocument || document;
if (!doc.getElementById('rs-css')) {
var s = doc.createElement('style'); s.id = 'rs-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
var d = g.querySelector('.sut__d');
if (d) d.insertAdjacentHTML('beforebegin', h); else g.insertAdjacentHTML('beforeend', h);
return true;
}
return { dlya: dlya, html: html, podPrefiks: podPrefiks, zagruzit: zagruzit, vstavit: vstavit, DOMENY: DOMENY, CSS: CSS };
});
;
/* --- /js/rekvizity-proverki.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.RekvizityProverki = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0';
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function z(n) { return (n < 10 ? '0' : '') + n; }
function data(s) {
if (!s) return null;
var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s).trim());
if (m) return { klyuch: +(m[3] + m[2] + m[1]), tekst: m[1] + '.' + m[2] + '.' + m[3] };
m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
if (m) return { klyuch: +(m[1] + m[2] + m[3]), tekst: m[3] + '.' + m[2] + '.' + m[1] };
return null;
}
function chistyjNomer(id) {
var s = String(id == null ? '' : id).trim();
return /^[0-9A-Za-z-]{1,40}$/.test(s) ? s : '';
}
function poslednijGod(ch) {
var g = 0;
(Array.isArray((ch || {}).revenue) ? ch.revenue : []).forEach(function (x) {
var y = parseInt(x && x.year, 10);
if (isFinite(y) && x.value != null && x.value !== '' && isFinite(Number(x.value)) && y > g) g = y;
});
return g || null;
}
function poMoskve(t) {
var m = new Date(t + 3 * 3600 * 1000);
return { data: z(m.getUTCDate()) + '.' + z(m.getUTCMonth() + 1) + '.' + m.getUTCFullYear(),
vremya: z(m.getUTCHours()) + ':' + z(m.getUTCMinutes()),
klyuch: +(m.getUTCFullYear() + z(m.getUTCMonth() + 1) + z(m.getUTCDate())) };
}
var TOLKO_DATA = /^\s*\d{4}-\d{2}-\d{2}\s*$/;
function sobrat(r, opt) {
if (!r || !r.company) return null;
opt = opt || {};
var s = r.checked_at || '';
var o = { nomer: chistyjNomer(r.report_id), data: '', vremya: '', davnie: null, otchetnost: null };
var segodnya = 0;
if (TOLKO_DATA.test(s)) {
var d0 = data(s);
o.data = d0.tekst; segodnya = d0.klyuch;
var pt = opt.polucheno instanceof Date ? opt.polucheno.getTime() : Number(opt.polucheno);
if (opt.polucheno != null && isFinite(pt)) {
var p = poMoskve(pt);
if (p.klyuch === segodnya) o.vremya = p.vremya;
}
} else {
var t = Date.parse(s);
if (isFinite(t)) {
var m = poMoskve(t);
o.data = m.data; o.vremya = m.vremya; segodnya = m.klyuch;
}
}
(r.signals || []).forEach(function (x) {
var d = x && data(x.as_of);
if (!d || (segodnya && d.klyuch > segodnya)) return;
if (!o.davnie || d.klyuch < o.davnie.klyuch) o.davnie = { klyuch: d.klyuch, data: d.tekst, istochnik: String(x.source || '').split(':')[0].trim() };
});
if (o.davnie && o.davnie.klyuch === segodnya) o.davnie = null;
if (o.davnie) delete o.davnie.klyuch;
o.otchetnost = poslednijGod((r.dossier || {}).charts);
if (!o.data && !o.nomer) return null;
return o;
}
function html(r, opt) {
var o = sobrat(r, opt);
if (!o) return '';
var p = [];
if (o.nomer) p.push(['Проверка №', '<span class="rkv__nom">' + esc(o.nomer) + '</span>']);
if (o.data) p.push(['Проверено', esc(o.data) + (o.vremya ? ', ' + esc(o.vremya) + NB + 'МСК' : '')]);
if (o.davnie) p.push(['Самые давние сведения', esc(o.davnie.data) + (o.davnie.istochnik ? '<small>' + esc(o.davnie.istochnik) + '</small>' : '')]);
if (o.otchetnost) p.push(['Бухотчётность', 'за ' + o.otchetnost + NB + 'год<small>ГИР БО</small>']);
return '<dl class="rkv">' + p.map(function (x) {
return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>';
}).join('') + '</dl>';
}
var CSS = '.rkv{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:0;border-top:1px solid var(--line,#E6E6E1);border-bottom:1px solid var(--line,#E6E6E1)}' +
'.rkv>div{padding:10px 12px 10px 0;min-width:0}.rkv>div:nth-child(even){border-left:1px solid #EFEFEA;padding-left:12px}' +
'.rkv>div:nth-child(n+3){border-top:1px solid #EFEFEA}' +
'.rkv dt{font-size:12px;color:var(--muted,#6B6B70);letter-spacing:.02em;margin:0 0 2px}' +
'.rkv dd{margin:0;font-size:15px;font-weight:600;color:var(--ink,#1D1D1F);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}' +
'.rkv dd small{display:block;font-size:12px;font-weight:400;color:var(--muted,#6B6B70)}' +
'.rkv__nom{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:500;letter-spacing:.02em}' +
'@media print{@page{margin:14mm}html,body{background:#fff!important}.rkv-skryt{display:none!important}' +
'.report{box-shadow:none!important;border-radius:0!important;padding:0!important;max-width:none!important;width:auto!important;grid-column:1/-1!important}' +
'.report-actions,.otz{display:none!important}.rkv,.rows .row{break-inside:avoid}' +
'.rkv,.pill,.row b{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
function stil(doc) {
if (!doc || doc.getElementById('rkv-css')) return;
var s = doc.createElement('style'); s.id = 'rkv-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function pechatTolkoOtchet(report) {
var doc = report.ownerDocument || document;
var n = report;
while (n && n.parentNode && n !== doc.body) {
var p = n.parentNode;
for (var i = 0; i < p.children.length; i++) {
var s = p.children[i];
if (s !== n && !/^(SCRIPT|STYLE|LINK|META)$/.test(s.tagName)) s.classList.add('rkv-skryt');
}
n = p;
}
}
function mount(report, r, opt) {
if (!report) return false;
var h = '';
try { h = html(r, opt); } catch (e) { h = ''; }
var doc = report.ownerDocument || document;
try { stil(doc); } catch (e) {}
try { pechatTolkoOtchet(report); } catch (e) {}
if (!h) return false;
var head = report.querySelector('.report-head');
var tag = report.querySelector('.report-head .tag');
if (tag && /^Проверка на /.test(tag.textContent)) tag.textContent = 'Отчёт о проверке контрагента';
var w = doc.createElement('div');
w.innerHTML = h;
if (head && head.parentNode) head.parentNode.insertBefore(w.firstChild, head.nextSibling);
else report.insertBefore(w.firstChild, report.firstChild);
var act = report.querySelector('.report-actions');
if (act && !act.querySelector('.btn-doc') && typeof window !== 'undefined' && window.print) {
var b = doc.createElement('button');
b.type = 'button'; b.setAttribute('data-act', 'print'); b.textContent = 'Распечатать';
b.onclick = function () { window.print(); };
var again = act.querySelector('[data-act="again"]');
act.insertBefore(b, again || null);
}
return true;
}
return { sobrat: sobrat, html: html, mount: mount, data: data, CSS: CSS };
});
;
/* --- /js/perepoverit.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Perepoverit = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var DNEJ = 30;
var NB = '\u00a0';
var SAJT = 'https://deloskop.ru/';
function z(n) { return (n < 10 ? '0' : '') + n; }
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function denProverki(s) {
s = String(s || '').trim();
var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
var t = Date.parse(s);
if (!isFinite(t)) return null;
var d = new Date(t + 3 * 3600 * 1000);
return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function ru(t) { var d = new Date(t); return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
function ymd(t) { var d = new Date(t); return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()); }
function chistyjInn(s) { s = String(s == null ? '' : s).replace(/\D/g, ''); return /^(\d{10}|\d{12})$/.test(s) ? s : ''; }
function srok(r) {
if (!r || !r.company) return null;
var c = r.company;
var inn = chistyjInn(c.inn);
var den = denProverki(r.checked_at);
if (!inn || den == null) return null;
var dodo = den + DNEJ * 864e5;
return {
inn: inn,
imya: String(c.name_short || c.name_full || ('ИНН ' + inn)).replace(/\s+/g, ' ').trim(),
proveren: ru(den), 'do': ru(dodo),
napomnit: ymd(dodo - 864e5), konec: ymd(dodo),
ssylka: SAJT + '?inn=' + inn + '&utm_source=ics'
};
}
function tekst(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function slozhit(line) {
var out = [], cur = '', n = 0, lim = 75;
for (var i = 0; i < line.length; i++) {
var ch = line[i], code = line.charCodeAt(i);
if (code >= 0xD800 && code <= 0xDBFF && i + 1 < line.length) { ch += line[++i]; }
var b = ch.length > 1 ? 4 : code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
if (n + b > lim) { out.push(cur); cur = ' '; n = 1; lim = 75; }
cur += ch; n += b;
}
out.push(cur);
return out.join('\r\n');
}
function shtamp(t) {
var d = new Date(t);
return d.getUTCFullYear() + z(d.getUTCMonth() + 1) + z(d.getUTCDate()) + 'T' + z(d.getUTCHours()) + z(d.getUTCMinutes()) + z(d.getUTCSeconds()) + 'Z';
}
function ics(s, seichas) {
if (!s) return '';
var zag = 'Перепроверить ' + s.imya + ' перед следующей оплатой';
var opis = 'Проверка в Делоскопе от ' + s.proveren + '. Перепроверить до ' + s['do'] +
': сведения реестров меняются, открытые данные ФНС обновляются раз в месяц.\n' + s.ssylka;
var L = [
'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Deloskop//Perepoverit//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
'BEGIN:VEVENT',
'UID:perepoverit-' + s.inn + '-' + s.konec + '@deloskop.ru',
'DTSTAMP:' + shtamp(seichas == null ? Date.now() : seichas),
'DTSTART;VALUE=DATE:' + s.napomnit,
'DTEND;VALUE=DATE:' + s.konec,
'SUMMARY:' + tekst(zag),
'DESCRIPTION:' + tekst(opis),
'URL:' + s.ssylka,
'TRANSP:TRANSPARENT',
'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT9H', 'DESCRIPTION:' + tekst(zag), 'END:VALARM',
'END:VEVENT', 'END:VCALENDAR'
];
return L.map(slozhit).join('\r\n') + '\r\n';
}
var POCHEMU = 'Сведения реестров меняются: запись ЕГРЮЛ — в любой день, открытые данные ФНС обновляются раз в' + NB + 'месяц.';
var KNOPKA = '<button type="button" class="pp__b" data-act="ics">Напомнить в' + NB + 'календаре</button>';
function kletka(s) {
if (!s) return '';
return '<div class="rkv__pp" data-pp><dt title="' + esc(POCHEMU) + '">Перепроверить до</dt><dd>' + esc(s['do']) +
'<small>через ' + DNEJ + NB + 'дней после проверки</small>' + KNOPKA + '</dd></div>';
}
function html(s) {
if (!s) return '';
return '<div class="pp" data-pp><p class="pp__t">Перепроверить до <b>' + esc(s['do']) + '</b>' +
'<small>' + esc(POCHEMU) + '</small></p>' + KNOPKA + '</div>';
}
var CSS = '.pp{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 0;border-bottom:1px solid var(--line,#E6E6E1)}' +
'.pp__t{margin:0;font-size:var(--t-15,15px);color:var(--ink,#1D1D1F);min-width:0}' +
'.pp__t b{font-weight:600;font-variant-numeric:tabular-nums}' +
'.pp__t small{display:block;font-size:var(--t-13,13px);color:var(--muted,#6B6B70);margin-top:2px}' +
'.pp__b{min-height:44px;border:1px solid var(--line,#D9D9D4);background:transparent;font:inherit;font-size:var(--t-15,15px);font-weight:600;' +
'border-radius:var(--r-small,10px);padding:10px 16px;cursor:pointer;color:var(--ink,#1D1D1F)}' +
'.pp__b:hover,.pp__b:focus-visible{border-color:var(--accent,#0B63E5);color:var(--accent,#0B63E5)}' +
'.rkv__pp .pp__b{display:block;margin-top:2px;min-height:44px;padding:0;border:0;font-size:var(--t-13,13px);color:var(--accent,#0B63E5);text-align:left;text-decoration:underline;text-underline-offset:3px}' +
'.rkv__pp .pp__b:hover,.rkv__pp .pp__b:focus-visible{text-decoration-thickness:2px}' +
'@media (max-width:600px){.pp .pp__b{width:100%}}' +
'@media print{.pp__b{display:none!important}}';
function stil(doc) {
if (!doc || doc.getElementById('pp-css')) return;
var st = doc.createElement('style'); st.id = 'pp-css'; st.textContent = CSS; (doc.head || doc.documentElement).appendChild(st);
}
function skachat(doc, s) {
var txt = ics(s);
var imya = 'perepoverit-' + s.inn + '.ics';
var url, blob = null;
try { blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' }); url = URL.createObjectURL(blob); }
catch (e) { url = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt); }
var a = doc.createElement('a');
a.href = url; a.download = imya; a.rel = 'noopener'; a.style.display = 'none';
(doc.body || doc.documentElement).appendChild(a);
a.click();
setTimeout(function () { a.remove(); if (blob) try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
}
function mount(report, r) {
if (!report) return false;
var s = srok(r);
if (!s) return false;
var doc = report.ownerDocument || document;
try { stil(doc); } catch (e) {}
var rkv = report.querySelector('.rkv');
var w = doc.createElement(rkv ? 'dl' : 'div');
w.innerHTML = rkv ? kletka(s) : html(s);
var el = w.firstChild;
var pod = report.querySelector('.report-head');
if (rkv) rkv.appendChild(el);
else if (pod && pod.parentNode) pod.parentNode.insertBefore(el, pod.nextSibling);
else report.insertBefore(el, report.firstChild);
var b = el.querySelector('[data-act="ics"]');
if (b) b.onclick = function () {
try { skachat(doc, s); } catch (e) {}
try { if (window.dlkGoal) window.dlkGoal('perepoverit_ics'); } catch (e) {}
b.textContent = 'Файл календаря скачан';
};
return true;
}
return { srok: srok, ics: ics, html: html, kletka: kletka, mount: mount, slozhit: slozhit, DNEJ: DNEJ, CSS: CSS };
});
;
/* --- /js/shchit.js --- */
(function (root, factory) {
var api = factory(root);
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Shchit = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
'use strict';
var SVERENO = false;
var SVERENO_NA = '02.10.2026';
var CBR_ZSK = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';
var T = {
zsk: {
b: { t: 'По открытым данным у компании есть признаки, по которым банки относят клиентов к повышенному риску. Это наш прогноз, не статус Банка России.', sver: true },
s: { t: 'Проверьте себя в сервисе Банка России — он показывает только «красную» зону. Если она есть, на заявление в МВК — 6 месяцев', norma: '(п. 1 ст. 7.8 115-ФЗ)', sver: true,
href: CBR_ZSK, knopka: 'Проверить в сервисе Банка России', ext: true, eshche: { href: '/skoraya-115-fz/?s=zsk', t: 'План, если зона красная' } }
},
nedost: {
b: { t: 'Отметка о недостоверности в ЕГРЮЛ — признак, на который банки обращают внимание.', sver: true },
n: { t: 'Если отметка держится больше 6 месяцев, инспекция может исключить компанию из ЕГРЮЛ', norma: '(пп. «б» п. 5 ст. 21.1 129-ФЗ)', sver: true, tolkoUL: true },
s: { t: 'Подайте исправленные или подтверждающие сведения в инспекцию.', href: '/nalogi/nedostovernyj-adres-egryul/', knopka: 'Как снять недостоверность' }
},
mass: {
b: { t: 'Массовый адрес или руководитель — признак, по которому банки ищут «технические» компании.', sver: true },
n: { t: 'Массовый адрес или руководитель — признак, по которому инспекция ищет «технические» компании.' },
s: { t: 'Держите под рукой договор аренды и фото офиса или вывески — их просят первыми.', href: '/nalogi/priznaki-tehnicheskoj-kompanii/', knopka: 'Признаки «технической» компании' }
},
young: {
b: { t: 'У компании младше года нет истории — банк внимательнее к крупным операциям.', sver: true },
s: { t: 'Первые месяцы — без транзита «пришло и ушло в тот же день»; к каждому крупному платежу — договор и акт.', sver: true, href: '/115-fz/zapros-banka-po-115-fz-kak-otvetit/', knopka: 'Как отвечать на запрос банка' }
},
staff: {
b: { t: 'Оборот без сотрудников банк сверяет с видом деятельности.', sver: true },
n: { t: 'Работы и услуги без людей — частый вопрос о реальности сделок', norma: '(ст. 54.1 НК РФ)', sver: true },
s: { t: 'Работаете с подрядчиками или самозанятыми — храните договоры и акты к каждому платежу.', href: '/nalogi/statya-54-1-nk-prostymi-slovami/', knopka: 'Статья 54.1 НК простыми словами' }
},
nagruzka: {
b: { t: 'Налоги, малые по сравнению с оборотом, банки замечают.', sver: true },
n: { t: 'Нагрузка ниже средней по отрасли — один из критериев отбора для выездной проверки.', sver: true },
s: { t: 'Подготовьте короткое объяснение: сезонность, вложения, убыток прошлого года.' }
},
dolg: {
b: { t: 'Долг по налогам может закончиться приостановкой расходных операций по счёту в пределах долга', norma: '(п. 2 ст. 76 НК РФ)', sver: true },
n: { t: 'Долг растёт пенями каждый день.', sver: true },
s: { t: 'Сверьте единый налоговый счёт в личном кабинете и погасите долг до требования.',
eshche: { href: '/praktika/nalogi/utochnenka-i-peni-ens/', t: 'Пени по старым периодам — проверьте уточнёнки' } }
},
fssp: {
b: { t: 'По исполнительному листу банк списывает деньги со счёта без согласия владельца', norma: '(ст. 8 229-ФЗ)', sver: true },
s: { t: 'Закройте долг и попросите постановление об окончании производства.' }
},
report: {
n: { t: 'Нет отчётности и операций 12 месяцев — компанию могут исключить из ЕГРЮЛ как недействующую', norma: '(п. 1 ст. 21.1 129-ФЗ)', sver: true, tolkoUL: true },
s: { t: 'Сдайте отчётность, даже нулевую.' }
},
director: {
b: { t: 'После смены руководителя банк обновляет сведения о клиенте и может запросить документы.', sver: true },
s: { t: 'Обновите анкету в банке сами, не дожидаясь запроса.' }
},
ubytki: {
b: { t: 'Убытки и отрицательные чистые активы банк учитывает при оценке платёжеспособности.', sver: true },
n: { t: 'Убытки два года и более — один из открытых критериев, по которым налоговая отбирает компании для выездной проверки',
norma: '(критерий 2, приказ ФНС от 30.05.2007 № ММ-3-06/333@)', dop: 'Проверка от этого не обязательна.', sver: true,
ist: 'https://www.consultant.ru/document/cons_doc_LAW_55729/f579efc1e846c86acedf1433b3fb8817a96a6916/' },
s: 'nagruzka'
},
rentabelnost: {
n: { t: 'Рентабельность ниже отраслевой на 10% и более — критерий отбора на выездную проверку.', sver: true },
s: 'nagruzka'
},
kapital: {
b: { t: 'Минус капитала — не признак по 115-ФЗ, но для кредита и отсрочки банк о нём спросит.', sver: true },
s: null
},
likvidnost: {
b: { t: 'Ликвидность ниже 1 — не признак по 115-ФЗ, но для кредита и лимитов банк на неё смотрит.', sver: true },
s: null
},
pokupateli: {
net: { t: 'Покупатель, который проверяет вас по ИНН перед оплатой, не увидит ни выручки, ни её динамики: о вашем бизнесе он будет судить по возрасту компании и записям в реестрах.' },
staraya: { t: 'Покупатель, который проверяет вас по ИНН перед оплатой, увидит отчётность только за {g} год — по ней трудно судить о вашем сегодняшнем обороте.' },
sokr: 'Индекс Делоскопа в такой проверке — «данных пока мало».',
s: { t: 'Откройте свою организацию в ГИР БО и посмотрите, видна ли там отчётность за {g} год. Если нет — проверьте, принята ли она налоговой. Если вы ограничили доступ к ней в ГИР БО, для крупных сделок держите копию с квитанцией о приёме.',
href: 'https://bo.nalog.gov.ru/', knopka: 'Открыть ГИР БО', ext: true }
},
skoraya: { t: 'Если банк уже прислал запрос или ограничил счёт — план по дням.', sver: true, href: '/skoraya-115-fz/', knopka: 'Открыть план по дням' },
sled: { t: 'Следить за своей компанией: добавьте её в список слежения в кабинете и проверяйте раз в месяц.', href: '/cabinet.html', knopka: 'Следить за компанией', sled: true }
};
var KAK_EST = { block: 'b', rnp: 'b', other: 'b', diskv: 'n', exit: 'n', fines: 'n' };
var PORYADOK = ['block', 'zsk', 'dolg', 'fssp', 'nedost', 'report', 'mass', 'staff', 'nagruzka', 'ubytki', 'rentabelnost', 'kapital', 'likvidnost',
'director', 'young', 'diskv', 'exit', 'rnp', 'other', 'fines'];
var MAX_SHAGOV = 3;
var ST = { LIQUIDATING: 'Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ', LIQUIDATED: 'Компания ликвидирована', BANKRUPT: 'Идёт банкротство', REORGANIZING: 'Идёт реорганизация' };
function tekst(x) {
var t = x.norma && (x.sver || SVERENO) ? x.t + ' ' + x.norma + '.' : (/[.!?»]$/.test(x.t) ? x.t : x.t + '.');
return x.dop ? t + ' ' + x.dop : t;
}
function reestr(t, ul) { return ul ? t : t.replace(/ЕГРЮЛ/g, 'ЕГРИП'); }
function Sk(o) {
if (o && o.statusKod) return o.statusKod;
if (root && root.StatusKod) return root.StatusKod;
try { return typeof require === 'function' ? require('./status-kod.js') : null; } catch (e) { return null; }
}
function Su(o) { return (o && o.sushchestvennoe) || (root && root.Sushchestvennoe) || (typeof require === 'function' ? require('./sushchestvennoe.js') : null); }
function Rn(o) {
if (o && o.rentabelnost) return o.rentabelnost;
if (root && root.Rentabelnost) return root.Rentabelnost;
try { return typeof require === 'function' ? require('./rentabelnost.js') : null; } catch (e) { return null; }
}
var NB = '\u00a0';
function skl(n, a, b, c) { var m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
function dengiF(v) {
var a = Math.abs(v), e = [[1e12, 'трлн'], [1e9, 'млрд'], [1e6, 'млн'], [1e3, 'тыс.']];
for (var i = 0; i < e.length; i++) if (a >= e[i][0]) return String(Math.round(a / e[i][0] * 10) / 10).replace('.', ',') + NB + e[i][1] + NB + '₽';
return String(Math.round(a)) + NB + '₽';
}
function finansy(r, o) {
var out = {}, c = r && r.company;
if (!c || !/^\d{10}$/.test(String(c.inn || ''))) return out;
var S = null; try { S = Su(o); } catch (e) { S = null; }
if (S) {
try {
var ub = S.ubytki && S.ubytki(r);
if (ub) out.ubytki = 'Убыток ' + ub.n + NB + skl(ub.n, 'год', 'года', 'лет') + ' подряд — по годовой отчётности за ' + (ub.n === 2 ? ub.ot + ' и ' + ub.god : ub.ot + '–' + ub.god);
var kp = S.kapital && S.kapital(r);
if (kp && kp.znach < 0) out.kapital = 'Собственный капитал на' + NB + '31.12.' + kp.god + ' — минус ' + dengiF(kp.znach) + ': обязательства больше активов';
var lk = S.likvidnost && S.likvidnost(r);
if (lk && lk.znach > 0 && lk.znach < 1) out.likvidnost = 'Текущая ликвидность на' + NB + '31.12.' + lk.god + ' — ' + lk.znach.toFixed(2).replace('.', ',') + ': краткосрочные долги больше оборотных средств';
} catch (e) {}
}
if (o && o.normy) {
try {
var R = Rn(o), x = R && R.raschet ? R.raschet(r, o.normy) : null;
if (x && x.st === 'nizhe' && typeof x.norma === 'number')
out.rentabelnost = 'Рентабельность активов за ' + x.god + ' — ' + (R.znachenie ? R.znachenie(x) : R.pct(x.n)) + ' при средней по отрасли ' + R.pct(x.norma) + ' (оценка; ГИР' + NB + 'БО и ФНС)';
} catch (e) {}
}
return out;
}
function U(o) { return (o && o.usloviya) || (root && root.Usloviya) || (typeof require === 'function' ? require('./usloviya.js') : null); }
function dataRu(s) { var d = new Date(s || Date.now()); if (isNaN(d)) d = new Date(); function z(n) { return (n < 10 ? '0' : '') + n; } return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear(); }
function nbsp(t) { return String(t).replace(/(\d) (?=\d{3}(\D|$))/g, '$1\u00a0').replace(/ ₽/g, '\u00a0₽'); }
function nazvanie(x) { var d = nbsp(String(x.detail || '').trim()); return /^(да|есть|внимание|нет данных|—|)$/i.test(d) ? x.title : x.title + ': ' + d.charAt(0).toLowerCase() + d.slice(1); }
function Io(o) { return (o && o.indeksOtvet) || (root && root.IndeksOtvet) || null; }
function vidimost(r, o) {
var c = r && r.company, S = null;
if (!c || !/^\d{10}$/.test(String(c.inn || ''))) return null;
if (!r.dossier || typeof r.dossier !== 'object') return null;
try { S = Su(o); } catch (e) { S = null; }
if (!S || !S.poslGodOtchetnosti || (S.bank && S.bank(c))) return null;
var g = S.poslGodOtchetnosti(r), st = null;
var t0 = Date.parse(r.checked_at || ''), gp = new Date((isFinite(t0) ? t0 : Date.now()) + 3 * 3600 * 1000).getUTCFullYear();
if (g !== null) { try { st = S.staraya ? S.staraya(r) : null; } catch (e) { st = null; } if (!st) return null; }
var T4 = T.pokupateli, out = { kind: 'pokupateli', god: gp - 1, staraya: g !== null ? g : null };
out.priznak = g === null ? 'Бухотчётности в' + NB + 'открытых данных ГИР' + NB + 'БО нет' : 'Последняя открытая отчётность — за' + NB + g + NB + 'год';
out.pochemu = g === null ? T4.net.t : T4.staraya.t.replace('{g} ', g + NB);
try { var IO = Io(o), v = IO && IO.gotov && IO.gotov() ? IO.vid(r) : null; if (v && v.rezhim === 'sokr') out.pochemu += ' ' + T4.sokr; } catch (e) {}
out.kratko = g === null ? 'Покупатели при проверке по ИНН не увидят вашу отчётность' : 'Покупатели при проверке по ИНН увидят отчётность только за ' + g + ' год';
return out;
}
function razbor(r, o) {
var Us = U(o); if (!Us) throw new Error('shchit: нет Usloviya');
r = r || {};
var f = Us.facts(r), np = Us.neProvereno(r, f), ul = f.kind !== 'INDIVIDUAL';
var est = {};
f.list.forEach(function (x) { if (!est[x.kind] || x.status === 'bad') est[x.kind] = nazvanie(x); });
if (f.zsk === 'high' || f.zsk === 'medium') est.zsk = 'Прогноз ЗСК — ' + (f.zsk === 'high' ? 'высокий' : 'средний') + ' · наша оценка';
if ((f.warn.young || f.bad.young) && !est.young) est.young = 'Компании меньше года';
if ((f.staff === 0 || f.staff === 1) && !est.staff) est.staff = f.staff ? 'В штате 1 человек' : 'В штате никого';
var SK = Sk(o);
if (ST[f.status] && !est.exit) est.exit = SK && SK.vid(f.status, f.kod) ? SK.fraza(f.status, f.kod, { zaglavnaya: true }) : ST[f.status];
var fin = finansy(r, o);
Object.keys(fin).forEach(function (k) { if (!est[k]) est[k] = fin[k]; });
var banki = [], nalogovaya = [], kinds = [];
PORYADOK.forEach(function (k) {
if (!est[k]) return;
kinds.push(k);
var t = T[k];
if (t) {
if (t.b && !(t.b.tolkoUL && !ul)) banki.push({ kind: k, priznak: est[k], pochemu: reestr(tekst(t.b), ul) });
if (t.n && !(t.n.tolkoUL && !ul)) nalogovaya.push({ kind: k, priznak: est[k], pochemu: reestr(tekst(t.n), ul) });
} else if (KAK_EST[k]) {
(KAK_EST[k] === 'b' ? banki : nalogovaya).push({ kind: k, priznak: est[k], pochemu: '' });
}
});
kinds.forEach(function (k) {
var vezde = banki.concat(nalogovaya).some(function (x) { return x.kind === k; });
if (!vezde) banki.push({ kind: k, priznak: est[k], pochemu: '' });
});
var pok = !est.exit && !est.report ? vidimost(r, o) : null, pokupateli = pok ? [pok] : [];
var shagi = [], bylo = {};
kinds.forEach(function (k) {
if (shagi.length >= MAX_SHAGOV) return;
if (T[k] && T[k].s === null) return;
var ss = T[k] && typeof T[k].s === 'string' ? T[k].s : k;
var s = T[ss] && T[ss].s ? T[ss].s : T.skoraya;
var key = s === T.skoraya ? 'skoraya' : ss;
if (bylo[key]) return; bylo[key] = 1;
shagi.push({ kind: key, t: tekst(s), href: s.href || '', knopka: s.knopka || '', ext: !!s.ext, eshche: s.eshche || null });
});
if (pok && shagi.length < MAX_SHAGOV) {
var ps = T.pokupateli.s;
shagi.push({ kind: 'pokupateli', t: ps.t.replace('{g} ', pok.god + NB), href: ps.href, knopka: ps.knopka, ext: !!ps.ext, eshche: null });
}
shagi.push({ kind: 'sled', t: T.sled.t, href: T.sled.href, knopka: T.sled.knopka, sled: true });
var sNormoj = banki.concat(nalogovaya).some(function (x) { return /\((п|пп|ст)\. [^)]+\)\.$/.test(x.pochemu); }) ||
shagi.some(function (x) { return /\((п|пп|ст)\. [^)]+\)\.$/.test(x.t); });
return { banki: banki, nalogovaya: nalogovaya, pokupateli: pokupateli, shagi: shagi, chisto: !kinds.length, neProvereno: np, ul: ul, data: dataRu(r.checked_at), imya: f.name, sNormoj: sNormoj };
}
function glavnyj(R) { for (var i = 0; i < R.shagi.length; i++) if (R.shagi[i].href) return R.shagi[i]; return R.shagi[R.shagi.length - 1]; }
function kratko(R) {
var p = R.chisto ? 'Заметных признаков в открытых данных нет' : 'Признаков: ' + (R.banki.length + R.nalogovaya.length);
if (R.pokupateli && R.pokupateli.length) p += '. ' + R.pokupateli[0].kratko;
var sh = R.shagi.filter(function (s) { return !s.sled; }).map(function (s, i) { return (i + 1) + '. ' + s.t; }).join(' ');
return R.imya + ' — глазами банка и налоговой на ' + R.data + '. ' + p + '.' + (sh ? ' Что сделать: ' + sh : '');
}
var CSS = '' +
'.shch{display:flex;flex-direction:column;gap:18px;color:var(--ink,#1D1D1F)}' +
'.shch-oh{margin:0;font-size:13px;color:var(--muted,#6B6B70);max-width:68ch}' +
'.shch-b{display:flex;flex-direction:column;gap:8px}' +
'.shch-b h3{margin:0;font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
'.shch-b ul,.shch-b ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}' +
'.shch-b li{background:var(--bg,#F5F5F2);border-radius:16px;padding:12px 14px;max-width:68ch}' +
'.shch-b li b{display:block;font-size:15px;font-weight:600;line-height:1.35}' +
'.shch-b li span{display:block;margin-top:3px;font-size:15px;line-height:1.45;color:var(--ink2,#48484C)}' +
'.shch-b li a{font-size:15px}' +
'.shch-sh{counter-reset:sh}' +
'.shch-sh li{position:relative;padding-left:44px}' +
'.shch-sh li:before{counter-increment:sh;content:counter(sh);position:absolute;left:14px;top:12px;width:20px;height:20px;border-radius:50%;background:var(--card,#fff);font-size:13px;font-weight:600;line-height:20px;text-align:center;color:var(--ink2,#48484C)}' +
'.shch-sh li.shch-sled:before{content:"";background:var(--accent,#0B63E5);box-shadow:inset 0 0 0 6px var(--card,#fff)}' +
'.shch-sh li span{margin-top:0;color:var(--ink,#1D1D1F)}' +
'.shch-pusto{margin:0;font-size:15px;color:var(--ink2,#48484C);max-width:68ch}' +
'.shch-ne{margin:0;font-size:15px;color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px;max-width:68ch}' +
'.shch-k{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;border-radius:999px;background:var(--accent,#0B63E5);color:#fff!important;font-weight:600;font-size:15px;padding:12px 22px;min-height:44px;text-decoration:none;max-width:100%;text-align:center}' +
'.shch-k:hover{background:var(--accent-hover,#084BB0)}' +
'.shch-ch{font-weight:400;color:var(--muted,#6B6B70);font-variant-numeric:tabular-nums}' +
'.shch-sv{margin:0;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70);max-width:68ch;border-top:1px solid var(--line,#E5E5E0);padding-top:10px}';
function nwNomer(h) { return h.replace(/№ ([^\s)<]+\)\.?)/g, '<span class="nw">№ $1</span>'); }
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ssylka(href, t, ext, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t) + '</a>'; }
function html(R) {
function blok(zag, spisok) {
if (!spisok.length) return '';
return '<div class="shch-b"><h3>' + zag + ' <span class="shch-ch">· ' + spisok.length + '</span></h3><ul>' + spisok.map(function (x) {
return '<li><b>' + esc(x.priznak) + '</b>' + (x.pochemu ? '<span>' + nwNomer(esc(x.pochemu)) + '</span>' : '') + '</li>';
}).join('') + '</ul></div>';
}
var g = glavnyj(R);
var sh = '<div class="shch-b"><h3>Что сделать сейчас</h3><ol class="shch-sh">' + R.shagi.map(function (s) {
var dop = [];
if (s.href && s !== g) dop.push(ssylka(s.href, s.knopka, s.ext));
if (s.eshche) dop.push(ssylka(s.eshche.href, s.eshche.t));
return '<li' + (s.sled ? ' class="shch-sled"' : '') + '><span>' + esc(s.t) + (dop.length ? ' ' + dop.join(' · ') : '') + '</span></li>';
}).join('') + '</ol></div>';
var np = R.neProvereno && R.neProvereno.spisok && R.neProvereno.spisok.length ? '<p class="shch-ne">Не проверяли: ' + esc(R.neProvereno.spisok.join(', ')) + '. Это не значит, что их нет.</p>' : '';
return '<section class="shch" aria-label="Ваша компания глазами банка и налоговой">' +
'<p class="shch-oh">Это наша оценка по открытым данным, а не решение банка или инспекции. Банк видит ваши операции — мы нет.</p>' +
(R.chisto ? '<p class="shch-pusto">В открытых данных заметных признаков не нашли. Это не гарантия: банк смотрит и на ваши операции.</p>' : '') +
blok('Как вас видит банк', R.banki) + blok('Как вас видит налоговая', R.nalogovaya) +
blok('Как вас видят покупатели', R.pokupateli || []) + np + sh +
ssylka(g.href, g.knopka, g.ext, 'shch-k') +
(R.sNormoj ? '<p class="shch-sv">Ссылки на нормы в скобках сверены командой Делоскопа (115-ФЗ и налоги) с редакциями законов на ' + SVERENO_NA + '.</p>' : '') + '</section>';
}
function nw(el) {
try { var w = root && root.dlkNerazryv ? root : (typeof window !== 'undefined' ? window : null); if (w && w.dlkNerazryv) w.dlkNerazryv.obernut(el); } catch (e) {}
}
function mount(el, r, o) {
if (!r || !r.company || !r.company.inn) throw new Error('shchit: нет данных о компании');
var doc = el.ownerDocument;
if (!doc.getElementById('shch-css')) { var s = doc.createElement('style'); s.id = 'shch-css'; s.textContent = CSS; doc.head.appendChild(s); }
var R = razbor(r, o);
el.innerHTML = html(R); nw(el);
el.addEventListener('click', function (e) {
var a = e.target && e.target.closest ? e.target.closest('a[href="/cabinet.html"]') : null;
if (a && root && root.dlkGoal) root.dlkGoal('shchit_sled', { inn_dlina: String(r.company.inn).length });
});
var Rnt = Rn(o), metka = {}; el.__shch = metka;
if (!(o && o.normy) && Rnt && Rnt.zagruzit && /^\d{10}$/.test(String(r.company.inn))) {
R.gotovo = Rnt.zagruzit().then(function (d) {
if (!d || el.__shch !== metka) return R;
var o2 = {}; Object.keys(o || {}).forEach(function (k) { o2[k] = o[k]; }); o2.normy = d;
var R2 = razbor(r, o2);
if (R2.banki.length + R2.nalogovaya.length === R.banki.length + R.nalogovaya.length) return R;
Object.keys(R2).forEach(function (k) { R[k] = R2[k]; });
el.innerHTML = html(R); nw(el);
return R;
}).catch(function () { return R; });
}
return R;
}
return { razbor: razbor, mount: mount, html: html, kratko: kratko, glavnyj: glavnyj, finansy: finansy, vidimost: vidimost, T: T, SVERENO: SVERENO, SVERENO_NA: SVERENO_NA, MAX_SHAGOV: MAX_SHAGOV, PORYADOK: PORYADOK };
});
;
/* --- /js/dinamika.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Dinamika = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = ' ';
var RAZBOR_ISKL = '/praktika/nalogi/isklyuchili-iz-egryul-dolg-s-direktora/';
var KEY = 'dlk_snimki', MAKS_INN = 40, MAKS_SNIMKOV = 4, CHAS = 3600 * 1000;
var POKAZATELI = [
{ k: 'revenue', nazv: 'Выручка', dengi: true },
{ k: 'profit', nazv: 'Чистая прибыль', dengi: true, znak: true },
{ k: 'income_tax', nazv: 'Налог на прибыль', dengi: true },
{ k: 'taxes_paid', nazv: 'Уплачено налогов и взносов', dengi: true, fns: true },
{ k: 'staff', nazv: 'Численность', chel: true, fns: true }
];
var LVL = { low: 'низкий', medium: 'средний', high: 'высокий' };
var STX = { ok: 'норма', info: 'справочно', warn: 'внимание', bad: 'риск' };
var VES = { ok: 0, info: 0, warn: 1, bad: 2 };
var STATUS = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
function kodSost(v) { var k = String(v == null ? '' : v).trim(); return /^\d{3}$/.test(k) ? k : ''; }
function iskl(k) { return !!(k && ISKL[k]); }
function nazvIskl(k) { return 'ФНС готовит исключение из ЕГРЮЛ' + (k === '108' ? ' по' + NB + 'сведениям Банка России' : ''); }
var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
function isklyuchena(k) { return !!(k && ISKLYUCHENA[k]); }
function plusMes(iso, n) {
var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
if (!m) return '';
var g = +m[1], me = +m[2] - 1 + n, d = +m[3];
g += Math.floor(me / 12); me = me % 12;
var posl = new Date(Date.UTC(g, me + 1, 0)).getUTCDate();
return g + '-' + ('0' + (me + 1)).slice(-2) + '-' + ('0' + Math.min(d, posl)).slice(-2);
}
function podIskl(k, kodd) {
var mes = k === '108' ? 6 : 3, do_ = kodd ? dmy(plusMes(kodd, mes)) : '';
return 'Новых авансов не платите. Если компания вам должна — возражение в налоговую нужно подать в течение ' + mes + NB + 'месяцев ' +
'со дня публикации в «Вестнике государственной регистрации».' + (do_ ? ' Ориентировочно до' + NB + do_ + '.' : '') +
' Дату публикации проверьте на vestnik-gosreg.ru.';
}
function nazvSt(st, kod) {
if (isklyuchena(kod)) return 'исключена из' + NB + 'ЕГРЮЛ';
if (st === 'LIQUIDATING' && kod) return iskl(kod) ? 'готовится исключение из' + NB + 'ЕГРЮЛ' : 'ликвидируется';
return STATUS[st];
}
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
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
function chel(v) {
if (v == null || !isFinite(v)) return '—';
var n = Math.round(v), t = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
return (n < 0 ? '−' : '') + t + NB + 'чел.';
}
function procent(p) {
var r = Math.round(p);
return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + NB + '%';
}
function izmenenie(was, stalo) {
var k = stalo / was;
if (k < 3) return procent((stalo - was) / was * 100);
if (k < 10) {
var t = chislo(Math.round(k * 10) / 10, 1).replace(/,0$/, '');
return 'в' + NB + t + NB + (/,/.test(t) ? 'раза' : skl(+t, 'раз', 'раза', 'раз'));
}
var n = Math.round(k);
return 'в' + NB + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + skl(n, 'раз', 'раза', 'раз');
}
function skl(n, a, b, c) {
var m = n % 100, d = n % 10;
return m > 10 && m < 20 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c;
}
function ryad(arr) {
var po = {};
(Array.isArray(arr) ? arr : []).forEach(function (x) {
if (!x) return;
var g = parseInt(x.year, 10), v = Number(x.value);
if (g > 1990 && g < 2100 && x.value !== null && x.value !== '' && isFinite(v)) po[g] = v;
});
return Object.keys(po).map(Number).sort(function (a, b) { return a - b; }).slice(-5)
.map(function (g) { return { year: g, value: po[g] }; });
}
function ryady(r) {
var ch = (r && r.dossier && r.dossier.charts) || {};
var ubGody = nalogBezZnaka(ch);
return POKAZATELI.map(function (p) {
var o = { k: p.k, nazv: p.nazv, znak: !!p.znak, chel: !!p.chel, fns: !!p.fns, ryad: ryad(ch[p.k]) };
if (p.k === 'income_tax' && ubGody.length) o.ubGody = ubGody;
return o;
}).filter(function (p) { return p.ryad.length >= 3; });
}
function nalogBezZnaka(ch) {
var t = Array.isArray(ch && ch.income_tax) ? ch.income_tax : [];
if (ch && ch.income_tax_znak === true) return [];
var sFlagom = t.some(function (x) { return x && typeof x.znak === 'boolean'; });
if (!sFlagom && t.some(function (x) { return x && Number(x.value) < 0; })) return [];
var izv = {}, ub = {};
t.forEach(function (x) { if (x && x.znak === true) izv[parseInt(x.year, 10)] = 1; });
(Array.isArray(ch && ch.profit_before_tax) ? ch.profit_before_tax : []).forEach(function (x) {
if (x && x.value !== null && x.value !== '' && isFinite(Number(x.value))) izv[parseInt(x.year, 10)] = 1;
});
(Array.isArray(ch && ch.profit) ? ch.profit : []).forEach(function (x) { if (x && x.value !== null && x.value !== '' && Number(x.value) < 0) ub[parseInt(x.year, 10)] = 1; });
return ryad(t).filter(function (x) { return ub[x.year] && !izv[x.year] && x.value !== 0; }).map(function (x) { return x.year; });
}
function stroka(p) {
var a = p.ryad, n = a.length, posl = a[n - 1], pred = a[n - 2], perv = a[0];
var o = { k: p.k, nazv: p.nazv, god: posl.year, znach: posl.value, ryad: a, kGodu: '', zaPeriod: '', ton: 'ro', fns: !!p.fns };
o.fmt = p.chel ? chel : dengi;
if (p.znak && posl.value < 0) o.znachTekst = 'убыток ' + dengi(-posl.value);
else if (p.k === 'income_tax' && posl.value < 0) o.znachTekst = 'доход ' + dengi(-posl.value);
else o.znachTekst = o.fmt(posl.value);
if (p.znak && (pred.value < 0) !== (posl.value < 0)) {
o.kGodu = posl.value < 0 ? 'в ' + pred.year + NB + '— прибыль' : 'в ' + pred.year + NB + '— убыток';
o.ton = posl.value < 0 ? 'vniz' : 'vverh';
o.smena = true;
} else if (pred.value > 0 && posl.value >= 0) {
var d = (posl.value - pred.value) / pred.value * 100;
o.kGodu = izmenenie(pred.value, posl.value) + ' к' + NB + pred.year;
o.ton = Math.round(d) > 0 ? 'vverh' : Math.round(d) < 0 ? 'vniz' : 'ro';
if (p.znak && posl.value === 0) o.ton = 'ro';
}
if (perv.value > 0 && posl.value > 0) o.zaPeriod = izmenenie(perv.value, posl.value) + ' с' + NB + perv.year;
if (p.ubGody) {
o.ubGody = p.ubGody;
var vRyadu = a.filter(function (x) { return p.ubGody.indexOf(x.year) >= 0; }).map(function (x) { return x.year; });
if (vRyadu.indexOf(perv.year) >= 0 || vRyadu.indexOf(posl.year) >= 0) o.zaPeriod = '';
if (vRyadu.indexOf(posl.year) >= 0 || vRyadu.indexOf(pred.year) >= 0) {
o.kGodu = ''; o.ton = 'ro';
o.zaPeriod = '±' + NB + '— в год убытка не видно, расход это или доход';
}
}
if (p.znak) {
var ub = a.filter(function (x) { return x.value < 0; }).map(function (x) { return x.year; });
if (ub.length && !(ub.length === 1 && ub[0] === pred.year && o.kGodu)) o.zaPeriod = 'убыток в' + NB + ub.join(', ');
else if (ub.length) o.zaPeriod = '';
}
return o;
}
function trendy(r) {
var rs = ryady(r), out = [];
var v = rs.filter(function (p) { return p.k === 'revenue'; })[0];
if (v) {
var a = v.ryad, rost = 0, pad = 0;
for (var i = 1; i < a.length; i++) { if (a[i].value > a[i - 1].value) rost++; else if (a[i].value < a[i - 1].value) pad++; }
var m = a.length - 1;
if (rost === m) out.push('Выручка росла каждый год с' + NB + a[0].year + ' по' + NB + a[m].year + '.');
else if (pad === m) out.push('Выручка снижалась каждый год с' + NB + a[0].year + ' по' + NB + a[m].year + '.');
else out.push('Выручка росла год к году ' + rost + ' ' + (rost >= 2 && rost <= 4 ? 'раза' : 'раз') + ' из' + NB + m + ' — с' + NB + a[0].year + ' по' + NB + a[m].year + '.');
}
var p = rs.filter(function (x) { return x.k === 'profit'; })[0];
if (p) {
var ub = p.ryad.filter(function (x) { return x.value < 0; }).length, n = p.ryad.length;
if (!ub) out.push('Прибыль — в каждом из' + NB + n + ' лет отчётности.');
else if (ub === n) out.push('Убыток — в каждом из' + NB + n + ' лет отчётности.');
else out.push('Убыток — в' + NB + ub + ' из' + NB + n + ' лет отчётности.');
}
return out.slice(0, 2);
}
var SKACHOK_BAZA = 1e6;
function skachok(r) {
var D = (r && r.dossier) || {}, ch = D.charts || {}, fakty = [], vverh = false, vniz = false;
var v = ryad(ch.revenue);
if (v.length >= 2) {
var a = v[v.length - 2], b = v[v.length - 1];
if (b.year - a.year === 1 && a.value >= SKACHOK_BAZA && b.value > 0) {
var k = b.value / a.value;
if (k >= 2) { vverh = true; fakty.push({ k: 'revenue', god: b.year, kRaz: k, tekst: 'Выручка за' + NB + b.year + NB + 'год — ' + vRaz(k) + ' больше, чем за' + NB + a.year + '.' }); }
else if (k <= 0.5) { vniz = true; fakty.push({ k: 'revenue', god: b.year, kRaz: k, tekst: 'Выручка за' + NB + b.year + NB + 'год — на' + NB + Math.round((1 - k) * 100) + NB + '% меньше, чем за' + NB + a.year + '.' }); }
}
}
var akt = (Array.isArray(D.kpi) ? D.kpi : []).filter(function (x) { return x && /^Активы(\s|$)/.test(String(x.label || '')); })[0];
var bg = ch.balance && typeof ch.balance === 'object' ? parseInt(ch.balance.year, 10) : NaN;
if (akt && typeof akt.delta === 'number' && isFinite(akt.delta) && typeof akt.value === 'number' && akt.value > 0) {
var na = isFinite(bg) ? 'Активы на' + NB + '31.12.' + bg : 'Активы';
var ka = 1 + akt.delta / 100;
if (ka >= 2 && akt.value / ka >= SKACHOK_BAZA) { vverh = true; fakty.push({ k: 'aktivy', god: isFinite(bg) ? bg : null, kRaz: ka, tekst: na + ' — ' + vRaz(ka) + ' больше, чем годом раньше.' }); }
else if (akt.delta <= -50) { vniz = true; fakty.push({ k: 'aktivy', god: isFinite(bg) ? bg : null, kRaz: ka, tekst: na + ' — на' + NB + Math.round(-akt.delta) + NB + '% меньше, чем годом раньше.' }); }
}
if (!fakty.length) return null;
var t = fakty.map(function (f) { return f.tekst; });
if (vverh) t.push('Так бывает, например, при присоединении другой компании, крупной сделке или переоценке имущества — годы до' + NB + 'и' + NB + 'после скачка сравнивайте осторожно.');
if (vniz) t.push('Перед авансом спросите компанию, что изменилось.');
return { ton: vniz ? 'warn' : 'ro', tekst: t.join(' '), fakty: fakty };
}
function skachokHtml(r) {
var s = skachok(r);
return s ? '<p class="din__skachok din__skachok--' + s.ton + '" data-blok="skachok"><b>Скачок в' + NB + 'отчётности.</b> ' + esc(s.tekst) + '</p>' : '';
}
function sparklajn(a) {
var W = 96, H = 20, P = 2, mx = -Infinity, mn = Infinity;
a.forEach(function (x) { mx = Math.max(mx, x.value); mn = Math.min(mn, x.value); });
var span = (mx - mn) || 1, n = a.length;
function y(v) { return mx === mn ? H / 2 : P + (mx - v) / span * (H - 2 * P); }
var pts = a.map(function (x, i) { return (n > 1 ? i * W / (n - 1) : W / 2).toFixed(1) + ',' + y(x.value).toFixed(1); }).join(' ');
var nol = mn < 0 && mx > 0 ? '<line x1="0" x2="' + W + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" class="din__0"/>' : '';
return '<svg class="din__sv" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">' + nol +
'<polyline points="' + pts + '"/></svg>';
}
function zaGod(s, g) {
var x = s.ryad.filter(function (q) { return q.year === g; })[0];
if (!x) return '<span class="din__na">нет данных</span>';
if (s.k === 'profit' && x.value < 0) return 'убыток ' + dengi(-x.value);
if (s.ubGody && s.ubGody.indexOf(g) >= 0) return '<span title="В год убытка не видно, расход это или доход по налогу">±' + s.fmt(x.value) + '</span>';
if (s.k === 'income_tax' && x.value < 0) return '<span title="Доход по налогу на прибыль">доход ' + dengi(-x.value) + '</span>';
return s.fmt(x.value);
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
function starayaHtml(r) { var s = staraya(r); return s ? '<p class="din__star" data-blok="staraya">' + esc(s.tekst) + '</p>' : ''; }
var STRELKA = { vverh: '▲', vniz: '▼', ro: '' };
function htmlDinamika(r, opt) {
var rs = ryady(r);
if (!rs.length) return '';
var st = rs.map(stroka), g0 = st[0].ryad[0].year, g1 = st[0].god;
st.forEach(function (s) { g0 = Math.min(g0, s.ryad[0].year); g1 = Math.max(g1, s.god); });
var gp = g1 - 1, tr = trendy(r), fns = st.some(function (s) { return s.fns; });
var rows = st.map(function (s) {
var izm = s.god === g1 && s.ryad.length > 1 && s.ryad[s.ryad.length - 2].year === gp && s.kGodu
? (STRELKA[s.ton] ? STRELKA[s.ton] + NB : '') + (s.smena ? (s.ton === 'vverh' ? 'из убытка' : 'в убыток') : s.kGodu.replace(/\sк\s\d{4}$/, '')) : '—';
return '<tr class="din__r din__r--' + s.ton + '">' +
'<th scope="row" class="din__n">' + esc(s.nazv) + (s.zaPeriod ? '<small>' + s.zaPeriod + '</small>' : '') + '</th>' +
'<td class="din__g">' + sparklajn(s.ryad) + '</td>' +
'<td class="din__v din__p n">' + zaGod(s, gp) + '</td>' +
'<td class="din__v n"><b>' + zaGod(s, g1) + '</b></td>' +
'<td class="din__v din__k n">' + izm + '</td></tr>';
}).join('');
return '<section class="din" aria-label="Динамика по годам">' +
'<div class="din__h"><b>Динамика за ' + g0 + '–' + g1 + '</b><span>' + (fns ? 'ГИР БО и наборы ФНС' : 'ГИР БО ФНС') + ' · ' + g0 + '–' + g1 + '</span></div>' +
starayaHtml(r) +
'<div class="din__w"><table class="din__t"><caption class="din__cap">Показатели по годам, ' + g0 + '–' + g1 + '</caption>' +
'<thead><tr><th scope="col">Показатель</th><th scope="col" class="din__g"><span class="din__cap">График </span>' + g0 + '–' + g1 + '</th>' +
'<th scope="col" class="din__v din__p n">' + gp + '</th><th scope="col" class="din__v n">' + g1 + '</th><th scope="col" class="din__v">Изм.</th></tr></thead>' +
'<tbody>' + rows + '</tbody></table></div>' +
(tr.length ? '<p class="din__tr">' + tr.map(esc).join(' ') + '</p>' : '') +
skachokHtml(r) +
(opt && opt.balans === false ? '' : htmlBalans(r)) +
'<p class="din__src">Источник: ГИР БО ФНС, годовая бухгалтерская отчётность; последний год — ' + g1 + ' (на' + NB + '31.12.' + g1 + ').' +
(fns ? ' Численность и уплаченные налоги — открытые наборы ФНС за год.' : '') + '</p>' +
'</section>';
}
function chisl(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
function doliBalansa(ch) {
var vse = ch.length === 3 && ch.every(function (x) { return x.v != null && x.v >= 0; });
var tot = vse ? ch.reduce(function (a, x) { return a + x.v; }, 0) : 0;
if (!(tot > 0)) return false;
ch.forEach(function (x) { var t = x.v / tot * 100; x.p = Math.floor(t); x.o = t - x.p; x.w = t; });
var ost = 100 - ch.reduce(function (a, x) { return a + x.p; }, 0);
ch.slice().sort(function (a, c) { return c.o - a.o; }).slice(0, ost).forEach(function (x) { x.p++; });
ch.forEach(function (x) { x.dolya = x.p < 1 && x.v > 0 ? 'меньше' + NB + '1' + NB + '%' : x.p + NB + '%'; });
return true;
}
function balans(r) {
var ch = (r && r.dossier && r.dossier.charts) || {};
var b = ch.balance && typeof ch.balance === 'object' ? ch.balance : null, d = ch.debts && typeof ch.debts === 'object' ? ch.debts : null;
var out = { god: null, chasti: [], polosa: false, kapitalMinus: null, raschety: [], godR: null, zajmyKVyr: null };
if (b) {
var gb = parseInt(b.year, 10), eq = chisl(b.equity), ld = chisl(b.long_debt), sd = chisl(b.short_debt);
if (isFinite(gb) && (eq != null || ld != null || sd != null)) {
out.god = gb;
var ch3 = [{ k: 'kap', nazv: 'Собственный капитал', v: eq }, { k: 'dol', nazv: 'Долгосрочные обязательства', v: ld }, { k: 'kor', nazv: 'Краткосрочные обязательства', v: sd }];
out.polosa = doliBalansa(ch3);
out.chasti = ch3.filter(function (x) { return x.v != null && x.v > 0; })
.map(function (x) { return { k: x.k, nazv: x.nazv, v: x.v, dolya: out.polosa ? x.dolya : '', p: out.polosa ? x.p : null, w: out.polosa ? x.w : null }; });
if (eq != null && eq < 0) out.kapitalMinus = eq;
}
}
if (d) {
var gd = parseInt(d.year, 10);
if (isFinite(gd)) {
[['rec', 'Фирме должны покупатели', d.receivables], ['pay', 'Фирма должна поставщикам', d.payables], ['loan', 'Кредиты и займы', d.loans]].forEach(function (x) {
var v = chisl(x[2]); if (v != null && v > 0) out.raschety.push({ k: x[0], nazv: x[1], v: v });
});
if (out.raschety.length) out.godR = gd;
var vy = (Array.isArray(ch.revenue) ? ch.revenue : []).filter(function (x) { return x && parseInt(x.year, 10) === gd; })[0];
var zl = chisl(d.loans);
if (zl != null && zl > 0 && vy && chisl(vy.value) != null && vy.value > 0) out.zajmyKVyr = Math.round(zl / vy.value * 100);
}
}
return out.chasti.length || out.kapitalMinus != null || out.raschety.length ? out : null;
}
function htmlBalans(r) {
var b = balans(r);
if (!b) return '';
var h = '<div class="din__bal" data-blok="balans">';
if (b.god != null) {
h += '<div class="din__bh"><b>На чём держится компания</b><span>баланс на' + NB + '31.12.' + b.god + '</span></div>';
if (b.polosa && b.chasti.length) {
h += '<div class="din__bar" role="img" aria-label="' + esc(b.chasti.map(function (x) { return x.nazv + ' — ' + x.dolya.replace(NB, ' '); }).join(', ')) + '">' +
b.chasti.map(function (x) { return '<i class="din__b--' + x.k + '" style="width:' + x.w.toFixed(1) + '%"></i>'; }).join('') + '</div>';
}
h += '<ul class="din__leg">' + (b.kapitalMinus != null ? '<li class="din__minus"><i></i><span>Собственный капитал</span><b class="n">' + dengi(b.kapitalMinus) + '</b><em>меньше нуля</em></li>' : '') +
b.chasti.map(function (x) {
return '<li><i' + (b.polosa ? ' class="din__b--' + x.k + '"' : '') + '></i><span>' + esc(x.nazv) + '</span><b class="n">' + dengi(x.v) + '</b><em class="n">' + x.dolya + '</em></li>';
}).join('') + '</ul>';
}
if (b.raschety.length) {
h += '<div class="din__bh"><b>Кто кому должен</b><span>на' + NB + '31.12.' + b.godR + '</span></div><ul class="din__leg din__ras">' + b.raschety.map(function (x) {
return '<li><span>' + esc(x.nazv) + '</span><b class="n">' + dengi(x.v) + '</b><em class="n">' +
(x.k === 'loan' && b.zajmyKVyr != null ? b.zajmyKVyr + NB + '% выручки за' + NB + b.godR : '') + '</em></li>';
}).join('') + '</ul>';
}
return h + '</div>';
}
function htmlBalansOtdelno(r) {
var bh = htmlBalans(r);
if (!bh) return '';
return '<section class="din" aria-label="Баланс по годовой отчётности">' + starayaHtml(r) + bh +
'<p class="din__src">Источник: ГИР БО ФНС, годовая бухгалтерская отчётность (баланс).</p></section>';
}
function zapisEgryul(r) {
var c = (r && r.company) || {}, d = null;
var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(c.state_actuality_date || ''));
if (m) d = m[1];
if (!d) {
var q = /последнее изменение записи ЕГРЮЛ[^—–-]*[—–-]\s*(\d{2})\.(\d{2})\.(\d{4})/i.exec(String(((r && r.dossier) || {}).data_dates || ''));
if (q) d = q[3] + '-' + q[2] + '-' + q[1];
}
if (!d || !isFinite(Date.parse(d))) return null;
var den = /^(\d{4}-\d{2}-\d{2})/.exec(String((r && r.checked_at) || ''));
if (den && d > den[1]) return null;
return d;
}
function davnost(iso, t) {
var a = Date.parse(iso), b = new Date(t + 3 * CHAS);
if (!isFinite(a) || !isFinite(t)) return null;
var dn = Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - a) / (24 * CHAS));
if (dn < 0) return null;
if (dn === 0) return { dn: 0, t: 'сегодня' };
if (dn <= 60) return { dn: dn, t: dn + NB + skl(dn, 'день', 'дня', 'дней') + ' назад' };
if (dn < 730) { var ms = Math.floor(dn / 30.44); return { dn: dn, t: ms + NB + skl(ms, 'месяц', 'месяца', 'месяцев') + ' назад' }; }
var g = Math.floor(dn / 365.25);
return { dn: dn, t: g + NB + skl(g, 'год', 'года', 'лет') + ' назад' };
}
var VYPISKA = '<a href="https://egrul.nalog.ru/" target="_blank" rel="noopener">выписке ЕГРЮЛ</a>';
function snimok(r) {
if (!r || !r.company) return null;
var c = r.company, inn = String(c.inn || '');
if (!/^\d{10}(\d{2})?$/.test(inn) || /^0+$/.test(inn)) return null;
var t = Date.parse(r.checked_at || '');
if (!isFinite(t)) return null;
var s = { t: t, inn: inn, lvl: LVL[r.risk_level] ? r.risk_level : '', st: STATUS[c.status] ? c.status : '', sig: {} };
(r.signals || []).forEach(function (x) {
if (x && /^[a-z0-9_]{2,32}$/.test(x.id || '') && STX[x.status]) s.sig[x.id] = [x.status, String(x.title || '').slice(0, 80)];
});
if (r.zsk && LVL[r.zsk.level]) s.zsk = r.zsk.level;
if (inn.length === 10) {
var nm = String(c.name_short || c.name_full || '').trim();
if (nm) s.nm = nm.slice(0, 120);
if (c.director_since) s.dir = String(c.director_since).slice(0, 10);
s.nedost = !!(c.invalid || c.address_invalid);
var ch = (r.dossier && r.dossier.charts) || {}, v = ryad(ch.revenue), p = ryad(ch.profit);
if (v.length) s.vyr = [v[v.length - 1].year, v[v.length - 1].value];
if (p.length) s.prib = [p[p.length - 1].year, p[p.length - 1].value];
var bl = ch.balance, kg = bl && typeof bl === 'object' ? parseInt(bl.year, 10) : NaN, ke = bl ? bl.equity : null;
if (isFinite(kg) && ke !== null && ke !== '' && typeof ke !== 'boolean' && isFinite(Number(ke))) s.kap = [kg, Number(ke)];
var lk = likvidnost(r);
if (lk) s.lk = lk;
var u = ubSerija(ch.profit);
if (u) s.ub = u;
var R = rent(), ro = R && R.ocenka ? R.ocenka(r) : null;
if (ro && isFinite(ro.n)) s.rn = ro.bezZnaka && isFinite(ro.nMin) ? [ro.god, Math.round(ro.nMin * 10) / 10, Math.round(ro.nMax * 10) / 10] : [ro.god, Math.round(ro.n * 10) / 10];
var db = ch.debts, zg = db && typeof db === 'object' ? parseInt(db.year, 10) : NaN, zl = db ? db.loans : null;
if (isFinite(zg) && zl !== null && zl !== '' && typeof zl !== 'boolean' && isFinite(Number(zl)) && Number(zl) >= 0) s.zm = [zg, Number(zl)];
var ok = okved(r);
if (ok) { s.ok = ok.kod; if (ok.nazv) s.okn = ok.nazv; }
var ku = ustKapital(r);
if (ku !== null) { s.ku = ku; if (ooo(r)) s.ooo = 1; }
var ez = zapisEgryul(r);
if (ez) s.egrd = ez;
var kpp = String(c.kpp == null ? '' : c.kpp).replace(/\s+/g, '').toUpperCase();
if (/^\d{4}[0-9A-Z]{2}\d{3}$/.test(kpp)) s.kpp = kpp;
var ix = ixChislo(r);
if (ix != null) {
s.ix = ix;
var ir = ixRazbor(r);
if (ir) { s.ixf = ir.f; s.ixp = ir.p; s.ixv = ir.v; }
}
var kd = kodSost(c.state_code);
if (kd) {
s.kod = kd;
var kdd = /^(\d{4}-\d{2}-\d{2})/.exec(String(c.state_actuality_date || ''));
if (kdd) s.kodd = kdd[1];
}
}
return s;
}
function okved(r) {
var c = (r && r.company) || {}, kod = String(c.okved == null ? '' : c.okved).trim();
if (!/^\d{2}(\.\d{1,2}){0,2}$/.test(kod)) return null;
var nazv = String(c.okved_name == null ? '' : c.okved_name).trim();
if (!nazv) {
var D = (r && r.dossier) || {};
(Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
if (!sk || !Array.isArray(sk.rows)) return;
sk.rows.forEach(function (row) {
if (nazv || !Array.isArray(row) || !/^Основной вид деятельности$/i.test(String(row[0] || '').trim())) return;
var m = /^\s*(\d{2}(?:\.\d{1,2}){0,2})\s*[—–-]\s*(.+?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
if (m && m[1] === kod) nazv = m[2];
});
});
}
nazv = nazv.replace(/\s+/g, ' ');
return { kod: kod, nazv: nazv.length > 90 ? nazv.slice(0, 89).replace(/\s+\S*$/, '') + '…' : nazv };
}
function strokaDosje(r, re) {
var D = (r && r.dossier) || {}, v = '';
(Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
if (!sk || !Array.isArray(sk.rows)) return;
sk.rows.forEach(function (row) {
if (!v && Array.isArray(row) && re.test(String(row[0] || '').trim())) v = String(row[1] == null ? '' : row[1]);
});
});
return v;
}
function ustKapital(r) {
var t = strokaDosje(r, /^Уставный капитал$/i).replace(/\s+/g, '').replace(/(₽|руб\.?)$/i, '');
if (!/^\d{1,15}(?:[.,]\d{1,2})?$/.test(t)) return null;
var v = Number(t.replace(',', '.'));
return isFinite(v) ? v : null;
}
function ooo(r) {
var c = (r && r.company) || {};
return /ограниченной\s+ответственностью/i.test(strokaDosje(r, /^Организационно-правовая форма$/i) + ' ' + String(c.name_full || ''));
}
function rubliTochno(v) {
var z = Math.round(v * 100), cel = Math.floor(z / 100), kop = z % 100;
return String(cel).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + (kop ? ',' + ('0' + kop).slice(-2) : '') + NB + '₽';
}
var POD_KAP = 'Если ваше требование к' + NB + 'компании возникло до' + NB + 'первой публикации уведомления об' + NB + 'уменьшении, в' + NB + 'течение 30' + NB + 'дней ' +
'с' + NB + 'последней публикации в' + NB + '«Вестнике государственной регистрации» вы вправе потребовать досрочного исполнения, а' + NB + 'если это невозможно — ' +
'прекращения обязательства и' + NB + 'возмещения убытков (п.' + NB + '5 ст.' + NB + '20 14-ФЗ). Пропустили 30' + NB + 'дней — право требовать досрочно уходит; ' +
'обычные права по' + NB + 'договору остаются. В' + NB + 'суд с' + NB + 'таким требованием — не' + NB + 'позднее 6' + NB + 'месяцев с' + NB + 'последней публикации.';
var POD_KPP = 'Старый КПП в' + NB + 'вашей платёжке — частая причина уточнения платежа. Новые реквизиты возьмите письмом за' + NB + 'подписью ' +
'и' + NB + 'подтвердите звонком по' + NB + 'известному номеру.';
var POD_REORG = 'Обязательства перейдут к' + NB + 'правопреемнику — узнайте, к' + NB + 'какому, и' + NB + 'проверьте его по' + NB + 'ИНН так' + NB + 'же, как саму компанию. ' +
'Если ваше требование возникло до' + NB + 'первой публикации о' + NB + 'реорганизации, проверьте сроки: 30' + NB + 'дней с' + NB + 'последней публикации ' +
'в' + NB + '«Вестнике государственной регистрации» (п.' + NB + '2 ст.' + NB + '60 ГК' + NB + 'РФ).';
function vRaz(k) {
if (k >= 10) { var n = Math.round(k); return 'в' + NB + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + skl(n, 'раз', 'раза', 'раз'); }
var t = chislo(Math.floor(k * 10) / 10, 1).replace(/,0$/, '');
return 'в' + NB + t + NB + (/,/.test(t) ? 'раза' : skl(+t, 'раз', 'раза', 'раз'));
}
function ubSerija(arr) {
var po = {};
(Array.isArray(arr) ? arr : []).forEach(function (x) {
var g = x ? parseInt(x.year, 10) : NaN;
if (isFinite(g) && x.value !== null && x.value !== '' && typeof x.value !== 'boolean' && isFinite(Number(x.value))) po[g] = Number(x.value);
});
var gody = Object.keys(po).map(Number).sort(function (a, b) { return a - b; });
if (!gody.length) return null;
var g1 = gody[gody.length - 1], n = 0;
while (po.hasOwnProperty(g1 - n) && po[g1 - n] < 0) n++;
return n >= 2 ? [g1, n] : null;
}
function rent() {
try {
if (typeof self !== 'undefined' && self.Rentabelnost) return self.Rentabelnost;
if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./rentabelnost.js');
} catch (e) {}
return null;
}
function ixModul() {
try {
if (typeof self !== 'undefined' && self.IndeksOtvet) return self.IndeksOtvet;
if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./indeks-otvet.js');
} catch (e) {}
return null;
}
function ixChislo(r) {
var v = r && r.indeks;
if (v !== undefined && v !== null && v !== '') {
if (typeof v === 'object') v = v.znachenie != null ? v.znachenie : v.ball;
v = typeof v === 'string' && /^\d{1,2}$/.test(v) ? +v : v;
return typeof v === 'number' && v >= 1 && v <= 99 && Math.round(v) === v ? v : null;
}
var IO = ixModul();
try { return IO && IO.gotov && IO.gotov() ? IO.ball(r) : null; } catch (e) { return null; }
}
function ixRazbor(r) {
var v = r && r.indeks;
if (v !== undefined && v !== null && v !== '') return null;
var IO = ixModul();
try {
if (!IO || !IO.gotov || !IO.gotov() || !IO.versiya) return null;
var x = IO.vid(r);
if (x.rezhim !== 'chislo' || !Array.isArray(x.vklady)) return null;
return { f: x.vklady.map(function (q) { return String(q.id); }).filter(function (id) { return /^[a-z0-9_]{2,40}$/.test(id); }).slice(0, 40),
p: isFinite(x.polnota) ? Math.round(x.polnota) : null, v: IO.versiya() };
} catch (e) { return null; }
}
function ixPochemu(a, b) {
if (!Array.isArray(a.ixf) || !Array.isArray(b.ixf)) return '';
if (a.ixv && b.ixv && a.ixv !== b.ixv) return 'Методика Индекса обновилась: v' + a.ixv + ' → v' + b.ixv + ' — факторы двух проверок не' + NB + 'сравниваем.';
var IO = ixModul(), F = function (id) { try { return IO && IO.faktor ? IO.faktor(id) : null; } catch (e) { return null; } };
var nov = [], ush = [];
b.ixf.forEach(function (id) { if (a.ixf.indexOf(id) < 0) { var f = F(id); if (f) nov.push(f); } });
a.ixf.forEach(function (id) { if (b.ixf.indexOf(id) < 0) { var f = F(id); if (f) ush.push(f); } });
var vse = nov.map(function (f) { return { f: f, d: f.vklad, n: 1 }; }).concat(ush.map(function (f) { return { f: f, d: -f.vklad, n: 0 }; }));
if (!vse.length) {
if (typeof a.ixp === 'number' && typeof b.ixp === 'number' && a.ixp !== b.ixp)
return 'Факторы те' + NB + 'же — изменилась полнота данных: ' + a.ixp + NB + '% → ' + b.ixp + NB + '%.';
return '';
}
vse.sort(function (p, q) { return Math.abs(q.d) - Math.abs(p.d); });
var est = vse.length > 3 ? vse.length - 3 : 0;
var dop = dopPochemu(a, b, nov, ush, vse, IO, est);
vse = vse.slice(0, 3);
var zn = function (n) { return (n > 0 ? '+' : '−') + Math.abs(n); };
var kav = function (t) { return '«' + String(t).replace(/«/g, '„').replace(/»/g, '“') + '»'; };
var chast = function (spisok, zag) {
return spisok.length ? zag + ' — ' + spisok.map(function (x) { return kav(x.f.tekst) + NB + '(' + zn(x.d) + ')'; }).join(', ') : '';
};
var t = [chast(vse.filter(function (x) { return x.n; }), 'появилось'), chast(vse.filter(function (x) { return !x.n; }), 'ушло')]
.filter(Boolean).join('; ');
return 'Почему: ' + t + (est ? '; и' + NB + 'ещё ' + est : '') + '.' + (dop ? ' ' + dop : '') +
' Вклады — по' + NB + 'открытой методике' + (b.ixv ? ' v' + b.ixv : '') + '.';
}
function dopPochemu(a, b, nov, ush, vse, IO, est) {
if (typeof a.ix !== 'number' || typeof b.ix !== 'number') return '';
var kav = function (t) { return '«' + String(t).replace(/«/g, '„').replace(/»/g, '“') + '»'; };
var minP = function (sp) {
var m = null;
sp.forEach(function (f) { if (typeof f.potolok === 'number' && (!m || f.potolok < m.potolok)) m = f; });
return m;
};
var pn = minP(nov), pu = minP(ush);
if (pn && b.ix === pn.potolok)
return (nov.length === 1 && !ush.length ? 'С' + NB + 'этим признаком' : 'При' + NB + 'признаке ' + kav(pn.tekst)) +
' Индекс не' + NB + 'выше ' + pn.potolok + ' — потолок методики.';
if (pu && a.ix === pu.potolok)
return 'Потолок методики «не' + NB + 'выше ' + pu.potolok + '» ушёл вместе с' + NB + 'признаком.';
if (est) return '';
var summa = 0;
vse.forEach(function (x) { summa += x.d; });
if (summa === b.ix - a.ix) return '';
var sh = null;
try { sh = IO && IO.shkala ? IO.shkala() : null; } catch (e) { sh = null; }
var pl = sh && typeof sh.plyusyMaks === 'number' ? ' (не' + NB + 'больше +' + sh.plyusyMaks + ')' : '';
var gr = sh && typeof sh.min === 'number' && typeof sh.max === 'number' ? 'шкала — от' + NB + sh.min + ' до' + NB + sh.max : 'шкала ограничена';
return 'Итог не' + NB + 'равен сумме вкладов: у' + NB + 'плюсов есть предел' + pl + ', у' + NB + 'части признаков — потолок, ' + gr + '.';
}
function ddmm(t) { var q = new Date(t + 3 * 3600 * 1000); return ('0' + q.getUTCDate()).slice(-2) + '.' + ('0' + (q.getUTCMonth() + 1)).slice(-2); }
function likvidnost(r) {
var D = (r && r.dossier) || {}, ch = D.charts || {}, v = null;
(Array.isArray(D.sections) ? D.sections : []).forEach(function (sk) {
if (!sk || sk.id !== 'dynamics' || !Array.isArray(sk.rows)) return;
sk.rows.forEach(function (row) {
if (!Array.isArray(row) || !/^Текущая ликвидность$/i.test(String(row[0] || '').trim())) return;
var m = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(row[1] == null ? '' : row[1]));
if (m) v = Number(m[1].replace(',', '.'));
});
});
var g = parseInt(((ch.balance || {}).year) || ((ch.debts || {}).year), 10);
if (v === null || !isFinite(v) || !(v > 0) || !isFinite(g)) return null;
return [g, Math.round(v * 100) / 100];
}
function dataRu(t) {
var d = new Date(t), m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
return d.getDate() + NB + m[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? NB + d.getFullYear() : '');
}
function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
function sravnit(a, b, dop) {
if (!a || !b || a.inn !== b.inn) return [];
var out = [];
function add(ton, t, pod) { var x = { ton: ton, t: t }; if (pod) x.pod = pod; out.push(x); }
var iA = iskl(a.kod), iB = iskl(b.kod), xA = isklyuchena(a.kod), xB = isklyuchena(b.kod), bezSt = false;
var zapis = function (s) { return s.kodd ? ': запись в' + NB + 'ЕГРЮЛ от' + NB + dmy(s.kodd) : ''; };
var ranshe = a.st ? ' (на' + NB + 'прошлой проверке — ' + nazvSt(a.st, a.kod) + ')' : '';
if (xB && !xA && (a.kod || a.st === 'ACTIVE' || a.st === 'LIQUIDATING')) {
add('huzhe', 'Компания исключена из' + NB + 'ЕГРЮЛ' + zapis(b) + ranshe,
'Последствия — как при' + NB + 'ликвидации (п.' + NB + '2 ст.' + NB + '64.2 ГК' + NB + 'РФ): договор с' + NB + 'ней не' + NB + 'заключайте и' + NB + 'не' + NB + 'платите. ' +
'Если она вам должна: исключение можно обжаловать в' + NB + 'суде в' + NB + 'течение года со дня, когда вы узнали или' + NB + 'должны были узнать о' + NB + 'нём (п.' + NB + '8 ст.' + NB + '22' + NB + '129-ФЗ). Долг можно требовать с' + NB + 'тех, кто' + NB + 'управлял компанией, если она не' + NB + 'заплатила из-за их' + NB + 'недобросовестных или' + NB + 'неразумных действий (п.' + NB + '3 ст.' + NB + '64.2 ГК' + NB + 'РФ, п.' + NB + '3.1 ст.' + NB + '3' + NB + '14-ФЗ). Разбор дела: что доказывать кредитору.');
bezSt = true;
} else if (iB && !iA && (a.kod || a.st === 'ACTIVE')) {
add('huzhe', nazvIskl(b.kod) + zapis(b) + ranshe, podIskl(b.kod, b.kodd));
bezSt = true;
} else if (iA && !iB && b.st === 'ACTIVE') {
add('luchshe', 'Отметки о' + NB + 'предстоящем исключении из' + NB + 'ЕГРЮЛ больше нет: компания действующая');
bezSt = true;
}
if (!bezSt && a.st && b.st && (a.st !== b.st || (a.kod && b.kod && iskl(a.kod) !== iskl(b.kod))) && nazvSt(a.st, a.kod) !== nazvSt(b.st, b.kod))
add(b.st === 'ACTIVE' ? 'luchshe' : 'huzhe', 'Статус в ЕГРЮЛ: ' + nazvSt(a.st, a.kod) + ' → ' + nazvSt(b.st, b.kod), b.st === 'REORGANIZING' ? POD_REORG : '');
if (a.lvl && b.lvl && a.lvl !== b.lvl) {
var o = ['low', 'medium', 'high'];
add(o.indexOf(b.lvl) > o.indexOf(a.lvl) ? 'huzhe' : 'luchshe', 'Оценка риска: ' + LVL[a.lvl] + ' → ' + LVL[b.lvl]);
}
if (a.ix && b.ix && a.ix !== b.ix && isFinite(a.t))
add(b.ix < a.ix ? 'huzhe' : 'luchshe', 'Индекс: ' + a.ix + ' → ' + b.ix + ' с' + NB + 'проверки ' + ddmm(a.t), ixPochemu(a, b));
if (a.zsk && b.zsk && a.zsk !== b.zsk) {
var z = ['low', 'medium', 'high'];
add(z.indexOf(b.zsk) > z.indexOf(a.zsk) ? 'huzhe' : 'luchshe', 'Прогноз ЗСК (наша оценка): ' + LVL[a.zsk] + ' → ' + LVL[b.zsk]);
}
if (a.nedost === false && b.nedost === true) add('huzhe', 'Появилась отметка о недостоверности сведений в ЕГРЮЛ');
if (a.nedost === true && b.nedost === false) add('luchshe', 'Отметка о недостоверности сведений в ЕГРЮЛ снята');
if (a.dir && b.dir && a.dir !== b.dir) add('info', 'Руководитель сменился: новая запись в ЕГРЮЛ с' + NB + dmy(b.dir));
if (typeof a.ku === 'number' && typeof b.ku === 'number' && a.ku > 0 && b.ku < a.ku)
add('info', 'Уставный капитал уменьшился: ' + rubliTochno(a.ku) + ' → ' + rubliTochno(b.ku) + ' (ЕГРЮЛ)', b.ooo && a.ooo ? POD_KAP : '');
if (a.kpp && b.kpp && a.kpp !== b.kpp)
add('info', 'КПП сменился: ' + a.kpp + ' → ' + b.kpp + (a.kpp.slice(0, 4) !== b.kpp.slice(0, 4) ? ' — компания встала на' + NB + 'учёт в' + NB + 'другой налоговой инспекции' : '') + ' (ЕГРЮЛ)', POD_KPP);
Object.keys(b.sig || {}).forEach(function (id) {
if (bezSt && id === 'status') return;
var x = (a.sig || {})[id], y = b.sig[id];
if (!x) { if (VES[y[0]] > 0) add('huzhe', y[1] + ': ' + STX[y[0]]); return; }
if (x[0] !== y[0]) add(VES[y[0]] > VES[x[0]] ? 'huzhe' : VES[y[0]] < VES[x[0]] ? 'luchshe' : 'info', y[1] + ': ' + STX[x[0]] + ' → ' + STX[y[0]]);
});
if (Object.keys(b.sig || {}).length) Object.keys(a.sig || {}).forEach(function (id) {
if ((bezSt && id === 'status') || b.sig.hasOwnProperty(id)) return;
var x = a.sig[id];
if (!Array.isArray(x) || !(VES[x[0]] > 0) || !x[1]) return;
add('info', x[1] + ': на' + NB + 'прошлой проверке — ' + STX[x[0]] + ', в' + NB + 'этой строки нет',
'Признак могли снять — или источник в' + NB + 'этот раз не' + NB + 'ответил. «Не' + NB + 'проверили» — не' + NB + 'значит «не' + NB + 'нашли».');
});
if (a.kap && b.kap && b.kap[0] >= a.kap[0]) {
if (a.kap[1] >= 0 && b.kap[1] < 0) add('huzhe', 'Собственный капитал ушёл в минус: на' + NB + '31.12.' + b.kap[0] +
' — минус ' + dengi(-b.kap[1]) + ', обязательства больше активов (ГИР' + NB + 'БО)');
else if (a.kap[1] < 0 && b.kap[1] >= 0) add('luchshe', 'Собственный капитал больше не отрицательный: на' + NB + '31.12.' + b.kap[0] +
' — ' + (b.kap[1] > 0 ? dengi(b.kap[1]) : '0' + NB + '₽') + ' (ГИР' + NB + 'БО)');
}
if (a.lk && b.lk && b.lk[0] >= a.lk[0]) {
if (a.lk[1] >= 1 && b.lk[1] < 1) add('huzhe', 'Текущая ликвидность опустилась ниже 1: на' + NB + '31.12.' + b.lk[0] +
' — ' + chislo(b.lk[1], 2) + ', краткосрочные долги больше оборотных средств (ГИР' + NB + 'БО)');
else if (a.lk[1] < 1 && b.lk[1] >= 1) add('luchshe', 'Оборотные средства снова покрывают краткосрочные долги: текущая ликвидность на' +
NB + '31.12.' + b.lk[0] + ' — ' + chislo(b.lk[1], 2) + ' (ГИР' + NB + 'БО)');
}
var novPrib = b.prib && b.vyr && b.prib[0] === b.vyr[0];
var tonOtch = !novPrib || !a.prib || !(b.prib[0] > a.prib[0]) ? 'info'
: a.prib[1] >= 0 && b.prib[1] < 0 ? 'huzhe' : a.prib[1] < 0 && b.prib[1] > 0 ? 'luchshe' : 'info';
if (b.vyr && (!a.vyr || b.vyr[0] > a.vyr[0])) add(tonOtch, 'Появилась отчётность за ' + b.vyr[0] + ': выручка ' + dengi(b.vyr[1]) +
(b.prib && b.prib[0] === b.vyr[0] ? ', ' + (b.prib[1] < 0 ? 'убыток ' + dengi(-b.prib[1]) : 'прибыль ' + dengi(b.prib[1])) : ''));
var gA = a.prib ? a.prib[0] : a.ub ? a.ub[0] : null;
if (b.ub && gA !== null && b.ub[0] > gA) {
var n = b.ub[1], ot = b.ub[0] - n + 1;
add('huzhe', 'Убыток ' + n + NB + skl(n, 'год', 'года', 'лет') + ' подряд: по годовой отчётности за ' +
(n === 2 ? ot + ' и ' + b.ub[0] : ot + '–' + b.ub[0]) + ' (ГИР' + NB + 'БО)');
}
if (a.ok && b.ok && a.ok !== b.ok) add('info', 'Основной вид деятельности в ЕГРЮЛ сменился: ' + a.ok + ' → ' + b.ok + (b.okn ? ' — ' + b.okn : ''));
if (a.zm && b.zm && b.zm[0] > a.zm[0]) {
var vA = a.vyr && a.vyr[0] === a.zm[0] && a.vyr[1] > 0 ? a.vyr[1] : null, vB = b.vyr && b.vyr[0] === b.zm[0] && b.vyr[1] > 0 ? b.vyr[1] : null;
var nd = 'на' + NB + '31.12.' + b.zm[0] + ' — ' + dengi(b.zm[1]);
if (vA !== null && vB !== null && a.zm[1] <= vA && b.zm[1] > vB) add('huzhe', 'Кредиты и займы стали больше годовой выручки: ' + nd +
', выручка за ' + b.zm[0] + ' — ' + dengi(vB) + ' (ГИР' + NB + 'БО)');
else if (vA !== null && vB !== null && a.zm[1] > vA && b.zm[1] <= vB) add('luchshe', 'Кредиты и займы больше не превышают годовую выручку: ' + nd +
', выручка за ' + b.zm[0] + ' — ' + dengi(vB) + ' (ГИР' + NB + 'БО)');
else if (a.zm[1] > 0 && b.zm[1] >= 2 * a.zm[1]) add('info', 'Кредиты и займы выросли ' + vRaz(b.zm[1] / a.zm[1]) + ': ' + nd +
', на' + NB + '31.12.' + a.zm[0] + ' — ' + dengi(a.zm[1]) + ' (ГИР' + NB + 'БО)');
}
if (a.egrd && b.egrd && b.egrd > a.egrd && !out.some(function (x) { return /ЕГРЮЛ/.test(x.t); }))
add('info', 'Запись в' + NB + 'ЕГРЮЛ обновлялась после вашей проверки: последнее изменение — ' + dmy(b.egrd),
'Из записи ЕГРЮЛ мы сравниваем статус, руководителя, капитал, КПП и' + NB + 'основной вид деятельности — они прежние. ' +
'Что ещё изменилось (например, участники или адрес), видно в' + NB + 'выписке ЕГРЮЛ.');
if (typeof dop === 'function') { try { var dx = dop(a, b); if (dx && dx.t) add(dx.ton, dx.t); } catch (e) {} }
var poryadok = { huzhe: 0, info: 1, luchshe: 2 };
return out.sort(function (p, q) { return poryadok[p.ton] - poryadok[q.ton]; }).slice(0, 7);
}
function chitat(ls) {
try { var o = JSON.parse(ls.getItem(KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return null; }
}
function zapisat(ls, o) { try { ls.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }
function zapomnit(r, ls) {
var b = snimok(r);
if (!b || !ls) return null;
var vse = chitat(ls);
if (!vse) return null;
var spisok = (Array.isArray(vse[b.inn]) ? vse[b.inn] : []).filter(function (x) { return x && x.inn === b.inn && isFinite(x.t); });
var rannie = spisok.filter(function (x) { return x.t <= b.t - CHAS; });
var a = rannie.length ? rannie[rannie.length - 1] : null;
if (!spisok.some(function (x) { return Math.abs(x.t - b.t) < CHAS; })) {
spisok.push(b);
spisok.sort(function (p, q) { return p.t - q.t; });
vse[b.inn] = spisok.slice(-MAKS_SNIMKOV);
var inns = Object.keys(vse).sort(function (p, q) {
var tp = (vse[p][vse[p].length - 1] || {}).t || 0, tq = (vse[q][vse[q].length - 1] || {}).t || 0;
return tq - tp;
});
inns.slice(MAKS_INN).forEach(function (k) { delete vse[k]; });
if (!zapisat(ls, vse)) return null;
}
if (!a) return b.egrd ? { pervyj: true, egrd: b.egrd, t: b.t } : { pervyj: true };
return { s: a, izm: sravnit(a, b) };
}
function sravnitSnimki(r, ls) {
var b = snimok(r);
if (!b || !ls) return null;
var vse = chitat(ls);
if (!vse) return null;
var a = null;
(Array.isArray(vse[b.inn]) ? vse[b.inn] : []).forEach(function (x) {
if (x && x.inn === b.inn && isFinite(x.t) && x.t <= b.t - CHAS && (!a || x.t > a.t)) a = x;
});
return a ? { s: a, izm: sravnit(a, b) } : null;
}
function obrazecIzm(r) {
var b = snimok(r);
if (!b) return null;
var a = JSON.parse(JSON.stringify(b));
a.t = b.t - 35 * 24 * CHAS;
a.lvl = 'medium';
if (b.kpp) a.kpp = b.kpp.slice(0, 2) + '11' + b.kpp.slice(4);
if (b.vyr) { a.vyr = [b.vyr[0] - 1, Math.round(b.vyr[1] * 0.91)]; delete a.prib; }
return { s: a, izm: sravnit(a, b) };
}
function htmlPasport(rez, obrazec) {
if (!rez || !rez.s || !Array.isArray(rez.izm)) return '';
return '<section class="pk-izm noprint" aria-label="Что изменилось с вашей прошлой проверки">' + htmlIzmeneniya(rez) +
'<p class="pk-izm__n">' + (obrazec ? 'Образец: так блок выглядит, когда вы проверяете компанию повторно. ' : '') +
(rez.izm.length ? '' : 'Сравнили с' + NB + 'вашей проверкой на' + NB + 'этом устройстве. ') +
'Блок только на экране: в' + NB + 'PDF Паспорта и в' + NB + 'его отпечаток не' + NB + 'входит.</p></section>';
}
function htmlIzmeneniya(rez, opt) {
if (!rez) return '';
var ZAPOMNILI = 'Запомнили эту проверку на' + NB + 'вашем устройстве. Проверите компанию снова — покажем, что изменилось.';
if (rez.pervyj && opt && opt.dokument) {
var dd = rez.egrd ? davnost(rez.egrd, rez.t) : null;
if (!dd) return '';
var kogdaD = dd.dn === 0 ? 'в' + NB + 'день проверки' : 'за ' + dd.t.replace(/ назад$/, '') + ' до' + NB + 'проверки';
return '<p class="izm izm--0" data-izm="egryul">Последнее изменение записи в' + NB + 'ЕГРЮЛ — ' + dmy(rez.egrd) + ', ' + kogdaD + '.' +
(dd.dn <= 30 ? ' Что именно изменилось, видно в' + NB + VYPISKA + '; перед оплатой сверьте с' + NB + 'ней подписанта и адрес в' + NB + 'договоре.' : '') + '</p>';
}
if (rez.pervyj) {
var dv = rez.egrd ? davnost(rez.egrd, rez.t) : null;
if (!dv) return '<p class="izm izm--0">' + ZAPOMNILI + '</p>';
if (dv.dn <= 30) return '<div class="izm izm--da izm--svezh" data-izm="egryul"><b>Запись в' + NB + 'ЕГРЮЛ менялась недавно: ' + dmy(rez.egrd) +
', ' + dv.t + '</b><span>Что именно изменилось, видно в' + NB + VYPISKA + '. Перед оплатой сверьте с' + NB +
'ней подписанта и адрес в' + NB + 'договоре.</span></div><p class="izm izm--0">' + ZAPOMNILI + '</p>';
return '<p class="izm izm--0" data-izm="egryul">Последнее изменение записи в' + NB + 'ЕГРЮЛ — ' + dmy(rez.egrd) + ', ' + dv.t + '. ' + ZAPOMNILI + '</p>';
}
var kogda = dataRu(rez.s.t);
var dosje = rez.id ? '<a href="/report.html?id=' + encodeURIComponent(rez.id) + '" target="_blank" rel="noopener">досье от' + NB + dmyT(rez.s.t) + '</a>' : '';
if (!rez.izm.length) return '<div class="izm"' + (rez.id ? ' data-izm="kabinet"' : '') + '><b>С вашей проверки ' + kogda + ' существенных изменений нет</b>' +
'<span>Статус, руководитель, долги, оценка риска и признаки светофора — прежние.' + (rez.id ? ' Сравнили с ' + dosje + ' в вашем кабинете.' : '') + '</span></div>';
return '<div class="izm izm--da"' + (rez.id ? ' data-izm="kabinet"' : '') + '><b>Что изменилось с вашей проверки ' + kogda + '</b><ul>' +
rez.izm.map(function (x) {
return '<li class="izm--' + x.ton + '">' + esc(x.t) + (x.pod ? '<small class="izm__pod">' + esc(x.pod).replace('vestnik-gosreg.ru',
'<a href="https://vestnik-gosreg.ru/" target="_blank" rel="noopener">vestnik-gosreg.ru</a>').replace('в' + NB + 'выписке ЕГРЮЛ.', 'в' + NB + VYPISKA + '.').replace('Разбор дела: что доказывать кредитору.',
'<a href="' + RAZBOR_ISKL + '">Разбор дела: что доказывать кредитору.</a>') + '</small>' : '') + '</li>';
}).join('') +
'</ul><span>' + (rez.id ? 'Сравниваем с ' + dosje + ' из вашего кабинета — проверка с любого устройства.'
: 'Сравниваем с проверкой на этом устройстве; снимок хранится только в вашем браузере.') + '</span></div>';
}
function dmyT(t) {
var d = new Date(t + 3 * CHAS);
return ('0' + d.getUTCDate()).slice(-2) + '.' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '.' + d.getUTCFullYear();
}
function predydushchaya(rows, inn, t, tekId) {
var best = null;
(Array.isArray(rows) ? rows : []).forEach(function (x) {
if (!x || String(x.inn || '').trim() !== inn || !x.report_id) return;
var tx = Date.parse(String(x.created_at || ''));
if (!isFinite(tx) || tx > t - CHAS || String(x.report_id) === String(tekId || '')) return;
if (!best || tx > best.t) best = { id: String(x.report_id), t: tx };
});
return best;
}
function nuzhenKabinet(lokal, server) {
if (!server) return false;
var tl = lokal && lokal.s && isFinite(lokal.s.t) ? lokal.s.t : -Infinity;
return server.t > tl + CHAS;
}
var poslednij = null;
var pokazan = null;
var dopolnenie = null;
function sDop(rez, b, fn) {
if (!rez || !rez.s || !Array.isArray(rez.izm) || typeof fn !== 'function') return null;
var x = null;
try { x = fn(rez.s, b); } catch (e) { x = null; }
if (!x || !x.t || rez.izm.some(function (q) { return q.t === x.t; })) return null;
var dx = { ton: x.ton, t: x.t }; if (x.pod) dx.pod = x.pod;
var poryadok = { huzhe: 0, info: 1, luchshe: 2 }, izm = rez.izm.concat([dx]);
izm.sort(function (p, q) { return poryadok[p.ton] - poryadok[q.ton]; });
var nov = {}; Object.keys(rez).forEach(function (k) { nov[k] = rez[k]; });
nov.izm = izm.slice(0, 7);
return nov;
}
function dobavit(report, r, fn) {
var b = snimok(r);
if (!report || !b || typeof fn !== 'function') return null;
var kl = b.inn + ':' + b.t;
dopolnenie = { kl: kl, fn: fn };
if (!pokazan || pokazan.kl !== kl) return null;
var nov = sDop(pokazan.rez, b, fn);
if (!nov) return null;
pokazan.rez = nov;
try { vstavit(report, htmlIzmeneniya(nov)); } catch (e) { return null; }
return nov;
}
function dogruzit(report, r, opt) {
opt = opt || {};
var f = opt.fetch || (typeof fetch === 'function' ? fetch : null);
var b = snimok(r), voshel = opt.voshel;
if (voshel == null) { try { voshel = window.localStorage.getItem('dlk_voshel') === '1'; } catch (e) { voshel = false; } }
if (!report || !b || !f || !voshel || opt.api == null) return Promise.resolve(null);
var lokal = poslednij && poslednij.inn === b.inn && poslednij.t === b.t ? poslednij.rez : null;
var api = String(opt.api), kl = b.inn + ':' + b.t;
try { report.setAttribute('data-izm-k', kl); } catch (e) { return Promise.resolve(null); }
function json(u, cr) {
return f(api + u, cr ? { credentials: 'include' } : {}).then(function (x) { if (!x || !x.ok) throw 0; return x.json(); });
}
return json('/api/me/checks', true).then(function (j) {
var srv = predydushchaya(j && (j.checks || j), b.inn, b.t, r.report_id);
if (!nuzhenKabinet(lokal, srv)) return null;
return json('/api/report/' + encodeURIComponent(srv.id)).then(function (pr) {
var a = snimok(pr);
if (!a || a.inn !== b.inn || !(a.t <= b.t - CHAS) || report.getAttribute('data-izm-k') !== kl) return null;
var rez = { s: a, izm: sravnit(a, b, dopolnenie && dopolnenie.kl === kl ? dopolnenie.fn : null), id: srv.id };
vstavit(report, htmlIzmeneniya(rez));
pokazan = { kl: kl, rez: rez, b: b };
try { if (typeof window !== 'undefined' && window.dlkGoal) window.dlkGoal('izm_kabinet'); } catch (e) {}
return rez;
});
}).catch(function () { return null; });
}
function vstavit(report, h) {
var doc = report.ownerDocument, t = doc.createElement('div');
t.innerHTML = h;
var nov = t.firstChild, star = report.querySelector('.izm');
if (!nov) return;
if (star) { star.parentNode.replaceChild(nov, star); return; }
var din = report.querySelector('.din');
if (din) { din.parentNode.insertBefore(nov, din); return; }
var rows = report.querySelector('.rows');
if (rows && rows.parentNode) rows.parentNode.insertBefore(nov, rows.nextSibling);
}
var CSS = '.din{display:grid;gap:10px;padding:16px 18px;border-radius:16px;background:var(--bg,#F5F5F2)}' +
'.din__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.din__h b{font-size:15px;font-weight:600}.din__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
'.din__w{overflow-x:auto}.din__t{width:100%;border-collapse:collapse;font-size:15px}' +
'.din__cap{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
'.din__t th,.din__t td{padding:10px 0 10px 16px;border-top:1px solid var(--line,#E6E6E1);vertical-align:middle;text-align:left;font-weight:400}' +
'.din__t th:first-child{padding-left:0}' +
'.din__t thead th{border-top:0;padding-top:2px;padding-bottom:6px;font-size:12px;color:var(--muted,#6B6B70)}' +
'.din__n small{display:block;font-size:12px;color:var(--muted,#6B6B70)}' +
'.din__v{text-align:right!important;white-space:nowrap}.din__v b{font-weight:600}' +
'.n{font-variant-numeric:tabular-nums}.din__p{color:var(--ink2,#48484C)}.din__na{font-size:12px;color:var(--muted,#6B6B70)}' +
'.din__k{font-size:13px;color:var(--muted,#6B6B70)}.din__r--vverh .din__k{color:var(--ok,#16723F)}.din__r--vniz .din__k{color:#B3261E}' +
'.din__g{width:96px}.din__sv{display:block}.din__sv polyline{fill:none;stroke:var(--accent,#0B63E5);stroke-width:1.5;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}' +
'.din__sv .din__0{stroke:#C9C9C4;stroke-width:1;stroke-dasharray:2 2}' +
'.din__star{margin:0;padding:10px 12px;border-radius:10px;background:var(--warn-bg,#FBF3E2);color:var(--warn,#8A5A00);font-size:15px;line-height:1.45}' +
'.din__tr{margin:0;font-size:15px;color:var(--ink2,#48484C)}.din__skachok{margin:0;padding:10px 12px;border-radius:10px;background:var(--surface-2,#F4F4F2);font-size:15px;line-height:1.45;color:var(--ink2,#48484C)}.din__skachok b{color:var(--ink,#1D1D1F)}.din__skachok--warn{background:var(--warn-bg,#FBF3E2);color:var(--warn,#8A5A00)}.din__skachok--warn b{color:inherit}.din__src{margin:0;font-size:12px;color:var(--muted,#6B6B70)}' +
'.din__bal{display:grid;gap:8px;padding-top:6px;border-top:1px solid var(--line,#E6E6E1)}' +
'.din__bh{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 10px;margin-top:6px}.din__bh b{font-size:15px;font-weight:600}.din__bh span{font-size:12px;color:var(--muted,#6B6B70)}' +
'.din__bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;background:var(--surface-2,#EEEEEA)}.din__bar i{display:block;height:100%;min-width:2px}' +
'.din__b--kap{background:var(--accent,#0B63E5)}.din__b--dol{background:#7FA8F0}.din__b--kor{background:#C9C9C4}' +
'.din__leg{margin:0;padding:0;list-style:none;display:grid;gap:2px;font-size:15px}' +
'.din__leg li{display:grid;grid-template-columns:auto 1fr auto 10em;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid var(--line,#E6E6E1)}.din__leg li:first-child{border-top:0}' +
'.din__leg li>i{width:8px;height:8px;border-radius:2px;align-self:center}.din__ras li{grid-template-columns:1fr auto 10em}' +
'.din__leg b{font-weight:600;text-align:right;white-space:nowrap}.din__leg em{font-style:normal;font-size:12px;color:var(--muted,#6B6B70);text-align:right;white-space:nowrap}' +
'.din__minus>i{background:#B3261E}.din__minus b,.din__minus em{color:#B3261E}' +
'@media (max-width:520px){.din__leg li{grid-template-columns:auto 1fr auto}.din__ras li{grid-template-columns:1fr auto}.din__leg em{grid-column:2/-1;text-align:left;margin-top:-4px}.din__ras em{grid-column:1/-1}.din__leg em:empty{display:none}}' +
'.izm{display:grid;gap:4px;padding:14px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);font-size:15px}' +
'.izm b{font-size:15px;font-weight:600}.izm span{font-size:12px;color:var(--muted,#6B6B70)}.izm span a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
'.izm ul{margin:4px 0;padding:0;list-style:none;display:grid;gap:4px}.izm li{padding-left:18px;position:relative}' +
'.izm li::before{content:"";position:absolute;left:2px;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--muted,#6B6B70)}' +
'.izm__pod{display:block;margin-top:2px;font-size:13px;line-height:1.45;color:var(--muted,#6B6B70)}.izm__pod a{white-space:nowrap;color:inherit;text-decoration:underline;text-underline-offset:2px}' +
'.izm li.izm--huzhe::before{background:#E5484D}.izm li.izm--luchshe::before{background:#2FA36B}' +
'.izm--0{margin:0;padding:0;border:0;font-size:13px;color:var(--muted,#6B6B70)}' +
'.izm--svezh{border-color:#E8D3A6;background:#FFFAF0}.izm--svezh+.izm--0{margin-top:8px}' +
'#doc .izm,#doc .din{margin-top:14px}' +
'@media (max-width:640px){.din__t .din__g{display:none}}' +
'@media (max-width:520px){.din{padding:14px}.din__t{font-size:15px}.din__t th,.din__t td{padding-left:10px}.din__t .din__p{display:none}}' +
'@media print{.din,.izm{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}.izm--0{display:none}}';
function stil(doc) {
if (!doc || doc.getElementById('din-css')) return;
var s = doc.createElement('style'); s.id = 'din-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function ozhidatIndeks(r, ls, doc) {
var b = snimok(r), v = r && r.indeks;
if (!b || b.ix != null || b.inn.length !== 10 || (v !== undefined && v !== null && v !== '')) return false;
var IO = ixModul();
if (!IO || typeof IO.gotovo !== 'function' || typeof IO.gotov !== 'function' || IO.gotov()) return false;
var kl = b.inn + ':' + b.t, popytki = 0;
var zhdat = function () {
if (!IO.gotov() && ++popytki < 4) { IO.gotovo(zhdat); return; }
try { dopisatIndeks(r, ls, kl, doc); } catch (e) {}
};
IO.gotovo(zhdat);
return true;
}
function dopisatIndeks(r, ls, kl, doc) {
var b = snimok(r);
if (!b || b.ix == null || b.inn + ':' + b.t !== kl) return null;
var zapisan = false;
var vse = ls ? chitat(ls) : null;
if (vse && Array.isArray(vse[b.inn])) {
vse[b.inn].forEach(function (x) {
if (!x || x.inn !== b.inn || !isFinite(x.t) || Math.abs(x.t - b.t) >= CHAS || x.ix != null) return;
x.ix = b.ix;
if (Array.isArray(b.ixf)) { x.ixf = b.ixf; x.ixp = b.ixp; x.ixv = b.ixv; }
zapisan = true;
});
if (zapisan) zapisan = zapisat(ls, vse);
}
var out = { b: b, zapisan: zapisan, rez: null };
if (!pokazan || pokazan.kl !== kl || !pokazan.rez || !pokazan.rez.s || !Array.isArray(pokazan.rez.izm)) return out;
var star = pokazan.rez, izm = sravnit(star.s, b, dopolnenie && dopolnenie.kl === kl ? dopolnenie.fn : null);
pokazan.b = b;
if (JSON.stringify(izm) === JSON.stringify(star.izm)) return out;
var nov = {}; Object.keys(star).forEach(function (k) { nov[k] = star[k]; });
nov.izm = izm;
pokazan.rez = nov;
if (poslednij && poslednij.inn + ':' + poslednij.t === kl && !star.id) poslednij.rez = nov;
out.rez = nov;
try {
doc = doc || (typeof document !== 'undefined' ? document : null);
var mesto = doc && (doc.querySelector('.report') || doc.body);
if (mesto && mesto.querySelector('.izm')) vstavit(mesto, htmlIzmeneniya(nov));
} catch (e) {}
return out;
}
function html(r, opt) {
opt = opt || {};
var ls = null;
try { ls = opt.ls || (typeof window !== 'undefined' && window.localStorage) || null; } catch (e) { ls = null; }
try { if (typeof document !== 'undefined') stil(document); } catch (e) {}
var izm = '';
try {
var rez = zapomnit(r, ls), b = snimok(r);
poslednij = b ? { inn: b.inn, t: b.t, rez: rez } : null;
pokazan = b ? { kl: b.inn + ':' + b.t, rez: rez, b: b } : null;
izm = htmlIzmeneniya(rez, { dokument: !!opt.dokument });
ozhidatIndeks(r, ls, opt.doc);
} catch (e) { izm = ''; }
var din = '';
try { din = htmlDinamika(r, opt); if (!din && opt.balans !== false) din = htmlBalansOtdelno(r); } catch (e) { din = ''; }
return izm + din;
}
return { skachok: skachok, skachokHtml: skachokHtml, ryad: ryad, ryady: ryady, nalogBezZnaka: nalogBezZnaka, stroka: stroka, izmenenie: izmenenie, trendy: trendy, dengi: dengi, htmlDinamika: htmlDinamika, poslGodOtchetnosti: poslGodOtchetnosti, staraya: staraya, balans: balans, htmlBalans: htmlBalans,
snimok: snimok, sravnit: sravnit, likvidnost: likvidnost, okved: okved, ustKapital: ustKapital, rubliTochno: rubliTochno, vRaz: vRaz, zapomnit: zapomnit, htmlIzmeneniya: htmlIzmeneniya, html: html, KEY: KEY, CSS: CSS,
iskl: iskl, isklyuchena: isklyuchena, ixChislo: ixChislo, plusMes: plusMes, kodSost: kodSost, predydushchaya: predydushchaya, nuzhenKabinet: nuzhenKabinet, dogruzit: dogruzit, dobavit: dobavit, sDop: sDop, ozhidatIndeks: ozhidatIndeks, dopisatIndeks: dopisatIndeks,
sravnitSnimki: sravnitSnimki, obrazecIzm: obrazecIzm, htmlPasport: htmlPasport, stil: stil };
});
;
/* --- /js/golos.js --- */
(function (root) {
"use strict";
var MAX = 500;
var DEN = 864e5, PAUZA_DNEJ = 30, POSLE_KOMPANIJ = 3, POSLE_KOMPANIJ_GOST = 2;
var TEMY = [
{ k: "sudy", t: "Суды и банкротства" },
{ k: "bank", t: "Отчёт для банка" },
{ k: "1s", t: "Выписка из 1С целиком" },
{ k: "slezhenie", t: "Слежение за контрагентами" },
{ k: "api", t: "API и выгрузка" },
{ k: "drugoe", t: "Другое" }
];
var KLYUCHI = TEMY.reduce(function (o, x) { o[x.k] = 1; return o; }, {});
var T = {
kabZag: "Чего не хватает в Делоскопе?",
kabPod: "Отметьте, что пригодилось бы в вашей работе, — по этим ответам решаем, что делать первым.",
pole: "Своими словами — необязательно",
chistka: "Телефоны, почту и номера уберём из текста ещё до отправки. Ответ читает только команда Делоскопа.",
otpravit: "Отправить",
spasibo: "Спасибо, получили.",
spasiboPod: "Что сделаем по таким просьбам, появится в «Что нового».",
ne: "Сайт не принял ответ.",
nePod: "Отправьте его письмом — текст уже подставлен:",
pismo: "Написать на help@deloskop.ru",
otchZag: "Что добавить в отчёт?",
otchPod: "Одной строкой — читаем каждую.",
otchPole: "Например, суды за пять лет",
nesejchas: "Не сейчас"
};
function chistyj(t) {
return String(t || "")
.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[почта]")
.replace(/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, "[телефон]")
.replace(/\b\d{10,20}\b/g, "[номер]")
.replace(/\s+/g, " ").trim().slice(0, MAX);
}
function tema(vybrano) {
var s = {};
(vybrano || []).forEach(function (k) { if (KLYUCHI[k]) s[k] = 1; });
return TEMY.filter(function (x) { return s[x.k]; }).map(function (x) { return x.k; }).join(",");
}
function novyjId() {
var a = new Uint8Array(8);
try { (root.crypto || require("crypto").webcrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < 8; i++) a[i] = Math.random() * 256; }
return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
}
function telo(vid, vybrano, tekst, id) {
var b = { id: /^[0-9a-f]{16}$/.test(id || "") ? id : novyjId(), stranica: vid === "kabinet" ? "/cabinet.html" : "/",
vid: vid === "kabinet" ? "kabinet" : "otchet", ocenka: "golos", tema: tema(vybrano), rezhim: "rabota" };
var t = chistyj(tekst);
if (t) b.tekst = t;
return b.tema || b.tekst ? b : null;
}
function mailto(b) {
var podpisi = (b.tema ? b.tema.split(",") : []).map(function (k) { for (var i = 0; i < TEMY.length; i++) if (TEMY[i].k === k) return TEMY[i].t; return k; });
var telo = (b.vid === "kabinet" ? "Чего не хватает: " : "Что добавить в отчёт: ") +
(podpisi.length ? podpisi.join(", ") : "") + (podpisi.length && b.tekst ? ". " : "") + (b.tekst || "");
return "mailto:help@deloskop.ru?subject=" + encodeURIComponent(b.vid === "kabinet" ? "Чего не хватает в Делоскопе" : "Что добавить в отчёт") +
"&body=" + encodeURIComponent(telo);
}
function otpechatok(inn) {
var s = String(inn || ""), h = 5381;
for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
return (h % 4096).toString(36);
}
function uchest(sost, inn) {
var s = { n: +(sost && sost.n) || 0, p: (sost && sost.p) || "", t: +(sost && sost.t) || 0 };
var o = otpechatok(inn);
if (inn && o !== s.p) { s.n += 1; s.p = o; }
return s;
}
function pokazat(sost, voshel, seichas) {
if (!sost) return false;
if ((+sost.n || 0) < (voshel ? POSLE_KOMPANIJ : POSLE_KOMPANIJ_GOST)) return false;
return !sost.t || (seichas - sost.t) >= PAUZA_DNEJ * DEN;
}
var api = { TEMY: TEMY, T: T, MAX: MAX, PAUZA_DNEJ: PAUZA_DNEJ, POSLE_KOMPANIJ: POSLE_KOMPANIJ, POSLE_KOMPANIJ_GOST: POSLE_KOMPANIJ_GOST,
chistyj: chistyj, tema: tema, telo: telo, mailto: mailto, otpechatok: otpechatok, uchest: uchest, pokazat: pokazat, novyjId: novyjId };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof document === "undefined") return;
root.DlkGolos = api;
var KLYUCH = "dlk_golos";
function prochest() { try { return JSON.parse(localStorage.getItem(KLYUCH) || "null") || {}; } catch (e) { return {}; } }
function zapisat(s) { try { localStorage.setItem(KLYUCH, JSON.stringify(s)); } catch (e) {} }
function voshel() { try { return localStorage.getItem("dlk_voshel") === "1"; } catch (e) { return false; } }
function cel(c, p) { try { if (window.dlkGoal) window.dlkGoal(c, p); } catch (e) {} }
function apiUrl(o) { return (o && o.api != null) ? String(o.api) : (/(^|\.)deloskop\.ru$/.test(location.hostname) ? "https://api.deloskop.ru" : ""); }
function otpravit(u, b) {
if (!u) return Promise.reject(new Error("net api"));
return fetch(u + "/api/otzyv", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
.then(function (r) { if (!r.ok) throw new Error(r.status); return r; });
}
var CSS = ".golos__temy{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}" +
".golos__t{min-height:40px;padding:0 16px;border:1px solid #D9D9D4;border-radius:999px;background:#fff;color:#1D1D1F;font:inherit;font-size:15px;font-weight:500;cursor:pointer}" +
".golos__t:hover{border-color:#0B63E5}.golos__t[aria-pressed=true]{background:#EAF1FD;border-color:#0B63E5;color:#0B63E5}" +
".golos__t[aria-pressed=true]::before{content:\"✓\\00a0\"}" +
".golos textarea,.golos__in{width:100%;margin:12px 0 0;padding:12px 14px;border:1px solid #D9D9D4;border-radius:10px;font:inherit;font-size:17px;color:#1D1D1F;background:#fff;box-sizing:border-box}" +
".golos textarea{min-height:76px;resize:vertical}" +
".golos textarea:focus,.golos__in:focus{outline:2px solid #0B63E5;outline-offset:1px;border-color:#0B63E5}" +
".golos__m{margin:8px 0 0;font-size:13px;line-height:1.45;color:#6B6B70}" +
".golos__r{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}" +
".golos__ok{margin:0;font-weight:600}.golos__ok span{display:block;font-weight:400;font-size:15px;color:#48484C}" +
".golos :focus-visible{outline:3px solid #0B63E5;outline-offset:2px}" +
".golos--otchet{margin:20px 0 0;padding:18px 20px;border-radius:16px;background:#F5F5F2}" +
".golos--otchet .golos__z{margin:0;font-weight:600;font-size:17px}.golos--otchet .golos__z span{display:block;font-weight:400;font-size:15px;color:#6B6B70}" +
".golos__b{min-height:44px;padding:0 18px;border:0;border-radius:10px;background:#0B63E5;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}" +
".golos__b:disabled{opacity:.45;cursor:default}.golos__b--tiho{background:none;color:#48484C;box-shadow:inset 0 0 0 1px #D9D9D4}" +
"@media print{.golos{display:none}}";
function stil() {
if (document.querySelector("style[data-golos]")) return;
var s = document.createElement("style"); s.setAttribute("data-golos", ""); s.textContent = CSS; document.head.appendChild(s);
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function itog(box, ok, b) {
box.innerHTML = ok
? '<p class="golos__ok" tabindex="-1">' + T.spasibo + "<span>" + T.spasiboPod + "</span></p>"
: '<p class="golos__ok" tabindex="-1">' + T.ne + "<span>" + T.nePod + ' <a href="' + esc(mailto(b)) + '">' + T.pismo + "</a></span></p>";
try { box.querySelector(".golos__ok").focus(); } catch (e) {}
}
function kabinet(el, o) {
if (!el || el.getAttribute("data-golos-gotov")) return;
el.setAttribute("data-golos-gotov", ""); stil();
el.classList.add("golos");
el.innerHTML = '<h2 id="golos-z">' + T.kabZag + '</h2><p class="sub" style="margin:0">' + T.kabPod + "</p>" +
'<div class="golos__box"><ul class="golos__temy" role="group" aria-labelledby="golos-z">' +
TEMY.map(function (x) { return '<li><button type="button" class="golos__t" aria-pressed="false" data-tema="' + x.k + '">' + x.t + "</button></li>"; }).join("") + "</ul>" +
'<label class="vh" for="golos-t">' + T.pole + '</label><textarea id="golos-t" maxlength="' + MAX + '" placeholder="' + T.pole + '"></textarea>' +
'<p class="golos__m">' + T.chistka + "</p>" +
'<div class="golos__r"><button type="button" class="btn primary" data-golos-go disabled>' + T.otpravit + "</button></div></div>";
el.hidden = false;
var box = el.querySelector(".golos__box"), ta = el.querySelector("textarea"), go = el.querySelector("[data-golos-go]");
function vybrano() { return Array.prototype.map.call(el.querySelectorAll('[aria-pressed="true"]'), function (b) { return b.getAttribute("data-tema"); }); }
function obnovit() { go.disabled = !telo("kabinet", vybrano(), ta.value); }
el.querySelectorAll("[data-tema]").forEach(function (b) {
b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); obnovit(); });
});
ta.addEventListener("input", obnovit);
go.addEventListener("click", function () {
var b = telo("kabinet", vybrano(), ta.value);
if (!b) return;
go.disabled = true;
cel("golos_otpravlen", { vid: "kabinet", tema: b.tema || "tekst" });
otpravit(apiUrl(o), b).then(function () { itog(box, true, b); }, function () { itog(box, false, b); });
});
}
function posleProverki(report, r, o) {
o = o || {};
if (!report || !r) return false;
var inn = r.company && r.company.inn;
var s = uchest(prochest(), inn);
var seichas = o.seichas || Date.now();
var vsh = o.voshel != null ? !!o.voshel : voshel();
var nado = pokazat(s, vsh, seichas);
if (nado) s.t = seichas;
zapisat(s);
if (!nado || report.querySelector("[data-golos-otchet]")) return false;
stil();
var d = document.createElement("section");
d.className = "golos golos--otchet"; d.setAttribute("data-golos-otchet", ""); d.setAttribute("aria-label", T.otchZag);
d.innerHTML = '<div class="golos__box"><p class="golos__z">' + T.otchZag + "<span>" + T.otchPod + "</span></p>" +
'<label class="vh" for="golos-o">' + T.otchZag + '</label><input class="golos__in" id="golos-o" type="text" maxlength="' + MAX + '" placeholder="' + T.otchPole + '" autocomplete="off">' +
'<div class="golos__r"><button type="button" class="golos__b" data-golos-go disabled>' + T.otpravit + '</button><button type="button" class="golos__b golos__b--tiho" data-golos-net>' + T.nesejchas + "</button></div></div>";
report.appendChild(d);
var box = d.querySelector(".golos__box"), inp = d.querySelector("input"), go = d.querySelector("[data-golos-go]");
inp.addEventListener("input", function () { go.disabled = !chistyj(inp.value); });
inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !go.disabled) { e.preventDefault(); go.click(); } });
d.querySelector("[data-golos-net]").addEventListener("click", function () { cel("golos_nesejchas", { vid: "otchet" }); d.remove(); });
go.addEventListener("click", function () {
var b = telo("otchet", [], inp.value);
if (!b) return;
go.disabled = true;
cel("golos_otpravlen", { vid: "otchet", tema: "tekst" });
otpravit(apiUrl(o), b).then(function () { itog(box, true, b); }, function () { itog(box, false, b); });
});
cel("golos_pokaz", { vid: "otchet" });
return true;
}
api.kabinet = kabinet;
api.posleProverki = posleProverki;
})(typeof window !== "undefined" ? window : this);
;
/* --- /js/nagruzka.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === "object" && module.exports) module.exports = api;
else root.DlkNagruzka = api;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";
var NBSP = " ";
var MIN_DOHOD = 1e6;
var KRASNYJ_DOHOD = 10e6;
function cifry(kod) { return String(kod || "").replace(/[^0-9]/g, ""); }
function okvedIzVvoda(s) {
var m = String(s || "").match(/\d{2}(?:\.\d{1,2}){1,2}/);
if (m) return m[0];
var d = cifry(s);
if (d.length < 2 || d.length > 6) return "";
var out = d.slice(0, 2);
if (d.length > 2) out += "." + d.slice(2, 4);
if (d.length > 4) out += "." + d.slice(4, 6);
return out;
}
function najti(okved, stroki) {
var d = cifry(okved);
if (d.length < 2 || !stroki) return null;
var luchshaya = null, dlina = 0;
for (var i = 0; i < stroki.length; i++) {
var ok = stroki[i].okved || [];
for (var j = 0; j < ok.length; j++) {
var p = cifry(ok[j]);
var luchshe = p.length > dlina || (p.length === dlina && luchshaya && /^[A-Z]$/.test(luchshaya.kod) && !/^[A-Z]$/.test(stroki[i].kod));
if (p && d.indexOf(p) === 0 && luchshe) { luchshaya = stroki[i]; dlina = p.length; }
}
}
return luchshaya;
}
var SPRAVOCHNIK = "/nalogi/nagruzka-po-otraslyam-2025/";
function yakor(kod, tablica) {
var k = kod === "ВСЕГО" ? "vsego" : String(kod || "").toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "");
return (tablica || "n") + "-" + k;
}
function pct(x) {
var r = Math.round(x * 10) / 10;
return String(r).replace(".", ",") + (String(r).indexOf(".") < 0 ? ",0" : "") + "%";
}
function podpisStroki(s) {
var nazv = String(s.nazvanie).replace(/\s+-\s+всего$/i, "");
var kod = /^[A-Z]$/.test(s.kod) ? "раздел " + s.kod : "ОКВЭД " + s.kod;
return kod + " «" + nazv + "»";
}
function ocenka(vvod, dannye) {
var god = String(vvod.god || 2025);
var dohody = Number(vvod.dohody), nalogi = Number(vvod.nalogi);
var r = { st: "", n: null, norma: null, stroka: null, ssylka: null, raz: null, zagolovok: "Налоговая нагрузка против отрасли", tekst: "", podpis: "" };
r.podpis = "Оценка по методике калькулятора ФНС: уплаченные налоги без страховых взносов / доходы за " + god +
" год. Норма — приложение 3 к приказу ФНС № ММ-3-06/333@, Информация ФНС от 05.05.2026. Страховые взносы не учитываются — как и в норме ФНС. Считается в вашем браузере, ничего не отправляем.";
if (!isFinite(dohody) || !isFinite(nalogi) || dohody < MIN_DOHOD || nalogi < 0) {
r.st = "net-dannyh";
r.tekst = "Для сравнения нужны доходы за год — от 1" + NBSP + "млн" + NBSP + "₽ — и сумма уплаченных налогов. " +
"У новой компании или при нулевой отчётности сравнивать не с чем — это не значит «всё плохо».";
return r;
}
r.n = nalogi / dohody * 100;
if (vvod.rezhim === "usn") {
r.st = "usn";
r.tekst = "Налоги — " + pct(r.n) + " от доходов. Вы на упрощённой системе. Общая отраслевая норма ФНС включает НДС и налог на прибыль, " +
"поэтому сравнивать с ней упрощенца некорректно — мы этого не делаем.";
return r;
}
var stroki = dannye && dannye.nagruzka;
var s = najti(vvod.okved, stroki);
if (!s || typeof s.nagruzka[god] !== "number") {
r.st = "net-normy";
r.tekst = "Налоги — " + pct(r.n) + " от доходов. Отраслевой нормы для вашего вида деятельности ФНС не публикует: " +
"в таблице ФНС есть не все разделы ОКВЭД. Со средней «Всего по РФ» не сравниваем — это была бы другая отрасль.";
return r;
}
r.stroka = s;
r.ssylka = SPRAVOCHNIK + "#" + yakor(s.kod);
r.norma = s.nagruzka[god];
r.raz = Math.round((r.norma - r.n) * 10) / 10;
var dolya = r.n / r.norma;
var golova = "Ваша нагрузка — " + pct(r.n) + ". Средняя по отрасли — " + pct(r.norma) + " (" + podpisStroki(s) + ", ФНС, " + god + " год). ";
var ndfl = vvod.sNdfl
? ""
: "В вашем расчёте нет НДФЛ за работников, а в норме ФНС он есть, поэтому настоящая нагрузка, скорее всего, выше. ";
if (dolya >= 1) {
r.st = "zelenyj";
r.tekst = golova + "Нагрузка не ниже отраслевой — по этому признаку налоговая компанию на проверку не отбирает.";
} else if (dolya >= 0.5 || dohody < KRASNYJ_DOHOD) {
r.st = "zheltyj";
r.tekst = golova + "Разница: " + String(r.raz).replace(".", ",") + NBSP + "п." + NBSP + "п. " + ndfl +
"Само по себе это не нарушение: ФНС сравнивает нагрузку с отраслью как один из 12 признаков при отборе на выездную проверку.";
} else {
r.st = "krasnyj";
var vRaz = r.n > 0 ? ": в " + Math.round(r.norma / r.n) + NBSP + "раз ниже" : "";
r.tekst = golova.replace(/\. $/, "") + vRaz + ". " + ndfl +
"Нагрузка ниже среднеотраслевой — первый из 12 признаков, по которым налоговая выбирает компании для выездной проверки " +
"(приказ ФНС № ММ-3-06/333@). Это не вывод о нарушении — возможны убытки, крупные вычеты или особенности бизнеса.";
}
return r;
}
function chislo(s) { var x = Number(String(s || "").replace(/[\s ]/g, "").replace(",", ".")); return isFinite(x) ? x : NaN; }
function init(doc, dannye) {
var f = doc.getElementById("nagruzka-forma");
if (!f) return;
var vyhod = doc.getElementById("nagruzka-itog");
function poschitat(e) {
if (e) e.preventDefault();
var r = ocenka({
okved: okvedIzVvoda(f.okved.value),
dohody: chislo(f.dohody.value),
nalogi: chislo(f.nalogi.value),
sNdfl: f.ndfl.checked,
rezhim: f.rezhim.value,
}, dannye);
vyhod.className = "itog itog--" + r.st;
vyhod.hidden = false;
vyhod.querySelector("[data-tekst]").textContent = r.tekst;
vyhod.querySelector("[data-podpis]").textContent = r.podpis;
var sp = vyhod.querySelector("[data-stroka-p]");
if (sp) {
sp.hidden = !r.ssylka;
if (r.ssylka) sp.querySelector("a").setAttribute("href", r.ssylka);
}
var shkala = vyhod.querySelector("[data-shkala]");
if (r.norma) {
var max = Math.max(r.n, r.norma) * 1.1;
shkala.hidden = false;
shkala.querySelector("[data-vy]").style.width = Math.min(100, r.n / max * 100) + "%";
shkala.querySelector("[data-otr]").style.width = Math.min(100, r.norma / max * 100) + "%";
shkala.querySelector("[data-vy-t]").textContent = "Вы — " + pct(r.n);
shkala.querySelector("[data-otr-t]").textContent = "Отрасль — " + pct(r.norma);
} else shkala.hidden = true;
}
f.addEventListener("submit", poschitat);
}
return { yakor: yakor, najti: najti, ocenka: ocenka, okvedIzVvoda: okvedIzVvoda, pct: pct, podpisStroki: podpisStroki, init: init, chislo: chislo };
});
;
/* --- /js/nagruzka-proverka.js --- */
(function (root, factory) {
var N = (typeof module === 'object' && module.exports) ? require('./nagruzka.js') : root.DlkNagruzka;
var api = factory(N);
if (typeof module === 'object' && module.exports) module.exports = api;
else root.NagruzkaProverka = api;
})(typeof self !== 'undefined' ? self : this, function (N) {
'use strict';
var NB = ' ';
var MIN_DOHOD = 1e6;
var URL_NORM = '/data/fns-normy-2025.json';
var SPRAVOCHNIK = '/nalogi/nagruzka-po-otraslyam-2025/';
var KALKULYATOR = '/nalogi/nagruzka/';
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function chislo(v) { return v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v)) ? Number(v) : NaN; }
function pct(x) {
var r = Math.round(x * 10) / 10, s = String(Math.abs(r)).replace('.', ',');
if (s.indexOf(',') < 0) s += ',0';
return (r < 0 ? '−' : '') + s + NB + '%';
}
function dengi(v) {
var a = Math.abs(v), s = v < 0 ? '−' : '';
function c(x) { return x.toFixed(1).replace('.', ','); }
if (a >= 1e12) return s + c(a / 1e12) + NB + 'трлн' + NB + '₽';
if (a >= 1e9) return s + c(a / 1e9) + NB + 'млрд' + NB + '₽';
if (a >= 1e6) return s + c(a / 1e6) + NB + 'млн' + NB + '₽';
if (a >= 1e3) return s + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
return s + Math.round(a) + NB + '₽';
}
function zaGod(arr, g) {
var x = (Array.isArray(arr) ? arr : []).filter(function (q) { return q && parseInt(q.year, 10) === g; })[0];
return x ? chislo(x.value) : NaN;
}
function godNabora(dd, re) {
var parts = [];
if (typeof dd === 'string') parts = dd.split(/;\s*/);
else if (dd && typeof dd === 'object') Object.keys(dd).forEach(function (k) { parts.push(k + ' — ' + dd[k]); });
for (var i = 0; i < parts.length; i++) {
if (!re.test(parts[i])) continue;
var m = /31\.12\.(\d{4})|(\d{4})-12-31/.exec(parts[i]);
if (m) return +(m[1] || m[2]);
}
return NaN;
}
function kpi(r, re) {
var a = (r && r.dossier && r.dossier.kpi) || [];
for (var i = 0; i < a.length; i++) if (a[i] && re.test(String(a[i].label || ''))) return a[i];
return null;
}
function rezhim(r) {
var v = '';
((r && r.signals) || []).forEach(function (s) { if (!v && s && s.title === 'Налоговый режим') v = String(s.detail || ''); });
((r && r.dossier && r.dossier.sections) || []).forEach(function (sec) {
((sec && sec.rows) || []).forEach(function (row) { if (!v && row && row[0] === 'Налоговый режим') v = String(row[1] || ''); });
});
if (!v) return '';
if (/АУСН|ЕСХН|СРП|Патент|ПСН/i.test(v)) return 'spec';
if (/УСН|упрощ/i.test(v)) return 'usn';
if (/ОСН|Общ/i.test(v)) return 'osn';
return '';
}
function dannye(r) {
if (!r || !r.company) return null;
var c = r.company, okved = String(c.okved || '');
if (!/^\d{10}$/.test(String(c.inn || ''))) return null;
if (/^64\.1(\.|\d|$)/.test(okved) || /^65(\.|$)/.test(okved)) return null;
var D = r.dossier || {}, ch = D.charts || {}, dd = D.data_dates;
var kandidaty = [];
function ryad(arr, sV) {
(Array.isArray(arr) ? arr : []).forEach(function (q) {
var g = parseInt(q && q.year, 10), v = chislo(q && q.value);
if (isFinite(g) && isFinite(v) && v >= 0) kandidaty.push({ god: g, nalogi: v, sVznosami: sV });
});
}
ryad(ch.taxes_paid_bez_vznosov, false);
if (!kandidaty.length) ryad(ch.taxes_paid, true);
if (!kandidaty.length) {
var k = kpi(r, /^Налоги и взносы|^Уплачено налогов/i), gN = godNabora(dd, /уплаченные налоги/i);
if (k && isFinite(chislo(k.value)) && chislo(k.value) >= 0 && isFinite(gN)) kandidaty.push({ god: gN, nalogi: chislo(k.value), sVznosami: true });
}
if (!kandidaty.length) return null;
var kD = kpi(r, /^Доходы за год/i), gD = godNabora(dd, /доходы и расходы/i);
kandidaty.sort(function (a, b) { return b.god - a.god; });
for (var i = 0; i < kandidaty.length; i++) {
var x = kandidaty[i], dohody = NaN, vid = '';
if (kD && gD === x.god && isFinite(chislo(kD.value))) { dohody = chislo(kD.value); vid = 'dohody'; }
else { dohody = zaGod(ch.revenue, x.god); vid = 'vyruchka'; }
if (isFinite(dohody) && dohody >= MIN_DOHOD) { x.dohody = dohody; x.vid = vid; return x; }
}
return null;
}
function neDejstvuet(c) { return !!c && ['BANKRUPT', 'LIQUIDATING', 'LIQUIDATED'].indexOf(String(c.status || '').toUpperCase()) >= 0; }
function raschet(r, normy) {
if (!normy || !N) return null;
if (neDejstvuet(r && r.company)) return null;
var x = dannye(r);
if (!x) return null;
var g = String(x.god);
if (x.god !== 2025 && x.god !== 2024) return null;
var o = { god: x.god, nalogi: x.nalogi, dohody: x.dohody, vid: x.vid, sVznosami: x.sVznosami, rezhim: rezhim(r) };
o.n = x.nalogi / x.dohody * 100;
if (o.rezhim === 'usn' || o.rezhim === 'spec') { o.st = o.rezhim; return o; }
var s = N.najti(String(r.company.okved || ''), normy.nagruzka);
var nn = s && s.nagruzka ? s.nagruzka[g] : undefined, nsv = s && s.sv ? s.sv[g] : undefined;
if (!s || typeof nn !== 'number' || (x.sVznosami && typeof nsv !== 'number')) { o.st = 'net-normy'; return o; }
o.stroka = s; o.normaN = nn; o.normaSv = x.sVznosami ? nsv : null;
o.norma = Math.round((nn + (x.sVznosami ? nsv : 0)) * 10) / 10;
var n1 = Math.round(o.n * 10) / 10;
o.st = n1 >= o.norma ? 'ne-nizhe' : n1 < o.norma * 0.5 ? 'nizhe-vdvoe' : 'nizhe';
return o;
}
var VYVOD = {
'ne-nizhe': 'Не ниже средней по отрасли.',
'nizhe': 'Ниже средней по отрасли.',
'nizhe-vdvoe': 'Ниже средней по отрасли более чем вдвое.',
'usn': 'Компания на упрощённой системе. Общая отраслевая норма ФНС включает НДС и налог на прибыль, поэтому сравнивать с ней упрощенца некорректно — мы этого не делаем.',
'spec': 'Компания на специальном налоговом режиме. Общая отраслевая норма ФНС рассчитана по всем налогам, поэтому сравнивать с ней некорректно — мы этого не делаем.',
'net-normy': 'Средней нагрузки для этого вида деятельности ФНС не публикует — со строкой «Всего по РФ» не сравниваем.'
};
var NDFL = 'В открытых данных нет НДФЛ за работников, а в норме ФНС он есть, поэтому настоящая нагрузка, скорее всего, выше.';
var PRIZNAK = 'Само по себе это не нарушение: ФНС сравнивает нагрузку с отраслью как один из 12 признаков при отборе на выездную проверку ' +
'(приказ ФНС № ММ-3-06/333@). Возможны убытки, крупные вычеты или особенности бизнеса.';
var REZHIM_NE_UKAZAN = 'Налоговый режим в ответе не указан: если компания на упрощёнке, сравнение с общей нормой некорректно.';
function html(o, opts) {
if (!o) return '';
opts = opts || {};
var sravn = o.st === 'ne-nizhe' || o.st === 'nizhe' || o.st === 'nizhe-vdvoe';
var ton = o.st === 'nizhe' || o.st === 'nizhe-vdvoe' ? 'warn' : o.st === 'ne-nizhe' ? 'ok' : 'ro';
var chto = o.sVznosami ? 'Налоги и взносы' : 'Налоговая нагрузка';
var zag = chto + ' против отрасли';
var podpis = o.stroka ? N.podpisStroki(o.stroka) : '';
var sr = '';
if (sravn) {
sr = 'Средняя по отрасли — <b class="n">' + pct(o.norma) + '</b>' +
(o.sVznosami ? ' (налоги ' + pct(o.normaN) + ' + взносы ' + pct(o.normaSv) + ')' : '') +
' · ' + esc(podpis) + ', данные ФНС за' + NB + o.god + NB + 'год';
}
var dop = [];
if (sravn && o.st !== 'ne-nizhe') dop.push(NDFL, PRIZNAK);
if (sravn && !o.rezhim) dop.push(REZHIM_NE_UKAZAN);
var kak = (o.sVznosami ? 'Уплачено налогов и страховых взносов' : 'Уплачено налогов') + ' за' + NB + o.god + ' — ' + dengi(o.nalogi) +
' (ФНС, открытые данные: уплаченные налоги; без налогов при ввозе и без НДФЛ, который компания удерживает за работников). ' +
(o.vid === 'dohody' ? 'Доходы за' + NB + o.god + ' — ' + dengi(o.dohody) + ' (ФНС, открытые данные: доходы и расходы по бухотчётности). '
: 'Выручка за' + NB + o.god + ' — ' + dengi(o.dohody) + ' (ГИР БО, строка 2110; в калькуляторе ФНС — все доходы, поэтому это оценка). ') +
'Отношение — ' + pct(o.n) + '. ' +
(o.sVznosami && sravn
? 'Норма ФНС (приложение 3 к приказу № ММ-3-06/333@, Информация ФНС от ' + (o.god === 2025 ? '05.05.2026' : '07.05.2025') + ') дана без взносов, ' +
'а нагрузку по взносам ФНС публикует той же таблицей отдельной колонкой — поэтому сравниваем сумму с суммой. '
: '') +
'У ФНС знаменатель — оборот организаций по данным Росстата, поэтому это оценка, а не расчёт инспекции.';
return '<section class="ngo ngo--' + ton + '" aria-label="' + esc(zag) + '">' +
'<div class="ngo__h"><b>' + esc(zag) + '</b><span>оценка · ФНС · ' + o.god + '</span></div>' +
'<p class="ngo__v"><b class="n">' + pct(o.n) + '</b><span>от' + NB + (o.vid === 'dohody' ? 'доходов' : 'выручки') + ' за' + NB + o.god + NB + 'год</span></p>' +
(sr ? '<p class="ngo__s">' + sr + '</p>' : '') +
'<p class="ngo__z">' + esc(VYVOD[o.st]) + '</p>' +
(dop.length ? '<p class="ngo__p">' + esc(dop.join(' ')) + '</p>' : '') +
'<details class="ngo__k"' + (opts.otkryto ? ' open' : '') + '><summary>Как посчитали</summary><p>' + esc(kak) +
' <a href="' + SPRAVOCHNIK + '">Нормы по всем отраслям</a> · <a href="' + KALKULYATOR + '">Посчитать свою нагрузку</a></p></details>' +
'</section>';
}
var CSS = '.ngo{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px}' +
'.ngo--warn{border-left-color:#E0A100}.ngo--ok{border-left-color:#2FA36B}.ngo--ro{border-left-color:var(--line,#E6E6E1)}' +
'.ngo__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.ngo__h b{font-size:15px;font-weight:600}' +
'.ngo__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
'.ngo p{margin:0}.ngo__v{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}.ngo__v b{font-size:24px;font-weight:600;letter-spacing:-.01em}' +
'.ngo__v span{font-size:13px;color:var(--muted,#6B6B70)}.ngo .n{font-variant-numeric:tabular-nums}' +
'.ngo__s{font-size:15px;color:var(--ink2,#48484C)}.ngo__s b{font-weight:600}.ngo__z{font-size:15px}' +
'.ngo__p{font-size:13px;line-height:1.5;color:var(--ink2,#48484C)}' +
'.ngo__k summary{cursor:pointer;font-size:13px;color:var(--muted,#6B6B70)}.ngo__k p{margin-top:6px;font-size:13px;line-height:1.5;color:var(--ink2,#48484C)}' +
'.ngo__k a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
'.ngo+section,.ngo+div{margin-top:12px}' +
'#doc .ngo{margin-top:14px}.doc .ngo{margin:18px 0 0}' +
'@media (max-width:520px){.ngo{padding:14px}}' +
'@media print{.ngo{break-inside:avoid}}';
function stil(doc) {
if (!doc || doc.getElementById('ngo-css')) return;
var s = doc.createElement('style'); s.id = 'ngo-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function vstavit(report, h) {
var doc = report.ownerDocument, t = doc.createElement('div');
t.innerHTML = h;
var nov = t.firstChild, star = report.querySelector('.ngo');
if (!nov) return null;
if (star) { star.parentNode.replaceChild(nov, star); return nov; }
var rnt = report.querySelector('.rnt');
if (rnt && rnt.parentNode) { rnt.parentNode.insertBefore(nov, rnt); return nov; }
var pos = null, sp = ['.din', '.izm', '.rows'];
for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
if (!pos || !pos.parentNode) return null;
pos.parentNode.insertBefore(nov, pos.nextSibling);
return nov;
}
var obeshchanie = null;
function zagruzit() {
if (!obeshchanie) {
obeshchanie = (typeof fetch === 'function' ? fetch(URL_NORM, { cache: 'no-cache' }).then(function (x) { return x.ok ? x.json() : null; }) : Promise.resolve(null))
.catch(function () { obeshchanie = null; return null; });
}
return obeshchanie;
}
function mount(report, r, opts) {
var stary = report && report.querySelector && report.querySelector('.ngo');
if (stary && stary.parentNode) stary.parentNode.removeChild(stary);
if (!report || !dannye(r)) return Promise.resolve(null);
var metka = {}; report.__ngo = metka;
return zagruzit().then(function (d) {
if (report.__ngo !== metka) return null;
var o = raschet(r, d);
if (!o) return null;
try { stil(report.ownerDocument); } catch (e) {}
vstavit(report, html(o, opts));
return o;
});
}
return { dannye: dannye, rezhim: rezhim, godNabora: godNabora, raschet: raschet, html: html, mount: mount, vstavit: vstavit,
VYVOD: VYVOD, NDFL: NDFL, PRIZNAK: PRIZNAK, CSS: CSS };
});
;
/* --- /js/rentabelnost.js --- */
(function (root, factory) {
var N = (typeof module === 'object' && module.exports) ? require('./nagruzka.js') : root.DlkNagruzka;
var api = factory(N);
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Rentabelnost = api;
})(typeof self !== 'undefined' ? self : this, function (N) {
'use strict';
var NB = '\u00a0';
var MIN_AKTIVY = 1e6;
var URL_NORM = '/data/fns-normy-2025.json';
var SPRAVOCHNIK = '/nalogi/nagruzka-po-otraslyam-2025/';
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function chislo(v) { return v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v)) ? Number(v) : NaN; }
function zaGod(arr, g) {
var x = (Array.isArray(arr) ? arr : []).filter(function (q) { return q && parseInt(q.year, 10) === g; })[0];
return x ? chislo(x.value) : NaN;
}
function okr(x) { return Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10; }
function pct(x) {
var r = okr(x), s = String(Math.abs(r)).replace('.', ',');
if (Math.abs(r) >= 100) return (r < 0 ? '−' : '') + s + NB + '%';
if (s.indexOf(',') < 0) s += ',0';
return (r < 0 ? '−' : '') + s + NB + '%';
}
function dengi(v) {
var a = Math.abs(v), s = v < 0 ? '−' : '';
function c(x) { return x.toFixed(1).replace('.', ','); }
if (a >= 1e12) return s + c(a / 1e12) + NB + 'трлн' + NB + '₽';
if (a >= 1e9) return s + c(a / 1e9) + NB + 'млрд' + NB + '₽';
if (a >= 1e6) return s + c(a / 1e6) + NB + 'млн' + NB + '₽';
if (a >= 1e3) return s + Math.round(a / 1e3) + NB + 'тыс.' + NB + '₽';
return s + Math.round(a) + NB + '₽';
}
function norma(stroka, god, dannye) {
if (!stroka || !dannye) return undefined;
var r = dannye.rentabelnost || {};
if (god === r.god) return stroka.aktivy;
var r24 = dannye.rentabelnost_2024;
if (god === 2024 && r24 && r24.znacheniya && Array.isArray(r24.znacheniya[stroka.kod])) return r24.znacheniya[stroka.kod][1];
return undefined;
}
function istochnikNormy(god, dannye) {
var r24 = dannye && dannye.rentabelnost_2024;
return god === 2024 && r24 && r24.istochnik && r24.istochnik.data === '2025-05-07'
? 'Информация ФНС от 07.05.2025' : 'Информация ФНС от 05.05.2026';
}
var NE_DEJSTVUET = ['BANKRUPT', 'LIQUIDATING', 'LIQUIDATED'];
function neDejstvuet(c) { return !!c && NE_DEJSTVUET.indexOf(String(c.status || '').toUpperCase()) >= 0; }
function ocenka(r) {
if (!r || !r.company) return null;
var c = r.company, inn = String(c.inn || ''), okved = String(c.okved || '');
if (!/^\d{10}$/.test(inn)) return null;
if (neDejstvuet(c)) return null;
if (/^64\.1(\.|\d|$)/.test(okved) || /^65(\.|$)/.test(okved)) return null;
var ch = (r.dossier && r.dossier.charts) || {}, b = ch.balance;
if (!b || typeof b !== 'object') return null;
var god = parseInt(b.year, 10);
if (!isFinite(god)) return null;
var kap = chislo(b.equity), dl = chislo(b.long_debt != null ? b.long_debt : b.long_liab), kr = chislo(b.short_debt != null ? b.short_debt : b.short_liab);
if (!isFinite(kap) || !isFinite(dl) || !isFinite(kr) || dl < 0 || kr < 0) return null;
var aktivy = kap + dl + kr;
var kA = ((r.dossier && r.dossier.kpi) || []).filter(function (x) { return x && /^Активы(\s|$)/i.test(String(x.label || '')) && isFinite(chislo(x.value)); })[0];
if (kA && chislo(kA.value) > aktivy) aktivy = chislo(kA.value);
if (!(aktivy >= MIN_AKTIVY)) return null;
var pribyl = zaGod(ch.profit, god);
if (!isFinite(pribyl)) return null;
var nalog = zaGod(ch.income_tax, god), sNalogom = isFinite(nalog);
var pbt = zaGod(ch.profit_before_tax, god);
if (isFinite(pbt)) { nalog = pbt - pribyl; sNalogom = true; }
var soZnakom = isFinite(pbt) || nalogSoZnakom(ch, god);
if (!sNalogom || nalog === 0 || soZnakom) {
var rez = sNalogom ? pribyl + nalog : pribyl, n1 = rez / aktivy * 100;
return { god: god, n: n1, nMin: n1, nMax: n1, pribyl: pribyl, nalog: sNalogom ? nalog : null, rez: rez, aktivy: aktivy,
sNalogom: sNalogom, bezZnaka: false };
}
var t = Math.abs(nalog), rMax = pribyl + t, rMin = pribyl - t;
return { god: god, n: rMax / aktivy * 100, nMin: rMin / aktivy * 100, nMax: rMax / aktivy * 100, pribyl: pribyl, nalog: t,
rez: rMax, rezMin: rMin, aktivy: aktivy, sNalogom: true, bezZnaka: true };
}
function rjadSoZnakom(arr) {
return (Array.isArray(arr) ? arr : []).some(function (q) { return q && isFinite(chislo(q.value)) && chislo(q.value) < 0; });
}
function nalogSoZnakom(ch, god) {
if (!ch) return false;
if (ch.income_tax_znak === true) return true;
var arr = Array.isArray(ch.income_tax) ? ch.income_tax : [];
var x = arr.filter(function (q) { return q && parseInt(q.year, 10) === god; })[0];
if (x && typeof x.znak === 'boolean') return x.znak;
if (arr.some(function (q) { return q && typeof q.znak === 'boolean'; })) return false;
return rjadSoZnakom(arr);
}
function sravnenie(n, god, okved, dannye) {
var rs = (dannye && dannye.rentabelnost) || {};
if (god !== rs.god && god !== 2024) return null;
var s = okved && N ? N.najti(String(okved), rs.stroki) : null;
var nr = norma(s, god, dannye);
if (!s || (nr !== 'отр' && typeof nr !== 'number')) return { st: 'net-normy', stroka: null, norma: null };
if (nr === 'отр') return { st: 'otr', stroka: s, norma: null };
var n1 = Math.round(n * 10) / 10;
return { st: nr > 0 && n1 <= nr * 0.9 ? 'nizhe' : n1 < nr ? 'chut-nizhe' : 'ne-nizhe', stroka: s, norma: nr };
}
function sravnenieDvuh(nMin, nMax, god, okved, dannye) {
var a = sravnenie(nMin, god, okved, dannye);
if (!a || nMin === nMax || typeof a.norma !== 'number') return a;
var b = sravnenie(nMax, god, okved, dannye);
if (a.st === b.st) return a;
var st = a.st === 'nizhe' || b.st === 'nizhe' ? 'neyasno' : 'ne-nizhe-10';
return { st: st, stroka: a.stroka, norma: a.norma };
}
function raschet(r, dannye) {
if (!dannye) return null;
var o = ocenka(r);
if (!o) return null;
var sr = sravnenieDvuh(o.nMin, o.nMax, o.god, String(r.company.okved || ''), dannye);
if (!sr) return null;
o.st = sr.st; o.stroka = sr.stroka; o.norma = sr.norma; o.istochnik = istochnikNormy(o.god, dannye);
return o;
}
function izmenenie(a, b, okved, dannye) {
if (!a || !b || !Array.isArray(a.rn) || !Array.isArray(b.rn) || !(b.rn[0] > a.rn[0])) return null;
function dva(rn) { return [rn[1], rn.length > 2 && isFinite(rn[2]) ? rn[2] : rn[1]]; }
var da = dva(a.rn), db = dva(b.rn);
var x = sravnenieDvuh(da[0], da[1], a.rn[0], okved, dannye), y = sravnenieDvuh(db[0], db[1], b.rn[0], okved, dannye);
if (!x || !y || typeof x.norma !== 'number' || typeof y.norma !== 'number' || x.st === 'neyasno' || y.st === 'neyasno') return null;
var hvost = ': за' + NB + b.rn[0] + ' — ' + diapazon(db[0], db[1]) + ' при средней ' + pct(y.norma) + ' (оценка; ГИР' + NB + 'БО и ФНС)';
if (x.st !== 'nizhe' && y.st === 'nizhe') return { ton: 'huzhe', t: 'Рентабельность активов стала ниже средней по отрасли на 10\u00a0% и более' + hvost };
if (x.st === 'nizhe' && y.st !== 'nizhe') return { ton: 'luchshe', t: 'Рентабельность активов больше не ниже средней по отрасли на 10\u00a0% и более' + hvost };
return null;
}
var VYVOD = {
'nizhe': 'Ниже средней по отрасли на 10\u00a0% и более.',
'chut-nizhe': 'Ниже средней по отрасли, но меньше чем на 10\u00a0%.',
'ne-nizhe': 'Не ниже средней по отрасли.',
'ne-nizhe-10': 'Не ниже средней по отрасли на 10\u00a0% и более.',
'neyasno': 'Сравнить точно нельзя: при одном знаке налога оценка ниже средней по отрасли на 10\u00a0% и более, при другом — нет.',
'otr': 'У отрасли в целом за этот год, по данным ФНС, убыток — сравнивать не с чем.',
'net-normy': 'Средней рентабельности для этого вида деятельности ФНС не публикует — со строкой «Всего» не сравниваем.'
};
var PRIZNAK = 'Признак отбора — рентабельность по бухучёту ниже среднеотраслевой на 10\u00a0% и более (критерий 11 приложения 2 к Концепции). ' +
'Это средние значения, а не порог: ФНС сравнивает с ними компании как с одним из 12 признаков при отборе на выездную проверку.';
var BEZ_ZNAKA = 'В открытых данных у налога на прибыль нет знака: по ним не видно, расход это или доход по налогу (доход бывает, например, из-за отложенного налога).';
function diapazon(a, b) {
var x = okr(Math.min(a, b)), y = okr(Math.max(a, b));
if (x === y) return pct(x);
return pct(x).replace(NB + '%', '') + (x < 0 || y < 0 ? ' … ' : '–') + pct(y);
}
function znachenie(o) { return o ? diapazon(isFinite(o.nMin) ? o.nMin : o.n, isFinite(o.nMax) ? o.nMax : o.n) : ''; }
function html(o, opts) {
if (!o) return '';
opts = opts || {};
var ton = o.st === 'nizhe' ? 'warn' : o.st === 'ne-nizhe' || o.st === 'chut-nizhe' || o.st === 'ne-nizhe-10' ? 'ok' : 'ro';
var podpis = o.stroka ? N.podpisStroki(o.stroka) : '';
var sr = o.norma != null
? 'Средняя по отрасли — <b class="n">' + pct(o.norma) + '</b> · ' + esc(podpis) + ', данные ФНС за' + NB + o.god + NB + 'год'
: (o.st === 'otr' ? esc(podpis) : '');
var kak = (o.bezZnaka ? BEZ_ZNAKA + ' Если это расход — прибыль до налогообложения ' + dengi(o.pribyl) + ' + ' + dengi(o.nalog) + ' = ' + dengi(o.rez) +
', если доход — ' + dengi(o.pribyl) + ' − ' + dengi(o.nalog) + ' = ' + dengi(o.rezMin) + '; считаем оба варианта'
: o.sNalogom
? 'Прибыль до налогообложения — чистая прибыль ' + dengi(o.pribyl) + (o.nalog < 0 ? ' минус доход по налогу на прибыль ' + dengi(-o.nalog) : ' плюс налог на прибыль ' + dengi(o.nalog)) + ' = ' + dengi(o.rez)
: 'Налога на прибыль в ответе нет — взяли чистую прибыль ' + dengi(o.pribyl)) +
' (ГИР БО, ' + o.god + '). Активы на' + NB + '31.12.' + o.god + ' — ' + dengi(o.aktivy) +
': капитал, долгосрочные и краткосрочные обязательства (баланс, строки 1300 + 1400 + 1500). ' +
'У ФНС — сальдированный финансовый результат к стоимости активов по всем организациям отрасли, поэтому это оценка, а не расчёт инспекции. ' +
'Норма — приложение 4 к приказу ФНС № ММ-3-06/333@, ' + o.istochnik + '.';
return '<section class="rnt rnt--' + ton + '" aria-label="Рентабельность активов против отрасли">' +
'<div class="rnt__h"><b>Рентабельность активов против отрасли</b><span>оценка · ГИР БО и ФНС · ' + o.god + '</span></div>' +
'<p class="rnt__v"><b class="n">' + znachenie(o) + '</b><span>за' + NB + o.god + NB + 'год</span></p>' +
(sr ? '<p class="rnt__s">' + sr + '</p>' : '') +
'<p class="rnt__z">' + esc(VYVOD[o.st]) + '</p>' +
(o.st === 'nizhe' ? '<p class="rnt__p">' + esc(PRIZNAK) + '</p>' : '') +
'<details class="rnt__k"' + (opts.otkryto ? ' open' : '') + '><summary>Как посчитали</summary><p>' + esc(kak) +
' <a href="' + SPRAVOCHNIK + '">Нормы по всем отраслям</a></p></details>' +
(opts.primechanie ? '<p class="rnt__m">' + esc(opts.primechanie) + '</p>' : '') +
'</section>';
}
var CSS = '.rnt{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px}' +
'.rnt--warn{border-left-color:#E0A100}.rnt--ok{border-left-color:#2FA36B}.rnt--ro{border-left-color:var(--line,#E6E6E1)}' +
'.rnt__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.rnt__h b{font-size:15px;font-weight:600}' +
'.rnt__h span{font-size:13px;color:var(--muted,#6B6B70)}' +
'.rnt p{margin:0}.rnt__v{display:flex;align-items:baseline;gap:8px}.rnt__v b{font-size:24px;font-weight:600;letter-spacing:-.01em}' +
'.rnt__v span{font-size:13px;color:var(--muted,#6B6B70)}.rnt .n{font-variant-numeric:tabular-nums}' +
'.rnt__s{font-size:15px;color:var(--ink2,#48484C)}.rnt__s b{font-weight:600}.rnt__z{font-size:15px}' +
'.rnt__p{font-size:13px;color:var(--ink2,#48484C)}' +
'.rnt__k summary{cursor:pointer;font-size:13px;color:var(--muted,#6B6B70)}.rnt__k p{margin-top:6px;font-size:13px;line-height:1.5;color:var(--ink2,#48484C)}' +
'.rnt__k a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
'.rnt__m{font-size:12px;color:var(--muted,#6B6B70)}' +
'#doc .rnt{margin-top:14px}.doc .rnt{margin:18px 0 0}.rz .rnt{margin-top:12px}' +
'@media (max-width:520px){.rnt{padding:14px}}' +
'@media print{.rnt{break-inside:avoid}.rnt__k p{display:block}}';
function stil(doc) {
if (!doc || doc.getElementById('rnt-css')) return;
var s = doc.createElement('style'); s.id = 'rnt-css'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function vstavit(report, h, opts) {
opts = opts || {};
var doc = report.ownerDocument, t = doc.createElement('div');
t.innerHTML = h;
var nov = t.firstChild, star = report.querySelector('.rnt');
if (!nov) return null;
if (star) { star.parentNode.replaceChild(nov, star); return nov; }
if (opts.vKonec) { opts.vKonec.appendChild(nov); return nov; }
var pos = null, sp = opts.posle || ['.ngo', '.din', '.izm', '.rows'];
for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
if (pos && pos.parentNode) pos.parentNode.insertBefore(nov, pos.nextSibling);
else return null;
return nov;
}
var obeshchanie = null;
function zagruzit(url) {
if (!obeshchanie) {
obeshchanie = (typeof fetch === 'function' ? fetch(url || URL_NORM, { cache: 'no-cache' }).then(function (x) { return x.ok ? x.json() : null; }) : Promise.resolve(null))
.catch(function () { obeshchanie = null; return null; });
}
return obeshchanie;
}
function mount(report, r, opts) {
var c = r && r.company, ch = r && r.dossier && r.dossier.charts;
if (!report || !c || !/^\d{10}$/.test(String(c.inn || '')) || !ch || !ch.balance || !ch.profit) return Promise.resolve(null);
var metka = {}; report.__rnt = metka;
return zagruzit().then(function (d) {
if (report.__rnt !== metka) return null;
var o = raschet(r, d);
if (!o) return null;
try { stil(report.ownerDocument); } catch (e) {}
vstavit(report, html(o, opts), opts);
try {
var Dn = typeof self !== 'undefined' ? self.Dinamika : null, okv = String(c.okved || '');
if (Dn && Dn.dobavit) Dn.dobavit(report, r, function (a, b) { return izmenenie(a, b, okv, d); });
} catch (e) {}
return o;
});
}
var PRIMECHANIE_PASPORT = 'Рассчитано Делоскопом по бухотчётности этого раздела и нормам ФНС; в отпечаток SHA-256 не входит.';
return { raschet: raschet, ocenka: ocenka, neDejstvuet: neDejstvuet, NE_DEJSTVUET: NE_DEJSTVUET, sravnenie: sravnenie, sravnenieDvuh: sravnenieDvuh, izmenenie: izmenenie, znachenie: znachenie,
diapazon: diapazon, nalogSoZnakom: nalogSoZnakom, BEZ_ZNAKA: BEZ_ZNAKA, html: html, mount: mount, vstavit: vstavit, zagruzit: zagruzit, norma: norma, pct: pct, CSS: CSS, VYVOD: VYVOD, PRIZNAK: PRIZNAK,
PRIMECHANIE_PASPORT: PRIMECHANIE_PASPORT };
});
;
/* --- /js/bez-nds.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === "object" && module.exports) module.exports = api;
else root.DlkBezNds = api;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";
function porog(godDohoda) {
if (godDohoda < 2025) return null;
if (godDohoda <= 2028) return 20e6;
if (godDohoda === 2029) return 15e6;
return 10e6;
}
function mln(n) {
var x = Math.round(n / 1e5) / 10;
return String(x).replace(".", ",") + " млн ₽";
}
function rezhim(dossier) {
var secs = (dossier && dossier.sections) || [];
for (var i = 0; i < secs.length; i++) {
var rows = secs[i].rows || [];
for (var j = 0; j < rows.length; j++) {
if (rows[j][0] !== "Налоговый режим") continue;
var v = String(rows[j][1] || "");
if (/АУСН|ЕСХН|СРП|Патент|ПСН|ОСН|Общая/i.test(v)) return "drugoj";
if (/УСН/.test(v)) return "usn";
return null;
}
}
return null;
}
function stroka(noVat, remote, segodnya) {
if (!noVat || !remote) return null;
var co = remote.company || {};
if (co.inn && String(co.inn).length !== 10) return null;
var d = remote.dossier || {};
var rz = rezhim(d);
if (rz === "drugoj") return null;
var god = (segodnya || new Date()).getFullYear() - 1;
var p = porog(god);
if (!p) return null;
var ryad = (d.charts && d.charts.revenue) || [];
var t = null;
for (var i = 0; i < ryad.length; i++) if (ryad[i] && ryad[i].year === god) t = ryad[i];
if (!t || typeof t.value !== "number" || t.value <= p) return null;
var nachalo = rz === "usn"
? "Поставщик на упрощёнке, выручка за " + god + " год по бухотчётности — " + mln(t.value) + ". Освобождение"
: "Выручка поставщика за " + god + " год по бухотчётности — " + mln(t.value) + ". Если он на упрощёнке, освобождение";
return {
st: "info",
title: "Без НДС",
detail: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании " +
"счёт без НДС. Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
};
}
function osvobozhdenie(god, p) {
return " от НДС в " + (god + 1) + " году — только при доходе за " + god + " год до " + mln(p) +
" (п. 1 ст. 145 НК РФ), выше — счёт выставляют с НДС: по общей ставке или по ставке 5 или 7\u00a0%. " +
"Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
"операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";
}
function rub(n) {
return Math.round(n).toLocaleString("ru-RU").replace(/[\s\u202f]/g, "\u00a0") + "\u00a0₽";
}
function rezhimKoda(k) {
if (k === "usn") return "usn";
if (k === "ausn" || k === "eshn" || k === "srp") return "drugoj";
return null;
}
function strokaVypiski(s, rm) {
if (!s || !rm || s.kind !== "org" || !s.inn || String(s.inn).length !== 10) return null;
var rz = rezhimKoda(rm.rezhim);
if (rz === "drugoj") return null;
if (typeof rm.dohod !== "number" || !/^\d{4}-/.test(String(rm.dohod_na || ""))) return null;
var god = parseInt(String(rm.dohod_na).slice(0, 4), 10);
var p = porog(god);
if (!p || rm.dohod <= p) return null;
var summa = (s.noVatGod || {})[god + 1];
if (!(summa > 0)) return null;
var dohod = "доход за " + god + " год по бухотчётности — " + mln(rm.dohod) + " (открытые данные ФНС).";
var nachalo = "Платежи «без НДС» в " + (god + 1) + " году — " + rub(summa) + ". " + (rz === "usn"
? "Поставщик на упрощёнке, " + dohod + " Освобождение"
: "Поставщик: " + dohod + " Если он на упрощёнке, освобождение");
return {
level: "info",
code: "bez_nds",
text: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании платежи без НДС. " +
"Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
};
}
var GOD_PROGNOZA = 2027, BLIZKO = 15e6;
function prognoz(remote, segodnya, T) {
T = T || GOD_PROGNOZA;
if (!remote) return null;
var co = remote.company || {};
if (!/^\d{10}$/.test(String(co.inn || ""))) return null;
var sg = segodnya || new Date();
if (sg < new Date(T - 1, 0, 1) || sg >= new Date(T, 4, 1)) return null;
var d = remote.dossier || {};
if (rezhim(d) !== "usn") return null;
var R = T - 2, p = porog(R), pTek = porog(T - 1);
if (!p || !pTek) return null;
var ryad = (d.charts && d.charts.revenue) || [], v = null, v0 = null;
for (var i = 0; i < ryad.length; i++) {
var x = ryad[i];
if (!x || typeof x.value !== "number") continue;
if (x.year === T - 1) return null;
if (x.year === R) v = x.value;
if (x.year === R - 1) v0 = x.value;
}
if (v == null || v <= 0) return null;
var vyr = "Поставщик на упрощёнке, выручка за " + R + " год по бухотчётности — " + (mln(v) === mln(p) && v !== p ? rub(v) : mln(v));
var hvost = " " + HVOST;
if (v > p) {
return { kod: "uzhe_platit", st: "info", title: "НДС в " + (T - 1) + " году", vyruchka: v, god: R, rost: null,
detail: vyr + ", выше порога " + mln(p) + ". Поэтому в " + (T - 1) + " году он, вероятно, платит НДС — по общей " +
"ставке или по ставке 5 или 7\u00a0% (п. 8 ст. 164 НК РФ). Если в счёте «Без НДС» — спросите основание." + hvost };
}
if (v <= BLIZKO) return { kod: "osvobozhdena", st: "info", title: "НДС в " + T + " году", vyruchka: v, god: R, rost: null, detail: "" };
var rost = v0 > 0 ? v / v0 - 1 : null;
var sRostom = rost != null && rost > 0 && v * (1 + rost) > pTek;
var detail = vyr + ", у порога " + mln(p) + ". Если доход за " + (T - 1) + " год превысит " + mln(pTek) +
", в " + T + " году освобождения от НДС не будет (п. 1 ст. 145 НК РФ). Если превысит уже в " + (T - 1) +
" году — НДС появится с 1-го числа следующего месяца (п. 5 ст. 145 НК РФ). Спросите поставщика, будет ли НДС " +
"в счетах " + T + " года, и закрепите в договоре, что будет с ценой: пункт 2.2 Делописи.";
if (sRostom) {
detail += " За " + R + " год выручка выросла на " + procent(rost) + " %. Если рост сохранится, доход за " +
(T - 1) + " год превысит " + mln(pTek) + ". Это наша оценка по двум годам отчётности, а не данные ФНС.";
}
return { kod: sRostom ? "u_poroga_rost" : "u_poroga", st: "info", title: "НДС в " + T + " году", vyruchka: v, god: R,
rost: sRostom ? rost : null, detail: detail + hvost };
}
function procent(x) { var n = x * 100; return n >= 1 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(".", ","); }
var HVOST = "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
"операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";
function podpis(remote, god) {
var s = String(((remote || {}).dossier || {}).data_dates || ""), data = "";
s.split(";").forEach(function (ch) {
var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
if (m && !data && /режим/i.test(m[1])) data = m[2];
});
return "Режим — открытые данные ФНС" + (data ? " на " + data : "") + "; выручка — бухотчётность ГИР БО за " + god + " год.";
}
function uPorogaVypiski(spisok, T) {
T = T || GOD_PROGNOZA;
var R = T - 2, p = porog(R), n = 0;
(spisok || []).forEach(function (rm) {
if (!rm || !/^\d{10}$/.test(String(rm.inn || "")) || rezhimKoda(rm.rezhim) !== "usn") return;
if (typeof rm.dohod !== "number" || String(rm.dohod_na || "").slice(0, 4) !== String(R)) return;
if (rm.dohod > BLIZKO && rm.dohod <= p) n++;
});
return n;
}
return { porog: porog, rezhim: rezhim, stroka: stroka, mln: mln, rezhimKoda: rezhimKoda, strokaVypiski: strokaVypiski,
prognoz: prognoz, podpis: podpis, uPorogaVypiski: uPorogaVypiski, HVOST: HVOST, GOD_PROGNOZA: GOD_PROGNOZA };
});
;
/* --- /js/nds-porog.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === "object" && module.exports) module.exports = api;
else root.NdsPorog = api;
})(typeof self !== "undefined" ? self : this, function () {
"use strict";
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
var CSS = ".ndp{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px;border-left-color:#8A8A90;margin-top:12px}" +
".ndp__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.ndp__h b{font-size:15px;font-weight:600}" +
".ndp__h span{font-size:13px;color:var(--muted,#6B6B70)}.ndp p{margin:0}.ndp__t{font-size:15px;line-height:1.5}" +
".ndp__t a{color:inherit;text-decoration:underline;text-underline-offset:2px}.ndp__m{font-size:12px;color:var(--muted,#6B6B70)}" +
"@media (max-width:520px){.ndp{padding:14px}}@media print{.ndp{break-inside:avoid}}";
function html(o, podpis) {
if (!o || !o.detail || o.kod === "osvobozhdena") return "";
var t = esc(o.detail).replace("пункт 2.2 Делописи", '<a href="/delopis/" data-goal="nds_porog_klik">пункт 2.2 Делописи</a>');
return '<section class="ndp" aria-label="' + esc(o.title) + '" data-nds-porog="' + esc(o.kod) + '">' +
'<div class="ndp__h"><b>' + esc(o.title) + '</b><span>к сведению · ГИР БО и ФНС</span></div>' +
'<p class="ndp__t">' + t + '</p>' +
(podpis ? '<p class="ndp__m">' + esc(podpis) + '</p>' : '') +
'</section>';
}
function stil(doc) {
if (!doc || doc.getElementById("ndp-css")) return;
var s = doc.createElement("style"); s.id = "ndp-css"; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
}
function mount(report, r, B, segodnya) {
B = B || (typeof self !== "undefined" ? self.DlkBezNds : null);
if (!report || !B || !B.prognoz) return null;
var star = report.querySelector(".ndp");
var o = B.prognoz(r, segodnya || new Date()), h = html(o, o ? B.podpis(r, o.god) : "");
if (!h) { if (star) star.parentNode.removeChild(star); return null; }
var doc = report.ownerDocument, t = doc.createElement("div");
t.innerHTML = h;
var nov = t.firstChild;
try { stil(doc); } catch (e) {}
if (star) star.parentNode.replaceChild(nov, star);
else {
var pos = null, sp = [".rnt", ".ngo", ".din", ".izm", ".rows"];
for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
if (!pos || !pos.parentNode) return null;
pos.parentNode.insertBefore(nov, pos.nextSibling);
}
if (typeof self !== "undefined" && self.dlkGoal) self.dlkGoal("nds_porog_view", { kod: o.kod });
return nov;
}
return { html: html, mount: mount, CSS: CSS };
});
;
/* --- /js/terminy.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.Terminy = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var BUKVA = /[0-9A-Za-zА-Яа-яЁё]/;
var NE_TROGAT = { A: 1, BUTTON: 1, SUMMARY: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, LABEL: 1 };
var CSS =
'.termin{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:help;text-align:inherit;' +
'text-decoration:underline dotted;text-decoration-thickness:1px;text-underline-offset:.22em;text-decoration-color:currentColor}' +
'.termin:hover,.termin[aria-expanded=true]{color:#0B63E5}' +
'#termin-pop{position:absolute;z-index:70;box-sizing:border-box;max-width:320px;background:#fff;color:#1D1D1F;border:1px solid #E6E6E1;' +
'border-radius:16px;padding:12px 14px;font:400 13px/1.5 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;' +
'box-shadow:0 12px 36px rgba(0,0,0,.16);text-align:left}' +
'#termin-pop b{display:block;font-weight:600;margin-bottom:4px}#termin-pop p{margin:0}' +
'#termin-pop a{display:inline-block;margin-top:8px;color:#0B63E5}' +
'@media print{#termin-pop{display:none!important}.termin{text-decoration:none}}';
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
function sobrat(spr) {
var out = [];
((spr && spr.terminy) || []).forEach(function (t) {
if (!t || !t.id || !t.shablon || !t.opredelenie || !t.stranica) return;
try { out.push({ t: t, re: new RegExp(t.shablon, 'g' + (t.flagi || '').replace(/g/g, '')) }); } catch (e) {   }
});
return out;
}
function najti(re, s) {
re.lastIndex = 0;
var m;
while ((m = re.exec(s))) {
if (!m[0]) { re.lastIndex++; continue; }
var a = m.index, b = a + m[0].length;
if ((a === 0 || !BUKVA.test(s.charAt(a - 1))) && (b >= s.length || !BUKVA.test(s.charAt(b)))) return [a, b];
re.lastIndex = a + 1;
}
return null;
}
function razmetit(s, terminy, uzhe) {
uzhe = uzhe || {};
var kuski = [{ tekst: String(s == null ? '' : s) }];
terminy.forEach(function (x) {
if (uzhe[x.t.id]) return;
for (var i = 0; i < kuski.length; i++) {
var k = kuski[i];
if (k.id) continue;
var p = najti(x.re, k.tekst);
if (!p) continue;
var nov = [];
if (p[0] > 0) nov.push({ tekst: k.tekst.slice(0, p[0]) });
nov.push({ tekst: k.tekst.slice(p[0], p[1]), id: x.t.id });
if (p[1] < k.tekst.length) nov.push({ tekst: k.tekst.slice(p[1]) });
kuski.splice.apply(kuski, [i, 1].concat(nov));
uzhe[x.t.id] = true;
break;
}
});
return kuski;
}
function podskazka(t) {
return '<b>' + esc(t.nazvanie) + '</b><p>' + esc(t.opredelenie) + '</p>' +
'<a href="' + esc(t.stranica) + '">Подробнее: ' + esc(t.stranica_nazvanie || 'статья') + ' →</a>';
}
var zagruzka = null, SPR = null, svyazano = false, pop = null, tek = null;
function zagruzit(url) {
if (!zagruzka) {
zagruzka = (typeof fetch === 'function' ? fetch(url || '/data/terminy.json', { cache: 'no-cache' })
.then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
.then(function (j) { SPR = j; return j; })
.catch(function () { return null; });
}
return zagruzka;
}
function stil(doc) {
if (doc.getElementById('termin-css')) return;
var s = doc.createElement('style'); s.id = 'termin-css'; s.textContent = CSS;
(doc.head || doc.documentElement).appendChild(s);
}
function zakryt() {
if (pop) { pop.parentNode && pop.parentNode.removeChild(pop); pop = null; }
if (tek) { tek.setAttribute('aria-expanded', 'false'); tek = null; }
}
function otkryt(btn) {
var doc = btn.ownerDocument, win = doc.defaultView;
var t = null;
((SPR && SPR.terminy) || []).forEach(function (x) { if (x.id === btn.getAttribute('data-termin')) t = x; });
if (!t) return;
zakryt();
pop = doc.createElement('div');
pop.id = 'termin-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Что значит «' + t.nazvanie + '»');
pop.innerHTML = podskazka(t);
doc.body.appendChild(pop);
var r = btn.getBoundingClientRect(), w = pop.offsetWidth, sx = win.pageXOffset || 0, sy = win.pageYOffset || 0;
var vw = doc.documentElement.clientWidth || win.innerWidth;
pop.style.left = Math.max(sx + 8, Math.min(r.left + sx - 12, sx + vw - w - 8)) + 'px';
pop.style.top = (r.bottom + sy + 8) + 'px';
btn.setAttribute('aria-expanded', 'true'); tek = btn;
}
function svyazat(doc) {
if (svyazano) return; svyazano = true;
doc.addEventListener('click', function (e) {
var b = e.target && e.target.closest ? e.target.closest('.termin') : null;
if (b) { e.preventDefault(); if (tek === b && !b.hasAttribute('data-navedenie')) zakryt(); else otkryt(b); b.removeAttribute('data-navedenie'); return; }
if (pop && !(e.target.closest && e.target.closest('#termin-pop'))) zakryt();
});
doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tek) { var b = tek; zakryt(); b.focus(); } });
var win = doc.defaultView, mysh = !!(win && win.matchMedia && win.matchMedia('(hover: hover) and (pointer: fine)').matches), tajmer = null;
if (!mysh) return;
doc.addEventListener('mouseover', function (e) {
var b = e.target.closest ? e.target.closest('.termin, #termin-pop') : null;
if (!b) return;
clearTimeout(tajmer);
if (b.classList.contains('termin') && tek !== b) { otkryt(b); b.setAttribute('data-navedenie', ''); }
});
doc.addEventListener('mouseout', function (e) {
var b = e.target.closest ? e.target.closest('.termin, #termin-pop') : null;
if (!b || !tek) return;
var kuda = e.relatedTarget;
if (kuda && kuda.closest && kuda.closest('.termin, #termin-pop')) return;
clearTimeout(tajmer); tajmer = setTimeout(zakryt, 300);
});
}
function mozhno(uzel, kont) {
for (var p = uzel.parentNode; p && p !== kont; p = p.parentNode) {
if (NE_TROGAT[p.nodeName] || (p.classList && (p.classList.contains('termin') || p.classList.contains('q'))) ||
(p.hasAttribute && p.hasAttribute('data-bez-terminov'))) return false;
}
return true;
}
function razmetitBlok(kont, spr) {
if (!kont || !spr) return 0;
var doc = kont.ownerDocument, terminy = sobrat(spr);
if (!terminy.length) return 0;
stil(doc); svyazat(doc);
var uzhe = {}, n = 0, uzly = [];
kont.querySelectorAll('.termin').forEach(function (b) { uzhe[b.getAttribute('data-termin')] = true; });
var w = doc.createTreeWalker(kont, 4, null), u;
while ((u = w.nextNode())) if (u.nodeValue && u.nodeValue.trim() && mozhno(u, kont)) uzly.push(u);
uzly.forEach(function (uz) {
var kuski = razmetit(uz.nodeValue, terminy, uzhe);
if (!kuski.some(function (k) { return k.id; })) return;
var fr = doc.createDocumentFragment();
kuski.forEach(function (k) {
if (!k.id) { fr.appendChild(doc.createTextNode(k.tekst)); return; }
var b = doc.createElement('button');
b.type = 'button'; b.className = 'termin'; b.setAttribute('data-termin', k.id);
b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-haspopup', 'dialog');
b.textContent = k.tekst; fr.appendChild(b); n++;
});
uz.parentNode.replaceChild(fr, uz);
});
return n;
}
function mount(kont, url) {
return zagruzit(url).then(function (spr) { try { return razmetitBlok(kont, spr); } catch (e) { return 0; } });
}
return { sobrat: sobrat, najti: najti, razmetit: razmetit, podskazka: podskazka, razmetitBlok: razmetitBlok, mount: mount, zagruzit: zagruzit };
});
;
/* --- /js/pasport-cta.js --- */
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.PasportCta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0';
var TARIFY_URL = '/tarify/tarify.json';
var PLATNYE = { start: 1, pro: 1, business: 1, biznes: 1, team: 1 };
var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function srokBety(d, sejchas) {
var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (!m) return null;
var k = Date.parse(d + 'T00:00:00+03:00') + 864e5;
if (isNaN(k) || (sejchas || Date.now()) >= k) return null;
return { kratko: m[3] + '.' + m[2], slovami: (+m[3]) + NB + MES[+m[2] - 1] };
}
function rub(n) {
return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';
}
function z(n) { return (n < 10 ? '0' : '') + n; }
function dataRu(v) {
if (!v) return '';
var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
if (m) return m[3] + '.' + m[2] + '.' + m[1];
return /^\d{2}\.\d{2}\.\d{4}$/.test(String(v)) ? String(v) : '';
}
function vremyaRu(v) {
if (/^\s*\d{4}-\d{2}-\d{2}\s*$/.test(String(v || ''))) return dataRu(String(v).trim());
var d = new Date(v);
if (!v || isNaN(d)) return '';
var m = new Date(d.getTime() + 3 * 3600 * 1000);
return z(m.getUTCDate()) + '.' + z(m.getUTCMonth() + 1) + '.' + m.getUTCFullYear() + ' в ' + z(m.getUTCHours()) + ':' + z(m.getUTCMinutes());
}
function iz(T) {
if (!T || !T.pasport_razovyj || !(T.pasport_razovyj.cena_rub > 0)) return null;
var p = T.paket_pasportov || {};
var start = (T.tarify || []).filter(function (t) { return t.id === 'start'; })[0];
return {
beta: T.beta === true,
betaDo: T.beta_do || null,
cena: T.pasport_razovyj.cena_rub,
paketShtuk: p.shtuk > 0 ? p.shtuk : null,
paketCena: p.cena_rub > 0 ? p.cena_rub : null,
start: start ? start.nazvanie : null,
startMes: start ? startMesyac(start, T.beta === true) : null,
startPasportov: start && start.otchetov > 0 ? start.otchetov : null
};
}
function startMesyac(t, beta) {
var st = t.startovaya;
if (beta && st && st.vklyuchit === true && st.god_soglasovan === true && st.mesyac > 0) return st.mesyac;
return t.mesyac > 0 ? t.mesyac : null;
}
function pasportov(n) {
var d = n % 10, s = n % 100;
if (d === 1 && s !== 11) return n + NB + 'Паспорт включён';
if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return n + NB + 'Паспорта включены';
return n + NB + 'Паспортов включены';
}
function startVygodnee(T) {
return !!(T && T.start && T.startMes && T.startPasportov && T.startMes < T.cena);
}
function startPodskazka(T) {
return rub(T.startMes) + ' в месяц, ' + pasportov(T.startPasportov);
}
function sostoyanie(o) {
o = o || {};
var T = o.tarify, u = o.user || null, inn = String(o.inn || '').replace(/\D/g, '');
var rid = /^[A-Za-z0-9_-]{8,24}$/.test(String(o.reportId || '')) ? String(o.reportId) : '';
var put = rid ? '/pasport/kontragent/?id=' + rid + '#sd' : '/pasport/kontragent/?inn=' + inn;
var g = o.gotov;
if (g && g.nomer) {
var kogda = vremyaRu(g.sformirovan);
return { sost: 'gotov', knopka: 'Открыть Паспорт № ' + g.nomer, stroka: kogda ? 'Сформирован ' + kogda : '', href: g.url || put };
}
if (o.beta || (T && T.beta)) {
var s = 'В бете — бесплатно.';
var srok = srokBety(T && T.betaDo, o.sejchas);
if (T && T.start && srok) s += ' После ' + srok.kratko + ' — ' + rub(T.cena) + ' или в тарифе «' + T.start + '»' + (startVygodnee(T) ? ': ' + startPodskazka(T) : '') + '.';
return { sost: 'beta', knopka: rid ? 'Досье сделки' : 'Паспорт контрагента', stroka: s, href: put };
}
var plan = u && u.plan ? String(u.plan) : '';
if (PLATNYE[plan]) return { sost: 'tarif', knopka: 'Сформировать Паспорт', stroka: 'Входит в ваш тариф', href: put };
var pk = u && u.paket;
if (pk && pk.ostalos > 0) {
var vsego = pk.vsego > 0 ? pk.vsego : (T && T.paketShtuk) || pk.ostalos;
var dd = dataRu(pk['do']);
return { sost: 'paket', knopka: 'Сформировать Паспорт', stroka: 'Осталось ' + pk.ostalos + ' из ' + vsego + (dd ? ' · до ' + dd : ''), href: put };
}
if (!T) return { sost: 'nejzvestno', knopka: 'Паспорт контрагента', stroka: '', href: put };
var r = { sost: 'gost', knopka: 'Паспорт на дату сделки — ' + rub(T.cena), stroka: 'Без подписки. PDF с QR-кодом, хранится в Кабинете.', href: '/schet/?produkt=pasport_razovyj' + (/^(\d{10}|\d{12})$/.test(inn) ? '&inn=' + inn : '') };
if (startVygodnee(T)) r.ssylka = { t: 'или «' + T.start + '» — ' + rub(T.startMes) + ' в месяц: дешевле одного Паспорта, и ' + pasportov(T.startPasportov), href: '/tarify/#t-start', cel: 'start' };
else if (T.paketShtuk && T.paketCena) r.ssylka = { t: T.paketShtuk + ' проверки — ' + rub(T.paketCena), href: '/schet/?produkt=paket_pasportov', cel: 'paket' };
return r;
}
var kesh = null;
function zagruzit(doc) {
if (kesh) return kesh;
var w = doc && doc.defaultView;
var el = doc && doc.getElementById && doc.getElementById('tarify-data');
if (el) { try { kesh = Promise.resolve(JSON.parse(el.textContent)); return kesh; } catch (e) {   } }
kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
return kesh;
}
function betaStranicy(doc) {
return !!(doc && doc.querySelector && doc.querySelector('meta[name="deloskop-rezhim"][content="beta"]'));
}
function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) {   } }
function primenit(a, s, mesto, nazvanie) {
var doc = a.ownerDocument, w = doc.defaultView;
if (nazvanie) a.setAttribute('data-naz', String(nazvanie).slice(0, 200));
a.textContent = s.knopka;
a.setAttribute('href', s.href);
a.setAttribute('data-sost', s.sost);
var box = a.parentNode && a.parentNode.querySelector('.pcta[data-dlya="' + (a.getAttribute('data-cel') || '') + '"]');
if (box) box.parentNode.removeChild(box);
if (s.stroka || s.ssylka) {
box = doc.createElement('p');
box.className = 'pcta';
box.setAttribute('data-dlya', a.getAttribute('data-cel') || '');
if (s.stroka) box.appendChild(doc.createTextNode(s.stroka));
if (s.ssylka) {
if (s.stroka) box.appendChild(doc.createTextNode(' '));
var l = doc.createElement('a');
l.href = s.ssylka.href; l.textContent = s.ssylka.t;
if (s.ssylka.cel) {
l.setAttribute('data-ssylka', s.ssylka.cel);
l.addEventListener('click', function () { cel(w, 'pasport_cta_click', { mesto: mesto, sost: s.sost, ssylka: s.ssylka.cel }); });
}
box.appendChild(l);
}
a.parentNode.insertBefore(box, a.nextSibling);
}
cel(w, 'pasport_cta_view', { mesto: mesto, sost: s.sost });
if (!a.getAttribute('data-pcta')) {
a.setAttribute('data-pcta', '1');
a.addEventListener('click', function (e) {
var sost = a.getAttribute('data-sost') || '';
cel(w, 'pasport_cta_click', { mesto: mesto, sost: sost });
if (sost !== 'gost' || !w.PasportOplata || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
e.preventDefault();
var href = a.getAttribute('href');
w.PasportOplata.otkryt({ nazvanie: a.getAttribute('data-naz') || '', inn: (/[?&]inn=(\d{10,12})/.exec(href) || [])[1] || '', doc: doc }).then(function (ok) { if (!ok) w.location.href = href; });
});
}
return s;
}
function mount(a, o) {
o = o || {};
if (!a || !a.ownerDocument) return Promise.resolve(null);
var doc = a.ownerDocument, beta = betaStranicy(doc), mesto = o.mesto || 'list';
var user = o.user ? Promise.resolve(o.user) : (beta || !o.api ? Promise.resolve(null)
: doc.defaultView.fetch(o.api + '/api/me', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (j) { return j && j.user || null; }).catch(function () { return null; }));
return Promise.all([zagruzit(doc), user]).then(function (x) {
return primenit(a, sostoyanie({ tarify: iz(x[0]), beta: beta, user: x[1], gotov: o.gotov, inn: o.inn, reportId: o.reportId }), mesto, o.nazvanie);
}).catch(function () { return null; });
}
return { sostoyanie: sostoyanie, iz: iz, pasportov: pasportov, startVygodnee: startVygodnee, rub: rub, dataRu: dataRu, vremyaRu: vremyaRu, mount: mount, primenit: primenit, srokBety: srokBety };
});
;
/* --- /js/pasport-oplata.js --- */
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.PasportOplata = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0';
var TARIFY_URL = '/tarify/tarify.json';
var SCHET_JS = '/js/schet.js';
var VNUTRI = [
'Все признаки — с источником и датой',
'Комментарий команды к сигналам, где он есть',
'PDF с QR-кодом: проверить подлинность может любой',
'Хранится в Кабинете — часть доказательств вашей осмотрительности'
];
var OGOVORKA = 'Оплачивая, вы принимаете оферту (п.' + NB + '3.7). Если Паспорт не сформирован или в нём ошибка по нашей вине, исправим за 3 рабочих дня, не исправим — вернём оплату.';
var PO_SCHETU = 'Компании и ИП — оплата по счёту';
function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }
function z(n) { return (n < 10 ? '0' : '') + n; }
function segodnya(now) {
var d = new Date((now == null ? Date.now() : +new Date(now)) + 3 * 3600 * 1000);
return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
}
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function model(T, o) {
o = o || {};
if (!T || T.beta === true) return null;
var p = T.pasport_razovyj;
if (!p || !(p.cena_rub > 0)) return null;
var sp = (Array.isArray(T.sposoby) ? T.sposoby : []).filter(function (s) {
return s && s.nazvanie && /^https:\/\//.test(String(s.href || ''));
}).map(function (s) { return { id: String(s.id || ''), nazvanie: String(s.nazvanie), href: String(s.href) }; });
return {
produkt: 'pasport_razovyj',
zag: 'Паспорт контрагента на' + NB + segodnya(o.now),
nazvanie: String(o.nazvanie || '').trim(),
inn: /^(\d{10}|\d{12})$/.test(String(o.inn || '')) ? String(o.inn) : '',
vnutri: VNUTRI.slice(),
cena: rub(p.cena_rub),
nds: 'без НДС',
sposoby: sp,
poSchetu: PO_SCHETU,
ogovorka: OGOVORKA
};
}
function html(m) {
if (!m) return '';
return '<header class="po-hd"><h2 class="po-zag" id="po-zag" tabindex="-1">' + esc(m.zag) + '</h2>' +
(m.nazvanie ? '<p class="po-naz">' + esc(m.nazvanie) + '</p>' : '') + '</header>' +
'<ul class="po-vn">' + m.vnutri.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
'<p class="po-cena"><b class="n">' + esc(m.cena) + '</b><span>' + esc(m.nds) + '</span></p>' +
(m.sposoby.length ? '<div class="po-sp">' + m.sposoby.map(function (s, i) {
return '<a class="btn' + (i === 0 ? ' p' : '') + '" href="' + esc(s.href) + '" data-sposob="' + esc(s.id) + '" rel="noopener">' + esc(s.nazvanie) + '</a>';
}).join('') + '</div>' : '') +
'<button type="button" class="po-schet' + (m.sposoby.length ? '' : ' po-schet--gl') + '" data-po-schet aria-expanded="false">' + esc(m.poSchetu) + '</button>' +
'<div class="po-forma" data-po-forma hidden></div>' +
'<p class="po-og">' + esc(m.ogovorka).replace('оферту', '<a href="/oferta/#razovye" target="_blank" rel="noopener">оферту</a>') + '</p>';
}
var kesh = null, dlg = null, schetGruzim = null;
function tarify(doc) {
if (kesh) return kesh;
var w = doc.defaultView, el = doc.getElementById && doc.getElementById('tarify-data');
if (el) { try { kesh = Promise.resolve(JSON.parse(el.textContent)); return kesh; } catch (e) {   } }
kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
return kesh;
}
function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) {   } }
function schet(doc) {
var w = doc.defaultView;
if (w.DeloskopSchet) return Promise.resolve(w.DeloskopSchet);
if (schetGruzim) return schetGruzim;
schetGruzim = new Promise(function (ok, ne) {
var s = doc.createElement('script'); s.src = SCHET_JS; s.async = true;
s.onload = function () { w.DeloskopSchet ? ok(w.DeloskopSchet) : ne(new Error('schet')); };
s.onerror = function () { schetGruzim = null; ne(new Error('schet')); };
doc.head.appendChild(s);
});
return schetGruzim;
}
function otkryt(o) {
o = o || {};
var doc = o.doc || (typeof document !== 'undefined' ? document : null);
if (!doc || !doc.defaultView || !doc.defaultView.HTMLDialogElement) return Promise.resolve(false);
var w = doc.defaultView;
return tarify(doc).then(function (T) {
var m = model(T, { nazvanie: o.nazvanie, inn: o.inn });
if (!m) return false;
if (!dlg) {
dlg = doc.createElement('dialog'); dlg.className = 'po';
dlg.setAttribute('aria-labelledby', 'po-zag');
doc.body.appendChild(dlg);
dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', function () { doc.documentElement.style.overflow = ''; });
}
dlg.classList.remove('po--schet');
dlg.innerHTML = '<button type="button" class="po-x" aria-label="Закрыть">×</button>' + html(m);
dlg.querySelector('.po-x').onclick = function () { dlg.close(); };
Array.prototype.forEach.call(dlg.querySelectorAll('[data-sposob]'), function (a) {
a.addEventListener('click', function () { cel(w, 'oplata_start', { produkt: 'razovyj', sposob: a.getAttribute('data-sposob') || '' }); });
});
var b = dlg.querySelector('[data-po-schet]'), box = dlg.querySelector('[data-po-forma]');
b.onclick = function () {
if (!box.hidden) return;
cel(w, 'oplata_start', { produkt: 'razovyj', sposob: 'schet' });
b.setAttribute('aria-expanded', 'true');
schet(doc).then(function (S) {
box.hidden = false; b.hidden = true; dlg.classList.add('po--schet');
var f = S.forma(box, { produkt: m.produkt, inn: m.inn, nazvanie: m.nazvanie }, true);
try { f.fokus(); } catch (e) {   }
}).catch(function () { w.location.href = '/schet/?produkt=' + m.produkt + (m.inn ? '&inn=' + m.inn : ''); });
};
doc.documentElement.style.overflow = 'hidden';
dlg.showModal();
try { dlg.querySelector('#po-zag').focus(); } catch (e) {   }
return true;
}).catch(function () { return false; });
}
return { model: model, html: html, otkryt: otkryt, segodnya: segodnya, rub: rub, VNUTRI: VNUTRI, OGOVORKA: OGOVORKA, PO_SCHETU: PO_SCHETU };
});
;
/* --- /indeks/indeks.js --- */
(function (root) {
'use strict';
function rasschitat(m, fakty, dostupno) {
var sh = m.shkala, ist = m.istochniki, polnota = 0, k;
for (k in ist) if (dostupno[k]) polnota += ist[k].ves_polnoty;
for (var i = 0; i < m.polnota.minimum_dlya_rascheta.length; i++)
if (!dostupno[m.polnota.minimum_dlya_rascheta[i]]) return { indeks: null, uroven: null, stop: null, polnota: polnota, vklady: [] };
for (i = 0; i < m.stop.length; i++)
if (fakty[m.stop[i].id]) return { indeks: null, uroven: { id: 'stop', nazvanie: 'Стоп', ton: 'red', tekst: m.stop[i].tekst }, stop: m.stop[i], polnota: polnota, vklady: [] };
var vklady = [], plyusy = 0, minusy = 0, potolki = [];
m.faktory.forEach(function (f) {
if (!fakty[f.id] || !dostupno[f.istochnik]) return;
vklady.push({ id: f.id, vklad: f.vklad, tekst: f.tekst, pochemu: f.pochemu, gruppa: f.gruppa });
if (f.vklad > 0) plyusy += f.vklad; else minusy += f.vklad;
if (f.potolok != null) potolki.push([f.potolok, f.tekst]);
});
var pu = Math.min(plyusy, m.plyusy_maksimum);
var indeks = Math.max(sh.min, Math.min(sh.max, sh.baza + minusy + pu)), potolok = null;
potolki.sort(function (a, b) { return a[0] - b[0]; });
if (potolki.length && indeks > potolki[0][0]) { indeks = potolki[0][0]; potolok = { znachenie: indeks, prichina: potolki[0][1] }; }
if (polnota < m.polnota.porog_sokrashchennoj)
return { indeks: null, uroven: null, stop: null, polnota: polnota, sokrashchennaya: true, vklady: [] };
vklady.sort(function (a, b) { return (a.vklad > 0) - (b.vklad > 0) || a.vklad - b.vklad; });
var u = m.urovni.filter(function (x) { return x.ot <= indeks && indeks <= x.do; })[0];
return { indeks: indeks, uroven: u, stop: null, polnota: polnota, sokrashchennaya: false, minusy: minusy,
plyusy: plyusy, plyusy_uchteno: pu, potolok: potolok, vklady: vklady };
}
function minus(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var PRESETY = {
zavod: ['vozrast_10g', 'shtat_10', 'likvidnost_vysokaya', 'goskontrakty', 'iski_est'],
tehnicheskaya: ['vozrast_do_6m', 'massovyj_rukovoditel', 'shtat_0_1', 'nalogi_nol', 'nedostovernyj_adres'],
startap: ['vozrast_6_12m', 'shtat_0_1', 'net_buhotchetnosti'],
ustalaya: ['vozrast_10g', 'ubytok_2_goda', 'chistye_aktivy_minus', 'nedoimka', 'iski_krupnye']
};
function zapustit(doc) {
var el = doc.getElementById('kalk');
if (!el) return;
var m = JSON.parse(doc.getElementById('metodika').textContent);
var vse = {}; for (var k in m.istochniki) vse[k] = true;
var box = el.querySelectorAll('input[type=checkbox]');
var chislo = el.querySelector('[data-k=chislo]'), nazv = el.querySelector('[data-k=uroven]'),
tekst = el.querySelector('[data-k=tekst]'), ukaz = el.querySelector('[data-k=ukazatel]'),
raskl = el.querySelector('[data-k=rasklad]'), kart = el.querySelector('.k-itog');
function obnovit() {
var f = {};
box.forEach(function (b) { f[b.value] = b.checked; });
var r = rasschitat(m, f, vse);
kart.setAttribute('data-ton', r.uroven.ton);
if (r.indeks == null) {
chislo.textContent = 'Стоп'; nazv.textContent = r.stop.tekst;
tekst.textContent = 'Индекс не считаем: с ликвидируемой или банкротящейся компанией работать нельзя.';
ukaz.style.left = '0%'; raskl.innerHTML = ''; return;
}
chislo.textContent = r.indeks; nazv.textContent = r.uroven.nazvanie; tekst.textContent = r.uroven.tekst;
ukaz.style.left = ((r.indeks - 1) / 98 * 100) + '%';
var h = '<li><span>База</span><b>' + m.shkala.baza + '</b></li>';
r.vklady.forEach(function (v) { h += '<li class="' + (v.vklad < 0 ? 'm' : 'p') + '"><span>' + esc(v.tekst) + '</span><b>' + minus(v.vklad) + '</b></li>'; });
if (r.plyusy > r.plyusy_uchteno) h += '<li class="n"><span>Плюсов больше +' + m.plyusy_maksimum + ' не засчитываем</span><b>' + minus(r.plyusy_uchteno - r.plyusy) + '</b></li>';
if (r.potolok) h += '<li class="n"><span>Потолок: ' + esc(r.potolok.prichina.toLowerCase()) + '</span><b>≤ ' + r.potolok.znachenie + '</b></li>';
h += '<li class="i"><span>Индекс</span><b>' + r.indeks + '</b></li>';
raskl.innerHTML = h;
}
box.forEach(function (b) { b.addEventListener('change', obnovit); });
el.querySelectorAll('[data-preset]').forEach(function (btn) {
btn.addEventListener('click', function () {
var p = PRESETY[btn.getAttribute('data-preset')] || [];
box.forEach(function (b) { b.checked = p.indexOf(b.value) >= 0; });
el.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
obnovit();
});
});
obnovit();
}
var api = { rasschitat: rasschitat, PRESETY: PRESETY };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else { root.DeloskopIndeks = api; if (root.document) { if (document.readyState !== 'loading') zapustit(document); else document.addEventListener('DOMContentLoaded', function () { zapustit(document); }); } }
})(typeof window !== 'undefined' ? window : this);
;
/* --- /js/indeks-otvet.js --- */
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
function gotovo(f) {
if (gotov() || typeof setTimeout !== 'function') { f(); return; }
var bylo = false, g = function () { if (!bylo) { bylo = true; f(); } };
zhdut.push(g); setTimeout(g, 4000);
}
function sig(r) { return Array.isArray(r && r.signals) ? r.signals.filter(function (s) { return s && typeof s === 'object'; }) : []; }
function t(s) { return String(s.title == null ? '' : s.title).replace(/ /g, ' ').trim(); }
function d(s) { return String(s.detail == null ? '' : s.detail).replace(/ /g, ' ').trim(); }
function plohoj(s) { return s.status === 'warn' || s.status === 'bad'; }
function naDatu(r) {
var x = Date.parse((r && r.checked_at) || '');
if (!isFinite(x)) x = Date.now();
var q = new Date(x + 3 * 3600 * 1000);
return { g: q.getUTCFullYear(), m: q.getUTCMonth() + 1, d: q.getUTCDate() };
}
function iso(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? { g: +m[1], m: +m[2], d: +m[3] } : null; }
function ru(v) { var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(v || '').trim()); return m ? { g: +m[3], m: +m[2], d: +m[1] } : iso(v); }
function mesyacev(a, b) { var n = (b.g - a.g) * 12 + (b.m - a.m); if (b.d < a.d) n--; return n; }
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
function izOtveta(r) {
r = r || {};
var c = r.company || {}, ch = (r.dossier && r.dossier.charts) || {}, na = naDatu(r);
var fakty = {}, dostupno = {}, neizv = [], neUchli = [];
var S = sig(r);
var kod = String(c.state_code == null ? '' : c.state_code).trim();
dostupno.egrul = !!(c.inn && S.some(function (s) { return t(s) === 'Статус'; }));
dostupno.fns = S.some(function (s) {
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
var b = dm[p[1]];
dostupno[p[0]] = !!(b && typeof b === 'object' && !b.iz_egryul && (b.status === 'provereno' || b.status === 'found' || b.status === 'not_found'));
});
var st = c.status;
if (st === 'LIQUIDATED' || ISKLYUCHENA[kod]) fakty.likvidirovana = true;
if (st === 'BANKRUPT') fakty.bankrotstvo = true;
if (st === 'REORGANIZING') fakty.reorganizaciya = true;
if (st === 'LIQUIDATING') {
if (ISKL[kod] || !kod) fakty.reshenie_ob_isklyuchenii = true;
else fakty.likvidaciya = true;
}
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
if (c.address_invalid === true) fakty.nedostovernyj_adres = true;
if (c.invalid === true && c.address_invalid !== true) fakty.nedostovernyj_rukovoditel = true;
S.forEach(function (s) {
if (!/^Среднесписочная численность/i.test(t(s))) return;
var m = /(\d+)\s*человек/.exec(d(s));
if (!m) { if (plohoj(s)) neizv.push(s); return; }
var n = +m[1];
if (n <= 1) fakty.shtat_0_1 = true; else if (n >= 10) fakty.shtat_10 = true;
});
var vyr = vyruchka(r);
S.forEach(function (s) {
if (!plohoj(s)) return;
var T = t(s), D = d(s), TD = T + ' ' + D;
if (/^Среднесписочная численность/i.test(T)) return;
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
return;
}
if (/^Низкая налоговая нагрузка/i.test(T)) { neUchli.push('nagruzka'); return; }
if (/^Прогноз ЗСК/i.test(T)) return;
if (/^(ФССП|Долг[иа]? у приставов|Исполнительн)/i.test(T)) {
var p = rubli(D);
if (dostupno.fssp && p != null && vyr && p > 0.05 * vyr) { fakty.pristavy_krupnye = true; return; }
if (dostupno.fssp && p != null && vyr) return;
neizv.push(s); return;
}
neizv.push(s);
});
var fs = dm.fssp;
if (dostupno.fssp && fs && fs.status === 'found') {
var ost = Number(fs.summa_ostatka);
if (isFinite(ost) && ost > 0 && vyr && ost > 0.05 * vyr) fakty.pristavy_krupnye = true;
else if (isFinite(ost) && ost > 0 && !vyr) neizv.push({ title: 'Долги у приставов', status: 'warn', faktor: 'pristavy_krupnye' });
}
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
if (M) M.faktory.forEach(function (f) {
if (fakty[f.id] && f.vklad < 0 && !dostupno[f.istochnik]) neizv.push({ title: f.tekst, status: 'warn', faktor: f.id });
});
return { fakty: fakty, dostupno: dostupno, neizvestnye: neizv, neUchli: neUchli, bankrIzEgryul: !!(dm.bankrotstvo && dm.bankrotstvo.iz_egryul) };
}
function chisloServera(r) {
var v = r && r.indeks;
return v !== undefined && v !== null && v !== '';
}
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
var out = { polnota: rez.polnota, istochnikov: n, vsego: Object.keys(M.istochniki).length, versiya: M.versiya, neUchityvali: neUchityvali(x, c) };
if (rez.stop) { out.rezhim = 'stop'; out.stop = rez.stop.tekst; out.ton = 'bad'; return out; }
if (rez.indeks == null && !rez.sokrashchennaya) { out.rezhim = 'net'; return out; }
if (x.neizvestnye.length) { out.rezhim = 'neizv'; out.signaly = x.neizvestnye.map(function (s) { return t(s); }); return out; }
if (rez.sokrashchennaya || rez.polnota < M.polnota.porog_sokrashchennoj) { out.rezhim = 'sokr'; out.porog = M.polnota.porog_sokrashchennoj; return out; }
out.uroven = rez.uroven.nazvanie; out.ton = TON[rez.uroven.ton] || 'warn';
out.rezhim = 'chislo'; out.ball = rez.indeks; out.baza = M.shkala.baza; out.vklady = rez.vklady;
out.potolok = rez.potolok; out.plyusy = rez.plyusy; out.plyusyUchteno = rez.plyusy_uchteno; out.plyusyMaks = M.plyusy_maksimum;
return out;
}
function bank(c) {
var S = root && root.Sushchestvennoe;
if (S && typeof S.bank === 'function') return S.bank(c);
return /^64\.1(\.|\d|$)/.test(String((c || {}).okved || ''));
}
function neUchityvali(x, c) {
var a = [], b = [];
Object.keys(NE_PODKL).forEach(function (k) { if (!x.dostupno[k]) a.push(k === 'fedresurs' && x.bankrIzEgryul ? 'сообщения ЕФРСБ' : NE_PODKL[k]); });
if (a.length) b.push(a.join(', ') + ' — источник не' + NB + 'подключён');
if (!x.dostupno.fns) b.push('налоги и штат — свежего набора ФНС в' + NB + 'ответе нет');
if (!x.dostupno.girbo) b.push(bank(c) ? 'бухотчётность — организация сдаёт в' + NB + 'Банк России, в' + NB + 'ГИР' + NB + 'БО её передаёт Банк России, доступ может быть ограничен (ч.' + NB + '9 и' + NB + '12 ст.' + NB + '18' + NB + '402-ФЗ)'
: 'бухотчётность — за' + NB + 'прошлый год в' + NB + 'ответе её нет');
b.push('налоговая нагрузка — сравним с' + NB + 'отраслью, когда придут налоги без взносов');
return b;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (q) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[q]; }); }
function nwFz(h) { return String(h).replace(/(\d+-ФЗ\)?\.?)/g, '<span class="nw">$1</span>'); }
function zn(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
function podpis(v) {
return 'По открытой методике v' + esc(v.versiya) + ' · ' + v.istochnikov + NB + 'из' + NB + v.vsego + ' источников · полнота ' + v.polnota + NB + '%';
}
var NE_ZNACHIT = 'Не проверено — не значит «не обнаружено».';
function strokaNe(v) { return 'Не учитывали в этот раз: ' + v.neUchityvali.join('; ') + '. ' + NE_ZNACHIT; }
var TXT_NEIZV = 'Индекс — считаем: в' + NB + 'проверке есть сигнал, который методика v1 пока не' + NB + 'оценивает. Он показан в' + NB + 'фактах ниже.';
var ZAG_SOKR = 'Индекс — данных пока' + NB + 'мало';
function txtSokr(v) { return 'Собрано ' + v.polnota + NB + '% данных — число и' + NB + 'уровень покажем, когда наберётся ' + (v.porog || 60) + NB + '%'; }
function neHvataet(v) {
var a = (v.neUchityvali || []).filter(function (x) { return !/не\s?подключён/.test(x) && !/^налоговая нагрузка/.test(x); });
return a.length ? a[0] : '';
}
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
return h + '<div class="ot-ix__ne">' + ZAG_SOKR + '</div>' +
'<div class="ot-ix__po n">' + esc(txtSokr(v)) + '.' + (neHvataet(v) ? ' Не хватает: ' + nwFz(esc(neHvataet(v)) + '.') : '') + '</div>' +
'<div class="ot-ix__po n">' + podpis(v) + ' · <a href="/indeks/">методика</a></div>';
if (v.rezhim === 'neizv')
return h + '<div class="ot-ix__ne">Индекс — считаем</div><div class="ot-ix__po">' + TXT_NEIZV.replace(/^Индекс — считаем: в/, 'В') + '</div>' +
'<div class="ot-ix__lv"><a href="/indeks/">методика</a></div>';
if (v.rezhim === 'stop')
return h + '<div class="ot-ix__big ot-ix__lv--bad">Стоп</div><div class="ot-ix__lv ot-ix__lv--bad">' + esc(v.stop) + '</div>' +
'<div class="ot-ix__po">По открытой методике v' + esc(v.versiya) + ' при этом факте число не' + NB + 'считаем · <a href="/indeks/">методика</a></div>';
return '';
}
function ball(r) {
var v = vid(r);
return v.rezhim === 'chislo' ? v.ball : null;
}
function faktor(id) {
if (!M || !Array.isArray(M.faktory)) return null;
var f = M.faktory.filter(function (x) { return x.id === id; })[0];
if (!f) return null;
var o = { id: f.id, tekst: f.tekst, vklad: f.vklad };
if (typeof f.potolok === 'number') o.potolok = f.potolok;
return o;
}
function shkala() {
if (!M || !M.shkala) return null;
return { min: M.shkala.min, max: M.shkala.max, plyusyMaks: M.plyusy_maksimum };
}
function versiya() { return M ? String(M.versiya || '') : ''; }
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
return { izOtveta: izOtveta, vid: vid, ball: ball, htmlKolonka: htmlKolonka, gotov: gotov, gotovo: gotovo, ustanovit: ustanovit, faktor: faktor, shkala: shkala, versiya: versiya,
rubli: rubli, TXT_NEIZV: TXT_NEIZV, ZAG_SOKR: ZAG_SOKR, txtSokr: txtSokr, neHvataet: neHvataet, strokaNe: strokaNe, podpis: podpis };
});
;
/* --- /js/otchet.js --- */
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory();
else root.Otchet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var NB = '\u00a0';
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
});
}
var UROVNI = [
[70, 'Без серьёзных сигналов', 'ok'],
[50, 'Есть вопросы', 'warn'],
[30, 'Есть серьёзные сигналы', 'warn'],
[1, 'Много признаков риска', 'bad']
];
function uroven(n) {
for (var i = 0; i < UROVNI.length; i++) if (n >= UROVNI[i][0]) return { t: UROVNI[i][1], ton: UROVNI[i][2] };
return null;
}
function indeks(r) {
var v = r && r.indeks;
if (v && typeof v === 'object') v = v.znachenie != null ? v.znachenie : v.value;
var n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d{1,2}$/.test(v) ? +v : NaN);
return isFinite(n) && n >= 1 && n <= 99 ? Math.round(n) : null;
}
function polnota(r) {
var v = r && r.polnota;
if (v && typeof v === 'object') v = v.procent;
var n = typeof v === 'number' ? v : NaN;
if (!isFinite(n)) return null;
if (n > 0 && n <= 1) n = n * 100;
return n >= 0 && n <= 100 ? Math.round(n) : null;
}
function tonPolosy(r) {
var l = r && r.risk_level;
return l === 'low' ? 'ok' : l === 'high' ? 'bad' : 'warn';
}
function dejstviya(r, svoj, g) {
var inn = String(r && r.company && r.company.inn || '').replace(/\D/g, '');
var a = [svoj && g && g.href && !g.sled
? { t: g.knopka || 'Что сделать', href: g.href, glavnaya: true, cel: 'shchit_shag', ext: !!g.ext }
: { t: svoj ? 'Следить за своей компанией' : 'Следить за компанией', href: '/cabinet.html#watch', glavnaya: true, cel: svoj ? 'shchit_sled' : 'otchet_sled' }];
var rid = /^[A-Za-z0-9_-]{8,24}$/.test(String(r && r.report_id || '')) ? String(r.report_id) : '';
if (!svoj && inn.length === 10) a.push(rid ? { t: 'Досье сделки', href: '/pasport/kontragent/?id=' + rid + '#sd', cel: 'otchet_pasport' } : { t: 'Паспорт контрагента', href: '/pasport/kontragent/?inn=' + inn, cel: 'otchet_pasport' });
if (!svoj && inn.length === 10) a.push({ t: '+' + NB + 'Сравнить с другой компанией', href: '/sravnit/?a=' + inn, cel: 'otchet_sravnit', tihaya: true });
return a;
}
function htmlIndeks(r) {
var n = indeks(r), p = polnota(r);
var h = '<div class="ot-ix__lab">Индекс Делоскопа</div>';
if (n != null) {
var u = uroven(n);
h += '<div class="ot-ix__big n">' + n + '<small>' + NB + '/' + NB + '99</small></div>' +
'<div class="ot-ix__sh" aria-hidden="true"><i style="left:' + n + '%"></i></div>' +
'<div class="ot-ix__lv">' + esc(u.t) + ' · <a href="/indeks/">методика</a></div>';
} else {
h += '<div class="ot-ix__ne">Индекс — считаем</div>' +
(p != null ? '<div class="ot-ix__pl n">собрано ' + p + NB + '% данных</div>' : '') +
'<div class="ot-ix__lv"><a href="/indeks/">методика</a></div>';
}
return h;
}
function htmlIndeksIz(r, IO) {
if (indeks(r) == null && IO && IO.vid && IO.htmlKolonka) {
try { var h = IO.htmlKolonka(IO.vid(r)); if (h) return h; } catch (e) {}
}
return htmlIndeks(r);
}
function modulIO() { return typeof self !== 'undefined' && self.IndeksOtvet ? self.IndeksOtvet : null; }
function summaVSsylku(a, report) {
var h = a.getAttribute('href') || '';
if (!/^\/pasport\/kontragent\/\?id=/.test(h)) return;
var i = report.querySelector('.usl-in input'), U = typeof self !== 'undefined' ? self.Usloviya : null;
var v = U && i ? U.parseAmount(i.value) : 0;
h = h.replace(/&summa=\d+/, '');
a.setAttribute('href', v > 0 ? h.replace(/(#sd)?$/, '&summa=' + Math.round(v) + '$1') : h);
}
function htmlDejstviya(r, svoj, g) {
return dejstviya(r, svoj, g).map(function (d) {
if (d.tihaya) return '<a class="ot-lnk" href="' + esc(d.href) + '" data-cel="' + d.cel + '">' + esc(d.t) + '</a>';
return '<a class="ot-btn ' + (d.glavnaya ? 'p' : 's') + '" href="' + esc(d.href) + '" data-cel="' + d.cel + '"' + (d.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(d.t) + '</a>';
}).join('');
}
function htmlKak(kak, statya) {
if (!kak || !kak.kak) return '';
return '<section class="ot-sc" id="ot-kak" aria-labelledby="ot-kak-h"><h3 id="ot-kak-h">Как посчитали предел</h3>' +
'<p class="n">' + esc(kak.kak) + '</p>' + (kak.ne ? '<p class="ot-ne n">' + esc(kak.ne) + '</p>' : '') +
(kak.ssylka ? '<p class="n" data-ot="bank"><a href="' + esc(kak.ssylka.u) + '" target="_blank" rel="noopener">' + esc(kak.ssylka.t) + ' →</a></p>' : '') +
'<p class="ot-cap">Ориентир Делоскопа, не норма закона. <a href="/indeks/#predoplata">Открытая формула предела</a>' + (statya ? '; пример — в разборе <a href="' + esc(statya) + '">«Сколько платить вперёд незнакомой компании»</a>' : '') + '.</p></section>';
}
var POD_PILL = 'по признакам из реестров';
var PILL_SOKR = 'В найденных данных серьёзных сигналов нет';
function podSokr(v) {
if (!v || !(v.vsego > 0) || !(v.istochnikov >= 0)) return '';
var t = 'Учтено реестров: ' + v.istochnikov + NB + 'из' + NB + v.vsego;
return v.istochnikov < v.vsego ? t + '. По остальным не' + NB + 'проверяли — это не' + NB + 'значит «нарушений нет».' : t;
}
function pilyulya(r, v) {
if (r && r.risk_level === 'low' && v && v.rezhim === 'sokr') return { t: PILL_SOKR, pod: podSokr(v) || POD_PILL };
return { t: null, pod: POD_PILL };
}
function otstup(doc) {
var w = doc.defaultView, m = 0;
if (!w || !w.getComputedStyle) return 0;
Array.prototype.forEach.call(doc.querySelectorAll('.shapka, .rezhim-otcheta .hero-text'), function (x) {
var cs = w.getComputedStyle(x);
if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
var b = (parseFloat(cs.top) || 0) + x.offsetHeight;
if (b > m) m = b;
});
return m;
}
function prokrutit(report) {
if (!report || !report.ownerDocument) return false;
var doc = report.ownerDocument, w = doc.defaultView;
if (!w || !w.scrollTo) return false;
var cel = (w.location && w.location.hash === '#indeks' && doc.getElementById('indeks')) || report;
var y = cel.getBoundingClientRect().top + (w.pageYOffset || 0) - otstup(doc) - 12;
var plavno = !(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
w.scrollTo({ top: Math.max(0, Math.round(y)), behavior: plavno ? 'smooth' : 'auto' });
return true;
}
var OGOVORKA = 'Оценка по открытым данным на дату проверки, а не решение банка или налоговой.';
var DRUGIE = [['Проверить счёт', '/proverit-schet/'], ['Кому вы' + NB + 'платите', '/kontragenty-iz-vypiski/'],
['Наличные глазами банка', '/nalichnye/'], ['Скорая 115\u2011ФЗ', '/skoraya-115-fz/'], ['Разборы дел', '/praktika/'],
['Все инструменты', '/#vitrina']];
function tekstPilyuli(pill, t) {
var uz = null;
for (var i = pill.childNodes.length - 1; i >= 0; i--) if (pill.childNodes[i].nodeType === 3) { uz = pill.childNodes[i]; break; }
if (!uz) return;
if (!pill.hasAttribute('data-t0')) pill.setAttribute('data-t0', uz.nodeValue);
uz.nodeValue = t == null ? pill.getAttribute('data-t0') : t;
}
function el(doc, tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function vzyat(report, sel) { var x = report.querySelector(sel); return x && x.parentNode ? x : null; }
function razlozhit(report, r, o) {
o = o || {};
if (!report || !r || !r.company) return false;
var doc = report.ownerDocument || document, svoj = !!o.svoj;
var head = vzyat(report, '.report-head'), who = head && head.firstElementChild, pill = vzyat(report, '.report-head .pill');
var rkv = vzyat(report, '.rkv'), rows = vzyat(report, '.rows'), izm = report.querySelector(':scope > .izm');
var din = report.querySelector(':scope > .din'), gl = report.querySelector('.sut__g');
var act = vzyat(report, '.report-actions'), otk = vzyat(report, '.otk') || vzyat(report, '.src');
var usl = o.usl || null;
if (!head || !act) return false;
var hd = el(doc, 'header', 'ot-hd'), whoBox = el(doc, 'div', 'ot-who'), rq = el(doc, 'div', 'ot-rq');
if (who) whoBox.appendChild(who);
if (rkv) rq.appendChild(rkv);
var ppEl = vzyat(report, '.pp');
if (ppEl) rq.appendChild(ppEl);
hd.appendChild(whoBox); hd.appendChild(rq);
var nom = null, nomEl = rkv && rkv.querySelector('.rkv__nom');
if (nomEl) {
var nomDiv = nomEl.closest ? nomEl.closest('div') : nomEl.parentNode.parentNode;
var nomDt = nomDiv && nomDiv.querySelector('dt');
nom = el(doc, 'p', 'ot-nom', (nomDt ? nomDt.innerHTML : 'Проверка №') + NB);
nom.appendChild(nomEl);
if (nomDiv && nomDiv.parentNode === rkv) rkv.removeChild(nomDiv);
if (rkv.children.length % 2) rkv.classList.add('rkv--nechet');
}
var vd = el(doc, 'section', 'ot-vd ot-vd--' + tonPolosy(r));
vd.setAttribute('aria-label', 'Вывод');
var ix = el(doc, 'div', 'ot-ix', htmlIndeks(r));
ix.id = 'indeks';
var zapolnit = function () {
var IO = modulIO(), h = htmlIndeksIz(r, IO);
ix.innerHTML = h;
var chislo = /ot-ix__big/.test(h);
if (pill && !chislo) {
pill.classList.add('ot-pill'); ix.insertBefore(pill, ix.lastChild);
var pv = null;
try { pv = IO && indeks(r) == null && IO.gotov && IO.gotov() ? IO.vid(r) : null; } catch (e) { pv = null; }
var pp = pilyulya(r, pv);
tekstPilyuli(pill, pp.t);
ix.insertBefore(el(doc, 'div', 'ot-ix__pod', esc(pp.pod)), ix.lastChild);
}
var pch = ix.querySelector('.ot-ix__pch');
if (pch) pch.addEventListener('toggle', function () { try { if (pch.open && window.dlkGoal) dlkGoal('indeks_raskladka'); } catch (e) {} });
};
zapolnit();
var IO0 = modulIO();
if (IO0 && indeks(r) == null && IO0.gotov && !IO0.gotov() && IO0.gotovo) {
var popytki = 0, zhdat = function () {
if (!IO0.gotov() && ++popytki < 4) { IO0.gotovo(zhdat); return; }
if (IO0.gotov()) zapolnit();
};
IO0.gotovo(zhdat);
}
var vt = el(doc, 'div', 'ot-vt');
if (svoj) {
var shKr = function () {
var kr = '';
try { kr = o.shR && window.Shchit ? Shchit.kratko(o.shR) : ''; } catch (e) { kr = ''; }
kr = kr.replace(/^.*? — глазами банка и налоговой на [\d.]+\.\s*/, '').replace(/\s*Что сделать:.*$/, '');
vt.innerHTML = '<h2 class="ot-vt__h">Ваша компания глазами банка и налоговой</h2>' + (kr ? '<p class="ot-vt__p">' + esc(kr) + '</p>' : '');
};
shKr();
if (o.shR && o.shR.gotovo && typeof o.shR.gotovo.then === 'function') o.shR.gotovo.then(shKr, function () {});
} else if (usl) {
vt.appendChild(usl);
vt.appendChild(el(doc, 'a', 'ot-vt__kak', 'Как посчитали предел')).setAttribute('href', '#ot-kak');
}
var g = null;
try { g = svoj && o.shR && window.Shchit ? Shchit.glavnyj(o.shR) : null; } catch (e) { g = null; }
var ac = el(doc, 'div', 'ot-act', htmlDejstviya(r, svoj, g));
vd.appendChild(ix); vd.appendChild(vt); vd.appendChild(ac);
var body = el(doc, 'div', 'ot-body'), main = el(doc, 'div', 'ot-main'), side = el(doc, 'aside', 'ot-side');
side.setAttribute('aria-label', 'Справка к выводу');
if (svoj && usl) main.appendChild(usl);
[rows, izm, din, gl].forEach(function (x) { if (x && x.parentNode) main.appendChild(x); });
if (gl) gl.classList.add('ot-gl');
if (!svoj) {
var kak = null;
try { kak = window.Usloviya ? Usloviya.decide(r).kak : null; } catch (e) { kak = null; }
var kh = htmlKak(kak, window.Usloviya && Usloviya.STATYA);
if (kh) side.appendChild(el(doc, 'div', null, kh).firstChild);
else { var k = vt.querySelector('.ot-vt__kak'); if (k) k.parentNode.removeChild(k); }
}
if (otk) { otk.classList.add('ot-otk'); side.appendChild(otk); }
body.appendChild(main); body.appendChild(side);
var foot = el(doc, 'div', 'ot-foot'); foot.appendChild(act);
if (nom) foot.appendChild(nom);
var disc = el(doc, 'p', 'ot-disc', esc(OGOVORKA));
var dr = null;
if (!svoj && doc.querySelector && doc.querySelector('main#top > .hero')) {
dr = el(doc, 'nav', 'ot-dr', '<p class="ot-dr__h">Другие инструменты</p><ul>' + DRUGIE.map(function (x) {
return '<li><a href="' + x[1] + '" data-goal="otchet_drugie">' + x[0] + '</a></li>';
}).join('') + '</ul>');
dr.setAttribute('aria-label', 'Другие инструменты');
}
Array.prototype.slice.call(report.children).forEach(function (x) { if (x !== head) main.appendChild(x); });
if (head.parentNode) head.parentNode.removeChild(head);
Array.prototype.slice.call(main.children).forEach(function (x) { if (!x.textContent.trim()) main.removeChild(x); });
report.innerHTML = '';
[hd, vd, body, foot, disc, dr].forEach(function (x) { if (x) report.appendChild(x); });
report.classList.add('ot');
report.setAttribute('aria-label', svoj ? 'Ваша компания глазами банка и налоговой' : 'Отчёт о проверке контрагента');
Array.prototype.forEach.call(vd.querySelectorAll('[data-cel]'), function (a) {
a.addEventListener('click', function () { try { if (window.dlkGoal) dlkGoal(a.getAttribute('data-cel')); } catch (e) {} });
});
var pa = vd.querySelector('[data-cel="otchet_pasport"]');
if (pa && doc.defaultView && doc.defaultView.PasportCta) {
try { doc.defaultView.PasportCta.mount(pa, { inn: r.company.inn, mesto: 'list', reportId: r.report_id, api: o.api || '', nazvanie: r.company.name_short || r.company.name_full || '' }); } catch (e) {   }
}
if (pa) pa.addEventListener('click', function () { summaVSsylku(pa, report); });
if (doc.body) doc.body.classList.add('rezhim-otcheta');
return true;
}
return { razlozhit: razlozhit, indeks: indeks, polnota: polnota, uroven: uroven, tonPolosy: tonPolosy, dejstviya: dejstviya,
htmlIndeks: htmlIndeks, htmlIndeksIz: htmlIndeksIz, htmlKak: htmlKak, prokrutit: prokrutit, UROVNI: UROVNI, OGOVORKA: OGOVORKA, POD_PILL: POD_PILL,
pilyulya: pilyulya, PILL_SOKR: PILL_SOKR };
});
;
/* --- /js/lipkaya.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else root.DlkLipkaya = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
var ZAG = 'Что делать завтра утром';
var UZKO = '(max-width: 600px)';
var sostoyanie = null;
function tekst(e) { return e ? String(e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
function vyvod(report) {
var vd = report && report.querySelector && report.querySelector('.ot-vd');
if (!vd) return null;
var vt = vd.querySelector('.ot-vt');
var kratko = tekst(vt && vt.querySelector('.usl-t')) || tekst(vd.querySelector('.ot-ix__lv')) || tekst(vd.querySelector('.ot-pill'));
var abzacy = [];
if (vt) {
['.usl-t', '.usl-r', '.usl-a', '.ot-vt__p'].forEach(function (s) {
var t = tekst(vt.querySelector(s));
if (t && abzacy.indexOf(t) < 0) abzacy.push(t);
});
}
var ssylki = [];
Array.prototype.forEach.call(vd.querySelectorAll('.ot-act a[href]'), function (a) {
var t = tekst(a);
if (t) ssylki.push({ t: t, href: a.getAttribute('href'), glavnaya: a.classList.contains('p'), ist: a });
});
if (!kratko && !abzacy.length) return null;
return { kratko: kratko, abzacy: abzacy, ssylki: ssylki, ton: (vd.className.match(/ot-vd--(\w+)/) || [])[1] || '' };
}
function el(doc, tag, cls, txt) {
var e = doc.createElement(tag);
if (cls) e.className = cls;
if (txt != null) e.textContent = txt;
return e;
}
function zapolnitOkno(s) {
var v = vyvod(s.report), dlg = s.dlg, doc = s.doc;
var telo = dlg.querySelector('.lip-d__t'), act = dlg.querySelector('.lip-d__act');
telo.textContent = ''; act.textContent = '';
if (!v) return false;
v.abzacy.forEach(function (t, i) { telo.appendChild(el(doc, 'p', i === 0 && v.abzacy.length > 1 ? 'lip-d__itog' : null, t)); });
v.ssylki.forEach(function (x) {
var a = el(doc, 'a', 'ot-btn ' + (x.glavnaya ? 'p' : 's'), x.t);
a.href = x.href;
if (x.ist.target) { a.target = x.ist.target; a.rel = 'noopener'; }
a.addEventListener('click', function (e) {
if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
e.preventDefault();
try { dlg.close(); } catch (er) {}
x.ist.click();
});
act.appendChild(a);
});
return true;
}
function obnovitStroku(s) {
var v = vyvod(s.report);
var t = s.bar.querySelector('.lip__t');
t.textContent = v ? v.kratko : '';
s.bar.setAttribute('data-ton', v ? v.ton : '');
return !!v;
}
function niz(s) {
var ck = s.doc.querySelector('.ck-bar'), hgt = 0;
if (ck && !ck.hidden) hgt = ck.getBoundingClientRect().height;
s.doc.documentElement.style.setProperty('--lip-niz', Math.round(hgt) + 'px');
}
function pokazat(s, da) {
var w = s.doc.defaultView;
niz(s);
var uzko = !!(w.matchMedia && w.matchMedia(UZKO).matches);
var on = !!(da && uzko && !(s.dlg.open) && obnovitStroku(s));
s.bar.classList.toggle('is-on', on);
s.bar.inert = !on;
s.doc.body.classList.toggle('lip-on', on);
}
function snyat() {
var s = sostoyanie;
if (!s) return;
sostoyanie = null;
try { if (s.io) s.io.disconnect(); if (s.ro) s.ro.disconnect(); } catch (e) {}
try { if (s.dlg.open) s.dlg.close(); } catch (e) {}
if (s.bar.parentNode) s.bar.parentNode.removeChild(s.bar);
if (s.dlg.parentNode) s.dlg.parentNode.removeChild(s.dlg);
if (s.mq && s.mq.removeEventListener) s.mq.removeEventListener('change', s.naMq);
s.doc.body.classList.remove('lip-on');
s.doc.documentElement.style.removeProperty('--lip-niz');
}
function mount(report) {
snyat();
var doc = report && report.ownerDocument, w = doc && doc.defaultView;
if (!w || typeof w.IntersectionObserver !== 'function' || typeof w.HTMLDialogElement !== 'function') return false;
var vd = report.querySelector('.ot-vd');
if (!vd || !vyvod(report)) return false;
var bar = el(doc, 'div', 'lip');
bar.setAttribute('role', 'region');
bar.setAttribute('aria-label', ZAG);
bar.inert = true;
var kn = el(doc, 'button', 'lip__b');
kn.type = 'button';
kn.setAttribute('aria-haspopup', 'dialog');
kn.appendChild(el(doc, 'span', 'lip__z', ZAG));
kn.appendChild(el(doc, 'span', 'lip__t'));
var str = el(doc, 'span', 'lip__s');
str.setAttribute('aria-hidden', 'true');
str.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l5-5 5 5"/></svg>';
kn.appendChild(str);
bar.appendChild(kn);
var dlg = el(doc, 'dialog', 'lip-d');
dlg.setAttribute('aria-labelledby', 'lip-d-h');
var h = el(doc, 'h2', 'lip-d__h', ZAG); h.id = 'lip-d-h';
var zakr = el(doc, 'button', 'lip-d__x', 'Закрыть'); zakr.type = 'button';
dlg.appendChild(h); dlg.appendChild(el(doc, 'div', 'lip-d__t')); dlg.appendChild(el(doc, 'div', 'lip-d__act')); dlg.appendChild(zakr);
var s = sostoyanie = { bar: bar, dlg: dlg, report: report, doc: doc, ushel: false };
kn.addEventListener('click', function () {
if (!zapolnitOkno(s)) return;
try { dlg.showModal(); } catch (e) { return; }
pokazat(s, false);
try { if (w.dlkGoal) w.dlkGoal('lipkaya_otkryta'); } catch (e) {}
});
zakr.addEventListener('click', function () { dlg.close(); });
dlg.addEventListener('click', function (e) {
if (e.target !== dlg) return;
var r = dlg.getBoundingClientRect();
if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) dlg.close();
});
dlg.addEventListener('close', function () { if (sostoyanie === s) { pokazat(s, s.ushel); kn.focus({ preventScroll: true }); } });
doc.body.appendChild(bar);
doc.body.appendChild(dlg);
s.io = new w.IntersectionObserver(function (z) {
var e = z[z.length - 1];
s.ushel = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
pokazat(s, s.ushel);
});
s.io.observe(vd);
var ck = doc.querySelector('.ck-bar');
if (ck && typeof w.ResizeObserver === 'function') {
s.ro = new w.ResizeObserver(function () { niz(s); });
s.ro.observe(ck);
}
if (w.matchMedia) {
s.mq = w.matchMedia(UZKO);
s.naMq = function () { pokazat(s, s.ushel); };
if (s.mq.addEventListener) s.mq.addEventListener('change', s.naMq);
}
return true;
}
return { mount: mount, snyat: snyat, vyvod: vyvod, ZAG: ZAG, UZKO: UZKO };
});
;
/* --- /js/svyazi.js --- */
(function (root, factory) {
if (typeof module === 'object' && module.exports) module.exports = factory(null);
else root.Svyazi = factory(root);
})(typeof self !== 'undefined' ? self : this, function (W) {
'use strict';
var d = W && W.document;
var tiho = !W || !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches;
var TON = { ok: 'ok', warn: 'warn', medium: 'warn', high: 'bad', bad: 'bad', critical: 'bad' };
function skl(n, a, b, c) { var m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
function str(v) { return v == null ? '' : String(v).trim(); }
function ton(s) { return (s && TON[s.status]) || 'neutral'; }
function model(r) {
var c = r && r.company;
if (!c || c.kind !== 'LEGAL') return null;
var sec = {};
((r.dossier || {}).sections || []).forEach(function (s) { sec[s.id] = s.rows || []; });
function ryad(id, re) { return (sec[id] || []).filter(function (x) { return x && re.test(str(x[0])) && str(x[1]); }); }
var sig = {}, massRuk = null, massAdr = null;
(r.signals || []).forEach(function (s) {
if (!s) return;
sig[s.id] = s;
if (/^Массовый руководитель/i.test(str(s.title))) massRuk = s;
if (/^Массовый адрес/i.test(str(s.title))) massAdr = s;
});
var uzly = [];
function dob(k, row, pod, s) {
if (!row) return;
uzly.push({ k: k, zag: str(row[0]), znach: str(row[1]), pod: str(pod), ton: s ? ton(s) : 'neutral' });
}
var ruk = (sec.management || []).filter(function (x) { return x && str(x[1]) && !/^(Руководит с|Уставный капитал)/i.test(str(x[0])) && !/учредит|участник|акционер|собственник/i.test(str(x[0])); })[0];
var s1 = ryad('management', /^Руководит с/i)[0];
if (ruk) dob('rukovoditel', ruk, massRuk ? str(massRuk.detail) : s1 ? s1[0] + ' ' + s1[1] : '', massRuk);
ryad('management', /учредит|участник|акционер|собственник/i).slice(0, 6).forEach(function (x) { dob('uchreditel', x, '', null); });
var adr = ryad('profile', /^Юридический адрес/i)[0];
var sa = massAdr || sig.address;
if (adr) dob('adres', adr, sa ? str(sa.detail) : '', sa);
dob('inspekciya', ryad('profile', /^Налоговая инспекция/i)[0], '', null);
dob('vid', ryad('activity', /^Основной вид деятельности/i)[0], '', null);
dob('filialy', ryad('profile', /^Филиалы/i)[0], '', null);
function dm(k) {
var b = (r.damia || {})[k];
return b && /^(polucheno|found|not_found|provereno)$/.test(b.status) && b.dannye && typeof b.dannye === 'object' && !b.iz_egryul ? b : null;
}
function chislo(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
var istD = [], KRATKO = { sudy: 'картотека арбитражных дел', fssp: 'ФССП', kontrakty: 'ЕИС', rnp: 'РНП ЕИС' };
function dmUzel(k, b, n, slova, tn) {
uzly.push({ k: k, zag: str(b.nazvanie), znach: chislo(n) + ' ' + slova, pod: str(b.itog), ton: tn });
var dd = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(b.data_svedeniy));
istD.push(KRATKO[k] + (dd ? ' на ' + dd[3] + '.' + dd[2] + '.' + dd[1] : ''));
}
var su = dm('sudy'), fs = dm('fssp'), kt = dm('kontrakty'), rn = dm('rnp');
if (su && +su.dannye.vsego > 0) dmUzel('sudy', su, +su.dannye.vsego, skl(+su.dannye.vsego, 'дело', 'дела', 'дел') + ' в картотеке', +su.dannye.otvetchik_nezaversheno > 0 ? 'warn' : 'neutral');
if (fs && +fs.dannye.otkryto > 0) dmUzel('fssp', fs, +fs.dannye.otkryto, skl(+fs.dannye.otkryto, 'открытое производство', 'открытых производства', 'открытых производств'), 'warn');
if (kt && +kt.dannye.vsego > 0) dmUzel('kontrakty', kt, +kt.dannye.vsego, skl(+kt.dannye.vsego, 'контракт', 'контракта', 'контрактов'), 'neutral');
if (rn && +rn.dannye.vsego > 0) dmUzel('rnp', rn, +rn.dannye.vsego, skl(+rn.dannye.vsego, 'запись', 'записи', 'записей') + ' в реестре', 'bad');
if (uzly.length < 2) return null;
var ist = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(c.fetched_at || r.checked_at));
return { centr: { zag: str(c.name_short || c.name_full), pod: c.inn ? 'ИНН ' + c.inn : '' }, uzly: uzly,
ist: 'Связи — из сведений этого отчёта: ЕГРЮЛ' + (ist ? ' на ' + ist[3] + '.' + ist[2] + '.' + ist[1] : '') + (istD.length ? ', ' + istD.join(', ') : '') +
'. Другие компании руководителя и учредителей покажем, когда загрузим ЕГРЮЛ целиком: неполную картину за полную не выдаём.' };
}
function cveta(el) {
var cs = W.getComputedStyle(el);
function v(n, z) { return (cs.getPropertyValue(n) || '').trim() || z; }
return { ink: v('--ink', '#1D1D1F'), muted: v('--muted', '#6B6B70'), accent: v('--accent', '#0B63E5'),
soft: v('--accent-soft', '#EAF1FD'), line: v('--line', '#E6E6E1'), surface: v('--surface', '#FFFFFF'),
ok: v('--ok', '#16723F'), warn: v('--warn', '#9A5B00'), bad: v('--bad', '#B3261E'), font: cs.fontFamily || 'sans-serif' };
}
function stroki(cx, t, w) {
var sl = t.split(/\s+/), out = [], cur = '';
for (var i = 0; i < sl.length; i++) {
var p = cur ? cur + ' ' + sl[i] : sl[i];
if (cx.measureText(p).width <= w || !cur) cur = p; else { out.push(cur); cur = sl[i]; if (out.length === 2) break; }
}
if (out.length < 2 && cur) out.push(cur); else if (out.length === 2 && i < sl.length) out[1] += '…';
return out.slice(0, 2);
}
function kadr(cx, m, w, h, phi, C) {
cx.clearRect(0, 0, w, h);
var n = m.uzly.length, lw = Math.min(170, w * 0.3), ox = w / 2, oy = h / 2 + 14, rx = Math.max(24, Math.min(w / 2 - lw - 22, 300)), ry = Math.min(h * 0.34, 120);
var P = m.uzly.map(function (u, i) {
var a = phi + (i + 0.5) * 6.2832 / n, z = Math.cos(a);
return { u: u, x: ox + rx * Math.sin(a), y: oy + ry * z * 0.75, z: z, s: 0.8 + 0.2 * (z + 1) / 2 };
});
P.sort(function (a, b) { return a.z - b.z; });
cx.globalAlpha = 0.25; cx.strokeStyle = C.muted; cx.lineWidth = 1; cx.setLineDash([2, 5]);
cx.beginPath(); cx.ellipse(ox, oy, rx, ry * 0.75, 0, 0, 6.2832); cx.stroke(); cx.setLineDash([]);
cx.lineWidth = 1.5;
P.forEach(function (p) {
cx.globalAlpha = 0.35 + 0.45 * (p.z + 1) / 2;
cx.strokeStyle = p.u.ton === 'neutral' ? C.muted : C[p.u.ton];
cx.beginPath(); cx.moveTo(ox, oy); cx.lineTo(p.x, p.y); cx.stroke();
});
cx.globalAlpha = 1;
cx.fillStyle = C.surface; cx.strokeStyle = C.accent; cx.lineWidth = 2;
cx.beginPath(); cx.arc(ox, oy, 22, 0, 6.2832); cx.fill(); cx.stroke();
cx.textAlign = 'center'; cx.textBaseline = 'top';
cx.font = '600 14px ' + C.font; cx.fillStyle = C.ink;
stroki(cx, m.centr.zag, w - 32)[0] && cx.fillText(stroki(cx, m.centr.zag, w - 32)[0], ox, 10);
P.forEach(function (p) {
var al = 0.45 + 0.55 * (p.z + 1) / 2, lev = p.x < ox - 4, x = p.x + (lev ? -12 : 12) * p.s;
cx.globalAlpha = al;
cx.fillStyle = p.u.ton === 'neutral' ? C.muted : C[p.u.ton];
cx.beginPath(); cx.arc(p.x, p.y, 6 * p.s, 0, 6.2832); cx.fill();
cx.textAlign = lev ? 'right' : 'left'; cx.textBaseline = 'middle';
cx.font = '500 11px ' + C.font; cx.fillStyle = C.muted;
cx.fillText(stroki(cx, p.u.zag, lw)[0], x, p.y - 15);
cx.font = '500 13px ' + C.font; cx.fillStyle = C.ink;
stroki(cx, p.u.znach, lw).forEach(function (t, j) { cx.fillText(t, x, p.y + 1 + j * 15); });
});
cx.globalAlpha = 1;
}
function el(t, c, txt) { var e = d.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
function spisok(m) {
var ul = el('ul', 'svz__sp');
m.uzly.forEach(function (u) {
var li = el('li', 'svz__u svz__u--' + u.ton);
li.appendChild(el('span', 'svz__zag', u.zag));
li.appendChild(el('b', 'svz__zn', u.znach));
if (u.pod) li.appendChild(el('small', 'svz__pod', u.pod));
ul.appendChild(li);
});
return ul;
}
function panel(rep) {
if (rep.dlkSvzPanel) return rep.dlkSvzPanel;
var m = rep.dlkSvz, p = el('div', 'svz'), cv = el('canvas', 'svz__cv'), cx = cv.getContext && cv.getContext('2d');
cv.setAttribute('aria-hidden', 'true');
var kn = el('button', 'svz__kn', 'Показать граф'); kn.type = 'button'; kn.setAttribute('aria-expanded', 'false');
p.appendChild(kn); if (cx) p.appendChild(cv); p.appendChild(spisok(m));
if (m.ist) p.appendChild(el('p', 'svz__ist', m.ist));
if (!cx) kn.hidden = true;
var phi = 0, cel = 0, idet = 0, C = null, w = 0, h = 0;
function razmer() {
var r = cv.getBoundingClientRect(), dpr = Math.min(2, W.devicePixelRatio || 1);
w = Math.round(r.width); h = Math.round(r.height);
if (!w || !h) return false;
cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
return true;
}
function risovat() { if (cx && p.isConnected && (w || razmer())) { C = C || cveta(p); kadr(cx, m, w, h, phi, C); } }
function petlya() {
if (idet) return;
idet = W.requestAnimationFrame(function shag() {
var dl = cel - phi;
phi += dl * 0.12;
if (Math.abs(dl) < 0.002) phi = cel;
risovat();
idet = phi !== cel && p.isConnected ? W.requestAnimationFrame(shag) : 0;
});
}
p.svzPusk = function () {
w = 0; C = null;
if (!razmer()) return;
if (tiho) { phi = cel = 0; risovat(); return; }
phi = -1.5708; cel = 0; petlya();
};
p.svzKadr = risovat;
kn.addEventListener('click', function () {
var on = p.classList.toggle('svz--graf');
kn.setAttribute('aria-expanded', on ? 'true' : 'false');
kn.textContent = on ? 'Скрыть граф' : 'Показать граф';
if (on) p.svzPusk();
});
if (!tiho && W.matchMedia && W.matchMedia('(hover:hover) and (pointer:fine)').matches) {
cv.addEventListener('pointermove', function (e) {
var r = cv.getBoundingClientRect();
cel = ((e.clientX - r.left) / r.width - 0.5) * 0.9; petlya();
}, { passive: true });
cv.addEventListener('pointerleave', function () { cel = 0; petlya(); });
}
W.addEventListener('resize', function () { if (p.isConnected) { w = 0; risovat(); } });
if (W.MutationObserver) new W.MutationObserver(function () { C = null; risovat(); })
.observe(d.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
rep.dlkSvzPanel = p;
return p;
}
return {
model: model,
_kadr: kadr,
zapomnit: function (rep, r) { if (!rep) return; rep.dlkSvz = model(r); rep.dlkSvzPanel = null; },
est: function (f) { var rep = f && f.closest && f.closest('.report'); return !!(rep && rep.dlkSvz); },
pokazat: function (spis, f, zhivo) {
var rep = f.closest('.report'); if (!rep || !rep.dlkSvz) return;
var p = panel(rep);
if (p.parentNode !== spis) spis.appendChild(p);
if (zhivo) p.svzPusk(); else p.svzKadr();
},
ubrat: function (spis) { var p = spis.querySelector(':scope > .svz'); if (p) spis.removeChild(p); }
};
});
;
/* --- /js/nedavnie.js --- */
(function (w) {
'use strict';
var KEY = 'dlk_nedavnie', MAX = 5;
var LVL = { low: 'Без серьёзных сигналов', medium: 'Есть вопросы', high: 'Есть серьёзные сигналы' };
function read() {
try {
var a = JSON.parse(w.localStorage.getItem(KEY) || '[]');
return Array.isArray(a) ? a.filter(function (x) { return x && /^\d{10}(\d{2})?$/.test(x.inn); }) : [];
} catch (e) { return []; }
}
function write(a) { try { w.localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
function add(r) {
if (!r || !/^\d{10}(\d{2})?$/.test(String(r.inn || '')) || /^0+$/.test(r.inn)) return;
var item = {
inn: String(r.inn),
name: String(r.name || '').slice(0, 160),
level: LVL[r.level] ? r.level : '',
id: /^[A-Za-z0-9_-]{8,24}$/.test(r.id || '') ? r.id : '',
t: Date.now()
};
var a = read().filter(function (x) { return x.inn !== item.inn; });
a.unshift(item);
write(a.slice(0, MAX));
}
function kav(t) { return w.DlkImya ? w.DlkImya.kavychki(t) : t; }
function esc(t) {
return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
});
}
function when(t) {
try { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
}
function render(el) {
if (!el) return 0;
var a = read();
if (!a.length) { el.hidden = true; el.innerHTML = ''; return 0; }
el.hidden = false;
el.innerHTML = '<h2 class="ned__h">Недавние проверки на этом устройстве</h2><ul class="ned__list">' +
a.map(function (x) {
var href = x.id ? '/report.html?id=' + encodeURIComponent(x.id) : '/?inn=' + encodeURIComponent(x.inn);
return '<li><a href="' + href + '"><b>' + esc(x.name ? kav(x.name) : ('ИНН ' + x.inn)) + '</b>' +
'<span>ИНН ' + esc(x.inn) + (x.t ? ' · ' + esc(when(x.t)) : '') + '</span></a>' +
(x.level ? '<i class="ned__lvl ned__lvl--' + x.level + '">' + LVL[x.level] + '</i>' : '') + '</li>';
}).join('') + '</ul><button type="button" class="ned__clear">Очистить список</button>';
el.querySelector('.ned__clear').onclick = function () { write([]); render(el); };
return a.length;
}
w.Nedavnie = { add: add, list: read, render: render, KEY: KEY };
})(window);
;
