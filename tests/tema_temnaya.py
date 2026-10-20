#!/usr/bin/env python3
"""Тёмная тема без ручного перекрашивания (vizual-v3.0b, 18.10.2026; решение владельца 18.10 15:38).

Зачем: цвета на сайте живут в трёх местах — токены (--bg, --ink, …), стили в /css/*.css и стили в <style>
самих страниц (их больше 80, у каждой страницы свои). Токены тёмной темы — вручную в /css/tema.css.
Всё, где цвет записан числом (#fff, rgba(255,255,255,.7), #EAF1FD…), этот модуль переводит в тёмную пару
по одному правилу и пишет отдельным слоем: для /css/*.css — в /css/tema.css между метками
/*<avto>*/…/*</avto>*/, для <style> страницы — в её же <head>, блок <style data-tema>…</style>
(правила страницы действуют только на ней — переносить их в общий файл нельзя: у разных страниц один класс
значит разное). Светлая тема не меняется ни на байт видимого: все правила — под [data-theme=dark].

Правило перевода (одно на весь сайт, без ручных исключений):
  фон и рамки: светлый нейтральный → поверхность #1C1C1F / #19191C / #26262A, фон страницы #F5F5F2 → #111113;
               светлый с оттенком → плашка того же смысла (синий → #16243D, зелёный → #0F2A1C,
               жёлтый → #2E220C, оранжевый → #35190D, красный → #3A1513); тёмный полупрозрачный
               (рамки rgba(29,29,31,.06)) → светлый полупрозрачный; фирменный синий → #5B9BFF;
  текст:       тёмный нейтральный → #F5F5F2 / #C7C7CC / #A1A1A6 по яркости; фирменный и цвета риска →
               светлые пары из css/tema.css; белый текст на фирменном синем → #0B0B0C (ДС v1 §2.5 --on-accent);
  тени:        светлые блики (inset белым) → почти прозрачные.
Прозрачность сохраняется. Пользуется tests/sobrat_shapku.py (каждая страница при сборке) — отдельного шага нет.

Запуск отдельно: python3 tests/tema_temnaya.py файл.css — показать, что получится.
"""
import colorsys
import re
import sys

DARK = "[data-theme=dark]"
# классы, которые ставятся на <html> (тот же элемент, что [data-theme]): index.html (rezhim-otcheta, zhdu-js, est-js),
# js/zhivoj-indeks.js (zhi-io), js/shapka.js (tema-vt, tema-ik, is-locked) — сверяет tests/zhivoj_otchet.test.js
KORNEVYE = ("rezhim-otcheta", "zhdu-js", "est-js", "zhi-io", "tema-vt", "tema-ik", "is-locked")
KORNEVOJ = re.compile(r"\.(?:" + "|".join(KORNEVYE) + r")(?![\w-])")
# токены, которые задаёт css/tema.css руками (общие имена ДС v1 и старых страниц) — их не трогаем
TOKENY_RUKAMI = {
    "--bg", "--surface", "--surface-2", "--card", "--soft", "--ink", "--ink-2", "--ink2", "--muted", "--off", "--na",
    "--rule", "--line", "--line-2", "--accent", "--accent-hover", "--accent-soft", "--on-accent", "--ok", "--ok-bg",
    "--okbg", "--ok-dot", "--warn", "--warn-bg", "--warnbg", "--warn-dot", "--high", "--high-bg", "--or", "--bad",
    "--bad-bg", "--badbg", "--bad-dot", "--dark", "--dark2", "--shadow",
}
SVOJSTVA = re.compile(r"^(?:background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-start|-end)?)?(?:-color)?"
                      r"|outline(?:-color)?|color|box-shadow|fill|stroke|text-decoration(?:-color)?|caret-color|accent-color"
                      r"|column-rule(?:-color)?|--[\w-]+)$")
CVET = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^()]*\)|\bwhite\b", re.I)

# точные пары фирменных цветов и цветов риска (те же, что в css/tema.css)
TEKST = {
    "0b63e5": "#5B9BFF", "084bb0": "#8AB8FF", "0952c2": "#8AB8FF", "0a58cc": "#8AB8FF",
    "16723f": "#4CC38A", "137a3e": "#4CC38A", "1a7f45": "#4CC38A",
    "9a5b00": "#E8A23A", "8a5a00": "#E8A23A", "b86e00": "#E8A23A", "a15c00": "#E8A23A",
    "c2410c": "#FF8F57", "b3261e": "#FF7B72", "b42318": "#FF7B72",
}
FON_TOCHNO = {"f5f5f2": (17, 17, 19), "0b63e5": (91, 155, 255), "084bb0": (138, 184, 255)}


def razobrat(s):
    s = s.strip().lower()
    if s == "white":
        return (255, 255, 255, 1.0)
    if s.startswith("#"):
        h = s[1:]
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    m = re.match(r"rgba?\(([^)]*)\)", s)
    if not m:
        return None
    p = [x for x in re.split(r"[\s,/]+", m.group(1)) if x]
    if len(p) < 3 or any("%" in x for x in p[:3]):
        return None
    try:
        r, g, b = (float(x) for x in p[:3])
        a = float(p[3].rstrip("%")) / (100 if p[3].endswith("%") else 1) if len(p) > 3 else 1.0
    except ValueError:
        return None
    return (r, g, b, a)


def hexkey(c):
    return "%02x%02x%02x" % tuple(int(round(x)) for x in c[:3])


def yarkost(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def ottenok(c):
    """(тон в градусах, насыщенность 0–1) — для выбора плашки того же смысла."""
    h, l, s = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
    return h * 360, (max(c[:3]) - min(c[:3])) / 255


def plashka(c):
    ton, chrom = ottenok(c)
    if chrom < 0.04:
        return None
    if 190 <= ton < 260:
        return (22, 36, 61)       # синий → --accent-soft
    if 90 <= ton < 190:
        return (15, 42, 28)       # зелёный → --ok-bg
    if 36 <= ton < 90:
        return (46, 34, 12)       # жёлтый → --warn-bg
    if 16 <= ton < 36:
        return (53, 25, 13)       # оранжевый → --high-bg
    if ton < 16 or ton >= 330:
        return (58, 21, 19)       # красный → --bad-bg
    return (36, 27, 58)           # фиолетовый


def zapis(rgb, a):
    r, g, b = (int(round(x)) for x in rgb)
    if a >= 0.999:
        return "#%02X%02X%02X" % (r, g, b)
    return "rgba(%d,%d,%d,%s)" % (r, g, b, ("%.3f" % a).rstrip("0").rstrip("."))


def perevesti(c, rol, na_akcente=False):
    """Тёмная пара для цвета c. rol: 'fon' | 'ramka' | 'tekst' | 'ten'. None — оставить как есть."""
    a = c[3]
    L = yarkost(c)
    k = hexkey(c)
    ton, chrom = ottenok(c)
    if rol == "tekst":
        if k in TEKST:
            return zapis(razobrat(TEKST[k])[:3], a)
        if L > 0.8:  # светлый текст: остаётся, кроме белого на фирменном синем
            return zapis((11, 11, 12), a) if na_akcente else None
        if chrom < 0.08 and L < 0.35:
            return zapis((245, 245, 242) if L < 0.03 else (199, 199, 204) if L < 0.1 else (161, 161, 166), a)
        if chrom >= 0.08 and L < 0.35:  # тёмный цветной текст → светлый того же тона
            h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in c[:3]))
            r, g, b = colorsys.hls_to_rgb(h, 0.72, min(1, s))
            return zapis((r * 255, g * 255, b * 255), a)
        return None
    if rol == "ten":
        if L > 0.6:  # светлые блики и обводки в тенях
            return zapis((255, 255, 255), min(a, 1) * 0.1)
        return None
    # фон и рамки
    if k in FON_TOCHNO and a >= 0.999 and rol == "fon":
        return zapis(FON_TOCHNO[k], a)
    if L > 0.45:
        p = plashka(c)
        if p:
            return zapis(p if rol == "fon" else tuple(min(255, x + 22) for x in p), a)
        if rol == "ramka":
            return zapis((46, 46, 51) if L > 0.6 else (72, 72, 78), a)
        if L >= 0.97:
            return zapis((28, 28, 31), a)
        if L >= 0.88:
            return zapis((17, 17, 19) if k == "f5f5f2" else (25, 25, 28), a)
        return zapis((38, 38, 42), a)
    if chrom < 0.08 and L < 0.03 and a < 0.4:  # тёмные полупрозрачные рамки и подложки → светлые
        return zapis((255, 255, 255), min(1, a * 1.4 + 0.02))
    if k in FON_TOCHNO:
        return zapis(FON_TOCHNO[k], a)
    return None


def rol_svojstva(sv):
    if sv == "color" or sv in ("fill", "caret-color") or sv.startswith("text-decoration"):
        return "tekst"
    if sv == "box-shadow":
        return "ten"
    if sv.startswith("border") or sv.startswith("outline") or sv.startswith("column-rule") or sv == "stroke":
        return "ramka"
    return "fon"


def perevesti_znachenie(sv, zn, na_akcente):
    if "var(" in zn and not CVET.search(re.sub(r"var\([^()]*\)", "", zn)):
        return None
    rol = rol_svojstva(sv)
    if sv.startswith("--"):  # свой токен страницы: по имени (тени) или по яркости (светлый — фон, тёмный — текст)
        rol = "ten" if "shadow" in sv else None
    izm = [False]

    def zam(m):
        if m.start() > 0 and zn[max(0, m.start() - 1)] == ",":  # запасное значение var(--x,#fff) — токен решает
            pre = zn[:m.start()]
            if pre.count("var(") > pre.count(")"):
                return m.group(0)
        c = razobrat(m.group(0))
        if not c:
            return m.group(0)
        r = rol or ("fon" if yarkost(c) > 0.45 else "tekst")
        n = perevesti(c, r, na_akcente)
        if n is None:
            return m.group(0)
        izm[0] = True
        return n
    nov = CVET.sub(zam, zn)
    return nov if izm[0] else None


def _bez_kommentariev(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _bloki(css):
    """Разбор верхнего уровня: [(заголовок, тело)] — правило или at-правило с телом."""
    res, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            break
        zag = css[i:j].strip()
        d, k = 1, j + 1
        while k < n and d:
            if css[k] == "{":
                d += 1
            elif css[k] == "}":
                d -= 1
            k += 1
        telo = css[j + 1:k - 1]
        if ";" in zag and not zag.startswith("@"):  # @import/@charset и т. п. перед правилом
            zag = zag.rsplit(";", 1)[1].strip()
        elif zag.startswith("@") and ";" in zag and not zag.lower().startswith(("@media", "@supports", "@layer", "@container")):
            zag = zag.rsplit(";", 1)[1].strip()
        res.append((zag, telo))
        i = k
    return res


def _selektor(s):
    s = s.strip()
    if not s:
        return s
    if s.startswith(":root"):
        return ":root" + DARK + s[5:]
    if re.match(r"html\b", s):
        return "html" + DARK + s[4:]
    if s.startswith(DARK) or s.startswith("[data-theme"):
        return None
    # zhivoj-v2: класс, который скрипты ставят на сам <html> (rezhim-otcheta — по «Проверить», до ответа API),
    # стоит на том же элементе, что и [data-theme] — «[data-theme=dark] .rezhim-otcheta» его не находит. На живом
    # 19.10: пока шёл запрос, липкая полоса формы в тёмной теме была светлой (245,245,242) со светлым текстом.
    if KORNEVOJ.match(s):
        return DARK + " " + s + "," + DARK + s
    return DARK + " " + s


def _razdelit_selektory(zag):
    res, d, cur = [], 0, ""
    for ch in zag:
        if ch in "([":
            d += 1
        elif ch in ")]":
            d -= 1
        if ch == "," and d == 0:
            res.append(cur)
            cur = ""
        else:
            cur += ch
    res.append(cur)
    return [x.strip() for x in res if x.strip()]


def _deklaracii(telo):
    res, d, cur = [], 0, ""
    for ch in telo:
        if ch == "(":
            d += 1
        elif ch == ")":
            d -= 1
        if ch == ";" and d == 0:
            res.append(cur)
            cur = ""
        else:
            cur += ch
    res.append(cur)
    out = []
    for x in res:
        if ":" not in x:
            continue
        sv, zn = x.split(":", 1)
        out.append((sv.strip().lower() if not sv.strip().startswith("--") else sv.strip(), zn.strip()))
    return out


def _semya(sv):
    """Семья свойства: border-right и border — одна (сброс «border-right:0» гасит рамку из «border»)."""
    for k in ("border", "outline", "background", "column-rule", "text-decoration"):
        if sv.startswith(k):
            return k
    return sv


def _perevedennye(css, nabor):
    """(селектор, семья) всех объявлений, которым тёмный слой даёт свой цвет, — во всём куске, с @media."""
    for zag, telo in _bloki(css):
        zl = zag.lower()
        if zl.startswith(("@media", "@supports", "@container", "@layer")):
            if not ("print" in zl and "screen" not in zl):
                _perevedennye(telo, nabor)
            continue
        if zl.startswith("@"):
            continue
        dekl = _deklaracii(telo)
        fon = " ".join(zn for sv, zn in dekl if sv.startswith("background")).lower()
        na_akcente = bool(re.search(r"#0b63e5|#084bb0|#0952c2|var\(--[\w-]*acc", fon))
        for sv, zn in dekl:
            if SVOJSTVA.match(sv) and sv not in TOKENY_RUKAMI and not sv.startswith("--"):
                if perevesti_znachenie(sv, re.sub(r"\s*!important$", "", zn, flags=re.I), na_akcente) is not None:
                    for s in _razdelit_selektory(zag):
                        nabor.add((s, _semya(sv)))
    return nabor


def pravila(css, _nabor=None):
    """Тёмный слой для куска CSS — строка CSS (может быть пустой).

    detali-отчёт (19.10): правило тёмного слоя сильнее обычного на атрибут [data-theme], поэтому сброс того же
    свойства ниже по каскаду (чаще всего — в @media для телефона: «.ex-ix{border-right:0}») в тёмной теме
    проигрывал — на 390 у кольца Индекса висела рамка-сирота. Теперь слой повторяет под [data-theme=dark] и такие
    объявления, если для того же селектора и той же семьи свойства слой уже дал свой цвет: порядок каскада
    в тёмной теме тот же, что в светлой."""
    if _nabor is None:
        css = _bez_kommentariev(css)
        _nabor = _perevedennye(css, set())
    out = []
    for zag, telo in _bloki(css):
        zl = zag.lower()
        if zl.startswith(("@media", "@supports", "@container", "@layer")):
            if "print" in zl and "screen" not in zl:
                continue
            vnutri = pravila(telo, _nabor)
            if vnutri:
                out.append(zag + "{" + vnutri + "}")
            continue
        if zl.startswith("@"):
            continue  # @keyframes, @font-face, @page
        dekl = _deklaracii(telo)
        fon = " ".join(zn for sv, zn in dekl if sv.startswith("background")).lower()
        na_akcente = bool(re.search(r"#0b63e5|#084bb0|#0952c2|var\(--[\w-]*acc", fon))
        nov, povtor = [], {}
        sels = _razdelit_selektory(zag)
        for sv, zn in dekl:
            if not SVOJSTVA.match(sv) or sv in TOKENY_RUKAMI:
                continue
            vazhno = ""
            if zn.lower().endswith("!important"):
                zn, vazhno = zn[:-10].strip(), "!important"
            p = perevesti_znachenie(sv, zn, na_akcente)
            if p is not None:
                nov.append(sv + ":" + p + vazhno)
            elif not sv.startswith("--"):
                for s in sels:  # сброс без цвета — повторить там, где слой перекрасил ту же семью
                    if (s, _semya(sv)) in _nabor:
                        povtor.setdefault(s, []).append(sv + ":" + zn + vazhno)
        if nov:
            sel = [x for x in (_selektor(s) for s in sels) if x]
            if sel:
                out.append(",".join(sel) + "{" + ";".join(nov) + "}")
        for s, d in povtor.items():
            x = _selektor(s)
            if x:
                out.append(x + "{" + ";".join(d) + "}")
    return "".join(out)


# ---------- страницы ----------
ATRIBUT = re.compile(r'\sstyle="([^"<>]*)"')


def atributy(html_tela):
    """Цвета в атрибутах style="" (их мало: значки уровней в таблицах) — правило по точному значению атрибута;
    !important нужен, потому что атрибут style сильнее любого правила без него."""
    out, bylo = [], set()
    for m in ATRIBUT.finditer(html_tela):
        zn = m.group(1)
        if zn in bylo or not CVET.search(zn):
            continue
        bylo.add(zn)
        dekl = _deklaracii(zn)
        fon = " ".join(z for s, z in dekl if s.startswith("background")).lower()
        na_akcente = bool(re.search(r"#0b63e5|#084bb0|var\(--[\w-]*acc", fon))
        nov = []
        for sv, z in dekl:
            if SVOJSTVA.match(sv):
                z = re.sub(r"\s*!important$", "", z)
                pz = perevesti_znachenie(sv, z, na_akcente)
                if pz is not None:
                    nov.append(sv + ":" + pz + "!important")
        if nov:
            out.append(DARK + ' [style="' + zn.replace("\\", "\\\\").replace('"', '\\"') + '"]{' + ";".join(nov) + "}")
    return "".join(out)

STIL_STRANICY = re.compile(r"<style(?![^>]*data-tema)[^>]*>(.*?)</style>", re.S)
BLOK = re.compile(r"\n?<style data-tema>.*?</style>", re.S)


def dlya_stranicy(txt):
    """Вставить/обновить <style data-tema> в <head> по стилям самой страницы."""
    golova = txt[:txt.find("</head>")] if "</head>" in txt else ""
    css = "\n".join(m.group(1) for m in STIL_STRANICY.finditer(BLOK.sub("", golova)))
    # стили в <body> страницы тоже её
    telo = txt[len(golova):]
    css += "\n" + "\n".join(m.group(1) for m in STIL_STRANICY.finditer(telo) if "<template" not in telo[:m.start()][-200:])
    p = pravila(css) + atributy(telo)
    txt = BLOK.sub("", txt, count=1) if "<style data-tema>" in golova else txt
    if p:
        txt = txt.replace("</head>", "<style data-tema>" + p + "</style>\n</head>", 1)
    return txt


# ---------- общие файлы ----------
FAJLY = ["css/ds.css", "css/shapka.css", "css/podval.css", "css/glubina.css", "css/vizual2.css", "css/otchet.css",
         "css/co.css", "css/acc.css", "css/praktika.css", "css/zhurnal.css", "css/reyting.css", "css/paket.css", "css/pusto.css"]
METKI = re.compile(r"/\*<avto>\*/.*?/\*</avto>\*/", re.S)


LITERAL = r"""(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)"""
CEPOCHKA = re.compile(LITERAL + r"(?:\s*\+\s*" + LITERAL + r")*")


def css_iz_js(js):
    """Стили, которые скрипт вставляет сам (строки CSS, склеенные «+»): склеиваем соседние строки и берём
    только похожие на CSS (селектор{свойство:значение})."""
    out = []
    for m in CEPOCHKA.finditer(js):
        kuski = re.findall(LITERAL, m.group(0))
        s = "".join(k[1:-1] for k in kuski).replace("\\'", "'").replace('\\"', '"')
        if "{" in s and "}" in s and re.search(r"[\w\])*-]\s*\{[^{}]*:[^{}]*\}", s) and re.match(r"\s*[.#@\[:a-zA-Z*]", s):
            out.append(s)
    return "\n".join(out)


def tema_css(koren, tekushchij, istochniki):
    """Новый текст css/tema.css: ручная часть + авто-слой из общих файлов (istochniki — {путь: текст};
    js/*.js — стили, которые вставляют скрипты)."""
    sloj = "".join(pravila(istochniki[f]) for f in FAJLY if f in istochniki)
    sloj += "".join(pravila(css_iz_js(istochniki[f])) for f in sorted(istochniki) if f.endswith(".js"))
    blok = ("/*<avto>*/\n/* СОБРАНО tests/tema_temnaya.py (зовёт sobrat_shapku) из " + ", ".join(FAJLY) +
            " — руками не править. */\n" + sloj.replace("}", "}\n") + "/*</avto>*/")
    if METKI.search(tekushchij):
        return METKI.sub(lambda m: blok, tekushchij, count=1)
    return tekushchij.rstrip("\n") + "\n" + blok + "\n"


if __name__ == "__main__":
    for f in sys.argv[1:]:
        print(pravila(open(f, encoding="utf-8").read()).replace("}", "}\n"))
