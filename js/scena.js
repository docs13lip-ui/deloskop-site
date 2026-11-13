/* Делоскоп — сцена поиска (scena-poiska-v1, 13.11.2026: «поиск в 3D, строка по центру»).
 *
 * WebGL без библиотек. Три прохода: фон с глубиной → в текстуру; текстура → на холст; поверх — три стеклянных предмета
 * (знак из двух колец, лупа, щит), каждый своей программой и только в своём прямоугольнике. Стекло преломляет настоящий фон.
 *
 * Правила (те же, что у линзы js/linza-poisk.js):
 *  • цвета — токены дизайн-системы (--bg, --ink, --accent, --warn, --ok), тема — по data-theme;
 *  • холст только в своём блоке; вне экрана и в закрытом окне — 0 кадров (IntersectionObserver + vkl(false));
 *  • «уменьшить движение» — один статичный кадр, перерисовка только по вводу;
 *  • нет WebGL или программа не собралась — O.netGL(): остаётся CSS-кадр страницы;
 *  • нагрузка под устройство: программы собираются без остановки страницы (KHR_parallel_shader_compile); холст ≤ 2,2 млн точек,
 *    фон ≤ 1,05 млн; цену кадра меряет сама видеокарта (чтение одной точки), а не пауза между кадрами; дорогой фон
 *    дорисовывается полосами в запасную текстуру; совсем тяжело — сцена замирает одним резким кадром;
 *  • ни текст запроса, ни ИНН сюда не попадают: сцене передают только три числа состояния (O.sost());
 *    сети, хранилища и чужих адресов нет.
 *
 * window.DlkScena(O) → {vkl(да/нет), puls(), tema(), zamer(), est()}
 *   O.cv — холст; O.mark — блок под знак; O.box — строка поиска; O.pole — поле ввода;
 *   O.lupa, O.shit — списки блоков-мест (берётся первый видимый); O.sost() → {focus:0..1, exact:bool, err:bool}; O.netGL() — запасной кадр. */
(function () {
if (window.DlkScena) return;
window.DlkScena = function (O) {
'use strict';
var cv=O.cv,obj=O.mark,box=O.box,q=O.pole,CW=1,CH=1,CL=0,CT=0,vkl=true,vidno=true,raf=0,gl=null,PR={},fb=null,tx=null,W=0,H=0,WB=0,HB=0,kq=1,kb=1,deln=performance.now(),chet=0,t0=performance.now(),last=0,gryaz=true,
    redu=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,zamok=/[#&]hq/.test(location.hash),
    dark=true,accent=[.357,.608,1],warn=[.95,.70,.36],ink=[.96,.96,.95],okc=[.36,.76,.54],cur=[.357,.608,1],curG=[.36,.76,.54],
    F=0,E=0,X=0,FO=0,TK=0,P=0,pStart=0,mx=0,my=0,tmx=0,tmy=0,fok=false,ema=.016,kadrov=0;
function ramka(){var b=cv.getBoundingClientRect();CW=Math.max(1,b.width);CH=Math.max(1,b.height);CL=b.left;CT=b.top}
function puls(){pStart=performance.now();gryaz=true}
function cvet(name,def){var v=getComputedStyle(document.documentElement).getPropertyValue(name).trim(),m=v.match(/^#([0-9a-f]{6})$/i);if(!m)return def;var n=parseInt(m[1],16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
function tema(){var b=cvet('--bg',[.07,.07,.07]);dark=(b[0]*.3+b[1]*.59+b[2]*.11)<.5;accent=cvet('--accent',accent);warn=cvet('--warn',warn);ink=cvet('--ink',ink);okc=cvet('--ok',okc);gryaz=true;fonGr=true}

var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
/* общее: шум, поворот, радуга тонкой плёнки, студийный свет для отражений (софтбокс сверху, тёплая полоса слева, холодная справа) */
var LIB=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uR,uM;uniform float uT,uD;uniform vec3 uC;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 irid(float x){return .5+.5*cos(6.2832*(x+vec3(0.,.33,.67)));}
float sbox(vec3 r,vec3 d,vec2 sz){float k=dot(r,d);if(k<=.001)return 0.;vec3 u=normalize(cross(vec3(0.,1.,0.),d));vec3 v=cross(d,u);
vec2 a=abs(vec2(dot(r,u),dot(r,v))/k);vec2 e=smoothstep(sz,sz*.70,a);return e.x*e.y;}
vec3 envl(vec3 r){
float top=sbox(r,normalize(vec3(.20,.80,.56)),vec2(.62,.26));
float lft=sbox(r,normalize(vec3(-.86,.12,.50)),vec2(.13,.85));
float rgt=sbox(r,normalize(vec3(.90,.0,.44)),vec2(.09,.70));
float und=pow(max(dot(r,normalize(vec3(.05,-.8,.6))),0.),4.);vec3 c;
if(uD>.5){c=mix(vec3(.022,.028,.050),vec3(.105,.135,.230),smoothstep(-.7,.9,r.y));
c+=top*vec3(2.3,2.35,2.5)+lft*vec3(1.5,1.0,.62)+rgt*vec3(.55,.85,1.6)+uC*und*.8;
c+=vec3(.5,.3,1.)*pow(max(dot(r,normalize(vec3(-.55,-.55,.6))),0.),6.)*.3;}
else{c=mix(vec3(.34,.35,.40),vec3(.97,.975,.99),smoothstep(-.55,.55,r.y));
c*=1.-.62*sbox(r,normalize(vec3(.70,.25,.66)),vec2(.10,.9));
c+=top*vec3(1.9)+lft*vec3(1.0,.78,.58)*.9+rgt*vec3(.6,.8,1.)*.8+uC*und*.45;}
return c;}`;
/* фон: линия горизонта проходит за строкой поиска — выше «небо» (туманность, звёзды, лучи), ниже «пол» (точки уходят в перспективу);
   боке и стеклянные шарики на разной глубине; свет от знака падает на строку */
var FS_BG=LIB+`uniform vec2 uO,uBx,uBs;uniform float uF,uP,uS,uFo,uQ,uE;
float HZ;
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*ns(p);p=p*2.03+7.1;a*=.5;}return s;}
vec3 base(vec2 p){float y=p.y-HZ;float ax=abs(p.x);vec3 c;
if(uD>.5){
vec3 sky=mix(vec3(.060,.075,.130),vec3(.016,.018,.032),smoothstep(0.,.75,y));
vec3 hc=mix(uC,vec3(.45,.55,1.),.4);
sky+=hc*.22*exp(-max(y,0.)*7.)*exp(-ax*ax*.9);
vec2 w=p*1.25+vec2(uT*.010,0.)+uM*.015;float n=fbm(w+fbm(w*1.9+3.1)*.55);
sky+=uC*.17*smoothstep(.42,.86,n)*smoothstep(-.25,.25,y);
sky+=vec3(.50,.28,.95)*.090*smoothstep(.50,.92,fbm(w*.8+11.+n*.4));
sky+=vec3(.10,.62,.70)*.060*smoothstep(.52,.95,fbm(w*.7-5.3));
vec3 fl=mix(vec3(.030,.036,.062),vec3(.012,.013,.022),smoothstep(0.,.5,-y));
fl+=hc*.14*exp(y*9.)*exp(-ax*ax*1.2);
c=mix(fl,sky,smoothstep(-.004,.004,y));
c+=vec3(.55,.70,1.)*.11*exp(-abs(y)*170.)*exp(-ax*ax*.7);
}else{
vec3 sky=mix(vec3(.945,.955,.975),vec3(.986,.985,.977),smoothstep(0.,.7,y));
vec2 w=p*1.05+vec2(uT*.008,0.)+uM*.015;float n=fbm(w+fbm(w*1.7+3.1)*.5);
sky=mix(sky,mix(vec3(1.),uC,.62),.36*smoothstep(.42,.84,n));
sky=mix(sky,vec3(1.,.84,.72),.34*smoothstep(.50,.90,fbm(w*.9-7.)));
sky=mix(sky,vec3(.84,.80,1.),.32*smoothstep(.50,.90,fbm(w*1.15+17.)));
sky=mix(sky,vec3(.80,.95,.90),.22*smoothstep(.55,.92,fbm(w*.8+31.)));
vec3 fl=mix(vec3(.915,.922,.942),vec3(.970,.969,.962),smoothstep(0.,.45,-y));
fl=mix(fl,mix(vec3(1.),uC,.5),.10*exp(y*6.)*exp(-ax*ax));
c=mix(fl,sky,smoothstep(-.004,.004,y));
c+=vec3(.045)*exp(-abs(y)*150.)*exp(-ax*ax*.6);
c-=vec3(.030,.028,.022)*exp(-max(-y,0.)*30.)*step(y,0.)*exp(-ax*ax*.5);
}
return c;}
void marb(inout vec3 col,vec2 p,vec2 c,float r,vec3 tint,float blur,float ph){
c.y+=.012*sin(uT*.45+ph);c+=uM*(.02+.03*blur);vec2 dl=p-c;float d=length(dl);
if(uD>.5){col+=tint*.05*exp(-d*d/(r*r)*.55);}
else{vec2 sd=(dl-vec2(.35,-.95)*r)*vec2(1.,1.9);col=mix(col,vec3(.16,.17,.24),.20*exp(-dot(sd,sd)/(r*r)*1.1));
vec2 cs=(dl-vec2(.22,-.80)*r)*vec2(1.,2.2);col+=mix(tint,vec3(1.),.4)*.20*exp(-dot(cs,cs)/(r*r)*9.);}
float e=mix(.035,.30,blur)*r+1.5/uR.y;float a=smoothstep(r,r-e,d);if(a<=0.)return;
vec2 qn=dl/r;float z=sqrt(max(1.-dot(qn,qn),0.));vec3 n=vec3(qn,z);vec3 rd=vec3(0.,0.,-1.);
vec3 rr=refract(rd,n,1./1.45);vec3 inn=base(c+rr.xy*r*(2.4-blur)-qn*r*.15);
vec3 body=inn*mix(vec3(1.),tint,.16+.34*z);body=mix(body,tint,.22*pow(1.-z,1.5));
if(uD>.5)body=body*1.6+tint*(.07+.10*z+.24*pow(1.-z,2.));
vec2 L=normalize(vec2(-.45,.7));float cau=pow(max(dot(qn,-L),0.),3.)*smoothstep(.2,.9,length(qn));
body+=mix(tint,vec3(1.),.55)*cau*(uD>.5?.70:.55);
float fr=.04+.96*pow(1.-z,4.);vec3 rf=envl(reflect(rd,n));
col=mix(col,mix(body,rf,fr*(1.-.5*blur)),a*(1.-.25*blur));}
void main(){vec2 px=gl_FragCoord.xy;float asp=uR.x/uR.y;vec2 p=(px-.5*uR)/uR.y;
HZ=(uBx.y-.5*uR.y)/uR.y;float y=p.y-HZ;vec3 col=base(p);
if(uD>.5&&y>0.){for(int l=0;l<3;l++){float fl=float(l);float sc=22.+fl*26.;vec2 g=(p+uM*(.006+.008*fl))*sc+fl*17.3;vec2 id=floor(g);vec2 f=fract(g)-.5;float r=h21(id+fl);
if(r>.80){vec2 o=(vec2(h21(id+1.7),h21(id+9.2))-.5)*.7;float d=length(f-o);float tw=.65+.35*sin(uT*(.6+r*2.)+r*40.);
col+=smoothstep(.10-fl*.02,0.,d)*tw*(.25+.75*h21(id+3.3))*mix(vec3(.72,.82,1.),vec3(1.,.90,.80),h21(id+5.1))*(1.-fl*.22)*smoothstep(0.,.05,y);}}}
{vec2 d=p-vec2(0.,1.15);float a=atan(d.x,-d.y);float r=fbm(vec2(a*7.,uT*.04));float rays=smoothstep(.45,.9,r)*smoothstep(1.9,.3,length(d))*smoothstep(.9,0.,abs(a));
if(uD>.5)col+=vec3(.5,.62,1.)*rays*.055*(y>0.?1.:.4);else col*=1.+.04*(rays-.25);}
if(y<0.){float z=1./(-y+.02);vec2 g=vec2((p.x+uM.x*.01)*z,z)*vec2(2.3,1.15)+vec2(0.,uT*.06);vec2 f=fract(g)-.5;float dd=length(f*vec2(1.,2.));
float dt=smoothstep(.11,.03,dd)*smoothstep(0.,.06,-y)*smoothstep(.55,.12,-y);
if(uD>.5)col+=mix(uC,vec3(.6,.75,1.),.5)*dt*.17;else col-=vec3(.11,.10,.08)*dt*.55;}
for(int i=0;i<9;i++){float fi=float(i);vec2 s=vec2(h21(vec2(fi,1.7)),h21(vec2(fi,9.3)));float dz=.35+.65*h21(vec2(fi,4.4));
vec2 c=(s-.5)*vec2(asp*1.1,1.1);c.y=mod(c.y+uT*.008*dz+.55,1.1)-.55;c+=uM*.035*dz;float r=.018+.055*h21(vec2(fi,6.1))*dz;
float d=length(p-c);float disc=smoothstep(r,r*.78,d);float rim=smoothstep(r*.55,r*.95,d)*disc;
vec3 tc=mix(uC,mix(vec3(.6,.4,1.),vec3(1.,.75,.55),h21(vec2(fi,2.2))),.5);
if(uD>.5)col+=tc*(disc*.035+rim*.045)*dz;else col=mix(col,vec3(1.),disc*.28*dz)+tc*rim*.03;}
{vec2 bq=(px-uBx)/uBs;float pool=exp(-bq.x*bq.x*.55-bq.y*bq.y*.05);
if(uD>.5)col+=mix(uC,vec3(.6,.7,1.),.3)*pool*(.05+.07*uFo+.06*uF);else col=mix(col,vec3(1.),pool*(.25+.15*uFo));
float ty=clamp((uO.y-px.y)/max(uO.y-uBx.y,1.),0.,1.);float hw=mix(uS*.22,uBs.x*.80,ty);
float cone=smoothstep(hw,hw*.30,abs(px.x-uO.x))*smoothstep(0.,.14,ty)*smoothstep(1.04,.72,ty);
if(uD>.5)col+=uC*cone*(.014+.05*uF);else col=mix(col,mix(vec3(1.),uC,.25),cone*(.03+.07*uF));}
{vec2 q=(px-uO)/uS;float dq=length(q);float glow=exp(-dq*dq*1.2)*(.10+.24*uF);vec3 gc=mix(uC,vec3(.55,.40,1.),.30*smoothstep(-.6,.8,q.x-q.y));
if(uD>.5)col+=gc*glow;else{vec2 sq=(q-vec2(.10,-.24))*vec2(1.,1.25);col=mix(col,vec3(.20,.22,.32),.10*exp(-dot(sq,sq)*1.6));col=mix(col,mix(vec3(1.),gc,.5),glow*.5);}
if(uP>.001&&uP<1.){float w=smoothstep(.10,0.,abs(dq-uP*2.4))*(1.-uP);vec3 wc=irid(uP*.8+dq*.3)*.5+uC*.6;if(uD>.5)col+=wc*w*.55;else col=mix(col,uC,w*.4);}}
if(uQ>.5){vec2 A=vec2(asp*.5,1.);
marb(col,p,vec2(-.90,.33)*A,.058,uC,0.,1.);
marb(col,p,vec2(.86,.30)*A,.040,vec3(.62,.45,1.),0.,2.3);
marb(col,p,vec2(-.57,-.37)*A,.034,vec3(.35,.85,.80),0.,4.1);
marb(col,p,vec2(.94,-.24)*A,.090,vec3(.92,.96,1.),1.,5.2);
marb(col,p,vec2(-.97,-.27)*A,.075,vec3(1.,.72,.50),1.,.4);
marb(col,p,vec2(.60,-.41)*A,.028,uC,0.,3.3);}
float v=length(p*vec2(.85,1.));
if(uD>.5)col*=1.-(.42+.18*uFo)*smoothstep(.35,1.25,v);else col-=vec3(.05,.05,.04)*(1.+uFo)*smoothstep(.4,1.3,v);
col+=(h21(px+fract(uT))-.5)/255.;gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;
var FS_BLIT=LIB+`uniform sampler2D uB;void main(){vec3 c=texture2D(uB,gl_FragCoord.xy/uR).rgb;c+=(h21(gl_FragCoord.xy+fract(uT))-.5)*(uD>.5?.020:.012);gl_FragColor=vec4(c,1.);}`;
/* предметы: общий трассировщик. Стекло — два преломления (вход и выход), поглощение по толщине, разложение цвета на краях. */
var OBJ=LIB+`uniform sampler2D uB;uniform vec2 uO;uniform float uS,uF,uE,uP,uK2,uAl;uniform vec3 uK,uG,uA;
const vec3 LK=vec3(.371,.743,.557);
vec3 kontr(float nv){return uD>.5?pow(1.-nv,2.6)*(vec3(.30,.40,.75)*.55+uC*.35):vec3(0.);}
vec2 map(vec3 p);
float smx(float a,float b,float k){float h=clamp(.5+.5*(a-b)/k,0.,1.);return mix(b,a,h)+k*h*(1.-h);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float ext(float d,float z,float h){vec2 w=vec2(d,abs(z)-h);return min(max(w.x,w.y),0.)+length(max(w,0.));}
float band(vec3 p,float R,vec2 hw,float cr){vec2 q=vec2(length(p.xy)-R,p.z);vec2 d=abs(q)-hw+cr;return length(max(d,0.))+min(max(d.x,d.y),0.)-cr;}
vec3 nrm(vec3 p){vec2 e=vec2(.0011,-.0011);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
float aoc(vec3 p,vec3 n){float a=clamp(map(p+n*.06).x/.06,0.,1.);float b=clamp(map(p+n*.16).x/.16,0.,1.);return .35+.65*a*(.5+.5*b);}
float shd(vec3 p,vec3 l){float s=1.,t=.03;for(int i=0;i<14;i++){float h=map(p+l*t).x;s=min(s,10.*h/t);t+=clamp(h,.02,.14);if(s<.02||t>1.4)break;}return clamp(s,0.,1.);}
vec3 bgs(vec2 q){return texture2D(uB,clamp(q/uR,.002,.998)).rgb;}
vec3 glass(vec3 p,vec3 rd,vec3 n,vec2 px,vec3 tint,float dens,float ior,float depth,out float th){
vec3 ri=refract(rd,n,1./ior);float t=.012;vec3 pe=p;
for(int i=0;i<18;i++){pe=p+ri*t;float d=-map(pe).x;if(d<.003)break;t+=max(d,.012);if(t>.9)break;}
th=t;vec3 n2=-nrm(pe);vec3 ro=refract(ri,n2,ior);if(dot(ro,ro)<.01)ro=reflect(ri,n2);
vec2 sh=((pe.xy-p.xy)+ro.xy*depth)*uS*.83;vec3 a=exp(-(1.-tint)*t*dens);
return vec3(bgs(px+sh*.93).r,bgs(px+sh).g,bgs(px+sh*1.08).b)*a;}`;
var OBJ_MAIN=`void main(){vec2 px=gl_FragCoord.xy;vec2 q=(px-uO)/uS;vec4 o=under(q);
if(dot(q,q)<2.6){vec3 ro=vec3(0.,0.,3.2);vec3 rd=normalize(vec3(q,-2.65));cam(ro,rd);
float t=1.4,md=1e3,tm=1.4,hit=0.;vec2 m=vec2(0.);
for(int i=0;i<96;i++){vec3 p=ro+rd*t;m=map(p);if(m.x<md){md=m.x;tm=t;}if(m.x<.0009){hit=1.;break;}t+=m.x*.95;if(t>5.4)break;}
float al=hit>.5?1.:smoothstep(1.7/uS,0.,md);
if(al>.004){if(hit<.5)t=tm;vec3 p=ro+rd*t;vec2 mm=map(p);vec3 n=nrm(p);vec3 c=clamp(surf(p,rd,n,mm.y,px),0.,4.);c=c/(1.+max(c-1.,0.)*.6);
o=o*(1.-al)+vec4(c*al,al);}}
vec4 ov=over(q);o.rgb+=ov.rgb;gl_FragColor=vec4(clamp(o.rgb,0.,1.),clamp(o.a,0.,1.))*uAl;}`;
/* знак: кольцо --ink (хром в тёмной теме, графитовая керамика в светлой), кольцо --accent (сапфировое стекло), между ними — линза с просветлением */
var FS_MARK=OBJ+`void cam(inout vec3 ro,inout vec3 rd){float tx=uM.x*.42+.18*sin(uT*.23),ty=.14+uM.y*.16+.04*cos(uT*.27);ro.yz*=rot(ty);rd.yz*=rot(ty);ro.xz*=rot(tx);rd.xz*=rot(tx);}
vec2 map(vec3 p){float d0=mix(.40,.33,uF);float tl=mix(.52,0.,uF)+.05*sin(uT*.7);
vec3 a=p-vec3(-d0,0.,0.);a.xz*=rot(tl);vec3 b=p-vec3(d0,0.,0.);b.xz*=rot(-tl);
float da=band(a,.60,vec2(.078,.088),.046),db=band(b,.60,vec2(.078,.088),.046);
float ia=length(p.xy-vec2(-d0,0.))-.530,ib=length(p.xy-vec2(d0,0.))-.530;float e=smx(ia,ib,.10);
float th=(.014+.135*smoothstep(0.,.30,-e))*(.30+.70*uF)*(1.+.25*uK2);float dl=max(e,abs(p.z)-th)*.6;
vec2 m=da<db?vec2(da,1.):vec2(db,3.);return m.x<dl?m:vec2(dl,2.);}
vec4 under(vec2 q){return vec4(0.);}
vec4 over(vec2 q){float f=(exp(-abs(q.x)*34.)*exp(-abs(q.y)*4.5)+exp(-abs(q.y)*34.)*exp(-abs(q.x)*4.5))*.45+exp(-dot(q,q)*55.)*.5;
return vec4(mix(uC,vec3(1.),.65)*f*uE*(.80+.20*sin(uT*2.1))*(uD>.5?.9:.55),0.);}
vec3 surf(vec3 p,vec3 rd,vec3 n,float id,vec2 px){
float nv=max(dot(n,-rd),0.),fr=pow(1.-nv,5.);vec3 rv=reflect(rd,n),rf=envl(rv);float oc=aoc(p,n),sh=shd(p+n*.004,LK),th;vec3 c;
float sp=pow(max(dot(rv,LK),0.),140.)*2.4;
if(id<1.5){
if(uD>.5)c=(mix(rf,vec3(dot(rf,vec3(.33))),.55)*vec3(.90,.90,.92)*(.74+.26*fr)+vec3(.26,.26,.29)*(.35+.65*max(dot(n,LK),0.)))*mix(.55,1.,sh)+irid(nv*1.1+.05)*.04*(1.-nv)+vec3(.50,.52,.58)*pow(1.-nv,2.6)*.45+sp;
else c=uK*(.30+.70*max(dot(n,LK),0.)*sh)+rf*(.045+.955*fr)*mix(.65,1.,sh)+sp*.8;}
else if(id<2.5){
vec3 g=glass(p,rd,n,px,mix(vec3(1.),uC,.10+.26*uF),1.4,1.50,.55+.55*uF,th);
vec3 body=uD>.5?g*(1.25+.95*uF)+uC*(.05+.20*uF):mix(g,uC,.06+.20*uF)+mix(uC,vec3(1.),.7)*pow(nv,5.)*(.08+.12*uF);
body*=.88+.24*max(dot(n,normalize(vec3(-.45,.6,.65))),0.);
vec3 coat=rf*mix(vec3(1.),irid(nv*.9+.58),.55);
c=mix(body,coat,.035+.965*fr)+irid(fr*2.+.15)*pow(1.-nv,3.)*.30+sp*.5+uC*uK2*.10;}
else{
vec3 g=glass(p,rd,n,px,mix(uC,vec3(1.),.10),5.5,1.52,.34,th);
float d0=mix(.40,.33,uF);vec2 bl=normalize(p.xy-vec2(d0,0.)+1e-4);float kau=pow(max(dot(bl,vec2(.50,-.86)),0.),3.)+.5*pow(max(dot(bl,vec2(-.80,.60)),0.),6.);
vec3 body=g*(uD>.5?1.15:.95)+uC*(uD>.5?.17+.24*nv:.20+.30*nv)+uC*pow(1.-nv,2.)*(uD>.5?.55:.10);
body+=mix(uC,vec3(1.),.55)*kau*(uD>.5?.50:.30);body+=mix(uC,vec3(1.),.6)*pow(nv,8.)*.26;body+=irid(fr*1.6+nv*.35+uT*.02)*pow(1.-nv,2.5)*(uD>.5?.50:.36);
c=mix(body,rf,.05+.95*fr)*mix(.72,1.,sh)+sp;}
return c*mix(.58,1.,oc);}`+OBJ_MAIN;
/* лупа: хромовый обод с чёрной прокладкой, двояковыпуклое стекло (две сферы), рифлёная муфта, ручка цвета --accent с хромовым торцом */
var FS_LUPA=OBJ+`void cam(inout vec3 ro,inout vec3 rd){}
vec2 map(vec3 p){p.y-=uA.z;p.xz*=rot(uA.x);p.yz*=rot(uA.y);p.xy*=rot(.60);p.y-=.45;
float rim=band(p,.50,vec2(.040,.060),.022);float gk=band(p,.452,vec2(.012,.040),.008);
float gl=max(max(length(p-vec3(0.,0.,-2.05))-2.11,length(p-vec3(0.,0.,2.05))-2.11),length(p.xy)-.452);
vec3 h=p-vec3(0.,-.625,0.);float kn=.0035*sin(atan(h.z,h.x)*28.)-.011*smoothstep(.010,.003,abs(abs(h.y)-.052));float col=max(length(h.xz)-(.072+kn),abs(h.y)-.082)-.006;
vec3 g=p-vec3(0.,-.72,0.);float ty=clamp(-g.y/.64,0.,1.);float hd=length(vec3(g.x,g.y+.64*ty,g.z))-mix(.068,.088,smoothstep(0.,1.,ty));
vec3 c2=p-vec3(0.,-1.40,0.);float cap=max(length(c2.xz)-.092,abs(c2.y)-.026)-.012;
vec2 m=vec2(min(min(rim,col),cap),4.);if(gk<m.x)m=vec2(gk,7.);if(hd<m.x)m=vec2(hd,6.);if(gl<m.x)m=vec2(gl,5.);return m;}
vec4 under(vec2 q){vec2 lc=vec2(.21,.31);float bob=uA.z*.83;
if(uD>.5){vec2 d=q-lc-vec2(0.,bob);float g=exp(-dot(d,d)*2.2)*.10;vec2 cs=(q-lc-vec2(.20,-.62))*vec2(1.,1.5);float ca=exp(-dot(cs,cs)*22.)*.22;
return vec4(uC*g+mix(vec3(1.,.92,.80),uC,.25)*ca,0.);}
vec2 s=q-vec2(.10,-.30+bob*.4);float ring=abs(length((s-lc)*vec2(1.,1.25))-.40);float sh=exp(-ring*ring*70.)*.9;
float hs=seg(s,lc+vec2(-.26,-.38),lc+vec2(-.68,-1.0));sh=max(sh,exp(-hs*hs*90.));sh+=exp(-dot((s-lc)*vec2(1.,1.25),(s-lc)*vec2(1.,1.25))*5.)*.25;
float a=clamp(sh,0.,1.)*.15;vec2 cs=(s-lc-vec2(.05,-.05))*vec2(1.,1.3);float ca=exp(-dot(cs,cs)*30.)*.55;
return vec4(vec3(.13,.14,.20)*a*(1.-ca)+vec3(1.,.97,.90)*ca*.5,a*(1.-ca)+ca*.5);}
vec4 over(vec2 q){return vec4(0.);}
vec3 surf(vec3 p,vec3 rd,vec3 n,float id,vec2 px){
float nv=max(dot(n,-rd),0.),fr=pow(1.-nv,5.);vec3 rv=reflect(rd,n),rf=envl(rv);float oc=aoc(p,n),sh=shd(p+n*.004,LK),th;vec3 c;
float sp=pow(max(dot(rv,LK),0.),140.)*2.4;
if(id<4.5)c=(rf*vec3(.86,.88,.93)*(.72+.28*fr)+(uD>.5?vec3(.16,.18,.23)*(.35+.65*max(dot(n,LK),0.)):vec3(0.)))*mix(.55,1.,sh)+irid(nv*.9+.3)*.035+kontr(nv)+sp;
else if(id<5.5){
vec3 g=glass(p,rd,n,px,vec3(.93,.97,1.),.9,1.50,1.9,th);
vec3 body=uD>.5?g*1.45+uC*.035:g*1.02;
vec3 lp=p;lp.y-=uA.z;lp.xz*=rot(uA.x);lp.yz*=rot(uA.y);lp.xy*=rot(.60);lp.y-=.45;float rr=length(lp.xy);
body+=mix(vec3(1.,.95,.86),uC,.2)*pow(max(dot(normalize(lp.xy+1e-4),vec2(.50,-.86)),0.),4.)*smoothstep(.26,.44,rr)*(uD>.5?.42:.30);
body*=mix(vec3(1.),uD>.5?vec3(.80,.90,1.):vec3(.84,.92,.99),smoothstep(.22,.45,rr));
float bk=lp.x*.80+lp.y*.60+.10+.22*sin(uA.x*2.+.6);float st=smoothstep(.075,.0,abs(bk))+.55*smoothstep(.030,.0,abs(bk-.15));
body+=vec3(1.)*st*smoothstep(.44,.30,rr)*(uD>.5?.11:.42);body+=(uD>.5?uC*.05:vec3(.0))+irid(rr*1.6+.1)*smoothstep(.36,.45,rr)*.10;
vec3 coat=rf*mix(vec3(1.),irid(nv*.8+.55),.50);
c=mix(body,coat,.04+.96*fr)+sp*.7;}
else if(id<6.5){vec3 hc=uD>.5?uC*.95:uC*.92;c=hc*(.30+.70*max(dot(n,LK),0.)*sh)+hc*.14+rf*(.05+.95*fr)*mix(.6,1.,sh)+kontr(nv)+sp;}
else c=vec3(.035,.037,.045)*(.5+.5*max(dot(n,LK),0.))+rf*.035;
return c*mix(.58,1.,oc);}`+OBJ_MAIN;
/* щит: изумрудное стекло в хромовой раме, выпуклая линза корпуса, белая эмалевая галочка */
var FS_SHIT=OBJ+`void cam(inout vec3 ro,inout vec3 rd){}
float shp(vec2 p){vec2 q=vec2(abs(p.x),p.y);return max(length(q-vec2(-.75,.45))-1.25,q.y-.60-.035*q.x*q.x);}
vec2 map(vec3 p){p.y-=uA.z;p.xz*=rot(uA.x);p.yz*=rot(uA.y);p.y-=.02;
float d2=shp(p.xy);float dome=.075*clamp(1.-length(p.xy*vec2(1.,.85)-vec2(0.,.02))/.70,0.,1.);dome=dome*dome*(3.-2.*dome/.075)/.075;
float body=ext(d2+.090,p.z,.040+dome)-.030;
float fr=ext(abs(d2+.030)-.018,p.z,.058)-.012;
float k2=min(seg(p.xy,vec2(-.25,.05),vec2(-.07,-.15)),seg(p.xy,vec2(-.07,-.15),vec2(.29,.28)))-.050;
float ck=ext(k2+.016,p.z-(.062+dome*.85),.020)-.016;
vec2 m=vec2(body,7.);if(fr<m.x)m=vec2(fr,9.);if(ck<m.x)m=vec2(ck,8.);return m;}
vec4 under(vec2 q){float bob=uA.z*.83;
if(uD>.5){vec2 d=q-vec2(0.,bob);float g=exp(-dot(d,d)*1.5)*(.07+.22*uE);return vec4(uG*g,0.);}
vec2 s=(q-vec2(.06,-.98+bob*.4))*vec2(1.,3.2);float a=exp(-dot(s,s)*2.2)*(.15+.06*uE);
return vec4(mix(vec3(.13,.14,.20),uG*.5,.25)*a,a);}
vec4 over(vec2 q){return vec4(0.);}
vec3 surf(vec3 p,vec3 rd,vec3 n,float id,vec2 px){
float nv=max(dot(n,-rd),0.),fr=pow(1.-nv,5.);vec3 rv=reflect(rd,n),rf=envl(rv);float oc=aoc(p,n),sh=shd(p+n*.004,LK),th;vec3 c;
float sp=pow(max(dot(rv,LK),0.),140.)*2.4;
if(id<7.5){
vec3 g=glass(p,rd,n,px,mix(uG,vec3(1.),.06),4.2,1.50,.45,th);
vec3 body=g*(uD>.5?1.1:.92)+uG*(uD>.5?.26+.30*nv+.30*uE:.16+.22*nv+.08*uE)+uG*pow(1.-nv,2.)*(uD>.5?.60:.10);
body+=mix(uG,vec3(1.),.6)*pow(nv,8.)*.24;body+=irid(fr*1.8+.6)*pow(1.-nv,2.5)*.32;
c=mix(body,rf,.05+.95*fr)*mix(.74,1.,sh)+sp;}
else if(id<8.5)c=vec3(.97,.97,.96)*(.50+.50*max(dot(n,LK),0.)*mix(.6,1.,sh))+rf*(.05+.95*fr)*.55+sp*.7;
else c=(rf*vec3(.88,.90,.92)*(.72+.28*fr)+(uD>.5?vec3(.16,.19,.21)*(.35+.65*max(dot(n,LK),0.)):vec3(0.)))*mix(.55,1.,sh)+irid(nv*.9+.3)*.035+kontr(nv)+sp;
return c*mix(.58,1.,oc);}`+OBJ_MAIN;

var parl=null,zhdut=[];
function prog(fs,imya,gotovo){
  function sh(t,src){var x=gl.createShader(t);gl.shaderSource(x,src);gl.compileShader(x);return x}
  var v=sh(gl.VERTEX_SHADER,VS),f=sh(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();
  gl.attachShader(p,v);gl.attachShader(p,f);gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);
  zhdut.push({p:p,f:f,imya:imya,zt:performance.now(),cb:gotovo})}
function oprosit(){var z=zhdut[0];if(!z||!gl)return;
  if(parl&&!gl.getProgramParameter(z.p,parl.COMPLETION_STATUS_KHR))return;
  zhdut.shift();tihoDo=performance.now()+1500;
  if(!gl.getProgramParameter(z.p,gl.LINK_STATUS)){console.error('сборка '+z.imya+': '+gl.getProgramInfoLog(z.p)+' '+gl.getShaderInfoLog(z.f));z.cb(null);return}
  ZM[z.imya]=Math.round(performance.now()-z.zt);z.cb({p:z.p,u:{}})}
function L(o,n){if(!(n in o.u))o.u[n]=gl.getUniformLocation(o.p,n);return o.u[n]}
var ZM={},zmMax=0,zmEl=null,zmGPU='',zmE=0,zmN=0,tihoDo=0,medl=0,stat=false,statN=0,zmSt=0,zmStM=0,zmBg=0,vse=false,pxb=new Uint8Array(4),stoim=0,probN=0,probK=30,spok=0,posl=0,pb=1,pq=1,potB=1,potQ=1;
function netGL(){if(O.netGL)O.netGL();cv.hidden=true;gl=null;sverit()}
function sverit(){var nado=vkl&&vidno&&!!gl;if(nado&&!raf){last=0;medl=0;raf=requestAnimationFrame(kadr)}else if(!nado&&raf){cancelAnimationFrame(raf);raf=0}}
function start(){
  try{gl=cv.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'high-performance'})}catch(e){gl=null}
  if(!gl){netGL();return}
  try{var di=gl.getExtension('WEBGL_debug_renderer_info');zmGPU=di?String(gl.getParameter(di.UNMASKED_RENDERER_WEBGL)).slice(0,90):''}catch(e){}
  parl=gl.getExtension('KHR_parallel_shader_compile');
  var ochered=[['bg',FS_BG,'фон'],['blit',FS_BLIT,'экран'],['mark',FS_MARK,'знак'],['lupa',FS_LUPA,'лупа'],['shit',FS_SHIT,'щит']];
  (function dalshe(){var x=ochered.shift();if(!x||!gl){vse=true;return}prog(x[1],x[2],function(o){
    if(o){o.al=0;PR[x[0]]=o}else if(x[0]==='bg'||x[0]==='blit'){netGL();return}else if(x[0]==='mark'&&O.netGL)O.netGL();
    gryaz=true;dalshe()})})();
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  txA=gl.createTexture();txB=gl.createTexture();fbA=gl.createFramebuffer();fbB=gl.createFramebuffer();
  tema();razmer();window.addEventListener('resize',razmer);
  cv.addEventListener('webglcontextlost',function(e){e.preventDefault();netGL()});
  if(window.matchMedia){var mq=matchMedia('(prefers-color-scheme: dark)');if(mq.addEventListener)mq.addEventListener('change',tema)}
  new MutationObserver(tema).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  window.addEventListener('pointermove',function(e){tmx=Math.max(-1,Math.min(1,((e.clientX-CL)/CW-.5)*2));tmy=Math.max(-1,Math.min(1,((e.clientY-CT)/CH-.5)*2));deln=performance.now()},{passive:true});
  document.documentElement.addEventListener('pointerleave',function(){tmx=0;tmy=0});
  window.addEventListener('scroll',function(){gryaz=true;deln=performance.now()},{passive:true});
  q.addEventListener('input',function(){TK=1;gryaz=true;deln=performance.now()});
  q.addEventListener('focus',function(){fok=true;gryaz=true});q.addEventListener('blur',function(){fok=false;gryaz=true});
  document.addEventListener('visibilitychange',function(){last=0;medl=0});
  if('IntersectionObserver' in window)new IntersectionObserver(function(z){vidno=z[z.length-1].isIntersecting;sverit()}).observe(cv);
  sverit()}
var txA=null,txB=null,fbA=null,fbB=null,fonN=4,fonI=0,SN=null,fonGr=true,fonStop=false,fonNado=false,mer=false,merHochu=false,merKonec=false,merBg=0,merOb=0,merK=0,zmOb=0;
function tekstura(t,f){gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,WB,HB,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0)}
function fonRis(z){var o=PR.bg;gl.useProgram(o.p);gl.uniform2f(L(o,'uR'),WB,HB);gl.uniform2f(L(o,'uM'),z.mx,z.my);gl.uniform1f(L(o,'uT'),z.T);gl.uniform1f(L(o,'uD'),dark?1:0);
  gl.uniform3f(L(o,'uC'),z.c[0],z.c[1],z.c[2]);gl.uniform3f(L(o,'uK'),ink[0],ink[1],ink[2]);gl.uniform3f(L(o,'uG'),z.g[0],z.g[1],z.g[2]);
  gl.uniform1f(L(o,'uF'),z.F);gl.uniform1f(L(o,'uE'),z.E);gl.uniform1f(L(o,'uP'),z.P);gl.uniform1f(L(o,'uK2'),z.TK);gl.uniform1i(L(o,'uB'),0);
  gl.uniform2f(L(o,'uO'),z.ox,z.oy);gl.uniform1f(L(o,'uS'),z.os);gl.uniform2f(L(o,'uBx'),z.bx,z.by);gl.uniform2f(L(o,'uBs'),z.bw,z.bh);gl.uniform1f(L(o,'uFo'),z.FO);gl.uniform1f(L(o,'uQ'),z.q);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
function razmer(){
  ramka();var d=Math.min(window.devicePixelRatio||1,CW>1400?1.25:1.6),px=CW*CH*d*d;if(px>2.2e6)d*=Math.sqrt(2.2e6/px);d*=kq;
  var w=Math.max(2,Math.round(CW*d)),h=Math.max(2,Math.round(CH*d));
  var kf0=kb*Math.min(1,Math.sqrt(1.05e6/(w*h))),wb=Math.max(2,Math.round(w*kf0)),hb=Math.max(2,Math.round(h*kf0));
  if(w===W&&h===H&&wb===WB&&hb===HB)return;W=w;H=h;WB=wb;HB=hb;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  tekstura(txA,fbA);tekstura(txB,fbB);gl.bindFramebuffer(gl.FRAMEBUFFER,null);fonGr=true;fonI=0;mer=false;
  gryaz=true;tihoDo=performance.now()+700}
function mesto(els,dol){var b=null,i;for(i=0;els&&i<els.length;i++){b=els[i]?els[i].getBoundingClientRect():null;if(b&&b.width)break;b=null}
  if(!b)return null;var k=W/CW;return {x:(b.left-CL+b.width/2)*k,y:(CH-(b.top-CT+b.height/2))*k,s:b.width*dol*k}}
function obshee(o,T){gl.useProgram(o.p);gl.uniform2f(L(o,'uR'),W,H);gl.uniform2f(L(o,'uM'),redu?0:mx,redu?0:my);gl.uniform1f(L(o,'uT'),T);gl.uniform1f(L(o,'uD'),dark?1:0);
  gl.uniform3f(L(o,'uC'),cur[0],cur[1],cur[2]);gl.uniform3f(L(o,'uK'),ink[0],ink[1],ink[2]);gl.uniform3f(L(o,'uG'),curG[0],curG[1],curG[2]);
  gl.uniform1f(L(o,'uF'),F);gl.uniform1f(L(o,'uE'),E);gl.uniform1f(L(o,'uP'),P);gl.uniform1f(L(o,'uK2'),TK);gl.uniform1i(L(o,'uB'),0)}
function predmet(o,m,T,a0,a1,a2,rad,dt){if(!o||!m)return;if(o.al<1){o.al=Math.min(1,o.al+dt*((redu||stat)?99:1.6));gryaz=true}var z=1-o.al;z=1-z*z*z;m={x:m.x,y:m.y,s:m.s*(.86+.14*z)};var r=m.s*rad;if(m.x+r<0||m.x-r>W||m.y+r<0||m.y-r>H)return;
  obshee(o,T);gl.uniform2f(L(o,'uO'),m.x,m.y);gl.uniform1f(L(o,'uS'),m.s);gl.uniform3f(L(o,'uA'),a0,a1,a2);gl.uniform1f(L(o,'uAl'),z);
  var x0=Math.max(0,Math.floor(m.x-r)),y0=Math.max(0,Math.floor(m.y-r)),x1=Math.min(W,Math.ceil(m.x+r)),y1=Math.min(H,Math.ceil(m.y+r));
  gl.scissor(x0,y0,x1-x0,y1-y0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
function kadr(now){raf=requestAnimationFrame(kadr);if(!gl||document.hidden)return;if(zhdut.length)oprosit();if(!PR.bg||!PR.blit)return;var tih=redu||stat,sost=O.sost();ramka();
  var polov=!tih&&now-deln>12000;if(polov&&(chet^=1))return;
  var syr=last?(now-last)/1000:.016,dt=Math.min(.1,Math.max(.001,syr));if(last&&!tih){var zd=(now-last)*(polov?.5:1);if(zd>zmMax)zmMax=zd;zmE=zmE?zmE+(zd-zmE)*.06:zd;zmN++}last=now;
  if(tih){if(!gryaz)return;if(stat&&statN&&now-deln<180)return;statN++;dt=10}gryaz=false;
  var k=1-Math.exp(-dt*5.5),k2=1-Math.exp(-dt*3.2),i;
  var tf=sost.exact?1:sost.focus,ok=sost.exact&&!sost.err?1:0;
  F+=(tf-F)*k;E+=(ok-E)*k2;X+=((sost.err?1:0)-X)*k;FO+=((fok||q.value?1:0)-FO)*k2;TK*=Math.exp(-dt*6);if(TK<.002)TK=0;
  mx+=(tmx-mx)*k2;my+=(tmy-my)*k2;
  var tc=sost.err?warn:accent,tg=sost.err?[okc[0]*.35+.25,okc[1]*.35+.25,okc[2]*.35+.25]:okc;
  for(i=0;i<3;i++){cur[i]+=(tc[i]-cur[i])*k;curG[i]+=(tg[i]-curG[i])*k}
  P=pStart?Math.min(1,(now-pStart)/900):0;if(P>=1)pStart=0;
  var T=tih?12:(now-t0)/1000,kk=W/CW,shir=CW>=1180;
  var r=obj.getBoundingClientRect(),bx=box.getBoundingClientRect();
  var M={x:(r.left-CL+r.width/2)*kk,y:(CH-(r.top-CT+r.height/2))*kk,s:Math.min(r.height*(shir?.50:.40),r.width*.46)*kk*(1+.03*TK)};
  if(!tih&&!zamok&&vse&&now>tihoDo){var dq=polov?syr*.5:syr;if(dq>.075)medl++;else medl=0;if(++kadrov>=probK||medl>=3){kadrov=0;medl=0;merHochu=true}}
  /* 1. фон → текстура. Фон — самая дорогая часть кадра, поэтому он дорисовывается полосами в запасную текстуру
     (одна полоса за кадр, все полосы — с одного «снимка» времени и состояния) и подменяет прежний целиком */
  gl.disable(gl.BLEND);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
  var kf=WB/CW,celik=fonGr||tih||fonN<=1;
  if(SN&&(Math.abs(F-SN.F)>.04||Math.abs(E-SN.E)>.04||Math.abs(FO-SN.FO)>.04))fonNado=true;
  if(fonStop&&!celik&&fonNado&&now-deln>220)celik=true;
  if(celik||!fonStop){
    if(celik||fonI===0){fonI=0;mer=merHochu;merHochu=false;merBg=0;merOb=0;merK=0;
      SN={T:T,mx:redu?0:mx,my:redu?0:my,F:F,E:E,P:P,TK:TK,FO:FO,c:cur.slice(),g:curG.slice(),ox:M.x/kk*kf,oy:M.y/kk*kf,os:M.s/kk*kf,
        bx:(bx.left-CL+bx.width/2)*kf,by:(CH-(bx.top-CT+bx.height/2))*kf,bw:bx.width/2*kf,bh:bx.height/2*kf,q:shir?1:0}}
    var pn=celik?1:fonN,y0=celik?0:Math.floor(HB*fonI/pn),y1=celik?HB:Math.floor(HB*(fonI+1)/pn);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbB);gl.viewport(0,0,WB,HB);gl.enable(gl.SCISSOR_TEST);gl.scissor(0,y0,WB,Math.max(1,y1-y0));fonRis(SN);gl.disable(gl.SCISSOR_TEST);
    if(mer){var z0=performance.now();gl.readPixels(0,y0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pxb);merBg+=performance.now()-z0}
    if(celik||++fonI>=pn){fonI=0;var tt=txA;txA=txB;txB=tt;tt=fbA;fbA=fbB;fbB=tt;fonGr=false;fonNado=false;merKonec=mer}
  }else if(merHochu){mer=true;merHochu=false;merBg=-1;merOb=0;merK=0;merKonec=true}
  /* 2. текстура → экран */
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);gl.bindTexture(gl.TEXTURE_2D,txA);obshee(PR.blit,T);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  /* 3. предметы поверх, с прозрачным краем */
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.SCISSOR_TEST);
  var ish=F>.02&&!sost.exact?1:0,dv=tih?0:1;
  predmet(PR.mark,M,T,0,0,0,1.75,dt);
  predmet(PR.lupa,mesto(O.lupa,.50),T,-.50+dv*(.26*Math.sin(T*.21)+.10*ish*Math.sin(T*2.4))+mx*.35,.20+dv*.09*Math.sin(T*.17)+my*.22,dv*.05*Math.sin(T*.8),1.95,dt);
  predmet(PR.shit,mesto(O.shit,.46),T,(.46+dv*.26*Math.sin(T*.19+1))*(1-E)+X*.75+mx*.35,(.14+dv*.07*Math.sin(T*.23))*(1-E)+my*.22,dv*.05*Math.sin(T*.8+2.1),1.75,dt);
  gl.disable(gl.SCISSOR_TEST);
  /* цена кадра меряется самой видеокартой (чтение одной точки ждёт конца рисования), а не паузой между кадрами:
     браузер сам придерживает кадры у вкладки в фоне, и это не повод рисовать хуже */
  if(mer){var zt=performance.now();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pxb);merOb+=performance.now()-zt;merK++;
    if(merKonec){mer=false;merKonec=false;if(merBg>=0)zmBg=merBg;probN++;ocenka(merOb/merK);zmSt=zmOb+(fonStop?0:zmBg/fonN);if(zmSt>zmStM)zmStM=zmSt;probK=spok>6?240:30}}}
function ocenka(ob){zmOb=ob;
  /* фон: дороже 2 мс — полосами, по одной за кадр; дороже 80 мс — мельче; и тогда дорого — фон стоит и обновляется, когда человек остановился */
  if(zmBg>80&&kb>.45){kb=Math.max(.4,kb*.6);spok=0;razmer();return}
  fonStop=zmBg>80;
  if(zmBg<10&&kb<1){kb=Math.min(1,kb*1.25);spok=0;razmer();return}
  fonN=Math.max(1,Math.min(24,Math.ceil(zmBg/2)));
  /* предметы: дороже 14 мс — мельче; на пределе и дороже 30 мс — сцена замирает резким кадром */
  if(ob>14){if(kq>.52){kq=Math.max(.5,kq*(ob>40?.6:.82));spok=0;razmer();return}if(ob>30){stat=true;kq=.75;kb=Math.max(kb,.6);statN=0;razmer();return}}
  else if(ob<4&&kq<1){kq=Math.min(1,kq*1.12);spok=0;razmer();return}
  spok++}
/* замер для приёмки: цифры этого устройства одной строкой */
function zamer(){var a=[],k;for(k in ZM)a.push(k+' '+ZM[k]+' мс');
  return 'кадров в секунду: '+(stat?'замерло кадром':(zmE?(1000/zmE).toFixed(zmE>100?1:0):0))+' (кадров всего '+zmN+')\nкадр стоит: '+zmSt.toFixed(1)+' мс (предметы '+zmOb.toFixed(1)+' · фон целиком '+zmBg.toFixed(1)+', полос '+(fonStop?'— стоит':fonN)+'), худший '+zmStM.toFixed(1)+' (замеров '+probN+') · самая длинная пауза: '+Math.round(zmMax)+' мс\nсборка: '+a.join(' · ')+(parl?' · без остановки страницы':'')+'\nхолст '+W+'×'+H+' · фон '+WB+'×'+HB+' · качество '+kq.toFixed(2)+' / '+kb.toFixed(2)+'\nблок '+Math.round(CW)+'×'+Math.round(CH)+' · dpr '+(window.devicePixelRatio||1)+'\n'+zmGPU}

start();
return {vkl:function(v){vkl=!!v;if(vkl){gryaz=true;deln=performance.now()}sverit()},puls:puls,tema:tema,zamer:zamer,est:function(){return !!gl}};
};
})();
