// paket-legkij-v1 (25.10.2026): пакеты js/b/*.js и css/b/*.css — без комментариев и отступов исходников
// (tests/szhat_js.py, вызывает tests/sobrat_js.py). Исходники js/*.js с комментариями остаются как были.
// Сторож: (1) каждый пакет компилируется; (2) в пакетах нет комментариев, кроме заголовка и пометок «--- /файл ---»;
// (3) на хитрых образцах (// в строках, /* в регулярках, шаблоны с ${…}, автоматическая «;») код до и после сжатия
// даёт один и тот же результат.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const KARTA = JSON.parse(fs.readFileSync(path.join(KOREN, 'partials', 'sborka.json'), 'utf8'));
const pakety = (v) => fs.readdirSync(path.join(KOREN, v, 'b')).filter((f) => f.endsWith('.' + v));

function szhat(vid, tekst) {
  const kod = 'import sys; sys.path.insert(0, "tests"); from szhat_js import szhat_js, szhat_css; ' +
    'sys.stdout.write((szhat_js if sys.argv[1] == "js" else szhat_css)(sys.stdin.read()))';
  return execFileSync('python3', ['-c', kod, vid], { cwd: KOREN, input: tekst, encoding: 'utf8' });
}

test('пакеты JS компилируются и без комментариев', () => {
  const fajly = pakety('js');
  assert.ok(fajly.length >= 5, 'пакеты на месте');
  for (const f of fajly) {
    const t = fs.readFileSync(path.join(KOREN, 'js', 'b', f), 'utf8');
    assert.doesNotThrow(() => new vm.Script(t, { filename: f }), f + ' компилируется');
    const imya = f.split('.')[0];
    const pometki = (t.match(/^\/\* --- \/[^\n]* --- \*\/$/gm) || []).length;
    assert.strictEqual(pometki, KARTA.pakety[imya].length, f + ': пометка на каждый исходник');
    // строки, которые начинаются с комментария (кроме заголовка и пометок), — признак, что сжатие не сработало
    const lishnie = t.split('\n').slice(1).filter((s) => /^\s*(\/\/|\/\*)/.test(s) && !/^\/\* --- \//.test(s));
    assert.deepStrictEqual(lishnie, [], f + ': комментарии исходников в пакет не попадают');
    assert.ok(!/^[ \t]+\S/m.test(t.replace(/`(?:\\[\s\S]|[^`\\])*`/g, '')), f + ': отступы вне шаблонов убраны');
  }
});

test('пакеты CSS без комментариев, скобки сбалансированы', () => {
  for (const f of pakety('css')) {
    const t = fs.readFileSync(path.join(KOREN, 'css', 'b', f), 'utf8');
    const bez = t.replace(/^\/\*[^\n]*\*\/$/gm, '');
    assert.ok(!bez.includes('/*'), f + ': комментарии исходников в пакет не попадают');
    const otkr = (t.match(/\{/g) || []).length;
    assert.strictEqual(otkr, (t.match(/\}/g) || []).length, f + ': { и } поровну');
  }
});

test('сжатие не меняет поведение кода (образцы)', () => {
  const obrazec = [
    '(function () {',
    '  // комментарий',
    '  var url = "https://deloskop.ru/a//b"; /* блок */ var s = \'/* не комментарий */\';',
    '  var re = /\\/\\*[^*]*\\*\\//g, d = 10 / 2 / 5;',
    '  var k = [/"/.test(\'"\'), /[/]/.test("/")];',
    '  var t = `строка // не комментарий\n    отступ внутри ${ `вложенный ${d} /* тоже */` } конец`;',
    '  var a = 1',
    '  /* многострочный',
    '     комментарий */',
    '  var b = a',
    '  ++b',
    '  function f() { return /*',
    '  */ 42 }',
    '  var o = { x: 1 }, p = o.x / 1;',
    '  return [url, s, re.source, d, k, t, a, b, f(), p];',
    '})()',
  ].join('\n');
  const posle = szhat('js', obrazec);
  assert.ok(!posle.includes('многострочный') && !posle.includes('блок') && !posle.includes('// комментарий'), 'комментарии убраны');
  assert.ok(posle.includes('отступ внутри'), 'текст шаблона на месте');
  assert.strictEqual(JSON.stringify(vm.runInNewContext(posle)), JSON.stringify(vm.runInNewContext(obrazec)), 'тот же результат');
  assert.strictEqual(vm.runInNewContext(posle)[8], undefined, 'return с переводом строки в комментарии — как в исходнике');
});

test('CSS: строки и значения не тронуты', () => {
  const obrazec = '/* шапка */\n.a::before {\n  content: "/* не комментарий */";\n  /* убрать */\n  color: red; }\n';
  const posle = szhat('css', obrazec);
  assert.ok(posle.includes('content: "/* не комментарий */";'));
  assert.ok(!posle.includes('убрать') && !posle.includes('шапка'));
});
