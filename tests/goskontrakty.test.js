// goskontrakty-v1 [Ночные запуски] 16.11: «Госконтракты» в разделе «подробно» отчёта по ИНН (план отчёта 15.11, п. 5).
// Форма ответа — живой /api/check 16.11 12:10 (крупный банк: 34 193 записи ЕИС как поставщик — 29 550 по 44-ФЗ и 4 643 по 223-ФЗ;
// сумма «по первым 200 из 34 193»; сервер передал 10 последних контрактов; РНП — «не нашли» на 12.10.2026).
// Заказчики и номера ниже вымышленные. node --test tests/goskontrakty.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/sudy-pristavy.js');
const bezNb = (t) => String(t).replace(/ /g, ' ');

function k(i, o) {
  return Object.assign({ nomer: '28601009620260000' + (10 + i), data: '2026-10-' + String(20 + i).padStart(2, '0'), summa: 1000000 * (i + 1),
    zakazchik: i % 2 ? 'АДМИНИСТРАЦИЯ ОБРАЗЦОВОГО ОКРУГА' : 'ДЕПАРТАМЕНТ ФИНАНСОВ', fz: '44',
    ssylka: 'https://zakupki.gov.ru/epz/contract/contractCard/common-info.html?reestrNumber=28601009620260000' + (10 + i) }, o || {});
}
function otvet(o) {
  o = o || {};
  const damia = {
    kontrakty: { nazvanie: 'Госконтракты', istochnik: 'ЕИС: контракты 44-ФЗ и договоры 223-ФЗ (через Checko)', status: 'polucheno', data_svedeniy: '2026-11-12T19:10+03:00',
      sostoyanie: o.kSost || 'found',
      dannye: { vsego: 34193, summa: 13990911750, summa_ohvat: o.ohvat || 'pervye_200_iz_34193', pokazano: 200,
        po_zakonam: { '44': { vsego: 29550 }, '223': { vsego: 4643 } }, poslednie: o.sp || [0, 1, 2, 3, 4, 5, 6].map((i) => k(i)) } },
    rnp: { nazvanie: 'Недобросовестные поставщики (РНП)', istochnik: 'Реестр недобросовестных поставщиков ЕИС (через DaMIA)', status: 'polucheno',
      data_svedeniy: '2026-10-12T11:40+03:00', sostoyanie: o.rnp || 'not_found', dannye: { deystvuyushie: [], vsego: o.rnpN || 0 } }
  };
  if (o.bezK) delete damia.kontrakty;
  return { company: { inn: '7700000001', kind: 'LEGAL', name_short: 'ПАО "ОБРАЗЕЦ"' }, damia };
}
const razdel = (m) => m.razdely.find((x) => x.k === 'kontrakty');

test('третий раздел «Госконтракты» — только когда есть блок; заголовок секции меняется вместе с ним', () => {
  const m = D.sobrat(otvet());
  assert.deepStrictEqual(m.razdely.map((x) => x.zag), ['Суды', 'Приставы', 'Госконтракты']);
  assert.match(D.html(m), /<h3 class="dl__h" id="dl-h">Суды, приставы, госконтракты — подробно<\/h3>/);
  const bez = D.sobrat({ company: { inn: '7700000001' }, damia: { sudy: { nazvanie: 'Арбитражные суды', status: 'polucheno', sostoyanie: 'not_found' } } });
  assert.deepStrictEqual(bez.razdely.map((x) => x.k), ['sudy', 'fssp']);
  assert.match(D.html(bez), /Суды и приставы — подробно/);
});

test('кратко и факты: всего как поставщик, по законам отдельно, последний контракт, РНП с датой; сумму «по первым 200» не показываем', () => {
  const g = razdel(D.sobrat(otvet()));
  assert.strictEqual(bezNb(g.kratko), '34 193 контракта и договора, где компания — поставщик (ЕИС, на 12.11.2026)');
  assert.deepStrictEqual(g.fakty.map((f) => bezNb(f.t + ': ' + f.z)), [
    'По 44-ФЗ (государственные и муниципальные заказчики): 29 550', 'По 223-ФЗ (госкомпании, монополии и другие заказчики по 223-ФЗ): 4 643', 'Последний контракт: 26.10.2026',
    'Реестр недобросовестных поставщиков: записей не нашли по данным на 12.10.2026']);
  assert.ok(!g.fakty.some((f) => f.vnim));
  const vse = razdel(D.sobrat(otvet({ ohvat: 'vse' })));
  assert.ok(vse.fakty.some((f) => bezNb(f.t + ': ' + f.z) === 'Сумма всех: 14 млрд ₽'));
});

test('РНП найден — в кратком и фактом «на что смотреть»; склонения записей', () => {
  const g = razdel(D.sobrat(otvet({ rnp: 'found', rnpN: 2 })));
  assert.strictEqual(bezNb(g.kratko), '34 193 контракта и договора, где компания — поставщик (ЕИС, на 12.11.2026) · есть запись в реестре недобросовестных поставщиков на 12.10.2026');
  const f = g.fakty[g.fakty.length - 1];
  assert.strictEqual(bezNb(f.z), '2 действующие записи на 12.10.2026');
  assert.ok(f.vnim);
  const nol = razdel(D.sobrat(otvet({ kSost: 'not_found', sp: [], rnp: 'found', rnpN: 1 })));
  assert.strictEqual(nol.vid, 'est');
  assert.strictEqual(bezNb(nol.kratko), '0 контрактов и договоров, где компания — поставщик (ЕИС, на 12.11.2026) · есть запись в реестре недобросовестных поставщиков на 12.10.2026');
});

test('список: свежие сверху, на виду 5, «Показать все загруженные», честно «загружены 7 последних из 34 193»; ссылки — только zakupki.gov.ru', () => {
  const sp = [0, 1, 2, 3, 4, 5].map((i) => k(i)).concat([k(6, { ssylka: 'javascript:alert(1)', nomer: '<b>1</b>', zakazchik: null, fz: '223', summa: 0 })]);
  const m = D.sobrat(otvet({ sp })), g = razdel(m), h = D.html(m);
  assert.deepStrictEqual(g.spisok.slice(0, 2).map((x) => x.data), ['26.10.2026', '25.10.2026']);
  assert.strictEqual(bezNb(g.pro), 'Загружены 7 последних из 34 193 — остальные в ЕИС');
  const blok = h.split('data-dl="kontrakty"')[1];
  assert.match(blok, /Показать все загруженные \(7\)/);
  assert.match(blok, /<p class="dl__gh">Последние контракты<\/p>/);
  assert.ok(!/javascript:/.test(h));
  const chuzhaya = D.html(D.sobrat(otvet({ sp: [k(0, { ssylka: 'https://zakupki-gov.example/epz/1' }), k(1, { ssylka: 'https://zakupki.gov.ru.example/x' })] })));
  assert.ok(!/example/.test(chuzhaya), 'ссылки только на zakupki.gov.ru');
  assert.match(blok, /&lt;b&gt;1&lt;\/b&gt;/);
  assert.ok(!/Заказчик не указан|неизвестен/.test(bezNb(blok)), 'без заказчика — строку пропускаем ([Право] № 53)');
  assert.match(blok, /<span class="dl__sum">без суммы<\/span><\/div><div class="dl__s2">223-ФЗ<\/div>/);
  assert.match(blok, /href="https:\/\/zakupki\.gov\.ru\/epz\/contract\/contractCard\/common-info\.html\?reestrNumber=2860100962026000010" target="_blank" rel="noopener nofollow"/);
  assert.match(blok, /href="https:\/\/zakupki\.gov\.ru\/epz\/contract\/search\/results\.html\?searchString=7700000001"[^>]*>открыть ЕИС/);
});

test('заказчики — по загруженным, с подписью «по N последним»; один заказчик — без группы', () => {
  const g = razdel(D.sobrat(otvet()));
  assert.strictEqual(bezNb(g.gruppyZag), 'Заказчики — по 7 последним');
  assert.deepStrictEqual(g.gruppy.map((x) => x.t + ' ' + x.n), ['ДЕПАРТАМЕНТ ФИНАНСОВ 4', 'АДМИНИСТРАЦИЯ ОБРАЗЦОВОГО ОКРУГА 3']);
  assert.match(bezNb(D.html(D.sobrat(otvet()))), /<p class="dl__gh">Заказчики — по 7 последним<\/p>/);
  const bezNazv = razdel(D.sobrat(otvet({ sp: [k(0), k(1), k(2), k(3, { zakazchik: null }), k(5, { zakazchik: '' }), k(7, { zakazchik: null })] })));
  assert.deepStrictEqual(bezNazv.gruppy.map((x) => x.t + ' ' + x.n), ['ДЕПАРТАМЕНТ ФИНАНСОВ 2', 'АДМИНИСТРАЦИЯ ОБРАЗЦОВОГО ОКРУГА 1'], 'без названия — не группа');
  const raz = razdel(D.sobrat(otvet({ sp: [k(0), k(1), k(3, { zakazchik: 'ТРЕТИЙ ЗАКАЗЧИК' })] })));
  assert.deepStrictEqual(raz.gruppy, [], 'все разовые — группы нет');
  const odin = razdel(D.sobrat(otvet({ sp: [k(0), k(2), k(4), k(1)] })));
  assert.deepStrictEqual(odin.gruppy.map((x) => x.t + ' ' + x.n), ['ДЕПАРТАМЕНТ ФИНАНСОВ 3', 'АДМИНИСТРАЦИЯ ОБРАЗЦОВОГО ОКРУГА 1']);
  const mnogo = razdel(D.sobrat(otvet({ sp: [k(0), k(2), 'А', 'Б', 'В', 'Г'].map((x, i) => typeof x === 'string' ? k(i, { zakazchik: x }) : x) })));
  assert.strictEqual(mnogo.gruppy.length, 3, 'не больше трёх');
  // у судов и приставов подпись групп прежняя
  assert.match(D.html(D.sobrat(otvet())), /<p class="dl__gh">Что взыскивают<\/p>|data-dl="fssp"/);
});

test('РНП устарел или источник не обновляется — так и пишем, без «нет записей»', () => {
  const r = otvet(); r.damia.rnp = Object.assign(r.damia.rnp, { status: 'stale', sostoyanie: 'stale', status_do: 'not_found' });
  const z = (m) => bezNb(razdel(m).fakty.find((f) => /недобросовестных/.test(f.t)).z);
  assert.strictEqual(z(D.sobrat(r)), 'записей не нашли по данным на 12.10.2026. Сведения не обновлялись больше месяца');
  assert.match(D.html(D.sobrat(r)), /не обновлялись больше месяца — <a href="https:\/\/zakupki\.gov\.ru\/epz\/dishonestsupplier\/search\/results\.html\?searchString=7700000001" target="_blank" rel="noopener nofollow">проверьте в ЕИС →<\/a>/);
  const r2 = otvet(); r2.damia.rnp = { nazvanie: 'Недобросовестные поставщики (РНП)', status: 'not_checked', sostoyanie: 'not_checked', prichina: 'источник сейчас не обновляется' };
  assert.strictEqual(z(D.sobrat(r2)), 'не проверено: источник сейчас не обновляется');
});

test('пусто, сбой, нет блока: факт с датой, «Не проверили», чего не проверяли; слов-оценок нет', () => {
  const p = razdel(D.sobrat(otvet({ kSost: 'not_found', sp: [] })));
  assert.strictEqual(p.vid, 'pusto');
  assert.strictEqual(bezNb(p.tekst), 'Не нашли контрактов, где компания — поставщик, на 12.11.2026; в РНП записей не нашли по данным на 12.10.2026.');
  const n = razdel(D.sobrat(otvet({ kSost: 'not_checked' })));
  assert.strictEqual(n.vid, 'ne');
  assert.match(n.tekst, /^Не проверили/);
  const bk = razdel(D.sobrat(otvet({ bezK: true })));
  assert.strictEqual(bk.vid, 'ne');
  const g = razdel(D.sobrat(otvet()));
  assert.strictEqual(bezNb(g.ne), 'Не проверяли: закупки, где компания — заказчик, и как исполнены контракты (расторжения, неустойки) — не проверяли не значит «нет».');
  assert.ok(!/чисто|надёжн|ненадёжн|благонад/i.test(D.html(D.sobrat(otvet()))));
});

test('сторож [Право] № 53: при части списка нет «всего на сумму»; «нет в РНП» без даты набора не пишем; слова «как поставщик» и «записей не было» ушли', () => {
  const chast = D.html(D.sobrat(otvet()));
  assert.ok(!/всего на сумму|Сумма всех/i.test(bezNb(chast)), 'часть списка — без суммы «всего»');
  const r = otvet(); delete r.damia.rnp.data_svedeniy;
  const f = razdel(D.sobrat(r)).fakty.find((x) => /недобросовестных/.test(x.t));
  assert.strictEqual(bezNb(f.z), 'записей не нашли');
  const vse = [D.html(D.sobrat(otvet())), D.html(D.sobrat(otvet({ rnp: 'found', rnpN: 1 }))), D.html(D.sobrat(r))].map(bezNb).join(' ');
  assert.ok(!/нет в РНП|в РНП записей нет|нет действующих записей|записей не было|как поставщик|госзаказчики\)/.test(vse), vse.slice(0, 200));
});
