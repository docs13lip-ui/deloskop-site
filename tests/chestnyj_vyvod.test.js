// «Работать можно» без суда, банкротства и приставов — пояснение честное: что не проверяли и что сделать
// (комплект chestnyj-vyvod-v1, [Ночные-3] 11.10). node --test tests/chestnyj_vyvod.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const U = require('../js/usloviya.js');
const KOREN = path.join(__dirname, '..');

// Форма живого ответа /api/check 11.10.2026 (damia-v1.4, бета: внешние реестры не подключены); компания вымышленная
function blok(sost, status) { return { status: status || 'ne_provereno', sostoyanie: sost }; }
function otvet(damia, o) {
  return Object.assign({
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО «ПРИМЕР»', status: 'ACTIVE', reg_date: '2000-09-05',
      okved: '47.91', director_since: '2020-02-08', invalid: false, address_invalid: false },
    risk_level: 'low', verdict: 'Работать можно. Серьёзных признаков риска не найдено.',
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null }],
    checked_at: '2026-10-11T07:23:00Z', damia: damia,
    dossier: { kpi: [{ label: 'Долг перед бюджетом', value: null, text: 'Нет' }], charts: {} }
  }, o || {});
}
const VSE_NE = { sudy: blok('not_checked'), bankrotstvo: blok('not_checked'), fssp: blok('not_checked'), rnp: blok('not_checked'), versiya: 'damia-v1.4' };

test('бета: суды, банкротство и приставы не проверяли — вместо «Серьёзных признаков риска не найдено» честная строка', () => {
  const r = otvet(VSE_NE);
  const t = U.chestnoPoyasnenie(r, U.bezPovtora(r.verdict, 'Работать можно'));
  assert.strictEqual(t, 'Не проверяли: арбитражные суды, банкротство, приставы. Перед крупной оплатой посмотрите их сами');
  assert.doesNotMatch(t, /в\s+этот\s+раз/, 'не подключённые — без «в этот раз» ([Право] 11.10, разд. 2)');
  assert.doesNotMatch(t, /риска не найдено/);
});

test('проверено всё — пояснение из ответа API без изменений', () => {
  const r = otvet({ sudy: blok('checked', 'not_found'), bankrotstvo: blok('checked', 'not_found'), fssp: blok('checked', 'not_found') });
  assert.strictEqual(U.chestnoPoyasnenie(r, 'Серьёзных признаков риска не найдено'), 'Серьёзных признаков риска не найдено');
});

test('часть не проверена — перечислены только непроверенные; старый ответ без sostoyanie — по status', () => {
  const r = otvet({ sudy: blok('checked', 'found'), bankrotstvo: { status: 'not_found' }, fssp: { status: 'oshibka' } });
  assert.deepStrictEqual(U.neProverenyKlyuchevye(r), ['приставы']);
  assert.match(U.chestnoPoyasnenie(r, 'Серьёзных признаков риска не найдено'), /^Не ответили в\u00a0этот раз: приставы\. Перед крупной оплатой посмотрите их сами$/);
});

test('причины разные — «Пока не проверяем: … Не ответили в этот раз: …» (как в «Существенных фактах»)', () => {
  const r = otvet({ sudy: blok('not_checked'), bankrotstvo: blok('checked', 'not_found'), fssp: { status: 'oshibka' } });
  assert.strictEqual(U.chestnoPoyasnenie(r, 'Серьёзных признаков риска не найдено'),
    'Пока не проверяем: арбитражные суды. Не ответили в\u00a0этот раз: приставы. Перед крупной оплатой посмотрите их сами');
});

test('нет блока damia (старый API) или пояснение не «не найдено» — не трогаем', () => {
  assert.strictEqual(U.chestnoPoyasnenie(otvet(undefined), 'Серьёзных признаков риска не найдено'), 'Серьёзных признаков риска не найдено');
  assert.strictEqual(U.chestnoPoyasnenie(otvet(VSE_NE), 'Есть вопросы к адресу'), 'Есть вопросы к адресу');
  assert.strictEqual(U.chestnoPoyasnenie(otvet(VSE_NE), ''), '');
});

test('карточка «Условий сделки»: под «Работать можно» — честная строка, в обоих направлениях', () => {
  const src = fs.readFileSync(path.join(KOREN, 'js', 'usloviya.js'), 'utf8');
  assert.ok(src.includes('chestnoPoyasnenie(r, bezPovtora(r && r.verdict, v.headline))'), 'draw() берёт пояснение через chestnoPoyasnenie');
  const v = U.decide(otvet(VSE_NE), {});
  assert.strictEqual(v.headline, 'Работать можно');
  assert.deepStrictEqual(v.reasons, []);
});

test('слова строки: без обещаний исхода и превосходных степеней (38-ФЗ)', () => {
  const t = U.chestnoPoyasnenie(otvet(VSE_NE), 'Серьёзных признаков риска не найдено');
  assert.doesNotMatch(t, /надёжн|гарант|безопасн|лучш|точно/i);
});
