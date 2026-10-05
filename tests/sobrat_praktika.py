#!/usr/bin/env python3
"""Сборщик раздела «Практика» (/praktika/) — «Разбор дела» ([Ночные запуски] 30.09.2026, решение владельца 30.09 01:20).

Данные — praktika/dela.json (карточки дел, кнопка, нормы, мета); текст автора-юриста — tests/praktika/<slug>.html
(блоки «Что случилось» … «Сколько на кону» в классах css/praktika.css по макету [Арт-директора] 30.09).
Сборщик пишет:
  praktika/index.html, praktika/115-fz/index.html, praktika/nalogi/index.html — хабы (новые сверху);
  praktika/<раздел>/<slug>/index.html — разборы: крошки → H1 → карточка дела → текст автора → одно действие →
  «Где в законе» → «Частые вопросы» (praktika/faq.json, ответы дословно из текста автора) → «Сверено» → «Похожие разборы» (с полем statyi — «Читайте также») → «Полезно?» (js/otzyv.js);
  строки /praktika/… в sitemap.xml; ссылку «Практика судов» в хабах /115-fz/ и /nalogi/ (между метками).
Шапку и подвал ставит sobrat_shapku.sobrat_stranicu — после этого сборщика sobrat_shapku.py ничего не меняет.
Запуск: python3 tests/sobrat_praktika.py [--check]
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import sobrat_shapku as SH  # noqa: E402
import sobrat_faq as FAQ  # noqa: E402

SAJT = "https://deloskop.ru"
MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
NB = " "


def put(*p):
    return os.path.join(KOREN, *p)


def e(s):
    return html.escape(str(s), quote=True)


def tipograf(txt):
    """Неразрывные пробелы в тексте (не внутри тегов): «30 млн ₽», «ст. 845», «№ 12-П», «7 198 800»."""
    def t(s):
        s = re.sub(r"(\d) (?=\d{3}(?!\d))", "\\1" + NB, s)
        s = re.sub(r"(\d) (?=\d{3}(?!\d))", "\\1" + NB, s)
        s = re.sub(r"(\d) (?=(млн|млрд|тыс\.|₽|%|месяц|рабоч|раз\b|лет\b|год|минут|дн|инстанц))", "\\1" + NB, s)
        s = re.sub(r"(^|[\s(«])(ст\.|п\.|пп\.|ч\.|подп\.|№) (?=[\dА-ЯA-Z])", "\\1\\2" + NB, s)
        s = re.sub(r" (—)", NB + "\\1", s)
        return s
    return "".join(ch if ch.startswith("<") else t(ch) for ch in re.split(r"(<[^>]+>)", txt))


def nerazryv(txt):
    """«115-ФЗ» не рвётся по дефису на 390 px — только внутри <main> и только в тексте (не в атрибутах)."""
    a, b = txt.find("<main"), txt.find("</main>")
    if a < 0 or b < 0:
        return txt
    m = re.sub(r"(>[^<]*)", lambda x: x.group(1).replace("115-ФЗ", '\x00'), txt[a:b])
    m = m.replace("\x00", '<span class="nw">115-ФЗ</span>')
    return txt[:a] + m + txt[b:]


def data_ru(iso):
    g, m, d = iso.split("-")
    return "%d %s %s" % (int(d), MES[int(m) - 1], g)


def minut_ru(n):
    """«3 минуты», «5 минут», «21 минута» — согласование с числом (сверка 05.10: на 4 разборах стояло «4 минут чтения»)."""
    if n % 10 == 1 and n % 100 != 11:
        return "%d минута" % n
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return "%d минуты" % n
    return "%d минут" % n


def sver_fraza(r, sverka):
    """Строка «Сверено» внизу разбора. Если хоть один акт сверен только по тезису (sverka_vid «tezis») —
    не пишем «по первоисточникам»: «не проверяли ≠ не нашли», и «прочитали тезис ≠ прочитали акт»."""
    t = '<time datetime="%s">%s</time>' % (sverka, data_ru(sverka))
    if any(d.get("sverka_vid") == "tezis" for d in r["dela"]):
        return "Нормы сверены по первоисточникам %s; постановление суда — по тезису в правовой базе, полный текст акта ещё сверяем" % t
    return "Сверено по первоисточникам %s" % t


def izmeneno(r):
    """dateModified и lastmod: поле «izmeneno» (ГГГГ-ММ-ДД) — когда правили текст или пересверили; нет — дата публикации."""
    v = r.get("izmeneno") or r["data"]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", v) or v < r["data"]:
        raise SystemExit("izmeneno: %r у %s" % (v, r["slug"]))
    return v


def data_ch(iso):
    g, m, d = iso.split("-")
    return "%s.%s.%s" % (d, m, g)


def dannye():
    with open(put("praktika", "dela.json"), encoding="utf-8") as fh:
        return json.load(fh)


def voprosy():
    """praktika/faq.json — «Частые вопросы» разборов ({slug: [{v, o}]}); файла нет — разборы без FAQ."""
    p = put("praktika", "faq.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)["razbory"]


def faq_razbora(r, telo, F):
    """Блок «Частые вопросы» и FAQPage разбора. Ответ — только дословные предложения из текста автора: новых
    правовых утверждений в вопросах нет (то же правило, что у статей, tests/sobrat_faq.py). Нарушение — сборка стоит."""
    v = F.get(r["slug"]) or []
    if not v:
        return "", None
    t = FAQ.norm(telo)
    for x in v:
        if not x["v"].rstrip().endswith("?") or not 1 <= len(x["o"]) <= 3:
            raise SystemExit("sobrat_praktika: %s — вопрос с «?» и 1–3 предложения в ответе: %s" % (r["slug"], x["v"]))
        for p in x["o"]:
            if FAQ.norm(p) not in t:
                raise SystemExit("sobrat_praktika: %s — предложения нет в тексте разбора дословно: %s" % (r["slug"], p))
    return FAQ.blok(v), FAQ.faqpage(v)


def url_razbora(r):
    return "/praktika/%s/%s/" % (r["razdel"], r["slug"])


def golova(title, description, url, jsonld, noindex=False):
    return """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(t)s</title>
<meta name="description" content="%(d)s">
<link rel="canonical" href="%(u)s">
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
<link rel="stylesheet" href="/css/praktika.css">
<link rel="stylesheet" href="/css/podval.css">
<link rel="stylesheet" href="/css/shapka.css">
<script src="/js/shapka.js" defer></script>
<script src="/js/metrika.js" defer></script>
</head>
<body>
<!--shapka--><!--/shapka-->
""" % {"t": e(title), "d": e(description), "u": SAJT + url, "j": json.dumps(jsonld, ensure_ascii=False)}


def kroshki_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SAJT + u} for i, (n, u) in enumerate(items)]}


def kroshki_html(items):
    ch = []
    for i, (n, u) in enumerate(items):
        ch.append('<a href="%s">%s</a>' % (u, e(n)) if i < len(items) - 1 else '<span aria-current="page">%s</span>' % e(n))
    return '<nav class="crumbs" aria-label="Навигация">' + '<span aria-hidden="true">›</span>'.join(ch) + "</nav>"


def akt_nomer(d):
    """[Ночные запуски] razbor9-v1: обзор практики Президиума ВС номера не имеет (`vid: obzor`, `nomer` пустой) — без висящего пробела."""
    return ("%s %s" % (d["akt"], d["nomer"])).strip()


def kartochka(d, n, vsego):
    t = ("Карточка обзора" if d.get("vid") == "obzor" else "Карточка дела") if vsego == 1 else "Дело %d из %d" % (n, vsego)
    itog = '<span class="itog%s">%s</span>' % (" itog--nov" if d.get("itog_nov") else "", e(d["itog"]))
    return """<section class="delo" aria-label="%(t)s">
<div class="delo__h"><p class="delo__t">%(t)s</p>%(itog)s</div>
<dl>
<dt>Суд</dt><dd>%(sud)s</dd>
<dt>Акт</dt><dd>%(akt_nomer)s</dd>
<dt>Дата</dt><dd><time datetime="%(data)s">%(data_ch)s</time></dd>
<dt>%(delo_p)s</dt><dd>%(delo)s</dd>
<dt>На кону</dt><dd>%(na_konu)s%(na_konu_2)s</dd>
</dl>
<p class="delo__src">Первоисточник: <a href="%(ist)s" rel="noopener" target="_blank">%(ist_p)s</a> · %(sv_slovo)s <time datetime="%(sv)s">%(sv_ch)s</time></p>
</section>""" % {"t": t, "itog": itog, "sud": e(d["sud"]), "akt_nomer": e(akt_nomer(d)), "delo_p": e(d.get("delo_podpis") or "Дело"),
                  "data": d["data"], "data_ch": data_ch(d["data"]), "delo": e(d["delo"]), "na_konu": e(d["na_konu"]),
                  "na_konu_2": ('<br><small class="delo__dop">%s</small>' % e(d["na_konu_2"])) if d.get("na_konu_2") else "",  # [Право] 21:10 разд. 3 п. 6
                  "ist": e(d["istochnik"]), "ist_p": e(d["istochnik_podpis"]), "sv": d["sverka"], "sv_ch": data_ch(d["sverka"]),
                  # sverka_vid «tezis»: акт сверен только по тезису в правовой базе, полный текст не читали — так и пишем ([Ночные запуски] 05.10 06:05)
                  "sv_slovo": "тезис сверен по правовой базе" if d.get("sverka_vid") == "tezis" else "сверено"}


CITATA = re.compile(r"^https://(www\.)?(vsrf\.ru/lk/practice/stor_pdf|ksrf\.ru/doc/|publication\.pravo\.gov\.ru/document/)")


def citaty(r):
    """`citation` в JSON-LD — только прямой адрес текста акта (vsrf, ksrf, pravo.gov.ru). Поиск kad.arbitr.ru или реестр
    решений без номера — не первоисточник-документ: не ставим, пока нет прямого адреса ([Ночные] 12:05, п. 5)."""
    return [d["istochnik"] for d in r["dela"] if CITATA.match(d["istochnik"])]


def pk(r):
    d = r["dela"][0]
    itog = d["itog"][0].lower() + d["itog"][1:]
    meta = " · ".join(x for x in (d["sud_kratko"], data_ch(d["data"]), d["nomer"], itog) if x)
    if len(r["dela"]) > 1:
        osnovy = {re.sub(r"\s*\(.*\)$", "", x["nomer"]) for x in r["dela"]}
        if len(osnovy) == 1:
            # Один номер на оба круга (ВС сохраняет номер производства): не повторяем его — показываем даты актов.
            meta = "%s · %d акта · %s · %s" % (d["sud_kratko"], len(r["dela"]), osnovy.pop(),
                                                " и ".join(data_ch(x["data"]) for x in r["dela"]))
        else:
            meta = "%s · %d дела · %s" % (d["sud_kratko"], len(r["dela"]), " и ".join(x["nomer"] for x in r["dela"]))
    kon = " и ".join(x.get("na_konu_kratko") or x["na_konu"] for x in r["dela"])
    return """<a class="pk" href="%s"><span class="pk__q">%s</span><span class="pk__m">%s</span><span class="pk__k">На кону — %s</span></a>""" % (
        url_razbora(r), e(r["h1"]), e(meta), e(kon))


def statya_k(url):
    """«Читайте также» — статья сайта (поле statyi в dela.json, [Продукт] 04.10 18:38 разд. 2): заголовок берём из <h1> самой
    статьи, чтобы ссылка не расходилась с живым текстом; нет файла или <h1> — сборка останавливается."""
    if not (url.startswith("/") and url.endswith("/") and not url.startswith("/praktika/")):
        raise SystemExit("statyi: адрес статьи вида /раздел/статья/ вне /praktika/: %r" % url)
    f = put(*url.strip("/").split("/"), "index.html")
    if not os.path.exists(f):
        raise SystemExit("statyi: нет страницы %s" % url)
    with open(f, encoding="utf-8") as fh:
        m = re.search(r"<h1[^>]*>(.*?)</h1>", fh.read(), re.S)
    if not m:
        raise SystemExit("statyi: нет <h1> на %s" % url)
    h1 = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
    return """<a class="pk" href="%s"><span class="pk__q">%s</span><span class="pk__m">Статья Делоскопа</span></a>""" % (e(url), e(h1))


def razbor(r, D, po_slug, F=None):
    rz = D["razdely"][r["razdel"]]
    url = url_razbora(r)
    kr = [("Делоскоп", "/"), ("Практика", "/praktika/"), (rz["kratko"], "/praktika/%s/" % r["razdel"]), (r["h1"], url)]
    ld = [{"@context": "https://schema.org", "@type": "Article", "headline": r["h1"][:110], "description": r["description"],
           "datePublished": r["data"], "dateModified": izmeneno(r), "inLanguage": "ru",
           "author": {"@type": "Organization", "name": "Редакция Делоскопа", "url": SAJT},
           "publisher": {"@type": "Organization", "name": "Делоскоп", "url": SAJT + "/", "logo": {"@type": "ImageObject", "url": SAJT + "/ikonka-512.png"}},
           "mainEntityOfPage": SAJT + url, "articleSection": rz["kratko"],
           "about": "; ".join(("%s %s от %s %s" % (d["akt"], d["sud"], data_ch(d["data"]), d["nomer"])).strip() for d in r["dela"])},
          kroshki_ld(kr[:-1] + [(r["h1"], url)])]
    cit = citaty(r)
    if cit:
        ld[0]["citation"] = cit
    with open(put("tests", "praktika", r["slug"] + ".html"), encoding="utf-8") as fh:
        telo = fh.read().strip()
    faq, faq_ld = faq_razbora(r, telo, F or {})
    if faq_ld:
        ld.append(faq_ld)
    k = r["knopka"]
    zakon = "\n".join(norma(z) for z in r["zakon"])
    sverka = max(d["sverka"] for d in r["dela"])
    sos = "\n".join([pk(po_slug[s]) for s in r["pohozhie"]] + [statya_k(u) for u in r.get("statyi", [])])
    kartochki = "\n".join(kartochka(d, i + 1, len(r["dela"])) for i, d in enumerate(r["dela"]))
    stranica = golova(r["title"], r["description"], url, ld) + """<main class="pr" id="main">
%(kr)s
<p class="rubr">Разбор дела</p>
<h1>%(h1)s</h1>
<p class="meta">Редакция Делоскопа · <time datetime="%(data)s">%(data_ru)s</time> · %(min)s чтения</p>
<p class="lid">%(lid)s</p>
%(kart)s
<article>
%(telo)s
</article>
<section class="dl" aria-label="Что сделать в Делоскопе"%(slezh)s>
<h2>%(kz)s</h2>
<p>%(kt)s</p>
<a class="btn" href="%(ku)s"%(cel)s>%(kk)s</a>
</section>
<h2>Где в законе</h2>
<ul class="zakon">
%(zakon)s
</ul>
%(faq)s
<p class="sver">%(sver_fraza)s. Материал носит информационный характер, исход спора не гарантирует и не заменяет консультацию юриста. Нашли неточность — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</p>
<h2>%(sos_z)s</h2>
<div class="sos">
%(sos)s
</div>
</main>
<script src="/obnovleniya.js" defer></script>
<script src="/js/otzyv.js" defer></script>
%(slezh_js)s<!--podval--><!--/podval-->
</body>
</html>
""" % {"kr": kroshki_html(kr), "h1": e(r["h1"]), "data": r["data"], "data_ru": data_ru(r["data"]), "min": minut_ru(r["minut"]),
       "lid": e(r["lid"]), "kart": kartochki, "telo": telo, "kz": e(k["zagolovok"]), "kt": e(k["tekst"]), "ku": e(k["url"]),
       "kk": e(k["knopka"]),
       "cel": (' data-goal="%s"' % e(k["cel"])) if k.get("cel") else "", "slezh": slezh_attr(k), "slezh_js": '<script src="/js/slezh-knopka.js" defer></script>\n' if k.get("slezh") else "", "zakon": zakon, "faq": faq, "sv": sverka, "sv_ru": data_ru(sverka), "sver_fraza": sver_fraza(r, sverka), "sos": sos,
       "sos_z": "Читайте также" if r.get("statyi") else "Похожие разборы"}
    return url, stranica


def slezh_attr(k):
    """Вторая кнопка «Следить за …» (knopka.slezh в dela.json): в HTML — только атрибуты секции, текста кнопки на странице нет.
    Кнопку ставит js/slezh-knopka.js, когда tarify.json → slezhenie_pisma: true (пока писем нет — обещания нет нигде)."""
    sl = k.get("slezh")
    if not sl:
        return ""
    if set(sl) - {"knopka", "url", "cel"} or not sl.get("knopka") or not str(sl.get("url", "")).startswith("/cabinet.html"):
        raise SystemExit("knopka.slezh: нужны knopka и url /cabinet.html…, лишних полей нет: %r" % sl)
    return ' data-slezh="%s" data-slezh-url="%s"%s' % (e(sl["knopka"]), e(sl["url"]),
                                                   (' data-slezh-cel="%s"' % e(sl["cel"])) if sl.get("cel") else "")


def norma(z):
    """Строка «Где в законе»: [норма, редакция, первоисточник]. Первоисточник — адрес полного текста (норма — ссылкой)
    или список пар [подпись, адрес], когда статьи из двух документов (ГК ч. 1 и ч. 2) — тогда каждая ссылка — своей меткой после нормы (на 390 px метки переносятся целиком)."""
    n, red, ist = z
    red_html = ' <span class="red">%s</span>' % e(red) if red else ""
    if isinstance(ist, str):
        return '<li><a href="%s" rel="noopener" target="_blank">%s</a>%s</li>' % (e(ist), e(n), red_html)
    ssylki = "".join(' <span class="red"><a href="%s" rel="noopener" target="_blank">%s</a></span>' % (e(u), e(podp)) for podp, u in ist)
    return '<li>%s%s%s</li>' % (e(n), red_html, ssylki)


def chislo_razborov(n):
    return "разбор" if n % 10 == 1 and n % 100 != 11 else ("разбора" if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else "разборов")


def svodka_haba(spisok):
    """[Ночные запуски] seo-pered-volnoj-v1 (ТЗ [Продукт · Маркетинг] 03.10 разд. 2.2): вводная строка хаба — только из dela.json.
    Число и дата не пишутся руками: новый разбор первым в dela.json — строка обновится сама."""
    if not spisok:
        return ""
    r = spisok[0]  # новые — первыми (правило dela.json, _kak)
    h = r["h1"].replace("«", "„").replace("»", "“")
    # [Право] 03.10 10:20, разд. 4: «решений ВС, КС и арбитражных судов» — только если у КАЖДОГО разбора все карточки дел —
    # судебные акты (поле `sud` заполнено). Разбор по письму Минфина/ФНС (карточка без `sud`) или без поля → «судебных решений и позиций ведомств».
    # Дата — публикации разбора («опубликован»), а не акта суда.
    vid = "решений ВС, КС и арбитражных судов" if vse_sudebnye(spisok) else "судебных решений и позиций ведомств"
    return "%d %s %s: суть, сколько на кону, что сделать. Последний — «%s», опубликован %s." % (
        len(spisok), chislo_razborov(len(spisok)), vid, h, data_ru(r["data"]))


def vse_sudebnye(spisok):
    # [Право] 03.10 14:30, разд. 2: обзор практики Президиума ВС (`vid: obzor`) — позиция, а не решение по делу → второй вариант строки.
    return all(r.get("dela") and all((d.get("sud") or "").strip() and d.get("vid") != "obzor" for d in r["dela"]) for r in spisok)


def hab(D, razdel=None):
    if razdel:
        rz = D["razdely"][razdel]
        url, h1, title, desc, lid = "/praktika/%s/" % razdel, rz["h1"], rz["title"], rz["description"], rz["lid"]
        kr = [("Делоскоп", "/"), ("Практика", "/praktika/"), (rz["kratko"], url)]
        spisok = [r for r in D["razbory"] if r["razdel"] == razdel]
    else:
        url, h1 = "/praktika/", "Как решают суды"
        title = "Судебная практика для бизнеса: разборы дел — Делоскоп"
        desc = "Разборы решений ВС, КС и арбитражных судов о блокировках счетов, комиссиях банков и налогах: номер дела, первоисточник, что делать и сколько на кону."
        lid = "Одно дело — одна страница: что случилось, что решил суд, где грань и что сделать завтра утром. У каждого разбора — номер дела и ссылка на текст акта."
        kr = [("Делоскоп", "/"), ("Практика", url)]
        spisok = list(D["razbory"])
    lid = lid + " " + svodka_haba(spisok)
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": h1, "description": desc, "url": SAJT + url, "inLanguage": "ru",
           "hasPart": [{"@type": "Article", "headline": r["h1"][:110], "url": SAJT + url_razbora(r)} for r in spisok]}, kroshki_ld(kr)]
    razd = [("Все", "/praktika/")] + [(v["nazvanie"], "/praktika/%s/" % k) for k, v in D["razdely"].items()]
    razd_html = "".join('<a href="%s"%s>%s</a>' % (u, ' aria-current="page"' if u == url else "", e(n)) for n, u in razd)
    stranica = golova(title, desc, url, ld) + """<main class="pr" id="main">
%(kr)s
<p class="rubr">Практика</p>
<h1>%(h1)s</h1>
<p class="lid">%(lid)s</p>
<nav class="razd" aria-label="Разделы практики">%(razd)s</nav>
<h2>%(n)s</h2>
<div class="sos">
%(sp)s
</div>
<p class="sver">Каждый разбор сверен с текстом судебного акта на дату, указанную в карточке дела. Материалы носят информационный характер и не заменяют консультацию юриста. Нашли неточность — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</p>
</main>
<script src="/obnovleniya.js" defer></script>
<!--podval--><!--/podval-->
</body>
</html>
""" % {"kr": kroshki_html(kr), "h1": e(h1), "lid": e(lid), "razd": razd_html, "sp": "\n".join(pk(r) for r in spisok),
       "n": "Разборы: %d" % len(spisok)}
    return url, stranica


def ssylka_v_hab(txt, razdel, n):
    """Карточка «Практика судов» в хабах /115-fz/ и /nalogi/ — между метками <!--praktika-->…<!--/praktika-->."""
    slova = chislo_razborov(n)
    blok = ('<!--praktika--><a class="card" href="/praktika/%s/"><small>Практика судов</small><b>Как решают суды: %d %s дел с номером акта и первоисточником</b>'
            '<span>Что случилось, что решил суд, что делать завтра утром</span></a><!--/praktika-->') % (razdel, n, slova)
    if "<!--praktika-->" in txt:
        return re.sub(r"<!--praktika-->.*?<!--/praktika-->", lambda m: blok, txt, flags=re.S)
    return txt.replace('<div class="cards" style="margin-top:28px">', '<div class="cards" style="margin-top:28px">' + blok, 1)


def ssylki_s_sajta(txt, f, spisok, D, po_slug):
    """Входящие ссылки на разборы с живых страниц (SEO-обвязка [Маркетинга] 30.09, п. 5): блок между метками
    <!--praktika-ssylki-->…<!--/praktika-ssylki-->. Статья — строка «Как это решают суды: …» перед </article>;
    /pasport/ — строка под «Как устроен Паспорт»; /skoraya-115-fz/ — карточки в «Разобраться подробнее»."""
    def cel(x):
        if x.startswith("hab:"):
            k = x[4:]
            n = sum(1 for r in D["razbory"] if r["razdel"] == k)
            return "/praktika/%s/" % k, "%s — %d %s" % (D["razdely"][k]["h1"], n, "разбора" if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else "разборов")
        r = po_slug[x]
        return url_razbora(r), r["h1"]
    celi = [cel(x) for x in spisok]
    if f.startswith("skoraya-115-fz/"):
        blok = "".join('<a class="card" href="%s"><small>Практика судов</small><b>%s</b><span>%s</span></a>' % (
            u, e(t), "Разборы дел с номером акта и первоисточником" if u.count("/") == 3 else "Разбор дела с номером акта") for u, t in celi)
        yakor, kak = '<h2>Разобраться подробнее</h2>\n  <div class="cards">', "posle"
    elif f.startswith("pasport/"):
        blok = "".join('<p class="hint">Почему важна дата проверки — <a href="%s">разбор двух дел: 137&nbsp;млн&nbsp;₽ отменили, 57&nbsp;млн&nbsp;— нет&nbsp;→</a></p>' % u for u, t in celi)
        yakor, kak = '  <h2>Как проверить подлинность</h2>', "pered"
    else:
        blok = "".join('<p><strong>Как это решают суды:</strong> <a href="%s">%s&nbsp;→</a></p>' % (u, e(t)) for u, t in celi)
        yakor, kak = "</article>", "pered"
    blok = "<!--praktika-ssylki-->" + blok.replace("115-ФЗ", "115&#8209;ФЗ") + "<!--/praktika-ssylki-->"  # не рвётся на 390
    if "<!--praktika-ssylki-->" in txt:
        return re.sub(r"<!--praktika-ssylki-->.*?<!--/praktika-ssylki-->", lambda m: blok, txt, flags=re.S)
    if txt.count(yakor) != 1:
        raise SystemExit("sobrat_praktika: в %s нет единственного места для ссылок на разборы (%s)" % (f, yakor))
    otstup = yakor[:len(yakor) - len(yakor.lstrip())]
    return txt.replace(yakor, (yakor + blok) if kak == "posle" else (otstup + blok + "\n" + yakor), 1)


def tri_dlya_glavnoj(D):
    """Три разбора для главной (glavnaya-v2, ТЗ [Продукт] 01.10, разд. 2.5): последние по дате; при равных датах —
    сначала по одному из каждого раздела, затем по порядку в dela.json (новые — первыми)."""
    po_date = sorted(D["razbory"], key=lambda r: r["data"], reverse=True)  # sorted устойчив: порядок json сохраняется
    top = [r for r in po_date if r["data"] == po_date[0]["data"]]
    if len(top) >= 3:
        vybor, est = [], set()
        for r in top:
            if r["razdel"] not in est:
                vybor.append(r); est.add(r["razdel"])
        vybor += [r for r in top if r not in vybor]
        return vybor[:3]
    return po_date[:3]


def glavnaya(txt, D):
    """Блок «Как решают суды» на главной — между метками <!--praktika-glavnaya-->…<!--/praktika-glavnaya-->."""
    if "<!--praktika-glavnaya-->" not in txt:
        return txt
    kart = []
    for r in tri_dlya_glavnoj(D):
        d = r["dela"][0]
        stroka = "%s · %s · %s" % (d["sud"], akt_nomer(d)[0].lower() + akt_nomer(d)[1:], data_ru(d["data"]))
        kart.append('<a href="%s"><small>%s</small><b>%s</b><span>%s</span></a>' % (
            url_razbora(r), e(D["razdely"][r["razdel"]]["kratko"]), e(r["h1"]), e(stroka)))
    blok = '<!--praktika-glavnaya--><div class="pr-gl">%s</div><!--/praktika-glavnaya-->' % "".join(kart)
    blok = nerazryv(tipograf(blok)).replace("115-ФЗ", "115&#8209;ФЗ")
    return re.sub(r"<!--praktika-glavnaya-->.*?<!--/praktika-glavnaya-->", lambda m: blok, txt, flags=re.S)


def sitemap(txt, D):
    txt = re.sub(r"\s*<url><loc>https://deloskop\.ru/praktika/[^<]*</loc>.*?</url>", "", txt)
    daty = {}
    for r in D["razbory"]:
        daty[url_razbora(r)] = izmeneno(r)
        for u in ("/praktika/", "/praktika/%s/" % r["razdel"]):
            daty[u] = max(daty.get(u, ""), izmeneno(r))
    stroki = "".join("\n  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, u, d) for u, d in daty.items())
    return txt.replace("\n</urlset>", stroki + "\n</urlset>", 1)


def sobrat():
    """Словарь {путь файла: новое содержимое} — всё, что должен дать сборщик."""
    D = dannye()
    po_slug = {r["slug"]: r for r in D["razbory"]}
    F = voprosy()
    lishnie = set(F) - set(po_slug)
    if lishnie:
        raise SystemExit("sobrat_praktika: в praktika/faq.json вопросы к несуществующим разборам: " + ", ".join(sorted(lishnie)))
    r_ = SH.rekv_sajta()
    podval, shapka = SH.podval_html(r_), SH.shapka_html()
    out = {}
    stranicy = [hab(D)] + [hab(D, k) for k in D["razdely"]] + [razbor(r, D, po_slug, F) for r in D["razbory"]]
    for url, txt in stranicy:
        out[url.strip("/") + "/index.html"] = SH.sobrat_stranicu(nerazryv(tipograf(txt)), r_, podval, shapka)
    for razdel, f in (("115-fz", "115-fz/index.html"), ("nalogi", "nalogi/index.html")):
        n = sum(1 for r in D["razbory"] if r["razdel"] == razdel)
        with open(put(f), encoding="utf-8") as fh:
            out[f] = ssylka_v_hab(fh.read(), razdel, n)
    for f, spisok in D.get("ssylki_s_sajta", {}).items():
        if f.startswith("_"):
            continue
        with open(put(f), encoding="utf-8") as fh:
            out[f] = ssylki_s_sajta(fh.read(), f, spisok, D, po_slug)
    with open(put("index.html"), encoding="utf-8") as fh:
        out["index.html"] = glavnaya(fh.read(), D)
    with open(put("sitemap.xml"), encoding="utf-8") as fh:
        out["sitemap.xml"] = sitemap(fh.read(), D)
    return out


def main():
    check = "--check" in sys.argv
    izm = []
    for f, txt in sobrat().items():
        p = put(f)
        stary = open(p, encoding="utf-8").read() if os.path.exists(p) else None
        if stary != txt:
            izm.append(f)
            if not check:
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(txt)
    if check:
        if izm:
            print("Нужна сборка практики: " + ", ".join(izm))
            sys.exit(1)
        print("Практика собрана")
    else:
        print("Собрано: %d файлов" % len(izm) + ("" if not izm else " — " + ", ".join(izm)))


if __name__ == "__main__":
    main()
