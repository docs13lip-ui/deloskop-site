// rekv-v1 (28.09.2026): реквизиты ИП на сайте — только из админки, только разрешённые поля.
// Решение владельца 28.09: ФИО, ИНН, ОГРНИП, дата и инспекция регистрации, адрес для писем (ст. 9 ЗоЗПП);
// счета, телефоны, личная почта, адрес регистрации — не публикуем.
// Запуск: node --test tests/rekvizity.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const R = require('../js/rekvizity.js');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');

// Синтетические номера с верными контрольными цифрами (не реальный человек)
function inn12() {
  const d = [7, 7, 0, 1, 2, 3, 4, 5, 6, 7];
  d.push([7, 2, 4, 10, 3, 5, 9, 4, 6, 8].reduce((s, w, i) => s + w * d[i], 0) % 11 % 10);
  d.push([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8].reduce((s, w, i) => s + w * d[i], 0) % 11 % 10);
  return d.join('');
}
const OGRNIP = '32677000012345' + String(Number(32677000012345n % 13n) % 10);
const OTVET = { est: true, fio: 'Тестов Тест Тестович', inn: inn12(), ogrnip: OGRNIP, data_registracii: '28.09.2026',
  organ_registracii: 'Межрайонная ИФНС России № 6 по Липецкой области', adres_dlya_pisem: '398000, г. Липецк, а/я 1',
  email: 'help@deloskop.ru' };

// Мини-DOM: ровно то, что использует js/rekvizity.js
function el(tag) {
  return { tag, children: [], className: '', href: '', _t: '', dataset: {}, parentNode: null,
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    replaceChild(nov, star) { const i = this.children.indexOf(star); this.children[i] = nov; nov.parentNode = this; },
    set textContent(v) { this._t = String(v); this.children = []; },
    get textContent() { return this._t + this.children.map(c => c.textContent).join(''); } };
}
function dok(rekv) {
  const body = el('body');
  const t = el('div'); t.dataset.rekv = 'tablica'; t.textContent = 'Реквизиты продавца появятся здесь…'; body.appendChild(t);
  const i = el('span'); i.dataset.rekv = 'ispolnitel'; i.textContent = 'сведения о котором указаны в разделе «Реквизиты»'; body.appendChild(i);
  return { body, createElement: el,
    querySelectorAll(s) { const k = s.match(/data-rekv="(\w+)"/)[1]; return body.children.filter(c => c.dataset && c.dataset.rekv === k); },
    querySelector(s) { return body.children.find(c => c.dataset && c.dataset.rekv) || null; } };
}

test('полный ответ — таблица и строка «Исполнитель» подставлены, только разрешённые поля', () => {
  const d = dok();
  assert.strictEqual(R.primenit(d, OTVET), 2);
  const t = d.body.textContent;
  for (const x of ['Индивидуальный предприниматель Тестов Тест Тестович', OTVET.inn, OGRNIP, '28.09.2026',
    'Межрайонная ИФНС России № 6', 'а/я 1', 'help@deloskop.ru', 'п.\u00a01 ст.\u00a0145 НК\u00a0РФ']) assert.ok(t.includes(x), 'нет: ' + x);
  assert.ok(t.includes('индивидуальный предприниматель Тестов Тест Тестович (ОГРНИП ' + OGRNIP + ', ИНН ' + OTVET.inn + ')'));
  assert.ok(!t.includes('появятся здесь'));
});

test('лишнее из ответа не выводится никогда: счета, телефон, личная почта', () => {
  const d = dok();
  R.primenit(d, Object.assign({}, OTVET, { rs: '40802810000000000001', telefon: '+7 900 000-00-00', email: 'lichnaya@yandex.ru',
    banki: [{ rs: '40802810000000000002' }] }));
  const t = d.body.textContent;
  for (const x of ['40802810', '+7 900', 'yandex.ru']) assert.ok(!t.includes(x), 'ушло на сайт: ' + x);
  assert.ok(t.includes('help@deloskop.ru'));
});

test('нет реквизитов / неполные / ошибка сети — заглушка остаётся как есть', () => {
  for (const r of [null, { est: false }, Object.assign({}, OTVET, { est: 'true' }), Object.assign({}, OTVET, { fio: 'Тестов' }),
    Object.assign({}, OTVET, { inn: '7701234567' }), Object.assign({}, OTVET, { ogrnip: '123' })]) {
    const d = dok();
    assert.strictEqual(R.primenit(d, r), 0);
    assert.ok(d.body.textContent.includes('появятся здесь'));
  }
});

test('сборщик: пока rekvizity.json пуст — на документах заглушки с меткой и скрипт; подвал без ИП', () => {
  const r = JSON.parse(chitat('rekvizity.json'));
  if (r.fio && r.inn && r.ogrnip) return; // реквизиты уже статичны — проверяет podval.test.js
  if (JSON.parse(chitat('tarify/tarify.json')).beta === true) { // beta-v1: в бете — честная строка, без скрипта реквизитов
    for (const f of ['rekvizity/index.html', 'oferta/index.html', 'politika/index.html']) {
      const t = chitat(f);
      assert.ok(t.includes('<div class="note" data-rekv="beta">'), f + ': нет строки беты');
      assert.ok(!/js\/rekvizity\.js/.test(t), f + ': в бете скрипт реквизитов не нужен');
    }
    return;
  }
  for (const f of ['rekvizity/index.html', 'oferta/index.html', 'politika/index.html']) {
    const t = chitat(f);
    assert.ok(t.includes('<div class="note" data-rekv="tablica">'), f + ': нет метки таблицы');
    assert.strictEqual((t.match(/<script src="\/js\/rekvizity\.js" defer><\/script>/g) || []).length, 1, f + ': скрипт ровно один раз');
  }
  assert.ok(chitat('oferta/index.html').includes('<span data-rekv="ispolnitel">индивидуальный предприниматель, сведения о котором указаны'));
  assert.ok(!/js\/rekvizity\.js/.test(chitat('index.html')), 'на обычных страницах скрипт не нужен');
});

test('js/rekvizity.js вставляет только текст (без innerHTML) и ходит только на /api/rekvizity', () => {
  const js = chitat('js/rekvizity.js');
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(js));
  assert.ok(js.includes("'/api/rekvizity'"));
});

test('админка: блок «На сайте» с галочкой, сохраняется отдельным запросом; счёт — «только с расчётного счёта» (п. 65)', () => {
  const a = chitat('admin.html'), j = chitat('js/admin-scheta.js');
  assert.ok(a.includes('id="rekPub" hidden') && a.includes('data-p="pokazyvat"') && a.includes('data-p="data_registracii"'));
  assert.ok(a.includes('домашний не указывайте'));
  assert.ok(j.includes('/api/admin/rekvizity/publichnye'));
  assert.ok(chitat('js/schet-dokument.js').includes('Оплата только с расчётного счёта организации или ИП.'));
});

// tests/rekvizity_iz_api.py — на локальном «API»
function zapusk(otvet, kod, jsonFajl, args) {
  return new Promise((res, rej) => {
    const srv = http.createServer((q, s) => {
      if (q.url !== '/api/rekvizity') { s.writeHead(404); return s.end(); }
      s.writeHead(kod, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(otvet));
    }).listen(0, '127.0.0.1', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rekv-'));
      fs.mkdirSync(path.join(dir, 'tests'));
      fs.copyFileSync(path.join(KOREN, 'tests/rekvizity_iz_api.py'), path.join(dir, 'tests/rekvizity_iz_api.py'));
      fs.writeFileSync(path.join(dir, 'rekvizity.json'), JSON.stringify(jsonFajl, null, 2));
      execFile('python3', [path.join(dir, 'tests/rekvizity_iz_api.py')].concat(args || []),
        { env: Object.assign({}, process.env, { REKV_API: 'http://127.0.0.1:' + srv.address().port }) }, (err, out) => {
          srv.close();
          res({ kod: err ? err.code : 0, out, json: JSON.parse(fs.readFileSync(path.join(dir, 'rekvizity.json'), 'utf8')) });
        });
    });
  });
}
const PUSTOJ = { email: 'help@deloskop.ru', fio: '', inn: '', ogrnip: '', telefon: '', banki: [{ bank: 'ПАО Сбербанк', rs: '' }] };

test('rekvizity_iz_api.py: данные из админки → rekvizity.json; банки и телефон не трогает; --check краснеет до записи', async () => {
  const c = await zapusk(OTVET, 200, PUSTOJ, ['--check']);
  assert.strictEqual(c.kod, 1);
  assert.strictEqual(c.json.fio, '');
  const r = await zapusk(OTVET, 200, PUSTOJ);
  assert.strictEqual(r.kod, 0);
  assert.strictEqual(r.json.fio, OTVET.fio);
  assert.strictEqual(r.json.ogrnip, OGRNIP);
  assert.strictEqual(r.json.adres_dlya_pisem, OTVET.adres_dlya_pisem);
  assert.deepStrictEqual(r.json.banki, PUSTOJ.banki);
});

test('rekvizity_iz_api.py: сбой API или «est:false» не стирает реквизиты с сайта', async () => {
  const est = Object.assign({}, PUSTOJ, { fio: OTVET.fio, inn: OTVET.inn, ogrnip: OGRNIP });
  for (const [otvet, kod] of [[{ detail: 'ошибка' }, 500], [{ est: false }, 200], [Object.assign({}, OTVET, { ogrnip: '326770000123450' }), 200]]) {
    const r = await zapusk(otvet, kod, est);
    assert.strictEqual(r.kod, 0);
    assert.strictEqual(r.json.fio, OTVET.fio);
  }
});
