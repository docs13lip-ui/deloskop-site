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

Запуск: python3 tests/sobrat_shapku.py        — собрать
        python3 tests/sobrat_shapku.py --check — только проверить (код 1, если нужна сборка)
"""
import html
import json
import os
import re
import subprocess
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISKLYUCHIT = {"admin.html"}  # служебная страница — без публичного подвала
# Файлы подтверждения прав (Яндекс Вебмастер, Google) — НЕ трогать: любая правка ломает подтверждение.
PODTVERZHDENIE = re.compile(r"^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$")
GOOGLE_FONTS = re.compile(
    r'[ \t]*<link[^>]+href="https://fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>\n?')
FONTS_LINK = '<link rel="stylesheet" href="/css/fonts.css">'
PODVAL_LINK = '<link rel="stylesheet" href="/css/podval.css">'
SHAPKA_LINK = '<link rel="stylesheet" href="/css/shapka.css">'
SHAPKA_JS = '<script src="/js/shapka.js" defer></script>'
OBNOV_JS = '<script src="/obnovleniya.js" defer></script>'
METRIKA_JS = '<script src="/js/metrika.js" defer></script>'
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
    return r


def e(s):
    return html.escape(str(s or ""), quote=True)


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
        ("Методика Индекса", "/indeks/#metodika"), ("Кабинет", "/cabinet.html"),
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
        li = "".join('<li><a href="%s">%s</a></li>' % (e(h), e(t)) for t, h in ssylki)
        cols.append('<nav class="podval__col" aria-label="%s"><p class="podval__h">%s</p><ul>%s</ul></nav>' % (e(zag), e(zag), li))
    stroka = "© 2026 Делоскоп"
    if r["_est"]:
        stroka += " · ИП %s · ИНН %s · ОГРНИП %s" % (e(r["fio"]), e(r["inn"]), e(r["ogrnip"]))
    return ('<!--podval--><div class="podval" role="contentinfo"><div class="podval__in">'
            '<div class="podval__cols">' + "".join(cols) + '</div>'
            '<div class="podval__niz"><p>' + stroka + '</p>'
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
    oblast = "a.skip,.shapka,dialog.mnav,.wn-bar,dialog.dlo,.ck-bar"
    with open(put("partials", "shapka.css"), encoding="utf-8") as fh:
        src = fh.read()
    return ("/* СОБРАНО tests/sobrat_shapku.py из /partials/shapka.css и токенов /css/ds.css — руками не править. */\n"
            + oblast + "{" + tok + "}\n"
            + ("@media (max-width:640px){" + oblast + "{" + mob + "}}\n" if mob else "")
            + src)


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
    if SHAPKA_LINK not in txt:
        txt = txt.replace("</head>", SHAPKA_LINK + "\n</head>", 1)
    if SHAPKA_JS not in txt:
        txt = txt.replace("</head>", SHAPKA_JS + "\n</head>", 1)
    if OBNOV_JS not in txt:
        txt = txt.replace("</head>", OBNOV_JS + "\n</head>", 1)
    if METRIKA_JS not in txt:
        txt = txt.replace("</head>", METRIKA_JS + "\n</head>", 1)
    # цель ссылки «Перейти к содержанию»
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
        return "индивидуальный предприниматель %s (ОГРНИП %s, ИНН %s)" % (e(r["fio"]), e(r["ogrnip"]), e(r["inn"]))
    return ('индивидуальный предприниматель, сведения о котором указаны в разделе '
            '<a href="/rekvizity/">«Реквизиты»</a>')


def tablica(r):
    if not r["_est"]:
        return ('<div class="note">Реквизиты продавца появятся здесь сразу после государственной регистрации '
                'индивидуального предпринимателя. До этого оплата на сайте не принимается. '
                'Вопросы — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</div>')
    stroki = [("Продавец", "Индивидуальный предприниматель " + e(r["fio"])), ("ИНН", e(r["inn"])),
              ("ОГРНИП", e(r["ogrnip"]))]
    if r.get("data_registracii") or r.get("organ_registracii"):
        stroki.append(("Регистрация", (e(r.get("data_registracii")) + ", " + e(r.get("organ_registracii"))).strip(", ")))
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
    stroki.append(("НДС", "Без НДС — УСН, освобождение по п. 1 ст. 145 НК РФ"))
    tr = "".join("<tr><td>%s</td><td>%s</td></tr>" % s for s in stroki)
    return '<div class="table-wrap"><table class="table"><tbody>' + tr + "</tbody></table></div>"


def sobrat_stranicu(txt, r, podval, shapka=None):
    # 1) шрифты со своего сервера
    if GOOGLE_FONTS.search(txt):
        txt = GOOGLE_FONTS.sub("", txt)
    if FONTS_LINK not in txt:
        txt = txt.replace("</head>", FONTS_LINK + "\n</head>", 1)
    if PODVAL_LINK not in txt:
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
    txt = re.sub(r"<!--rekvizity-->.*?<!--/rekvizity-->", lambda m: "<!--rekvizity-->" + tablica(r) + "<!--/rekvizity-->", txt, flags=re.S)
    return txt


def main():
    check = "--check" in sys.argv
    r = rekv()
    podval = podval_html(r)
    shapka = shapka_html()
    izmeneno = []
    for imya, css in (("podval.css", podval_css()), ("shapka.css", shapka_css())):
        cp = put("css", imya)
        stary = open(cp, encoding="utf-8").read() if os.path.exists(cp) else ""
        if stary != css:
            izmeneno.append("css/" + imya)
            if not check:
                with open(cp, "w", encoding="utf-8") as fh:
                    fh.write(css)
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
