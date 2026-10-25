// Сторож: Разбор № 1 «Вокфорс» ссылается на Обзор судебной практики ВС № 3 (2026), п. 19 ([Право] 24.10, consultant ✅).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const kor = path.join(__dirname, '..');
test('«Вокфорс»: в «Где в законе» — Обзор ВС № 3 (2026), п. 19, и dateModified сдвинут', () => {
  const s = fs.readFileSync(path.join(kor, 'praktika/nalogi/vokfors-rekonstrukciya/index.html'), 'utf8');
  const zakon = s.split('<ul class="zakon">')[1].split('</ul>')[0];
  assert.match(zakon, /Обзор судебной практики Верховного суда РФ №(\s|&nbsp;| )3 \(2026\)/);
  assert.match(zakon, /п\.(\s|&nbsp;| )19/);
  assert.match(zakon, /garant\.ru\/products\/ipo\/prime\/doc\/414981131/);
  assert.match(s, /"dateModified":\s*"2026-10-24"/);
});
