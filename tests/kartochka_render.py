#!/usr/bin/env python3
"""Отрисовка карточки компании /company/{инн}-{slug}/ — общий модуль сайта и API (комплект render-v1, 01.10.2026).

Один рендер на всех: статичные карточки сайта собирает tests/kartochki.py (ступени 0–1, до 1 000 карточек),
а со ступени 2 тот же модуль подключает deloskop-api (/company/ через nginx → API + кэш) — правила ворот,
тексты, «не проверяли ≠ не нашли», 152-ФЗ (люди — только при PERSONS_PUBLIC=1) живут в одном месте.

Здесь — только чистые функции «сведения → HTML»: стандартная библиотека, без чтения файлов, сети и
модулей сайта (это проверяет tests/test_kartochka_render.py). Шапку, подвал и режим беты ставит сайт
(tests/sobrat_shapku.py → sobrat_stranicu); на их место в разметке — метки <!--shapka--><!--/shapka-->.

Для API — одна точка входа: kartochka_iz_check(ответ /api/check, соседи) → (годится, причина, адрес, html),
и оболочка: nadet_obolochku(html, оболочка) — оболочку собирает сайт (tests/sobrat_shapku.py → partials/obolochka.json),
результат байт в байт равен статичной карточке волны (obolochka-v1).
Правила карточек — в шапке tests/kartochki.py.
"""
import datetime as dt
import html
import json
import math
import os
import re
import urllib.parse

SAJT = "https://deloskop.ru"
PAPKA = "company"
POROG_INDEKSA = 60
# Ступени волны (Ночные 27.09 14:05, раздел 2): 0 — пробная (сколько прошло ворота, но не больше 300).
STUPENI = {0: 300, 1: 1000, 2: 5000, 3: 20000, 4: 50000}
HUB_INDEX_OT = 20  # хаб /company/ в индексе — от 20 карточек (Маркетинг §2.6)
KOMMERCHESKIE = re.compile(r"^(ООО|АО|ПАО|НАО|ЗАО|ОАО)\b")
STOP_SLOVA = re.compile(r"однодневк|надёжн|надежн|опасн|уклон|гарант|мошенн|фирма-прокладк|обнал", re.I)
NE_PROVERYALI_ZAPRET = re.compile(r"(^|[^а-яё])(нет|не найдено|не нашли|чисто|отсутству)", re.I)

MESYACY = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
NB = " "


def persons_public():
    return os.environ.get("PERSONS_PUBLIC", "") == "1"


# ---------------------------------------------------------------- мелочи
def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def inn_ok(v):
    s = re.sub(r"\D", "", str(v or ""))
    if len(s) != 10:
        return False
    w = [2, 4, 10, 3, 5, 9, 4, 6, 8]
    return sum(a * int(b) for a, b in zip(w, s)) % 11 % 10 == int(s[9])


def plural(n, one, few, many):
    a = abs(int(n)) % 100
    b = a % 10
    if 10 < a < 20:
        return many
    if 1 < b < 5:
        return few
    if b == 1:
        return one
    return many


def data_iz(v):
    """'2026-07-25', '2026-07-25T10:00:00+03:00', '25.07.2026' → date или None."""
    if not v:
        return None
    s = str(v).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return dt.date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            return None
    m = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})$", s)
    if m:
        try:
            return dt.date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError:
            return None
    return None


def data_tekst(d):
    return "%d%s%s %d" % (d.day, NB, MESYACY[d.month - 1], d.year) if d else ""


def data_korotko(d):
    return d.strftime("%d.%m.%Y") if d else ""


def dengi(v):
    """48 300 000 → «48,3 млн ₽»; 412 000 → «412 тыс. ₽»; 5 846 млрд → «5,8 трлн ₽»; с неразрывными пробелами."""
    v = float(v)
    znak = "−" if v < 0 else ""
    a = abs(v)
    if a >= 1e12:
        t, ed = a / 1e12, "трлн"
    elif a >= 1e9:
        t, ed = a / 1e9, "млрд"
    elif a >= 1e6:
        t, ed = a / 1e6, "млн"
    elif a >= 1e3:
        t, ed = a / 1e3, "тыс."
    else:
        return znak + "%d%s₽" % (round(a), NB)
    s = ("%.1f" % t).rstrip("0").rstrip(".") if t < 100 else "%d" % round(t)
    return znak + s.replace(".", ",") + NB + ed + NB + "₽"


def chislo(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)) and math.isfinite(v):
        return float(v)
    if isinstance(v, str):
        s = v.replace(NB, "").replace(" ", "").replace(",", ".")
        if re.fullmatch(r"-?\d+(\.\d+)?", s):
            return float(s)
    return None


# ---------------------------------------------------------------- имя, адрес, slug
# kartochki-v4-kod: короткие обычные слова — не аббревиатуры («Торговый дом», а не «Торговый ДОМ»); ТД, НК, ГК, ПК — как есть.
KOROTKIE_SLOVA = {"ДОМ", "МИР", "САД", "ЛЕС"}


def imya(short, full=""):
    """'ООО "ТД "ЧЕРНОЗЕМЬЕ"' → 'ООО «ТД Черноземье»'. Кавычки всегда парные (Маркетинг §2.2, п. 4)."""
    s = re.sub(r"\s+", " ", str(short or full or "").strip())
    if not s:
        return ""
    m = re.match(r'^([^"«»“”„]*?)\s*["«»“”„](.*)$', s)
    if not m:
        return s
    opf, vnutri = m.group(1).strip(), re.sub(r'["«»“”„]', "", m.group(2)).strip()
    # kartochki-v4-kod: слово сразу после внутренней кавычки — тоже имя собственное, с прописной:
    # АО "АВИАКОМПАНИЯ "СИБИРЬ" → «Авиакомпания Сибирь» (было «…сибирь»), ООО "ТОРГОВЫЙ ДОМ "ЛЕНТА" → «Торговый дом Лента».
    posle_kavychki = set()
    for i, w in enumerate([x for x in m.group(2).strip().split(" ") if re.sub(r'["«»“”„]', "", x)]):
        if i > 0 and re.match(r'^["«»“”„]', w):
            posle_kavychki.add(i)
    if vnutri == vnutri.upper() and re.search(r"[А-ЯЁA-Z]", vnutri):
        slova = vnutri.split(" ")
        out = []
        for i, w in enumerate(slova):
            bukv = len(re.sub(r"[^А-Яа-яЁёA-Za-z]", "", w))
            if bukv <= 3 and w not in KOROTKIE_SLOVA:
                out.append(w)
            elif i == 0 or i in posle_kavychki or (i == 1 and slova[0] not in KOROTKIE_SLOVA and len(re.sub(r"[^А-Яа-яЁёA-Za-z]", "", slova[0])) <= 3):
                out.append("-".join(p[:1] + p[1:].lower() for p in w.split("-")))
            else:
                out.append(w.lower())
        vnutri = " ".join(out)
    return (opf + " " if opf else "") + "«" + vnutri + "»"


TRANSLIT = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
                    ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t",
                     "u", "f", "h", "c", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"]))


def slug(name):
    s = re.sub(r"^(ООО|АО|ПАО|НАО|ЗАО|ОАО)\s+", "", str(name or ""))
    s = "".join(TRANSLIT.get(ch, ch) for ch in s.lower())
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if len(s) > 60:
        s = s[:60].rsplit("-", 1)[0]
    return s or "kompaniya"


REGION = re.compile(r"(?:^|,\s*)((?:[А-ЯЁ][а-яё\-]+\s+)?(?:обл|область|край|респ|Респ|Республика|АО|автономный округ)\.?(?:\s+[А-ЯЁ][а-яё\-]+(?:\s*[-—]\s*[А-ЯЁ][а-яё]+)?)?)\s*(?:,|$)")
GOROD_FED = re.compile(r"(?:^|,\s*)г\.?\s+(Москва|Санкт-Петербург|Севастополь)\b")
GOROD = re.compile(r"(?:^|,\s*)(?:г|город)\.?\s+([А-ЯЁ][А-Яа-яЁё\-]+(?:\s[А-ЯЁ][а-яё]+)?)")
AVT_OKRUG = re.compile(r"(?:^|,\s*)([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)*\s+[Аа]втономный\s+[Оо]круг(?:\s*[-—]\s*[А-ЯЁ][а-яё]+)?)")
SOKR = {"обл": "область", "респ": "Республика", "Респ": "Республика"}


def region_gorod(adres):
    a = str(adres or "")
    m = GOROD_FED.search(a)
    if m:
        return m.group(1), m.group(1)
    reg = ""
    m = AVT_OKRUG.search(a) or REGION.search(a)
    if m:
        reg = m.group(1).strip()
        reg = re.sub(r"\b(обл|респ|Респ)\b\.?", lambda x: SOKR[x.group(1)], reg)
    g = GOROD.search(a)
    return reg, (g.group(1) if g else "")


OKVED_RAZDELY = [
    (1, 3, "Сельское и лесное хозяйство, рыболовство"), (5, 9, "Добыча полезных ископаемых"),
    (10, 33, "Обрабатывающие производства"), (35, 35, "Энергетика"), (36, 39, "Водоснабжение и отходы"),
    (41, 43, "Строительство"), (45, 47, "Торговля"), (49, 53, "Транспорт и хранение"),
    (55, 56, "Гостиницы и общепит"), (58, 63, "Информация и связь"), (64, 66, "Финансы и страхование"),
    (68, 68, "Операции с недвижимостью"), (69, 75, "Профессиональная и научная деятельность"),
    (77, 82, "Административная деятельность"), (84, 84, "Госуправление"), (85, 85, "Образование"),
    (86, 88, "Здравоохранение и соцуслуги"), (90, 93, "Культура, спорт, досуг"), (94, 96, "Прочие услуги"),
    (97, 98, "Домашние хозяйства"), (99, 99, "Экстерриториальные организации")]


def okved_razdel(okved):
    m = re.match(r"^(\d{2})", str(okved or ""))
    if not m:
        return ""
    k = int(m.group(1))
    for a, b, t in OKVED_RAZDELY:
        if a <= k <= b:
            return t
    return ""


# ---------------------------------------------------------------- из ответа /api/check → карточка
# Сигналы /api/check узнаём по заголовку; код факта нужен для правил выводов (Данные §2, V01–V22).
SIGNALY = [
    ("shtat", re.compile(r"численност|сотрудник|работник", re.I)),
    ("nalogi", re.compile(r"уплач|налоги и взносы", re.I)),
    ("nedoimka", re.compile(r"долг.{0,20}налог|задолженн.{0,20}(налог|бюджет)|недоимк", re.I)),
    ("shtrafy", re.compile(r"правонаруш|штраф", re.I)),
    ("nedostovernost", re.compile(r"недостоверн", re.I)),
    ("diskval", re.compile(r"дисквалиф", re.I)),
    ("otchetnost", re.compile(r"бухгалтерск|отч[её]тност", re.I)),
    ("snr", re.compile(r"спецрежим|упрощ|УСН|ЕСХН|налоговый режим", re.I)),
    ("fssp", re.compile(r"пристав|ФССП|исполнительн", re.I)),
    ("msp", re.compile(r"МСП|малого и среднего", re.I)),
    ("dohod", re.compile(r"доход|выручк", re.I)),
]
KPI = [
    ("dohod", re.compile(r"^Доходы за год|^Выручка", re.I)),
    ("shtat", re.compile(r"^Сотрудники", re.I)),
    ("nalogi", re.compile(r"^Налоги и взносы|^Уплачено налогов", re.I)),
    ("nedoimka", re.compile(r"^Долг перед бюджетом|^Задолженность всего", re.I)),
    ("rezultat", re.compile(r"^Результат за год", re.I)),
]
ISTOCHNIK_PO_KODU = {
    "shtat": "ФНС, открытые данные: среднесписочная численность",
    "nalogi": "ФНС, открытые данные: уплаченные налоги и взносы",
    "nedoimka": "ФНС, открытые данные: задолженность по налогам",
    "shtrafy": "ФНС, открытые данные: налоговые правонарушения",
    "dohod": "ФНС, открытые данные: доходы и расходы",
    "rezultat": "ФНС, открытые данные: доходы и расходы",
    "snr": "ФНС, открытые данные: специальные налоговые режимы",
    "msp": "ФНС, реестр МСП",
    "egrul": "ЕГРЮЛ",
}


GIRBO_KPI = re.compile(r"^Выручка", re.I)
# имя набора в dossier.data_dates → код факта карточки
DATY_NABOROV = [
    ("egrul", re.compile(r"ЕГРЮЛ", re.I)),
    ("nedoimka", re.compile(r"задолженн", re.I)),
    ("dohod", re.compile(r"доходы и расходы", re.I)),
    ("rezultat", re.compile(r"доходы и расходы", re.I)),
    ("shtat", re.compile(r"численност", re.I)),
    ("shtrafy", re.compile(r"штраф", re.I)),
    ("fssp", re.compile(r"ФССП|пристав", re.I)),
    # daty-v2: API (daty-api-v1, коммит 3) отдаёт дату набора ФНС «уплаченные налоги» — без неё V23 не выходил
    ("nalogi", re.compile(r"уплаченн\w* налог", re.I)),
]


def daty_naborov(s):
    """'ЕГРЮЛ/ЕГРИП — на 21.09.2026; задолженность — на 01.09.2026' → {'egrul': date, 'nedoimka': date}.
    Неразобранное и битые даты пропускаем: нет даты — факт остаётся «не проверяли»."""
    out = {}
    for kusok in str(s or "").split(";"):
        m = re.search(r"^\s*(.+?)\s+—\s+на\s+(\d{2}\.\d{2}\.\d{4})\s*$", kusok)
        if not m:
            continue
        d = data_iz(m.group(2))
        if not d:
            continue
        for kod, rx in DATY_NABOROV:
            if rx.search(m.group(1)) and kod not in out:
                out[kod] = d
    return out


def _god(s):
    m = re.search(r"\b(20\d\d)\b", str(s or ""))
    return int(m.group(1)) if m else None


def _pervoe_chislo(s):
    m = re.search(r"(-?\d[\d\s ]*(?:[.,]\d+)?)\s*(млрд|млн|тыс)?", str(s or ""))
    if not m:
        return None
    v = float(re.sub(r"[\s ]", "", m.group(1)).replace(",", "."))
    return v * {"млрд": 1e9, "млн": 1e6, "тыс": 1e3}.get(m.group(2) or "", 1)


def _rukovodit_s(D):
    """Досье, раздел «Руководство»: строка «Руководит с» → «12.04.2007 (19 лет 5 месяцев)» → дата."""
    for sec in D.get("sections") or []:
        for row in sec.get("rows") or []:
            if isinstance(row, (list, tuple)) and len(row) >= 2 and re.match(r"^\s*Руководит с", str(row[0])):
                m = re.search(r"\d{2}\.\d{2}\.\d{4}", str(row[1]))
                return data_iz(m.group(0)) if m else None
    return None


def iz_check(r):
    """Ответ /api/check (или запись выгрузки в том же формате) → словарь карточки. Ничего не выдумываем:
    факт без даты сведений получает статус ne_provereno и в ворота не идёт."""
    c = r.get("company") or {}
    inn = re.sub(r"\D", "", str(c.get("inn") or r.get("inn") or ""))
    proverka = data_iz(r.get("checked_at")) or data_iz((r.get("daty") or {}).get("pereschet"))
    k = {
        "inn": inn, "ogrn": str(c.get("ogrn") or ""), "kpp": str(c.get("kpp") or ""),
        "kind": c.get("kind") or ("LEGAL" if len(inn) == 10 else "INDIVIDUAL"),
        "status": c.get("status") or "", "name": imya(c.get("name_short"), c.get("name_full")),
        "name_full": imya(c.get("name_full")) if c.get("name_full") else "",
        "reg_date": data_iz(c.get("reg_date")), "address": c.get("address") or "",
        "okved": str(c.get("okved") or ""), "okved_name": c.get("okved_name") or "",
        "direktor": {"post": c.get("director_post") or "", "fio": c.get("director_name") or ""},
        "uchrediteli": c.get("founders") or r.get("uchrediteli") or [],
        "egrul_data": data_iz(r.get("egrul_data")) or proverka,
        "proverka": proverka,
        "fakty": {}, "finansy": [], "ne_provereno": [],
        "gruppa": r.get("gruppa") or "",
    }
    reg, gor = region_gorod(k["address"])
    k["region"] = r.get("region") or c.get("region") or reg
    k["gorod"] = r.get("gorod") or c.get("city") or gor
    # сигналы: источник и дата — от сервера
    for s in r.get("signals") or []:
        t = str(s.get("title") or "")
        # kartochki-v2: живой API шлёт сигнал «Адрес» с деталью «Отметок о недостоверности нет» — признак в детали,
        # не в заголовке; без этого V16 не выходил ни у одной компании. По детали ищем только недостоверность.
        po_detali = not any(rx.search(t) for _, rx in SIGNALY) and SIGNALY[4][1].search(str(s.get("detail") or ""))
        if po_detali:
            t = "Отметки о недостоверности"
        for kod, rx in SIGNALY:
            if rx.search(t):
                # недостоверность: отметка хоть по одному сигналу (адрес, руководитель, учредитель) главнее «нет отметок»
                if kod in k["fakty"] and not (kod == "nedostovernost" and s.get("status") in ("warn", "bad")
                                              and k["fakty"][kod].get("ton") not in ("warn", "bad")):
                    break
                k["fakty"][kod] = {
                    "kod": kod, "zagolovok": t, "detal": str(s.get("detail") or ""), "ton": s.get("status") or "info",
                    "istochnik": s.get("source") or ISTOCHNIK_PO_KODU.get(kod, ""), "data": data_iz(s.get("as_of")),
                    "znachenie": _pervoe_chislo(s.get("detail")), "god": _god(s.get("detail")),
                    # строка светофора как есть — для «Комментария команды» (заголовок до замены по детали)
                    "signal": {"title": str(s.get("title") or ""), "detail": str(s.get("detail") or ""), "status": s.get("status") or ""},
                }
                # сведения ЕГРЮЛ без as_of — получены в день проверки (как egrul_data, daty-v1)
                if po_detali and not k["fakty"][kod]["data"] and re.match(r"ЕГРЮЛ", k["fakty"][kod]["istochnik"]):
                    k["fakty"][kod]["data"] = k["egrul_data"]
                break
    # числа из досье (kpi) — дополняют сигналы; дата — у одноимённого сигнала или общая дата наборов ФНС
    D = r.get("dossier") or {}
    fns_data = data_iz(r.get("fns_data")) or data_iz(((r.get("daty") or {}).get("dannye") or {}).get("ФНС")
                                                     if isinstance((r.get("daty") or {}).get("dannye"), dict) else None)
    # daty-v1: даты наборов из досье («ЕГРЮЛ/ЕГРИП — на 21.09.2026; задолженность — на 01.09.2026; …») — сервер их
    # уже отдаёт строкой; без них факт ФНС оставался «без даты» и не шёл в выводы (пилот 02.10: 9 из 17 — «выводов 2 из 3»).
    # «ЕГРЮЛ/ЕГРИП — на …» в досье — state.actuality_date DaData, то есть дата последних изменений записи, а не дата
    # сведений: для ЕГРЮЛ остаётся дата проверки (сведения получены в этот день).
    dd = daty_naborov(D.get("data_dates"))
    for x in D.get("kpi") or []:
        lab = str(x.get("label") or "")
        for kod, rx in KPI:
            if rx.search(lab):
                v = chislo(x.get("value"))
                girbo = kod == "dohod" and GIRBO_KPI.search(lab)
                god = _god(lab) or _god(x.get("text"))
                # «Выручка за 2025» — строка 2110 бухотчётности из ГИР БО, не набор «доходы и расходы»:
                # источник — ГИР БО, дата сведений — конец отчётного года (как state_date у наборов ФНС).
                ist = "ГИР БО, бухгалтерская отчётность" if girbo else ISTOCHNIK_PO_KODU.get(kod, "")
                data0 = (dt.date(god, 12, 31) if girbo and god else None) or fns_data or dd.get(kod)
                f = k["fakty"].get(kod) or {"kod": kod, "zagolovok": lab, "detal": x.get("text") or "", "ton": "info",
                                             "istochnik": ist, "data": data0,
                                             "znachenie": None, "god": god}
                if v is not None:
                    f["znachenie"] = v
                if x.get("delta") is not None:
                    f["delta"] = chislo(x.get("delta"))
                k["fakty"][kod] = f
                break
    # сигнал без as_of (например, «Численность» у старых ответов) — дата того же набора из досье
    for kod, f in k["fakty"].items():
        if not f.get("data") and dd.get(kod) and not GIRBO_KPI.search(str(f.get("zagolovok") or "")):
            f["data"] = dd[kod]
    # daty-v2: «Налоги и взносы за год» — без года в подписи; набор ФНС «уплаченные налоги» датирован 31.12 года уплаты
    t = k["fakty"].get("nalogi")
    if t and not t.get("god") and dd.get("nalogi") and (dd["nalogi"].month, dd["nalogi"].day) == (12, 31):
        t["god"] = dd["nalogi"].year
    # финансы по годам: досье (бухотчётность) или явное поле выгрузки
    ch = D.get("charts") or {}
    for p in (r.get("finansy") or ch.get("revenue") or []):
        g, v = p.get("year") or p.get("god"), chislo(p.get("value") if "value" in p else p.get("dohod"))
        if g and v is not None:
            k["finansy"].append({"god": int(g), "dohod": v})
    k["finansy"].sort(key=lambda x: x["god"])
    k["finansy_istochnik"] = r.get("finansy_istochnik") or ("ГИР БО, бухгалтерская отчётность" if ch.get("revenue") else "")
    # kartochki-v2: в kpi нет «Выручка за …», а ряд по годам из ГИР БО в досье есть (charts.revenue) — тот же факт,
    # строка 2110 последнего года; дата сведений — 31.12 этого года, изменение — к предыдущему году ряда.
    d0 = k["fakty"].get("dohod") or {}
    if not (d0.get("data") and (d0.get("znachenie") or 0) > 0) and k["finansy"] and k["finansy_istochnik"].startswith("ГИР БО"):
        p1 = k["finansy"][-1]
        if p1["dohod"] > 0:
            f = {"kod": "dohod", "zagolovok": "Выручка за %d" % p1["god"], "detal": "", "ton": "info",
                 "istochnik": "ГИР БО, бухгалтерская отчётность", "data": dt.date(p1["god"], 12, 31),
                 "znachenie": p1["dohod"], "god": p1["god"]}
            p0 = k["finansy"][-2] if len(k["finansy"]) > 1 else None
            if p0 and p0["god"] == p1["god"] - 1 and p0["dohod"] > 0:
                f["delta"] = (p1["dohod"] / p0["dohod"] - 1) * 100
            k["fakty"]["dohod"] = f
    # pribyl-kapital-v1 (Ночные-2, 03.10): прибыль и собственный капитал из ГИР БО уже есть в ответе (charts.profit,
    # charts.balance.equity — строки 2400 и 1300), но выводами не становились. Берём только год выручки на карточке:
    # другой год рядом с выручкой читался бы как один отчёт. Ряд пустой, значение не число — факта нет.
    gv = (k["fakty"].get("dohod") or {}).get("god") if str((k["fakty"].get("dohod") or {}).get("istochnik") or "").startswith("ГИР БО") else None
    if gv:
        pr = None
        for p in ch.get("profit") or []:
            if isinstance(p, dict) and str(p.get("year")) == str(gv):
                pr = chislo(p.get("value"))
        if pr is None:
            for x in D.get("kpi") or []:
                if str(x.get("label") or "") == "Чистая прибыль за %d" % gv:
                    pr = chislo(x.get("value"))
        if pr is not None:
            k["fakty"]["pribyl"] = {"kod": "pribyl", "god": gv, "znachenie": pr, "data": dt.date(gv, 12, 31),
                                    "istochnik": "ГИР БО, бухгалтерская отчётность"}
        b = ch.get("balance")
        if isinstance(b, dict) and str(b.get("year")) == str(gv) and not isinstance(b.get("equity"), bool):
            kp = chislo(b.get("equity"))
            if kp is not None:
                k["fakty"]["kapital"] = {"kod": "kapital", "god": gv, "znachenie": kp, "data": dt.date(gv, 12, 31),
                                         "istochnik": "ГИР БО, бухгалтерская отчётность"}
    # kartochki-v2: с какой даты руководитель тот же (ЕГРЮЛ) — только дата, без ФИО (люди — при PERSONS_PUBLIC)
    k["rukovodit_s"] = data_iz(c.get("director_date")) or _rukovodit_s(D)
    if k["rukovodit_s"] and ((k["reg_date"] and k["rukovodit_s"] < k["reg_date"]) or (proverka and k["rukovodit_s"] > proverka)):
        k["rukovodit_s"] = None
    k["finansy_data"] = data_iz(r.get("finansy_data")) or data_iz(r.get("girbo_data"))
    # полнота и Индекс — как в js/indeks-vorota.js
    ind = r.get("indeks")
    obj = ind if isinstance(ind, dict) else None
    k["indeks"] = chislo(obj.get("ball", obj.get("znachenie")) if obj else ind)
    pol = chislo(obj.get("polnota") if obj and obj.get("polnota") is not None else r.get("polnota"))
    k["polnota"] = None if pol is None else max(0, min(100, round(pol)))
    k["indeks_status"] = str((obj or {}).get("status") or r.get("indeks_status") or "")
    # что не проверяли — от сервера (полнота по источникам), без выдумки
    for x in (r.get("istochniki") or (r.get("polnota_istochniki") or [])):
        if str(x.get("status") or "") in ("ne_provereno", "not_checked", "error", "off"):
            k["ne_provereno"].append({"nazvanie": x.get("title") or x.get("nazvanie") or x.get("source") or "",
                                      "prichina": x.get("prichina") or x.get("note") or ""})
    return k


def indeks_vid(k):
    """Те же ворота, что js/indeks-vorota.js: число только при 1…99 целом, полноте ≥ 60 и статусе не «schitaem»."""
    b, p = k.get("indeks"), k.get("polnota")
    if k.get("kind") != "LEGAL":
        return {"rezhim": "ip"}
    if b is not None and 1 <= b <= 99 and round(b) == b and p is not None and p >= POROG_INDEKSA and k.get("indeks_status") != "schitaem":
        # уровни — как indeks/metodika-v1.json ([Право] 02.10 12:30 разд. 4; 222-ФЗ: без «надёжн», «Высокий риск» — только о ЗСК)
        z = "Без серьёзных сигналов" if b >= 70 else "Есть вопросы" if b >= 50 else "Есть серьёзные сигналы" if b >= 30 else "Много признаков риска"
        return {"rezhim": "chislo", "ball": int(b), "polnota": p, "zona": z}
    return {"rezhim": "schitaem", "polnota": p}


# ---------------------------------------------------------------- выводы человеческим языком (Данные §2)
def _v(kod, ton, tekst, istochnik, data, s_chislom=True, status="podtverzhdeno"):
    return {"kod": kod, "ton": ton, "tekst": tekst, "istochnik": istochnik, "data": data, "s_chislom": s_chislom, "status": status}


def vozrast_mes(k, na):
    r = k.get("reg_date")
    if not r or not na or r > na:
        return None
    return (na.year - r.year) * 12 + (na.month - r.month) - (1 if na.day < r.day else 0)


def msp_kategoriya(t):
    """'Малое предприятие (с 10.08.2016)' → 'малое предприятие'; без слова «предприятие» — '' (категорию не угадываем)."""
    t = str(t or "")
    if re.search(r"не\s+(входит|состоит|являет)|исключен", t, re.I):
        return ""
    if re.search(r"микропредприят", t, re.I):
        return "микропредприятие"
    if re.search(r"(^|[^а-яё])мал\w*\s+предприят", t, re.I):
        return "малое предприятие"
    if re.search(r"(^|[^а-яё])средн\w*\s+предприят", t, re.I):
        return "среднее предприятие"
    return ""


def vyvody(k):
    out = []
    F = k["fakty"]
    na = k.get("proverka")
    mes = vozrast_mes(k, na)
    if mes is not None and k.get("egrul_data"):
        let = mes // 12
        if let >= 10:
            out.append(_v("V01", "ok", "Работает %d%s%s — с%s%d года" % (let, NB, plural(let, "год", "года", "лет"), NB, k["reg_date"].year), "ЕГРЮЛ", k["egrul_data"]))
        elif let >= 3:
            out.append(_v("V01a", "info", "Работает %d%s%s — с%s%d года" % (let, NB, plural(let, "год", "года", "лет"), NB, k["reg_date"].year), "ЕГРЮЛ", k["egrul_data"]))
        elif let >= 1:
            out.append(_v("V02", "warn", "Молодая компания: %d%s%s. Ограничьте предоплату, пока нет истории" % (let, NB, plural(let, "год", "года", "лет")), "ЕГРЮЛ", k["egrul_data"]))
    d = F.get("dohod")
    if d and d.get("znachenie") and d["znachenie"] > 0 and d.get("data"):
        g = d.get("god") or (k["finansy"][-1]["god"] if k["finansy"] else None)
        za = (" за%s%d" % (NB, g)) if g else " за год"
        dl = d.get("delta")
        sl = "Выручка" if str(d.get("istochnik") or "").startswith("ГИР БО") else "Доход"
        if dl is not None and dl >= 10:
            out.append(_v("V03", "ok", "%s%s — %s, на%s%d%s%% больше, чем годом раньше" % (sl, za, dengi(d["znachenie"]), NB, round(dl), NB), d["istochnik"], d["data"]))
        elif dl is not None and dl <= -30:
            out.append(_v("V04", "warn", "%s%s — %s, на%s%d%s%% меньше, чем годом раньше" % (sl, za, dengi(d["znachenie"]), NB, round(-dl), NB), d["istochnik"], d["data"]))
        elif d["znachenie"] > 0:
            out.append(_v("V03a", "info", "%s%s — %s" % (sl, za, dengi(d["znachenie"])), d["istochnik"], d["data"]))
    # pribyl-kapital-v1: V25 — капитал меньше нуля (та же фраза, что на экране проверки, kapital-v1); плюс — строки нет.
    # V24 — чистая прибыль / убыток того же года. Порядок важен для предела «2 из одного источника»: капитал главнее убытка.
    kp = F.get("kapital")
    if kp and kp.get("znachenie") is not None and kp["znachenie"] < 0:
        out.append(_v("V25", "warn", "Собственный капитал на%s31.12.%d — минус %s: обязательства больше активов" % (
            NB, kp["god"], dengi(-kp["znachenie"])), kp["istochnik"], kp["data"]))
    pb = F.get("pribyl")
    if pb and pb.get("znachenie"):
        if pb["znachenie"] > 0:
            out.append(_v("V24", "ok", "Чистая прибыль за%s%d — %s" % (NB, pb["god"], dengi(pb["znachenie"])), pb["istochnik"], pb["data"]))
        else:
            out.append(_v("V24a", "warn", "Убыток за%s%d — %s" % (NB, pb["god"], dengi(-pb["znachenie"])), pb["istochnik"], pb["data"]))
    s = F.get("shtat")
    if s and s.get("znachenie") is not None and s.get("data"):
        n = int(s["znachenie"])
        g = s.get("god")
        za = (" (%d)" % g) if g else ""
        if n >= 5:
            out.append(_v("V06", "ok", "В штате %d%s%s%s" % (n, NB, plural(n, "человек", "человека", "человек"), za), s["istochnik"], s["data"]))
        elif n >= 2:
            out.append(_v("V06a", "info", "В штате %d%s%s%s" % (n, NB, plural(n, "человек", "человека", "человек"), za), s["istochnik"], s["data"]))
        # V07 (0–1 человек при доходе ≥ 10 млн) — только после [Юриста 115-ФЗ]; на публичной карточке не выводим.
    t = F.get("nalogi")
    if t and t.get("znachenie") and t["znachenie"] > 0 and t.get("data"):
        g = t.get("god")
        out.append(_v("V23", "ok", "Уплатила налогов и взносов — %s%s" % (dengi(t["znachenie"]), (" за%s%d" % (NB, g)) if g else ""), t["istochnik"], t["data"]))
    n = F.get("nedoimka")
    if n and n.get("data"):
        v = n.get("znachenie")
        if v and v > 0:
            out.append(_v("V10", "warn", "Задолженность перед бюджетом — %s на%s%s. Могла быть погашена после этой даты" % (dengi(v), NB, data_tekst(n["data"])), n["istochnik"], n["data"]))
        elif n.get("ton") == "ok":
            out.append(_v("V09", "ok", "Налоговой задолженности в данных ФНС нет (на%s%s)" % (NB, data_tekst(n["data"])), n["istochnik"], n["data"], s_chislom=False))
    sh = F.get("shtrafy")
    if sh and sh.get("data") and sh.get("ton") in ("warn", "bad") and sh.get("znachenie"):
        # shtrafy-v1 (03.10, по сверке [Ночных запусков] 00:05, приказ ФНС ММВ-7-14/729@ п. 4): в наборе — только штрафы,
        # НЕ уплаченные к 1 октября; уплачен ли он позже — набор не знает. Не «Не уплачен …» в настоящем времени (ст. 152 ГК).
        out.append(_v("V15", "warn", "Налоговый штраф не был уплачен в срок — %s (данные ФНС на%s%s). Мог быть уплачен после этой даты" % (
            dengi(sh["znachenie"]), NB, data_tekst(sh["data"])), sh["istochnik"], sh["data"]))
    nd = F.get("nedostovernost")
    if nd and nd.get("ton") == "ok" and k.get("egrul_data"):
        out.append(_v("V16", "ok", "Адрес и руководитель в реестре — без отметок о недостоверности", nd["istochnik"] or "ЕГРЮЛ", nd.get("data") or k["egrul_data"], s_chislom=False))
    fs = F.get("fssp")
    if fs and fs.get("data") and na and (na - fs["data"]).days <= 7:
        if fs.get("ton") == "ok":
            out.append(_v("V11", "ok", "Долгов у приставов не нашли (на%s%s)" % (NB, data_tekst(fs["data"])), fs["istochnik"], fs["data"], s_chislom=False))
        elif fs.get("znachenie"):
            out.append(_v("V12", "warn", "У приставов есть производства на %s (на%s%s)" % (dengi(fs["znachenie"]), NB, data_tekst(fs["data"])), fs["istochnik"], fs["data"]))
    sn = F.get("snr")
    if sn and sn.get("data") and re.search(r"УСН|упрощ", sn.get("detal", "") + sn.get("zagolovok", ""), re.I):
        out.append(_v("V13", "info", "Применяет упрощённую систему налогообложения", sn["istochnik"], sn["data"], s_chislom=False))
    # V21 (каталог Данных 26.09): «В реестре МСП: {малое} предприятие» — ⚪, без числа. Только категория, прямо названная
    # в строке реестра МСП («Микропредприятие / Малое / Среднее предприятие»), и только с датой сведений: заголовок вида
    # «субъект малого и среднего предпринимательства» категорию не называет — вывода нет (ничего не додумываем).
    ms = F.get("msp")
    if ms and ms.get("data") and ms.get("ton") not in ("warn", "bad"):
        kat = msp_kategoriya(ms.get("detal"))
        if kat:
            out.append(_v("V21", "info", "В реестре МСП: %s" % kat, ms["istochnik"] or ISTOCHNIK_PO_KODU["msp"], ms["data"], s_chislom=False))
    # V18 / V19 — после V16: при пределе «2 из одного источника» отметка о недостоверности главнее стажа руководителя
    # V18 / V19 (каталог Данных 26.09): смена руководителя ≤ 6 мес. — 🟡; один руководитель ≥ 3 лет — 🟢. ЕГРЮЛ, без ФИО.
    rs = vozrast_mes({"reg_date": k.get("rukovodit_s")}, na) if k.get("rukovodit_s") and k.get("egrul_data") else None
    if rs is not None and mes is not None and mes >= 12:
        if rs <= 6:
            out.append(_v("V18", "warn", "Руководитель сменился %s" % ("в этом месяце" if rs < 1 else "%d%s%s назад" % (rs, NB, plural(rs, "месяц", "месяца", "месяцев"))), "ЕГРЮЛ", k["egrul_data"]))
        elif rs >= 36:
            let = rs // 12
            out.append(_v("V19", "ok", "Руководитель тот же %d%s%s — с%s%d года" % (let, NB, plural(let, "год", "года", "лет"), NB, k["rukovodit_s"].year), "ЕГРЮЛ", k["egrul_data"]))
    # порядок: 🟡 → 🟢 → ⚪; не больше 2 из одного источника; не больше 6
    por = {"warn": 0, "ok": 1, "info": 2}
    out.sort(key=lambda x: por.get(x["ton"], 3))
    itog, schet = [], {}
    for x in out:
        if schet.get(x["istochnik"], 0) >= 2:
            continue
        schet[x["istochnik"]] = schet.get(x["istochnik"], 0) + 1
        itog.append(x)
    for x in itog:
        assert not STOP_SLOVA.search(x["tekst"]), x["tekst"]
    return itog[:6]


# ---------------------------------------------------------------- ворота
def vorota(k, V=None):
    """(годится, причина). Годится = карточка создаётся и идёт в sitemap."""
    V = vyvody(k) if V is None else V
    if not inn_ok(k["inn"]) or k.get("kind") != "LEGAL":
        return False, "не юрлицо или неверный ИНН"
    if k.get("status") != "ACTIVE":
        return False, "статус не «действующая»"
    if not KOMMERCHESKIE.match(k.get("name") or ""):
        return False, "не ООО/АО (НКО, учреждения — вне волны)"
    mes = vozrast_mes(k, k.get("proverka"))
    if mes is None or mes < 12:
        return False, "моложе 12 месяцев или нет даты регистрации"
    nd = k["fakty"].get("nedostovernost")
    if nd and nd.get("ton") in ("warn", "bad"):
        return False, "отметка о недостоверности — ждёт формулировки Юриста (V17)"
    d = k["fakty"].get("dohod") or {}
    dohod_ok = bool(d.get("data") and (d.get("znachenie") or 0) > 0) or bool(k["finansy"] and k["finansy"][-1]["dohod"] > 0)
    if not dohod_ok:
        return False, "нет финансов (доход > 0 по ФНС / ГИР БО)"
    if len(V) < 3:
        return False, "выводов %d из 3" % len(V)
    if sum(1 for x in V if x["s_chislom"]) < 2:
        return False, "выводов с числом меньше 2"
    ist = {x["istochnik"] for x in V if x.get("data")}
    if len(ist) < 2:
        return False, "меньше 2 первоисточников с датой"
    return True, "ок"


def gruppa(k):
    """«со спросом» / «контроль» (Ночные 27.09 14:05, разд. 2). Явная отметка из выгрузки — главнее."""
    if k.get("gruppa") in ("spros", "kontrol"):
        return k["gruppa"]
    d = (k["fakty"].get("dohod") or {}).get("znachenie") or 0
    s = (k["fakty"].get("shtat") or {}).get("znachenie") or 0
    mes = vozrast_mes(k, k.get("proverka")) or 0
    return "spros" if (d >= 10e6 or s >= 5 or (mes >= 36 and d > 0)) else "kontrol"


def adres_str(k):
    return "/%s/%s-%s/" % (PAPKA, k["inn"], slug(k["name"]))


def lastmod(k, V):
    daty = [x["data"] for x in V if x.get("data")]
    if k.get("finansy_data"):
        daty.append(k["finansy_data"])
    return max(daty) if daty else k.get("proverka")


# ---------------------------------------------------------------- title и description (Маркетинг §2.2)
def _ukorotit_imya(nm, dlina):
    if len(nm) <= dlina:
        return nm
    m = re.match(r"^(.*?«)(.*)»$", nm)
    if not m:
        return nm[:dlina].rsplit(" ", 1)[0]
    golova, telo = m.group(1), m.group(2)
    ost = max(3, dlina - len(golova) - 2)
    t = telo[:ost]
    if " " in t and len(telo) > ost:
        t = t.rsplit(" ", 1)[0]
    return golova + t.rstrip(" ,-") + "…»"


def title(k):
    nm = k["name"]
    iv = indeks_vid(k)
    hvost = [": Индекс %d, проверка и риски — Делоскоп" % iv["ball"], ": Индекс %d — Делоскоп" % iv["ball"]] if iv["rezhim"] == "chislo" \
        else [": проверка и риски — Делоскоп", ": проверка — Делоскоп"]
    for h in hvost:
        t = "%s, ИНН %s%s" % (nm, k["inn"], h)
        if len(t) <= 70:
            return t
    h = hvost[-1]
    return "%s, ИНН %s%s" % (_ukorotit_imya(nm, 70 - len(", ИНН %s%s" % (k["inn"], h))), k["inn"], h)


def description(k, V):
    chasti = []
    mesto = k.get("gorod") or k.get("region")
    if k.get("reg_date"):
        chasti.append("%s%s: с %d года" % (k["name"], (" (%s)" % mesto) if mesto else "", k["reg_date"].year))
    else:
        chasti.append(k["name"])
    d = k["fakty"].get("dohod")
    if d and d.get("znachenie"):
        chasti.append("доход %s" % dengi(d["znachenie"]))
    s = k["fakty"].get("shtat")
    if s and s.get("znachenie") and s["znachenie"] >= 2:
        n = int(s["znachenie"])
        chasti.append("в штате %d%s%s" % (n, NB, plural(n, "человек", "человека", "человек")))
    hvost = ". Налоги, долги и реестры ФНС с датой сведений."
    t = ", ".join(chasti) + hvost
    while len(t) > 160 and len(chasti) > 1:
        chasti.pop()
        t = ", ".join(chasti) + hvost
    if len(t) > 160:
        t = t[:157].rsplit(" ", 1)[0] + "…"
    return t


# ---------------------------------------------------------------- HTML
ZNAK = {"ok": ("ok", "хорошо"), "warn": ("warn", "обратите внимание"), "info": ("info", "справочно")}
# karta-v1.1: знаки как в Паспорте контрагента (п. 145 б): ● подтверждено источником · ◆ рассчитано Делоскопом · ○ не проверяли
STATUS_METKA = {"podtverzhdeno": "● подтверждено источником", "rasschitano": "◆ рассчитано Делоскопом", "ne_provereno": "○ не проверяли"}


# karta-v2 (Ф7, глубина 30.09 02:05/04:05): поле DaData management.disqualified не заполняется, поэтому
# «дисквалификации нет» из пустого поля — не проверка. «● подтверждено» у строки — только если:
#  (а) источник назвал отметку (статус bad/warn — это найденный факт с источником), или
#  (б) сведения из реестра дисквалифицированных лиц ФНС (nalog.gov.ru/opendata/7707329152-registerdisqualified) с датой.
# karta-v2 (Ф6): что карточка НЕ обещает в «Полном отчёте» и «Паспорте», пока источник не подключён
# (суды и приставы — «не проверяли», решение 29.09 23:15; связи — findAffiliated ждёт API). Подключили — убрать слово отсюда.
NE_OBESHCHAEM = re.compile(r"суд|пристав|ФССП|связ|аффилир|банкрот|арбитраж|залог|блокиров", re.I)
DISKVAL_ISTOCHNIK = "Реестр дисквалифицированных лиц ФНС"
DISKVAL_REESTR = re.compile(r"реестр\S*\s+дисквалифицир", re.I)


def diskval_proveren(f):
    if not f.get("data"):
        return False
    if str(f.get("ton") or "") in ("bad", "warn"):
        return True
    return bool(DISKVAL_REESTR.search(str(f.get("istochnik") or "")))


def _istochnik_stroka(ist, data, status="podtverzhdeno", podklyuchaem=False):
    if podklyuchaem:  # источник ещё не подключён — даты сведений нет и быть не может
        return '<span class="co-src">%s · %s</span>' % (e(ist), STATUS_METKA["ne_provereno"])
    return '<span class="co-src">%s · %s · %s</span>' % (
        e(ist), ("сведения на " + data_korotko(data)) if data else "дата сведений не указана",
        STATUS_METKA.get(status, status))


def svg_stolbcy(fin):
    """Столбцы выручки — рисует сервер, без JS. Под ними таблица с теми же числами."""
    if len(fin) < 2:
        return ""
    mx = max(x["dohod"] for x in fin) or 1
    w, h, gap = 64, 140, 20
    shir = len(fin) * (w + gap) - gap
    bars = []
    for i, x in enumerate(fin):
        bh = max(2, round(h * max(0, x["dohod"]) / mx))
        xx = i * (w + gap)
        bars.append('<rect x="%d" y="%d" width="%d" height="%d" rx="6" class="co-bar%s"/>'
                    '<text x="%d" y="%d" class="co-bar-t">%d</text>' % (
                        xx, h - bh, w, bh, " co-bar--last" if i == len(fin) - 1 else "", xx + w // 2, h + 18, x["god"]))
    return ('<svg class="co-chart" viewBox="0 0 %d %d" role="img" aria-label="Доход по годам: %s">%s</svg>' % (
        shir, h + 24, e("; ".join("%d — %s" % (x["god"], dengi(x["dohod"])) for x in fin)), "".join(bars)))


def pohozhie(k, vse):
    """До 6 соседей: тот же регион и класс ОКВЭД → регион и раздел → класс по России → регион (Маркетинг §2.5)."""
    moi_d = (k["fakty"].get("dohod") or {}).get("znachenie") or 0
    ok4, ok2 = k["okved"][:5], k["okved"][:2]
    ur = [lambda x: x["region"] == k["region"] and x["okved"][:5] == ok4 and ok4,
          lambda x: x["region"] == k["region"] and x["okved"][:2] == ok2 and ok2,
          lambda x: x["okved"][:5] == ok4 and ok4,
          lambda x: x["region"] == k["region"] and k["region"]]
    out = []
    for f in ur:
        kand = [x for x in vse if x["inn"] != k["inn"] and x not in out and f(x)]
        kand.sort(key=lambda x: (abs(math.log1p(max(0, (x["fakty"].get("dohod") or {}).get("znachenie") or 0)) - math.log1p(max(0, moi_d))), x["inn"]))
        out.extend(kand[:6 - len(out)])
        if len(out) >= 6:
            break
    return out


def html_kartochki(k, V, sosedi, kom=None):
    """kom — библиотека data/kommentarii.json (сайт читает файл сам, API передаёт её же); None — без комментариев."""
    nm = k["name"]
    iv = indeks_vid(k)
    url = SAJT + adres_str(k)
    razdel = okved_razdel(k["okved"])
    mes = vozrast_mes(k, k["proverka"]) or 0
    let = mes // 12
    vozr = ("%d%s%s" % (let, NB, plural(let, "год", "года", "лет"))) if let else ("%d%s%s" % (mes, NB, plural(mes, "месяц", "месяца", "месяцев")))
    mesto = k.get("gorod") or k.get("region")
    # JSON-LD: без aggregateRating, без людей (PERSONS_PUBLIC выкл.)
    org = {"@type": "Organization", "name": nm, "legalName": k.get("name_full") or nm, "taxID": k["inn"]}
    if k.get("ogrn"):
        org["identifier"] = {"@type": "PropertyValue", "propertyID": "ОГРН", "value": k["ogrn"]}
    if k.get("reg_date"):
        org["foundingDate"] = k["reg_date"].isoformat()
    if k.get("region") or k.get("gorod"):
        org["address"] = {"@type": "PostalAddress", "addressCountry": "RU"}
        if k.get("region"):
            org["address"]["addressRegion"] = k["region"]
        if k.get("gorod"):
            org["address"]["addressLocality"] = k["gorod"]
    kroshki = [("Делоскоп", SAJT + "/"), ("Компании", SAJT + "/%s/" % PAPKA)]
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(kroshki + [(nm, url)])]},
        org]}
    # Индекс
    if iv["rezhim"] == "chislo":
        ind = ('<section class="co-ind" aria-label="Индекс Делоскопа"><p class="co-ind__n num">%d<small> из%s99</small></p>'
               '<div><p class="co-ind__z">Индекс Делоскопа · %s</p><p class="caption">Собрано %d%s%% данных · '
               '<a href="/indeks/">как считаем</a></p></div></section>' % (iv["ball"], NB, e(iv["zona"]), iv["polnota"], NB))
    else:
        pol = iv.get("polnota")
        t = ("Для этой компании собрано %d%s%% данных, для балла нужно %d%s%%." % (pol, NB, POROG_INDEKSA, NB)) if pol is not None \
            else "Собираем данные из источников; балл покажем, когда их будет не меньше %d%s%%." % (POROG_INDEKSA, NB)
        bar = ('<div class="co-bar-pol" role="img" aria-label="Собрано %d%% данных, для балла нужно %d%%"><i style="width:%d%%"></i><b style="left:%d%%"></b></div>'
               % (pol, POROG_INDEKSA, pol, POROG_INDEKSA)) if pol is not None else ""
        ind = ('<section class="co-ind co-ind--wait" aria-label="Индекс Делоскопа"><p class="co-ind__n">Индекс%s— считаем</p>'
               '<div><p class="caption">%s Пока смотрите выводы по фактам ниже. <a href="/indeks/">Как считаем</a></p>%s</div></section>'
               % (NB, e(t), bar))
    # выводы
    vv = "".join('<li class="co-v co-v--%s"><span class="co-v__z" aria-label="%s"></span><div><p>%s</p>%s</div></li>' % (
        ZNAK[x["ton"]][0], ZNAK[x["ton"]][1], e(x["tekst"]).replace("&nbsp;", NB), _istochnik_stroka(x["istochnik"], x["data"], x["status"]))
        for x in V)
    # перед оплатой — по признакам компании
    sovety = []
    if any(x["ton"] == "warn" for x in V):
        sovety.append('Спросите компанию о пунктах «обратите внимание» выше — до оплаты, письменно.')
    if mes < 36:
        sovety.append('Компании меньше трёх лет — договоритесь об оплате частями или по факту поставки. '
                      '<a href="/nalogi/skolko-platit-vpered-neznakomoj-kompanii/">Сколько можно платить вперёд</a>')
    sovety.append('Сверьте реквизиты в счёте с этой компанией: ИНН, название, банк. <a href="/proverit-schet/">Проверить счёт</a>')
    sovety.append('Перед договором проверьте полномочия подписанта и сохраните копии документов. '
                  '<a href="/nalogi/proverka-kontragenta-pered-dogovorom/">Что запросить у контрагента</a>')
    pered = "".join("<li>%s</li>" % s for s in sovety[:3])
    # реестры
    stroki = []
    for kod in ("nedoimka", "shtrafy", "shtat", "nalogi", "dohod", "otchetnost", "snr", "nedostovernost", "diskval", "fssp", "msp"):
        f = k["fakty"].get(kod)
        if not f:
            continue
        st = "podtverzhdeno" if f.get("data") else "ne_provereno"
        znach = f.get("detal") or ""
        if kod in ("dohod", "nalogi", "nedoimka") and f.get("znachenie"):
            znach = dengi(f["znachenie"]) + ((" за%s%d" % (NB, f["god"])) if f.get("god") else "")
        elif kod == "shtat" and f.get("znachenie") is not None:
            n = int(f["znachenie"])
            znach = "%d%s%s" % (n, NB, plural(n, "человек", "человека", "человек")) + ((" за%s%d" % (NB, f["god"])) if f.get("god") else "")
        ist, dat, zag, podkl = f["istochnik"], f.get("data"), f["zagolovok"], False
        if kod == "diskval" and not diskval_proveren(f):
            # karta-v2 (Ф7): отсутствие отметки в DaData — не проверка; до подключения реестра ФНС — «не проверяли»
            st, ist, dat, zag, podkl = "ne_provereno", DISKVAL_ISTOCHNIK + " — подключаем", None, "Дисквалификация руководителя", True
        if st == "ne_provereno":
            znach = "не проверяли"
        stroki.append('<div class="fact"><span>%s</span><span class="fact__v">%s</span>%s</div>' % (
            e(zag), e(znach).replace("&nbsp;", NB), _istochnik_stroka(ist, dat, st, podkl).replace("co-src", "fact__src co-src")))
        # «Комментарий команды Делоскопа» — только под проверенным фактом («не проверяли» — без текста) и только утверждённый [Право]
        km = kom_najti(kom, f.get("signal")) if (kom and st == "podtverzhdeno") else None
        if km:
            stroki.append(kom_html(km))
    if any(s.startswith('<div class="kom ') for s in stroki):
        stroki.append(kom_ogovorka_html())  # оговорка [Право] 02.10 11:15 — один раз, под последней строкой реестров
    ne_pr = [x for x in k["ne_provereno"] if x.get("nazvanie")]
    ne_blok = ""
    if ne_pr:
        ne_blok = ('<div class="co-np"><p class="co-np__h">Ещё не проверяли по этой компании</p><ul>%s</ul>'
                   '<p class="caption">«Не проверяли» — это не «не нашли». Полная проверка по всем подключённым источникам — в отчёте.</p></div>'
                   % "".join("<li>○ %s%s</li>" % (e(x["nazvanie"]), (" — " + e(x["prichina"])) if x.get("prichina") else "") for x in ne_pr))
    # финансы
    fin = k["finansy"]
    fin_blok = ""
    if fin:
        posl = fin[-1]
        zag = "Доход за %d год — %s" % (posl["god"], dengi(posl["dohod"]))
        if len(fin) >= 2 and fin[-2]["dohod"] > 0:
            izm = (posl["dohod"] / fin[-2]["dohod"] - 1) * 100
            zag = ("Доход вырос на %d%s%% за год" % (round(izm), NB)) if izm >= 5 else \
                  ("Доход снизился на %d%s%% за год" % (round(-izm), NB)) if izm <= -5 else "Доход почти не изменился за год"
        tab = "".join("<tr><td>%d</td><td class=\"num\">%s</td></tr>" % (x["god"], dengi(x["dohod"])) for x in reversed(fin))
        fin_blok = ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">%s</h2>%s<div class="table-wrap"><table class="table">'
                    '<thead><tr><th>Год</th><th>Доход</th></tr></thead><tbody>%s</tbody></table></div>%s</section>' % (
                        e(zag).replace("&nbsp;", NB), svg_stolbcy(fin), tab,
                        _istochnik_stroka(k.get("finansy_istochnik") or "ГИР БО", k.get("finansy_data"),
                                          "podtverzhdeno" if k.get("finansy_data") else "ne_provereno")))
    elif (k["fakty"].get("dohod") or {}).get("znachenie") is not None:
        d = k["fakty"]["dohod"]
        g = d.get("god")
        fin_blok = ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Доход%s — %s</h2>'
                    '<p class="small">Все поступления компании за год по данным ФНС. Разбор по статьям и за пять лет — в полном отчёте.</p>%s</section>' % (
                        (" за%s%d год" % (NB, g)) if g else " за год", dengi(d["znachenie"]), _istochnik_stroka(d["istochnik"], d.get("data"))))
    # люди — только с PERSONS_PUBLIC=1
    lyudi = ""
    if persons_public():
        dr = k.get("direktor") or {}
        rows = []
        if dr.get("fio"):
            rows.append('<div class="fact"><span>%s</span><span class="fact__v">%s</span></div>' % (e(dr.get("post") or "Руководитель"), e(dr["fio"])))
        for u in k.get("uchrediteli") or []:
            if not isinstance(u, dict) or not u.get("name"):
                continue
            if str(u.get("tip") or u.get("type") or "").upper() in ("IP", "INDIVIDUAL"):
                continue  # ИП не показываем ни именем, ни ссылкой
            dolya = u.get("dolya") or u.get("share")
            rows.append('<div class="fact"><span>Учредитель</span><span class="fact__v">%s%s</span></div>' % (
                e(u["name"]), (" · %s%%" % e(dolya)) if dolya else ""))
        if rows:
            lyudi = ('<section class="co-sec" aria-labelledby="lyudi"><h2 id="lyudi">Руководство и владельцы</h2>%s%s</section>'
                     % ("".join(rows), _istochnik_stroka("ЕГРЮЛ", k.get("egrul_data"))))
    # соседи
    sos = ""
    if sosedi:
        sos = '<aside class="co-side card" aria-labelledby="sos"><h2 id="sos" class="co-h3">Похожие компании%s</h2><ul class="co-sos">%s</ul></aside>' % (
            (" — " + e(k["region"])) if k.get("region") and all(x["region"] == k["region"] for x in sosedi) else "",
            "".join('<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (
                adres_str(x), e(x["name"]), e(", ".join(filter(None, [x.get("gorod") or x.get("region"),
                                                                        dengi(x["fakty"]["dohod"]["znachenie"]) if (x["fakty"].get("dohod") or {}).get("znachenie") else ""]))).replace("&nbsp;", NB))
                for x in sosedi))
    podzag = " · ".join(filter(None, ["Действующая", ("работает " + vozr) if mes else "", e(mesto) if mesto else "",
                                      "ИНН " + k["inn"], ("ОГРН " + k["ogrn"]) if k.get("ogrn") else ""]))
    return """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://deloskop.ru/ikonka-512.png">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/css/ds.css">
<link rel="stylesheet" href="/css/co.css">
<script type="application/ld+json">{ld}</script>
<script src="/js/otzyv.js" defer></script>
</head>
<body class="co">
<!--shapka--><!--/shapka-->
<main id="main" class="wrap co-wrap">
<nav class="co-krosh caption" aria-label="Навигация"><a href="/">Делоскоп</a> › <a href="/{papka}/">Компании</a>{kr_reg}{kr_razd}</nav>
<header class="co-head">
<h1>{h1}</h1>
<p class="co-sub">{podzag}</p>
<div class="co-act"><a class="btn btn--primary" href="/?inn={inn}">Проверить сейчас — полный отчёт</a><a class="btn btn--secondary" href="/proverit-schet/">Проверить счёт от этой компании</a></div>
</header>
<div class="co-grid">
<div class="co-main">
{ind}
<section class="co-sec" aria-labelledby="korotko"><h2 id="korotko">Коротко о компании</h2><ul class="co-vv">{vv}</ul></section>
<section class="co-sec co-pered" aria-labelledby="pered"><h2 id="pered">Перед оплатой</h2><ul>{pered}</ul></section>
{fin}
<section class="co-sec" aria-labelledby="reestry"><h2 id="reestry">Проверка по реестрам</h2>{stroki}{ne_blok}</section>
{lyudi}
<section class="co-sec co-ogov caption"><p>Сведения — из открытых государственных реестров на указанные даты; выводы — наш расчёт по этим сведениям, а не решение банка или налоговой. Сведения могли измениться после даты: полная проверка на сегодня — <a href="/?inn={inn}">в отчёте</a>.</p><p>Нашли ошибку или не согласны с выводом? Напишите на <a href="mailto:help@deloskop.ru?subject={tema}">help@deloskop.ru</a> — проверим по первоисточнику и исправим.</p><p>Страница собрана {sobrano}.</p></section>
</div>
<div class="co-aside">
<aside class="co-side card"><h2 class="co-h3">Полный отчёт</h2><p class="small">Финансы за пять лет, налоги и долги, разбор Индекса и Паспорт контрагента для печати — и что проверить самим, со ссылками на первоисточники.</p><a class="btn btn--secondary co-w100" href="/?inn={inn}">Открыть отчёт</a></aside>
{sos}
<aside class="co-side card" aria-labelledby="pasport-h"><h2 id="pasport-h" class="co-h3">Паспорт контрагента</h2><p class="small">Документ для папки к сделке: 17 разделов, у каждого источник и дата сведений, «Чего мы не знаем и почему», PDF с номером и QR проверки подлинности.</p><a class="btn btn--secondary co-w100" href="/pasport/kontragent/?inn={inn}" rel="nofollow">Собрать Паспорт</a></aside>
</div>
</div>
</main>
</body>
</html>
""".format(
        title=e(title(k)), desc=e(description(k, V)).replace("&nbsp;", NB), url=url,
        ld=json.dumps(ld, ensure_ascii=False, sort_keys=True).replace("</", "<\\/"), papka=PAPKA,
        kr_reg=(" › " + e(k["region"])) if k.get("region") else "", kr_razd=(" › " + e(razdel)) if razdel else "",
        h1=e(nm), podzag=podzag, inn=k["inn"], ind=ind, vv=vv, pered=pered, fin=fin_blok, stroki="".join(stroki),
        ne_blok=ne_blok, lyudi=lyudi, sos=sos, tema=urllib.parse.quote("Ошибка в карточке ИНН " + k["inn"]),
        sobrano=data_tekst(k.get("proverka")) if k.get("proverka") else "")


def html_haba(kart, index):
    po_reg = {}
    for k in kart:
        po_reg.setdefault(k.get("region") or "Регион не указан", []).append(k)
    bloki = []
    for reg in sorted(po_reg, key=lambda r: (-len(po_reg[r]), r)):
        sp = sorted(po_reg[reg], key=lambda x: x["name"])
        bloki.append('<section class="co-sec"><h2>%s <span class="caption">%d</span></h2><ul class="co-sos co-sos--cols">%s</ul></section>' % (
            e(reg), len(sp), "".join('<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (
                adres_str(x), e(x["name"]), e(x.get("gorod") or "")) for x in sp)))
    t = "Компании в Делоскопе: проверка по ИНН — Делоскоп"
    d = "%d %s с выводами по открытым реестрам: доходы, штат, налоги и долги — у каждой цифры источник и дата сведений." % (
        len(kart), plural(len(kart), "компания", "компании", "компаний"))
    robots = "" if index else '<meta name="robots" content="noindex, follow">\n'
    return """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
{robots}<meta name="description" content="{d}">
<link rel="canonical" href="{sajt}/{papka}/">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/ds.css">
<link rel="stylesheet" href="/css/co.css">
</head>
<body class="co">
<!--shapka--><!--/shapka-->
<main id="main" class="wrap co-wrap">
<nav class="co-krosh caption" aria-label="Навигация"><a href="/">Делоскоп</a> › Компании</nav>
<header class="co-head"><h1>Компании</h1><p class="lead">Карточки компаний с выводами по открытым госреестрам. Каждая цифра — с источником и датой сведений. Нет нужной компании — проверьте её по ИНН на <a href="/">главной</a>: отчёт соберём за минуту.</p></header>
{bloki}
</main>
</body>
</html>
""".format(t=e(t), robots=robots, d=e(d), sajt=SAJT, papka=PAPKA, bloki="".join(bloki))


# ---------------------------------------------------------------- «Комментарий команды Делоскопа» (kommentarii-kartochki-v1)
# То же правило, что js/kommentarii.js (решения владельца 02.10; тексты — [Право], data/kommentarii.json). Функции чистые:
# библиотеку передаёт вызывающий (сайт — tests/kommentarii.py → zagruzit, API — тот же файл сайта). tests/kommentarii.py
# берёт их отсюда — одна Python-копия правила. Комментарий — пояснение практика, а не вывод: в ворота он не засчитывается.
KOM_TON = {"ok": "zel", "info": "zel", "warn": "zhel", "bad": "kras"}
KOM_MAKS = 300
# [Право] 02.10 08:20: зелёный текст — только если источник ответил («не проверяли ≠ не нашли»). То же, что NE_OTVETIL в JS.
KOM_NE_OTVETIL = re.compile(r"не\s*провер|недоступ|не\s*ответ|нет\s*ответа|нет\s*данных|нет\s*сведений|не\s*получ|ошибк|временно|не\s*удалось", re.I)
# [Право] 02.10 11:15 — общая оговорка (ст. 152 ГК РФ, ч. 3 ст. 5 38-ФЗ); дословно как OGOVORKA в js/kommentarii.js.
KOM_OGOVORKA = ("Комментарий команды — общий: он объясняет, как банки и налоговая смотрят на такой признак. "
                "Это не оценка этой компании или сделки и не юридическая консультация.")


def kom_dlina(t):
    return sum(len(str(t.get(x) or "")) for x in ("bank", "nalog", "sdelat"))


def kom_gotov(t):
    return bool(t and t.get("status") == "utverzhdeno" and t.get("proveril")
                and re.match(r"^\d{4}-\d{2}-\d{2}", str(t.get("data_proverki") or ""))
                and t.get("sdelat") and (t.get("bank") or t.get("nalog")) and kom_dlina(t) <= KOM_MAKS)


def _kom_rx(s):
    try:
        return re.compile(s, re.I)
    except re.error:
        return None


def kom_zapis(sprav, signal):
    """Первое совпадение сверху: re — по заголовку; uslovie — по «заголовок · деталь»; kak — тексты другой записи."""
    signal = signal or {}
    title = str(signal.get("title") or "")
    if not title:
        return None
    vse = title + " · " + str(signal.get("detail") or "")
    spisok = (sprav or {}).get("signaly") or []
    for z in spisok:
        r = _kom_rx(z.get("re") or "")
        if not r or not r.search(title):
            continue
        if z.get("uslovie"):
            u = _kom_rx(z["uslovie"])
            if not u or not u.search(vse):
                continue
        if not z.get("kak"):
            return z
        for c in spisok:
            if c.get("id") == z["kak"] and not c.get("kak"):
                return c
        return None
    return None


def kom_istochnik_otvetil(signal):
    signal = signal or {}
    if signal.get("status") != "ok":
        return False
    return not KOM_NE_OTVETIL.search(str(signal.get("title") or "") + " · " + str(signal.get("detail") or ""))


def kom_najti(sprav, signal):
    """Готовый комментарий к строке светофора или None (нет утверждённого текста — блока нет, без заглушек)."""
    z = kom_zapis(sprav, signal)
    ton = KOM_TON.get((signal or {}).get("status"))
    if not z or not ton:
        return None
    if ton == "zel" and not kom_istochnik_otvetil(signal):
        return None
    t = (z.get("tony") or {}).get(ton)
    if not kom_gotov(t):
        return None
    if t.get("uslovie"):  # тон только для своей детали — как в js/kommentarii.js
        u = _kom_rx(t["uslovie"])
        if not u or not u.search(str(signal.get("title") or "") + " · " + str(signal.get("detail") or "")):
            return None
    g, m, d = str(t["data_proverki"])[:10].split("-")
    return {"id": z["id"], "ton": ton, "bank": t.get("bank") or "", "nalog": t.get("nalog") or "",
            "sdelat": t["sdelat"], "norma": (t["norma"] if t.get("norma") is not None else z.get("norma")) or "",
            "podpis": (sprav or {}).get("podpis") or "Команда Делоскопа", "data": f"{d}.{m}.{g}"}


def _kom_esc(s):
    # как esc() в js/kommentarii.js: & < > " (апостроф не трогаем) — разметка байт в байт как в отчёте
    return re.sub(r'[&<>"]', lambda x: {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[x.group(0)], str(s if s is not None else ""))


def kom_html(k):
    """Та же разметка, что html() в js/kommentarii.js (проверяет tests/test_kartochki.py через node)."""
    if not k:
        return ""
    def stroka(l, t):
        return ('<p><span class="kom__l">%s</span> %s</p>' % (l, _kom_esc(t))) if t else ""
    return ('<div class="kom kom--%s" data-kom="%s"><div class="kom__h">Комментарий команды Делоскопа</div>%s%s%s'
            '<div class="kom__p">%s%s%s</div></div>') % (
        _kom_esc(k["ton"]), _kom_esc(k["id"]), stroka("Банк:", k.get("bank")), stroka("Налоговая:", k.get("nalog")),
        stroka("Что сделать:", k.get("sdelat")), _kom_esc(k.get("podpis")),
        (" · " + _kom_esc(k["norma"])) if k.get("norma") else "", (" · нормы сверены " + _kom_esc(k["data"])) if k.get("data") else "")


def kom_ogovorka_html():
    return '<p class="kom-og">%s</p>' % _kom_esc(KOM_OGOVORKA)


# ---------------------------------------------------------------- точка входа для API (render-v1)
def kartochka_iz_check(zapis, sosedi=(), kom=None):
    """Ответ /api/check → (годится, причина, адрес, html без оболочки).

    Те же ворота, что у статичной волны (vorota): не прошла — (False, причина, None, None), и API отвечает 404.
    ИП (ИНН из 12 цифр) отбрасывается до всякой обработки, как в otobrat. sosedi — уже разобранные
    карточки (iz_check) для блока «Похожие»; пусто — блока нет. kom — библиотека data/kommentarii.json сайта
    (как partials/obolochka.json): без неё карточка API выйдет без «Комментария команды» и не совпадёт с файлом волны."""
    inn = re.sub(r"\D", "", str(((zapis.get("company") or {}).get("inn")) or zapis.get("inn") or ""))
    if len(inn) == 12:
        return False, "не юрлицо или неверный ИНН", None, None
    k = iz_check(zapis)
    V = vyvody(k)
    ok, pr = vorota(k, V)
    if not ok:
        return False, pr, None, None
    return True, pr, adres_str(k), html_kartochki(k, V, pohozhie(k, list(sosedi)), kom)


# ---------------------------------------------------------------- оболочка для API (obolochka-v1)
OBOLOCHKA_METKA = "<!--shapka--><!--/shapka-->"


def nadet_obolochku(telo, ob):
    """HTML карточки (kartochka_iz_check) + оболочка сайта (partials/obolochka.json) → готовая страница.

    Три вставки — те же, что делает tests/sobrat_shapku.py → sobrat_stranicu: ссылки и метка режима — перед </head>,
    шапка (и полоса беты) — на место метки, подвал — перед последним </body>. Совпадение байт в байт со статичной
    карточкой проверяет tests/test_kartochki.py. Нет метки или </head> — None (API отвечает 503, а не кривой страницей)."""
    if not telo or OBOLOCHKA_METKA not in telo or "</head>" not in telo or "</body>" not in telo:
        return None
    t = telo.replace("</head>", ob["head"] + "</head>", 1)
    t = t.replace(OBOLOCHKA_METKA, ob["shapka"], 1)
    i = t.rfind("</body>")
    return t[:i] + ob["podval"] + t[i:]
