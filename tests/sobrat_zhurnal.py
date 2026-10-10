#!/usr/bin/env python3
"""Журнал «Делоскоп · Неделя» (zhurnal-v1; решение владельца 10.10.2026, устав —
claude/Решения_владельца_10.10_Журнал_Делоскопа_еженедельник.md). Один исходник — три формы.

Исходник выпуска: data/zhurnal/<nomer>.json (nomer — «ГГГГ-НН», номер недели ISO).
  1. Страница /zhurnal/<nomer>/ — полный текст, шапка и подвал сайта (sobrat_shapku), печатный CSS A4.
  2. Письмо — HTML с инлайн-стилями (≤ 3 500 знаков текста) + текстовая версия; ссылки «Читать дальше»
     с utm; на месте ссылки отписки — метка {{otpiska}} (подставляет API для каждого адресата).
  3. PDF — та же страница, напечатанная Chromium (Playwright), ≤ 2 МБ.

Запуск:
  python3 tests/sobrat_zhurnal.py                   — собрать /zhurnal/ (список) и страницы опубликованных выпусков
  python3 tests/sobrat_zhurnal.py --check           — только проверить (код 1, если нужна сборка)
  python3 tests/sobrat_zhurnal.py 2026-42 [--out DIR] [--pdf]
                                                    — собрать выпуск: страница, письмо, текст письма (+ PDF) в DIR
  python3 tests/sobrat_zhurnal.py 2026-42 --v-sajt  — опубликовать PDF: напечатать выпуск в zhurnal/<nomer>/deloskop-nedelya-<nomer>.pdf
                                                    и пересобрать страницы (ссылка «PDF для печати» появится сама)
Выпуск с "obrazec": true на сайт НЕ попадает: его страница собирается только в DIR и с noindex.
DIR по умолчанию — ../zhurnal-sborka/<nomer>/ рядом с папкой сайта (не в репозитории).

zhurnal-v1.1 (10.10.2026, решение владельца 04:35 п. 2): рубрика «Делобух: бухгалтерия недели» — с № 1
(поле "delobuh": 2–5 дел недели, у каждого — зачем, первоисточник и, если есть, инструмент сайта);
на странице выпуска — ссылка «PDF для печати» (A4, страниц, размер), если PDF лежит рядом со страницей.
"""
import datetime
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sobrat_shapku as SH  # noqa: E402
from sobrat_praktika import tipograf, nerazryv, data_ru, kroshki_ld, kroshki_html  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAJT = "https://deloskop.ru"
NAZVANIE = "Делоскоп · Неделя"
NADZAG = "Журнал Делоскопа"
PISMO_MAKS = 3500
PDF_MAKS = 2 * 1024 * 1024
KRATKO_MAKS = 220

# Первоисточники (устав, п. 4) + реестры и ведомства. СМИ — только в "ukazatel", рядом с первоисточником.
DOMENY = ("consultant.ru", "pravo.gov.ru", "vsrf.ru", "ksrf.ru", "nalog.gov.ru", "cbr.ru", "kad.arbitr.ru",
          "regulation.gov.ru", "sozd.duma.gov.ru", "minfin.gov.ru", "economy.gov.ru", "fedsfm.ru",
          "fedresurs.ru", "bankrot.fedresurs.ru", "egrul.nalog.ru", "zakupki.gov.ru", "fssp.gov.ru",
          "garant.ru", "government.ru", "kremlin.ru")
STATUSY = {"prinyat": "", "proekt": "Проект — не принят", "sobytie": ""}

# Рубрики устава (п. 3) — порядок постоянный. (ключ в JSON, якорь, заголовок, подпись под заголовком)
RUBRIKI = [
    ("glavnoe", "glavnoe", "Главное за неделю", ""),
    ("bank115", "115-fz", "115-ФЗ и банки", "ЗСК, блокировки, практика банков"),
    ("nalogi", "nalogi", "Налоги", "НК РФ, письма ФНС и Минфина, приказы"),
    ("sudy", "sudy", "Суды", "Одно дело — один вывод для вашего платежа"),
    ("vokrug", "vokrug", "Вокруг компаний", "Банкротства, ликвидации, события недели"),
    ("razbor", "razbor", "Разбор дела", "Текст команды Делоскопа"),
    ("sroki", "sroki", "Сроки недели", "Что и до какого числа"),
    ("delobuh", "delobuh", "Делобух: бухгалтерия недели", "Что сделать до следующей пятницы — по пунктам"),
    ("novoe", "novoe", "Что нового в Делоскопе", ""),
    ("kommentarij", "kommentarij", "Комментарий команды", ""),
]
NOVOSTNYE = ("bank115", "nalogi", "sudy", "vokrug")
DELOBUH_MIN, DELOBUH_MAKS = 2, 5
DELO_MAKS = 120  # «что сделать» — одна строка чек-листа, в письме тоже


def put(*p):
    return os.path.join(KOREN, *p)


def e(s):
    return html.escape(str(s or ""), quote=True)


def t(s):
    """Текст с типографикой: экранирование + неразрывные пробелы (как в Разборах)."""
    return tipograf(e(s))


# ---------- данные ----------
def vypuski():
    d = put("data", "zhurnal")
    if not os.path.isdir(d):
        return []
    res = []
    for f in sorted(os.listdir(d)):
        if re.match(r"^\d{4}-\d{2}\.json$", f):
            with open(os.path.join(d, f), encoding="utf-8") as fh:
                res.append(json.load(fh))
    return res


def vypusk(nomer):
    p = put("data", "zhurnal", nomer + ".json")
    if not os.path.exists(p):
        raise SystemExit("sobrat_zhurnal: нет файла data/zhurnal/%s.json" % nomer)
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def domen_ok(url):
    m = re.match(r"^https://([^/]+)/", url or "")
    if not m:
        return False
    h = m.group(1).lower()
    return any(h == d or h.endswith("." + d) for d in DOMENY)


def oshibki(V):
    """Схема выпуска. Пустой список — всё в порядке. Тот же список проверяет tests/zhurnal.test.js."""
    o = []
    nomer = V.get("nomer", "")
    if not re.match(r"^\d{4}-\d{2}$", nomer):
        o.append("nomer — «ГГГГ-НН»")
    try:
        d = datetime.date.fromisoformat(V.get("data", ""))
        if d.weekday() != 4:
            o.append("data %s — не пятница (устав, п. 1: выпуск по пятницам)" % d)
        if "%d-%02d" % d.isocalendar()[:2] != nomer:
            o.append("nomer %s не совпадает с неделей ISO даты %s" % (nomer, d))
    except ValueError:
        o.append("data — дата ГГГГ-ММ-ДД")
        d = None
    if not isinstance(V.get("poryadkovyj"), int) or V["poryadkovyj"] < 1:
        o.append("poryadkovyj — целое ≥ 1")
    if not isinstance(V.get("obrazec"), bool):
        o.append("obrazec — true/false")
    ob = V.get("oblozhka") or {}
    if not ob.get("cifra") or not ob.get("podpis"):
        o.append("oblozhka: cifra и podpis обязательны")
    o += oshibki_istochnika(ob.get("istochnik"), "oblozhka", d)
    gl = V.get("glavnoe") or []
    if len(gl) != 3:
        o.append("glavnoe — ровно 3 тезиса")
    ru = V.get("rubriki") or {}
    for k in NOVOSTNYE:
        sp = ru.get(k)
        if not isinstance(sp, list) or not sp:
            o.append("rubriki.%s — хотя бы одна новость" % k)
            continue
        for i, n in enumerate(sp):
            gde = "rubriki.%s[%d]" % (k, i)
            for pole in ("id", "zagolovok", "kratko", "chto_znachit", "status"):
                if not n.get(pole):
                    o.append("%s: нет %s" % (gde, pole))
            if not isinstance(n.get("tekst"), list) or not n.get("tekst"):
                o.append("%s: tekst — список абзацев" % gde)
            if n.get("status") not in STATUSY:
                o.append("%s: status — prinyat / proekt / sobytie" % gde)
            if n.get("status") == "proekt" and "проект" not in " ".join([n.get("zagolovok", "")] + n.get("tekst", [])).lower():
                o.append("%s: проект — слово «проект» обязательно в заголовке или тексте" % gde)
            if len(n.get("kratko", "")) > KRATKO_MAKS:
                o.append("%s: kratko длиннее %d знаков" % (gde, KRATKO_MAKS))
            o += oshibki_istochnika(n.get("istochnik"), gde, d)
            if n.get("ukazatel") and not (n["ukazatel"].get("url", "").startswith("https://") and n["ukazatel"].get("nazvanie")):
                o.append("%s: ukazatel — nazvanie и https-адрес" % gde)
    rz = V.get("razbor") or {}
    if not rz.get("zagolovok") or not rz.get("abzacy"):
        o.append("razbor: zagolovok и abzacy обязательны")
    o += oshibki_istochnika(rz.get("istochnik"), "razbor", d)
    o += oshibki_delobuh(V.get("delobuh"), d)
    for i, s in enumerate(V.get("sroki") or []):
        try:
            datetime.date.fromisoformat(s.get("data", ""))
        except ValueError:
            o.append("sroki[%d]: data — ГГГГ-ММ-ДД" % i)
        o += oshibki_istochnika(s.get("istochnik"), "sroki[%d]" % i, None)
    if not V.get("sroki"):
        o.append("sroki — хотя бы один срок")
    if not V.get("kommentarij"):
        o.append("kommentarij обязателен")
    p = V.get("pismo") or {}
    if not p.get("tema"):
        o.append("pismo.tema обязательна")
    return o


def stranica_est(url):
    """Инструмент из «Делобуха» — только своя страница сайта, которая есть в репозитории."""
    if not isinstance(url, str) or not re.match(r"^/[a-z0-9\-/]*$", url):
        return False
    p = put(*[x for x in url.split("/") if x])
    return os.path.isfile(os.path.join(p, "index.html")) if url.endswith("/") else os.path.isfile(p)


def oshibki_delobuh(db, data_vypuska):
    if not isinstance(db, dict):
        return ["delobuh — рубрика «Делобух: бухгалтерия недели» обязательна с № 1 (решение владельца 10.10)"]
    o = []
    dela = db.get("dela")
    if not isinstance(dela, list) or not DELOBUH_MIN <= len(dela) <= DELOBUH_MAKS:
        return ["delobuh.dela — от %d до %d дел" % (DELOBUH_MIN, DELOBUH_MAKS)]
    ids = set()
    for i, x in enumerate(dela):
        gde = "delobuh.dela[%d]" % i
        for pole in ("id", "chto", "zachem"):
            if not x.get(pole):
                o.append("%s: нет %s" % (gde, pole))
        if x.get("id") in ids:
            o.append("%s: id повторяется" % gde)
        ids.add(x.get("id"))
        if len(x.get("chto", "")) > DELO_MAKS:
            o.append("%s: chto длиннее %d знаков — это строка чек-листа" % (gde, DELO_MAKS))
        if x.get("srok"):
            try:
                datetime.date.fromisoformat(x["srok"])
            except ValueError:
                o.append("%s: srok — ГГГГ-ММ-ДД" % gde)
        ins = x.get("instrument")
        if ins is not None and not (isinstance(ins, dict) and ins.get("nazvanie") and stranica_est(ins.get("url"))):
            o.append("%s: instrument — nazvanie и адрес существующей страницы сайта (/...)" % gde)
        o += oshibki_istochnika(x.get("istochnik"), gde, data_vypuska)
    return o


def oshibki_istochnika(ist, gde, data_vypuska):
    if not isinstance(ist, dict):
        return ["%s: нет istochnik (первоисточник обязателен)" % gde]
    o = []
    if not ist.get("nazvanie"):
        o.append("%s: istochnik.nazvanie пуст" % gde)
    if not domen_ok(ist.get("url")):
        o.append("%s: istochnik.url %r — не первоисточник из списка DOMENY" % (gde, ist.get("url")))
    try:
        di = datetime.date.fromisoformat(ist.get("data", ""))
        if data_vypuska and di > data_vypuska:
            o.append("%s: дата источника позже даты выпуска" % gde)
    except ValueError:
        o.append("%s: istochnik.data — ГГГГ-ММ-ДД" % gde)
    return o


def novoe_za_nedelyu(V):
    """«Что нового в Делоскопе» — записи ленты obnovleniya.json за неделю выпуска."""
    with open(put("obnovleniya.json"), encoding="utf-8") as fh:
        L = json.load(fh)["obnovleniya"]
    s, po = V["nedelya"]["s"], V["nedelya"]["po"]
    return [x for x in L if s <= (data_zapisi(x) or "") <= po][:5]


MESYACY = ("января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря")


def fraza_lenty(x):
    """Первый тезис «что нового» без прямых кавычек: в ленте они бывают примером из реестра (ПАО "…"),
    а в журнале типографика строже — такой тезис пропускаем, остаётся заголовок."""
    for f in x.get("chto_novogo") or []:
        if '"' not in f:
            return f
    return ""


def data_zapisi(x):
    """ISO-дата записи ленты. В obnovleniya.json "data" — текстом («10 октября 2026»), id — «ГГГГ-ММ-ДД-N».
    (v1.1: в v1 сравнивали текст с ISO — рубрика «Что нового» всегда была пустой.)"""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})-", x.get("id") or "")
    if m:
        return m.group(1)
    m = re.match(r"^(\d{1,2}) ([а-я]+) (\d{4})$", (x.get("data") or "").replace("\u00a0", " ").strip())
    if m and m.group(2) in MESYACY:
        return "%s-%02d-%02d" % (m.group(3), MESYACY.index(m.group(2)) + 1, int(m.group(1)))
    return None


def url_vypuska(V):
    return "/zhurnal/%s/" % V["nomer"]


def data_kratko(iso):
    g, m, d = iso.split("-")
    return "%s.%s.%s" % (d, m, g)


def imya_pdf(V):
    return "deloskop-nedelya-%s.pdf" % V["nomer"]


def pdf_svedeniya(put_pdf):
    """{'imya', 'bajt', 'stranic'} готового PDF или None — для ссылки «PDF для печати»."""
    if not os.path.isfile(put_pdf):
        return None
    with open(put_pdf, "rb") as fh:
        b = fh.read()
    if not b.startswith(b"%PDF"):
        return None
    return {"imya": os.path.basename(put_pdf), "bajt": len(b), "stranic": len(re.findall(rb"/Type\s*/Page[^s]", b))}


def razmer_ru(bajt):
    if bajt >= 1024 * 1024:
        return ("%.1f МБ" % (bajt / 1024 / 1024)).replace(".", ",")
    return "%d КБ" % max(1, round(bajt / 1024))


def pdf_html(pdf_):
    if not pdf_:
        return ""
    st = pdf_["stranic"]
    sl = "страница" if st % 10 == 1 and st % 100 != 11 else ("страницы" if 2 <= st % 10 <= 4 and not 12 <= st % 100 <= 14 else "страниц")
    return ('<p class="zh-pdf"><a href="%s" download data-goal="zhurnal_pdf">PDF для печати</a>'
            '<span>A4 · %d %s · %s</span></p>' % (e(pdf_["imya"]), st, sl, razmer_ru(pdf_["bajt"])))


def nazv_nomera(V):
    return "%s № %d" % (NAZVANIE, V["poryadkovyj"])


def istochnik_html(ist, ukaz=None):
    s = '<p class="zh-ist">Первоисточник: <a href="%s" rel="noopener">%s</a> · %s' % (
        e(ist["url"]), t(ist["nazvanie"]), e(data_kratko(ist["data"])))
    if ukaz:
        s += ' · сообщил <a href="%s" rel="noopener nofollow">%s</a>' % (e(ukaz["url"]), t(ukaz["nazvanie"]))
    return s + "</p>"


# ---------- страница выпуска ----------
def golova(title, description, url, jsonld, noindex):
    robots = '<meta name="robots" content="noindex, nofollow">\n' if noindex else ""
    return """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(t)s</title>
<meta name="description" content="%(d)s">
%(r)s<link rel="canonical" href="%(u)s">
<meta property="og:type" content="article">
<meta property="og:title" content="%(t)s">
<meta property="og:description" content="%(d)s">
<meta property="og:url" content="%(u)s">
<meta property="og:image" content="https://deloskop.ru/ikonka-512.png">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">%(j)s</script>
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/zhurnal.css">
<link rel="stylesheet" href="/css/podval.css">
<link rel="stylesheet" href="/css/shapka.css">
<script src="/js/shapka.js" defer></script>
<script src="/js/metrika.js" defer></script>
</head>
<body>
<!--shapka--><!--/shapka-->
""" % {"t": e(title), "d": e(description), "u": SAJT + url, "r": robots, "j": json.dumps(jsonld, ensure_ascii=False)}


def novost_html(n, rub):
    metka = STATUSY.get(n["status"]) or ""
    s = ['<article class="zh-n" id="%s">' % e(n["id"])]
    if metka:
        s.append('<p class="zh-proekt">%s</p>' % e(metka))
    s.append("<h3>%s</h3>" % t(n["zagolovok"]))
    s += ["<p>%s</p>" % t(a) for a in n["tekst"]]
    s.append('<div class="zh-znachit"><p class="zh-znachit__h">Что это значит для вас</p><p>%s</p></div>' % t(n["chto_znachit"]))
    s.append(istochnik_html(n["istochnik"], n.get("ukazatel")))
    s.append("</article>")
    return "".join(s)


def razdel(yakor, zag, podpis, telo, nomer_rubriki):
    pod = '<p class="zh-r__pod">%s</p>' % e(podpis) if podpis else ""
    return ('<section class="zh-r" id="%s" aria-labelledby="%s-h"><header class="zh-r__shap"><span class="zh-r__n">%02d</span>'
            '<h2 id="%s-h">%s</h2>%s</header>%s</section>' % (yakor, yakor, nomer_rubriki, yakor, e(zag), pod, telo))


def stranica_vypuska(V, pdf_=None):
    url = url_vypuska(V)
    obr = V.get("obrazec", True)
    data_p = data_ru(V["data"])
    title = "%s — %s" % (nazv_nomera(V), data_p)
    description = "Журнал Делоскопа за неделю: 115-ФЗ и банки, налоги, суды, сроки. " + V["glavnoe"][0]
    if len(description) > 158:
        description = description[:157].rsplit(" ", 1)[0] + "…"
    ld = [{"@context": "https://schema.org", "@type": "Article", "headline": title[:110],
           "datePublished": V["data"], "dateModified": V["data"], "inLanguage": "ru",
           "author": {"@type": "Organization", "name": "Делоскоп", "url": SAJT + "/"},
           "publisher": {"@type": "Organization", "name": "Делоскоп", "url": SAJT + "/"},
           "isPartOf": {"@type": "Periodical", "name": NAZVANIE, "url": SAJT + "/zhurnal/"},
           "mainEntityOfPage": SAJT + url},
          kroshki_ld([("Главная", "/"), ("Журнал", "/zhurnal/"), ("№ %d" % V["poryadkovyj"], url)])]
    ch = [golova(title, description, url, ld, noindex=obr)]
    ch.append('<main class="zh">')
    if obr:
        ch.append('<p class="zh-obrazec" role="note">Образец выпуска — не публиковать. Тексты рубрик показывают формат, а не новости недели.</p>')
    ch.append(kroshki_html([("Главная", "/"), ("Журнал", "/zhurnal/"), ("№ %d" % V["poryadkovyj"], url)]))
    ob = V["oblozhka"]
    ch.append('<header class="zh-obl"><p class="zh-obl__nad">%s</p><h1 class="zh-obl__h">%s<span> № %d · %s</span></h1>'
              '<p class="zh-obl__cifra">%s</p><p class="zh-obl__pod">%s</p>%s</header>' % (
                  e(NADZAG), e(NAZVANIE), V["poryadkovyj"], e(data_p), t(ob["cifra"]), t(ob["podpis"]),
                  istochnik_html(ob["istochnik"]) + pdf_html(pdf_)))
    # оглавление — якоря рубрик
    li = "".join('<li><a href="#%s"><span>%02d</span>%s</a></li>' % (y, i + 1, e(z)) for i, (_, y, z, _p) in enumerate(RUBRIKI))
    ch.append('<nav class="zh-sod" aria-label="Рубрики выпуска"><ol>%s</ol></nav>' % li)
    for i, (k, y, z, p) in enumerate(RUBRIKI):
        if k == "glavnoe":
            telo = '<ol class="zh-gl">' + "".join("<li>%s</li>" % t(x) for x in V["glavnoe"]) + "</ol>"
        elif k in NOVOSTNYE:
            telo = "".join(novost_html(n, k) for n in V["rubriki"][k])
        elif k == "razbor":
            rz = V["razbor"]
            telo = ('<article class="zh-n zh-razbor"><h3>%s</h3><p class="zh-lid">%s</p>%s'
                    '<p><a class="zh-dalee" href="%s">Все разборы дел →</a></p>%s</article>' % (
                        t(rz["zagolovok"]), t(rz.get("lid", "")), "".join("<p>%s</p>" % t(a) for a in rz["abzacy"]),
                        e(rz.get("ssylka") or "/praktika/"), istochnik_html(rz["istochnik"])))
        elif k == "sroki":
            telo = '<table class="zh-sroki"><tbody>' + "".join(
                '<tr><td class="zh-sroki__d"><time datetime="%s">%s</time></td><td>%s<br><span class="zh-ist">%s · <a href="%s" rel="noopener">первоисточник</a></span></td></tr>' % (
                    e(s["data"]), e(data_ru(s["data"])[:-5]), t(s["chto"]), t(s["istochnik"]["nazvanie"]), e(s["istochnik"]["url"]))
                for s in V["sroki"]) + "</tbody></table>"
        elif k == "delobuh":
            db = V["delobuh"]
            li = []
            for x in db["dela"]:
                srok = ('<time class="zh-delo__srok" datetime="%s">до %s</time>' % (e(x["srok"]), e(data_ru(x["srok"])[:-5]))) if x.get("srok") else ""
                ins = ('<a class="zh-delo__ins" href="%s">%s →</a>' % (e(x["instrument"]["url"]), t(x["instrument"]["nazvanie"]))) if x.get("instrument") else ""
                li.append('<li class="zh-delo" id="delo-%s"><span class="zh-delo__box" aria-hidden="true"></span><div>'
                          '<p class="zh-delo__chto">%s%s</p><p class="zh-delo__zachem">%s</p>%s%s</div></li>' % (
                              e(x["id"]), t(x["chto"]), srok, t(x["zachem"]), ins,
                              '<p class="zh-ist">Норма: <a href="%s" rel="noopener">%s</a></p>' % (e(x["istochnik"]["url"]), t(x["istochnik"]["nazvanie"]))))
            telo = (('<p class="zh-lid zh-delobuh__lid">%s</p>' % t(db["lid"])) if db.get("lid") else "") + '<ol class="zh-dela">' + "".join(li) + "</ol>"
        elif k == "novoe":
            nov = novoe_za_nedelyu(V)
            if nov:
                telo = '<ul class="zh-novoe">' + "".join(
                    "<li><b>%s</b>%s</li>" % (t(x["zagolovok"]), (" " + t(fraza_lenty(x))) if fraza_lenty(x) else "")
                    for x in nov) + '</ul><p><a class="zh-dalee" href="/obnovleniya/">Вся лента обновлений →</a></p>'
            else:
                telo = '<p class="zh-pusto">На этой неделе обновлений сайта не было. <a href="/obnovleniya/">Лента обновлений →</a></p>'
        else:
            telo = '<blockquote class="zh-kom"><p>%s</p><footer>Команда Делоскопа</footer></blockquote>' % t(V["kommentarij"])
        ch.append(razdel(y, z, p, telo, i + 1))
    ch.append('<aside class="zh-niz"><p>Проверьте контрагента из выпуска — по ИНН, за минуту.</p>'
              '<a class="zh-btn" href="/">Проверить компанию</a>'
              '<p class="zh-niz__m">Каждая новость — со ссылкой на первоисточник и датой. Материалы носят информационный характер и не заменяют консультацию юриста. '
              'Журнал приходит по пятницам тем, кто согласился получать письма Делоскопа (<a href="/rassylki/">условия</a>).</p></aside>')
    ch.append("</main>\n</body>\n</html>\n")
    return url, "".join(ch)


# ---------- список выпусков ----------
def stranica_spiska(spisok):
    url = "/zhurnal/"
    title = "Журнал Делоскопа — «Делоскоп · Неделя»"
    description = "Еженедельный журнал Делоскопа: 115-ФЗ и банки, налоги, суды, сроки недели. Каждая новость — с первоисточником и датой."
    ld = [{"@context": "https://schema.org", "@type": "Periodical", "name": NAZVANIE, "url": SAJT + url,
           "inLanguage": "ru", "publisher": {"@type": "Organization", "name": "Делоскоп", "url": SAJT + "/"}},
          kroshki_ld([("Главная", "/"), ("Журнал", url)])]
    ch = [golova(title, description, url, ld, noindex=not spisok)]
    ch.append('<main class="zh">')
    ch.append(kroshki_html([("Главная", "/"), ("Журнал", url)]))
    ch.append('<header class="zh-obl zh-obl--spisok"><p class="zh-obl__nad">%s</p><h1 class="zh-obl__h">%s</h1>'
              '<p class="zh-obl__pod">Раз в неделю, в пятницу утром: 115-ФЗ и банки, налоги, суды, события вокруг компаний и сроки. '
              'Коротко, простым языком, у каждой новости — первоисточник и дата.</p></header>' % (e(NADZAG), e(NAZVANIE)))
    if spisok:
        kart = []
        for V in sorted(spisok, key=lambda x: x["data"], reverse=True):
            kart.append('<li><a href="%s"><span class="zh-sp__n">№ %d · %s</span><span class="zh-sp__c">%s</span><span class="zh-sp__t">%s</span></a></li>' % (
                url_vypuska(V), V["poryadkovyj"], e(data_ru(V["data"])), t(V["oblozhka"]["cifra"]), t(V["glavnoe"][0])))
        ch.append('<ol class="zh-sp" reversed>%s</ol>' % "".join(kart))
    else:
        ch.append('<p class="zh-pusto">Первый выпуск готовим. Выпуски будут появляться здесь каждую пятницу.</p>')
    ch.append('<section class="zh-r"><header class="zh-r__shap"><h2>Что внутри каждого выпуска</h2></header><ol class="zh-gl">%s</ol></section>' % "".join(
        "<li><b>%s</b>%s</li>" % (e(z), (" — " + e(p[0].lower() + p[1:] if p[1:2].islower() else p)) if p else "") for _, _, z, p in RUBRIKI))
    ch.append('<aside class="zh-niz"><p>Журнал приходит на почту клиентам с аккаунтом, которые согласились получать письма Делоскопа. '
              'Отписаться — одной ссылкой в любом письме.</p><a class="zh-btn" href="/cabinet.html">Войти и подписаться</a>'
              '<p class="zh-niz__m"><a href="/rassylki/">Условия рассылки</a></p></aside>')
    ch.append("</main>\n</body>\n</html>\n")
    return url, "".join(ch)


def gotovo(txt, r_, podval, shapka):
    return SH.sobrat_stranicu(nerazryv(tipograf(txt)), r_, podval, shapka)


# ---------- письмо ----------
C = {"bg": "#F5F5F2", "card": "#FFFFFF", "ink": "#1D1D1F", "ink2": "#48484C", "muted": "#6B6B70", "line": "#E6E6E1", "accent": "#0B63E5"}
SHRIFT = "Onest,-apple-system,'Segoe UI',Roboto,Arial,sans-serif"


def utm(href, V, mesto):
    sep = "&" if "?" in href else "?"
    return "%s%s%sutm_source=zhurnal&utm_medium=email&utm_campaign=%s&utm_content=%s" % (SAJT, href, sep, V["nomer"], mesto)


def pismo(V):
    """HTML-письмо: таблицы и инлайн-стили (почтовые клиенты режут <style>), ширина 600."""
    url = url_vypuska(V)
    P = 'style="margin:0 0 12px;font:400 16px/1.5 %s;color:%s"' % (SHRIFT, C["ink2"])

    def blok(rub, zag, tekst, href):
        return ('<tr><td style="padding:24px 32px 0">'
                '<p style="margin:0 0 6px;font:600 12px/1 %s;letter-spacing:.06em;text-transform:uppercase;color:%s">%s</p>'
                '<p style="margin:0 0 6px;font:600 19px/1.3 %s;color:%s">%s</p>'
                '<p %s>%s</p>'
                '<a href="%s" style="font:600 15px/1 %s;color:%s;text-decoration:none">Читать дальше →</a>'
                '</td></tr>') % (SHRIFT, C["muted"], e(rub), SHRIFT, C["ink"], t(zag), P, t(tekst), e(href), SHRIFT, C["accent"])

    bloki = []
    for k, y, z, _ in RUBRIKI:
        if k in NOVOSTNYE:
            n = V["rubriki"][k][0]
            zag = n["zagolovok"] + (" (проект)" if n["status"] == "proekt" and "проект" not in n["zagolovok"].lower() else "")
            bloki.append(blok(z, zag, n["kratko"], utm(url, V, y) + "#" + y))
        elif k == "razbor":
            rz = V["razbor"]
            bloki.append(blok(z, rz["zagolovok"], rz.get("lid") or rz["abzacy"][0], utm(url, V, y) + "#" + y))
        elif k == "sroki":
            s = V["sroki"][0]
            ost = len(V["sroki"]) - 1
            tekst = "%s — %s%s%s" % (data_ru(s["data"])[:-5], s["chto"], "" if s["chto"].endswith((".", "!", "?")) else ".",
                                     (" Ещё сроков в выпуске: %d." % ost) if ost else "")
            bloki.append(blok(z, "Что и до какого числа", tekst, utm(url, V, y) + "#" + y))
        elif k == "delobuh":
            dela = "".join('<li style="margin:0 0 6px">%s</li>' % t(x["chto"]) for x in V["delobuh"]["dela"])
            bloki.append(('<tr><td style="padding:24px 32px 0">'
                          '<p style="margin:0 0 8px;font:600 12px/1 %s;letter-spacing:.06em;text-transform:uppercase;color:%s">%s</p>'
                          '<ul style="margin:0 0 12px;padding:0 0 0 20px;font:400 16px/1.5 %s;color:%s;list-style:square">%s</ul>'
                          '<a href="%s" style="font:600 15px/1 %s;color:%s;text-decoration:none">Зачем и где проверить →</a>'
                          '</td></tr>') % (SHRIFT, C["muted"], e(z), SHRIFT, C["ink"], dela, e(utm(url, V, y) + "#" + y), SHRIFT, C["accent"]))
    ob = V["oblozhka"]
    gl = "".join('<li style="margin:0 0 8px">%s</li>' % t(x) for x in V["glavnoe"])
    pre = e((V.get("pismo") or {}).get("preheader", ""))
    h = ('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
         '<title>%(tema)s</title></head>'
         '<body style="margin:0;padding:0;background:%(bg)s">'
         '<div style="display:none;max-height:0;overflow:hidden">%(pre)s</div>'
         '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background:%(bg)s"><tr><td align="center" style="padding:24px 12px">'
         '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%%;max-width:600px;background:%(card)s;border-radius:24px">'
         '<tr><td style="padding:32px 32px 0">'
         '<p style="margin:0 0 4px;font:600 12px/1 %(f)s;letter-spacing:.06em;text-transform:uppercase;color:%(muted)s">%(nad)s</p>'
         '<p style="margin:0;font:600 22px/1.2 %(f)s;color:%(ink)s">%(naz)s</p>'
         '<p style="margin:4px 0 0;font:400 14px/1.4 %(f)s;color:%(muted)s">%(data)s</p>'
         '<p style="margin:28px 0 8px;font:600 64px/1 %(f)s;letter-spacing:-.03em;color:%(ink)s">%(cifra)s</p>'
         '<p %(P)s>%(podpis)s</p>'
         '<p style="margin:16px 0 8px;font:600 12px/1 %(f)s;letter-spacing:.06em;text-transform:uppercase;color:%(muted)s">Главное за неделю</p>'
         '<ol style="margin:0;padding:0 0 0 20px;font:400 16px/1.5 %(f)s;color:%(ink)s">%(gl)s</ol>'
         '</td></tr>%(bloki)s'
         '<tr><td style="padding:32px">'
         '<a href="%(vse)s" style="display:inline-block;padding:14px 24px;border-radius:999px;background:%(accent)s;color:#FFFFFF;font:600 16px/1 %(f)s;text-decoration:none">Читать выпуск целиком</a>'
         '<p style="margin:14px 0 0;font:400 14px/1.4 %(f)s;color:%(muted)s"><a href="%(pdf)s" style="color:%(muted)s">PDF для печати</a> — тот же выпуск на листах A4</p>'
         '</td></tr>'
         '<tr><td style="padding:0 32px 32px;border-top:1px solid %(line)s">'
         '<p style="margin:20px 0 6px;font:400 13px/1.5 %(f)s;color:%(muted)s">У каждой новости в выпуске — ссылка на первоисточник и дата. Материалы носят информационный характер и не заменяют консультацию юриста.</p>'
         '<p style="margin:0 0 6px;font:400 13px/1.5 %(f)s;color:%(muted)s">Письмо пришло, потому что вы согласились получать письма Делоскопа. <a href="{{otpiska}}" style="color:%(muted)s">Отписаться</a> — одно нажатие.</p>'
         '<p style="margin:0;font:400 13px/1.5 %(f)s;color:%(muted)s">Делоскоп — проверка контрагентов по ИНН · <a href="%(tar)s" style="color:%(muted)s">тарифы</a> · help@deloskop.ru</p>'
         '</td></tr></table></td></tr></table></body></html>\n') % {
        "tema": e(V["pismo"]["tema"]), "bg": C["bg"], "card": C["card"], "ink": C["ink"], "muted": C["muted"], "line": C["line"],
        "accent": C["accent"], "f": SHRIFT, "P": P, "pre": pre, "nad": e(NADZAG), "naz": e(nazv_nomera(V)), "data": e(data_ru(V["data"])),
        "cifra": t(ob["cifra"]), "podpis": t(ob["podpis"]), "gl": gl, "bloki": "".join(bloki),
        "vse": e(utm(url, V, "knopka")), "pdf": e(utm(url + imya_pdf(V), V, "pdf")), "tar": e(utm("/tarify/", V, "podval"))}
    return tipograf(h)


def tekst_pisma(h):
    """Видимый текст письма — то, что считаем в лимит 3 500 знаков, и текстовая версия (multipart/alternative)."""
    s = re.sub(r'<div style="display:none[^>]*>.*?</div>', "", h, flags=re.S)
    s = re.sub(r"<title>.*?</title>", "", s, flags=re.S)
    s = re.sub(r"<(br|/p|/li|/tr)[^>]*>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace(" ", " ")
    s = "\n".join(x.strip() for x in s.split("\n"))
    return re.sub(r"\n{3,}", "\n\n", s).strip() + "\n"


def tekst_versiya(V, h):
    """Текстовая версия письма со ссылками (для клиентов без HTML)."""
    t_ = tekst_pisma(h)
    return t_ + "\nЧитать выпуск: %s\nОтписаться: {{otpiska}}\n" % utm(url_vypuska(V), V, "tekst")


# ---------- PDF ----------
def pdf(html_put, pdf_put, V):
    """Печать страницы выпуска в PDF (A4) Chromium'ом. Страница отдаётся локальным сервером из папки сайта,
    а сам выпуск — из папки сборки: так подтягиваются /css и /fonts без публикации образца."""
    import http.server
    import socketserver
    import threading
    from playwright.sync_api import sync_playwright

    url_v = url_vypuska(V)
    koren = KOREN

    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=koren, **k)

        def log_message(self, *a):
            pass

        def send_head(self):
            if self.path.split("?")[0].split("#")[0] == url_v:
                with open(html_put, "rb") as fh:
                    b = fh.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                import io
                return io.BytesIO(b)
            return super().send_head()

    with socketserver.TCPServer(("127.0.0.1", 0), H) as srv:
        port = srv.server_address[1]
        th = threading.Thread(target=srv.serve_forever, daemon=True)
        th.start()
        try:
            with sync_playwright() as p:
                kw = {}
                if os.path.exists("/opt/pw-browsers/chromium"):
                    pass  # PLAYWRIGHT_BROWSERS_PATH уже указывает на /opt/pw-browsers
                b = p.chromium.launch(**kw)
                pg = b.new_page()
                pg.goto("http://127.0.0.1:%d%s" % (port, url_v), wait_until="networkidle")
                pg.emulate_media(media="print")
                pg.pdf(path=pdf_put, format="A4", print_background=True, prefer_css_page_size=True,
                       display_header_footer=True, header_template="<span></span>",
                       footer_template=('<div style="width:100%%;font:9px Arial,sans-serif;color:#6B6B70;padding:0 16mm;display:flex;justify-content:space-between">'
                                        '<span>%s · %s</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>') % (
                           e(nazv_nomera(V)), e(data_ru(V["data"]))),
                       margin={"top": "18mm", "bottom": "18mm", "left": "16mm", "right": "16mm"})
                b.close()
        finally:
            srv.shutdown()
    razmer = os.path.getsize(pdf_put)
    if razmer > PDF_MAKS:
        raise SystemExit("sobrat_zhurnal: PDF %d байт > 2 МБ" % razmer)
    return razmer


# ---------- сборка ----------
def sobrat_sajt():
    """{файл: содержимое} для сайта: /zhurnal/ и страницы опубликованных (не образцов) выпусков + sitemap."""
    vse = vypuski()
    for V in vse:
        o = oshibki(V)
        if o:
            raise SystemExit("sobrat_zhurnal: %s.json — %s" % (V.get("nomer"), "; ".join(o)))
    opubl = [V for V in vse if not V.get("obrazec")]
    r_ = SH.rekv_sajta()
    podval, shapka = SH.podval_html(r_), SH.shapka_html()
    out = {}
    u, txt = stranica_spiska(opubl)
    out["zhurnal/index.html"] = gotovo(txt, r_, podval, shapka)
    for V in opubl:
        pdf_ = pdf_svedeniya(put("zhurnal", V["nomer"], imya_pdf(V)))
        if not pdf_:
            raise SystemExit("sobrat_zhurnal: %s опубликован без PDF — python3 tests/sobrat_zhurnal.py %s --v-sajt" % (V["nomer"], V["nomer"]))
        u, txt = stranica_vypuska(V, pdf_)
        out[u.strip("/") + "/index.html"] = gotovo(txt, r_, podval, shapka)
    with open(put("sitemap.xml"), encoding="utf-8") as fh:
        sm = fh.read()
    sm = re.sub(r"\s*<url><loc>https://deloskop\.ru/zhurnal/[^<]*</loc>.*?</url>", "", sm)
    if opubl:
        stroki = "\n  <url><loc>%s/zhurnal/</loc><lastmod>%s</lastmod></url>" % (SAJT, max(V["data"] for V in opubl))
        stroki += "".join("\n  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, url_vypuska(V), V["data"]) for V in opubl)
        sm = sm.replace("\n</urlset>", stroki + "\n</urlset>", 1)
    out["sitemap.xml"] = sm
    return out


def sobrat_vypusk(nomer, out_dir, s_pdf):
    V = vypusk(nomer)
    o = oshibki(V)
    if o:
        raise SystemExit("sobrat_zhurnal: %s.json — %s" % (nomer, "; ".join(o)))
    r_ = SH.rekv_sajta()
    podval, shapka = SH.podval_html(r_), SH.shapka_html()
    os.makedirs(out_dir, exist_ok=True)
    u, txt = stranica_vypuska(V)
    stranica = gotovo(txt, r_, podval, shapka)
    sp = os.path.join(out_dir, "stranica.html")
    with open(sp, "w", encoding="utf-8") as fh:
        fh.write(stranica)
    h = pismo(V)
    with open(os.path.join(out_dir, "pismo.html"), "w", encoding="utf-8") as fh:
        fh.write(h)
    with open(os.path.join(out_dir, "pismo.txt"), "w", encoding="utf-8") as fh:
        fh.write(tekst_versiya(V, h))
    n = len(tekst_pisma(h))
    if n > PISMO_MAKS:
        raise SystemExit("sobrat_zhurnal: письмо %d знаков > %d — сократите kratko" % (n, PISMO_MAKS))
    meta = {"nomer": nomer, "tema": V["pismo"]["tema"], "obrazec": V.get("obrazec"), "znakov_v_pisme": n,
            "url": SAJT + url_vypuska(V)}
    if s_pdf:
        imya = imya_pdf(V)
        meta["pdf"] = imya
        meta["pdf_bajt"] = pdf(sp, os.path.join(out_dir, imya), V)
        # страница со ссылкой «PDF для печати» (в печати ссылка скрыта — PDF от этого не меняется)
        u, txt = stranica_vypuska(V, pdf_svedeniya(os.path.join(out_dir, imya)))
        with open(sp, "w", encoding="utf-8") as fh:
            fh.write(gotovo(txt, r_, podval, shapka))
    with open(os.path.join(out_dir, "vypusk.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    return meta


def v_sajt(nomer):
    """Публикация PDF выпуска: печать в zhurnal/<nomer>/ и пересборка страниц сайта. Образец — нельзя."""
    V = vypusk(nomer)
    if V.get("obrazec", True):
        raise SystemExit("sobrat_zhurnal: %s — образец (obrazec: true), на сайт не публикуется" % nomer)
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        m = sobrat_vypusk(nomer, d, True)
        cel = put("zhurnal", nomer, m["pdf"])
        os.makedirs(os.path.dirname(cel), exist_ok=True)
        with open(os.path.join(d, m["pdf"]), "rb") as fh, open(cel, "wb") as out:
            out.write(fh.read())
    for f, txt in sobrat_sajt().items():
        with open(put(f), "w", encoding="utf-8") as fh:
            fh.write(txt)
    print("Опубликован PDF: zhurnal/%s/%s (%d байт); страницы пересобраны" % (nomer, m["pdf"], m["pdf_bajt"]))


def main():
    argv = [a for a in sys.argv[1:]]
    nomera = [a for a in argv if re.match(r"^\d{4}-\d{2}$", a)]
    if nomera and "--v-sajt" in argv:
        for nomer in nomera:
            v_sajt(nomer)
        return
    if nomera:
        out = None
        if "--out" in argv:
            out = argv[argv.index("--out") + 1]
        for nomer in nomera:
            d = out or os.path.join(os.path.dirname(KOREN), "zhurnal-sborka", nomer)
            m = sobrat_vypusk(nomer, d, "--pdf" in argv)
            print("Выпуск %s%s: %s — письмо %d знаков%s" % (
                nomer, " (ОБРАЗЕЦ — не публиковать)" if m["obrazec"] else "", d, m["znakov_v_pisme"],
                (", PDF %d байт" % m["pdf_bajt"]) if "pdf_bajt" in m else ""))
        return
    check = "--check" in argv
    izm = []
    for f, txt in sobrat_sajt().items():
        p = put(f)
        stary = open(p, encoding="utf-8").read() if os.path.exists(p) else None
        if stary != txt:
            izm.append(f)
            if not check:
                os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(txt)
    if check:
        if izm:
            print("Нужна сборка журнала: " + ", ".join(izm))
            sys.exit(1)
        print("Журнал собран")
    else:
        print("Собрано: %d файлов" % len(izm) + ("" if not izm else " — " + ", ".join(izm)))


if __name__ == "__main__":
    main()
