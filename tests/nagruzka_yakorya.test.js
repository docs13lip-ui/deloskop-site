// nagruzka-yakorya-v1: у каждой строки таблиц ФНС на /nalogi/nagruzka-po-otraslyam-2025/ — свой якорь;
// карточки /company/ и калькулятор /nalogi/nagruzka/ ведут прямо на строку отрасли (ТЗ [Маркетинг] 03.10, разд. 2.1).
// node --test tests/nagruzka_yakorya.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const N = require("../js/nagruzka.js");

const ROOT = path.join(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fns-normy-2025.json"), "utf8"));
const chitat = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TABL = chitat("nalogi/nagruzka-po-otraslyam-2025/index.html");
const KALK = chitat("nalogi/nagruzka/index.html");
const ids = [...TABL.matchAll(/<tr id="([^"]+)"/g)].map((m) => m[1]);

test("справочник: якорь у каждой строки обеих таблиц, без повторов", () => {
  assert.strictEqual(ids.length, D.nagruzka.length + D.rentabelnost.stroki.length);
  assert.strictEqual(new Set(ids).size, ids.length, "повтор id");
  for (const s of D.nagruzka) assert.ok(ids.includes(N.yakor(s.kod)), s.kod);
  for (const s of D.rentabelnost.stroki) assert.ok(ids.includes(N.yakor(s.kod, "r")), s.kod);
  for (const id of ids) assert.match(id, /^[nr]-[0-9a-z]+(-[0-9a-z]+)*$/);
  assert.strictEqual(N.yakor("ВСЕГО"), "n-vsego");
  assert.strictEqual(N.yakor("35.1"), "n-35-1");
  assert.strictEqual(N.yakor("49.1–49.2"), "n-49-1-49-2");
  assert.strictEqual(N.yakor("F", "r"), "r-f");
  assert.match(TABL, /table\.normy tr:target td\{background:/);
  assert.match(TABL, /table\.normy tr\{scroll-margin-top:/);
});

test("якорь одинаков в JS, сборщике таблицы и генераторе карточек", () => {
  const kody = JSON.stringify([...new Set([...D.nagruzka, ...D.rentabelnost.stroki].map((s) => s.kod))]);
  const py = execFileSync("python3", ["-c",
    "import json,sys;sys.path.insert(0,'tests');import sobrat_nagruzka as S,kartochka_render as K;" +
    "k=json.loads(sys.argv[1]);print(json.dumps([[S.yakor(x),K.yakor_normy(x),S.yakor(x,'r')] for x in k]))", kody],
  { cwd: ROOT, encoding: "utf8" });
  const otv = JSON.parse(py);
  JSON.parse(kody).forEach((kod, i) => {
    assert.strictEqual(otv[i][0], N.yakor(kod), kod);
    assert.strictEqual(otv[i][1], N.yakor(kod), kod);
    assert.strictEqual(otv[i][2], N.yakor(kod, "r"), kod);
  });
});

test("карточки /company/: ссылка «Таблица ФНС» — на существующую строку, старого #nagruzka нет", () => {
  const papka = path.join(ROOT, "company");
  let n = 0;
  for (const d of fs.readdirSync(papka)) {
    const f = path.join(papka, d, "index.html");
    if (!/^\d{10}-/.test(d) || !fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    const m = t.match(/<p class="small co-otr">.*?<a href="\/nalogi\/nagruzka-po-otraslyam-2025\/#([^"]+)">/s);
    if (!m) continue;
    n++;
    assert.ok(ids.includes(m[1]), d + ": нет строки #" + m[1]);
  }
  assert.ok(n >= 10, "карточек с отраслью: " + n);
});

test("калькулятор: ссылка на строку отрасли — только когда есть норма", () => {
  assert.match(KALK, /data-stroka-p hidden><a href="\/nalogi\/nagruzka-po-otraslyam-2025\/#nagruzka" data-goal="nagruzka_stroka">/);
  const r = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 2e6, sNdfl: false, rezhim: "osn" }, D);
  assert.strictEqual(r.ssylka, "/nalogi/nagruzka-po-otraslyam-2025/#n-f");
  assert.ok(ids.includes("n-f"));
  const usn = N.ocenka({ okved: "41.20", dohody: 50e6, nalogi: 2e6, rezhim: "usn" }, D);
  assert.strictEqual(usn.ssylka, null);
  const net = N.ocenka({ okved: "72.19", dohody: 50e6, nalogi: 2e6, rezhim: "osn" }, D);
  assert.strictEqual(net.ssylka, null);
});
