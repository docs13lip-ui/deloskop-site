/* Перечень недружественных государств (распоряжение Правительства РФ № 430-р) — проверка страны в браузере
   (nedruzh-430r-v1, [команда] 10.10.2026). Данные — /data/nedruzhestvennye-430r.json; заодно сверяем страну
   с перечнем офшорных зон Минфина (/data/ofshory-minfin.json) — это другой перечень, для налоговых правил.
   Название страны на сервер не уходит. Чистые функции — window.dlkNedruzh (norm, najti, otvet) — их проверяет
   tests/nedruzhestvennye.test.js. */
(function () {
  'use strict';
  var NB = '\u00a0';

  function norm(t) {
    return String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'().,;:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function vid(n) { return String(n).replace(/ - /g, ' — '); }

  // → { tochno: [{x, cherez}], chastichno: [{x, cherez}] }; cherez — страна ЕС, по которой нашли строку «Государства — члены ЕС»
  function najti(spisok, zapros) {
    var q = norm(zapros);
    var res = { tochno: [], chastichno: [] };
    if (q.length < 2) return res;
    spisok.forEach(function (x) {
      var imena = [x.nazvanie].concat(x.poisk || []).map(norm);
      var es = (x.chleny_es || []);
      var esN = es.map(norm);
      var i = esN.indexOf(q);
      if (imena.indexOf(q) >= 0) res.tochno.push({ x: x });
      else if (i >= 0) res.tochno.push({ x: x, cherez: es[i] });
      else if (q.length >= 4) {
        if (imena.some(function (s) { return s.indexOf(q) >= 0; })) res.chastichno.push({ x: x });
        else {
          var j = esN.findIndex(function (s) { return s.indexOf(q) === 0; });
          if (j >= 0) res.chastichno.push({ x: x, cherez: es[j] });
        }
      }
    });
    return res;
  }

  function najtiOfshor(ofSpisok, zapros) {
    if (!ofSpisok) return [];
    var q = norm(zapros);
    if (q.length < 2) return [];
    return ofSpisok.filter(function (x) {
      return x.status === 'dejstvuet' && [x.nazvanie].concat(x.poisk || []).map(norm).indexOf(q) >= 0;
    });
  }

  function stroka(r) {
    var t = '<i class="t"></i><b>В' + NB + 'перечне</b>' + NB + '— <a href="#p' + r.x.n + '">строка ' + r.x.n + '</a>: «' + esc(vid(r.x.nazvanie)) + '»';
    if (r.cherez) t += ' (' + esc(r.cherez) + '&nbsp;— член Европейского союза)';
    return t + '.';
  }

  function otvet(spisok, zapros, ofSpisok) {
    var r = najti(spisok, zapros);
    var t;
    if (r.tochno.length) {
      t = r.tochno.map(stroka).join('<br>');
      t += '<br>Перечень говорит о' + NB + 'государстве, а' + NB + 'не' + NB + 'о' + NB + 'конкретной компании. Особый порядок может касаться и' + NB + 'российских компаний, которые контролируют лица из' + NB + 'этих государств. До' + NB + 'подписания покажите сделку юристу.';
    } else if (r.chastichno.length) {
      t = 'Похожие строки перечня:<br>' + r.chastichno.slice(0, 5).map(stroka).join('<br>');
    } else {
      t = '<i class="t t--ser"></i>«' + esc(zapros) + '» в' + NB + 'перечне не' + NB + 'нашли. Сверьте написание с' + NB + 'таблицей ниже: в' + NB +
        'перечне есть общая строка для стран Европейского союза и' + NB + 'для британских территорий.';
    }
    var of = najtiOfshor(ofSpisok, zapros);
    if (of.length) {
      t += '<br><span class="nd__of">Отдельно: страна есть и' + NB + 'в' + NB + '<a href="/nalogi/ofshornye-zony-perechen-minfina/#p' + of[0].n +
        '">перечне офшорных зон Минфина</a>, пункт ' + of[0].n + '. Это другой перечень&nbsp;— для налоговых правил сделки.</span>';
    }
    return t;
  }

  window.dlkNedruzh = { norm: norm, najti: najti, otvet: otvet };

  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var forma = document.querySelector('[data-nd-forma]');
    var vyvod = document.querySelector('[data-nd-otvet]');
    if (!forma || !vyvod) return;
    var spisok = null, ofSpisok = null;
    fetch('/data/ofshory-minfin.json').then(function (r) { return r.json(); }).then(function (d) { ofSpisok = d.spisok; }).catch(function () {});
    fetch('/data/nedruzhestvennye-430r.json').then(function (r) { return r.json(); }).then(function (d) {
      spisok = d.spisok;
      var dl = document.getElementById('nd-spisok');
      if (dl) {
        var imena = [];
        spisok.forEach(function (x) {
          imena.push((x.poisk && x.poisk[0]) || x.nazvanie);
          (x.chleny_es || []).forEach(function (s) { imena.push(s); });
        });
        dl.innerHTML = imena.map(function (s) { return '<option value="' + esc(s).replace(/"/g, '&quot;') + '">'; }).join('');
      }
    }).catch(function () {
      vyvod.textContent = 'Перечень не загрузился — сверьте страну по таблице ниже.';
    });
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = forma.strana.value;
      if (!spisok) { vyvod.textContent = 'Перечень ещё загружается — попробуйте через секунду или сверьте по таблице ниже.'; return; }
      vyvod.innerHTML = otvet(spisok, q, ofSpisok);
      if (window.dlkGoal) window.dlkGoal('nedruzh_proverka', { statya: location.pathname });
    });
  });
})();
