// Ставки партнёров: 25% с подписок, 15% с разовых (владелец 30.09.2026, п. 5; тексты [Право] 02.10.2026 11:15,
// claude/Право_ответы_✎_Паспорт_ЗСК_tochnost_партнёры_02.10.md, разд. 5). Числа на странице сверяются с tarify.json.
// Запуск: node --test tests/partnery_stavka.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const bezTegov = t => t.replace(/<[^>]+>/g, '').replace(/&#8209;/g, '‑').replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
const T = JSON.parse(chitat('tarify/tarify.json'));
const S = T.partner_stavka;
const html = chitat('partneram/usloviya/index.html');
const s = bezTegov(html);
const rub = x => {                       // 4990 → «4 990», 748.5 → «748,50»
  const [c, d] = x.toFixed(2).split('.');
  return c.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d === '00' ? '' : ',' + d);
};

test('tarify.json: partner_stavka — 25 с подписок, 15 с разовых, 12 месяцев', () => {
  assert.ok(S, 'нет partner_stavka в tarify.json');
  assert.strictEqual(S.podpiska, 25);
  assert.strictEqual(S.razovo, 15);
  assert.strictEqual(S.mesyacev, 12);
});

test('страница: ставки из tarify.json в title, лиде, «Коротко», п. 5', () => {
  const p = S.podpiska + '%', r = S.razovo + '%';
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.ok(title.includes(p + ' с подписок') && title.includes(r + ' с разовых'), 'title: ' + title);
  assert.ok(html.includes(`<span data-partner="podpiska">${p}</span>`) && html.includes(`<span data-partner="razovo">${r}</span>`), 'лид');
  assert.ok(s.includes(`Коротко. ${p} с подписок и ${r} с разовых покупок клиента за ${S.mesyacev} месяцев`), '«Коротко»');
  assert.ok(s.includes(`Вознаграждение — ${p} от поступивших и не возвращённых оплат подписки (тарифы) и ${r} — от оплат разовых продуктов и услуг`), 'п. 5');
  assert.ok(s.includes('Какая ставка относится к оплате, видно в отчёте.'));
});

test('страница: нет «25% от оплат» без подписок и нет «25% включают НДС»', () => {
  assert.ok(!/25% (от|с) оплат(?! подпис)/.test(s), 'осталось «25% от оплат» без подписок');
  assert.ok(!s.includes('25% включают НДС'));
  assert.ok(s.includes('Вознаграждение (25% или 15%) включает НДС, если вы его платите.'));
});

test('пример: подписка 12 000 ₽ и разовая покупка «Скорая под ключ» — арифметика и НДФЛ в полных рублях', () => {
  const nd = x => Math.round(x * 0.13);    // п. 6 ст. 52 НК — полные рубли
  const v1 = 12000 * S.podpiska / 100;
  assert.ok(s.includes(`клиент оплатил 12 000 ₽ → ваше вознаграждение ${rub(v1)} ₽ → НДФЛ ${nd(v1)} ₽ → на руки ${rub(v1 - nd(v1))} ₽`));
  assert.ok(s.includes(`при налоге 6% — ${rub(v1 * 0.94)} ₽`));
  const cena = T.skoraya_pod_klyuch.cena_rub, v2 = cena * S.razovo / 100;
  assert.strictEqual(T.skoraya_pod_klyuch.razovo, true);
  assert.ok(s.includes(`С разовой покупки на ${rub(cena)} ₽ — ${rub(v2)} ₽, НДФЛ ${nd(v2)} ₽, на руки ${rub(v2 - nd(v2))} ₽.`),
    'пример разовой: ' + rub(cena) + ' → ' + rub(v2));
});

test('НДФЛ: полная шкала по ст. 224 НК, а не «свыше 2,4 млн — 15%»', () => {
  assert.ok(s.includes('13% с дохода до 2,4 млн ₽ за год, сверх — по прогрессивной шкале 15–22% (п. 1 ст. 224 НК РФ); ставки — для налоговых резидентов РФ'));
  assert.ok(!s.includes('свыше 2,4 млн ₽ за год — 15%'));
});

test('редакция: дата и правило 14 дней для принявших редакцию 26.09', () => {
  assert.ok(/Редакция от \d{1,2} (октября|ноября) 2026 · действует с даты публикации; для партнёров, принявших редакцию от 26 сентября 2026 года, — через 14 дней после публикации/.test(s));
  assert.ok(s.includes('Изменение условий — с уведомлением за 14 дней; начисления за прошлые периоды не пересматриваются.'));
  assert.ok(html.includes('"dateModified": "2026-10-02"'));
});
