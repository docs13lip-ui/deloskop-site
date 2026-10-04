// [Ночные-3] metodika-101-v1: методика Индекса 1.0.1 — ниже 60 % данных числа нет (раньше — «по сокращённым данным, не выше 69»);
// пилюля «Без серьёзных сигналов» при «данных пока мало» → «В найденных данных серьёзных сигналов нет» + «Проверено источников: N из M»;
// /cookies/ — о снимке в браузере. ТЗ [Продукт · Данные] 03.10 18:55 разд. 4, [Право] 03.10 20:07 разд. 3–4. node --test tests/metodika_101.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const M = require('../indeks/metodika-v1.json');
const KALK = require('../indeks/indeks.js');
const IO = require('../js/indeks-otvet.js');
const O = require('../js/otchet.js');
const OT = require('../js/otkuda.js');
const NB = '\u00a0';

function otvet(over) {
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', invalid: false, address_invalid: false },
    risk_level: 'low', checked_at: '2026-10-03T09:00:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2015', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    dossier: { charts: {} }, // отчётности в ответе нет → полнота 55 %
  }, over || {});
}

test('методика 1.0.1: версия, журнал, без потолка 69; JSON на странице = файлу целиком', () => {
  assert.strictEqual(M.versiya, '1.0.1');
  assert.strictEqual(M.polnota.porog_sokrashchennoj, 60);
  assert.ok(!('potolok_sokrashchennoj' in M.polnota));
  assert.match(M.polnota.poyasnenie, /число и уровень не показываем/);
  const z = M.zhurnal[M.zhurnal.length - 1];
  assert.deepStrictEqual([z.versiya, z.data], ['1.0.1', '2026-10-03']);
  assert.match(z.chto, /Расчёт не изменился/);
  const h = chitat('indeks/index.html');
  const s = h.match(/<script type="application\/json" id="metodika">([\s\S]*?)<\/script>/);
  assert.deepStrictEqual(JSON.parse(s[1]), M, 'методика на странице и в indeks/metodika-v1.json разошлись');
  assert.match(h, /<span class="ver">Методика v1\.0\.1 · /);
  assert.match(h, /<td>v1\.0\.1<\/td><td>3 октября 2026<\/td>/);
  assert.strictEqual((h.match(/"version": "1\.0\.1"/g) || []).length, 2);
});

test('на /indeks/ и в JSON нет «не выше 69» и «сокращённым данным»', () => {
  for (const f of ['indeks/index.html', 'indeks/metodika-v1.json', 'indeks/indeks.js']) {
    // журнал версий честно пишет, что было раньше, — эту оговорку не считаем
    const t = chitat(f).replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').split('(раньше — не выше 69)').join('');
    assert.ok(!/не выше 69/.test(t), f + ': «не выше 69»');
    assert.ok(!/сокращённым данным/i.test(t), f + ': «сокращённым данным»');
  }
});

test('расчёт: полнота < 60 % — числа и уровня нет; ≥ 60 % — прежнее число', () => {
  const vse = {}; Object.keys(M.istochniki).forEach((k) => { vse[k] = true; });
  const malo = { egrul: true, fns: true }; // 55 %
  const f = { vozrast_10g: true };
  const a = KALK.rasschitat(M, f, malo);
  assert.strictEqual(a.indeks, null);
  assert.strictEqual(a.uroven, null);
  assert.strictEqual(a.sokrashchennaya, true);
  assert.strictEqual(a.polnota, 55);
  const b = KALK.rasschitat(M, f, vse);
  assert.strictEqual(b.indeks, 75);
  assert.strictEqual(b.sokrashchennaya, false);
  // без ЕГРЮЛ — по-прежнему «не считаем», а не «данных мало»
  const c = KALK.rasschitat(M, f, { fns: true, girbo: true, sudy: true });
  assert.strictEqual(c.indeks, null);
  assert.ok(!c.sokrashchennaya);
});

test('экран: ответ без отчётности → «данных пока мало», числа и уровня нет', () => {
  const v = IO.vid(otvet());
  assert.strictEqual(v.rezhim, 'sokr');
  assert.strictEqual(v.polnota, 55);
  assert.strictEqual(IO.ball(otvet()), null);
  assert.ok(!/ot-ix__big/.test(IO.htmlKolonka(v)));
});

test('пилюля при «данных пока мало»: low → «В найденных данных серьёзных сигналов нет» + «Учтено реестров: N из 7» (indeks-yasno-v1)', () => {
  const r = otvet(), v = IO.vid(r);
  assert.strictEqual(v.vsego, 7);
  const p = O.pilyulya(r, v);
  assert.strictEqual(p.t, 'В найденных данных серьёзных сигналов нет');
  assert.strictEqual(p.pod, 'Учтено реестров: ' + v.istochnikov + NB + 'из' + NB + '7. По остальным не' + NB + 'проверяли — это не' + NB + 'значит «нарушений нет».');
  // знаменатель и числитель — те же, что в колонке Индекса: расхождения быть не может
  assert.ok(IO.podpis(v).includes(v.istochnikov + NB + 'из' + NB + v.vsego + ' источников'));
  // все 7 учтены — без оговорки
  assert.strictEqual(O.pilyulya(r, Object.assign({}, v, { istochnikov: 7 })).pod, 'Учтено реестров: 7' + NB + 'из' + NB + '7');
  // опись «Откуда данные» в подстрочник больше не передаётся: третий аргумент ничего не меняет
  assert.strictEqual(O.pilyulya(r, v, { otvetili: 3, oprosheno: 10 }).pod, p.pod);
  // нет вида Индекса — прежняя подпись
  assert.strictEqual(O.pilyulya(r, null).pod, O.POD_PILL);
  assert.ok(!/Проверено источников/.test(chitat('js/otchet.js')), 'старое «Проверено источников: N из M» осталось');
});

test('пилюля не меняется: есть число, другой уровень риска, нет разбора', () => {
  const r = otvet();
  r.dossier.charts = { revenue: [{ year: 2025, value: 48.2e6 }] };
  const v = IO.vid(r);
  assert.strictEqual(v.rezhim, 'chislo');
  assert.deepStrictEqual(O.pilyulya(r, v, { otvetili: 3, oprosheno: 7 }), { t: null, pod: O.POD_PILL });
  const m = otvet({ risk_level: 'medium' });
  assert.strictEqual(O.pilyulya(m, IO.vid(m), { otvetili: 3, oprosheno: 7 }).t, null);
  assert.strictEqual(O.pilyulya(otvet(), null, null).t, null);
  // тексты — без «надёжн» и оценок компании в целом (222-ФЗ, 38-ФЗ)
  assert.doesNotMatch(O.PILL_SOKR + O.pilyulya(r, IO.vid(otvet()), { otvetili: 1, oprosheno: 7 }).pod, /надёжн|гарантир|безопасн/i);
});

test('лист: подстрочник пилюли встаёт в колонку Индекса, текст пилюли меняется после значка', () => {
  const src = chitat('js/otchet.js');
  assert.match(src, /tekstPilyuli\(pill, pp\.t\)/);
  assert.match(src, /el\(doc, 'div', 'ot-ix__pod', esc\(pp\.pod\)\)/);
});

test('/cookies/: снимок в браузере — ИНН, статусы, выручка, коды факторов Индекса; кнопка «Очистить список» есть на главной', () => {
  const c = chitat('cookies/index.html');
  assert.ok(c.includes('браузер запоминает последние проверки компаний (ИНН, статусы, выручку, коды факторов Индекса) у вас на устройстве. На наш сервер это не уходит; очистить — в настройках браузера или кнопкой «Очистить список» на главной.'));
  assert.ok(chitat('js/portfel.js').includes('Очистить список'));
  assert.match(chitat('js/portfel.js'), /removeItem\(K_SNIMKI\)/, 'кнопка чистит и снимки «что изменилось»');
  assert.ok(chitat('index.html').includes('/js/portfel.js'));
});
