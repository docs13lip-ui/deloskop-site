// «Что ещё проверить самим» (reestry-sami-v1): справочник data/reestry-sami.json + js/reestry-sami.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RS = require('../js/reestry-sami.js');
const KOREN = path.join(__dirname, '..');
const SPRAV = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/reestry-sami.json'), 'utf8'));
const ORG = { company: { inn: '7736050003' } };

test('справочник: у каждой записи — кто ведёт, когда важно, обновление, норма, официальная ссылка, цель', () => {
  assert.match(SPRAV.svereno, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(SPRAV.pravilo && /не позже \d{2}\.\d{2}\.\d{4}/.test(SPRAV.pravilo), 'правило обновления с датой');
  assert.ok(SPRAV.istochnik);
  const ids = new Set();
  for (const x of SPRAV.reestry) {
    for (const k of ['id', 'nazv', 'kto', 'kogda', 'chto', 'obnovlenie', 'norma', 'ssylka', 'cel']) assert.ok(x[k], x.id + ': нет ' + k);
    assert.ok(RS.DOMENY.test(x.ssylka), 'не официальный домен: ' + x.ssylka);
    assert.match(x.cel, /^reestry_[a-z]+$/);
    assert.ok(!ids.has(x.id)); ids.add(x.id);
  }
  assert.ok(SPRAV.reestry.length >= 3);
});

test('сверка не старше 92 дней от даты в файле до следующей сверки', () => {
  const m = /не позже (\d{2})\.(\d{2})\.(\d{4})/.exec(SPRAV.pravilo);
  const sled = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  const sv = Date.parse(SPRAV.svereno + 'T00:00:00Z');
  assert.ok(sled - sv <= 92 * 864e5 && sled > sv);
});

test('тексты: без обещаний, превосходных степеней и «надёжн»; латиница в русских словах не прячется', () => {
  const t = JSON.stringify(SPRAV) + fs.readFileSync(path.join(KOREN, 'js/reestry-sami.js'), 'utf8');
  for (const s of [/надёжн/i, /надежн/i, /гарантир/i, /лучш/i, /самый/i, /\bИИ\b/, /нейросет/i]) assert.ok(!s.test(t), String(s));
  assert.ok(!/[а-яё][a-z]|[a-z][а-яё]/i.test(Object.values(SPRAV.reestry).map(x => x.chto + x.kogda + x.nazv).join(' ') + SPRAV.pravilo));
});

test('показ: только организации; ИП и пустой ответ — ничего', () => {
  assert.strictEqual(RS.dlya(ORG, SPRAV).length, SPRAV.reestry.length);
  assert.deepStrictEqual(RS.dlya({ company: { inn: '500100732259' } }, SPRAV), []);
  assert.deepStrictEqual(RS.dlya({}, SPRAV), []);
  assert.deepStrictEqual(RS.dlya(ORG, null), []);
  assert.strictEqual(RS.html([], SPRAV), '');
});

test('чужой домен и запись без нормы не выводятся', () => {
  const s = { reestry: [ { id: 'a', nazv: 'A', chto: 'x', norma: 'ст. 1', ssylka: 'https://example.com/' },
    { id: 'b', nazv: 'B', chto: 'x', ssylka: 'https://rmsp.nalog.ru/' },
    { id: 'c', nazv: 'C', chto: 'x', norma: 'ст. 1', ssylka: 'http://rmsp.nalog.ru/' } ] };
  assert.deepStrictEqual(RS.dlya(ORG, s), []);
});

test('разметка: раздел «Все данные из реестров», ссылки наружу, цели Метрики, дата сверки, оговорка', () => {
  const h = RS.html(RS.dlya(ORG, SPRAV), SPRAV);
  assert.match(h, /<section class="sut__s rs" data-reestry-sami><h4>Что ещё проверить самим — бесплатно<\/h4>/);
  assert.strictEqual((h.match(/target="_blank" rel="noopener"/g) || []).length, SPRAV.reestry.length);
  for (const x of SPRAV.reestry) assert.ok(h.includes('data-goal="' + x.cel + '"'));
  assert.match(h, /Ссылки и нормы сверены 04\.10\.2026\./);
  assert.match(h, /пока не опрашивает — результат проверки их не учитывает/);
  assert.ok(h.includes('ГК\u00a0РФ') && h.includes('ст.\u00a04.1\u00a0209-ФЗ'), 'неразрывные пробелы в нормах');
  assert.ok(!/<script|javascript:/i.test(h));
});

test('экранирование: разметка из справочника не исполняется', () => {
  const s = { svereno: '2026-10-04', reestry: [{ id: 'x"', nazv: '<b>', kogda: '<i>', chto: '<img src=x>', norma: 'ст. 1', ssylka: 'https://rmsp.nalog.ru/"><x', cel: 'reestry_x' }] };
  const h = RS.html(RS.dlya(ORG, s), s);
  assert.ok(!/<img|<b>|<i>|"><x/.test(h));
});

test('главная подключает модуль и вставляет раздел только в режиме проверки контрагента', () => {
  const s = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.ok(s.includes('<script src="/js/reestry-sami.js" defer></script>'));
  assert.ok(s.includes("if(!svoj&&window.Sushchestvennoe&&window.ReestrySami){ReestrySami.zagruzit()"));
});
