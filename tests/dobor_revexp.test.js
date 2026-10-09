// dobor-revexp-v1 (10.10.2026): workflow «Добор ИНН из набора ФНС» — ветка dobor с ИНН юрлиц для волны карточек.
// Краснеет, если workflow (1) пишет куда-то кроме ветки dobor (main — никогда: там деплой), (2) кладёт в ветку
// что-то кроме dobor.txt и dobor_meta.txt (набор ФНС и названия компаний в репозиторий не идут), (3) потерял проверку
// «только 10-значные ИНН юрлиц» (ИП — 12 знаков, их данные не публикуем), (4) запускается от правок сайта (лишние
// прогоны и нагрузка на ФНС). И реальный прогон: отбор kartochki.py vybor на синтетическом наборе — тем же вызовом,
// что в workflow, без сети.
// Запуск: node --test tests/dobor_revexp.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const WF = fs.readFileSync(path.join(KOREN, '.github/workflows/dobor-revexp.yml'), 'utf8');
const strokiKoda = WF.split('\n').filter((s) => !/^\s*#/.test(s));

test('dobor: права и куда пишет — только ветка dobor', () => {
  assert.match(WF, /^permissions:\n\s+contents: write\s*$/m);
  assert.ok(!/pull-requests|actions: write|id-token/.test(WF), 'лишние права');
  const push = strokiKoda.filter((s) => /git\s+push/.test(s));
  assert.strictEqual(push.length, 1, 'ровно один git push');
  assert.match(push[0], /\sdobor\s*$/, 'push только в dobor');
  assert.ok(!/\bmain\b/.test(push[0]), 'в строке push нет main');
  assert.match(WF, /git init -q -b dobor/, 'ветка собирается с нуля — без истории сайта');
});

test('dobor: в ветку — ровно dobor.txt и dobor_meta.txt', () => {
  const add = strokiKoda.filter((s) => /git\s+add/.test(s));
  assert.strictEqual(add.length, 1);
  assert.deepStrictEqual(add[0].trim().split(/\s+/).slice(2).sort(), ['dobor.txt', 'dobor_meta.txt']);
  assert.ok(!/git add (-A|\.|--all)/.test(WF));
});

test('dobor: источник — набор ФНС revexp, проверка ИНН юрлиц на месте', () => {
  assert.match(WF, /https:\/\/www\.nalog\.gov\.ru\/opendata\/7707329152-revexp\//);
  assert.match(WF, /https:\/\/file\.nalog\.ru\/opendata\/7707329152-revexp\/data-\d{8}-structure-\d{8}\.zip/);
  assert.match(WF, /inn_yul_ok/, 'шаг проверки «только ИНН юрлиц»');
  assert.match(WF, /kartochki\.py vybor --revexp revexp\.zip/);
  assert.match(WF, /unzip -tq revexp\.zip/, 'битый или пустой ответ ФНС роняет шаг');
});

test('dobor: запускается только от своих файлов, раз в неделю и вручную', () => {
  const blok = WF.split('\non:\n')[1].split('\npermissions:')[0];
  const puti = [...blok.matchAll(/^\s+- '([^']+)'$/gm)].map((m) => m[1]).sort();
  assert.deepStrictEqual(puti, ['.github/workflows/dobor-revexp.yml', 'tests/kartochki.py',
    'tests/kartochki_otsev.txt', 'tests/kartochki_vybor.py']);
  assert.match(blok, /branches: \[main\]/);
  assert.match(blok, /cron: '\d+ \d+ \* \* \d'/, 'раз в неделю');
  assert.match(blok, /workflow_dispatch:/);
  assert.ok(!/pull_request/.test(blok), 'от PR не запускается — у PR из форков нет прав, а набор качать незачем');
});

test('dobor: реальный прогон отбора на синтетическом наборе (тот же вызов, что в workflow)', () => {
  const VES = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const inn = (r, k) => {
    const s = r + String(1000000 + k).slice(1, 8).padStart(7, '0');
    return s + String(VES.reduce((a, v, i) => a + v * Number(s[i]), 0) % 11 % 10);
  };
  const docs = [];
  let k = 0;
  for (const r of ['48', '77', '50', '66', '78', '23']) {
    for (let i = 0; i < 20; i += 1) {
      k += 1;
      docs.push(`<Документ><СведНП НаимОрг="Тест" ИННЮЛ="${inn(r, k * 7919)}"/><СведДохРасх СумДоход="${(70 + k) * 1e6}" СумРасход="1"/></Документ>`);
    }
  }
  docs.push('<Документ><СведНП ИННЮЛ="482400000001"/><СведДохРасх СумДоход="900000000"/></Документ>'); // 12 знаков — ИП
  docs.push(`<Документ><СведНП ИННЮЛ="${inn('77', 1)}"/><СведДохРасх СумДоход="1000"/></Документ>`); // доход ниже порога
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dobor-'));
  const xml = path.join(d, 'revexp.xml');
  fs.writeFileSync(xml, `<?xml version="1.0" encoding="utf-8"?><Файл>${docs.join('')}</Файл>`);
  const vyhod = path.join(d, 'dobor.txt');
  const log = execFileSync('python3', [path.join(KOREN, 'tests/kartochki.py'), 'vybor', '--revexp', xml, '--n', '40',
    '--vyhod', vyhod], { encoding: 'utf8', cwd: KOREN });
  assert.match(log, /выбрано: 40/);
  const s = fs.readFileSync(vyhod, 'utf8').split(/\s+/).filter(Boolean);
  assert.strictEqual(s.length, 40);
  assert.strictEqual(new Set(s).size, 40, 'без повторов');
  for (const x of s) assert.match(x, /^\d{10}$/, 'только ИНН юрлиц: ' + x);
  assert.ok(!s.includes(inn('77', 1)), 'ниже порога дохода — не берём');
  assert.strictEqual(s.filter((x) => x.startsWith('48')).length, 6, 'квота Липецкой — 15 %');
  fs.rmSync(d, { recursive: true, force: true });
});
