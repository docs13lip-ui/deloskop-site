// п. 354 Очереди ([Ночные запуски] 21.10.2026 08:05): статья «Будет ли НДС в счёте поставщика на упрощёнке» —
// раздел «Что с ценой договора» и вопрос FAQ по тексту [Право · Налоговый юрист] 20.10 (Разбор № 23,
// claude/Право_ответы_✎_20.10_и_Разбор_23_НДС_в_цене_договора.md): расчётный метод 293-ФЗ — про изменение закона,
// упрощенца, перешедшего порог, не касается; исход решает договор. Ссылка в тексте — на Разбор № 23.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const un = (s) => s.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/&#8209;/g, '-').replace(/‑/g, '-');
const STR = un(fs.readFileSync(path.join(KOREN, 'nalogi/nds-postavshchika-na-usn-po-inn/index.html'), 'utf8'));
const TXT = STR.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const RAZBOR = '/praktika/nalogi/nds-postavshchika-usn-cena-dogovora/';

test('раздел «Что с ценой договора» — до «Что покажет проверка», с нормами', () => {
  const i = STR.indexOf('<h2>Что с ценой договора</h2>');
  assert.ok(i > 0 && i < STR.indexOf('<h2>Что покажет проверка</h2>'));
  for (const s of ['п. 3.2 ст. 166 НК РФ', '293-ФЗ', 'Пленума ВАС РФ от 30.05.2014 № 33', 'расчётный метод на такой случай не распространяется', 'спора нет'])
    assert.ok(TXT.includes(s), s);
});

test('в тексте раздела — ссылка на Разбор № 23, и он существует', () => {
  const kusok = STR.slice(STR.indexOf('<h2>Что с ценой договора</h2>'), STR.indexOf('<h2>Что покажет проверка</h2>'));
  assert.ok(kusok.includes('href="' + RAZBOR + '"'));
  assert.ok(fs.existsSync(path.join(KOREN, RAZBOR, 'index.html')), 'Разбор № 23 должен быть в той же выкладке');
});

test('третий вопрос FAQ — в видимом блоке и в JSON-LD, без обещания исхода', () => {
  const v = 'Поставщик на УСН стал платить НДС — он может поднять цену?';
  assert.ok(TXT.includes(v));
  const ld = STR.match(/"FAQPage", "mainEntity": (\[[\s\S]*?\])\}\]<\/script>/);
  assert.ok(ld && JSON.parse(ld[1]).some((q) => q.name === v));
  assert.ok(!/(точно выиграете|гарантир)/i.test(TXT));
});

test('lastmod статьи в sitemap не раньше dateModified', () => {  // seo-svyazi-v1: lastmod — по смене текста (tests/sitemap_lastmod.py)
  const dm = STR.match(/"dateModified": "([\d-]+)"/)[1];
  const sm = fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8');
  const lm = sm.match(/nalogi\/nds-postavshchika-na-usn-po-inn\/<\/loc><lastmod>([\d-]+)</);
  assert.ok(lm && lm[1] >= dm, 'lastmod ' + (lm && lm[1]) + ' < dateModified ' + dm);
});
