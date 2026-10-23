"""kartochki-svodka-v1 ([Ночные-2] 23.10): зелёные «Комментарии команды» на карточке — одним блоком под реестрами.

[Право] 23.10 00:30, разд. 3 (п. 373б): тексты те же; жёлтые и красные — под своей строкой; оговорка — одна."""
import json
import os
import re
import sys
import unittest
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOREN / "tests"))
import kartochka_render as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402


def _frazy(t):
    return re.findall(r'<span class="kom__l">[^<]*</span> [^<]*', t)


class TestSvodka(unittest.TestCase):
    def setUp(self):
        self.kom = json.loads((KOREN / "data" / "kommentarii.json").read_text(encoding="utf-8"))

    def _html(self, z, kom=None):
        k = K.iz_check(z)
        return K.html_kartochki(k, K.vyvody(k), [], self.kom if kom is None else kom)

    def _bez_svodki(self, z):
        k = K.iz_check(z)
        return K._html_kartochki_do_svodki(k, K.vyvody(k), [], self.kom)

    def test_teksty_te_zhe_i_poryadok(self):
        z = O.zapis(3)
        do, posle = self._bez_svodki(z), self._html(z)
        self.assertEqual(_frazy(do), _frazy(posle))  # ни одного нового слова в фразах [Право], порядок строк тот же
        reestry = re.search(r'aria-labelledby="reestry">.*?</section>', posle, re.S).group(0)
        self.assertNotIn("kom--zel", reestry)
        self.assertEqual(posle.count('class="co-sec co-zel"'), 1)

    def test_ogovorka_odna(self):
        for i in range(12):
            t = self._html(O.zapis(i))
            self.assertLessEqual(t.count("Комментарий команды — общий"), 1)

    def test_kras_ostaetsya_pod_strokoj(self):
        t = self._html(O.zapis(3, dolg_status="bad", dolg="есть, 1 200 000 ₽"))
        reestry = re.search(r'aria-labelledby="reestry">.*?</section>', t, re.S).group(0)
        self.assertIn('class="kom kom--kras" data-kom="nedoimka"', reestry)
        self.assertIn('class="kom-og"', reestry)  # под строками ещё есть комментарий — оговорка там
        self.assertEqual(t.count('class="kom-og"'), 1)
        self.assertIn('class="co-sec co-zel"', t)

    def test_imya_i_data_v_punkte(self):
        t = self._html(O.zapis(3))
        blok = re.search(r'<section class="co-sec co-zel".*?</section>', t, re.S).group(0)
        self.assertRegex(blok, r'<h2 id="zel">Что значат зелёные строки .+ для банка и налоговой</h2>')
        self.assertRegex(blok, r'class="co-zel__f">[^<]+, сведения на \d{2}\.\d{2}\.\d{4}</p>')
        self.assertIn('<p class="kom__p">Команда Делоскопа · 115-ФЗ и налоги</p>', blok)

    def test_povtor_nichego_ne_menyaet(self):
        t = self._html(O.zapis(3))
        self.assertEqual(K.svodka_zel(t), t)

    def test_bez_biblioteki_bloka_net(self):
        k = K.iz_check(O.zapis(3))
        t = K.html_kartochki(k, K.vyvody(k), [], None)
        self.assertNotIn("co-zel", t)

    def test_opublikovannye(self):
        papka = KOREN / "company"
        vse = sorted(p for p in papka.glob("*/index.html") if re.match(r"\d{10}-", p.parent.name))
        if not vse:
            self.skipTest("карточек нет")
        for p in vse:
            t = p.read_text(encoding="utf-8")
            reestry = re.search(r'aria-labelledby="reestry">.*?</section>', t, re.S)
            self.assertTrue(reestry, p)
            self.assertNotIn("kom--zel", reestry.group(0), p)
            self.assertLessEqual(t.count("Комментарий команды — общий"), 1, p)


if __name__ == "__main__":
    unittest.main()
