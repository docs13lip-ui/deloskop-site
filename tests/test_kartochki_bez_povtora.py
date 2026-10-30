#!/usr/bin/env python3
"""kartochki-bez-povtora-v1 (31.10.2026, [Ночные-2]; решение владельца 30.10 «уникальность — приоритет 1»): в блоке «Что это
значит для вас» карточек /company/ абзац, все числа которого (≥ 2: суммы ₽, проценты, «в N раза»; годы не в счёт) уже названы
в «Разборе по цифрам» или в абзацах выше, снимается — на 167 карточках так повторялись ~145 абзацев («росла каждый год… от X
до Y» под «за 5 лет выросла в N раза: с X до Y»). Сторож: (1) повтор снят, абзац с новым числом — на месте; (2) абзац с
заголовком (<b>), подпись ◆ и абзац с советом не снимаются, даже если числа те же, и блок не становится короче
ZN_MIN_SLOV слов (сторож test_kartochki_znachit); (3) bez_povtora идемпотентна, без блока —
страница байт в байт; (4) на опубликованных карточках нет абзаца-повтора и в блоке остаётся ≥ 2 абзацев."""
import glob
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAZ = ('<section class="co-sec co-razbor" aria-labelledby="razbor"><h2 id="razbor">Разбор</h2><ul class="co-vv"><li><div>'
       '<p>Выручка «Тест» за&nbsp;5&nbsp;лет выросла в&nbsp;3&nbsp;раза: с&nbsp;9,4&nbsp;млрд&nbsp;₽ в&nbsp;2020 до&nbsp;28,3&nbsp;млрд&nbsp;₽ в&nbsp;2025.</p>'
       '</div></li></ul><p class="caption">◆ рассчитано 4,1&nbsp;% и 5&nbsp;%</p></section>')
ZN = ('<section class="co-sec co-znachit" aria-labelledby="znachit"><h2 id="znachit">Что это значит</h2>'
      '<p><b>Год «Тест».</b> Прибыль 1,2&nbsp;млрд&nbsp;₽ после убытка 426&nbsp;млн&nbsp;₽.</p>'
      '<p>С&nbsp;2020 по&nbsp;2025&nbsp;год выручка выросла в&nbsp;3&nbsp;раза&#160;— с&nbsp;9,4&nbsp;млрд&nbsp;₽ до&nbsp;28,3&nbsp;млрд&nbsp;₽.</p>'
      '<p>«Тест» снова в&#160;плюсе: 1,2&nbsp;млрд&nbsp;₽ при выручке 28,3&nbsp;млрд&nbsp;₽, убыток 426&nbsp;млн&nbsp;₽.</p>'
      '<p>Убыток 426&nbsp;млн&nbsp;₽ при выручке 28,3&nbsp;млрд&nbsp;₽. Крупный аванс&#160;— этапами.</p>'
      '<p>Самая большая прибыль&#160;— 1,9&nbsp;млрд&nbsp;₽; за&nbsp;2025&#160;— 1,2&nbsp;млрд&nbsp;₽, это 63&nbsp;% от&#160;неё.</p>'
      '<p class="caption">◆ Расчёт 1,2&nbsp;млрд&nbsp;₽ и 28,3&nbsp;млрд&nbsp;₽.</p></section>')


def stranica(razbor=True):
    return "<main>%s%s</main>" % (RAZ if razbor else "", ZN)


class TestBezPovtora(unittest.TestCase):
    def setUp(self):  # образец короткий — порог длины блока (ZN_MIN_SLOV) проверяет test_porog_dliny
        self._min, K.ZN_MIN_SLOV = K.ZN_MIN_SLOV, 0

    def tearDown(self):
        K.ZN_MIN_SLOV = self._min

    def test_porog_dliny(self):
        K.ZN_MIN_SLOV = 10 ** 6  # блок короче порога — повторы остаются, страница байт в байт
        self.assertEqual(K.bez_povtora(stranica()), stranica())

    def test_povtor_snyat(self):
        t = K.bez_povtora(stranica())
        self.assertNotIn("С&nbsp;2020 по&nbsp;2025&nbsp;год выручка", t)
        self.assertNotIn("снова в&#160;плюсе", t)
        self.assertIn("63&nbsp;%", t)

    def test_sluzhebnye_na_meste(self):
        t = K.bez_povtora(stranica())
        self.assertIn("<b>Год «Тест».</b>", t)
        self.assertIn("Крупный аванс", t)
        self.assertIn('<p class="caption">◆ Расчёт', t)

    def test_bez_razbora(self):
        t = K.bez_povtora(stranica(razbor=False))
        self.assertIn("С&nbsp;2020 по&nbsp;2025&nbsp;год выручка", t)  # чисел нигде выше нет — абзац новый
        self.assertNotIn("снова в&#160;плюсе", t)  # а этот повторяет первый абзац блока

    def test_idempotentna(self):
        t = K.bez_povtora(stranica())
        self.assertEqual(K.bez_povtora(t), t)
        bez = "<main><p>нет блока 1,2&nbsp;млрд&nbsp;₽</p></main>"
        self.assertEqual(K.bez_povtora(bez), bez)



class TestOpublikovannye(unittest.TestCase):
    def test_opublikovannye(self):
        fajly = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]" * 10 + "-*", "index.html")))
        if not fajly:
            self.skipTest("карточек нет")
        for f in fajly:
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            z = K._BP_ZNACHIT.search(t)
            if not z:
                continue
            with self.subTest(f=os.path.basename(os.path.dirname(f))):
                self.assertEqual(K.bez_povtora(t), t, "абзац-повтор в «Что это значит» — perepechatat")
                abz = [p for p in K._BP_P.finditer(z.group(2)) if "caption" not in (p.group(1) or "")]
                self.assertGreaterEqual(len(abz), 2)


if __name__ == "__main__":
    unittest.main()
