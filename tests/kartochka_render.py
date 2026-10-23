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
# kartochki-opf-v1: ЕГРЮЛ пишет форму и в конце в скобках — «БАНК ВТБ (ПАО)», «БАНК ГПБ (АО)», 'АКБ "ПЕРЕСВЕТ" (АО)';
# живой /api/check 04.10 отсеивал ВТБ как «не ООО/АО». Те же формы — и полным названием в строке досье
# «Организационно-правовая форма» (НКО, унитарные, госкорпорации сюда не входят — вне волны, как было).
OPF_V_SKOBKAH = re.compile(r"\((ООО|АО|ПАО|НАО|ЗАО|ОАО)\)$")
OPF_POLNYE = {"общество с ограниченной ответственностью", "акционерное общество", "публичное акционерное общество",
              "непубличное акционерное общество", "закрытое акционерное общество", "открытое акционерное общество"}
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


def _god(v):
    """Год отчётности: целое 1990…2100, иначе None (bool и мусор — не год)."""
    if isinstance(v, bool):
        return None
    try:
        g = int(str(v).strip())
    except (TypeError, ValueError):
        return None
    return g if 1990 <= g <= 2100 else None


PORYADKOVYE = {2: "второй", 3: "третий", 4: "четвёртый", 5: "пятый", 6: "шестой", 7: "седьмой"}


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
# kartochki-v4.1: написание, которое правило регистра не выводит (латиница в кириллице, внутренняя прописная).
# Ключ — то, что внутри кавычек в ЕГРЮЛ (заглавными); значение — как пишет сама компания. Только точное совпадение.
IMENA_TOCHNO = {
    "МЕТРО КЭШ ЭНД КЕРРИ": "Метро Кэш энд Керри",
    "ФОСАГРО": "ФосАгро",
    # kartochki-0510-v2: живые ответы 05.10 — фамилия/топоним после первого слова, внутренняя прописная, аббревиатура с гласной
    "ГРУППА ЧЕРКИЗОВО": "Группа Черкизово",
    "СИБУР ХОЛДИНГ": "СИБУР Холдинг",
    "АРНЕСТ ЮНИРУСЬ": "Арнест ЮниРусь",
    "МОЭК": "МОЭК",
    # kartochki-0510-v4: аббревиатура с гласной (Липецкая энергосбытовая компания) — правило регистра дало бы «Лэск»
    "ЛЭСК": "ЛЭСК",
    # kartochki-0510-v7: вторая часть — название бывшей компании (Ленэнерго), не нарицательное слово
    "РОССЕТИ ЛЕНЭНЕРГО": "Россети Ленэнерго",
    # kartochki-0710-v1: «Россети» + регион — топоним с прописной; союз «и» — строчными; апостроф — типографский
    "РОССЕТИ СИБИРЬ": "Россети Сибирь",
    "РОССЕТИ УРАЛ": "Россети Урал",
    "РОССЕТИ ВОЛГА": "Россети Волга",
    "РОССЕТИ ЦЕНТР": "Россети Центр",
    "РОССЕТИ ЦЕНТР И ПРИВОЛЖЬЕ": "Россети Центр и Приволжье",
    "РОССЕТИ МОСКОВСКИЙ РЕГИОН": "Россети Московский регион",
    "О`КЕЙ": "О’КЕЙ",
    # kartochki-1010-v1: «Юг» — топоним (правило регистра оставляло «ЮГ» аббревиатурой), «Северо-Запад» — обе части с прописной
    "РОССЕТИ ЮГ": "Россети Юг",
    "РОССЕТИ СЕВЕРО-ЗАПАД": "Россети Северо-Запад",
    # kartochki-1010b-n2: «Северный Кавказ» — топоним, обе части с прописной
    "РОССЕТИ СЕВЕРНЫЙ КАВКАЗ": "Россети Северный Кавказ",
    # kartochki-1010c-n2: «Томск» — топоним (правило регистра давало «Россети томск»)
    "РОССЕТИ ТОМСК": "Россети Томск",
    # kartochki-1010e-n2: топонимы с прописной — «Янтарь» (бренд Калининградской сети), «Ростов-на-Дону», «Ярославль»;
    # «энерго» и «межрегионгаз» — строчными, как пишут сами компании
    "РОССЕТИ ЯНТАРЬ": "Россети Янтарь",
    "ТНС ЭНЕРГО РОСТОВ-НА-ДОНУ": "ТНС энерго Ростов-на-Дону",
    "ГАЗПРОМ МЕЖРЕГИОНГАЗ ЯРОСЛАВЛЬ": "Газпром межрегионгаз Ярославль",
    # kartochki-1010f-n2: топонимы с прописной — «Воронеж», «Кубань», «Тюмень»; «энерго» — строчными, как у ТНС энерго
    "ТНС ЭНЕРГО ВОРОНЕЖ": "ТНС энерго Воронеж",
    "ТНС ЭНЕРГО КУБАНЬ": "ТНС энерго Кубань",
    "РОССЕТИ ТЮМЕНЬ": "Россети Тюмень",
    # kartochki-1010g-n2: топоним «Санкт-Петербург» и имя собственное «Росэнергоатом» — с прописной; «Рус» — слово, не
    # аббревиатура (правило «≤ 3 букв» давало «РУС»); СЭРК — аббревиатура с гласной (правило регистра давало «Сэрк»)
    "ГАЗПРОМ ТРАНСГАЗ САНКТ-ПЕТЕРБУРГ": "Газпром трансгаз Санкт-Петербург",
    "КОНЦЕРН РОСЭНЕРГОАТОМ": "Концерн Росэнергоатом",
    "БУРГЕР РУС": "Бургер Рус",
    "СЭРК": "СЭРК",
    # kartochki-1110a-n2: внутренняя прописная («ТрансКонтейнер»), топоним «Москва» с прописной, аббревиатуры с гласной
    # (ТВЭЛ, РАО — правило регистра давало «Твэл», «рао»); составное имя — через тире по типографике сайта
    "ТРАНСКОНТЕЙНЕР": "ТрансКонтейнер",
    "ГАЗПРОМ ТРАНСГАЗ МОСКВА": "Газпром трансгаз Москва",
    "ТВЭЛ": "ТВЭЛ",
    "ИНТЕР РАО-ЭЛЕКТРОГЕНЕРАЦИЯ": "Интер РАО — Электрогенерация",
    # kartochki-1110b-n2: топонимы с прописной («Санкт-Петербург(а)», «Уренгой», «Ямбург», «Югорск», «Западная Сибирь»),
    # часть после дефиса у дочерних «Лукойла» — с прописной (как «Лукойл» на карточке ПАО); СПб и СЗ — сокращения
    "ГАЗПРОМ МЕЖРЕГИОНГАЗ САНКТ-ПЕТЕРБУРГ": "Газпром межрегионгаз Санкт-Петербург",
    "ТЕПЛОСЕТЬ САНКТ-ПЕТЕРБУРГА": "Теплосеть Санкт-Петербурга",
    "МОРПОРТ СПБ": "Морпорт СПб",
    "ЛСР. НЕДВИЖИМОСТЬ-СЗ": "ЛСР. Недвижимость-СЗ",
    "ЛУКОЙЛ-ЗАПАДНАЯ СИБИРЬ": "Лукойл-Западная Сибирь",
    "ЛУКОЙЛ-ВОЛГОГРАДНЕФТЕПЕРЕРАБОТКА": "Лукойл-Волгограднефтепереработка",
    "ГАЗПРОМ ДОБЫЧА УРЕНГОЙ": "Газпром добыча Уренгой",
    "ГАЗПРОМ ДОБЫЧА ЯМБУРГ": "Газпром добыча Ямбург",
    "ГАЗПРОМ ТРАНСГАЗ ЮГОРСК": "Газпром трансгаз Югорск",
    # kartochki-1110c-n2: внутренние прописные — как пишет сама компания («ЛенСпецСМУ», СМУ — аббревиатура)
    "ЭТАЛОН ЛЕНСПЕЦСМУ": "Эталон ЛенСпецСМУ",
    # kartochki-1110d-n2: название региона и аббревиатура — как пишет сама компания
    "ГАЗПРОМ ГАЗОРАСПРЕДЕЛЕНИЕ ЛЕНИНГРАДСКАЯ ОБЛАСТЬ": "Газпром газораспределение Ленинградская область",
    "ЛОЭСК": "ЛОЭСК",
    "ВОЗДУШНЫЕ ВОРОТА СЕВЕРНОЙ СТОЛИЦЫ": "Воздушные Ворота Северной Столицы",
    # kartochki-1110e-n2: второе слово — часть названия, как пишет сама компания
    "ФОРВАРД ЭНЕРГО": "Форвард Энерго",
    # kartochki-1110f-n2: топоним и внутренняя прописная — как пишет сама компания
    "ТРАНСНЕФТЬ - ВЕРХНЯЯ ВОЛГА": "Транснефть — Верхняя Волга",
    "ГАЗПРОМ ТРАНСГАЗ ЕКАТЕРИНБУРГ": "Газпром трансгаз Екатеринбург",
    "ПЕПСИКО ХОЛДИНГС": "ПепсиКо Холдингс",
    # kartochki-1210-n2: топонимы с прописной («Уфа», «Сыктывкар», «Прикамье», «Хутор»); ДЛ — аббревиатура
    # («Деловые Линии»), второе слово — часть названия; составное имя — через тире по типографике сайта
    "ГАЗПРОМ ГАЗОРАСПРЕДЕЛЕНИЕ УФА": "Газпром газораспределение Уфа",
    "ГАЗПРОМ ГАЗОРАСПРЕДЕЛЕНИЕ СЫКТЫВКАР": "Газпром газораспределение Сыктывкар",
    "ТРАНСНЕФТЬ - ПРИКАМЬЕ": "Транснефть — Прикамье",
    "РОЗА ХУТОР": "Роза Хутор",
    "ДЛ-ТРАНС": "ДЛ-Транс",
    "ПРОММАШ ТЕСТ": "Проммаш Тест",
    # kartochki-1210-n3: фамилия с прописной; «ПФ» и «СКБ» — аббревиатуры, внутренние кавычки снимаем (как «Торговый дом Лента»)
    "ЛАБОРАТОРИЯ КАСПЕРСКОГО": "Лаборатория Касперского",
    "ПФ СКБ КОНТУР": "ПФ СКБ Контур",
    # kartochki-1210-n4: бренды с прописной во втором слове; «М.Видео», «Яндекс.Вертикали» — как пишут сами компании
    "КРОК ИНКОРПОРЕЙТЕД": "Крок Инкорпорейтед",
    "ЯНДЕКС.ВЕРТИКАЛИ": "Яндекс.Вертикали",
    "НОВАБЕВ ГРУПП": "Новабев Групп",
    "М.ВИДЕО": "М.Видео",
    "ИНСТАМАРТ СЕРВИС": "Инстамарт Сервис",
    # kartochki-1210-n2b: «Юг» — топоним; вторая часть имени собственного — с прописной; «чай» — слово, не аббревиатура
    # (правило «≤ 3 букв» давало «Дикси ЮГ», «Русский ЧАЙ»)
    "ДИКСИ ЮГ": "Дикси Юг",
    "МУЛТОН ПАРТНЕРС": "Мултон Партнерс",
    "ДЖОНСОН & ДЖОНСОН": "Джонсон & Джонсон",
    "РУССКИЙ ЧАЙ": "Русский чай",
}


def imya(short, full=""):
    """'ООО "ТД "ЧЕРНОЗЕМЬЕ"' → 'ООО «ТД Черноземье»'. Кавычки всегда парные (Маркетинг §2.2, п. 4)."""
    s = re.sub(r"\s+", " ", str(short or full or "").strip())
    if not s:
        return ""
    # kartochki-0710-v1: два кратких наименования через запятую ('ПАО "РОССЕТИ МОСКОВСКИЙ РЕГИОН", ПАО "РОССЕТИ МР"',
    # ответ /api/check 07.10) — берём первое; иначе в кавычки уходило «…регион, ПАО Россети МР».
    dva = re.match(r'^((?:ООО|АО|ПАО|НАО|ЗАО|ОАО)\s+["«].*?["»]),\s*(?:ООО|АО|ПАО|НАО|ЗАО|ОАО)\s+["«][^,]*$', s)
    if dva:
        s = dva.group(1)
    # kartochki-v3.7: хвост после закрывающей кавычки — 'ПАО "ТАТНЕФТЬ" ИМ. В.Д. ШАШИНА' →
    # 'ПАО «Татнефть» им. В.Д. Шашина' (было «Татнефть ИМ. В.Д. шашина» — хвост уходил внутрь кавычек).
    kav = re.findall(r'["«»“”„]', s)
    if len(kav) == 2 and not re.search(r'["«»“”„]$', s):
        hv = re.match(r'^(.*["«»“”„])\s+([^"«»“”„]+)$', s)
        if hv and hv.group(2) == hv.group(2).upper():
            return imya(hv.group(1)) + " " + _hvost(hv.group(2))
    m = re.match(r'^([^"«»“”„]*?)\s*["«»“”„](.*)$', s)
    if not m:
        # kartochki-opf-v1: «БАНК ВТБ (ПАО)» → «Банк ВТБ (ПАО)» — регистр как внутри кавычек, кавычек не добавляем
        sk = re.match(r"^(.+?)\s*(\((?:ООО|АО|ПАО|НАО|ЗАО|ОАО)\))$", s)
        if sk and sk.group(1) == sk.group(1).upper() and re.search(r"[А-ЯЁA-Z]", sk.group(1)):
            return imya('"%s"' % sk.group(1))[1:-1] + " " + sk.group(2)
        return s
    opf, vnutri = m.group(1).strip(), re.sub(r'["«»“”„]', "", m.group(2)).strip()
    # kartochki-v4-kod: слово сразу после внутренней кавычки — тоже имя собственное, с прописной:
    # АО "АВИАКОМПАНИЯ "СИБИРЬ" → «Авиакомпания Сибирь» (было «…сибирь»), ООО "ТОРГОВЫЙ ДОМ "ЛЕНТА" → «Торговый дом Лента».
    posle_kavychki = set()
    for i, w in enumerate([x for x in m.group(2).strip().split(" ") if re.sub(r'["«»“”„]', "", x)]):
        if i > 0 and re.match(r'^["«»“”„]', w):
            posle_kavychki.add(i)
    if vnutri in IMENA_TOCHNO:
        return (opf + " " if opf else "") + "«" + IMENA_TOCHNO[vnutri] + "»"
    if vnutri == vnutri.upper() and re.search(r"[А-ЯЁA-Z]", vnutri):
        slova = vnutri.split(" ")
        out = []
        for i, w in enumerate(slova):
            bukv = len(re.sub(r"[^А-Яа-яЁёA-Za-z]", "", w))
            # kartochki-v3.8: слово без гласных — аббревиатура при любой длине: «НЛМК», а не «Нлмк»
            bez_glasnyh = bukv >= 2 and not re.search(r"[АЕЁИОУЫЭЮЯAEIOUY]", w)
            if (bukv <= 3 and w not in KOROTKIE_SLOVA) or bez_glasnyh:
                out.append(w)
            elif i == 0 or i in posle_kavychki or (i == 1 and slova[0] not in KOROTKIE_SLOVA and len(re.sub(r"[^А-Яа-яЁёA-Za-z]", "", slova[0])) <= 3):
                out.append("-".join(p[:1] + p[1:].lower() for p in w.split("-")))
            else:
                out.append(w.lower())
        vnutri = " ".join(out)
    return (opf + " " if opf else "") + "«" + vnutri + "»"


def _hvost(h):
    """Хвост названия вне кавычек: «ИМ.»/«ИМЕНИ» — строчными, инициалы как есть, фамилия — с прописной."""
    out = []
    for w in h.split(" "):
        if w in ("ИМ.", "ИМЕНИ"):
            out.append(w.lower())
        elif OPF_V_SKOBKAH.fullmatch(w):
            out.append(w)  # kartochki-opf-v1: 'АКБ "ПЕРЕСВЕТ" (АО)' → «(АО)», а не «(ао)»
        elif re.fullmatch(r"(?:[А-ЯЁA-Z]\.)+", w):
            out.append(w)
        else:
            out.append("-".join(p[:1] + p[1:].lower() for p in w.split("-")))
    return " ".join(out)


TRANSLIT = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
                    ["a", "b", "v", "g", "d", "e", "e", "zh", "z", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t",
                     "u", "f", "h", "c", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"]))


def slug(name):
    s = re.sub(r"^(ООО|АО|ПАО|НАО|ЗАО|ОАО)\s+", "", str(name or ""))
    s = re.sub(r"\s*\((ООО|АО|ПАО|НАО|ЗАО|ОАО)\)$", "", s)  # kartochki-opf-v1: «Банк ВТБ (ПАО)» → bank-vtb
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


# v3.9: ЕГРЮЛ отдаёт адрес ПРОПИСНЫМИ и без пробела после «Г.» («Г.САНКТ-ПЕТЕРБУРГ»,
# ответ /api/check у «Газпром нефти» 03.10) — без приведения город и регион терялись.
_MALYE = {"Г": "г", "ГОРОД": "город", "ОБЛ": "обл", "ОБЛАСТЬ": "область", "КРАЙ": "край", "РЕСП": "Респ",
          "РЕСПУБЛИКА": "Республика", "АВТОНОМНЫЙ": "автономный", "ОКРУГ": "округ", "Д": "д", "УЛ": "ул",
          "ПОМ": "пом", "КАБ": "каб", "ЛИТЕРА": "литера", "ЛИТ": "лит", "ПР-КТ": "пр-кт", "ПЕР": "пер",
          "Ш": "ш", "ПЛ": "пл", "НАБ": "наб", "СТР": "стр", "КОРП": "корп", "ЭТАЖ": "этаж", "ОФИС": "офис",
          "ВН.ТЕР.Г.": "вн.тер.г.", "МУНИЦИПАЛЬНЫЙ": "муниципальный", "ПОС": "пос", "С": "с", "Р-Н": "р-н"}


def _iz_propisnyh(a):
    """Адрес без строчных кириллических букв → обычный регистр: «Г.САНКТ-ПЕТЕРБУРГ» → «г. Санкт-Петербург»."""
    if re.search(r"[а-яё]", a) or not re.search(r"[А-ЯЁ]", a):
        return a
    a = re.sub(r"(?<![А-ЯЁ])(Г|ОБЛ|РЕСП|УЛ|Д)\.(?=[А-ЯЁ])", r"\1. ", a)

    def slovo(m):
        w = m.group(0)
        if w in _MALYE:
            return _MALYE[w]
        if w == "АО" or re.fullmatch(r"[А-ЯЁ]", w):
            return w.lower() if w != "АО" else w
        # kartochki-1010-v1: служебные слова внутри дефисного топонима — строчными («Ростов-на-Дону», «Комсомольск-на-Амуре»)
        return "-".join(p.lower() if i and p in _VNUTRI_DEFISA else p[:1] + p[1:].lower() for i, p in enumerate(w.split("-")))
    return re.sub(r"[А-ЯЁ][А-ЯЁ\-]*", slovo, a)


_VNUTRI_DEFISA = {"НА", "НАД", "ПОД", "ДЕ"}


def region_gorod(adres):
    a = _iz_propisnyh(str(adres or ""))
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


_OKVED_KOD = re.compile(r"^\d{2}(?:\.\d{1,2}){0,2}$")


def okved_kod(okved):
    """kartochki-okved-v1: код основного ОКВЭД как в ЕГРЮЛ («46.71.4») или "" (мусор, «46,71», 5 уровней)."""
    s = str(okved or "").strip()
    return s if _OKVED_KOD.match(s) else ""


def okved_klass(x):
    """Класс ОКВЭД — первые 2 цифры кода («46.71.4» → «46»); у страницы без кода — "" (класс неизвестен)."""
    kod = okved_kod(x.get("okved"))
    return kod[:2] if kod else ""


def okved_nazvanie_iz_dosie(r, kod):
    """Живой /api/check отдаёт okved_name = null, а название — строкой досье «Основной вид деятельности»
    («46.71.4 — Торговля оптовая…»). Берём только при том же коде (как okved-zajmy-izm-v1 на сайте)."""
    if not kod:
        return ""
    for sec in ((r.get("dossier") or {}).get("sections") or []):
        for row in sec.get("rows") or []:
            if isinstance(row, (list, tuple)) and len(row) >= 2 and re.match(r"^\s*Основной вид деятельности", str(row[0])):
                m = re.match(r"^\s*(\d{2}(?:\.\d{1,2}){0,2})\s*[—–-]\s*(.+?)\s*$", str(row[1]))
                if m and m.group(1) == kod:
                    return m.group(2)
    return ""


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


_IZM_ZAPISI = re.compile(r"последнее изменение записи ЕГРЮЛ[^—–;]*[—–]\s*(\d{2}\.\d{2}\.\d{4})", re.I)


def data_izmeneniya_zapisi(c, data_dates):
    """kartochki-daty-v2: дата последнего изменения записи в ЕГРЮЛ — company.state_actuality_date, запасной путь —
    «последнее изменение записи ЕГРЮЛ/ЕГРИП — ДД.ММ.ГГГГ» в dossier.data_dates (как js/dinamika.js). «— на …» не берём."""
    d = data_iz(str((c or {}).get("state_actuality_date") or "")[:10])
    if d:
        return d
    m = _IZM_ZAPISI.search(str(data_dates or ""))
    return data_iz(m.group(1)) if m else None


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


def opf_iz_dosie(r):
    """kartochki-opf-v1: строка «Организационно-правовая форма» раздела «Профиль» досье /api/check (или пусто)."""
    for sek in ((r.get("dossier") or {}).get("sections") or []):
        for row in sek.get("rows") or []:
            if isinstance(row, (list, tuple)) and len(row) >= 2 and str(row[0]).strip() == "Организационно-правовая форма":
                return str(row[1] or "").strip()
    return ""


def kommercheskaya(k):
    """ООО/АО/ПАО/НАО/ЗАО/ОАО — в начале названия, в скобках в конце или полным названием формы из досье."""
    nm = k.get("name") or ""
    return bool(KOMMERCHESKIE.match(nm) or OPF_V_SKOBKAH.search(nm)
                or (k.get("opf") or "").strip().lower() in OPF_POLNYE)


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
        "opf": opf_iz_dosie(r),
    }
    if not k["okved_name"]:
        k["okved_name"] = okved_nazvanie_iz_dosie(r, okved_kod(k["okved"]))  # kartochki-okved-v1
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
    # kartochki-fssp-v1 (Ночные-2, 12.10): после istochniki-v1 приставы приходят не сигналом светофора, а блоком
    # damia.fssp (status «polucheno», sostoyanie found/not_found, data_svedeniy) — V11/V12 не выходили ни у кого.
    # Берём только ответ с датой сведений и ясным состоянием; not_checked и «нет даты» — факта нет («не проверяли»).
    fb = (r.get("damia") or {}).get("fssp")
    if "fssp" not in k["fakty"] and isinstance(fb, dict) and fb.get("sostoyanie") in ("found", "not_found") \
            and data_iz(fb.get("data_svedeniy")):
        dn = fb.get("dannye") if isinstance(fb.get("dannye"), dict) else {}
        nashli = fb["sostoyanie"] == "found"
        k["fakty"]["fssp"] = {
            "kod": "fssp", "zagolovok": str(fb.get("nazvanie") or "Приставы"), "detal": str(fb.get("itog") or ""),
            "ton": "warn" if nashli else "ok",
            "istochnik": str(fb.get("istochnik") or "ФССП: исполнительные производства"),
            "data": data_iz(fb.get("data_svedeniy")),
            "znachenie": chislo(dn.get("ostatok")) if nashli else None, "god": None,
        }
    # числа из досье (kpi) — дополняют сигналы; дата — у одноимённого сигнала или общая дата наборов ФНС
    D = r.get("dossier") or {}
    fns_data = data_iz(r.get("fns_data")) or data_iz(((r.get("daty") or {}).get("dannye") or {}).get("ФНС")
                                                     if isinstance((r.get("daty") or {}).get("dannye"), dict) else None)
    # daty-v1: даты наборов из досье («ЕГРЮЛ/ЕГРИП — на 21.09.2026; задолженность — на 01.09.2026; …») — сервер их
    # уже отдаёт строкой; без них факт ФНС оставался «без даты» и не шёл в выводы (пилот 02.10: 9 из 17 — «выводов 2 из 3»).
    # «ЕГРЮЛ/ЕГРИП — на …» в досье — state.actuality_date DaData, то есть дата последних изменений записи, а не дата
    # сведений: для ЕГРЮЛ остаётся дата проверки (сведения получены в этот день).
    dd = daty_naborov(D.get("data_dates"))
    # kartochki-daty-v2 ([Ночные-2] 17.10): «ЕГРЮЛ/ЕГРИП — на …» — дата получения сведений, а не изменения записи (сверено
    # живым /api/check 17.10: «на 17.10.2026; последнее изменение записи — 28.08.2026»). Дата изменения — только
    # company.state_actuality_date или отдельная строка «последнее изменение записи …»; нет — строки на карточке нет.
    k["egrul_aktualno"] = data_izmeneniya_zapisi(c, D.get("data_dates"))
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
    # kartochki-finansy-v1 (Ночные-2, 04.10): ряд прибыли, баланс и расчёты из ГИР БО уже есть в живом ответе
    # (charts.profit / balance / debts — «Аэрофлот», «Газпром» 04.10), но на карточку шли только выручка и одна прибыль.
    # Берём как факты с годом отчётности; без числа или года — молчим. Год позже даты проверки — не факт.
    k["pribyl_ryad"], k["balans"], k["raschety"] = {}, None, None
    gp = proverka.year if proverka else 9999
    if str(k["finansy_istochnik"]).startswith("ГИР БО"):
        for p in ch.get("profit") or []:
            if isinstance(p, dict):
                g, v = _god(p.get("year")), chislo(p.get("value"))
                if g and g <= gp and v is not None:
                    k["pribyl_ryad"][g] = v
    # kartochki-ton-v1: налог на прибыль из отчёта о финансовых результатах (строка 2410 = 2411 текущий + 2412 отложенный,
    # charts.income_tax) — того же года, что последний год прибыли. Только расход (> 0): доход (обратный знак) не показываем
    # ([Право · Налоговый] 04.10 07:07 разд. 5.2 п. 3). «Уплатила» не пишем — это не сумма, уплаченная в бюджет.
    # ⚠ Знак в charts.income_tax не различает расход и доход: «Аэрофлот» 2020 — убыток 96,5 млрд ₽ и +26,6 млрд ₽ «налога»
    # (по отчётности это доход по налогу).
    # kartochki-znak-naloga-v1 (Ночные-2, 05.10): вместо общего флага — знак по контракту [Продукт · Данные] 04.10 разд. 1
    # (nalog_prib_znak): строка 2300 за год → налог = 2300 − 2400; иначе флаг ряда income_tax_znak / точки znak.
    # Без этих полей (живой API сейчас) строки нет — как было. Правило «есть отрицательное → ряд со знаком» на публичной
    # странице не берём: у прибыльной компании оно ничего не доказывает (тот же контракт).
    k["nalog_prib"] = None
    if NALOG_PRIB_ZNAK and k["pribyl_ryad"]:
        gn = max(k["pribyl_ryad"])
        v = nalog_prib_znak(ch, gn, k["pribyl_ryad"][gn])
        k["nalog_prib"] = {"god": gn, "znachenie": v} if (v is not None and v > 0) else None
    b = ch.get("balance")
    if isinstance(b, dict) and _god(b.get("year")) and _god(b.get("year")) <= gp:
        chasti = [chislo(b.get(x)) for x in ("equity", "long_debt", "short_debt")]
        if any(x is not None for x in chasti):
            k["balans"] = {"god": _god(b.get("year")), "kap": chasti[0], "dol": chasti[1], "kor": chasti[2]}
    db = ch.get("debts")
    if isinstance(db, dict) and _god(db.get("year")) and _god(db.get("year")) <= gp:
        ras = [chislo(db.get(x)) for x in ("receivables", "payables", "loans")]
        if any(x is not None and x > 0 for x in ras):
            k["raschety"] = {"god": _god(db.get("year")), "rec": ras[0], "pay": ras[1], "loan": ras[2]}
    # kartochki-v2: с какой даты руководитель тот же (ЕГРЮЛ) — только дата, без ФИО (люди — при PERSONS_PUBLIC)
    k["rukovodit_s"] = data_iz(c.get("director_date")) or _rukovodit_s(D)
    if k["rukovodit_s"] and ((k["reg_date"] and k["rukovodit_s"] < k["reg_date"]) or (proverka and k["rukovodit_s"] > proverka)):
        k["rukovodit_s"] = None
    k["finansy_data"] = data_iz(r.get("finansy_data")) or data_iz(r.get("girbo_data"))
    # kartochki-v3.4 (Ночные-2, 03.10): ряд из ГИР БО (charts.revenue) — те же строки 2110, что и вывод «Выручка за Г»
    # (сведения на 31.12.Г, ● подтверждено). Таблица под ним писала «дата сведений не указана · ○ не проверяли» —
    # одно и то же число на странице с двумя статусами. Дата ряда = 31.12 последнего года ряда.
    if not k["finansy_data"] and k["finansy"] and k["finansy_istochnik"].startswith("ГИР БО") and ch.get("revenue"):
        k["finansy_data"] = dt.date(k["finansy"][-1]["god"], 12, 31)
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
# kartochki-ton-v1 / kartochki-znak-naloga-v1: строка налога на прибыль на карточке — только когда знак известен
# по году (nalog_prib_znak). False — аварийный выключатель: строки нет ни у кого.
NALOG_PRIB_ZNAK = True


def nalog_prib_znak(ch, god, pribyl):
    """kartochki-znak-naloga-v1: налог на прибыль за год со знаком (расход > 0, доход < 0) или None — знак неизвестен.

    Контракт /api/check ([Продукт · Данные] 04.10, разд. 1), тот же порядок, что js/rentabelnost.js (znak-naloga-v1.1):
    1) charts.profit_before_tax за год (строка 2300) → 2300 − чистая прибыль (2400) — точно и со знаком;
    2) charts.income_tax_znak is True → значение точки как есть;
    3) у точки года есть znak (bool) → True — как есть, False — None;
    иначе None (в том числе в смешанном ряду без znak у года и в ряду без флагов)."""
    ch = ch if isinstance(ch, dict) else {}
    if god is None or pribyl is None:
        return None
    for p in ch.get("profit_before_tax") or []:
        if isinstance(p, dict) and _god(p.get("year")) == god:
            pbt = chislo(p.get("value"))
            if pbt is not None:
                return pbt - pribyl
    tochka = None
    for p in ch.get("income_tax") or []:
        if isinstance(p, dict) and _god(p.get("year")) == god:
            tochka = p
    if tochka is None:
        return None
    v = chislo(tochka.get("value"))
    if v is None:
        return None
    if ch.get("income_tax_znak") is True:
        return v
    return v if tochka.get("znak") is True else None


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


# nds-porog-v1 (Ночные-2, 03.10): «НДС в 2027 году» на карточке — только факт, без совета (текст [Право · Налоговый юрист]
# 03.10 21:10, разд. 2 claude/Право_Старт_390_оферта_НДС-2027_Вокфорс_03.10.md: «Упрощённая система; выручка за 2025 год —
# 18,4 млн ₽ при пороге освобождения от НДС 20 млн ₽ (п. 1 ст. 145 НК РФ).»). Логика — как js/bez-nds.js prognoz():
# окно с 01.01.(T−1) до 01.05.T, выручка за T−2 из ГИР БО, выручки за T−1 в ряду нет; T = 2027. Пороги п. 1 ст. 145
# (ред. 228-ФЗ от 04.07.2026): 20 млн ₽ — доход за 2025–2028 годы, 15 млн ₽ — за 2029-й, 10 млн ₽ — дальше.
NDS_GOD_PROGNOZA = 2027


def nds_porog(god):
    if god < 2025:
        return None
    return 20e6 if god <= 2028 else (15e6 if god == 2029 else 10e6)


def vyvod_nds_porog(k, na, T=NDS_GOD_PROGNOZA):
    if not na or not (dt.date(T - 1, 1, 1) <= na < dt.date(T, 5, 1)):
        return None
    if not str(k.get("finansy_istochnik") or "").startswith("ГИР БО"):
        return None
    ryad = {p["god"]: p["dohod"] for p in k.get("finansy") or []}
    v, p = ryad.get(T - 2), nds_porog(T - 2)
    if T - 1 in ryad or not v or v <= 0 or not p:
        return None
    vs = dengi(v)
    if vs == dengi(p) and v != p:  # 20 000 001 ₽ не пишем «20 млн ₽ при пороге 20 млн ₽»
        vs = "{:,}".format(int(round(v))).replace(",", NB) + NB + "₽"
    return "Упрощённая система; выручка за %d год — %s при пороге освобождения от НДС %s (п.%s1 ст.%s145 НК РФ)" % (
        T - 2, vs, dengi(p), NB, NB)


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
        # kartochki-finansy-v1: к прибыли — сравнение с прошлым годом того же ряда ГИР БО (пороги — как у выручки V03/V04),
        # к убытку — сколько лет подряд. Один вывод, без лишнего слота «2 из одного источника».
        ryad, g, v = k.get("pribyl_ryad") or {}, pb["god"], pb["znachenie"]
        p0 = ryad.get(g - 1)
        if v > 0:
            t = "Чистая прибыль за%s%d — %s" % (NB, g, dengi(v))
            if p0 is not None and p0 < 0:
                t += ", годом раньше — убыток"
            elif p0:
                dl = (v / p0 - 1) * 100
                if dl >= 10:
                    t += ", на%s%d%s%% больше, чем годом раньше" % (NB, round(dl), NB)
                elif dl <= -30:
                    t += ", на%s%d%s%% меньше, чем годом раньше" % (NB, round(-dl), NB)
                    # kartochki-ton-v1: падение прибыли ≥ 30 % — «справочно», не «хорошо» ([Право · Налоговый] 04.10 07:07
                    # разд. 5.2: зелёная точка у прибыли, упавшей вдвое, читается как оценка; методики для неё нет). Текст тот же.
                    out.append(_v("V24b", "info", t, pb["istochnik"], pb["data"]))
                    t = None
            if t:
                out.append(_v("V24", "ok", t, pb["istochnik"], pb["data"]))
        else:
            n = 1
            while (ryad.get(g - n) or 0) < 0:
                n += 1
            t = "Убыток за%s%d — %s" % (NB, g, dengi(-v))
            if n >= 2:
                t += ", %s%sгод подряд" % (PORYADKOVYE.get(n, "%d-й" % n), NB)
            out.append(_v("V24a", "warn", t, pb["istochnik"], pb["data"]))
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
        # kartochki-v3.7: текст V15 — [Право · Налоговый юрист] 03.10 07:07 (разд. 3) дословно; год — от даты набора:
        # набор на 01.12.Y → штрафы по решениям Y−1, не уплаченные к 01.10.Y (п. 4 и п. 10 «ж» прил. к 729@ в ред. 1006@).
        d = sh["data"]
        y = d.year if d.month >= 10 else d.year - 1
        out.append(_v("V15", "warn", "Налоговые штрафы по решениям %d года не были уплачены к%s01.10.%d — %s (данные ФНС на%s%s). Могли быть уплачены после этой даты" % (
            y - 1, NB, y, dengi(sh["znachenie"]), NB, data_korotko(d)), sh["istochnik"], d))
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
        nds = vyvod_nds_porog(k, na)
        out.append(_v("V13n", "info", nds, sn["istochnik"], sn["data"]) if nds else
                   _v("V13", "info", "Применяет упрощённую систему налогообложения", sn["istochnik"], sn["data"], s_chislom=False))
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


# ---------------------------------------------------------------- «Разбор по цифрам» (razbor-cifry-v1, [Тестировщик] 10.10)
# Находка 10.10: 5 случайных карточек совпадали по предложениям на 73–82 %, «Комментарий команды» — на 100 %
# (общие тексты [Право] по типу признака). Здесь — 2–4 фразы только из цифр этой компании (ряд ГИР БО, прибыль,
# штат, налоги): динамика за весь ряд, рентабельность год к году, выручка на сотрудника, налоги к выручке.
# Это расчёт Делоскопа (◆), без оценок и советов: ни «хорошо», ни «плохо» — только что видно по отчётности.
def _proc(x, znak=False):
    """0.0072 → «0,7 %»; 0.153 → «15 %»; с неразрывным пробелом."""
    v = x * 100
    t = ("%.1f" % v) if abs(v) < 10 else ("%d" % round(v))
    t = t.rstrip("0").rstrip(".") if "." in t else t
    return ("+" if znak and v > 0 else "") + t.replace(".", ",").replace("-", "−") + NB + "%"


def _raz(a, b):
    """Во сколько раз b больше a: «2,3 раза», «2 раза», «5 раз», «22 раза»."""
    r = b / a
    if r < 10 and abs(r - round(r)) >= 0.05:
        return ("%.1f" % r).replace(".", ",") + NB + "раза"
    n = int(round(r))
    return "%d%s%s" % (n, NB, plural(n, "раз", "раза", "раз"))


def razbor_cifry(k):
    """Список фраз (str, без HTML). Пусто — блока нет: на карточке без ряда ГИР БО не придумываем."""
    out = []
    ryad = [x for x in (k.get("finansy") or []) if x.get("dohod") and x["dohod"] > 0]
    if len(ryad) >= 3 and str(k.get("finansy_istochnik") or "").startswith("ГИР БО"):
        a, b = ryad[0], ryad[-1]
        n = b["god"] - a["god"]
        podryad, znak = 0, 0
        for p0, p1 in zip(ryad[-2::-1], ryad[::-1]):          # с конца: сколько лет подряд в одну сторону
            z = 1 if p1["dohod"] > p0["dohod"] else -1 if p1["dohod"] < p0["dohod"] else 0
            if z == 0 or (znak and z != znak):
                break
            znak, podryad = z, podryad + 1
        if b["dohod"] >= a["dohod"] * 1.05:
            t = "За%s%d%s%s выручка выросла в%s%s: с%s%s в%s%d до%s%s в%s%d" % (
                NB, n, NB, plural(n, "год", "года", "лет"), NB, _raz(a["dohod"], b["dohod"]), NB, dengi(a["dohod"]), NB,
                a["god"], NB, dengi(b["dohod"]), NB, b["god"])
        elif b["dohod"] <= a["dohod"] * 0.95:
            t = "За%s%d%s%s выручка снизилась на%s%s: с%s%s в%s%d до%s%s в%s%d" % (
                NB, n, NB, plural(n, "год", "года", "лет"), NB, _proc(1 - b["dohod"] / a["dohod"]), NB, dengi(a["dohod"]), NB,
                a["god"], NB, dengi(b["dohod"]), NB, b["god"])
        else:
            t = "За%s%d%s%s выручка почти не изменилась: %s в%s%d и%s%s в%s%d" % (
                NB, n, NB, plural(n, "год", "года", "лет"), dengi(a["dohod"]), NB, a["god"], NB, dengi(b["dohod"]), NB, b["god"])
        if podryad >= 3:
            t += "; %s%s%d%s%s подряд" % ("растёт" if znak > 0 else "снижается", NB, podryad, NB, plural(podryad, "год", "года", "лет"))
        out.append(t + ".")
    dohod = {x["god"]: x["dohod"] for x in ryad}
    pr = k.get("pribyl_ryad") or {}
    gody = sorted(g for g in pr if dohod.get(g))
    if gody:
        g1 = gody[-1]
        m1 = pr[g1] / dohod[g1]
        t = "Чистая рентабельность за%s%d — %s" % (NB, g1, _proc(m1))
        if len(gody) >= 2 and gody[-2] == g1 - 1:
            m0 = pr[g1 - 1] / dohod[g1 - 1]
            t += ", годом раньше — %s" % _proc(m0)
            if m0 > 0 and m1 < m0 * 0.7 and dohod[g1] > dohod[g1 - 1]:
                t += ": выручка выросла, а прибыль на каждый рубль выручки — снизилась"
            elif m0 > 0 and m1 > m0 * 1.3 and m1 > 0:
                t += ": прибыль на каждый рубль выручки выросла"
        out.append(t + ".")
    F = k.get("fakty") or {}
    sh = (F.get("shtat") or {}).get("znachenie")
    d = (F.get("dohod") or {}).get("znachenie")
    if sh and int(sh) >= 5 and d and d > 0:
        out.append("Выручка на одного сотрудника — %s в год (штат %s%s%s)." % (dengi(d / int(sh)), f"{int(sh):,}".replace(",", NB), NB,
                                                                               plural(int(sh), "человек", "человека", "человек")))
    nl = (F.get("nalogi") or {}).get("znachenie")
    if nl and nl > 0 and d and d > 0 and len(out) < 4:
        out.append("Налоги и взносы — %s выручки за год." % _proc(nl / d))
    for x in out:
        assert not STOP_SLOVA.search(x), x
    return out[:4]


def razbor_html(k):
    f = razbor_cifry(k)
    if len(f) < 2:
        return ""
    src = k.get("finansy_istochnik") or "ГИР БО, бухгалтерская отчётность"
    return ('<section class="co-sec co-razbor" aria-labelledby="razbor"><h2 id="razbor">Разбор по цифрам</h2>'
            '<ul class="co-vv">%s</ul><p class="caption">◆ рассчитано Делоскопом по данным: %s и открытые данные ФНС — '
            'без оценки компании.</p></section>' % (
                "".join('<li class="co-v co-v--info"><span class="co-v__z" aria-label="расчёт"></span><div><p>%s</p></div></li>'
                        % e(x).replace("&nbsp;", NB) for x in f), e(src)))


# ---------------------------------------------------------------- ворота
def vorota(k, V=None):
    """(годится, причина). Годится = карточка создаётся и идёт в sitemap."""
    V = vyvody(k) if V is None else V
    if not inn_ok(k["inn"]) or k.get("kind") != "LEGAL":
        return False, "не юрлицо или неверный ИНН"
    if k.get("status") != "ACTIVE":
        return False, "статус не «действующая»"
    if not kommercheskaya(k):
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
        # v3.9: отчётность старше прошлого года (ГИР БО закрыта, «Газпром нефть» — 2021) — год в сниппете,
        # иначе старая выручка читается как нынешняя
        pr, g = k.get("proverka"), d.get("god")
        staraya = bool(g and hasattr(pr, "year") and g < pr.year - 1)
        chasti.append("доход %s%s" % (dengi(d["znachenie"]), (" за%s%d" % (NB, g)) if staraya else ""))
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


def svg_stolbcy(fin, sl="Доход"):
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
    return ('<svg class="co-chart" viewBox="0 0 %d %d" role="img" aria-label="%s по годам: %s">%s</svg>' % (
        shir, h + 24, sl, e("; ".join("%d — %s" % (x["god"], dengi(x["dohod"])) for x in fin)), "".join(bars)))


def _razdel(x):
    """Раздел ОКВЭД: из кода или из крошек страницы (добор)."""
    return okved_razdel(x.get("okved")) or x.get("razdel") or ""


def _dohod_kart(x):
    """Доход как напечатан (dengi) — добор и полная сборка сортируют одинаково."""
    v = (x.get("fakty", {}).get("dohod") or {}).get("znachenie") or 0
    if v <= 0:
        return 0.0
    m = re.match(r"^([0-9]+(?:,[0-9]+)?) (трлн|млрд|млн|тыс\.)", dengi(v).replace("&nbsp;", NB))
    return float(m.group(1).replace(",", ".")) * {"трлн": 1e12, "млрд": 1e9, "млн": 1e6, "тыс.": 1e3}[m.group(2)] if m else float(v)


SOSEDEJ = 5  # v3.8b: 3–5 ссылок (ТЗ Маркетинга 03.10, 2.4)


def pohozhie(k, vse):
    """kartochki-okved-v1 (ТЗ [Продукт · Данные] 03.10 разд. 3.2 п. 4, ТЗ 16:50): есть компании того же класса ОКВЭД
    (2 цифры) — только они (сначала свой регион), до 5; нет — как v3.8b: регион+раздел → раздел → регион → остальные
    (до 3), и блок называется «Ещё компании в Делоскопе». Только напечатанное на странице: добор = полная сборка.
    Внутри уровня — ближе по доходу, затем ИНН."""
    moi_d, rz, kl = _dohod_kart(k), _razdel(k), okved_klass(k)
    if kl:
        kand = [x for x in vse if x["inn"] != k["inn"] and okved_klass(x) == kl]
        if kand:
            kand.sort(key=lambda x: (not (k.get("region") and x.get("region") == k["region"]),
                                     abs(math.log1p(_dohod_kart(x)) - math.log1p(moi_d)), x["inn"]))
            return kand[:SOSEDEJ]
    ur = [lambda x: rz and k.get("region") and x.get("region") == k["region"] and _razdel(x) == rz,
          lambda x: rz and _razdel(x) == rz,
          lambda x: k.get("region") and x.get("region") == k["region"],
          None]
    out = []
    for f in ur:
        if f is None and len(out) >= 3:
            break
        kand = [x for x in vse if x["inn"] != k["inn"] and x not in out and (f is None or f(x))]
        kand.sort(key=lambda x: (abs(math.log1p(_dohod_kart(x)) - math.log1p(moi_d)), x["inn"]))
        out.extend(kand[:(SOSEDEJ if f else 3) - len(out)])
        if len(out) >= SOSEDEJ:
            break
    return out


def sosedi_html(k, sosedi, eshche=None):
    """Блок «Похожие компании»; добор обновляет им и опубликованные карточки. eshche — добор до 5 ссылок
    (kartochki-shablon-v1, eshche_kompanii): отдельным списком под своим заголовком, «похожими» не называем."""
    if not sosedi:
        return ""
    # kartochki-okved-v1: «Похожие» — только если у всех тот же класс ОКВЭД (2 цифры); регион или раздел — не похожесть
    kl = okved_klass(k)
    if kl and all(okved_klass(x) == kl for x in sosedi):
        zag = ("Похожие компании — " + e(k["region"])) if (k.get("region") and all(x.get("region") == k["region"] for x in sosedi)) \
            else "Похожие компании"
    else:
        zag = "Ещё компании в Делоскопе"
    return '<aside class="co-side card" aria-labelledby="sos"><h2 id="sos" class="co-h3">%s</h2><ul class="co-sos">%s</ul>%s</aside>' % (
        zag, "".join('<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (
            adres_str(x), e(x["name"]), e(", ".join(filter(None, [x.get("gorod") or x.get("region"),
                                                                    dengi(_dohod_kart(x)) if _dohod_kart(x) else ""]))).replace("&nbsp;", NB))
            for x in sosedi), eshche_html(k, eshche or []))


# v3.8b: средняя нагрузка отрасли (data/fns-normy-2025.json, прил. 3 ММ-3-06/333@); свою нагрузку не сравниваем —
# в API налоги со взносами. Модуль без чтения файлов (его берёт API): строки передаёт сборщик (normy).


def yakor_normy(kod, tablica="n"):
    """nagruzka-yakorya-v1: якорь строки справочника /nalogi/nagruzka-po-otraslyam-2025/ — «n-35-1», «n-f», «n-vsego».
    Тот же расчёт — tests/sobrat_nagruzka.py yakor и js/nagruzka.js yakor (tests/nagruzka_yakorya.test.js)."""
    k = "vsego" if kod == "ВСЕГО" else re.sub(r"[^0-9a-z]+", "-", str(kod).lower()).strip("-")
    return tablica + "-" + k


SPRAVOCHNIK_NORM = "/nalogi/nagruzka-po-otraslyam-2025/"


def _nazv_normy(r):
    nz = re.sub(r"\s+-\s+всего$", "", r["nazvanie"]).strip()
    return nz[:1].upper() + nz[1:]


def otrasl_stroka(okved, normy):
    """→ строка ФНС (dict) по самому длинному префиксу ОКВЭД (при равенстве — узкая строка) или None."""
    kod = re.sub(r"[^0-9.]", "", str(okved or ""))
    luchshij = None
    for r in normy or []:
        z = (r.get("nagruzka") or {}).get("2025")
        if not kod or not isinstance(z, (int, float)):
            continue
        for pr in r.get("okved") or []:
            klyuch = (len(pr), -len(r.get("okved") or []))
            if kod.startswith(pr) and (luchshij is None or klyuch > luchshij[0]):
                luchshij = (klyuch, r)
    return luchshij[1] if luchshij else None


def otrasl_nagruzka(okved, normy):
    """→ (строка ФНС, % за 2025) по самому длинному префиксу ОКВЭД (при равенстве — узкая строка) или None."""
    r = otrasl_stroka(okved, normy)
    return (_nazv_normy(r), r["nagruzka"]["2025"]) if r else None


def otrasl_html(k, normy):
    r = otrasl_stroka(k.get("okved"), normy)
    if not r:
        return ""
    # nagruzka-yakorya-v1: ссылка — сразу на строку отрасли в таблице ФНС (ТЗ [Маркетинг] 03.10, разд. 2.1)
    return ('<p class="small co-otr">Средняя налоговая нагрузка в отрасли «%s» за%s2025%sгод — %s%s%% (данные ФНС, без страховых взносов). '
            '<a href="%s#%s">Таблица ФНС по отраслям ›</a></p>' % (
                e(_nazv_normy(r)), NB, NB, ("%.1f" % r["nagruzka"]["2025"]).replace(".", ","), NB,
                SPRAVOCHNIK_NORM, yakor_normy(r["kod"])))


_OTR_STARYJ = re.compile(r'(<p class="small co-otr">Средняя налоговая нагрузка в отрасли «(.*?)» за.*?)'
                         r'<a href="/nalogi/nagruzka-po-otraslyam-2025/#nagruzka">', re.S)


def pochinit_otrasl_yakor(t, normy):
    """nagruzka-yakorya-v1: опубликованные карточки — «Таблица ФНС по отраслям ›» ведёт на строку отрасли, как у новых.
    Строку ищем по названию отрасли в тексте абзаца; не нашли одну — ссылку не трогаем. Повтор ничего не меняет."""
    def zamena(m):
        nz = html.unescape(m.group(2))
        nabor = [r for r in normy or [] if _nazv_normy(r) == nz]
        if len(nabor) != 1:
            return m.group(0)
        return m.group(1) + '<a href="%s#%s">' % (SPRAVOCHNIK_NORM, yakor_normy(nabor[0]["kod"]))
    return _OTR_STARYJ.sub(zamena, t, count=1)


# ---------------------------------------------------------------- «Даты из реестра» и вход в Паспорт (kartochki-daty-v1)
# ТЗ [Продукт · Маркетинг] 04.10 08:45 разд. 2 (claude/Продукт_знак_налога_контракт_API_даты_ЕГРЮЛ_на_карточке_04.10.md),
# окончательный текст — [Продукт] 10:20 разд. 2 с правками [Право · Юрист 115-ФЗ] 09:20 разд. 5 и 10:15 разд. 3
# (claude/Право_полоса_беты_основатель_вход_Паспорт_ст48_04.10.md). Публично — только даты-факты о компании; «что менялось»
# не пишем (истории с регистрации у нас нет). Строка о руководителе — без ФИО и только после «РКН отправлено»
# (RKN_OTPRAVLENO=1 в окружении сборки): дата записи косвенно относится к человеку (п. 1 ст. 3 152-ФЗ).
# Вход в Паспорт — две половины разметки беты (tests/beta.py): в бете — «бесплатно по {beta_do}», после — цена из
# tarify/tarify.json. Переключили флаг беты → sobrat_shapku.py меняет половины на всех карточках сам.
PASPORT_VHOD_GOAL = "kartochka_pasport_vhod"
PASPORT_VHOD_TEKST = ("Полный Паспорт контрагента: руководитель и" + NB + "учредители, финансы и" + NB + "налоги, предел аванса "
                      "под вашу сумму и" + NB + "документы, которые стоит запросить. У" + NB + "каждого факта" + NB + "— источник и" + NB +
                      "дата, расчёты" + NB + "— по" + NB + "открытой методике.")
# beta-data-v1: дату вписывает сборщик из tarify.json → beta_do (tests/beta.py, sroki), после конца беты span убирает браузер.
PASPORT_VHOD_BETA = "В" + NB + "бете бесплатно<span data-beta-srok></span>" + NB + "→"


def rkn_otpravleno():
    return os.environ.get("RKN_OTPRAVLENO", "") == "1"


# Половины беты (<!--oplata-->…<!--/oplata--><!--v-bete-->…<!--/v-bete-->) — то же, что tests/beta.py (blok/primenit), без
# чтения файлов: модуль подключает API, а там нет tests/beta.py. Совпадение с beta.py проверяет tests/test_kartochki.py.
_BETA_BLOK = re.compile(r"<!--oplata-->(.*?)<!--/oplata-->(?:<!--v-bete-->(.*?)<!--/v-bete-->)?", re.S)
_T_OPL = ("<template data-oplata>", "</template>")
_T_BET = ("<template data-v-bete>", "</template>")


def _beta_snyat(s, t):
    if s.startswith(t[0]) and s.endswith(t[1]):
        s = s[len(t[0]):-len(t[1])].replace(" data-oplata-href=", " href=")
    return s


def _beta_spryatat(s, t):
    return (t[0] + s.replace(" href=", " data-oplata-href=") + t[1]) if s else s


# beta-data-v1: срок беты в тексте — <span data-beta-srok="ГГГГ-ММ-ДД"> по 13 октября</span>, дата — tarify.json → beta_do
# (на сайте — из сборщика, в API — из partials/obolochka.json → "beta_do"). То же, что tests/beta.py → sroki;
# совпадение проверяет tests/test_kartochki.py. После конца дня span убирает браузер (js/shapka.js).
_SROK = re.compile(r'<span data-beta-srok(?:="[^"]*")?( data-beta-vkl)?>[^<]*</span>')
_SROK_STARYJ = re.compile(r"(В&nbsp;бете бесплатно) по&nbsp;\d{1,2}&nbsp;(?:%s)(&nbsp;→)" % "|".join(MESYACY))
_DATA_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def _srok_span(bdo, vkl=False):
    if not bdo or not _DATA_ISO.match(bdo):
        return '<span data-beta-srok%s></span>' % (" data-beta-vkl" if vkl else "")
    g, m, d = (int(x) for x in _DATA_ISO.match(bdo).groups())
    return '<span data-beta-srok="%s"%s> по&nbsp;%d&nbsp;%s%s</span>' % (bdo, " data-beta-vkl" if vkl else "", d, MESYACY[m - 1],
                                                                       " включительно" if vkl else "")


def beta_sroki(txt, bdo=None):
    txt = _SROK_STARYJ.sub(lambda m: m.group(1) + _srok_span(None) + m.group(2), txt)
    return _SROK.sub(lambda m: _srok_span(bdo, bool(m.group(1))), txt)


def beta_poloviny(txt, beta, bdo=None):
    """Привести половины беты к режиму (идемпотентно); bdo — tarify.json → beta_do (None — даты нет)."""
    txt = beta_sroki(txt, bdo)

    def blok(m):
        op, vb = _beta_snyat(m.group(1), _T_OPL), _beta_snyat(m.group(2) or "", _T_BET)
        if beta:
            return "<!--oplata-->" + _beta_spryatat(op, _T_OPL) + "<!--/oplata--><!--v-bete-->" + vb + "<!--/v-bete-->"
        return "<!--oplata-->" + op + "<!--/oplata--><!--v-bete-->" + _beta_spryatat(vb, _T_BET) + "<!--/v-bete-->"
    return _BETA_BLOK.sub(blok, txt)


def data_slovami(d):
    """14 марта 2011 года — с неразрывными пробелами внутри даты."""
    return "%d%s%s%s%d%sгода" % (d.day, NB, MESYACY[d.month - 1], NB, d.year, NB) if d else ""


def skolko_nazad(d, na):
    """«15 лет назад» / «меньше года назад» на дату сборки; дата позже даты сборки — пусто."""
    if not d or not na or d > na:
        return ""
    mes = (na.year - d.year) * 12 + na.month - d.month - (1 if na.day < d.day else 0)
    if mes < 12:
        return "меньше года назад"
    let = mes // 12
    return "%d%s%s назад" % (let, NB, plural(let, "год", "года", "лет"))


def pasport_vhod_html(inn, cena=None):
    """Абзац входа в Паспорт: общий текст + ссылка; ссылка — две половины беты (в бете / после беты)."""
    href = "/pasport/kontragent/?inn=%s" % inn
    a = '<a href="%s" rel="nofollow" data-goal="%s">%%s</a>' % (href, PASPORT_VHOD_GOAL)
    # kartochki-bez-ceny-v1: решение владельца 16.10 «в публичных текстах нет цен» — и в скрытой половине беты тоже
    # (скрытый HTML индексируется; ответ Штаба 18.10 11:35). cena оставлен в подписи — API передаёт его же.
    posle = "Полный Паспорт на" + NB + "дату сделки" + NB + "→"
    return ('<p class="co-daty__vhod">%s <!--oplata-->%s<!--/oplata--><!--v-bete-->%s<!--/v-bete--></p>'
            % (PASPORT_VHOD_TEKST, a % posle, a % PASPORT_VHOD_BETA))


def daty_html(k, cena=None):
    """Блок «Даты из реестра». Нет поля — нет строки; нет ни одной даты — блока нет (Паспорт остаётся в правой колонке)."""
    na = k.get("proverka") or k.get("egrul_data")
    stroki = []
    rd = k.get("reg_date")
    if rd and (not na or rd <= na):
        nz = skolko_nazad(rd, na)
        stroki.append(("Зарегистрирована", data_slovami(rd), nz))
    rs = k.get("rukovodit_s")
    if rs and rkn_otpravleno():
        stroki.append(("Сведения о" + NB + "нынешнем руководителе внесены в" + NB + "ЕГРЮЛ", data_slovami(rs), ""))
    ak = k.get("egrul_aktualno")
    if ak and (not na or ak <= na):
        stroki.append(("Последнее изменение записи в" + NB + "ЕГРЮЛ", data_slovami(ak), ""))  # vozrast-segodnya-v1
    if not stroki:
        return ""
    dl = "".join('<div><dt>%s</dt> <dd><span class="num">%s</span>%s</dd></div>' % (
        z, d, (' <span class="co-daty__p">— %s</span>' % p) if p else "") for z, d, p in stroki)
    return ('<section class="co-sec co-daty" aria-labelledby="daty"><h2 id="daty">Даты из реестра</h2><dl class="co-daty__sp">%s</dl>'
            '%s%s</section>' % (dl, _istochnik_stroka("ЕГРЮЛ", k.get("egrul_data")), pasport_vhod_html(k["inn"], cena)))


# kartochki-daty-v2: на 106 из 142 опубликованных карточек «Последнее изменение записи» = день получения сведений
# (генератор брал «ЕГРЮЛ — на …»; живой /api/check 17.10 у «Газпром переработки»: карточка — 11.10, на деле — 07.10.2026).
# Сведений для настоящей даты в HTML нет — строку снимаем (не проверяли ≠ не нашли). Дата раньше дня сведений больше
# чем на сутки — настоящая (её давали старые ответы API), остаётся.
_IZM_STROKA = re.compile(r'<div><dt>Последнее изменение записи в(?:&nbsp;|\u00a0)ЕГРЮЛ</dt> <dd><span class="num">'
                         r'(\d{1,2})(?:&nbsp;|\u00a0)(\S+?)(?:&nbsp;|\u00a0)(\d{4})(?:&nbsp;|\u00a0)года</span></dd></div>')
_IZM_SVED = re.compile(r'<span class="co-src">ЕГРЮЛ · сведения на (\d{2})\.(\d{2})\.(\d{4})')


def pochinit_izmenenie(t):
    """kartochki-daty-v2: снять «Последнее изменение записи в ЕГРЮЛ», если дата не раньше дня сведений минус сутки
    (это дата получения сведений, а не изменения). Повтор ничего не меняет."""
    m, sv = _IZM_STROKA.search(t), None
    if not m or m.group(2) not in MESYACY:
        return t
    i = t.find('<section class="co-sec co-daty"')
    sv = _IZM_SVED.search(t, i) if i >= 0 else None
    if not sv:
        return t
    d = dt.date(int(m.group(3)), MESYACY.index(m.group(2)) + 1, int(m.group(1)))
    na = dt.date(int(sv.group(3)), int(sv.group(2)), int(sv.group(1)))
    if d >= na - dt.timedelta(days=1):
        t = t[:m.start()] + t[m.end():]
    return t


_DATY_VHOD = re.compile(r'<p class="co-daty__vhod">.*?</p>', re.S)
_DATY_EST = '<section class="co-sec co-daty"'
_DATY_LD = re.compile(r'"foundingDate": "(\d{4}-\d{2}-\d{2})"')
_DATY_SOBRANO = re.compile(r"Страница собрана (\d{1,2})(?:&nbsp;|\u00a0| )(\S+?) (\d{4})\.")
_DATY_INN = re.compile(r'"taxID": "(\d{10})"')
_DATY_KUDA = ('<section class="co-sec" aria-labelledby="fin">', '<section class="co-sec" aria-labelledby="reestry">')
_PASPORT_ASIDE_STAROE = "17 разделов, у каждого источник и дата сведений"
PASPORT_ASIDE_NOVOE = "17 разделов, у каждого факта" + NB + "— источник и дата сведений"


def pochinit_daty(t, cena=None):
    """kartochki-daty-v1: опубликованные карточки — блок «Даты из реестра» (дата регистрации из JSON-LD foundingDate,
    «N лет назад» и «сведения на» — на дату сборки страницы) и свежий абзац входа в Паспорт; в правой колонке —
    «у каждого факта» вместо «у каждого» ([Право] 10:15). Повтор ничего не меняет."""
    t = t.replace(_PASPORT_ASIDE_STAROE, PASPORT_ASIDE_NOVOE)
    inn = _DATY_INN.search(t)
    if _DATY_EST in t:
        return _DATY_VHOD.sub(lambda m: pasport_vhod_html(inn.group(1), cena), t, count=1) if inn else t
    ld, sb = _DATY_LD.search(t), _DATY_SOBRANO.search(t)
    if not (inn and ld and sb) or sb.group(2) not in MESYACY:
        return t
    na = dt.date(int(sb.group(3)), MESYACY.index(sb.group(2)) + 1, int(sb.group(1)))
    blok = daty_html({"inn": inn.group(1), "reg_date": data_iz(ld.group(1)), "proverka": na, "egrul_data": na}, cena)
    if not blok:
        return t
    for kuda in _DATY_KUDA:
        if kuda in t:
            return t.replace(kuda, blok + "\n" + kuda, 1)
    return t


def indeks_v_otchete_html(inn):
    """Блок «Индекс — в полном отчёте» (ТЗ [Продукт · Маркетинг] 03.10 16:50, разд. 2; цель Метрики kartochka_indeks).
    Ссылка — без «#indeks»: на главной такого якоря нет (tests/ssylki.test.js); появится id у блока Индекса — допишем."""
    return ('<section class="co-ind co-ind--wait" aria-label="Индекс Делоскопа"><p class="co-ind__n">Индекс%s— в%sполном отчёте</p>'
            '<div><p class="caption">Балл от 1 до 99 считаем на сегодняшних данных, когда собрано не меньше %d%s%% сведений. '
            'Здесь%s— выводы по фактам на дату карточки.</p><p class="caption"><a href="/?inn=%s" data-goal="kartochka_indeks">'
            'Посчитать Индекс на сегодня ›</a></p></div></section>' % (NB, NB, POROG_INDEKSA, NB, NB, inn))


_IND_STARYJ = re.compile(r'<section class="co-ind co-ind--wait" aria-label="Индекс Делоскопа">.*?</section>', re.S)
_KANON_INN = re.compile(r'<link rel="canonical" href="[^"]*/(\d{10})-')


def pochinit_indeks_blok(t):
    """kartochki-okved-v1: опубликованные карточки («Индекс — считаем») → «Индекс — в полном отчёте». Повтор ничего не меняет."""
    m = _KANON_INN.search(t)
    if not m:
        return t
    return _IND_STARYJ.sub(lambda _: indeks_v_otchete_html(m.group(1)), t, count=1)


UBYTOK_METKA = '<span class="co-ub">убыток</span> '  # пробел — для чтения вслух и копирования; после блока он не виден


def pribyl_yachejka(v):
    """Ячейка «Чистая прибыль»: убыток — словом, а не минусом (минус в таблице легко не заметить); нет года — тире.
    kartochki-v4.2 (ТЗ [Арт-директор] 04.10, разд. 2): «убыток» — подписью над числом (12 px, серым, css/co.css .co-ub),
    число с единицей — одной строкой (неразрывные пробелы из dengi): на 390 px «убыток 45,6 млрд ₽» больше не рвётся."""
    if v is None:
        return "—"
    return (UBYTOK_METKA + dengi(-v)) if v < 0 else dengi(v)


_UB_STARYJ = re.compile(r'<td class="num">убыток (?=\d)')


def pochinit_ubytok(t):
    """kartochki-v4.2: опубликованные карточки — ячейка «убыток 45,6 млрд ₽» → подпись над числом, как у новых.
    Только ячейки таблицы; текст выводов («годом раньше — убыток») не трогаем. Повтор ничего не меняет."""
    return _UB_STARYJ.sub('<td class="num">' + UBYTOK_METKA, t)


def doli_balansa(chasti):
    """Доли пассива методом наибольшего остатка — как js/dinamika.js doliBalansa и Паспорт (balans-edinyj-v1):
    только когда известны все три части и ни одна не меньше нуля; сумма — ровно 100."""
    if len(chasti) != 3 or any(v is None or v < 0 for v in chasti):
        return None
    tot = sum(chasti)
    if tot <= 0:
        return None
    t = [v / tot * 100 for v in chasti]
    p = [math.floor(x) for x in t]
    for i in sorted(range(3), key=lambda i: -(t[i] - p[i]))[:100 - sum(p)]:
        p[i] += 1
    return [("меньше%s1%s%%" % (NB, NB)) if (p[i] < 1 and chasti[i] > 0) else "%d%s%%" % (p[i], NB) for i in range(3)]


def balans_html(k):
    """kartochki-finansy-v1: «На чём держится компания» и «Кто кому должен» — те же строки и подписи, что на экране
    проверки (js/dinamika.js balans-ekran-v1), только факты баланса ГИР БО на 31.12 года, без оценок."""
    b, r = k.get("balans"), k.get("raschety")
    if not b and not r:
        return ""
    h = []
    if b:
        ch = [b["kap"], b["dol"], b["kor"]]
        doli = doli_balansa(ch)
        stroki = []
        if b["kap"] is not None and b["kap"] < 0:
            # kartochki-v4.3: «меньше нуля» — серой подписью 12 px, как «убыток» (МВМ на 360 px — таблица без прокрутки вбок)
            stroki.append("<tr><td>Собственный капитал</td><td class=\"num\">%s</td><td class=\"co-mn\">меньше нуля</td></tr>" % dengi(b["kap"]))
        for i, nazv in enumerate(("Собственный капитал", "Долгосрочные обязательства", "Краткосрочные обязательства")):
            if ch[i] is not None and ch[i] > 0:
                stroki.append("<tr><td>%s</td><td class=\"num\">%s</td><td class=\"num\">%s</td></tr>" % (nazv, dengi(ch[i]), doli[i] if doli else ""))
        if stroki:
            h.append('<h3 class="co-h3">На чём держится компания — баланс на%s31.12.%d</h3><div class="table-wrap"><table class="table">'
                     '<thead><tr><th>Источник средств</th><th>Сумма</th><th>Доля</th></tr></thead><tbody>%s</tbody></table></div>' % (
                         NB, b["god"], "".join(stroki)))
    if r:
        vyr = {x["god"]: x["dohod"] for x in k.get("finansy") or []} if str(k.get("finansy_istochnik") or "").startswith("ГИР БО") else {}
        stroki = []
        for kl, nazv in (("rec", "Фирме должны покупатели"), ("pay", "Фирма должна поставщикам"), ("loan", "Кредиты и займы")):
            v = r.get(kl)
            if v is not None and v > 0:
                vy = vyr.get(r["god"])
                dop = ("%d%s%% выручки за%s%d" % (round(v / vy * 100), NB, NB, r["god"])) if (kl == "loan" and vy and vy > 0) else ""
                stroki.append("<tr><td>%s</td><td class=\"num\">%s</td><td class=\"num\">%s</td></tr>" % (nazv, dengi(v), dop))
        if stroki:
            h.append('<h3 class="co-h3">Кто кому должен — на%s31.12.%d</h3><div class="table-wrap"><table class="table">'
                     '<thead><tr><th>Расчёты</th><th>Сумма</th><th>К выручке</th></tr></thead><tbody>%s</tbody></table></div>' % (
                         NB, r["god"], "".join(stroki)))
    if not h:
        return ""
    god = max(x["god"] for x in (b, r) if x)
    return ('<section class="co-sec" aria-labelledby="bal"><h2 id="bal">Баланс и расчёты</h2>%s'
            '<p class="small">Суммы из бухгалтерской отчётности на конец года, без оценок. Что они значат для сделки — в полном отчёте.</p>%s</section>' % (
                "".join(h), _istochnik_stroka("ГИР БО, бухгалтерская отчётность", dt.date(god, 12, 31))))


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None):
    """kom — библиотека data/kommentarii.json (сайт читает файл сам, API передаёт её же); None — без комментариев.
    cena — цена Паспорта после беты из tarify.json (kartochki-daty-v1; сайт читает файл сам, API передаёт её же)."""
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
        # kartochki-okved-v1: карточка статична, числа на ней нет (решение 03.10 13:35) — «считаем» читалось как сломанная
        # страница; ведём в полный отчёт (ТЗ [Продукт · Маркетинг] 03.10 16:50, разд. 2)
        ind = indeks_v_otchete_html(k["inn"])
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
            # kartochki-v3.10: год уже в подписи («Выручка за 2021») — второй раз в значении не пишем
            znach = dengi(f["znachenie"]) + ((" за%s%d" % (NB, f["god"])) if f.get("god") and not god_v_podpisi(f["zagolovok"], f["god"]) else "")
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
        # v3.8b: ряд ГИР БО — выручка, как в V03
        vyr = str(k.get("finansy_istochnik") or "ГИР БО").startswith("ГИР БО")
        sl = "Выручка" if vyr else "Доход"
        zag = "%s за %d год — %s" % (sl, posl["god"], dengi(posl["dohod"]))
        if len(fin) >= 2 and fin[-2]["dohod"] > 0:
            izm = (posl["dohod"] / fin[-2]["dohod"] - 1) * 100
            # kartochki-v3.8: отчётность старше 2 лет от даты проверки (РЖД, «Газпром нефть» — 2021) — год в заголовке,
            # иначе «за год» читается как «за последний год»
            pg = k.get("proverka")
            za = (" за%s%d%sгод" % (NB, posl["god"], NB)) if (pg and pg.year - posl["god"] > 2) else " за год"
            rod = ("выросла", "снизилась", "почти не изменилась") if vyr else ("вырос", "снизился", "почти не изменился")
            zag = ("%s %s на %d%s%%%s" % (sl, rod[0], round(izm), NB, za)) if izm >= 5 else \
                  ("%s %s на %d%s%%%s" % (sl, rod[1], round(-izm), NB, za)) if izm <= -5 else "%s %s%s" % (sl, rod[2], za)
        # kartochki-finansy-v1: чистая прибыль (строка 2400) — второй колонкой, если в ряду ГИР БО есть хоть один год таблицы
        pr = k.get("pribyl_ryad") or {}
        s_pr = vyr and any(x["god"] in pr for x in fin)
        tab = "".join("<tr><td>%d</td><td class=\"num\">%s</td>%s</tr>" % (
            x["god"], dengi(x["dohod"]), ("<td class=\"num\">%s</td>" % pribyl_yachejka(pr.get(x["god"]))) if s_pr else "") for x in reversed(fin))
        nl = k.get("nalog_prib")
        nl_str = ('<p class="small">Налог на прибыль по отчёту о финансовых результатах за%s%d — %s (текущий и отложенный вместе). '
                  'Это расход по отчётности, а не сумма, уплаченная в бюджет.</p>' % (NB, nl["god"], dengi(nl["znachenie"]))) if (s_pr and nl) else ""
        fin_blok = ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">%s</h2>%s<div class="table-wrap"><table class="table">'
                    '<thead><tr><th>Год</th><th>%s</th>%s</tr></thead><tbody>%s</tbody></table></div>%s%s</section>' % (
                        e(zag).replace("&nbsp;", NB), svg_stolbcy(fin, sl), sl, "<th>Чистая прибыль</th>" if s_pr else "", tab, nl_str,
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
    if fin_blok and fin_blok.endswith("</section>"):
        fin_blok = fin_blok[:-len("</section>")] + otrasl_html(k, normy) + "</section>"
    if fin_blok:
        fin_blok += balans_html(k)
    sos = sosedi_html(k, sosedi, k.get("_eshche"))
    # kartochki-okved-v1 (ТЗ 16:50, разд. 2): строка основного ОКВЭД под заголовком; код — ещё и в крошках (data-okved),
    # чтобы добор опубликованных карточек знал класс для «Похожих» и хаба без пересборки из сведений
    okk = okved_kod(k.get("okved"))
    okved_str = ""
    if okk:
        nz = re.sub(r"\s+", " ", str(k.get("okved_name") or "")).strip()
        okved_str = '\n<p class="caption co-okved">Основной вид деятельности — <span class="num">%s</span>%s · ЕГРЮЛ%s</p>' % (
            okk, (" " + e(nz)) if nz else "", (" · сведения на " + data_korotko(k["egrul_data"])) if k.get("egrul_data") else "")
    daty_blok = daty_html(k, cena)  # kartochki-daty-v1
    if daty_blok:
        daty_blok += "\n"
    podzag = " · ".join(filter(None, ["Действующая", ("работает " + vozr) if mes else "", e(mesto) if mesto else "",
                                      "ИНН " + k["inn"], ("ОГРН " + k["ogrn"]) if k.get("ogrn") else ""]))
    return shablon_v2(primenit_vorota_indeksa("""<!doctype html>
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
<meta property="og:image" content="https://deloskop.ru/oblozhka.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Делоскоп: перед оплатой — проверить, если банк спросил — ответить">
<meta property="og:site_name" content="Делоскоп">
<meta property="og:locale" content="ru_RU">
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
<nav class="co-krosh caption" aria-label="Навигация"{okved_attr}><a href="/">Делоскоп</a> › <a href="/{papka}/">Компании</a>{kr_reg}{kr_razd}</nav>
<header class="co-head">
<h1>{h1}</h1>
<p class="co-sub">{podzag}</p>{okved_str}
<div class="co-act"><a class="btn btn--primary" href="/?inn={inn}">Проверить сейчас — полный отчёт</a><a class="btn btn--secondary" href="/proverit-schet/">Проверить счёт от этой компании</a></div>
</header>
<div class="co-grid">
<div class="co-main">
{ind}
<section class="co-sec" aria-labelledby="korotko"><h2 id="korotko">Коротко о компании</h2><ul class="co-vv">{vv}</ul></section>
{razbor}<section class="co-sec co-pered" aria-labelledby="pered"><h2 id="pered">Перед оплатой</h2><ul>{pered}</ul></section>
{daty}{fin}
<section class="co-sec" aria-labelledby="reestry"><h2 id="reestry">Проверка по реестрам</h2>{stroki}{ne_blok}</section>
{lyudi}
<section class="co-sec co-ogov caption"><p>Сведения — из открытых государственных реестров на указанные даты; выводы — наш расчёт по этим сведениям, а не решение банка или налоговой. Сведения могли измениться после даты: полная проверка на сегодня — <a href="/?inn={inn}">в отчёте</a>.</p><p>Нашли ошибку или не согласны с выводом? Напишите на <a href="mailto:help@deloskop.ru?subject={tema}">help@deloskop.ru</a> — проверим по первоисточнику и исправим.</p><p>Страница собрана {sobrano}.</p></section>
</div>
<div class="co-aside">
<aside class="co-side card"><h2 class="co-h3">Полный отчёт</h2><p class="small">Финансы за пять лет, налоги и долги, разбор Индекса и Паспорт контрагента для печати — и что проверить самим, со ссылками на первоисточники.</p><a class="btn btn--secondary co-w100" href="/?inn={inn}">Открыть отчёт</a></aside>
{sos}
<aside class="co-side card" aria-labelledby="pasport-h"><h2 id="pasport-h" class="co-h3">Паспорт контрагента</h2><p class="small">Документ для папки к сделке: 17 разделов, у каждого факта{nb}— источник и дата сведений, «Чего мы не знаем и почему», PDF с номером и QR проверки подлинности.</p><a class="btn btn--secondary co-w100" href="/pasport/kontragent/?inn={inn}" rel="nofollow">Собрать Паспорт</a></aside>
</div>
</div>
</main>
</body>
</html>
""".format(
        title=e(title(k)), desc=e(description(k, V)).replace("&nbsp;", NB), url=url,
        ld=json.dumps(ld, ensure_ascii=False, sort_keys=True).replace("</", "<\\/"), papka=PAPKA,
        kr_reg=(" › " + e(k["region"])) if k.get("region") else "", kr_razd=(" › " + e(razdel)) if razdel else "",
        h1=e(nm), podzag=podzag, nb=NB, daty=daty_blok, okved_attr=(' data-okved="%s"' % okk) if okk else "", okved_str=okved_str, inn=k["inn"], ind=ind, vv=vv, razbor=razbor_html(k), pered=pered, fin=fin_blok, stroki="".join(stroki),
        ne_blok=ne_blok, lyudi=lyudi, sos=sos, tema=urllib.parse.quote("Ошибка в карточке ИНН " + k["inn"]),
        sobrano=data_tekst(k.get("proverka")) if k.get("proverka") else "")))


# ---------------------------------------------------------------- ворота индексации (kartochki-indeks-v1)
# ТЗ [Продукт · Данные] 03.10 18:55 разд. 3.2 и ответ на ✎ 16:50 (claude/Продукт_волна_5000_карточек_ворота_ответы_✎_03.10.md).
# Ворота публикации (vorota) — как были. Карточка идёт в индекс и в sitemap, только если на самой странице:
#   1) не меньше 6 строк фактов с датой сведений (выводы «Коротко» + строки «Проверка по реестрам») не меньше чем из 3 источников
#      (ЕГРЮЛ, ГИР БО, набор ФНС…; источник блока выручки засчитывается в источники);
#   2) год последней открытой отчётности ≥ 2024;
#   3) есть хотя бы один вывод: «Комментарий команды» под фактом или «что изменилось» год к году в блоке выручки.
# Иначе — `noindex, follow` и не в sitemap. Старше 2024 года выручка не попадает в description (title её и так не несёт),
# а в блоке выручки — подпись о годе последней открытой отчётности. Считаем по готовому HTML: полная сборка, добор
# опубликованных страниц и API (одна функция, вызывается в html_kartochki) дают одно и то же.
GOD_INDEKSA_OT = 2024
FAKTOV_INDEKSA = 6
ISTOCHNIKOV_INDEKSA = 3
ROBOTS_NOINDEX = '<meta name="robots" content="noindex, follow">\n'
_PROB = "(?:&nbsp;|\u00a0| )"
_IND_V = re.compile(r'<li class="co-v [^"]*">.*?<span class="co-src">([^<]*?) · сведения на \d', re.S)
_IND_F = re.compile(r'<span class="fact__src co-src">([^<]*?) · сведения на \d')
_IND_FIN_SRC = re.compile(r'<section class="co-sec" aria-labelledby="fin">.*?<span class="co-src">([^<]*?) · сведения на \d', re.S)
_IND_FIN = re.compile(r'(<h2 id="fin">)([^<]*)(</h2>)')
_IND_TAB = re.compile(r'<tbody><tr><td>(\d{4})</td>')
_IND_DESC = re.compile(r'(<meta (?:name|property)="(?:og:)?description" content="[^"]*?), доход [0-9]+(?:,[0-9]+)?' + _PROB +
                       r'(?:трлн|млрд|млн|тыс\.)' + _PROB + r'₽(?: за' + _PROB + r'\d{4})?')
IND_FIN_PODPIS = "Последняя открытая отчётность — за" + NB + "%d" + NB + "год."


def _ind_semya(ist):
    """«ГИР БО, бухгалтерская отчётность» → «ГИР БО»; «ФНС, открытые данные» → «ФНС»."""
    return re.split(r"[,(·]", html.unescape(ist))[0].strip()


def god_otchetnosti_html(t):
    """Год последней открытой отчётности на карточке: первая строка таблицы выручки, иначе год в заголовке блока; нет — None."""
    m = _IND_TAB.search(t)
    if m:
        return int(m.group(1))
    h = _IND_FIN.search(t)
    g = re.search(r"за" + _PROB + r"(\d{4})", h.group(2)) if h else None
    return int(g.group(1)) if g else None


def vorota_indeksa_html(t):
    """(в индекс, причина) по готовой странице карточки."""
    ist = _IND_V.findall(t) + _IND_F.findall(t)
    if len(ist) < FAKTOV_INDEKSA:
        return False, "фактов с датой %d из %d" % (len(ist), FAKTOV_INDEKSA)
    # источник блока выручки (ряд ГИР БО по годам) — тоже факты о компании с датой; в счёт строк не идёт
    if len({_ind_semya(x) for x in ist + _IND_FIN_SRC.findall(t)}) < ISTOCHNIKOV_INDEKSA:
        return False, "источников меньше %d" % ISTOCHNIKOV_INDEKSA
    g = god_otchetnosti_html(t)
    if g is None or g < GOD_INDEKSA_OT:
        return False, "последняя открытая отчётность — %s (нужна ≥ %d)" % (g or "нет года", GOD_INDEKSA_OT)
    h = _IND_FIN.search(t)
    izm = bool(h and re.search(r"выросл|снизил|не изменил", h.group(2)))
    if '<div class="kom ' not in t and not izm:
        return False, "нет вывода: ни комментария команды, ни изменения год к году"
    return True, "ок"


def noindex_html(t):
    return 'name="robots" content="noindex' in t


def primenit_vorota_indeksa(t):
    """Готовая карточка (тело или страница) → та же карточка с решением ворот индексации. Повторный вызов ничего не меняет."""
    g = god_otchetnosti_html(t)
    if g is not None and g < GOD_INDEKSA_OT:
        # старая выручка — не в сниппет (description и og:description)
        t = _IND_DESC.sub(lambda m: m.group(1), t)
        podpis = IND_FIN_PODPIS % g
        if "co-fin-god" not in t:
            t = _IND_FIN.sub(lambda m: m.group(0) + '<p class="caption co-fin-god">%s</p>' % podpis, t, count=1)
    ok, _ = vorota_indeksa_html(t)
    est = noindex_html(t)
    if not ok and not est:
        i = t.find('<meta name="description"')
        if i >= 0:
            t = t[:i] + ROBOTS_NOINDEX + t[i:]
    elif ok and est:
        t = t.replace(ROBOTS_NOINDEX, "", 1)
    return t


def god_v_podpisi(zagolovok, god):
    """kartochki-v3.10: «Выручка за 2021» уже называет год — значение без второго «за 2021»."""
    return bool(re.search(r"\bза\s+%d\b" % int(god), str(zagolovok or "")))


_GOD_DVAZHDY = re.compile(r'(<div class="fact"><span>[^<]*?за (\d{4})</span><span class="fact__v">[^<]*?) за&nbsp;\2</span>')


def pochinit_god_dvazhdy(t):
    """kartochki-v3.10: та же правка для опубликованных страниц (добор не пересобирает их из сведений)."""
    return _GOD_DVAZHDY.sub(lambda m: m.group(1) + "</span>", t)


# hab-v2 (03.10, [Ночные запуски]; аудит [Продукт] 03.10 разд. 2.4): группировка по разделам ОКВЭД, строка регионов
# и «Как читать карточку». Тексты — только о том, что делает сама карточка (без норм права): правовых формулировок нет.
HAB_NET_OTRASLI = "Отрасль не указана"
HAB_CHITAT = [
    ("Верх карточки", "Статус и возраст компании по ЕГРЮЛ, ИНН и ОГРН. Сверяйте именно ИНН со счётом и договором: "
              "название может совпадать у разных компаний."),
    # kartochki-okved-v1: текст [Продукт · Маркетинг] 03.10 16:50 разд. 2 — дословно
    ("Индекс", "Балл от 1 до 99 по открытой методике. На карточке его нет: считаем в полном отчёте на сегодня, когда собрано "
               "не меньше 60" + NB + "% сведений. <a href=\"/indeks/\">Как считаем</a> · "
               "<a href=\"/tochnost/\">как проверяем точность</a>."),
    ("Коротко о компании", "Главные факты. Под каждым — источник, дата сведений и отметка «подтверждено источником»."),
    # kartochki-v3.10: текст [Право] 03.10 17:07 разд. 4 — дословно (ст. 18 402-ФЗ: срок, кто сдаёт не в налоговую, ограничение доступа)
    ("Дата сведений — не дата страницы", "Годовую бухотчётность компании сдают в налоговую не позднее трёх месяцев после "
               "окончания года — поэтому за прошлый год она появляется в открытом доступе весной. Банки и некоторые другие "
               "организации сдают её не в налоговую, а у части компаний доступ к отчётности ограничен по решению Правительства. "
               "Если свежей нет, показываем последнюю и пишем её год. Долги по налогам — на дату набора ФНС."),
    ("Комментарий команды", "Под строкой реестра — как такой признак видят банк и налоговая и что сделать. "
               "Комментарий общий: это не оценка компании или сделки."),
    ("«Не проверяли» ≠ «не нашли»", "Если источник не ответил, так и пишем. Отсутствие строки не значит, что всё чисто."),
    ("Перед оплатой", "Карточка собрана на дату внизу страницы. Перед платежом сверьте счёт и проверьте компанию на сегодня — "
               "<a href=\"/\">полный отчёт</a> соберём за минуту."),
]


def _ssylka_chitat(zagolovok, statyi):
    adr, txt = HAB_CHITAT_SSYLKI.get(zagolovok, (None, None))
    return ' <a href="%s">%s%s›</a>' % (adr, txt, NB) if adr and adr in statyi else ""


def hab_otrasl(k):
    return _razdel(k) or HAB_NET_OTRASLI


# kartochki-volna-v1 (ТЗ [Продукт · Данные] 03.10 разд. 3.3): хаб /company/ — по 100 карточек на страницу.
# Страница 1 — /company/ (как была); 2…N — /company/stranica/N/: noindex, follow (в sitemap не идут — карточки и так там),
# canonical на себя, ссылки на все страницы. Порядок — тот же, что был у одной страницы: отрасли, внутри — по названию.
HAB_NA_STRANICE = 100
HAB_STRANICA = "stranica"


def _hab_poryadok(kart):
    po_otr = {}
    for k in kart:
        po_otr.setdefault(hab_otrasl(k), []).append(k)
    # порядок: больше карточек — выше; «Отрасль не указана» — всегда последней
    otrasli = sorted(po_otr, key=lambda o: (o == HAB_NET_OTRASLI, -len(po_otr[o]), o))
    return [x for o in otrasli for x in sorted(po_otr[o], key=lambda x: x["name"])]


# kartochki-hab-v3 (ТЗ [Продукт] 23.10 С2): на /company/ — ВСЕ карточки, что стоят в sitemap-companies.xml (до
# HAB_PERVAYA_MAKS), группами по отраслям; внутри группы первые HAB_VIDNO видны, остальные — под <details> (без JS-подгрузки,
# ссылки в HTML). Карточки вне sitemap (noindex или ждут партии) — на /company/stranica/2/… (noindex, follow).
# Масштаб: 10 000+ карточек — первая страница ограничена HAB_PERVAYA_MAKS, дальше несут хабы отраслей и регионов.
HAB_PERVAYA_MAKS = 1000
HAB_VIDNO = 8


def stranicy_haba(kart, na_stranice=HAB_NA_STRANICE, v_sitemap=None, pervaya=None):
    """→ [карточки страницы 1, страницы 2, …] в порядке хаба; пустой список карточек — одна пустая страница.
    v_sitemap — адреса карточек в sitemap: тогда страница 1 = они (до pervaya), страницы 2… — остальные."""
    sp = _hab_poryadok(kart)
    if v_sitemap:
        pervaya = HAB_PERVAYA_MAKS if pervaya is None else pervaya
        pervye = [x for x in sp if adres_str(x) in v_sitemap][:pervaya]
        if pervye:
            est = {id(x) for x in pervye}
            ost = [x for x in sp if id(x) not in est]
            return [pervye] + [ost[i:i + na_stranice] for i in range(0, len(ost), na_stranice)]
    return [sp[i:i + na_stranice] for i in range(0, len(sp), na_stranice)] or [[]]


def adres_stranicy_haba(n):
    return "/%s/" % PAPKA if n <= 1 else "/%s/%s/%d/" % (PAPKA, HAB_STRANICA, n)


def _nav_stranic(n, vsego):
    if vsego <= 1:
        return ""
    sp = []
    for i in range(1, vsego + 1):
        if i == n:
            sp.append('<span aria-current="page">%d</span>' % i)
        else:
            sp.append('<a href="%s">%d</a>' % (adres_stranicy_haba(i), i))
    tuda = []
    if n > 1:
        tuda.append('<a href="%s" rel="prev">‹%sНазад</a>' % (adres_stranicy_haba(n - 1), NB))
    if n < vsego:
        tuda.append('<a href="%s" rel="next">Дальше%s›</a>' % (adres_stranicy_haba(n + 1), NB))
    return '<nav class="co-str caption" aria-label="Страницы списка компаний">%s<span class="co-str__sp">%s</span></nav>' % (
        "".join(tuda), "".join(sp))


# kartochki-v4.5 (✎ [Ночные запуски] 04.10 13:05, ТЗ [Маркетинга] 10:50 разд. 2 — входящая № 2): в «Как читать карточку»
# у пункта об отчётности — ссылка на статью. Ставим, только если статья уже есть на сайте (statyi — от сборщика):
# битой ссылки не будет ни до, ни после выкладки net-otchetnosti-v1.
STATYA_NET_OTCHETNOSTI = "/nalogi/net-otchetnosti-v-otkrytyh-dannyh/"
HAB_CHITAT_SSYLKI = {"Дата сведений — не дата страницы": (STATYA_NET_OTCHETNOSTI, "Почему отчётности может не быть")}


def html_haba(kart, index, n=1, vsego=1, vse=None, kg=None, statyi=frozenset(), v_sitemap=None):
    """Страница n из vsego хаба; kart — карточки этой страницы, vse — все (для описания и строки регионов);
    kg — {(vid, имя): адрес} хабов групп (kartochki-haby-v1): заголовок отрасли и регион — ссылкой на свой хаб;
    statyi — адреса статей сайта, которые уже есть (ссылки HAB_CHITAT_SSYLKI ставим только на них)."""
    vse = kart if vse is None else vse
    kg = kg or {}

    def _s(vid, imya, txt):
        adr = kg.get((vid, imya))
        return '<a href="%s">%s</a>' % (adr, txt) if adr else txt
    po_otr, po_reg = {}, {}
    for k in vse:
        r = k.get("region") or ""
        if r:
            po_reg[r] = po_reg.get(r, 0) + 1
    vse_otr = {hab_otrasl(k) for k in vse}
    for k in _hab_poryadok(kart):
        po_otr.setdefault(hab_otrasl(k), []).append(k)
    otrasli = list(po_otr)  # порядок уже задан _hab_poryadok (по всем карточкам страницы)
    if vse is not kart:
        poryadok = {o: i for i, o in enumerate(dict.fromkeys(hab_otrasl(x) for x in _hab_poryadok(vse)))}
        otrasli = sorted(otrasli, key=lambda o: poryadok.get(o, 0))
    bloki = []
    razdelit = bool(v_sitemap) and n <= 1  # kartochki-hab-v3: все карточки страницы 1, длинные группы — под <details>
    for o in otrasli:
        sp = sorted(po_otr[o], key=lambda x: x["name"])
        # kartochki-okved-v1 (ТЗ 16:50, разд. 2): под названием — «город · ОКВЭД 46.71», если код напечатан на карточке
        li = ['<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (
            adres_str(x), e(x["name"]), " · ".join(filter(None, [e(x.get("gorod") or x.get("region") or ""),
                                                               ("ОКВЭД%s<span class=\"num\">%s</span>" % (NB, okved_kod(x.get("okved"))))
                                                               if okved_kod(x.get("okved")) else ""]))) for x in sp]
        spisok = '<ul class="co-sos co-sos--cols">%s</ul>' % "".join(li)
        if razdelit and len(li) > HAB_VIDNO + 1:
            ostalos = len(li) - HAB_VIDNO
            spisok = ('<ul class="co-sos co-sos--cols">%s</ul><details class="co-esche"><summary>Ещё%s%d%s%s</summary>'
                      '<ul class="co-sos co-sos--cols">%s</ul></details>') % (
                "".join(li[:HAB_VIDNO]), NB, ostalos, NB, plural(ostalos, "компания", "компании", "компаний"),
                "".join(li[HAB_VIDNO:]))
        bloki.append('<section class="co-sec"><h2>%s <span class="caption">%d</span></h2>%s</section>' % (
            _s("otrasl", o, e(o)), len(sp), spisok))
    regiony = ""
    if razdelit:
        # kartochki-hab-v3: отрасль, у которой нет карточек в поиске, без своего раздела — но ссылка на её хаб остаётся
        net = [(imya, adr) for (vid, imya), adr in sorted(kg.items()) if vid == "otrasl" and imya not in po_otr]
        if net:
            regiony = '<p class="co-reg caption">Ещё отрасли: %s.</p>' % " · ".join('<a href="%s">%s</a>' % (adr, e(imya)) for imya, adr in net)
    if po_reg and n <= 1:
        regiony = regiony + '<p class="co-reg caption">Группы — по основному виду деятельности в ЕГРЮЛ (раздел ОКВЭД%s2). По регионам: %s.</p>' % (NB, " · ".join(
            "%s%s—%s%d" % (_s("region", r, e(r)), NB, NB, c) for r, c in sorted(po_reg.items(), key=lambda x: (-x[1], x[0]))))
    chitat = ('<section class="co-sec co-chit" id="kak-chitat"><h2>Как читать карточку</h2><ol class="co-chit__sp">%s</ol>'
              '<p class="caption">Сведения — из открытых государственных реестров на указанные даты; выводы — наш расчёт по этим '
              'сведениям, а не решение банка или налоговой. Средняя налоговая нагрузка по отраслям — '
              '<a href="/nalogi/nagruzka-po-otraslyam-2025/#nagruzka">таблица ФНС</a>. Нашли ошибку — '
              '<a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</p></section>') % "".join(
        "<li><b>%s.</b> %s%s</li>" % (e(z), tekst, _ssylka_chitat(z, statyi)) for z, tekst in HAB_CHITAT)
    n_otr = len([o for o in vse_otr if o != HAB_NET_OTRASLI])
    t = "Компании в Делоскопе: проверка по ИНН — Делоскоп"
    # kartochki-hab-v3: число — карточек в поиске (= ссылок на странице 1), а не всех опубликованных
    n_k = len(kart) if razdelit else len(vse)
    d = "%d %s%s с выводами по открытым реестрам: доходы, штат, налоги и долги — у каждой цифры источник и дата сведений." % (
        n_k, plural(n_k, "компания", "компании", "компаний"),
        (" из %d %s" % (n_otr, plural(n_otr, "отрасли", "отраслей", "отраслей"))) if n_otr > 1 else "")
    robots = "" if (index and n <= 1) else '<meta name="robots" content="noindex, follow">\n'
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Делоскоп", "item": SAJT + "/"},
        {"@type": "ListItem", "position": 2, "name": "Компании", "item": "%s/%s/" % (SAJT, PAPKA)}]}
    h1, krosh, lead = "Компании", "Компании", (
        'Карточки компаний с выводами по открытым госреестрам. Каждая цифра — с источником и датой сведений. Нет нужной '
        'компании — проверьте её по ИНН на <a href="/">главной</a>: отчёт соберём за минуту. <a href="#kak-chitat">Как читать карточку ›</a>')
    ld2 = ""
    if razdelit:
        h1 = "%d%s%s в%sДелоскопе" % (n_k, NB, plural(n_k, "компания", "компании", "компаний"), NB)
        sp_ld = [x for o in otrasli for x in sorted(po_otr[o], key=lambda x: x["name"])]
        ld2 = json.dumps({"@context": "https://schema.org", "@type": "CollectionPage", "name": "Компании в Делоскопе",
                          "url": "%s/%s/" % (SAJT, PAPKA), "inLanguage": "ru",
                          "mainEntity": {"@type": "ItemList", "numberOfItems": len(sp_ld), "itemListElement": [
                              {"@type": "ListItem", "position": i, "url": SAJT + adres_str(x), "name": x["name"]}
                              for i, x in enumerate(sp_ld, 1)]}}, ensure_ascii=False, separators=(",", ":"))
        ld2 = '\n<script type="application/ld+json">%s</script>' % ld2.replace("</", "<\\/")
    if n > 1:
        t = "Компании в Делоскопе — страница %d из %d" % (n, vsego)
        d = "%s Страница %d из %d." % (d, n, vsego)
        h1 = "Компании — страница%s%d из%s%d" % (NB, n, NB, vsego)
        krosh = '<a href="/%s/">Компании</a> › Страница%s%d' % (PAPKA, NB, n)
        lead = ('Продолжение списка карточек компаний. Нет нужной — проверьте её по ИНН на <a href="/">главной</a>. '
                '<a href="/%s/#kak-chitat">Как читать карточку%s›</a>' % (PAPKA, NB))
        if v_sitemap:
            lead = ('Карточки, которых пока нет в поиске: новые ждут своей очереди в карте сайта, по части компаний в открытых '
                    'реестрах мало сведений. Нет нужной — проверьте её по ИНН на <a href="/">главной</a>. '
                    '<a href="/%s/#kak-chitat">Как читать карточку%s›</a>' % (PAPKA, NB))
        chitat = ""
        ld["itemListElement"].append({"@type": "ListItem", "position": 3, "name": "Страница %d" % n,
                                      "item": SAJT + adres_stranicy_haba(n)})
    nav = _nav_stranic(n, vsego)
    return """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
{robots}<meta name="description" content="{d}">
<link rel="canonical" href="{sajt}{kanon}">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/ds.css">
<link rel="stylesheet" href="/css/co.css">
<script type="application/ld+json">{ld}</script>{ld2}
</head>
<body class="co">
<!--shapka--><!--/shapka-->
<main id="main" class="wrap co-wrap">
<nav class="co-krosh caption" aria-label="Навигация"><a href="/">Делоскоп</a> › {krosh}</nav>
<header class="co-head"><h1>{h1}</h1><p class="lead">{lead}</p>{regiony}</header>
{bloki}
{nav}{chitat}
</main>
</body>
</html>
""".format(t=e(t), robots=robots, d=e(d), sajt=SAJT, kanon=adres_stranicy_haba(n), bloki="".join(bloki), regiony=regiony,
           chitat=chitat, nav=nav + ("\n" if nav else ""), h1=h1, krosh=krosh, lead=lead, ld2=ld2,
           ld=json.dumps(ld, ensure_ascii=False, separators=(",", ":")))


# ---------------------------------------------------------------- kartochki-haby-v1: хабы отраслей и регионов
# ТЗ [Продукт · Данные] 03.10 разд. 3.3 и hab-v2: «Хаб региона или раздела ОКВЭД появляется, когда в нём ≥ 30 карточек».
# /company/otrasl/<slug>/ — раздел ОКВЭД (основной вид деятельности в ЕГРЮЛ), /company/region/<slug>/ — регион по адресу
# в ЕГРЮЛ. Меньше HAB_GRUPPY_OT опубликованных карточек — страницы нет вовсе (тонкий список — риск «малоценных»), ссылок
# на неё тоже нет. В индекс и sitemap-companies — только когда ≥ HAB_GRUPPY_OT карточек группы сами за воротами
# индексации (то же правило, что перевод /company/ в index — тестом по sitemap); иначе noindex, follow. По 100 карточек
# на страницу, страницы 2…N — noindex, follow. Ссылки: заголовки отраслей и строка регионов хаба /company/, звенья
# «регион» и «раздел» в крошках карточек. Тексты — только о том, что делает страница (без норм права).
HAB_GRUPPY_OT = 30
GRUPPY_VIDY = ("otrasl", "region")


def region_polnyj(r):
    """«Челябинская обл» → «Челябинская область», «Респ Татарстан» → «Республика Татарстан» (только вид, не смысл)."""
    s = str(r or "").strip()
    s = re.sub(r"\bобл\.?$", "область", s)
    s = re.sub(r"^Респ\.?\s", "Республика ", s)
    s = re.sub(r"\sРесп\.?$", " Республика", s)
    return s


def gruppa_karty(k, vid):
    if vid == "otrasl":
        o = hab_otrasl(k)
        return "" if o == HAB_NET_OTRASLI else o
    return k.get("region") or ""


def gruppy_haba(vse, ot=None):
    """→ [{vid, imya, slug, kart}] — группы с ≥ ot опубликованных карточек; порядок и адреса детерминированы."""
    ot = HAB_GRUPPY_OT if ot is None else ot
    out = []
    for vid in GRUPPY_VIDY:
        po = {}
        for k in vse:
            g = gruppa_karty(k, vid)
            if g:
                po.setdefault(g, []).append(k)
        zanyato = set()
        for imya in sorted(po, key=lambda x: (-len(po[x]), x)):
            if len(po[imya]) < ot:
                continue
            s = slug(region_polnyj(imya) if vid == "region" else imya)
            s0, i = s, 2
            while s in zanyato:
                s, i = "%s-%d" % (s0, i), i + 1
            zanyato.add(s)
            out.append({"vid": vid, "imya": imya, "slug": s, "kart": sorted(po[imya], key=lambda x: (x["name"], x["inn"]))})
    return out


def adres_gruppy(g, n=1):
    base = "/%s/%s/%s/" % (PAPKA, g["vid"], g["slug"])
    return base if n <= 1 else "%s%s/%d/" % (base, HAB_STRANICA, n)


def karta_grupp(gruppy):
    """{(vid, имя): адрес} — для ссылок из хаба и крошек."""
    return {(g["vid"], g["imya"]): adres_gruppy(g) for g in gruppy}


def _nav_obshij(n, vsego, adres, metka):
    if vsego <= 1:
        return ""
    sp = [('<span aria-current="page">%d</span>' % i) if i == n else ('<a href="%s">%d</a>' % (adres(i), i))
          for i in range(1, vsego + 1)]
    tuda = []
    if n > 1:
        tuda.append('<a href="%s" rel="prev">‹%sНазад</a>' % (adres(n - 1), NB))
    if n < vsego:
        tuda.append('<a href="%s" rel="next">Дальше%s›</a>' % (adres(n + 1), NB))
    return '<nav class="co-str caption" aria-label="%s">%s<span class="co-str__sp">%s</span></nav>' % (
        metka, "".join(tuda), "".join(sp))


def _li_haba(x, s_otraslyu=False):
    podpis = [e(x.get("gorod") or x.get("region") or "")]
    if s_otraslyu and hab_otrasl(x) != HAB_NET_OTRASLI:
        podpis.append(e(hab_otrasl(x)))
    if okved_kod(x.get("okved")):
        podpis.append("ОКВЭД%s<span class=\"num\">%s</span>" % (NB, okved_kod(x.get("okved"))))
    return '<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (
        adres_str(x), e(x["name"]), " · ".join(filter(None, podpis)))


def stranicy_gruppy(g, na_stranice=None):
    na = na_stranice or HAB_NA_STRANICE
    sp = g["kart"]
    return [sp[i:i + na] for i in range(0, len(sp), na)] or [[]]


def title_gruppy(g):
    imya = region_polnyj(g["imya"]) if g["vid"] == "region" else g["imya"]
    t = ("Компании: %s — проверка по ИНН" % imya) if g["vid"] == "region" else ("%s: компании — проверка по ИНН" % imya)
    return t + " — Делоскоп" if len(t) + len(" — Делоскоп") <= 70 else t


def html_gruppy(g, kart, index, n=1, vsego=1):
    """Страница n из vsego хаба группы g; kart — карточки страницы."""
    vsego_k = len(g["kart"])
    kom = "%d%s%s" % (vsego_k, NB, plural(vsego_k, "компания", "компании", "компаний"))
    if g["vid"] == "region":
        imya = region_polnyj(g["imya"])
        h1 = "Компании: %s" % e(imya)
        lead = ("%s, у которых адрес в ЕГРЮЛ — %s. Сгруппированы по основному виду деятельности. " % (kom, e(imya)))
        d = "%s в Делоскопе, адрес в ЕГРЮЛ — %s: доходы, штат, налоги и долги, у каждой цифры источник и дата сведений." % (kom, imya)
        po = {}
        for x in kart:
            po.setdefault(hab_otrasl(x), []).append(x)
        otr = sorted(po, key=lambda o: (o == HAB_NET_OTRASLI, -len(po[o]), o))
        bloki = "".join('<section class="co-sec"><h2>%s <span class="caption">%d</span></h2><ul class="co-sos co-sos--cols">%s</ul></section>' % (
            e(o), len(po[o]), "".join(_li_haba(x) for x in po[o])) for o in otr)
    else:
        imya = g["imya"]
        h1 = e(imya)
        lead = ("%s, у которых основной вид деятельности в ЕГРЮЛ — из раздела «%s» (ОКВЭД%s2). " % (kom, e(imya), NB))
        d = "%s в Делоскопе с основным видом деятельности «%s»: доходы, штат, налоги и долги — с источником и датой сведений." % (kom, imya)
        bloki = '<section class="co-sec"><ul class="co-sos co-sos--cols">%s</ul></section>' % "".join(_li_haba(x) for x in kart)
    lead += ('У каждой цифры на карточке — источник и дата сведений. Нет нужной компании — проверьте её по ИНН на '
             '<a href="/">главной</a>. <a href="/%s/#kak-chitat">Как читать карточку%s›</a>' % (PAPKA, NB))
    t = title_gruppy(g)
    if len(d) > 160:
        d = d[:157].rsplit(" ", 1)[0] + "…"
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Делоскоп", "item": SAJT + "/"},
        {"@type": "ListItem", "position": 2, "name": "Компании", "item": "%s/%s/" % (SAJT, PAPKA)},
        {"@type": "ListItem", "position": 3, "name": imya, "item": SAJT + adres_gruppy(g)}]}
    krosh = '<a href="/%s/">Компании</a> › %s' % (PAPKA, e(imya))
    if n > 1:
        t = "%s — страница %d из %d" % (imya if g["vid"] == "otrasl" else "Компании: " + imya, n, vsego)
        d = "%s Страница %d из %d." % (d.rstrip("…"), n, vsego) if len(d) < 140 else d
        h1 = "%s — страница%s%d из%s%d" % (h1, NB, n, NB, vsego)
        krosh = '<a href="/%s/">Компании</a> › <a href="%s">%s</a> › Страница%s%d' % (PAPKA, adres_gruppy(g), e(imya), NB, n)
        ld["itemListElement"].append({"@type": "ListItem", "position": 4, "name": "Страница %d" % n,
                                      "item": SAJT + adres_gruppy(g, n)})
    robots = "" if (index and n <= 1) else '<meta name="robots" content="noindex, follow">\n'
    nav = _nav_obshij(n, vsego, lambda i: adres_gruppy(g, i), "Страницы списка компаний")
    return """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
{robots}<meta name="description" content="{d}">
<link rel="canonical" href="{sajt}{kanon}">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/ds.css">
<link rel="stylesheet" href="/css/co.css">
<script type="application/ld+json">{ld}</script>
</head>
<body class="co">
<!--shapka--><!--/shapka-->
<main id="main" class="wrap co-wrap">
<nav class="co-krosh caption" aria-label="Навигация"><a href="/">Делоскоп</a> › {krosh}</nav>
<header class="co-head"><h1>{h1}</h1><p class="lead">{lead}</p></header>
{bloki}
{nav}</main>
</body>
</html>
""".format(t=e(t), robots=robots, d=e(d), sajt=SAJT, kanon=adres_gruppy(g, n), krosh=krosh, h1=h1, lead=lead,
           bloki=bloki, nav=nav + ("\n" if nav else ""), ld=json.dumps(ld, ensure_ascii=False, separators=(",", ":")))


_KROSH_KART = re.compile(r'(<nav class="co-krosh caption" aria-label="Навигация"[^>]*><a href="/">Делоскоп</a> › '
                         r'<a href="/%s/">Компании</a>)((?: › (?:<a href="[^"]*">)?[^<›]*(?:</a>)?)*)(</nav>)' % PAPKA)


def ssylki_kroshek(t, kg):
    """Звенья «регион» и «раздел ОКВЭД» в крошках карточки — ссылкой на хаб группы, если он есть; иначе текстом.
    Повторный вызов с теми же группами ничего не меняет; хаб пропал — ссылка снимается."""
    def zamena(m):
        zvenya = [z for z in m.group(2).split(" › ") if z]
        out = []
        for z in zvenya:
            imya = html.unescape(re.sub(r"<[^>]+>", "", z)).strip()
            vid = "otrasl" if imya in {t_ for _, _, t_ in OKVED_RAZDELY} else "region"
            adr = kg.get((vid, imya))
            out.append('<a href="%s">%s</a>' % (adr, e(imya)) if adr else e(imya))
        return m.group(1) + "".join(" › " + z for z in out) + m.group(3)
    return _KROSH_KART.sub(zamena, t, count=1)


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
def kartochka_iz_check(zapis, sosedi=(), kom=None, normy=None, cena=None):
    """Ответ /api/check → (годится, причина, адрес, html без оболочки).

    Те же ворота, что у статичной волны (vorota): не прошла — (False, причина, None, None), и API отвечает 404.
    ИП (ИНН из 12 цифр) отбрасывается до всякой обработки, как в otobrat. sosedi — уже разобранные
    карточки (iz_check) для блока «Похожие»; пусто — блока нет. kom — библиотека data/kommentarii.json сайта
    (как partials/obolochka.json): без неё карточка API выйдет без «Комментария команды» и не совпадёт с файлом волны.
    normy — «nagruzka» из data/fns-normy-2025.json (v3.8b)."""
    inn = re.sub(r"\D", "", str(((zapis.get("company") or {}).get("inn")) or zapis.get("inn") or ""))
    if len(inn) == 12:
        return False, "не юрлицо или неверный ИНН", None, None
    k = iz_check(zapis)
    V = vyvody(k)
    ok, pr = vorota(k, V)
    if not ok:
        return False, pr, None, None
    vse_ = list(sosedi)
    sos_ = pohozhie(k, vse_)
    k["_eshche"] = eshche_kompanii(k, vse_, sos_)  # kartochki-shablon-v1: как у статичной волны — не меньше 5 ссылок
    return True, pr, adres_str(k), html_kartochki(k, V, sos_, kom, normy, cena)


# ---------------------------------------------------------------- оболочка для API (obolochka-v1)
OBOLOCHKA_METKA = "<!--shapka--><!--/shapka-->"


def nadet_obolochku(telo, ob):
    """HTML карточки (kartochka_iz_check) + оболочка сайта (partials/obolochka.json) → готовая страница.

    Три вставки — те же, что делает tests/sobrat_shapku.py → sobrat_stranicu: ссылки и метка режима — перед </head>,
    шапка (и полоса беты) — на место метки, подвал — перед последним </body>. Совпадение байт в байт со статичной
    карточкой проверяет tests/test_kartochki.py. Нет метки или </head> — None (API отвечает 503, а не кривой страницей)."""
    if not telo or OBOLOCHKA_METKA not in telo or "</head>" not in telo or "</body>" not in telo:
        return None
    t = beta_poloviny(telo, bool(ob.get("beta")), ob.get("beta_do"))  # kartochki-daty-v1: вход в Паспорт — половина по режиму, как на сайте
    t = t.replace("</head>", ob["head"] + "</head>", 1)
    t = t.replace(OBOLOCHKA_METKA, ob["shapka"], 1)
    i = t.rfind("</body>")
    return t[:i] + ob["podval"] + t[i:]


# ---------------------------------------------------------------- «Что это значит для вас» (kartochki-znachit-v1, [Ночные-2] 11.10)
# П. 6 шаблона карточки [Продукт · Яндекс] 11.10 14:40 и идея 2 [Тестировщика] 10.10: блок ≥ 60 слов из фактов ЭТОЙ компании
# (динамика, прибыль, капитал, налоги, смена руководителя, давность отчётности), а не из общих фраз. Тела карточек совпадали
# с соседями по предложениям на 73–92 % (общие оговорки и «Перед оплатой») — «шаблон без содержания» для Яндекса.
# Источник фактов — сама собранная страница (выводы «Коротко», таблица выручки и прибыли, JSON-LD), а не сведения API:
# блок одинаково встаёт на новые карточки (обёртка html_kartochki ниже) и на опубликованные (kartochki.py, добор и
# perepechatat) без повторного запроса к API. Повторный вызов ничего не меняет. Без оценок компании (STOP_SLOVA), без норм
# права и обещаний исхода; советы — о порядке оплаты и документах, как в «Перед оплатой». ✎ [Право] — формулировки.
ZN_MIN_SLOV = 60
ZN_MNOZH = {"трлн": 1e12, "млрд": 1e9, "млн": 1e6, "тыс.": 1e3}

_ZN_BLOK = re.compile(r'<section class="co-sec co-znachit"[^>]*>.*?</section>\n?', re.S)
_ZN_KUDA = '<section class="co-sec co-pered"'
_ZN_LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
_ZN_V = re.compile(r'<li class="co-v co-v--(ok|warn|info)">.*?<p>(.*?)</p>', re.S)
_ZN_KOROTKO = re.compile(r'<section class="co-sec" aria-labelledby="korotko">.*?</section>', re.S)
_ZN_FIN = re.compile(r'<section class="co-sec" aria-labelledby="fin">.*?</section>', re.S)
_ZN_STROKA = re.compile(r"<tr><td>(\d{4})</td><td class=\"num\">([^<]*)</td>(?:<td class=\"num\">(.*?)</td>)?</tr>", re.S)
_ZN_DOHOD_H2 = re.compile(r'<h2 id="fin">Доход(?: за[ \u00a0](\d{4})[ \u00a0]год)? — ([^<]*)</h2>')
_ZN_SVEDENIYA = re.compile(r"ЕГРЮЛ · сведения на (\d{2})\.(\d{2})\.(\d{4})")
_ZN_SUMMA = re.compile(r"(\d+(?:,\d+)?)\s*(трлн|млрд|млн|тыс\.)?\s*₽")
_ZN_OTRASL = re.compile(r'<p class="small co-otr">Средняя налоговая нагрузка в отрасли «(.*?)» за\s*(\d{4})\s*год — (\d+(?:,\d+)?)')


def _zn_txt(s):
    """Фрагмент разметки → текст с обычными пробелами."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or "")).replace(NB, " ")).strip()


def zn_summa(s):
    """«36,6 млрд ₽» → 36 600 000 000.0; «убыток 9,8 млрд ₽» → −9 800 000 000.0; нет числа → None."""
    t = _zn_txt(s)
    m = _ZN_SUMMA.search(t)
    if not m:
        return None
    v = float(m.group(1).replace(",", ".")) * ZN_MNOZH.get(m.group(2), 1)
    return -v if "убыток" in t else v


def _zn_proc(x):
    v = abs(x) * 100
    t = ("%.1f" % v).rstrip("0").rstrip(".") if v < 10 else "%d" % round(v)
    return t.replace(".", ",") + NB + "%"


def _zn_let(n):
    return "%d%s%s" % (n, NB, plural(n, "год", "года", "лет"))


def zn_fakty(t):
    """Факты со страницы карточки → dict (пустой — не карточка)."""
    t = t.replace("&nbsp;", NB)
    f = {"imya": "", "osnovana": None, "na": None, "V": [], "ryad": [], "otrasl": None}
    for blok in _ZN_LD.findall(t):
        if '"@type": "Organization"' in blok:
            org = blok[blok.index('"@type": "Organization"'):]
            n = re.search(r'"name": "([^"]*)"', org)
            d = re.search(r'"foundingDate": "(\d{4})-(\d{2})-(\d{2})"', org)
            f["imya"] = n.group(1).replace('\\"', '"') if n else ""
            f["osnovana"] = dt.date(*map(int, d.groups())) if d else None
            i = re.search(r'"taxID": "(\d{10})"', org)
            f["inn"] = i.group(1) if i else ""
    sv = [dt.date(int(g), int(mm), int(dd)) for dd, mm, g in _ZN_SVEDENIYA.findall(t)]
    f["na"] = max(sv) if sv else None
    k = _ZN_KOROTKO.search(t)
    if k:
        f["V"] = [(ton, _zn_txt(p)) for ton, p in _ZN_V.findall(k.group(0))]
    fin = _ZN_FIN.search(t)
    if fin:
        ryad = []
        for g, d, p in _ZN_STROKA.findall(fin.group(0)):
            dv = zn_summa(d)
            if dv:
                ryad.append({"god": int(g), "dohod": dv, "pribyl": zn_summa(p) if p and _zn_txt(p) != "—" else None})
        if not ryad:
            h = _ZN_DOHOD_H2.search(fin.group(0))
            if h and zn_summa(h.group(2)):
                ryad = [{"god": int(h.group(1)) if h.group(1) else None, "dohod": zn_summa(h.group(2)), "pribyl": None, "fns": True}]
        f["ryad"] = sorted(ryad, key=lambda x: x["god"] or 0)
        o = _ZN_OTRASL.search(fin.group(0))
        if o:
            f["otrasl"] = (_zn_txt(o.group(1)), int(o.group(2)), o.group(3))
    return f


def _zn_v(f, ton, nachalo):
    """Первый вывод «Коротко» с тоном ton, текст которого начинается с nachalo, или None."""
    return next((x for t, x in f["V"] if t == ton and x.startswith(nachalo)), None)


def _zn_nb(s):
    """Числа с единицами и «за 2025» — неразрывно, как в остальной карточке."""
    s = re.sub(r"(\d) (трлн|млрд|млн|тыс\.|%|₽|год|года|лет)", lambda m: m.group(1) + NB + m.group(2), s)
    s = re.sub(r"(трлн|млрд|млн|тыс\.) ₽", lambda m: m.group(1) + NB + "₽", s)
    return re.sub(r"\b(за|с|на|в|до) (\d)", lambda m: m.group(1) + NB + m.group(2), s, flags=re.I)


def zn_frazy(f):
    """Список предложений блока (без HTML). Пусто — блока нет: на странице нет выручки или имени."""
    ryad = [x for x in f["ryad"] if x.get("dohod") and x["dohod"] > 0]
    if not f["imya"] or not ryad:
        return []
    out = []
    na = f["na"]
    p1 = ryad[-1]
    g1, r1, pr1 = p1["god"], p1["dohod"], p1.get("pribyl")
    p0 = ryad[-2] if len(ryad) >= 2 and ryad[-2]["god"] == (g1 or 0) - 1 else None
    za = ("за %d год" % g1) if g1 else "за последний год"

    # 1. История в реестре — с какого года и сколько лет открытой отчётности на странице
    if f["osnovana"] and na:
        mes = (na.year - f["osnovana"].year) * 12 + na.month - f["osnovana"].month - (na.day < f["osnovana"].day)
        let = mes // 12
        ruk = _zn_v(f, "ok", "Руководитель тот же")
        ruk_s = re.search(r"с (\d{4}) года", ruk or "")
        t = "%s — в реестре с %d года" % (f["imya"], f["osnovana"].year)
        if let >= 1:
            t += " (%s)" % _zn_let(let)
        if ruk_s:
            t += ", руководитель не менялся с %s года" % ruk_s.group(1)
        if len(ryad) >= 3 and not p1.get("fns"):
            t += "; в открытых данных — отчётность за %s, с %d по %d год" % (_zn_let(len(ryad)), ryad[0]["god"], g1)
            t += ": по ней видно, как компания прошла последние годы, а не один удачный или неудачный год."
        elif let < 3:
            t += ": история короткая, поэтому оплату вперёд лучше ограничить и платить частями по факту поставки."
        else:
            t += "."
        out.append(t)

    # 2. Деньги: убыток / капитал / падение прибыли или выручки / прибыль — что это меняет в условиях оплаты
    kap = re.search(r"минус ([^:]+):", _zn_v(f, "warn", "Собственный капитал") or "")
    ub = _zn_v(f, "warn", "Убыток за")
    podryad = re.search(r"(\S+) год подряд", ub or "")
    dl = (r1 / p0["dohod"] - 1) if p0 else None
    if pr1 is not None and pr1 < 0:
        t = "%s компания получила убыток %s" % (za.capitalize(), dengi(-pr1))
        if podryad:
            t += " (%s год подряд)" % podryad.group(1)
        t += " при выручке %s" % dengi(r1)
        if kap:
            t += ", а обязательства больше активов на %s" % kap.group(1).strip()
        t += (": если платите вперёд, привяжите оплату к поставке или этапам работ — по отчётности у компании нет "
              "запаса, из которого она вернула бы аванс без новых денег." if kap else
              ": крупный аванс лучше разбить на этапы и платить по факту поставки, а в договоре прописать срок возврата "
              "предоплаты.")
        out.append(t)
    elif kap:
        out.append("Обязательства компании больше её активов на %s (баланс на 31.12.%s): если платите вперёд, привяжите "
                   "оплату к поставке или этапам работ." % (kap.group(1).strip(), g1))
    elif pr1 is not None and p0 and p0.get("pribyl") and p0["pribyl"] > 0 and pr1 <= p0["pribyl"] * 0.7:
        t = "Прибыль %s — %s, на %s меньше, чем годом раньше" % (za, dengi(pr1), _zn_proc(1 - pr1 / p0["pribyl"]))
        if dl is not None and abs(dl) >= 0.05:
            t += ", при выручке, %s на %s" % ("выросшей" if dl > 0 else "снизившейся", _zn_proc(dl))
        t += ": под крупный аванс попросите поэтапную оплату или аккредитив и спросите у %s, с чем связано падение." % im
        out.append(t)
    elif dl is not None and dl <= -0.3:
        out.append("Выручка %s — %s, на %s меньше, чем годом раньше: спросите компанию о причине и уточните, хватит ли "
                   "ей людей и мощностей на ваш объём." % (za, dengi(r1), _zn_proc(dl)))
    elif pr1 is not None and pr1 > 0:
        m1 = pr1 / r1
        t = "%s компания заработала %s чистой прибыли при выручке %s — %s выручки" % (
            za.capitalize(), dengi(pr1), dengi(r1), _zn_proc(m1))
        if p0 and p0.get("pribyl") and p0["pribyl"] > 0:
            m0 = p0["pribyl"] / p0["dohod"]
            t += " (годом раньше — %s)" % _zn_proc(m0)
        t += ": условия оплаты можно обсуждать обычные — по списку ниже."
        out.append(t)
    else:
        t = "Выручка %s — %s" % (za, dengi(r1))
        if dl is not None and abs(dl) >= 0.05:
            t += ", на %s %s, чем годом раньше" % (_zn_proc(dl), "больше" if dl > 0 else "меньше")
        t += (". Чистой прибыли в открытой отчётности на этой странице нет — до крупной оплаты попросите у компании отчёт "
              "о финансовых результатах за %d год." % g1 if g1 else
              ". До крупной оплаты попросите у компании отчёт о финансовых результатах за последний год.")
        out.append(t)

    # 3. Давность отчётности
    if g1 and na and na.year - g1 >= 2:
        out.append("У %s последняя открытая отчётность — за %d год, о %d годе она ничего не говорит: до подписания "
                   "договора попросите у компании бухгалтерскую отчётность за %d год." % (f["imya"], g1, na.year - 1, na.year - 1))

    # 4. Налоги и руководитель — по выводам «Коротко»
    nd = _zn_v(f, "warn", "Задолженность перед бюджетом")
    if nd:
        m = re.search(r"— (.*?) на (\d.*?\d{4})", nd)
        if m:
            out.append("В данных ФНС на %s у компании была задолженность перед бюджетом — %s: попросите справку "
                       "об исполнении обязанности по уплате налогов на свежую дату." % (m.group(2), m.group(1)))
    else:
        up = _zn_v(f, "ok", "Уплатила налогов и взносов")
        bez = _zn_v(f, "ok", "Налоговой задолженности")
        m = re.search(r"— (.*?)(?: за (\d{4}))?$", up or "")
        d = re.search(r"\(на (.*?)\)", bez or "")
        if m and d:
            out.append("%s компания уплатила налогов и взносов на %s, а задолженности перед бюджетом в данных ФНС на %s "
                       "у неё не было." % (("За %s год" % m.group(2)) if m.group(2) else "За год", m.group(1), d.group(1)))
    sm = _zn_v(f, "warn", "Руководитель сменился")
    if sm:
        out.append("У %s %s — убедитесь, что договор подписывает действующий руководитель или представитель по "
                   "доверенности от него." % (f["imya"], sm[0].lower() + sm[1:]))

    # 5. Масштаб: средняя выручка в месяц — чтобы соотнести с суммой своей сделки
    # kartochki-imya-v1: сумма и название — в самом совете (было «с этой суммой… для компании» — одна фраза на всех карточках)
    out.append("Для масштаба: %s компания получала в среднем %s выручки в месяц. Если ваша сделка сопоставима с %s "
               "или больше, для %s она крупная — запросите свежую отчётность и проверьте, кто подписывает договор."
               % (za, dengi(r1 / 12), dengi(r1 / 12), f["imya"]))

    # 6. Мало слов — строка отрасли (ФНС), если она есть на странице
    if sum(len(x.split()) for x in out) < ZN_MIN_SLOV and f["otrasl"]:
        nz, god, proc = f["otrasl"]
        out.append("Средняя налоговая нагрузка в отрасли «%s» за %d год — %s %% по данным ФНС: с ней можно сравнить "
                   "налоги компании в полном отчёте." % (nz, god, proc))
    out = [_zn_nb(x) for x in out]
    for x in out:
        assert not STOP_SLOVA.search(x), x
    return out


# kartochki-unik-v9 (ТЗ [Продукт] 23.10 п. 3Б, ✓ [Арт-директор]): подпись «◆» короче — 24 слова на всех 167 карточках
# были самым частым повтором после оговорок. «Условия сделки решаете вы» оставлена: в оговорке карточки этой фразы нет.
ROMB_PODPIS = "◆ Расчёт Делоскопа по открытым данным. Условия сделки решаете вы — проверка на сегодня — "


def zn_blok_html(fr, inn=""):
    if not fr:
        return ""
    e = lambda s: html.escape(s, quote=False)
    return ('<section class="co-sec co-znachit" aria-labelledby="znachit"><h2 id="znachit">Что это значит для вас</h2>%s'
            '<p class="caption">' + ROMB_PODPIS.replace("%", "%%") + '<a href="/?inn=%s">в отчёте</a>.</p></section>\n') % (
                "".join("<p>%s</p>" % e(x) for x in fr), inn)


def vstavit_znachit(t):
    """Ставит (или обновляет) блок перед «Перед оплатой». Нет «Перед оплатой» или фактов — страница без изменений,
    кроме снятия устаревшего блока. Повтор — без изменений."""
    bez = _ZN_BLOK.sub("", t)
    if _ZN_KUDA not in bez:
        return bez if _ZN_BLOK.search(t) else t
    f = zn_fakty(bez)
    b = zn_blok_html(zn_frazy(f), f.get("inn", ""))
    if not b:
        return bez
    i = bez.index(_ZN_KUDA)
    novyj = bez[:i] + b + bez[i:]
    return t if novyj == t else novyj


_html_kartochki_bez_znachit = html_kartochki


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None):  # noqa: F811 — та же подпись, + «Что это значит для вас»
    return vstavit_znachit(_html_kartochki_bez_znachit(k, V, sosedi, kom, normy, cena))


# ---------------------------------------------------------------- kartochki-shablon-v1 ([Ночные-2] 11.10, ТЗ [Продукт · Яндекс] 11.10 14:40 пп. 2, 3, 5)
# Шаблон карточки для волн (3 млн юрлиц): у соседей по отрасли сниппеты и заголовки были почти одинаковыми.
#  * H1 — «{Форма} «{Имя}», ИНН {ИНН}» (основной запрос карточки — «ИНН + название»); ИНН — тише имени (span, запятая —
#    снаружи: на 390 px строка не начинается с запятой);
#  * под H1 — «Действующая · {город} · {отрасль словами} · с {год} года ({возраст}) · ОГРН …» (ИНН уже в H1);
#  * description — «{Имя} ({город}), {отрасль}: с {год} года, выручка {X} за {год} ({±N %}). {Главный факт}.» —
#    главный факт = первый вывод «Коротко о компании» (порядок выводов уже по весу: 🟡 → 🟢 → ⚪), без вывода о возрасте;
#  * всё — из готовой страницы (одна функция для новых карточек, добора опубликованных и API): добор = полная сборка.
# Ничего не додумываем: нет отрасли / года / выручки на странице — нет и в сниппете. Выручка старше GOD_INDEKSA_OT —
# не в сниппете (как и раньше, kartochki-indeks-v1).
SHABLON_DESC_MAX = 160
SHABLON_OTRASL_MAX = 45
_SH_H1 = re.compile(r'(<header class="co-head">\n<h1>)(.*?)(</h1>)', re.S)
_SH_SUB = re.compile(r'(<p class="co-sub">)(.*?)(</p>)', re.S)
_SH_DESC = re.compile(r'(<meta (?:name|property)="(?:og:)?description" content=")([^"]*)(")')
_SH_OKVED = re.compile(r'<p class="caption co-okved">Основной вид деятельности — <span class="num">[0-9.]+</span>(?: ([^·<]+?))? ·')
_SH_KROSH = re.compile(r'<nav class="co-krosh[^>]*>(.*?)</nav>', re.S)
_SH_FIN_H2 = re.compile(r'<h2 id="fin">([^<]*)</h2>')
_SH_TAB = re.compile(r'<tbody><tr><td>(\d{4})</td><td class="num">([^<]+)</td>')
_SH_FIN_FNS = re.compile(r"^Доход за(?:&nbsp;| | )(\d{4})(?:&nbsp;| | )год — (.+)$")
_SH_V = re.compile(r'<li class="co-v co-v--(\w+)">.*?<p>(.*?)</p>', re.S)
_SH_IZM = re.compile("(выросл?а?|снизил(?:ся|ась)) на (\\d+)(?:&nbsp;| | )%")
_SH_VOZRAST_V = re.compile(r"^(Работает|Компании) ")


def _sh_txt(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).replace(" ", " ").strip()


def _sh_org(t):
    for blok in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
        try:
            graf = json.loads(blok.replace("<\\/", "</")).get("@graph") or []
        except ValueError:
            continue
        for x in graf:
            if isinstance(x, dict) and x.get("@type") == "Organization":
                return x
    return {}


def _sh_mal(s):
    """Первая буква — строчная, если это не аббревиатура («Передача электроэнергии» → «передача…», «ЖКХ» — как есть)."""
    return s[:1].lower() + s[1:] if len(s) > 1 and s[1:2].islower() else s


def shablon_otrasl(t):
    """Отрасль словами: название основного ОКВЭД со страницы (если короткое), иначе раздел из крошек; нет — ""."""
    m = _SH_OKVED.search(t)
    nz = re.sub(r"\s+", " ", _sh_txt(m.group(1))) if (m and m.group(1)) else ""
    if nz and len(nz) <= SHABLON_OTRASL_MAX:
        return _sh_mal(nz)
    kr = _SH_KROSH.search(t)
    razd = {t_ for _, _, t_ in OKVED_RAZDELY}
    if kr:
        for zv in reversed([_sh_txt(x) for x in kr.group(1).split(" › ")]):
            if zv in razd:
                return _sh_mal(zv)
    return ""


def shablon_glavnyj_fakt(t):
    """Выводы «Коротко о компании» по весу, кроме возраста (год уже в сниппете) и выручки/дохода (уже в сниппете)."""
    out = []
    for ton, p in _SH_V.findall(t):
        s = re.sub(r"\s+", " ", _sh_txt(p)).rstrip(".")
        if s and not _SH_VOZRAST_V.match(s) and not re.match(r"^(Выручка|Доход)\b", s):
            out.append(s)
            kor = re.sub(r" \((?:на|по состоянию на) [^)]*\)$", "", s)  # «(на 1 сентября 2026)» — дата есть на странице
            if kor != s:
                out.append(kor)
    return out


def shablon_dannye(t):
    org = _sh_org(t)
    adr = org.get("address") or {}
    d = {"name": org.get("name") or "", "inn": org.get("taxID") or "",
         "mesto": adr.get("addressLocality") or adr.get("addressRegion") or "",
         "god": int(org["foundingDate"][:4]) if re.match(r"^\d{4}", str(org.get("foundingDate") or "")) else None,
         "otrasl": shablon_otrasl(t), "fakty": shablon_glavnyj_fakt(t), "vyruchka": ""}
    tab, h2 = _SH_TAB.search(t), _SH_FIN_H2.search(t)
    fns = _SH_FIN_FNS.search(h2.group(1)) if (h2 and not tab) else None  # доход только из набора ФНС — без таблицы
    god_v, summa = (tab.group(1), tab.group(2)) if tab else ((fns.group(1), fns.group(2)) if fns else (None, None))
    d["staraya"] = not (god_v and int(god_v) >= GOD_INDEKSA_OT)
    if god_v and not d["staraya"]:
        sl = "выручка" if (h2 and h2.group(1).startswith("Выручка")) else "доход"
        v = "%s %s за %s" % (sl, _sh_txt(summa), god_v)
        iz = _SH_IZM.search(h2.group(1)) if h2 else None
        if iz:
            v += " (%s%s %%)" % ("+" if iz.group(1).startswith("выр") else "−", iz.group(2))
        d["vyruchka"] = v
    return d


def shablon_description(d):
    golova = d["name"] + ((" (%s)" % d["mesto"]) if d["mesto"] else "")
    if d["otrasl"]:
        golova += ", " + d["otrasl"]
    chasti = []
    if d["god"]:
        chasti.append("с %d года" % d["god"])
    vyr = [d["vyruchka"], re.sub(r" \([+−]\d+ %\)$", "", d["vyruchka"]), ""] if d["vyruchka"] else [""]
    osn = [golova + (": " + ", ".join(chasti + ([v] if v else [])) if (chasti or v) else "") for v in vyr]
    fakty = [f for f in d["fakty"] if not (d.get("staraya") and "₽" in f)]  # старая отчётность — без денег в сниппете
    # порядок: факт + выручка (с процентом, без него) → факт без выручки → без факта; главный факт важнее процента
    s_vyr, bez_vyr = (osn[:-1], osn[-1:]) if len(osn) > 1 else (osn, [])
    varianty = [o + ". " + f + "." for f in fakty for o in s_vyr] + [o + ". " + f + "." for f in fakty for o in bez_vyr]
    varianty += [o + ". Налоги, долги и реестры ФНС с датой сведений." for o in osn] + [o + "." for o in osn]
    for s in varianty:
        if len(s) <= SHABLON_DESC_MAX:
            return s.replace(" ₽", NB + "₽")
    s = varianty[-1]
    return (s[:SHABLON_DESC_MAX - 1].rsplit(" ", 1)[0] + "…").replace(" ₽", NB + "₽")


def _sh_vozrast(god, t):
    m = re.search("работает ([0-9]+)(?:&nbsp;| | )(года|год|лет|месяцев|месяца|месяц)", t)
    return ("%s%s%s" % (m.group(1), NB, m.group(2))) if m else ""


# kartochki-h1-d4 (23.10.2026, [Ночные-2]; ТЗ [Продукт] интенсив 23.10 Д4): ОПФ не отрывается от названия
# (ООО&nbsp;«Лента»), ИНН — отдельной строкой без запятой (.co-h1-inn — display:block в css/co.css). Идемпотентна.
_D4_OPF = re.compile(r'^(ООО|АО|ПАО|НАО|ЗАО|ОАО)(?: |\u00a0)(?=\S)')


def h1_d4(h1, inn):
    h1 = h1.replace(',<span class="co-h1-inn"> ИНН', '<span class="co-h1-inn">ИНН')
    if "co-h1-inn" not in h1:
        h1 += '<span class="co-h1-inn">ИНН&nbsp;%s</span>' % inn
    return _D4_OPF.sub(r'\1&nbsp;', h1)


def shablon_v2(t):
    """kartochki-shablon-v1: H1 с ИНН, строка под H1 и description по шаблону [Продукт · Яндекс] 11.10. Идемпотентна."""
    d = shablon_dannye(t)
    if not (d["name"] and d["inn"]):
        return t
    h1 = _SH_H1.search(t)
    if h1:
        t = t[:h1.start(2)] + h1_d4(h1.group(2), d["inn"]) + t[h1.end(2):]
    sub = _SH_SUB.search(t)
    if sub and "ИНН " + d["inn"] in sub.group(2):
        chasti = [x.strip() for x in sub.group(2).split(" · ")]
        st = chasti[0] if chasti and not chasti[0].startswith(("работает", "ИНН", "ОГРН")) and chasti[0] != e(d["mesto"]) else ""
        ogrn = next((x for x in chasti if x.startswith("ОГРН ")), "").replace("ОГРН ", "ОГРН&nbsp;")
        voz = _sh_vozrast(d["god"], sub.group(2))
        s_goda = ("с%s%d года" % (NB, d["god"]) + ((" (%s)" % voz) if voz else "")) if d["god"] else (("работает " + voz) if voz else "")
        nov = " · ".join(filter(None, [st, e(d["mesto"]), e(d["otrasl"]), s_goda, ogrn]))
        t = t[:sub.start(2)] + nov + t[sub.end(2):]
    desc = e(shablon_description(d)).replace("&nbsp;", NB)
    t = _SH_DESC.sub(lambda m: m.group(1) + desc + m.group(3), t)
    return t


# ---------------------------------------------------------------- kartochki-shablon-v1: ≥ 5 ссылок на другие карточки (п. 5 ТЗ)
# «Похожие компании» — по-прежнему только тот же класс ОКВЭД (решение [Данные] 03.10: регион — не похожесть). Если их
# меньше 5, ниже — «Ещё в регионе …» (тот же регион, ближе по выручке), затем тот же раздел ОКВЭД, затем любые.
# Всего ссылок — не меньше SOSEDEJ_MIN (если карточек хватает). Только напечатанное на страницах: добор = полная сборка.
SOSEDEJ_MIN = 5


def eshche_kompanii(k, vse, sosedi):
    nado = SOSEDEJ_MIN - len(sosedi)
    if nado <= 0:
        return []
    zanyato = {k["inn"]} | {x["inn"] for x in sosedi}
    moi_d, rz = _dohod_kart(k), _razdel(k)
    out = []
    for f in (lambda x: k.get("region") and x.get("region") == k["region"],
              lambda x: rz and _razdel(x) == rz,
              lambda x: True):
        kand = [x for x in vse if x["inn"] not in zanyato and f(x)]
        kand.sort(key=lambda x: (abs(math.log1p(_dohod_kart(x)) - math.log1p(moi_d)), x["inn"]))
        for x in kand[:nado - len(out)]:
            out.append(x)
            zanyato.add(x["inn"])
        if len(out) >= nado:
            break
    return out


def eshche_html(k, eshche):
    if not eshche:
        return ""
    zag = ("Ещё в регионе: " + e(k["region"])) if (k.get("region") and all(x.get("region") == k["region"] for x in eshche)) \
        else "Ещё компании в Делоскопе"
    return '<p class="co-sos__h caption">%s</p><ul class="co-sos co-sos--eshche">%s</ul>' % (
        zag, "".join('<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (
            adres_str(x), e(x["name"]), e(", ".join(filter(None, [x.get("gorod") or x.get("region"),
                                                                    dengi(_dohod_kart(x)) if _dohod_kart(x) else ""]))).replace("&nbsp;", NB))
            for x in eshche))


# ---------------------------------------------------------------- vozrast-segodnya-v1 (Очередь п. 287, Тестировщик 11.10)
# Возраст компании на карточке — на день сборки по Москве, а не на дату сведений: иначе после годовщины регистрации
# страница месяцами пишет «24 года» вместо «25 лет» (ФосАгро, «Газпром нефть» на 12.10). Четыре места — вывод
# «Работает N — с …» (и «Молодая компания: N»), строка под H1 «с … года (N)», «в реестре с … года (N)» в «Что это значит»
# и «— N назад» в «Даты из реестра». Число — в <span class="vozr" data-s="дата регистрации">: js/vozrast.js
# пересчитывает его в браузере (только вперёд и не больше чем на 2 года — сбитые часы посетителя не портят страницу).
# Дата регистрации — только из JSON-LD foundingDate самой страницы; меньше года — не трогаем (там месяцы).
# Вторая дата «Даты из реестра» — state.actuality_date DaData, то есть дата последнего изменения записи, а не «актуальность».
VOZR_KLASS = "vozr"
VOZR_SKRIPT = '<script src="/js/vozrast.js" defer></script>'
DATY_IZMENENIE = "Последнее изменение записи в" + NB + "ЕГРЮЛ"
_VZ_NB = "(?:&nbsp;| )"
_VZ_SLOVO = "(?:год|года|лет)"
_VZ_SPAN = re.compile(r'<span class="vozr" data-s="\d{4}-\d{2}-\d{2}">(\d+%s%s)</span>' % (_VZ_NB, _VZ_SLOVO))
_VZ_LD = re.compile(r'"foundingDate": "(\d{4}-\d{2}-\d{2})"')
_VZ_MESTA = [
    re.compile(r"(<p>Работает )\d+%s%s( — с%s\d{4} года)" % (_VZ_NB, _VZ_SLOVO, _VZ_NB)),
    re.compile(r"(<p>Молодая компания: )\d+%s%s(\.)" % (_VZ_NB, _VZ_SLOVO)),
    re.compile(r"(<p class=\"co-sub\">[^<]*?с%s\d{4} года \()\d+%s%s(\))" % (_VZ_NB, _VZ_NB, _VZ_SLOVO)),
    re.compile(r"(в реестре с%s\d{4}%sгода \()\d+%s%s(\))" % (_VZ_NB, _VZ_NB, _VZ_NB, _VZ_SLOVO)),
    re.compile(r"(<span class=\"co-daty__p\">— )(?:\d+%s%s|меньше года)( назад</span>)" % (_VZ_NB, _VZ_SLOVO)),
]


def vozrast_let(s, na):
    """Полных лет от даты регистрации s на дату na; s позже na — None."""
    if not s or not na or s > na:
        return None
    return na.year - s.year - ((na.month, na.day) < (s.month, s.day))


def vozrast_span(s, let):
    return '<span class="%s" data-s="%s">%d&nbsp;%s</span>' % (VOZR_KLASS, s.isoformat(), let, plural(let, "год", "года", "лет"))


def pochinit_vozrast(t, na):
    """Возраст компании — на дату na (день сборки по Москве) в четырёх местах карточки + подпись второй даты реестра
    + подключение js/vozrast.js. Идемпотентна: повтор в тот же день ничего не меняет."""
    t = t.replace("Сведения в" + NB + "реестре актуальны на", DATY_IZMENENIE).replace(
        "Сведения в&nbsp;реестре актуальны на", DATY_IZMENENIE.replace(NB, "&nbsp;"))
    m = _VZ_LD.search(t)
    s = data_iz(m.group(1)) if m else None
    let = vozrast_let(s, na)
    if not let or let < 1:
        return t
    t = _VZ_SPAN.sub(lambda x: x.group(1), t)  # прежняя обёртка — снять, число посчитать заново
    novoe = vozrast_span(s, let)
    for rx in _VZ_MESTA:
        t = rx.sub(lambda x: x.group(1) + novoe + x.group(2), t)
    if 'class="%s"' % VOZR_KLASS in t and VOZR_SKRIPT not in t:
        kuda = "</main>" if "</main>" in t else ("</body>" if "</body>" in t else None)
        if kuda:  # внутри тела страницы: «голое» тело из комплекта и API получают тот же скрипт, что и сборка
            i = t.rindex(kuda)
            t = t[:i] + VOZR_SKRIPT + "\n" + t[i:]
    return t


def vozrast_kak_v(staraya, novaya):
    """Тот же span возраста, что уже стоит на странице, — в пересобранный кусок (блок «Что это значит для вас»):
    иначе vstavit_znachit видел бы разницу «(20 лет)» и «(<span…>20 лет</span>)» и считал блок устаревшим."""
    m = re.search(r'<span class="vozr" data-s="\d{4}-\d{2}-\d{2}">\d+%s%s</span>' % (_VZ_NB, _VZ_SLOVO), staraya)
    if not m:
        return novaya
    for rx in _VZ_MESTA:
        novaya = rx.sub(lambda x: x.group(1) + m.group(0) + x.group(2), novaya)
    return novaya


def segodnya_msk_render():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).date()


_vstavit_znachit_bez_vozrasta = vstavit_znachit


def vstavit_znachit(t):  # noqa: F811 — vozrast-segodnya-v1: возраст в новом блоке — тем же span, что на странице
    novyj = _vstavit_znachit_bez_vozrasta(t)
    if novyj == t:
        return t
    novyj = vozrast_kak_v(t, novyj)
    return t if novyj == t else novyj


_html_kartochki_bez_vozrasta = html_kartochki


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None, segodnya=None):  # noqa: F811
    """vozrast-segodnya-v1: та же карточка, возраст — на день сборки по Москве (сайт и API — одна функция)."""
    return pochinit_vozrast(_html_kartochki_bez_vozrasta(k, V, sosedi, kom, normy, cena), segodnya or segodnya_msk_render())


# ---------------------------------------------------------------- kartochki-imya-v1 ([Ночные-2] 12.10)
# Отчёт «совпадение предложений с соседними карточками» (ТЗ [Продукт · Яндекс] 11.10 п. 7, цель < 60 %): на 12.10 медиана
# 80 %. Часть общих фраз — наши служебные советы и заголовки, где вместо названия стоит «эта компания». Здесь они называют
# компанию и её ИНН — по-русски точнее и для поиска честнее (страница о ЭТОЙ компании). Тексты [Право] («Комментарий
# команды», оговорки) не трогаем. Только формы-аббревиатуры (ООО, АО, ПАО, НАО, ЗАО, ОАО) — они не склоняются: «с ООО «…»».
# Идемпотентна: после замены старых фраз на странице нет. Тот же вызов — у новых карточек и у опубликованных (perepechatat).
IMYA_FORMY = ("ООО", "АО", "ПАО", "НАО", "ЗАО", "ОАО")
_IM_SOVET_SCHET = "Сверьте реквизиты в счёте с этой компанией: ИНН, название, банк."
_IM_SOVET_DOGOVOR = "Перед договором проверьте полномочия подписанта и сохраните копии документов."
_IM_H2_REESTRY = '<h2 id="reestry">Проверка по реестрам</h2>'


def pochinit_imya(t):
    org = _sh_org(t)
    imya, inn = str(org.get("name") or ""), str(org.get("taxID") or "")
    if imya.split(" ")[0] not in IMYA_FORMY or len(imya.split(" ")) < 2 or not re.match(r"^\d{10}$", inn):
        return t
    im = html.escape(imya, quote=False).replace(" ", NB, 1)  # «ООО «…»» — форма не отрывается от названия
    t = t.replace(_IM_SOVET_SCHET, "Сверьте реквизиты в счёте с %s: ИНН%s%s, название, банк." % (im, NB, inn))
    t = t.replace(_IM_SOVET_DOGOVOR, "Перед договором с %s проверьте полномочия подписанта и сохраните копии документов." % im)
    t = t.replace(_IM_H2_REESTRY, '<h2 id="reestry">Проверка %s по реестрам</h2>' % im)
    return t


_html_kartochki_bez_imeni = html_kartochki


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None, segodnya=None):  # noqa: F811
    """kartochki-imya-v1: та же карточка, служебные советы и заголовок реестров — с названием компании."""
    return pochinit_imya(_html_kartochki_bez_imeni(k, V, sosedi, kom, normy, cena, segodnya))


# ---------------------------------------------------------------- kartochki-unik-v2 ([Ночные-2] 12.10)
# ТЗ «Штаба» 12.10 18:55 (claude/Штаб_уникальность_замер_и_ТЗ_12.10.md, пп. 1–3, 6): медиана повтора текста карточек — 52 %
# (5-словные фрагменты), цель ≤ 35 %. Шаблон сидел в «Что это значит для вас» и «Перед оплатой»: одни и те же связки на
# 50–66 карточках. Здесь:
#  1. фразы — из фактов, а не из каркаса: вариант выбирает возраст, ход выручки и прибыли, размер, а не хеш;
#  2. абзац «Чем {Имя} отличается» — 1–2 самых необычных факта на фоне ДРУГИХ карточек Делоскопа (место по выручке
#     в разделе и в регионе, рентабельность, рост за период, возврат к прибыли, давность регистрации) с годом отчётности;
#  3. «Перед оплатой» — советы по найденным признакам; признаков нет — один совет (сверить счёт), а не общий список.
# Всё — из готовых страниц (как kartochki-znachit-v1): одинаково для новых и опубликованных карточек, без API. Сравнение
# берёт опубликованные карточки (kartochki.un_zagruzit → un_ustanovit); новая — получает абзац на финальном проходе sobrat.
# Тексты [Право] («Комментарий команды», оговорки) не трогаем. Стоп-слова (STOP_SLOVA) — те же ворота. ✎ [Право] — тон советов.
UN_GRUPPA_OT = 5          # место в разделе / регионе — только если в группе не меньше 5 карточек с выручкой того же года
_UN = {"dannye": None}
_UN_KROSH = re.compile(r'<nav class="co-krosh[^>]*>(.*?)</nav>', re.S)
_UN_RAZDELY = {t for _, _, t in OKVED_RAZDELY}
_UN_PRIB_V = re.compile(r"^Чистая прибыль за (\d{4}) — (.+?₽)")
_UN_UB_V = re.compile(r"^Убыток за (\d{4}) — (.+?₽)")
_UN_SHTAT = re.compile(r"^В штате ([\d  ]+) человек")
_UN_PERED = re.compile(r'(<section class="co-sec co-pered" aria-labelledby="pered"><h2 id="pered">Перед оплатой</h2><ul>)(.*?)(</ul></section>)', re.S)
PORYADK_ZH = {1: "первая", 2: "вторая", 3: "третья", 4: "четвёртая", 5: "пятая"}


def un_kratkoe(imya):
    """«ПАО «НЛМК»» → «НЛМК» в кавычках: форма — отдельное слово, и перед ней общий текст давал одинаковые
    5-словные фрагменты на всех ПАО (или всех ООО). Без формы — как есть."""
    ch = (imya or "").split(" ", 1)
    return ch[1] if len(ch) == 2 and ch[0] in IMYA_FORMY and ch[1].startswith("«") else (imya or "")


def un_fakty(t):
    """zn_fakty + прибыль из «Коротко» (если в таблице её нет), регион, город, раздел ОКВЭД, штат."""
    f = zn_fakty(t)
    if not f.get("imya"):
        return f
    po_godu = {x["god"]: x for x in f["ryad"] if x.get("god")}
    for ton, x in f["V"]:
        m = _UN_PRIB_V.match(x) or _UN_UB_V.match(x)
        if m and int(m.group(1)) in po_godu and po_godu[int(m.group(1))].get("pribyl") is None:
            v = zn_summa(m.group(2))
            if v:
                po_godu[int(m.group(1))]["pribyl"] = -abs(v) if x.startswith("Убыток") else v
        s = _UN_SHTAT.match(x)
        if s:
            f["shtat"] = int(re.sub(r"\D", "", s.group(1)) or 0)
    org = _sh_org(t)
    adr = org.get("address") or {}
    f["region"], f["gorod"] = adr.get("addressRegion") or "", adr.get("addressLocality") or ""
    kr = _UN_KROSH.search(t)
    zv = [z.strip() for z in _zn_txt(kr.group(1)).split("›")] if kr else []
    f["razdel"] = zv[-1] if zv and zv[-1] in _UN_RAZDELY else ""
    return f


def _un_kratko(f):
    """Факты одной карточки для сравнения с другими (без HTML)."""
    ryad = [x for x in f.get("ryad") or [] if x.get("dohod") and x["dohod"] > 0 and x.get("god") and not x.get("fns")]
    if not f.get("imya") or not ryad:
        return None
    p1 = ryad[-1]
    p0 = ryad[-2] if len(ryad) >= 2 and ryad[-2]["god"] == p1["god"] - 1 else None
    return {"inn": f.get("inn", ""), "imya": f["imya"], "razdel": f.get("razdel", ""), "region": f.get("region", ""),
            "osnovana": f.get("osnovana"), "g1": p1["god"], "r1": p1["dohod"], "pr1": p1.get("pribyl"),
            "pr0": p0.get("pribyl") if p0 else None, "y0": ryad[0]["god"], "r0": ryad[0]["dohod"], "let_ryada": len(ryad)}


def un_kontekst():
    """{ИНН: факты} карточек для сравнения. Модуль файлов не читает (его подключает и API): заполняет вызывающий —
    un_ustanovit(...) (сайт: kartochki.un_zagruzit с диска). Не заполнено — абзаца «На фоне других» нет."""
    return _UN["dannye"] or {}


def un_ustanovit(stranicy):
    """stranicy — тексты карточек (index.html) → контекст сравнения."""
    d = {}
    for t in stranicy:
        k = _un_kratko(un_fakty(t.replace("&nbsp;", NB)))
        if k and k["inn"]:
            d[k["inn"]] = k
    _UN["dannye"] = d
    return d


def _un_mesto(k, vse, klyuch, obratno=False):
    """Место k среди vse по значению klyuch (1 — наибольшее; obratno — наименьшее) и размер группы."""
    ryad = sorted(vse, key=lambda x: (-klyuch(x) if not obratno else klyuch(x), x["inn"]))
    return 1 + [x["inn"] for x in ryad].index(k["inn"]), len(ryad)


def _un_poryadk(n):
    """kartochki-unik-v4: «результат» — мужской род: «1-й результат», а не «1-я» (13 карточек на main 1924d70)."""
    return "%d-й" % n


def _un_kompanij(n):
    return "%d%s%s" % (n, NB, plural(n, "компании", "компаний", "компаний"))


def un_otlichie(k, vse):
    """1–2 самых необычных факта компании на фоне других карточек → (текст, год отчётности) или None."""
    r = _un_otlichie_vid(k, vse)
    return r[:2] if r else None


def _un_otlichie_vid(k, vse):
    """То же + вид первого факта (kartochki-unik-v5: от него — заголовок абзаца)."""
    if not k:
        return None
    g1 = k["g1"]
    svoi = [x for x in vse.values() if x["g1"] == g1]
    if k["inn"] not in {x["inn"] for x in svoi}:
        svoi.append(k)
    kand = []  # (вес, вид, текст)
    rz = [x for x in svoi if k["razdel"] and x["razdel"] == k["razdel"]]
    if len(rz) >= UN_GRUPPA_OT:
        por = sorted(rz, key=lambda x: (-x["r1"], x["inn"]))
        m, n = 1 + [x["inn"] for x in por].index(k["inn"]), len(por)
        sos = lambda x: "%s (%s)" % (un_kratkoe(x["imya"]), dengi(x["r1"]))
        if m == 1:
            kand.append((6, "razdel", "%s выручки за%s%d год — больше, чем у остальных %d в разделе «%s» на Делоскопе; "
                         "следом — %s" % (dengi(k["r1"]), NB, g1, n - 1, k["razdel"], sos(por[1]))))
        elif m == n:
            kand.append((2, "razdel", "ближе всех по выручке — %s; это %d-е место из%s%d за%s%d год в разделе «%s»"
                         % (sos(por[m - 2]), m, NB, n, NB, g1, k["razdel"])))
        else:
            kand.append((4 if m <= 3 else 1, "razdel", "между %s и %s по выручке за%s%d год (%s) в разделе «%s»"
                         % (sos(por[m - 2]), sos(por[m]), NB, g1, dengi(k["r1"]), k["razdel"])))
        mr = [x for x in rz if x["pr1"] is not None]
        if k["pr1"] is not None and len(mr) >= UN_GRUPPA_OT:
            m, n = _un_mesto(k, mr, lambda x: x["pr1"] / x["r1"])
            if m == 1 and k["pr1"] > 0:
                kand.append((5, "rent", "самая высокая в разделе чистая рентабельность за%s%d год — %s выручки (у %s раздела с прибылью)"
                             % (NB, g1, _zn_proc(k["pr1"] / k["r1"]), _un_kompanij(n))))
            elif m == n and k["pr1"] < 0:
                kand.append((4, "rent", "самый глубокий убыток к выручке в разделе за%s%d год — %s выручки (из %s раздела)"
                             % (NB, g1, _zn_proc(k["pr1"] / k["r1"]), _un_kompanij(n))))
    rg = [x for x in svoi if k["region"] and x["region"] == k["region"]]
    if len(rg) >= UN_GRUPPA_OT:
        m, n = _un_mesto(k, rg, lambda x: x["r1"])
        if m <= 3:
            kand.append((5 if m == 1 else 3, "region", "%d-е место по выручке за%s%d год среди %s региона «%s» на Делоскопе"
                         % (m, NB, g1, _un_kompanij(n), k["region"]) +
                         ("" if m == 1 else " — после %s" % ", ".join(un_kratkoe(x["imya"]) for x in sorted(
                             rg, key=lambda x: (-x["r1"], x["inn"]))[:m - 1]))))
        sv = [x for x in rg if x["osnovana"]]
        if k["osnovana"] and len(sv) >= UN_GRUPPA_OT:
            m, n = _un_mesto(k, sv, lambda x: x["osnovana"].toordinal(), obratno=True)
            if m == 1:
                kand.append((4, "vozrast", "самая ранняя дата регистрации среди %s региона «%s» на Делоскопе — %s"
                             % (_un_kompanij(n), k["region"], data_slovami(k["osnovana"]))))
    # рост выручки за период — среди всех карточек с тем же первым и последним годом отчётности
    if k["let_ryada"] >= 3:
        per = [x for x in svoi if x["y0"] == k["y0"] and x["let_ryada"] >= 3]
        if len(per) >= UN_GRUPPA_OT * 2:
            m, n = _un_mesto(k, per, lambda x: x["r1"] / x["r0"])
            raz = k["r1"] / k["r0"]
            if m <= max(3, n // 10) and raz >= 1.3:
                kand.append((5 if m <= 3 else 3, "rost", "выручка с%s%d по%s%d год выросла в%s%s — %s результат из %s на Делоскопе с отчётностью за эти годы"
                             % (NB, k["y0"], NB, g1, NB, _raz(k["r0"], k["r1"]), _un_poryadk(m), _un_kompanij(n))))
            elif m >= n - max(2, n // 10) + 1 and raz <= 0.8:
                kand.append((3, "rost", "выручка с%s%d по%s%d год сократилась на%s%s — сильнее, чем у %d из %s на Делоскопе с отчётностью за эти годы"
                             % (NB, k["y0"], NB, g1, NB, _zn_proc(1 - raz), m - 1, _un_kompanij(n))))
    if k["pr0"] is not None and k["pr1"] is not None:
        if k["pr0"] < 0 < k["pr1"]:
            kand.append((5, "povorot", "за%s%d год — снова прибыль, %s, после убытка %s годом раньше"
                         % (NB, g1, dengi(k["pr1"]), dengi(-k["pr0"]))))
        elif k["pr1"] < 0 < k["pr0"]:
            kand.append((5, "povorot", "за%s%d год — убыток %s, хотя годом раньше была прибыль %s"
                         % (NB, g1, dengi(-k["pr1"]), dengi(k["pr0"]))))
    if not kand:  # группа мала — ближайшие по выручке среди всех карточек этого года
        por = sorted(svoi, key=lambda x: (-x["r1"], x["inn"]))
        m = [x["inn"] for x in por].index(k["inn"])
        ryadom = [por[i] for i in (m - 1, m + 1) if 0 <= i < len(por)]
        if not ryadom:
            return None
        kand.append((0, "vse", "%s выручки за%s%d год — по этой цифре рядом на Делоскопе %s"
                     % (dengi(k["r1"]), NB, g1, " и ".join("%s (%s)" % (un_kratkoe(x["imya"]), dengi(x["r1"])) for x in ryadom))))
    kand.sort(key=lambda x: -x[0])
    vybor, vidy = [], []
    for ves, vid, tx in kand:
        if vid not in vidy and len(vybor) < 2:
            vybor.append(tx)
            vidy.append(vid)
    return "; ".join(vybor), g1, vidy[0]


def un_otlichie_html(f):
    k = _un_kratko(f)
    if not k or not k["inn"]:
        return ""
    vse = un_kontekst()
    if k["inn"] not in vse:
        return ""
    r = _un_otlichie_vid(k, vse)
    if not r:
        return ""
    tx = r[0]
    if STOP_SLOVA.search(tx):
        return ""
    zag = un_otlichie_zag(un_kratkoe(f["imya"]) if f.get("imya") else "", r[2])
    return "<p><b>%s</b> %s.</p>" % (html.escape(_zn_nb(zag), quote=False), html.escape(_zn_nb(tx[0].upper() + tx[1:]), quote=False))


# kartochki-unik-v5 ([Ночные-2] 18.10): заголовок «На фоне других компаний Делоскопа.» стоял на всех карточках с абзацем
# (5 одинаковых слов подряд). Теперь — имя компании и то, с кем сравниваем (вид первого выбранного факта).
UN_ZAG = {
    "razdel": "%s в своём разделе.",
    "rent": "%s в своём разделе.",
    "region": "%s в своём регионе.",
    "vozrast": "%s в своём регионе.",
    "rost": "Рост выручки %s — среди других.",
    "povorot": "Год %s в цифрах.",
    "vse": "Рядом с %s по выручке.",
}


def un_otlichie_zag(im, vid):
    if not im:
        return "На фоне других компаний Делоскопа."
    return UN_ZAG.get(vid, "%s среди компаний Делоскопа.") % im


def _un_put(ryad):
    """kartochki-unik-v7 ([Ночные-2] 19.10): каким путём шла выручка между первым и последним открытым годом —
    по строкам той же таблицы на странице (соседние годы). Возвращает (вид, год, доля): «kazhdyj» — росла каждый год,
    «spad» — самый глубокий годовой спад (≥ 5 %), иначе (None, None, None)."""
    pary = [(a, b) for a, b in zip(ryad, ryad[1:]) if a.get("god") and b.get("god") == a["god"] + 1
            and a.get("dohod") and b.get("dohod")]
    if len(pary) < 2 or len(pary) != len(ryad) - 1:
        return None, None, None
    spady = [(b["dohod"] / a["dohod"] - 1, b["god"]) for a, b in pary if b["dohod"] < a["dohod"] * 0.95]
    if spady:
        d, g = min(spady)
        return "spad", g, -d
    if all(b["dohod"] > a["dohod"] for a, b in pary):
        return "kazhdyj", None, None
    return None, None, None


def un_istoriya(im, reestr, ruk, a0, p1, ryad=None):
    """kartochki-unik-v5 ([Ночные-2] 18.10): «— с него начинается открытая отчётность на странице» было на 159 из 167
    карточек. Теперь — что произошло с выручкой от первого года открытой отчётности до последнего (числа той же таблицы
    на странице; новых утверждений нет)."""
    g0, r0, g1, r1 = a0["god"], a0["dohod"], p1["god"], p1["dohod"]
    nach = "%s %s%s" % (im, reestr, ruk)
    if r1 / r0 >= 1.3:
        vid, gs, ds = _un_put(ryad or [])
        if vid == "kazhdyj":
            return "%s; выручка росла каждый год из%s%d%s%s открытой отчётности — от%s%s в%s%d до%s%s в%s%d." % (
                nach, NB, len(ryad), NB, "года" if len(ryad) % 10 == 1 and len(ryad) % 100 != 11 else "лет", NB, dengi(r0), NB, g0, NB, dengi(r1), NB, g1)
        if vid == "spad":
            return "%s. За%s%d–%d%sгоды выручка %s выросла в%s%s, до%s%s; %s%s%d%sгод — спад на%s%s." % (
                nach[:1].upper() + nach[1:], NB, g0, g1, NB, im, NB, _raz(r0, r1), NB, dengi(r1),
                "последний, " if gs == g1 else "", "", gs, NB, NB, _zn_proc(ds))
        return "%s; с%s%d по%s%d год выручка выросла в%s%s — с%s%s до%s%s." % (
            nach, NB, g0, NB, g1, NB, _raz(r0, r1), NB, dengi(r0), NB, dengi(r1))
    if r1 / r0 <= 0.8:
        return "%s; выручка %d года — %s, на%s%s меньше, чем в%s%d (%s)." % (
            nach, g1, dengi(r1), NB, _zn_proc(1 - r1 / r0), NB, g0, dengi(r0))
    return "%s: %s выручки в%s%d году и%s%s — в%s%d." % (nach, dengi(r0), NB, g0, NB, dengi(r1), NB, g1)



# kartochki-unik-v8d ([Ночные-2] 21.10): возраст компании стоял на карточке четыре раза — строка под H1 «с 2006 года
# (20 лет)», «Работает 20 лет — с 2006 года» в «Коротко», «Зарегистрирована … — 20 лет назад» в «Даты из реестра» и
# ещё раз «в реестре с 2006 года (20 лет)» первым предложением «Что это значит для вас» (165 из 167). В «Что это
# значит» возраст теперь только у молодых компаний (до 3 лет — он и есть вывод: «история короткая»); у остальных
# абзац начинается с того, что из возраста не видно: выручка за годы открытой отчётности и руководитель. Числа — те же.
def un_istoriya_v8d(im, ruk_god, a0, p1, ryad=None):
    g0, r0, g1, r1 = a0["god"], a0["dohod"], p1["god"], p1["dohod"]
    ruk = ("; руководитель тот же с%s%s года" % (NB, ruk_god)) if ruk_god else ""
    if r1 / r0 >= 1.3:
        vid, gs, ds = _un_put(ryad or [])
        if vid == "kazhdyj":
            return "Выручка %s росла каждый год из%s%d%s%s открытой отчётности — от%s%s в%s%d до%s%s в%s%d%s." % (
                im, NB, len(ryad), NB, "года" if len(ryad) % 10 == 1 and len(ryad) % 100 != 11 else "лет", NB,
                dengi(r0), NB, g0, NB, dengi(r1), NB, g1, ruk)
        if vid == "spad":
            return "За%s%d–%d%sгоды выручка %s выросла в%s%s, до%s%s; %s%d%sгод — спад на%s%s%s." % (
                NB, g0, g1, NB, im, NB, _raz(r0, r1), NB, dengi(r1),
                "последний, " if gs == g1 else "", gs, NB, NB, _zn_proc(ds), ruk)
        return "С%s%d по%s%d год выручка %s выросла в%s%s — с%s%s до%s%s%s." % (
            NB, g0, NB, g1, im, NB, _raz(r0, r1), NB, dengi(r0), NB, dengi(r1), ruk)
    if r1 / r0 <= 0.8:
        return "Выручка %s за%s%d год — %s, на%s%s меньше, чем в%s%d (%s)%s." % (
            im, NB, g1, dengi(r1), NB, _zn_proc(1 - r1 / r0), NB, g0, dengi(r0), ruk)
    return "Выручка %s — %s в%s%d году и%s%s в%s%d%s." % (im, dengi(r0), NB, g0, NB, dengi(r1), NB, g1, ruk)


def un_korotkaya_v8d(im, ruk_god, n_let, fns):
    chast = ("открытой отчётности на странице — %s" % _zn_let(n_let)) if not fns \
        else "на странице — только доход за год по данным ФНС"
    if ruk_god:
        return "Руководитель %s не менялся с%s%s года; %s." % (im, NB, ruk_god, chast)
    return "У %s %s." % (im, chast) if not fns else "По %s %s." % (im, chast)


def _un_let(n):
    return _zn_let(n)


UN_KRUPNYJ_OT = 12e9    # выручка за год от 12 млрд ₽ (≈ 1 млрд ₽ в месяц) — «крупный бизнес» в абзаце о месячной выручке
UN_NEBOLSHOJ_DO = 120e6  # до 120 млн ₽ за год (< 10 млн ₽ в месяц) — «оборот небольшой»


def un_mesyac(im, za, r1, pr1, dl):
    """kartochki-unik-v4 ([Ночные-2] 18.10): абзац «средняя выручка в месяц» был одной формулировкой на всех 167 карточках
    (≈ 30 одинаковых 5-словных фрагментов на каждой). Вариант выбирают факты — убыток, ход выручки, размер, — а не хеш;
    смысл прежний: заказ от месячной выручки и выше для компании крупный, под него — свои меры. Правило текста то же,
    что у un_frazy: между общими словами — имя и числа компании (не больше 4 общих слов подряд). Новых утверждений
    о компании нет — только её числа из таблицы на той же странице."""
    d = {"im": im, "Im": im[:1].upper() + im[1:], "za": za, "mes": dengi(r1 / 12),
         "dl": _zn_proc(abs(dl)) if dl is not None else "", "ub": dengi(-pr1) if pr1 is not None and pr1 < 0 else ""}
    if pr1 is not None and pr1 < 0:
        return ("При убытке %(ub)s %(za)s заказ от %(mes)s (это средняя выручка %(im)s в месяц) лучше оплачивать "
                "после приёмки, а не до." % d)
    if dl is not None and dl >= 0.15:
        return ("Выручка %(im)s %(za)s выросла на %(dl)s, до %(mes)s в месяц; при заказе от %(mes)s спросите, кто будет "
                "его выполнять — сотрудники %(im)s или подрядчики." % d)
    if dl is not None and dl <= -0.05:
        return ("%(mes)s в месяц — средняя выручка %(im)s %(za)s, на %(dl)s ниже прошлогодней; в договоре от %(mes)s "
                "пропишите этапы оплаты и срок возврата аванса." % d)
    if r1 >= UN_KRUPNYJ_OT:
        if dl is not None and dl >= 0.05:
            return ("%(Im)s %(za)s в среднем получала %(mes)s в месяц, на %(dl)s больше прошлогоднего: договор меньше "
                    "%(mes)s для неё обычный, больше — сверьте полномочия подписанта." % d)
        return ("%(Im)s — крупный бизнес: %(mes)s выручки в месяц %(za)s. Договор меньше %(mes)s для неё обычный; "
                "больше — проверьте, кто подписывает, и запросите свежую отчётность." % d)
    if r1 < UN_NEBOLSHOJ_DO:
        return ("Оборот %(im)s — %(mes)s в месяц %(za)s; заказ от %(mes)s займёт заметную часть её мощностей — "
                "платите частями по факту." % d)
    return ("Средняя месячная выручка %(im)s %(za)s — %(mes)s; для %(im)s сделка от %(mes)s крупная — проверьте, "
            "кто подписывает договор, и запросите свежую отчётность." % d)


def un_frazy(f):
    """«Что это значит для вас» — варианты по фактам (замена zn_frazy). Пусто — блока нет.
    Правило текста: общие связки — короткие, между ними — название компании и её числа (иначе 5-словные фрагменты
    повторяются на десятках карточек; замер «Штаба» 12.10)."""
    ryad = [x for x in f["ryad"] if x.get("dohod") and x["dohod"] > 0]
    if not f["imya"] or not ryad:
        return []
    out = []
    na, im = f["na"], un_kratkoe(f["imya"])
    p1 = ryad[-1]
    g1, r1, pr1 = p1["god"], p1["dohod"], p1.get("pribyl")
    p0 = ryad[-2] if len(ryad) >= 2 and ryad[-2]["god"] == (g1 or 0) - 1 else None
    za = ("за %d год" % g1) if g1 else "за последний год"
    dl = (r1 / p0["dohod"] - 1) if p0 else None

    # 1. История: возраст × глубина открытой отчётности × руководитель
    if f["osnovana"] and na:
        mes = (na.year - f["osnovana"].year) * 12 + na.month - f["osnovana"].month - (na.day < f["osnovana"].day)
        let = mes // 12
        ruk = _zn_v(f, "ok", "Руководитель тот же")
        ruk_s = re.search(r"с (\d{4}) года", ruk or "")
        reestr = "в реестре с %d года" % f["osnovana"].year + (" (%s)" % _zn_let(let) if let >= 1 else "")
        glub = len(ryad) >= 3 and not p1.get("fns")
        a0 = ryad[0]
        if let < 3:
            out.append("%s %s: история короткая, поэтому оплату вперёд лучше ограничить и платить частями по факту "
                       "поставки." % (im, reestr))
        elif glub:
            out.append(un_istoriya_v8d(im, ruk_s.group(1) if ruk_s else None,
                                       a0, p1, [x for x in ryad if not x.get("fns")]))
        else:
            out.append(un_korotkaya_v8d(im, ruk_s.group(1) if ruk_s else None, len(ryad), p1.get("fns")))

    # 2. Деньги: что это меняет в условиях оплаты
    kap = re.search(r"минус ([^:]+):", _zn_v(f, "warn", "Собственный капитал") or "")
    ub = _zn_v(f, "warn", "Убыток за")
    podryad = re.search(r"(\S+) год подряд", ub or "")
    if pr1 is not None and pr1 < 0:
        t = "У %s %s убыток %s" % (im, za, dengi(-pr1))
        if podryad:
            t += " (%s год подряд)" % podryad.group(1)
        t += " при выручке %s" % dengi(r1)
        if kap:
            t += ", а обязательства больше активов на %s" % kap.group(1).strip()
            t += (": если платите вперёд, привяжите оплату к поставке или этапам работ — по отчётности у компании нет "
                  "запаса, из которого она вернула бы аванс без новых денег.")
        elif p0 and p0.get("pribyl") and p0["pribyl"] > 0:
            t += (", а годом раньше, в %d, у %s была прибыль %s. Крупный аванс — этапами, срок возврата предоплаты — "
                  "в договоре." % (g1 - 1, im, dengi(p0["pribyl"])))
        else:
            t += (". Аванс %s лучше разбить на этапы и платить по факту поставки, а в договоре прописать срок возврата "
                  "предоплаты." % im)
        out.append(t)
    elif kap:
        out.append("Обязательства %s больше активов на %s (баланс на 31.12.%s): если платите вперёд, привяжите "
                   "оплату к поставке или этапам работ." % (im, kap.group(1).strip(), g1))
    elif pr1 is not None and p0 and p0.get("pribyl") and p0["pribyl"] > 0 and pr1 <= p0["pribyl"] * 0.7:
        t = "Прибыль %s %s — %s, на %s меньше, чем годом раньше" % (im, za, dengi(pr1), _zn_proc(1 - pr1 / p0["pribyl"]))
        if dl is not None and abs(dl) >= 0.05:
            t += ", при выручке, %s на %s" % ("выросшей" if dl > 0 else "снизившейся", _zn_proc(dl))
        t += ": под крупный аванс попросите поэтапную оплату или аккредитив и спросите у %s, с чем связано падение." % im
        out.append(t)
    elif dl is not None and dl <= -0.3:
        out.append("Выручка %s %s — %s, на %s меньше, чем годом раньше: спросите у %s о причине и уточните, хватит ли "
                   "людей и мощностей на ваш объём." % (im, za, dengi(r1), _zn_proc(dl), im))
    elif pr1 is not None and pr1 > 0:
        m1 = pr1 / r1
        m0 = p0["pribyl"] / p0["dohod"] if p0 and p0.get("pribyl") and p0["pribyl"] > 0 else None
        if p0 and p0.get("pribyl") is not None and p0["pribyl"] < 0:
            out.append("%s %s снова в плюсе: %s чистой прибыли при выручке %s, а за %d год был убыток %s." % (
                za.capitalize(), im, dengi(pr1), dengi(r1), g1 - 1, dengi(-p0["pribyl"])))
        elif m0 is not None and m1 >= m0 * 1.3:
            out.append("Каждый рубль выручки %s приносит больше: чистая прибыль %s за%s%d год — %s, это %s от %s (годом раньше — %s)." % (
                im, im, NB, g1, dengi(pr1), _zn_proc(m1), dengi(r1), _zn_proc(m0)))
        elif m1 >= 0.15:
            out.append("С каждых 100" + NB + "₽ выручки %s у %s остаётся %d" % (za, im, round(m1 * 100)) + NB +
                       "₽ чистой прибыли: %s при выручке %s%s." % (
                           dengi(pr1), dengi(r1), (" (годом раньше — %s)" % _zn_proc(m0)) if m0 else ""))
        elif m1 < 0.03:
            out.append("У %s %s чистая прибыль %s при выручке %s — %s: запас прочности тонкий, крупный аванс лучше "
                       "привязать к поставке." % (im, za, dengi(pr1), dengi(r1), _zn_proc(m1)))
        else:
            t = "У %s %s — %s чистой прибыли при выручке %s, это %s выручки" % (
                im, za, dengi(pr1), dengi(r1), _zn_proc(m1))
            if m0 is not None:
                t += " (годом раньше — %s)" % _zn_proc(m0)
            out.append(t + ".")
    else:
        t = "Выручка %s %s — %s" % (im, za, dengi(r1))
        if dl is not None and abs(dl) >= 0.05:
            t += ", на %s %s, чем годом раньше" % (_zn_proc(dl), "больше" if dl > 0 else "меньше")
        t += (". Прибыли в открытых данных на этой странице нет — до крупной оплаты попросите у %s отчёт "
              "о финансовых результатах за %d год." % (im, g1) if g1 else
              ". До крупной оплаты попросите у %s отчёт о финансовых результатах за последний год." % im)
        out.append(t)

    # 2б. Лучший год по выручке и по прибыли из открытых (≥ 3 лет ГИР БО) — если это не последний год
    gl = [x for x in ryad if x.get("god") and not x.get("fns")]
    if len(gl) >= 3:
        mx = max(gl, key=lambda x: (x["dohod"], x["god"]))
        pp = [x for x in gl if x.get("pribyl") is not None]
        mp = max(pp, key=lambda x: (x["pribyl"], x["god"])) if len(pp) >= 3 else None
        chasti = []
        if mx["god"] != g1:
            chasti.append("по выручке лучшим у %s из открытых лет был %d год — %s" % (im, mx["god"], dengi(mx["dohod"])))
        if mp and mp["pribyl"] > 0 and mp["god"] != g1 and not chasti:
            # kartochki-unik-v7: одна «по прибыли — N год, …» без начала фразы читалась обрывком (47 карточек) →
            # лучший год прибыли против последнего, числа той же таблицы
            posl = p1.get("pribyl")
            if posl is not None and posl > 0:
                chasti.append("самая большая прибыль у %s из открытых лет — за %d год, %s; за %d — %s, это %s от неё" % (
                    im, mp["god"], dengi(mp["pribyl"]), g1, dengi(posl), _zn_proc(posl / mp["pribyl"])))
            else:
                chasti.append("самая большая прибыль у %s из открытых лет — за %d год, %s" % (
                    im, mp["god"], dengi(mp["pribyl"])))
        elif mp and mp["pribyl"] > 0 and mp["god"] != g1:
            chasti.append("по прибыли — %d год, %s" % (mp["god"], dengi(mp["pribyl"])))
        elif mp and mp["pribyl"] > 0 and mp["god"] == g1 and len(pp) >= 3:
            chasti.append("прибыль %s за %d год — самая высокая за %s открытой отчётности" % (im, g1, _zn_let(len(pp))))
        if chasti:
            t = "; ".join(chasti)
            out.append(t[0].upper() + t[1:] + ".")

    # 3. Давность отчётности. kartochki-zakrytye-v1 (ТЗ [Продукт] 23.10 п. 3Д; текст — [Право] 23.10, разд. 1): годы без
    # отчётности называем числами; причину для компании не называем (основания закрытия разные, мы их не видим) — только
    # общая строка о ст. 18 402-ФЗ, без номера части до сверки [Право]
    # «Старше двух лет» (≥ 3 года до года сведений) — новый абзац; за позапрошлый год — прежний (2025-ю могли ещё не открыть)
    if g1 and na and na.year - g1 == 2:
        out.append("У %s последняя открытая отчётность — за %d год, о %d годе она ничего не говорит: до подписания "
                   "договора попросите у компании бухгалтерскую отчётность за %d год." % (im, g1, na.year - 1, na.year - 1))
    elif g1 and na and na.year - g1 >= 3:
        prichina = ("Так бывает по разным причинам, в том числе законным: в ряде случаев доступ к отчётности в ГИР БО "
                    "ограничен (ст." + NB + "18 Федерального закона №" + NB + "402-ФЗ).")
        gody = "%d–%d годы" % (g1 + 1, na.year - 1)
        out.append(("Последняя открытая отчётность %s — за %d год. За %s в открытой части ГИР БО её нет — до сделки "
                    "попросите у компании бухгалтерскую отчётность и справку КНД" + NB + "1120101. %s") % (im, g1, gody, prichina))

    # 4. Налоги и руководитель — по выводам «Коротко»
    nd = _zn_v(f, "warn", "Задолженность перед бюджетом")
    if nd:
        m = re.search(r"— (.*?) на (\d.*?\d{4})", nd)
        if m:
            out.append("В данных ФНС на %s у %s была задолженность перед бюджетом — %s: попросите справку "
                       "об исполнении обязанности по уплате налогов на свежую дату." % (m.group(2), im, m.group(1)))
    else:
        up = _zn_v(f, "ok", "Уплатила налогов и взносов")
        bez = _zn_v(f, "ok", "Налоговой задолженности")
        m = re.search(r"— (.*?)(?: за (\d{4}))?$", up or "")
        d = re.search(r"\(на (.*?)\)", bez or "")
        if m and d:
            out.append("%s от %s в бюджет поступило %s налогов и взносов; на %s долга перед бюджетом в данных ФНС не было." % (
                ("За %s год" % m.group(2)) if m.group(2) else "За год", im, m.group(1), d.group(1)))
    sm = _zn_v(f, "warn", "Руководитель сменился")
    if sm:
        out.append("У %s %s — убедитесь, что договор подписывает действующий руководитель или представитель по "
                   "доверенности от него." % (im, sm[0].lower() + sm[1:]))

    # 5. Масштаб: средняя выручка в месяц — формулировка по фактам (kartochki-unik-v4, [Ночные-2] 18.10)
    out.append(un_mesyac(im, za, r1, pr1, dl))

    # 6. Мало слов — строка отрасли (ФНС), если она есть на странице
    if sum(len(x.split()) for x in out) < ZN_MIN_SLOV and f["otrasl"]:
        nz, god, proc = f["otrasl"]
        out.append("Средняя налоговая нагрузка в отрасли «%s» за %d год — %s %% по данным ФНС: с ней можно сравнить "
                   "налоги %s в полном отчёте." % (nz, god, proc, im))
    out = [_zn_nb(x) for x in out]
    for x in out:
        assert not STOP_SLOVA.search(x), x
    return out


def un_blok_html(f):
    fr = un_frazy(f)
    if not fr:
        return ""
    e_ = lambda s: html.escape(s, quote=False)
    otl = un_otlichie_html(f)
    return ('<section class="co-sec co-znachit" aria-labelledby="znachit"><h2 id="znachit">Что это значит для вас</h2>%s%s'
            '<p class="caption">' + ROMB_PODPIS.replace("%", "%%") + '<a href="/?inn=%s">в отчёте</a>.</p></section>\n') % (
                otl, "".join("<p>%s</p>" % e_(x) for x in fr), f.get("inn", ""))


def _un_vstavit(t):
    bez = _ZN_BLOK.sub("", t)
    if _ZN_KUDA not in bez:
        return bez if _ZN_BLOK.search(t) else t
    f = un_fakty(bez.replace("&nbsp;", NB))
    b = un_blok_html(f)
    if not b:
        return bez
    i = bez.index(_ZN_KUDA)
    novyj = bez[:i] + b + bez[i:]
    return t if novyj == t else novyj


def un_pered(f):
    """Советы «Перед оплатой» по признакам страницы → список HTML-строк (1–3)."""
    im = html.escape(un_kratkoe(f["imya"]), quote=False)
    inn = f.get("inn", "")
    ryad = [x for x in f["ryad"] if x.get("dohod") and x["dohod"] > 0]
    p1 = ryad[-1] if ryad else {}
    p0 = ryad[-2] if len(ryad) >= 2 and ryad[-2].get("god") == (p1.get("god") or 0) - 1 else None
    s = []
    nd = _zn_v(f, "warn", "Задолженность перед бюджетом")
    if nd:
        m = re.search(r"— (.*?) на (\d.*?\d{4})", nd)
        s.append("Попросите у %s справку об исполнении обязанности по уплате налогов (КНД 1120101): на %s в данных ФНС "
                 "был долг %s." % (im, m.group(2), m.group(1)) if m else
                 "Попросите у %s справку об исполнении обязанности по уплате налогов (КНД 1120101)." % im)
    sm = _zn_v(f, "warn", "Руководитель сменился")
    if sm:
        s.append("Руководитель %s %s — попросите решение о его назначении или доверенность того, кто подписывает." % (
            im, sm[len("Руководитель "):]))
    kap = re.search(r"минус ([^:]+):", _zn_v(f, "warn", "Собственный капитал") or "")
    if (p1.get("pribyl") is not None and p1["pribyl"] < 0) or kap:
        prichina = ("убыток %s за %d год" % (dengi(-p1["pribyl"]), p1["god"]) if p1.get("pribyl") is not None and p1["pribyl"] < 0
                    else "обязательства больше активов на %s" % kap.group(1).strip())
        s.append('Аванс — частями, по факту поставки или этапов работ: у %s %s. '
                 '<a href="/nalogi/skolko-platit-vpered-neznakomoj-kompanii/">Сколько можно платить вперёд</a>' % (im, prichina))
    elif p0 and p1.get("dohod") and p1["dohod"] <= p0["dohod"] * 0.7:
        s.append("Выручка %s за %d год упала на %s — спросите о причине и о том, хватит ли мощностей на ваш заказ." % (
            im, p1["god"], _zn_proc(1 - p1["dohod"] / p0["dohod"])))
    if f["osnovana"] and f["na"] and (f["na"] - f["osnovana"]).days < 3 * 365:
        s.append('%s моложе трёх лет — оплату частями или по факту поставки. '
                 '<a href="/nalogi/skolko-platit-vpered-neznakomoj-kompanii/">Сколько можно платить вперёд</a>' % im)
    schet = ('Счёт от %s: сверьте ИНН%s%s, название и банк. <a href="/proverit-schet/">Проверить счёт</a>'
             % (im, NB, inn))
    if not s:
        return ['В сведениях этой страницы у %s замечаний нет — перед оплатой остаётся сверить счёт: ИНН%s%s, '
                'название и банк. <a href="/proverit-schet/">Проверить счёт</a>' % (im, NB, inn)]
    return (s + [schet])[:3]


def pochinit_pered(t):
    """«Перед оплатой» — по признакам страницы (kartochki-unik-v2). Идемпотентна; без имени или ИНН — без изменений."""
    m = _UN_PERED.search(t)
    if not m:
        return t
    f = un_fakty(t.replace("&nbsp;", NB))
    if not f.get("imya") or not re.match(r"^\d{10}$", f.get("inn") or ""):
        return t
    novoe = "".join("<li>%s</li>" % x for x in un_pered(f))
    if html.unescape(m.group(2)).replace("&nbsp;", NB) == html.unescape(novoe):
        return t
    return t[:m.start(2)] + novoe + t[m.end(2):]


_vstavit_znachit_do_unik = vstavit_znachit


def vstavit_znachit(t):  # noqa: F811 — kartochki-unik-v2: блок по вариантам + «Чем отличается»; возраст — тем же span
    novyj = _un_vstavit(t)
    if novyj == t:
        return t
    novyj = vozrast_kak_v(t, novyj)
    return t if novyj == t else novyj


_html_kartochki_do_unik = html_kartochki


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None, segodnya=None):  # noqa: F811
    """kartochki-unik-v2: «Перед оплатой» — по признакам; «Что это значит для вас» — по вариантам (через vstavit_znachit)."""
    return pochinit_pered(vstavit_znachit(_html_kartochki_do_unik(k, V, sosedi, kom, normy, cena, segodnya)))


# kartochki-unik-v2: «Разбор по цифрам» — с названием компании (заголовок и первая строка; 64 карточки начинались одинаково)
_UN_RZ_H2 = '<h2 id="razbor">Разбор по цифрам</h2>'
_UN_RZ_ZA = re.compile(r"<p>За(?:&nbsp;|\u00a0)(\d+)(?:&nbsp;|\u00a0)(год|года|лет) выручка (?=выросла|снизилась|почти)")


def pochinit_razbor(t):
    if 'class="co-sec co-razbor"' not in t:
        return t
    imya = str(_sh_org(t).get("name") or "")
    if not imya:
        return t
    im = html.escape(un_kratkoe(imya), quote=False)
    return _UN_RZ_ZA.sub(lambda m: "<p>Выручка %s за%s%s%s%s " % (im, NB, m.group(1), NB, m.group(2)), t, count=1)


_html_kartochki_do_razbora = html_kartochki


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None, segodnya=None):  # noqa: F811
    return pochinit_razbor(_html_kartochki_do_razbora(k, V, sosedi, kom, normy, cena, segodnya))


# ---------------------------------------------------------------- kartochki-unik-v3 (Очередь п. 310, ТЗ [Штаб] 12.10 п. 4)
# Замер Штаба (5-словные фрагменты, без фраз > 30 % страниц) на 17.10: карточки — медиана 46 %, хабы отраслей 94–97 %.
# Больше всего общего текста давали «Похожие компании» (79 % фрагментов блока — одни и те же «название, город, выручка»
# на всех карточках, где сосед встречается) и хабы (только списки тех же строк). v3: (1) у соседа — сравнение с этой
# компанией по обороту за один и тот же год («в 2,1 раза больше, чем у «Лента»»); годы разные — без сравнения, как было;
# (2) у хаба — вводный абзац из данных: крупнейшие по обороту, где больше всего компаний группы. Только напечатанное на
# карточках (добор = полная сборка), без новых сведений и без оценок компании.
SOS_POCHTI = 1.15  # ближе ±15 % — «почти столько же»
SOS_MAKS = 20  # разница больше чем в 20 раз — не сравниваем: «в 1 248 раз меньше» ничего не говорит о сделке


def _god_dohoda(x):
    """Год оборота, который печатает карточка (fakty.dohod.god; у опубликованной — из её таблицы или заголовка); нет — None.
    Дату сведений годом не считаем: у набора ФНС это день публикации, а не отчётный год."""
    g = ((x.get("fakty") or {}).get("dohod") or {}).get("god")
    return int(g) if g else None


def _drob1(v):
    """2.04 → «2», 2.46 → «2,5» (одна цифра после запятой, ноль не пишем)."""
    s = ("%.1f" % v).replace(".", ",")
    return s[:-2] if s.endswith(",0") else s


def sos_otnoshenie(moj, chuzhoj):
    """Оборот соседа к обороту этой компании → «в 2,1 раза больше» / «на 30 % меньше» / «почти столько же»."""
    if not (moj and chuzhoj and moj > 0 and chuzhoj > 0):
        return ""
    r = chuzhoj / moj
    if 1 / SOS_POCHTI < r < SOS_POCHTI:
        return "почти столько же"
    slovo, q = ("больше", r) if r > 1 else ("меньше", 1 / r)
    if q > SOS_MAKS:
        return ""
    if q < 1.95:
        return "на%s%d%s%% %s" % (NB, round(abs(r - 1) * 100), NB, slovo)
    if q < 10 and _drob1(q).find(",") >= 0:
        return "в%s%s%sраза %s" % (NB, _drob1(q), NB, slovo)
    n = int(round(q))
    return "в%s%d%s%s %s" % (NB, n, NB, plural(n, "раз", "раза", "раз"), slovo)


def sos_podpis(k, x):
    """Подпись соседа в «Похожих»: сравнение с этой компанией, если оборот обеих — за один год; иначе — город, оборот и год."""
    mesto = x.get("gorod") or x.get("region") or ""
    d_k, d_x, g_k, g_x = _dohod_kart(k), _dohod_kart(x), _god_dohoda(k), _god_dohoda(x)
    rel = sos_otnoshenie(d_k, d_x) if (g_k and g_k == g_x) else ""
    if not rel:
        # kartochki-unik-v8c: годы разные — оборот с годом («Москва · оборот 289 млрд ₽ за 2024»): без года сумма
        # читалась как сравнимая с оборотом этой компании
        if not d_x:
            return e(mesto)
        ob = "оборот " + e(dengi(d_x)).replace("&nbsp;", NB) + ((" за%s%d" % (NB, g_x)) if g_x else "")
        return (e(mesto) + " · " + ob) if mesto else ob
    imya_k = e(un_kratkoe(k.get("name") or ""))
    # kartochki-unik-v8c: у сравнения есть подлежащее — «оборот в 2 раза больше, чем у…» (было «в 2 раза больше, чем у…»:
    # больше чего — не сказано)
    nachalo = ("оборот почти такой же, как у %s" % imya_k) if rel == "почти столько же" \
        else "оборот %s, чем у %s" % (rel, imya_k)
    return "%s: %s за%s%d%s" % (nachalo, e(dengi(d_x)).replace("&nbsp;", NB), NB, g_x,
                                (" · " + e(mesto)) if mesto else "")


def _sos_li(k, x):
    return '<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (adres_str(x), e(x["name"]), sos_podpis(k, x))


def sosedi_html(k, sosedi, eshche=None):  # noqa: F811 — kartochki-unik-v3: подпись соседа — сравнение с этой компанией
    if not sosedi:
        return ""
    kl = okved_klass(k)
    if kl and all(okved_klass(x) == kl for x in sosedi):
        zag = ("Похожие компании — " + e(k["region"])) if (k.get("region") and all(x.get("region") == k["region"] for x in sosedi)) \
            else "Похожие компании"
    else:
        zag = "Ещё компании в Делоскопе"
    return '<aside class="co-side card" aria-labelledby="sos"><h2 id="sos" class="co-h3">%s</h2><ul class="co-sos">%s</ul>%s</aside>' % (
        zag, "".join(_sos_li(k, x) for x in sosedi), eshche_html(k, eshche or []))


def eshche_html(k, eshche):  # noqa: F811 — kartochki-unik-v3: та же подпись-сравнение
    if not eshche:
        return ""
    zag = ("Ещё в регионе: " + e(k["region"])) if (k.get("region") and all(x.get("region") == k["region"] for x in eshche)) \
        else "Ещё компании в Делоскопе"
    return '<p class="co-sos__h caption">%s</p><ul class="co-sos co-sos--eshche">%s</ul>' % (
        zag, "".join(_sos_li(k, x) for x in eshche))


HAB_KRUPNYE = 3


def hab_vvod(g):
    """Вводный абзац хаба группы из напечатанного на карточках: крупнейшие по обороту и где их больше всего.
    Меньше 3 компаний с оборотом — без абзаца (не из чего сравнивать)."""
    kart = g.get("kart") or []
    s_dohodom = sorted([x for x in kart if _dohod_kart(x) > 0 and _god_dohoda(x)],
                       key=lambda x: (-_dohod_kart(x), x["inn"]))
    if len(s_dohodom) < HAB_KRUPNYE:
        return ""
    top = s_dohodom[:HAB_KRUPNYE]
    sp = ["%s — %s за%s%d" % (e(un_kratkoe(x["name"])), e(dengi(_dohod_kart(x))).replace("&nbsp;", NB), NB, _god_dohoda(x))
          for x in top]
    gde = "в группе" if g["vid"] == "otrasl" else "с адресом в этом регионе"
    abz = "Крупнейшие по обороту %s (последняя открытая отчётность каждой): %s и %s." % (gde, ", ".join(sp[:-1]), sp[-1])
    po = {}
    for x in kart:
        kl = (x.get("region") or "") if g["vid"] == "otrasl" else (hab_otrasl(x) if hab_otrasl(x) != HAB_NET_OTRASLI else "")
        if kl:
            po[kl] = po.get(kl, 0) + 1
    chasto = sorted(po.items(), key=lambda a: (-a[1], a[0]))
    if len(chasto) >= 2 and chasto[0][1] >= 2:
        (a, na), (b, nb) = chasto[0], chasto[1]
        if g["vid"] == "otrasl":
            abz += " Больше всего компаний группы — с адресом %s (%d), дальше — %s (%d)." % (
                e(region_polnyj(a)), na, e(region_polnyj(b)), nb)
        else:
            abz += " Чаще всего здесь — «%s» (%d), дальше — «%s» (%d)." % (e(a), na, e(b), nb)
    return '<p class="co-hab__vvod">%s</p>' % abz


_html_gruppy_do_v3 = html_gruppy


_LI_VID = {"vid": None}
_li_haba_do_v3 = _li_haba


def _li_haba(x, s_otraslyu=False):  # noqa: F811 — kartochki-unik-v3: подпись строки — своя у хаба отрасли и хаба региона
    """Хаб отрасли: «оборот за Г — сумма · город»; хаб региона: «ОКВЭД · оборот сумма за Г». Та же строка «город · ОКВЭД»
    стояла в хабе отрасли, хабе региона и общем хабе — три страницы из одинаковых строк. Нет оборота — как раньше."""
    vid = _LI_VID["vid"]
    d, g = _dohod_kart(x), _god_dohoda(x)
    if vid not in ("otrasl", "region") or not (d > 0 and g):
        return _li_haba_do_v3(x, s_otraslyu)
    summa = e(dengi(d)).replace("&nbsp;", NB)
    if vid == "otrasl":
        podpis = "оборот за%s%d — %s" % (NB, g, summa)
        mesto = e(x.get("gorod") or x.get("region") or "")
        podpis += (" · " + mesto) if mesto else ""
    else:
        kod = okved_kod(x.get("okved"))
        podpis = ("ОКВЭД%s<span class=\"num\">%s</span> · " % (NB, kod) if kod else "") + "оборот %s за%s%d" % (summa, NB, g)
    return '<li><a href="%s">%s</a><span class="caption">%s</span></li>' % (adres_str(x), e(x["name"]), podpis)


def html_gruppy(g, kart, index, n=1, vsego=1):  # noqa: F811 — kartochki-unik-v3: вводный абзац из данных на 1-й странице
    _LI_VID["vid"] = g.get("vid")
    try:
        t = _html_gruppy_do_v3(g, kart, index, n, vsego)
    finally:
        _LI_VID["vid"] = None
    vv = hab_vvod(g) if n <= 1 else ""
    return t.replace("</p></header>", "</p>%s</header>" % vv, 1) if vv else t


# kartochki-unik-v6: «Перед оплатой» без замечаний — совет из фактов этой страницы, а не одна строка на 113 карточках
# («В сведениях этой страницы у X замечаний нет — перед оплатой остаётся сверить счёт…»). Порядок: заметное движение
# выручки → (по ИНН) дата сведений о налогах или возраст в реестре / руководитель. Слова — без оценок (STOP_SLOVA).
_un_pered_do_v6 = un_pered


def _un_pered_fakt(f):
    """Один совет «Перед оплатой» по фактам страницы без замечаний (HTML-строка) или None."""
    im = html.escape(un_kratkoe(f["imya"]), quote=False)
    inn = f.get("inn", "") or ""
    ryad = [x for x in f["ryad"] if x.get("dohod") and x["dohod"] > 0]
    p1 = ryad[-1] if ryad else {}
    p0 = ryad[-2] if len(ryad) >= 2 and ryad[-2].get("god") == (p1.get("god") or 0) - 1 else None
    g1, r1 = p1.get("god"), p1.get("dohod")
    if p0 and r1 and g1:
        dl = r1 / p0["dohod"] - 1
        if dl <= -0.05:
            return ("Выручка %s за%s%d год — %s, на %s ниже, чем за %d: в длинном договоре закрепите объёмы и сроки "
                    "поставок по этапам." % (im, NB, g1, dengi(r1), _zn_proc(dl), g1 - 1))
        if dl >= 0.3:
            return ("За%s%d год выручка %s выросла на %s, до %s: если заказ рассчитан на месяцы вперёд, пропишите "
                    "сроки этапов и неустойку за их срыв." % (NB, g1, im, _zn_proc(dl), dengi(r1)))
    var = []
    bez = _zn_v(f, "ok", "Налоговой задолженности")
    d = re.search(r"\(на (.*?)\)", bez or "")
    if d:
        t = "Налогового долга у %s не было на %s — это последние сведения ФНС на странице." % (im, d.group(1))
        if r1 and g1:
            t += (" Если сумма сделки больше %s (средняя месячная выручка за%s%d), попросите справку КНД 1120101 "
                  "на дату договора." % (dengi(r1 / 12), NB, g1))
        var.append(t)
    ruk = re.search(r"с%s?(\d{4}) года" % NB, (_zn_v(f, "ok", "Руководитель тот же") or "").replace(" ", NB))
    if ruk:
        var.append("Руководитель %s не менялся с%s%s года — договор подписывает он или представитель по доверенности "
                   "от него; копию доверенности приложите к договору." % (im, NB, ruk.group(1)))
    elif f.get("osnovana") and f.get("na") and f["na"].year - f["osnovana"].year >= 10:
        var.append("%s в реестре с%s%d года. При первой сделке сверьте реквизиты в договоре с выпиской ЕГРЮЛ: "
                   "полное название, адрес и того, кто подписывает." % (im, NB, f["osnovana"].year))
    if not var:
        return None
    return var[int(inn[-1]) % len(var)] if inn[-1:].isdigit() else var[0]


def un_pered(f):  # noqa: F811
    s = _un_pered_do_v6(f)
    if len(s) != 1 or "замечаний нет" not in s[0]:
        return s
    fakt = _un_pered_fakt(f)
    if not fakt:
        return s
    assert not STOP_SLOVA.search(fakt), fakt
    inn = f.get("inn", "")
    im = html.escape(un_kratkoe(f["imya"]), quote=False)
    return [fakt, 'Счёт от %s: сверьте ИНН%s%s, название и банк. <a href="/proverit-schet/">Проверить счёт</a>'
            % (im, NB, inn)]


# kartochki-unik-v8 ([Ночные-2] 20.10): «Перед оплатой» у карточек без замечаний — два совета чередовались по чётности
# ИНН («Налогового долга … не было» — 47, «… в реестре с N года. При первой сделке сверьте реквизиты…» — 40 карточек).
# Теперь пул шире — каждый совет опирается на факт этой же страницы: прибыль заметно упала (из «Коротко»), адрес без
# отметки о недостоверности (город из реестра), документ приёмки по разделу ОКВЭД. Выбор — по ИНН, ровно по пулу.
# Слова — без оценок (STOP_SLOVA). ✎ [Право] — формулировки (словарь UN_PERED_RAZDEL, одна строка на раздел).
UN_PERED_RAZDEL = {
    "Торговля": "Товар от %s принимайте по УПД и сверяйте количество при приёмке: расхождение оформите актом в тот же "
                "день, а оплату — по подписанному УПД.",
    "Обрабатывающие производства": "Для продукции %s пропишите в договоре, как принимают партию по качеству и кто "
                                   "оплачивает возврат брака, — до того как платить за неё.",
    "Транспорт и хранение": "Перевозку или хранение у %s подтверждайте транспортной накладной или актом с маршрутом и "
                            "датами — без них расход сложно подтвердить.",
    "Информация и связь": "Услуги %s принимайте по акту с перечнем сделанного за период — для услуг без вещественного "
                          "результата акт и отчёт и есть подтверждение расхода.",
    "Строительство": "Работы %s принимайте по актам КС-2 и справке КС-3, а оплату этапа привяжите к подписанному акту.",
    "Энергетика": "В договоре с %s сверьте точки поставки и порядок снятия показаний — от них зависит сумма каждого "
                  "счёта.",
}
_UN_PRIB_MINUS = re.compile(r"^Чистая прибыль за (\d{4}) — (.+?₽), на (\d+(?:,\d+)?) % меньше, чем годом раньше")
_un_pered_fakt_do_v8 = _un_pered_fakt


def un_pered_varianty(f):
    """Все советы «Перед оплатой» по фактам страницы без замечаний (HTML-строки, порядок постоянный)."""
    im = html.escape(un_kratkoe(f["imya"]), quote=False)
    ryad = [x for x in f["ryad"] if x.get("dohod") and x["dohod"] > 0]
    p1 = ryad[-1] if ryad else {}
    p0 = ryad[-2] if len(ryad) >= 2 and ryad[-2].get("god") == (p1.get("god") or 0) - 1 else None
    if p0 and p1.get("dohod") and (p1["dohod"] / p0["dohod"] - 1 <= -0.05 or p1["dohod"] / p0["dohod"] - 1 >= 0.3):
        return [_un_pered_fakt_do_v8(f)]  # заметное движение выручки — по-прежнему первым и единственным
    var = []
    inn = f.get("inn", "") or ""
    for chet in ("0", "1"):  # оба прежних совета (налоги / руководитель или возраст в реестре)
        s = _un_pered_fakt_do_v8(dict(f, inn=inn[:-1] + chet if inn else chet))
        if s and s not in var:
            var.append(s)
    for ton, x in f["V"]:
        m = _UN_PRIB_MINUS.match(x.replace(NB, " "))
        if m and float(m.group(3).replace(",", ".")) >= 20:
            var.append(_zn_nb("Чистая прибыль %s за %s год — %s, на %s %% меньше, чем годом раньше: крупный аванс "
                              "разбейте на этапы и платите за каждый после приёмки." % (im, m.group(1), m.group(2),
                                                                                       m.group(3))))
            break
    if _zn_v(f, "ok", "Адрес и руководитель в реестре") and f.get("gorod"):
        var.append("Адрес %s в ЕГРЮЛ (%s) — без отметки о недостоверности: этот же адрес укажите в договоре — на этот "
                   "адрес удобно направлять претензии и документы." % (im, html.escape(f["gorod"], quote=False)))
    if f.get("razdel") in UN_PERED_RAZDEL:
        var.append(UN_PERED_RAZDEL[f["razdel"]] % im)
    return [v for v in var if v]


def _un_pered_fakt(f):  # noqa: F811
    var = un_pered_varianty(f)
    if not var:
        return None
    inn = f.get("inn", "") or ""
    return var[int(inn[-3:]) % len(var)] if inn[-3:].isdigit() else var[0]



# ---------------------------------------------------------------- kartochki-svodka-v1 ([Ночные-2] 23.10; ТЗ [Продукт] 23.10 п. 3А)
# [Право] 23.10 00:30, разд. 3 (п. 373б): «зелёные тоны одинаковы для всех — на карточках только одним сводным блоком
# «Что значат эти строки для банка и налоговой»; тексты те же; правовой стороны против нет». Здесь: у зелёных строк
# «Проверки по реестрам» блок «Комментарий команды» снимается, его три фразы — дословно, без новых слов — переезжают
# одним пунктом в раздел под реестрами; пункт начинается с имени компании, строки факта и даты сведений этой карточки.
# Жёлтые и красные комментарии остаются под своей строкой. Оговорка [Право] 02.10 — одна на карточку: если под строками
# ещё есть комментарии — остаётся там, иначе — последней строкой сводного блока. Подпись «Команда Делоскопа · …» —
# одна на блок, у пункта — только норма и дата сверки. Пункт — тот же «kom kom--zel» (цвета и тёмная тема — прежние).
# Чистая функция по готовой разметке: одинаково для новых карточек (обёртка html_kartochki ниже, значит и API) и
# опубликованных (kartochki.py → perepechatat). Повторный вызов ничего не меняет. В отчёте /api/check — как было.
_SV_REESTRY = re.compile(r'(<section class="co-sec" aria-labelledby="reestry">)(.*?)(</section>)', re.S)
_SV_PARA = re.compile(r'<div class="fact"><span>([^<]*)</span><span class="fact__v">([^<]*)</span>'
                      r'<span class="fact__src co-src">([^<]*)</span></div>'
                      r'(<div class="kom kom--zel" data-kom="([a-z0-9_]+)"><div class="kom__h">[^<]*</div>(.*?)'
                      r'<div class="kom__p">([^<]*)</div></div>)', re.S)
_SV_OG = '<p class="kom-og">'
_SV_DATA = re.compile(r"сведения на (\d{2}\.\d{2}\.\d{4})")
SV_METKA = 'class="co-sec co-zel"'


def _sv_podpis(stroki):
    """Подписи пунктов «Команда Делоскопа · 115-ФЗ и налоги · норма · нормы сверены …» → общая часть и хвосты."""
    chasti = [s.split(" · ") for s in stroki]
    n = min(len(c) for c in chasti)
    obsh = 0
    while obsh < n - 1 and all(c[obsh] == chasti[0][obsh] for c in chasti):
        obsh += 1
    if len(chasti) == 1:  # один пункт: общая часть — до нормы (первые две части), как подпись библиотеки
        obsh = min(2, n - 1)
    return " · ".join(chasti[0][:obsh]), [" · ".join(c[obsh:]) for c in chasti]


def _sv_mal(s):
    return s[:1].lower() + s[1:]


def svodka_zel(t):
    if SV_METKA in t:
        return t
    m = _SV_REESTRY.search(t)
    if not m or "kom kom--zel" not in m.group(2):
        return t
    telo = m.group(2)
    pary = list(_SV_PARA.finditer(telo))
    if not pary:
        return t
    org = _sh_org(t)
    im = html.escape(un_kratkoe(str(org.get("name") or "")), quote=False).replace(" ", NB, 1) or "компании"
    podpis, hvosty = _sv_podpis([p.group(7) for p in pary])
    punkty = []
    for p, hv in zip(pary, hvosty):
        zag, znach, src, kod, frazy = p.group(1), p.group(2), p.group(3), p.group(5), p.group(6)
        d = _SV_DATA.search(src)
        fakt = _sv_mal(znach) if len(znach.split()) >= 3 else "%s — %s" % (_sv_mal(zag), _sv_mal(znach))
        punkty.append('<li class="kom kom--zel co-zel__i" data-kom="%s"><p class="co-zel__f">%s: %s%s</p>%s'
                      '<div class="kom__p">%s</div></li>' % (kod, im, fakt, (", сведения на " + d.group(1)) if d else "",
                                                             frazy, hv))
    novoe = telo
    for p in pary:
        novoe = novoe.replace(p.group(4), "", 1)
    og = ""
    if 'class="kom ' not in novoe and _SV_OG in novoe:
        i = novoe.index(_SV_OG)
        j = novoe.index("</p>", i) + 4
        og, novoe = novoe[i:j], novoe[:i] + novoe[j:]
    blok = ('\n<section %s aria-labelledby="zel"><h2 id="zel">Что значат зелёные строки %s для банка и налоговой</h2>'
            '<ul class="co-zel__s">%s</ul>%s%s</section>' % (
                SV_METKA, im, "".join(punkty), ('<p class="kom__p">%s</p>' % podpis) if podpis else "", og))
    return t[:m.start()] + m.group(1) + novoe + m.group(3) + blok + t[m.end():]


_html_kartochki_do_svodki = html_kartochki


def html_kartochki(k, V, sosedi, kom=None, normy=None, cena=None, segodnya=None):  # noqa: F811
    """kartochki-svodka-v1: зелёные комментарии — одним блоком под реестрами."""
    return svodka_zel(_html_kartochki_do_svodki(k, V, sosedi, kom, normy, cena, segodnya))
