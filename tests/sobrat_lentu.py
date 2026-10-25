#!/usr/bin/env python3
"""Лента «Что нового» в HTML страницы /obnovleniya/ — для поискового робота ([Ночные запуски] seo-pered-volnoj-v1, 03.10.2026).

Зачем: страница в sitemap, а лента рисовалась только скриптом — роботу в <main> было видно 12 слов
(аудит [Продукт · Маркетинг] 03.10, разд. 2.3). Теперь последние 20 записей obnovleniya.json стоят в HTML
между метками <!--lenta-->…<!--/lenta--> той же разметкой, что рисует скрипт страницы; скрипт после загрузки
заменяет блок полной лентой — посетитель видит то же, что и раньше.

«Пульс проекта» на /o-proekte/ (12.10.2026, ошибка поймана [Выкладкой] на kartochki-1210-n6): снимок «Последние
изменения» — 5 ссылок /obnovleniya/#id — собирается здесь же из тех же записей (верхние 5, та же разметка, что
рисует скрипт страницы). Раньше снимок стоял руками на 11.10: новая запись ленты вытесняла его якорь из 20 записей
/obnovleniya/ и tests/ssylki.test.js краснел у любого комплекта с лентой. Теперь якоря пульса всегда среди 20.

Типографика ленты (18.10.2026, [Ночные запуски] lenta-chisto-v1): заголовки и пункты записей проходят те же правила,
что статьи (tests/tipograf_statej.py → tekst): короткие слова не висят в конце строки, «115-ФЗ», суммы и сроки не рвутся.
До этого на /obnovleniya/ при 390 px висело ~1 500 предлогов и союзов. Скрипт страницы и полоса «Новое» (obnovleniya.js)
делают то же самое своей функцией tipo(); совпадение с этим сборщиком сверяет tests/lenta_chisto.test.js.

Блок ленты — ровно одна пара меток <!--lenta-->…<!--/lenta--> внутри #list. С 12.10 после блока висел хвост старой
сборки (записи -71 и -47 и лишняя </div>): метка искалась до ПЕРВОГО <!--/lenta-->, хвост за ней жил вечно, и посетитель
видел эти две записи дважды (с одинаковыми id). Теперь блок заменяется до ПОСЛЕДНЕЙ закрывающей метки внутри <main>.

Цифры «Пульса» на /o-proekte/ (24.10.2026, [Ночные запуски] puls-cifry-v1): четыре числа над снимком стояли руками
на 11.10 — «285 обновлений», «112 карточек», «18 разборов», «44 статьи» и «Цифры на 11 октября 2026». Скрипт страницы
через полсекунды менял 285 на длину ленты (383 на живом 24.10) — число прыгало на глазах, а остальные три отставали
навсегда (на 24.10: 166 карточек, 21 разбор, 27 статей). Теперь все четыре и дата подписи считаются здесь из файлов
сайта: записи obnovleniya.json; папки /company/<ИНН>-…/; разборы praktika/dela.json; статьи — страницы /115-fz/…/ и
/nalogi/…/ без хабов; дата — день верхней записи ленты. Сторож — tests/puls_cifry.test.js.

Запуск: python3 tests/sobrat_lentu.py [--check]
Вызывается сам из tests/postavit_vremya.py — то есть при каждой выкладке, вместе с проставлением времени.
"""
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import tipograf_statej as TS  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
LENTA = ROOT / "obnovleniya.json"
STRANICA = ROOT / "obnovleniya" / "index.html"
SKOLKO = 20
METKA = re.compile(r"<!--lenta-->.*?<!--/lenta-->", re.S)
PULS_STRANICA = ROOT / "o-proekte" / "index.html"
PULS_SKOLKO = 5  # столько же показывает скрипт страницы (a.slice(0,5))
PULS = re.compile(r'(<ul class="puls__l" data-puls>)(.*?)(</ul>)', re.S)
MESYACY = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября",
           "октября", "ноября", "декабря"]


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&#39;"))


def t(s):
    """Текст записи: экранирование + типографика статей (те же правила, что tipo() в скрипте страницы)
    + номер дела без переноса (nomer-dela-v1; в скрипте страницы — nd())."""
    return TS.nomer_dela(TS.tekst(esc(s)))


def kogda(u):
    t = TS.tekst(esc(u.get("data") or "")) + (", " + esc(u["vremya"]) + " МСК" if u.get("vremya") else "")
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", u.get("id") or "")
    if m and u.get("vremya"):
        return '<time datetime="%sT%s+03:00">%s</time>' % (m.group(1), esc(u["vremya"]), t)
    return t


def zapis(u):
    h = '<section class="u" id="%s"><span class="tag">%s</span><h2>%s</h2>' % (esc(u["id"]), kogda(u), t(u.get("zagolovok", "")))
    if u.get("chto_novogo"):
        h += '<h3>Что нового</h3><ul class="n">' + "".join("<li>%s</li>" % t(x) for x in u["chto_novogo"]) + "</ul>"
    if u.get("chto_proverit"):
        li = []
        for p in u["chto_proverit"]:
            if p.get("ssylka"):
                li.append('<li><a href="%s">%s →</a></li>' % (esc(p["ssylka"]), t(p.get("tekst", ""))))
            else:
                li.append("<li>%s</li>" % t(p.get("tekst", "")))
        h += '<h3>Что проверить</h3><ul class="p">' + "".join(li) + "</ul>"
    if u.get("kuda_pisat"):
        h += '<p class="note">%s</p>' % t(u["kuda_pisat"])
    return h + "</section>"


def blok():
    zapisi = json.loads(LENTA.read_text(encoding="utf-8"))["obnovleniya"][:SKOLKO]
    if not zapisi:
        return '<!--lenta--><p class="empty">Пока обновлений нет.</p><!--/lenta-->'
    return "<!--lenta-->" + "\n".join(zapis(u) for u in zapisi) + "<!--/lenta-->"


LIST = re.compile(r'<div id="list">(.*?)(?=</main>)', re.S)
# что может стоять в #list между метками ленты и </main>: записи, метки, пустые <p class="empty">, закрывающие </div>
LIST_MUSOR = re.compile(r'<section class="u"[^>]*>.*?</section>|<p class="empty">[^<]*</p>|<!--/?lenta-->|</div>|\s+', re.S)


def sobrat(txt):
    """Блок #list = одна пара меток ленты и </div>. Всё, что сборка оставляла в #list раньше (хвост 12.10), — заменяется."""
    b = blok()
    m = LIST.search(txt)
    if m and "<!--lenta-->" in m.group(1):
        if LIST_MUSOR.sub("", m.group(1)):
            raise SystemExit("sobrat_lentu: в #list на /obnovleniya/ после ленты стоит что-то кроме записей — разметку правили руками")
        return txt[:m.start()] + '<div id="list">' + b + "</div>\n" + txt[m.end():]
    stary = '<div id="list"><p class="empty">Загружаю…</p></div>'
    if stary not in txt:
        raise SystemExit("sobrat_lentu: на /obnovleniya/ нет ни меток <!--lenta-->, ни блока #list — разметку правили руками")
    return txt.replace(stary, '<div id="list">' + b + "</div>", 1)


def esc_js(s):
    """Как e() в скрипте /o-proekte/: & < > " — кавычки-ёлочки и апостроф остаются как есть."""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def puls_stroka(u):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", u.get("id") or "")
    if m:
        kogda_ = "%d&nbsp;%s" % (int(m.group(3)), MESYACY[int(m.group(2)) - 1])
        dt = m.group(0)
    else:
        kogda_, dt = esc_js(u.get("data") or ""), ""
    return '<li><time datetime="%s">%s</time><a href="/obnovleniya/#%s">%s</a></li>' % (
        dt, kogda_, esc_js(u.get("id", "")), TS.tekst(esc_js(u.get("zagolovok", ""))))  # tipograf-obolochka-v1


def sobrat_puls(txt, zapisi):
    """Снимок «Последние изменения» на /o-proekte/ — верхние PULS_SKOLKO записей ленты."""
    if not PULS.search(txt):
        raise SystemExit("sobrat_lentu: на /o-proekte/ нет <ul class=\"puls__l\" data-puls> — разметку правили руками")
    li = "\n".join(puls_stroka(u) for u in zapisi[:PULS_SKOLKO])
    return PULS.sub(lambda m: m.group(1) + "\n" + li + "\n" + m.group(3), txt, count=1)


CIFRA = re.compile(r'(<div class="cifra"><b(?: data-c="(\w+)")?>)\d+(</b><span(?: data-c-l)?>)(.*?)(</span></div>)')
CIFRY_DATA = re.compile(r'(<p class="cap">Цифры на&nbsp;)\d+&nbsp;[а-я]+(?:&nbsp;| )\d{4}(\.</p>)')
# вид числа → (формы слова для 1 / 2–4 / 5+, хвост подписи как в разметке)
CIFRY_VIDY = [
    ("zapisej", ("обновление", "обновления", "обновлений"), " в&nbsp;ленте с&nbsp;25&nbsp;сентября&nbsp;2026"),
    ("kartochki", ("карточка", "карточки", "карточек"), " компаний&nbsp;— у&nbsp;каждой свой вывод"),
    ("razbory", ("разбор", "разбора", "разборов"), " судебных и&nbsp;налоговых дел"),
    ("stati", ("статья", "статьи", "статей"), " о&nbsp;115&#8209;ФЗ и&nbsp;налогах простыми словами"),
]


def forma(n, f):
    """Как в скрипте /o-proekte/: 1 обновление, 2 обновления, 5 и 11–19 обновлений."""
    d, k = n % 100, n % 10
    return f[2] if 10 < d < 20 else f[0] if k == 1 else f[1] if 1 < k < 5 else f[2]


def schet_puls(zapisi):
    """Четыре числа «Пульса» — из файлов сайта, без ручных правок."""
    kart = sum(1 for d in (ROOT / "company").iterdir()
               if d.is_dir() and re.match(r"^\d{10}(\d{2})?-", d.name) and (d / "index.html").exists()) \
        if (ROOT / "company").is_dir() else 0
    dela = ROOT / "praktika" / "dela.json"
    razb = len(json.loads(dela.read_text(encoding="utf-8")).get("razbory", [])) if dela.exists() else 0
    stati = 0
    for hab in ("115-fz", "nalogi"):
        h = ROOT / hab
        if h.is_dir():
            stati += sum(1 for f in h.rglob("index.html") if f.parent != h)
    return {"zapisej": len(zapisi), "kartochki": kart, "razbory": razb, "stati": stati}


def sobrat_cifry(txt, zapisi):
    """Числа над «Последними изменениями» и подпись «Цифры на …» — день верхней записи ленты."""
    chisla = schet_puls(zapisi)
    bloki = list(CIFRA.finditer(txt))
    if len(bloki) != len(CIFRY_VIDY):
        raise SystemExit("sobrat_lentu: на /o-proekte/ не %d цифр «Пульса», а %d — разметку правили руками"
                         % (len(CIFRY_VIDY), len(bloki)))
    po_poryadku = iter(CIFRY_VIDY)

    def zamena(m):
        vid, formy, hvost = next(po_poryadku)
        n = chisla[vid]
        return "%s%d%s%s%s%s" % (m.group(1), n, m.group(3), forma(n, formy), hvost, m.group(5))
    txt = CIFRA.sub(zamena, txt)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", (zapisi[0].get("id") if zapisi else "") or "")
    if m:
        den = "%d&nbsp;%s&nbsp;%s" % (int(m.group(3)), MESYACY[int(m.group(2)) - 1], m.group(1))  # tipograf-daty-v1
        txt = CIFRY_DATA.sub(lambda x: x.group(1) + den + x.group(2), txt, count=1)
    return txt


def main(argv):
    zapisi = json.loads(LENTA.read_text(encoding="utf-8"))["obnovleniya"]
    pary = [(STRANICA, sobrat, "Лента в HTML /obnovleniya/"),
            (PULS_STRANICA, lambda t: sobrat_cifry(sobrat_puls(t, zapisi), zapisi),
             "«Пульс проекта» на /o-proekte/")]
    kod = 0
    for put, f, imya in pary:
        if not put.exists():
            continue
        stary = put.read_text(encoding="utf-8")
        novyj = f(stary)
        if "--check" in argv:
            if novyj != stary:
                print(imya + " отстала от obnovleniya.json — запустите: python3 tests/sobrat_lentu.py")
                kod = 1
            else:
                print(imya + " совпадает с obnovleniya.json")
        elif novyj != stary:
            put.write_text(novyj, encoding="utf-8")
            print(imya + " — обновлено")
        else:
            print(imya + " — уже свежее")
    return kod


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
