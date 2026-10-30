// signal-id-v1 — правила по стабильному коду признака, а не по тексту заголовка (задание Master 30.10, «Архитектура»;
// приёмка: «переименование текста сигнала не меняет правило»).
// Сначала — воспроизведение на main b737976d: признак tax_debt с другим заголовком («Сумма к уплате в бюджет»)
// классифицировался как 'other' — долг перед бюджетом выпадал из «Условий сделки», «Щита» и сравнения.
// Совместимость: для нынешних ответов API (заголовки как есть) вид признака побайтно прежний.
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/usloviya.js');
const S = require('../js/sdelka.js');
const SV = require('../js/svyazi.js');
const SR = require('../js/sravnenie.js');

// прежний классификатор (main b737976d, js/usloviya.js KINDS) — эталон совместимости
const STARYJ = [
  ['exit', /ликвидац|ликвидир|банкрот|реорганиз|прекращ/i], ['diskv', /дисквалиф/i], ['nedost', /недостоверн/i],
  ['block', /приостановл|блокировк[аи]? (операц|сч)|решени[ея] о приостан/i], ['mass', /массов/i],
  ['fssp', /пристав|исполнительн|фссп/i], ['rnp', /недобросовестн.*поставщ|\bрнп\b/i], ['dolg', /задолженн|недоимк|долг/i],
  ['director', /руководител|директор/i], ['staff', /численност|сотрудник|штат/i], ['report', /отч[её]тност|не сда/i],
  ['nagruzka', /нагрузк|налоги.*уплач|уплачен.*налог/i], ['fines', /правонаруш|штраф/i], ['young', /молод|зарегистрир|возраст/i]
];
const staryj = (t) => { for (const [k, re] of STARYJ) if (re.test(t || '')) return k; return 'other'; };

// заголовки, которые сегодня отдаёт /api/check (ответ 30.10 21:30 и фикстуры тестов), с их id
const API = [
  ['status', 'Статус'], ['address', 'Адрес'], ['age', 'Возраст компании'], ['tax_debt', 'Задолженность по налогам'],
  ['tax_debt', 'Долги по налогам'], ['employees', 'Сотрудники'], ['management', 'Массовый руководитель'],
  ['mass', 'Массовый адрес'], ['mass_address', 'Массовый адрес'], ['mass_dir', 'Массовый руководитель'], ['fssp', 'ФССП'],
  ['dynamics', 'Финансовая динамика по годам'], [undefined, 'Массовый учредитель'], [undefined, 'Недостоверность сведений'],
  [undefined, 'Дисквалифицированный руководитель'], [undefined, 'Компания в процессе ликвидации'],
  [undefined, 'Решение о приостановлении операций по счетам'], [undefined, 'Реестр недобросовестных поставщиков'],
  [undefined, 'Налоговая нагрузка'], [undefined, 'Не сдаёт отчётность'], [undefined, 'Штрафы за налоговые правонарушения'],
  [undefined, 'Смена руководителя'], [undefined, 'Новый признак']
];

const resp = (signals) => ({ company: { inn: '7700000000', name_short: 'ООО «Тест»', status: 'ACTIVE', kind: 'LEGAL', reg_date: '2015-01-01' },
  risk_level: 'medium', signals, checked_at: '2026-10-30T10:00:00Z', dossier: { kpi: [{ label: 'Выручка за 2025', value: 50e6 }] } });

test('совместимость: для нынешних заголовков API вид признака — как у прежнего классификатора', () => {
  API.forEach(([id, title]) => {
    const s = { id, title, status: 'warn' };
    assert.strictEqual(U.kindOf(s), staryj(title), id + ' / ' + title);
    assert.strictEqual(U.kindOf(title), staryj(title), 'kindOf(строка): ' + title);
  });
});

test('воспроизведение: заголовок tax_debt переименован → прежний классификатор терял долг, теперь — тот же признак', () => {
  const nov = 'Сумма к уплате в бюджет';
  assert.strictEqual(staryj(nov), 'other', 'дефект на main: по тексту — «прочее»');
  const s = { id: 'tax_debt', title: nov, status: 'bad', detail: '120 000 ₽' };
  assert.deepStrictEqual(U.signalId(s), { id: 'tax_debt', kind: 'dolg', po: 'id' });
  // «Условия сделки»: вывод тот же, что при прежнем заголовке (кроме самих слов заголовка)
  const a = U.decide(resp([{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'bad', detail: '120 000 ₽' }]), { amount: 500000 });
  const b = U.decide(resp([s]), { amount: 500000 });
  ['tone', 'cap', 'level'].forEach((k) => assert.strictEqual(b[k], a[k], k));
  assert.deepStrictEqual(b.facts.bad, a.facts.bad);
  assert.strictEqual(b.facts.list[0].sid, 'tax_debt');
  // сравнение двух компаний: строка «Долги по налогам» берёт признак по коду
  const st = SR.stroki(resp([s]), resp([{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет' }]));
  const nd = st.filter((x) => x.k === 'nedoimka')[0];
  assert.strictEqual(nd.a.t, '120 000 ₽');
  assert.strictEqual(nd.a.ton, 'bad');
});

test('однозначные id: переименование заголовка не меняет правило (численность, возраст, массовый адрес и руководитель, ФССП)', () => {
  [['employees', 'Люди в штате', 'shtat', 'staff'], ['age', 'Дата появления', 'vozrast', 'young'],
    ['mass_address', 'Адрес многих компаний', 'mass_address', 'mass'], ['mass_dir', 'Руководит многими', 'mass_dir', 'mass'],
    ['fssp', 'Взыскания', 'fssp', 'fssp']].forEach(([id, title, sid, kind]) => {
    assert.deepStrictEqual(U.signalId({ id, title, status: 'warn' }), { id: sid, kind, po: 'id' }, id);
  });
});

test('код признака (signal_id / rule_id) главнее текста; неизвестный код не угадывается по словам и не теряется', () => {
  assert.deepStrictEqual(U.signalId({ signal_id: 'mass_dir', title: 'Что-то совсем другое' }), { id: 'mass_dir', kind: 'mass', po: 'kod' });
  assert.deepStrictEqual(U.signalId({ rule_id: 'likvidaciya', id: 'status', title: 'Статус' }), { id: 'likvidaciya', kind: 'exit', po: 'kod' });
  assert.deepStrictEqual(U.signalId({ signal_id: 'novyj_kod', title: 'Компания ликвидирована' }), { id: 'novyj_kod', kind: 'other', po: 'kod' });
  const v = U.decide(resp([{ signal_id: 'novyj_kod', title: 'Компания ликвидирована', status: 'bad' }]));
  assert.strictEqual(v.facts.bad.other, 1, 'неизвестный «плохой» признак — в «прочем», а не потерян');
  // общие id (status, address, management) — через адаптер по заголовку, как раньше
  assert.strictEqual(U.signalId({ id: 'management', title: 'Массовый руководитель' }).po, 'tekst');
  assert.strictEqual(U.signalId({ id: 'management', title: 'Массовый руководитель' }).id, 'mass_dir');
  // каждый signal_id словаря получает свой вид
  U.SIGNALY.forEach((k) => assert.notStrictEqual(U.signalId({ signal_id: k }).kind, 'other', k));
});

test('signal_id не попадает в сохранённый вывод: JSON фактов побайтно прежний', () => {
  const v = U.decide(resp([{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'bad' }]));
  assert.strictEqual(v.facts.list[0].sid, 'tax_debt');
  assert.ok(!/"sid"/.test(JSON.stringify(v)), 'sid в JSON');
});

test('досье сделки и «Связи»: массовый адрес и руководитель находятся по коду при новом заголовке, без кода — как раньше', () => {
  const sec = { sections: [{ id: 'management', rows: [['Генеральный директор', 'Иванов Иван'], ['Руководит с', '01.01.2020']] },
    { id: 'profile', rows: [['Юридический адрес', 'г. Москва, ул. Тестовая, 1']] }] };
  const r = (signals) => Object.assign(resp(signals), { dossier: sec });
  const nov = [{ id: 'mass_dir', title: 'Руководит многими', status: 'warn', detail: '12 компаний' },
    { id: 'mass_address', title: 'Адрес многих компаний', status: 'warn', detail: '40 компаний' }];
  const st = [{ title: 'Массовый руководитель', status: 'warn', detail: '12 компаний' }, { title: 'Массовый адрес', status: 'warn', detail: '40 компаний' }];
  [nov, st].forEach((sig, i) => {
    const m = SV.model(r(sig));
    const ruk = m.uzly.filter((u) => u.k === 'rukovoditel')[0], adr = m.uzly.filter((u) => u.k === 'adres')[0];
    assert.strictEqual(ruk.ton, 'warn', 'Связи, руководитель, вариант ' + i);
    assert.strictEqual(ruk.pod, '12 компаний');
    assert.strictEqual(adr.ton, 'warn', 'Связи, адрес, вариант ' + i);
    const sv = S.svyazi(r(sig));
    assert.ok(sv && JSON.stringify(sv).includes('12 компаний'), 'досье, руководитель, вариант ' + i);
  });
  // ok-признак в досье не считается замечанием (как раньше)
  const okSig = [{ id: 'mass_address', title: 'Адрес многих компаний', status: 'ok', detail: '' }];
  assert.ok(!JSON.stringify(S.svyazi(r(okSig)) || {}).includes('Адрес многих компаний'));
});
