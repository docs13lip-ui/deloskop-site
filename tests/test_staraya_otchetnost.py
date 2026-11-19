"""staraya-otchetnost-v1 ([Ночные-2] 19.11, слова [Право] 19.11 вечер разд. 1 (1)): год сведений − год последней
открытой отчётности > 2 → в «Что это значит» только факт с годом и «Это старые данные — о нынешнем положении компании они
не говорят»; в «Перед оплатой» — «Свежей отчётности в открытых данных нет. Запросите баланс и отчёт о финансовых
результатах за {год − 1} … До этого — платите по факту поставки или этапами.» Советов по старым цифрам нет."""
import datetime
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tekst(s):
    return re.sub(r"[   ]", " ", html.unescape(re.sub(r"<[^>]+>", "", s or "")))


def sekciya(t, kod):
    m = re.search(r'<section class="co-sec co-%s".*?</section>' % kod, t, re.S)
    return tekst(m.group(0)) if m else ""


def karty():
    papka = os.path.join(KOREN, "company")
    for d in sorted(os.listdir(papka)):
        f = os.path.join(papka, d, "index.html")
        if os.path.isfile(f):
            with open(f, encoding="utf-8") as fh:
                yield d, fh.read()


class StarayaOtchetnost(unittest.TestCase):
    def test_god(self):
        na = datetime.date(2026, 10, 1)
        self.assertEqual(K.staraya_god({"ryad": [{"god": 2021, "dohod": 5}], "na": na}), (2021, 2026))
        self.assertIsNone(K.staraya_god({"ryad": [{"god": 2024, "dohod": 5}], "na": na}))  # позапрошлый — прежний абзац
        self.assertIsNone(K.staraya_god({"ryad": [{"god": 2025, "dohod": 5, "fns": True}], "na": na}))
        self.assertIsNone(K.staraya_god({"ryad": [], "na": na}))

    def test_slova_prava(self):
        s = tekst(K.staraya_pered_tekst(2026))
        self.assertEqual(s, "Свежей отчётности в открытых данных нет. Запросите баланс и отчёт о финансовых результатах "
                            "за 2025 год с квитанцией о приёме налоговой. До этого — платите по факту поставки или этапами.")
        self.assertFalse(K.STOP_SLOVA.search(s))

    def test_motorinvest(self):
        with open(os.path.join(KOREN, "company", "4810004427-motorinvest", "index.html"), encoding="utf-8") as fh:
            t = fh.read()
        z, p = sekciya(t, "znachit"), sekciya(t, "pered")
        self.assertIn("Последняя открытая отчётность «Моторинвест» — за 2021 год: убыток 202 млн ₽ при выручке 19,6 млн ₽. "
                      "Это старые данные — о нынешнем положении компании они не говорят. За 2022–2025 годы", z)
        self.assertEqual(z.count("Последняя открытая отчётность"), 1)
        self.assertNotIn("лучше разбить на этапы", z)
        self.assertNotIn("Аванс — частями", p)
        self.assertIn("Свежей отчётности в открытых данных нет", p)
        self.assertIn("Проверить счёт", p)

    def test_vse_kartochki(self):
        # у карточек со старой отчётностью — нет советов, опирающихся на её цифры; запрос свежей отчётности — один раз
        n = 0
        for d, t in karty():
            if "Свежей отчётности в" not in t:
                continue
            n += 1
            p = sekciya(t, "pered")
            self.assertEqual(p.count("Свежей отчётности в открытых данных нет"), 1, d)
            m = re.search(r"финансовых результатах за (\d{4}) год", p)
            god = int(m.group(1))
            for abz in re.findall(r"<p>(.*?)</p>", re.search(r'<section class="co-sec co-znachit".*?</section>', t, re.S)
                                  .group(0) if "co-znachit" in t else "", re.S):
                x = tekst(abz)
                if re.search(r"за %d год" % (god - 4) + "|" + r"за %d год" % (god - 3) + "|" + r"за %d год" % (god - 5), x):
                    self.assertNotRegex(x, r"аванс|запас прочности|этапам|после приёмки|обычный|крупная", d)
            self.assertNotIn("Аванс — частями", p, d)
        self.assertGreaterEqual(n, 20)


if __name__ == "__main__":
    unittest.main()
