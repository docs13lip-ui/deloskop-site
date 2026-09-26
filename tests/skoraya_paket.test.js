// «Скорая под ключ» (#paket на /skoraya-115-fz/, п. 6): состав 14 пунктов, оговорка, цена только из tarify.json,
// токены блока = ds.css, режим «разовый продукт» в js/schet.js. node --test tests/*.test.*
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const R = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const S = require("../js/schet.js");
const D = JSON.parse(R("tarify/tarify.json"));
const html = R("skoraya-115-fz/index.html");
const blok = html.slice(html.indexOf('<section class="pkg'), html.indexOf("</section>\n\n<section class=\"more"));
const tekst = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const NB = /[  ]/g;

// Редакция Юриста 115-ФЗ (claude/Скорая_под_ключ_v2.md §2а). Меняется только через юриста.
const OGOVORKA = "Важно. Документы — черновики, сформированные автоматически по данным, которые вы указали. Это не индивидуальная консультация юриста, не представительство и не гарантия исхода. Решение принимают банк, Банк России, межведомственная комиссия или суд. Перед подачей в суд покажите документы юристу.";
const FIT = "Какие документы из списка вы получите, зависит от вашей ситуации: например, черновик иска нужен не всем, а для красной зоны ЗСК путь один — межведомственная комиссия.";
const PUNKTY = ["Ответ на запрос банка.", "Заявление в банк об устранении оснований отказа.",
  "Заявление в межведомственную комиссию при Банке России.", "Заявление о закрытии счёта и переводе остатка.",
  "Претензия о возврате заградительной комиссии или «штрафа за 115-ФЗ».", "Обращение в Банк России.", "Черновик иска.",
  "Разбор выписки глазами банка.", "Проверка крупнейших контрагентов.", "Шаблоны пояснений.",
  "Памятка «Отключили интернет-банк».", "Календарь ваших сроков.", "Одна доработка пакета.", "План на 3 месяца."];

test("блок #paket стоит после плана и до «Разобраться подробнее»", () => {
  const a = html.indexOf('id="out"'), b = html.indexOf('id="paket"'), c = html.indexOf('class="more');
  assert.ok(a > 0 && a < b && b < c);
});

test("14 пунктов подряд, группы 7 / 4 / 3, start = 1, 8, 12", () => {
  const n = [...blok.matchAll(/<span class="pkg-item__n" aria-hidden="true">(\d+)<\/span>/g)].map((m) => +m[1]);
  assert.deepStrictEqual(n, Array.from({ length: 14 }, (_, i) => i + 1));
  const gr = blok.split('<section class="pkg__group"').slice(1).map((g) => (g.match(/class="pkg-item"/g) || []).length);
  assert.deepStrictEqual(gr, [7, 4, 3]);
  assert.deepStrictEqual([...blok.matchAll(/<ol class="pkg__list" start="(\d+)">/g)].map((m) => +m[1]), [1, 8, 12]);
  const t = [...blok.matchAll(/<b class="pkg-item__t">([^<]+)<\/b>/g)].map((m) => m[1].replace(/&nbsp;/g, " ").replace(NB, " "));
  assert.deepStrictEqual(t, PUNKTY);
});

test("оговорка юриста — полным текстом в блоке и ссылкой у кнопки; «что получите» — как у юриста", () => {
  const leg = blok.match(/<aside class="pkg__legal" id="pkg-legal"[^>]*>([\s\S]*?)<\/aside>/);
  assert.ok(leg); assert.strictEqual(tekst(leg[1]), OGOVORKA);
  assert.ok(tekst(blok).includes(FIT));
  const card = blok.match(/<aside class="pkg__card"[\s\S]*?<\/aside>/)[0];
  assert.ok(card.includes('href="#pkg-legal"') && card.includes("не гарантия исхода"));
});

test("цена — только из tarify.json, в узлах data-cena; других сумм с ₽ в блоке нет", () => {
  const p = D.skoraya_pod_klyuch;
  assert.ok(p && p.razovo === true && p.cena_rub === 4990, "цена согласована владельцем 26.09: 4 990 ₽");
  const uzly = [...blok.matchAll(/<span data-cena="skoraya_pod_klyuch">([^<]*)<\/span>/g)].map((m) => m[1].replace(NB, " "));
  assert.strictEqual(uzly.length, 2);
  uzly.forEach((u) => assert.strictEqual(u, p.cena_rub.toLocaleString("ru-RU").replace(NB, " ")));
  const bez = blok.replace(/<span data-cena="skoraya_pod_klyuch">[^<]*<\/span>/g, "");
  assert.ok(!/\d[\d\s  ]*(&nbsp;|\s)?₽/.test(bez), "цифры с ₽ вне data-cena");
  assert.ok(!/cena_rekomendaciya/.test(html));
});

test("кнопки пакета: data-produkt есть в tarify.json и ссылка без JS ведёт на /schet/", () => {
  const kn = [...blok.matchAll(/<a class="pkg__cta[^"]*" href="([^"]+)" data-schet data-produkt="([a-z_]+)"/g)];
  assert.strictEqual(kn.length, 2);
  kn.forEach((m) => { assert.ok(D[m[2]] && D[m[2]].razovo); assert.strictEqual(m[1], "/schet/?produkt=" + m[2]); });
  assert.ok(html.includes('<script src="/js/schet.js" defer></script>'));
  assert.ok(R("schet/index.html").includes("produkt:q.get('produkt')"));
});

test("в блоке нет таймеров и «срочно», красного и своих hex-цветов вне токенов", () => {
  assert.ok(!/срочно|успейте|осталось \d/i.test(tekst(blok)));
  const css = R("css/paket.css");
  const telo = css.replace(/^\.pkg\{[\s\S]*?\n\}/m, "");
  assert.ok(!/#[0-9A-Fa-f]{3,8}\b/.test(telo), "цвета — только токенами");
});

test("токены блока совпадают с /css/ds.css", () => {
  const ds = R("css/ds.css"), pk = R("css/paket.css");
  const root = ds.match(/:root\{([\s\S]*?)\n\}/)[1];
  const tok = (s) => Object.fromEntries([...s.matchAll(/(--[a-z0-9-]+):([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const a = tok(root), b = tok(pk.match(/^\.pkg\{([\s\S]*?)\n\}/m)[1]);
  for (const k of Object.keys(b)) assert.strictEqual(b[k], a[k], "токен " + k);
});

test("schet.js: разовый продукт — сумма, текст заявки и письмо", () => {
  const p = D.skoraya_pod_klyuch;
  assert.strictEqual(S.produktIz(D, "skoraya_pod_klyuch"), p);
  assert.strictEqual(S.produktIz(D, "pro"), null);
  assert.strictEqual(S.summa(D, "skoraya_pod_klyuch", "razovo"), 4990);
  assert.strictEqual(S.summa(D, "pro", "god"), D.tarify.find((t) => t.id === "pro").god);
  const z = { produkt: "skoraya_pod_klyuch", tarif: "skoraya_pod_klyuch", srok: "razovo", inn: "7707083893", email: "a@b.ru" };
  const t = S.tekstZayavki(z, D).replace(NB, " ");
  assert.ok(t.includes("Услуга: Скорая под ключ, разовый платёж") && t.includes("4 990") && t.includes("7707083893"));
  const m = S.mailtoZayavki(z, D);
  assert.ok(m.startsWith("mailto:help@deloskop.ru?subject=") && decodeURIComponent(m).includes("Счёт: Скорая под ключ"));
});
