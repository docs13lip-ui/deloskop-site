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
  "Статус": "likvidaciya",
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
    assert.doesNotThrow(() => new RegExp(x.re, "i"), x.id);
    assert.ok(!/\\b/.test(x.re), "без \\b — в JS не работает с кириллицей: " + x.id);
    assert.deepStrictEqual(Object.keys(x.tony).sort(), ["kras", "zel", "zhel"]);
  });
  assert.ok(SPRAV.podpis && !/\d+\s*(лет|год)/i.test(SPRAV.podpis), "подпись без стажа числом");
});

test("библиотека: тексты — без запрещённых слов, ≤ 300 знаков; утверждённый — с ролью и датой", () => {
  for (const x of SPRAV.signaly) for (const [ton, t] of Object.entries(x.tony)) {
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
    if (SPRAV.signaly.every((x) => Object.values(x.tony).every((t) => t.status !== "utverzhdeno")))
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
