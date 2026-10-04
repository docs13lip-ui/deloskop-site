// namerenie-v1: метрика беты М6 «намерение платить» (ТЗ [Продукт] 04.10.2026). node --test tests/otzyv.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/otzyv.js');
const JS = fs.readFileSync(path.join(__dirname, '..', 'js', 'otzyv.js'), 'utf8');

test('namerenie: вопрос — только в бете и только на отчёте, Паспорте и карточке', () => {
  assert.strictEqual(O.namerenieVid('/report.html', true, false), 'otchet');
  assert.strictEqual(O.namerenieVid('/pasport/kontragent/', true, false), 'pasport');
  assert.strictEqual(O.namerenieVid('/pasport/', true, false), 'pasport');
  assert.strictEqual(O.namerenieVid('/company/7707548740-mvm/', true, false), 'kartochka');
  assert.strictEqual(O.namerenieVid('/report.html', false, false), null, 'без meta beta — нет');
  assert.strictEqual(O.namerenieVid('/praktika/nalogi/vokfors-rekonstrukciya/', true, false), null, 'vid = stranica — нет');
  assert.strictEqual(O.namerenieVid('/', true, false), null);
  assert.strictEqual(O.namerenieVid('/115-fz/', true, false), null);
});

test('namerenie: на той же странице повторно не спрашиваем', () => {
  assert.strictEqual(O.namerenieVid('/report.html', true, true), null);
  assert.ok(JS.includes('"dlk_namerenie:"'), 'ключ dlk_namerenie:<путь>');
  assert.ok(/function uzheN\(\) \{ try \{[^}]*\} catch \(e\) \{ return false; \} \}/.test(JS), 'localStorage — в try/catch');
});

test('namerenie: ровно две кнопки, обе контуром, тексты дословно из ТЗ', () => {
  const h = O.namerenieHtml();
  const knopki = h.match(/<button[^>]*>[^<]*<\/button>/g);
  assert.strictEqual(knopki.length, 2);
  assert.deepStrictEqual(knopki.map((b) => b.replace(/<[^>]+>/g, '')), ['Да', 'Пока нет']);
  knopki.forEach((b) => assert.ok(b.includes('otz__b otz__b--tiho'), 'без primary-кнопки: ' + b));
  assert.ok(!/selected|aria-pressed="true"|autofocus|checked/.test(h), 'без предвыбранного ответа');
  assert.ok(h.includes('Перед следующей оплатой поставщику проверите его здесь же?'));
  assert.strictEqual(O.NAMERENIE.spasibo, 'Спасибо — так мы поймём, что делать дальше.');
});

test('namerenie: без цен, тарифов, скидок и упоминания ИИ', () => {
  const vse = Object.values(O.NAMERENIE).join(' ') + O.namerenieHtml();
  assert.ok(!/тариф|скидк|подписк|₽|руб\.|\bИИ\b|нейросет|искусствен/i.test(vse), vse);
});

test('namerenie: цели — ровно namerenie_da / namerenie_net, параметр только vid без цифр', () => {
  assert.strictEqual(O.namerenieCel('da'), 'namerenie_da');
  assert.strictEqual(O.namerenieCel('net'), 'namerenie_net');
  assert.strictEqual(O.namerenieCel('chto-to'), 'namerenie_net');
  for (const v of ['otchet', 'pasport', 'kartochka', '7707548740', undefined]) {
    const p = O.namerenieParam(v);
    assert.deepStrictEqual(Object.keys(p), ['vid']);
    assert.ok(!/\d{10,12}/.test(JSON.stringify(p)), JSON.stringify(p));
  }
  const celi = JS.match(/namerenie_[a-z]+/g).filter((x, i, a) => a.indexOf(x) === i).sort();
  assert.deepStrictEqual(celi, ['namerenie_da', 'namerenie_net']);
  // параметр vid разрешён белым списком Метрики (metrika-params-v1.2)
  const M = fs.readFileSync(path.join(__dirname, '..', 'js', 'metrika.js'), 'utf8');
  assert.ok(/KLYUCHI = \{[^}]*\bvid: 1/.test(M));
});

test('namerenie: на наш сервер не уходит, спрашиваем после любой оценки', () => {
  const f = JS.slice(JS.indexOf('function namerenie(d)'), JS.indexOf('if (document.readyState'));
  assert.ok(f.length > 100);
  assert.ok(!/fetch|otpravit|\/api\//.test(f), 'только Метрика');
  const o = JS.slice(JS.indexOf('function ocenit('), JS.indexOf('function namerenie(d)'));
  assert.ok(o.includes('namerenie(d);'), 'вызов — в ocenit, общий для «Полезно» и «Не понял»');
  assert.ok(!/if \(ocenka === "polezno"\)[^;]*namerenie/.test(o));
});
