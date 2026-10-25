#!/usr/bin/env python3
"""vitrina-v1: «Витрина экосистемы» на главной — из partials/vitrina.json.

Главная 5.0 (ТЗ команды 18.10.2026): после первого экрана и «С чего начнём?» идёт зал экосистемы —
каждый продукт своим экспонатом: сцена с героем (рисунок из набора ниже), статус, одна фраза пользы,
три факта «что умеет», одно действие и ссылка на свою страницу. Будущие продукты — компактно,
«в разработке», без дат. Тексты, порядок и статусы — только в partials/vitrina.json; HTML собирает этот сборщик.

Блок стоит между метками <!--vitrina-->…<!--/vitrina--> в index.html (после секции #vhody).
Внутри: набор рисунков (<svg> с <symbol>), секция #vitrina, JSON-LD ItemList (якоря /#<id>).

Запуск:  python3 tests/sobrat_vitrinu.py           — пересобрать index.html
         python3 tests/sobrat_vitrinu.py --check   — только проверить (код 1, если index.html отстал)
Сторож — tests/vitrina.test.js (CI: node --test).

Ворота содержания (сборка останавливается): id — латиница и уникальны, не совпадают с id страницы;
статус из трёх; ровно три «умеет»; нет «!», цен («₽»), процентов и «ИИ»; ссылка — внутренняя;
герой — из набора; у «в разработке» действие — следить за выходом. Типографика — общий типограф статей.
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import tipograf_statej  # noqa: E402

NACH, KON = "<!--vitrina-->", "<!--/vitrina-->"
POSLE = "</section>"  # первая вставка — сразу после секции #vhody
STATUSY = {
    "zhivoe": "Работает",
    "chast": "Работает, развивается",
    "razrabotka": "В разработке",
}

# Рисунки сцен (ДС: штрих 2, скругления, цвета — переменными темы; внутри <use> работают только наследуемые
# свойства, поэтому цвет задан style="…var(--vg-*)"). viewBox 0 0 200 160 у всех — одна «линза».
A = 'style="fill:var(--vg-a)"'          # акцент
P = 'style="fill:var(--vg-p)"'          # поверхность
S = 'style="fill:var(--vg-s)"'          # мягкий акцент
L = 'fill="none" style="stroke:var(--vg-l)"'  # тонкие линии
N = 'fill="none" style="stroke:var(--vg-a)"'  # линия акцентом
OK = 'style="fill:var(--vg-ok)"'
WR = 'style="fill:var(--vg-warn)"'
BD = 'style="fill:var(--vg-bad)"'
GEROI = {
    "kolco": (
        f'<circle cx="100" cy="80" r="64" {P}/>'
        f'<path d="M67.5 112.5A46 46 0 1 1 132.5 112.5" {L} stroke-width="11"/>'
        f'<path d="M67.5 112.5A46 46 0 1 1 139.6 56.6" {N} stroke-width="11"/>'
        f'<rect x="80" y="70" width="40" height="12" rx="6" {A}/><rect x="87" y="89" width="26" height="6" rx="3" {S}/>'
    ),
    "dokument": (
        f'<rect x="54" y="26" width="84" height="112" rx="8" transform="rotate(-7 96 82)" {S}/>'
        f'<path d="M66 16h52l22 22v100a6 6 0 0 1-6 6H66a6 6 0 0 1-6-6V22a6 6 0 0 1 6-6z" {P}/>'
        f'<path d="M118 16v16a6 6 0 0 0 6 6h16" fill="none"/>'
        f'<path d="M74 56h36M74 70h52M74 84h52M74 98h34" {L} stroke-width="4"/>'
        f'<circle cx="120" cy="122" r="13" {A}/><path d="M114 122l4 4 8-8" fill="none" style="stroke:var(--vg-on)" stroke-width="3"/>'
    ),
    "set": (
        f'<path d="M100 80L46 40M100 80L156 36M100 80L164 98M100 80L120 138M100 80L42 112M100 80L74 18" {L} stroke-width="3"/>'
        f'<circle cx="46" cy="40" r="11" {P}/><circle cx="156" cy="36" r="9" {P}/><circle cx="164" cy="98" r="12" {P}/>'
        f'<circle cx="120" cy="138" r="9" {P}/><circle cx="42" cy="112" r="10" {P}/><circle cx="74" cy="18" r="7" {P}/>'
        f'<circle cx="164" cy="98" r="5" {WR}/><circle cx="46" cy="40" r="5" {OK}/>'
        f'<circle cx="100" cy="80" r="22" {A}/><circle cx="100" cy="80" r="9" style="fill:var(--vg-on)"/>'
    ),
    "moneta": (
        f'<ellipse cx="82" cy="128" rx="44" ry="12" {S}/><ellipse cx="82" cy="116" rx="44" ry="12" {P}/>'
        f'<ellipse cx="82" cy="104" rx="44" ry="12" {P}/><ellipse cx="82" cy="92" rx="44" ry="12" {P}/>'
        f'<circle cx="138" cy="70" r="40" {P}/><circle cx="138" cy="70" r="29" {L} stroke-width="3"/>'
        f'<path d="M130 88V52h12a10 10 0 0 1 0 20h-18M124 80h18" {N} stroke-width="5"/>'
    ),
    "karta": (
        f'<rect x="20" y="24" width="64" height="112" rx="8" {P}/>'
        f'<path d="M32 44h40M32 62h40M32 80h40M32 98h40M32 116h28" {L} stroke-width="4"/>'
        f'<path d="M84 44C120 44 120 34 150 34M84 62C120 62 124 70 160 70M84 98C118 98 122 108 146 112M84 116C116 116 120 140 150 140" {L} stroke-width="2.5"/>'
        f'<circle cx="156" cy="34" r="12" {OK}/><circle cx="166" cy="70" r="12" {OK}/>'
        f'<circle cx="152" cy="112" r="12" {WR}/><circle cx="156" cy="140" r="9" {BD}/>'
    ),
    "shhit": (
        f'<path d="M100 14l56 20v40c0 36-24 62-56 76-32-14-56-40-56-76V34z" {P}/>'
        f'<path d="M100 30l40 14v30c0 26-17 46-40 57" {S}/>'
        f'<path d="M58 82h22l10-22 16 40 10-18h26" {N} stroke-width="6"/>'
    ),
    "radar": (
        f'<circle cx="100" cy="84" r="66" {P}/><circle cx="100" cy="84" r="44" {L} stroke-width="2"/>'
        f'<circle cx="100" cy="84" r="22" {L} stroke-width="2"/>'
        f'<path d="M100 84L100 18A66 66 0 0 1 157 51z" {S}/><path d="M100 84L157 51" {N} stroke-width="4"/>'
        f'<circle cx="130" cy="44" r="7" {A}/><circle cx="64" cy="104" r="6" {WR}/><circle cx="120" cy="118" r="5" {OK}/>'
    ),
    "piramida": (
        f'<rect x="28" y="96" width="24" height="44" rx="5" {P}/><rect x="60" y="74" width="24" height="66" rx="5" {P}/>'
        f'<rect x="92" y="40" width="24" height="100" rx="5" {A}/><rect x="124" y="62" width="24" height="78" rx="5" {P}/>'
        f'<rect x="156" y="86" width="24" height="54" rx="5" {P}/><path d="M20 146h168" {L} stroke-width="3"/>'
        f'<circle cx="104" cy="22" r="9" {OK}/>'
    ),
    "pechat": (
        f'<ellipse cx="100" cy="136" rx="62" ry="14" {S}/><ellipse cx="100" cy="136" rx="40" ry="8" {N} stroke-width="3"/>'
        f'<path d="M64 112h72v14H64z" {P}/><path d="M86 112V76h28v36" {P}/>'
        f'<rect x="76" y="22" width="48" height="58" rx="24" {A}/>'
    ),
    "gazeta": (
        f'<rect x="30" y="22" width="140" height="116" rx="8" {P}/><rect x="44" y="36" width="112" height="16" rx="4" {A}/>'
        f'<rect x="44" y="62" width="50" height="40" rx="4" {S}/>'
        f'<path d="M104 66h52M104 78h52M104 90h40M44 114h112M44 126h80" {L} stroke-width="4"/>'
    ),
    "telefon": (
        f'<rect x="62" y="8" width="76" height="144" rx="16" {P}/><rect x="70" y="22" width="60" height="112" rx="6" {S}/>'
        f'<rect x="78" y="32" width="18" height="18" rx="5" {A}/><rect x="104" y="32" width="18" height="18" rx="5" {P}/>'
        f'<rect x="78" y="58" width="18" height="18" rx="5" {P}/><rect x="104" y="58" width="18" height="18" rx="5" {P}/>'
        f'<path d="M100 88v28M90 106l10 10 10-10" {N} stroke-width="5"/><path d="M92 142h16" {L} stroke-width="4"/>'
    ),
    "linza": (
        f'<rect x="24" y="96" width="18" height="40" rx="4" {P}/><rect x="50" y="72" width="18" height="64" rx="4" {P}/>'
        f'<rect x="76" y="84" width="18" height="52" rx="4" {P}/><path d="M18 142h96" {L} stroke-width="3"/>'
        f'<circle cx="118" cy="66" r="40" {P}/><circle cx="118" cy="66" r="28" {S}/>'
        f'<path d="M104 66l10 10 18-20" {N} stroke-width="6"/><path d="M146 96l28 30" {N} stroke-width="14"/>'
    ),
    "kalendar": (
        f'<rect x="32" y="26" width="136" height="116" rx="12" {P}/><path d="M32 56h136" {L} stroke-width="3"/>'
        f'<rect x="32" y="26" width="136" height="30" rx="12" {S}/><path d="M64 16v22M136 16v22" {N} stroke-width="6"/>'
        f'<path d="M52 76h14M84 76h14M116 76h14M148 76h6M52 98h14M84 98h14M148 98h6M52 120h14M84 120h14M116 120h14" {L} stroke-width="8"/>'
        f'<rect x="112" y="88" width="22" height="20" rx="5" {A}/>'
    ),
    "okno": (
        f'<rect x="20" y="20" width="160" height="120" rx="12" {P}/><path d="M20 44h160" {L} stroke-width="3"/>'
        f'<circle cx="34" cy="32" r="4" {S}/><circle cx="46" cy="32" r="4" {S}/>'
        f'<rect x="34" y="58" width="40" height="66" rx="6" {S}/><rect x="80" y="58" width="40" height="66" rx="6" {S}/>'
        f'<rect x="126" y="58" width="40" height="66" rx="6" {A}/><path d="M42 72h24M88 72h24M134 72h24" {L} stroke-width="4"/>'
    ),
    "shesterni": (
        f'<circle cx="80" cy="88" r="40" {N} stroke-width="14" stroke-dasharray="11 9.94"/>'
        f'<circle cx="80" cy="88" r="34" {P}/><circle cx="80" cy="88" r="12" {S}/>'
        f'<circle cx="138" cy="50" r="26" {N} stroke-width="12" stroke-dasharray="8 8.34"/>'
        f'<circle cx="138" cy="50" r="21" {P}/><circle cx="138" cy="50" r="8" {A}/>'
    ),
}


class Oshibka(Exception):
    pass


def e(s):
    return html.escape(str(s), quote=True)


def t(s):
    """Видимый текст: экранирование + общий типограф статей (неразрывные пробелы, «115‑ФЗ»)."""
    return tipograf_statej.tekst(e(s))


def dannye(put=None):
    with open(put or os.path.join(KOREN, "partials", "vitrina.json"), encoding="utf-8") as f:
        return json.load(f)


ZAPRET = [
    (re.compile(r"!"), "«!»"),
    (re.compile(r"₽|руб\.?(?!\w)|\d\s*%"), "цены и проценты"),
    (re.compile(r"(?<![А-Яа-яЁё])ИИ(?![А-Яа-яЁё])|нейросет", re.I), "ИИ в публичных текстах"),
    (re.compile(r"\b(?:гарантир\w*|100\s*%)", re.I), "обещание исхода"),
]


def proverit(d, html_stranicy=""):
    ex = d.get("eksponaty") or []
    if len(ex) < 2:
        raise Oshibka("vitrina.json: нет экспонатов")
    zanyato = set(re.findall(r'\sid="([^"]+)"', vyrezat(html_stranicy)))
    vidennye = set()
    for x in ex:
        i = x.get("id", "")
        if not re.fullmatch(r"[a-z][a-z0-9-]{1,30}", i):
            raise Oshibka("vitrina.json: id %r — латиница, цифры, дефис" % i)
        if i in vidennye or i in zanyato or i in ("vitrina", "vitrina-h", "vitrina-skoro"):
            raise Oshibka("vitrina.json: id %r уже занят на странице" % i)
        vidennye.add(i)
        if x.get("status") not in STATUSY:
            raise Oshibka("%s: статус %r — один из %s" % (i, x.get("status"), ", ".join(STATUSY)))
        if len(x.get("umeet") or []) != 3:
            raise Oshibka("%s: «умеет» — ровно три факта" % i)
        if x.get("geroj") not in GEROI:
            raise Oshibka("%s: герой %r — нет такого рисунка (%s)" % (i, x.get("geroj"), ", ".join(GEROI)))
        s = x.get("ssylka", "")
        if not s.startswith("/") or s.startswith("//"):
            raise Oshibka("%s: ссылка — только внутренняя, с «/»" % i)
        if not (0 < len(x.get("kratko", "")) <= 18):
            raise Oshibka("%s: kratko — от 1 до 18 знаков" % i)
        if x["status"] == "razrabotka" and "выход" not in x.get("dejstvie", ""):
            raise Oshibka("%s: у продукта в разработке действие — «Следить за выходом» (без сроков)" % i)
        for pole in ("zag", "polza", "dejstvie", "kratko"):
            if not x.get(pole):
                raise Oshibka("%s: пусто поле %s" % (i, pole))
        vse = [x[k] for k in ("zag", "polza", "dejstvie", "kratko")] + list(x["umeet"])
        for kusok in vse:
            for r, chto in ZAPRET:
                if r.search(kusok):
                    raise Oshibka("%s: %s — нельзя (%r)" % (i, chto, kusok))
    # demo-vitrina-v1: показы на /kak-rabotaet/ сами называют свой экспонат (data-eksponat) — ссылка «Как это работает»
    po_id = {x["id"]: x for x in ex}
    for i, pokaz in POKAZY().items():
        if i not in po_id or po_id[i]["status"] == "razrabotka":
            raise Oshibka("kak-rabotaet: показ #%s — экспонат %r не найден или ещё в разработке" % (pokaz, i))
    zal = d.get("zal") or {}
    for k in ("nad", "zag", "lead", "skoro"):
        if not zal.get(k):
            raise Oshibka("vitrina.json: zal.%s пусто" % k)
    if not isinstance(zal.get("ubrat_dubli", False), bool):
        raise Oshibka("vitrina.json: zal.ubrat_dubli — true или false")
    if not all(isinstance(i, str) and re.fullmatch(r"[a-z][a-z0-9-]*", i) for i in zal.get("dubli") or []):
        raise Oshibka("vitrina.json: zal.dubli — список id секций главной")
    cd = d.get("chto_dalshe") or {}
    for r, chto in ZAPRET:
        if r.search(cd.get("tekst", "")) or any(r.search(v) for v in zal.values() if isinstance(v, str)):
            raise Oshibka("zal/chto_dalshe: %s — нельзя" % chto)


def POKAZY(koren=KOREN):
    try:
        with open(os.path.join(koren, "kak-rabotaet", "index.html"), encoding="utf-8") as f:
            # у экспоната может быть несколько показов (vypiska: «Кому вы платите» и «Проверь счёт») — ссылка ведёт на первый
            d = {}
            for i, e in re.findall(r'<section class="kr-d" id="([^"]+)" data-eksponat="([^"]+)"', f.read()):
                d.setdefault(e, i)
            return d
    except OSError:
        return {}


def kak(x):
    pokaz = POKAZY().get(x["id"])
    if not pokaz:
        return ""
    return '<p class="vit-e__go"><a class="vit-lnk" href="/kak-rabotaet/#%s">Как это работает<span aria-hidden="true">→</span></a></p>' % e(pokaz)


def geroj(imya, klass="vit-g"):
    return '<svg class="%s" viewBox="0 0 200 160" aria-hidden="true" focusable="false"><use href="#vg-%s"/></svg>' % (klass, imya)


def nabor(ex):
    nuzhny = []
    for x in ex:
        if x["geroj"] not in nuzhny:
            nuzhny.append(x["geroj"])
    sym = "".join('<symbol id="vg-%s" viewBox="0 0 200 160">%s</symbol>' % (g, GEROI[g]) for g in nuzhny)
    # штрих (цвет, толщина, скругления) наследуется от <svg class="vit-g"> через <use> — css/vitrina.css
    return '<svg class="vit-nabor" width="0" height="0" aria-hidden="true" focusable="false">%s%s</svg>' % (MATERIALY, sym)


# vitrina-v2: материалы героев сцены — объём градиентом при одном свете сверху слева (ДС: цвета — токены темы,
# поэтому stop-color задан style="…var()"). В сцене css/vitrina.css подменяет плоские --vg-p/--vg-a/--vg-s на эти
# градиенты; в карте витрины рисунки остаются плоскими (маленький размер — объём не читается).
def _grad(gid, verh, niz):
    return ('<linearGradient id="%s" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" style="stop-color:%s"/><stop offset="1" style="stop-color:%s"/></linearGradient>') % (gid, verh, niz)


MATERIALY = "<defs>%s%s%s</defs>" % (
    _grad("vg-gp", "var(--vg-p-svet)", "var(--vg-p-ten)"),   # поверхность: бумага/стекло
    _grad("vg-ga", "var(--vg-a-svet)", "var(--vg-a-ten)"),   # акцент: эмаль
    _grad("vg-gs", "var(--vg-s-svet)", "var(--vg-s-ten)"),   # мягкий акцент
)
# Крупные экспонаты (полная сцена) — остальные компактные: ритм зала и короткая витрина на телефоне.
KRUPNYE = {1, 3, 5, 8, 10, 12}


def ssylka(x, klass, tekst_html, vt=True):
    s = x["ssylka"]
    dop = ' data-focus-inn' if s == "/#inn" else ""
    if vt and not s.startswith("/#"):
        dop += ' data-vt'
    return '<a class="%s" href="%s"%s>%s</a>' % (klass, e(s), dop, tekst_html)


def ritm(n_vsego):
    """vitrina-v2b: ритм зала на широком экране — для экспоната n (с 1) классы вида и стороны сцены.
    Крупные (KRUPNYE) — полная строка; компактные подряд — парой в одну строку (две колонки, сцена над текстом);
    одиночный компактный — строка с малой сценой. Сторона сцены чередуется по строкам (пара — одна строка)."""
    vid = {n: ("k" if n in KRUPNYE else "m") for n in range(1, n_vsego + 1)}
    klass, n, stroka = {}, 1, 0
    while n <= n_vsego:
        if vid[n] == "m" and n + 1 <= n_vsego and vid[n + 1] == "m":
            klass[n] = klass[n + 1] = "vit-e--m vit-e--para"
            n += 2
        else:
            klass[n] = "vit-e--%s%s" % (vid[n], " vit-e--sp" if stroka % 2 else "")
            n += 1
        stroka += 1
    return klass


def eksponat(x, n, klass=None):
    st = x["status"]
    umeet = "".join("<li>%s</li>" % t(u) for u in x["umeet"])
    klass = klass or "vit-e--%s" % ("k" if n in KRUPNYE else "m")
    fid = "vf-" + x["id"]
    # сцена — слои глубины (задний ореол, свет, тело героя, пол, частицы, блик): css/vitrina.css, js/vitrina.js
    return (
        '<li class="vit-e %s" id="%s" data-status="%s" data-kratko="%s" data-sobir>' % (klass, e(x["id"]), st, e(x["kratko"])) +
        '<div class="vit-e__scena" data-geroj="%s"><div class="vit-e__zad"></div><div class="vit-e__svet"></div>' % e(x["geroj"]) +
        '<div class="vit-e__tilt">%s</div><div class="vit-e__pol"></div><div class="vit-e__blik"></div></div>' % geroj(x["geroj"]) +
        '<div class="vit-e__txt">'
        '<p class="vit-e__nad"><span class="vit-e__n">%02d</span><span class="vit-st vit-st--%s">%s</span></p>' % (n, st, STATUSY[st]) +
        '<h2 class="vit-e__h">%s</h2>' % ssylka(x, "vit-e__a", t(x["zag"])) +
        '<p class="vit-e__p">%s</p>' % t(x["polza"]) +
        '<ul class="vit-e__u" id="%s">%s</ul>' % (fid, umeet) +
        # «3 факта» — только на узком экране и только со скриптом (js/vitrina.js снимает hidden); без скрипта факты открыты
        '<div class="vit-e__niz"><button type="button" class="vit-e__fb" aria-expanded="false" aria-controls="%s" hidden>'
        'Что умеет<span aria-hidden="true"></span></button>' % fid +
        '<p class="vit-e__go">%s</p>%s</div>' % (ssylka(x, "vit-btn", t(x["dejstvie"]) + '<span aria-hidden="true">→</span>'), kak(x)) +
        '</div></li>'
    )


def budushij(x):
    umeet = "".join("<li>%s</li>" % t(u) for u in x["umeet"])
    return (
        '<li class="vit-b" id="%s" data-status="razrabotka">' % e(x["id"]) +
        '<div class="vit-b__scena" data-geroj="%s">%s</div>' % (e(x["geroj"]), geroj(x["geroj"])) +
        '<h3 class="vit-b__h">%s</h3>' % t(x["zag"]) +
        '<p class="vit-b__p">%s</p><ul class="vit-b__u" id="vf-%s">%s</ul>' % (t(x["polza"]), e(x["id"]), umeet) +
        '<div class="vit-e__niz"><button type="button" class="vit-e__fb" aria-expanded="false" aria-controls="vf-%s" hidden>'
        'Что будет<span aria-hidden="true"></span></button>' % e(x["id"]) +
        '<p class="vit-b__go">%s</p></div>' % ssylka(x, "vit-lnk", t(x["dejstvie"]) + '<span aria-hidden="true">→</span>', vt=False) +
        '</li>'
    )


def ld(ex):
    spisok = [{
        "@type": "ListItem", "position": i + 1, "name": x["zag"],
        "url": "https://deloskop.ru/#" + x["id"], "description": x["polza"],
    } for i, x in enumerate(ex)]
    d = {"@context": "https://schema.org", "@type": "ItemList", "name": "Продукты Делоскопа",
         "itemListOrder": "https://schema.org/ItemListOrderAscending", "numberOfItems": len(spisok),
         "itemListElement": spisok}
    return '<script type="application/ld+json">%s</script>' % json.dumps(d, ensure_ascii=False).replace("</", "<\\/")


def blok(d):
    ex = d["eksponaty"]
    zal = d["zal"]
    zhivye = [x for x in ex if x["status"] != "razrabotka"]
    budushie = [x for x in ex if x["status"] == "razrabotka"]
    karta = "".join(
        '<li><a href="#%s" class="vit-k%s">%s<span>%s</span></a></li>' % (
            e(x["id"]), " vit-k--b" if x["status"] == "razrabotka" else "", geroj(x["geroj"], "vit-k__g"), t(x["kratko"]))
        for x in ex)
    kl = ritm(len(zhivye))
    zalhtml = "".join(eksponat(x, i + 1, kl[i + 1]) for i, x in enumerate(zhivye))
    cd = d.get("chto_dalshe") or {}
    dalshe = ""
    if cd.get("tekst"):
        dalshe = ('<div class="vit-d"><h3 class="vit-d__h">%s</h3><p>%s</p><p><a class="vit-lnk" href="%s">Что нового<span aria-hidden="true">→</span></a></p></div>'
                  % (t(cd.get("zag", "Что дальше")), t(cd["tekst"]), e(cd.get("ssylka", "/obnovleniya/"))))
    skoro = ""
    if budushie:
        skoro = ('<div class="vit-s" aria-labelledby="vitrina-skoro"><h2 class="vit-s__h" id="vitrina-skoro">%s</h2>'
                 '<ul class="vit-s__g" data-sobir>%s</ul>%s</div>') % (t(zal["skoro"]), "".join(budushij(x) for x in budushie), dalshe)
    return (
        NACH + nabor(ex) +
        '<section class="vit" id="vitrina" aria-labelledby="vitrina-h"><div class="wrap">'
        '<header class="vit__head"><p class="eyebrow">%s</p><h2 class="h2" id="vitrina-h">%s</h2><p class="lead">%s</p></header>' % (
            t(zal["nad"]), t(zal["zag"]), t(zal["lead"])) +
        '<nav class="vit__karta" aria-label="Карта витрины"><ul>%s</ul></nav>' % karta +
        '<ol class="vit__zal">%s</ol>%s</div></section>' % (zalhtml, skoro) +
        ld(ex) + KON
    )


def vyrezat(s):
    """Страница без нашего блока — для поиска занятых id."""
    if NACH in s and KON in s:
        a = s.index(NACH)
        return s[:a] + s[s.index(KON, a) + len(KON):]
    return s


# vitrina-v2b: флаг zal.ubrat_dubli — секции главной, которые повторяют экспонаты («С чего начнём?», «Щит»,
# «Почему нам можно верить»), убираются со страницы обратимо: секция оборачивается в <template data-dubli="id">
# (не рисуется и не читается как текст страницы), false — разворачивается обратно. Включать — только после переноса
# их форм в экспонаты и ✓ Арт-директора (ТЗ Штаба 19.10). Ворота: если на id секции (или любой id внутри неё)
# ведут ссылки с других страниц сайта, а на главной вне убранных секций такого id нет — сборка останавливается.
DUBLI = ["vhody", "shield", "doverie"]
OBERTKA = re.compile(r'<template data-dubli="([a-z][a-z0-9-]*)">(<section[\s\S]*?</section>)</template>')


def sekciya(s, i):
    """(начало, конец) секции верхнего уровня с id=i — по парным <section>…</section>."""
    m = re.search(r'<section\b[^>]*\sid="%s"' % re.escape(i), s)
    if not m:
        return None
    glub, poz = 0, m.start()
    for t_ in re.finditer(r'<(/?)section\b', s[m.start():]):
        glub += -1 if t_.group(1) else 1
        if glub == 0:
            kon = s.index(">", m.start() + t_.start()) + 1
            return poz, kon
    raise Oshibka("index.html: секция #%s не закрыта" % i)


def ssylki_na(ids, koren=KOREN):
    """Страницы сайта со ссылками на /#id или #id (для главной) — {id: [файл, …]}."""
    nashli = {}
    for papka, dirs, files in os.walk(koren):
        dirs[:] = [x for x in dirs if not x.startswith(".") and x not in ("node_modules", "tests", "partials")]
        for f in files:
            if not f.endswith(".html"):
                continue
            put = os.path.join(papka, f)
            with open(put, encoding="utf-8") as fh:
                txt = fh.read()
            glavnaya = os.path.relpath(put, koren) == "index.html"
            for i in ids:
                shablon = r'href="(?:https://deloskop\.ru)?/#%s"' % re.escape(i)
                if glavnaya:
                    shablon = r'href="(?:/)?#%s"' % re.escape(i)
                if re.search(shablon, txt):
                    nashli.setdefault(i, []).append(os.path.relpath(put, koren))
    return nashli


def dubli(s, d, koren=KOREN):
    zal = d.get("zal") or {}
    s = OBERTKA.sub(lambda m: m.group(2), s)          # сначала всегда разворачиваем — сборка повторяема
    if not zal.get("ubrat_dubli"):
        return s
    spisok = zal.get("dubli") or DUBLI
    granicy = []
    for i in spisok:
        g = sekciya(s, i)
        if not g:
            raise Oshibka("ubrat_dubli: на главной нет секции #%s" % i)
        granicy.append((i, g))
    vnutri = set()
    for i, (a, z) in granicy:
        vnutri |= set(re.findall(r'\sid="([^"]+)"', s[a:z]))
    ostatok = s
    for i, (a, z) in sorted(granicy, key=lambda x: -x[1][0]):
        ostatok = ostatok[:a] + ostatok[z:]
    ostayutsya = set(re.findall(r'\sid="([^"]+)"', ostatok))
    for i, fajly in ssylki_na(sorted(vnutri), koren).items():
        if i not in ostayutsya:
            raise Oshibka("ubrat_dubli: на #%s ведут ссылки (%s) — сначала перенесите якорь в экспонат" % (i, ", ".join(fajly[:3])))
    for i, (a, z) in sorted(granicy, key=lambda x: -x[1][0]):
        s = s[:a] + '<template data-dubli="%s">' % i + s[a:z] + "</template>" + s[z:]
    return s


def sobrat(s, d, koren=KOREN):
    proverit(d, s)
    b = blok(d)
    if NACH in s:
        a = s.index(NACH)
        z = s.index(KON, a) + len(KON)
        return dubli(s[:a] + b + s[z:], d, koren)
    m = re.search(r'<section class="vhody"[\s\S]*?</section>', s)
    if not m:
        raise Oshibka("index.html: нет секции #vhody — некуда поставить витрину")
    return dubli(s[:m.end()] + "\n\n  " + b + s[m.end():], d, koren)


def main(argv):
    put = os.path.join(KOREN, "index.html")
    with open(put, encoding="utf-8") as f:
        s = f.read()
    try:
        novoe = sobrat(s, dannye())
    except Oshibka as o:
        print("sobrat_vitrinu: " + str(o), file=sys.stderr)
        return 2
    if "--check" in argv:
        if novoe != s:
            print("sobrat_vitrinu: index.html отстал от partials/vitrina.json — запустите python3 tests/sobrat_vitrinu.py", file=sys.stderr)
            return 1
        print("sobrat_vitrinu: витрина совпадает с partials/vitrina.json")
        return 0
    if novoe != s:
        with open(put, "w", encoding="utf-8") as f:
            f.write(novoe)
        print("sobrat_vitrinu: index.html пересобран")
    else:
        print("sobrat_vitrinu: без изменений")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
