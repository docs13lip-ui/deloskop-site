// «Поставщик прислал новые реквизиты?» (js/smena.js) — сравнение реквизитов в браузере.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../js/smena.js");

// Сбербанк: БИК 044525225, корсчёт 30101810400000000225; Альфа-Банк: 044525593 / 30101810200000000593.
function rs(bik, pref, hvost) { // подобрать контрольную цифру счёта: pref(5) + 810 + k + hvost(11)
  for (let k = 0; k < 10; k++) {
    const a = pref + "810" + k + hvost;
    const s = bik.slice(-3) + a; const w = [7, 1, 3]; let x = 0;
    for (let i = 0; i < s.length; i++) x += +s[i] * w[i % 3];
    if (x % 10 === 0) return a;
  }
}
const SB = "044525225", AL = "044525593";
const ORG_SB = rs(SB, "40702", "00000012345");
const ORG_AL = rs(AL, "40702", "00000067890");
const FIZ_AL = rs(AL, "40817", "00000067890");
const IP_AL = rs(AL, "40802", "00000067890");
const BYLO = `ООО «Ромашка», ИНН 7707083893, КПП 773601001, р/с ${ORG_SB}, БИК ${SB}, к/с 30101810400000000225`;

test("одинаковые реквизиты — зелёный", () => {
  const r = S.sravnit(BYLO, BYLO.replace(/ /g, "\n"));
  assert.strictEqual(r.uroven, "ok");
  assert.match(r.zagolovok, /совпадают/);
});

test("тот же ИНН, новый банк и счёт — жёлтый, просим подтвердить голосом", () => {
  const r = S.sravnit(BYLO, `ИНН 7707083893 р/с ${ORG_AL.replace(/(\d{4})/g, "$1 ")} БИК ${AL} к/с 30101810200000000593`);
  assert.strictEqual(r.uroven, "warn");
  assert.match(r.tekst, /по номеру из договора/);
  assert.ok(r.stroki.some((x) => x.pole === "БИК банка" && x.uroven === "warn"));
});

test("другой ИНН получателя — красный", () => {
  const r = S.sravnit(BYLO, `ИНН 7736050003 р/с ${ORG_AL} БИК ${AL}`);
  assert.strictEqual(r.uroven, "bad");
  assert.ok(r.stroki.some((x) => x.pole === "ИНН получателя" && x.uroven === "bad"));
});

test("личный счёт человека и счёт ИП при ИНН организации — красный", () => {
  assert.strictEqual(S.vidScheta(FIZ_AL), "fiz");
  assert.strictEqual(S.vidScheta(IP_AL), "ip");
  assert.strictEqual(S.vidScheta(ORG_AL), "org");
  assert.strictEqual(S.sravnit(BYLO, `ИНН 7707083893 р/с ${FIZ_AL} БИК ${AL}`).uroven, "bad");
  assert.strictEqual(S.sravnit(BYLO, `ИНН 7707083893 р/с ${IP_AL} БИК ${AL}`).uroven, "bad");
});

test("изменённая цифра в счёте ловится ключом", () => {
  const plohoj = ORG_AL.slice(0, 19) + ((+ORG_AL[19] + 1) % 10);
  const r = S.sravnit(BYLO, `ИНН 7707083893 р/с ${plohoj} БИК ${AL}`);
  assert.strictEqual(r.uroven, "bad");
  assert.ok(r.stroki.some((x) => x.pole === "Расчётный счёт" && /ключу/.test(x.tekst)));
});

test("пустые поля — честная подсказка, без вердикта", () => {
  assert.strictEqual(S.sravnit("", BYLO).uroven, "none");
  assert.strictEqual(S.sravnit(BYLO, "просто текст").uroven, "none");
});

test("страница: блок #smena, скрипт, ссылка из результата, без обещаний, sitemap", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "proverit-schet", "index.html"), "utf8");
  assert.match(h, /id="smena"/);
  assert.match(h, /<script src="\/js\/smena\.js" defer><\/script>/);
  assert.match(h, /href="#smena"/);
  const blok = h.split('id="smena"')[1].split("</section>")[0];
  assert.doesNotMatch(blok, /гарантир|100\s*%|безопасно платить/i);
  assert.match(blok, /никуда не&nbsp;отправляются/);
  const js = fs.readFileSync(path.join(__dirname, "..", "js", "smena.js"), "utf8");
  assert.doesNotMatch(js, /innerHTML/);
  const sm = fs.readFileSync(path.join(__dirname, "..", "sitemap.xml"), "utf8");
  assert.match(sm, /proverit-schet\/<\/loc><lastmod>2026-10-01/);
});
