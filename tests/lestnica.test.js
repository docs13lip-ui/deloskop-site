// «Лестница проверки по сумме» (Ночные 30.09 21:05, п. 173) — node --test tests/lestnica.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'js', 'lestnica.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const n = (v) => L.stupen(v).n;

test('ступени по сумме — на границах', () => {
  assert.strictEqual(n({ summa: 99999 }), 1);
  assert.strictEqual(n({ summa: 100000 }), 2);
  assert.strictEqual(n({ summa: 999999 }), 2);
  assert.strictEqual(n({ summa: 1000000 }), 3);
  assert.strictEqual(n({ summa: 9999999 }), 3);
  assert.strictEqual(n({ summa: 10000000 }), 4);
  assert.strictEqual(n({ summa: '250 000' }), 2, 'сумма с пробелами из поля');
});

test('без суммы ступени нет — просим ввести, а не угадываем', () => {
  const v = L.stupen({});
  assert.strictEqual(v.n, null);
  assert.deepStrictEqual(v.spisok, []);
  assert.match(v.pochemu, /Введите сумму/);
  assert.strictEqual(L.stupen({ summa: 'много' }).n, null);
  assert.strictEqual(L.stupen({ summa: -5 }).n, null);
});

test('доля в закупках: ниже по доле, но не больше чем на одну ступень', () => {
  // 5 млн при закупках 2 млрд — 0,25 %: по доле 1, по сумме 3 → 2
  const v = L.stupen({ summa: 5000000, zakupki: 2000000000 });
  assert.strictEqual(v.n, 2);
  assert.match(v.pochemu, /0,25 % ваших закупок/);
  assert.match(v.pochemu, /на ступень ниже, чем по сумме/);
  // 300 тыс. при закупках 1 млн — 30 %: по доле 4
  assert.strictEqual(n({ summa: 300000, zakupki: 1000000 }), 4);
  // закупки меньше суммы — ошибка ввода, считаем по сумме
  const z = L.stupen({ summa: 300000, zakupki: 1000 });
  assert.strictEqual(z.n, 2);
  assert.match(z.pochemu, /больше ваших закупок/);
});

test('признаки поднимают: 1–2 — на ступень, 3 и больше — на две, выше 4 не бывает', () => {
  assert.strictEqual(n({ summa: 50000, priznaki: ['pervaya'] }), 2);
  assert.strictEqual(n({ summa: 50000, priznaki: ['pervaya', 'cena'] }), 2);
  assert.strictEqual(n({ summa: 50000, priznaki: ['pervaya', 'cena', 'predoplata'] }), 3);
  assert.strictEqual(n({ summa: 5000000, priznaki: ['cena', 'okved', 'posrednik', 'molodaya'] }), 4);
  assert.strictEqual(n({ summa: 50000, priznaki: ['pervaya', 'pervaya', 'neizvestnyj'] }), 2, 'повторы и чужие id не считаем');
  assert.match(L.stupen({ summa: 50000, priznaki: ['cena'] }).pochemu, /на ступень выше — цена заметно ниже рынка/);
  assert.match(L.stupen({ summa: 20000000, priznaki: ['cena'] }).pochemu, /ступень уже высшая/);
});

test('список — по нарастанию: каждая ступень включает предыдущие', () => {
  const dl = [1, 2, 3, 4].map((k) => L.stupen({ summa: [50000, 500000, 5000000, 50000000][k - 1] }).spisok.length);
  for (let i = 1; i < 4; i++) assert.ok(dl[i] > dl[i - 1]);
  const v = L.stupen({ summa: 5000000 });
  assert.ok(v.spisok.every((x) => x.stupen <= 3));
  assert.ok(v.spisok.some((x) => /КНД 1120101/.test(x.t)), 'справка о налогах — со ступени 3');
  assert.ok(!L.stupen({ summa: 500000 }).spisok.some((x) => /КНД 1120101/.test(x.t)));
});

test('наличные: больше 100 000 ₽ — красная строка по 5348-У (п. 4); ровно 100 000 — без неё', () => {
  assert.strictEqual(L.stupen({ summa: 100000 }).nalichnye, null);
  assert.match(L.stupen({ summa: 100001 }).nalichnye, /только безналично/);
  assert.match(L.NALICHNYE, /п\. 4 Указания Банка России от 09\.12\.2019 № 5348‑У/);
});

test('отменённое Указание 3073-У нигде на сайте не упоминается (Юрист 115-ФЗ 01.10: заменено 5348-У)', () => {
  const fs = require('fs'), path = require('path');
  const koren = path.join(__dirname, '..'), plohie = [];
  (function obhod(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (/^(\.git|node_modules|tests)$/.test(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) obhod(p);
      else if (/\.(html|js|json|mjs)$/.test(f.name) && f.name !== 'obnovleniya.json' && /3073/.test(fs.readFileSync(p, 'utf8'))) plohie.push(path.relative(koren, p));
    }
  })(koren);
  assert.deepStrictEqual(plohie, [], 'ссылка на отменённое 3073-У');
});

test('честность: «ориентир Делоскопа», основание с номерами, без обещаний исхода и без паспорта подписанта', () => {
  assert.match(L.OGOVORKA, /Порогов в рублях закон не устанавливает/);
  assert.match(L.OGOVORKA, /ориентир Делоскопа/);
  assert.match(L.OSNOVANIE, /БВ‑4‑7\/3060@/);
  assert.match(L.OSNOVANIE, /307‑ЭС19‑27597/);
  const vse = JSON.stringify(L.STUPENI) + JSON.stringify(L.PRIZNAKI) + L.OGOVORKA + L.OSNOVANIE + L.NALICHNYE;
  assert.ok(!/гарант|суд примет|защитит|обязательно|доказано/i.test(vse));
  assert.ok(!/паспорт(а|)\s+(подписанта|директора|руководителя)|копи[юя] паспорта/i.test(vse), 'копию паспорта не просим');
});

test('ссылки: внешние — только https; внутренние — с корня сайта', () => {
  L.STUPENI.slice(1).forEach((s) => s.sdelat.forEach((x) => x.gde.forEach((g) => assert.ok(/^(https:\/\/|\/)/.test(g[1]), g[1]))));
});

test('модуль без сети и хранилищ', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'lestnica.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon|document\.cookie/.test(src));
});

test('Паспорт, раздел 15: ступень из суммы и возраста по ЕГРЮЛ, наличные — предупреждением; без суммы — ничего', () => {
  const r = { checked_at: '2026-09-30T10:00:00Z', company: { inn: '7701234567', name_short: 'ООО «Тест»', reg_date: '2026-05-01', status: 'ACTIVE' }, signals: [] };
  const p = P.sobrat(r, { usloviya: U, lestnica: L, summa: 500000 });
  const z = p.razdely.find((x) => x.id === 'zaprosit');
  const ob = z.fakty.find((f) => f.tekst === 'Объём проверки');
  assert.ok(ob, 'строка «Объём проверки» есть');
  assert.match(ob.znachenie, /^ступень 3 из 4/, '500 тыс. — ступень 2, компания моложе года — на ступень выше');
  assert.match(ob.znachenie, /ориентир Делоскопа/);
  assert.strictEqual(z.fakty[0].tekst, 'Объём проверки', 'первой строкой раздела');
  assert.ok(z.fakty.some((f) => f.tekst === 'Оплата' && /безналично/.test(f.znachenie) && f.ton === 'warn'));
  const bez = P.sobrat(r, { usloviya: U, lestnica: L }).razdely.find((x) => x.id === 'zaprosit');
  assert.ok(!bez.fakty.some((f) => f.tekst === 'Объём проверки' || f.tekst === 'Оплата'));
  // в «главное» итога строки лестницы не попадают
  assert.ok(!(p.itog.glavnoe || []).some((t) => /безналично|Объём проверки/.test(t)));
  assert.deepStrictEqual(P.proverit(p), []);
});

test('страница Паспорта: модуль подключён до скрипта страницы, блок вне отпечатка и без сети', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
  const i = html.indexOf('<script src="/js/lestnica.js"></script>');
  assert.ok(i > 0 && i < html.indexOf('<script src="/js/pasport-kontragenta.js"></script>'));
  const skript = html.slice(html.indexOf('var API='), html.indexOf('<!--podval-->'));
  const blok = skript.slice(skript.indexOf('var L=window.Lestnica'), skript.indexOf('function reshenieHtml('));
  assert.ok(blok.length > 300, 'код лестницы найден');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon|cookie/.test(blok));
  assert.match(skript, /Объём проверки по сумме/);
  assert.match(blok, /прил\. № ____/, 'в печати — место для номера приложения');
  assert.match(skript, /lestnicaSvyazat\(it\.na_konu&&it\.na_konu\.summa,r\)/);
});
