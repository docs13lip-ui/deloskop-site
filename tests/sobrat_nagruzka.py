#!/usr/bin/env python3
"""Справочник «Налоговая нагрузка и рентабельность по отраслям» (nagruzka-v1, 02.10.2026).

Таблицы страницы /nalogi/nagruzka-po-otraslyam-2025/ собираются из data/fns-normy-2025.json —
между метками <!--normy--> и <!--/normy-->. Цифры руками в HTML не правим: правим JSON и запускаем сборщик.
Источник — Информация ФНС от 05.05.2026 (приложения 3–4 к приказу № ММ-3-06/333@);
рентабельность за 2024 год — Информация ФНС от 07.05.2025 (ключ rentabelnost_2024).
normy-kompanii-v1 (24.10.2026): блок «Компании этих отраслей на Делоскопе» между <!--normy-kompanii--> и
<!--/normy-kompanii--> — из опубликованных карточек /company/ (строка таблицы — по ссылке карточки «Таблица ФНС по
отраслям», только карточки в индексе). Пересобирается вместе с карточками (tests/kartochki.py sobrat / perepechatat).

Запуск: python3 tests/sobrat_nagruzka.py         — собрать
        python3 tests/sobrat_nagruzka.py --check — только проверить (код 1, если нужна сборка; tests/nagruzka.test.js)
"""
import html
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANNYE = os.path.join(KOREN, "data", "fns-normy-2025.json")
STRANICA = os.path.join(KOREN, "nalogi", "nagruzka-po-otraslyam-2025", "index.html")
METKI = re.compile(r"<!--normy-->.*?<!--/normy-->", re.S)
# nagruzka-yakorya-v1: открытая по ссылке строка (#n-35-1) — подсвечена и не уезжает под липкую шапку
CSS_POSLE = "table.normy td b{color:var(--ink)}\n"
CSS_YAKOR = ("table.normy tr{scroll-margin-top:calc(var(--header-h,64px) + 24px)}"
             "table.normy tr:target td{background:var(--accent-soft,#EAF1FD)}"
             "table.normy tr:target td:first-child{box-shadow:inset 2px 0 0 var(--accent)}\n")
# normy-kompanii-v1: строки «Компаний этих отраслей» — плотнее вопросов FAQ (22 строки на 390 px не должны занимать 4 экрана)
CSS_KOMP = (".faq.normy-komp details{padding:10px 16px;margin:0 0 6px;border-radius:16px}"
            ".faq.normy-komp summary{font-weight:500;font-size:15px;line-height:1.35}"
            ".faq.normy-komp summary small{color:var(--muted);font-weight:400;font-size:13px;white-space:nowrap}"
            ".faq.normy-komp details p{font-size:15px}\n")


def chislo(x):
    if isinstance(x, str):
        return "убыток" if x == "отр" else html.escape(x)
    return ("%.1f" % x).replace(".", ",") + "%"


def kod(s):
    if s["kod"] == "ВСЕГО":
        return "все"
    return ("раздел " + s["kod"]) if re.fullmatch(r"[A-Z]", s["kod"]) else s["kod"]


def nazv(s):
    n = re.sub(r"\s+-\s+всего$", "", s["nazvanie"], flags=re.I)
    if s["kod"] == "ВСЕГО":
        n = "Всего по России"
    return html.escape(n[:1].upper() + n[1:])


def yakor(kod, tablica="n"):
    """nagruzka-yakorya-v1: якорь строки — «n-35-1» (нагрузка), «r-f» (рентабельность), «n-vsego».
    Тот же расчёт — js/nagruzka.js yakor и tests/kartochka_render.py (ссылки карточек и калькулятора на строку)."""
    k = "vsego" if kod == "ВСЕГО" else re.sub(r"[^0-9a-z]+", "-", str(kod).lower()).strip("-")
    return tablica + "-" + k


def klass(s):
    if s["kod"] == "ВСЕГО":
        return ' class="vsego"'
    return ' class="razdel"' if re.fullmatch(r"[A-Z]", s["kod"]) else ""


def izmenenie(a, b):
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return "—"
    d = round(a - b, 1)
    if d == 0:
        return "0"
    return ("+" if d > 0 else "−") + ("%.1f" % abs(d)).replace(".", ",") + " п. п."


def tablicy(d):
    out = ['<!--normy-->',
           '<h2 id="nagruzka">Налоговая нагрузка по видам деятельности</h2>',
           '<p>Налоги и сборы организаций к их обороту, с учётом НДФЛ; страховые взносы&nbsp;— справочно, в нагрузку не входят. '
           'Строки ФНС даны по разделам и части групп ОКВЭД-2: если вашей группы нет, смотрите раздел.</p>',
           '<div class="tw"><table class="normy" data-normy>',
           '<thead><tr><th>Вид деятельности</th><th>ОКВЭД</th><th>2025</th><th>2024</th><th>Изменение</th><th>Взносы 2025, справочно</th></tr></thead><tbody>']
    for s in d["nagruzka"]:
        n = s["nagruzka"]
        out.append('<tr id="%s"%s><td>%s</td><td>%s</td><td><b>%s</b></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
            yakor(s["kod"]), klass(s), nazv(s), kod(s), chislo(n["2025"]), chislo(n["2024"]), izmenenie(n["2025"], n["2024"]), chislo(s["sv"]["2025"])))
    out.append('</tbody></table></div>')
    r = d["rentabelnost"]
    z2 = (d.get("rentabelnost_2024") or {}).get("znacheniya") or {}
    g2 = "2024" if z2 and all(s["kod"] in z2 for s in r["stroki"]) else None
    zag = ("за %d и %s годы" % (r["god"], g2)) if g2 else ("за %d год" % r["god"])
    out += ['<h2 id="rentabelnost">Рентабельность по видам деятельности %s</h2>' % zag,
            '<p>Рентабельность продаж — прибыль от продаж к себестоимости с коммерческими и управленческими расходами; '
            'рентабельность активов — сальдированный финансовый результат к стоимости активов. «Убыток» — у отрасли в целом отрицательный результат.</p>',
            '<div class="tw"><table class="normy" data-normy>',
            ('<thead><tr><th>Вид деятельности</th><th>ОКВЭД</th><th>Продаж, %d</th><th>Продаж, %s</th><th>Активов, %d</th><th>Активов, %s</th></tr></thead><tbody>'
             % (r["god"], g2, r["god"], g2)) if g2 else
            '<thead><tr><th>Вид деятельности</th><th>ОКВЭД</th><th>Рентабельность продаж</th><th>Рентабельность активов</th></tr></thead><tbody>']
    for s in r["stroki"]:
        if g2:
            out.append('<tr id="%s"%s><td>%s</td><td>%s</td><td><b>%s</b></td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>' % (
                yakor(s["kod"], "r"), klass(s), nazv(s), kod(s), chislo(s["prodazhi"]), chislo(z2[s["kod"]][0]), chislo(s["aktivy"]), chislo(z2[s["kod"]][1])))
        else:
            out.append('<tr id="%s"%s><td>%s</td><td>%s</td><td><b>%s</b></td><td>%s</td></tr>' % (
                yakor(s["kod"], "r"), klass(s), nazv(s), kod(s), chislo(s["prodazhi"]), chislo(s["aktivy"])))
    out.append('</tbody></table></div>')
    out.append('<!--/normy-->')
    return "\n".join(out)


# ---------------------------------------------------------------- normy-kompanii-v1: карточки компаний по строкам таблицы
KOMP_METKI = re.compile(r"<!--normy-kompanii-->.*?<!--/normy-kompanii-->", re.S)
KOMP_NA_STROKU = 8    # сколько карточек назвать в строке, если все они есть на хабе отрасли (остальные — «и ещё N» → хаб)
KOMP_BEZ_HABA = 24    # без такого хаба — больше (на 10 000 карточек строка не разрастается: «и ещё N» → каталог)
_H1 = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
_STROKA = re.compile(r'href="/nalogi/nagruzka-po-otraslyam-2025/#(n-[0-9a-z-]+)"')
_SSYLKA_KARTOCHKI = re.compile(r'href="/company/(\d{10}-[^/"]+)/"')


def _noindex(t):
    return re.search(r'<meta name="robots" content="[^"]*noindex', t) is not None


def kartochki_po_strokam(koren=KOREN):
    """→ {якорь строки «n-35-1»: [(ключ сортировки, папка, название html)]} — только карточки в индексе."""
    papka = os.path.join(koren, "company")
    po = {}
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        put = os.path.join(papka, d, "index.html")
        if not re.match(r"^\d{10}-", d) or not os.path.isfile(put):
            continue
        t = open(put, encoding="utf-8").read().replace("&#160;", " ")  # kartochki-chisla-v1: NB_T карточки — обычным пробелом
        if _noindex(t):
            continue
        m, h = _STROKA.search(t), _H1.search(t)
        if not m or not h:
            continue
        imya = re.sub(r"<span[^>]*>.*?</span>", "", h.group(1), flags=re.S).strip()
        klyuch = re.sub(r"^(ООО|АО|ПАО|НАО|ЗАО|ОАО)\s*", "", html.unescape(imya).replace("\u00a0", " ")).strip("«»\" ").lower()
        po.setdefault(m.group(1), []).append((klyuch, d, imya))
    return po


def haby_otrasley(koren=KOREN):
    """→ [(адрес хаба, название, множество папок карточек)] — только хабы отраслей в индексе."""
    out = []
    papka = os.path.join(koren, "company", "otrasl")
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        put = os.path.join(papka, d, "index.html")
        if not os.path.isfile(put):
            continue
        t = open(put, encoding="utf-8").read().replace("&#160;", " ")  # kartochki-chisla-v1: NB_T карточки — обычным пробелом
        if _noindex(t):
            continue
        h = _H1.search(t)
        imya = re.sub(r"<[^>]+>", "", h.group(1)).strip() if h else d
        out.append(("/company/otrasl/%s/" % d, imya, set(_SSYLKA_KARTOCHKI.findall(t))))
    return out


def _kompaniy(n):
    f = "компания" if n % 10 == 1 and n % 100 != 11 else ("компании" if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else "компаний")
    return "%d&nbsp;%s" % (n, f)


def blok_kompanii(d, koren=KOREN):
    po = kartochki_po_strokam(koren)
    haby = haby_otrasley(koren)
    stroki = []
    for s in d["nagruzka"]:
        y = yakor(s["kod"])
        kart = sorted(po.get(y, []))
        if not kart:
            continue
        hab = next((h for h in haby if {p for _, p, _ in kart} <= h[2]), None)
        limit = KOMP_NA_STROKU if hab else KOMP_BEZ_HABA
        if len(kart) <= limit + 1:  # «и ещё 1» не пишем — называем
            limit = len(kart)
        nazv_ = ", ".join('<a href="/company/%s/">%s</a>' % (p, imya) for _, p, imya in kart[:limit])
        ostatok = len(kart) - limit
        hvost = ""
        if ostatok > 0:
            hvost = (" и&nbsp;ещё %d&nbsp;— <a href=\"%s\">все карточки раздела «%s»</a>" % (ostatok, hab[0], html.escape(hab[1]))
                     if hab else " и&nbsp;ещё %d&nbsp;— <a href=\"/company/\">в&nbsp;каталоге компаний</a>" % ostatok)
        stroki.append('<details data-stroka="%s"><summary><span>%s <small>%s · %s</small></span></summary><p>%s%s.</p><p><a href="#%s">Норма ФНС этой строки ↑</a></p></details>'
                      % (y, nazv(s), kod(s), _kompaniy(len(kart)), nazv_, hvost, y))
    if not stroki:
        return "<!--normy-kompanii--><!--/normy-kompanii-->"
    return ("<!--normy-kompanii-->\n"
            '<section class="faq normy-komp" aria-labelledby="kompanii"><h2 id="kompanii">Компании этих отраслей на&nbsp;Делоскопе</h2>\n'
            "<p>Строка&nbsp;— по&nbsp;основному ОКВЭД компании из&nbsp;ЕГРЮЛ. У&nbsp;каждой карточки&nbsp;— ссылка на&nbsp;эту строку "
            "таблицы и&nbsp;отчётность компании на&nbsp;дату сведений. Порядок&nbsp;— по&nbsp;алфавиту, это не&nbsp;рейтинг.</p>\n%s\n</section>\n"
            "<!--/normy-kompanii-->") % "\n".join(stroki)


def sobrat(proverit=False, koren=KOREN):
    d = json.load(open(DANNYE, encoding="utf-8"))
    s = open(STRANICA, encoding="utf-8").read()
    if not KOMP_METKI.search(s):  # normy-kompanii-v1: место блока — перед «Как это решают суды», иначе в конце статьи
        mesto = "<!--praktika-ssylki-->" if "<!--praktika-ssylki-->" in s else "</article>"
        s_komp = s.replace(mesto, "<!--normy-kompanii--><!--/normy-kompanii-->\n" + mesto, 1)
    else:
        s_komp = s
    if CSS_YAKOR not in s_komp and CSS_POSLE in s_komp:
        s_css = s_komp.replace(CSS_POSLE, CSS_POSLE + CSS_YAKOR, 1)
    else:
        s_css = s_komp
    if CSS_KOMP not in s_css and CSS_YAKOR in s_css:
        s_css = s_css.replace(CSS_YAKOR, CSS_YAKOR + CSS_KOMP, 1)
    if not METKI.search(s):
        print("нет меток <!--normy--> в " + STRANICA)
        return 1
    novoe = METKI.sub(lambda m: tablicy(d), s_css, count=1)
    novoe = KOMP_METKI.sub(lambda m: blok_kompanii(d, koren), novoe, count=1)
    if novoe == s:
        print("nagruzka: таблицы собраны")
        return 0
    if proverit:
        print("nagruzka: таблицы не совпадают с data/fns-normy-2025.json — запустите python3 tests/sobrat_nagruzka.py")
        return 1
    open(STRANICA, "w", encoding="utf-8").write(novoe)
    print("nagruzka: таблицы обновлены")
    return 0


if __name__ == "__main__":
    sys.exit(sobrat("--check" in sys.argv[1:]))
