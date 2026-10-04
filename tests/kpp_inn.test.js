// [Ночные-3] kpp-inn-v1 — расшифровка ИНН и КПП по приказу ФНС от 26.06.2025 № ЕД-7-14/559@.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const K = require("../js/kpp-inn.js");
const ROOT = path.join(__dirname, "..");
const chitat = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const D = JSON.parse(chitat("data/kpp-inn.json"));

test("справочник: источник, редакция, сверка не старше 120 дней", () => {
  assert.match(D.istochnik.nazvanie, /ЕД-7-14\/559@/);
  assert.strictEqual(D.istochnik.v_sile_s, "2026-01-01");
  assert.match(D.istochnik.zamenil, /ММВ-7-6\/435@/);
  assert.match(D.regiony_istochnik.licenziya, /CC BY-SA 4\.0/);
  const dni = (Date.now() - Date.parse(D.sverka)) / 864e5;
  assert.ok(dni < 120, "справочник ИНН/КПП не сверяли " + Math.round(dni) + " дней — сверьте с приказом ФНС и обновите sverka");
  // дословно из Порядка — диапазоны причины и буквы в КПП
  assert.strictEqual(D.kpp.PP_rossijskaya, "от 01 до 50 (01 - по месту ее нахождения)");
  assert.strictEqual(D.kpp.PP_inostrannaya, "от 50 до 99");
  assert.match(D.kpp.PP, /заглавную букву латинского алфавита от А до Z/);
});

test("регионы: коды двузначные, без догадок для 90, 93–95, 99", () => {
  const k = Object.keys(D.regiony);
  assert.ok(k.length >= 80);
  k.forEach((x) => assert.match(x, /^\d\d$/));
  ["90", "93", "94", "95", "99"].forEach((x) => assert.ok(!(x in D.regiony), x));
  assert.strictEqual(D.regiony["77"], "Москва");
  assert.strictEqual(D.regiony["50"], "Московская область");
});

test("КПП: основной, другое основание, буква, ошибки", () => {
  const a = K.kpp("770701001", D.regiony);
  assert.ok(a.ok && a.osnovnoj);
  assert.strictEqual(a.region, "Москва");
  assert.strictEqual(a.nnnn, "7707");
  const b = K.kpp("7707 02 001");
  assert.ok(b.ok && !b.osnovnoj);
  assert.match(b.prichina, /ст\. 83 НК РФ/);
  const c = K.kpp("7707ab001");
  assert.ok(c.ok);
  assert.strictEqual(c.pp, "AB");
  assert.match(c.prichina, /латинской букв/);
  assert.ok(!K.kpp("77070100").ok);
  assert.ok(!K.kpp("77A701001").ok, "буква не на 5–6 месте");
  assert.ok(!K.kpp("770700001").ok, "00 — нет в Порядке");
  assert.match(K.kpp("770751001").prichina, /иностранн/);
  assert.match(K.kpp("770750001").prichina, /и к российским, и к иностранным/);
});

test("ИНН: контрольное число, тип, регион; 3–4 цифры не называем инспекцией нового ИНН", () => {
  const i = K.inn("7707083893", D.regiony);
  assert.ok(i.ok);
  assert.strictEqual(i.tip, "organizaciya");
  assert.strictEqual(i.region, "Москва");
  assert.ok(!K.inn("7707083894").ok);
  assert.ok(!K.inn("12345").ok);
  const s = chitat("js/kpp-inn-stranica.js");
  assert.ok(s.includes("с 2026 года — индекс ФНС"));
});

test("Проверь счёт: КПП с буквой читается из текста, расхождение объяснено", () => {
  const h = chitat("proverit-schet/index.html");
  assert.ok(h.includes('<script src="/js/kpp-inn.js" defer></script>'));
  assert.ok(chitat("nalogi/kak-proverit-schet-pered-oplatoj/index.html").includes('href="/nalogi/chto-oznachayut-cifry-inn-i-kpp/"'));
  assert.ok(h.includes("(\\d{4}[0-9A-Z]{2}\\d{3})(?![0-9A-Z])/i"));
  assert.ok(!/КПП\[\^\\d\]\{0,12\}\(\\d\{9\}\)/.test(h), "старое правило «9 цифр» осталось");
  assert.ok(!/КПП\[\^\\d\]\{0,12\}\(\\d\{9\}\)/.test(chitat("js/smena.js")), "smena.js: старое правило «9 цифр»");
  const re = /КПП[^\d]{0,12}(\d{4}[0-9A-Z]{2}\d{3})(?![0-9A-Z])/i;
  assert.strictEqual("ИНН 7707083893, КПП 7707AB001, р/с".match(re)[1], "7707AB001");
  assert.strictEqual("КПП: 770701001".match(re)[1], "770701001");
  const t = K.strokaRashozhdeniya("770702001", "770701001");
  assert.match(t, /причиной «02»/);
  assert.match(t, /ИНН один на все КПП/);
  assert.match(K.strokaRashozhdeniya("500101001", "770701001"), /после переезда/);
});

test("страница: в хабе, sitemap, FAQ, источники; без обещаний", () => {
  const p = chitat("nalogi/chto-oznachayut-cifry-inn-i-kpp/index.html");
  // карточку в хабе ставит posle_kpp_inn_v1.py при выкладке (строку карточек правит и statusy-egryul-v1)
  assert.ok(chitat("nalogi/index.html").includes('href="/nalogi/chto-oznachayut-cifry-inn-i-kpp/"'), "нет карточки в хабе /nalogi/ — запустите posle_kpp_inn_v1.py");
  assert.ok(chitat("sitemap.xml").includes("https://deloskop.ru/nalogi/chto-oznachayut-cifry-inn-i-kpp/"));
  assert.ok(p.includes("ЕД-7-14/559@") && p.includes("ст. 83 НК РФ") && p.includes("CC BY-SA 4.0"));
  assert.ok(p.includes('"@type": "FAQPage"'));
  const vid = p.slice(p.indexOf("<main"), p.indexOf("</main>")).replace(/<[^>]+>/g, " ");
  assert.ok(!/гарант|надёжн|100\s?%|лучш/i.test(vid));
});
