// chistka-v1 (Очередь п. 286, Тестировщик 11.10 14:45): в том, что сайт отдаёт наружу, нет служебного —
// путей к внутренним документам команды, пометок отделов и «решений владельца». Снаружи — только «Команда Делоскопа».
// Красный тест → python3 tests/chistka.py (чистит сам, повторный запуск ничего не меняет) → закоммитить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const KOREN = path.join(__dirname, '..');
const NE_SAJT = new Set(['.git', 'tests', 'deploy', '.github', 'node_modules', '__pycache__']);
const NE_SAJT_FAJLY = new Set(['Dockerfile', '.gitignore']);
const TEKST = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.md', '.svg', '.webmanifest', '.csv', '.yml', '.yaml']);

// то же, что ZAPRET в tests/chistka.py
const ZAPRET = [
  [/claude/i, 'путь или имя внутреннего инструмента'],
  [/[Рр]ешени[а-яё]* владельца|«да» владельца|[Пп]риказ владельца/, '«решение владельца»'],
  [/\[(?:✎\s*)?(?:Право|Продукт|Ночные|Ночных|Выкладк|Штаб|Планёрк|Тестировщик|Стратег|Арт-директор)/, 'пометка отдела в [скобках]'],
  [/«Штаб/, '«Штаб»'],
  [/Ночн(?:ые|ых)(?:-\d)?[\s,)]/, 'подпись запуска «Ночные …»'],
];

function fajly(papka = KOREN, koren = true, out = []) {
  for (const z of fs.readdirSync(papka, { withFileTypes: true })) {
    if (z.isDirectory()) {
      if ((koren && NE_SAJT.has(z.name)) || ['node_modules', '__pycache__', '.git'].includes(z.name)) continue;
      fajly(path.join(papka, z.name), false, out);
    } else if (z.isFile()) {
      if (koren && NE_SAJT_FAJLY.has(z.name)) continue;
      if (TEKST.has(path.extname(z.name).toLowerCase())) out.push(path.join(papka, z.name));
    }
  }
  return out;
}

test('в исходнике сайта нет служебного (claude/, пометок отделов, «решений владельца»)', () => {
  const najdeno = [];
  for (const f of fajly()) {
    const stroki = fs.readFileSync(f, 'utf8').split('\n');
    stroki.forEach((s, i) => {
      for (const [re, chto] of ZAPRET) {
        if (re.test(s)) najdeno.push(`${path.relative(KOREN, f)}:${i + 1} — ${chto}`);
      }
    });
  }
  assert.deepStrictEqual(najdeno.slice(0, 30), [],
    `служебное в файлах сайта (${najdeno.length}). Почистить: python3 tests/chistka.py`);
});

test('проверяем весь сайт, а не пустой список: страницы, скрипты, данные', () => {
  const vse = fajly().map((f) => path.relative(KOREN, f).split(path.sep).join('/'));
  for (const f of ['index.html', 'tarify/tarify.json', 'js/shchit.js', 'sroki.json', 'css/ds.css']) assert.ok(vse.includes(f), f);
  assert.ok(!vse.some((f) => f.startsWith('tests/') || f.startsWith('deploy/') || f.startsWith('.github/')), 'служебные папки не проверяем — сайт их не отдаёт');
});

test('обычные слова страниц не тронуты: «владельца счёта», «без согласия владельца», «владельцы облигаций»', () => {
  const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
  assert.match(chitat('praktika/115-fz/dvojnik-postavshchika-bank-poluchatelya/index.html'), /владельца счёта/);
  assert.match(chitat('js/shchit.js'), /без согласия владельца/);
  assert.match(chitat('praktika/nalogi/reorganizaciya-kontragenta-dosrochnyj-vozvrat-ks-17-p/index.html'), /Владельцы облигаций/);
});

test('чистильщик: сайт уже чистый, повторный запуск ничего не меняет', () => {
  const vyvod = execFileSync('python3', [path.join(KOREN, 'tests', 'chistka.py'), '--check'], { encoding: 'utf8' });
  assert.match(vyvod, /чистый/);
});

test('чистильщик: правила — на образцах (что меняет и что оставляет)', () => {
  const kod = [
    'import importlib.util, json, sys',
    `s = importlib.util.spec_from_file_location("ch", ${JSON.stringify(path.join(KOREN, 'tests', 'chistka.py'))})`,
    'm = importlib.util.module_from_spec(s); s.loader.exec_module(m)',
    'print(json.dumps([m.pochistit(x) for x in json.loads(sys.stdin.read())], ensure_ascii=False))',
  ].join('\n');
  const obrazcy = [
    '/* шапка (claude/Дизайн_шапка_логотип_и_Скорая_v2.md, разд. 2) */',
    '// решение владельца 02.10, тексты [Право · Юрист 115-ФЗ] 03.10',
    '"soglasovano": "владелец, 30.09.2026"',
    'Меняет только «Штаб» по правилу',
    'с данными владельца счёта; без согласия владельца (ст. 8 229-ФЗ); Владельцы облигаций',
    '// «Папка к договору» (Ночные 30.09 23:05): опись; (nds-porog-v1, Ночные-2, 03.10); (Прорыв Ночных 30.09 14:05)',
  ];
  const otvet = JSON.parse(execFileSync('python3', ['-c', kod], { input: JSON.stringify(obrazcy), encoding: 'utf8' }));
  assert.deepStrictEqual(otvet, [
    '/* шапка (документ команды, разд. 2) */',
    '// решение команды 02.10, тексты [команда] 03.10',
    '"soglasovano": "команда, 30.09.2026"',
    'Меняет только команда по правилу',
    'с данными владельца счёта; без согласия владельца (ст. 8 229-ФЗ); Владельцы облигаций',
    '// «Папка к договору» (команда 30.09 23:05): опись; (nds-porog-v1, команда, 03.10); (команда 30.09 14:05)',
  ]);
});
