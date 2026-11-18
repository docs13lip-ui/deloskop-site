"""rekvizity-kartochki-v1 ([Ночные-2] 18.11): блок «Реквизиты» на карточках /company/ и кнопка «Скопировать реквизиты».
Решение владельца 18.11 разд. 3 п. 4; люди — рамка [Право] 18.11 (1): ФИО в git нет, строка «в полной проверке»."""
import glob
import os
import re
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import kartochka_render as K  # noqa: E402

KARTOCHKI = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html")))


def chitat(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


class TestOpublikovannye(unittest.TestCase):
    def test_u_kazhdoj_blok_i_skript(self):
        self.assertGreater(len(KARTOCHKI), 100)
        for p in KARTOCHKI:
            t = chitat(p)
            self.assertEqual(t.count('<section class="co-sec co-rekv"'), 1, p)
            self.assertEqual(t.count(K.RK_SKRIPT), 1, p)
            self.assertLess(t.index('class="co-sec co-rekv"'), t.index(K.RK_SKRIPT), p)

    def test_povtor_te_zhe_bajty(self):
        for p in KARTOCHKI[:40]:
            t = K.bez_tipografa(chitat(p))  # как сборка: снять типограф, применить, проверить байты
            self.assertEqual(K.rekvizity_kartochki(t), t, p)

    def test_magnit(self):
        t = chitat(os.path.join(KOREN, "company", "2309085638-magnit", "index.html"))
        sek = re.search(r'<section class="co-sec co-rekv".*?</section>', t, re.S).group(0)
        for s in ("<dt>ИНН</dt><dd>2309085638</dd>", "<dt>ОГРН</dt><dd>1032304945947</dd>", "<dt>Дата регистрации</dt><dd>12.11.2003</dd>",
                  "<dt>Статус</dt><dd>Действующая</dd>", "68.20.21", "ЕГРЮЛ · сведения на", "data-rk-kop hidden",
                  'href="/pasport/kontragent/?inn=2309085638" rel="nofollow"'):
            self.assertIn(s, sek)
        self.assertLess(t.index('class="co-sec co-rekv"'), t.index('class="co-sec co-daty"'))

    def test_bez_lyudej_i_ip(self):
        """[Право] 18.11 (1): в git нет ФИО и 12-значных ИНН; руководитель и участники — «в полной проверке»."""
        for p in KARTOCHKI:
            sek = re.search(r'<section class="co-sec co-rekv".*?</section>', chitat(p), re.S).group(0)
            sek = sek.replace("&nbsp;", K.NB).replace("&#160;", K.NB)
            self.assertNotRegex(sek, r"(?<!\d)\d{12}(?!\d)", p)
            self.assertIn("в" + K.NB + "полной проверке", sek, p)
            self.assertNotRegex(sek, r"массов|номинал|подставн|надёжн|благонад", p)


class TestShablon(unittest.TestCase):
    T = ('<script type="application/ld+json">{"@graph": [{"@type": "Organization", "address": {"@type": "PostalAddress", '
         '"addressRegion": "Москва", "addressLocality": "Москва"}, "foundingDate": "2010-02-03", "identifier": {"@type": "PropertyValue", '
         '"propertyID": "ОГРН", "value": "1027700000000"}, "legalName": "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «Тест»", "taxID": "%s"}]}</script>'
         '<main><p class="co-sub">Действующая · Москва · ОГРН&nbsp;1027700000000</p>'
         '<p class="caption co-okved">Основной вид деятельности&#160;— <span class="num">46.90</span> Торговля оптовая · ЕГРЮЛ · сведения на&#160;10.11.2026</p>'
         '<section class="co-sec co-daty" aria-labelledby="daty"></section></main>')

    def test_kpp_i_adres_u_novyh_i_perenos(self):
        t = K.rekvizity_kartochki(self.T % "7700000000", "770001001", "г. Москва, ул. Тестовая, д. 1")
        self.assertIn("<dt>КПП</dt><dd>770001001</dd>", t)
        self.assertIn("<dt>Юридический адрес</dt><dd>г. Москва, ул. Тестовая, д. 1</dd>", t)
        self.assertNotIn("Регион", t)
        self.assertIn("<dt>Регион</dt><dd>Москва</dd>", K.rekvizity_kartochki(self.T % "7700000000"))
        # перепечатка без сведений: КПП и адрес остаются из прежнего блока
        self.assertEqual(K.rekvizity_kartochki(t), t)

    def test_ip_net(self):
        t = K.rekvizity_kartochki(self.T % "770000000000")
        self.assertNotIn("co-rekv", t)
        self.assertNotIn(K.RK_SKRIPT, t)

    def test_persons_public_bez_stroki(self):
        os.environ["PERSONS_PUBLIC"] = "1"
        try:
            t = K.rekvizity_kartochki(self.T % "7700000000")
        finally:
            os.environ.pop("PERSONS_PUBLIC", None)
        self.assertIn("co-rekv", t)
        self.assertNotIn("полной проверке", t)


if __name__ == "__main__":
    unittest.main()
