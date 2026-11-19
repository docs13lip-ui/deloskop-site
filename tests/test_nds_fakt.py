"""nds-fakt-v1 ([Ночные-2] 19.11, слова [Право · Налоговый] 19.11 разд. 3 (1)): под строкой «Уплатила налогов и
взносов — …, в том числе НДС — X» — справочно «В {год} уплачивала НДС (данные ФНС). Вероятно, выставляет счета с НДС —
сверьте со счётом.» Без «плательщик НДС» и «вычет»; без года и без НДС — строки нет; в description не идёт."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402
import test_nds_uplacheno as T  # noqa: E402

NB = " "
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def kody(r):
    return [(v["kod"], v["tekst"]) for v in K.vyvody(K.iz_check(r))]


class NdsFakt(unittest.TestCase):
    def test_stroka_pod_v23(self):
        v = kody(T.otvet([["Уплачено: Налог на добавленную стоимость", "3 577 435 198 ₽"]]))
        i = [k for k, _ in v].index("V23")
        self.assertEqual(v[i + 1], ("V23n", "В" + NB + "2025 уплачивала НДС (данные ФНС). Вероятно, выставляет счета с" + NB
                                    + "НДС" + NB + "— сверьте со" + NB + "счётом."))

    def test_bez_nds_net(self):
        v = kody(T.otvet([["Уплачено: Налог на имущество организаций", "38 534 200 ₽"]]))
        self.assertNotIn("V23n", [k for k, _ in v])

    def test_slova_zapreshcheny(self):
        t = K.nds_fakt_tekst(2025)
        for plohoe in ("плательщик", "вычет", "обязательно"):
            self.assertNotIn(plohoe, t)

    def test_opublikovannaya_odin_raz(self):
        li = ('<li class="co-v co-v--ok"><span class="co-v__z" role="img" aria-label="хорошо"></span><div><p>Уплатила налогов '
              'и взносов — 622&nbsp;млн&nbsp;₽ за&nbsp;2025, в том числе НДС — 556&nbsp;млн&nbsp;₽</p><span class="co-src">ФНС, '
              'открытые данные: уплаченные налоги и взносы · сведения на 31.12.2025 · ● подтверждено источником</span></div></li>')
        t1 = K.nds_fakt_korotko(li)
        self.assertEqual(t1.count("уплачивала НДС"), 1)
        self.assertIn("В&nbsp;2025 уплачивала НДС", t1)
        self.assertEqual(K.nds_fakt_korotko(t1), t1)
        self.assertEqual(K.nds_fakt_korotko(li.replace(", в том числе НДС — 556&nbsp;млн&nbsp;₽", "")),
                         li.replace(", в том числе НДС — 556&nbsp;млн&nbsp;₽", ""))

    def test_ne_v_description(self):
        p = '<li class="co-v co-v--info"><span class="co-v__z" role="img" aria-label="справочно"></span><div><p>%s</p></div></li>'
        self.assertFalse(any("уплачивала" in f for f in K.shablon_glavnyj_fakt(
            '<section class="co-sec" aria-labelledby="korotko"><ul class="co-vv">' + p % K.nds_fakt_tekst(2025) + "</ul></section>")))

    def test_kartochki_na_diske(self):
        # у каждой опубликованной карточки со строкой «в том числе НДС» — ровно одна справочная строка, и только у них
        papka = os.path.join(KOREN, "company")
        for d in sorted(os.listdir(papka)):
            f = os.path.join(papka, d, "index.html")
            if not os.path.isfile(f):
                continue
            t = open(f, encoding="utf-8").read()
            est = bool(re.search(r"Уплатила налогов[^<]*в(?:&#160;|&nbsp;| | )том числе НДС", t))
            self.assertEqual(t.count("уплачивала НДС"), 1 if est else 0, d)
            if est:
                self.assertNotIn("уплачивала НДС", re.search(r'<meta name="description" content="([^"]*)"', t).group(1), d)


if __name__ == "__main__":
    unittest.main()
