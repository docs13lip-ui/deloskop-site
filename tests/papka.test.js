// «Папка к договору» — опись приложений (Ночные 30.09 23:05) — node --test tests/papka.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'js', 'papka.js'));
const L = require(path.join(ROOT, 'js', 'lestnica.js'));

const PAS = { nomer: 'ОБРАЗЕЦ', data: '30.09.2026 в 22:00 МСК', nazvanie: 'ООО «Тест»', inn: '7701234567', otpechatok: 'AB12‑CD34‑EF56‑7890' };
function otm(razdel, o) {
  return Object.assign({ ok: true, razdel, rez: 'net', url: 'https://egrul.nalog.ru/', adres: 'https://egrul.nalog.ru/',
    tekst: 'Проверено вами 30.09.2026 в 22:10 МСК — egrul.nalog.ru: сведений не найдено.', kogda: '30.09.2026 в 22:10 МСК',
    pril: '', ep: false, dolzhnost: 'Бухгалтер' }, o || {});
}
const FSSP = { url: 'https://fssp.gov.ru/iss/ip', adres: 'https://fssp.gov.ru/iss/ip', tekst: 'Проверено вами 30.09.2026 в 22:15 МСК — Банк данных ФССП: сведений не найдено.' };

test('пусто — честная подсказка, без выдуманных приложений', () => {
  const o = K.opis({ pasport: PAS });
  assert.strictEqual(o.itogo, 0);
  assert.deepStrictEqual(o.stroki, []);
  assert.match(o.itogoTekst, /Приложений пока нет/);
  assert.match(o.zagolovok, /^Опись приложений к Паспорту контрагента № ОБРАЗЕЦ, сведения на 30\.09\.2026/);
  assert.strictEqual(o.kompaniya, 'ООО «Тест» · ИНН 7701234567');
});

test('номер, вписанный заказчиком, сохраняется; остальным — свободные номера по порядку', () => {
  const o = K.opis({ pasport: PAS, otmetki: [otm(6, { pril: '2', ep: true }), otm(9, Object.assign({}, FSSP))] });
  assert.deepStrictEqual(o.stroki.map((x) => x.n), ['1', '2']);
  const ep = o.stroki.find((x) => x.n === '2');
  assert.strictEqual(ep.chto, 'Выписка ЕГРЮЛ в PDF с электронной подписью ФНС');
  assert.strictEqual(ep.kogda, '30.09.2026 в 22:10 МСК');
  assert.strictEqual(ep.kto, 'Бухгалтер');
  const f = o.stroki.find((x) => x.n === '1');
  assert.match(f.chto, /^Снимок экрана: Банк данных ФССП: сведений не найдено$/);
  assert.match(f.primechanie, /номер присвоен описью, подпишите им документ/);
  assert.deepStrictEqual(o.preduprezhdeniya, []);
  assert.match(o.itogoTekst, /^Всего 2 приложения на ____ листах$/);
});

test('один номер у двух отметок и пропуски — предупреждаем, не молчим', () => {
  const o = K.opis({ pasport: PAS, otmetki: [otm(6, { pril: '3' }), otm(9, Object.assign({ pril: '3' }, FSSP))] });
  assert.ok(o.preduprezhdeniya.some((t) => /Номер 3 указан дважды — в разделах 6 и 9/.test(t)));
  assert.ok(o.preduprezhdeniya.some((t) => /Пропущены номера: 1, 2/.test(t)));
});

test('«проверить не удалось» без снимка — не приложение; со снимком — приложение', () => {
  assert.strictEqual(K.opis({ otmetki: [otm(6, { rez: 'ne_udalos' })] }).itogo, 0);
  assert.strictEqual(K.opis({ otmetki: [otm(6, { rez: 'ne_udalos', pril: '1' })] }).itogo, 1);
  assert.strictEqual(K.opis({ otmetki: [{ ok: false }] }).itogo, 0, 'ошибочная отметка не считается');
});

test('лестница: пункты «в самом Паспорте» — без приложения; от контрагента — «от контрагента»', () => {
  const v = L.stupen({ summa: 50000000 });
  const o = K.opis({ pasport: PAS, lestnica: v.spisok });
  const vPas = v.spisok.filter((x) => x.k === 'v_pasporte').length;
  assert.strictEqual(vPas, 2, 'отметка (ступень 1) и «Решение о сделке» (ступень 4)');
  assert.strictEqual(o.itogo, v.spisok.length - vPas);
  assert.ok(!o.stroki.some((x) => /Отметка о самопроверке|«Решение о сделке»/.test(x.chto)));
  const kontr = o.stroki.filter((x) => x.otkuda === 'от контрагента');
  assert.ok(kontr.some((x) => /^Справка об исполнении обязанности по уплате налогов \(КНД 1120101\)/.test(x.chto)));
  assert.strictEqual(o.lsNomera.length, v.spisok.length, 'номер для каждого пункта лестницы в печати');
  v.spisok.forEach((x, i) => assert.strictEqual(o.lsNomera[i], x.k === 'v_pasporte' ? 'в Паспорте' : 'прил. № ' + (i + 1 - v.spisok.slice(0, i).filter((y) => y.k === 'v_pasporte').length)));
  assert.deepStrictEqual(o.stroki.map((x) => +x.n), o.stroki.map((_, i) => i + 1), 'номера подряд без дыр');
});

test('отметка закрывает пункт лестницы с тем же первоисточником — одна строка, не две', () => {
  const v = L.stupen({ summa: 500000 });
  const bez = K.opis({ lestnica: v.spisok }).itogo;
  const o = K.opis({ lestnica: v.spisok, otmetki: [otm(6, { pril: '2', ep: true })] });
  assert.strictEqual(o.itogo, bez - 1, 'выписка с ЭП закрывает и «Статус в ЕГРЮЛ», и «Выписку ЕГРЮЛ с ЭП»: минус одна строка к лестнице, плюс ноль');
  const ep = o.stroki.find((x) => x.n === '2');
  assert.match(ep.primechanie, /пункты лестницы, ступени 1 и 2/);
  const iEp = v.spisok.findIndex((x) => x.k === 'egrul_ep'), iSt = v.spisok.findIndex((x) => /^Статус в ЕГРЮЛ/.test(x.t));
  assert.strictEqual(o.lsNomera[iEp], 'прил. № 2');
  assert.strictEqual(o.lsNomera[iSt], 'прил. № 2');
});

test('пункт с двумя первоисточниками закрывается, только когда отмечены оба', () => {
  const v = L.stupen({ summa: 500000 });
  const o = K.opis({ lestnica: v.spisok, otmetki: [otm(9, Object.assign({}, FSSP))] });
  const ost = o.stroki.find((x) => /^Долги у приставов \(для организаций\) и арбитражные дела/.test(x.chto));
  assert.ok(ost, 'строка осталась');
  assert.match(ost.chto, /ещё не отмечено: kad\.arbitr\.ru$/);
  assert.strictEqual(ost.otkuda, 'kad.arbitr.ru');
  const kad = { url: 'https://kad.arbitr.ru/', adres: 'https://kad.arbitr.ru/', tekst: 'Проверено вами 30.09.2026 в 22:20 МСК — Картотека арбитражных дел: сведений не найдено.' };
  const o2 = K.opis({ lestnica: v.spisok, otmetki: [otm(9, Object.assign({}, FSSP)), otm(10, kad)] });
  assert.ok(!o2.stroki.some((x) => /^Долги у приставов/.test(x.chto)), 'оба отмечены — пункт закрыт');
});

test('поле «Запросили у контрагента»: по запятым, без повторов, не больше 20', () => {
  const o = K.opis({ zaprosili: 'приказ о директоре, доверенность подписанта; приказ о директоре\nустав' });
  assert.deepStrictEqual(o.stroki.map((x) => x.chto), ['Приказ о директоре', 'Доверенность подписанта', 'Устав']);
  assert.ok(o.stroki.every((x) => x.otkuda === 'от контрагента'));
  const mnogo = K.opis({ zaprosili: Array.from({ length: 40 }, (_, i) => 'док ' + i).join(',') });
  assert.strictEqual(mnogo.itogo, K.MAX_ZAPROS);
});

test('склонение: 1 приложение, 2 приложения, 5 и 11 приложений, 21 приложение', () => {
  assert.strictEqual(K.prilozhenij(1), '1 приложение');
  assert.strictEqual(K.prilozhenij(3), '3 приложения');
  assert.strictEqual(K.prilozhenij(5), '5 приложений');
  assert.strictEqual(K.prilozhenij(11), '11 приложений');
  assert.strictEqual(K.prilozhenij(12), '12 приложений');
  assert.strictEqual(K.prilozhenij(21), '21 приложение');
  assert.strictEqual(K.prilozhenij(22), '22 приложения');
});

test('честность: без обещаний исхода; оговорка «не получал и не проверял»', () => {
  const vse = K.OGOVORKA + K.PODSKAZKA + fs.readFileSync(path.join(ROOT, 'js', 'papka.js'), 'utf8').split('*/')[1];
  assert.match(K.OGOVORKA, /Делоскоп эти документы не получал и не проверял/);
  assert.match(K.OGOVORKA, /в отпечаток SHA-256 Паспорта опись не входит/);
  assert.ok(!/гарант|суд примет|защитит|доказано|100 ?%/i.test(vse));
});

test('модуль без сети и хранилищ', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'papka.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon|document\.cookie/.test(src));
});

test('страница Паспорта: модуль подключён, кнопка есть, опись в печати — только по кнопке, отдельной страницей', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
  const i = html.indexOf('<script src="/js/papka.js"></script>');
  assert.ok(i > 0 && i < html.indexOf('<script src="/js/pasport-kontragenta.js"></script>'));
  assert.match(html, /id="papka" hidden[^>]*>Папка к договору</);
  assert.match(html, /html:not\(\.papka-pechat\) #papka-r\{display:none!important\}/);
  assert.match(html, /#papka-r\{break-before:page/);
  const skript = html.slice(html.indexOf('var API='), html.indexOf('<!--podval-->'));
  const blok = skript.slice(skript.indexOf('var K=window.Papka'), skript.indexOf('function reshenieHtml('));
  assert.ok(blok.length > 500, 'код папки найден');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon|cookie/.test(blok));
  assert.match(blok, /classList\.remove\('papka-pechat'\)/, 'после печати режим снимается');
  assert.match(skript, /otmSvodka\(\);papkaObnovit\(\);/, 'опись обновляется при каждой отметке');
});

// ── papka-v1.1 (Ночные 01.10 01:05, п. 180): выписка с ЭП и «ЗСК-дневник» ──
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const ZSK_URL = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';
function zskOtm(o) { return otm(12, Object.assign({ url: ZSK_URL, adres: ZSK_URL, tekst: 'Проверено вами 30.09.2026 в 22:20 МСК — cbr.ru — проверка по ИНН: сведений не найдено.', kogda: '30.09.2026 в 22:20 МСК', dnej: 0 }, o || {})); }

test('v1.1: пункт лестницы «Выписка с ЭП» без отметки — подсказка скачать PDF и вписать дату', () => {
  const o = K.opis({ pasport: PAS, lestnica: L.stupen({ summa: 5000000 }).spisok });
  const r = o.stroki.find((x) => /Выписка ЕГРЮЛ в PDF с электронной подписью/.test(x.chto));
  assert.ok(r, 'пункт есть на ступени 3');
  assert.ok(r.primechanie.indexOf(K.EP_PODSKAZKA) > 0);
  assert.match(K.EP_PODSKAZKA, /дату скачивания/);
});

test('v1.1: отметка с выпиской с ЭП — дата из отметки и оговорка «исправьте от руки»', () => {
  const o = K.opis({ pasport: PAS, otmetki: [otm(6, { pril: '1', ep: true })] });
  assert.match(o.stroki[0].primechanie, /если PDF скачан в другой день — исправьте дату от руки/);
  const b = K.opis({ pasport: PAS, otmetki: [Object.assign({}, otm(9), FSSP)] });
  assert.ok(!/PDF скачан/.test(b.stroki[0].primechanie), 'у снимка ФССП подсказки про PDF нет');
});

test('v1.1: ЗСК-дневник — не сверяли / не найдено / есть / давность', () => {
  const n = K.opis({ pasport: PAS }).zsk;
  assert.strictEqual(n.est, false);
  assert.match(n.tekst, /у Банка России не сверяли/);
  const ok = K.opis({ pasport: PAS, otmetki: [zskOtm()] });
  // п. 180 в редакции Юриста 115-ФЗ 01.10: сервис показывает только высокий риск; «ежедневно» не обещаем
  assert.match(ok.zsk.tekst, /^ЗСК: по сервису Банка России «Проверка по ИНН» на 30\.09\.2026 в 22:20 МСК сведений об отнесении к группе высокого риска нет \(отметка заказчика\)\. Средний и низкий уровни сервис не показывает\./);
  assert.ok(!/ежедневно/.test(ok.zsk.tekst));
  assert.match(ok.zsk.tekst, /в день оплаты проверьте ещё раз/);
  assert.ok(!/Сверка была/.test(ok.zsk.tekst));
  assert.ok(!/жёлт|низк/i.test(ok.zsk.tekst.replace('Средний и низкий уровни сервис не показывает.', '')), 'о жёлтом и низком уровне не утверждаем — публично их не узнать');
  assert.match(ok.stroki[0].primechanie, /ЗСК — сверьте ещё раз в день оплаты/);
  assert.match(K.opis({ otmetki: [zskOtm({ rez: 'est', pril: '1' })] }).zsk.tekst, /есть сведения о высоком уровне риска/);
  assert.match(K.opis({ otmetki: [zskOtm({ dnej: 3 })] }).zsk.tekst, /Сверка была 3 дня назад\./);
  assert.match(K.opis({ otmetki: [zskOtm({ dnej: 21 })] }).zsk.tekst, /21 день назад/);
  assert.match(K.opis({ otmetki: [zskOtm({ dnej: 11 })] }).zsk.tekst, /11 дней назад/);
  // список нелегальных ЦБ — не ЗСК
  const wl = K.opis({ otmetki: [zskOtm({ url: 'https://www.cbr.ru/inside/warning-list/', adres: 'https://www.cbr.ru/inside/warning-list/' })] });
  assert.strictEqual(wl.zsk.est, false);
});

test('v1.1: отметка ЗСК — свой срок свежести (день), не 30 дней', () => {
  const r = { n: 12, id: 'stoplisty', status: 'not_checked', sam: [{ tekst: 'cbr.ru — проверка по ИНН', url: ZSK_URL }] };
  const seg = new Date(2026, 9, 1, 12, 0);
  const s0 = P.otmetka(r, { rez: 'net', data: '01.10.2026', vremya: '10:00' }, seg);
  assert.ok(s0.ok && s0.zsk);
  assert.ok(s0.sovet.indexOf(P.OTM_ZSK) >= 0);
  assert.ok(!/Сверка с Банком России была/.test(s0.sovet));
  const s2 = P.otmetka(r, { rez: 'net', data: '28.09.2026', vremya: '10:00' }, seg);
  assert.match(s2.sovet, /^Сверка с Банком России была 3 дня назад\. /);
  const s40 = P.otmetka(r, { rez: 'net', data: '20.08.2026', vremya: '10:00' }, seg);
  assert.ok(!/Проверке больше 30 дней/.test(s40.sovet), 'для ЗСК — одна подсказка, без дубля');
  const eg = { n: 6, id: 'egrul', status: 'not_checked', sam: [{ tekst: 'egrul.nalog.ru', url: 'https://egrul.nalog.ru/' }] };
  const e = P.otmetka(eg, { rez: 'net', data: '28.09.2026', vremya: '10:00' }, seg);
  assert.ok(!e.zsk && e.sovet.indexOf(P.OTM_ZSK) < 0, 'у ЕГРЮЛ правило ЗСК не срабатывает');
});
