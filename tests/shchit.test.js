// Щит — своя компания глазами банка и налоговой (js/shchit.js). node --test tests/shchit.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../js/shchit.js");

const chitat = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const MART26 = "2026-10-01T12:00:00+03:00";
function otvet(signals = [], dop = {}) {
  return Object.assign({ checked_at: MART26, company: { inn: "7707083893", name_short: "ООО «Своя»", status: "ACTIVE", reg_date: "2018-04-01" }, signals }, dop);
}
const sig = (title, status = "bad", detail = "Да") => ({ title, status, detail });
// Названия признаков — как их классифицирует Usloviya.kindOf.
const PO_VIDU = {
  nedost: sig("Недостоверные сведения об адресе"),
  mass: sig("Массовый адрес регистрации", "warn"),
  staff: sig("Численность сотрудников", "warn", "1"),
  nagruzka: sig("Налоговая нагрузка ниже отраслевой", "warn", "Внимание"),
  dolg: sig("Задолженность по налогам", "bad", "120 000 ₽"),
  fssp: sig("Исполнительные производства ФССП", "bad", "2 на 80 000 ₽"),
  report: sig("Не сдаёт отчётность", "bad"),
  director: sig("Руководитель сменился недавно", "warn", "Внимание"),
  block: sig("Решение о приостановлении операций по счетам", "bad"),
  diskv: sig("Дисквалифицированный руководитель", "bad"),
  rnp: sig("В реестре недобросовестных поставщиков", "bad"),
};
const vse = (R) => [...R.banki, ...R.nalogovaya].map((x) => x.priznak + " " + x.pochemu).join(" ") + " " + R.shagi.map((s) => s.t + " " + s.knopka).join(" ");
const ZAPRET = /предоплат|поставщик|\bМожно\b|надёжн|гарантир|безопасн/i;

test("каждый признак из таблицы ТЗ даёт строку хотя бы в одном блоке", () => {
  for (const [k, s] of Object.entries(PO_VIDU)) {
    const R = S.razbor(otvet([s]));
    const est = [...R.banki, ...R.nalogovaya].some((x) => x.kind === k);
    assert.ok(est, "нет строки для " + k);
    assert.strictEqual(R.chisto, false);
  }
  const young = S.razbor(otvet([], { company: { inn: "7707083893", name_short: "ООО «Новая»", status: "ACTIVE", reg_date: "2026-05-01" } }));
  assert.ok(young.banki.some((x) => x.kind === "young"), "молодая компания");
  const zsk = S.razbor(otvet([], { zsk: { level: "medium", title: "Средний" } }));
  assert.ok(zsk.banki.some((x) => x.kind === "zsk"), "прогноз ЗСК");
});

test("в Щите нет слов из проверки контрагента (предоплата, поставщик, «Можно», надёжность, гарантии)", () => {
  const R = S.razbor(otvet(Object.values(PO_VIDU).filter((s) => !/недобросовестных поставщиков/.test(s.title)), { zsk: { level: "high" } }));
  const t = vse(R).replace(/«[^»]*»/g, "");
  assert.doesNotMatch(t, ZAPRET);
  const H = S.html(R);
  assert.doesNotMatch(H.replace(/<[^>]+>/g, " "), ZAPRET);
  const P = S.html(S.razbor(otvet([])));
  assert.doesNotMatch(P.replace(/<[^>]+>/g, " "), ZAPRET);
});

test("шагов — не больше трёх, последним всегда «Следить», порядок по ТЗ", () => {
  const R = S.razbor(otvet(Object.values(PO_VIDU), { zsk: { level: "high" } }));
  const bez = R.shagi.filter((s) => !s.sled);
  assert.ok(bez.length <= 3);
  assert.deepStrictEqual(bez.map((s) => s.kind), ["skoraya", "zsk", "dolg"]);
  const last = R.shagi[R.shagi.length - 1];
  assert.ok(last.sled && last.href === "/cabinet.html" && /^Следить за своей компанией/.test(last.t));
  // «Скорая» одна, даже если признаков «как есть» несколько
  const R2 = S.razbor(otvet([PO_VIDU.block, PO_VIDU.diskv, PO_VIDU.rnp]));
  assert.strictEqual(R2.shagi.filter((s) => s.kind === "skoraya").length, 1);
});

test("ЗСК: всегда «не статус Банка России» и ссылка на сервис ЦБ главной кнопкой", () => {
  for (const level of ["high", "medium"]) {
    const R = S.razbor(otvet([], { zsk: { level } }));
    const z = R.banki.find((x) => x.kind === "zsk");
    assert.match(z.pochemu, /не статус Банка России/);
    const g = S.glavnyj(R);
    assert.strictEqual(g.href, "https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/");
    assert.match(g.t, /6 месяцев \(п\. 1 ст\. 7\.8 115-ФЗ\)\.$/);
    assert.match(S.html(R), /href="\/skoraya-115-fz\/\?s=zsk"/);
  }
});

test("замечаний нет → честный текст, «Не проверяли» и шаг «Следить»", () => {
  const R = S.razbor(otvet([]));
  assert.strictEqual(R.chisto, true);
  assert.deepStrictEqual(R.banki, []);
  assert.deepStrictEqual(R.nalogovaya, []);
  assert.strictEqual(R.shagi.length, 1);
  const H = S.html(R);
  assert.match(H, /В открытых данных заметных признаков не нашли\. Это не гарантия: банк смотрит и на ваши операции\./);
  assert.match(H, /Не проверяли: долги у приставов, долги по налогам/);
  assert.match(H, /class="shch-k" href="\/cabinet\.html">Следить за компанией</);
  // источники ответили «не найдено» — строки «Не проверяли» нет
  const R2 = S.razbor(otvet([], { istochniki: [{ kod: "fssp", status: "not_found" }, { kod: "nalogi", status: "not_found" }] }));
  assert.doesNotMatch(S.html(R2), /Не проверяли/);
});

test("◐-строки без «да» [Право] — без номера статьи; сверенные — с нормой", () => {
  assert.strictEqual(S.SVERENO, false);
  const R = S.razbor(otvet(Object.values(PO_VIDU)));
  const norma = /\((п|пп|ст)\.[^)]*\)/;
  for (const x of [...R.banki, ...R.nalogovaya]) {
    const t = S.T[x.kind];
    const stroka = t && (R.banki.includes(x) ? t.b : t.n);
    if (stroka && !stroka.sver) assert.doesNotMatch(x.pochemu, norma, x.kind);
  }
  for (const s of R.shagi) if (s.kind !== "zsk") assert.doesNotMatch(s.t, norma, s.kind);
  const dolg = R.banki.find((x) => x.kind === "dolg");
  assert.strictEqual(dolg.pochemu, "Долг по налогам может закончиться приостановкой операций по счёту.");
});

test("ИП: нет строк про исключение из ЕГРЮЛ, признак не теряется", () => {
  const R = S.razbor(otvet([PO_VIDU.report, PO_VIDU.nedost], { company: { inn: "500100732259", name_short: "ИП Пример", status: "ACTIVE", reg_date: "2015-01-01" } }));
  assert.strictEqual(R.ul, false);
  assert.doesNotMatch(vse(R), /ЕГРЮЛ/);
  assert.ok([...R.banki, ...R.nalogovaya].some((x) => x.kind === "report"));
});

test("строки экранируются, деталь признака видна", () => {
  const R = S.razbor(otvet([sig("Задолженность по налогам", "bad", "<b>120 000 ₽</b>")]));
  const H = S.html(R);
  assert.doesNotMatch(H, /<b><b>/);
  assert.match(H, /Задолженность по налогам: &lt;b&gt;120\u00a0000\u00a0₽&lt;\/b&gt;/);
  assert.match(S.kratko(R), /^ООО «Своя» — глазами банка и налоговой на 01\.10\.2026\. Признаков: 2\. Что сделать: 1\. Сверьте/);
});

test("главная: Щит подключён, обычная проверка по ИНН идёт через Usloviya без изменений", () => {
  const G = chitat("index.html");
  assert.match(G, /<script src="\/js\/shchit\.js" defer><\/script>/);
  assert.match(G, /runCheck\(d,\{svoj:true\}\)/);
  assert.match(G, /dlkGoal\('shchit_start'\)/);
  assert.match(G, /else if\(window\.Usloviya&&ub\)\{[^}]*Usloviya\.mount\(ub,r\)/);
  assert.match(chitat("js/metrika.js"), /"shchit_start" \| "shchit_sled"/);
  assert.match(chitat("js/shchit.js"), /dlkGoal\('shchit_sled'/);
  // ссылки шагов ведут на существующие страницы
  for (const k of Object.keys(S.T)) {
    const s = S.T[k].s || S.T[k];
    if (s.href && s.href.startsWith("/") && !s.href.startsWith("/cabinet")) {
      const p = s.href.split("?")[0];
      assert.ok(fs.existsSync(path.join(__dirname, "..", p, "index.html")), "нет страницы " + p);
    }
  }
});
