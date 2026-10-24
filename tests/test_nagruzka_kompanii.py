#!/usr/bin/env python3
"""normy-kompanii-v1 (24.10.2026): справочник норм ФНС /nalogi/nagruzka-po-otraslyam-2025/ ссылается на карточки
компаний по строкам отраслей. Сторож: каждая карточка в индексе со ссылкой «Таблица ФНС по отраслям» названа в строке
своей отрасли (или учтена в «и ещё N» со ссылкой на хаб, где она есть); карточек под noindex и ИП в блоке нет;
блок собран (повторная сборка ничего не меняет); слов оценки нет."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sobrat_nagruzka as S  # noqa: E402

KOREN = S.KOREN
STR = open(S.STRANICA, encoding="utf-8").read()
BLOK = (S.KOMP_METKI.search(STR) or [None])[0] or ""


class TestNormyKompanii(unittest.TestCase):
    def test_blok_sobran(self):
        self.assertTrue(BLOK, "нет меток <!--normy-kompanii--> — python3 tests/sobrat_nagruzka.py")
        self.assertEqual(S.sobrat(proverit=True), 0, "блок устарел — python3 tests/sobrat_nagruzka.py")

    def test_kazhdaya_kartochka_v_svoej_stroke(self):
        po = S.kartochki_po_strokam(KOREN)
        self.assertGreater(sum(len(v) for v in po.values()), 50)
        haby = {h[0]: h[2] for h in S.haby_otrasley(KOREN)}
        stroki = {m.group(1): m.group(0) for m in re.finditer(r'<details data-stroka="(n-[0-9a-z-]+)">.*?</details>', BLOK, re.S)}
        for y, kart in po.items():
            self.assertIn(y, stroki, "строка %s: %d карточек, а в блоке её нет" % (y, len(kart)))
            li = stroki[y]
            nazvany = set(re.findall(r'href="/company/(\d{10}-[^/"]+)/"', li))
            ne_nazvany = {p for _, p, _ in kart} - nazvany
            if ne_nazvany:
                m = re.search(r'и&nbsp;ещё (\d+)&nbsp;— <a href="([^"]+)"', li)
                self.assertTrue(m, "строка %s: не названы %s и нет «и ещё N»" % (y, sorted(ne_nazvany)[:3]))
                self.assertEqual(int(m.group(1)), len(ne_nazvany))
                if m.group(2) != "/company/":
                    self.assertTrue(ne_nazvany <= haby.get(m.group(2), set()), "хаб %s не содержит всех карточек строки" % m.group(2))
            self.assertNotIn("ещё 1&nbsp;—", li, "«и ещё 1» не пишем — называем")
            self.assertIn(S._kompaniy(len(kart)), li)
            self.assertIn('<a href="#%s">' % y, li, "из строки блока — обратно на строку таблицы")
            self.assertIn('id="%s"' % y, STR, "якорь %s есть в таблице" % y)

    def test_tolko_v_indekse_i_yurlica(self):
        for p in set(re.findall(r'href="/company/(\d{10}-[^/"]+)/"', BLOK)):
            t = open(os.path.join(KOREN, "company", p, "index.html"), encoding="utf-8").read()
            self.assertFalse(S._noindex(t), "%s под noindex — в справочнике ей не место" % p)
            self.assertRegex(p, r"^\d{10}-", "только юрлица (10 цифр ИНН)")
        for h in re.findall(r'href="(/company/otrasl/[^"]+)"', BLOK):
            t = open(os.path.join(KOREN, h.strip("/"), "index.html"), encoding="utf-8").read()
            self.assertFalse(S._noindex(t), "хаб %s под noindex" % h)

    def test_bez_ocenok(self):
        tekst = re.sub(r"<[^>]+>", " ", BLOK).lower()
        for slovo in ("надёжн", "надежн", "лучш", "худш", "рекоменд", "благонад", "рейтинг компаний"):
            self.assertNotIn(slovo, tekst)
        self.assertIn("это не&nbsp;рейтинг", BLOK)

    def test_skloneniya(self):
        self.assertEqual([S._kompaniy(n) for n in (1, 2, 5, 11, 12, 21, 22, 25, 111)],
                         ["1&nbsp;компания", "2&nbsp;компании", "5&nbsp;компаний", "11&nbsp;компаний", "12&nbsp;компаний",
                          "21&nbsp;компания", "22&nbsp;компании", "25&nbsp;компаний", "111&nbsp;компаний"])


if __name__ == "__main__":
    unittest.main()
