// «Базы» в админке — pult-baz-v1, [Ночные запуски] 11.10.2026. ТЗ: claude/Решения_владельца_11.10_пульт_баз_светофор.md.
// Запуск: node --test tests/admin_bazy.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const ADMIN = fs.readFileSync(path.join(KOREN, 'admin.html'), 'utf8');
const KOD = fs.readFileSync(path.join(KOREN, 'js/admin-bazy.js'), 'utf8');

function zagruzit() {
  const el = {};
  const document = { getElementById: id => (el[id] = el[id] || { textContent: '', innerHTML: '', hidden: true }), hidden: false };
  const ctx = { window: {}, document, setInterval: () => 0, Date, Number, String, Promise };
  vm.runInNewContext(KOD, ctx);
  return { api: ctx.window.DlkBazy, el };
}

const OTVET = {
  itog: { tekst: 'Работает 2 из 4', rabotaet: 2, vsego: 4, zelenyj: 1, zheltyj: 1, krasnyj: 1, seryj: 1 },
  gruppy: ['Реестры ФНС', 'Финансы', 'Суды и долги', 'Закупки', 'Банк России', 'Прочее'],
  bazy: [
    { id: 'egryul', nazvanie: 'ЕГРЮЛ', gruppa: 'Реестры ФНС', istochnik: 'DaData', sostoyanie: 'zelenyj', prichina: 'работает',
      poslednij_uspeh: '2026-10-11T18:05:00+00:00', svezhest_dannyh: '2026-10-11', proba: '2026-10-11T18:05:00+00:00' },
    { id: 'fssp_otkr', nazvanie: 'Приставы', gruppa: 'Суды и долги', istochnik: 'ФССП', sostoyanie: 'zheltyj',
      prichina: 'данные на 01.08.2026 — старше 45 дн.', poslednij_uspeh: '2026-10-11T18:05:00+00:00', zapisej: 120000 },
    { id: 'damia_arb', nazvanie: 'Арбитражные суды <b>', gruppa: 'Суды и долги', istochnik: 'DaMIA', sostoyanie: 'krasnyj',
      prichina: 'ключ отклонён', poslednij_uspeh: null, poslednyaya_oshibka: { tekst: 'HTTP 403: Неверный ключ (1)', vremya: '2026-10-11T18:04:00+00:00' } },
    { id: 'eis', nazvanie: 'ЕИС', gruppa: 'Закупки', istochnik: 'ЕИС', sostoyanie: 'seryj', prichina: 'не подключено',
      chto_nuzhno: 'EIS_TOKEN через Госуслуги и комплект eis-rnp-v1' },
  ],
};

test('админка: раздел «Базы» подключён и скрыт до ответа API', () => {
  assert.match(ADMIN, /<section class="card" id="bzSek" hidden>/);
  assert.match(ADMIN, /<script src="\/js\/admin-bazy\.js"><\/script>/);
  assert.match(ADMIN, /DlkBazy\.start\(call,function\(\)\{return isAdmin\}\)/);
  assert.ok(ADMIN.indexOf('id="bzSek"') < ADMIN.indexOf('<h2>Данные ФНС</h2>'), '«Базы» — выше «Данных ФНС»');
});

test('светофор: цвета, итог, группы, «что нужно» у серого', () => {
  const { api, el } = zagruzit();
  api._risovat(OTVET, true);
  assert.strictEqual(el.bzItog.innerHTML, 'Работает 2 из 4 <span class="bz-plohie">не работает: 1</span>');
  assert.match(el.bzGruppy.innerHTML, />Ключ отклонён</);
  const h = el.bzGruppy.innerHTML;
  for (const c of ['zelenyj', 'zheltyj', 'krasnyj', 'seryj']) assert.match(h, new RegExp('class="bz ' + c + '"'));
  assert.match(h, /<h3>Реестры ФНС<\/h3>/);
  assert.doesNotMatch(h, /<h3>Финансы<\/h3>/, 'пустые группы не показываем');
  assert.match(h, /Что нужно: EIS_TOKEN через Госуслуги/);
  assert.match(h, /успехов не было/);
  assert.match(h, /120\s000 записей/);
  assert.match(h, /HTTP 403: Неверный ключ \(1\)/);
  assert.match(h, /Арбитражные суды &lt;b&gt;/, 'текст экранируется');
  assert.strictEqual((h.match(/class="bz-run"/g) || []).length, 3, 'у серых нет кнопки «Проверить сейчас»');
});

test('тестировщику — без кнопок проверки', () => {
  const { api, el } = zagruzit();
  api._risovat(OTVET, false);
  assert.doesNotMatch(el.bzGruppy.innerHTML, /bz-run/);
});

test('цвет не только точкой: у точки есть подпись для экранного диктора', () => {
  const { api, el } = zagruzit();
  api._risovat(OTVET, true);
  assert.match(el.bzGruppy.innerHTML, /aria-label="Не работает"/);
});
