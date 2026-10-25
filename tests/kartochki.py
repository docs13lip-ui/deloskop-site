#!/usr/bin/env python3
"""Карточки компаний /company/{инн}-{slug}/ — пробная SEO-волна (Очередь п. 64; комплект karta-v1 + v1.1, 29.09.2026).

Что делает: из сведений о компаниях (JSON Lines, одна компания — одна строка, формат ответа /api/check)
собирает статичные страницы-карточки, хаб /company/, sitemap-companies.xml и строку Sitemap в robots.txt.
Только стандартная библиотека Python.

    python3 tests/kartochki.py sobrat  --vhod kartochki.jsonl [--stupen 0] [--spros 800 --kontrol 200] [--dobavit]
        # --dobavit (v3.5): опубликованные карточки не трогать, новые — добавить; хаб и sitemap — по всем
    python3 tests/kartochki.py perepechatat  # опубликованные карточки — по текущему шаблону, без сведений (kartochki-shablon-v1)
    python3 tests/kartochki.py proverka --vhod kartochki.jsonl [--podrobno]  # только отчёт «сколько проходит ворота», файлы не трогает
    python3 tests/kartochki.py iz-api  --inn spisok.txt --vyhod kartochki.jsonl [--pauza 6] [--maks 300] [--zanovo]  # живой /api/check; 429 — стоп;
        # опубликованные и отсев (tests/kartochki_otsev.txt) не спрашиваются (kartochki-vybor-v1)
    python3 tests/kartochki.py svezhest [--pokazat 10]  # даты сведений опубликованных карточек, старейшие первыми
    python3 tests/kartochki.py iz-api  --osvezhit 150 --vyhod svezhie.jsonl  # освежить N старейших (анонимно — до 10 в сутки),
        # затем sobrat --dobavit --vhod svezhie.jsonl; ответ без финансов карточку не снимает (kartochki-svezhest-v1)
    python3 tests/kartochki.py vybor   --revexp data-….zip [--n 500] [--vyhod spisok.txt]  # кандидаты из набора ФНС revexp (ТЗ 3.1)
    python3 tests/kartochki.py otsev   --vhod kartochki.jsonl  # отказы ворот публикации → отсев на 90 дней
        # служебный доступ — DELOSKOP_SERVICE_TOKEN в окружении запуска (заголовок X-Deloskop-Service; не в файлы)

Правила (кто решил — в скобках):
  * только юрлица: ИНН из 10 цифр с верной контрольной суммой; ИП — карточки нет вовсе (владелец 26.09 16:50);
  * ворота индексации: карточка создаётся, только если ≥ 3 выводов, из них ≥ 2 с числом, есть финансы и
    ≥ 2 первоисточника с датой сведений (Маркетинг §2.7, Данные §2); иначе — нет страницы и нет в sitemap;
  * в волну — только действующие коммерческие (ООО, АО, ПАО, НАО), возраст ≥ 12 мес. (Данные §1.3);
  * отметка о недостоверности — карточку не публикуем, пока [Юрист 115-ФЗ] не утвердит формулировку (V17);
  * блок «Люди» (ФИО руководителя и учредителей) — только при PERSONS_PUBLIC=1 (до строки «РКН отправлено» — выключен);
  * Индекс — числом только за воротами полноты (≥ 60 %, те же правила, что js/indeks-vorota.js); иначе «Индекс — считаем»;
  * у каждого вывода и строки реестра — источник, дата сведений и статус ● подтверждено / ◆ рассчитано / ○ не проверяли;
  * «не проверяли» ≠ «не нашли»: строка без даты сведений не считается проверенной;
  * телефонов и e-mail нет; aggregateRating нет; JSON-LD — Organization + BreadcrumbList + WebPage (dateModified — день
    последнего изменения видимого текста, kartochki-unik-v9);
  * lastmod — самая свежая из дат: сведений карточки и изменения её текста (не дата сборки); сборка детерминирована (те же данные → те же байты).

Данные в репозиторий не кладём: файл .jsonl живёт у того, кто собирает (папка tests/kartochki_dannye/ — в .gitignore).
"""
import hashlib
import html
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import sobrat_shapku as ss  # noqa: E402
import kommentarii  # noqa: E402
import kartochki_vybor as kv  # noqa: E402  kartochki-vybor-v1: отбор ИНН, отсев, «не спрашивать опубликованные»
# render-v1: отрисовка («сведения → HTML») — общий модуль сайта и API; здесь — отбор волны, файлы, sitemap, iz-api.
# Имена — прежние (K.vyvody, K.html_kartochki, K.STUPENI …).
from kartochka_render import *  # noqa: E402,F401,F403


# ---------------------------------------------------------------- сборка
def chitat_jsonl(put):
    out = []
    with open(put, encoding="utf-8") as fh:
        for i, s in enumerate(fh, 1):
            s = s.strip()
            if not s:
                continue
            try:
                out.append(data_proverki_msk(json.loads(s)))
            except json.JSONDecodeError as ex:
                raise SystemExit("Строка %d: не JSON (%s)" % (i, ex))
    return out


def data_proverki_msk(r):
    """kartochki-msk-v1 (Ночные-2, 10.10): API ставит checked_at по UTC — с 00:00 до 03:00 МСК проверка датируется
    вчерашним днём (живой ответ 10.10 01:37 МСК: checked_at «2026-10-09»; [Продукт] 10.10 разд. 2.1). Момент запроса
    по Москве iz-api пишет в `_poluchen_msk` — это наш факт, не догадка. Если его дата позже checked_at — дата проверки
    карточки берётся по Москве, исходная остаётся в `_checked_at_api`. Раньше — не трогаем (сервер не «моложе» запроса)."""
    if not isinstance(r, dict):
        return r
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(r.get("_poluchen_msk") or ""))
    c = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(r.get("checked_at") or ""))
    if not (m and c):
        return r
    d_msk = dt.date(*map(int, m.groups()))
    d_api = dt.date(*map(int, c.groups()))
    if (d_msk - d_api).days == 1:  # только сдвиг поясов (UTC отстаёт от МСК на 3 ч) — больше дня не «чиним»
        r = dict(r)
        r["_checked_at_api"] = r.get("checked_at")
        r["checked_at"] = d_msk.isoformat()
    return r


def poluchen_msk(seichas=None):
    """Момент запроса по Москве, до минуты: «2026-10-10T01:37»."""
    t = seichas or dt.datetime.now(dt.timezone.utc)
    return (t.astimezone(dt.timezone.utc) + dt.timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M")


def otobrat(zapisi, limit, spros=None, kontrol=None):
    """→ (годные карточки по порядку, отчёт). ИП и неверные ИНН выбрасываются до всякой обработки."""
    otchet = {"vsego": len(zapisi), "ip_otbrosheno": 0, "proshli": 0, "prichiny": {}, "spros": 0, "kontrol": 0}
    godnye, vidali = [], set()
    for r in zapisi:
        inn = re.sub(r"\D", "", str(((r.get("company") or {}).get("inn")) or r.get("inn") or ""))
        if len(inn) == 12:
            otchet["ip_otbrosheno"] += 1
            continue
        if inn in vidali:
            continue
        vidali.add(inn)
        k = iz_check(r)
        V = vyvody(k)
        ok, pr = vorota(k, V)
        otchet.setdefault("po_inn", []).append((inn, pr, diagnoz(k, V)))
        if not ok:
            otchet["prichiny"][pr] = otchet["prichiny"].get(pr, 0) + 1
            continue
        k["_V"], k["_gr"] = V, gruppa(k)
        godnye.append(k)
    # «со спросом» сначала, внутри — по ИНН (детерминированно); квоты групп
    godnye.sort(key=lambda x: (x["_gr"] != "spros", x["inn"]))
    sp = [x for x in godnye if x["_gr"] == "spros"]
    kt = [x for x in godnye if x["_gr"] == "kontrol"]
    if spros is not None:
        sp = sp[:spros]
    if kontrol is not None:
        kt = kt[:kontrol]
    itog = (sp + kt)[:limit]
    otchet["proshli"] = len(godnye)
    otchet["v_volne"] = len(itog)
    otchet["spros"] = sum(1 for x in itog if x["_gr"] == "spros")
    otchet["kontrol"] = len(itog) - otchet["spros"]
    return itog, otchet


def diagnoz(k, V):
    """kartochki-v2: почему факт не стал выводом — по каждому коду: «вывод» / «без даты» / «нет числа» / «нет в ответе».
    Для `proverka --podrobno`: видно, чего не хватает воротам, без ослабления самих ворот."""
    est = {x["kod"] for x in V}
    out = ["выводы: " + (", ".join(sorted(est)) or "нет")]
    for kod in ("dohod", "shtat", "nalogi", "nedoimka", "nedostovernost", "fssp"):
        f = k["fakty"].get(kod)
        out.append("%s: %s" % (kod, "нет в ответе" if not f else "без даты" if not f.get("data")
                               else "нет числа" if f.get("znachenie") is None and kod in ("dohod", "shtat", "nalogi") else "есть"))
    out.append("финансы: %s" % (("%d–%d" % (k["finansy"][0]["god"], k["finansy"][-1]["god"])) if k["finansy"] else "нет"))
    return "; ".join(out)


def pechat_otcheta(o, podrobno=False):
    print("Записей на входе: %d · ИП отброшено до обработки: %d" % (o["vsego"], o["ip_otbrosheno"]))
    print("Прошли ворота индексации: %d · в волне: %d (со спросом %d, контроль %d)" % (o["proshli"], o.get("v_volne", 0), o["spros"], o["kontrol"]))
    for pr, n in sorted(o["prichiny"].items(), key=lambda x: -x[1]):
        print("  не прошли — %s: %d" % (pr, n))
    if podrobno:
        for inn, pr, dg in o.get("po_inn", []):
            print("  %s — %s · %s" % (inn, pr, dg))


# kartochki-ascii-v1: невидимые знаки в файлах карточек — сущностями, а не «сырыми» байтами.
# Так серию карточек можно перенести перепечаткой текста патча (проект → папка → GitHub) без потери
# неразрывных пробелов: перепечатка теряет U+00A0 (у kartochki-v3.1…v3.3 так и не сошлась), а «&nbsp;» — нет.
# Внутри <script> (JSON-LD) сущности не раскрываются — там JSON-экранирование «\u00a0». Браузер и поиск видят то же самое.
NEVIDIMYE = {"\u00a0": ("&nbsp;", "\\u00a0"), "\u202f": ("&#8239;", "\\u202f"), "\u2009": ("&#8201;", "\\u2009"),
             "\u2060": ("&#8288;", "\\u2060"), "\u00ad": ("&shy;", "\\u00ad"), "\u200b": ("&#8203;", "\\u200b")}
_NEV = re.compile("[" + "".join(NEVIDIMYE) + "]")
_SKRIPT = re.compile(r"(<script\b[^>]*>)(.*?)(</script>)", re.S | re.I)


def bez_nevidimyh(txt):
    """Заменяет невидимые знаки: в разметке и тексте — HTML-сущностью, внутри <script> — JSON-экранированием."""
    if not _NEV.search(txt):
        return txt
    chasti, poz = [], 0
    for m in _SKRIPT.finditer(txt):
        chasti.append(_NEV.sub(lambda z: NEVIDIMYE[z.group()][0], txt[poz:m.start()]))
        chasti.append(m.group(1) + _NEV.sub(lambda z: NEVIDIMYE[z.group()][1], m.group(2)) + m.group(3))
        poz = m.end()
    chasti.append(_NEV.sub(lambda z: NEVIDIMYE[z.group()][0], txt[poz:]))
    return "".join(chasti)


def zapisat(put, txt):
    if put.endswith(".html"):
        txt = bez_nevidimyh(txt)
    os.makedirs(os.path.dirname(put), exist_ok=True)
    stary = open(put, encoding="utf-8").read() if os.path.exists(put) else None
    if stary != txt:
        with open(put, "w", encoding="utf-8") as fh:
            fh.write(txt)
        return True
    return False


# ---------------------------------------------------------------- kartochki-v3.5: добор порциями (--dobavit)
# Сведения компаний в репозиторий и проект не кладём, а анонимно API отдаёт 3–6 ответов за запуск. Поэтому полная
# пересборка из одного запуска стёрла бы карточки прошлых порций. В режиме «добавить» уже опубликованные карточки
# остаются как есть (байт в байт), а хаб, sitemap и «Похожие компании» новых карточек знают о них по самим
# страницам: JSON-LD Organization (ИНН, название, регион, город), доход — из meta description, lastmod — самая
# свежая «сведения на дд.мм.гггг» страницы (то же правило, что lastmod()). Новых данных не храним.
_LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
_DOHOD = re.compile(r"(?:доход|выручка) ([0-9]+(?:,[0-9]+)?)(?:&nbsp;|\u00a0| )(трлн|млрд|млн|тыс\.)(?:&nbsp;|\u00a0| )₽")
# kartochki-shablon-v1: доход только из набора ФНС (без таблицы ГИР БО) — из заголовка блока «Доход за 2025 год — …»
_DOHOD_H2 = re.compile(r'<h2 id="fin">Доход[^<]*? — ([0-9]+(?:,[0-9]+)?)(?:&nbsp;|\u00a0| )(трлн|млрд|млн|тыс\.)(?:&nbsp;|\u00a0| )₽</h2>')
_DOHOD_TAB = re.compile(r'<tbody><tr><td>\d{4}</td><td class="num">([0-9]+(?:,[0-9]+)?)(?:&nbsp;|\u00a0| )(трлн|млрд|млн|тыс\.)(?:&nbsp;|\u00a0| )₽')
_ZA_GOD = re.compile(r"(?:&nbsp;|\u00a0| )за(?:&nbsp;|\u00a0| )(\d{4})")
_GOD_TAB = re.compile(r'<tbody><tr><td>(\d{4})</td><td class="num">')
_GOD_H2 = re.compile(r'<h2 id="fin">Доход за(?:&nbsp;|\u00a0| )(\d{4})')
_MNOZH = {"трлн": 1e12, "млрд": 1e9, "млн": 1e6, "тыс.": 1e3}
_SVEDENIYA = re.compile(r"сведения на (\d\d)\.(\d\d)\.(\d{4})")
BEZ_OBOLOCHKI = "<!--shapka--><!--/shapka-->"
_KROSH = re.compile(r'<nav class="co-krosh caption"[^>]*>(.*?)</nav>', re.S)
_OKVED_ATTR = re.compile(r'<nav class="co-krosh caption"[^>]*? data-okved="([0-9.]+)"')
_RAZDELY = {t for _, _, t in OKVED_RAZDELY}
_SOS = re.compile(r'(<aside class="co-side card"><h2 class="co-h3">Полный отчёт</h2>.*?</aside>\n)(.*?)(\n<aside class="co-side card" aria-labelledby="pasport-h">)', re.S)


NORMY_FNS = os.path.join(KOREN, "data", "fns-normy-2025.json")


def zagruzit_normy(put=NORMY_FNS):
    """v3.8b: строки «nagruzka» справочника ФНС; нет файла — []."""
    try:
        with open(put, encoding="utf-8") as fh:
            return json.load(fh).get("nagruzka") or []
    except (OSError, ValueError):
        return []


def kartochki_na_diske(koren=KOREN):
    """→ {ИНН: заглушка} опубликованных карточек: только то, что уже напечатано на странице."""
    papka = os.path.join(koren, PAPKA)
    out = {}
    if not os.path.isdir(papka):
        return out
    for d in sorted(os.listdir(papka)):
        m = re.match(r"^(\d{10})-", d)
        put = os.path.join(papka, d, "index.html")
        if not m or not os.path.isfile(put):
            continue
        with open(put, encoding="utf-8") as fh:
            t = bez_tipografa(fh.read())  # kartochki-chisla-v1
        org = None
        for blok in _LD.findall(t):
            try:
                graf = json.loads(blok).get("@graph") or []
            except ValueError:
                continue
            org = next((x for x in graf if isinstance(x, dict) and x.get("@type") == "Organization"), org)
        if not org or org.get("taxID") != m.group(1) or not org.get("name"):
            continue
        adr = org.get("address") or {}
        k = {"inn": m.group(1), "name": org["name"], "region": adr.get("addressRegion") or "",
             "gorod": adr.get("addressLocality") or "", "okved": "", "fakty": {}, "_papka": d, "_s_diska": True}
        md = re.search(r'<meta name="description" content="([^"]*)"', t)
        z = _DOHOD.search(md.group(1)) if md else None
        # kartochki-unik-v3: год — тот, что напечатан рядом с этой суммой («… млн ₽ за 2025»), иначе — строки таблицы
        zg = _ZA_GOD.match(md.group(1), z.end()) if z else None
        z = z or _DOHOD_TAB.search(t) or _DOHOD_H2.search(t)  # kartochki-indeks-v1: старой выручки в description нет — берём строку таблицы
        if z:
            k["fakty"]["dohod"] = {"znachenie": float(z.group(1).replace(",", ".")) * _MNOZH[z.group(2)]}
            # kartochki-unik-v3: год оборота — первая строка таблицы финансов или «Доход за Г» (для сравнения соседей)
            zg = zg or _GOD_TAB.search(t) or _GOD_H2.search(t)
            if zg:
                k["fakty"]["dohod"]["god"] = int(zg.group(1))
        daty = [dt.date(int(g), int(mm), int(dd)) for dd, mm, g in _SVEDENIYA.findall(t)]
        k["_lastmod"] = max(daty) if daty else None
        ok = _OKVED_ATTR.search(t)  # kartochki-okved-v1: код основного ОКВЭД (крошки, data-okved) — класс для «Похожих» и хаба
        k["okved"] = okved_kod(ok.group(1)) if ok else ""
        kr = _KROSH.search(t)  # v3.8b: раздел ОКВЭД — последнее звено крошек
        if kr:
            hv = html.unescape(re.sub(r"<[^>]+>", "", kr.group(1))).split(" › ")[-1].strip()
            k["razdel"] = hv if hv in _RAZDELY else ""
        out[k["inn"]] = k
    return out


# ---------------------------------------------------------------- kartochki-unik-v9: WebPage и дата изменения текста
# ТЗ [Продукт] 23.10 п. 3В (Маркетинг 11.10): у карточек не было WebPage с dateModified, а lastmod в sitemap стоял по дате
# сведений (03–12.10), хотя текст менялся 18–22.10 — Яндекс не видел обновлений. Теперь у карточки отпечаток видимого
# текста <main> (без скриптов и «Похожих компаний») — комментарием рядом с WebPage. Сборка меняет дату, только если
# отпечаток другой; та же сборка в другой день — те же байты. Шапка и подвал в отпечаток не входят (общие для сайта — не изменение карточки).
WP_ISTOCHNIKI = ["https://egrul.nalog.gov.ru/", "https://bo.nalog.gov.ru/", "https://www.nalog.gov.ru/opendata/"]
_WP_BLOK = re.compile(r'<!--tekst:([0-9a-f]{16})-->\n?<script type="application/ld\+json" data-dlk="webpage">(.*?)</script>\n?', re.S)
_WP_MAIN = re.compile(r"<main\b[^>]*>(.*?)</main>", re.S)
_WP_SKRIPT = re.compile(r"<script\b.*?</script>|<style\b.*?</style>", re.S)
# «Похожие компании» — подписи соседей меняются с каждым добором; это не изменение сведений о самой компании
_WP_SOSEDI = re.compile(r'<aside class="co-side card" aria-labelledby="sos">.*?</aside>', re.S)
_WP_LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>\n?', re.S)
_WP_TITLE = re.compile(r"<title>(.*?)</title>", re.S)
_WP_CANON = re.compile(r'<link rel="canonical" href="([^"]+)"')


def otpechatok_teksta(t):
    """16 знаков sha256 видимого текста <main> карточки (без тегов, скриптов, вида пробелов); нет <main> — None."""
    t = _WP_BLOK.sub("", t)
    m = _WP_MAIN.search(t)
    if not m:
        return None
    tx = html.unescape(re.sub(r"<[^>]+>", " ", _WP_SKRIPT.sub(" ", _WP_SOSEDI.sub(" ", m.group(1)))))
    tx = " ".join(tx.replace(NB, " ").split())
    return hashlib.sha256(tx.encode("utf-8")).hexdigest()[:16]


def data_teksta(t):
    """(отпечаток, дата dateModified) из блока WebPage страницы или (None, None)."""
    m = _WP_BLOK.search(t)
    if not m:
        return None, None
    try:
        d = json.loads(m.group(2)).get("dateModified") or ""
        return m.group(1), dt.date.fromisoformat(d[:10])
    except (ValueError, AttributeError):
        return m.group(1), None


def vstavit_webpage(t, den, prezhnij=None):
    """→ (страница, дата изменения текста). WebPage ставится сразу за JSON-LD карточки; нет Organization — без изменений.
    prezhnij — (отпечаток, дата) опубликованной версии до этой сборки: с ней и сравниваем (сборка пишет файл по нескольку
    раз — промежуточный текст датой не считается)."""
    h = otpechatok_teksta(t)
    ld = _WP_LD.search(t)
    if not h or not ld:
        return t, None
    try:
        graf = json.loads(ld.group(1)).get("@graph") or []
    except ValueError:
        return t, None
    org = next((x for x in graf if isinstance(x, dict) and x.get("@type") == "Organization"), None)
    kan = _WP_CANON.search(t)
    if not org or not org.get("taxID") or not kan:
        return t, None
    h_byl, d_byl = prezhnij if prezhnij else data_teksta(t)
    d = d_byl if (h_byl == h and d_byl) else den
    tit = _WP_TITLE.search(t)
    wp = {"@context": "https://schema.org", "@type": "WebPage", "url": kan.group(1),
          "name": html.unescape(tit.group(1)).strip() if tit else org.get("name"),
          "inLanguage": "ru", "dateModified": d.isoformat(), "isBasedOn": WP_ISTOCHNIKI,
          "publisher": {"@type": "Organization", "name": "Делоскоп", "url": SAJT + "/"},
          "about": {"@type": "Organization", "name": org.get("name"), "taxID": org["taxID"]}}
    blok = '<!--tekst:%s-->\n<script type="application/ld+json" data-dlk="webpage">%s</script>\n' % (
        h, json.dumps(wp, ensure_ascii=False, sort_keys=True).replace("</", "<\\/"))
    bez = _WP_BLOK.sub("", t)
    ld = _WP_LD.search(bez)
    kon = ld.end()
    novyj = bez[:kon] + ("" if ld.group(0).endswith("\n") else "\n") + blok + bez[kon:]
    return novyj, d


def prezhnie_otpechatki(koren=KOREN):
    """kartochki-unik-v9: {папка карточки: (отпечаток текста, dateModified)} — до сборки, с опубликованных страниц."""
    papka = os.path.join(koren, PAPKA)
    out = {}
    if not os.path.isdir(papka):
        return out
    for d in os.listdir(papka):
        put = os.path.join(papka, d, "index.html")
        if re.match(r"^\d{10}-", d) and os.path.isfile(put):
            with open(put, encoding="utf-8") as fh:
                h, dd = data_teksta(fh.read())
            if h and dd:
                out[d] = (h, dd)
    return out


# ---------------------------------------------------------------- kartochki-volna-v1: партии sitemap (ТЗ [Данные] 03.10 разд. 3.3)
# Новые адреса карточек идут в sitemap-companies.xml не больше PARTIYA_V_SUTKI в сутки (по Москве) — темп волны 5 000 без
# всплеска «малоценных» в Вебмастере. Счёт партии — строка-комментарий в самом sitemap (отдельного файла состояния нет):
# <!-- partiya ГГГГ-ММ-ДД: N -->. Уже стоящие в sitemap адреса остаются (пока проходят ворота индексации); новые —
# по доходу по убыванию, затем по адресу. Не вошедшие публикуются как обычно и ждут следующей сборки (--dobavit завтра).
# IndexNow берёт только адреса из sitemap (tests/indexnow.py) — значит, и он идёт партиями.
PARTIYA_V_SUTKI = 500
_PARTIYA = re.compile(r"<!-- partiya (\d{4}-\d{2}-\d{2}): (\d+) -->")
_LOC = re.compile(r"<loc>([^<]+)</loc>")


TARIFY = os.path.join(KOREN, "tarify", "tarify.json")


def cena_pasporta(put=TARIFY):
    """kartochki-daty-v1: цена «Паспорта на дату сделки» из tarify.json (не руками, как js/pasport-cta.js); нет — None."""
    try:
        with open(put, encoding="utf-8") as fh:
            c = (json.load(fh).get("pasport_razovyj") or {}).get("cena_rub")
        return int(c) if isinstance(c, (int, float)) and c > 0 else None
    except (OSError, ValueError, AttributeError):
        return None


def segodnya_msk():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).date()


def partiya_sitemap(lm, staryj_xml, segodnya, partiya=PARTIYA_V_SUTKI, dohod=None):
    """lm {адрес: lastmod} — карточки за воротами индексации → ({адрес: lastmod} в sitemap, метка или None, ждут).
    Метка — (дата, всего новых за эту дату, новых в этой сборке); без новых — прежняя строка без изменений."""
    dohod = dohod or {}
    uzhe = {u[len(SAJT):] for u in _LOC.findall(staryj_xml or "") if u.startswith(SAJT + "/")}
    m = _PARTIYA.search(staryj_xml or "")
    den = segodnya.isoformat()
    bylo = int(m.group(2)) if m and m.group(1) == den else 0
    novye = sorted((a for a in lm if a not in uzhe), key=lambda a: (-(dohod.get(a) or 0), a))
    berem = novye[:max(0, int(partiya) - bylo)]
    vybor = {a: d for a, d in lm.items() if a in uzhe or a in set(berem)}
    if berem:
        metka = (den, bylo + len(berem), len(berem))
    elif m:
        metka = (m.group(1), int(m.group(2)), 0)
    else:
        metka = None
    return vybor, metka, len(novye) - len(berem)


_H1_STATI = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)


def statyi_haba(koren):
    """haby-statyi-v1: [(адрес, заголовок h1)] статей HAB_STATYI, что есть на сайте и открыты роботам."""
    out = []
    for st in HAB_STATYI:
        put = os.path.join(koren, st, "index.html")
        if not os.path.isfile(put):
            continue
        t = open(put, encoding="utf-8").read()
        h = _H1_STATI.search(t)
        if not h or re.search(r'<meta name="robots" content="[^"]*noindex', t):
            continue
        out.append(("/%s/" % st, re.sub(r"[ \t\r\n]+", " ", html.unescape(re.sub(r"<[^>]+>", "", h.group(1)))).strip()))
    return out


def sobrat_gruppy(gruppy, lm, koren, r, podval, shapka):
    """kartochki-haby-v1: пишет хабы групп, убирает исчезнувшие → {адрес стр. 1: lastmod} хабов, идущих в sitemap.
    В индекс — когда ≥ HAB_GRUPPY_OT карточек группы стоят в sitemap (lm); lastmod — самая свежая из них."""
    v_sm = {}
    nuzhnye = set()
    normy, statyi = zagruzit_normy(), statyi_haba(koren)  # haby-statyi-v1
    kg = karta_grupp(gruppy)  # haby-svyazi-v1: ссылки регион ↔ отрасль
    for g in gruppy:
        lms = [lm[adres_str(k)] for k in g["kart"] if adres_str(k) in lm]
        index = len(lms) >= HAB_GRUPPY_OT
        chasti = stranicy_gruppy(g, HAB_NA_STRANICE)
        for n, chast in enumerate(chasti, 1):
            a = adres_gruppy(g, n)
            nuzhnye.add(a)
            zapisat(os.path.join(koren, a.strip("/"), "index.html"),
                    ss.sobrat_stranicu(html_gruppy(g, chast, index, n, len(chasti), normy, statyi, kg), r, podval, shapka))
        if index:
            v_sm[adres_gruppy(g)] = max(lms)
    # лишнее (группа ушла ниже порога, страниц стало меньше) — удаляем; пустые папки — тоже
    for vid in GRUPPY_VIDY:
        kor = os.path.join(koren, PAPKA, vid)
        if not os.path.isdir(kor):
            continue
        for sl in sorted(os.listdir(kor)):
            base = "/%s/%s/%s/" % (PAPKA, vid, sl)
            if base not in nuzhnye:
                shutil.rmtree(os.path.join(kor, sl))
                continue
            ps = os.path.join(kor, sl, HAB_STRANICA)
            if os.path.isdir(ps):
                for d in os.listdir(ps):
                    if "%s%s/%s/" % (base, HAB_STRANICA, d) not in nuzhnye:
                        shutil.rmtree(os.path.join(ps, d))
                if not os.listdir(ps):
                    os.rmdir(ps)
        if not os.listdir(kor):
            os.rmdir(kor)
    return v_sm


def un_zagruzit(koren=KOREN):
    """kartochki-unik-v2: опубликованные карточки → контекст «На фоне других компаний Делоскопа» (render файлов не читает)."""
    papka = os.path.join(koren, PAPKA)
    stranicy = []
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        put = os.path.join(papka, d, "index.html")
        if re.match(r"^\d{10}-", d) and os.path.isfile(put):
            with open(put, encoding="utf-8") as fh:
                stranicy.append(bez_tipografa(fh.read()))  # kartochki-chisla-v1
    return un_ustanovit(stranicy)


# kartochki-svezhest-v1 ([Ночные-2] 23.10): анонимный /api/check отдаёт реестр без финансов. Если такой ответ попал в
# добор по уже опубликованной карточке, ворота говорили «нет финансов» — и карточка удалялась. Финансы из ГИР БО не
# исчезают: это неполный ответ, а не новость о компании. Такую карточку оставляем как есть (другие причины — снимают).
NET_FIN = "нет финансов (доход > 0 по ФНС / ГИР БО)"


def nepolnye_otvety(otchet, opublikovannye):
    """→ ИНН опубликованных карточек, по которым свежий ответ не прошёл ворота только из-за «нет финансов»."""
    return {inn for inn, pr, _ in otchet.get("po_inn", []) if pr == NET_FIN and inn in opublikovannye}


def sobrat(zapisi, koren=KOREN, limit=STUPENI[0], spros=None, kontrol=None, dobavit=False,
           partiya=PARTIYA_V_SUTKI, segodnya=None):
    kart, otchet = otobrat(zapisi, limit, spros, kontrol)
    # kartochki-unik-v9: каждая запись карточки — с WebPage; дата изменения текста сравнивается с версией до этой сборки
    prezhnie = prezhnie_otpechatki(koren)
    daty_teksta = {}
    den_ = segodnya or segodnya_msk()

    def zapisat_k(put, txt):
        p_ = os.path.basename(os.path.dirname(put))
        txt, d_t = vstavit_webpage(tipograf_kartochki(bez_nevidimyh(txt), chisla=True), den_, prezhnie.get(p_))  # kartochki-tipograf-v1
        if d_t:
            daty_teksta["/%s/%s/" % (PAPKA, p_)] = d_t
        return zapisat(put, txt)
    un_zagruzit(koren)  # kartochki-unik-v2: сравнение с уже опубликованными (после записи — ещё раз, по свежему составу)
    r = ss.rekv_sajta()  # beta-v1: режим сайта (в бете — без реквизитов ИП и с полосой беты)
    papka = os.path.join(koren, PAPKA)
    nuzhnye = {adres_str(k).strip("/").split("/", 1)[1] for k in kart}
    starye, svezhie = [], set()
    if dobavit:
        # свежие сведения главнее страницы; ИНН, который сейчас не прошёл ворота, уходит, как при полной сборке
        na_diske = kartochki_na_diske(koren)
        nepolnye = nepolnye_otvety(otchet, na_diske)  # kartochki-svezhest-v1: неполный ответ карточку не снимает
        otchet["nepolnye"] = len(nepolnye)
        svezhie = {inn for inn, _, _ in otchet.get("po_inn", [])} - nepolnye
        starye = [x for inn, x in sorted(na_diske.items()) if inn not in svezhie]
        nuzhnye |= {x["_papka"] for x in starye}
    vse = kart + starye
    # карточки, которые больше не проходят ворота, убираем — адрес уйдёт в «мягкую 404» → живую проверку
    if os.path.isdir(papka):
        for d in os.listdir(papka):
            if re.match(r"^\d{10}-", d) and d not in nuzhnye and (not dobavit or d[:10] in svezhie):
                shutil.rmtree(os.path.join(papka, d))  # при доборе — только ИНН из этой порции, чужое не трогаем
    # хаб и подвал: ссылка «Компании» в подвале появляется вместе с хабом (sobrat_shapku смотрит на company/index.html)
    hub_index = len(vse) >= HUB_INDEX_OT
    if vse:
        zapisat(os.path.join(papka, "index.html"), "")  # чтобы подвал уже знал о хабе
    podval = ss.podval_html(r)
    shapka = ss.shapka_html()
    normy = zagruzit_normy()
    cena = cena_pasporta()  # kartochki-daty-v1: цена Паспорта после беты — из tarify.json
    kom = kommentarii.zagruzit()  # «Комментарий команды» — data/kommentarii.json (только утверждённые [Право] тексты)
    # kartochki-haby-v1: хабы отраслей и регионов (≥ HAB_GRUPPY_OT карточек) — до карточек: крошки ссылаются на них
    gruppy = gruppy_haba(vse, HAB_GRUPPY_OT)
    kg = karta_grupp(gruppy)
    izm = 0
    den = segodnya or segodnya_msk()  # vozrast-segodnya-v1: возраст компании — на день сборки по Москве
    for k in kart:
        sos_ = pohozhie(k, vse)
        k["_eshche"] = eshche_kompanii(k, vse, sos_)  # kartochki-shablon-v1: всего ссылок на карточки — не меньше 5
        txt = ss.sobrat_stranicu(bez_tipografa(html_kartochki(k, k["_V"], sos_, kom, normy, cena)), r, podval, shapka)  # kartochki-chisla-v1: NB_T — при записи
        txt = ssylki_kroshek(txt, kg)
        txt = pochinit_vozrast(txt, den)
        k["_noindex"] = noindex_html(txt)
        izm += zapisat_k(os.path.join(koren, adres_str(k).strip("/"), "index.html"), txt)
    # v3.8b: у опубликованных — свежие «Похожие компании», остальное байт в байт
    for x in starye:
        put = os.path.join(papka, x["_papka"], "index.html")
        with open(put, encoding="utf-8") as fh:
            t = ubrat_nabor(ubrat_statyu(bez_tipografa(fh.read())))  # kartochki-chisla-v1: без NB_T · kartochki-stati-v1 + nedoimka-mesyac-v1: обе строки ставим заново
        sos_ = pohozhie(x, vse)
        t2 = _SOS.sub(lambda m: m.group(1) + sosedi_html(x, sos_, eshche_kompanii(x, vse, sos_)) + m.group(3), t, count=1)
        t2 = pochinit_god_dvazhdy(t2)  # v3.10: «Выручка за 2021 — … за 2021» → год один раз, как у новых карточек
        t2 = pochinit_indeks_blok(t2)  # kartochki-okved-v1: «Индекс — считаем» → «Индекс — в полном отчёте», как у новых
        t2 = pochinit_ubytok(t2)  # kartochki-v4.2: «убыток» в таблице — подписью над числом, как у новых
        t2 = pochinit_otrasl_yakor(t2, normy)  # nagruzka-yakorya-v1: «Таблица ФНС» — на строку отрасли, как у новых
        t2 = pochinit_daty(t2, cena)  # kartochki-daty-v1: «Даты из реестра» и вход в Паспорт, как у новых
        t2 = pochinit_izmenenie(t2)  # kartochki-daty-v2: «изменение записи» = день сведений — не изменение, снять
        t2 = vstavit_znachit(t2)  # kartochki-znachit-v1: «Что это значит для вас» — из фактов страницы, как у новых
        t2 = beta_poloviny(t2, r["_beta"], r.get("_beta_do"))  # половины беты — по флагу, как sobrat_shapku
        t2 = primenit_vorota_indeksa(t2)  # kartochki-indeks-v1: те же ворота индексации, что у новых карточек
        t2 = ssylki_kroshek(t2, kg)  # kartochki-haby-v1: регион и раздел в крошках — ссылкой на хаб группы
        t2 = shablon_v2(t2)  # kartochki-shablon-v1: H1 с ИНН, строка под H1, description — как у новых
        t2 = pochinit_imya(t2)  # kartochki-imya-v1: советы и заголовок реестров — с названием, как у новых
        t2 = svodka_zel(t2)  # kartochki-svodka-v1: зелёные комментарии — одним блоком под реестрами, как у новых
        t2 = nabor_nedoimki(t2)  # nedoimka-mesyac-v1: «ФНС обновляет набор раз в месяц» под строкой недоимки, как у новых
        t2 = pochinit_pered(t2)  # kartochki-unik-v2: «Перед оплатой» — по признакам страницы, как у новых
        t2 = pochinit_razbor(t2)  # kartochki-unik-v2: «… в цифрах» — с названием, как у новых
        t2 = pochinit_vozrast(t2, den)  # vozrast-segodnya-v1: возраст — на сегодня, число пересчитывает и браузер
        t2 = pochinit_rol_znaka(t2)  # kartochki-rol-znaka-v1: точке вывода — role="img", подпись читается вслух
        x["_noindex"] = noindex_html(t2)
        if BEZ_OBOLOCHKI in t2:
            # «голое» тело из комплекта — оболочка той же sobrat_stranicu
            t2 = ss.sobrat_stranicu(t2, r, podval, shapka)
        izm += zapisat_k(put, t2)
    # kartochki-unik-v2: «Чем {Имя} отличается» сравнивает карточку с остальными — после записи всех карточек
    # пересобираем блок «Что это значит для вас» по свежему составу (новые карточки получают абзац, у старых — места)
    un_zagruzit(koren)
    for k_ in sorted(kartochki_na_diske(koren).values(), key=lambda x: x["_papka"]):
        put = os.path.join(papka, k_["_papka"], "index.html")
        with open(put, encoding="utf-8") as fh:
            t = bez_tipografa(fh.read())  # kartochki-chisla-v1
        izm += zapisat_k(put, vstavit_znachit(t))
    # kartochki-unik-v3: «Похожие» (подпись — сравнение по обороту) — по напечатанному на всех карточках, как у добора:
    # первая сборка из сведений и следующий добор дают одни и те же байты
    na_d = kartochki_na_diske(koren)
    vse_d = [na_d[i] for i in sorted(na_d)]
    teksty = {}
    for x in vse_d:
        with open(os.path.join(papka, x["_papka"], "index.html"), encoding="utf-8") as fh:
            teksty[x["inn"]] = bez_tipografa(fh.read())  # kartochki-chisla-v1
    # kartochki-vhod-v1: у каждой открытой карточки — не меньше VHOD_MIN входящих ссылок с других карточек
    svyazi = svyazi_vse(vse_d, {i for i, t in teksty.items() if noindex_html(t)})
    for x in vse_d:
        put = os.path.join(papka, x["_papka"], "index.html")
        sos_, esh_ = svyazi[x["inn"]]
        izm += zapisat_k(put, _SOS.sub(lambda m: m.group(1) + sosedi_html(x, sos_, esh_) + m.group(3), teksty[x["inn"]], count=1))
    # kartochki-stati-v1: обратная перелинковка — в одном разделе карточки строка «По теме раздела: «статья»» (подбор —
    # tests/sobrat_stati_kartochki.py, по тем же карточкам, что статьи → карточки); последним шагом, до sitemap: дата
    # изменения текста WebPage и lastmod учитывают строку
    try:
        import sobrat_stati_kartochki as sk_
        if os.path.abspath(koren) == os.path.abspath(sk_.KOREN):
            for put, t in sk_.kartochki_so_statyami(koren).items():
                izm += zapisat_k(put, t)
    except Exception as oshibka:  # не роняем сборку; test_stati_kartochki (--check) покажет несобранные строки
        otchet["stati_v_kartochkah"] = "ошибка: %s" % oshibka
    # sitemap-companies.xml + robots.txt
    sm = os.path.join(koren, "sitemap-companies.xml")
    rb = os.path.join(koren, "robots.txt")
    stroka = "Sitemap: %s/sitemap-companies.xml" % SAJT
    robots = open(rb, encoding="utf-8").read()
    lm = {}
    if vse:
        # kartochki-indeks-v1: карточка с noindex в sitemap не идёт (ворота индексации, ТЗ [Данные] 03.10 разд. 3.2)
        lm = {adres_str(k): (k["_lastmod"] if k.get("_s_diska") else lastmod(k, k["_V"])) for k in vse if not k.get("_noindex")}
        lm = {a: d for a, d in lm.items() if d}
        lm = {a: max(d, daty_teksta.get(a, d)) for a, d in lm.items()}  # kartochki-unik-v9: и дата изменения текста
        # kartochki-volna-v1: новые адреса — партиями, не больше `partiya` в сутки (по Москве); остальные ждут завтра
        staryj = open(sm, encoding="utf-8").read() if os.path.exists(sm) else ""
        dohod = {adres_str(k): ((k.get("fakty") or {}).get("dohod") or {}).get("znachenie") or 0 for k in vse}
        lm, metka, zhdut = partiya_sitemap(lm, staryj, segodnya or segodnya_msk(), partiya, dohod)
        lm_grupp = sobrat_gruppy(gruppy, lm, koren, r, podval, shapka)
        otchet["sitemap_vsego"], otchet["sitemap_zhdut"] = len(lm), zhdut
        otchet["sitemap_novyh"] = metka[2] if metka else 0
        urls = []
        if metka:
            urls.append("<!-- partiya %s: %d -->" % (metka[0], metka[1]))
        if hub_index and lm:
            urls.append("  <url><loc>%s/%s/</loc><lastmod>%s</lastmod></url>" % (SAJT, PAPKA, max(lm.values()).isoformat()))
        # v3.5: по адресу (= по ИНН) — полная сборка и добор дают один и тот же sitemap
        urls += ["  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, a, lm[a].isoformat()) for a in sorted(lm)]
        # kartochki-haby-v1: хабы групп за воротами — после карточек (адреса карточек и партия не меняются)
        urls += ["  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, a, lm_grupp[a].isoformat()) for a in sorted(lm_grupp)]
        kom_ = [u for u in urls if u.startswith("<!--")]
        urls = [u for u in urls if not u.startswith("<!--")]
        zapisat(sm, '<?xml version="1.0" encoding="UTF-8"?>\n' + "".join(x + "\n" for x in kom_) +
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
        if stroka not in robots:
            zapisat(rb, robots.rstrip("\n") + "\n" + stroka + "\n")
    else:
        sobrat_gruppy([], {}, koren, r, podval, shapka)
        if os.path.exists(sm):
            os.remove(sm)
        if stroka in robots:
            zapisat(rb, robots.replace(stroka + "\n", "").replace(stroka, ""))
    # kartochki-volna-v1: хаб — по HAB_NA_STRANICE карточек; лишние страницы прошлой сборки убираем.
    # kartochki-hab-v3 (С2): страница 1 = все карточки из sitemap-companies.xml (поэтому хаб — после sitemap), 2… — остальные
    v_sm = frozenset(lm) if (vse and hub_index) else frozenset()  # хаб вне индекса — делить незачем
    str_haba = stranicy_haba(vse, HAB_NA_STRANICE, v_sm) if vse else []
    # kartochki-v4.5: ссылки «Как читать карточку» — только на статьи, которые уже есть в этой сборке сайта
    statyi = frozenset(u for u in (STATYA_NET_OTCHETNOSTI,)
                       if os.path.isfile(os.path.join(koren, u.strip("/"), "index.html")))
    if vse:
        for n, chast in enumerate(str_haba, 1):
            put = os.path.join(koren, adres_stranicy_haba(n).strip("/"), "index.html")
            zapisat(put, ss.sobrat_stranicu(html_haba(chast, hub_index, n, len(str_haba), vse, kg, statyi, v_sm), r, podval, shapka))
    elif os.path.exists(os.path.join(papka, "index.html")):
        os.remove(os.path.join(papka, "index.html"))
    papka_str = os.path.join(papka, HAB_STRANICA)
    if os.path.isdir(papka_str):
        for d in os.listdir(papka_str):
            if not (d.isdigit() and 2 <= int(d) <= len(str_haba)):
                shutil.rmtree(os.path.join(papka_str, d))
        if not os.listdir(papka_str):
            os.rmdir(papka_str)
    otchet["izmeneno_stranic"] = izm
    otchet["s_diska"] = len(starye)
    # reyting-v1: /reyting/ строится из опубликованных карточек — пересобрать вместе с ними (если страница заведена)
    try:
        import sobrat_reyting
        otchet["reyting"] = sobrat_reyting.zapisat_esli_est(koren)
    except Exception as oshibka:  # рейтинг не должен ронять сборку карточек; тест reyting.test.js покажет устаревшую страницу
        otchet["reyting"] = "ошибка: %s" % oshibka
    # normy-kompanii-v1: справочник норм ФНС ссылается на карточки по строкам отраслей — пересобрать вместе с ними
    try:
        import sobrat_nagruzka
        if os.path.abspath(koren) == os.path.abspath(sobrat_nagruzka.KOREN):
            otchet["nagruzka"] = sobrat_nagruzka.sobrat(koren=koren)
    except Exception as oshibka:  # не роняем сборку карточек; nagruzka.test.js (--check) покажет устаревший блок
        otchet["nagruzka"] = "ошибка: %s" % oshibka
    # stati-kartochki-v1: статьи /nalogi/ и /115-fz/ называют карточки по теме — пересобрать вместе с ними
    try:
        import sobrat_stati_kartochki
        if os.path.abspath(koren) == os.path.abspath(sobrat_stati_kartochki.KOREN):
            otchet["stati"] = sobrat_stati_kartochki.sobrat(koren=koren)
    except Exception as oshibka:  # не роняем сборку карточек; test_stati_kartochki (--check) покажет устаревший блок
        otchet["stati"] = "ошибка: %s" % oshibka
    return kart, otchet


# ---------------------------------------------------------------- kartochki-shablon-v1: совпадение текста с «Похожими»
# ТЗ [Продукт · Яндекс] 11.10 п. 7: доля предложений карточки, которые дословно стоят и на соседней карточке («Похожие» и
# «Ещё в регионе»), — максимум по соседям. Цель — < 60 %; пока это ОТЧЁТ, а не ворота: на 11.10 медиана ≈ 83 % — общие
# тексты (оговорки [Право], «Перед оплатой», «Полный отчёт», «Паспорт»). Сделать воротами — решение [Продукт] (✎).
SOVPADENIE_CEL = 0.60
_SOS_SSYLKI = re.compile(r'<li><a href="/company/([^/"]+)/">')


def ubrat_statyu(t):
    """kartochki-stati-v1: опубликованная карточка без строки «По теме раздела» (её ставит конец сборки)."""
    return re.sub(r"<!--karta-statya-->.*?<!--/karta-statya-->", "", t, flags=re.S)


def predlozheniya(t):
    m = re.search(r"<main.*?</main>", t, re.S)
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", m.group(0) if m else t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t)).replace("\u00a0", " ")
    out = set()
    for blok in t.split("\n"):
        for s in re.split(r"(?<=[.!?…])\s+", blok):
            s = re.sub(r"\s+", " ", s).strip()
            if len(s) >= 20:
                out.add(s)
    return out


def sovpadenie(koren=KOREN):
    """→ [(доля, папка)] по опубликованным карточкам, по убыванию доли."""
    papka = os.path.join(koren, PAPKA)
    stranicy = {}
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        put = os.path.join(papka, d, "index.html")
        if re.match(r"^\d{10}-", d) and os.path.isfile(put):
            with open(put, encoding="utf-8") as fh:
                stranicy[d] = fh.read()
    pr = {d: predlozheniya(t) for d, t in stranicy.items()}
    out = []
    for d, t in stranicy.items():
        m = re.search(r'aria-labelledby="sos".*?</aside>', t, re.S)
        sos = [x for x in _SOS_SSYLKI.findall(m.group(0)) if x in pr] if m else []
        dolya = max([len(pr[d] & pr[x]) / max(1, len(pr[d])) for x in sos] or [0.0])
        out.append((dolya, d))
    return sorted(out, reverse=True)


# ---------------------------------------------------------------- сведения из живого /api/check
MAKS_ZAPROSOV = 300  # за один запуск (правило «Штаба» 02.10: не больше 300 запросов к API за запуск)


def zagolovki_dostupa(env=None):
    """Служебный доступ к /api/check (решение владельца 02.10, п. 4; API — servis-dostup-v1).
    DELOSKOP_SERVICE_TOKEN → заголовок X-Deloskop-Service: без анонимного лимита, потолок 1 000/сутки на стороне API.
    DELOSKOP_COOKIE (прежний способ: сессия сотрудника или deloskop_service=<токен>) — тоже работает.
    Значения берутся только из окружения запуска: в файлы, вывод и журнал не попадают."""
    env = os.environ if env is None else env
    zag = {}
    t = (env.get("DELOSKOP_SERVICE_TOKEN") or "").strip()
    if t:
        zag["X-Deloskop-Service"] = t
    if (env.get("DELOSKOP_COOKIE") or "").strip():
        zag["Cookie"] = env["DELOSKOP_COOKIE"].strip()
    return zag


def svezhest(koren=KOREN, segodnya=None):
    """kartochki-svezhest-v1: опубликованные карточки по дате сведений, старейшие первыми → [(ИНН, дата|None, дней|None)]."""
    segodnya = segodnya or segodnya_msk()
    na_d = kartochki_na_diske(koren)
    out = [(inn, k.get("_lastmod"), (segodnya - k["_lastmod"]).days if k.get("_lastmod") else None) for inn, k in na_d.items()]
    return sorted(out, key=lambda x: (x[1] or dt.date.min, x[0]))


def k_osvezheniyu(n, vyhod=None, koren=KOREN):
    """kartochki-svezhest-v1: N опубликованных карточек со старейшими сведениями, ещё не спрошенных в vyhod."""
    gotovo = set()
    if vyhod and os.path.exists(vyhod):
        gotovo = {re.sub(r"\D", "", str((r.get("company") or {}).get("inn") or "")) for r in chitat_jsonl(vyhod)}
    return [inn for inn, _, _ in svezhest(koren) if inn not in gotovo][:max(0, int(n))]


_NABOR_DATA = re.compile(r'<span>Задолженность по налогам</span><span class="fact__v">[^<]*</span>'
                         r'<span class="fact__src co-src">ФНС, открытые данные[^<]* · сведения на (\d\d)\.(\d\d)\.(\d{4})')


def nabory_nedoimki(koren=KOREN):
    """nedoimka-mesyac-v1: [(дата набора ФНС о недоимке, сколько карточек)] по опубликованным, новые первыми."""
    papka = os.path.join(koren, PAPKA)
    schet = {}
    for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
        put = os.path.join(papka, d, "index.html")
        if re.match(r"^\d{10}-", d) and os.path.isfile(put):
            with open(put, encoding="utf-8") as fh:
                m = _NABOR_DATA.search(bez_tipografa(fh.read()))  # kartochki-chisla-v1
            if m:
                dd = dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
                schet[dd] = schet.get(dd, 0) + 1
    return sorted(schet.items(), reverse=True)


def pechat_svezhesti(spisok, pokazat=10):
    dni = [d for _, _, d in spisok if d is not None]
    if not spisok:
        print("Опубликованных карточек нет.")
        return
    korz = [("до 7 дней", 0, 7), ("8–14 дней", 8, 14), ("15–30 дней", 15, 30), ("старше 30 дней", 31, 10 ** 6)]
    print("Карточек: %d · сведения: самые старые — %s дн., самые свежие — %s дн." % (
        len(spisok), max(dni) if dni else "?", min(dni) if dni else "?"))
    for imya_, ot, do in korz:
        print("  %s: %d" % (imya_, sum(1 for d in dni if ot <= d <= do)))
    bez = sum(1 for d in spisok if d[2] is None)
    if bez:
        print("  без даты сведений: %d" % bez)
    print("Старейшие %d (освежить первыми — iz-api --osvezhit N):" % min(pokazat, len(spisok)))
    for inn, d, n in spisok[:pokazat]:
        print("  %s — сведения на %s (%s дн.)" % (inn, d.strftime("%d.%m.%Y") if d else "—", n if n is not None else "?"))


def iz_api(spisok, vyhod, api="https://api.deloskop.ru", pauza=6.0, maks=MAKS_ZAPROSOV, zanovo=False, osvezhit=None):
    """Берёт ИНН из файла (по одному в строке), спрашивает /api/check и дописывает ответы в vyhod (.jsonl).
    Возобновляется с места обрыва. ИНН из 12 цифр не запрашиваются вовсе. Каждый запрос — это одна
    живая проверка (DaData findById + базы) — не больше 1 000 за ночь (Данные §1.4, бюджет DaData).
    kartochki-v2: пауза по умолчанию 6 с, не больше maks запросов за запуск, на HTTP 429 — сразу стоп
    (лимит не обходим: продолжить — та же команда позже, готовые ИНН пропускаются).
    kartochki-vybor-v1: опубликованные на сайте и ИНН из отсева (tests/kartochki_otsev.txt) не спрашиваются —
    запрос не тратится на известный ответ; zanovo=True (`--zanovo`) — спросить всё."""
    gotovo = set()
    if os.path.exists(vyhod):
        for r in chitat_jsonl(vyhod):
            gotovo.add(re.sub(r"\D", "", str((r.get("company") or {}).get("inn") or "")))
    zag = {"Accept": "application/json", "User-Agent": "Deloskop-kartochki/1"}
    zag.update(zagolovki_dostupa())
    sluzhebnyj = "X-Deloskop-Service" in zag or "Cookie" in zag
    inns = []
    if osvezhit is not None:
        # kartochki-svezhest-v1: освежаем опубликованные, старейшие сведения первыми (опубликованные спрашиваем намеренно).
        # Анонимно — не больше 10 в сутки (на 429 — стоп); если ответ придёт без финансов, sobrat --dobavit карточку не снимет.
        inns = k_osvezheniyu(osvezhit, vyhod)
        zanovo = True
    stroki = []
    if spisok:
        with open(spisok, encoding="utf-8") as fh:
            stroki = fh.read().splitlines()
    for s in stroki:
        s = re.sub(r"\D", "", s)
        if len(s) == 10 and inn_ok(s) and s not in gotovo and s not in inns:
            inns.append(s)
    propusk = {"opub": 0, "otsev": 0}
    if not zanovo:
        opub, otsev = kv.ne_sprashivat(segodnya_msk(), KOREN)
        propusk = {"opub": sum(1 for s in inns if s in opub), "otsev": sum(1 for s in inns if s in otsev and s not in opub)}
        inns = [s for s in inns if s not in opub and s not in otsev]
    if propusk["opub"] or propusk["otsev"]:
        print("Пропущено: уже на сайте %d · в отсеве %d (не прошли ворота за последние %d дней; спросить всё — --zanovo)" % (
            propusk["opub"], propusk["otsev"], kv.OTSEV_DNEJ))
    inns = inns[:max(0, int(maks))]
    print("Служебный доступ: %s · к запросу: %d ИНН (не больше %d за запуск)" % ("да" if sluzhebnyj else "нет — анонимно, 10 проверок в день", len(inns), maks))
    ok = oshibki = 0
    with open(vyhod, "a", encoding="utf-8") as fh:
        for i, inn in enumerate(inns, 1):
            try:
                with urllib.request.urlopen(urllib.request.Request(api + "/api/check?q=" + inn, headers=zag), timeout=60) as otv:
                    r = json.loads(otv.read().decode("utf-8"))
                c = r.get("company") or {}
                # люди в файл не попадают, пока PERSONS_PUBLIC выключен
                if not persons_public():
                    for pole in ("director_name", "founders", "managers"):
                        c.pop(pole, None)
                for pole in ("phones", "emails", "phone", "email"):
                    c.pop(pole, None)
                r["_poluchen_msk"] = poluchen_msk()  # kartochki-msk-v1: дата проверки по Москве, не по UTC сервера
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
                fh.flush()
                ok += 1
            except urllib.error.HTTPError as ex:
                if ex.code == 429:
                    print("  %s: HTTP 429 — %s. Остановились (лимит не обходим); продолжить — та же команда позже." % (
                        inn, "суточный потолок служебного доступа" if sluzhebnyj else "анонимный лимит API"))
                    break
                oshibki += 1
                print("  %s: HTTP %s" % (inn, ex.code))
                if oshibki >= 20 and oshibki > ok:
                    print("Слишком много ошибок подряд — остановились. Продолжить: та же команда.")
                    break
            except Exception as ex:  # noqa: BLE001 — один сбой не останавливает всю ночь
                oshibki += 1
                print("  %s: %s" % (inn, str(ex)[:120]))
                if oshibki >= 20 and oshibki > ok:
                    print("Слишком много ошибок подряд — остановились. Продолжить: та же команда.")
                    break
            if i % 50 == 0:
                print("  … %d из %d" % (i, len(inns)))
            time.sleep(pauza)
    print("Получено: %d · ошибок: %d · файл: %s" % (ok, oshibki, vyhod))
    return 0


def _arg(argv, imya_, po_umolch=None):
    return argv[argv.index(imya_) + 1] if imya_ in argv else po_umolch


def vorota_zapisi(r):
    """kartochki-vybor-v1: ворота публикации одной записи /api/check — те же, что в otobrat."""
    k = iz_check(r)
    return vorota(k, vyvody(k))


def otsev(vhod, segodnya=None, put=None):
    """Дописывает в отсев ИНН из vhod (.jsonl), не прошедшие ворота публикации; прошедшие — из отсева убирает."""
    put = put or kv.OTSEV
    segodnya = segodnya or segodnya_msk()
    staryj = kv.chitat_otsev(put)
    zapisi = chitat_jsonl(vhod)
    novye = kv.otsev_iz_otveta(zapisi, segodnya, vorota_zapisi)
    proshli = {re.sub(r"\D", "", str((r.get("company") or {}).get("inn") or "")) for r in zapisi} - set(novye)
    itog = {i: v for i, v in staryj.items() if i not in proshli}
    itog.update(novye)
    kv.zapisat_otsev(itog, put)
    return novye, len(itog)


def main(argv):
    if not argv or argv[0] not in ("sobrat", "proverka", "iz-api", "vybor", "otsev", "perepechatat", "svezhest"):
        print(__doc__)
        return 2
    if argv[0] == "perepechatat":
        # kartochki-shablon-v1: опубликованные карточки — по текущему шаблону, без сведений и без API (= sobrat --dobavit
        # с пустым входом): «Похожие», H1, строка под H1, description и прочие pochinit_* — как у новых карточек
        argv = ["sobrat", "--dobavit", "--vhod", os.devnull]
    if argv[0] == "svezhest":
        pechat_svezhesti(svezhest(), int(_arg(argv, "--pokazat", "10")))
        nab = nabory_nedoimki()
        if nab:  # nedoimka-mesyac-v1: набор ФНС выходит ежемесячно — видно, когда API отдал новый (тогда perepechatat/--osvezhit)
            print("Набор ФНС о недоимке на карточках: " + ", ".join("на %s — %d" % (d.strftime("%d.%m.%Y"), n) for d, n in nab))
        return 0
    if argv[0] == "iz-api":
        osv = _arg(argv, "--osvezhit")
        if not _arg(argv, "--inn") and osv is None:
            print("Нужен --inn <файл со списком ИНН> или --osvezhit N.")
            return 2
        return iz_api(_arg(argv, "--inn"), _arg(argv, "--vyhod", "tests/kartochki_dannye/kartochki.jsonl"),
                      _arg(argv, "--api", "https://api.deloskop.ru"), max(6.0, float(_arg(argv, "--pauza", "6"))),
                      int(_arg(argv, "--maks", str(MAKS_ZAPROSOV))), zanovo="--zanovo" in argv,
                      osvezhit=int(osv) if osv is not None else None)
    if argv[0] == "vybor":
        return kv.main_vybor(argv, _arg, segodnya_msk())
    if argv[0] == "otsev":
        novye, vsego = otsev(_arg(argv, "--vhod", "tests/kartochki_dannye/kartochki.jsonl"))
        for inn, (_, pr) in sorted(novye.items()):
            print("  %s — %s" % (inn, pr))
        print("Отсев: новых %d · всего %d → %s (в git — только ИНН, дата и причина)" % (len(novye), vsego, kv.OTSEV))
        return 0
    vhod = _arg(argv, "--vhod", "tests/kartochki_dannye/kartochki.jsonl")
    zapisi = chitat_jsonl(vhod)
    stupen = int(_arg(argv, "--stupen", "0"))
    limit = int(_arg(argv, "--limit", STUPENI.get(stupen, STUPENI[0])))
    spros = _arg(argv, "--spros")
    kontrol = _arg(argv, "--kontrol")
    spros = int(spros) if spros else None
    kontrol = int(kontrol) if kontrol else None
    if argv[0] == "proverka":
        _, o = otobrat(zapisi, limit, spros, kontrol)
        pechat_otcheta(o, "--podrobno" in argv)
        return 0
    _, o = sobrat(zapisi, KOREN, limit, spros, kontrol, dobavit="--dobavit" in argv,
                  partiya=int(_arg(argv, "--partiya", str(PARTIYA_V_SUTKI))))
    # хаб появился/исчез → ссылка «Компании» в подвале всех страниц; пересобираем общий подвал сразу
    import subprocess
    subprocess.run([sys.executable, os.path.join(KOREN, "tests", "sobrat_shapku.py")], cwd=KOREN, check=True)
    pechat_otcheta(o)
    if o.get("s_diska"):
        print("Добор (--dobavit): опубликованных карточек оставлено как есть: %d." % o["s_diska"])
    if o.get("nepolnye"):
        print("Из них по неполному ответу (реестр без финансов — анонимный доступ?): %d — не сняты, сведения прежние." % o["nepolnye"])
    if "sitemap_vsego" in o:
        print("Sitemap: %d адресов карточек · новых в этой сборке: %d · ждут следующей партии: %d (не больше %s в сутки)." % (
            o["sitemap_vsego"], o["sitemap_novyh"], o["sitemap_zhdut"], _arg(argv, "--partiya", str(PARTIYA_V_SUTKI))))
    sv = sovpadenie(KOREN)
    if sv:
        dd = sorted(x for x, _ in sv)
        print("Совпадение предложений с соседними карточками: медиана %d %% · максимум %d %% (%s) · ниже цели %d %%: %d из %d — отчёт, не ворота." % (
            round(dd[len(dd) // 2] * 100), round(sv[0][0] * 100), sv[0][1], round(SOVPADENIE_CEL * 100),
            sum(1 for x in dd if x < SOVPADENIE_CEL), len(dd)))
    print("Карточек изменено: %d. Дальше: node --test tests/*.test.* && python3 tests/test_kartochki.py → PR." % o["izmeneno_stranic"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
