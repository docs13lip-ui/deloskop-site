/* Делоскоп — «Живой отчёт» (zhivoj-v2, 20.10.2026; ТЗ — Дизайн 4.0 §1а «Загрузка и ожидание», «Переходы состояний»).
   1. Ожидание ответа /api/check: строка состояния называет реестры, которые спрашивает проверка (те же, что в блоке
      «Откуда данные»: ЕГРЮЛ/ЕГРИП, ГИР БО, суды, ФССП, ФНС, ЕИС), по ним бежит свет — без галочек: что ответило,
      станет известно только с ответом, раньше не показываем. Пример под ней — «перелив» (css/otchet.css, .report.loading).
   2. Готовый отчёт: вывод и действия полосы «проявляются» снизу вверх по очереди, после кольца Индекса.
   Только opacity/transform; «Уменьшить движение» — строка без бегущего света, вывод сразу. Текст строки — для диктора
   тот же, что видно (разделители скрыты от диктора). */
(function (W, d) {
  'use strict';
  function tiho() { return !W.matchMedia || !W.matchMedia('(prefers-reduced-motion: no-preference)').matches; }
  // ИП (12 цифр) — ЕГРИП и без ГИР БО (у ИП бухотчётности нет — как в «Откуда данные»)
  function reestry(q) {
    var ip = /^\d{12}$/.test(String(q || '').replace(/\s/g, ''));
    return (ip ? ['ЕГРИП'] : ['ЕГРЮЛ', 'ГИР БО']).concat(['суды', 'ФССП', 'ФНС', 'ЕИС']);
  }
  function zhdu(note, q) {
    note.className = 'note zh-ist';
    note.textContent = '';
    // на телефоне начало строки видит только диктор: строка в одну линию — нет сдвига, когда её сменит итог проверки
    var p = d.createElement('span');
    p.className = 'zh-ist__p';
    p.textContent = 'Проверяем по реестрам: ';
    note.appendChild(p);
    reestry(q).forEach(function (t, i) {
      if (i) { // разделитель держится за предыдущее слово (неразрывный пробел перед точкой) — строка не начинается с «·»
        var r = d.createElement('span');
        r.className = 'zh-ist__r';
        r.setAttribute('aria-hidden', 'true');
        r.textContent = '\u00a0· ';
        note.appendChild(r);
      }
      var s = d.createElement('span');
      s.className = 'zh-ist__i';
      s.setAttribute('data-t', t);
      s.style.setProperty('--i', i);
      s.textContent = t;
      note.appendChild(s);
    });
  }
  // вывод «проявляется»: класс снимаем, когда всё сыграло, — перестановка узлов потом анимацию не повторит
  function pojav(report) {
    var vd = report && report.querySelector('.ot-vd');
    if (!vd || tiho()) return;
    var i = 0;
    [].forEach.call(vd.querySelectorAll('.ot-vt>*,.ot-act>*'), function (e) { e.style.setProperty('--zh-i', Math.min(i++, 6)); });
    vd.classList.add('ot-vd--pojav');
    setTimeout(function () { vd.classList.remove('ot-vd--pojav'); }, 1400);
  }
  W.DlkZhivoj = { zhdu: zhdu, pojav: pojav, reestry: reestry };
})(window, document);
