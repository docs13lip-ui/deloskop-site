// «Подписант на дату подписи» в Паспорте контрагента (Ночные 29.09 23:05, Прорыв «Я-3») — node --test tests/pasport_podpisant.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/pasport-kontragenta.js');
const U = require('../js/usloviya.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'pasport', 'kontragent', 'index.html'), 'utf8');
const skript = html.slice(html.indexOf('var API='), html.indexOf('<!--podval-->'));
const blok = skript.slice(skript.indexOf('var RS={};'), skript.indexOf('function render(r,opts){'));

function otvet(o) {
  return Object.assign({ checked_at: '2026-09-29T10:00:00+03:00', risk_level: 'low',
    company: { inn: '7700000000', ogrn: '1027700000000', name_short: 'ООО «Тест»', status: 'ACTIVE', reg_date: '2015-03-01',
      director_post: 'Генеральный директор', director_name: 'Иванов Иван Иванович' }, signals: [] }, o || {});
}
function sp(r, vvod) { const p = P.sobrat(r, { usloviya: U }); return P.podpisant(r, p, vvod); }
const vse = (a) => a.map((x) => x.tekst).join(' | ');

test('по ЕГРЮЛ — должность руководителя на дату Паспорта, ● источник; имени нет', () => {
  const a = sp(otvet(), {});
  assert.match(a[0].tekst, /^По ЕГРЮЛ на 29\.09\.2026 без доверенности действует: генеральный директор\.$/);
  assert.equal(a[0].vid, 'istochnik');
  assert.ok(!/Иванов/.test(vse(a)), 'имена людей в сверку не попадают');
});

test('подписал не руководитель при основании «устав» — просим доверенность', () => {
  const a = sp(otvet(), { dolzhnost: 'Коммерческий директор', osnovanie: 'ustav' });
  const w = a.find((x) => x.ton === 'warn');
  assert.ok(w, 'есть предупреждение');
  assert.match(w.tekst, /Запросите доверенность подписанта/);
  assert.ok(w.ssylki.some((l) => /m4d\.nalog\.gov\.ru/.test(l.u)), 'ссылка на реестр МЧД');
});

test('«Директор» и «Генеральный директор» — одна роль; заместитель — нет', () => {
  assert.ok(P.tuZheDolzhnost('директор', 'Генеральный директор'));
  assert.ok(P.tuZheDolzhnost('ГЕНЕРАЛЬНЫЙ ДИРЕКТОР', 'Генеральный директор'));
  assert.ok(!P.tuZheDolzhnost('Заместитель генерального директора', 'Генеральный директор'));
  assert.ok(!P.tuZheDolzhnost('Финансовый директор', 'Генеральный директор'));
  const a = sp(otvet(), { dolzhnost: 'директор', osnovanie: 'ustav' });
  assert.ok(a.some((x) => x.ton === 'ok' && /совпадает/.test(x.tekst)));
});

test('МЧД — проверка в реестре ФНС с ИНН доверителя', () => {
  const a = sp(otvet(), { dolzhnost: 'Менеджер', osnovanie: 'mchd' });
  const m = a.find((x) => /Электронная доверенность/.test(x.tekst));
  assert.ok(m && /ИНН 7700000000/.test(m.tekst));
  assert.equal(m.ssylki[0].u, 'https://m4d.nalog.gov.ru/emchd/check-status');
  assert.ok(!a.some((x) => x.ton === 'warn'), 'при доверенности несовпадение должности — не тревога');
});

test('подпись раньше даты сведений — к выписке ЕГРЮЛ, честно: дату записи не получаем', () => {
  const a = sp(otvet(), { data: '01.09.2026' });
  const d = a.find((x) => /раньше даты сведений/.test(x.tekst));
  assert.ok(d, 'строка есть');
  assert.match(d.tekst, /мы эту дату пока не получаем/);
  assert.equal(d.ssylki[0].u, 'https://egrul.nalog.ru/');
});

test('Паспорт старше подписи на 30+ дней — пересобрать; дата с ошибкой — не распознали', () => {
  assert.ok(sp(otvet(), { data: '15.11.2026' }).some((x) => x.ton === 'warn' && /пересоберите/.test(x.tekst)));
  assert.ok(sp(otvet(), { data: '31.02.2026' }).some((x) => x.vid === 'net' && /не распознали/.test(x.tekst)));
  assert.ok(sp(otvet(), { data: '05.10.2026' }).some((x) => x.ton === 'ok' && /разница 6 дн\./.test(x.tekst)));
});

test('отметка о дисквалификации или недостоверности руководителя поднимается в блок подписанта', () => {
  const r = otvet({ signals: [{ title: 'Руководитель дисквалифицирован', detail: 'Иванов Иван Иванович', status: 'bad', source: 'ФНС', as_of: '2026-09-01' }] });
  const a = sp(r, {});
  const b = a.find((x) => x.ton === 'bad');
  assert.ok(b, 'есть отметка');
  assert.match(b.tekst, /на 01\.09\.2026/);
  assert.ok(!/Иванов/.test(b.tekst));
});

test('нет руководителя в ответе — «○», а не выдумка; ИП — блока нет', () => {
  const r = otvet(); delete r.company.director_post; delete r.company.director_name;
  const a = sp(r, {});
  assert.equal(a[0].vid, 'net');
  const ip = otvet({ company: { inn: '770000000000', kind: 'INDIVIDUAL' } });
  assert.deepEqual(sp(ip, {}), []);
});

test('тексты блока — без словаря 222-ФЗ и запрещённых формулировок', () => {
  const r = otvet({ signals: [{ title: 'Недостоверность сведений о руководителе', status: 'warn', source: 'ФНС' }] });
  [{}, { dolzhnost: 'Коммерческий директор', osnovanie: 'ustav', data: '01.01.2026' }, { osnovanie: 'mchd', data: '31.12.2026' }, { osnovanie: 'bumaga' }]
    .forEach((v) => sp(r, v).forEach((x) => {
      assert.ok(!P.SLOVAR_222.test(x.tekst), x.tekst);
      assert.ok(!/(^|\s)(чисто|рисков\s+нет|не\s+банкрот)(\s|[.,!]|$)/i.test(x.tekst), x.tekst);
    }));
});

test('страница: поля подписанта только на странице, без имён, пересчёт на вводе, в отпечаток не входит', () => {
  assert.match(blok, /Подписант контрагента на дату подписи/);
  assert.match(blok, /'pdolzh','pdata'/, 'поля запоминаются при пересчёте «на кону»');
  assert.match(blok, /RS\.posn=o\?o\.value:''/);
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon|cookie/.test(blok));
  assert.ok(!/ФИО/.test(blok), 'имя подписанта не спрашиваем');
  assert.match(skript, /podpisantSvyazat\(r,p\);/);
  const vyp = skript.indexOf('P.vypustit(p)');
  assert.ok(vyp < skript.indexOf("reshenieHtml(it.vyvod||'см. досье',it.na_konu&&it.na_konu.summa,r,p)"), 'отпечаток считается раньше блока');
  assert.ok(!/RS_OSN\[/.test(skript.slice(vyp - 400, vyp)));
});
