// Разовые покупки в оферте и на /vozvrat/ — oferta-razovye-v1, [Ночные запуски] 02.10.2026.
// Тексты — [Право · Юрист 115-ФЗ] + [Налоговый юрист] 02.10 12:30, разд. 1 (claude/Право_оферта_разовые_покупки_…_02.10.md), дословно;
// срок пакета 12 месяцев — «да» [Продукт · Стратег] 02.10 12:55. Менять формулировки — только через [Право].
// Правило: каждый продукт tarify.json с razovo: true описан в оферте и на странице «Возврат денег».
// Запуск: node --test tests/razovye_oferta.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const bezTegov = t => t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ');
const T = JSON.parse(chitat('tarify/tarify.json'));
const RAZOVYE = Object.keys(T).filter(k => T[k] && typeof T[k] === 'object' && T[k].razovo === true);

// Как продукт назван в оферте и на /vozvrat/. Новый разовый продукт без строки здесь — тест красный:
// сначала текст [Право] в оферту и на /vozvrat/, потом кнопка «Купить».
const GDE = {
  pasport_razovyj: { oferta: '«Паспорт контрагента на дату сделки»', vozvrat: '«Паспорт контрагента»' },
  paket_pasportov: { oferta: '«3 развёрнутые проверки»', vozvrat: '«3 развёрнутые проверки»' },
  pasport_svoj: { oferta: '«Паспорт своей компании с проверкой подлинности»', vozvrat: '«Паспорт своей компании»' },
  skoraya_pod_klyuch: { oferta: 'Услуга «Скорая под ключ»', vozvrat: '«Скорая под ключ»' },
  // Тариф основателя — годовая подписка «Про» по разделу 3 (Период — год); отдельного пункта в оферте пока нет —
  // ✎ [Право] 02.10 18:20: обещание «цена не растёт, пока подписка не прервана» (/osnovatel/) закрепить в оферте.
  osnovatel: { oferta: 'Период', vozvrat: 'Отказ от тарифа в любой момент Периода', zhdyot_pravo: true },
};

test('каждый razovo: true из tarify.json описан в оферте и на /vozvrat/', () => {
  const o = bezTegov(chitat('oferta/index.html'));
  const v = bezTegov(chitat('vozvrat/index.html'));
  assert.ok(RAZOVYE.length >= 5, 'в tarify.json меньше разовых, чем ожидали: ' + RAZOVYE);
  for (const k of RAZOVYE) {
    assert.ok(GDE[k], `разовый продукт «${k}» не описан: добавьте пункт в оферту, строку на /vozvrat/ и сюда`);
    assert.ok(o.includes(GDE[k].oferta), `${k}: в оферте нет ${GDE[k].oferta}`);
    assert.ok(v.includes(GDE[k].vozvrat), `${k}: на /vozvrat/ нет ${GDE[k].vozvrat}`);
  }
});

test('оферта п. 3.7 «Разовые покупки» — формулировки [Право] дословно, термин «Паспорт»', () => {
  const t = chitat('oferta/index.html');
  const s = bezTegov(t);
  assert.ok(/<h2 id="o3">3\. Лицензия на программу: подписка и разовые покупки<\/h2>/.test(t));
  assert.ok(t.includes('<a href="#o3">3. Лицензия на программу: подписка и разовые покупки</a>'));
  // п. 3.7 — седьмой пункт раздела 3 (нумерация пунктов оферты — по порядку <li>, как п. 5.5, 6.6)
  const r3 = t.split('<h2 id="o3">')[1].split('<h2 id="o4">')[0];
  const verhnie = r3.replace(/<ol class="bukvy">[\s\S]*?<\/ol>/, '').match(/<li[\s>]/g) || [];
  assert.strictEqual(verhnie.length, 7, 'в разделе 3 должно быть 7 пунктов, «Разовые покупки» — седьмой');
  assert.ok(/<li id="razovye"><strong>Разовые покупки\.<\/strong>/.test(r3));
  for (const f of [
    'Разовые покупки. Кроме подписки, можно оплатить отдельно, без Периода:',
    '(а) «Паспорт контрагента на дату сделки» — право один раз сформировать с помощью Программы развёрнутый отчёт (Паспорт) по одному ИНН. Право считается предоставленным в момент формирования Паспорта: он сохраняется в Кабинете, и его можно скачать в PDF.',
    '(б) «3 развёрнутые проверки» — право сформировать три Паспорта по любым ИНН в течение 12 месяцев с даты оплаты. Неиспользованные проверки по заявлению возвращаем деньгами в течение этого срока.',
    '(в) «Паспорт своей компании с проверкой подлинности» — лицензия по разделу 3 на 1 год: Паспорт вашей компании, публичная ссылка и QR для проверки подлинности. Период — год с даты оплаты, без автопродления.',
    'Цена — по странице «Тарифы» на дату оплаты, без налога (НДС), по тому же основанию, что в разделе 3. Возврат — по п. 6.6 и странице «Возврат денег». Если Паспорт не сформирован или содержит ошибку по нашей вине, мы исправляем её в течение 3 рабочих дней; не исправили — возвращаем оплату.',
    'Паспорт — развёрнутый отчёт Программы по одному ИНН на дату формирования: сведения из источников с датами и расчёты Программы.',
  ]) assert.ok(s.includes(f), 'нет фразы: ' + f.slice(0, 70));
  // п. 6.6 — по-прежнему «Отказаться от подписки» (на него ссылается п. 3.7)
  const r6 = t.split('<h2 id="o6">')[1].split('<h2 id="o7">')[0];
  const p66 = bezTegov(r6.split(/<li[\s>]/)[6] || '');
  assert.ok(p66.includes('Отказаться от подписки можно в любой момент'), 'п. 6.6 сдвинулся: ' + p66.slice(0, 60));
  assert.ok(!/<style/.test(t), 'оферта — без своих стилей');
  assert.ok(chitat('css/ds.css').includes('.doc ol.bukvy{list-style:none;padding-left:0}'));
});

test('срок пакета — 12 месяцев везде из tarify.json; 330 ₽ = цена / штук', () => {
  const p = T.paket_pasportov;
  assert.strictEqual(p.srok_mes, 12);
  const shtuka = Math.floor(p.cena_rub / p.shtuk);
  const v = chitat('vozvrat/index.html');
  assert.ok(v.includes(`<span data-cena-shtuka="paket_pasportov">${shtuka}</span>`), 'на /vozvrat/ не та цена проверки');
  assert.ok(bezTegov(v).includes(`Стоимость неиспользованных проверок — ${shtuka} ₽ за каждую — в течение ${p.srok_mes} месяцев с оплаты.`));
  assert.ok(bezTegov(chitat('oferta/index.html')).includes(`в течение ${p.srok_mes} месяцев с даты оплаты`));
  const tar = bezTegov(chitat('tarify/index.html'));
  assert.ok(tar.includes(`разово, действуют ${p.srok_mes} месяцев`), '/tarify/: нет срока пакета');
  assert.ok(tar.includes('Условия разовых покупок — оферта, п. 3.7; возврат — «Возврат денег».'));
  assert.ok(chitat('tarify/index.html').includes('href="/oferta/#razovye"'));
});

test('/vozvrat/: строки [Право] дословно, старой «Пакет дополнительных отчётов» нет, ссылка на п. 3.7', () => {
  const t = chitat('vozvrat/index.html');
  const s = bezTegov(t);
  assert.ok(!s.includes('Пакет дополнительных отчётов'));
  for (const [sit, skolko] of [
    ['«Паспорт контрагента» — до формирования', 'Полностью.'],
    ['«Паспорт контрагента» — после формирования', 'Право использовано, возврата нет. Ошибка по нашей вине, которую не исправили за 3 рабочих дня, — вернём всё.'],
    ['«Паспорт своей компании»', 'Как подписка: за вычетом дней до отказа, пропорционально году.'],
  ]) assert.ok(s.includes(sit + ' ' + skolko) || s.includes(sit + skolko), 'нет строки: ' + sit);
  assert.ok(/<tr id="razovye">/.test(t));
  assert.ok(t.includes('<a href="/oferta/#razovye">п.&nbsp;3.7</a>'));
  assert.ok(s.includes('п. 6.6 и 5.11 оферты'));
});

test('редакции обеих страниц — с датой, dateModified совпадает', () => {
  const MES = { 'сентября': '09', 'октября': '10' };
  for (const d of ['oferta', 'vozvrat']) {
    const t = chitat(d + '/index.html');
    const m = t.match(/<p class="meta">Редакция от (\d{1,2}) (сентября|октября) 2026/);
    assert.ok(m, d + ': нет строки редакции');
    const iso = `2026-${MES[m[2]]}-${m[1].padStart(2, '0')}`;
    assert.ok(t.includes(`"dateModified": "${iso}"`), `${d}: dateModified ≠ редакции ${iso}`);
  }
});
