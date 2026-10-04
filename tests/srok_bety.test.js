// bez-dvusmyslennosti-v1 (04.10.2026, [Ночные запуски]): бета бесплатна ПО 13 октября включительно
// (решение владельца 30.09). «До 13 октября» читается как «13-го уже платно» — спор с клиентом,
// который заплатил 13.10 ([Право · Юрист 115-ФЗ] 04.10 09:20, ч. 7 ст. 5 38-ФЗ).
// Сторож: на публичных страницах и в скриптах — ни «до 13 октября», ни «до 13.10».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
// obnovleniya/ — история ленты: старые записи не переписываем.
const PROPUSK = new Set(['.git', 'node_modules', 'tests', 'deploy', 'obnovleniya']);
function obojti(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PROPUSK.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) obojti(p, out);
    else if (/\.(html|js|json)$/.test(e.name) && e.name !== 'obnovleniya.json' && e.name !== 'obnovleniya.js') out.push(p);
  }
  return out;
}
const PLOHO = /до(?:\s|&nbsp;| )+13(?:(?:\s|&nbsp;| )+октябр|\.10\b)/i;
test('срок беты: «по 13 октября», а не «до 13 октября»', () => {
  const plohie = obojti(KOREN, []).filter((f) => PLOHO.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(KOREN, f));
  assert.deepStrictEqual(plohie, [], 'пишите «по 13 октября (включительно)» или «до 14 октября»');
});
test('полоса беты говорит «включительно»', () => {
  const p = fs.readFileSync(path.join(KOREN, 'partials', 'beta.html'), 'utf8');
  assert.ok(p.includes('по&nbsp;13&nbsp;октября включительно'));
});

// bez-dvusmyslennosti-v1.1 (04.10.2026, [Ночные запуски]): вторая строка полосы — о 14 октября
// ([Право · Юрист 115-ФЗ] 04.10 10:15, ч. 7 ст. 5 38-ФЗ: «бесплатной» без лимита скрывает условие).
const vm = require('vm');
const polosa = () => fs.readFileSync(path.join(KOREN, 'partials', 'beta.html'), 'utf8');
test('полоса: «С 14 октября — тарифы; быстрая проверка останется бесплатной, 3 в день»', () => {
  assert.ok(polosa().includes('С&nbsp;14&nbsp;октября&nbsp;— тарифы; быстрая проверка останется бесплатной, 3&nbsp;в&nbsp;день.'));
  assert.ok(!polosa().includes('появятся позже'));
});
test('сторож: рядом с «останется бесплатн» — всегда «3 в день»', () => {
  const RYADOM = /останется бесплатн[^<]{0,40}/g, LIMIT = /3(?:\s|&nbsp;| )+в(?:\s|&nbsp;| )+день/;
  const plohie = [];
  for (const f of obojti(KOREN, [])) {
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(RYADOM)) if (!LIMIT.test(m[0])) plohie.push(path.relative(KOREN, f) + ': ' + m[0]);
  }
  assert.deepStrictEqual(plohie, [], 'назовите лимит: «…останется бесплатной, 3 в день»');
});
test('полоса: ссылка «Цена основателя» — на /osnovatel/, с целью, без «успейте»', () => {
  const p = polosa();
  assert.ok(/<a href="\/osnovatel\/" data-goal="beta_osnovatel" data-beta-osn>Цена основателя для первых 300&nbsp;→<\/a>/.test(p));
  assert.ok(!/успе|последн|только сегодня/i.test(p));
  assert.ok(p.includes('localStorage.getItem("dlk_beta_skryt2")'), 'новый ключ «скрыть» — новость о 14.10 увидят все');
});
function shapka() {
  const win = {};
  const doc = { readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(KOREN, 'js/shapka.js'), 'utf8'),
    { window: win, document: doc, location: { pathname: '/', hostname: '' }, localStorage: { getItem: () => null } });
  return win.dlkBeta;
}
const MSK = (s) => Date.parse(s + '+03:00');
test('«Скрыть»: неделя, но не дольше 14.10 00:00 МСК; надпись крестика по сроку', () => {
  const B = shapka();
  assert.strictEqual(B.KLYUCH, 'dlk_beta_skryt2');
  assert.strictEqual(B.KONEC_BETY, MSK('2026-10-14T00:00:00'));
  assert.strictEqual(B.srokSkrytiya(MSK('2026-10-10T12:00:00')), MSK('2026-10-14T00:00:00'));
  assert.strictEqual(B.srokSkrytiya(MSK('2026-10-05T12:00:00')), MSK('2026-10-12T12:00:00'));
  assert.strictEqual(B.nadpisKrestika(MSK('2026-10-05T12:00:00')), 'Скрыть на неделю');
  assert.strictEqual(B.nadpisKrestika(MSK('2026-10-08T12:00:00')), 'Скрыть до конца беты');
});
test('ссылка «Цена основателя» гаснет, когда мест нет; API молчит — остаётся', () => {
  const B = shapka();
  assert.strictEqual(B.osnSsylka({ vsego: 300, zanyato: 300 }), false);
  assert.strictEqual(B.osnSsylka({ vsego: 300, zanyato: 301 }), false);
  assert.strictEqual(B.osnSsylka({ vsego: 300, zanyato: 0 }), true);
  assert.strictEqual(B.osnSsylka(null), true);
});
