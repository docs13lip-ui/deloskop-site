// slova-pravo-v2 — [Ночные запуски] 17.11.2026 по «В Очередь» [Право] 17.11 (Разбор № 54 п. 2, пересверка 170956, ч. 12 ст. 18 402-ФЗ).
// 1) Прогноз ЗСК на экранах продукта — одной формой: «наш прогноз по признакам ЗСК — не оценка Банка России».
// 2) Плюс «нет недоимки» — с пенями и штрафами, дата — «сведения на» дату набора ФНС (ст. 102 НК: набор публикуется периодически).
// 3) Статья о закрытой отчётности — ч. 12 ст. 18 в ред. от 15.12.2025 (471-ФЗ), «по согласованию с Банком России».
// 4) sroki: законопроект 170956 — сверка 17.11, пересверка 15.12.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const KOR = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(KOR, f), 'utf8');
const vid = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');

const EKRANY = ['report.html', 'index.html', 'pasport/index.html', 'sravnit/index.html',
  'js/shchit.js', 'js/sushchestvennoe.js', 'js/sravnenie.js', 'js/plyusy-minusy.js'];

test('ЗСК: на экранах продукта нет «не статус Банка России» и «наша оценка» — только «не оценка Банка России»', () => {
  for (const f of EKRANY) {
    const s = vid(chit(f));
    assert.ok(!/не статус Банка России/.test(s), f + ': осталось «не статус Банка России»');
    assert.ok(!/наша оценка, не/.test(s), f + ': осталось «наша оценка, не …»');
    if (/ЗСК/.test(s)) assert.match(s, /не оценка Банка России/, f);
  }
  // пакеты js/b собираются из js/*.js — после sobrat_js в них тоже не должно остаться старой формы
  const paketi = execSync('git ls-files js/b', { cwd: KOR, encoding: 'utf8' }).split('\n').filter((x) => /\.js$/.test(x));
  for (const f of paketi) assert.ok(!/не статус Банка России/.test(chit(f)), f + ' — пересоберите sobrat_js');
});

test('ЗСК: форма [Право] дословно в отчёте, Паспорте, экране проверки и «Существенном»', () => {
  assert.match(vid(chit('report.html')), /Наш прогноз по признакам ЗСК в открытых данных — не оценка Банка России/);
  assert.match(vid(chit('pasport/index.html')), /\(наш прогноз по признакам ЗСК — не оценка Банка России\)/);
  assert.match(vid(chit('index.html')), /Наш прогноз по признакам ЗСК — не оценка Банка России <a/);
  assert.match(chit('js/sushchestvennoe.js'), /nazv: 'Наш прогноз по признакам ЗСК — не оценка Банка России'/);
});

test('недоимка: «Недоимки и долгов по пеням и штрафам … не нашли — сведения на» — сайт и карточки одними словами', () => {
  const js = vid(chit('js/plyusy-minusy.js'));
  assert.ok(!/Недоимки по' \+ NB \+ 'данным ФНС/.test(chit('js/plyusy-minusy.js')), 'старая строка в js');
  const py = vid(chit('tests/kartochka_render.py'));
  const fraza = 'Недоимки и долгов по пеням и штрафам в открытых данных ФНС не нашли';
  const izJs = js.match(/NEDOIMKI_NET = (.+);/)[1].replace(/' \+ NB \+ '/g, ' ').replace(/^'|'$/g, '');
  assert.strictEqual(izJs, fraza);
  const izPy = py.match(/NEDOIMKI_NET = \(([\s\S]+?)\)\n/)[1].replace(/"\s*\+\s*NB\s*\+\s*"/g, ' ').replace(/\s*\n\s*\+\s*/g, '').replace(/^"|"$/g, '').replace(/""/g, '');
  assert.strictEqual(izPy, fraza);
  assert.match(js, /' —' \+ NB \+ 'сведения на' \+ NB \+ d/);
});

test('статья о закрытой отчётности: ч. 12 ст. 18 — ред. от 15.12.2025, «по согласованию с Банком России»', () => {
  const s = vid(chit('nalogi/net-otchetnosti-v-otkrytyh-dannyh/index.html'));
  assert.match(s, /устанавливает Правительство по согласованию с Банком России \(ч\. 12 ст\. 18 402-ФЗ\)/);
  assert.match(s, /\(ч\. 4, 5, 9, 12; ред\. от 15\.12\.2025, 471-ФЗ\)<\/a>/);
  assert.match(s, /"dateModified": "2026-11-17"/);
  assert.match(s, /Обновлено 17 ноября 2026\. Нормы сверены командой Делоскопа 17\.11\.2026\./);
  // [Право] 17.11 п. 1.2: причину закрытия по компании не называем; «не сдаёт» ложно
  assert.ok(!/не сдаёт отчётност/.test(s));
});

test('sroki: 170956 — сверка 17.11.2026 сверху, пересверка до 15.12.2026, на сайте не публикуем', () => {
  const d = JSON.parse(chit('sroki.json'));
  const z = d.sroki.find((x) => x.id === 'zakonoproekt_170956_chastichnoe_sovpadenie');
  assert.ok(z.sverka.startsWith('2026-11-17: '));
  assert.strictEqual(z.proverit_do, '2026-12-15');
  assert.deepStrictEqual(z.gde, []);
});
