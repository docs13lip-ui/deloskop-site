// demo-vitrina-v1: сторож страницы «Как это работает» (/kak-rabotaet/) и ссылок на неё из витрины главной.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const K = path.join(__dirname, "..");
const s = fs.readFileSync(path.join(K, "kak-rabotaet/index.html"), "utf8");
const main = s.slice(s.indexOf("<main"), s.indexOf("</main>"));
const pokazy = [...main.matchAll(/<section class="kr-d" id="([^"]+)"[\s\S]*?<\/section>/g)];

test("восемь показов: Проверка по ИНН, Паспорт, Досье сделки, Кому вы платите, Проверь счёт, Наличные, Скорая, Слежение", () => {
  assert.deepStrictEqual(pokazy.map((m) => m[1]), ["proverka", "pasport", "dosje", "platite", "schet", "nalichnye", "skoraya", "slezhenie"]);
  const oglav = [...main.matchAll(/<ul class="kr-oglav">([\s\S]*?)<\/ul>/g)][0][1];
  assert.deepStrictEqual([...oglav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]), pokazy.map((m) => m[1]), "оглавление = показы");
});

// demo-vitrina-v2: цифры показов — из «Посмотреть на примере» самих продуктов; разошлись — правьте обе стороны
test("цифры показов совпадают с примерами продуктов", () => {
  const blok = (id) => pokazy.find((m) => m[1] === id)[0].replace(/&nbsp;|\u00a0/g, " ");
  const pl = blok("platite");
  assert.strictEqual(4880000 + 1830000 + 366000 + 150000 + 95000, 7321000);
  for (const x of ["7 321 000 ₽", "4 880 000 ₽ · 67 %", "1 830 000 ₽ · 25 %", "366 000 ₽ · 5 %", "от 1 056 000 до 2 632 000 ₽", "97 %"]) assert.ok(pl.includes(x), x);
  const vyp = fs.readFileSync(path.join(K, "kontragenty-iz-vypiski/index.html"), "utf8");
  for (const x of ["'2440000.00'", "'1220000.00'", "'1830000.00'", "'366000.00'", "'150000.00'", "'95000.00'"]) assert.ok(vyp.includes(x), "пример выписки: " + x);
  assert.strictEqual(2440000 + 1220000 + 1220000, 4880000, "«Пример-Бетон» — три платежа");
  const nal = blok("nalichnye");
  for (const x of ["41 %", "33 %", "0,5 %", "0,9 %", "3 024 091 ₽"]) assert.ok(nal.includes(x), x);
  const sk = blok("skoraya");
  for (const x of ["20.10.2026", "3 000 000 ₽", "27 окт.", "6 нояб.", "11 нояб.", "146 тыс. ₽", "п. 13.4 ст. 7"]) assert.ok(sk.includes(x), x);
  // 3 000 000 ₽ в месяц → в рабочий день 146 тыс. ₽ (как в Скорой: WD_PER_MONTH = 247 / 12)
  assert.match(fs.readFileSync(path.join(K, "skoraya-115-fz/engine.js"), "utf8"), /WD_PER_MONTH = 247 \/ 12/);
  assert.strictEqual(Math.round(3000000 / (247 / 12) / 1000), 146);
});

// demo-vitrina-v3: показ «Паспорт компании» — цифры образца Паспорта (pasport/engine.js и /pasport/kontragent/?demo=1)
test("Паспорт: цифры и метки — как в образце Паспорта", () => {
  const b = pokazy.find((m) => m[1] === "pasport")[0].replace(/&nbsp;|\u00a0/g, " ");
  for (const x of ["Предварительно: есть замечания", "11 компаний", "на 01.10.2026", "6 из 12 разделов", "61 400 000 ₽", "1 100 000 ₽", "Собрать Паспорт"]) assert.ok(b.includes(x), x);
  for (const x of ["kr-m--ist", "kr-m--ras", "kr-m--net"]) assert.ok(b.includes(x), x);
  const eng = fs.readFileSync(path.join(K, "pasport/engine.js"), "utf8");
  assert.match(eng, /по адресу зарегистрировано 11 компаний/);
  assert.match(eng, /id: 'tax_debt'[^}]*detail: 'нет'[^}]*as_of: '2026-10-01'/);
  assert.match(fs.readFileSync(path.join(K, "pasport/kontragent/index.html"), "utf8"), /year:2025,value:61400000/);
  // предел аванса образца: две недели выручки (÷ 26), одно замечание → половина, вниз до сотен тысяч
  assert.strictEqual(Math.floor(61400000 / 26 / 2 / 100000) * 100000, 1100000);
  // витрина: экспонат «Паспорт» ведёт на показ Паспорта, а не на досье
  assert.ok(fs.readFileSync(path.join(K, "index.html"), "utf8").includes('href="/kak-rabotaet/#pasport">Как это работает'));
});

test("[data-zam] — только у элементов на смену ушедшему (не на первом шаге)", () => {
  for (const [blok, id] of pokazy) for (const m of blok.matchAll(/data-ot="(\d+)"[^>]*data-zam/g)) assert.ok(+m[1] > 1, id);
});

test("у показа: 3–6 шагов с длительностью, экран скрыт от читалки, «Повторить» и переход к своей проверке", () => {
  for (const [blok, id] of pokazy) {
    const shagi = [...blok.matchAll(/<button type="button" data-t="(\d+)">/g)];
    assert.ok(shagi.length >= 3 && shagi.length <= 6, id + ": шагов " + shagi.length);
    shagi.forEach((m) => assert.ok(+m[1] >= 1500 && +m[1] <= 6000, id + ": шаг " + m[1] + " мс"));
    assert.match(blok, /<div class="kr-ekr" aria-hidden="true">/, id);
    assert.match(blok, /data-povtor>Повторить</, id);
    assert.match(blok, /href="\/[^"]*" data-demo-go>(Проверить сво[йю]|Открыть) /, id);
    const ot = [...blok.matchAll(/data-ot="(\d+)"/g)].map((m) => +m[1]);
    assert.ok(Math.max(...ot) === shagi.length, id + ": последний шаг экрана = последний шаг списка");
  }
});

test("только вымышленная компания, без «!», ИИ и обещаний исхода", () => {
  const tekst = main.replace(/<[^>]+>/g, " ");
  const inn = [...tekst.matchAll(/(?<!\d)\d{10}(?!\d)|(?<!\d)\d{12}(?!\d)/g)].map((m) => m[0]);
  assert.ok(inn.length > 0 && inn.every((x) => x === "0000000000"), "ИНН в показах: " + inn.join(", "));
  assert.match(tekst, /ООО(&nbsp;|\s| )«Пример»/);
  assert.doesNotMatch(tekst, /!/);
  assert.doesNotMatch(tekst, /(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)|нейросет|гарантир/i);
});

test("свои скрипты и стили — без чужих плееров и счётчиков", () => {
  for (const m of s.matchAll(/<(?:script|link|iframe|video)[^>]+(?:src|href)="([^"]+)"/g)) {
    assert.ok(m[1].startsWith("/") || m[1].startsWith("https://deloskop.ru/"), m[1]);
  }
  assert.doesNotMatch(s, /<iframe|<video/);
});

test("страница в sitemap, а витрина ведёт на существующие показы", () => {
  assert.match(fs.readFileSync(path.join(K, "sitemap.xml"), "utf8"), /<loc>https:\/\/deloskop\.ru\/kak-rabotaet\/<\/loc>/);
  const v = JSON.parse(fs.readFileSync(path.join(K, "partials/vitrina.json"), "utf8"));
  const ids = new Set(v.eksponaty.filter((x) => x.status !== "razrabotka").map((x) => x.id));
  const kak = [...main.matchAll(/<section class="kr-d" id="([^"]+)" data-eksponat="([^"]+)"/g)];
  assert.strictEqual(kak.length, pokazy.length, "у каждого показа — свой экспонат витрины");
  kak.forEach((m) => assert.ok(ids.has(m[2]), m[1] + " → " + m[2]));
  const glav = fs.readFileSync(path.join(K, "index.html"), "utf8");
  // у экспоната несколько показов — ссылка на первый (vypiska → «Кому вы платите», а не «Проверь счёт»)
  const pervyj = new Map();
  for (const m of kak) if (!pervyj.has(m[2])) pervyj.set(m[2], m[1]);
  for (const [eks, id] of pervyj) assert.ok(glav.includes('href="/kak-rabotaet/#' + id + '">Как это работает'), eks + " → " + id);
  assert.strictEqual((glav.match(/href="\/kak-rabotaet\/#/g) || []).length, pervyj.size, "по одной ссылке на экспонат");
});
