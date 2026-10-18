/* vitrina-v1: витрина экосистемы на главной — сцена экспоната наклоняется к курсору, блик идёт за ним.
   Только ноутбук (наведение мышью); телефон, «меньше движения» и без JS — сцена стоит (поворот по прокрутке и
   появление — CSS: css/vitrina.css, css/glubina.css). Один кадр на движение мыши, только transform. */
(function (W, d) {
  'use strict';
  if (!W.matchMedia || !W.requestAnimationFrame) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  function nastroit(s) {
    var t = s.querySelector('.vit-e__tilt'), b = s.querySelector('.vit-e__blik'), raf = 0, x = 0, y = 0;
    if (!t) return;
    function kadr() {
      raf = 0;
      t.style.setProperty('--ry', (x * 16).toFixed(2) + 'deg');
      t.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
      if (b) b.style.transform = 'translate3d(' + ((x + 0.5) * 166).toFixed(1) + '%,' + ((y + 0.5) * 166).toFixed(1) + '%,0)';
    }
    function pozzhe() { if (!raf) raf = requestAnimationFrame(kadr); }
    s.addEventListener('pointermove', function (e) {
      var r = s.getBoundingClientRect();
      if (!r.width || !r.height) return;
      x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      pozzhe();
    }, { passive: true });
    s.addEventListener('pointerleave', function () { x = 0; y = 0; pozzhe(); }, { passive: true });
  }
  var sceny = d.querySelectorAll('.vit-e__scena');
  for (var i = 0; i < sceny.length; i++) nastroit(sceny[i]);
})(window, document);
