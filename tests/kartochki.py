#!/usr/bin/env python3
"""Карточки компаний /company/{инн}-{slug}/ — пробная SEO-волна (Очередь п. 64; комплект karta-v1 + v1.1, 29.09.2026).

Что делает: из сведений о компаниях (JSON Lines, одна компания — одна строка, формат ответа /api/check)
собирает статичные страницы-карточки, хаб /company/, sitemap-companies.xml и строку Sitemap в robots.txt.
Только стандартная библиотека Python.

    python3 tests/kartochki.py sobrat  --vhod kartochki.jsonl [--stupen 0] [--spros 800 --kontrol 200]
    python3 tests/kartochki.py proverka --vhod kartochki.jsonl      # только отчёт «сколько проходит ворота», файлы не трогает
    python3 tests/kartochki.py iz-api  --inn spisok.txt --vyhod kartochki.jsonl   # сведения из живого /api/check

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
import json
import os
import re
import shutil
import sys
import time
import urllib.request

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import sobrat_shapku as ss  # noqa: E402
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


def pechat_otcheta(o):
    print("Записей на входе: %d · ИП отброшено до обработки: %d" % (o["vsego"], o["ip_otbrosheno"]))
    print("Прошли ворота индексации: %d · в волне: %d (со спросом %d, контроль %d)" % (o["proshli"], o.get("v_volne", 0), o["spros"], o["kontrol"]))
    for pr, n in sorted(o["prichiny"].items(), key=lambda x: -x[1]):
        print("  не прошли — %s: %d" % (pr, n))


def zapisat(put, txt):
    os.makedirs(os.path.dirname(put), exist_ok=True)
    stary = open(put, encoding="utf-8").read() if os.path.exists(put) else None
    if stary != txt:
        with open(put, "w", encoding="utf-8") as fh:
            fh.write(txt)
        return True
    return False


def sobrat(zapisi, koren=KOREN, limit=STUPENI[0], spros=None, kontrol=None):
    kart, otchet = otobrat(zapisi, limit, spros, kontrol)
    r = ss.rekv_sajta()  # beta-v1: режим сайта (в бете — без реквизитов ИП и с полосой беты)
    papka = os.path.join(koren, PAPKA)
    nuzhnye = {adres_str(k).strip("/").split("/", 1)[1] for k in kart}
    # карточки, которые больше не проходят ворота, убираем — адрес уйдёт в «мягкую 404» → живую проверку
    if os.path.isdir(papka):
        for d in os.listdir(papka):
            if re.match(r"^\d{10}-", d) and d not in nuzhnye:
                shutil.rmtree(os.path.join(papka, d))
    # хаб и подвал: ссылка «Компании» в подвале появляется вместе с хабом (sobrat_shapku смотрит на company/index.html)
    hub_index = len(kart) >= HUB_INDEX_OT
    if kart:
        zapisat(os.path.join(papka, "index.html"), "")  # чтобы подвал уже знал о хабе
    podval = ss.podval_html(r)
    shapka = ss.shapka_html()
    izm = 0
    for k in kart:
        txt = ss.sobrat_stranicu(html_kartochki(k, k["_V"], pohozhie(k, kart)), r, podval, shapka)
        izm += zapisat(os.path.join(koren, adres_str(k).strip("/"), "index.html"), txt)
    if kart:
        zapisat(os.path.join(papka, "index.html"), ss.sobrat_stranicu(html_haba(kart, hub_index), r, podval, shapka))
    elif os.path.exists(os.path.join(papka, "index.html")):
        os.remove(os.path.join(papka, "index.html"))
    # sitemap-companies.xml + robots.txt
    sm = os.path.join(koren, "sitemap-companies.xml")
    rb = os.path.join(koren, "robots.txt")
    stroka = "Sitemap: %s/sitemap-companies.xml" % SAJT
    robots = open(rb, encoding="utf-8").read()
    if kart:
        urls = []
        if hub_index:
            urls.append("  <url><loc>%s/%s/</loc><lastmod>%s</lastmod></url>" % (SAJT, PAPKA, max(lastmod(k, k["_V"]) for k in kart).isoformat()))
        urls += ["  <url><loc>%s%s</loc><lastmod>%s</lastmod></url>" % (SAJT, adres_str(k), lastmod(k, k["_V"]).isoformat()) for k in kart]
        zapisat(sm, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
        if stroka not in robots:
            zapisat(rb, robots.rstrip("\n") + "\n" + stroka + "\n")
    else:
        if os.path.exists(sm):
            os.remove(sm)
        if stroka in robots:
            zapisat(rb, robots.replace(stroka + "\n", "").replace(stroka, ""))
    otchet["izmeneno_stranic"] = izm
    return kart, otchet


# ---------------------------------------------------------------- сведения из живого /api/check
def iz_api(spisok, vyhod, api="https://api.deloskop.ru", pauza=2.0):
    """Берёт ИНН из файла (по одному в строке), спрашивает /api/check и дописывает ответы в vyhod (.jsonl).
    Возобновляется с места обрыва. ИНН из 12 цифр не запрашиваются вовсе. Каждый запрос — это одна
    живая проверка (DaData findById + базы) — не больше 1 000 за ночь (Данные §1.4, бюджет DaData)."""
    gotovo = set()
    if os.path.exists(vyhod):
        for r in chitat_jsonl(vyhod):
            gotovo.add(re.sub(r"\D", "", str((r.get("company") or {}).get("inn") or "")))
    inns = []
    for s in open(spisok, encoding="utf-8"):
        s = re.sub(r"\D", "", s)
        if len(s) == 10 and inn_ok(s) and s not in gotovo and s not in inns:
            inns.append(s)
    zag = {"Accept": "application/json", "User-Agent": "Deloskop-kartochki/1"}
    if os.environ.get("DELOSKOP_COOKIE"):
        zag["Cookie"] = os.environ["DELOSKOP_COOKIE"]  # сессия сотрудника — без лимита анонимных проверок; в файлы не пишем
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
               _arg(argv, "--api", "https://api.deloskop.ru"), float(_arg(argv, "--pauza", "2")))
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
        pechat_otcheta(o)
        return 0
    _, o = sobrat(zapisi, KOREN, limit, spros, kontrol)
    # хаб появился/исчез → ссылка «Компании» в подвале всех страниц; пересобираем общий подвал сразу
    import subprocess
    subprocess.run([sys.executable, os.path.join(KOREN, "tests", "sobrat_shapku.py")], cwd=KOREN, check=True)
    pechat_otcheta(o)
    print("Карточек изменено: %d. Дальше: node --test tests/*.test.* && python3 tests/test_kartochki.py → PR." % o["izmeneno_stranic"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
