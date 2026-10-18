// tipograf-tarify-v1 (18.10.2026, [Ночные запуски]): /tarify/ — та же типографика, что в статьях и на длинных страницах.
// 1) sobrat_tarify.py прогоняет страницу через tests/tipograf_statej.py → statya (внутри <article>): на 390 px висело
//    62 коротких слова в конце строки (Chromium), стало 0. Красный тест → python3 tests/sobrat_tarify.py . && python3 tests/sobrat_shapku.py
// 2) подсказки калькулятора (tarify.js) — через tipo(), ту же функцию, что в «Что нового» (obnovleniya.js);
// 3) «хватит N быстрых проверок в день» — число из tarify.json → gost_v_den (было «трёх» при лимите 10).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

function funkciya(src, imya, konec) {
  const a = src.indexOf('function ' + imya + '(');
  assert.ok(a >= 0, 'нет function ' + imya);
  const b = src.indexOf(konec, a);
  assert.ok(b > a, 'конец ' + imya + ' не найден');
  return src.slice(a, b + konec.length);
}

test('/tarify/ доведён типографом статей (правим источник — sobrat_tarify.py)', () => {
  const kod = 'import sys,importlib.util as u;s=u.spec_from_file_location("t",sys.argv[1]);m=u.module_from_spec(s);'
    + 's.loader.exec_module(m);sys.stdout.write(m.statya(sys.stdin.read(), "article"))';
  const s = chitat('tarify/index.html');
  const v = execFileSync('python3', ['-c', kod, path.join(__dirname, 'tipograf_statej.py')], { input: s, encoding: 'utf8' });
  assert.ok(v === s, 'типограф ещё что-то правит на /tarify/ — python3 tests/sobrat_tarify.py . && python3 tests/sobrat_shapku.py');
  assert.ok(chitat('tests/sobrat_tarify.py').includes("TIPO.statya(page, 'article')"), 'типограф — в сборщике');
  const art = s.slice(s.indexOf('<article>'), s.indexOf('</article>'));
  assert.ok(art.includes('в&nbsp;'), 'на странице есть неразрывные пробелы после предлогов');
});

test('tarify.js: tipo() — та же, что в obnovleniya.js; подсказки калькулятора — через неё', () => {
  const t = chitat('tarify/tarify.js');
  const konec = '"$1\\u2011");}';
  assert.strictEqual(funkciya(t, 'tipo', konec), funkciya(chitat('obnovleniya.js'), 'tipo', konec));
  for (const pole of ['i-per', 'i-alt', 'o-nalog-sost']) {
    const vse = t.split('$("' + pole + '").textContent = ').length - 1;
    const s_tipo = t.split('$("' + pole + '").textContent = tipo(').length - 1;
    const pusto = t.split('$("' + pole + '").textContent = "";').length - 1;
    assert.ok(vse > 0 && vse === s_tipo + pusto, pole + ': текст — через tipo()');
  }
  assert.ok(t.includes('$("o-vyvod").textContent = tipo(vyvod);'));
  assert.ok(t.includes('"<li>" + tipo(s) + "</li>"'));
});

test('калькулятор: «хватит N быстрых проверок в день» — N из gost_v_den', () => {
  const t = chitat('tarify/tarify.js');
  assert.ok(!/трёх быстрых|трех быстрых|3 быстрых/.test(t), 'число быстрых проверок не пишем руками');
  const f = new Function('D', funkciya(t, 'bystryhVDen', '\n  }') + '\nreturn bystryhVDen(D);');
  const D = JSON.parse(chitat('tarify/tarify.json'));
  const n = D.gost_v_den;
  assert.strictEqual(f(D), n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'быстрой проверки' : 'быстрых проверок') + ' в день');
  assert.strictEqual(f({ gost_v_den: 1 }), '1 быстрой проверки в день');
  assert.strictEqual(f({ gost_v_den: 10 }), '10 быстрых проверок в день');
  assert.strictEqual(f({ gost_v_den: 21 }), '21 быстрой проверки в день');
});
