// kak-rabotaet-sverka-v1: цифры показов /kak-rabotaet/ считаются ДВИЖКАМИ самих продуктов на их же примерах.
// kak_rabotaet.test.js проверяет, что цифры есть в показе; этот — что продукт на своём примере выдаёт те же цифры.
// Поменяли пример или формулу в продукте — показ разойдётся, и сторож скажет, какую строку показа поправить.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const K = path.join(__dirname, "..");
const s = fs.readFileSync(path.join(K, "kak-rabotaet/index.html"), "utf8");
const main = s.slice(s.indexOf("<main"), s.indexOf("</main>"));
// текст показа без тегов, неразрывные пробелы и дефисы — обычными
const blok = (id) => {
  const m = main.match(new RegExp('<section class="kr-d" id="' + id + '"[\\s\\S]*?</section>'));
  assert.ok(m, "нет показа #" + id);
  // печатаемые по шагу значения (data-pech) — тоже текст показа
  return m[0].replace(/<b data-pech="([^"]*)"><\/b>/g, " $1 ").replace(/<[^>]+>/g, " ").replace(/&nbsp;| | /g, " ").replace(/&#8209;|‑/g, "-").replace(/\s+/g, " ");
};
const ryad = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const rub = (n) => ryad(n) + " ₽";
// доля как в показах: от 10 % — целое, ниже — одна цифра после запятой; знак — через пробел (по «Ководству» показов)
const dolya = (x) => { const v = x * 100; return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toString().replace(".", ",") + " %"; };
const est = (t, x, chto) => assert.ok(t.includes(x), chto + ": в показе нет «" + x + "»");

test("«Кому вы платите»: движок выписки на примере продукта даёт цифры показа", () => {
  const E = require(path.join(K, "kontragenty-iz-vypiski/engine.js"));
  const h = fs.readFileSync(path.join(K, "kontragenty-iz-vypiski/index.html"), "utf8");
  const nach = "$('demo').onclick=function(){";
  const a = h.indexOf(nach), b = h.indexOf("state.parsed=[E.parse(t)]", a);
  assert.ok(a > 0 && b > a, "пример выписки не найден в kontragenty-iz-vypiski/index.html");
  const t = new Function(h.slice(a + nach.length, b) + ";return t;")();
  const r = E.analyze([E.parse(t)], { regime: "osn" }); // режим по умолчанию у продукта — ОСН
  const pl = blok("platite");
  est(pl, "Поставщикам ушло " + rub(r.totals.supplier), "итог");
  const top = r.suppliers.slice(0, 3);
  for (const x of top) est(pl, x.name.replace(/^ООО /, "ООО ") + " " + rub(x.sum) + " · " + dolya(x.share), "поставщик");
  est(pl, "от " + rub(top[0].stake.soft).replace(" ₽", "") + " до " + rub(top[0].stake.hard), "на кону у главного");
  est(pl, "«" + top[0].name.replace(/^ООО «|»$/g, "") + "» окажется «технической»", "кто главный");
  est(pl, "на них " + dolya(top.reduce((a, x) => a + x.share, 0)) + " расходов", "доля трёх главных");
  const dt = (iso) => iso.slice(8, 10) + "." + iso.slice(5, 7);
  est(pl, dt(r.period.from) + "–" + dt(r.period.to) + "." + r.period.to.slice(0, 4), "период выписки");
  // предупреждения показа — те, что движок ставит этим поставщикам
  assert.ok(top[0].signals.some((x) => x.code === "acc_change"), "у главного должна быть смена счёта");
  est(pl, "сменились счёт и банк", "смена счёта");
  assert.ok(top[1].signals.some((x) => x.code === "vague"), "у второго — размытое назначение");
  est(pl, "не видно, за что платите", "размытое назначение");
});

test("«Наличные глазами банка»: движок Щита на примере продукта даёт цифры показа", () => {
  const E = require(path.join(K, "nalichnye/shchit-engine.js"));
  const Dm = require(path.join(K, "nalichnye/shchit-demo.js"));
  const r = E.analyze(E.parse1C(Dm.demo()));
  const n = blok("nalichnye");
  const sig = (id) => r.signals.find((x) => x.id === id);
  est(n, dolya(r.shares.cash) + " наличными от расходов", "доля наличных");
  est(n, dolya(r.shares.transit) + " транзит за " + sig("transit").window + " рабочих дня", "транзит");
  est(n, dolya(r.shares.tax) + " налоги к обороту, ориентир банков — " + dolya(sig("tax_share").threshold), "налоги к обороту");
  est(n, "на " + r.money.blockDays + " рабочих дней " + rub(r.money.atStake), "встанет при ограничении");
  const mes = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const m0 = r.months[0].key, m1 = r.months[r.months.length - 1].key;
  est(n, mes[+m0.slice(5) - 1] + " — " + mes[+m1.slice(5) - 1] + " " + m1.slice(0, 4), "период выписки");
});

test("«Скорая 115-ФЗ»: план движка Скорой — те же даты, основания и сумма в день", () => {
  const S = require(path.join(K, "skoraya-115-fz/engine.js"));
  const sk = blok("skoraya");
  est(sk, "20.10.2026", "дата отказа");
  est(sk, "3 000 000 ₽", "платежи в месяц");
  // показ снят 25.10.2026: срок подачи считается от «сегодня» (PREP_DAYS), поэтому сегодня в показе зафиксировано
  const p = S.buildPlan({ scenario: "otkaz", today: "2026-10-25", eventDate: "2026-10-20", turnover: 3000000 });
  const shag = (re) => { const x = p.steps.find((st) => re.test(st.label)); assert.ok(x, "в плане Скорой нет шага " + re); return x; };
  const prichina = shag(/сообщить дату и причину/), podat = shag(/^Подать в банк/), otvet = shag(/^Банк обязан ответить/), mvk = shag(/^Если отказ — заявление/);
  const d = (st) => S.humanShort(st.date, 2026).replace(/ /g, " ");
  est(sk, d(prichina) + " Банк сообщает дату и причину отказа · " + prichina.basis, "шаг «банк сообщает»");
  est(sk, d(podat) + " Подать документы и пояснение · " + podat.basis.replace(/ 115-ФЗ$/, ""), "шаг «подать»");
  est(sk, d(otvet) + " Ответ банка — 7 рабочих дней со дня подачи", "шаг «ответ банка»");
  assert.strictEqual(S.workdaysBetween(podat.date, otvet.date), 7, "ответ банка — 7 рабочих дней после подачи");
  est(sk, d(mvk) + " Если отказ — в комиссию при Банке России", "шаг «комиссия»");
  // порядок дат в показе — как в плане
  const daty = [...sk.matchAll(/(\d{1,2} (?:окт|нояб|дек)\.)/g)].map((m) => m[1]);
  assert.deepStrictEqual(daty, [prichina, podat, otvet, mvk].map(d), "даты показа по порядку");
  est(sk, S.rubShort(p.money.perDay).replace(/ /g, " "), "задержится в рабочий день");
  const ne = p.works.items.find((x) => /^Не повторяйте/.test(x));
  assert.ok(ne, "в Скорой нет совета «Не повторяйте…»");
  est(sk, ne.replace(/ — .*$/, ""), "совет «не повторяйте»");
});

test("«Проверь счёт»: НДС 22 % внутри суммы — по формуле", () => {
  const sc = blok("schet");
  const m = sc.match(/Итого ([\d ]+) ₽, в т\. ч\. НДС (\d+) % — ([\d ]+),(\d\d) ₽/);
  assert.ok(m, "строка «Итого … в т. ч. НДС …» не найдена");
  const summa = +m[1].replace(/ /g, ""), st = +m[2], nds = +(m[3].replace(/ /g, "") + "." + m[4]);
  assert.strictEqual(st, 22, "ставка НДС с 2026 года — 22 %");
  assert.strictEqual(Math.round((summa * st) / (100 + st) * 100) / 100, nds);
});
