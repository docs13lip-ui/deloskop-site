// nagruzka-v1: нормы ФНС (data/fns-normy-2025.json), калькулятор /nalogi/nagruzka/, справочник /nalogi/nagruzka-po-otraslyam-2025/.
// node --test tests/nagruzka.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const N = require("../js/nagruzka.js");

const ROOT = path.join(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fns-normy-2025.json"), "utf8"));
const chitat = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const KALK = chitat("nalogi/nagruzka/index.html");
const TABL = chitat("nalogi/nagruzka-po-otraslyam-2025/index.html");

test("справочник: источник, дата, контрольные строки «Всего» (двойной ввод)", () => {
  assert.match(D.istochnik.nazvanie, /Информация ФНС России от 05\.05\.2026/);
  assert.strictEqual(D.istochnik.data, "2026-05-05");
  assert.match(D.istochnik.prikaz, /ММ-3-06\/333@/);
  const vsego = D.nagruzka[0];
  assert.strictEqual(vsego.kod, "ВСЕГО");
  assert.strictEqual(vsego.nagruzka["2025"], D.sverka.kontrol_vsego.nagruzka_2025);
  assert.strictEqual(vsego.nagruzka["2025"], 11.9);
  assert.strictEqual(vsego.nagruzka["2024"], 11.6);
  const r0 = D.rentabelnost.stroki[0];
  assert.strictEqual(r0.prodazhi, 10.9);
  assert.strictEqual(r0.aktivy, 5.0);
  assert.strictEqual(D.nagruzka.length, 45);
  assert.strictEqual(D.rentabelnost.stroki.length, 61);
});

test("справочник: значения — числа 0–100 или «отр», коды уникальны, контроль по документу Налогового юриста 27.09", () => {
  const kody = new Set();
  for (const s of D.nagruzka) {
    assert.ok(!kody.has(s.kod), "повтор кода " + s.kod); kody.add(s.kod);
    for (const g of ["2025", "2024"]) {
      for (const v of [s.nagruzka[g], s.sv[g]]) assert.ok(typeof v === "number" && v >= 0 && v < 100, s.kod + " " + g);
    }
  }
  for (const s of D.rentabelnost.stroki) {
    for (const v of [s.prodazhi, s.aktivy]) assert.ok(v === "отр" || (typeof v === "number" && v > 0 && v < 100), s.kod);
  }
  const n = (k) => D.nagruzka.find((s) => s.kod === k).nagruzka;
  // claude/Налоговый_юрист_нагрузка_против_отрасли_27.09.md, § 1, «Значения 2025»
  assert.deepStrictEqual([n("F")["2025"], n("F")["2024"]], [15.0, 14.4]);
  assert.strictEqual(n("46")["2025"], 2.6);
  assert.strictEqual(n("47")["2025"], 6.3);
  assert.strictEqual(n("H")["2025"], 7.4);
  assert.deepStrictEqual([n("J")["2025"], n("J")["2024"]], [15.6, 15.4]);
  assert.deepStrictEqual([n("L")["2025"], n("L")["2024"]], [23.2, 20.6]);
  assert.deepStrictEqual([n("C")["2025"], n("C")["2024"]], [8.7, 7.6]);
  assert.deepStrictEqual([n("A")["2025"], n("A")["2024"]], [5.6, 4.9]);
  assert.strictEqual(n("I")["2025"], 11.9);
  assert.strictEqual(n("N")["2025"], 16.9);
  const r = (k) => D.rentabelnost.stroki.find((s) => s.kod === k);
  assert.deepStrictEqual([r("F").prodazhi, r("F").aktivy], [9.3, 3.4]);
  assert.deepStrictEqual([r("46").prodazhi, r("46").aktivy], [4.5, 2.2]);
  assert.deepStrictEqual([r("47").prodazhi, r("47").aktivy], [5.8, 4.4]);
  assert.deepStrictEqual([r("H").prodazhi, r("H").aktivy], [11.2, 4.2]);
});

test("подбор строки: самая подробная, разделы проигрывают группе с тем же кодом, «Всего» не подставляем", () => {
  const k = (o) => (N.najti(o, D.nagruzka) || {}).kod || null;
  assert.strictEqual(k("41.20"), "F");
  assert.strictEqual(k("46.90"), "46");
  assert.strictEqual(k("47.11"), "47");
  assert.strictEqual(k("49.10"), "49.1–49.2");
  assert.strictEqual(k("49.41"), "H");
  assert.strictEqual(k("35.11.1"), "35.1");
  assert.strictEqual(k("06.10"), "05–06");
  assert.strictEqual(k("10.71"), "10–12");
  assert.strictEqual(k("62.01"), "J");
  assert.strictEqual(k("69.10"), null); // раздел M — нормы нагрузки ФНС нет
  assert.strictEqual(k("64.19"), null); // K — нет
  assert.strictEqual(k(""), null);
  const r = (o) => (N.najti(o, D.rentabelnost.stroki) || {}).kod || null;
  assert.strictEqual(r("49.41"), "49.4");
  assert.strictEqual(r("72.19"), "72");
  assert.strictEqual(r("64.19"), "K");
  assert.strictEqual(r("71.12"), null);
});

test("ввод ОКВЭД", () => {
  assert.strictEqual(N.okvedIzVvoda("41.20"), "41.20");
  assert.strictEqual(N.okvedIzVvoda("4120"), "41.20");
  assert.strictEqual(N.okvedIzVvoda("ОКВЭД 46.90"), "46.90");
  assert.strictEqual(N.okvedIzVvoda("47.11.1"), "47.11.1");
  assert.strictEqual(N.okvedIzVvoda("46"), "46");
  assert.strictEqual(N.okvedIzVvoda("abc"), "");
  assert.strictEqual(N.chislo("50 000 000"), 50e6);
  assert.strictEqual(N.chislo("1 234,5"), 1234.5);
});

test("зелёный, жёлтый, красный — тексты § 3 Налогового юриста", () => {
  const z = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 8e6, rezhim: "osn" }, D);
  assert.strictEqual(z.st, "zelenyj");
  assert.match(z.tekst, /^Ваша нагрузка — 16,0%\. Средняя по отрасли — 15,0% \(раздел F «Строительство», ФНС, 2025 год\)/);
  assert.match(z.tekst, /Нагрузка не ниже отраслевой — по этому признаку налоговая компанию на проверку не отбирает\.$/);

  const y = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 4.9e6, rezhim: "osn" }, D);
  assert.strictEqual(y.st, "zheltyj");
  assert.match(y.tekst, /Ваша нагрузка — 9,8%\. Средняя по отрасли — 15,0%/);
  assert.match(y.tekst, /Разница: 5,2 п\. п\./);
  assert.match(y.tekst, /нет НДФЛ за работников, а в норме ФНС он есть/);
  assert.match(y.tekst, /один из 12 признаков при отборе на выездную проверку\.$/);
  const yN = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 4.9e6, rezhim: "osn", sNdfl: true }, D);
  assert.doesNotMatch(yN.tekst, /НДФЛ/);

  const k = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 0.55e6, rezhim: "osn" }, D);
  assert.strictEqual(k.st, "krasnyj");
  assert.match(k.tekst, /1,1%.*15,0%.*: в 14 раз ниже\./);
  assert.match(k.tekst, /первый из 12 признаков.*\(приказ ФНС № ММ-3-06\/333@\)\. Это не вывод о нарушении/);
  const k0 = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 0, rezhim: "osn" }, D);
  assert.strictEqual(k0.st, "krasnyj");
  assert.doesNotMatch(k0.tekst, /раз ниже|Infinity|NaN/);
});

test("ловушки: УСН не красим, доходы < 10 млн — не «красный», < 1 млн — «данных нет», нет нормы — без «Всего»", () => {
  const u = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 0.5e6, rezhim: "usn" }, D);
  assert.strictEqual(u.st, "usn");
  assert.strictEqual(u.norma, null);
  assert.match(u.tekst, /сравнивать с ней упрощенца некорректно — мы этого не делаем/);
  const m = N.ocenka({ okved: "41.20", dohody: 5e6, nalogi: 0.05e6, rezhim: "osn" }, D);
  assert.strictEqual(m.st, "zheltyj");
  const nd = N.ocenka({ okved: "41.20", dohody: 0.5e6, nalogi: 0, rezhim: "osn" }, D);
  assert.strictEqual(nd.st, "net-dannyh");
  assert.strictEqual(N.ocenka({ okved: "41.20", dohody: NaN, nalogi: 1, rezhim: "osn" }, D).st, "net-dannyh");
  const nn = N.ocenka({ okved: "69.10", dohody: 50e6, nalogi: 1e6, rezhim: "osn" }, D);
  assert.strictEqual(nn.st, "net-normy");
  assert.doesNotMatch(nn.tekst, /11,9/);
  assert.match(nn.tekst, /Отраслевой нормы для вашего вида деятельности ФНС не публикует/);
});

test("запрещённые слова — нигде в калькуляторе, справочнике и модуле", () => {
  const vse = [KALK, TABL, chitat("js/nagruzka.js")].join("\n").toLowerCase();
  for (const slovo of ["вас проверят", "группе риска", "группа риска", "гарантир", "безопасная нагрузка", "безопасной нагрузк", "нейросет", "искусственн"]) {
    assert.ok(!vse.includes(slovo), "запрещено: " + slovo);
  }
  for (const st of ["zelenyj", "zheltyj", "krasnyj", "usn", "net-normy", "net-dannyh"]) {
    assert.ok(KALK.includes("itog--" + st), "нет подписи состояния " + st);
  }
});

test("справочник собран из JSON (sobrat_nagruzka.py --check) и показывает все строки", () => {
  execFileSync("python3", [path.join(ROOT, "tests/sobrat_nagruzka.py"), "--check"], { stdio: "pipe" });
  const tr = (TABL.match(/<tbody>[\s\S]*?<\/tbody>/g) || []).map((t) => (t.match(/<tr/g) || []).length);
  assert.deepStrictEqual(tr, [45, 61]);
  assert.match(TABL, /<td>Строительство<\/td><td>раздел F<\/td><td><b>15,0%<\/b><\/td><td>14,4%<\/td><td>\+0,6 п\. п\.<\/td>/);
  assert.match(TABL, /<td>Добыча угля<\/td><td>05<\/td><td><b>убыток<\/b><\/td><td>убыток<\/td>/);
  assert.match(TABL, /Данные ФНС от 05\.05\.2026/);
});

test("страницы: SEO, ссылки, источники, без внешних скриптов, в sitemap и в разделе «Налоги»", () => {
  for (const [s, u] of [[KALK, "/nalogi/nagruzka/"], [TABL, "/nalogi/nagruzka-po-otraslyam-2025/"]]) {
    assert.ok(s.includes('<link rel="canonical" href="https://deloskop.ru' + u + '">'));
    assert.ok(s.includes('"BreadcrumbList"'));
    assert.ok(s.includes("base.garant.ru/414173177"));
    assert.ok(s.includes("ММ-3-06/333@"));
    assert.doesNotMatch(s, /<script[^>]+src="https?:/);
    assert.ok(chitat("sitemap.xml").includes("https://deloskop.ru" + u + "</loc>"));
  }
  assert.ok(KALK.includes('href="/nalogi/nagruzka-po-otraslyam-2025/"'));
  assert.ok(TABL.includes('href="/nalogi/nagruzka/"'));
  assert.ok(KALK.includes('<script src="/js/nagruzka.js"></script>'));
  assert.ok(KALK.includes("fetch('/data/fns-normy-2025.json')"));
  assert.ok(chitat("nalogi/index.html").includes('href="/nalogi/nagruzka/"'));
  assert.match(KALK, /региональных норм нет/);
});

test("лента: запись о калькуляторе нагрузки", () => {
  const L = JSON.parse(chitat("obnovleniya.json")).obnovleniya;
  const z = L.find((x) => x.id === "2026-10-02-7");
  assert.ok(z, "нет записи 2026-10-02-7");
  assert.ok(z.chto_proverit.some((c) => c.ssylka === "/nalogi/nagruzka/"));
});
