/* linza-indeksa-v1 (11.11): «Линза Индекса» — объёмное кольцо 1–99 (WebGL, без библиотек).
   Разметка — section.linza: data-ball="N" — балл посчитан (заливка цветом зоны), без него — «ждёт» (пустая дорожка, блик раз в 4 с).
   Запасной кадр — CSS (.linza__k::before): нет WebGL, ошибка шейдера, prefers-reduced-motion, печать. Вне экрана — 0 кадров.
   Цвета — только токены ДС (getComputedStyle), перечитываются при смене темы. DPR ≤ 2. Наклон за мышью ≤ 10°, покачивание ≤ 4°.
   linza-otchet-v1: то же стекло в кольце .zhi[data-ball] (отчёт, пример на главной); число и слова — в разметке, наклон — CSS. */
(function () {
  'use strict';
  var mm = window.matchMedia;
  if (!mm || mm('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = 'precision mediump float;uniform vec2 R,T;uniform float F,G,A;uniform vec3 C,D;' +
    'mat2 r(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}' +
    'vec3 tp(vec3 p){p.yz*=r(T.y);p.xz*=r(T.x);return p;}' +
    'float an(vec3 q){float a=atan(q.x,q.y);return (a<0.?a+6.2831853:a)/6.2831853;}' +
    'vec3 bd(){float a=F*6.2831853;return vec3(sin(a),cos(a),0.);}' +
    'float m(vec3 p){vec3 q=tp(p);float d=length(vec2(length(q.xy)-1.,q.z))-.13;return F>0.?min(d,length(q-bd())-.19):d;}' +
    'vec3 n(vec3 p){vec2 e=vec2(.003,0.);return normalize(vec3(m(p+e.xyy)-m(p-e.xyy),m(p+e.yxy)-m(p-e.yxy),m(p+e.yyx)-m(p-e.yyx)));}' +
    'void main(){vec2 u=(gl_FragCoord.xy*2.-R)/R.y;vec3 o=vec3(0.,0.,2.2),d=normalize(vec3(u,-1.5));float t=0.,md=9.,h=0.;vec3 mp=o;' +
    'for(int i=0;i<48;i++){vec3 p=o+d*t;float s=m(p);if(s<md){md=s;mp=p;}if(s<.002){h=1.;break;}t+=s;if(t>6.)break;}' +
    'vec3 q=tp(mp);float a=an(q),b=F>0.?step(length(q-bd()),.22):0.,l=max(step(a,F),b);' +
    'float g=G<0.?0.:exp(-pow(min(abs(a-G),1.-abs(a-G))*14.,2.))*.12;' +
    'if(h>.5){vec3 p=o+d*t,N=n(p),L=normalize(vec3(-.5,.8,.7));float df=max(dot(N,L),0.),fr=pow(1.-max(dot(N,-d),0.),3.),sp=pow(max(dot(reflect(-L,N),-d),0.),40.);' +
    'vec3 c=mix(D*(1.+g),C,l);c=c*(.62+.6*df)+fr*mix(D,C,l)*.6+sp*.55;gl_FragColor=vec4(c,1.);}' +
    'else{float w=exp(-md*14.)*l*A;gl_FragColor=vec4(C*w,w);}}';

  function hex(s) {
    s = (s || '').trim().replace('#', '');
    if (s.length === 3) s = s.replace(/(.)/g, '$1$1');
    var v = parseInt(s, 16) || 0;
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
  }
  function zona(b) { return b >= 70 ? '--ok' : b >= 50 ? '--warn' : b >= 30 ? '--high' : '--bad'; }
  function temnaya() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : mm('(prefers-color-scheme: dark)').matches;
  }

  function linza(el, cv, z) {
    if (!cv || el.linza) return;
    el.linza = 1;
    var gl = null;
    try { gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true }); } catch (e) { gl = null; }
    if (!gl) return;
    if (z) el.querySelector('.zhi__kolco').appendChild(cv);
    function sh(tip, src) { var s = gl.createShader(tip); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return;
    var pr = gl.createProgram();
    gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var lp = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    'R T F G A C D'.split(' ').forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });

    var ball = parseInt(el.getAttribute('data-ball'), 10), dlit = z ? 1200 : 600, est = ball >= 1 && ball <= 99;
    var cel = est ? ball / 99 * .96 : 0, fill = 0, start = 0;
    var col, dim, alfa, vid = false, raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, gotov = false;
    function cveta() {
      var cs = getComputedStyle(el);
      col = hex(cs.getPropertyValue(z ? '--zona-cvet' : est ? zona(ball) : '--muted')); // .zhi — как слова уровня
      dim = hex(cs.getPropertyValue('--line'));
      alfa = temnaya() ? .35 : .15;
    }
    cveta();

    function kadr(now) {
      raf = 0;
      if (!el.isConnected) { // отчёт сменился: стоп, контекст отдаём
        vid = false; io.disconnect(); var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return;
      }
      var d = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(cv.parentNode.clientWidth * (z ? 1.3 : 1) * d); // canvas скрыт до первого кадра — меряем обёртку
      if (!w) return;
      if (cv.width !== w) { cv.width = w; cv.height = w; }
      if (!start) { start = now; cveta(); } // кольцо отчёта собрано вне документа
      var s = now / 1000;
      if (est) { var k = Math.min(1, (now - start) / dlit); fill = cel * (z ? k * (2 - k) : 1 - Math.pow(1 - k, 3)); }
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      var kach = Math.sin(s * 6.2831853 / 12) * .07; // ≈ 4°
      gl.viewport(0, 0, w, w);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.R, w, w);
      gl.uniform2f(U.T, cx * .17 + kach, -cy * .17 + .16 + kach * .5); // наклон за мышью ≤ 10° (0,17 рад)
      gl.uniform1f(U.F, fill);
      gl.uniform1f(U.G, est ? -1 : (s % 4) / 4 * 1.6 - .3); // блик проходит дорожку раз в 4 с
      gl.uniform1f(U.A, alfa);
      gl.uniform3f(U.C, col[0], col[1], col[2]);
      gl.uniform3f(U.D, dim[0], dim[1], dim[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!gotov) { gotov = true; el.classList.add('linza--gl'); }
      if (vid) raf = requestAnimationFrame(kadr);
    }
    function pusk() { if (!raf && vid) raf = requestAnimationFrame(kadr); }
    var io = new IntersectionObserver(function (e) { vid = e[e.length - 1].isIntersecting; if (vid) pusk(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } });
    io.observe(el);
    if (!z) el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var b = cv.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - .5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height - .5) * 2));
    });
    el.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    new MutationObserver(cveta).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    try { mm('(prefers-color-scheme: dark)').addEventListener('change', cveta); } catch (e) { /* старый Safari */ }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); vid = false; el.classList.remove('linza--gl'); });
  }

  function zhi(z) {
    if (!z || z.linza || !(+z.getAttribute('data-ball') >= 1)) return;
    var cv = document.createElement('canvas');
    cv.className = 'zhi__gl'; cv.setAttribute('aria-hidden', 'true');
    linza(z, cv, 1);
  }
  window.Linza = { zhi: zhi }; // зовёт js/zhivoj-indeks.js
  function vse() {
    Array.prototype.forEach.call(document.querySelectorAll('.linza'), function (el) { linza(el, el.querySelector('.linza__gl')); });
    Array.prototype.forEach.call(document.querySelectorAll('.zhi[data-ball]'), zhi);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vse); else vse();
})();
