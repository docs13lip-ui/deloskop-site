// [Ночные-3] otsrochka-pokupatelyu-v1 — «Условия сделки» в обе стороны: «Я плачу им» / «Они платят мне»
// (ТЗ [Продукт] 05.10, claude/Продукт_отсрочка_покупателю_ответы_✎_05.10.md, разд. 1, п. 10 а–е).
// Главное: предел — одно число в обоих режимах, меняются только слова; по умолчанию — как до комплекта, побайтно.
// node --test tests/otsrochka_pokupatelyu.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const KOREN = path.join(__dirname, '..');
const U = require('../js/usloviya.js');
const P = require('../indeks/predoplata.js');
const F = require('./otsrochka_fixtures.js');
const SNIMOK = JSON.parse(fs.readFileSync(path.join(__dirname, 'otsrochka_pokupatelyu.snapshot.json'), 'utf8'));
const NB = '\u00a0';
const sha = (x) => require('node:crypto').createHash('sha256').update(JSON.stringify(x)).digest('hex');
const OTG = { napravlenie: 'otgruzhaem' };
const otg = (r, o) => U.decide(r, Object.assign({}, o || {}, OTG));
const rub = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';

test('(а) предел в двух режимах — одно число на шести ответах (go, cap, cap+malo, post, stop, ликвидирована)', () => {
  const ozhid = { go: ['go', 2000000], cap: ['cap', 150000], capMalo: ['cap', 0], post: ['post', 0], stop: ['stop', 0], liquidated: ['stop', 0] };
  Object.keys(F).forEach((k) => {
    const a = U.decide(F[k]), b = otg(F[k]);
    assert.strictEqual(a.tone, ozhid[k][0], k + ': тон');
    assert.strictEqual(a.cap, ozhid[k][1], k + ': предел');
    assert.strictEqual(b.cap, a.cap, k + ': предел в «Они платят мне» другой');
    assert.strictEqual(b.malo, a.malo, k);
    assert.deepStrictEqual(b.raschet, a.raschet, k + ': расчёт разошёлся');
    assert.deepStrictEqual(b.reasons, a.reasons, k + ': причины разошлись');
  });
});

test('(б) заголовки «Они платят мне» — дословно из ТЗ п. 3', () => {
  assert.strictEqual(otg(F.liquidated).headline, 'Сделку не заключать');
  assert.strictEqual(otg(F.stop).headline, 'Отгружайте только после оплаты');
  assert.strictEqual(otg(F.post).headline, 'Только по предоплате');
  assert.strictEqual(otg(F.capMalo).headline, 'Можно, но без отсрочки');
  assert.strictEqual(otg(F.cap).headline, 'Можно, отсрочка — до ' + rub('150000'));
  assert.strictEqual(otg(F.go).headline, 'Работать можно');
});

test('(б) советы «Они платят мне» — дословно из ТЗ п. 4', () => {
  const STOP = 'Отсрочку не давайте: отгрузка — после оплаты. Если без отсрочки сделки не будет — только под банковскую гарантию платежа или аккредитив.';
  assert.strictEqual(otg(F.stop).advice, STOP);
  assert.strictEqual(otg(F.post).advice, STOP);
  assert.strictEqual(otg(F.capMalo).advice, 'Отсрочку — только под банковскую гарантию платежа или аккредитив.');
  assert.strictEqual(otg(F.cap).advice, 'Больше предела — под банковскую гарантию или аккредитив. Держите долг покупателя в пределе: следующая отгрузка — после оплаты предыдущей.');
  assert.strictEqual(otg(F.go).advice, 'Сохраните досье с датой проверки: если покупатель задержит оплату, оно покажет, на каких данных вы дали отсрочку.');
  const bankrot = Object.assign({}, F.go, { company: Object.assign({}, F.go.company, { status: 'BANKRUPT' }) });
  assert.strictEqual(otg(bankrot).advice, 'Новые отгрузки — только после оплаты и по согласованию с арбитражным управляющим.');
  const likv = Object.assign({}, F.go, { company: Object.assign({}, F.go.company, { status: 'LIQUIDATING' }) });
  const a = otg(likv).advice, b = U.decide(likv).advice;
  assert.ok(a.startsWith('В долг не отгружайте: новые обязательства компания может не исполнить. Если она вам должна'), a);
  assert.strictEqual(a.slice(a.indexOf(' Если она')), b.slice(b.indexOf(' Если она')), 'хвост совета ликвидируемой — как сейчас');
  assert.ok(!/оплачивайте|платить по такому счёту/.test(otg(F.liquidated).advice), 'ликвидированной — без «счёт не оплачивайте»');
});

test('(б) «Как посчитали» и сумма отгрузки — фразы ТЗ пп. 5–6', () => {
  const NACHALO = 'Предел — сколько денег разумно держать под риском у одной компании: и предоплатой, и отгрузкой в долг. Считаем одинаково. ';
  Object.keys(F).forEach((k) => assert.ok(otg(F[k]).kak.kak.startsWith(NACHALO), k));
  assert.strictEqual(otg(F.post).kak.kak, NACHALO + 'В долг — 0' + NB + '₽: задолженность по налогам: 412' + NB + '000' + NB + '₽ — отгружайте после оплаты.');
  assert.ok(otg(F.go).kak.kak.endsWith(U.decide(F.go).kak.kak), 'строка расчёта та же');
  assert.strictEqual(otg(F.go, { amount: 1500000 }).prepay, 'Сумма в пределах ориентира — отсрочка допустима.');
  assert.strictEqual(otg(F.cap, { amount: 500000 }).prepay, 'В долг — не больше ' + rub('150000') + ' (30% суммы), остальное — предоплатой.');
  assert.strictEqual(otg(F.stop, { amount: 500000 }).prepay, 'В долг не отгружайте: ' + rub('500000') + ' — после оплаты.');
  assert.strictEqual(otg(F.capMalo, { amount: 500000 }).prepay, 'В долг не отгружайте: ' + rub('500000') + ' — после оплаты.');
  // «Не проверяли…»: «в долг лучше не отгружать» вместо «вперёд лучше не платить»
  const ne = otg(F.go).kak.ne, neP = U.decide(F.go).kak.ne;
  assert.ok(neP && neP.includes('вперёд лучше не платить'), 'в образце должна быть строка «Не проверяли»');
  assert.ok(ne.includes('в долг лучше не отгружать') && !ne.includes('вперёд'), ne);
});

test('(в) в «Они платят мне» нет «вперёд» и «предоплата —» в заголовке, нет «На кону» и карточки реквизитов', () => {
  Object.keys(F).forEach((k) => {
    const v = otg(F[k], { amount: 500000 });
    assert.ok(!/вперёд|предоплата —/i.test(v.headline), k + ': ' + v.headline);
    assert.strictEqual(v.stake, null, k + ': «На кону» в режиме продавца не считаем');
    assert.ok(!v.docs.some((d) => d.id === 'card'), k + ': card');
    assert.ok(!/\bВперёд\b/.test(v.kak.kak), k + ': ' + v.kak.kak);
    assert.strictEqual(v.napravlenie, 'otgruzhaem');
  });
  assert.ok(U.decide(F.go).docs.some((d) => d.id === 'card'), 'в «Я плачу им» карточка реквизитов осталась');
});

test('(г) по умолчанию «Я плачу им», и вывод побайтно как до комплекта (снимок)', () => {
  Object.keys(F).forEach((k) => {
    const bez = U.decide(F[k]), summa = U.decide(F[k], { amount: 500000 });
    assert.strictEqual(sha(bez), SNIMOK[k].bez, k + ': без суммы — вывод «Я плачу им» изменился');
    assert.strictEqual(sha(summa), SNIMOK[k].summa, k + ': с суммой — вывод «Я плачу им» изменился');
    assert.strictEqual(JSON.stringify(U.decide(F[k], { napravlenie: 'platim', amount: 500000 })), JSON.stringify(summa), k + ': platim = по умолчанию');
    assert.ok(!('napravlenie' in bez), k + ': в прежнем выводе нового поля нет');
  });
});

test('v1.1 «Что запросить» в «Они платят мне» — без regime/resources/license/card/experience; письмо без ст. 54.1 (ТЗ [Продукт] 05.10, п. 1.1–1.2)', () => {
  const NELZYA = ['regime', 'resources', 'license', 'card', 'experience'];
  Object.keys(F).forEach((k) => [0, 500000, 5000000].forEach((a) => {
    const v = otg(F[k], { amount: a }), ids = v.docs.map((d) => d.id);
    NELZYA.forEach((id) => assert.ok(!ids.includes(id), k + ' ' + a + ': ' + id));
    assert.ok(ids.length <= 7, k);
    assert.ok(!/54\.1|БВ-4-7/.test(v.letter.body + v.letter.subject), k + ': письмо продавца без ст. 54.1');
    assert.ok(v.letter.body.includes('По нашим внутренним правилам работы с покупателями просим прислать скан-копии:'), k);
    assert.ok(v.letter.body.includes('Мы проходим эту процедуру со всеми покупателями, которым даём отсрочку. Будем благодарны за ответ в течение трёх рабочих дней.'), k);
    // при сумме больше предела — поручительство (кроме «стоп»: там только после оплаты)
    if (a > v.cap && v.tone !== 'stop') assert.ok(ids.includes('poruchitel'), k + ' ' + a + ': нет poruchitel');
    if (v.tone === 'stop') assert.ok(!ids.includes('poruchitel'), k + ': стоп — без поручительства');
  }));
  // сумма в пределах — без поручительства; сумма не введена и тон cap — с ним
  assert.ok(!otg(F.go, { amount: 1500000 }).docs.some((d) => d.id === 'poruchitel'));
  assert.ok(!otg(F.go).docs.some((d) => d.id === 'poruchitel'));
  assert.ok(otg(F.cap).docs.some((d) => d.id === 'poruchitel'));
  // отчётность — только когда в ответе нет выручки
  assert.ok(otg(F.cap).docs.some((d) => d.id === 'otchetnost'), 'нет выручки → otchetnost');
  assert.ok(!otg(F.go).docs.some((d) => d.id === 'otchetnost'), 'выручка есть → без otchetnost');
  const p = otg(F.cap).docs.find((d) => d.id === 'poruchitel');
  assert.strictEqual(p.title, 'Поручительство директора или участника');
  assert.strictEqual(p.why, 'если покупатель не оплатит, долг можно потребовать и с поручителя (ст. 361 ГК РФ) — работает, только если у поручителя есть имущество');
  // порядок ТЗ: power → fssp → taxCert → unblock → bank → fixRecord/premises → otchetnost → poruchitel
  const PORYADOK = ['power', 'powerNew', 'fssp', 'taxCert', 'unblock', 'bank', 'fixRecord', 'premises', 'otchetnost', 'poruchitel'];
  Object.keys(F).forEach((k) => {
    const n = otg(F[k], { amount: 5000000 }).docs.map((d) => PORYADOK.indexOf(d.id));
    assert.ok(n.every((x, i) => x >= 0 && (i === 0 || x > n[i - 1])), k + ': порядок ' + n);
  });
  const v = otg(F.cap, { amount: 500000 });
  assert.strictEqual(v.letter.subject, 'Документы для отгрузки с отсрочкой платежа — ' + v.facts.name);
  assert.ok(v.letter.body.includes(' с отсрочкой платежа на сумму 500 000 ₽. '), v.letter.body);
  assert.ok(otg(F.cap).letter.body.includes(' с отсрочкой платежа. '), 'без суммы — без «на сумму»');
  // «Я плачу им» — письмо по-прежнему со ст. 54.1
  assert.ok(U.decide(F.cap, { amount: 500000 }).letter.body.includes('ст. 54.1 НК РФ'));
});

test('v1.1 подпись под списком: продавцу — «Список зависит от суммы отгрузки…», покупателю — п. 16 письма ФНС', () => {
  const src = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  assert.ok(src.includes("(otg ? 'Список зависит от суммы отгрузки и найденных признаков.' : 'Список соразмерен сумме сделки — так требует п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@.')"));
});

test('reasonText склеивает число и ₽ неразрывным пробелом («1 937 ₽» не рвётся на 390 px)', () => {
  const r = Object.assign({}, F.post, { signals: [{ title: 'Долг', status: 'bad', detail: '1 937 ₽' }] });
  const pr = U.decide(r).reasons.join('|');
  assert.ok(pr.includes('1' + NB + '937' + NB + '₽'), pr);
});

test('(д) фраза п. 8 — на /indeks/ в разделе #predoplata; title и H1 не менялись', () => {
  const S = fs.readFileSync(path.join(KOREN, 'indeks/index.html'), 'utf8');
  const a = S.indexOf('<h2 id="predoplata">'), b = S.indexOf('<h2>Как считается</h2>');
  const t = S.slice(a, b).replace(/&nbsp;/g, NB).replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ');
  assert.ok(t.includes('Тот же предел действует и в обратную сторону: столько разумно отгрузить покупателю в долг. В отчёте переключите «Они платят мне».'));
  assert.ok(/<title>Индекс Делоскопа/.test(S));
});

test('калькулятор /indeks/: галочка «Отчёт сдан, выручки нет» → 0 ₽; без галочки — потолок по возрасту', () => {
  const s = P.raschet({ vyruchka: null, vozrast: 'starshe', vyvod: 'go', nol: true });
  assert.strictEqual(s.itog, 0);
  assert.ok(s.shagi.some((x) => x === '0' + NB + '₽ — советуем платить по факту поставки.'), s.shagi.join('|'));
  assert.strictEqual(P.raschet({ vyruchka: null, vozrast: 'starshe', vyvod: 'go' }).itog, 3000000);
  assert.strictEqual(P.raschet({ vyruchka: 0, vozrast: 'do12', vyvod: 'go', nol: false }).itog, 300000);
  assert.strictEqual(P.raschet({ vyruchka: 5200000, vozrast: 'starshe', vyvod: 'go', nol: true }).itog, 200000, 'при выручке галочка не действует');
  const S = fs.readFileSync(path.join(KOREN, 'indeks/index.html'), 'utf8');
  assert.ok(/name="nol"/.test(S) && S.includes('Отчёт за&nbsp;год сдан, но&nbsp;выручки в&nbsp;нём нет'));
});

test('PDF-досье — без переключателя (bezNapr), в печати он скрыт', () => {
  const R = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.ok(R.includes('Usloviya.mount(ub,r,{open:true,bezNapr:true})'));
  const src = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  assert.ok(/@media print\{\.usl \.usl-napr,\.usl \.usl-watch/.test(src));
  assert.ok(src.includes("cel('usl_otgruzhaem')") && src.includes("cel('usl_otgruzhaem_summa')"), 'цели Метрики');
  assert.ok(!/dlkGoal\([^)]*inn/i.test(src), 'без ИНН в целях');
});

// (е) Chromium 390: сегменты в одну строку, вбок 0. Нет Playwright — пропуск (проверка вида — в облаке перед выкладкой).
let pw = null;
try { pw = require('playwright'); } catch (_) { pw = null; }
test('(е) Chromium 390 и 1280: два сегмента в одну строку, вбок 0, переключение и слежение', { skip: !pw && 'нет playwright' }, async () => {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  let b;
  try { b = await pw.chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { return; }
  const kod = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  try {
    for (const w of [390, 1280]) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      await p.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:16px;font:16px system-ui"><div id="u"></div></body>');
      await p.addScriptTag({ content: kod });
      await p.evaluate((r) => { window.celi = []; window.dlkGoal = (c) => window.celi.push(c); window.M = Usloviya.mount(document.getElementById('u'), r); }, F.cap);
      const seg = await p.$$eval('[data-napr]', (bs) => bs.map((x) => { const r = x.getBoundingClientRect(); return { top: Math.round(r.top), h: r.height, pr: x.getAttribute('aria-pressed') }; }));
      assert.strictEqual(seg.length, 2);
      assert.strictEqual(seg[0].top, seg[1].top, w + ': сегменты в одну строку');
      assert.ok(seg[0].h >= 36 && seg[0].h <= 40, w + ': высота ' + seg[0].h);
      await p.click('[data-napr=otgruzhaem]');
      const t = await p.$eval('.usl-t', (x) => x.textContent);
      assert.strictEqual(t, 'Можно, отсрочка — до 150' + NB + '000' + NB + '₽');
      assert.ok(await p.$('a.usl-watch[href="/cabinet.html#watch"]'), 'ссылка на слежение');
      assert.strictEqual(await p.$('.usl select'), null, 'режим налогов скрыт');
      assert.strictEqual(await p.$eval('.usl-note', (x) => x.textContent), 'Список зависит от суммы отгрузки и найденных признаков.');
      assert.ok(!/54\.1/.test(decodeURIComponent(await p.$eval('[data-u=mail]', (x) => x.getAttribute('href')))), 'письмо продавца без ст. 54.1');
      await p.fill('.usl input', '500000'); await p.waitForTimeout(450);
      const celi = await p.evaluate(() => window.celi);
      assert.deepStrictEqual(celi, ['usl_otgruzhaem', 'usl_otgruzhaem_summa']);
      const vbok = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(vbok <= 0, w + ': вбок ' + vbok);
      await p.close();
    }
  } finally { await b.close(); }
});

test('v1.2 «Отчётность» — только у действующей: LIQUIDATING / LIQUIDATED / BANKRUPT — без неё (✎ ответ [Продукт] 05.10, разд. 4)', () => {
  assert.ok(otg(F.cap).docs.some((d) => d.id === 'otchetnost'), 'образец: действующая без выручки → otchetnost');
  ['LIQUIDATING', 'LIQUIDATED', 'BANKRUPT'].forEach((st) => {
    const r = Object.assign({}, F.cap, { company: Object.assign({}, F.cap.company, { status: st }) });
    [0, 500000].forEach((a) => {
      const ids = otg(r, { amount: a }).docs.map((d) => d.id);
      assert.ok(!ids.includes('otchetnost'), st + ' ' + a + ': ' + ids);
      assert.ok(!ids.includes('poruchitel'), st + ' ' + a + ': стоп — без поручительства');
    });
  });
  assert.ok(!otg(F.liquidated).docs.some((d) => d.id === 'otchetnost'), 'liquidated');
  // «Я плачу им» — без изменений: его сверяет снимок теста (г)
});
