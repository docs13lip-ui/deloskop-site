#!/usr/bin/env python3
"""kartochki-rol-znaka-v1 (25.10.2026, [Ночные-2]; аудит axe dostupnost-v1, ✎ 05:55): цветная точка вывода на карточках
/company/ — <span class="co-v__z" aria-label="…">. У span без роли aria-label запрещён (axe aria-prohibited-attr) и
читалка подпись не произносит. Сторож: (1) на опубликованных карточках у каждой точки — role="img" и непустая подпись;
(2) шаблон новых карточек ставит role="img"; (3) pochinit_rol_znaka идемпотентна и чинит старую разметку."""
import glob
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOCHKA = re.compile(r'<span class="co-v__z"[^>]*>')


class TestRolZnaka(unittest.TestCase):
    def test_opublikovannye(self):
        plohie, n = [], 0
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            with open(f, encoding="utf-8") as fh:
                for m in TOCHKA.finditer(fh.read()):
                    n += 1
                    if not re.fullmatch(r'<span class="co-v__z" role="img" aria-label="[^"<>]+">', m.group(0)):
                        plohie.append("%s: %s" % (os.path.basename(os.path.dirname(f)), m.group(0)))
        self.assertGreater(n, 500)
        self.assertEqual(plohie[:5], [])

    def test_shablon(self):
        with open(os.path.join(KOREN, "tests", "kartochka_render.py"), encoding="utf-8") as fh:
            src = fh.read()
        self.assertNotIn('<span class="co-v__z" aria-label=', src.replace("_ZNAK_BEZ_ROLI = re.compile(r'<span class=\"co-v__z\" aria-label=\"')", ""))
        self.assertEqual(src.count('<span class="co-v__z" role="img" aria-label='), 3)

    def test_pochinit(self):
        star = '<li class="co-v co-v--warn"><span class="co-v__z" aria-label="обратите внимание"></span><div><p>x</p></div></li>'
        nov = K.pochinit_rol_znaka(star)
        self.assertIn('<span class="co-v__z" role="img" aria-label="обратите внимание">', nov)
        self.assertEqual(K.pochinit_rol_znaka(nov), nov)


if __name__ == "__main__":
    unittest.main()
