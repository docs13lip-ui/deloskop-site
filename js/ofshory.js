/* Перечень офшорных зон Минфина — проверка страны в браузере (ofshory-v1, [Ночные-3] 04.10.2026).
   Данные — /data/ofshory-minfin.json (приказ Минфина России № 86н, ред. № 187н). Название страны на сервер не уходит.
   Чистые функции — window.dlkOfshory (норм, najti) — их проверяет tests/ofshory.test.js. */
(function () {
  'use strict';
  var NB = '\u00a0';

  function norm(t) {
    return String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'().,;:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // → { tochno: [пункты], chastichno: [пункты] }
  function najti(spisok, zapros) {
    var q = norm(zapros);
    var res = { tochno: [], chastichno: [] };
    if (q.length < 2) return res;
    spisok.forEach(function (x) {
      var imena = [x.nazvanie].concat(x.poisk || []).map(norm);
      if (imena.indexOf(q) >= 0) res.tochno.push(x);
      else if (q.length >= 4 && imena.some(function (s) { return s.indexOf(q) >= 0; })) res.chastichno.push(x);
    });
    return res;
  }

  function dataRus(iso) {
    var m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var p = iso.split('-');
    return (+p[2]) + NB + m[+p[1] - 1] + ' ' + p[0];
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function stroka(x) {
    if (x.status === 'dejstvuet') {
      return '<i class="t"></i><b>В' + NB + 'перечне</b>' + NB + '— <a href="#p' + x.n + '">пункт ' + x.n + '</a>: «' + esc(x.nazvanie) + '».';
    }
    return '<i class="t t--ser"></i><b>Исключены из' + NB + 'перечня с' + NB + dataRus(x.isklyuchen_s) + '</b>' + NB + '— <a href="#p' + x.n + '">пункт ' + x.n +
      '</a>, «' + esc(x.nazvanie) + '» (' + esc(x.isklyuchen_prikaz) + ').';
  }

  function otvet(spisok, zapros) {
    var r = najti(spisok, zapros);
    if (r.tochno.length) {
      var t = r.tochno.map(stroka).join('<br>');
      if (r.tochno.some(function (x) { return x.status === 'dejstvuet'; })) {
        t += '<br>Сделку с' + NB + 'компанией оттуда покажите бухгалтеру до' + NB + 'оплаты: она может стать контролируемой (ст.' + NB + '105.14 НК' + NB + 'РФ).';
      }
      return t;
    }
    if (r.chastichno.length) {
      return 'Похожие пункты перечня:<br>' + r.chastichno.slice(0, 5).map(stroka).join('<br>');
    }
    return '<i class="t t--zel"></i>«' + esc(zapros) + '» в' + NB + 'перечне не' + NB + 'нашли. Сверьте написание с' + NB + 'таблицей ниже: в' + NB +
      'перечне — официальные названия и' + NB + 'части стран (например, остров Мэн или Макао).';
  }

  window.dlkOfshory = { norm: norm, najti: najti, otvet: otvet };

  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', function () {
    var forma = document.querySelector('[data-of-forma]');
    var vyvod = document.querySelector('[data-of-otvet]');
    if (!forma || !vyvod) return;
    var spisok = null;
    fetch('/data/ofshory-minfin.json').then(function (r) { return r.json(); }).then(function (d) {
      spisok = d.spisok;
      var dl = document.getElementById('of-spisok');
      if (dl) {
        dl.innerHTML = spisok.map(function (x) {
          return '<option value="' + esc((x.poisk && x.poisk[0]) || x.nazvanie).replace(/"/g, '&quot;') + '">';
        }).join('');
      }
    }).catch(function () {
      vyvod.textContent = 'Перечень не загрузился — сверьте страну по таблице ниже.';
    });
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = forma.strana.value;
      if (!spisok) { vyvod.textContent = 'Перечень ещё загружается — попробуйте через секунду или сверьте по таблице ниже.'; return; }
      vyvod.innerHTML = otvet(spisok, q);
      if (window.dlkGoal) window.dlkGoal('ofshory_proverka', { statya: location.pathname });
    });
  });
})();
