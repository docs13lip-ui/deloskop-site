#!/usr/bin/env python3
"""seo-haby-v1 (25.10.2026): «хлебные крошки» и состав разделов — в разметке для поиска.

Аудит main a949553e (25.10, 04:20): у 69 из 79 индексируемых страниц (без /company/) есть BreadcrumbList, а у хабов
/115-fz/ и /nalogi/ и у продуктовых страниц первого уровня — нет; CollectionPage хабов — только имя и адрес, без
описания и списка статей. Яндекс и Google берут из BreadcrumbList путь в сниппете («deloskop.ru › 115-ФЗ»), из
ItemList — понимают, что страница-раздел собирает именно эти статьи (п. 295 Очереди: «CollectionPage + ItemList на хабах»).

Что делает (шаг 6д sobrat_shapku, по canonical страницы — карточек и оболочки API не касается):
  • хаб — одна разметка [BreadcrumbList, CollectionPage{name, description, url, inLanguage, mainEntity: ItemList}]
    вместо прежней; список — ссылки страницы на свои статьи (/115-fz/<адрес>/) в порядке появления, без noindex,
    имя — <h1> статьи; пересобирается каждый раз — новая статья на хабе попадает в список сама;
  • продуктовая страница — BreadcrumbList «Делоскоп → <h1>», если крошек ещё нет.
Имена — как в крошках статей («115-ФЗ», «Налоги»); пути проверяет tests/test_seo_haby.py.
"""
import html
import json
import os
import re

SAJT = "https://deloskop.ru"
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# хаб: адрес → имя второго шага крошек (то же, что в BreadcrumbList его статей)
HABY = {"/115-fz/": "115-ФЗ", "/nalogi/": "Налоги"}
# продуктовые страницы первого уровня без крошек (аудит 25.10); новое — одной строкой
PRODUKTY = ("/delopis/", "/proverit-schet/", "/kontragenty-iz-vypiski/", "/skoraya-115-fz/",
            "/nalichnye/", "/obnovleniya/")

CANON = re.compile(r'<link rel="canonical" href="https://deloskop\.ru(/[^"]*)"')
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
H1 = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.S)
DESC = re.compile(r'<meta name="description" content="([^"]*)"')
NOINDEX = re.compile(r'<meta[^>]+name="robots"[^>]+noindex')


def tekst(s):
    """Видимый текст без тегов: &nbsp; → пробел, неразрывный дефис → обычный (так ищут люди)."""
    s = re.sub(r'<(span|small|sup)\b[^>]*class="[^"]*beta[^"]*"[^>]*>.*?</\1>', "", s, flags=re.S)  # метка «бета» — не имя
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace(" ", " ").replace("‑", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


def kroshki(url, imya):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Делоскоп", "item": SAJT + "/"},
        {"@type": "ListItem", "position": 2, "name": imya, "item": SAJT + url}]}


def _h1_fajla(url):
    p = os.path.join(KOREN, url.strip("/"), "index.html")
    if not os.path.exists(p):
        return None
    s = open(p, encoding="utf-8").read()
    if NOINDEX.search(s):
        return None
    m = H1.search(s)
    return tekst(m.group(1)) if m else None


def stati_haba(txt, url):
    """Ссылки хаба на свои статьи — по порядку, без повторов; только из разметки страницы, не из скриптов."""
    telo = re.sub(r"<script\b.*?</script>", "", txt, flags=re.S)
    telo = telo[telo.find("<body"):] if "<body" in telo else telo
    vidno, spisok = set(), []
    for h in re.findall(r'href="(' + re.escape(url) + r'[a-z0-9-]+/)"', telo):
        if h in vidno:
            continue
        vidno.add(h)
        imya = _h1_fajla(h)
        if imya:
            spisok.append((h, imya))
    return spisok


def razmetka_haba(txt, url):
    h1 = H1.search(txt)
    d = DESC.search(txt)
    stati = stati_haba(txt, url)
    cp = {"@context": "https://schema.org", "@type": "CollectionPage",
          "name": tekst(h1.group(1)) if h1 else HABY[url], "url": SAJT + url, "inLanguage": "ru"}
    if d:
        cp["description"] = html.unescape(d.group(1))
    if stati:
        cp["mainEntity"] = {"@type": "ItemList", "numberOfItems": len(stati), "itemListElement": [
            {"@type": "ListItem", "position": i, "url": SAJT + h, "name": imya}
            for i, (h, imya) in enumerate(stati, 1)]}
    return json.dumps([kroshki(url, HABY[url]), cp], ensure_ascii=False)


def primenit(txt):
    m = CANON.search(txt)
    if not m:
        return txt
    url = m.group(1)
    if url in HABY:
        nov = '<script type="application/ld+json">' + razmetka_haba(txt, url) + "</script>"
        for b in LD.finditer(txt):
            if '"CollectionPage"' in b.group(1):
                return txt[:b.start()] + nov + txt[b.end():]
        return txt.replace("</head>", nov + "\n</head>", 1)
    if url in PRODUKTY and '"BreadcrumbList"' not in txt:
        h1 = H1.search(txt)
        if not h1:
            return txt
        kr = kroshki(url, tekst(h1.group(1)))
        b = LD.search(txt)
        if b and b.start() < txt.find("</head>"):
            # в первый блок разметки страницы — его же дополняют sobrat_faq (FAQPage) и другие сборщики
            ld = json.loads(b.group(1))
            ld = [kr] + (ld if isinstance(ld, list) else [ld])
            return txt[:b.start(1)] + json.dumps(ld, ensure_ascii=False) + txt[b.end(1):]
        # разметки нет — отдельным блоком сразу после canonical (место не плывёт от вставок у </head>)
        i = txt.find(">", m.start()) + 1
        return (txt[:i] + '\n<script type="application/ld+json">' + json.dumps(kr, ensure_ascii=False)
                + "</script>" + txt[i:])
    return txt
