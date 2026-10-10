#!/usr/bin/env python3
"""Рейтинг компаний по открытой отчётности — страница /reyting/ (reyting-v1, 10.10.2026;
решение владельца 10.10 04:35, claude/Решения_владельца_10.10_полное_согласие_экосистема_бренды_идеи.md, п. 3).

Откуда цифры: только из опубликованных карточек /company/ (те, что прошли ворота индексации — без noindex).
Своих данных нет: выручка, прибыль, изменение к прошлому году, год регистрации — ровно то, что стоит
на карточке, с тем же источником и датой сведений. ИП нет (карточек ИП нет вовсе).

Правила:
  * одна таблица — одна цифра и один год; компании с отчётностью за другой год в таблицу года не входят
    (их число пишем под таблицей — «не проверяли ≠ не нашли»);
  * ранжируем только факты; слов «надёжн», «лучш», «рекоменд» на странице нет (222-ФЗ, ✎ [Право]);
  * отчётность — юрлица, а не группы: так и пишем;
  * до «да» [Право] на формулировки — noindex и не в sitemap (флаг OTKRYT ниже);
  * reyting-v1.1 (10.10): «да» [Право] получено — страница в индексе: строка в sitemap.xml (сразу после главной,
    lastmod — самая свежая дата сведений) и ссылка в шапке хаба /company/ между метками <!--reyting-->…<!--/reyting-->;
    компании без отчётности за год таблицы в список не входят и «0» не получают; ИП (12 цифр) и ФИО на странице нет (тест).

    python3 tests/sobrat_reyting.py           — собрать reyting/index.html
    python3 tests/sobrat_reyting.py --check   — только проверить (код 1, если страница устарела)
Сборщик карточек (tests/kartochki.py sobrat) вызывает сборку сам, если страница уже есть.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sobrat_shapku as SH  # noqa: E402
from sobrat_praktika import tipograf, nerazryv, kroshki_ld  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAJT = "https://deloskop.ru"
URL = "/reyting/"
OTKRYT = True  # reyting-v1.1: «да» [Право] 10.10 10:07 (claude/Право_ответы_✎_рейтинг_…_10.10.md, разд. 1) — без noindex, адрес в sitemap.xml, ссылка из хаба /company/
TOP = 15
TOP_MALYJ = 10
NB = "\u00a0"

MNOZH = {"тыс.": 1e3, "млн": 1e6, "млрд": 1e9, "трлн": 1e12}
_CHISLO = re.compile(r"(минус\s+)?(\d[\d\s]*(?:,\d+)?)\s*(тыс\.|млн|млрд|трлн)?\s*₽")
_FAKT = re.compile(r'<li class="co-v[^"]*">.*?<p>(.*?)</p>\s*<span class="co-src">(.*?)</span>', re.S)


def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def tekst(h):
    h = re.sub(r"<[^>]+>", "", h)
    return html.unescape(h).replace(NB, " ").strip()


def chislo(s):
    """«5,4 млрд ₽» → 5.4e9; «минус 2 млрд ₽» → -2e9; нет суммы → None."""
    m = _CHISLO.search(s)
    if not m:
        return None
    v = float(m.group(2).replace(" ", "").replace(",", ".")) * MNOZH.get(m.group(3) or "", 1)
    return -v if m.group(1) else v


def summa_tekstom(s):
    """Сумма ровно как на карточке: «5,4 млрд ₽»."""
    m = _CHISLO.search(s)
    return m.group(0).strip() if m else ""


def procent(s):
    """«… — на 12 % больше, чем годом раньше» → 12; «меньше» → −12; нет — None."""
    m = re.search(r"на\s+(\d+(?:,\d+)?)\s*%\s+(больше|меньше)", s)
    if not m:
        return None
    v = float(m.group(1).replace(",", "."))
    return v if m.group(2) == "больше" else -v


def data_svedenij(src):
    m = re.search(r"сведения на (\d{2}\.\d{2}\.\d{4})", src)
    return m.group(1) if m else None


# ---------- чтение карточек ----------
def kartochki(koren=KOREN):
    papka = os.path.join(koren, "company")
    out = []
    if not os.path.isdir(papka):
        return out
    for d in sorted(os.listdir(papka)):
        if not re.match(r"^\d{10}-", d):
            continue  # ИНН юрлица — 10 цифр; ИП (12) не бывает
        p = os.path.join(papka, d, "index.html")
        if not os.path.isfile(p):
            continue
        with open(p, encoding="utf-8") as fh:
            s = fh.read()
        golova = s[:s.find("</head>")]
        if re.search(r'<meta name="robots" content="[^"]*noindex', golova):
            continue  # за воротами индексации — в рейтинг не идёт
        k = razobrat(s, d)
        if k:
            out.append(k)
    return out


def razobrat(s, papka):
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)
    if not m:
        return None
    try:
        ld = json.loads(m.group(1))
    except ValueError:
        return None
    org = next((x for x in ld.get("@graph", []) if x.get("@type") == "Organization"), None)
    if not org or not re.match(r"^\d{10}$", org.get("taxID", "")):
        return None
    adr = org.get("address") or {}
    k = {"inn": org["taxID"], "imya": org.get("name") or "", "url": "/company/%s/" % papka,
         "gorod": adr.get("addressLocality") or "", "region": adr.get("addressRegion") or "",
         "osnovana": org.get("foundingDate") or "", "otrasl": ""}
    kr = re.search(r'<nav class="co-krosh[^"]*"[^>]*>(.*?)</nav>', s, re.S)
    if kr:
        chasti = [tekst(x) for x in tekst_s_razdelitelem(kr.group(1))]
        if len(chasti) >= 4:
            k["otrasl"] = chasti[-1]
    for p, src in _FAKT.findall(s):
        t = tekst(p)
        src_t = tekst(src)
        g = re.match(r"(Выручка|Чистая прибыль|Убыток) за (\d{4}) — ", t)
        if not g or "● подтверждено" not in src_t:
            continue
        vid = {"Выручка": "vyruchka", "Чистая прибыль": "pribyl", "Убыток": "pribyl"}[g.group(1)]
        if vid in k:
            continue
        v = chislo(t[g.end():])
        if v is None:
            continue
        if g.group(1) == "Убыток":
            v = -abs(v)
        k[vid] = {"god": int(g.group(2)), "v": v, "tekst": summa_tekstom(t[g.end():]),
                  "ubytok": g.group(1) == "Убыток", "izm": procent(t), "data": data_svedenij(src_t),
                  "istochnik": src_t.split(" · ")[0]}
    return k


def tekst_s_razdelitelem(h):
    return [x for x in re.split(r"\s*›\s*", re.sub(r"<[^>]+>", "", h)) if x.strip()]


# ---------- таблицы ----------
def god_otchetnosti(spisok, vid):
    """Самый частый год отчётности по виду цифры — год таблицы."""
    goda = {}
    for k in spisok:
        if vid in k:
            goda[k[vid]["god"]] = goda.get(k[vid]["god"], 0) + 1
    return max(goda, key=lambda g: (goda[g], g)) if goda else None


def data_ru_kratko(dmy):
    return dmy or "—"


def chislo_ru(v):
    s = ("%.0f" % abs(v)) if abs(v - round(v)) < 0.05 else ("%.1f" % abs(v)).replace(".", ",")
    return s


def izm_html(izm, god):
    if izm is None:
        return ""
    if izm == 0:
        return '<span class="ry-izm">как в %d</span>' % (god - 1)
    znak = "+" if izm > 0 else "−"
    kl = "ry-izm ry-izm--plus" if izm > 0 else "ry-izm ry-izm--minus"
    return '<span class="%s">%s%s%s%% к %d</span>' % (kl, znak, chislo_ru(izm), NB, god - 1)


def kompaniya_html(k):
    gde = k["gorod"] or k["region"]
    return ('<a href="%s">%s</a><span class="ry-gde">%s%s</span>' % (
        e(k["url"]), e(k["imya"]), e(gde), (" · " + e(k["otrasl"])) if k["otrasl"] else ""))


def tablica(stroki, zag_znach, polosa=None):
    """stroki: [(k, значение-html, доля 0..1 или None)]."""
    tr = []
    for i, (k, zn, dolya) in enumerate(stroki, 1):
        bar = ""
        if dolya is not None:
            bar = '<span class="ry-bar" aria-hidden="true"><i style="width:%.1f%%"></i></span>' % max(1.5, dolya * 100)
        tr.append('<tr><td class="ry-n num">%d</td><td class="ry-k">%s%s</td><td class="num ry-z">%s</td></tr>' % (
            i, kompaniya_html(k), bar, zn))
    return ('<div class="table-wrap"><table class="table ry-t"><thead><tr><th class="ry-n">№</th><th>Компания</th>'
            '<th class="ry-z">%s</th></tr></thead><tbody>%s</tbody></table></div>' % (e(zag_znach), "".join(tr)))


def istochnik_html(spisok, vid, god, ne_voshli):
    daty = sorted({k[vid]["data"] for k in spisok if k[vid].get("data")})
    ist = spisok[0][vid]["istochnik"] if spisok else "ГИР БО"
    s = "%s · сведения на %s · ● подтверждено источником" % (ist, ", ".join(daty) or "—")
    if ne_voshli:
        s += (" · не вошли %d %s: отчётности за %d в открытых данных нет — это не значит, что её нет у компании"
              % (ne_voshli, sklon(ne_voshli, "компания", "компании", "компаний"), god))
    return '<p class="co-src ry-src">%s</p>' % e(s)


def sklon(n, a, b, c):
    n = abs(n) % 100
    if 10 < n < 20:
        return c
    n %= 10
    return a if n == 1 else b if 2 <= n <= 4 else c


def sobrat_dannye(vse):
    """Всё, что идёт на страницу, — словарём (тест сверяет порядок и источники)."""
    res = {"vsego": len(vse)}
    g = god_otchetnosti(vse, "vyruchka")
    res["god"] = g
    vyr = [k for k in vse if "vyruchka" in k and k["vyruchka"]["god"] == g and k["vyruchka"]["v"] > 0]
    vyr.sort(key=lambda k: (-k["vyruchka"]["v"], k["imya"]))
    res["vyruchka"] = vyr
    res["vyruchka_ne_voshli"] = len(vse) - len(vyr)
    rost = [k for k in vyr if k["vyruchka"]["izm"] is not None]
    rost.sort(key=lambda k: (-k["vyruchka"]["izm"], -k["vyruchka"]["v"], k["imya"]))
    res["rost"] = rost
    gp = god_otchetnosti(vse, "pribyl")
    pr = [k for k in vse if "pribyl" in k and k["pribyl"]["god"] == gp]
    res["god_pribyli"] = gp
    res["pribyl"] = sorted([k for k in pr if k["pribyl"]["v"] > 0], key=lambda k: (-k["pribyl"]["v"], k["imya"]))
    res["ubytok"] = sorted([k for k in pr if k["pribyl"]["v"] < 0], key=lambda k: (k["pribyl"]["v"], k["imya"]))
    res["pribyl_ne_voshli"] = len(vse) - len(pr)
    st = [k for k in vse if re.match(r"^\d{4}-\d{2}-\d{2}$", k["osnovana"])]
    st.sort(key=lambda k: (k["osnovana"], k["imya"]))
    res["starshie"] = st
    otr = {}
    for k in vyr:
        otr.setdefault(k["otrasl"] or "Другое", []).append(k)
    res["otrasli"] = sorted(otr.items(), key=lambda x: (-len(x[1]), -x[1][0]["vyruchka"]["v"], x[0]))
    return res


MES_R = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


def data_reg(iso):
    g, m, d = iso.split("-")
    return "%d %s %s" % (int(d), MES_R[int(m) - 1], g)


def stranica(D):
    g, gp = D["god"], D["god_pribyli"]
    title = "Рейтинг компаний по отчётности: выручка, прибыль, рост | Делоскоп"  # ≤ 70 знаков (v1.1: страница идёт в индекс)
    desc = ("Выручка за %s год и прибыль, рост к прошлому году, дата регистрации — компании из карточек Делоскопа. "
            "У каждой цифры — источник и дата сведений." % g)  # ≤ 160 знаков
    ld = [kroshki_ld([("Делоскоп", "/"), ("Компании", "/company/"), ("Рейтинг по отчётности", URL)])]
    if D["vyruchka"]:
        ld.append({"@context": "https://schema.org", "@type": "ItemList",
                   "name": "Выручка за %s год — компании Делоскопа" % g, "numberOfItems": min(TOP, len(D["vyruchka"])),
                   "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": SAJT + k["url"], "name": k["imya"]}
                                       for i, k in enumerate(D["vyruchka"][:TOP])]})
    robots = "" if OTKRYT else '<meta name="robots" content="noindex, nofollow">\n'
    ch = ["""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(t)s</title>
<meta name="description" content="%(d)s">
%(r)s<link rel="canonical" href="%(u)s">
<meta property="og:type" content="website">
<meta property="og:title" content="%(t)s">
<meta property="og:description" content="%(d)s">
<meta property="og:url" content="%(u)s">
<meta property="og:image" content="https://deloskop.ru/ikonka-512.png">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">%(j)s</script>
<link rel="stylesheet" href="/css/ds.css">
<link rel="stylesheet" href="/css/co.css">
<link rel="stylesheet" href="/css/reyting.css">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/podval.css">
<link rel="stylesheet" href="/css/shapka.css">
<script src="/js/shapka.js" defer></script>
<script src="/js/metrika.js" defer></script>
<script src="/obnovleniya.js" defer></script>
<script src="/js/kopiya.js" defer></script>
</head>
<body>
<!--shapka--><!--/shapka-->
""" % {"t": e(title), "d": e(desc), "u": SAJT + URL, "r": robots, "j": json.dumps(ld, ensure_ascii=False)}]
    ch.append('<main id="main" class="wrap co-wrap ry">')
    ch.append('<nav class="co-krosh caption" aria-label="Навигация"><a href="/">Делоскоп</a> › <a href="/company/">Компании</a> › Рейтинг по отчётности</nav>')
    ch.append('<header class="co-head ry-head"><p class="ry-nad caption">Компании в цифрах · %d %s</p>'
              '<h1>Рейтинг по открытой отчётности</h1>'
              '<p class="lead ry-lead">Компании из карточек Делоскопа, выстроенные по одной цифре из госреестров: выручка, прибыль, рост, '
              'дата регистрации. Это не оценка компании и не совет, с кем работать, — только факты с источником и датой сведений.</p>'
              '<div class="co-act"><a class="btn btn--primary" href="/" data-goal="reyting_proverka">Проверить свою компанию по ИНН</a></div></header>'
              % (D["vsego"], sklon(D["vsego"], "компания", "компании", "компаний")))

    # 1. Выручка
    v = D["vyruchka"][:TOP]
    if v:
        mx = v[0]["vyruchka"]["v"]
        st = [(k, '%s%s' % (e(k["vyruchka"]["tekst"]), izm_html(k["vyruchka"]["izm"], g)), k["vyruchka"]["v"] / mx) for k in v]
        ch.append('<section class="co-sec" aria-labelledby="ry-vyr"><h2 id="ry-vyr">Выручка за %d год</h2>'
                  '<p class="ry-pod">Первые %d из %d. Отчётность самого юрлица, а не группы компаний: у холдинга выручка бывает меньше, чем у его дочерних компаний.</p>%s%s</section>'
                  % (g, len(v), len(D["vyruchka"]), tablica(st, "Выручка"),
                     istochnik_html(D["vyruchka"], "vyruchka", g, D["vyruchka_ne_voshli"])))
    # 2. Рост
    r = [k for k in D["rost"] if k["vyruchka"]["izm"] > 0][:TOP_MALYJ]
    if r:
        st = [(k, '<b class="ry-big">+%s%s%%</b><span class="ry-izm">%s за %d</span>' % (
            chislo_ru(k["vyruchka"]["izm"]), NB, e(k["vyruchka"]["tekst"]), g), None) for k in r]
        snizh = len([k for k in D["rost"] if k["vyruchka"]["izm"] < 0])
        ch.append('<section class="co-sec" aria-labelledby="ry-rost"><h2 id="ry-rost">Быстрее всех росла выручка</h2>'
                  '<p class="ry-pod">%d год к %d: насколько выросла выручка за год. Выручка снизилась у %d из %d компаний, где карточка сравнивает два года.</p>%s%s</section>'
                  % (g, g - 1, snizh, len(D["rost"]), tablica(st, "Рост"),
                     istochnik_html(D["rost"], "vyruchka", g, 0)))
    # 3. Прибыль и убыток
    p = D["pribyl"][:TOP_MALYJ]
    if p:
        mx = p[0]["pribyl"]["v"]
        st = [(k, '%s%s' % (e(k["pribyl"]["tekst"]), izm_html(k["pribyl"]["izm"], gp)), k["pribyl"]["v"] / mx) for k in p]
        ub = D["ubytok"]
        ub_html = ""
        if ub:
            ub_html = ('<p class="ry-ub"><b>Убыток по итогам %d года</b> — у %d %s: %s.</p>' % (
                gp, len(ub), sklon(len(ub), "компании", "компаний", "компаний"),
                ", ".join('<a href="%s">%s</a> (%s)' % (e(k["url"]), e(k["imya"]), e(k["pribyl"]["tekst"])) for k in ub)))
        vse_pr = D["pribyl"] + D["ubytok"]
        ch.append('<section class="co-sec" aria-labelledby="ry-pr"><h2 id="ry-pr">Чистая прибыль за %d год</h2>'
                  '<p class="ry-pod">Первые %d из %d с прибылью.</p>%s%s%s</section>'
                  % (gp, len(p), len(D["pribyl"]), tablica(st, "Прибыль"), ub_html,
                     istochnik_html(vse_pr, "pribyl", gp, D["pribyl_ne_voshli"])))
    # 4. Старшие в реестре
    s = D["starshie"][:TOP_MALYJ]
    if s:
        st = [(k, '%s<span class="ry-izm">%s</span>' % (k["osnovana"][:4], e(data_reg(k["osnovana"]))), None) for k in s]
        ch.append('<section class="co-sec" aria-labelledby="ry-st"><h2 id="ry-st">Дольше всех в реестре</h2>'
                  '<p class="ry-pod">По дате регистрации юрлица в ЕГРЮЛ. Многие компании старше своей записи: '
                  'до 2002 года регистрацию вели другие органы, а после реорганизации у компании появляется новая дата.</p>%s'
                  '<p class="co-src ry-src">ЕГРЮЛ · дата регистрации из выписки на дату карточки · ● подтверждено источником</p></section>'
                  % tablica(st, "С года"))
    # 5. Отрасли
    if D["otrasli"]:
        li = []
        for nazv, sp in D["otrasli"]:
            k = sp[0]
            li.append('<li><span class="ry-otr">%s</span><span class="ry-otr__n num">%d</span>'
                      '<span class="ry-otr__l">больше всех выручка — <a href="%s">%s</a>, %s</span></li>' % (
                          e(nazv), len(sp), e(k["url"]), e(k["imya"]), e(k["vyruchka"]["tekst"])))
        ch.append('<section class="co-sec" aria-labelledby="ry-otr"><h2 id="ry-otr">По отраслям</h2>'
                  '<p class="ry-pod">Отрасль — по основному виду деятельности в ЕГРЮЛ, число — компаний в таблице выручки за %d год.</p>'
                  '<ul class="ry-otrasli">%s</ul></section>' % (g, "".join(li)))
    # Как составлено
    ch.append('<section class="co-sec co-ogov ry-kak" aria-labelledby="ry-kak"><h2 id="ry-kak">Как составлено</h2>'
              '<p>Это не кредитный рейтинг, не оценка компании и не совет, с кем работать: только цифры из бухгалтерской '
              'отчётности (ГИР БО) и ЕГРЮЛ — с годом отчётности и датой сведений.</p>'
              '<p>Только компании, у которых есть карточка в Делоскопе: действующие коммерческие организации с открытой отчётностью. '
              'Индивидуальных предпринимателей здесь нет. Цифры — те же, что на карточке компании, с теми же датами сведений; '
              'суммы округлены, как на карточке.</p>'
              '<p>В таблицу года входят компании, у которых в открытых данных есть отчётность именно за этот год. '
              'Компании без неё не ниже и не выше остальных — по ним цифры нет, и мы так и пишем.</p>'
              '<p>Выручка и прибыль говорят о размере бизнеса, а не о том, безопасна ли сделка. Перед оплатой проверьте контрагента на сегодня: '
              '<a href="/">проверка по ИНН</a> покажет реестры, долги и Индекс Делоскопа.</p>'
              '<p class="ry-oshibka">Нашли ошибку в цифре — напишите на <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>: '
              'проверим по отчётности и исправим.</p>'
              '<p class="caption">Все компании — в разделе <a href="/company/">«Компании»</a>.</p></section>')
    ch.append("</main>\n<!--podval--><!--/podval-->\n</body>\n</html>\n")
    return "".join(ch)


def sobrat(koren=KOREN):
    D = sobrat_dannye(kartochki(koren))
    txt = stranica(D)
    r_ = SH.rekv_sajta()
    # сырые NBSP → &nbsp;: патч остаётся ASCII-безопасным при пересылке текстом (урок kartochki-ascii-v1)
    txt = nerazryv(tipograf(txt)).replace(NB, "&nbsp;")
    return SH.sobrat_stranicu(txt, r_, SH.podval_html(r_), SH.shapka_html()), D


SM_STROKA = re.compile(r"\n  <url><loc>https://deloskop\.ru/reyting/</loc>[^\n]*</url>")
GLAVNAYA_SM = "<url><loc>https://deloskop.ru/</loc>"
HAB_METKA = re.compile(r"<!--reyting-->.*?<!--/reyting-->", re.S)


def lastmod(D, koren=KOREN):
    """Самая свежая lastmod карточек страницы в sitemap-companies.xml: рейтинг меняется вместе с ними."""
    p = os.path.join(koren, "sitemap-companies.xml")
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as fh:
        sm = dict(re.findall(r"<loc>%s(/company/\d{10}-[^<]+)</loc><lastmod>(\d{4}-\d{2}-\d{2})</lastmod>" % re.escape(SAJT), fh.read()))
    daty = [sm[k["url"]] for k in D["vyruchka"] if k["url"] in sm]
    return max(daty) if daty else None


def sitemap(txt, D, koren=KOREN):
    """Строка /reyting/ — сразу после главной (место не зависит от сборщика практики, который пишет в конец)."""
    txt = SM_STROKA.sub("", txt)
    lm = lastmod(D, koren)
    if not (OTKRYT and lm and D["vyruchka"]):
        return txt
    i = txt.find(GLAVNAYA_SM)
    if i < 0:
        return txt
    j = txt.find("</url>", i) + len("</url>")
    return txt[:j] + "\n  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, URL, lm) + txt[j:]


def ssylka_v_hab(txt, D):
    """Хаб /company/ (стр. 1): строка-ссылка в шапке, перед </header>. Без OTKRYT — убрать."""
    txt = HAB_METKA.sub("", txt)
    if not (OTKRYT and D["vyruchka"]):
        return txt
    blok = ('<!--reyting--><p class="co-reg caption"><a href="%s">Рейтинг по открытой отчётности%s›</a> — '
            'выручка, прибыль и рост компаний из карточек за %d год</p><!--/reyting-->' % (URL, "&nbsp;", D["god"]))
    i = txt.find('<header class="co-head">')
    j = txt.find("</header>", i) if i >= 0 else -1
    if j < 0:
        return txt
    r = txt.find('<p class="co-reg caption">', i, j)  # сразу под лидом — выше длинной строки регионов
    return txt[:r] + blok + txt[r:] if r >= 0 else txt[:j] + blok + txt[j:]


def svyazannye(koren, D):
    """{путь: новое содержимое} — sitemap.xml и хаб /company/ (если есть)."""
    out = {}
    for f, fn in (("sitemap.xml", sitemap), (os.path.join("company", "index.html"), ssylka_v_hab)):
        p = os.path.join(koren, f)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                out[p] = fn(fh.read(), D) if fn is ssylka_v_hab else fn(fh.read(), D, koren)
    return out


def zapisat_esli_est(koren=KOREN):
    """Для tests/kartochki.py: после сборки карточек — пересобрать рейтинг, если страница уже заведена."""
    p = os.path.join(koren, "reyting", "index.html")
    if not os.path.exists(p):
        return False
    txt, D = sobrat(koren)
    izm = False
    for put_, t in [(p, txt)] + list(svyazannye(koren, D).items()):
        with open(put_, encoding="utf-8") as fh:
            if fh.read() == t:
                continue
        with open(put_, "w", encoding="utf-8") as fh:
            fh.write(t)
        izm = True
    return izm


def main():
    txt, D = sobrat()
    p = os.path.join(KOREN, "reyting", "index.html")
    stary = open(p, encoding="utf-8").read() if os.path.exists(p) else None
    svyaz = svyazannye(KOREN, D)
    rasn = [f for f, t in svyaz.items() if open(f, encoding="utf-8").read() != t]
    if "--check" in sys.argv:
        if stary != txt or rasn:
            print("Нужна сборка рейтинга: python3 tests/sobrat_reyting.py" + ("" if not rasn else " (" + ", ".join(os.path.relpath(f, KOREN) for f in rasn) + ")"))
            sys.exit(1)
        print("Рейтинг собран")
        return
    if stary != txt:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(txt)
    for f in rasn:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(svyaz[f])
    print("Рейтинг: %d компаний; выручка за %s — %d, рост — %d, прибыль — %d, убыток — %d%s" % (
        D["vsego"], D["god"], len(D["vyruchka"]), len(D["rost"]), len(D["pribyl"]), len(D["ubytok"]),
        "" if stary != txt else " (без изменений)"))


if __name__ == "__main__":
    main()
