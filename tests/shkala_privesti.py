#!/usr/bin/env python3
"""detali-v1b (19.10.2026, [Ночные запуски]): приводит размеры шрифта и радиусы в исходниках к шкале.
Шрифт (px): 11–12 → 12; 12,5–13,5 → 13; 14–15,5 → 15; 16–18 → 17; 19–21 → 20; 22–26 → 24; 28–38 → 32; 40–48 → 48 (крупнее — не трогает).
Радиус (px): 10–12 → 10; 14–20 → 16; 22–32 → 28; от 40 → 999; меньше 10 — не трогает.
Запуск из корня сайта: python3 tests/shkala_privesti.py — повторный запуск ничего не меняет. После — обычная сборка.
Нужен, когда в main пришли стили не по шкале (сторож tests/shkala_radiusy.test.js) или при конфликте сборки."""
import re,subprocess,sys
SH={11:12,11.5:12,12:12,12.5:13,13:13,13.5:13,14:15,14.5:15,15:15,15.5:15,16:17,16.5:17,17:17,18:17,19:20,20:20,21:20,22:24,24:24,25:24,26:24,28:32,30:32,32:32,34:32,36:32,38:32,40:48,44:48,46:48,48:48}
def rad(n):
    if n<10: return None
    if n<=12: return 10
    if n<=20: return 16
    if n<=32: return 28
    return 999
def fs(n):
    return SH.get(n)
def num(s): 
    v=float(s); return int(v) if v==int(v) else v
def fmt(v): return ('%g'%v)
stat={'fs':0,'r':0}
def snap_fs_val(val):
    def rep(m):
        n=num(m.group(1)); t=fs(n)
        if t is None or t==n: return m.group(0)
        stat['fs']+=1; return fmt(t)+'px'
    return re.sub(r'(?<![\d.])(\d+(?:\.\d+)?)px', rep, val)
def snap_r_val(val):
    def rep(m):
        n=num(m.group(1)); t=rad(n)
        if t is None or t==n: return m.group(0)
        stat['r']+=1; return fmt(t)+'px'
    return re.sub(r'(?<![\d.])(\d+(?:\.\d+)?)px', rep, val)
def obrabotat(t):
    t=re.sub(r'(font-size\s*:\s*)([^;}"\'\n]+)', lambda m: m.group(1)+snap_fs_val(m.group(2)), t)
    t=re.sub(r'(--t-[a-z0-9-]+\s*:\s*)([^;}"\'\n]+)', lambda m: m.group(1)+snap_fs_val(m.group(2)), t)
    # font shorthand: первый размер (перед / или пробелом и семейством)
    def font_sh(m):
        v=m.group(2)
        mm=re.search(r'(?<![\d.])(\d+(?:\.\d+)?)px(?=\s*/|\s+[A-Za-z"\'v-])', v)
        if not mm: return m.group(0)
        n=num(mm.group(1)); tt=fs(n)
        if tt is None or tt==n: return m.group(0)
        stat['fs']+=1
        return m.group(1)+v[:mm.start()]+fmt(tt)+'px'+v[mm.end():]
    t=re.sub(r'((?<![-\w])font\s*:\s*)([^;}"\'\n]+)', font_sh, t)
    t=re.sub(r'(border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*)([^;}"\'\n]+)', lambda m: m.group(1)+snap_r_val(m.group(2)), t)
    t=re.sub(r'(--r(?:-[a-z]+)?\s*:\s*)(\d+(?:\.\d+)?px)', lambda m: m.group(1)+snap_r_val(m.group(2)), t)
    return t
files=subprocess.run(['git','ls-files'],capture_output=True,text=True).stdout.split('\n')
ch=0
for f in files:
    if not re.search(r'\.(css|html|js|py|json)$',f) or f.startswith(('css/b/','js/b/','tests/')) and not f.endswith('.py') : continue
    if f.endswith('.test.js') or f.startswith('tests/test_') or 'zamer' in f or f in ('tests/shkala_privesti.py', 'css/vitrina.css'): continue  # витрину ведёт vitrina-v2 (19.10) — приведёт к шкале сам
    if f.endswith('.json') and not f.startswith('partials/'): continue
    try: t=open(f,encoding='utf-8').read()
    except Exception: continue
    n=obrabotat(t)
    if n!=t: open(f,'w',encoding='utf-8').write(n); ch+=1
print('файлов',ch,stat)
