// admin-dokumenty-v1 (14.11.2026): раздел «Документы в фирменном стиле» в админке — js/admin-dokumenty.js.
// Договор (с организацией или ИП; с физическим лицом; лицензия или услуги), счёт, два акта и два письма в одном
// оформлении; печать и PDF — окном печати браузера. Сторожа: реквизитов продавца в коде сайта нет (только с сервера);
// росчерк хранится в браузере и никуда не уходит; к серверу — только реквизиты и проверка по ИНН; набранное в полях
// экранируется; суммы считаются верно; паспортных данных в договоре с человеком нет; картинки лёгкие.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const D = require('../js/admin-dokumenty.js');
const P = { fio: 'Иванова Мария Петровна', inn: '123456789012', ogrnip: '123456789012345', nds_tekst: '', aktivnyj_bank: 'alfa',
  banki: { sber: { bank: 'ПАО Первый', bik: '111111111', ks: '11111111111111111111', rs: '22222222222222222222' }, alfa: { bank: 'АО «Второй»', bik: '044525593', ks: '30101810200000000593', rs: '40802810302930014277' } } };
const propis = (n) => 'прописью ' + n;
// неразрывные пробелы листа сравниваем как обычные
const pr = (x) => String(x).replace(/\u00A0/g, ' ');
const list = (...a) => pr(D.list(...a));
const UR = { pok: 'ООО «Ромашка»', pinn: '7707083893', pkpp: '770701001', pogrn: '1027700132195', padres: 'г. Москва, ул. Вавилова, д. 19', pruk: 'генеральный директор Петров Пётр Петрович', posn: 'Устава',
  pemail: 'buh@romashka.example', nomer: 'Д-7', data: '2026-11-14', mesto: 'г. Липецк', tarif: 'Про', srok: '12 месяцев', summa: '29700' };

test('семь документов; шапка, визитка и QR — одни на всех', () => {
  assert.deepStrictEqual(D.VIDY.map((x) => x[0]), ['dogovor_ur', 'dogovor_fiz', 'schet', 'akt_uslugi', 'akt', 'pismo', 'pismo_ip']);
  assert.deepStrictEqual(Object.keys(D.POLYA).sort(), D.VIDY.map((x) => x[0]).sort(), 'у каждого документа — свои поля');
  assert.deepStrictEqual(Object.keys(D.ROSCHERK).sort(), D.VIDY.map((x) => x[0]).sort(), 'у каждого документа — подсказка о росчерке');
  for (const [vid] of D.VIDY) {
    for (const d of [{}, { predmet: 'usl' }]) {
      const h = list(vid, d, P, propis);
      assert.ok(h.includes('<img src="/img/dok/znak.webp" alt=""><b>делоскоп</b>'), vid + ': знак и слово вверху');
      assert.ok(h.includes('/img/dok/studiya.jpg') && h.includes('/img/dok/vizitka-lico.jpg') && h.includes('/img/dok/vizitka-oborot.jpg'), vid + ': студия и визитка');
      assert.ok(h.includes('<img src="/img/dok/qr.svg" alt="QR-код: deloskop.ru">'), vid + ': QR-код сайта');
      assert.doesNotMatch(h, /undefined|NaN|\[object/, vid + ': пустые поля — прочерки, а не мусор');
      assert.strictEqual((h.match(/data-nasha/g) || []).length, vid === 'pismo' ? 0 : 1, vid + ': своя строка подписи — одна');
    }
  }
  for (const f of ['znak.webp', 'studiya.jpg', 'vizitka-lico.jpg', 'vizitka-oborot.jpg', 'qr.svg']) {
    const b = fs.statSync(path.join(KOREN, 'img/dok', f)).size;
    assert.ok(b > 500 && b <= 40 * 1024, 'img/dok/' + f + ': ' + b + ' Б (не больше 40 КБ)');
  }
});

test('письмо: от команды — подпись команды, от ИП — строка подписи ИП и реквизиты в шапке; текст экранируется', () => {
  const a = list('pismo', { tema: 'Тема <script>', komu: 'ООО «Ромашка»\nдиректору', tekst: 'Первый.\n\nВторой <b>абзац</b>.', nomer: '7', data: '2026-11-14' }, P, propis);
  assert.ok(a.includes('<h1>Тема &lt;script&gt;</h1>') && a.includes('<p>Второй &lt;b&gt;абзац&lt;/b&gt;.</p>') && !a.includes('<script>'));
  assert.ok(a.includes('<span>ООО «Ромашка»</span><span>директору</span>'));
  assert.ok(a.includes('14 ноября 2026 г.') && a.includes('Исх. № 7'));
  assert.ok(a.includes('<b>Команда Делоскопа</b><span>Проверка контрагента по ИНН</span>') && a.includes('С уважением,'));
  assert.ok(!a.includes('Индивидуальный предприниматель') && !a.includes(P.inn), 'в письме от команды данных ИП нет');
  const b = list('pismo_ip', {}, P, propis);
  assert.ok(b.includes('<b>Индивидуальный предприниматель Иванова Мария Петровна</b>') && b.includes('ИНН 123456789012 · ОГРНИП 123456789012345'));
  assert.ok(b.includes('<div class="pa"><span>Индивидуальный предприниматель</span><div class="ln" data-nasha><i></i><span>подпись</span></div><span>Иванова М. П.</span></div>'));
  assert.ok(b.includes('Уважаемый(ая) ______________,') && b.includes('Исполнитель: Команда Делоскопа, help@deloskop.ru'));
});

test('счёт: реквизиты активного банка, сумма и пропись, формулировки — как в счёте на сайте', () => {
  const h = list('schet', { nomer: 'Д-2026-000123', data: '2026-11-14', do: '2026-11-28', pok: 'ООО «Ромашка»', pinn: '7707083893', pkpp: '770701001', kol: '2', cena: '1500,50' }, P, propis);
  assert.ok(h.includes('АО «Второй»') && h.includes('044525593') && h.includes('30101810200000000593') && h.includes('40802810302930014277'), 'банк — активный');
  assert.ok(!h.includes('11111111111111111111') && !h.includes('ПАО Первый'), 'второй банк в счёт не попадает');
  assert.ok(h.includes('1 500,50') && h.includes('3 001,00') && h.includes('прописью 3001'));
  assert.ok(h.includes('Без налога (НДС). Счёт действителен до 28 ноября 2026 г.'), 'строка НДС по умолчанию — как на сайте');
  assert.ok(h.includes('от 14.11.2026 за доступ к сервису «Делоскоп». Без НДС.'));
  assert.ok(h.includes('Оплата счёта — акцепт оферты deloskop.ru/oferta/ (п. 3 ст. 438 ГК РФ)'));
  const sayt = chitat('js/schet-dokument.js');
  assert.ok(sayt.includes('Оплата только с расчётного счёта организации или ИП. Оплата счёта — акцепт оферты deloskop.ru/oferta/'), 'та же строка в счёте сайта');
  const pusto = list('schet', {}, {}, propis);
  assert.ok(pusto.includes('________') && pusto.includes('(сумма прописью)') && pusto.includes('Д-20__-______'), 'без данных — бланк с прочерками');
  assert.strictEqual(D.den(null), '________');
  assert.strictEqual(pr(D.den(1234567.5)), '1 234 567,50');
});

test('акты: право использования — как на сайте; работы и услуги — отдельный акт; человек — без ИНН', () => {
  const a = list('akt', { pok: 'ООО «Ромашка»', kol: '1', cena: '990' }, P, propis);
  assert.ok(a.includes('Предоставлено право использования программы для ЭВМ «Делоскоп» (простая неисключительная лицензия)'));
  assert.ok(chitat('js/schet-dokument.js').includes('Предоставлено право использования программы для ЭВМ «Делоскоп» (простая неисключительная лицензия)'));
  assert.ok(a.includes('<b>Исполнитель</b>') && a.includes('<b>Заказчик</b><span>ООО «Ромашка»</span>') && a.includes('Право использования предоставлено Заказчику'));
  const u = list('akt_uslugi', { pok: 'ООО «Ромашка»', pinn: '7707083893', pkpp: '770701001', naim: 'Подготовка документов', kol: '1', cena: '29700', osn: 'Договор № Д-7 от 14.11.2026' }, P, propis);
  assert.ok(u.includes('<h1>Акт выполненных работ (оказанных услуг) № ________'));
  assert.ok(u.includes('Подготовка документов') && u.includes('29 700,00') && u.includes('прописью 29700') && u.includes('Договор № Д-7 от 14.11.2026'));
  assert.ok(u.includes('Работы выполнены (услуги оказаны) полностью и в срок. Заказчик претензий по объёму, качеству и срокам не имеет.'));
  assert.ok(u.includes('ООО «Ромашка», ИНН 7707083893, КПП 770701001'));
  assert.strictEqual(pr(D.storona({ pok: 'Сидоров Алексей Николаевич' })), 'Сидоров Алексей Николаевич', 'человек — только имя');
  assert.strictEqual(pr(D.storona({ pok: 'ИП Сидоров', pinn: '123456789012' })), 'ИП Сидоров, ИНН 123456789012', 'у ИП нет КПП');
  assert.ok(pr(D.storona({})).includes('ИНН ____________, КПП _________'), 'пустой бланк — с прочерками');
});

test('договор: организация, ИП и человек; лицензия и услуги; росчерк — по п. 3.3; исход не обещаем', () => {
  const a = list('dogovor_ur', UR, P, propis);
  assert.ok(a.includes('<h1>Лицензионный договор № Д-7</h1>') && a.includes('<span>г. Липецк</span><span>14 ноября 2026 г.</span>'));
  assert.ok(a.includes('далее — «Лицензиар», и ООО «Ромашка» (ИНН 7707083893, КПП 770701001, ОГРН 1027700132195), далее — «Лицензиат», от имени которого действует генеральный директор Петров Пётр Петрович на основании Устава'));
  assert.ok(a.includes('по тарифу «Про» на срок 12 месяцев') && a.includes('29 700,00 руб. (прописью 29700). Без налога (НДС).'));
  assert.ok(a.includes('определены офертой Лицензиара по адресу deloskop.ru/oferta/'));
  assert.ok(a.includes('40802810302930014277') && a.includes('044525593') && !a.includes('22222222222222222222'), 'реквизиты — активного банка');
  assert.ok(a.includes('buh@romashka.example') && a.includes('г. Москва, ул. Вавилова, д. 19'));
  const f = list('dogovor_fiz', { pok: 'Сидоров Алексей Николаевич', pemail: 'a@b.example', summa: '990', tarif: 'Старт', srok: '1 месяц' }, P, propis);
  assert.ok(f.includes('и Сидоров Алексей Николаевич, далее — «Лицензиат», заключили договор'), 'человек — без «от имени которого»');
  assert.ok(f.includes('на расчётный счёт Лицензиара по реквизитам раздела 5') && f.includes('законодательство о защите прав потребителей'));
  assert.doesNotMatch(f, /паспорт|серия|выдан|зарегистрирован|дата рождения/i, 'паспортных данных в договоре с человеком нет');
  assert.ok(!D.POLYA.dogovor_fiz.some((x) => /pinn|padres|pasport/.test(x[0])), 'и полей для них нет');
  const ip = list('dogovor_ur', Object.assign({}, UR, { pinn: '123456789012', pok: 'ИП Сидоров А. Н.' }), P, propis);
  assert.ok(ip.includes('ИП Сидоров А. Н. (ИНН 123456789012, ОГРНИП 1027700132195), далее — «Лицензиат», заключили'), 'ИП — без КПП и без «на основании Устава»');
  const u = list('dogovor_ur', Object.assign({}, UR, { predmet: 'usl', usluga: 'подготовка <пакета> документов', srok: '10 рабочих дней' }), P, propis);
  assert.ok(u.includes('<h1>Договор оказания услуг № Д-7</h1>') && u.includes('«Исполнитель»') && u.includes('«Заказчик»') && !u.includes('Лицензиа'));
  assert.ok(u.includes('подготовка &lt;пакета&gt; документов, а Заказчик — принять и оплатить их. Срок: 10 рабочих дней.'));
  assert.ok(u.includes('Решения банков, государственных органов и иных третьих лиц от Исполнителя не зависят, и Исполнитель их не гарантирует.'), 'исход не обещаем');
  assert.ok(u.includes('акт выполненных работ (оказанных услуг)'));
  for (const h of [a, f, ip, u]) {
    assert.ok(h.includes('с использованием факсимильного воспроизведения подписи (п. 2 ст. 160 Гражданского кодекса РФ)'), 'росчерк — по соглашению сторон');
    assert.ok(h.includes('5. Реквизиты и подписи сторон') && h.includes('<div class="ln" data-nasha>'));
  }
  const pusto = list('dogovor_ur', {}, {}, null);
  assert.ok(pusto.includes('______________________________ (ИНН ____________, КПП _________, ОГРН _______________)') && pusto.includes('на основании Устава'), 'без данных — бланк');
});

test('заполнение по ИНН: из ответа проверки — название, КПП, ОГРН, адрес и руководитель', () => {
  const o = D.izProverki({ company: { inn: '7707083893', ogrn: '1027700132195', kpp: '773601001', name_short: 'ПАО СБЕРБАНК', name_full: 'ПУБЛИЧНОЕ…', address: 'г. Москва', director_name: 'Иванов Иван Иванович', director_post: 'ГЕНЕРАЛЬНЫЙ ДИРЕКТОР' } });
  assert.deepStrictEqual(o, { pok: 'ПАО СБЕРБАНК', pinn: '7707083893', pkpp: '773601001', pogrn: '1027700132195', padres: 'г. Москва', pruk: 'генеральный директор Иванов Иван Иванович' });
  const s = D.izProverki({ items: [{ inn: '7707083893', ogrn: '1027700132195', name: 'ПАО СБЕРБАНК', address: 'г. Москва' }] });
  assert.deepStrictEqual(s, { pok: 'ПАО СБЕРБАНК', pinn: '7707083893', pkpp: '', pogrn: '1027700132195', padres: 'г. Москва' }, 'запасной путь — подсказки: без КПП и руководителя');
  assert.strictEqual(D.izProverki({}), null);
  assert.strictEqual(D.izProverki({ items: [] }), null);
  assert.strictEqual(D.izProverki({ company: { inn: '1' } }), null, 'без названия — не заполняем');
});

test('росчерк — только в этом браузере; к серверу — реквизиты и проверка по ИНН; реквизитов в коде нет', () => {
  const js = chitat('js/admin-dokumenty.js'), kod = js.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.strictEqual((kod.match(/localStorage\.(setItem|getItem|removeItem)\(KLYUCH/g) || []).length, (kod.match(/localStorage\./g) || []).length, 'в хранилище браузера — только росчерк');
  assert.doesNotMatch(kod, /fetch\(|XMLHttpRequest|sendBeacon|dlkGoal|ym\(|document\.cookie|sessionStorage/, 'лист собирается в браузере');
  assert.deepStrictEqual(kod.match(/call\("[^"]+"/g), ['call("/api/check?q="', 'call("/api/suggest?q="', 'call("/api/admin/rekvizity"'], 'к серверу — проверка по ИНН и реквизиты, без тела запроса');
  assert.match(kod, /if \(!\/\^\(\\d\{10\}\|\\d\{12\}\)\$\/\.test\(inn\)\) \{ note\(/, 'в запрос уходит только ИНН из 10 или 12 цифр');
  assert.doesNotMatch(kod, /call\([^)]*(roscherk|KLYUCH|pok|tekst)/, 'росчерк и набранный текст на сервер не уходят');
  assert.match(kod, /if \(!svoj && fx\.w \* k > 22\)/, 'росчерк сам встаёт не выше 22 мм — не закрывает текст');
  assert.doesNotMatch(kod, /\b\d{9,20}\b/, 'ни ИНН, ни счетов, ни БИК в коде сайта');
  assert.doesNotMatch(kod, /Косарев|Kosarev/i, 'имени ИП в коде сайта нет');
  assert.doesNotMatch(js.match(/var CSS = [\s\S]*?;\n/)[0], /font-size:\s*[\d.]+px/, 'лист — в пунктах и миллиметрах (печать)');
  assert.ok(D.ROSCHERK.pismo_ip.includes('в банк и госорганы росчерк не ставьте'), 'подсказка: где росчерка недостаточно');
  assert.ok(D.ROSCHERK.dogovor_fiz.includes('с кассовым чеком'), 'подсказка об оплате от человека');
  assert.ok(D.dokument('pismo', {}, {}, null, 'Письмо <1>').includes('<title>Письмо &lt;1&gt;</title>'));
});

test('админка: раздел, скрипт и запуск после входа', () => {
  const h = chitat('admin.html');
  assert.match(h, /<section class="card" id="dokSek" hidden>\s*<h2>Документы в фирменном стиле<\/h2>[\s\S]*?<div id="dokBox"><\/div>\s*<\/section>/);
  assert.ok(h.includes('<script src="/js/admin-dokumenty.js"></script>'));
  assert.ok(h.includes('if(window.DlkDokumenty)try{DlkDokumenty.start(call,function(){return isAdmin})}catch(_){}'));
  assert.ok(h.indexOf('id="rekSek"') < h.indexOf('id="dokSek"') && h.indexOf('id="dokSek"') < h.indexOf('id="bzSek"'), 'раздел — после реквизитов');
});
