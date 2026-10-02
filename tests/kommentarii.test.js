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
  assert.match(h, /Команда Делоскопа · 115-ФЗ и налоги · 229-ФЗ · проверено 04\.10\.2026/);
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

test("v2: 22 тона утверждены — роль, дата, без ФИО и NBSP", () => {
  let n = 0;
  for (const x of SPRAV.signaly) for (const t of Object.values(x.tony || {})) if (t.status === "utverzhdeno") {
    n++;
    assert.strictEqual(t.proveril, "Право · Юрист 115-ФЗ и Налоговый юрист");
    assert.strictEqual(t.data_proverki, "2026-10-02");
    assert.ok(!/\u00a0/.test(t.bank + t.nalog + t.sdelat));
  }
  assert.strictEqual(n, 22);
});
