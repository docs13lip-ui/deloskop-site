// Сторож: Разбор № 28 (ВС № 305-ЭС26-602) ссылается на Обзор судебной практики ВС № 3 (2026), п. 13 — текст [Право] 24.10 разд. 3; вторично advgazeta.ru 25.10.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const kor = path.join(__dirname, '..');
test('Разбор № 28: в «Где в законе» — Обзор ВС № 3 (2026), п. 13, ссылка на garant', () => {
  const s = fs.readFileSync(path.join(kor, 'praktika/dogovory/kompensaciya-poter-406-1-vs-2026/index.html'), 'utf8');
  const zakon = s.split('<ul class="zakon">')[1].split('</ul>')[0];
  assert.match(zakon, /Обзор судебной практики Верховного суда РФ №(\s|&nbsp;| )3 \(2026\)/);
  assert.match(zakon, /п\.(\s|&nbsp;| )13/);
  assert.match(zakon, /garant\.ru\/products\/ipo\/prime\/doc\/414981131/);
});
