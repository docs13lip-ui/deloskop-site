// inn-pole-v1 (24.10.2026, [Ночные запуски]): поле ИНН в формах «Проверить» принимает ИНН, скопированный
// с пробелами, дефисами и подписью («ИНН 7707 083 893 »), и объясняет отказ по-русски. До правки браузер
// отклонял такую вставку общим «Введите данные в указанном формате», а 12 цифр в поле «только организации»
// (maxlength 10) обрезал до 10 — и форма уходила с чужим ИНН. Сторож: блок inn-pole-v1 в js/shapka.js
// (запуск в песочнице с поддельным document) + каждое поле ИНН на сайте под него подходит и подписано.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const SHAPKA = fs.readFileSync(path.join(KOREN, 'js', 'shapka.js'), 'utf8');
const BLOK = (SHAPKA.match(/\/\/ inn-pole-v1 >>>[\s\S]*?\/\/ <<< inn-pole-v1/) || [''])[0];
const SEL = 'input[name="inn"][inputmode="numeric"]';

function zapustit() {
  const slush = {};
  const document = { addEventListener: (n, f) => { slush[n] = f; } };
  class Event { constructor(t, o) { this.type = t; this.bubbles = !!(o && o.bubbles); } }
  vm.runInNewContext(BLOK, { document, Event });
  return slush;
}
function pole(maxlength, value = '') {
  const p = {
    value, selectionStart: value.length, selectionEnd: value.length, custom: '', sobytiya: 0,
    matches: (s) => s === SEL,
    getAttribute: (a) => (a === 'maxlength' ? String(maxlength) : null),
    setCustomValidity(t) { this.custom = t; },
    dispatchEvent() { this.sobytiya++; return true; },
  };
  return p;
}
function vstavit(sl, p, tekst) {
  let otmeneno = false;
  sl.paste({ target: p, clipboardData: { getData: () => tekst }, preventDefault: () => { otmeneno = true; } });
  if (!otmeneno) { // так вставил бы браузер сам: с обрезкой по maxlength
    const ml = +p.getAttribute('maxlength');
    p.value = (p.value + tekst).slice(0, ml);
  }
  return otmeneno;
}

test('inn-pole: блок есть в js/shapka.js и стоит в пакете «ядро»', () => {
  assert.ok(BLOK.length > 500, 'нет блока inn-pole-v1 в js/shapka.js');
  const yadro = fs.readdirSync(path.join(KOREN, 'js', 'b')).filter((f) => /^yadro\.[0-9a-f]{10}\.js$/.test(f));
  assert.strictEqual(yadro.length, 1, 'пакетов yadro: ' + yadro.length);
  assert.ok(fs.readFileSync(path.join(KOREN, 'js', 'b', yadro[0]), 'utf8').includes('inn-pole-v1') ||
    fs.readFileSync(path.join(KOREN, 'js', 'b', yadro[0]), 'utf8').includes('ИНН организации'), 'пакет yadro собран без блока');
});

test('inn-pole: вставка с пробелами, дефисами и подписью → чистый ИНН', () => {
  const sl = zapustit();
  const sluchai = {
    '7707083893 ': '7707083893', ' 7707083893': '7707083893', '7707 083 893': '7707083893',
    '7707-083-893': '7707083893', 'ИНН 7707083893': '7707083893', 'ИНН/КПП 7707083893/770701001': '7707083893',
    'ИНН 7707083893 КПП 770701001': '7707083893', '5001 0073 2259': '500100732259', '7707083893\n': '7707083893',
  };
  for (const [vvod, nado] of Object.entries(sluchai)) {
    const p = pole(12);
    assert.ok(vstavit(sl, p, vvod), 'вставку «' + vvod + '» должен взять скрипт');
    assert.strictEqual(p.value, nado, JSON.stringify(vvod));
    assert.ok(p.sobytiya >= 1, 'после вставки — событие input для остальных скриптов');
  }
  const chistyj = pole(12);
  assert.ok(!vstavit(sl, chistyj, '7707083893'), 'чистый ИНН вставляет сам браузер');
  assert.strictEqual(chistyj.value, '7707083893');
});

test('inn-pole: 12 цифр в поле «только организации» не обрезаются до чужого ИНН', () => {
  const sl = zapustit();
  for (const vvod of ['500100732259', 'ИНН 500100732259']) {
    const p = pole(10);
    vstavit(sl, p, vvod);
    assert.strictEqual(p.value, '500100732259', vvod);
    assert.ok(!/^\d{10}$/.test(p.value), 'поле прошло бы pattern \\d{10}');
    sl.invalid({ target: p });
    assert.ok(/ИНН организации/.test(p.custom) && /12/.test(p.custom), p.custom);
  }
});

test('inn-pole: ввод — только цифры; отказ — по-русски, с длиной, без «!»', () => {
  const sl = zapustit();
  const p = pole(12, '77 07a');
  p.custom = 'старое';
  sl.input({ target: p });
  assert.strictEqual(p.value, '7707');
  assert.strictEqual(p.custom, '', 'ввод снимает прошлый отказ');
  sl.invalid({ target: p });
  assert.ok(p.custom.includes('Сейчас цифр:\u00a04.'), p.custom);
  const pusto = pole(12);
  sl.invalid({ target: pusto });
  assert.ok(/^Введите ИНН/.test(pusto.custom) && pusto.custom.includes('12\u00a0у\u00a0ИП'), pusto.custom);
  const org = pole(10, '123');
  sl.invalid({ target: org });
  assert.ok(org.custom.startsWith('ИНН организации'), org.custom);
  for (const t of [p.custom, pusto.custom, org.custom]) {
    assert.ok(!t.includes('!'), t);
    assert.ok(!/[ ](10|12)\b|\b(10|12)[ ]/.test(t), 'число не отрывается от соседнего слова: ' + t);
  }
  const chuzhoe = { matches: () => false, value: 'abc' };
  sl.input({ target: chuzhoe });
  assert.strictEqual(chuzhoe.value, 'abc', 'другие поля не трогаем');
});

const PROPUSK = new Set(['node_modules', '.git', 'tests', 'js', 'css', 'img', 'fonts', 'partials', 'сайт']);
function html(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!PROPUSK.has(e.name) && !e.name.startsWith('.')) html(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

test('inn-pole: каждое поле ИНН формы «Проверить» — под скрипт и с подписью для экранного диктора', () => {
  let n = 0;
  for (const f of html(KOREN)) {
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/<input\b[^>]*\bname="inn"[^>]*>/g)) {
      const tag = m[0];
      if (!/\bpattern="/.test(tag)) continue; // поиск на главной принимает и название — у него свой разбор
      n++;
      const kto = path.relative(KOREN, f);
      assert.ok(/\binputmode="numeric"/.test(tag), kto + ': без inputmode="numeric" скрипт поле не увидит');
      assert.ok(/\bmaxlength="(10|12)"/.test(tag), kto + ': maxlength 10 или 12');
      const id = (tag.match(/\bid="([^"]+)"/) || [])[1];
      const podpis = /\baria-label="[^"]+"/.test(tag) || (id && t.includes('<label for="' + id + '"'));
      assert.ok(podpis, kto + ': поле ИНН без подписи (aria-label или <label for>) — только placeholder');
    }
  }
  assert.ok(n >= 30, 'полей ИНН с pattern: ' + n);
});
