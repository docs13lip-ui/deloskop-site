// «Скорая 115-ФЗ»: узнать вид и основание ограничения (skoraya-osnovanie-v1, [Ночные запуски] 05.10.2026).
// ТЗ [Продукт] 04.10 разд. 3; тексты [Право] 04.10 12:30 (ИН-01-59/98) и разд. 2 (ИН-03-45/32 — «по договору»).
// Письма сверены 05.10.2026 по consultant.ru: cons_doc_LAW_513007, cons_doc_LAW_545360.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(ROOT, "skoraya-115-fz/engine.js"), "utf8");
const S = require(path.join(ROOT, "skoraya-115-fz/engine.js"));
const plain = (s) => s.replace(/&nbsp;/g, " ").replace(/ /g, " ").replace(/&#8209;/g, "-");
const STATYA = plain(fs.readFileSync(path.join(ROOT, "115-fz/zablokirovali-schet-chto-delat/index.html"), "utf8"));
const CIFRY = plain(fs.readFileSync(path.join(ROOT, "115-fz/v-cifrah/index.html"), "utf8"));

test("unknown: первым делом — спросить вид и основание (ИН-01-59/98)", () => {
  assert.ok(js.includes("ИН-01-59/98"));
  const sc = S.SCENARIOS ? S.SCENARIOS.unknown : null;
  if (sc) assert.ok(plain(sc.what).includes("на каком основании: 115-ФЗ или 161-ФЗ"));
  const L = plain(S.buildLetter("unknown", {}));
  assert.ok(L.includes("Прошу письменно сообщить, какое ограничение введено"), "письмо в банк начинается с запроса основания");
  assert.ok(L.indexOf("Прошу письменно сообщить") < L.indexOf("Представляем документы"), "запрос — до пояснения");
  assert.ok(L.includes("№ ИН-01-59/98"));
});

test("запрос основания — только в сценарии unknown: в других письмах его нет", () => {
  for (const sc of ["otkaz", "dbo", "zapros", "rastorzhenie", "zsk"]) {
    assert.ok(!plain(S.buildLetter(sc, {})).includes("Прошу письменно сообщить, какое ограничение"), sc);
  }
});

test("dbo: письмо об ЭСП — «по договору», не «по правилам о переводах»", () => {
  const what = plain(S.SCENARIOS.dbo.what);
  assert.ok(what.includes("ИН-03-45/32"));
  assert.ok(!what.includes("по правилам о"), "вводная [Продукт] снята правкой [Право]: письмо — о приостановлении по договору");
  assert.ok(what.includes("приостановил интернет-банк или карту по договору"));
});

test("рядом с каждой ссылкой на ИН-03-45/32 — «рекомендация, а не обязанность»", () => {
  const bezIstochnikov = (t) => { const i = t.indexOf('<section class="src">'); return i === -1 ? t : t.slice(0, i); };
  const ekran = Object.keys(S.SCENARIOS).map((k) => plain(S.SCENARIOS[k].what)).join("\n");
  for (const [imya, t] of [["Скорая", ekran], ["статья", bezIstochnikov(STATYA)], ["v-cifrah", bezIstochnikov(CIFRY)]]) {
    let i = -1, n = 0;
    while ((i = t.indexOf("ИН-03-45/32", i + 1)) !== -1) {
      n++;
      assert.ok(/рекомендация, а не\s+обязанность/.test(t.slice(Math.max(0, i - 200), i)), imya + ": нет оговорки у ссылки № " + n);
    }
    assert.ok(n > 0, imya + ": ссылка на письмо есть");
  }
});

test("статья: H3 и FAQ «Счёт разблокировали, а переводы не проходят»", () => {
  assert.ok(STATYA.includes('id="razblokirovali-a-perevody-ne-prohodyat"'));
  assert.ok(STATYA.includes("Счёт разблокировали, а переводы не проходят — что делать?"));
  assert.ok(STATYA.includes('"name": "Счёт разблокировали, а переводы не проходят — что делать?"'), "вопрос — в FAQPage");
  assert.ok(STATYA.includes("cons_doc_LAW_513007/") && STATYA.includes("cons_doc_LAW_545360/"), "оба письма — в «Источниках»");
  assert.ok(!/гарантир|обязан вернуть доступ|обязан сделать это/.test(STATYA), "не превращаем рекомендацию в обязанность");
});
