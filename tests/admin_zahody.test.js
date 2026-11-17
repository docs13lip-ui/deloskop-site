// zahody-izvne-v1 (17.11, ✎ Штаба 16.11 п. 8): плитка «Откуда приходят» и «Люди» читают новые поля сервера
// /api/admin/pult/segodnya → zahody.za_7_dnej / zahody.segodnya. 16.11 18:00 сервер отдавал izvne = 12,
// а экран писал «За 7 дней заходов извне нет» — по старому полю otkuda (нули).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../js/admin-segodnya.js');
const S = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/pult_slova.json'), 'utf8'));
const T = Date.parse('2026-11-16T15:00:00Z');
const BAZA = { est: true, lyudi: { segodnya: 48, nedelya: 300, zahody_nedelya: 0 } };
const plitka = (sv, id) => G.plitki(Object.assign({}, BAZA, sv), S, T).find(p => p.id === id);

test('(1) случай 16.11: otkuda нули, zahody.za_7_dnej.izvne = 12 — плитка «12 заходов», а не «нет»', () => {
  const p = plitka({ otkuda: { poisk_yandex: 0, vk: 0 }, zahody: { za_7_dnej: { izvne: 12, pryamye: 10 }, segodnya: { izvne: 2, pryamye: 1 } } }, 'otkuda');
  assert.strictEqual(p.cifra, '12'); assert.strictEqual(p.podpis, 'заходов извне за 7 дней'); assert.strictEqual(p.cvet, 'ok');
  assert.deepStrictEqual(p.stroki.map(s => [s.tekst, s.n]), [[S.otkuda.stroka_izvne, 12], ['Прямые заходы', 10]]);
  assert.ok(!/заходов извне нет/.test(p.smysl), p.smysl);
  assert.match(p.smysl, /не делит/); assert.match(p.smysl, /Сегодня — 2 извне, прямых — 1\./);
  assert.ok(G.bezZhargona(p)); assert.ok(!/\{|\}/.test(p.smysl + p.podpis));
});

test('(2) otkuda нет совсем, период числом — тоже читается; без прямых — одна строка', () => {
  const p = plitka({ zahody: { za_7_dnej: 7, segodnya: 0 } }, 'otkuda');
  assert.strictEqual(p.cifra, '7'); assert.strictEqual(p.stroki.length, 1); assert.match(p.smysl, /Сегодня — 0 извне\./);
});

test('(3) по видам есть — как раньше (доли), «сегодня» дописано; zahody не подменяет виды', () => {
  const p = plitka({ otkuda: { poisk_yandex: 30, pryamoj: 10, vk: 2 }, zahody: { za_7_dnej: { izvne: 99 }, segodnya: { izvne: 3 } } }, 'otkuda');
  assert.strictEqual(p.cifra, '42'); assert.strictEqual(p.stroki[0].tekst, 'Поиск Яндекса');
  assert.match(p.smysl, /Больше всего — Поиск Яндекса: 71 %\. Сегодня — 3 извне\./);
});

test('(4) честный ноль и «нет данных»: нули везде — серая «нет»; поля нет — «не посчитаны», не «0»', () => {
  let p = plitka({ zahody: { za_7_dnej: { izvne: 0, pryamye: 0 } } }, 'otkuda');
  assert.strictEqual(p.cvet, 'seryj'); assert.strictEqual(p.cifra, '0'); assert.match(p.smysl, /нет/);
  p = plitka({ otkuda: { pryamoj: 0 }, zahody: { za_7_dnej: { izvne: 0, pryamye: 4 } } }, 'otkuda');
  assert.strictEqual(p.cvet, 'ok', 'прямые есть — плитка не пустая'); assert.strictEqual(p.stroki[1].n, 4);
  p = plitka({}, 'otkuda');
  assert.strictEqual(p.cifra, '—'); assert.strictEqual(p.smysl, S.otkuda.net);
  p = plitka({ zahody: { segodnya: { izvne: 5 } } }, 'otkuda');
  assert.strictEqual(p.cifra, '—'); assert.match(p.smysl, /Сегодня — 5 извне/);
});

test('(5) «Люди»: заходы за неделю берутся из zahody.za_7_dnej.izvne, старое поле — запасное', () => {
  assert.match(plitka({ zahody: { za_7_dnej: { izvne: 12 } } }, 'lyudi').smysl, /заходов на сайт извне — около 12\./);
  assert.match(plitka({}, 'lyudi').smysl, /извне — около 0\./);
  assert.match(plitka({ lyudi: { segodnya: 1, nedelya: 5, zahody_nedelya: 3 } }, 'lyudi').smysl, /около 3\./);
});

test('(6) zahodyIz: прямые под любым из трёх имён, мусор — null', () => {
  assert.deepStrictEqual(G.zahodyIz({ za_7_dnej: { izvne: '12', pryamoj: 4 } }).ned, { izvne: 12, pryamye: 4 });
  assert.deepStrictEqual(G.zahodyIz({ segodnya: { pryamyh: 2 } }).seg, { izvne: null, pryamye: 2 });
  assert.deepStrictEqual(G.zahodyIz('x').ned, { izvne: null, pryamye: null });
  assert.deepStrictEqual(G.zahodyIz(null).seg, { izvne: null, pryamye: null });
});
