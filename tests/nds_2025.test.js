// НДС 20% в счёте 2026 года — не всегда ошибка: ставка по дате отгрузки (глубина 01.10 04:05).
// Отгрузка 2025 г., оплата в 2026 г. — 20% верны; аванс 2025 г. — 20/120, отгрузка 2026 г. — 22%
// (разъяснения ФНС в пересказе БУХ.1С, buh.ru/articles/perekhod-na-stavku-nds-22-s-2026-goda.html, проверено 01.10.2026).
// Запуск: node --test tests/nds_2025.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('«Проверь счёт»: при 20% не называем счёт ошибочным, а просим дату отгрузки', () => {
  const s = chitat('proverit-schet/index.html');
  const m = s.match(/Math\.abs\(rate-20\)<0\.3\)add\('warn','НДС','([^']+)'\)/);
  assert.ok(m, 'ветка 20% не найдена');
  assert.match(m[1], /отгруж/);
  assert.match(m[1], /до 1 января 2026 года/);
  assert.match(m[1], /услуга оказана/, 'Налоговый 01.10: отгрузка, работа или услуга — п. 1 ст. 167 НК');
  assert.doesNotMatch(m[1], /почему старая ставка/);
});

test('статья «Как проверить счёт»: правило даты отгрузки, источник и свежая дата', () => {
  const s = chitat('nalogi/kak-proverit-schet-pered-oplatoj/index.html');
  assert.match(s, /Ставка зависит от даты отгрузки, а не от даты счёта/);
  assert.match(s, /buh\.ru\/articles\/perekhod-na-stavku-nds-22-s-2026-goda\.html/);
  const dm = (s.match(/"dateModified": "(\d{4})-(\d{2})-(\d{2})"/) || []).slice(1).map(Number);
  assert.deepStrictEqual(dm, [2026, 10, 1]);
  assert.match(s, /Обновлено 1 октября 2026\./);
});

test('sitemap: lastmod статьи не раньше dateModified', () => {
  const sm = chitat('sitemap.xml');
  const m = sm.match(/kak-proverit-schet-pered-oplatoj\/<\/loc><lastmod>([\d-]+)</);
  assert.ok(m && m[1] >= '2026-10-01');
});
