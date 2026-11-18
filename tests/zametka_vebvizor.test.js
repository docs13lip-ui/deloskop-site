// zametka-vebvizor-v1 [Ночные запуски] 18.11: текст заметок к компаниям не должен попасть в Яндекс
// ни при каком включении Вебвизора ([Право] 18.11, разд. 1, 152-ФЗ): поле ввода — ym-disable-keys,
// показанный текст — ym-hide-content (справка Метрики «Подключение и настройка Вебвизора»);
// подсказка «Не пишите сюда паспортные данные и пароли»; строка о заметках в /cookies/.
// node --test tests/zametka_vebvizor.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/portfel.js');
const Z = require('../js/zametka-otcheta.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const bezNb = (t) => String(t).replace(/ /g, ' ').replace(/&nbsp;/g, ' ');
const NOW = new Date(2026, 10, 18, 21, 0).getTime();
const INN = '7707083893';

// Все <textarea> и все элементы с текстом заметки в разметке
const textarei = (h) => h.match(/<textarea[^>]*>/g) || [];

test('список на главной: поле — ym-disable-keys, текст — ym-hide-content, подсказка про паспорт и пароли', () => {
  const rows = P.sobrat({ [INN]: [{ t: NOW, inn: INN, lvl: 'low', nm: 'ПАО Сбербанк' }] }, []);
  const zm = { [INN]: { z: 'Иванов просил предоплату', t: NOW } };
  const pokaz = P.html(rows, NOW, { zametki: zm });
  const p = pokaz.match(/<p class="pf__z[^"]*">Иванов просил предоплату<\/p>/);
  assert.ok(p && /\bym-hide-content\b/.test(p[0]), 'показанный текст заметки скрыт от записи сессии');
  const red = bezNb(P.html(rows, NOW, { zametki: zm, red: INN }));
  const ta = textarei(red);
  assert.strictEqual(ta.length, 1);
  assert.ok(/class="[^"]*\bym-disable-keys\b/.test(ta[0]), 'ввод заметки не записывается');
  assert.ok(red.includes('видна только в этом браузере. Не пишите сюда паспортные данные и пароли.'));
});

test('отчёт по ИНН: поле — ym-disable-keys, текст — ym-hide-content, та же подсказка', () => {
  const pokaz = Z.html(INN, 'Иванов просил предоплату', false);
  const p = pokaz.match(/<p class="zo__z[^"]*">Иванов просил предоплату<\/p>/);
  assert.ok(p && /\bym-hide-content\b/.test(p[0]));
  const red = bezNb(Z.html(INN, 'x', true));
  const ta = textarei(red);
  assert.strictEqual(ta.length, 1);
  assert.ok(/class="[^"]*\bym-disable-keys\b/.test(ta[0]));
  assert.ok(red.includes('видна только в этом браузере. Не пишите сюда паспортные данные и пароли.'));
});

test('в исходниках нет поля заметки без ym-disable-keys и строки заметки без ym-hide-content', () => {
  for (const f of ['js/portfel.js', 'js/zametka-otcheta.js']) {
    const js = chitat(f);
    for (const m of js.match(/<textarea[^>]*/g) || []) assert.ok(m.includes('ym-disable-keys'), f + ': ' + m);
    for (const m of js.match(/class="(pf__z|zo__z)\b[^"]*"/g) || []) assert.ok(m.includes('ym-hide-content'), f + ': ' + m);
  }
});

test('/cookies/: заметки — только в этом браузере, Делоскоп их не получает', () => {
  const h = bezNb(chitat('cookies/index.html'));
  assert.ok(h.includes('Заметки к компаниям хранятся только в этом браузере. Делоскоп их не получает и не видит. Очистите данные сайта — заметки пропадут.'));
});
