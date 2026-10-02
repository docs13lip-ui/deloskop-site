// «Ваши контрагенты» на главной (ТЗ [Продукт] 02.10 19:37, разд. 1): js/portfel.js.
// node --test tests/portfel.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const P = require('../js/portfel.js');
const D = require('../js/dinamika.js');
const NB = '\u00a0';
const DEN = 864e5;
const NOW = new Date(2026, 9, 2, 20, 0).getTime();

function lsIz(store) {
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
}
const snimki = {
  '7707083893': [{ t: NOW - 40 * DEN, inn: '7707083893', lvl: 'low', nm: 'ПАО Сбербанк' }, { t: NOW - 2 * DEN, inn: '7707083893', lvl: 'medium', nm: 'ПАО Сбербанк' }],
  '7736050003': [{ t: NOW - 1 * DEN, inn: '7736050003', lvl: 'high', nm: 'ПАО «Газпром»' }],
  '500100732259': [{ t: NOW - 3 * DEN, inn: '500100732259', lvl: 'low', nm: 'Петров Пётр Петрович' }],
  '7702070139': [{ t: NOW - 45 * DEN, inn: '7702070139', lvl: 'low' }],
  '0000000000': [{ t: NOW, inn: '0000000000', lvl: 'low' }]
};
const nedavnie = [
  { inn: '7702070139', name: 'Банк ВТБ (ПАО)', level: 'low', t: NOW - 45 * DEN },
  { inn: '7728168971', name: 'АО «Альфа-Банк»', level: '', t: NOW - 5 * DEN },
  { inn: '500100732259', name: 'Петров Пётр Петрович', level: 'low', t: NOW - 3 * DEN }
];

test('один ИНН — одна строка по последней проверке; пример 0000000000 не попадает', () => {
  const r = P.sobrat(snimki, nedavnie);
  assert.deepStrictEqual(r.map((x) => x.inn).sort(), ['500100732259', '7702070139', '7707083893', '7728168971', '7736050003'].sort());
  const sber = r.find((x) => x.inn === '7707083893');
  assert.strictEqual(sber.ur, 'vopr', 'уровень — по последнему снимку');
  assert.strictEqual(r.find((x) => x.inn === '7702070139').nm, 'Банк ВТБ (ПАО)', 'название из «Недавних», если в снимке его нет');
});

test('порядок: хуже по уровню выше, внутри уровня — давно проверенные выше; «итог не сохранён» — в конце', () => {
  const r = P.sobrat(snimki, nedavnie);
  assert.deepStrictEqual(r.map((x) => x.ur), ['ser', 'vopr', 'bez', 'bez', 'net']);
  assert.deepStrictEqual(r.filter((x) => x.ur === 'bez').map((x) => x.inn), ['7702070139', '500100732259']);
});

test('ФИО не выводится никогда: ИНН из 12 цифр → «Индивидуальный предприниматель»', () => {
  const h = P.html(P.sobrat(snimki, nedavnie), NOW, { vse: true });
  assert.ok(!/Петров/.test(h));
  assert.ok(h.includes('Индивидуальный предприниматель'));
  assert.ok(!('nm' in D.snimok({ checked_at: '2026-10-02T10:00:00Z', company: { inn: '500100732259', name_short: 'ИП Петров П. П.' } })), 'снимок ИП без имени');
  assert.strictEqual(D.snimok({ checked_at: '2026-10-02T10:00:00Z', company: { inn: '7707083893', name_short: 'ПАО Сбербанк' } }).nm, 'ПАО Сбербанк');
});

test('тексты ТЗ: заголовок, подзаголовок с числом, светофор только ненулевых частей, сноска', () => {
  const h = P.html(P.sobrat(snimki, nedavnie), NOW, {});
  assert.ok(h.includes('>Ваши контрагенты<'));
  assert.ok(h.includes('Последние проверки в' + NB + 'этом браузере — 5' + NB + 'компаний. Список хранится только у' + NB + 'вас и' + NB + 'не' + NB + 'уходит на' + NB + 'наш сервер.'));
  assert.ok(h.includes('— есть серьёзные сигналы') && h.includes('— есть вопросы') && h.includes('— без серьёзных сигналов'));
  assert.ok(!h.includes('— много признаков риска'), 'нулевые части не показываем');
  assert.ok(h.includes('По последней проверке каждой компании, а' + NB + 'не' + NB + 'на' + NB + 'сегодня.'));
  assert.ok(h.includes('Итог не сохранён') && h.includes('Перепроверить') && h.includes('aria-label="Убрать из списка"'));
  assert.ok(!/надёжн|лучш|гарантир/i.test(h), '222-ФЗ и 38-ФЗ');
  assert.ok(P.html(P.sobrat({ '7707083893': [{ t: NOW, inn: '7707083893', lvl: 'low' }] }, []), NOW).includes('1' + NB + 'компания.'));
});

test('даты: сегодня / вчера / N дней назад; старше 30 дней — предупреждение', () => {
  assert.strictEqual(P.kogda(NOW - 3600e3, NOW).t, 'Проверено сегодня · 02.10');
  assert.strictEqual(P.kogda(NOW - DEN, NOW).t, 'Проверено вчера · 01.10');
  assert.strictEqual(P.kogda(NOW - 21 * DEN, NOW).t, 'Проверено 21' + NB + 'день назад · 11.09');
  assert.strictEqual(P.kogda(NOW - 3 * DEN, NOW).t, 'Проверено 3' + NB + 'дня назад · 29.09');
  const s = P.kogda(NOW - 45 * DEN, NOW);
  assert.ok(s.staryj);
  assert.strictEqual(s.t, 'Сведения на' + NB + '18.08 — перед платежом перепроверьте');
  assert.ok(P.html(P.sobrat(snimki, nedavnie), NOW).includes('pf__d--star'));
});

test('больше 10 — «Показать все N»; подтверждение очистки с числом проверок', () => {
  const mnogo = {};
  for (let i = 0; i < 14; i++) { const inn = String(7700000010 + i); mnogo[inn] = [{ t: NOW - i * DEN, inn, lvl: 'low' }]; }
  const r = P.sobrat(mnogo, []);
  const h = P.html(r, NOW);
  assert.strictEqual((h.match(/class="pf__r"/g) || []).length, 10);
  assert.ok(h.includes('Показать все 14'));
  assert.ok(h.includes('Удалить из' + NB + 'этого браузера все 14' + NB + 'проверок? Отменить нельзя.'));
  assert.strictEqual((P.html(r, NOW, { vse: true }).match(/class="pf__r"/g) || []).length, 14);
});

test('нет снимков — блока нет (виден пример)', () => {
  assert.strictEqual(P.html(P.sobrat({}, []), NOW), '');
  assert.strictEqual(P.html(P.sobrat(null, null), NOW), '');
});

test('«Убрать» и «Очистить список» трогают только ключи Делоскопа со снимками', () => {
  const store = { dlk_snimki: JSON.stringify(snimki), dlk_nedavnie: JSON.stringify(nedavnie), dlk_beta_skryt: '1', chuzhoj: 'x', dlk_soglasie: 'all' };
  const ls = lsIz(store);
  P.ubrat(ls, '7702070139');
  const d = P.chitat(ls);
  assert.ok(!('7702070139' in d.s) && !d.n.some((x) => x.inn === '7702070139'));
  P.ochistit(ls);
  assert.deepStrictEqual(Object.keys(store).sort(), ['chuzhoj', 'dlk_beta_skryt', 'dlk_soglasie']);
});

test('показ без сети: в модуле нет fetch/XHR/sendBeacon; главная подключает модуль и прячет блок при отчёте', () => {
  const js = chitat('js/portfel.js');
  assert.ok(!/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|import\s*\(/.test(js));
  const h = chitat('index.html');
  const sec = h.indexOf('<div class="pf" id="portfel"'), ex = h.indexOf('<div class="report ex"');
  assert.ok(sec > 0 && ex > sec, 'блок стоит на месте примера, перед ним');
  assert.ok(h.includes('<script src="/js/portfel.js" defer></script>'));
  const r = h.indexOf("report.classList.remove('ex');"), s = h.indexOf('if(window.Portfel)Portfel.skryt();');
  assert.ok(r > 0 && s > r, 'настоящий отчёт прячет «Ваших контрагентов»');
  const css = chitat('css/otchet.css');
  assert.ok(css.includes('.hero.pf-on .report.ex{display:none}'));
  (css.match(/\.pf[^{]*\{[^}]*\}/g) || []).forEach((x) => {
    const m = /font-size:(\d+(?:\.\d+)?)px/.exec(x);
    if (m) assert.ok(+m[1] >= 12, 'мельче 12 px: ' + x);
  });
});

test('Метрика: цели portfel_pokaz, portfel_pereproverit, portfel_ubrat, portfel_ochistit', () => {
  const js = chitat('js/portfel.js');
  ['portfel_pokaz', 'portfel_pereproverit', 'portfel_ubrat', 'portfel_ochistit'].forEach((c) => assert.ok(js.includes("'" + c + "'"), c));
});
