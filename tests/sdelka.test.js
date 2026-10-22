// dosje-sdelki-v1 — «Досье сделки» (задача владельца 22.10.2026). Сторожа критериев приёмки:
// один связанный сценарий; неизвестное ≠ «в порядке»; нет необоснованного «можно платить»; PDF — с датой и источниками;
// телефон (поля 16 px, кнопки 44 px, без вбок); реквизиты и сохранение — только в браузере.
// node --test tests/sdelka.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
global.self = global;
const KOREN = path.join(__dirname, '..');
const U = require('../js/usloviya.js'); global.Usloviya = U;
const S = require('../js/sdelka.js');
const P = require('../js/pasport-kontragenta.js');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

const INN = '7707049388';
function otvet(o) {
  return Object.assign({
    checked_at: new Date(Date.now() - 3600e3).toISOString(), report_id: 'R0xQzpOGTyjt', risk_level: 'low', verdict: 'Серьёзных признаков риска не найдено',
    company: { inn: INN, name_short: 'ПАО «Тест»', status: 'ACTIVE', reg_date: '2002-01-01', kind: 'LEGAL', okved: '61.10' },
    signals: [{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', as_of: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10) }],
    damia: {
      sudy: { nazvanie: 'Арбитражные суды', status: 'ne_provereno', sostoyanie: 'not_checked', prichina: 'источник недоступен' },
      bankrotstvo: { nazvanie: 'Банкротство', status: 'not_found', sostoyanie: 'not_found', data_svedeniy: '2026-10-22', istochnik: 'ЕГРЮЛ ФНС' },
      fssp: { nazvanie: 'Исполнительные производства', status: 'ne_provereno', sostoyanie: 'not_checked' },
      priostanovki: { nazvanie: 'Счета', status: 'ne_provereno', sostoyanie: 'not_checked' }
    }
  }, o || {});
}
// «всё проверено»: выручка есть, источники ответили not_found — чтобы проверить, что закрытое досье всё равно не «можно платить»
function vseProvereno() {
  const d = new Date().toISOString().slice(0, 10);
  return otvet({ dossier: { kpi: [{ label: 'Выручка за 2025', value: 520000000 }] },
    damia: { sudy: { status: 'not_found', data_svedeniy: d, istochnik: 'КАД' }, bankrotstvo: { status: 'not_found', data_svedeniy: d, istochnik: 'ЕГРЮЛ ФНС' },
      fssp: { status: 'not_found', data_svedeniy: d, istochnik: 'ФССП' }, priostanovki: { status: 'not_found', data_svedeniy: d, istochnik: 'ФНС' },
      mery: { status: 'not_found', data_svedeniy: d }, rnp: { status: 'not_found', data_svedeniy: d }, kontrakty: { status: 'not_found', data_svedeniy: d } } });
}
function sobrat(r, summa, extra) {
  const v = U.decide(r, { amount: summa });
  const p = P.sobrat(r, { usloviya: U, summa: summa });
  const o = Object.assign({ r: r, v: v, p: p, summa: summa, rekv: { vvedeny: false, stroki: [] }, otm: {}, galki: { docs: {} } }, extra || {});
  o.nedostaet = S.nedostaet(o); o.problemy = S.problemy(o);
  return { o: o, v: v, p: p, it: S.itog(o) };
}
const NELZYA = /можно платить|(?<!не )платите вперёд|(?<!не )оплачивайте|предоплата допустима|обычные условия подойдут|безопасн/i;

test('неизвестное ≠ «в порядке»: суды и приставы не проверены, нет выручки — открытые пункты, итог «по факту», 0 % предоплаты', () => {
  const x = sobrat(otvet(), 1500000);
  const k = x.o.nedostaet.map((n) => n.k);
  assert.ok(k.includes('r_sudy'), 'суды не проверены — пункт: ' + k);
  assert.ok(k.includes('r_pristavy'), 'приставы — пункт');
  assert.ok(k.includes('vyruchka'), 'выручки нет — пункт');
  assert.ok(k.includes('rekv'), 'реквизиты не сверены — пункт');
  assert.ok(k.includes('dogovor'), 'договор — пункт');
  assert.strictEqual(x.it.kod, 'predv');
  assert.strictEqual(x.it.predoplata, 0);
  assert.match(x.it.tekst, /оплата по факту поставки/);
  assert.match(S.delopisSsylka(INN, x.it), /predoplata=0$/);
});

test('без суммы — пункт «Сумма сделки не указана»', () => {
  const x = sobrat(otvet(), null);
  assert.ok(x.o.nedostaet.some((n) => n.k === 'summa'));
});

test('Паспорт: банкротство «нет» по ЕГРЮЛ не закрывает раздел 8, если картотеку судов не проверяли', () => {
  const p = P.sobrat(otvet(), { usloviya: U });
  const s = p.razdely.find((x) => x.id === 'sudy');
  assert.strictEqual(s.status, 'not_checked');
  assert.match(s.prichina, /^Не проверяли арбитражные суды/);
  assert.ok(s.fakty.some((f) => f.istochnik === 'ЕГРЮЛ ФНС' && f.data === '2026-10-22'), 'факт о банкротстве по ЕГРЮЛ (с источником и датой) остаётся');
});

test('«Условия сделки»: без выручки и проверок — «Предварительно», совет по сумме не разрешает платить вперёд', () => {
  const v = U.decide(otvet(), { amount: 1500000 });
  assert.match(v.headline, /^Предварительно/);
  assert.ok(v.predvaritelno && v.predvaritelno.baza === 'age');
  assert.doesNotMatch(v.prepay, /допустима|подойдут/);
  assert.match(v.prepay, /платите по факту поставки/);
  assert.match(v.kak.ne, /Не проверено — не значит «в порядке»/);
});

test('реквизиты: чужой ИНН, личный счёт, счёт ИП у организации — проблема и «Не платите вперёд»', () => {
  const r = otvet();
  for (const t of ['ИНН 7736050003, р/с 40702810938000012345, БИК 044525225', 'ИНН ' + INN + ', р/с 40817810938000012345, БИК 044525225', 'ИНН ' + INN + ', р/с 40802810938000012345, БИК 044525225']) {
    const rk = S.rekvizity(t, r);
    assert.ok(rk.oshibka, t);
    const x = sobrat(r, 1500000, { rekv: rk });
    assert.strictEqual(x.it.kod, 'stop', t);
    assert.strictEqual(x.it.zagolovok, 'Не платите вперёд');
    assert.strictEqual(x.it.predoplata, 0);
  }
});

test('реквизиты: в счёте два ИНН — находим ИНН проверенной компании; принадлежность счёта всегда «не подтверждено»', () => {
  const rk = S.rekvizity('Покупатель ИНН 7736050003. Поставщик ПАО «Тест» ИНН 7707 049 388 р/с 40702810938000012345 БИК 044525225', otvet());
  assert.ok(!rk.oshibka, JSON.stringify(rk.stroki.map((x) => x.cls + x.nazv)));
  assert.strictEqual(rk.stroki[0].verdikt, 'Совпадает');
  assert.ok(rk.stroki.some((x) => x.cls === 'is-none' && /принадлежит/.test(x.nazv)));
  const x = sobrat(otvet(), 1500000, { rekv: rk });
  assert.ok(x.o.nedostaet.some((n) => n.k === 'rekv_dogovor') && x.o.nedostaet.some((n) => n.k === 'rekv_tel'), 'сверка и звонок — открытые пункты');
});

test('нет необоснованного разрешения платить: ни в одном итоге, даже когда все пункты закрыты', () => {
  const r = vseProvereno();
  const rk = S.rekvizity('ИНН ' + INN + ', р/с 40702810938000012345, БИК 044525225', r);
  const v = U.decide(r, { amount: 1500000 });
  const docs = {}; v.docs.forEach((d) => { docs[d.id] = true; });
  const p = P.sobrat(r, { usloviya: U, summa: 1500000 });
  const otm = {};
  p.razdely.filter((x) => S.KLYUCH.includes(x.id) && x.status === 'not_checked').forEach((x) => { otm[x.n] = { ok: true, rez: 'net', razdel: x.n }; });
  const x = sobrat(r, 1500000, { rekv: rk, otm: otm, galki: { svereny: true, telefon: true, dogovor: true, docs: docs } });
  assert.deepStrictEqual(x.o.nedostaet.map((n) => n.k), [], 'всё закрыто');
  assert.strictEqual(x.it.kod, 'sobrano');
  assert.match(x.it.tekst, /Решение принимает ваша компания\.$/);
  assert.ok(x.it.predoplata > 0 && x.it.predoplata <= 100);
  // все варианты итога — без «можно платить»
  const varianty = [x.it, sobrat(otvet(), 1500000).it, sobrat(otvet({ risk_level: 'high', signals: [{ title: 'Недостоверные сведения в ЕГРЮЛ', status: 'bad', detail: 'Адрес' }] }), 1500000).it,
    sobrat(otvet({ company: Object.assign({}, otvet().company, { status: 'LIQUIDATED' }) }), 1500000).it];
  varianty.forEach((it) => assert.doesNotMatch(it.zagolovok + ' ' + it.tekst, NELZYA, it.zagolovok + ' ' + it.tekst));
});

test('отметка заказчика «есть сведения» — проблема, «не удалось» — пункт остаётся открытым', () => {
  const r = otvet(), p = P.sobrat(r, { usloviya: U, summa: 1500000 });
  const sudy = p.razdely.find((x) => x.id === 'sudy');
  let x = sobrat(r, 1500000, { otm: { [sudy.n]: { ok: true, rez: 'est', razdel: sudy.n, sovet: 'Запросите объяснение' } } });
  assert.strictEqual(x.it.kod, 'stop');
  assert.ok(!x.o.nedostaet.some((n) => n.k === 'r_sudy'));
  x = sobrat(r, 1500000, { otm: { [sudy.n]: { ok: true, rez: 'ne_udalos', razdel: sudy.n } } });
  assert.ok(x.o.nedostaet.some((n) => n.k === 'r_sudy' && /не удалось/.test(n.kak)));
});

test('сохранение: только по вызову, в хранилище браузера; повторная проверка сравнивает со снимком', () => {
  const mem = {}; const ls = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const x = sobrat(otvet(), 1500000);
  const sn = S.snimok(otvet(), x.v, x.it);
  assert.ok(S.sohranit(ls, { inn: INN, nazvanie: 'ПАО «Тест»', id: 'R0xQzpOGTyjt', summa: 1500000, rekv: { inn: INN, bik: '044525225', acc: '40702810938000012345' }, galki: { svereny: true }, otm: [], snimok: sn }));
  const z = S.najti(ls, INN);
  assert.strictEqual(z.summa, 1500000);
  assert.strictEqual(z.galki.svereny, true);
  assert.strictEqual(S.spisok(ls).length, 1);
  const r2 = otvet({ report_id: 'Novyj000001', risk_level: 'medium', signals: otvet().signals.concat([{ title: 'Руководитель сменился недавно', status: 'warn', detail: 'Внимание' }]) });
  const v2 = U.decide(r2, { amount: 1500000 });
  const izm = S.sravnit(z.snimok, S.snimok(r2, v2, null), U);
  assert.ok(izm.some((t) => /Итог проверки: было «без серьёзных сигналов», стало «есть вопросы»/.test(t)), izm.join(' | '));
  assert.ok(izm.some((t) => /Новые замечания: Руководитель сменился недавно/.test(t)));
  assert.strictEqual(S.sravnit(z.snimok, z.snimok).length, 0);
  assert.ok(S.svezhest(new Date(Date.now() - 40 * 864e5).toISOString()).staroe);
  S.udalit(ls, INN);
  assert.strictEqual(S.najti(ls, INN), null);
  // хранилище недоступно — без исключения
  assert.strictEqual(S.sohranit({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }, { inn: INN }), false);
});

test('разметка: дата досье и сведений, источники разделов, экранирование текста счёта, отметки — подписаны как отметки заказчика', () => {
  const r = otvet(), x = sobrat(r, 1500000);
  const rk = S.rekvizity('<img src=x onerror=alert(1)> ИНН ' + INN + ' р/с 40702810938000012345 БИК 044525225', r);
  const h = S.html({ nazvanie: '<b>ООО</b>', inn: INN, summa: 1500000, svedeniyaNa: '22.10.2026 в 20:09 МСК', sobrano: '22.10.2026 в 20:33 МСК', it: x.it, ned: x.o.nedostaet, pr: [],
    rekv: rk, rekvTekst: '<img src=x onerror=alert(1)>', galki: {}, docs: x.v.docs, fakty: [{ n: 1, title: 'Реквизиты и статус', tekst: 'сведения на 22.10.2026 · ЕГРЮЛ', mark: 'm-ist' }], delopis: S.delopisSsylka(INN, x.it) });
  assert.ok(!/<img/.test(h) && !/<b>ООО/.test(h), 'текст счёта и названия — только экранированным');
  assert.match(h, /Сведения на 22\.10\.2026 в 20:09 МСК/);
  assert.match(h, /собрано 22\.10\.2026 в 20:33 МСК/);
  assert.match(h, /сведения на 22\.10\.2026 · ЕГРЮЛ/);
  assert.match(h, /из ЕГРЮЛ — наш расчёт/);
  assert.ok(h.includes(S.OGOVORKA_OTM));
  assert.match(h, /\/delopis\/\?kontragent=7707049388&amp;predoplata=0/);
  ['Контрагент и сумма', 'Факты, источники и даты', 'Реквизиты для оплаты', 'Чего не хватает', 'Договор и документы', 'Сохранение и повторная проверка'].forEach((t) => assert.ok(h.includes('<h4>' + t), t));
  assert.match(h, /aria-label="Готово \d из 6 шагов досье"/, 'кольцо готовности подписано для экранного диктора');
});

test('один сценарий: отчёт, PDF-досье и «Проверь счёт» ведут в досье по номеру проверки, сумма — с собой; Делопись подхватывает ИНН и долю', () => {
  const O = require('../js/otchet.js');
  const a = O.dejstviya({ company: { inn: INN }, report_id: 'R0xQzpOGTyjt' });
  assert.deepStrictEqual(a[1], { t: 'Досье сделки', href: '/pasport/kontragent/?id=R0xQzpOGTyjt#sd', cel: 'otchet_pasport' });
  assert.match(chitat('js/otchet.js'), /summaVSsylku\(pa, report\)/);
  const PC = require('../js/pasport-cta.js');
  const s = PC.sostoyanie({ beta: true, inn: INN, reportId: 'R0xQzpOGTyjt' });
  assert.strictEqual(s.href, '/pasport/kontragent/?id=R0xQzpOGTyjt#sd');
  assert.strictEqual(s.knopka, 'Досье сделки');
  const rep = chitat('report.html');
  assert.ok(rep.includes('>Досье сделки</a>') && rep.includes("'&summa='+Math.round(v)"));
  const ps = chitat('proverit-schet/index.html');
  assert.ok(ps.includes('Собрать досье сделки') && ps.includes("sessionStorage.setItem('dlk_sdelka_vhod'"));
  assert.ok(!/dlk_sdelka_vhod[^\n]*location\.(href|search)/.test(ps), 'реквизиты — не через адресную строку');
  const dp = chitat('delopis/index.html');
  assert.ok(dp.includes("q.get('kontragent')") && dp.includes("q.get('predoplata')"));
  const pk = chitat('pasport/kontragent/index.html');
  ['/js/smena.js', '/js/acc.js', '/js/sdelka.js'].forEach((f) => assert.ok(pk.includes('<script src="' + f + '"></script>'), f));
  assert.ok(pk.indexOf('/js/sdelka.js') < pk.indexOf('var SDK=window.Sdelka'), 'модуль — до кода страницы');
  assert.match(pk, /id="rs-w"/, '«Платить» при незакрытом досье — предупреждение');
});

test('телефон и печать: поля 17 px, кнопки 44 px, плитки в две колонки, обложка печатается светлой, без холста', () => {
  const pk = chitat('pasport/kontragent/index.html');
  assert.match(pk, /\.sd-f input\[type=text\],\.sd-f textarea\{[^}]*font-size:17px/);
  const mob = pk.slice(pk.indexOf('@media (max-width:640px){\n  .sd-cover'));
  assert.match(mob, /\.sd-btns \.btn,\.sd-f \.btn\{min-height:44px/);
  assert.match(mob, /\.sd-tiles\{grid-template-columns:1fr 1fr/);
  const pe = pk.slice(pk.indexOf('@media print{\n  .sd{break-before:page}'));
  assert.match(pe, /\.sd-cover\{margin:0;padding:14px 0 12px;background:none/);
  assert.match(pe, /\.sd-cover__fon,\.sd-orbit\{display:none!important\}/);
  assert.match(pe, /\.sd-g input\{display:none\}/);
  assert.match(pk, /prefers-reduced-motion:no-preference/, 'движение — только если человек не просил его убрать');
});

test('обложка одинакова в светлой и тёмной теме: цвета обложки — hsl, тёмный слой их не перекрашивает', () => {
  const pk = chitat('pasport/kontragent/index.html');
  assert.ok(!/\[data-theme=dark\] \.sd-(cover|ring|puls|chips)/.test(pk), 'тёмный слой не трогает обложку');
});

test('реальность контрагента: налоги, долги, штат, достоверность — первыми; у каждого признака источник и дата или «не проверяли»', () => {
  const I = require('../js/istochniki.js'); global.Sushchestvennoe = require('../js/sushchestvennoe.js');
  const r = otvet({ signals: otvet().signals.concat([{ id: 'employees', title: 'Сотрудники', status: 'ok', detail: '17 чел.', source: 'ФНС, открытые данные', as_of: '2025-12-31' }]),
    dossier: { sections: [{ id: 'finance', rows: [['Уплачено налогов и взносов', '4,1 млн ₽'], ['Данные на', '31.12.2025']] }] } });
  I.dopolnit(r);
  const R = S.realnost(r);
  assert.deepStrictEqual(R.plitki.slice(0, 4).map((t) => t.k), ['nalogi', 'dolgi', 'shtat', 'dostovernost']);
  R.plitki.forEach((t) => { if (t.ton !== 'off') assert.ok(t.ist && t.data, t.k + ': источник и дата'); else assert.match(t.znach, /^Не проверяли/, t.k); });
  const nal = R.plitki.find((t) => t.k === 'nalogi');
  assert.match(nal.znach, /^Нет в списке ФНС на/);
  assert.match(nal.pod, /Уплачено налогов и взносов за год: 4,1 млн ₽/);
  const dl = R.plitki.find((t) => t.k === 'dolgi');
  assert.strictEqual(dl.ton, 'off', 'приставы и суды не ответили — «не проверяли», не «норма»');
  assert.strictEqual(R.plitki.find((t) => t.k === 'shtat').znach, '17 чел.');
  const h = S.html({ realnost: R, it: { kod: 'predv', zagolovok: 'Досье не закрыто', tekst: '' } });
  assert.match(h, /Реальность контрагента/);
  assert.ok(h.indexOf('sd-puls') < h.indexOf('sd-real'), 'главные признаки — на обложке, до всего остального');
});

test('связи и группа компаний: управляющая компания, учредитель-юрлицо, доля > 25 % — факты ЕГРЮЛ, без квалификаций', () => {
  const r = otvet({ dossier: { sections: [{ id: 'management', rows: [['Руководитель', 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ УПРАВЛЯЮЩАЯ КОМПАНИЯ "ЛУЧ"'], ['Руководит с', '28.07.2025'],
    ['Учредитель', 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ЛУЧ-ГРУПП" — 40 %'], ['Учредитель', 'Иванова Анна Петровна — 60 %'], ['Уставный капитал', '10 000 ₽']] },
    { id: 'profile', rows: [['Юридический адрес', '630055, г Новосибирск, ул Гнесиных, д 10/1, помещ 405']] }] } });
  const V = S.svyazi(r);
  const uk = V.uzly.find((u) => u.k === 'rukovoditel');
  assert.ok(uk.yur && uk.imya === 'ООО УК «ЛУЧ»', JSON.stringify(uk));
  assert.ok(V.uzly.some((u) => u.k === 'uchreditel' && u.yur && u.dolya === 40));
  const t = V.flagi.map((f) => f.t).join(' | ');
  assert.match(t, /управляющая компания/);
  assert.match(t, /учредител\S* с долей больше 25/);
  assert.match(t, /Среди учредителей — юрлицо/);
  assert.ok(!/аффилир|подконтрол|номинальн/i.test(JSON.stringify(V)), 'без квалификаций');
  assert.match(V.ne, /неполную картину за полную не выдаём/);
  // найденные по названию юрлица по одному адресу — флаг группы; адрес контрагента совпал — флаг «тот же адрес»
  assert.ok(S.obshchijAdres('г Новосибирск, ул Николаева, д 12/3, помещ 103', '630090, Новосибирская обл, г Новосибирск, ул Николаева, д 12/3, помещ 1'));
  assert.ok(!S.obshchijAdres('г Новосибирск, ул Николаева, д 12/3', 'г Новосибирск, ул Гнесиных, д 10/1'));
  const dop = S.svyaziDop(V, { 0: { inn: '5446018460', adres: 'г Новосибирск, ул Николаева, д 12/3, помещ 103' }, 1: { inn: '5446019209', adres: 'г Новосибирск, ул Николаева, д 12/3, помещ 1', obshchij: true } });
  assert.ok(dop.some((f) => /по одному адресу/.test(f.t)) && dop.some((f) => /тот же адрес|тому же адресу/.test(f.t)));
  assert.strictEqual(S.kratkoGraf({ imya: 'Иванова Анна Петровна' }), 'Иванова А. П.');
  const h = S.html({ svyazi: V, it: {} });
  assert.match(h, /data-sd-najti="0"/, 'юрлицо — кнопка «Найти ИНН»');
  assert.match(h, /pb\.nalog\.ru/);
});
