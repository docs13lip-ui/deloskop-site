#!/usr/bin/env python3
"""kartochki-vybor-v1 (Ночные-2, 04.10): какие ИНН звать в /api/check, чтобы не тратить суточный потолок впустую.

ТЗ [Продукт · Данные] 03.10 18:55 (claude/Продукт_волна_5000_карточек_ворота_ответы_✎_03.10.md): упираемся не в токен,
а в ИНН — слепой список крупных проходит ворота ~50 %, отбор из набора ФНС revexp (доходы за год по бухотчётности) — ~85 %.
Три вещи (только стандартная библиотека, данных компаний в репозиторий не кладём):

1. Опубликованные — не спрашиваем: ИНН из папок company/<ИНН>-<slug>/ сайта (одна живая проверка = один запрос DaData).
2. Отсев (tests/kartochki_otsev.txt): ИНН, которые уже не прошли ворота публикации, с датой и причиной — не спрашиваем
   OTSEV_DNEJ дней (финансы за год появляются раз в год). Только 10-значные ИНН юрлиц, без названий и сведений о людях.
   Ворота не меняются: отсев лишь не тратит запрос на заранее известный отказ; `iz-api --zanovo` спрашивает всё.
3. `vybor` — список кандидатов из скачанного набора revexp (zip или xml) по правилам ТЗ разд. 3.1: доходы от 60 млн до
   50 млрд ₽, контрольная сумма ИНН, без опубликованных и отсева; квоты 15 % Липецкая область (48), 35 % остальной ЦФО,
   50 % другие регионы; внутри квоты — доход по убыванию; недобор квоты добирается из остальных тем же порядком.
   Набор из облака не скачать (file.nalog.ru — 403 политикой сети), запускает тот, у кого он есть.

    python3 tests/kartochki.py vybor --revexp data-….zip [--n 500] [--ot 60000000] [--do 50000000000] [--vyhod spisok.txt]
    python3 tests/kartochki.py otsev --vhod tests/kartochki_dannye/x.jsonl     # дописать отказы ворот в отсев
    python3 tests/kartochki.py iz-api --inn spisok.txt … [--zanovo]            # опубликованные и отсев пропускаются
"""
import datetime as dt
import io
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPKA = "company"
OTSEV = os.path.join(KOREN, "tests", "kartochki_otsev.txt")
OTSEV_DNEJ = 90
VYBOR_N = 500
VYBOR_N_MAKS = 2000
DOHOD_OT = 60e6
DOHOD_DO = 50e9
# ЦФО — коды регионов по первым двум цифрам ИНН (код налоговой при постановке на учёт; у переехавших может не совпасть)
CFO = frozenset({"31", "32", "33", "36", "37", "40", "44", "46", "48", "50", "57", "62", "67", "68", "69", "71", "76", "77"})
KVOTY = (("lipeck", 0.15), ("cfo", 0.35), ("drugie", 0.50))
_VES = (2, 4, 10, 3, 5, 9, 4, 6, 8)


def inn_yul_ok(s):
    s = str(s or "")
    return len(s) == 10 and s.isdigit() and sum(int(a) * b for a, b in zip(s, _VES)) % 11 % 10 == int(s[9])


def opublikovannye(koren=KOREN):
    """ИНН опубликованных карточек — по именам папок company/<ИНН>-<slug>/ (хабы и страницы списка — не карточки)."""
    p = os.path.join(koren, PAPKA)
    if not os.path.isdir(p):
        return set()
    return {m.group(1) for d in os.listdir(p) for m in [re.match(r"(\d{10})-", d)]
            if m and os.path.isfile(os.path.join(p, d, "index.html"))}


# ---------------------------------------------------------------- отсев
def chitat_otsev(put=OTSEV):
    """→ {ИНН: (дата, причина)}; строки: «ИНН · ГГГГ-ММ-ДД · причина», «#» — комментарий. Последняя запись ИНН главнее."""
    out = {}
    if not os.path.exists(put):
        return out
    with open(put, encoding="utf-8") as fh:
        stroki = fh.read().splitlines()
    for s in stroki:
        s = s.strip()
        if not s or s.startswith("#"):
            continue
        ch = [x.strip() for x in s.split("·", 2)]
        if len(ch) < 2 or not inn_yul_ok(ch[0]):
            continue
        try:
            d = dt.date.fromisoformat(ch[1])
        except ValueError:
            continue
        out[ch[0]] = (d, ch[2] if len(ch) > 2 else "")
    return out


def otsev_dejstvuet(otsev, segodnya, dnej=OTSEV_DNEJ):
    """ИНН, которые не спрашиваем сегодня: запись не старше dnej дней (и не из будущего)."""
    return {inn for inn, (d, _) in otsev.items() if 0 <= (segodnya - d).days < dnej}


def zapisat_otsev(otsev, put=OTSEV):
    """Файл пишется целиком, по ИНН — детерминированно; шапка-комментарий сохраняется."""
    shapka = []
    if os.path.exists(put):
        with open(put, encoding="utf-8") as fh:
            for s in fh.read().splitlines():
                if not s.startswith("#"):
                    break
                shapka.append(s)
    stroki = ["%s · %s · %s" % (inn, d.isoformat(), pr.replace("\n", " ").strip()) for inn, (d, pr) in sorted(otsev.items())]
    with open(put, "w", encoding="utf-8") as fh:
        fh.write("\n".join(shapka + stroki) + "\n")


def otsev_iz_otveta(zapisi, segodnya, vorota_fn):
    """Ответы /api/check → {ИНН: (дата, причина)} для тех, кто не прошёл ворота публикации. ИП (12 цифр) — не пишем вовсе.
    vorota_fn(запись) → (годится, причина) — та же функция, что у сборки (kartochki.otobrat)."""
    out = {}
    for r in zapisi:
        inn = re.sub(r"\D", "", str(((r.get("company") or {}).get("inn")) or r.get("inn") or ""))
        if not inn_yul_ok(inn):
            continue
        ok, pr = vorota_fn(r)
        if ok:
            out.pop(inn, None)
            continue
        out[inn] = (segodnya, "ворота публикации: " + pr)  # причина сборки, а не сведения о компании
    return out


def ne_sprashivat(segodnya, koren=KOREN, put=OTSEV):
    """→ (опубликованные, отсев действующий) — два множества ИНН, которые iz-api пропускает без --zanovo."""
    return opublikovannye(koren), otsev_dejstvuet(chitat_otsev(put), segodnya)


# ---------------------------------------------------------------- отбор из набора ФНС revexp
def _attr(el, *imena):
    for k, v in el.attrib.items():
        if k.split("}")[-1] in imena:
            return v
    return None


def stroki_revexp(fh):
    """Поток XML набора revexp → (ИНН, доход). Документ ФНС: <Документ><СведНП ИННЮЛ=…/><СведДохРасх СумДоход=…/></Документ>;
    ищем атрибуты на любом уровне внутри «Документ», чтобы перестановка тегов не обнуляла отбор."""
    inn = doh = None
    for sob, el in ET.iterparse(fh, events=("start", "end")):
        tag = el.tag.split("}")[-1]
        if sob == "start":
            if tag == "Документ":
                inn = doh = None
            continue
        v = _attr(el, "ИННЮЛ")
        if v:
            inn = v.strip()
        v = _attr(el, "СумДоход")
        if v:
            doh = v.strip()
        if tag == "Документ":
            if inn and doh:
                try:
                    yield inn, float(doh.replace(",", "."))
                except ValueError:
                    pass
            el.clear()


def chitat_revexp(put):
    """zip (как публикует ФНС — много xml внутри) или один xml → {ИНН: доход}; неверные ИНН и ИП отброшены."""
    out = {}

    def _dob(fh):
        for inn, d in stroki_revexp(fh):
            if inn_yul_ok(inn):
                out[inn] = d

    if zipfile.is_zipfile(put):
        with zipfile.ZipFile(put) as z:
            for n in sorted(z.namelist()):
                if n.lower().endswith(".xml"):
                    with z.open(n) as fh:
                        _dob(io.BufferedReader(fh))
    else:
        with open(put, "rb") as fh:
            _dob(fh)
    return out


def kvota_inn(inn):
    r = inn[:2]
    return "lipeck" if r == "48" else "cfo" if r in CFO else "drugie"


def vybrat(dohody, n=VYBOR_N, ot=DOHOD_OT, do=DOHOD_DO, isklyuchit=()):
    """{ИНН: доход} → список ИНН (порядок = порядок запросов). Квоты KVOTY; недобор квоты — из остальных по доходу."""
    n = max(0, min(int(n), VYBOR_N_MAKS))
    iskl = set(isklyuchit)
    kand = sorted(((-d, inn) for inn, d in dohody.items() if ot <= d <= do and inn not in iskl and inn_yul_ok(inn)))
    po = {k: [inn for _, inn in kand if kvota_inn(inn) == k] for k, _ in KVOTY}
    vzyato, out = set(), []
    for k, dolya in KVOTY:
        for inn in po[k][:int(round(n * dolya))]:
            out.append(inn)
            vzyato.add(inn)
    for _, inn in kand:  # добор недостающего — крупные первыми
        if len(out) >= n:
            break
        if inn not in vzyato:
            out.append(inn)
            vzyato.add(inn)
    out = out[:n]
    # порядок запросов: по доходу, крупные первыми — чем раньше 429/потолок, тем ценнее уже полученное
    d = dohody
    return sorted(out, key=lambda i: (-d[i], i))


def main_vybor(argv, arg, segodnya):
    put = arg(argv, "--revexp")
    if not put or not os.path.exists(put):
        print("Нужен --revexp <zip|xml> — набор ФНС «доходы и расходы по бухотчётности» (7707329152-revexp).")
        return 2
    dohody = chitat_revexp(put)
    if not dohody:
        print("0 ИНН в наборе — проверьте имена тегов (ИННЮЛ, СумДоход) в XML.")
        return 1
    opub, otsev = ne_sprashivat(segodnya)
    sp = vybrat(dohody, int(arg(argv, "--n", str(VYBOR_N))), float(arg(argv, "--ot", str(DOHOD_OT))),
                float(arg(argv, "--do", str(DOHOD_DO))), opub | otsev)
    vyhod = arg(argv, "--vyhod", os.path.join(KOREN, "tests", "kartochki_dannye", "spisok.txt"))
    os.makedirs(os.path.dirname(os.path.abspath(vyhod)), exist_ok=True)
    with open(vyhod, "w", encoding="utf-8") as fh:
        fh.write("".join(i + "\n" for i in sp))
    po = {k: sum(1 for i in sp if kvota_inn(i) == k) for k, _ in KVOTY}
    print("В наборе ИНН юрлиц: %d · опубликовано: %d · в отсеве: %d · выбрано: %d (Липецкая %d, ЦФО %d, другие %d) → %s" % (
        len(dohody), len(opub), len(otsev), len(sp), po["lipeck"], po["cfo"], po["drugie"], vyhod))
    return 0


if __name__ == "__main__":
    print(__doc__)
    sys.exit(0)
