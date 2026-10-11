// platyat-pozzhe-v1: «Контрагенты стали платить позже» на главной + строка «Для сравнения» в «Условиях сделки».
// ТЗ [Продукт] 10.10 разд. 3.4. Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const K = path.join(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(K, 'data/rynok.json'), 'utf8')).platezhi;
const HTML = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const U = require(path.join(K, 'js/usloviya.js'));
const DEN = 864e5;

function blok(txt) {
  const m = /<!--rynok-glavnaya-->([\s\S]*?)<!--\/rynok-glavnaya-->/.exec(txt);
  assert.ok(m, 'в index.html нет меток <!--rynok-glavnaya-->');
  return m[1];
}
const tekst = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const B = blok(HTML);
const T = tekst(B);
const plus = (iso, d) => new Date(Date.parse(iso + 'T00:00:00Z') + d * DEN).toISOString().slice(0, 10); // календарные дни, без часового пояса
const DO = plus(P.sverka, 121);
function okno(seichas) {
  const s = /<script>([\s\S]*?)<\/script>/.exec(B)[1];
  const sec = { hidden: false };
  const win = {};
  const D = function () {}; D.now = () => seichas; D.parse = Date.parse;
  vm.runInNewContext(s, { window: win, document: { getElementById: id => (id === 'rynok' ? sec : null) }, Date: D });
  return { sec, R: win.DLK_RYNOK };
}

test('блок стоит между «Как решают суды» и калькулятором и собран из data/rynok.json (sobrat_rynok --check)', () => {
  const a = HTML.indexOf('id="praktika"'), b = HTML.indexOf('<!--rynok-glavnaya-->'), c = HTML.indexOf('id="oshibka"');
  assert.ok(a > 0 && a < b && b < c, 'порядок: разборы → «Платят позже» → калькулятор');
  execFileSync('python3', [path.join(K, 'tests/sobrat_rynok.py'), '--check', '--segodnya', P.sverka], { stdio: 'pipe' });
});

test('все числа блока и строки «Для сравнения» — из data/rynok.json (плюс «60 дней» и «1 из 4»)', () => {
  const izJson = new Set();
  Object.values(P).forEach(v => (String(v).match(/\d+(?:,\d+)?/g) || []).forEach(n => izJson.add(String(+n.replace(',', '.')).replace('.', ','))));
  const dop = new Set(['60', '1', '4']);
  const R = okno(Date.parse(P.sverka + 'T12:00:00+03:00')).R;
  [T, R.tekst.replace(/\u00a0/g, ' ')].forEach(t => {
    (t.match(/\d+(?:,\d+)?/g) || []).forEach(n => {
      const k = String(+n.replace(',', '.')).replace('.', ',');
      assert.ok(izJson.has(k) || dop.has(k), 'число «' + n + '» не из data/rynok.json: ' + t);
    });
  });
  ['vovremya', 'svyshe60', 'msb_do60_pp', 'msb_svyshe60_pp'].forEach(k =>
    assert.ok(T.includes(P[k].replace(/^выше /, '')), k + ' = ' + P[k] + ' — нет в блоке'));
  assert.ok(T.includes('Источник: ' + P.istochnik.replace(', ', ' и ') + ', ' + P.period));
  assert.match(T, /≈ 1 из 4/);
  assert.ok(R.tekst.replace(/\u00a0/g, ' ').startsWith('Для сравнения: ' + P.dolya_s_opozdaniem + ' счетов'));
});

test('источник — ссылкой nofollow, цель Метрики platyat_pozzhe_klik ведёт к форме проверки; кнопок нет (primary на экране одна)', () => {
  assert.ok(B.includes('<a href="' + P.url + '" target="_blank" rel="nofollow noopener">Интерфакса</a>'));
  assert.match(B, /<a href="#check" data-focus-inn data-goal="platyat_pozzhe_klik">Проверить, сколько платить вперёд/);
  assert.match(HTML, /<form class="check" id="check"/);
  assert.doesNotMatch(B, /<button|class="btn/);
});

test('сверка старше 120 дней — блока нет: сборщик ставит пустые метки, а страница прячет блок сама', () => {
  const py = 'import sys,datetime;sys.path.insert(0,"tests");import sobrat_rynok as s;' +
    't=open("index.html",encoding="utf-8").read();p=s.dannye();' +
    'print(s.sobrat(t,p,datetime.date.fromisoformat(sys.argv[1])).count("<!--rynok-glavnaya--><!--/rynok-glavnaya-->"))';
  assert.strictEqual(execFileSync('python3', ['-c', py, plus(P.sverka, 121)], { cwd: K }).toString().trim(), '1');
  assert.strictEqual(execFileSync('python3', ['-c', py, plus(P.sverka, 120)], { cwd: K }).toString().trim(), '0');
  const svezhij = okno(Date.parse(DO + 'T00:00:00+03:00') - 1);
  assert.strictEqual(svezhij.sec.hidden, false);
  assert.ok(svezhij.R && svezhij.R['do'] === DO);
  const staryj = okno(Date.parse(DO + 'T00:00:00+03:00'));
  assert.strictEqual(staryj.sec.hidden, true);
  assert.strictEqual(staryj.R, null);
  assert.strictEqual(U.rynokStroka({ tekst: 'x', do: DO }, { tone: 'go', cap: 1e6 }, Date.parse(DO + 'T00:00:00+03:00')), '');
});

test('цифры поменялись — сборщик не ставит старые слова («каждый пятый», «≈ 1 из 4») с новыми числами', () => {
  const py = 'import sys;sys.path.insert(0,"tests");import sobrat_rynok as s;p=s.dannye();p[sys.argv[1]]=sys.argv[2]\n' +
    'try:\n s.blok(p);print("собрал")\nexcept s.StaryjTekst:\n print("стоп")';
  assert.strictEqual(execFileSync('python3', ['-c', py, 'do60', 'примерно 25 %'], { cwd: K }).toString().trim(), 'стоп');
  assert.strictEqual(execFileSync('python3', ['-c', py, 'dolya_s_opozdaniem', 'около трети'], { cwd: K }).toString().trim(), 'стоп');
});

test('в блоке нет «лучш», «гарант», «100 %», «ИИ», «нейро» и «не заплатит» (источник — о просрочке, не о неоплате)', () => {
  const t = T.toLowerCase();
  ['лучш', 'гарант', '100 %', 'нейро', 'не заплат', 'каждый четвёртый'].forEach(w => assert.ok(!t.includes(w), w));
  assert.doesNotMatch(T, /(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)/);
});

test('«Для сравнения» — только при пределе предоплаты: не при «только по факту», «не платить» и «советуем по факту»', () => {
  const R = { tekst: 'Для сравнения: …', do: DO };
  const t0 = Date.parse(P.sverka + 'T12:00:00+03:00');
  assert.strictEqual(U.rynokStroka(R, { tone: 'cap', cap: 250000 }, t0), R.tekst);
  assert.strictEqual(U.rynokStroka(R, { tone: 'go', cap: 3000000 }, t0), R.tekst);
  assert.strictEqual(U.rynokStroka(R, { tone: 'post', cap: 0 }, t0), '');
  assert.strictEqual(U.rynokStroka(R, { tone: 'stop', cap: 0 }, t0), '');
  assert.strictEqual(U.rynokStroka(R, { tone: 'cap', cap: 0, malo: true }, t0), '');
  assert.strictEqual(U.rynokStroka(null, { tone: 'go', cap: 1e6 }, t0), '');
  // на настоящем решении: ликвидирована → stop, строки нет; чистая компания с выручкой → предел, строка есть
  const r = (status, signals) => ({ risk_level: 'low', company: { inn: '7700000000', name_short: 'ООО «Пример»', status, reg_date: '2015-01-01' }, signals: signals || [] });
  assert.strictEqual(U.rynokStroka(R, U.decide(r('LIQUIDATED')), t0), '');
  const go = U.decide(r('ACTIVE'));
  assert.ok(go.cap > 0, 'у чистой компании есть предел');
  assert.strictEqual(U.rynokStroka(R, go, t0), R.tekst);
});

test('строку передаёт только экран проверки на главной — не PDF-досье и не Паспорт', () => {
  assert.match(HTML, /Usloviya\.mount\(ub,r,\{rynok:window\.DLK_RYNOK\}\)/);
  ['report.html', 'pasport/kontragent/index.html', 'indeks/index.html'].forEach(f =>
    assert.doesNotMatch(fs.readFileSync(path.join(K, f), 'utf8'), /DLK_RYNOK|rynok:/, f));
  assert.doesNotMatch(fs.readFileSync(path.join(K, 'js/otchet.js'), 'utf8'), /DLK_RYNOK/);
});
