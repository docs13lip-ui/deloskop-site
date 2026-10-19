#!/usr/bin/env python3
"""Сборщик общих блоков сайта (claude/Дизайн_система_v1.md §3.1–3.2).

Что делает (идемпотентно, можно запускать сколько угодно раз):
  1. Единый подвал на всех публичных страницах — между <!--podval--> и <!--/podval-->
     (старый <footer>…</footer> страницы удаляется при первом запуске).
  2. Шрифт Onest — со своего сервера: ссылки на fonts.googleapis.com / fonts.gstatic.com
     заменяются на /css/fonts.css (нет передачи IP посетителя за рубеж, 152-ФЗ).
  3. /css/podval.css — стили подвала на токенах из /css/ds.css (токены копируются,
     своих цветов нет), чтобы подвал одинаково выглядел и на старых страницах.
  4. Реквизиты продавца из /rekvizity.json — в подвал и в документы
     (метки <!--r:имя-->…<!--/r--> и <!--rekvizity-->…<!--/rekvizity-->).

  5. Единая ШАПКА (согласована владельцем 26.09; claude/Дизайн_шапка_логотип_и_Скорая_v2.md) —
     /partials/shapka.html между <!--shapka--> и <!--/shapka--> на всех страницах (старые
     <header class="top|hdr">…</header> удаляются при первом запуске); /css/shapka.css собирается из
     /partials/shapka.css + токены ds.css (в области шапки — старые страницы ещё не на ds.css);
     в <head> — /css/shapka.css, /js/shapka.js и /obnovleniya.js (defer); у <main> — id="main"
     (ссылка «Перейти к содержанию»).
     kopiya-v1 (01.10): в <head> ещё /js/kopiya.js (defer) — подпись «Источник: … deloskop.ru · делоскоп.рф»
     при копировании длинного текста.
     pwa-v1 (12.10): в <head> — /manifest.webmanifest, имя для iPhone и /js/pwa.js
     (service worker /sw.js + тихая подсказка «Установить»). offline.html — вне сборки, самодостаточный.

  6. ОТКРЫТАЯ БЕТА (beta-v1, решение владельца 29.09.2026) — флаг tarify/tarify.json → "beta". В бете:
     блоки <!--oplata-->…<!--/oplata--> уходят в <template>, показываются <!--v-bete-->…<!--/v-bete-->;
     полоса /partials/beta.html под шапкой; в подвале и документах — без ИНН и ОГРНИП, даже если
     rekvizity.json заполнен. Флаг false — всё возвращается байт в байт (tests/beta.py, tests/test_beta.py).

  7. ОБЩИЕ ПАКЕТЫ (yadro-v1, 18.10.2026): fonts/podval/shapka/tema.css → один /css/b/ds.<отпечаток>.css,
     shapka/metrika/kopiya/pwa.js и obnovleniya.js → один /js/b/yadro.<отпечаток>.js (те же, что на главной;
     состав — partials/sborka.json). svernut(): только если порядок каскада и исполнения не меняется. Отпечаток
     считается здесь же по только что собранным стилям; python3 tests/sobrat_js.py пишет сами файлы пакетов
     и обновляет отпечаток на всех страницах. Правите исходник пакета — запустите оба.

Запуск: python3 tests/sobrat_shapku.py        — собрать
        python3 tests/sobrat_shapku.py --check — только проверить (код 1, если нужна сборка)
"""
import html
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import beta as BETA  # noqa: E402
import tema_temnaya as TT  # noqa: E402  vizual-v3.0b: тёмный слой стилей страницы

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISKLYUCHIT = {"admin.html", "offline.html"}  # служебная — без подвала; offline.html (pwa-v1) самодостаточный экран «Нет сети»
# Файлы подтверждения прав (Яндекс Вебмастер, Google) — НЕ трогать: любая правка ломает подтверждение.
PODTVERZHDENIE = re.compile(r"^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$")
GOOGLE_FONTS = re.compile(
    r'[ \t]*<link[^>]+href="https://fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>\n?')
FONTS_LINK = '<link rel="stylesheet" href="/css/fonts.css">'
# shrift-v1 (19.10): фирменный шрифт грузится сразу с HTML, а не после разбора стилей — к первой отрисовке он уже есть,
# и текст не перенабирается запасным «Onest Zapas» (прыжок строк при подмене: CLS /indeks/ на холодном кэше, замер Штаба 00:55).
# Кириллица и латиница (пробелы, цифры, знаки — из латинского набора) начертаний 400 и 600: ~44 КБ, нужны любой странице.
SHRIFT_PRELOAD = "\n".join('<link rel="preload" href="/fonts/onest-%s.woff2" as="font" type="font/woff2" crossorigin>' % f
                           for f in ("cyrillic-400", "latin-400", "cyrillic-600"))
GLAVNAYA_CANON = '<link rel="canonical" href="https://deloskop.ru/">'
STARYJ_PRELOAD = re.compile(r'<link rel="preload" href="/fonts/onest-[^"]+" as="font"[^>]*>\n?')
DS_PAKET = re.compile(r'<link rel="stylesheet" href="/css/b/ds\.[0-9a-f]{10}\.css">')
PODVAL_LINK = '<link rel="stylesheet" href="/css/podval.css">'
SHAPKA_LINK = '<link rel="stylesheet" href="/css/shapka.css">'
SHAPKA_JS = '<script src="/js/shapka.js" defer></script>'
OBNOV_JS = '<script src="/obnovleniya.js" defer></script>'
METRIKA_JS = '<script src="/js/metrika.js" defer></script>'
KOPIYA_JS = '<script src="/js/kopiya.js" defer></script>'  # kopiya-v1: подпись-источник при копировании
# yandex-tehnika-v1 (11.10): PNG-значок 120×120 для сниппета Яндекса и лента «Разборов дел» (RSS) — на всех страницах
IKONKA_120 = '<link rel="icon" type="image/png" sizes="120x120" href="/favicon-120.png">'
RSS_LINK = '<link rel="alternate" type="application/rss+xml" title="Разборы дел — Делоскоп" href="/praktika/rss.xml">'
# pwa-v1 (12.10): сайт ставится на телефон как приложение — манифест, иконка iPhone, цвет панели, service worker
MANIFEST_LINK = '<link rel="manifest" href="/manifest.webmanifest">'
APPLE_IMYA = '<meta name="apple-mobile-web-app-title" content="Делоскоп">'
PWA_JS = '<script src="/js/pwa.js" defer></script>'
# vizual-v1 (17.10, «глубина и свет»): последним стилем страницы — тени в три слоя, дышащий фон, стекло
GLUBINA_LINK = '<link rel="stylesheet" href="/css/glubina.css">'
# vizual-v3.0b (18.10): тёмная тема — по системе + переключатель в подвале (решение владельца 18.10 15:38).
# Строка в <head> ставит data-theme на <html> до первой отрисовки (без мигания): выбор из localStorage «tema»
# (light | dark; иначе — как в системе) и цвет панели браузера. Остальное — css/tema.css и js/shapka.js §8.
TEMA_LINK = '<link rel="stylesheet" href="/css/tema.css">'
DETALI_LINK = '<link rel="stylesheet" href="/css/detali.css">'  # detali-v1: переносы и поля касания — последним в пакете «ds»
TEMA_JS = ('<script>!function(d,t){try{t=localStorage.tema}catch(e){}t=t=="auto"?'
           '(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"):t=="light"?t:"dark";d.dataset.theme=t;'
           'if(t=="dark"&&(t=document.querySelector("meta[name=theme-color]")))t.content="#111113"}'
           '(document.documentElement)</script>')
STARAYA_TEMA_JS = re.compile(r'<script>!function\(d,t\)\{try\{t=localStorage\.tema\}[^<]*</script>\n?')
TEMA_PODVAL = ('<div class="tema" data-tema hidden><span class="tema__h" id="tema-h">Тема</span>'
               '<span class="tema__g" role="group" aria-labelledby="tema-h">'
               '<button type="button" data-tema-v="dark" aria-pressed="true">Тёмная</button>'
               '<button type="button" data-tema-v="light" aria-pressed="false">Светлая</button>'
               '<button type="button" data-tema-v="auto" aria-pressed="false">Как в системе</button></span></div>')
STARAYA_SHAPKA = re.compile(r'<header(?: class="(?:top|hdr)")?>.*?</header>\n?', re.S)


def put(*p):
    return os.path.join(KOREN, *p)


def stranicy():
    try:
        vse = subprocess.check_output(["git", "ls-files", "*.html"], cwd=KOREN, text=True).split("\n")
    except Exception:
        vse = []
        for d, _, fs in os.walk(KOREN):
            for f in fs:
                if f.endswith(".html"):
                    vse.append(os.path.relpath(os.path.join(d, f), KOREN))
    novye = []
    for d in ("oferta", "politika", "soglasie", "vozvrat", "rekvizity", "cookies", "rassylki", "partneram/usloviya"):
        if os.path.exists(put(d, "index.html")):
            novye.append(d + "/index.html")
    res = []
    for f in sorted(set(x.strip() for x in vse + novye if x.strip())):
        if f in ISKLYUCHIT or PODTVERZHDENIE.match(f) or f.startswith("partials/") or f.startswith("сайт/") or f.startswith('"') or "/tests/" in f or f.startswith("tests/"):
            continue
        if os.path.exists(put(f)):
            res.append(f)
    return res


def rekv():
    with open(put("rekvizity.json"), encoding="utf-8") as fh:
        r = json.load(fh)
    r["_est"] = bool(r.get("fio") and r.get("inn") and r.get("ogrnip"))
    sv = r.get("sverka_egrip") if r["_est"] and isinstance(r.get("sverka_egrip"), dict) else {}
    # п. 123: только населённый пункт по ЕГРИП; адрес регистрации в шаблоны не выводим никогда
    r["_gorod"] = sv.get("gorod") or ""
    r["_sverka"] = sv if sv.get("data") else {}
    return r


def rekv_sajta():
    """Реквизиты с учётом режима сайта. beta-v1: в открытой бете реквизиты ИП на сайт не выводим (решение
    владельца 29.09.2026), даже если rekvizity.json заполнен. Этим пользуются main() и tests/kartochki.py."""
    r = rekv()
    r["_beta"] = BETA.vklyuchena(KOREN)
    r["_beta_do"] = BETA.beta_do(KOREN)  # beta-data-v1: дата конца беты — одно место, tarify.json
    if r["_beta"]:
        r["_est"] = False
    return r


def e(s):
    return html.escape(str(s or ""), quote=True)


def gorod(r):
    """«г.&nbsp;Липецк» — сокращение не отрывается от названия на узком экране."""
    return re.sub(r"^(г|пгт|рп|п|с|д|х|ст-ца|сл|ст|нп|кп|дп|аул)\. ", r"\1.&nbsp;", e(r.get("_gorod")))


# ---------- подвал ----------
KOLONKI = [
    ("Продукты", [
        ("Проверка по ИНН", "/"), ("Индекс Делоскопа", "/indeks/"), ("Щит", "/#shield"),
        ("Наличные глазами банка", "/nalichnye/"), ("Кому вы платите", "/kontragenty-iz-vypiski/"),
        ("Проверь счёт", "/proverit-schet/"), ("Скорая 115-ФЗ", "/skoraya-115-fz/"),
        ("Паспорт", "/pasport/"), ("Делопись", "/delopis/"), ("Тарифы", "/tarify/")]),
    ("Знания", [
        ("115-ФЗ простыми словами", "/115-fz/"), ("Налоги", "/nalogi/"), ("Что нового", "/obnovleniya/")]),
    ("Компания", [
        ("О проекте", "/o-proekte/"),  # o-proekte-v1 (11.10): миссия, принципы, роли команды, пульс
        ("Методика Индекса", "/indeks/#metodika"), ("Точность Индекса", "/tochnost/"),
        ("Кабинет", "/cabinet.html"), ("Бухгалтерам и партнёрам", "/partneram/"),
        ("Реквизиты и контакты", "/rekvizity/"), ("help@deloskop.ru", "mailto:help@deloskop.ru")]),
    ("Документы", [
        ("Публичная оферта", "/oferta/"), ("Политика обработки ПДн", "/politika/"),
        ("Согласие на обработку ПДн", "/soglasie/"), ("Согласие на рассылки", "/rassylki/"),
        ("Cookies и Метрика", "/cookies/"), ("Возврат денег", "/vozvrat/"),
        ("Условия для партнёров", "/partneram/usloviya/"), ("Реквизиты", "/rekvizity/")]),
]


def podval_html(r):
    cols = []
    for zag, ssylki in KOLONKI:
        # karta-v1: «Компании» — в подвале, только когда хаб карточек уже собран (tests/kartochki.py)
        if zag == "Знания" and os.path.exists(put("company", "index.html")):
            ssylki = ssylki + [("Компании", "/company/")]
        # zhurnal-v1: «Журнал» — в подвале, когда страница /zhurnal/ собрана (tests/sobrat_zhurnal.py)
        if zag == "Знания" and os.path.exists(put("zhurnal", "index.html")):
            ssylki = ssylki + [("Журнал", "/zhurnal/")]
        li = "".join('<li><a href="%s">%s</a></li>' % (e(h), e(t)) for t, h in ssylki)
        cols.append('<nav class="podval__col" aria-label="%s"><p class="podval__h">%s</p><ul>%s</ul></nav>' % (e(zag), e(zag), li))
    stroka = "© 2026 Делоскоп"
    if r["_est"]:
        # rekv-podval-v2 (владелец 11.10): в подвале — только ОГРНИП; ФИО и ИНН — на /oferta/ и /rekvizity/ (ссылка «Реквизиты»)
        stroka += " · ОГРНИП %s" % e(r["ogrnip"])
        if r.get("_gorod"):
            stroka += " · " + gorod(r)
        stroka += ' · <a href="/rekvizity/">Реквизиты</a>'
    return ('<!--podval--><div class="podval" role="contentinfo"><div class="podval__in">'
            '<div class="podval__cols">' + "".join(cols) + '</div>'
            '<div class="podval__niz"><p>' + stroka + '</p>' + TEMA_PODVAL +
            '<p>Сотрудничество, отзывы и предложения — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>. Принимаем 24/7</p>'
            '<p>Материалы носят информационный характер и не заменяют консультацию юриста</p></div>'
            '</div></div><!--/podval-->')


# ---------- шапка ----------
def shapka_html():
    with open(put("partials", "shapka.html"), encoding="utf-8") as fh:
        return "<!--shapka-->\n" + fh.read().strip("\n") + "\n<!--/shapka-->"


def tokeny_ds():
    with open(put("css", "ds.css"), encoding="utf-8") as fh:
        ds = fh.read()
    m = re.search(r":root\{(.*?)\n\}", ds, re.S)
    tok = " ".join(x.strip() for x in m.group(1).split("\n") if x.strip())
    mm = re.search(r"@media \(max-width:640px\)\{:root\{([^}]*)\}\}", ds)
    return tok, (mm.group(1) if mm else "")


def shapka_css():
    tok, mob = tokeny_ds()
    oblast = "a.skip,.shapka,dialog.mnav,.wn-bar,.beta-bar,dialog.dlo,.ck-bar"
    with open(put("partials", "shapka.css"), encoding="utf-8") as fh:
        src = fh.read()
    return ("/* СОБРАНО tests/sobrat_shapku.py из /partials/shapka.css и токенов /css/ds.css — руками не править. */\n"
            + oblast + "{" + tok + "}\n"
            + ("@media (max-width:640px){" + oblast + "{" + mob + "}}\n" if mob else "")
            + src)


# vizual-v3.0a: страница, которая подключает пакет (js/b/<имя>.<отпечаток>.js, css/b/<имя>.<отпечаток>.css —
# tests/sobrat_js.py, partials/sborka.json), уже содержит исходники пакета — отдельный тег не вставляем.
def _pakety_karta():
    try:
        with open(os.path.join(KOREN, "partials", "sborka.json"), encoding="utf-8") as f:
            return json.load(f).get("pakety", {})
    except OSError:
        return {}


PAKETY = _pakety_karta()
PAKET_V_HTML = re.compile(r'/(?:js|css)/b/([a-z0-9-]+)\.[0-9a-f]{10}\.(?:js|css)"')


def est(txt, teg):
    """Тег уже на странице — сам или внутри подключённого пакета."""
    if teg in txt:
        return True
    m = re.search(r'(?:src|href)="/([^"]+)"', teg)
    if not m:
        return False
    for imya in PAKET_V_HTML.findall(txt):
        if m.group(1) in PAKETY.get(imya, ()):
            return True
    return False


# yadro-v1 (18.10, Визуал v3 §7, шаг 2 волны 3.0): общие стили и скрипты каждой страницы — двумя пакетами
# с отпечатком вместо девяти файлов: «ds» (fonts, podval, shapka, tema — css/b/) и «yadro» (shapka, metrika, kopiya,
# pwa, obnovleniya — js/b/). Те же, что на главной: перешёл с главной — оба уже в кэше. Пакет встаёт на место
# первого своего файла (шрифты — только @font-face, их место в каскаде не важно), остальные теги уходят.
# Сворачиваем, только если порядок каскада и исполнения не меняется: между файлами пакета нет чужих стилей
# (кроме glubina.css — на главной тот же порядок) и чужих внешних скриптов. Иначе страница остаётся как была.
SVERNUT = (("ds", "css"), ("yadro", "js"))
ADRESA = {}  # имя пакета → /css|js/b/<имя>.<отпечаток>.*; main() считает по только что собранным стилям


def adres(imya):
    if imya not in ADRESA:
        import sobrat_js as SJ
        ADRESA[imya] = SJ.adres_paketa(imya, KOREN)
    return ADRESA[imya]


def _teg(v, put):
    return ('<link rel="stylesheet" href="/%s">' % put) if v == "css" else ('<script src="/%s" defer></script>' % put)


def _ubrat(txt, teg):
    i = txt.find(teg)
    if i < 0:
        return txt
    j = i + len(teg)
    if txt[j:j + 1] == "\n":
        j += 1
    return txt[:i] + txt[j:]


def svernut(txt):
    """yadro-v1: теги общих файлов → один тег пакета (или обновить отпечаток уже стоящего)."""
    for imya, v in SVERNUT:
        fajly = PAKETY.get(imya)
        if not fajly:
            continue
        nov = adres(imya)
        star = re.compile(r"/%s/b/%s\.[0-9a-f]{10}\.%s" % (v, re.escape(imya), v))
        tegi = [_teg(v, f) for f in fajly]
        if star.search(txt):
            txt = star.sub(nov, txt)
            for t in tegi:  # остатки, если кто-то вставил файл пакета руками
                txt = _ubrat(txt, t)
            continue
        if not all(t in txt for t in tegi):
            continue
        konec_head = txt.find("</head>")
        poz = {t: txt.find(t) for t in tegi}
        if v == "css":
            if any(p > konec_head for p in poz.values()):
                continue
            yakor = min(p for t, p in poz.items() if "fonts.css" not in t)
            kusok = txt[yakor:max(poz.values())]
            chuzhie = [h for h in re.findall(r'<link rel="stylesheet" href="([^"]+)"', kusok)
                       if h not in ["/" + f for f in fajly] + ["/css/glubina.css"]]
            if chuzhie or "<style" in kusok:
                continue
        else:
            v_head = [p for p in poz.values() if p < konec_head]
            if not v_head:
                continue
            yakor = min(v_head)
            kusok = txt[yakor:max(v_head)]
            chuzhie = [m for m in re.findall(r'<script[^>]*\ssrc="([^"]+)"', kusok) if m not in ["/" + f for f in fajly]]
            if chuzhie:
                continue
        paket = _teg(v, nov.lstrip("/"))
        txt = txt[:yakor] + "\0PAKET\0" + txt[yakor:]
        for t in tegi:
            txt = _ubrat(txt, t)
        txt = txt.replace("\0PAKET\0", paket + "\n", 1)
    return txt


def vstavit_shapku(txt, shapka):
    if "<!--shapka-->" in txt:
        txt = re.sub(r"<!--shapka-->.*?<!--/shapka-->", lambda m: shapka, txt, count=1, flags=re.S)
    else:
        m = STARAYA_SHAPKA.search(txt)
        if m:
            txt = txt[:m.start()] + shapka + "\n" + txt[m.end():]
        else:
            b = re.search(r"<body[^>]*>\n?", txt)
            txt = txt[:b.end()] + shapka + "\n" + txt[b.end():]
    # <head>: стили и скрипты шапки
    if not est(txt, SHAPKA_LINK):
        txt = txt.replace("</head>", SHAPKA_LINK + "\n</head>", 1)
    if not est(txt, SHAPKA_JS):
        txt = txt.replace("</head>", SHAPKA_JS + "\n</head>", 1)
    if not est(txt, OBNOV_JS):
        txt = txt.replace("</head>", OBNOV_JS + "\n</head>", 1)
    if not est(txt, METRIKA_JS):
        txt = txt.replace("</head>", METRIKA_JS + "\n</head>", 1)
    if not est(txt, KOPIYA_JS):
        txt = txt.replace("</head>", KOPIYA_JS + "\n</head>", 1)
    if IKONKA_120 not in txt:
        txt = txt.replace("</head>", IKONKA_120 + "\n</head>", 1)
    if RSS_LINK not in txt:
        txt = txt.replace("</head>", RSS_LINK + "\n</head>", 1)
    # pwa-v1: apple-touch-icon и theme-color — в <head> самих страниц (у карточек из API они свои; условная
    # вставка сломала бы равенство оболочки API и сборщика — tests/test_kartochki.py, TestObolochka)
    if MANIFEST_LINK not in txt:
        txt = txt.replace("</head>", MANIFEST_LINK + "\n</head>", 1)
    if APPLE_IMYA not in txt:
        txt = txt.replace("</head>", APPLE_IMYA + "\n</head>", 1)
    if not est(txt, PWA_JS):
        txt = txt.replace("</head>", PWA_JS + "\n</head>", 1)
    if not est(txt, GLUBINA_LINK):
        txt = txt.replace("</head>", GLUBINA_LINK + "\n</head>", 1)
    if not est(txt, TEMA_LINK):
        txt = txt.replace("</head>", TEMA_LINK + "\n</head>", 1)
    if not est(txt, DETALI_LINK):  # сразу за tema.css (glubina.css остаётся последним)
        txt = txt.replace(TEMA_LINK, TEMA_LINK + "\n" + DETALI_LINK, 1) if TEMA_LINK in txt else txt.replace("</head>", DETALI_LINK + "\n</head>", 1)
    if TEMA_JS not in txt:
        txt = STARAYA_TEMA_JS.sub("", txt)  # прежняя строка темы (другое умолчание) — заменяем
        txt = txt.replace("</head>", TEMA_JS + "\n</head>", 1)
    # цель ссылки «Перейти к содержанию»
    txt = svernut(txt)
    if 'id="main"' not in txt:
        mm = re.search(r"<main(?=[\s>])([^>]*)>", txt)
        if mm and " id=" not in mm.group(1):
            txt = txt[:mm.start()] + '<main id="main"' + mm.group(1) + ">" + txt[mm.end():]
        else:
            txt = txt.replace("<!--/shapka-->", '<!--/shapka-->\n<span id="main" tabindex="-1"></span>', 1)
    return txt


def podval_css():
    with open(put("css", "ds.css"), encoding="utf-8") as fh:
        ds = fh.read()
    m = re.search(r":root\{(.*?)\n\}", ds, re.S)
    tokeny = " ".join(x.strip() for x in m.group(1).split("\n") if x.strip())
    return ("/* СОБРАНО tests/sobrat_shapku.py из /css/ds.css — руками не править. Подвал §3.2 дизайн-системы. */\n"
            ".podval{" + tokeny + "}\n"
            ".podval{background:var(--surface);border-top:1px solid var(--line);color:var(--muted);font:400 var(--t-small)/1.5 var(--font);margin-top:var(--s-8);padding:var(--s-8) 0 var(--s-7);text-align:left}\n"
            ".podval *{box-sizing:border-box}\n"
            ".podval__in{max-width:calc(var(--wide) + 2*var(--gutter));margin:0 auto;padding:0 var(--gutter)}\n"
            ".podval__cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--s-6)}\n"
            ".podval .podval__h{margin:0 0 var(--s-3);color:var(--ink);font:600 var(--t-small)/1.4 var(--font)}\n"
            ".podval ul{list-style:none;margin:0;padding:0}\n"
            ".podval li{margin:0 0 var(--s-2);padding:0}.podval li::before{content:none}\n"
            ".podval nav,.podval ul,.podval li,.podval p,.podval a{position:static;float:none;width:auto;height:auto;min-height:0;border:0;box-shadow:none;background:none;text-transform:none;letter-spacing:normal;overflow:visible}\n"
            ".podval p{font-size:inherit;line-height:inherit}\n"
            ".podval a{display:inline;padding:0;border-radius:0;font:inherit;color:var(--ink-2);text-decoration:none}.podval a:hover{color:var(--accent);background:none}\n"
            ".podval a:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}\n"
            ".podval__niz{display:flex;justify-content:space-between;gap:var(--s-3) var(--s-6);flex-wrap:wrap;margin-top:var(--s-7);padding-top:var(--s-5);border-top:1px solid var(--line);font-size:var(--t-caption);line-height:1.4}\n"
            ".podval .podval__niz p{margin:0;color:var(--muted);font-size:var(--t-caption)}\n"
            "@media (max-width:900px){.podval__cols{grid-template-columns:repeat(2,minmax(0,1fr))}}\n"
            "@media (max-width:640px){.podval{padding:var(--s-7) 0 var(--s-6)}.podval__cols{gap:var(--s-5) var(--s-4)}.podval li{margin-bottom:var(--s-3)}}\n"
            "@media print{.podval{display:none}}\n")


# ---------- реквизиты в документах ----------
def ispolnitel(r):
    if r["_est"]:
        mesto = (", место нахождения — " + gorod(r)) if r.get("_gorod") else ""
        return "индивидуальный предприниматель %s (ОГРНИП %s, ИНН %s%s)" % (e(r["fio"]), e(r["ogrnip"]), e(r["inn"]), mesto)
    # rekv-v1: пока в rekvizity.json пусто — js/rekvizity.js подставит данные из админки (GET /api/rekvizity),
    # не дожидаясь пересборки; при следующей сборке tests/rekvizity_iz_api.py запишет их сюда статично.
    return ('<span data-rekv="ispolnitel">индивидуальный предприниматель, сведения о котором указаны в разделе '
            '<a href="/rekvizity/">«Реквизиты»</a></span>')


def tablica(r):
    if r.get("_beta"):
        return ('<div class="note" data-rekv="beta">Идёт открытая бета: Делоскоп работает бесплатно, оплата на сайте '
                'не принимается, поэтому реквизиты продавца здесь пока не публикуем. Они появятся до того, как мы начнём '
                'принимать оплату. Вопросы — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</div>')
    if not r["_est"]:
        return ('<div class="note" data-rekv="tablica">Реквизиты продавца появятся здесь сразу после государственной регистрации '
                'индивидуального предпринимателя. До этого оплата на сайте не принимается. '
                'Вопросы — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</div>'
                '<script src="/js/rekvizity.js" defer></script>')
    stroki = [("Продавец", "Индивидуальный предприниматель " + e(r["fio"])), ("ИНН", e(r["inn"])),
              ("ОГРНИП", e(r["ogrnip"]))]
    if r.get("data_registracii") or r.get("organ_registracii"):
        stroki.append(("Регистрация", (e(r.get("data_registracii")) + ", " + e(r.get("organ_registracii"))).strip(", ")))
    if r.get("_gorod"):
        stroki.append(("Место нахождения", gorod(r) + " — по ЕГРИП"))
    if r.get("adres_dlya_pisem"):
        stroki.append(("Адрес для писем и претензий", e(r["adres_dlya_pisem"])))
    for b in r.get("banki", []):
        if b.get("rs"):
            stroki.append(("Счёт в " + e(b["bank"]), "р/с %s, БИК %s, к/с %s" % (e(b["rs"]), e(b["bik"]), e(b["ks"]))))
    stroki.append(("Электронная почта", '<a href="mailto:%s">%s</a>' % (e(r["email"]), e(r["email"]))))
    if r.get("telefon"):
        stroki.append(("Телефон", e(r["telefon"])))
    if r.get("rkn_reestr_nomer"):
        stroki.append(("Реестр операторов ПДн", "№ " + e(r["rkn_reestr_nomer"])))
    stroki.append(("НДС", "Без НДС — УСН, освобождение по п.&nbsp;1 ст.&nbsp;145 НК&nbsp;РФ"))
    sv = r.get("_sverka") or {}
    if sv:
        # п. 126: продавец проверяет себя сам — тем же сервисом, что и контрагентов
        stroki.append(("Сверено с ЕГРИП", e(sv["data"]) + " — " + e(sv.get("sovpalo") or "ИНН, ОГРНИП и статус") +
                       ' совпадают. Проверили себя тем же сервисом, что и ваших контрагентов: '
                       '<a href="/report.html?inn=' + e(r["inn"]) + '">открыть проверку</a>'))
    tr = "".join("<tr><td>%s</td><td>%s</td></tr>" % s for s in stroki)
    return '<div class="table-wrap"><table class="table"><tbody>' + tr + "</tbody></table></div>"


def sobrat_stranicu(txt, r, podval, shapka=None):
    # 1) шрифты со своего сервера
    if GOOGLE_FONTS.search(txt):
        txt = GOOGLE_FONTS.sub("", txt)
    if not est(txt, FONTS_LINK):
        txt = txt.replace("</head>", FONTS_LINK + "\n</head>", 1)
    if not est(txt, PODVAL_LINK):
        txt = txt.replace("</head>", PODVAL_LINK + "\n</head>", 1)
    # 2) подвал
    if "<!--podval-->" in txt:
        txt = re.sub(r"<!--podval-->.*?<!--/podval-->", lambda m: podval, txt, count=1, flags=re.S)
    else:
        txt, n = re.subn(r"<footer[\s>].*?</footer>\n?", "", txt, count=1, flags=re.S)
        i = txt.rfind("</body>")  # последний </body>: в скриптах страниц бывает строка "</body>"
        txt = txt[:i] + podval + "\n" + txt[i:]
    # 3) шапка
    if shapka:
        txt = vstavit_shapku(txt, shapka)
    # 4) реквизиты
    txt = re.sub(r"<!--r:ispolnitel-->.*?<!--/r-->", lambda m: "<!--r:ispolnitel-->" + ispolnitel(r) + "<!--/r-->", txt, flags=re.S)
    txt = re.sub(r"<!--r:gorod-->.*?<!--/r-->",
                 lambda m: "<!--r:gorod-->" + ((" (" + gorod(r) + ")") if r.get("_gorod") else "") + "<!--/r-->", txt, flags=re.S)
    txt = re.sub(r"<!--rekvizity-->.*?<!--/rekvizity-->", lambda m: "<!--rekvizity-->" + tablica(r) + "<!--/rekvizity-->", txt, flags=re.S)
    # 5) открытая бета: оплата ↔ «в бете бесплатно», метка режима, полоса под шапкой
    txt = BETA.primenit(txt, r.get("_beta", False), bdo=r.get("_beta_do"))
    # 6) vizual-v3.0b: тёмная тема — цвета, записанные числом в <style> страницы, получают тёмную пару
    #    (<style data-tema> в <head>; tests/tema_temnaya.py). Правки стилей страницы — пересобрать.
    txt = TT.dlya_stranicy(txt)
    # 7) shrift-v1: предзагрузка шрифта — последней строкой <head> и после всех вставок: так страница, собранная заново
    #    (kartochki perepechatat, сборщики разделов), и пересобранная sobrat_shapku совпадают байт в байт
    txt = STARYJ_PRELOAD.sub("", txt)
    if GLAVNAYA_CANON not in txt:  # главная — без предзагрузки: подмена шрифта там не двигает строки (CLS 0,000),
        # а ожидание шрифта задержало бы первый экран (+~250 мс на 4G, замер shrift-v1).
        # Перед </head>, как остальные вставки: карточки из API надевают ту же оболочку (TestObolochka); сканер
        # предзагрузки браузера видит ссылку, пока разбирается <head>, — место в <head> на скорость не влияет.
        m = DS_PAKET.search(txt)  # до стилей пакета ds: запрос шрифта уходит раньше, чем разбор стилей его потребует
        i = m.start() if m and m.start() < txt.find("</head>") else txt.find("</head>")
        txt = txt[:i] + SHRIFT_PRELOAD + "\n" + txt[i:]
    return txt


OBOLOCHKA_JSON = ("partials", "obolochka.json")
PROBA = ('<!doctype html>\n<html lang="ru">\n<head>\n</head>\n<body>\n<!--shapka--><!--/shapka-->\n'
         '<main id="main"></main>\n</body>\n</html>\n')


def obolochka(r, podval, shapka):
    """obolochka-v1: шапка, подвал и режим беты для карточек из API (/company/ со ступени 2).

    Собираем пустую страницу той же sobrat_stranicu и вырезаем три вставки: что добавилось перед </head>,
    что встало на место метки шапки, что добавилось перед </body>. API надевает их на карточку
    (kartochka_render.nadet_obolochku) — без копии сборщика и partials. render — отпечаток модуля
    отрисовки: API с другой версией tests/kartochka_render.py карточки не отдаёт (503), а не рисует по-старому."""
    import hashlib
    s = sobrat_stranicu(PROBA, r, podval, shapka)
    a = s.index("<head>\n") + len("<head>\n")
    head = s[a:s.index("</head>")]
    b = s.index("<body>\n") + len("<body>\n")
    shap = s[b:s.index("\n<main")]
    c = s.index("</main>\n") + len("</main>\n")
    podv = s[c:s.rindex("</body>")]
    with open(put("tests", "kartochka_render.py"), "rb") as fh:
        otp = hashlib.sha256(fh.read().replace(b"\r\n", b"\n")).hexdigest()[:16]
    ob = {"versiya": 1, "beta": bool(r.get("_beta")), "beta_do": r.get("_beta_do"), "render": otp, "head": head, "shapka": shap, "podval": podv}
    return json.dumps(ob, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def main():
    check = "--check" in sys.argv
    r = rekv_sajta()
    podval = podval_html(r)
    shapka = shapka_html()
    izmeneno = []
    gotovye = {"podval.css": podval_css(), "shapka.css": shapka_css()}
    # vizual-v3.0b: авто-слой тёмной темы для общих стилей — в css/tema.css между /*<avto>*/ и /*</avto>*/
    ist = {}
    for f in TT.FAJLY:
        imya = f.split("/")[-1]
        if imya in gotovye:
            ist[f] = gotovye[imya]
        elif os.path.exists(put(f)):
            ist[f] = open(put(f), encoding="utf-8").read()
    for f in sorted(os.listdir(put("js"))) + ["../obnovleniya.js"]:
        if f.endswith(".js") and os.path.isfile(put("js", f)):
            ist[os.path.normpath("js/" + f)] = open(put("js", f), encoding="utf-8").read()
    tp = put("css", "tema.css")
    gotovye["tema.css"] = TT.tema_css(KOREN, open(tp, encoding="utf-8").read(), ist)
    for imya, css in gotovye.items():
        cp = put("css", imya)
        stary = open(cp, encoding="utf-8").read() if os.path.exists(cp) else ""
        if stary != css:
            izmeneno.append("css/" + imya)
            if not check:
                with open(cp, "w", encoding="utf-8") as fh:
                    fh.write(css)
    # yadro-v1: адреса общих пакетов — по стилям, которые только что собраны (при --check они ещё не на диске)
    import sobrat_js as SJ
    zam = {"css/" + imya: css for imya, css in gotovye.items()}
    for imya, _v in SVERNUT:
        if imya in PAKETY:
            ADRESA[imya] = SJ.adres_paketa(imya, KOREN, zam)
    op = put(*OBOLOCHKA_JSON)
    ob = obolochka(r, podval, shapka)
    stary = open(op, encoding="utf-8").read() if os.path.exists(op) else ""
    if stary != ob:
        izmeneno.append("/".join(OBOLOCHKA_JSON))
        if not check:
            with open(op, "w", encoding="utf-8") as fh:
                fh.write(ob)
    for f in stranicy():
        with open(put(f), encoding="utf-8") as fh:
            txt = fh.read()
        nov = sobrat_stranicu(txt, r, podval, shapka)
        if nov != txt:
            izmeneno.append(f)
            if not check:
                with open(put(f), "w", encoding="utf-8") as fh:
                    fh.write(nov)
    if check:
        if izmeneno:
            print("Нужна сборка: " + ", ".join(izmeneno))
            sys.exit(1)
        print("Шапка, подвал и реквизиты собраны на всех страницах")
    else:
        print("Собрано: %d файлов" % len(izmeneno) + ("" if not izmeneno else " — " + ", ".join(izmeneno)))


if __name__ == "__main__":
    main()
