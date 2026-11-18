"""chto-za-kompaniya-v1 ([Ночные-2] 18.11): карточка /company/ — под ОКВЭД «Выручка за год — X, работников — N (ФНС, на дату)»;
при штате до 10 человек и выручке от 1 млрд ₽ или чистой прибыли больше выручки — общее правило [Право] 18.11 (3) без догадки
о компании. Итог первого экрана — тремя формами [Право] 18.11 (2), «Не проверяли» сразу под ним (tests/test_pervyj_ekran_kartochki.py)."""
import html
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = Path(__file__).resolve().parent.parent
NB = K.NB
_CHTO = re.compile(r'<p class="caption co-chto">(.*?)</p><!--/co-chto-->', re.S)
ZAPRET = re.compile(r"(?i)аффилир|техническ|похоже|номинал|массов|надёжн|подставн|головная компания|входит в\s+групп")


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s)).replace(NB, " ").split())


def kartochki():
    for p in sorted((KOREN / "company").glob("*/index.html")):
        yield p.parent.name, p.read_text(encoding="utf-8")


class TestChtoZa(unittest.TestCase):
    def test_vse(self):
        n = pravilo = 0
        for imya, t in kartochki():
            m = _CHTO.findall(t)
            self.assertLessEqual(len(m), 1, imya + ": строка одна")
            u = t.replace("&nbsp;", NB)  # на диске — после типографа сборки (&nbsp;); функция пишет NB
            self.assertEqual(K.chto_za_kompaniyu(u), u, imya + ": повтор не меняет байты")
            if not m:
                continue
            n += 1
            s = txt(m[0])
            self.assertIsNone(ZAPRET.search(s), imya + ": " + s)
            B = K.ss_baza(t)
            self.assertTrue(B, imya + ": строка только при выручке ГИР БО")
            self.assertIn("Выручка за %d год — " % B["god"], s, imya)
            sh = re.search(r"работников — (\d+) \(ФНС", s)
            self.assertTrue(sh, imya)
            fakt = re.search(r'<span>Сотрудники</span><span class="fact__v">(.*?)</span>', t)
            self.assertEqual(int(re.sub(r"\D", "", txt(fakt.group(1)))), int(sh.group(1)), imya + ": штат — из строки реестров")
            inn = imya[:10]
            if "Так бывает" in s:
                pravilo += 1
                self.assertTrue(B["golovnaya"] or (int(sh.group(1)) <= K.CZ_SHTAT_MALO and B["summa"] >= K.CZ_VYRUCHKA_MNOGO), imya)
                self.assertTrue(s.endswith("сверьте, что ИНН в счёте и договоре — %s." % inn), imya)
            self.assertLess(t.index('class="caption co-chto"'), t.index('class="co-itog"') if 'class="co-itog"' in t else len(t), imya)
            self.assertIsNone(re.search(r"(?<!\d)\d{12}(?!\d)", s), imya + ": 12-значного ИНН нет")
        if (KOREN / "company").is_dir():
            self.assertGreater(n, 100)
            self.assertGreater(pravilo, 0)

    def test_magnit(self):
        p = next((KOREN / "company").glob("2309085638-*/index.html"), None)
        if not p:
            self.skipTest("нет карточки «Магнита»")
        s = txt(_CHTO.search(p.read_text(encoding="utf-8")).group(1))
        self.assertIn("Так бывает у головных и управляющих компаний групп.", s, "п. 20: прибыль больше выручки")

    def test_bez_dannyh(self):
        for t in ("", "<main></main>", '<p class="caption co-okved">x</p>'):
            self.assertEqual(K.chto_za_kompaniyu(t), t)


if __name__ == "__main__":
    unittest.main()
