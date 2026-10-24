#!/usr/bin/env python3
"""kartochki-unik-v11 ([Ночные-2] 24.10): подпись «Разбора по цифрам», вход в Паспорт, боковые «Полный отчёт» и
«Паспорт контрагента» — с названием компании, а не одной фразой на 140–167 карточках. Совпадение предложений
с соседними карточками на 24.10: медиана 59 % → 54 %, ниже цели 60 % — 165 из 167 (отчёт kartochki.py, не ворота).
Тексты [Право] не трогаем. Запуск: python3 tests/test_kartochki_unik11.py"""
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = "\u00a0"
LD = '<script type="application/ld+json">{"@graph": [{"@type": "Organization", "name": "%s", "taxID": "7705035012"}]}</script>'
TELO = ('<p class="caption">◆ рассчитано Делоскопом по данным: ГИР БО, бухгалтерская отчётность и открытые данные ФНС — '
        'без оценки компании.</p>'
        '<p class="co-daty__vhod">Полный Паспорт контрагента: руководитель и' + NB + 'учредители, финансы</p>'
        '<p class="small">Финансы за пять лет, налоги и долги, разбор Индекса</p>'
        '<p class="small">Документ для папки к сделке: 17 разделов, у каждого факта</p>')
OBSHCHIE = ("◆ рассчитано Делоскопом по данным:", "Полный Паспорт контрагента: руководитель",
            "Финансы за пять лет", "Документ для папки к сделке: 17 разделов")


class TestImya(unittest.TestCase):
    def test_s_imenem_i_povtor(self):
        t = R.pochinit_imya(LD % "ПАО «Мосэнерго»" + TELO)
        im = "ПАО" + NB + "«Мосэнерго»"
        for f in ("◆ рассчитано Делоскопом для %s по данным: ГИР БО" % im,
                  "Полный Паспорт контрагента %s: руководитель и" % im,
                  "Финансы «Мосэнерго» за пять лет, налоги и долги",
                  "Документ для папки к сделке с %s: 17 разделов" % im,
                  "без оценки компании."):
            self.assertIn(f, t)
        for f in OBSHCHIE:
            self.assertNotIn(f, t)
        self.assertEqual(R.pochinit_imya(t), t)  # идемпотентна

    def test_bez_formy_kak_bylo(self):
        t = LD % "Банк ВТБ (ПАО)" + TELO
        self.assertEqual(R.pochinit_imya(t), t)


class TestNaDiske(unittest.TestCase):
    def test_otkrytye_kartochki_s_imenem(self):
        n = 0
        for f in sorted((KOREN / "company").glob("[0-9]" * 10 + "-*/index.html")):
            t = f.read_text(encoding="utf-8")
            m = re.search(r'"@type": "Organization", "name": "([^"]+)"', t)
            if not m or m.group(1).split(" ")[0] not in R.IMYA_FORMY or len(m.group(1).split(" ")) < 2:
                continue
            n += 1
            for o in OBSHCHIE:
                self.assertNotIn(o, t, f.parent.name + ": kartochki.py perepechatat")
        self.assertGreater(n, 100)


if __name__ == "__main__":
    unittest.main()
