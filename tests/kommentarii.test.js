// «Комментарий команды Делоскопа»: библиотека data/kommentarii.json + js/kommentarii.js + вывод в report.html.
// node --test tests/kommentarii.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const K = require("../js/kommentarii.js");

const KOREN = path.join(__dirname, "..");
const SPRAV = JSON.parse(fs.readFileSync(path.join(KOREN, "data/kommentarii.json"), "utf8"));
const ZAPRET = /однодневк|надёжн|надежн|гарант|мошенн|прокладк|обнал|лучш|лет опыта|\d+\s*лет\b|искусственн|нейросет|(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/i;
const STATUSY = new Set(["zhdet_prava", "chernovik", "utverzhdeno"]);

// Заголовки строк светофора, которые отдаёт живой /api/check (из ответов 01–02.10 и фикстур тестов) → ожидаемый id
const ZHIVYE = {
  "Статус": "status",
  "Возраст компании": "vozrast",
  "Адрес": "adres",
  "Недостоверность адреса или руководителя": "nedostovernost",
  "Недостоверность сведений о руководителе": "nedostovernost",
  "Руководитель": "rukovodstvo",
  "Руководство и собственники": "rukovodstvo",
  "Дисквалификация руководителя": "diskval",
  "Руководитель дисквалифицирован": "diskval",
  "Задолженность по налогам": "nedoimka",
  "Долги по налогам": "nedoimka",
  "Недоимка по взносам": "nedoimka",
  "Уплаченные налоги и взносы": "nalogi",
  "Среднесписочная численность": "shtat",
  "Доходы и расходы": "otchetnost",
  "ФССП": "fssp",
  "Исполнительные производства": "fssp",
  "Суды (арбитраж)": "arbitrazh",
  "Перечень Росфинмониторинга": "stoplisty",
};

function utv(t) {
  return Object.assign({ status: "utverzhdeno", proveril: "[Право · Юрист 115-ФЗ]", data_proverki: "2026-10-04" }, t);
}
function spravS(tony) {
  return { podpis: "Команда Делоскопа · 115-ФЗ и налоги", signaly: [{ id: "fssp", re: "пристав|фссп|исполнительн", norma: "229-ФЗ", tony }] };
}

test("библиотека: id уникальны, порядок 1…N, регулярки компилируются, три тона", () => {
  const s = SPRAV.signaly;
  assert.ok(s.length >= 20, "первые 20 сигналов");
  assert.strictEqual(new Set(s.map((x) => x.id)).size, s.length);
  s.forEach((x, i) => {
    assert.strictEqual(x.poryadok, i + 1, x.id);
    assert.match(x.id, /^[a-z_]+$/);
    assert.ok(x.nazv && x.norma, x.id);
    for (const r of [x.re, x.uslovie].filter(Boolean)) {
      assert.doesNotThrow(() => new RegExp(r, "i"), x.id);
      assert.ok(!/\\b/.test(r), "без \\b — в JS не работает с кириллицей: " + x.id);
    }
    if (x.kak) {
      const c = s.find((y) => y.id === x.kak);
      assert.ok(c && !c.kak && c.tony, x.id + ": kak ведёт на запись с текстами");
      assert.ok(!x.tony, x.id + ": у записи kak своих текстов нет");
    } else assert.deepStrictEqual(Object.keys(x.tony).sort(), ["kras", "zel", "zhel"]);
  });
  assert.ok(SPRAV.podpis && !/\d+\s*(лет|год)/i.test(SPRAV.podpis), "подпись без стажа числом");
});

test("библиотека: тексты — без запрещённых слов, ≤ 300 знаков; утверждённый — с ролью и датой", () => {
  for (const x of SPRAV.signaly) for (const [ton, t] of Object.entries(x.tony || {})) {
    const gde = x.id + "/" + ton;
    assert.ok(STATUSY.has(t.status), gde);
    for (const k of ["bank", "nalog", "sdelat"]) if (t[k]) assert.ok(!ZAPRET.test(t[k]), gde + ": запрещённое слово — " + t[k]);
    assert.ok(K.dlina(t) <= K.MAKS, gde + ": больше 300 знаков");
    if (t.status === "utverzhdeno") {
      assert.ok(K.gotov(t), gde + ": утверждён, но не готов (роль, дата ГГГГ-ММ-ДД, «что сделать»)");
      assert.ok(!/[А-ЯЁ][а-яё]+ [А-ЯЁ]\.\s?[А-ЯЁ]\./.test(t.proveril), gde + ": роль, не ФИО");
    }
  }
});

test("живые заголовки светофора находят свою запись", () => {
  for (const [title, id] of Object.entries(ZHIVYE)) {
    const z = K.zapis(SPRAV, { title });
    assert.ok(z, "нет записи: " + title);
    assert.strictEqual(z.id, id, title);
  }
  assert.strictEqual(K.zapis(SPRAV, { title: "" }), null);
});

test("без утверждённых текстов — ничего не показываем", () => {
  for (const title of Object.keys(ZHIVYE)) for (const status of ["ok", "warn", "bad"])
    if (SPRAV.signaly.every((x) => Object.values(x.tony || {}).every((t) => t.status !== "utverzhdeno")))
      assert.strictEqual(K.najti(SPRAV, { title, status }), null);
  const S = spravS({ zel: { status: "chernovik", sdelat: "x", bank: "y" }, zhel: utv({ bank: "б", sdelat: "с" }), kras: utv({ bank: "б" }) });
  assert.strictEqual(K.najti(S, { title: "ФССП", status: "ok" }), null, "черновик");
  assert.strictEqual(K.najti(S, { title: "ФССП", status: "bad" }), null, "без «что сделать»");
  assert.strictEqual(K.najti(S, { title: "ФССП", status: "?" }), null, "неизвестный тон");
  assert.strictEqual(K.najti(spravS({ zhel: utv({ bank: "б", sdelat: "с", proveril: "" }) }), { title: "ФССП", status: "warn" }), null, "без роли");
  assert.strictEqual(K.najti(spravS({ zhel: utv({ bank: "б", sdelat: "с", data_proverki: "04.10" }) }), { title: "ФССП", status: "warn" }), null, "дата не ГГГГ-ММ-ДД");
  assert.strictEqual(K.najti(spravS({ zhel: utv({ bank: "б".repeat(290), sdelat: "с".repeat(20) }) }), { title: "ФССП", status: "warn" }), null, "> 300 знаков");
});

test("утверждённый тон: тон по статусу строки, подпись, норма, дата, экранирование", () => {
  const S = spravS({ zhel: utv({ bank: "Банк <b>видит</b> долг", nalog: "", sdelat: "Возьмите справку" }) });
  const k = K.najti(S, { title: "Исполнительные производства", status: "warn" });
  assert.deepStrictEqual([k.id, k.ton, k.data, k.norma], ["fssp", "zhel", "04.10.2026", "229-ФЗ"]);
  const h = K.html(k);
  assert.match(h, /Комментарий команды Делоскопа/);
  assert.match(h, /Команда Делоскопа · 115-ФЗ и налоги · 229-ФЗ · нормы сверены 04\.10\.2026/);
  assert.ok(!/проверено/.test(h), "[Право] 02.10: «проверено» читается как «мы проверили компанию»");
  assert.match(h, /&lt;b&gt;видит&lt;\/b&gt;/);
  assert.ok(!/Налоговая:/.test(h), "пустая фраза не выводится");
  assert.strictEqual(K.html(null), "");
});

test("vstavit: строка под своим признаком, один раз", () => {
  const S = spravS({ zhel: utv({ bank: "б", sdelat: "с" }) });
  const sozdano = [];
  const doc = { createElement: () => { const e = { className: "", innerHTML: "" }; sozdano.push(e); return e; } };
  const tr = { ownerDocument: doc, nextSibling: null, parentNode: { insertBefore: (n, ref) => { tr.nextSibling = n; } } };
  const tab = { querySelector: (q) => (q === 'tr[data-sig="1"]' ? tr : null) };
  const sig = [{ title: "Возраст компании", status: "ok" }, { title: "ФССП", status: "warn" }];
  assert.strictEqual(K.vstavit(tab, sig, S), 1);
  assert.strictEqual(tr.nextSibling.className, "kom-tr");
  assert.match(tr.nextSibling.innerHTML, /data-kom="fssp"/);
  assert.strictEqual(K.vstavit(tab, sig, S), 0, "повторно не вставляет");
  assert.strictEqual(K.vstavit(tab, sig, null), 0);
});

test("report.html: модуль подключён, строки светофора с номером, вызов после отрисовки", () => {
  const h = fs.readFileSync(path.join(KOREN, "report.html"), "utf8");
  assert.match(h, /<script src="\/js\/kommentarii\.js"><\/script>/);
  assert.match(h, /<tr data-sig="'\+i\+'">/);
  assert.match(h, /Kommentarii\.zagruzit\(\)\.then/);
  assert.ok(!/15 лет|лучший/i.test(h));
});

// kommentarii-v2 (02.10): первые 22 текста [Право] (claude/Право_ответы_✎_02.10_комментарии_команды.md, разд. 3)
// + деталь строки (uslovie) и общие тексты (kak). Неясная строка — без комментария.
const NA_ZHIVOM = [
  // [заголовок, деталь, статус] → [id записи с текстами, тон] или null
  [["Недостоверность адреса или руководителя", "отметок нет", "ok"], ["nedostovernost", "zel"]],
  [["Недостоверность адреса или руководителя", "есть отметка о недостоверности адреса", "bad"], ["nedostovernost", "kras"]],
  [["Адрес", "сведения недостоверны (отметка ФНС)", "bad"], ["nedostovernost", "kras"]],
  [["Адрес", "массовый адрес: 54 компании", "warn"], ["massovyj_adres", "zhel"]],
  [["Адрес", "Москва", "ok"], null],
  [["Массовый руководитель", "12 компаний", "warn"], ["massovyj_rukovoditel", "zhel"]],
  [["Массовый адрес или руководитель", "да", "warn"], null],
  [["Долги по налогам", "нет", "ok"], ["nedoimka", "zel"]],
  [["Задолженность по налогам", "1,2 млн ₽", "bad"], ["nedoimka", "kras"]],
  [["Приостановление операций по счетам", "2 решения", "bad"], ["blokirovka", "kras"]],
  [["ФССП", "3 производства на 410 000 ₽", "warn"], ["fssp", "zhel"]],
  [["Статус", "Банкротство", "bad"], ["bankrotstvo", "kras"]],
  [["Статус", "Ликвидирована", "bad"], ["likvidaciya", "kras"]],
  [["Статус", "Исключение из ЕГРЮЛ (недействующая)", "bad"], ["isklyuchenie", "kras"]],
  [["Статус", "Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ", "bad"], null],
  // status-kody-v1: 108 и 110 — тексты [Право] 04.10 23:07 (kommentarii-108-110-v1), проверка — тест «v6» ниже.
  [["ФНС готовит исключение из ЕГРЮЛ — компания недействующая", "Если компания вам должна — заявление в налоговую в течение 3 месяцев со дня публикации.", "bad"], ["isklyuchenie", "kras"]],
  [["ФНС готовит исключение из ЕГРЮЛ — ликвидация невозможна", "", "bad"], ["isklyuchenie", "kras"]],
  [["ФНС готовит исключение из ЕГРЮЛ — из-за недостоверных сведений", "", "bad"], ["isklyuchenie", "kras"]],
  [["Статус", "ФНС готовит исключение из ЕГРЮЛ — из-за недостоверных сведений", "bad"], ["isklyuchenie", "kras"]],
  // kommentarii-isklyucheno-v1 ([Ночные запуски] 03.10 13:40): 407/414/415/418/420 — «Компания исключена из ЕГРЮЛ» (уже исключена) —
  // не текст «на пути к исключению … заберите долг до исключения»; свой текст — запись isklyuchena (тест ниже, kommentarii-isklyuchena-v2).
  [["Статус", "Исключение из ЕГРЮЛ (недействующая)", "bad"], ["isklyuchenie", "kras"]],
  [["Статус", "Действует", "ok"], null],
  [["Возраст компании", "8 месяцев", "warn"], ["molodaya", "zhel"]],
  [["Возраст компании", "1 год 8 месяцев", "warn"], null],
  [["Среднесписочная численность", "0 человек за 2025 год", "warn"], ["net_sotrudnikov", "zhel"]],
  [["Среднесписочная численность", "14 человек за 2025 год", "warn"], null],
  [["Доходы и расходы", "убыток 3,1 млн ₽ за 2025 год", "warn"], ["ubytok", "zhel"]],
  [["Доходы и расходы", "отчётность за 2025 год не сдана", "warn"], ["net_otchetnosti", "zhel"]],
  [["Доходы и расходы", "отчётность не раскрыта", "warn"], null],
  [["Низкая налоговая нагрузка", "0,4 % при норме 2,1 %", "warn"], ["nagruzka", "zhel"]],
  [["Прогноз ЗСК (наша оценка): высокий уровень риска", "", "bad"], null],
  [["Красная группа ЗСК Банка России", "", "bad"], ["zsk", "kras"]],
  [["Дисквалификация руководителя", "да", "bad"], ["diskval", "kras"]],
];

test("v2: живые строки → свой текст [Право]; неясные — без комментария", () => {
  for (const [[title, detail, status], ozh] of NA_ZHIVOM) {
    const k = K.najti(SPRAV, { title, detail, status });
    const gde = title + " · " + detail + " · " + status;
    if (!ozh) { assert.strictEqual(k, null, gde); continue; }
    const id = ozh[0];
    assert.ok(k, "нет комментария: " + gde);
    assert.deepStrictEqual([k.id, k.ton], [id, ozh[1]], gde);
    assert.strictEqual(k.data, "02.10.2026");
    assert.ok(k.bank && k.nalog && k.sdelat, gde);
  }
});

test("v2+v4+v5: 28 тонов утверждены (22 + 5 зелёных [Право] 08:20 + дисквалификация «Внимание» 21:25) — роль, дата, без ФИО и NBSP", () => {
  let n = 0;
  for (const x of SPRAV.signaly) for (const t of Object.values(x.tony || {})) if (t.status === "utverzhdeno") {
    n++;
    assert.ok(!/\u00a0/.test(t.bank + t.nalog + t.sdelat));
    if (["isklyuchenie_cb", "isklyuchenie_uchastniki", "reorganizaciya"].includes(x.id)) { // kommentarii-108-110-v1: [Право] 04.10 23:07 разд. 1
      assert.strictEqual(t.proveril, "Право · Юрист 115-ФЗ и Налоговый юрист");
      assert.strictEqual(t.data_proverki, "2026-10-04");
      continue;
    }
    if (x.id === "isklyuchena") { // kommentarii-isklyuchena-v2: [Право] 03.10 14:30 разд. 1 (3) + 16:07 разд. 2 и 3; v3 — «Что сделать» 04.10 07:07 разд. 1
      assert.strictEqual(t.proveril, "Право · Юрист 115-ФЗ и Налоговый юрист");
      assert.strictEqual(t.data_proverki, "2026-10-04");
      continue;
    }
    if (x.id === "kapital" || x.id === "likvidnost") { // kom-kapital-v1: [Право · Юрист 115-ФЗ] 03.10 07:07, разд. 5
      assert.strictEqual(t.proveril, "Право · Юрист 115-ФЗ");
      assert.strictEqual(t.data_proverki, "2026-10-03");
      continue;
    }
    assert.strictEqual(t.proveril, "Право · Юрист 115-ФЗ и Налоговый юрист");
    assert.strictEqual(t.data_proverki, "2026-10-02");
  }
  assert.strictEqual(n, 34); // +3 kommentarii-108-110-v1 (108, 110, реорганизация)
});

test("v5: uslovie у тона — «Внимание» у дисквалификации только при совпадении по ФИО без ИНН ([Право] 21:25)", () => {
  const fio = K.najti(SPRAV, { title: "Дисквалификация руководителя", detail: "совпадение по ФИО, без ИНН", status: "warn" });
  assert.ok(fio, "совпадение по ФИО — комментарий есть");
  assert.deepStrictEqual([fio.id, fio.ton], ["diskval", "zhel"]);
  assert.match(fio.bank, /только по ФИО/);
  assert.strictEqual(fio.norma, "ст. 3.11 КоАП РФ");
  assert.strictEqual(K.najti(SPRAV, { title: "Дисквалификация руководителя", detail: "проверка не завершена", status: "warn" }), null,
    "«Внимание» по другой причине — молчим: текст о ФИО к ней не подходит");
  assert.strictEqual(K.najti(SPRAV, { title: "Дисквалификация руководителя", detail: "", status: "warn" }), null);
  assert.strictEqual(K.najti(SPRAV, { title: "Дисквалификация руководителя", detail: "однофамилец в реестре", status: "warn" }).ton, "zhel");
  // красный и зелёный тоны uslovie не задевает
  assert.strictEqual(K.najti(SPRAV, { title: "Дисквалификация руководителя", detail: "в реестре", status: "bad" }).ton, "kras");
  // битое выражение — тон не показываем
  const S = JSON.parse(JSON.stringify(SPRAV));
  S.signaly.find((x) => x.id === "diskval").tony.zhel.uslovie = "(";
  assert.strictEqual(K.najti(S, { title: "Дисквалификация руководителя", detail: "ФИО", status: "warn" }), null);
});

// ── Паспорт контрагента (kommentarii-pasport-v1): комментарий под строкой признака, вне отпечатка SHA-256 ──
const P = require("../js/pasport-kontragenta.js");
const E = require("../pasport/engine.js");
const U = require("../js/usloviya.js");
function obrazec() { const r = JSON.parse(JSON.stringify(E.DEMO)); r.checked_at = "2026-10-02T08:00:00Z"; return r; }

test("Паспорт: образец — комментарии под массовым адресом, недостоверностью и долгами по налогам", () => {
  const r = obrazec(), p = P.sobrat(r, { usloviya: U });
  const sp = K.dlyaFaktov(p.razdely, r.signals, SPRAV);
  const po = Object.fromEntries(sp.map((v) => [v.f, v.k.id + ":" + v.k.ton]));
  const gde = (id, t) => id + ":" + p.razdely.find((x) => x.id === id).fakty.findIndex((f) => f.tekst === t);
  assert.strictEqual(po[gde("svyazi", "Массовый адрес")], "massovyj_adres:zhel");
  assert.strictEqual(po[gde("rekvizity", "Недостоверность адреса или руководителя")], "nedostovernost:zel");
  assert.strictEqual(po[gde("nalogi", "Долги по налогам")], "nedoimka:zel");
  assert.strictEqual(sp.length, 3);
});

test("Паспорт: без библиотеки, в служебных и расчётных разделах и у строк ЕГРЮЛ — комментариев нет", () => {
  const r = obrazec(), p = P.sobrat(r, { usloviya: U, summa: 500000 });
  assert.deepStrictEqual(K.dlyaFaktov(p.razdely, r.signals, null), []);
  for (const v of K.dlyaFaktov(p.razdely, r.signals, SPRAV)) {
    assert.ok(!/^(predel|zaprosit|ne_znaem|podlinnost|indeks):/.test(v.f), v.f);
    const [id, i] = v.f.split(":");
    const f = p.razdely.find((x) => x.id === id).fakty[+i];
    assert.ok(r.signals.some((s) => s.title === f.tekst), "строка не из признаков: " + f.tekst);
  }
});

test("Паспорт: признак берётся один раз — две строки с одним заголовком не получают чужой тон", () => {
  const razdely = [{ id: "svyazi", vid: "istochnik", fakty: [
    { tekst: "Массовый адрес", ton: "warn" }, { tekst: "Массовый адрес", ton: "warn" }] }];
  const sp = K.dlyaFaktov(razdely, [{ title: "Массовый адрес", status: "warn", detail: "11 компаний" }], SPRAV);
  assert.deepStrictEqual(sp.map((v) => v.f), ["svyazi:0"]);
  const tonRazny = K.dlyaFaktov(razdely, [{ title: "Массовый адрес", status: "ok", detail: "" }], SPRAV);
  assert.deepStrictEqual(tonRazny, []);
});

test("Паспорт: отпечаток SHA-256 не зависит от комментариев (вставка — в страницу, не в сведения)", async () => {
  const r = obrazec(), p1 = P.sobrat(r, { usloviya: U }), p2 = P.sobrat(obrazec(), { usloviya: U });
  K.dlyaFaktov(p1.razdely, r.signals, SPRAV);
  if (!(globalThis.crypto && crypto.subtle)) return;
  assert.strictEqual(await P.otpechatok(p1), await P.otpechatok(p2));
});

test("Паспорт: страница подключает библиотеку, помечает строки data-f и вставляет блок после выпуска", () => {
  const h = fs.readFileSync(path.join(KOREN, "pasport/kontragent/index.html"), "utf8");
  assert.ok(h.includes('<script src="/js/kommentarii.js"></script>'));
  assert.ok(h.includes(`data-f="'+esc(x.id)+':'+i+'"`));
  assert.ok(/Kommentarii\.vstavitFakty\(pk,Kommentarii\.dlyaFaktov\(p\.razdely,r\.signals,K\)\)/.test(h));
  assert.ok(/\.kom--zhel\{border-left-color:var\(--warn\)\}/.test(h));
  assert.ok(/@media print\{\n\s+\.kom\{background:none;break-inside:avoid\}/.test(h));
});

test("Паспорт: vstavitFakty — строка после tr[data-f], повторно не вставляет", () => {
  const sozdano = [];
  function uzel(cls) { return { className: cls || "", nextSibling: null }; }
  const tr = uzel("warn");
  const tbody = { insertBefore(n, ref) { sozdano.push(n); tr.nextSibling = n; } };
  tr.parentNode = tbody; tr.ownerDocument = { createElement: () => uzel() };
  const koren = { querySelector: (sel) => (sel === 'tr[data-f="svyazi:0"]' ? tr : null) };
  const k = K.najti(SPRAV, { title: "Массовый адрес", status: "warn", detail: "" });
  const sp = [{ f: "svyazi:0", k }, { f: "nalogi:9", k }];
  assert.strictEqual(K.vstavitFakty(koren, sp), 1);
  assert.strictEqual(sozdano[0].className, "kom-tr");
  assert.ok(sozdano[0].innerHTML.includes("Комментарий команды Делоскопа"));
  assert.strictEqual(K.vstavitFakty(koren, sp), 0);
});

// ---- v3: экран проверки (существенные факты) + оговорка [Право] 02.10 11:15 ----
const SU = require("../js/sushchestvennoe.js");

test("оговорка [Право] 02.10 — дословно, без запрещённых слов", () => {
  assert.strictEqual(K.OGOVORKA, "Комментарий команды — общий: он объясняет, как банки и налоговая смотрят на такой признак. Это не оценка этой компании или сделки и не юридическая консультация.");
  assert.ok(!ZAPRET.test(K.OGOVORKA));
  assert.ok(!/\u00a0/.test(fs.readFileSync(path.join(KOREN, "js/kommentarii.js"), "utf8")), "без NBSP в исходнике");
});

test("экран проверки: dlyaSut — комментарии к существенным фактам образца, только при совпадении тона", () => {
  const r = obrazec(), f = SU.fakty(r, { segodnya: new Date("2026-10-02T09:00:00Z") });
  const sp = K.dlyaSut(f.spisok, r.signals, SPRAV);
  assert.ok(sp.length >= 1, "хотя бы один комментарий на образце");
  for (const v of sp) {
    const fakt = f.spisok.find((x) => x.k === v.k);
    assert.ok(fakt, "комментарий только к показанному факту: " + v.k);
    assert.ok(["ok", "warn", "bad"].includes(fakt.ton));
    if (v.k === "kapital" || v.k === "likvidnost") continue; // свои факты экрана — без строки светофора (kom-kapital-v1)
    assert.strictEqual(K.TON[r.signals.find((s, j) => (s.id || "sig" + j) === v.k).status], v.kom.ton);
  }
  assert.deepStrictEqual(K.dlyaSut(f.spisok, r.signals, null), []);
  assert.ok(!sp.some((v) => v.k === "otchetnost"), "у выручки из ГИР БО (не строка светофора) комментария нет");
});

test("экран проверки: налоги «не проверяли» (нейтральный тон) — без зелёного комментария", () => {
  const sig = [{ id: "tax_debt", title: "Долги по налогам", status: "ok", detail: "Нет" }];
  assert.strictEqual(K.dlyaSut([{ k: "tax_debt", ton: "neutral" }], sig, SPRAV).length, 0);
  const s2 = K.dlyaSut([{ k: "tax_debt", ton: "ok" }], sig, SPRAV);
  assert.deepStrictEqual(s2.map((v) => v.kom.id + ":" + v.kom.ton), ["nedoimka:zel"]);
});

function dom() {
  // мини-DOM: контейнер со строками .sut__r[data-fakt]
  function uzel(cls, attrs) { return { className: cls || "", attrs: attrs || {}, nextSibling: null, parentNode: null, textContent: "" }; }
  const deti = [];
  const doc = {
    _sozdano: [], head: { appendChild(x) { doc._stil = x; } }, getElementById: (id) => (id === "kom-css" && doc._stil ? doc._stil : null),
    createElement(teg) {
      const e = uzel(); e.tagName = teg.toUpperCase();
      Object.defineProperty(e, "innerHTML", { set(h) { const m = /^<div class="([^"]+)"/.exec(h); e.firstChild = m ? Object.assign(uzel(m[1]), { html: h, ownerDocument: doc }) : null; } });
      doc._sozdano.push(e); return e;
    },
  };
  const koren = {
    ownerDocument: doc,
    insertBefore(n, ref) { const i = ref ? deti.indexOf(ref) : deti.length; deti.splice(i, 0, n); n.parentNode = koren; perelink(); },
    querySelectorAll: (sel) => (sel === ".sut__r" ? deti.filter((d) => d.className === "row sut__r") : []),
    querySelector(sel) {
      if (sel === ".kom-og") return deti.find((d) => d.className === "kom-og") || null;
      const m = /data-fakt="([^"]+)"/.exec(sel);
      return m ? deti.find((d) => d.attrs.fakt === m[1]) || null : null;
    },
  };
  function perelink() { deti.forEach((d, i) => { d.nextSibling = deti[i + 1] || null; d.parentNode = koren; d.ownerDocument = doc; }); }
  ["status", "address", "tax_debt", "diskv"].forEach((k) => deti.push(uzel("row sut__r", { fakt: k })));
  perelink();
  return { koren, deti, doc };
}

test("экран проверки: vstavitSut — комментарий под фактом, оговорка один раз под списком фактов, повторно не вставляет", () => {
  const { koren, deti, doc } = dom();
  const k1 = K.najti(SPRAV, { title: "Массовый адрес", status: "warn", detail: "" });
  const k2 = K.najti(SPRAV, { title: "Долги по налогам", status: "ok", detail: "Нет" });
  const sp = [{ k: "address", kom: k1 }, { k: "tax_debt", kom: k2 }, { k: "net_takogo", kom: k2 }];
  assert.strictEqual(K.vstavitSut(koren, sp), 2);
  const kl = deti.map((d) => d.className);
  assert.deepStrictEqual(kl, ["row sut__r", "row sut__r", "kom kom--zhel", "row sut__r", "kom kom--zel", "row sut__r", "kom-og"],
    "оговорка — под всем списком фактов, а не посреди него");
  assert.strictEqual(deti[6].textContent, K.OGOVORKA);
  assert.ok(doc._stil && doc._stil.textContent.includes(".sut .kom"), "стили экрана добавлены");
  assert.strictEqual(K.vstavitSut(koren, sp), 0, "повторно не вставляет");
  assert.strictEqual(deti.filter((d) => d.className === "kom-og").length, 1, "оговорка одна");
  assert.strictEqual(K.vstavitSut(koren, []), 0);
  assert.strictEqual(K.vstavitSut(null, sp), 0);
});

test("Паспорт: оговорка один раз — под таблицей с последним комментарием", () => {
  const og = [];
  const doc = { createElement: (t) => ({ tagName: t.toUpperCase(), className: "", nextSibling: null }) };
  const tbody = { tagName: "TBODY" };
  const table = { tagName: "TABLE", nextSibling: null, ownerDocument: doc, parentNode: { insertBefore(n) { og.push(n); } } };
  tbody.parentNode = table;
  const tr = { className: "warn", nextSibling: null, parentNode: tbody, ownerDocument: doc, tagName: "TR" };
  tbody.insertBefore = (n) => { tr.nextSibling = n; };
  const koren = { querySelector: (sel) => (sel === 'tr[data-f="svyazi:0"]' ? tr : sel === ".kom-og" ? og[0] || null : null) };
  const k = K.najti(SPRAV, { title: "Массовый адрес", status: "warn", detail: "" });
  assert.strictEqual(K.vstavitFakty(koren, [{ f: "svyazi:0", k }]), 1);
  assert.strictEqual(og.length, 1);
  assert.strictEqual(og[0].className, "kom-og");
  assert.strictEqual(og[0].textContent, K.OGOVORKA);
  K.vstavitFakty(koren, [{ f: "svyazi:0", k }]);
  assert.strictEqual(og.length, 1, "повторно — не добавляет");
  const h = fs.readFileSync(path.join(KOREN, "pasport/kontragent/index.html"), "utf8");
  assert.ok(h.includes(".kom-og{"), "у оговорки есть стиль в Паспорте (видна и в печати)");
});

test("главная: модуль подключён после существенных фактов, только вне Щита, после отрисовки фактов", () => {
  const h = fs.readFileSync(path.join(KOREN, "index.html"), "utf8");
  const a = h.indexOf('<script src="/js/sushchestvennoe.js" defer></script>'), b = h.indexOf('<script src="/js/kommentarii.js" defer></script>');
  assert.ok(a > 0 && b > a, "kommentarii.js подключён после sushchestvennoe.js");
  const m = h.indexOf("Sushchestvennoe.mount(report.querySelector('.rows'),r)"), v = h.indexOf("Kommentarii.vstavitSut(");
  assert.ok(m > 0 && v > m, "вставка — после существенных фактов");
  assert.ok(/if\(!svoj&&window\.Sushchestvennoe&&window\.Kommentarii\)/.test(h), "в Щите комментариев к фактам нет — там свой разбор");
});

test("досье (report.html): оговорка один раз под таблицей признаков, стиль есть", () => {
  const og = [];
  const doc = { createElement: (t) => ({ tagName: t.toUpperCase(), className: "", nextSibling: null }) };
  const tr = { ownerDocument: doc, nextSibling: null, parentNode: { insertBefore: (n) => { tr.nextSibling = n; } } };
  const obertka = { querySelector: (sel) => (sel === ".kom-og" ? og[0] || null : null), insertBefore: (n) => og.push(n) };
  const tab = { ownerDocument: doc, parentNode: obertka, nextSibling: null,
    querySelector: (q) => (q === 'tr[data-sig="0"]' ? tr : q === ".kom-tr" ? (tr.nextSibling || null) : null) };
  const k = [{ title: "Массовый адрес", status: "warn", detail: "" }];
  assert.strictEqual(K.vstavit(tab, k, SPRAV), 1);
  assert.strictEqual(og.length, 1);
  assert.strictEqual(og[0].textContent, K.OGOVORKA);
  K.vstavit(tab, k, SPRAV);
  assert.strictEqual(og.length, 1, "повторно — не добавляет");
  const pust = { ownerDocument: doc, parentNode: obertka, querySelector: () => null };
  og.length = 0;
  K.vstavit(pust, k, SPRAV);
  assert.strictEqual(og.length, 0, "без комментариев — без оговорки");
  assert.ok(fs.readFileSync(path.join(KOREN, "report.html"), "utf8").includes(".kom-og{"));
});

// ── kommentarii-v4: зелёные тоны [Право] 02.10 08:20 (claude/Право_ответы_✎_kommentarii-v2_dvojnik_02.10.md) ──
test("v4: зелёные тоны — дословно [Право], только у ok и только если источник ответил", () => {
  const ZEL = [
    [["ФССП", "нет производств", "ok"], "fssp", ""],
    [["Банкротство", "нет сообщений", "ok"], "bankrotstvo", "п. 1 ст. 61.2 127-ФЗ"],
    [["Приостановление операций по счетам", "нет решений", "ok"], "blokirovka", "ст. 76 НК РФ"],
    [["Дисквалификация руководителя", "нет", "ok"], "diskval", "ст. 3.11 КоАП РФ"],
    [["Реестр недобросовестных поставщиков", "нет", "ok"], "rnp", "ст. 104 44-ФЗ"],
  ];
  for (const [[title, detail, status], id, norma] of ZEL) {
    const k = K.najti(SPRAV, { title, detail, status });
    assert.ok(k, "нет комментария: " + title);
    assert.deepStrictEqual([k.id, k.ton, k.norma], [id, "zel", norma], title);
    assert.ok(/на дату проверки/.test(k.bank), "«на дату проверки» — " + title);
    assert.ok(K.dlina(k) <= 300, title);
    // «не проверяли ≠ не нашли»: источник не ответил — зелёного текста нет
    for (const d of ["не проверяли — источник временно недоступен", "нет данных", "Не проверяли", "ошибка источника"])
      assert.strictEqual(K.najti(SPRAV, { title, detail: d, status }), null, title + " · " + d);
    // info/неизвестный статус — тоже без зелёного текста
    assert.strictEqual(K.najti(SPRAV, { title, detail, status: "info" }), null, title + " · info");
  }
  const f = K.najti(SPRAV, { title: "ФССП", detail: "нет", status: "ok" });
  assert.strictEqual(f.bank, "В банке данных приставов нет открытых производств против компании — на дату проверки.");
  assert.ok(!K.html(f).includes(" · 229-ФЗ"), "у fssp·zel [Право] нормы не дали — подписи нормы нет");
  assert.ok(K.html(K.najti(SPRAV, { title: "ФССП", detail: "3 производства", status: "warn" })).includes(" · 229-ФЗ"), "у fssp·zhel норма записи осталась");
});

test("v4: подписи норм — правки [Право] 08:20 (массовые — только ст. 54.1 НК; нет отчётности — ст. 18 402-ФЗ; убыток — полностью; недостоверность·kras — пп. «б» п. 5)", () => {
  const n = (title, detail, status) => K.najti(SPRAV, { title, detail, status }).norma;
  assert.strictEqual(n("Адрес", "массовый адрес: 54 компании", "warn"), "ст. 54.1 НК РФ");
  assert.strictEqual(n("Массовый руководитель", "12 компаний", "warn"), "ст. 54.1 НК РФ");
  assert.strictEqual(n("Доходы и расходы", "отчётность за 2025 год не сдана", "warn"), "п. 1 ст. 21.1 129-ФЗ; ст. 18 402-ФЗ");
  assert.strictEqual(n("Доходы и расходы", "убыток 3,1 млн ₽ за 2025 год", "warn"), "приказ ФНС от 30.05.2007 № ММ-3-06/333@ (критерий рентабельности)");
  assert.strictEqual(n("Недостоверность адреса или руководителя", "есть отметка о недостоверности адреса", "bad"), "пп. «б» п. 5 ст. 21.1 129-ФЗ");
  assert.strictEqual(n("Недостоверность адреса или руководителя", "отметок нет", "ok"), "п. 4.2 ст. 9, ст. 21.1 129-ФЗ");
  for (const x of SPRAV.signaly) assert.ok(!/ЗСК/.test(x.norma || ""), "«ЗСК» — не норма: " + x.id);
});

test("v4: комментарий проходит через общую обёртку неразрывных номеров (js/shapka.js), если она есть", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "kommentarii.js"), "utf8");
  assert.strictEqual((src.match(/nerazryv\((nov|el)\);/g) || []).length, 3, "вызов после каждой из трёх вставок");
  assert.ok(src.includes("w.dlkNerazryv.obernut(uzel)"));
});

test("kom-kapital-v1: минус капитала и ликвидность ниже 1 на экране — комментарий [Право] 03.10; без минуса — нет", () => {
  const NB = "\u00a0";
  const spisok = [
    { k: "kapital", nazv: "Собственный капитал на" + NB + "31.12.2025", ton: "warn", znach: "Минус 12 млн ₽: обязательства больше активов" },
    { k: "likvidnost", nazv: "Текущая ликвидность", ton: "warn", znach: "0,74: краткосрочные долги больше оборотных средств" },
  ];
  const sp = K.dlyaSut(spisok, [], SPRAV);
  assert.deepStrictEqual(sp.map((v) => v.k + ":" + v.kom.id + ":" + v.kom.ton), ["kapital:kapital:zhel", "likvidnost:likvidnost:zhel"]);
  assert.ok(sp[0].kom.bank.startsWith("Минус капитала — не признак по 115-ФЗ"));
  assert.ok(sp[1].kom.sdelat.endsWith("здесь данные на 31 декабря."));
  for (const v of sp) {
    assert.strictEqual(v.kom.norma, "", "норма — внутри текста [Право], отдельной подписи нет");
    assert.ok(K.dlina(v.kom) <= 300);
    assert.ok(!ZAPRET.test(v.kom.bank + v.kom.nalog + v.kom.sdelat));
  }
  assert.strictEqual(K.dlyaSut([{ k: "kapital", nazv: "Собственный капитал на 31.12.2025", ton: "ok", znach: "1 млн ₽" }], [], SPRAV).length, 0);
  // строка светофора с похожим словом не цепляет эти записи
  assert.notStrictEqual((K.zapis(SPRAV, { title: "Ликвидация", status: "bad" }) || {}).id, "likvidnost");
});

test("kom-kapital-v1: настоящий экран (sushchestvennoe) — названия фактов совпадают с записями библиотеки", () => {
  const src = fs.readFileSync(path.join(KOREN, "js/sushchestvennoe.js"), "utf8");
  assert.ok(/k: 'kapital', nazv: 'Собственный капитал на'/.test(src));
  assert.ok(/k: 'likvidnost', nazv: 'Текущая ликвидность'/.test(src));
});

// ── kommentarii-isklyuchena-v2 (Ночные-2, 03.10 22:35): компания УЖЕ исключена из ЕГРЮЛ (коды 407/414/415/418/420) ──
// Тексты [Право] дословно: «Банк» — 14:30 разд. 1 (3) с уточнением 16:07 разд. 2 («Последствия — как при ликвидации…»
// вместо «Закон приравнивает…»); «Налоговая» — пусто (14:30: норму о документах от исключённой ещё не сверили);
// «Что сделать» — 16:07 разд. 3 (159 знаков: «ООО» обязательно, исход не обещаем). Норма — 14:30.
test("isklyuchena: исключённая — свой текст [Право]; «готовится исключение» — по-прежнему isklyuchenie", () => {
  const BANK = "Компания исключена из ЕГРЮЛ. Последствия — как при ликвидации (п. 2 ст. 64.2 ГК РФ): договор с ней не заключайте и не платите.";
  // kommentarii-isklyuchena-v3 (Ночные-2, 04.10): «Что сделать» — [Право] 04.10 07:07 разд. 1 (167 знаков): год на обжалование
  // + долг ООО с управлявших при условии вины; «взыщут»/«вернёте» не пишем — обещание исхода.
  const SDELAT = "Оспорить исключение в суде — в течение года (п. 8 ст. 22 129-ФЗ). Долг ООО можно требовать с директора или участников, если не оплачен по их вине (п. 3.1 ст. 3 14-ФЗ).";
  for (const [title, detail] of [["Статус", "Компания исключена из ЕГРЮЛ"], ["Компания исключена из ЕГРЮЛ", ""],
    ["Статус", "Юрлицо исключено из ЕГРЮЛ как недействующее"], ["Статус", "ФНС исключила компанию из ЕГРЮЛ"],
    ["Компания исключена из ЕГРЮЛ", "по сведениям Банка России"]]) {
    const k = K.najti(SPRAV, { title, detail, status: "bad" });
    assert.ok(k, title + " · " + detail);
    assert.deepStrictEqual([k.id, k.ton, k.bank, k.nalog, k.sdelat, k.norma, k.data],
      ["isklyuchena", "kras", BANK, "", SDELAT, "п. 2–3 ст. 64.2 ГК РФ; п. 3.1 ст. 3 14-ФЗ", "04.10.2026"], title + " · " + detail);
    assert.ok(!/до исключения|заберите долг|вернут|вернёте|взыщ|взыскать|гарант|приравнива/i.test(k.bank + k.sdelat));
    assert.ok(/по их вине/.test(k.sdelat), "условие вины — обязательно");
    assert.ok(!K.html(k).includes("Налоговая:"), "пустая «Налоговая» — строки нет");
  }
  // жёлтый и зелёный тоны — без текстов (молчим)
  assert.strictEqual(K.najti(SPRAV, { title: "Статус", detail: "Компания исключена из ЕГРЮЛ", status: "warn" }), null);
  // «готовится исключение» — прежний текст isklyuchenie; «ликвидируется или исключается» — неясно, молчим
  assert.strictEqual(K.najti(SPRAV, { title: "Статус", detail: "Исключение из ЕГРЮЛ (недействующая)", status: "bad" }).id, "isklyuchenie");
  assert.strictEqual(K.najti(SPRAV, { title: "ФНС готовит исключение из ЕГРЮЛ — компания недействующая", detail: "", status: "bad" }).id, "isklyuchenie");
  assert.strictEqual(K.najti(SPRAV, { title: "Статус", detail: "Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ", status: "bad" }), null);
  assert.strictEqual(K.najti(SPRAV, { title: "Статус", detail: "Действует", status: "bad" }), null);
  // 300 знаков на тон
  const t = SPRAV.signaly.find((x) => x.id === "isklyuchena").tony.kras;
  assert.ok(t.bank.length + t.sdelat.length <= 300);
});

// ── kommentarii-108-110-v1 ([Ночные-2] 05.10): тексты [Право] 04.10 23:07 разд. 1 дословно —
// claude/Право_✎_комментарии_108_110_реорганизация_Разбор17_НДС_аванс_04.10.md. Реорганизация — только формы, после которых
// компания прекращается (122, 123, 124, 129); выделение, присоединение к ней, преобразование и уже прекращённые — молчим.
const V6 = [
  [["ФНС готовит исключение из ЕГРЮЛ по сведениям Банка России", "Компания в группе высокого риска Банка России (ЗСК), и это не отменено ни комиссией, ни судом (п. 4 ст. 7.8 115-ФЗ).", "bad"], ["isklyuchenie_cb", "kras"]],
  [["ФНС готовит исключение из ЕГРЮЛ (пп. «г» п. 5 ст. 21.1 129-ФЗ)", "", "bad"], ["isklyuchenie_cb", "kras"]],
  [["ФНС готовит исключение из ЕГРЮЛ — по основанию из закона о противодействии отмыванию (ст. 7.8 115-ФЗ)", "", "bad"], ["isklyuchenie_cb", "kras"]],
  [["Статус", "ФНС готовит исключение из ЕГРЮЛ по сведениям Банка России", "bad"], ["isklyuchenie_cb", "kras"]],
  [["Участники закрывают компанию в упрощённом порядке — ФНС готовит исключение из ЕГРЮЛ", "", "bad"], ["isklyuchenie_uchastniki", "kras"]],
  [["Статус", "Участники закрывают компанию в упрощённом порядке", "bad"], ["isklyuchenie_uchastniki", "kras"]],
  [["Статус", "Компания реорганизуется и прекратит существование. Её договоры и долги перейдут к правопреемнику — уточните, к кому.", "warn"], ["reorganizaciya", "zhel"]],
  [["Компания прекратит существование после реорганизации", "договор и долги перейдут к правопреемнику", "warn"], ["reorganizaciya", "zhel"]],
  [["Статус", "Находится в процессе реорганизации в форме слияния", "warn"], ["reorganizaciya", "zhel"]],
  [["Статус", "Находится в процессе реорганизации в форме разделения", "warn"], ["reorganizaciya", "zhel"]],
  [["Статус", "Находится в процессе реорганизации в форме присоединения к другому юрлицу", "warn"], ["reorganizaciya", "zhel"]],
  [["Статус", "Находится в процессе реорганизации при одновременном сочетании различных форм реорганизации и прекращения деятельности", "warn"], ["reorganizaciya", "zhel"]],
  // компания продолжает существовать или уже прекращена — текст «прекратит существование» не подходит
  [["Статус", "Находится в процессе реорганизации в форме выделения", "warn"], null],
  [["Статус", "Находится в процессе реорганизации в форме присоединения к нему других юрлиц", "warn"], null],
  [["Статус", "Находится в процессе реорганизации в форме разделения, осуществляемой одновременно с присоединением", "warn"], null],
  [["Статус", "Находится в процессе реорганизации в форме преобразования", "warn"], null],
  [["Статус", "Прекращение деятельности путем реорганизации в форме слияния", "bad"], null],
  [["Статус", "Прекратила деятельность при реорганизации", "bad"], null],
  [["Статус", "Реорганизация", "warn"], null],
  // соседи не сдвинулись
  [["ФНС готовит исключение из ЕГРЮЛ — компания недействующая", "", "bad"], ["isklyuchenie", "kras"]],
  [["Статус", "Компания исключена из ЕГРЮЛ", "bad"], ["isklyuchena", "kras"]],
  [["Статус", "Ликвидирована", "bad"], ["likvidaciya", "kras"]],
  [["Статус", "Действует", "ok"], null],
];

test("v6: 108, 110, реорганизация — тексты [Право] 04.10 дословно, только своим строкам", () => {
  for (const [[title, detail, status], ozh] of V6) {
    const k = K.najti(SPRAV, { title, detail, status });
    const gde = title + " · " + detail + " · " + status;
    if (!ozh) { assert.strictEqual(k, null, gde); continue; }
    assert.ok(k, "нет комментария: " + gde);
    assert.deepStrictEqual([k.id, k.ton], ozh, gde);
    if (["isklyuchenie_cb", "isklyuchenie_uchastniki", "reorganizaciya"].includes(ozh[0])) {
      assert.ok(k.bank && k.nalog && k.sdelat, gde);
      assert.strictEqual(k.data, "04.10.2026", gde);
    }
  }
  const k108 = K.najti(SPRAV, { title: "ФНС готовит исключение из ЕГРЮЛ (пп. «г» п. 5 ст. 21.1 129-ФЗ)", detail: "", status: "bad" });
  assert.strictEqual(k108.bank, "Компания в группе высокого риска Банка России (ЗСК), и это не отменено. ФНС готовит исключение из ЕГРЮЛ.");
  assert.strictEqual(k108.nalog, "Пп. «г» п. 5 ст. 21.1 129-ФЗ. Возразить могут только кредиторы.");
  assert.match(k108.sdelat, /6 месяцев/);
  assert.ok(!/3 месяц/.test(k108.sdelat), "у 108 срок 6 месяцев (п. 7 ст. 21.1 129-ФЗ), не 3");
  const k110 = K.najti(SPRAV, { title: "Статус", detail: "Участники закрывают компанию в упрощённом порядке", status: "bad" });
  assert.match(k110.bank, /единогласно/);
  assert.match(k110.nalog, /реестра МСП/);
  assert.match(k110.sdelat, /3 месяцев со дня публикации \(п\. 10\)/);
  const kr = K.najti(SPRAV, { title: "Статус", detail: "Находится в процессе реорганизации в форме слияния", status: "warn" });
  assert.strictEqual(kr.nalog, "Её налоги и пени платит правопреемник (ст. 50 НК РФ).");
  assert.match(kr.sdelat, /п\. 2 ст\. 60 ГК РФ/);
  // реорганизация — тон «Внимание», не «Риск»: красного текста нет
  assert.strictEqual(K.najti(SPRAV, { title: "Статус", detail: "Находится в процессе реорганизации в форме слияния", status: "bad" }), null);
  // [Право]: для 105–110 нет «закроет счёт» (это текст про уже исключённую компанию), нет «банк спросит», «упрощ», «гарант», «взыщут»
  for (const id of ["isklyuchenie", "isklyuchenie_cb", "isklyuchenie_uchastniki", "reorganizaciya"]) {
    const z = SPRAV.signaly.find((x) => x.id === id);
    const t = Object.values(z.tony).find((x) => x.status === "utverzhdeno");
    const vse = t.bank + " " + t.nalog + " " + t.sdelat;
    assert.ok(!/закроет сч[её]т|банк спросит|упрощ|гарант|взыщ|по сведениям банка россии/i.test(vse), id);
    assert.ok(K.dlina(t) <= 300, id);
  }
});

test("isklyuchenie-v1.1: коды 105–107 (ФНС готовит исключение) — без «закроет счёт», компания ещё не исключена ([Право] 04.10 23:15)", () => {
  for (const detail of [
    "Регистрирующий орган принял решение о предстоящем исключении недействующего юрлица из ЕГРЮЛ",
    "Предстоящее исключение из ЕГРЮЛ: недостоверные сведения",
  ]) {
    const k = K.najti(SPRAV, { title: "Статус", detail, status: "bad" });
    assert.ok(k, detail);
    assert.ok(!/закроет сч[её]т/i.test(k.bank + " " + k.nalog + " " + k.sdelat), detail);
    assert.strictEqual(k.bank, "Компания на пути к исключению из ЕГРЮЛ — после исключения её не станет.");
  }
  // уже исключённая — своя запись (isklyuchena), её текст не трогали
  const z = SPRAV.signaly.find((x) => x.id === "isklyuchena");
  assert.ok(z);
});
