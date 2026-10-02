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

test('НДФЛ: агент удерживает со своих выплат, шкала п. 1 ст. 224 НК ([Право] 02.10 18:30, п. 3)', () => {
  assert.ok(s.includes('Мы — налоговый агент: удерживаем НДФЛ и сами перечисляем его в бюджет. Ставка — 13% с выплат до 2,4 млн ₽ за год, с превышения — 15%, с больших сумм — 18–22% по шкале п. 1 ст. 224 НК РФ. Ставки указаны для налоговых резидентов РФ.'));
  assert.ok(!s.includes('свыше 2,4 млн ₽ за год — 15%'));
  assert.ok(!s.includes('сверх — по прогрессивной шкале'));
});

test('редакция: принявшим условия до 02.10 — 25% на все оплаты, без «через 14 дней» (ст. 310 ГК, [Право] 02.10 18:30, п. 1)', () => {
  assert.ok(/Редакция от \d{1,2} (октября|ноября) 2026 года\. Для новых партнёров действует с даты публикации\./.test(s));
  assert.ok(s.includes('Если вы приняли условия до 2 октября 2026 года, по клиентам, которых вы привели, сохраняется ставка 25% на все оплаты. Так будет, пока вы сами не примете новую редакцию — в кабинете партнёра или ответным письмом.'));
  assert.ok(!s.includes('через 14 дней после публикации'));
  assert.ok(s.includes('Изменение условий — с уведомлением за 14 дней; начисления за прошлые периоды не пересматриваются.'));
  assert.ok(s.includes('Для партнёров-граждан и самозанятых новая редакция, которая ухудшает их условия, применяется только с их согласия (п. 2 ст. 310 ГК РФ).'));
  assert.ok(html.includes('"dateModified": "2026-10-02"'));
});

test('категория ставки: у каждого разового продукта tarify.json — partner_kategoriya; «Тариф основателя» — подписка (25%)', () => {
  const prod = Object.entries(T).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && 'cena_rub' in v);
  assert.ok(prod.length >= 5);
  for (const [k, v] of prod) assert.ok(['razovo', 'podpiska'].includes(v.partner_kategoriya), 'нет partner_kategoriya у ' + k);
  assert.strictEqual(T.osnovatel.partner_kategoriya, 'podpiska');
  assert.strictEqual(T.osnovatel.razovo, true, 'флаг razovo — про счёт, остаётся');
  for (const k of ['paket_pasportov', 'pasport_razovyj', 'pasport_svoj', 'skoraya_pod_klyuch']) assert.strictEqual(T[k].partner_kategoriya, 'razovo', k);
  // закрытый список на странице совпадает с tarify.json
  assert.ok(s.includes('Разовые покупки — Паспорт контрагента, пакет «3 развёрнутые проверки», «Паспорт своей компании» и «Скорая под ключ». Остальное, включая «Тариф основателя», — подписки.'));
  const v = T.osnovatel.cena_rub * S.podpiska / 100;
  assert.strictEqual(rub(v), '1 787,50');
});
