// Оплата по счёту к 14.10 — oplata-schet-v1, [Ночные запуски] 10.10.2026.
// Решение владельца 10.10 (claude/Решения_владельца_10.10_оплата_по_счёту_год_3700_счёт_бухгалтеру.md): п. 1 — годовой «Старт»
// 3 700 ₽ согласован; п. 2 — при оплате по счёту (karta: false) на /tarify/ по умолчанию «За год».
// Тексты оферты, счёта, акта и /schet/ — [Право] 10.10 01:20 (claude/Право_оплата_по_счёту_без_карты_оферта_14.10_ответы_✎_10.10.md,
// О1–О5), дословно. Правки оферты лежат в половинах <!--oplata--> и показываются вместе с оплатами; дата редакции
// становится датой включения оплат (tests/startovaya.py → redakciya_pri_oplatah). Менять формулировки — только через [Право].
// Запуск: node --test tests/oplata_schet.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = (f, k = KOREN) => fs.readFileSync(path.join(k, f), 'utf8');
const vidimoe = t => t.replace(/<template\b[\s\S]*?<\/template>/g, '');
const tekst = t => t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ');
const MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const O1 = 'Тариф — объём прав и цена на странице «Тарифы» на дату выставления счёта, если счёт оплачен в срок его действия; в остальных случаях — на дату оплаты.';
const O2 = 'Доступ открывается не позднее рабочего дня, следующего за днём зачисления оплаты на наш счёт (при оплате картой — сразу). Период начинается со дня открытия доступа.';
const O3 = [
  'Оплата по счёту. Пока платёжный сервис не подключён, платные Тарифы и разовые покупки оплачиваются только по счёту с расчётного счёта организации или индивидуального предпринимателя. Гражданам без статуса ИП, в том числе самозанятым, счёт не выставляется.',
  'Счёт действует 5 рабочих дней с даты выставления (для Тарифа основателя — п. 3.8 (з)). Счёт, оплаченный в этот срок, оплачивается по цене, указанной в счёте. Оплату после срока мы принимаем, если её сумма равна цене на дату оплаты; если не равна — предложим доплатить разницу или вернём деньги.',
  'В назначении платежа указывается номер счёта. Оплату за Покупателя может внести другое лицо (ст. 313 ГК РФ): доступ и акт оформляем на Покупателя, указанного в счёте.',
  'Если поступило меньше суммы счёта, доступ открываем после доплаты. Переплату по письму на help@deloskop.ru возвращаем на счёт, с которого она поступила, в течение 10 рабочих дней или засчитываем в следующий счёт.',
  'Если оплата поступила со счёта гражданина, не являющегося ИП, мы в течение 1 рабочего дня сообщаем об этом плательщику и возвращаем деньги на счёт, с которого они поступили.',
];
const STARYJ_DOSTUP = 'Доступ открывается в день зачисления оплаты (при оплате картой — сразу) на весь Период.';

test('tarify.json: «да» владельца на годовой «Старт» 3 700 ₽ (п. 1) — по публичному правилу округления', () => {
  const T = JSON.parse(chitat('tarify/tarify.json'));
  const st = T.tarify.find(t => t.id === 'start').startovaya;
  assert.strictEqual(st.god_soglasovan, true);
  assert.strictEqual(st.god, 3700);
  assert.strictEqual(st.god, Math.floor(st.mesyac * 12 * 0.8 / 100) * 100);
  assert.match(st.soglasovano, /10\.10\.2026/);
});

test('оферта в бете: на странице — действующая редакция, новые пункты лежат скрытыми до оплат', () => {
  const of = chitat('oferta/index.html');
  const v = tekst(vidimoe(of));
  const vse = tekst(of.replace(/<!--v-bete-->[\s\S]*?<!--\/v-bete-->/g, '').replace(/<\/?template[^>]*>/g, ''));  // как будет при оплатах
  assert.ok(v.includes(STARYJ_DOSTUP), 'видна прежняя строка о доступе');
  assert.ok(!v.includes(O2) && vse.includes(O2), 'О2 — в половине oplata');
  assert.ok(!v.includes('на дату выставления счёта') && vse.includes(O1), 'О1 — в половине oplata');
  O3.forEach((a, i) => assert.ok(!v.includes(a) && vse.includes(a), 'О3 абзац ' + (i + 1)));
  assert.match(of, /<!--redakciya-pri-oplatah:/);
  assert.match(of, /<p class="meta">Редакция от 4 октября 2026 /);
});

test('счёт, акт и /schet/: О2, О4, О5 — дословно, редакция оферты в счёте = строка «Редакция от» оферты', () => {
  const js = chitat('js/schet-dokument.js');
  assert.ok(js.includes("Оплата счёта — акцепт оферты deloskop.ru/oferta/' + esc(redakciya()) + ' (п. 3 ст. 438 ГК РФ). '"));
  assert.ok(js.includes('" в редакции от " + m.content'));
  assert.ok(js.includes('"Доступ открывается не позднее рабочего дня, следующего за днём зачисления оплаты, на срок тарифа."'));
  assert.ok(js.includes('"Предоставлено право использования программы для ЭВМ «Делоскоп» (простая неисключительная лицензия), тариф «" + d.tarif + "», на период с "'));
  assert.ok(js.includes('"Право использования предоставлено Заказчику на указанный период."'));
  assert.doesNotMatch(js, /согласие с условиями оферты|Предоставление доступа к сервису|Доступ к сервису предоставлен|в день зачисления оплаты на срок|увидим оплату в тот же день/);
  assert.doesNotMatch(chitat('js/schet.js'), /увидим оплату в тот же день/);
  const red = chitat('oferta/index.html').match(/<p class="meta">Редакция от (\d{1,2} [а-я]+ \d{4})/)[1];
  assert.ok(chitat('schet/dokument/index.html').includes('<meta name="deloskop-oferta" content="' + red + '">'), 'meta = дата редакции');
  const sc = chitat('schet/index.html');
  assert.ok(sc.includes('<li><b>Доступ — в день зачисления</b>Не позднее следующего рабочего дня. Откроем тариф на почту из заявки и пришлём акт для бухгалтерии.</li>'));
  assert.doesNotMatch(sc, /Доступ — в день оплаты/);
});

test('репетиция 14.10 на копии: "beta": false → новая редакция видна, дата = день включения, повтор ничего не меняет', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oplata-schet-'));
  const K = path.join(tmp, 'site');
  fs.cpSync(KOREN, K, { recursive: true, filter: s => !/[\\/](\.git|node_modules)([\\/]|$)/.test(s) });
  try {
    const p = path.join(K, 'tarify/tarify.json');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('"beta": true', '"beta": false'));
    const sobrat = () => {
      execFileSync('python3', ['tests/sobrat_tarify.py', '.'], { cwd: K, stdio: 'pipe' });
      execFileSync('python3', ['tests/sobrat_shapku.py'], { cwd: K, stdio: 'pipe' });
    };
    sobrat();
    const msk = new Date(Date.now() + 3 * 3600e3);
    const segodnya = msk.getUTCDate() + ' ' + MES[msk.getUTCMonth()] + ' ' + msk.getUTCFullYear();
    const of = chitat('oferta/index.html', K);
    const v = tekst(vidimoe(of));
    assert.ok(v.includes(O1) && v.includes(O2), 'О1 и О2 видны');
    O3.forEach((a, i) => assert.ok(v.includes(a), 'О3 абзац ' + (i + 1) + ' виден'));
    assert.ok(!v.includes(STARYJ_DOSTUP), 'прежняя строка о доступе скрыта');
    assert.ok(v.includes('Вознаграждение — по Тарифу на странице «Тарифы», в рублях.'), 'разд. 3 без «на дату оплаты»');
    assert.ok(of.includes('<p class="meta">Редакция от ' + segodnya + ' '), 'дата редакции — сегодня');
    assert.doesNotMatch(of, /redakciya-pri-oplatah/);
    assert.ok(of.includes('"dateModified": "' + msk.toISOString().slice(0, 10) + '"'));
    assert.ok(chitat('schet/dokument/index.html', K).includes('<meta name="deloskop-oferta" content="' + segodnya + '">'));
    assert.ok(of.includes('<li id="start">'), 'п. 3.9 стартовой цены встал вместе с оплатами («да» на 3 700 ₽)');
    const pg = chitat('tarify/index.html', K);
    assert.ok(pg.includes('data-period="god" aria-pressed="true" class="on"'), '/tarify/ — «За год» по умолчанию');
    const snimok = ['oferta/index.html', 'schet/dokument/index.html', 'tarify/index.html', 'tarify/tarify.json'].map(f => chitat(f, K));
    sobrat();
    assert.deepStrictEqual(['oferta/index.html', 'schet/dokument/index.html', 'tarify/index.html', 'tarify/tarify.json'].map(f => chitat(f, K)), snimok, 'повторная сборка ничего не меняет');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
