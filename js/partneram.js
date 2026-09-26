// Переключатель «Кто вы?» на /partneram/usloviya/ (26.09.2026).
// Без JS видны все три блока (А, Б, В); с JS — один, выбранный кнопкой или якорем #grazhdanin / #npd / #ip-org.
(function () {
  var seg = document.querySelector('[data-partner-seg]');
  if (!seg) return;
  var knopki = seg.querySelectorAll('button[data-tip]');
  var bloki = document.querySelectorAll('[data-partner-blok]');
  function pokazat(tip, prokrutit) {
    var est = false;
    bloki.forEach(function (b) { if (b.id === tip) est = true; });
    if (!est) tip = 'grazhdanin';
    bloki.forEach(function (b) { b.hidden = b.id !== tip; });
    knopki.forEach(function (k) { k.setAttribute('aria-pressed', String(k.getAttribute('data-tip') === tip)); });
    if (prokrutit) {
      // заголовок «Кто вы?» — под липкой шапкой, а не за ней
      var cel = document.getElementById('kto') || seg;
      var y = cel.getBoundingClientRect().top + window.pageYOffset - 88;
      window.scrollTo({ top: Math.max(0, y), behavior: prokrutit === 'srazu' ? 'auto' : 'smooth' });
    }
  }
  knopki.forEach(function (k) {
    k.addEventListener('click', function () {
      var tip = k.getAttribute('data-tip');
      pokazat(tip, false);
      try { history.replaceState(null, '', '#' + tip); } catch (e) {}
    });
  });
  seg.hidden = false;
  var h = (location.hash || '').slice(1);
  pokazat(h, h ? 'srazu' : false);
  if (h) setTimeout(function () { pokazat(h, 'srazu'); }, 0); // после собственного прыжка браузера к якорю
  window.addEventListener('hashchange', function () { pokazat((location.hash || '').slice(1), true); });
})();
