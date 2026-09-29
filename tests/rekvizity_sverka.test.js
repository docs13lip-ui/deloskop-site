// site-v10 (28.09.2026): «продавец, который проверяет себя сам» (п. 126) и «место нахождения — город» (п. 123).
// rekvizity_iz_api.py сверяет реквизиты из админки с ЕГРИП нашим же /api/check и пишет в rekvizity.json только
// населённый пункт; сборщик ставит город в подвал, оферту и на /rekvizity/ + строку «Сверено с ЕГРИП».
// Адрес регистрации (улица, дом, квартира, индекс) на сайт не попадает никогда (ч. 2 ст. 10 149-ФЗ; решение 28.09).
// Запуск: node --test tests/rekvizity_sverka.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile, execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');

// Синтетические номера с верными контрольными цифрами (не реальный человек)
function inn12() {
  const d = [7, 7, 0, 1, 2, 3, 4, 5, 6, 7];
  d.push([7, 2, 4, 10, 3, 5, 9, 4, 6, 8].reduce((s, w, i) => s + w * d[i], 0) % 11 % 10);
  d.push([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8].reduce((s, w, i) => s + w * d[i], 0) % 11 % 10);
  return d.join('');
}
const INN = inn12();
const OGRNIP = '32677000012345' + String(Number(32677000012345n % 13n) % 10);
const REKV = { est: true, fio: 'Тестов Тест Тестович', inn: INN, ogrnip: OGRNIP, data_registracii: '28.09.2026',
  organ_registracii: 'Межрайонная ИФНС России № 6 по Липецкой области', adres_dlya_pisem: '398000, г. Липецк, а/я 1',
  email: 'help@deloskop.ru' };
const ULICA = '398001, Липецкая обл, г Липецк, ул Тестовая, д 7, кв 13';
const CHECK = { company: { inn: INN, ogrn: OGRNIP, kind: 'INDIVIDUAL', status: 'ACTIVE', address: ULICA } };
const PUSTOJ = { email: 'help@deloskop.ru', fio: '', inn: '', ogrnip: '', telefon: '', banki: [] };

function py(kod, vhod, env) {
  return execFileSync('python3', ['-c', 'import sys, json; sys.path.insert(0, "tests");\n' + kod],
    { cwd: KOREN, encoding: 'utf8', input: vhod || '', env: Object.assign({}, process.env, env || {}) });
}

test('город из адреса: только населённый пункт, улица/дом/индекс — никогда', () => {
  const sluchai = {
    '398000, Липецкая обл, г Липецк': 'г. Липецк',
    'г Москва': 'г. Москва',
    [ULICA]: 'г. Липецк',
    'г Санкт-Петербург, пр-кт Невский, д 1': 'г. Санкт-Петербург',
    'Респ Татарстан, г Казань': 'г. Казань',
    'Московская обл, г.о. Красногорск, г Красногорск': 'г. Красногорск',
    'Липецкая обл, Грязинский р-н, с Казинка': 'с. Казинка, Липецкая обл',
    'ул Ленина, д 5': '',
    'Иванов Иван, ул Мира': '',
    '': '',
  };
  const out = JSON.parse(py('import rekvizity_iz_api as m; print(json.dumps({a: m.gorod_iz_adresa(a) for a in json.loads(sys.argv[1])}, ensure_ascii=False))'
    .replace('sys.argv[1]', JSON.stringify(JSON.stringify(Object.keys(sluchai))))));
  for (const [a, g] of Object.entries(sluchai)) assert.strictEqual(out[a], g, a);
  for (const g of Object.values(out)) assert.ok(!/(^|[\s,])(ул|кв|пр-кт)[\s.]|(^|[\s,])д\.?\s?\d|\d/.test(g), 'в городе лишнее: ' + g);
});

function zapusk(check, jsonFajl, args) {
  return new Promise(res => {
    const srv = http.createServer((q, s) => {
      if (q.url === '/api/rekvizity') { s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify(REKV)); }
      if (q.url === '/api/check?q=' + INN && check) { s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify(check)); }
      s.writeHead(404); s.end();
    }).listen(0, '127.0.0.1', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sverka-'));
      fs.mkdirSync(path.join(dir, 'tests'));
      fs.copyFileSync(path.join(KOREN, 'tests/rekvizity_iz_api.py'), path.join(dir, 'tests/rekvizity_iz_api.py'));
      fs.writeFileSync(path.join(dir, 'rekvizity.json'), JSON.stringify(jsonFajl, null, 2));
      execFile('python3', [path.join(dir, 'tests/rekvizity_iz_api.py')].concat(args || []),
        { env: Object.assign({}, process.env, { REKV_API: 'http://127.0.0.1:' + srv.address().port, REKV_SEGODNYA: '28.09.2026' }) },
        (err, out) => {
          srv.close();
          const txt = fs.readFileSync(path.join(dir, 'rekvizity.json'), 'utf8');
          res({ kod: err ? err.code : 0, out, txt, json: JSON.parse(txt) });
        });
    });
  });
}

test('rekvizity_iz_api.py: всё совпало — пишет отметку сверки и только город; адреса регистрации в файле нет', async () => {
  const r = await zapusk(CHECK, PUSTOJ);
  assert.strictEqual(r.kod, 0);
  assert.deepStrictEqual(r.json.sverka_egrip, { data: '28.09.2026', gorod: 'г. Липецк', sovpalo: 'ИНН, ОГРНИП и статус «действующий»' });
  for (const x of ['Тестовая', 'кв 13', '398001']) assert.ok(!r.txt.includes(x), 'в rekvizity.json ушло: ' + x);
  const c = await zapusk(CHECK, r.json, ['--check']);
  assert.strictEqual(c.kod, 0, 'повторная сверка того же дня — не «нужна сборка»');
});

test('rekvizity_iz_api.py: не совпал ОГРНИП или статус — «сверено» с сайта убираем и предупреждаем', async () => {
  const est = Object.assign({}, PUSTOJ, REKV, { sverka_egrip: { data: '01.09.2026', gorod: 'г. Липецк', sovpalo: 'x' } });
  delete est.est;
  for (const plohoj of [{ ogrn: '326770000000000' }, { status: 'LIQUIDATED' }]) {
    const r = await zapusk({ company: Object.assign({}, CHECK.company, plohoj) }, est);
    assert.strictEqual(r.kod, 0);
    assert.ok(!('sverka_egrip' in r.json), 'отметка сверки осталась при расхождении');
    assert.ok(r.out.includes('⚠ Сверка с ЕГРИП'));
    assert.strictEqual(r.json.fio, REKV.fio, 'реквизиты при этом не стираются');
  }
});

test('rekvizity_iz_api.py: /api/check не ответил — прежняя сверка не трогается', async () => {
  const est = Object.assign({}, PUSTOJ, REKV, { sverka_egrip: { data: '27.09.2026', gorod: 'г. Липецк', sovpalo: 'x' } });
  delete est.est;
  const r = await zapusk(null, est);
  assert.strictEqual(r.kod, 0);
  assert.deepStrictEqual(r.json.sverka_egrip, est.sverka_egrip);
});

test('сборщик: город — в подвале, оферте (подсудность) и на /rekvizity/; строка «Сверено с ЕГРИП»; лишнего нет', () => {
  const r = Object.assign({}, PUSTOJ, REKV, { sverka_egrip: { data: '28.09.2026', gorod: 'г. Липецк', sovpalo: 'ИНН, ОГРНИП и статус «действующий»' },
    adres_registracii: ULICA, address: ULICA });
  // тот же разбор, что rekv() сборщика, но из временного файла (настоящий rekvizity.json не трогаем)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sborka-'));
  fs.writeFileSync(path.join(dir, 'rekvizity.json'), JSON.stringify(r));
  const out = JSON.parse(py(
    'import os, sobrat_shapku as s; D = os.environ["SBORKA_DIR"]; orig = s.put\n' +
    's.put = lambda *a: os.path.join(D, *a) if a == ("rekvizity.json",) else orig(*a)\n' +
    'x = s.rekv(); of = open("oferta/index.html", encoding="utf-8").read()\n' +
    'print(json.dumps({"podval": s.podval_html(x), "isp": s.ispolnitel(x), "tab": s.tablica(x), "of": s.sobrat_stranicu(of, x, "<!--podval--><!--/podval-->")}, ensure_ascii=False))',
    '', { SBORKA_DIR: dir }));
  assert.ok(out.podval.includes('ОГРНИП ' + OGRNIP + ' · г.&nbsp;Липецк'), 'подвал без города');
  assert.ok(out.isp.includes('место нахождения — г.&nbsp;Липецк'));
  assert.ok(out.tab.includes('<td>Место нахождения</td><td>г.&nbsp;Липецк — по ЕГРИП</td>'));
  assert.ok(out.tab.includes('<td>Сверено с ЕГРИП</td><td>28.09.2026 — ИНН, ОГРНИП и статус «действующий» совпадают.'));
  assert.ok(out.tab.includes('href="/report.html?inn=' + INN + '"'));
  assert.ok(out.of.includes('по месту нахождения Исполнителя<!--r:gorod--> (г.&nbsp;Липецк)<!--/r--> после'));
  for (const k of ['podval', 'isp', 'tab', 'of']) for (const x of ['Тестовая', 'кв 13', '398001'])
    assert.ok(!out[k].includes(x), k + ': адрес регистрации попал на сайт: ' + x);
});

test('сборщик: без сверки — ни города, ни отметки; метка в оферте пустая', () => {
  const r = JSON.parse(chitat('rekvizity.json'));
  const of = chitat('oferta/index.html');
  assert.strictEqual((of.match(/<!--r:gorod-->/g) || []).length, 1, 'метка города в оферте ровно одна');
  if (!r.sverka_egrip) {
    assert.ok(of.includes('<!--r:gorod--><!--/r-->'));
    assert.ok(!chitat('rekvizity/index.html').includes('Сверено с ЕГРИП'));
  }
});

test('rekvizity.json: только разрешённые поля — адреса регистрации, паспорта, личного телефона нет', () => {
  const r = JSON.parse(chitat('rekvizity.json'));
  const mozhno = ['_kak', 'fio', 'inn', 'ogrnip', 'data_registracii', 'organ_registracii', 'adres_dlya_pisem', 'email', 'telefon',
    'banki', 'rkn_reestr_nomer', 'sverka_egrip'];
  for (const k of Object.keys(r)) assert.ok(mozhno.includes(k), 'лишнее поле в rekvizity.json: ' + k);
  if (r.sverka_egrip) assert.deepStrictEqual(Object.keys(r.sverka_egrip).sort(), ['data', 'gorod', 'sovpalo']);
  const sb = chitat('tests/sobrat_shapku.py');
  assert.ok(!/adres_registracii|\["address"\]/.test(sb), 'сборщик не должен знать об адресе регистрации');
});
