"""Вымышленные компании для тестов карточек (karta-v1). Регион «00» не существует — совпадение с реальной фирмой исключено.
Формат — как ответ /api/check. На сайт не попадает: тесты собирают карточки во временную папку."""


def inn10(n):
    s = "00" + str(n).zfill(7)
    w = [2, 4, 10, 3, 5, 9, 4, 6, 8]
    return s + str(sum(a * int(b) for a, b in zip(w, s)) % 11 % 10)


GORODA = ["Образцовск", "Примерный", "Тестоград"]
OKVED = [("41.20", "Строительство жилых и нежилых зданий"), ("46.90", "Торговля оптовая неспециализированная"),
         ("49.41", "Деятельность автомобильного грузового транспорта")]
NAZV = ["СТРОЙМАСТЕР", "АЛЬФА-ТРЕЙД", "ТД \"ЧЕРНОЗЕМЬЕ", "ВЕКТОР", "ГРУЗОВИК ПЛЮС", "ОБРАЗЕЦ", "ЛИНИЯ", "КВАДРАТ", "МОСТ", "ОПОРА"]


def zapis(i, **pr):
    g = GORODA[i % 3]
    ok, okn = OKVED[i % 3]
    dohod = pr.get("dohod", 5e6 * (i + 1))
    shtat = pr.get("shtat", 2 + i % 12)
    r = {
        "checked_at": "2026-09-29T10:00:00+03:00",
        "risk_level": "low",
        "company": {
            "inn": pr.get("inn", inn10(1000 + i)), "ogrn": "10200000%05d" % i, "kpp": "001001001",
            "kind": pr.get("kind", "LEGAL"), "status": pr.get("status", "ACTIVE"),
            "name_short": pr.get("name", 'ООО "%s %d"' % (NAZV[i % len(NAZV)], i)),
            "name_full": 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "%s %d"' % (NAZV[i % len(NAZV)], i),
            "reg_date": pr.get("reg_date", "%d-03-15" % (2010 + i % 14)),
            "address": "000000, Образцовская обл, г %s, ул Примерная, д %d" % (g, i + 1),
            "director_post": "Генеральный директор", "director_name": "Примеров Иван Петрович",
            "okved": ok, "okved_name": okn,
        },
        "signals": [
            {"title": "Среднесписочная численность", "status": "ok", "detail": "%d человек за 2025 год" % shtat, "source": "ФНС, открытые данные", "as_of": "2026-09-25"},
            {"title": "Уплаченные налоги и взносы", "status": "ok", "detail": "%s ₽ за 2025 год" % int((dohod or 3e6) * 0.08), "source": "ФНС, открытые данные: уплаченные налоги", "as_of": "2026-09-25"},
            {"title": "Долги по налогам", "status": pr.get("dolg_status", "ok"), "detail": pr.get("dolg", "нет"), "source": "ФНС, открытые данные: задолженность", "as_of": "2026-09-01"},
            {"title": "Недостоверность адреса или руководителя", "status": pr.get("nedost", "ok"), "detail": "отметок нет", "source": "ЕГРЮЛ", "as_of": "2026-09-29"},
        ],
        "dossier": {"kpi": [], "charts": {}},
        "polnota": pr.get("polnota", 24),
        "istochniki": [{"title": "Суды (арбитраж)", "status": "ne_provereno"}, {"title": "ФССП", "status": "ne_provereno", "prichina": "сопоставляем без ИНН"}],
    }
    if dohod is not None:
        r["dossier"]["kpi"].append({"label": "Доходы за год", "value": dohod, "delta": pr.get("delta", 12)})
        r["signals"].append({"title": "Доходы и расходы", "status": "info", "detail": "доход %d ₽ за 2025 год" % dohod, "source": "ФНС, открытые данные: доходы и расходы", "as_of": "2026-09-25"})
    if pr.get("finansy"):
        r["dossier"]["charts"]["revenue"] = [{"year": 2021 + j, "value": v} for j, v in enumerate(pr["finansy"])]
        r["girbo_data"] = "2026-04-01"
    if "indeks" in pr:
        r["indeks"] = pr["indeks"]
    return r


def nabor(n=30):
    out = [zapis(i) for i in range(n)]
    out[0] = zapis(0, finansy=[8e6, 11e6, 14e6, 18e6, 24e6], dohod=24e6, delta=33)
    return out
