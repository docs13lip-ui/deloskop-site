#!/usr/bin/env python3
"""kartochki-unik-v8c ([Ночные-2] 21.10): подпись соседа в «Похожих компаниях».
(1) У сравнения есть подлежащее: «оборот в 9,9 раза больше, чем у «X»», «оборот почти такой же, как у «X»»
    (на живом — «в 9,9 раза больше, чем у…»: больше чего, не сказано).
(2) Годы оборота разные — сравнения нет, как было, но сумма с годом: «Москва · оборот 289 млрд ₽ за 2024»
    (без года сумма читалась как сравнимая с оборотом этой компании).
Запуск: python3 tests/test_kartochki_unik8c.py"""
import html
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = "\u00a0"


def kart(name, dohod, god, gorod="Москва", inn="7700000001"):
    return {"inn": inn, "name": name, "region": "г Москва", "gorod": gorod, "okved": "46.18",
            "fakty": {"dohod": {"znachenie": dohod, "god": god}}}


class Podpis(unittest.TestCase):
    def test_bolshe_s_podlezhashchim(self):
        p = R.sos_podpis(kart("АО «Фармстандарт»", 142e9, 2025), kart("АО «ТК Мегаполис»", 1.4e12, 2025, "Видное", "7700000002"))
        self.assertTrue(p.startswith("оборот в" + NB + "9,9" + NB + "раза больше, чем у «Фармстандарт»: "), p)
        self.assertTrue(p.endswith("за" + NB + "2025 · Видное"), p)

    def test_pochti_takoj_zhe(self):
        p = R.sos_podpis(kart("АО «Фармстандарт»", 142e9, 2025), kart("ООО «Комус»", 147e9, 2025, inn="7700000002"))
        self.assertTrue(p.startswith("оборот почти такой же, как у «Фармстандарт»: 147"), p)
        self.assertNotIn("сколько у", p)

    def test_raznye_gody_s_godom(self):
        p = R.sos_podpis(kart("АО «Фармстандарт»", 142e9, 2025), kart("ООО «СЭРК»", 289e9, 2024, inn="7700000002"))
        self.assertEqual(p, "Москва · оборот 289" + NB + "млрд" + NB + "₽ за" + NB + "2024")
        self.assertNotIn("чем у", p)

    def test_bez_goda_i_bez_goroda(self):
        x = kart("ООО «Б»", 5e9, None, gorod="", inn="7700000002")
        x["region"] = ""
        p = R.sos_podpis(kart("ООО «А»", 1e9, 2025), x)
        self.assertTrue(p.startswith("оборот 5"), p)
        self.assertNotIn("за" + NB, p)
        self.assertEqual(R.sos_podpis(kart("ООО «А»", 1e9, 2025), kart("ООО «Б»", 0, None, inn="7700000002")), "Москва")


class Opublikovannye(unittest.TestCase):
    """Опубликованные карточки пересобраны: в «Похожих» нет сравнения без подлежащего и суммы без года."""

    def test_karty(self):
        karty = sorted((KOREN / "company").glob("[0-9]" * 10 + "-*/index.html"))
        if not karty:
            self.skipTest("карточек нет")
        sravn = 0
        for f in karty:
            t = R.bez_tipografa(f.read_text(encoding="utf-8"))  # kartochki-korotkie-v1: без NB_T
            for blok in re.findall(r'<ul class="co-sos(?: co-sos--eshche)?">(.*?)</ul>', t, re.S):
                for cap in re.findall(r'<span class="caption">(.*?)</span>', blok):
                    c = html.unescape(cap)
                    self.assertFalse(re.match(r"^(в|на)\s", c), "%s: %s" % (f.parent.name, c))
                    self.assertNotIn("сколько у", c, f.parent.name)
                    if "₽" in c and "чем у" not in c and "как у" not in c:
                        self.assertRegex(c, r"за\s\d{4}", "%s: сумма без года — %s" % (f.parent.name, c))
                    sravn += "чем у «" in c
        self.assertGreater(sravn, 100)


if __name__ == "__main__":
    unittest.main()
