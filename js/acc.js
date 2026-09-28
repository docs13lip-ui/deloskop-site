/* «Проверь счёт» — блок «Проверка реквизитов» (.acc), Очередь п. 82; аудит 27.09, п. Б.
 *
 * Идея (Арт-директор, claude/Арт-директор_приёмка_site-v9_tri_acc_28.09.md §4): принадлежность счёта
 * поставщику — отдельная строка со статусом «Не подтверждено», всегда, а не оговорка внизу.
 * Каждая строка говорит, КТО это подтвердил:
 *   ● is-fact  — подтверждено источником (справочник БИК Банка России, сервис ФНС) с датой;
 *   ◆ is-calc  — рассчитано нами (контрольный ключ счёта);
 *   ○ is-none  — не проверяли / проверить нельзя («не проверяли» ≠ «нет»);
 *   ■ is-bad   — ошибка в реквизитах (единственный случай красного цвета);
 *   ▲ is-high  — найдены решения ФНС о приостановке.
 * Справочника БИК на сервере пока нет — банк честно «Не сверяли», пока API не пришлёт bank.ok.
 * Только textContent и createElement — никакой вставки HTML из текста счёта или ответа сервера.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkAcc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var NB = ' ';

  function dmy(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(iso);
  }

  function key23(s) { var w = [7, 1, 3], x = 0; for (var i = 0; i < s.length; i++) x += (+s[i]) * w[i % 3]; return x % 10 === 0; }
  function klyuchSchyota(bik, acc) { return /^\d{9}$/.test(bik || '') && /^\d{20}$/.test(acc || '') ? key23(bik.slice(-3) + acc) : null; }

  /* d = {bik, acc, bankNazvanie?, bank?:{ok, name, bik, as_of}, priostanovki?:{status, as_of, text}}
   * bank и priostanovki — только из ответа сервера; без них строки честно «не сверяли» / нет строки. */
  function stroki(d) {
    d = d || {};
    var out = [];
    var bik = d.bik || null, acc = d.acc || null;
    var bik9 = /^\d{9}$/.test(bik || '');
    var bikFormat = bik9 && bik.indexOf('04') === 0;

    // 1. Банк
    if (d.bank && d.bank.ok === true) {
      out.push({ cls: 'is-fact', nazv: 'Банк существует, лицензия действует', verdikt: 'Подтверждено',
        meta: (d.bank.name || d.bankNazvanie || 'Банк') + ', БИК ' + (d.bank.bik || bik) +
          ' · справочник БИК Банка России' + (d.bank.as_of ? ' на' + NB + dmy(d.bank.as_of) : '') });
    } else if (d.bank && d.bank.ok === false) {
      out.push({ cls: 'is-bad', nazv: 'Банк по' + NB + 'этому БИК', verdikt: 'Не' + NB + 'найден',
        meta: 'В справочнике БИК Банка России такого банка нет или его лицензия отозвана. Платить по' + NB + 'этим реквизитам нельзя, пока поставщик их не' + NB + 'исправит.' });
    } else if (!bik) {
      out.push({ cls: 'is-none', nazv: 'БИК банка', verdikt: 'Не' + NB + 'нашли',
        meta: 'В тексте счёта нет 9-значного БИК. Сверьте реквизиты банка с' + NB + 'договором.' });
    } else if (!bikFormat) {
      out.push({ cls: 'is-bad', nazv: 'БИК банка', verdikt: 'С' + NB + 'ошибкой',
        meta: 'БИК ' + bik + ' не' + NB + 'похож на' + NB + 'российский: он всегда начинается с' + NB + '«04». Попросите поставщика прислать реквизиты заново.' });
    } else {
      out.push({ cls: 'is-none', nazv: 'Банк по' + NB + 'БИК ' + bik, verdikt: 'Не' + NB + 'сверяли',
        meta: (d.bankNazvanie ? 'В счёте: ' + d.bankNazvanie + '. ' : '') +
          'Со справочником БИК Банка России этот банк сегодня не' + NB + 'сверяли' + NB + '— это не' + NB + 'значит, что с' + NB + 'ним что-то не' + NB + 'так.' });
    }

    // 2. Номер счёта — контрольный ключ (наш расчёт)
    var k = klyuchSchyota(bik, acc);
    if (!acc) {
      out.push({ cls: 'is-none', nazv: 'Номер счёта', verdikt: 'Не' + NB + 'нашли',
        meta: 'В тексте нет 20-значного номера расчётного счёта.' });
    } else if (k === null) {
      out.push({ cls: 'is-none', nazv: 'Номер счёта', verdikt: 'Не' + NB + 'проверили',
        meta: 'Без верного БИК контрольный ключ счёта не' + NB + 'посчитать.' });
    } else if (k) {
      out.push({ cls: 'is-calc', nazv: 'Номер счёта написан без ошибок', verdikt: 'Верно',
        meta: 'Контрольный ключ сошёлся' + NB + '— наш расчёт. Это значит, что в' + NB + 'номере нет опечатки, но' + NB + 'не' + NB + 'значит, что счёт принадлежит поставщику.' });
    } else {
      out.push({ cls: 'is-bad', nazv: 'Номер счёта', verdikt: 'С' + NB + 'ошибкой',
        meta: 'Контрольный ключ не' + NB + 'сошёлся' + NB + '— в' + NB + 'номере опечатка или счёт не' + NB + 'из' + NB + 'этого банка. Попросите поставщика прислать реквизиты заново.' });
    }

    // 3. Приостановки ФНС — только если сервер прислал (DaMIA, п. 99)
    var p = d.priostanovki;
    if (p && p.status === 'found') {
      out.push({ cls: 'is-high', nazv: 'Решения ФНС о' + NB + 'приостановке операций по' + NB + 'счетам', verdikt: 'Найдены',
        meta: (p.text || 'Банк не' + NB + 'проведёт расходные операции поставщика; поступления на' + NB + 'счёт идут.') +
          ' Сервис ФНС' + (p.as_of ? ' на' + NB + dmy(p.as_of) : '') + '.' });
    } else if (p && p.status === 'not_found') {
      out.push({ cls: 'is-fact', nazv: 'Решения ФНС о' + NB + 'приостановке операций по' + NB + 'счетам', verdikt: 'Не' + NB + 'найдены',
        meta: 'Сервис ФНС' + (p.as_of ? ' на' + NB + dmy(p.as_of) : '') + '.' });
    } else if (p) {
      out.push({ cls: 'is-none', nazv: 'Решения ФНС о' + NB + 'приостановке', verdikt: 'Не' + NB + 'проверяли',
        meta: 'Сегодня не' + NB + 'проверили' + NB + '— это не' + NB + 'значит, что решений нет. Проверить самим: service.nalog.ru/bi.do' });
    }

    // 4. Принадлежность — всегда отдельной строкой
    out.push({ cls: 'is-none', nazv: 'Счёт принадлежит поставщику', verdikt: 'Не' + NB + 'подтверждено',
      meta: 'Этого не' + NB + 'видит никто, кроме банка. Сверьте реквизиты со' + NB + 'счётом и' + NB + 'договором, а' + NB + 'если реквизиты пришли письмом и' + NB + 'недавно поменялись' + NB + '— позвоните поставщику по' + NB + 'телефону из' + NB + 'договора.' });
    return out;
  }

  function zagolovok(s) {
    var bad = s.some(function (x) { return x.cls === 'is-bad'; });
    if (bad) return 'В реквизитах ошибка. Сверьте их со' + NB + 'счётом поставщика';
    var kl = s.some(function (x) { return x.cls === 'is-calc'; });
    if (kl) return 'Номер счёта без опечаток. Чей это счёт' + NB + '— подтвердить может только банк';
    return 'Что удалось проверить в' + NB + 'реквизитах';
  }

  function render(doc, host, d) {
    var s = stroki(d);
    function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    var sec = el('section', 'acc-box'); sec.setAttribute('aria-labelledby', 'acc-t');
    sec.appendChild(el('p', 'acc-box__eyebrow', 'Проверка реквизитов'));
    var h = el('h2', 'acc-box__t', zagolovok(s)); h.id = 'acc-t'; sec.appendChild(h);
    var ul = el('ul', 'acc');
    s.forEach(function (x) {
      var li = el('li', x.cls);
      var i = el('span', 'acc__i'); i.setAttribute('aria-hidden', 'true');
      li.appendChild(i); li.appendChild(el('p', 'acc__n', x.nazv)); li.appendChild(el('span', 'acc__v', x.verdikt));
      li.appendChild(el('p', 'acc__m', x.meta));
      ul.appendChild(li);
    });
    sec.appendChild(ul);
    var leg = el('p', 'acc-box__leg');
    [['is-fact', 'подтверждено источником'], ['is-calc', 'наш расчёт'], ['is-none', 'не проверено']].forEach(function (x) {
      var sp = el('span', x[0]); var i = el('span', 'acc__i'); i.setAttribute('aria-hidden', 'true');
      sp.appendChild(i); sp.appendChild(doc.createTextNode(x[1])); leg.appendChild(sp);
    });
    sec.appendChild(leg);
    host.textContent = '';
    host.appendChild(sec);
    return s;
  }

  return { stroki: stroki, zagolovok: zagolovok, render: render, klyuchSchyota: klyuchSchyota };
});
