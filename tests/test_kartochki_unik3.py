#!/usr/bin/env python3
"""kartochki-unik-v3 ([Ночные-2] 17.10, Очередь п. 310): «Похожие компании» — сравнение с этой компанией по обороту
за один и тот же год; хабы отраслей и регионов — вводный абзац из данных и своя подпись строки.
Первая сборка из сведений и добор дают одни и те же байты; опубликованные карточки уже пересобраны.
Запуск: python3 tests/test_kartochki_unik3.py"""
import pathlib
import re
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = "\u00a0"


def kart(name, dohod, god, region="г Москва", gorod="Москва", inn="7700000001", okved="35.12"):
    return {"inn": inn, "name": name, "region": region, "gorod": gorod, "okved": okved,
            "fakty": {"dohod": {"znachenie": dohod, "god": god}}}


class Otnoshenie(unittest.TestCase):
    def test_slova(self):
        self.assertEqual(R.sos_otnoshenie(100, 210), "в" + NB + "2,1" + NB + "раза больше")
        self.assertEqual(R.sos_otnoshenie(100, 300), "в" + NB + "3" + NB + "раза больше")
        self.assertEqual(R.sos_otnoshenie(100, 1500), "в" + NB + "15" + NB + "раз больше")
        self.assertEqual(R.sos_otnoshenie(100, 2100), "", "больше чем в 20 раз — без сравнения")
        self.assertEqual(R.sos_otnoshenie(1248, 1), "")
        self.assertEqual(R.sos_otnoshenie(100, 130), "на" + NB + "30" + NB + "% больше")
        self.assertEqual(R.sos_otnoshenie(100, 70), "на" + NB + "30" + NB + "% меньше")
        self.assertEqual(R.sos_otnoshenie(100, 40), "в" + NB + "2,5" + NB + "раза меньше")
        self.assertEqual(R.sos_otnoshenie(100, 105), "почти столько же")
        self.assertEqual(R.sos_otnoshenie(0, 105), "")


class Podpis(unittest.TestCase):
    def test_odin_god_sravnenie(self):
        k = kart("ООО «Лента»", 100e9, 2025)
        x = kart("ООО «О’КЕЙ»", 210e9, 2025, inn="7700000002", gorod="Санкт-Петербург")
        p = R.sos_podpis(k, x)
        self.assertIn("раза больше, чем у «Лента»", p)
        self.assertIn("за" + NB + "2025", p)
        self.assertTrue(p.endswith("Санкт-Петербург"), p)

    def test_raznye_gody_bez_sravneniya(self):
        # 2021 против 2025 — не сравниваем: оборот разных лет читался бы как одно и то же
        k = kart("ООО «Лента»", 100e9, 2021)
        x = kart("ООО «О’КЕЙ»", 210e9, 2025, inn="7700000002", gorod="Санкт-Петербург")
        p = R.sos_podpis(k, x)
        self.assertNotIn("чем у", p)
        self.assertTrue(p.startswith("Санкт-Петербург, 210"), p)

    def test_net_goda_bez_sravneniya(self):
        k = kart("ООО «Лента»", 100e9, None)
        x = kart("ООО «О’КЕЙ»", 210e9, 2025, inn="7700000002")
        self.assertNotIn("чем у", R.sos_podpis(k, x))


class Haby(unittest.TestCase):
    def test_vvod_krupnye(self):
        g = {"vid": "otrasl", "imya": "Энергетика", "slug": "energetika", "kart": [
            kart("АО «А»", 5e9, 2025, inn="7700000001"), kart("АО «Б»", 9e9, 2025, inn="7700000002"),
            kart("АО «В»", 1e9, 2025, inn="7700000003", region="г Санкт-Петербург", gorod="Санкт-Петербург"),
            kart("АО «Г»", 2e9, 2024, inn="7700000004")]}
        v = R.hab_vvod(g)
        self.assertIn("«Б» — 9" + NB + "млрд" + NB + "₽ за" + NB + "2025, «А» — 5", v)
        self.assertIn("и «Г» — 2" + NB + "млрд" + NB + "₽ за" + NB + "2024.", v)
        self.assertIn("с адресом г Москва (3), дальше — г Санкт-Петербург (1)", v)

    def test_vvod_malo(self):
        g = {"vid": "region", "imya": "г Москва", "slug": "moskva", "kart": [kart("АО «А»", 5e9, 2025)]}
        self.assertEqual(R.hab_vvod(g), "")


def sobrat(zapisi, **kw):
    d = tempfile.mkdtemp()
    shutil.copy(KOREN / "robots.txt", d)
    _, o = K.sobrat(zapisi, d, **kw)
    return d, o


class Sborka(unittest.TestCase):
    def test_dobor_ravno_pervaya_sborka(self):
        d, _ = sobrat(O.nabor(12))
        try:
            st = {p: p.read_text(encoding="utf-8") for p in pathlib.Path(d, "company").rglob("index.html")}
            _, o = K.sobrat([], d, dobavit=True)
            self.assertEqual(o["izmeneno_stranic"], 0)
            for p, t in st.items():
                self.assertEqual(p.read_text(encoding="utf-8"), t, p)
            sravn = sum("чем у «" in t for t in st.values())
            self.assertGreater(sravn, 0, "ни одной подписи-сравнения на образцовом наборе")
        finally:
            shutil.rmtree(d, ignore_errors=True)

    def test_na_saite(self):
        # опубликованные карточки и хабы уже собраны по v3 (иначе — python3 tests/kartochki.py perepechatat)
        papka = KOREN / "company"
        haby = [p for p in papka.glob("*/*/index.html") if p.parent.parent.name in ("otrasl", "region")]
        for p in haby:
            self.assertIn('class="co-hab__vvod"', p.read_text(encoding="utf-8"), p)
        karty = [p for p in papka.glob("*/index.html") if re.match(r"^\d{10}-", p.parent.name)]
        if karty:
            self.assertTrue(any("чем у «" in p.read_text(encoding="utf-8") for p in karty))


if __name__ == "__main__":
    unittest.main()
