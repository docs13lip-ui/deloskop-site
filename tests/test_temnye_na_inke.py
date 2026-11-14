"""Тёмная тема: белый текст на фоне var(--ink) не пропадает (temnye-na-inke-v1, 07.11.2026).
Запуск из корня: python3 tests/test_temnye_na_inke.py

Фон var(--ink) в тёмной теме светлеет (#F5F1E6), и белый текст на нём сливался с фоном: номера шагов
«Что сделать завтра утром» в «Разборах», «Шаги» на /pasport/, нажатые кнопки на /indeks/ и /tarify/,
тост на главной. Авто-слой (tests/tema_temnaya.py) переводит такой текст в #081229 — как белый на синем.

Проверяем:
  • правило: var(--ink) + белый → #081229; var(--ink-2) и var(--dark) не трогаем; полупрозрачный белый — та же
    прозрачность;
  • весь сайт: каждый селектор, где в исходных стилях фон var(--ink) и белый текст, получил тёмный цвет текста
    в слое темы (css/tema.css или <style data-tema> своей страницы).
"""
import os
import re
import sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, "tests"))
import tema_temnaya as TT  # noqa: E402

n = 0


def ok(name, cond, extra=""):
    global n
    if not cond:
        print("✗", name, extra)
        sys.exit(1)
    n += 1
    print("✓", name)


p = TT.pravila(".a::before{background:var(--ink);color:#fff}")
ok("белый на var(--ink) → #081229", "[data-theme=dark] .a::before{color:#081229}" in p, p)
p = TT.pravila(".a{color:rgba(255,255,255,.7);background:var(--ink)}")
ok("полупрозрачный белый — та же прозрачность", "rgba(8,18,41,0.7)" in p, p)
ok("var(--ink-2) не трогаем", TT.pravila(".a{background:var(--ink-2);color:#fff}") == "")
ok("var(--dark) не трогаем (в тёмной теме он чёрный)", TT.pravila(".a{background:var(--dark);color:#fff}") == "")
ok("белый на синем — как было", "#081229" in TT.pravila(".a{background:#12305F;color:#fff}"))

BELYJ = re.compile(r"(?:^|;)\s*color\s*:\s*(?:#fff\b|#ffffff\b|white\b|rgba?\(\s*255\s*,\s*255\s*,\s*255)", re.I)
INK = re.compile(r"background(?:-color)?\s*:[^;]*var\(--ink\)")


def iskhodnye(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        sel, telo = m.group(1).strip(), m.group(2)
        if sel.startswith("@") or "[data-theme" in sel:
            continue
        if INK.search(telo) and BELYJ.search(";" + telo):
            yield sel


def proverit(sel, sloj, gde):
    pervyj = TT._razdelit_selektory(sel)[0]
    x = TT._selektor(pervyj)
    ok("%s: %s" % (gde, pervyj), x and re.search(re.escape(x) + r"\{[^}]*color:(?:#081229|rgba\(8,18,41)", sloj),
       "в слое темы нет тёмного текста")


tema = open(os.path.join(R, "css", "tema.css"), encoding="utf-8").read()
vsego = 0
for f in TT.FAJLY:
    pf = os.path.join(R, f)
    if os.path.exists(pf):
        for sel in iskhodnye(open(pf, encoding="utf-8").read()):
            proverit(sel, tema, f)
            vsego += 1
STIL = re.compile(r"<style(?![^>]*data-tema)[^>]*>(.*?)</style>", re.S)
for kor, papki, fajly in os.walk(R):
    papki[:] = [p for p in papki if not p.startswith((".", "node_modules"))]
    for fn in fajly:
        if not fn.endswith(".html"):
            continue
        pf = os.path.join(kor, fn)
        txt = open(pf, encoding="utf-8").read()
        sloj = "".join(re.findall(r"<style data-tema>(.*?)</style>", txt, re.S))
        for m in STIL.finditer(txt):
            for sel in iskhodnye(m.group(1)):
                proverit(sel, sloj, os.path.relpath(pf, R))
                vsego += 1
ok("нашли хотя бы номера шагов и /pasport/ (поиск работает)", vsego >= 5, str(vsego))
print("Готово: %d проверок" % n)
