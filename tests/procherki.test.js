// «Прочерки» (решение владельца 29.09 23:15 «по судам пока прочерк»): суды, банкротство, приставы, РНП —
// «не проверяли» без обещаний срока, с дорогой к первоисточнику «проверьте сами». node --test tests/procherki.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const E = require(path.join(ROOT, 'pasport', 'engine.js'));
const chitat = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function demo(status) {
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.checked_at = '2026-09-30T01:10:00+03:00';
  if (status) r.company = Object.assign({}, r.company, { status });
  r.damia = {};
  return r;
}
const opt = { usloviya: U, indeksVorota: IV };
const razdel = (p, id) => p.razdely.find((x) => x.id === id);
const HOSTY = /^https:\/\/(kad\.arbitr\.ru|bankrot\.fedresurs\.ru|fssp\.gov\.ru|zakupki\.gov\.ru|service\.nalog\.ru)\//;

test('разделы 8–11: без обещаний «подключается / появятся автоматически», у каждого — «проверьте сами»', () => {
  const p = P.sobrat(demo(), opt);
  ['sudy', 'scheta', 'pristavy', 'goszakaz'].forEach((id) => {
    const x = razdel(p, id);
    assert.ok(!/подключается|появятся .*автоматически/i.test(x.prichina), id + ': обещание срока');
    assert.ok(x.sam.length >= 1, id + ': нет ссылки «проверьте сами»');
    x.sam.forEach((a) => { assert.match(a.url, HOSTY, id + ': ссылка не на первоисточник'); assert.ok(a.tekst); });
  });
  assert.deepStrictEqual(P.proverit(p), []);
});

test('раздел 8, компания действует: остаётся «не проверяли», но говорит, что видно по ЕГРЮЛ', () => {
  const x = razdel(P.sobrat(demo('ACTIVE'), opt), 'sudy');
  assert.strictEqual(x.status, 'not_checked');
  assert.match(x.prichina, /По ЕГРЮЛ записи о банкротстве нет/);
  assert.match(x.prichina, /Картотеку арбитражных дел .* не подключили/);
  assert.ok(!/не банкрот|судов нет|дел нет/i.test(x.prichina));
});

test('раздел 8, компания ликвидирована: про банкротство по ЕГРЮЛ молчим — причину прекращения даст код статуса', () => {
  const x = razdel(P.sobrat(demo('LIQUIDATED'), opt), 'sudy');
  assert.strictEqual(x.status, 'not_checked');
  assert.ok(!/записи о банкротстве нет/.test(x.prichina));
});

test('раздел 8, запись о банкротстве в ЕГРЮЛ: факт первоисточника + честно, что картотеку не смотрели', () => {
  const p = P.sobrat(demo('BANKRUPT'), opt);
  const x = razdel(p, 'sudy');
  assert.strictEqual(x.status, 'found');
  assert.strictEqual(x.ton, 'bad');
  assert.strictEqual(x.fakty[0].istochnik, 'ЕГРЮЛ');
  assert.match(x.chastichno, /не проверяли/);
  const nz = razdel(p, 'ne_znaem');
  assert.ok(nz.fakty.some((f) => /^8\./.test(f.tekst) && /не проверяли/.test(f.znachenie)), '«Чего мы не знаем» молчит про картотеку');
  assert.deepStrictEqual(P.proverit(p), []);
});

test('страница Паспорта: ссылки «проверьте сами», кнопка ИНН не печатается и не уходит в сеть', () => {
  const t = chitat('pasport/kontragent/index.html');
  assert.match(t, /function samHtml/);
  assert.match(t, /class="kinn noprint"/);
  assert.match(t, /rel="noopener"/);
  assert.match(t, /navigator\.clipboard\.writeText/);
});

// Слова, которыми мы обещали бы проверку судов, банкротства и приставов, которой нет. Методика /indeks/
// и разборы /115-fz/, /nalogi/ описывают источники как предмет — там эти слова законны.
const ZAPRET = [/проверяем суды/i, /проверили суды/i, /судятся ли/i, /не банкрот/i, /банкротства проверены/i,
  /долгов у приставов нет/i, /Следом подключаем/i, /появятся в Паспорте автоматически/i];
test('на сайте нет обещаний проверки судов, банкротства и приставов', () => {
  const faily = [];
  (function obhod(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || ['node_modules', 'tests', 'сайт', 'indeks', '115-fz', 'nalogi'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) obhod(p);
      else if (/\.(html|js|json)$/.test(e.name) && e.name !== 'obnovleniya.json') faily.push(p); // лента — журнал: цитирует, что убрали
    }
  })(ROOT);
  for (const f of faily) {
    const t = fs.readFileSync(f, 'utf8');
    for (const z of ZAPRET) assert.ok(!z.test(t), path.relative(ROOT, f) + ': ' + z);
  }
});

test('/indeks/: над группой «Суды и долги» — честная строка, что в балл не входит', () => {
  assert.match(chitat('indeks/index.html'), /class="gr-net"><td colspan="3">Источники этой группы мы пока не&nbsp;подключили/);
});

test('главная: вместо «следом подключаем» — где проверить самим', () => {
  assert.match(chitat('index.html'), /Арбитражные дела, приставов и&nbsp;госзакупки мы пока не&nbsp;проверяем/);
});
