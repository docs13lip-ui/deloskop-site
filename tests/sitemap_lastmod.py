#!/usr/bin/env python3
"""seo-svyazi-v1 (24.10.2026): lastmod в sitemap.xml — по смене текста страницы, а не руками.

Зачем: lastmod главной стоял 2026-10-01, хотя главная менялась 22–24.10 (аудит [Маркетинг] 24.10, разд. 1.2) —
Яндекс реже переобходит страницу, которая «не меняется». Руками дату забывают; дата коммита файла (git log)
не годится: «сборка» трогает все ~260 страниц при каждой смене адреса пакета «ядро», а в CI клон неглубокий.

Как: для каждой страницы sitemap.xml считаем отпечаток видимого текста (title, description, тело страницы без
шапки, подвала, полосы беты, скриптов, стилей и комментариев; неразрывный пробел = пробел — типограф не «меняет» страницу).
Отпечатки и даты их смены — в data/lastmod.json. Отпечаток сменился → дата = сегодня (МСК).
lastmod = самая поздняя из: прежний lastmod, dateModified страницы (JSON-LD), дата смены текста. Назад не идёт.

Не трогаем строки, которые ведут свои сборщики: /praktika/… (sobrat_praktika), /reyting/ (sobrat_reyting),
/zhurnal/… (sobrat_zhurnal); карточки — sitemap-companies.xml (kartochki.py).

Зовётся из tests/sobrat_shapku.py последним шагом (и в --check): страница, собранная заново, и sitemap
совпадают — CI («sobrat_tarify . && sobrat_shapku && git diff --quiet») ловит забытую дату.
"""
import datetime
import hashlib
import html
import json
import os
import re

SAJT = "https://deloskop.ru"
SVOI = ("/praktika/", "/reyting/", "/zhurnal/")  # их lastmod ставят свои сборщики
REESTR = ("data", "lastmod.json")
STROKA = re.compile(r"(<url><loc>" + re.escape(SAJT) + r"([^<]*)</loc><lastmod>)(\d{4}-\d{2}-\d{2})(</lastmod>)")
_UBRAT = re.compile(r"<!--(shapka|podval|beta-polosa)-->.*?<!--/\1-->|<(script|style|noscript|template)\b.*?</\2>|<!--.*?-->", re.S | re.I)


def segodnya():
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("Europe/Moscow")).date().isoformat()
    except Exception:  # pragma: no cover — без базы часовых поясов: UTC+3
        return (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).date().isoformat()


def fajl(url):
    f = url.lstrip("/")
    return f + "index.html" if (f == "" or f.endswith("/")) else f


def tekst(s):
    """Видимый текст страницы для отпечатка: заголовок, описание и тело без шапки, подвала, скриптов и стилей."""
    zag = re.search(r"<title>(.*?)</title>", s, re.S)
    opis = re.search(r'<meta name="description" content="([^"]*)"', s)
    b = s.find("<body")
    telo = _UBRAT.sub(" ", s[b:] if b >= 0 else s)
    telo = re.sub(r"<[^>]+>", " ", telo)
    t = " ".join([zag.group(1) if zag else "", opis.group(1) if opis else "", telo])
    t = html.unescape(t).replace(" ", " ").replace("‑", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", t).strip()


def otpechatok(s):
    return hashlib.sha1(tekst(s).encode("utf-8")).hexdigest()[:16]


def data_izmeneniya(s):
    m = re.search(r'"dateModified": ?"(\d{4}-\d{2}-\d{2})', s)
    return m.group(1) if m else ""


def obnovit(koren, check=False, den=None):
    """Возвращает список изменённых файлов (sitemap.xml, data/lastmod.json); при check=False — пишет их."""
    den = den or segodnya()
    sp = os.path.join(koren, "sitemap.xml")
    rp = os.path.join(koren, *REESTR)
    if not os.path.exists(sp):
        return []
    sm = open(sp, encoding="utf-8").read()
    reestr = json.load(open(rp, encoding="utf-8")) if os.path.exists(rp) else {}
    novyj = {}

    def zamena(m):
        url, staraya = m.group(2), m.group(3)
        p = os.path.join(koren, fajl(url))
        if url.startswith(SVOI) or not os.path.exists(p):
            return m.group(0)
        s = open(p, encoding="utf-8").read()
        h = otpechatok(s)
        z = reestr.get(url)
        if z and z.get("h") == h:
            d = z["d"]
        else:
            d = den if z else max(staraya, data_izmeneniya(s))  # новая страница в реестре — без «сегодня»
        novyj[url] = {"h": h, "d": d}
        return m.group(1) + max(staraya, data_izmeneniya(s), d) + m.group(4)

    sm2 = STROKA.sub(zamena, sm)
    r2 = json.dumps(novyj, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    izm = []
    if sm2 != sm:
        izm.append("sitemap.xml")
    if not os.path.exists(rp) or open(rp, encoding="utf-8").read() != r2:
        izm.append("/".join(REESTR))
    if izm and not check:
        with open(sp, "w", encoding="utf-8") as fh:
            fh.write(sm2)
        os.makedirs(os.path.dirname(rp), exist_ok=True)
        with open(rp, "w", encoding="utf-8") as fh:
            fh.write(r2)
    return izm


if __name__ == "__main__":
    import sys
    k = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    izm = obnovit(k, check="--check" in sys.argv)
    print(("Нужна сборка lastmod: " if "--check" in sys.argv and izm else "lastmod: ") + (", ".join(izm) or "без изменений"))
    sys.exit(1 if ("--check" in sys.argv and izm) else 0)
