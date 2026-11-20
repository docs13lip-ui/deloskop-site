#!/usr/bin/env python3
"""ne-svereno-kartochki-v1 ([Ночные-2] 21.11.2026, ТЗ [Ночные запуски] 21.11 00:40): год выручки, помеченный сервером
`ne_svereno` (или равный прошлому году до рубля), не идёт на карточку — ни выводом «Выручка за Г», ни динамикой, ни долями.
Год остаётся оговоркой под таблицей с прибылью года; давность отчётности считается по нему («о 2025 ничего не говорит» — нет).
Ответ — короткий словарь по образцу живого /api/check «Магнита» 2309085638 21.11 (числа ГИР БО, без людей)."""
import copy
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

NS = [{"god": 2025, "pokazateli": ["vyruchka"], "tekst": "Год не сверен"}]
OTVET = {
    "company": {"inn": "2309085638", "ogrn": "1032304945947", "kpp": "231101001", "kind": "LEGAL", "status": "ACTIVE",
                "name_short": "ПАО \"МАГНИТ\"", "name_full": "ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО \"МАГНИТ\"",
                "reg_date": "2003-11-18", "address": "г Краснодар, ул Солнечная, д 15/5", "okved": "70.10.1"},
    "checked_at": "2026-11-21T00:10:00+03:00",
    "signals": [{"title": "Задолженность по налогам", "detail": "Нет", "status": "ok",
                 "source": "ФНС, открытые данные", "as_of": "2026-10-01"},
                {"title": "Адрес", "detail": "Отметок о недостоверности нет", "status": "ok", "source": "ЕГРЮЛ"}],
    "dengi": {"vyruchka": {"summa": 412062000, "god": 2025, "ne_svereno": NS}},
    "ne_svereno": NS,
    "dossier": {
        "kpi": [{"label": "Выручка за 2025", "value": 412062000, "delta": 0},
                {"label": "Чистая прибыль за 2025", "value": 5354640000, "delta": -92}],
        "charts": {
            "revenue": [{"year": 2020, "value": 767443000}, {"year": 2021, "value": 712086000},
                        {"year": 2022, "value": 713122000}, {"year": 2023, "value": 558670000},
                        {"year": 2024, "value": 412062000}, {"year": 2025, "value": 412062000}],
            "profit": [{"year": 2020, "value": 28127553000}, {"year": 2021, "value": 57079156000},
                       {"year": 2022, "value": 272038000}, {"year": 2023, "value": 98338389000},
                       {"year": 2024, "value": 63777902000}, {"year": 2025, "value": 5354640000}],
            "balance": {"year": 2025, "equity": 213482646000, "long_debt": 178108580000, "short_debt": 205979865000},
            "debts": {"year": 2025, "receivables": 63920315000, "payables": 5129706000, "loans": 378873287000},
        },
    },
}


def tekst(t):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t).replace("&#160;", " ").replace("&nbsp;", " ").replace(K.NB, " ")
    return re.sub(r"\s+", " ", t)


class Gody(unittest.TestCase):
    def test_server(self):
        k = K.iz_check(OTVET)
        self.assertEqual([x["god"] for x in k["finansy"]], [2020, 2021, 2022, 2023, 2024])
        self.assertEqual(k["fakty"]["dohod"]["god"], 2024)
        self.assertEqual(k["fakty"]["pribyl"]["god"], 2024)
        self.assertEqual([x["god"] for x in k["finansy_ne_svereno"]], [2025])
        self.assertAlmostEqual(k["fakty"]["dohod"]["delta"], (412062000 / 558670000 - 1) * 100)

    def test_storozh_bez_servera(self):
        r = copy.deepcopy(OTVET)
        r.pop("ne_svereno")
        r["dengi"] = {}
        k = K.iz_check(r)
        self.assertEqual([(x["god"], x["prichina"]) for x in k["finansy_ne_svereno"]], [(2025, "kopiya")])
        self.assertEqual(k["fakty"]["dohod"]["god"], 2024)

    def test_raznye_chisla_ne_trogaem(self):
        r = copy.deepcopy(OTVET)
        r.pop("ne_svereno")
        r["dengi"] = {}
        r["dossier"]["charts"]["revenue"][-1]["value"] = 412062001
        k = K.iz_check(r)
        self.assertEqual(k["finansy_ne_svereno"], [])
        self.assertEqual(k["fakty"]["dohod"]["god"], 2025)

    def test_melkie_ne_trogaem(self):
        r = copy.deepcopy(OTVET)
        r.pop("ne_svereno")
        r["dengi"] = {}
        for p in r["dossier"]["charts"]["revenue"][-2:]:
            p["value"] = 500000
        self.assertEqual(K.iz_check(r)["finansy_ne_svereno"], [])

    def test_drugoj_pokazatel(self):
        r = copy.deepcopy(OTVET)
        r["ne_svereno"] = [{"god": 2025, "pokazateli": ["pribyl"]}]
        r["dengi"] = {}
        r["dossier"]["charts"]["revenue"][-1]["value"] = 500000000
        self.assertEqual(K.iz_check(r)["finansy_ne_svereno"], [])


class Stranica(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ok, _, cls.adres, t = K.kartochka_iz_check(copy.deepcopy(OTVET))
        cls.t = t or ""
        cls.x = tekst(cls.t)

    def test_ogovorka(self):
        self.assertIn('class="small co-fin-nesver" data-god="2025"', self.t)
        self.assertIn("Выручку за 2025 год не показываем: в открытых данных она совпадает с 2024 годом до рубля", self.x)
        self.assertIn("Чистая прибыль за 2025 год — 5,4 млрд ₽ (ГИР БО)", self.x)

    def test_net_vyruchki_2025(self):
        self.assertNotRegex(self.x, r"Выручка за 2025|выручки за 2025|до 412 млн ₽ в 2025|412 млн ₽ в 2025")
        self.assertNotIn("почти не изменилась", self.x)

    def test_davnost_po_godu_otchetnosti(self):
        self.assertNotIn("о 2025 годе она ничего не говорит", self.x)
        self.assertNotIn("Последняя открытая отчётность «Магнит» — за 2024", self.x)

    def test_tablica(self):
        self.assertIsNone(re.search(r"<tr><td>2025</td>", self.t))
        self.assertRegex(self.t, r"<tbody><tr><td>2024</td>")


if __name__ == "__main__":
    unittest.main()
