// poisk-v2-b (13.11.2026): лупа в шапке, «/» и Ctrl+K — та же строка с любой страницы (js/shapka.js + js/poisk-okno.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');

function klavisha() {
  const kod = chitat('js/shapka.js');
  const kusok = kod.slice(kod.indexOf('// poisk-v2-b'));
  const window = {};
  vm.runInNewContext(kusok, { window, document: {}, location: {} });
  return window.dlkPoiskKlavisha;
}

test('клавиши: «/» вне полей, Ctrl+K и ⌘K в любой раскладке; в полях и с другими модификаторами — нет', () => {
  const k = klavisha();
  const body = { tagName: 'BODY' }, pole = { tagName: 'INPUT' }, tekst = { tagName: 'DIV', isContentEditable: true };
  assert.strictEqual(k({ key: '/', code: 'Slash', target: body }), 'slash');
  assert.strictEqual(k({ key: '.', code: 'Slash', target: body }), 'slash', 'русская раскладка: та же клавиша');
  assert.strictEqual(k({ key: ',', code: 'Slash', shiftKey: true, target: body }), '', 'Shift + клавиша — это запятая, не поиск');
  assert.strictEqual(k({ key: '/', code: 'Slash', target: pole }), '', 'в поле «/» — просто символ');
  assert.strictEqual(k({ key: '/', code: 'Slash', target: tekst }), '');
  assert.strictEqual(k({ key: 'k', code: 'KeyK', ctrlKey: true, target: pole }), 'ctrlk', 'Ctrl+K — и из поля');
  assert.strictEqual(k({ key: 'л', code: 'KeyK', metaKey: true, target: body }), 'ctrlk', '⌘K в русской раскладке');
  assert.strictEqual(k({ key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true, target: body }), '');
  assert.strictEqual(k({ key: '/', code: 'Slash', ctrlKey: true, target: body }), '');
  assert.strictEqual(k({ key: '/', code: 'Slash', isComposing: true, target: body }), '');
  assert.strictEqual(k({ key: '/', code: 'Slash', defaultPrevented: true, target: body }), '');
  assert.strictEqual(k({ key: 'a', code: 'KeyA', target: body }), '');
});

test('шапка: лупа с подписью, сочетаниями и адресом пакета; пакет poisk-okno = разбор + окно', () => {
  const h = chitat('partials/shapka.html');
  assert.match(h, /<button class="shapka__poisk" type="button" data-poisk-knopka data-poisk-src="\/js\/b\/poisk-okno\.[0-9a-f]{10}\.js" aria-label="Найти: ИНН, название, счёт или вопрос" aria-keyshortcuts="\/ Control\+K"/);
  assert.ok(h.indexOf('shapka__poisk') < h.indexOf('shapka__tema'), 'лупа — перед кнопкой темы');
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.deepStrictEqual(sb.pakety['poisk-okno'], ['js/poisk.js', 'js/poisk-okno.js']);
  assert.ok(!Object.values(sb.stranicy).some((x) => x.includes('poisk-okno')), 'пакет окна не грузится тегом — только по нажатию');
  const adres = h.match(/\/js\/b\/poisk-okno\.[0-9a-f]{10}\.js/)[0];
  assert.ok(fs.existsSync(path.join(KOREN, adres)), 'пакет собран: ' + adres);
  for (const s of ['praktika/index.html', 'o-proekte/index.html']) assert.ok(chitat(s).includes(adres), 'лупа с тем же адресом на ' + s);
});

test('окно: запрос не храним, в Метрику — только виды; адреса — только свои', () => {
  const o = chitat('js/poisk-okno.js');
  assert.doesNotMatch(o, /localStorage\.setItem|sessionStorage|target="_blank"|innerHTML\s*=\s*[^;]*input\.value/);
  assert.match(o, /goal\('poisk_vybor', \{ vid: pustoe \? 'nedavnie' : vidVybora\(r\), mesto: 'okno', sposob: sposob, nomer: i \}\)/);
  assert.match(o, /goal\('poisk_tip', \{ vid: PR\.vid, mesto: 'okno' \}\)/);
  // чистые функции окна — через vm: kuda() ведёт только на свой сайт
  const window = { DlkPoisk: { deystvie() { return true; } } };
  vm.runInNewContext(o, { window, location: { hostname: 'localhost' }, document: {} });
  const W = window.DlkPoiskOkno;
  assert.strictEqual(W.kuda({ inn: '2309085638', imya: 'Х' }), '/?inn=2309085638');
  assert.strictEqual(W.kuda({ q: 'магнит' }), '/?inn=%D0%BC%D0%B0%D0%B3%D0%BD%D0%B8%D1%82#poisk');
  assert.strictEqual(W.kuda({ href: '/proverit-schet/' }), '/proverit-schet/');
  assert.strictEqual(W.kuda({ href: '//evil.example/' }), '', 'чужой адрес — нет');
  assert.strictEqual(W.kuda({ href: 'https://evil.example/' }), '');
  assert.strictEqual(W.kuda({ t: 'пояснение' }), '');
  assert.strictEqual(W.vidVybora({ inn: '2309085638' }), 'inn');
  assert.strictEqual(W.vidVybora({ inn: '2309085638', imya: 'Х' }), 'kompaniya');
  assert.strictEqual(W.vidVybora({ href: '/x/', razdel: true }), 'razdel');
});

test('главная: шапка ставит курсор в строку; выбор — цель poisk_vybor без текста; #poisk — подсказки сразу', () => {
  const s = chitat('js/shapka.js');
  assert.match(s, /function glavnaya\(\) \{ var i = document\.getElementById\("inn"\); return i && i\.getAttribute\("role"\) === "combobox"/);
  assert.match(s, /if \(okno && !okno\.classList\.contains\("pso"\)\) return;/, 'открыто другое окно — клавиши не перехватываем');
  const g = chitat('index.html');
  assert.match(g, /dlkGoal\('poisk_vybor',\{vid:pustoe\?'nedavnie':r\.inn\?\(r\.imya\?'kompaniya':'inn'\):r\.dopisat\?'dopisat':r\.q\?'nazvanie':r\.razdel\?'razdel':'instrument',mesto:'glavnaya',sposob:sposob\|\|'enter',nomer:i\}\)/);
  assert.match(g, /if\(location\.hash==='#poisk'\)\{try\{history\.replaceState\(null,'',location\.pathname\+location\.search\)\}catch\(e\)\{\}input\.focus\(\);input\.dispatchEvent\(new Event\('input'\)\)\}/);
});
