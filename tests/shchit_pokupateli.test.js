// Щит v4 — «Как вас видят покупатели» (js/shchit.js, shchit-pokupateli-v1 [Ночные-3] 11.10). node --test tests/shchit_pokupateli.test.js
const test = require("node:test");
const assert = require("node:assert");
const S = require("../js/shchit.js");

const NA = "2026-10-11T04:23:00+03:00";
// Форма живого ответа /api/check (ПАО, 11.10.2026): досье есть, рядов ГИР БО нет, KPI — только долг.
function otvet(dop = {}, company = {}) {
  return Object.assign({
    checked_at: NA,
    company: Object.assign({ inn: "1650032058", kind: "LEGAL", name_short: "ПАО «Своё»", status: "ACTIVE", reg_date: "1990-08-23", okved: "29.10.4" }, company),
    signals: [{ title: "Статус", status: "ok", detail: "Действующая" }],
    dossier: { kpi: [{ label: "Долг перед бюджетом", value: null }], charts: {}, sections: [] },
  }, dop);
}
const ZAPRET = /предоплат|поставщик|\bМожно\b|надёжн|гарантир|безопасн/i;
const tekst = (H) => H.replace(/<[^>]+>/g, " ");

test("нет бухотчётности в ответе → блок «Как вас видят покупатели» и шаг «Открыть ГИР БО» за прошлый год", () => {
  const R = S.razbor(otvet());
  assert.strictEqual(R.pokupateli.length, 1);
  assert.strictEqual(R.pokupateli[0].priznak, "Бухотчётности в открытых данных ГИР БО нет");
  assert.match(R.pokupateli[0].pochemu, /не увидит ни выручки, ни её динамики/);
  assert.strictEqual(R.chisto, true, "признаков риска нет — честная строка остаётся");
  const sh = R.shagi.find((s) => s.kind === "pokupateli");
  assert.ok(sh && sh.href === "https://bo.nalog.gov.ru/" && sh.ext && sh.knopka === "Открыть ГИР БО");
  assert.match(sh.t, /отчётность за 2025 год\./);
  assert.ok(R.shagi[R.shagi.length - 1].sled, "«Следить» — последним");
  const H = S.html(R);
  assert.match(H, /<h3>Как вас видят покупатели <span class="shch-ch">· 1<\/span><\/h3>/);
  assert.match(H, /class="shch-k" href="https:\/\/bo\.nalog\.gov\.ru\/" target="_blank" rel="noopener">Открыть ГИР БО</);
  assert.doesNotMatch(tekst(H), ZAPRET);
  assert.match(S.kratko(R), /Заметных признаков в открытых данных нет\. Покупатели при проверке по ИНН не увидят вашу отчётность\. Что сделать: 1\. Откройте/);
});

test("свежая отчётность есть → блока нет; старая (за 2021 при проверке 2026) → «только за 2021 год»", () => {
  const svezh = otvet({ dossier: { kpi: [], charts: { revenue: [{ year: 2024, value: 1e9 }, { year: 2025, value: 1.2e9 }] }, sections: [] } });
  assert.deepStrictEqual(S.razbor(svezh).pokupateli, []);
  const proshlyj = otvet({ dossier: { kpi: [], charts: { revenue: [{ year: 2024, value: 1e9 }] }, sections: [] } });
  assert.deepStrictEqual(S.razbor(proshlyj).pokupateli, [], "2024 при проверке 2026 — не «старая» (правило Существенных фактов)");
  const st = S.razbor(otvet({ dossier: { kpi: [], charts: { revenue: [{ year: 2020, value: 5e8 }, { year: 2021, value: 6e8 }] }, sections: [] } }));
  assert.strictEqual(st.pokupateli.length, 1);
  assert.strictEqual(st.pokupateli[0].priznak, "Последняя открытая отчётность — за 2021 год");
  assert.match(st.pokupateli[0].pochemu, /увидит отчётность только за 2021 год — /);
  assert.match(S.kratko(st), /увидят отчётность только за 2021 год/);
});

test("не трогаем: ИП, банк (ОКВЭД 64.1x), прекращающую работу, признак API «отчётность», ответ без досье", () => {
  assert.deepStrictEqual(S.razbor(otvet({}, { inn: "770700000000", kind: "INDIVIDUAL" })).pokupateli, []);
  assert.deepStrictEqual(S.razbor(otvet({}, { okved: "64.19" })).pokupateli, []);
  assert.deepStrictEqual(S.razbor(otvet({}, { status: "LIQUIDATING" })).pokupateli, []);
  const rep = S.razbor(otvet({ signals: [{ title: "Не сдаёт отчётность", status: "bad", detail: "Да" }] }));
  assert.deepStrictEqual(rep.pokupateli, []);
  assert.ok(rep.nalogovaya.some((x) => x.kind === "report"), "у признака API — свой текст и шаг");
  const bez = otvet(); delete bez.dossier;
  assert.deepStrictEqual(S.razbor(bez).pokupateli, []);
});

test("шаг покупателей не вытесняет шаги по признакам риска: ≤ 3 шагов, он — после них", () => {
  const sig = (title, status, detail) => ({ title, status, detail });
  const R = S.razbor(otvet({ signals: [sig("Задолженность по налогам", "bad", "120 000 ₽"), sig("Массовый адрес регистрации", "warn", "Да")], zsk: { level: "high" } }));
  const bez = R.shagi.filter((s) => !s.sled).map((s) => s.kind);
  assert.deepStrictEqual(bez, ["zsk", "dolg", "mass"]);
  const R2 = S.razbor(otvet({ signals: [sig("Массовый адрес регистрации", "warn", "Да")] }));
  assert.deepStrictEqual(R2.shagi.filter((s) => !s.sled).map((s) => s.kind), ["mass", "pokupateli"]);
  assert.strictEqual(S.glavnyj(R2).kind, "mass", "главная кнопка — по признаку риска");
});

test("Индекс в браузере «данных мало» → одна фраза в строке; ◐ — номеров норм в строке и шаге нет", () => {
  const IO = { gotov: () => true, vid: () => ({ rezhim: "sokr" }) };
  const R = S.razbor(otvet(), { indeksOtvet: IO });
  assert.match(R.pokupateli[0].pochemu, /Индекс Делоскопа в такой проверке — «данных пока мало»\.$/);
  const R2 = S.razbor(otvet(), { indeksOtvet: { gotov: () => true, vid: () => ({ rezhim: "chislo" }) } });
  assert.doesNotMatch(R2.pokupateli[0].pochemu, /Индекс/);
  const sh = R.shagi.find((s) => s.kind === "pokupateli");
  assert.doesNotMatch(R.pokupateli[0].pochemu + " " + sh.t, /(ст|п|ч)\.\s?\d|ФЗ|НК РФ/);
  assert.strictEqual(R.sNormoj, false, "подпись «нормы сверены» ради строки без нормы не появляется");
});

// v4.1 (12.10): две правки [команда] 11.10 — без «размера бизнеса» (не звучит как оценка) и «если вы ограничили доступ в ГИР БО»
test('тексты блока «Как вас видят покупатели» — по согласованию 11.10', () => {
  const kod = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'shchit.js'), 'utf8');
  require('node:assert').match(kod, /о вашем бизнесе он будет судить по возрасту компании и записям в реестрах/);
  require('node:assert').match(kod, /Если вы ограничили доступ к ней в ГИР БО/);
  require('node:assert').doesNotMatch(kod, /размере вашего бизнеса|Если доступ к ней ограничен|◐ — ждёт/);
});
