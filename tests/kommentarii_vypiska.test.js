// «Комментарий команды Делоскопа» в «Кому вы платите» (/kontragenty-iz-vypiski/): раздел vypiska библиотеки
// data/kommentarii.json + js/kommentarii.js (vypiska / vypiskaHtml / estVypiska) + вывод на странице.
// node --test tests/kommentarii_vypiska.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const K = require("../js/kommentarii.js");
const E = require("../kontragenty-iz-vypiski/engine.js");

const KOREN = path.join(__dirname, "..");
const SPRAV = JSON.parse(fs.readFileSync(path.join(KOREN, "data/kommentarii.json"), "utf8"));
const ENGINE = fs.readFileSync(path.join(KOREN, "kontragenty-iz-vypiski/engine.js"), "utf8");
const STR = fs.readFileSync(path.join(KOREN, "kontragenty-iz-vypiski/index.html"), "utf8");
const ZAPRET = /однодневк|надёжн|надежн|гарант|мошенн|прокладк|обнал|лучш|лет опыта|\d+\s*лет\b|искусственн|нейросет|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/i;

// Коды и уровни сигналов движка — прямо из исходника: add('warn', 'key', …) и { level: 'bad', code: 'acc_person' … }
function kodyDvizhka() {
  const out = {};
  const re = /add\('(bad|warn|info)', '([a-z_]+)'|level: '(bad|warn|info)', code: '([a-z_]+)'/g;
  let m;
  while ((m = re.exec(ENGINE))) out[m[2] || m[4]] = m[1] || m[3];
  return out;
}
function utv(t) {
  return Object.assign({ status: "utverzhdeno", proveril: "Право · Юрист 115-ФЗ", data_proverki: "2026-10-04" }, t);
}
function spravS(kod, uroven, ton, norma) {
  return { podpis: "Команда Делоскопа · 115-ФЗ и налоги",
    vypiska: { zapisi: [{ id: "vyp_" + kod, kod, gde: "postavshchik", uroven, poryadok: 1, nazv: "x", norma: norma || "", ton }] } };
}

test("vypiska: каждый код движка есть в библиотеке с тем же уровнем — и лишних записей нет", () => {
  const dv = kodyDvizhka();
  assert.ok(Object.keys(dv).length >= 16, "движок отдаёт ≥ 16 кодов");
  const z = SPRAV.vypiska.zapisi;
  const lib = {};
  z.forEach((x) => { lib[x.kod] = x.uroven; });
  assert.deepStrictEqual(lib, dv);
  assert.strictEqual(new Set(z.map((x) => x.id)).size, z.length, "id уникальны");
  z.forEach((x, i) => {
    assert.strictEqual(x.id, "vyp_" + x.kod);
    assert.strictEqual(x.poryadok, i + 1, x.id);
    assert.ok(["postavshchik", "potok"].includes(x.gde), x.id);
    assert.ok(x.nazv && !ZAPRET.test(x.nazv), x.id);
    assert.ok(x.ton && typeof x.ton === "object", x.id + ": один тон");
    for (const k of ["bank", "nalog", "sdelat"]) if (x.ton[k]) assert.ok(!ZAPRET.test(bezIsklyucheniya(x, k)), x.id + ": " + x.ton[k]);
  });
});

// Одно исключение из ZAPRET — и только дословно: у смены счёта [Право] 21:25 называет приём («частый приём мошенников»:
// письмо о новых реквизитах), а не поставщика. Ярлык о самом поставщике по-прежнему запрещён везде.
const ISKLYUCHENIYA = { "vyp_acc_change.bank": "частый приём мошенников: письмо «о новых реквизитах» от имени поставщика" };
function bezIsklyucheniya(x, k) {
  const fr = ISKLYUCHENIYA[x.id + "." + k];
  return fr ? x.ton[k].split(fr).join("") : x.ton[k];
}

test("vypiska v3: 6 текстов [Право] 21:25 + 9 текстов 22:30 утверждены дословно — роль, дата, норма; bigcash молчит", () => {
  // bigcash не утверждён намеренно: в движке это операции с наличными от 1 млн ₽ — и снятие, и взнос,
  // а текст [Право] 22:30 — только о снятии (правило [Право]: смысл кода другой — запись не ставить, ✎).
  const utv6 = { acc_person: "ст. 54.1 НК РФ", acc_change: "ст. 312 ГК РФ", key: "ст. 54.1 НК РФ",
    oneshot: "письмо ФНС от 10.03.2021 № БВ-4-7/3060@", cash: "", lowtax: "приказ ФНС от 30.05.2007 № ММ-3-06/333@",
    inn_invalid: "", inn_missing: "", acc_many: "ст. 312 ГК РФ", vague: "", round: "", novat: "п. 2 ст. 171 НК РФ",
    persons: "п. 1 ст. 226 НК РФ", cashin: "", self: "" };
  assert.strictEqual(SPRAV.vypiska.zapisi.find((x) => x.kod === "bigcash").ton.status, "zhdet_prava");
  assert.strictEqual(K.vypiska(SPRAV, "inn_invalid").ton, "kras", "уровень bad — красный");
  assert.strictEqual(K.vypiska(SPRAV, "vague").ton, "sery", "уровень info — серый, как в движке");
  // ◐ [Право] 22:30: нормы по наличным, ровным суммам и переводам себе намеренно не ставим (18-МР не сверен)
  for (const kod of ["cashin", "round", "self", "vague"]) {
    const t = SPRAV.vypiska.zapisi.find((x) => x.kod === kod).ton;
    assert.ok(!/18-МР|Банк России|ст\. 6 115/.test(t.bank + t.nalog + t.sdelat), kod);
  }
  const est = SPRAV.vypiska.zapisi.filter((x) => x.ton.status === "utverzhdeno").map((x) => x.kod).sort();
  assert.deepStrictEqual(est, Object.keys(utv6).sort());
  for (const [kod, norma] of Object.entries(utv6)) {
    const k = K.vypiska(SPRAV, kod);
    assert.ok(k, kod);
    assert.strictEqual(k.norma, norma, kod);
    assert.strictEqual(k.data, "02.10.2026");
    assert.ok(k.bank && k.nalog && k.sdelat, kod + ": три фразы");
    assert.ok(!/\u00a0/.test(k.bank + k.nalog + k.sdelat), kod + ": без NBSP — их ставит код");
    const z = SPRAV.vypiska.zapisi.find((x) => x.kod === kod);
    assert.strictEqual(z.ton.proveril, "Право · Юрист 115-ФЗ и Налоговый юрист");
  }
  assert.strictEqual(K.vypiska(SPRAV, "acc_person").ton, "kras");
  assert.strictEqual(K.vypiska(SPRAV, "lowtax").ton, "zhel");
  // ◐ [Право]: порог 0,9 % и 18-МР не сверены — в тексте их нет
  const low = SPRAV.vypiska.zapisi.find((x) => x.kod === "lowtax").ton;
  assert.ok(!/0,9|Банк России|18-МР/.test(low.bank + low.nalog + low.sdelat));
  // исключение ZAPRET — только дословная фраза; вне её слово по-прежнему ловится
  assert.ok(ZAPRET.test("Поставщик — мошенник"));
  assert.ok(!ZAPRET.test(bezIsklyucheniya(SPRAV.vypiska.zapisi.find((x) => x.kod === "acc_change"), "bank")));
  const B = { id: "vyp_acc_change", ton: { bank: "Поставщик похож на мошенников." } };
  assert.ok(ZAPRET.test(bezIsklyucheniya(B, "bank")));
});

test("vypiska: тексты пишет [Право] — пока не утверждены, на странице ничего нет", () => {
  for (const x of SPRAV.vypiska.zapisi) {
    if (x.ton.status !== "utverzhdeno") {
      assert.strictEqual(K.vypiska(SPRAV, x.kod), null, x.kod);
      assert.strictEqual(K.vypiskaHtml(SPRAV, x.kod), "", x.kod);
    } else assert.ok(K.gotov(x.ton), x.kod + ": утверждённый — с ролью, датой, «что сделать», ≤ 300");
  }
  assert.strictEqual(K.vypiskaHtml(null, "key"), "");
  assert.strictEqual(K.vypiskaHtml({ signaly: [] }, "key"), "", "старая библиотека без vypiska — пусто");
  assert.strictEqual(K.vypiskaHtml(SPRAV, "neizvestnyj"), "");
});

test("vypiska: утверждённый текст — свёрнут, тон по уровню сигнала, экранирование, норма и дата", () => {
  const S = spravS("acc_person", "bad", utv({ bank: "Банк <видит> счёт", nalog: "", sdelat: "Позвоните поставщику.", norma: "ст. 864 ГК РФ" }));
  const h = K.vypiskaHtml(S, "acc_person");
  assert.match(h, /^<details class="kom kom--kras" data-kom="vyp_acc_person">/);
  assert.match(h, /<summary class="kom__h">Комментарий команды Делоскопа<\/summary>/);
  assert.ok(/Банк &lt;видит&gt; счёт/.test(h), "экранирование");
  assert.ok(!/Налоговая:/.test(h), "пустая фраза не выводится");
  assert.ok(/ст\. 864 ГК РФ · нормы сверены 04\.10\.2026/.test(h));
  assert.strictEqual(K.vypiska(spravS("key", "warn", utv({ bank: "a", sdelat: "b" })), "key").ton, "zhel");
  assert.strictEqual(K.vypiska(spravS("vague", "info", utv({ bank: "a", sdelat: "b" })), "vague").ton, "sery", "справка — не «норма»");
  assert.ok(K.estVypiska(S));
  assert.ok(!K.estVypiska(SPRAV) || SPRAV.vypiska.zapisi.some((x) => x.ton.status === "utverzhdeno"));
});

test("vypiska: ворота те же — без роли, даты, «что сделать» или длиннее 300 знаков не показываем", () => {
  const bez = (t) => K.vypiskaHtml(spravS("key", "warn", t), "key");
  assert.strictEqual(bez(utv({ bank: "a", sdelat: "" })), "");
  assert.strictEqual(bez(utv({ bank: "a", sdelat: "b", proveril: null })), "");
  assert.strictEqual(bez(utv({ bank: "a", sdelat: "b", data_proverki: "скоро" })), "");
  assert.strictEqual(bez(Object.assign(utv({ bank: "a", sdelat: "b" }), { status: "chernovik" })), "");
  assert.strictEqual(bez(utv({ bank: "я".repeat(299), sdelat: "bb" })), "");
  assert.strictEqual(K.vypiskaHtml(spravS("key", "nevedomyj", utv({ bank: "a", sdelat: "b" })), "key"), "", "неизвестный уровень");
});

test("движок: пример выписки со страницы — у каждого сигнала есть code, и он есть в библиотеке", () => {
  const i = STR.indexOf("var me='40702810900000000001';"), j = STR.indexOf("'КонецФайла'].join('\\n');");
  assert.ok(i > 0 && j > i, "пример выписки на странице");
  const t = new Function(STR.slice(i, j + "'КонецФайла'].join('\\n');".length) + "\nreturn t;")();
  const r = E.analyze([E.parse(t)], { regime: "osn" });
  const vse = [].concat(...r.suppliers.map((s) => s.signals), r.flows);
  assert.ok(vse.length >= 5, "на примере есть сигналы: " + vse.length);
  const lib = new Set(SPRAV.vypiska.zapisi.map((x) => x.kod));
  for (const x of vse) assert.ok(x.code && lib.has(x.code), "код в библиотеке: " + x.code);
  // с утверждённым текстом для всех кодов — комментарий выходит под каждым сигналом примера
  const S = { podpis: "Команда Делоскопа", vypiska: { zapisi: SPRAV.vypiska.zapisi.map((x) => Object.assign({}, x, { ton: utv({ bank: "a", sdelat: "b" }) })) } };
  for (const x of vse) assert.match(K.vypiskaHtml(S, x.code), new RegExp('data-kom="vyp_' + x.code + '"'));
});

test("страница: модуль подключён до движка, комментарий — после сигнала поставщика и внутри строки потока, оговорка один раз", () => {
  const iK = STR.indexOf('<script src="/js/kommentarii.js"></script>');
  const iE = STR.indexOf('<script src="/kontragenty-iz-vypiski/engine.js"></script>');
  assert.ok(iK > 0 && iK < iE, "kommentarii.js — перед engine.js, без defer");
  assert.ok(/K\.zagruzit\(\)\.then\(function\(s\)\{state\.kom=s;if\(state\.res&&K\.estVypiska\(s\)\)render\(\)\}\)/.test(STR), "перерисовка — только если есть утверждённый текст");
  assert.ok(/'<\/div>'\+kom\(x\.code\)\}\)\.join\(''\)/.test(STR), "под сигналом поставщика");
  assert.ok(/\+kom\(f\.code\)\+'<\/div>'/.test(STR), "внутри строки «Что видит банк»");
  assert.ok(/var og=K&&\/class="kom \/\.test\(flows\+sup\)\?K\.ogovorkaHtml\(\):''/.test(STR), "оговорка [Право] — только если есть комментарий");
  assert.ok(/\+flows\+sup\+og\+/.test(STR));
  assert.ok(/\.kom summary\{cursor:pointer/.test(STR) && /@media print\{\.kom\{background:none;break-inside:avoid\}\}/.test(STR));
  assert.ok(!/\u00a0/.test(fs.readFileSync(path.join(KOREN, "js/kommentarii.js"), "utf8")), "без NBSP в исходнике модуля");
});

test("страница: удалённые причины API (без кода) комментария не получают — тон у них не известен", () => {
  assert.strictEqual(K.vypiskaHtml(spravS("key", "warn", utv({ bank: "a", sdelat: "b" })), undefined), "");
  assert.ok(/function kom\(code\)\{return K&&state\.kom&&code\?K\.vypiskaHtml\(state\.kom,code,klient\(\)\):''\}/.test(STR));
  assert.ok(/rr\.map\(function\(x\)\{return '<div class="sig '\+x\.level\+'">'\+esc\(x\.text\)\+'<\/div>'\}\)/.test(STR), "причины API — без kom()");
});

test("vypiska persons: строка о чеке самозанятого — только клиенту-организации ([Право · Налоговый юрист] 02.10 23:20)", () => {
  const z = SPRAV.vypiska.zapisi.find((x) => x.kod === "persons");
  const o = z.ton.dlya_organizacii;
  assert.strictEqual(o.tekst, "Платите самозанятому — берите чек из «Мой налог» на каждую оплату. Без чека компания не учтёт расход по налогу на прибыль (ч. 8 ст. 15 422-ФЗ).");
  assert.strictEqual(o.norma, "ч. 8 ст. 15 422-ФЗ");
  assert.ok(o.tekst.length <= K.MAKS && !ZAPRET.test(o.tekst) && !/ /.test(o.tekst));
  const org = K.vypiska(SPRAV, "persons", "org");
  assert.strictEqual(org.org, o.tekst);
  assert.strictEqual(org.norma, "п. 1 ст. 226 НК РФ; ч. 8 ст. 15 422-ФЗ");
  const h = K.vypiskaHtml(SPRAV, "persons", "org");
  assert.ok(/Компании:<\/span> Платите самозанятому/.test(h));
  assert.ok(/226 НК РФ; ч\. 8 ст\. 15 422-ФЗ · нормы сверены 02\.10\.2026/.test(h));
  // ◐ для ИП норма не сверена — ни строки, ни ссылки; неизвестный ИНН — тоже молчим
  for (const kl of ["ip", "", undefined]) {
    const k = K.vypiska(SPRAV, "persons", kl);
    assert.strictEqual(k.org, "", String(kl));
    assert.strictEqual(k.norma, "п. 1 ст. 226 НК РФ", String(kl));
    assert.ok(!/422-ФЗ|Компании:/.test(K.vypiskaHtml(SPRAV, "persons", kl)), String(kl));
  }
  // у других кодов строки нет и для организации
  assert.strictEqual(K.vypiska(SPRAV, "self", "org").org, "");
  // без роли или даты строка не выходит
  const S = spravS("persons", "warn", utv({ bank: "a", sdelat: "b", dlya_organizacii: { tekst: "x", norma: "n" } }));
  assert.strictEqual(K.vypiska(S, "persons", "org").org, "");
  // страница передаёт тип клиента по ИНН выписки
  assert.ok(/i\.length===10\?'org':i\.length===12\?'ip':''/.test(STR));
  assert.ok(/K\.vypiskaHtml\(state\.kom,code,klient\(\)\)/.test(STR));
});
