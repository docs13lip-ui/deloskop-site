#!/usr/bin/env python3
"""kartochki-unik-v10 ([Ночные-2] 24.10): заголовки баланса, подписи к Индексу и балансу, кнопка «Проверить счёт» —
с названием компании (форма-аббревиатура), а не «компания» / «этой компании». Совпадение предложений с соседними
карточками на 24.10: медиана 65 % → 59 % (цель < 60 %, отчёт kartochki.py — не ворота). Тексты [Право] не трогаем.
Запуск: python3 tests/test_kartochki_unik10.py"""
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = " "
LD = '<script type="application/ld+json">{"@graph": [{"@type": "Organization", "name": "%s", "taxID": "7707083893"}]}</script>'
TELO = ('<p class="caption">Балл от 1 до 99 считаем на сегодняшних данных, когда собрано не меньше 60&nbsp;% сведений.</p>'
        '<a class="btn btn--secondary" href="/proverit-schet/">Проверить счёт от этой компании</a>'
        '<h3 class="co-h3">На чём держится компания — баланс на&nbsp;31.12.2025</h3>'
        '<h3 class="co-h3">Кто кому должен — на&nbsp;31.12.2025</h3>'
        '<p class="small">Суммы из бухгалтерской отчётности на конец года, без оценок. Что они значат для сделки — в полном отчёте.</p>')
OBSHCHIE = ("Балл от 1 до 99 считаем", "Проверить счёт от этой компании", "На чём держится компания",
            "Кто кому должен — на", "Что они значат для сделки — в полном отчёте.")


class TestImya(unittest.TestCase):
    def test_s_imenem_i_povtor(self):
        t = R.pochinit_imya(LD % "ПАО «Мосэнерго»" + TELO)
        im = "ПАО" + NB + "«Мосэнерго»"
        for f in ("Балл от 1 до 99 для %s считаем на сегодняшних данных" % im,
                  'href="/proverit-schet/">Проверить счёт от «Мосэнерго»</a>',
                  "На чём держится %s — баланс на&nbsp;31.12.2025" % im,
                  "Кто кому должен — расчёты %s на&nbsp;31.12.2025" % im,
                  "Что они значат для сделки с %s — в полном отчёте." % im):
            self.assertIn(f, t)
        for f in OBSHCHIE:
            self.assertNotIn(f, t)
        self.assertEqual(R.pochinit_imya(t), t)  # идемпотентна

    def test_dlinnoe_imya_knopka_prezhnyaya(self):
        t = R.pochinit_imya(LD % "ООО «Газпром трансгаз Санкт-Петербург»" + TELO)
        self.assertIn("Проверить счёт от этой компании", t)
        self.assertIn("На чём держится ООО" + NB + "«Газпром трансгаз Санкт-Петербург»", t)

    def test_bez_formy_kak_bylo(self):
        t = LD % "Банк ВТБ (ПАО)" + TELO
        self.assertEqual(R.pochinit_imya(t), t)


class TestNaDiske(unittest.TestCase):
    def test_otkrytye_kartochki_s_imenem(self):
        n = 0
        for f in sorted((KOREN / "company").glob("[0-9]" * 10 + "-*/index.html")):
            t = f.read_text(encoding="utf-8")
            m = re.search(r'"@type": "Organization", "name": "([^"]+)"', t)
            if not m or m.group(1).split(" ")[0] not in R.IMYA_FORMY:
                continue
            n += 1
            for o in OBSHCHIE[:1] + OBSHCHIE[2:]:
                self.assertNotIn(o, t, f.parent.name + ": kartochki.py perepechatat")
        self.assertGreater(n, 100)


if __name__ == "__main__":
    unittest.main()
