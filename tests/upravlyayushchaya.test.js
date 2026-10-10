// upravlyayushchaya-v1 ([Ночные-3] 10.10.2026) — полномочия руководителя переданы управляющей организации.
// Живой ответ /api/check (ПАО «Яковлев», ПАО «ОДК-Сатурн», 10.10.2026): director_name — название компании,
// director_post — null. Было: «Руководитель: ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "…"» в Паспорте, «Руководителя в полученных
// сведениях нет» в подписанте, а Делопись сокращала название как ФИО («ПУБЛИЧНОЕ А. О. …»).
// node --test tests/upravlyayushchaya.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../js/imya.js');
const P = require('../js/pasport-kontragenta.js');
const U = require('../js/usloviya.js');
const S = require('../js/sushchestvennoe.js');

const UK = 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "ОБЪЕДИНЕННАЯ АВИАСТРОИТЕЛЬНАЯ КОРПОРАЦИЯ"';
const UK_E = 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «ОБЪЕДИНЕННАЯ АВИАСТРОИТЕЛЬНАЯ КОРПОРАЦИЯ»';

function otvet(dir, post) {
  return {
    checked_at: '2026-10-10T04:22:00+03:00', risk_level: 'low', signals: [],
    company: { inn: '3807002509', ogrn: '1023801428111', kind: 'LEGAL', name_short: 'ПАО "ЯКОВЛЕВ"', status: 'ACTIVE',
      reg_date: '1992-10-13', director_name: dir, director_post: post == null ? null : post, director_since: '2025-01-21' },
    dossier: { sections: [{ title: 'Руководство и собственники', rows: [['Руководитель', dir], ['Руководит с', '21.01.2025 (1 год 8 месяцев)'], ['Уставный капитал', '1 ₽']], comment: 'Руководитель стабилен.' }] },
  };
}

test('организация или ФИО: формы целиком, фамилии не путаем', () => {
  for (const t of [UK, 'ООО "УК РОСТ"', 'АО «УК»', 'УК ВЕКТОР', 'Общество с ограниченной ответственностью Ромашка', 'ГОСКОРПОРАЦИЯ РОСАТОМ'])
    assert.ok(I.organizaciya(t), t);
  for (const t of ['Иванов Иван Иванович', 'Фондов Олег Петрович', 'Компаниец Пётр Ильич', 'Ао Иван', 'Обществов Илья', '', null, undefined])
    assert.ok(!I.organizaciya(t), String(t));
});

test('ispravitOtvet: должность «Управляющая организация», «ёлочки», строки досье; ФИО не трогаем', () => {
  const r = I.ispravitOtvet(otvet(UK));
  assert.strictEqual(r.company.director_org, true);
  assert.strictEqual(r.company.director_post, 'Управляющая организация');
  assert.strictEqual(r.company.director_name, UK_E);
  assert.deepStrictEqual(r.dossier.sections[0].rows.slice(0, 2).map((x) => x[0]), ['Управляющая организация', 'Управляет с']);
  assert.strictEqual(r.dossier.sections[0].rows[0][1], UK_E);
  assert.strictEqual(r.dossier.sections[0].comment, 'Управляющая организация не менялась.');
  // повторный вызов ничего не меняет
  assert.deepStrictEqual(I.ispravitOtvet(JSON.parse(JSON.stringify(r))), r);
  // должность из ЕГРЮЛ, если есть, не заменяем
  assert.strictEqual(I.ispravitOtvet(otvet(UK, 'УПРАВЛЯЮЩАЯ КОМПАНИЯ')).company.director_post, 'УПРАВЛЯЮЩАЯ КОМПАНИЯ');
  // человек — как было
  const f = I.ispravitOtvet(otvet('Иванов Иван Иванович', 'Генеральный директор'));
  assert.strictEqual(f.company.director_org, undefined);
  assert.strictEqual(f.dossier.sections[0].rows[0][0], 'Руководитель');
  assert.strictEqual(f.dossier.sections[0].rows[1][0], 'Руководит с');
  assert.strictEqual(f.dossier.sections[0].comment, 'Руководитель стабилен.');
});

test('существенные факты: строка «Управляющая организация», «сменилась» в женском роде', () => {
  const r = I.ispravitOtvet(otvet(UK));
  const a = S.fakty(r);
  const spisok = a.spisok.concat(a.eshche);
  const ruk = spisok.find((x) => x.k === 'rukovoditel');
  assert.ok(ruk, 'строка о руководителе есть');
  assert.strictEqual(ruk.nazv, 'Управляющая организация');
  assert.match(ruk.znach, /^(Не менялась|Сменилась) /);
});

test('Паспорт: управляющая организация названа, подписант — через неё, без «руководителя нет»', () => {
  const r = I.ispravitOtvet(otvet(UK));
  const p = P.sobrat(r, { usloviya: U });
  const lyudi = p.razdely.find((x) => x.id === 'lyudi');
  const f = lyudi.fakty.find((x) => x.tekst === 'Управляющая организация');
  assert.ok(f, 'факт в разделе «Руководитель и учредители»');
  assert.strictEqual(f.znachenie, UK_E, 'название организации — не персональные данные, показываем');
  assert.strictEqual(P.VERSIYA, 'Паспорт v2.11');
  const a = P.podpisant(r, p, { dolzhnost: 'Генеральный директор', osnovanie: 'ustav' });
  const t = a.map((x) => x.tekst).join(' | ');
  assert.match(t, /полномочия руководителя переданы управляющей организации — ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «ОБЪЕДИНЕННАЯ/);
  assert.match(t, /договор о передаче полномочий/);
  assert.doesNotMatch(t, /Руководителя в полученных сведениях нет/);
  assert.doesNotMatch(t, /без доверенности действует: управляющая/);
  assert.ok(!a.some((x) => x.ton === 'warn'), 'должность подписанта с «управляющей организацией» не сравниваем');
});

test('Делопись: название управляющей организации не сокращаем как ФИО', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'delopis', 'index.html'), 'utf8');
  const i = html.indexOf('function partyLine(c, role)'), j = html.indexOf('function reqs(c, role)');
  const kod = html.slice(i, j);
  const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // eslint-disable-next-line no-new-func
  const f = new Function('esc', kod + '; return { partyLine: partyLine, signer: signer };')(esc);
  const c = I.ispravitOtvet(otvet(UK)).company;
  c.name_full = 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «ЯКОВЛЕВ»';
  const pl = f.partyLine(c, 'Поставщик'), sg = f.signer(c);
  assert.match(pl, /договор подписывает управляющая организация ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «ОБЪЕДИНЕННАЯ АВИАСТРОИТЕЛЬНАЯ КОРПОРАЦИЯ» в лице/);
  assert.match(sg, /^За управляющую организацию ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «ОБЪЕДИНЕННАЯ/);
  assert.doesNotMatch(pl + sg, /А\. О\.|ПУБЛИЧНОЕ А\./);
  // человек — как было
  const ch = { kind: 'LEGAL', name_full: 'ООО «Тест»', inn: '7700000000', ogrn: '1', director_post: 'Генеральный директор', director_name: 'Иванов Иван Иванович' };
  assert.match(f.signer(ch), /Иванов И\. И\./);
});

test('imya.js подключён везде, где показываем руководителя из ответа API', () => {
  for (const f of ['index.html', 'report.html', 'pasport/kontragent/index.html', 'pasport/index.html', 'delopis/index.html']) {
    const h = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(h.includes('/js/imya.js'), f);
  }
});
