/* Делоскоп — линза поиска (poisk-v2-c, 13.11.2026).
 *
 * Знак Делоскопа в объёме: два стеклянных кольца, в пересечении — линза. Пока человек печатает, кольца сходятся
 * и линза «наводится»; распознали ввод (ИНН с верной контрольной цифрой, счёт и БИК, реквизиты) — кольца совпали;
 * опечатка — тёплый цвет (--warn); Enter — волна. Шейдер — из образца «Поиск Делоскопа» с правками Арт-директора 13.11:
 *  • холст — только в своём блоке .lp (+ поле для свечения), не на весь экран; фон прозрачный — под ним страница (--bg);
 *  • небо со звёздами видно только сквозь стекло («линза увеличивает небо»), снаружи — ничего;
 *  • вне экрана — 0 кадров (IntersectionObserver); без ввода 6 с — засыпает на последнем кадре;
 *  • «уменьшить движение» — один статичный кадр на каждое состояние, без покачивания и волны;
 *  • цвета — только токены ДС (--ink, --accent, --warn, --bg), перечитываются при смене темы; DPR ≤ 1,6;
 *  • linza-cvet-v1 (13.11, слово владельца «белый фон, белые линзы — не то»): кольца — цветами знака, как в CSS-кадре:
 *    левое — --ink (светлая тема: чёрный лак; тёмная: светлое стекло), правое — --accent (густое цветное стекло);
 *    линза в пересечении наливается --accent по мере распознавания; светлая тема — студийный свет и мягкая тень на странице;
 *    край колец сглажен (частичное покрытие на промахе луча); свет «студия» (софтбокс, тёплый слева, холодный справа)
 *    и радужный край стекла — как в образце «Поиск Делоскопа», версия 5 (13.11, «больше 3D и цветов»);
 *  • нет WebGL или шейдер не собрался — остаётся CSS-кадр из двух колец (.lp__k), он тоже знает состояние.
 * Состояние берём из того же разбора, что строка (DlkPoisk.razobrat): ни текст, ни ИНН никуда не уходят.
 * Чистая функция sostoyanie() — для автотестов (node): tests/linza_poisk.test.js. Подключение — index.html (.lp). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DlkLinzaPoisk = api; if (root.document) api.start(root); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- состояние: ждёт / ввод / распознано / опечатка ----------
  // R — ответ DlkPoisk.razobrat (или null); q — текст строки. → { sost, F } — F от 0 (кольца врозь) до 1 (сошлись)
  function sostoyanie(R, q) {
    var t = String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
    if (!t) return { sost: 'zhdet', F: 0 };
    // «не хватает цифр» и «цифр пока не столько» — человек ещё печатает, это не опечатка
    if (R && R.err && R.vid !== 'malo_cifr' && R.vid !== 'cifry') return { sost: 'opechatka', F: Math.min(0.85, 0.35 + t.length / 16) };
    if (R && R.exact) return { sost: 'raspoznano', F: 1 };
    return { sost: 'vvod', F: Math.min(0.9, 0.35 + t.length / 16) };
  }

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uR,uO,uM;uniform float uT,uF,uP,uS,uD;uniform vec3 uC,uB,uK;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'vec3 irid(float x){return .5+.5*cos(6.2832*(x+vec3(0.,.33,.67)));}',
    // небо — цвет страницы (--bg): в тёмной теме звёзды, в светлой — дневной свет с точками; видно только сквозь стекло
    'vec3 bg(vec2 p){vec3 c=uB;',
    ' if(uD>.5){for(int l=0;l<2;l++){float fl=float(l);vec2 g=p*(9.+fl*11.)+fl*17.3;vec2 id=floor(g);vec2 f=fract(g)-.5;float r=h21(id+fl);',
    '  if(r>.72){vec2 o=(vec2(h21(id+1.7),h21(id+9.2))-.5)*.6;float tw=.7+.3*sin(uT*(.6+r*2.)+r*40.);',
    '   c+=smoothstep(.13-fl*.03,0.,length(f-o))*tw*mix(vec3(.72,.82,1.),vec3(1.,.93,.84),h21(id+5.1))*(.9-fl*.3);}}',
    '  c+=uC*.05;}',
    ' else{vec2 g=p*14.;c=mix(c,uC,.06+.08*clamp(p.y+.5,0.,1.))-.08*smoothstep(.09,0.,length(fract(g)-.5))*step(.5,h21(floor(g)));}',
    ' return c;}',
    'float tor(vec3 p,float R,float r){vec2 q=vec2(length(p.xy)-R,p.z);return length(q)-r;}',
    'float smx(float a,float b,float k){float h=clamp(.5+.5*(a-b)/k,0.,1.);return mix(b,a,h)+k*h*(1.-h);}',
    // 1 — кольцо цвета --ink, 3 — кольцо цвета --accent (при опечатке --warn), 2 — линза в пересечении
    'vec2 map(vec3 p){float d0=mix(.40,.33,uF);float tl=mix(.50,0.,uF)+.05*sin(uT*.7);',
    ' vec3 a=p-vec3(-d0,0.,0.);a.xz*=rot(tl);vec3 b=p-vec3(d0,0.,0.);b.xz*=rot(-tl);',
    ' float R=.60,r=.086;float da=tor(a,R,r),db=tor(b,R,r);',
    ' float Ri=R-.03;float ia=length(p.xy-vec2(-d0,0.))-Ri,ib=length(p.xy-vec2(d0,0.))-Ri;float ins=-smx(ia,ib,.12);',
    ' float th=(.010+.12*smoothstep(0.,.30,ins))*(.25+.75*uF);float dl=max(max(ia,ib),abs(p.z)-th)*.6;',
    ' vec2 m=da<db?vec2(da,1.):vec2(db,3.);return m.x<dl?m:vec2(dl,2.);}',
    'vec3 nrm(vec3 p){vec2 e=vec2(.0012,0.);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}',
    // окружение для отражений: тёмная — ночь и цвет кольца; светлая — студия: софтбокс полосой сверху, боковой свет, тёмный низ
    'vec3 envl(vec3 r){vec3 c;float st=smoothstep(.40,.55,r.y)*smoothstep(.98,.80,r.y)*smoothstep(.80,.25,abs(r.x+.12));',
    ' vec3 wl=vec3(1.,.62,.40)*pow(max(dot(r,normalize(vec3(-.9,.15,.4))),0.),7.);vec3 cl=vec3(.40,.66,1.)*pow(max(dot(r,normalize(vec3(.9,.05,.45))),0.),7.);',
    ' if(uD>.5){c=mix(vec3(.012,.015,.026),vec3(.07,.09,.15),r.y*.5+.5);c+=st*vec3(1.7);c+=wl*.75+cl*.85;',
    '  c+=uC*pow(max(dot(r,normalize(vec3(.1,-.7,.6))),0.),5.)*.9;c+=vec3(.55,.35,1.)*pow(max(dot(r,normalize(vec3(-.5,-.6,.5))),0.),6.)*.35;}',
    ' else{c=mix(vec3(.17,.18,.21),vec3(.93,.94,.96),smoothstep(-.35,.75,r.y));c+=st*vec3(2.5);c+=wl*.85+cl*.95;',
    '  c+=uC*pow(max(dot(r,normalize(vec3(.1,-.7,.6))),0.),5.)*.55;}',
    ' return c;}',
    'float spc(vec3 rd,vec3 n){vec3 v=reflect(rd,n);return pow(max(dot(v,normalize(vec3(.45,.75,.5))),0.),110.)*1.6+pow(max(dot(v,normalize(vec3(-.6,.5,.6))),0.),60.)*.45;}',
    // выход — с предумноженной прозрачностью: снаружи колец только свечение (и тень в светлой теме), под ним страница
    'void main(){vec2 px=gl_FragCoord.xy;vec2 sp=(px-.5*uR)/uR.y;vec2 q=(px-uO)/uS;float dq=length(q);float k=uS/uR.y;vec2 c0=(uO-.5*uR)/uR.y;',
    ' float glow=exp(-dq*dq*1.5)*(.08+.20*uF)*(uD>.5?1.:.30);',
    ' if(uP>.001&&uP<1.)glow+=smoothstep(.10,0.,abs(dq-uP*1.9))*(1.-uP)*(uD>.5?.5:.35);',
    ' vec2 kr=min(px,uR-px);float kraj=smoothstep(0.,.14*uR.y,min(kr.x,kr.y));glow*=kraj;vec3 pc=uC*glow;float al=glow;',
    // светлая тема: мягкая тень колец на странице — знак висит над ней, а не тонет в белом
    ' if(uD<.5){float d0=mix(.40,.33,uF)*.86,ct=cos(mix(.50,0.,uF));vec2 s=q-vec2(.03,-.10);',
    '  vec2 sa=s+vec2(d0,0.),sb=s-vec2(d0,0.);sa.x/=ct;sb.x/=ct;float ds=min(abs(length(sa)-.516),abs(length(sb)-.516));',
    '  float sh=exp(-ds*ds*95.)*.16*kraj;pc*=1.-sh;al+=sh*(1.-al);}',
    ' if(dq<1.28){vec3 ro=vec3(0.,0.,3.);vec3 rd=normalize(vec3(q,-2.6));',
    '  float tx=uM.x*.30+.07*sin(uT*.31),ty=-uM.y*.24+.05*cos(uT*.27);',
    '  ro.yz*=rot(ty);rd.yz*=rot(ty);ro.xz*=rot(tx);rd.xz*=rot(tx);',
    '  float t=1.7;float md=1e3,mm=1.;vec2 m=vec2(0.);bool hit=false;',
    '  for(int i=0;i<88;i++){vec3 p=ro+rd*t;m=map(p);if(m.x<md){md=m.x;mm=m.y;}if(m.x<.0012){hit=true;break;}t+=m.x;if(t>4.6)break;}',
    '  if(hit){vec3 p=ro+rd*t;vec3 n=nrm(p);float nv=max(dot(n,-rd),0.);float fr=pow(1.-nv,5.);vec3 rf=envl(reflect(rd,n));float sg=spc(rd,n);vec3 c;',
    '   if(m.y>1.5&&m.y<2.5){float Fk=.04+.96*fr;float mag=mix(1.,.52,uF);vec3 acc;',
    '    vec3 rr=refract(rd,n,1./1.44);acc.r=bg(c0+(sp-c0)*mag+rr.xy*.26*k).r;',
    '    rr=refract(rd,n,1./1.47);acc.g=bg(c0+(sp-c0)*mag+rr.xy*.26*k).g;',
    '    rr=refract(rd,n,1./1.50);acc.b=bg(c0+(sp-c0)*mag+rr.xy*.26*k).b;',
    '    vec3 tint=mix(vec3(1.),uC,.20+.30*uF);',
    '    vec3 body=uD>.5?acc*tint*(1.5+1.1*uF)+uC*(.06+.20*uF):mix(acc,uC,.24+.52*uF)+mix(uC,vec3(1.),.7)*pow(nv,5.)*(.10+.12*uF);',
    '    body*=.86+.28*max(dot(n,normalize(vec3(-.45,.6,.65))),0.);body+=uC*pow(1.-nv,3.)*(uD>.5?.35:.18);body+=irid(fr*2.+.15)*pow(1.-nv,3.)*.35;c=mix(body,rf,Fk)+sg*.6;}',
    '   else{vec3 r1=refract(rd,n,1./1.4);vec3 back=bg(sp+r1.xy*.16*k);vec3 tc=m.y<1.5?uK:uC;',
    // тёмная: стекло — кольцо --ink светлое, кольцо --accent синее, ободок светится; светлая: --ink — чёрный лак, --accent — густое цветное стекло
    '    if(uD>.5&&m.y<1.5){c=rf*mix(vec3(.62),uK,.15)*(.75+.25*fr)+irid(nv*1.1+.05)*.05*(1.-nv)+sg*1.5;}',
    '    else if(m.y<1.5){c=uK*(.45+.55*nv)+rf*(.08+.92*fr)+sg*1.3;}',
    '    else{vec3 body=uD>.5?back*.35+uC*(.40+.40*nv)+uC*pow(1.-nv,2.)*.85:uC*(.30+.70*nv)*(.92+.08*back.r);body+=mix(uC,vec3(1.),.6)*pow(nv,8.)*.32;'+
    '     body+=irid(fr*1.6+nv*.35+uT*.02)*pow(1.-nv,2.5)*(uD>.5?.55:.40);c=mix(body,rf,.05+.95*fr)+sg*1.3;}}',
    '   pc=c;al=1.;',
    // край без ступенек: промах рядом с кольцом — частичное покрытие цветом этого кольца
    '  }else{float e=smoothstep(1.6/uS,0.,md);vec3 ec=mm<1.5?uK:mm<2.5?uC*.8:uC;ec=uD>.5?ec*.55+.06:ec*.85;pc=mix(pc,ec,e);al=mix(al,1.,e);}',
    ' }',
    ' al=clamp(al,0.,1.);pc+=(h21(px+fract(uT))-.5)/255.*al;gl_FragColor=vec4(clamp(pc,vec3(0.),vec3(al)),al);}'
  ].join('\n');

  function start(win) {
    var doc = win.document, el = doc.querySelector('.lp'), cv = el && el.querySelector('.lp__gl');
    var input = doc.getElementById('inn'), form = doc.getElementById('check');
    if (!el || !cv || el.getAttribute('data-lp-gotovo')) return;
    el.setAttribute('data-lp-gotovo', '1');
    var mm = win.matchMedia, redu = !!(mm && mm('(prefers-reduced-motion: reduce)').matches);
    var st = { sost: 'zhdet', F: 0 }, F = 0, P = 0, pStart = 0, mx = 0, my = 0, tmx = 0, tmy = 0, t0 = Date.now();
    var accent = [0.36, 0.61, 1], warn = [0.95, 0.7, 0.36], bgc = [0.07, 0.07, 0.08], ink = [0.96, 0.96, 0.95], cur = accent.slice(), dark = true;
    var vidno = false, raf = 0, budil = 0, dpr = 1, gl = null, U = {};

    // CSS-кадр тоже знает состояние (сходятся кольца, тёплый цвет) — data-sost на блоке
    function obnovit() {
      var P0 = win.DlkPoisk, v = input ? input.value : '';
      st = sostoyanie(P0 && v.trim() ? P0.razobrat(v, []) : null, v);
      if (el.getAttribute('data-sost') !== st.sost) el.setAttribute('data-sost', st.sost);
      razbudit();
    }
    function puls() { if (!redu) pStart = Date.now(); razbudit(); }
    if (input) {
      input.addEventListener('input', obnovit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') puls(); });
    }
    if (form) form.addEventListener('submit', puls, true);
    obnovit();

    try { gl = cv.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return;
    function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { gl = null; return; }
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uR', 'uO', 'uM', 'uT', 'uF', 'uP', 'uS', 'uD', 'uC', 'uB', 'uK'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.clearColor(0, 0, 0, 0);
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; el.classList.remove('lp--gl'); });

    function cvet(name, def) {
      var v = win.getComputedStyle(doc.documentElement).getPropertyValue(name).trim(), m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (!m) return def;
      var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1], n = parseInt(h, 16);
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    }
    function tema() {
      bgc = cvet('--bg', bgc); accent = cvet('--accent', accent); warn = cvet('--warn', warn); ink = cvet('--ink', ink);
      dark = (bgc[0] * 0.3 + bgc[1] * 0.59 + bgc[2] * 0.11) < 0.5; razbudit();
    }
    function razmer() {
      dpr = Math.min(win.devicePixelRatio || 1, 1.6);
      var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, cv.width, cv.height); razbudit();
    }
    // покой: без ввода и движения 6 с — последний кадр остаётся, анимация спит
    function razbudit() { budil = Date.now(); if (gl && vidno && !raf) raf = win.requestAnimationFrame(kadr); }
    function kadr() {
      raf = 0;
      if (!gl || !vidno || doc.hidden) return;
      var now = Date.now(), r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
      var S = Math.min(r.height * 0.62, r.width * 0.44) * dpr;
      var cx = (r.left - c.left + r.width / 2) * dpr, cy = (c.bottom - (r.top + r.height / 2)) * dpr;
      var cel = st.F, tc = st.sost === 'opechatka' ? warn : accent;
      F += (cel - F) * (redu ? 1 : 0.08); mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
      for (var i = 0; i < 3; i++) cur[i] += (tc[i] - cur[i]) * (redu ? 1 : 0.08);
      P = pStart ? Math.min(1, (now - pStart) / 900) : 0; if (P >= 1) pStart = 0;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uR, cv.width, cv.height); gl.uniform2f(U.uO, cx, cy); gl.uniform2f(U.uM, redu ? 0 : mx, redu ? 0 : my);
      gl.uniform1f(U.uT, redu ? 12 : (now - t0) / 1000); gl.uniform1f(U.uF, F); gl.uniform1f(U.uP, P); gl.uniform1f(U.uS, S);
      gl.uniform1f(U.uD, dark ? 1 : 0); gl.uniform3f(U.uC, cur[0], cur[1], cur[2]); gl.uniform3f(U.uB, bgc[0], bgc[1], bgc[2]); gl.uniform3f(U.uK, ink[0], ink[1], ink[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!el.classList.contains('lp--gl')) el.classList.add('lp--gl');
      var dvizh = Math.abs(cel - F) > 0.002 || pStart || Math.abs(tmx - mx) + Math.abs(tmy - my) > 0.004;
      if (!redu && (dvizh || now - budil < 6000)) raf = win.requestAnimationFrame(kadr);
    }

    tema();
    if (win.MutationObserver) new win.MutationObserver(tema).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    if (mm) { var mq = mm('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', tema); }
    win.addEventListener('resize', razmer);
    if (!redu) win.addEventListener('pointermove', function (e) {
      tmx = (e.clientX / win.innerWidth - 0.5) * 2; tmy = (e.clientY / win.innerHeight - 0.5) * 2;
      if (now() - budil > 120) razbudit();
    }, { passive: true });
    function now() { return Date.now(); }
    new win.IntersectionObserver(function (z) {
      vidno = z[0].isIntersecting;
      if (vidno) { razmer(); razbudit(); } else if (raf) { win.cancelAnimationFrame(raf); raf = 0; }
    }).observe(el);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) razbudit(); });
  }

  return { sostoyanie: sostoyanie, start: start, FS: FS };
});
