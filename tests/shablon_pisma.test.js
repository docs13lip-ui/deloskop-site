// shablon-pisma-v1 (30.10.2026): «Письмо в банк» на /115-fz/sovpadenie-s-perechnem-chto-delat/ — текст [Право · Юрист 115-ФЗ]
// 30.10 19:05 (✎ 419) и его условия 152-ФЗ: только в браузере, без сервера и хранилищ, в Метрику — без значений полей.
// Запуск: node --test tests/shablon_pisma.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const K = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const P = require('../js/shablon-pisma.js');
const JS = chit('js/shablon-pisma.js').replace(/^\s*\/\/.*$/gm, ''); // без строк-комментариев
const S = chit('115-fz/sovpadenie-s-perechnem-chto-delat/index.html');
const blok = S.slice(S.indexOf('<!--pismo-->'), S.indexOf('<!--/pismo-->'));
const vidno = (h) => h.replace(/&nbsp;/g, ' ').replace(/&#8209;/g, '-').replace(/ /g, ' ').replace(/‑/g, '-')
  .replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// разбор zip (STORE) без сторонних библиотек: имя → текст
function razobrat(u) {
  const b = Buffer.from(u), out = {};
  let i = 0;
  while (b.readUInt32LE(i) === 0x04034b50) {
    const metod = b.readUInt16LE(i + 8), crc = b.readUInt32LE(i + 14), dl = b.readUInt32LE(i + 18), n = b.readUInt16LE(i + 26), e = b.readUInt16LE(i + 28);
    const imya = b.slice(i + 30, i + 30 + n).toString('utf8'), dan = b.slice(i + 30 + n + e, i + 30 + n + e + dl);
    assert.strictEqual(metod, 0, 'STORE');
    assert.strictEqual(crc, zlib.crc32 ? zlib.crc32(dan) : P.crc32(dan), 'crc ' + imya);
    out[imya] = dan.toString('utf8');
    i += 30 + n + e + dl;
  }
  assert.strictEqual(b.readUInt32LE(b.length - 22), 0x06054b50, 'конец zip');
  return out;
}

test('текст [Право] 30.10 — дословно (человек)', () => {
  const t = P.tekst({});
  for (const f of [
    'В [наименование банка]',
    'от [ФИО полностью], дата рождения [дд.мм.гггг], ИНН [ ], телефон [ ], e-mail [ ]',
    'Заявление о сверке данных с перечнем и об основании ограничения операции',
    '[Дата] банк [остановил операцию / не исполнил платёж / ограничил распоряжение средствами] по счёту, оканчивающемуся на [4 цифры], на сумму [ ] ₽.',
    '1. основание ограничения: норму закона и пункт договора банковского счёта;',
    '2. связано ли ограничение с совпадением моих данных с записью перечня организаций и физических лиц, в отношении которых имеются сведения об их причастности к экстремистской деятельности или терроризму.',
    'Я не включён(а) в этот перечень. Мои данные отличаются от данных записи перечня: [что отличается: дата рождения / место рождения / паспорт / ИНН / СНИЛС]. Копии документов прилагаю.',
    'По позиции Росфинмониторинга (письмо от 15.05.2020 № 01-01-40/9140), если хотя бы одно из идентификационных данных клиента не совпадает с данными перечня, клиент не может быть признан включённым в перечень, и меры по замораживанию (блокированию), предусмотренные подп. 6 п. 1 ст. 7 Федерального закона от 07.08.2001 № 115-ФЗ, к нему не применяются.',
    'Прошу сверить мои данные с записью перечня, по результату снять ограничение и письменно сообщить итог [на e-mail / в приложении банка].',
    'Приложения: 1) копия паспорта (страницы с ФИО, датой и местом рождения); 2) [ИНН / СНИЛС]; 3) [иное].',
  ]) assert.ok(t.includes(f), f);
});

test('заполненные поля встают на места; компания — от имени организации', () => {
  const t = P.tekst({ bank: 'АО «Банк»', fio: 'Петров Пётр Петрович', dr: '1980-05-01', inn: '123', data: '2026-10-29', dejstvie: 1,
    schet4: '1234', summa: '480000', otlichiya: ['дата рождения', 'СНИЛС', 'ОГРН'], otvet: 'app' });
  assert.ok(t.includes('от Петров Пётр Петрович, дата рождения 01.05.1980, ИНН 123'));
  assert.ok(t.includes('29.10.2026 банк не исполнил платёж по счёту, оканчивающемуся на 1234, на сумму 480 000 ₽.'));
  assert.ok(t.includes('отличаются от данных записи перечня: дата рождения, СНИЛС.'), 'ОГРН у человека не берём');
  assert.ok(t.includes('итог в приложении банка.'));
  assert.ok(t.includes('2) СНИЛС; 3) [иное]'));
  assert.ok(t.endsWith('[Дата]    [Подпись]    Петров Пётр Петрович'));
  const o = P.tekst({ kto: 'org', naim: 'ООО «Пример»', inn: '7700000000', otlichiya: ['ОГРН'] });
  assert.ok(o.includes('от ООО «Пример», ИНН 7700000000, ОГРН [ ], в лице [должность, ФИО]'));
  assert.ok(o.includes('совпадением данных организации с записью перечня'));
  assert.ok(o.includes('Организация не включена в этот перечень. Данные организации отличаются от данных записи перечня: ОГРН.'));
  assert.ok(o.includes('Приложения: 1) выписка из ЕГРЮЛ с ИНН и ОГРН'));
  assert.ok(!/дата рождения|паспорт/.test(o));
});

test('.docx — настоящий пакет Word: части на месте, crc сходится, текст письма внутри', () => {
  const z = razobrat(P.docx({ fio: 'Иванов & <Ко>' }));
  assert.deepStrictEqual(Object.keys(z).sort(), ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/document.xml', 'word/styles.xml']);
  const d = z['word/document.xml'];
  assert.ok(d.includes('Иванов &amp; &lt;Ко&gt;'), 'экранирование');
  assert.ok(d.includes('<w:b/>') && d.includes('Заявление о сверке данных'));
  assert.ok(z['[Content_Types].xml'].includes('wordprocessingml.document.main+xml'));
  assert.ok(z['word/styles.xml'].includes('Times New Roman'));
  const tekstDoc = [...d.matchAll(/<w:t xml:space="preserve">([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  assert.strictEqual(tekstDoc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), P.tekst({ fio: 'Иванов & <Ко>' }).replace(/\n\n/g, ''));
});

test('на странице: блок после «Что сделать в первый день», образец = текст модуля, строка [Право] под кнопкой', () => {
  assert.ok(blok.length > 0);
  assert.ok(S.indexOf('<!--pismo-->') > S.indexOf('id="pervyj-den"') && S.indexOf('<!--pismo-->') < S.indexOf('id="dokumenty"'));
  const obr = blok.match(/<div class="pismo__obr" data-pismo-obr>([\s\S]*?)<\/div>/)[1];
  assert.strictEqual(vidno(obr), vidno(P.html({})), 'образец без JS = то, что соберёт модуль с пустыми полями');
  assert.ok(vidno(blok).includes('Образец. Исход зависит от банка — мы его не обещаем. Перед отправкой проверьте свои данные.'));
  assert.ok(vidno(blok).includes('Скачать шаблон письма в банк'));
  assert.ok(S.includes('<script src="/js/shablon-pisma.js" defer></script>'));
  assert.ok(/<form class="pismo__f" data-pismo novalidate autocomplete="off">/.test(blok));
  assert.ok(!/action=|method=/.test(blok), 'форма никуда не отправляется');
  for (const m of blok.matchAll(/<input [^>]*>/g)) assert.ok(!/ value="[^"]*\d/.test(m[0]) || /type="(radio|checkbox)"/.test(m[0]), 'поля пустые: ' + m[0]);
});

test('152-ФЗ: ни сети, ни хранилищ; в Метрику — только способ, без значений полей', () => {
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|indexedDB/.test(JS));
  const celi = [...JS.matchAll(/dlkGoal\("([^"]+)",\s*(\{[^}]*\})\)/g)];
  assert.strictEqual(celi.length, 2);
  for (const c of celi) {
    assert.strictEqual(c[1], 'odnofamilec_shablon');
    assert.match(c[2], /^\{ sposob: "(docx|kopiya)" \}$/);
  }
});

test('без обещаний исхода и упоминаний ИИ; лента', () => {
  const v = vidno(blok);
  assert.ok(!/разблокир|гарант|вернём|снимем|точно сним/i.test(v));
  assert.ok(!/искусственн|нейросет|\bИИ\b/.test(v));
  const L = JSON.parse(chit('obnovleniya.json')).obnovleniya;
  assert.ok(L.some((x) => (x.chto_proverit || []).some((c) => c.ssylka === '/115-fz/sovpadenie-s-perechnem-chto-delat/#pismo')));
});
