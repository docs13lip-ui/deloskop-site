/* Делоскоп · пакет «linza-poisk» — собран tests/sobrat_js.py из 1 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/linza-poisk.js --- */
(function (root, factory) {
var api = factory();
if (typeof module === 'object' && module.exports) module.exports = api;
else { root.DlkLinzaPoisk = api; if (root.document) api.start(root); }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
function sostoyanie(R, q) {
var t = String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
if (!t) return { sost: 'zhdet', F: 0 };
if (R && R.err && R.vid !== 'malo_cifr' && R.vid !== 'cifry') return { sost: 'opechatka', F: Math.min(0.85, 0.35 + t.length / 16) };
if (R && R.exact) return { sost: 'raspoznano', F: 1 };
return { sost: 'vvod', F: Math.min(0.9, 0.35 + t.length / 16) };
}
var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
var FS = [
'#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
'uniform vec2 uR,uO,uM;uniform float uT,uF,uP,uS,uD;uniform vec3 uC,uB;',
'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
'vec3 bg(vec2 p){vec3 c=uB;',
' if(uD>.5){for(int l=0;l<2;l++){float fl=float(l);vec2 g=p*(9.+fl*11.)+fl*17.3;vec2 id=floor(g);vec2 f=fract(g)-.5;float r=h21(id+fl);',
'  if(r>.72){vec2 o=(vec2(h21(id+1.7),h21(id+9.2))-.5)*.6;float tw=.7+.3*sin(uT*(.6+r*2.)+r*40.);',
'   c+=smoothstep(.13-fl*.03,0.,length(f-o))*tw*mix(vec3(.72,.82,1.),vec3(1.,.93,.84),h21(id+5.1))*(.9-fl*.3);}}',
'  c+=uC*.05;}',
' else{vec2 g=p*14.;c=mix(c,uC,.05)-.07*smoothstep(.09,0.,length(fract(g)-.5))*step(.5,h21(floor(g)));}',
' return c;}',
'float tor(vec3 p,float R,float r){vec2 q=vec2(length(p.xy)-R,p.z);return length(q)-r;}',
'vec2 map(vec3 p){float d0=mix(.40,.33,uF);float tl=mix(.50,0.,uF)+.05*sin(uT*.7);',
' vec3 a=p-vec3(-d0,0.,0.);a.xz*=rot(tl);vec3 b=p-vec3(d0,0.,0.);b.xz*=rot(-tl);',
' float R=.60,r=.072;float dr=min(tor(a,R,r),tor(b,R,r));',
' float Ri=R-.03;float ia=length(p.xy-vec2(-d0,0.))-Ri,ib=length(p.xy-vec2(d0,0.))-Ri;float ins=-max(ia,ib);',
' float th=(.010+.12*smoothstep(0.,.30,ins))*(.25+.75*uF);float dl=max(max(ia,ib),abs(p.z)-th)*.6;',
' return dr<dl?vec2(dr,1.):vec2(dl,2.);}',
'vec3 nrm(vec3 p){vec2 e=vec2(.0018,0.);return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));}',
'vec3 envl(vec3 r){float up=r.y*.5+.5;vec3 c;',
' if(uD>.5){c=mix(vec3(.02,.03,.05),vec3(.10,.14,.22),up);c+=pow(max(dot(r,normalize(vec3(.5,.7,.5))),0.),42.)*vec3(1.8);',
'  c+=pow(max(dot(r,normalize(vec3(-.7,.3,.6))),0.),9.)*uC;c+=pow(max(dot(r,normalize(vec3(.1,-.8,.5))),0.),14.)*vec3(.25,.3,.4);}',
' else{c=mix(vec3(.62,.66,.72),vec3(1.),up);c+=pow(max(dot(r,normalize(vec3(.5,.7,.5))),0.),42.)*vec3(.9);c=mix(c,uC,.18*pow(max(dot(r,normalize(vec3(-.7,.3,.6))),0.),4.));}',
' return c;}',
'void main(){vec2 px=gl_FragCoord.xy;vec2 sp=(px-.5*uR)/uR.y;vec2 q=(px-uO)/uS;float dq=length(q);float k=uS/uR.y;vec2 c0=(uO-.5*uR)/uR.y;',
' vec3 col=vec3(0.);float al=0.;',
' float glow=exp(-dq*dq*1.5)*(.08+.20*uF)*(uD>.5?1.:.55);',
' if(uP>.001&&uP<1.)glow+=smoothstep(.10,0.,abs(dq-uP*1.9))*(1.-uP)*(uD>.5?.5:.35);',
' vec2 kr=min(px,uR-px);glow*=smoothstep(0.,.14*uR.y,min(kr.x,kr.y));col=uC;al=glow;',
' if(dq<1.28){vec3 ro=vec3(0.,0.,3.);vec3 rd=normalize(vec3(q,-2.6));',
'  float tx=uM.x*.30+.07*sin(uT*.31),ty=-uM.y*.24+.05*cos(uT*.27);',
'  ro.yz*=rot(ty);rd.yz*=rot(ty);ro.xz*=rot(tx);rd.xz*=rot(tx);',
'  float t=1.7;float md=1e3;vec2 m=vec2(0.);bool hit=false;',
'  for(int i=0;i<64;i++){vec3 p=ro+rd*t;m=map(p);md=min(md,m.x);if(m.x<.0016){hit=true;break;}t+=m.x;if(t>4.6)break;}',
'  if(hit){vec3 p=ro+rd*t;vec3 n=nrm(p);float fr=pow(1.-max(dot(n,-rd),0.),5.);vec3 rf=envl(reflect(rd,n));vec3 c;',
'   if(m.y<1.5){float Fk=.10+.90*fr;vec3 r1=refract(rd,n,1./1.33);vec3 back=bg(sp+r1.xy*.16*k);',
'    vec3 body=uD>.5?back*.6+vec3(.10,.13,.19):back*.80-vec3(.06);body=mix(body,uC*(uD>.5?.62:.9),.22+.40*uF);float rim=pow(1.-max(dot(n,-rd),0.),2.);if(uD>.5)body+=uC*rim*.45;',
'    c=mix(body,rf,Fk)+rf*(uD>.5?.30:.06);}',
'   else{float Fk=.04+.96*fr;float mag=mix(1.,.52,uF);vec3 acc;',
'    vec3 rr=refract(rd,n,1./1.44);acc.r=bg(c0+(sp-c0)*mag+rr.xy*.26*k).r;',
'    rr=refract(rd,n,1./1.47);acc.g=bg(c0+(sp-c0)*mag+rr.xy*.26*k).g;',
'    rr=refract(rd,n,1./1.50);acc.b=bg(c0+(sp-c0)*mag+rr.xy*.26*k).b;',
'    vec3 tint=mix(vec3(1.),uC,(uD>.5?.20:.30)+.30*uF);vec3 body=uD>.5?acc*tint*(1.5+1.1*uF)+uC*(.06+.20*uF):mix(acc,uC,.10+.22*uF);',
'    c=mix(body,rf,Fk);}',
'   col=c;al=1.;',
'  }else{float e=smoothstep(.014,0.,md)*.35;col=mix(col,uD>.5?uC*.6+.1:uC*.5+.4,e);al=max(al,e);}',
' }',
' col+=(h21(px+fract(uT))-.5)/255.;al=clamp(al,0.,1.);gl_FragColor=vec4(clamp(col,0.,1.)*al,al);}'
].join('\n');
function start(win) {
var doc = win.document, el = doc.querySelector('.lp'), cv = el && el.querySelector('.lp__gl');
var input = doc.getElementById('inn'), form = doc.getElementById('check');
if (!el || !cv || el.getAttribute('data-lp-gotovo')) return;
el.setAttribute('data-lp-gotovo', '1');
var mm = win.matchMedia, redu = !!(mm && mm('(prefers-reduced-motion: reduce)').matches);
var st = { sost: 'zhdet', F: 0 }, F = 0, P = 0, pStart = 0, mx = 0, my = 0, tmx = 0, tmy = 0, t0 = Date.now();
var accent = [0.36, 0.61, 1], warn = [0.95, 0.7, 0.36], bgc = [0.07, 0.07, 0.08], cur = accent.slice(), dark = true;
var vidno = false, raf = 0, budil = 0, dpr = 1, gl = null, U = {};
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
['uR', 'uO', 'uM', 'uT', 'uF', 'uP', 'uS', 'uD', 'uC', 'uB'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
gl.clearColor(0, 0, 0, 0);
cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; el.classList.remove('lp--gl'); });
function cvet(name, def) {
var v = win.getComputedStyle(doc.documentElement).getPropertyValue(name).trim(), m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
if (!m) return def;
var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1], n = parseInt(h, 16);
return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function tema() {
bgc = cvet('--bg', bgc); accent = cvet('--accent', accent); warn = cvet('--warn', warn);
dark = (bgc[0] * 0.3 + bgc[1] * 0.59 + bgc[2] * 0.11) < 0.5; razbudit();
}
function razmer() {
dpr = Math.min(win.devicePixelRatio || 1, 1.6);
var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
gl.viewport(0, 0, cv.width, cv.height); razbudit();
}
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
gl.uniform1f(U.uD, dark ? 1 : 0); gl.uniform3f(U.uC, cur[0], cur[1], cur[2]); gl.uniform3f(U.uB, bgc[0], bgc[1], bgc[2]);
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
;
