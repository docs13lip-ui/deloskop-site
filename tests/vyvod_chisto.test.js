// Вывод экрана проверки без повтора и без обещания исхода; бухотчётность банка — честной строкой (комплект vyvod-chisto-v1, [Ночные-3]).
// node --test tests/vyvod_chisto.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/sushchestvennoe.js');
const U = require('../js/usloviya.js');
const KOREN = path.join(__dirname, '..');
const NB = '\u00a0';

// Форма живого ответа /api/check 03.10 (крупный банк, ГИР БО пуст); компания вымышленная
function otvet(okved, o) {
  return Object.assign({
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ПАО «ПРИМЕР»', status: 'ACTIVE', reg_date: '1991-06-20',
      okved: okved, director_since: '2009-10-04', invalid: false, address_invalid: false },
    risk_level: 'low', verdict: 'Работать можно. Серьёзных признаков риска не найдено.',
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null }],
    checked_at: '2026-10-03', dossier: { kpi: [{ label: 'Долг перед бюджетом', value: null, text: 'Нет' }], charts: {} }
  }, o || {});
}

test('банк (ОКВЭД 64.19): «Организация сдаёт отчётность в Банк России, а не в ГИР БО» и ссылка в ЦБ по ОГРН', () => {
  const f = S.fakty(otvet('64.19'));
  const b = f.spisok.find((x) => x.k === 'otchetnost');
  assert.ok(b, 'строка отчётности есть');
  assert.strictEqual(b.znach, 'Организация сдаёт отчётность в' + NB + 'Банк России, а не в' + NB + 'ГИР' + NB + 'БО');
  assert.strictEqual(b.ton, 'neutral');
  assert.strictEqual(b.ssylka, 'https://www.cbr.ru/finorg/foinfo/?ogrn=1027700000001');
  assert.match(b.ist, /ОКВЭД 64\.19/);
  assert.ok(!f.spisok.some((x) => /Нет в ответе ГИР БО/.test(x.znach)));
  const h = S.html(otvet('64.19'));
  assert.match(h, /проверить в\u00a0ЦБ/);
});

test('не банк: прежняя строка «Нет в ответе ГИР БО»; 64.9 и 46.19 — не банк', () => {
  ['46.19', '64.92', '64.99', '', undefined].forEach((ok) => {
    assert.strictEqual(S.bank({ okved: ok }), false, String(ok));
    const b = S.fakty(otvet(ok)).spisok.find((x) => x.k === 'otchetnost');
    assert.strictEqual(b.znach, 'Нет в ответе ГИР БО');
    assert.ok(!b.ssylka);
  });
  ['64.19', '64.1', '64.11'].forEach((ok) => assert.strictEqual(S.bank({ okved: ok }), true, ok));
});

test('банк без ОГРН — ссылка на справочник ЦБ без параметра', () => {
  const r = otvet('64.19'); r.company.ogrn = '';
  assert.strictEqual(S.fakty(r).spisok.find((x) => x.k === 'otchetnost').ssylka, 'https://www.cbr.ru/finorg/foinfo/');
});

test('банк с отчётностью в ответе — показываем выручку, как у всех', () => {
  const r = otvet('64.19'); r.dossier.charts = { revenue: [{ year: 2025, value: 5e9 }] };
  assert.match(S.fakty(r).spisok.find((x) => x.k === 'otchetnost').nazv, /^Выручка за 2025$/);
});

test('пояснение под выводом не повторяет вывод', () => {
  assert.strictEqual(U.bezPovtora('Работать можно. Серьёзных признаков риска не найдено.', 'Работать можно'), 'Серьёзных признаков риска не найдено');
  assert.strictEqual(U.bezPovtora('Вывод: Работать можно — признаков нет.', 'Работать можно'), 'признаков нет');
  assert.strictEqual(U.bezPovtora('Есть вопросы к адресу.', 'Работать можно'), 'Есть вопросы к адресу');
  assert.strictEqual(U.bezPovtora('', 'Работать можно'), '');
  assert.strictEqual(U.bezPovtora(null, ''), '');
});

test('Условия сделки на чистой компании: «Работать можно» один раз, пояснение с заглавной', () => {
  const { JSDOM } = (() => { try { return require('jsdom'); } catch (_) { return {}; } })();
  const src = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  assert.ok(src.includes('bezPovtora(r && r.verdict, v.headline)'), 'draw() берёт пояснение через bezPovtora');
  if (!JSDOM) return; // без jsdom — проверка по исходнику выше
  const dom = new JSDOM('<div id="u"></div>');
  global.localStorage = undefined;
  U.mount(dom.window.document.getElementById('u'), otvet('46.19'));
  const t = dom.window.document.getElementById('u').textContent;
  assert.strictEqual((t.match(/Работать можно/g) || []).length, 1);
  assert.match(t, /Серьёзных признаков риска не найдено\./);
});

test('совет «Работать можно» без обещания исхода — «может стать частью доказательств», как в PDF-досье', () => {
  const d = U.decide(otvet('46.19'), {});
  assert.strictEqual(d.headline, 'Работать можно');
  assert.strictEqual(d.advice, 'Сохраните досье с датой проверки — оно может стать частью доказательств должной осмотрительности.');
  const src = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  assert.ok(!/это ваше доказательство/.test(src));
  const rep = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.ok(rep.includes('может стать частью доказательств должной осмотрительности'));
});
