// demo-vitrina-v1: сторож страницы «Как это работает» (/kak-rabotaet/) и ссылок на неё из витрины главной.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const K = path.join(__dirname, "..");
const s = fs.readFileSync(path.join(K, "kak-rabotaet/index.html"), "utf8");
const main = s.slice(s.indexOf("<main"), s.indexOf("</main>"));
const pokazy = [...main.matchAll(/<section class="kr-d" id="([^"]+)"[\s\S]*?<\/section>/g)];

test("три показа: Проверка по ИНН, Досье сделки, Проверь счёт", () => {
  assert.deepStrictEqual(pokazy.map((m) => m[1]), ["proverka", "dosje", "schet"]);
});

test("у показа: 3–6 шагов с длительностью, экран скрыт от читалки, «Повторить» и переход к своей проверке", () => {
  for (const [blok, id] of pokazy) {
    const shagi = [...blok.matchAll(/<button type="button" data-t="(\d+)">/g)];
    assert.ok(shagi.length >= 3 && shagi.length <= 6, id + ": шагов " + shagi.length);
    shagi.forEach((m) => assert.ok(+m[1] >= 1500 && +m[1] <= 6000, id + ": шаг " + m[1] + " мс"));
    assert.match(blok, /<div class="kr-ekr" aria-hidden="true">/, id);
    assert.match(blok, /data-povtor>Повторить</, id);
    assert.match(blok, /href="\/[^"]*" data-demo-go>Проверить свой/, id);
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
  for (const m of kak) assert.ok(glav.includes('href="/kak-rabotaet/#' + m[1] + '">Как это работает'), m[1]);
});
