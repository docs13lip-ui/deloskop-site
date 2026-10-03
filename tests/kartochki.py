#!/usr/bin/env python3
"""Карточки компаний /company/{инн}-{slug}/ — пробная SEO-волна (Очередь п. 64; комплект karta-v1 + v1.1, 29.09.2026).

Что делает: из сведений о компаниях (JSON Lines, одна компания — одна строка, формат ответа /api/check)
собирает статичные страницы-карточки, хаб /company/, sitemap-companies.xml и строку Sitemap в robots.txt.
Только стандартная библиотека Python.

    python3 tests/kartochki.py sobrat  --vhod kartochki.jsonl [--stupen 0] [--spros 800 --kontrol 200] [--dobavit]
        # --dobavit (v3.5): опубликованные карточки не трогать, новые — добавить; хаб и sitemap — по всем
    python3 tests/kartochki.py proverka --vhod kartochki.jsonl [--podrobno]  # только отчёт «сколько проходит ворота», файлы не трогает
    python3 tests/kartochki.py iz-api  --inn spisok.txt --vyhod kartochki.jsonl [--pauza 6] [--maks 300]  # живой /api/check; 429 — стоп;
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
  * телефонов и e-mail нет; aggregateRating нет; JSON-LD — Organization + BreadcrumbList;
  * lastmod — самая свежая дата сведений карточки, не дата сборки; сборка детерминирована (те же данные → те же байты).

Данные в репозиторий не кладём: файл .jsonl живёт у того, кто собирает (папка tests/kartochki_dannye/ — в .gitignore).
"""
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
                out.append(json.loads(s))
            except json.JSONDecodeError as ex:
                raise SystemExit("Строка %d: не JSON (%s)" % (i, ex))
    return out


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
_DOHOD = re.compile(r"доход ([0-9]+(?:,[0-9]+)?)(?:&nbsp;|\u00a0| )(трлн|млрд|млн|тыс\.)(?:&nbsp;|\u00a0| )₽")
_MNOZH = {"трлн": 1e12, "млрд": 1e9, "млн": 1e6, "тыс.": 1e3}
_SVEDENIYA = re.compile(r"сведения на (\d\d)\.(\d\d)\.(\d{4})")
BEZ_OBOLOCHKI = "<!--shapka--><!--/shapka-->"
_KROSH = re.compile(r'<nav class="co-krosh caption"[^>]*>(.*?)</nav>', re.S)
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
            t = fh.read()
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
        if z:
            k["fakty"]["dohod"] = {"znachenie": float(z.group(1).replace(",", ".")) * _MNOZH[z.group(2)]}
        daty = [dt.date(int(g), int(mm), int(dd)) for dd, mm, g in _SVEDENIYA.findall(t)]
        k["_lastmod"] = max(daty) if daty else None
        kr = _KROSH.search(t)  # v3.8b: раздел ОКВЭД — последнее звено крошек
        if kr:
            hv = html.unescape(re.sub(r"<[^>]+>", "", kr.group(1))).split(" › ")[-1].strip()
            k["razdel"] = hv if hv in _RAZDELY else ""
        out[k["inn"]] = k
    return out


def sobrat(zapisi, koren=KOREN, limit=STUPENI[0], spros=None, kontrol=None, dobavit=False):
    kart, otchet = otobrat(zapisi, limit, spros, kontrol)
    r = ss.rekv_sajta()  # beta-v1: режим сайта (в бете — без реквизитов ИП и с полосой беты)
    papka = os.path.join(koren, PAPKA)
    nuzhnye = {adres_str(k).strip("/").split("/", 1)[1] for k in kart}
    starye, svezhie = [], set()
    if dobavit:
        # свежие сведения главнее страницы; ИНН, который сейчас не прошёл ворота, уходит, как при полной сборке
        svezhie = {inn for inn, _, _ in otchet.get("po_inn", [])}
        starye = [x for inn, x in sorted(kartochki_na_diske(koren).items()) if inn not in svezhie]
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
    kom = kommentarii.zagruzit()  # «Комментарий команды» — data/kommentarii.json (только утверждённые [Право] тексты)
    izm = 0
    for k in kart:
        txt = ss.sobrat_stranicu(html_kartochki(k, k["_V"], pohozhie(k, vse), kom, normy), r, podval, shapka)
        izm += zapisat(os.path.join(koren, adres_str(k).strip("/"), "index.html"), txt)
    # v3.8b: у опубликованных — свежие «Похожие компании», остальное байт в байт
    for x in starye:
        put = os.path.join(papka, x["_papka"], "index.html")
        with open(put, encoding="utf-8") as fh:
            t = fh.read()
        t2 = _SOS.sub(lambda m: m.group(1) + sosedi_html(x, pohozhie(x, vse)) + m.group(3), t, count=1)
        if BEZ_OBOLOCHKI in t2:
            # «голое» тело из комплекта — оболочка той же sobrat_stranicu
            t2 = ss.sobrat_stranicu(t2, r, podval, shapka)
        izm += zapisat(put, t2)
    if vse:
        zapisat(os.path.join(papka, "index.html"), ss.sobrat_stranicu(html_haba(vse, hub_index), r, podval, shapka))
    elif os.path.exists(os.path.join(papka, "index.html")):
        os.remove(os.path.join(papka, "index.html"))
    # sitemap-companies.xml + robots.txt
    sm = os.path.join(koren, "sitemap-companies.xml")
    rb = os.path.join(koren, "robots.txt")
    stroka = "Sitemap: %s/sitemap-companies.xml" % SAJT
    robots = open(rb, encoding="utf-8").read()
    if vse:
        lm = {adres_str(k): (k["_lastmod"] if k.get("_s_diska") else lastmod(k, k["_V"])) for k in vse}
        lm = {a: d for a, d in lm.items() if d}
        urls = []
        if hub_index:
            urls.append("  <url><loc>%s/%s/</loc><lastmod>%s</lastmod></url>" % (SAJT, PAPKA, max(lm.values()).isoformat()))
        # v3.5: по адресу (= по ИНН) — полная сборка и добор дают один и тот же sitemap
        urls += ["  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, a, lm[a].isoformat()) for a in sorted(lm)]
        zapisat(sm, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
        if stroka not in robots:
            zapisat(rb, robots.rstrip("\n") + "\n" + stroka + "\n")
    else:
        if os.path.exists(sm):
            os.remove(sm)
        if stroka in robots:
            zapisat(rb, robots.replace(stroka + "\n", "").replace(stroka, ""))
    otchet["izmeneno_stranic"] = izm
    otchet["s_diska"] = len(starye)
    return kart, otchet


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


def iz_api(spisok, vyhod, api="https://api.deloskop.ru", pauza=6.0, maks=MAKS_ZAPROSOV):
    """Берёт ИНН из файла (по одному в строке), спрашивает /api/check и дописывает ответы в vyhod (.jsonl).
    Возобновляется с места обрыва. ИНН из 12 цифр не запрашиваются вовсе. Каждый запрос — это одна
    живая проверка (DaData findById + базы) — не больше 1 000 за ночь (Данные §1.4, бюджет DaData).
    kartochki-v2: пауза по умолчанию 6 с, не больше maks запросов за запуск, на HTTP 429 — сразу стоп
    (лимит не обходим: продолжить — та же команда позже, готовые ИНН пропускаются)."""
    gotovo = set()
    if os.path.exists(vyhod):
        for r in chitat_jsonl(vyhod):
            gotovo.add(re.sub(r"\D", "", str((r.get("company") or {}).get("inn") or "")))
    inns = []
    for s in open(spisok, encoding="utf-8"):
        s = re.sub(r"\D", "", s)
        if len(s) == 10 and inn_ok(s) and s not in gotovo and s not in inns:
            inns.append(s)
    inns = inns[:max(0, int(maks))]
    zag = {"Accept": "application/json", "User-Agent": "Deloskop-kartochki/1"}
    zag.update(zagolovki_dostupa())
    sluzhebnyj = "X-Deloskop-Service" in zag or "Cookie" in zag
    print("Служебный доступ: %s · к запросу: %d ИНН (не больше %d за запуск)" % ("да" if sluzhebnyj else "нет — анонимно, 3 проверки в день", len(inns), maks))
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


def _arg(argv, imya_, po_umolch=None):
    return argv[argv.index(imya_) + 1] if imya_ in argv else po_umolch


def main(argv):
    if not argv or argv[0] not in ("sobrat", "proverka", "iz-api"):
        print(__doc__)
        return 2
    if argv[0] == "iz-api":
        iz_api(_arg(argv, "--inn"), _arg(argv, "--vyhod", "tests/kartochki_dannye/kartochki.jsonl"),
               _arg(argv, "--api", "https://api.deloskop.ru"), max(6.0, float(_arg(argv, "--pauza", "6"))),
               int(_arg(argv, "--maks", str(MAKS_ZAPROSOV))))
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
    _, o = sobrat(zapisi, KOREN, limit, spros, kontrol, dobavit="--dobavit" in argv)
    # хаб появился/исчез → ссылка «Компании» в подвале всех страниц; пересобираем общий подвал сразу
    import subprocess
    subprocess.run([sys.executable, os.path.join(KOREN, "tests", "sobrat_shapku.py")], cwd=KOREN, check=True)
    pechat_otcheta(o)
    if o.get("s_diska"):
        print("Добор (--dobavit): опубликованных карточек оставлено как есть: %d." % o["s_diska"])
    print("Карточек изменено: %d. Дальше: node --test tests/*.test.* && python3 tests/test_kartochki.py → PR." % o["izmeneno_stranic"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
