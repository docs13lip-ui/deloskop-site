// Честная пометка сверки ([Ночные запуски] 05.10.2026 06:05, глубина). Разбор «Остаток при закрытии счёта» стоит на
// постановлении АС МО от 15.03.2024 № Ф05-300/2024 (А40-42087/2023): тезис взят из подборки consultant.ru, полный текст
// акта в открытых источниках не найден, в claude/Практика_115ФЗ_банки.md дело — «не подтверждено». Пока акт не прочитан
// (поле dela[].sverka_vid = "tezis"), страница не пишет «Сверено по первоисточникам», а остальные разборы — пишут.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const un = (s) => s.replace(/ /g, ' ').replace(/&nbsp;/g, ' ');
const dela = JSON.parse(fs.readFileSync(path.join(KOREN, 'praktika/dela.json'), 'utf8'));
const razbory = dela.razbory || dela.dela || Object.values(dela).find(Array.isArray);
const str = (r) => un(fs.readFileSync(path.join(KOREN, 'praktika', r.razdel, r.slug, 'index.html'), 'utf8'));

test('разбор с актом «по тезису» не обещает сверку по первоисточникам', () => {
  const tez = razbory.filter((r) => r.dela.some((d) => d.sverka_vid === 'tezis'));
  assert.ok(tez.some((r) => r.slug === 'ostatok-pri-zakrytii-scheta'));
  for (const r of tez) {
    const t = str(r);
    assert.ok(!t.includes('Сверено по первоисточникам'), r.slug);
    assert.ok(t.includes('полный текст акта ещё сверяем'), r.slug);
    assert.ok(t.includes('тезис сверен по правовой базе'), r.slug);
  }
});

test('остальные разборы — прежняя строка «Сверено по первоисточникам»', () => {
  for (const r of razbory.filter((r) => !r.dela.some((d) => d.sverka_vid))) {
    assert.ok(str(r).includes('Сверено по первоисточникам'), r.slug);
  }
});

test('sverka_vid — только известное значение', () => {
  for (const r of razbory) for (const d of r.dela) {
    if ('sverka_vid' in d) assert.ok(['tezis', 'kopiya'].includes(d.sverka_vid), r.slug);
  }
});

// [Ночные запуски] 05.10 11:05: «kopiya» — полный текст акта прочитан в копии правовой базы (klerk.ru/cdoc), PDF на vsrf.ru
// из облака закрыт (403). Страница честно пишет «с сайтом Верховного суда ещё сверяем» и не обещает «по первоисточникам».
test('разбор с актом «по копии» не обещает сверку по первоисточникам', () => {
  const kop = razbory.filter((r) => r.dela.some((d) => d.sverka_vid === 'kopiya'));
  assert.ok(kop.some((r) => r.slug === 'podryadchik-ne-vystavil-schet-fakturu'));
  for (const r of kop) {
    const t = str(r);
    assert.ok(!t.includes('Сверено по первоисточникам'), r.slug);
    assert.ok(t.includes('с сайтом Верховного суда ещё сверяем'), r.slug);
    assert.ok(t.includes('текст сверен по копии в правовой базе'), r.slug);
  }
});
