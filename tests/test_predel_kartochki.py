#!/usr/bin/env python3
"""predel-kartochki-v1 ([Ночные-2] 19.11, аудит 19.11 «чрезмерно уверенные денежные рекомендации»): на карточках
/company/ абзац «средняя выручка в месяц» при выручке старше двух лет (год сведений − год выручки ≥ 3, правило [Право]
12.11 п. 3) не меряет сделку — без «обычный», «крупная», «платите после приёмки»; число — с годом.
Запуск: python3 tests/test_predel_kartochki.py"""
import glob
import pathlib
import re
import sys
import unittest

KOREN = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOREN / "tests"))
import kartochka_render as R  # noqa: E402

NB = " "
MERILO = re.compile(r"для неё обычный|сделка от [^.]{0,40}крупная|займёт заметную часть|лучше оплачивать после приёмки|"
                    r"кто будет его выполнять|пропишите этапы оплаты и срок возврата аванса|по выручке не соизмерить")


class TestStaryj(unittest.TestCase):
    def test_tekst(self):
        s = R.un_mesyac_staryj("«Ромашка»", 2021, 19.2e6).replace(NB, " ")
        self.assertTrue(s.startswith("За 2021 год средняя выручка «Ромашка» была 1,6 млн ₽ в месяц"), s)
        self.assertFalse(MERILO.search(s), s)
        self.assertFalse(R.STOP_SLOVA.search(s), s)

    def test_zhivye_kartochki(self):
        """В опубликованных карточках абзац «Что это значит» не меряет сделку выручкой трёхлетней давности."""
        n = 0
        for f in sorted(glob.glob(str(KOREN / "company" / "*" / "index.html"))):
            t = open(f, encoding="utf-8").read().replace("&nbsp;", " ").replace("&#160;", " ").replace(NB, " ")
            m = re.search(r"Сведения на (\d\d)\.(\d\d)\.(\d{4})|«?ЕГРЮЛ · сведения на (\d\d)\.(\d\d)\.(\d{4})", t)
            for p in re.findall(r"<p>([^<]*)</p>", t):
                if not MERILO.search(p):
                    continue
                g = re.search(r"за (20\d\d) год", p)
                god_sv = int(m.group(3) or m.group(6)) if m else 2026
                if g:
                    n += 1
                    self.assertLess(god_sv - int(g.group(1)), 3, (f, p[:160]))
        self.assertGreater(n, 100)  # мерило осталось у свежих

    def test_svezhij_ne_tronut(self):
        s = R.un_mesyac("«А»", "за 2025 год", 24e9, 1e9, 0.0).replace(NB, " ")
        self.assertIn("для неё обычный", s)


if __name__ == "__main__":
    unittest.main()
