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
