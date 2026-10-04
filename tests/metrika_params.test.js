// metrika-params-v1.2 (claude/Продукт_metrika-v1.2_адрес_белый_список_МСП_04.10.md, [Право] 19:10 разд. 2):
// события дублируются в параметры визита, ключи — белый список, ИНН и почта не уходят;
// просмотр отправляется вручную с адресом без значений параметров; ИНН ИП / ОГРНИП в адресе — счётчик не грузим.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOD = fs.readFileSync(path.join(__dirname, '..', 'js', 'metrika.js'), 'utf8');

function zapustit({ soglasie = 'all', href = 'https://deloskop.ru/', referrer = '' } = {}) {
  const vyzovy = [];
  const hranilishche = {};
  if (soglasie) hranilishche.dlk_cookies = JSON.stringify({ v: soglasie, t: Date.now() });
  const uzel = () => ({ parentNode: { insertBefore() {} }, setAttribute() {}, addEventListener() {}, remove() {} });
  const document = {
    readyState: 'complete', referrer, title: 'Проверка', body: { appendChild() {} },
    createElement: uzel, getElementsByTagName: () => [uzel()],
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}
  };
  const u = new URL(href);
  const window = { document };
  const sb = {
    window, document, location: { href: u.href, pathname: u.pathname, search: u.search, origin: u.origin },
    localStorage: { getItem: (k) => hranilishche[k] || null, setItem: (k, v) => { hranilishche[k] = v; } },
    JSON, Date, String, Object, URL
  };
  window.localStorage = sb.localStorage; window.location = sb.location;
  vm.createContext(sb);
  vm.runInContext(KOD, sb);
  // загрузчик ставит очередь window.ym — подменяем запись вызовов, сохраняя уже накопленные
  if (typeof window.ym === 'function') {
    for (const a of (window.ym.a || [])) vyzovy.push(JSON.parse(JSON.stringify(Array.from(a))));
    window.ym = function () { vyzovy.push(JSON.parse(JSON.stringify(Array.from(arguments)))); };
  }
  return { window, vyzovy };
}

test('(1) без согласия и при «Только необходимые» ym не вызывается', () => {
  for (const s of [null, 'need']) {
    const { window, vyzovy } = zapustit({ soglasie: s });
    assert.strictEqual(typeof window.ym, 'undefined');
    window.dlkGoal('check_started', { kuda: '/' });
    assert.strictEqual(vyzovy.length, 0);
  }
});

test('(2) один dlkGoal → ровно reachGoal + params{sobytie}', () => {
  const { window, vyzovy } = zapustit();
  const do_ = vyzovy.length;
  window.dlkGoal('pasport_cta_click', { mesto: 'otchet', sost: 'est' });
  const n = vyzovy.slice(do_);
  assert.strictEqual(n.length, 2);
  assert.deepStrictEqual(n[0], [113083788, 'reachGoal', 'pasport_cta_click', { mesto: 'otchet', sost: 'est' }]);
  assert.deepStrictEqual(n[1], [113083788, 'params', { sobytie: { pasport_cta_click: { mesto: 'otchet', sost: 'est' } } }]);
});

test('(3) ИНН, ОГРНИП и почта отбрасываются; inn_dlina остаётся', () => {
  const { window, vyzovy } = zapustit();
  for (const v of ['7707083893', '500100732259', '304500116000157', 'ИНН 7707083893', 'a@b.ru']) {
    window.dlkGoal('x', { kuda: v, inn_dlina: 10 });
    assert.deepStrictEqual(vyzovy[vyzovy.length - 2][3], { inn_dlina: '10' }, v);
  }
});

test('(4) ключи вне белого списка (q, nazvanie, fio, nomer) отбрасываются; stupen и n остаются', () => {
  const { window, vyzovy } = zapustit();
  window.dlkGoal('invoice_created', { nomer: 'D-17', q: 'Ромашка', nazvanie: 'ООО', fio: 'Иванов', produkt: 'start' });
  assert.deepStrictEqual(vyzovy[vyzovy.length - 2][3], { produkt: 'start' });
  window.dlkGoal('lestnica_iz_stati', { stupen: 3, statya: '/115-fz/nalichnye/' });
  assert.deepStrictEqual(vyzovy[vyzovy.length - 2][3], { stupen: '3', statya: '/115-fz/nalichnye/' });
});

test('(5) у адресов в параметрах — только путь; (6) строка > 120 знаков обрезается; (7) без параметров — sobytie: {cel: 1}', () => {
  const { window, vyzovy } = zapustit();
  window.dlkGoal('x', { kuda: '/pasport/kontragent/?inn=7707083893' });
  assert.deepStrictEqual(vyzovy[vyzovy.length - 2][3], { kuda: '/pasport/kontragent/' });
  window.dlkGoal('x', { statya: '/' + 'a'.repeat(200) });
  assert.strictEqual(vyzovy[vyzovy.length - 2][3].statya.length, 120);
  window.dlkGoal('beta_bar_close');
  assert.deepStrictEqual(vyzovy[vyzovy.length - 1], [113083788, 'params', { sobytie: { beta_bar_close: 1 } }]);
});

function hit(href, referrer) {
  const { vyzovy } = zapustit({ href, referrer });
  const init = vyzovy.filter((v) => v[1] === 'init');
  const hity = vyzovy.filter((v) => v[1] === 'hit');
  return { init, hity, vyzovy };
}

test('(8) просмотр — вручную: init с defer: true, ровно один hit, значения параметров → *', () => {
  const sl = [
    ['https://deloskop.ru/pasport/?inn=7707083893&d=2026-10-04&f=ab12', 'https://deloskop.ru/pasport/?inn=*&d=*&f=*'],
    ['https://deloskop.ru/?utm_source=ya&inn=7707083893', 'https://deloskop.ru/?utm_source=ya&inn=*'],
    ['https://deloskop.ru/?yclid=123456789012345678&inn=7707083893#inn', 'https://deloskop.ru/?yclid=123456789012345678&inn=*'],
    ['https://deloskop.ru/?utm_term=7707083893', 'https://deloskop.ru/?utm_term=*'],
    ['https://deloskop.ru/company/7707083893-sberbank/', 'https://deloskop.ru/company/7707083893-sberbank/'],
    ['https://deloskop.ru/115-fz/', 'https://deloskop.ru/115-fz/']
  ];
  for (const [vhod, nado] of sl) {
    const { init, hity } = hit(vhod, 'https://deloskop.ru/?q=Ромашка');
    assert.strictEqual(init.length, 1, vhod);
    assert.strictEqual(init[0][2].defer, true, 'defer: true');
    assert.strictEqual(init[0][2].webvisor, false);
    assert.strictEqual(hity.length, 1, vhod);
    assert.strictEqual(hity[0][2], nado, vhod);
    assert.strictEqual(hity[0][3].referer, 'https://deloskop.ru/?q=*', 'referer тоже без значений');
  }
});

test('(8а) ИНН ИП / ОГРНИП в адресе или referer — счётчик не загружается, цели молчат', () => {
  for (const [href, ref] of [
    ['https://deloskop.ru/pasport/?inn=500100732259&d=2026-10-04&f=ab12', ''],
    ['https://deloskop.ru/?inn=500100732259', ''],
    ['https://deloskop.ru/x/500100732259/', ''],
    ['https://deloskop.ru/?304500116000157', ''],
    ['https://deloskop.ru/?utm_term=500100732259', ''],
    ['https://deloskop.ru/115-fz/', 'https://deloskop.ru/?inn=500100732259']
  ]) {
    const { window, vyzovy } = zapustit({ href, referrer: ref });
    assert.strictEqual(typeof window.ym, 'undefined', href);
    window.dlkGoal('check_started', { kuda: '/' });
    assert.strictEqual(vyzovy.length, 0, href);
  }
  // 13-значный ОГРН юрлица и длинный yclid — не ИНН ИП: счётчик грузится
  for (const href of ['https://deloskop.ru/?ogrn=1027700132195', 'https://deloskop.ru/?yclid=500100732259']) {
    const { init } = hit(href, '');
    assert.strictEqual(init.length, 1, href);
  }
});

test('код: загрузка только при «all», без Вебвизора, автопросмотр выключен', () => {
  assert.ok(/if \(v === "all"\) zagruzit\(\)/.test(KOD));
  assert.ok(KOD.includes('webvisor: false, defer: true'));
  assert.ok(!/reachGoal", cel, params/.test(KOD), 'reachGoal — только с очищенными параметрами');
});
