"""kartochki-anonim-v1 ([Ночные-2] 28.10): анонимный /api/check приходит без финансов — его «нет финансов» не отсев.

Запуск: python3 tests/test_kartochki_anonim.py
"""
import datetime as dt
import io
import json
import os
import pathlib
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402
import kartochki_vybor as kv  # noqa: E402

D = dt.date(2026, 10, 28)


def pisat(put, zapisi):
    pathlib.Path(put).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in zapisi), encoding="utf-8")


class TestOtsevAnonim(unittest.TestCase):
    def test_anonimnyj_bez_finansov_ne_v_otsev(self):
        t = tempfile.mkdtemp()
        anon = dict(O.zapis(2, dohod=None), _dostup="anonimno")
        polnyj = dict(O.zapis(3, dohod=None), _dostup="sluzhebnyj")
        staryj = dict(O.zapis(4, dohod=None), _dostup="anonimno")
        put, vhod = os.path.join(t, "otsev.txt"), os.path.join(t, "x.jsonl")
        pathlib.Path(put).write_text("# шапка\n%s · 2026-10-12 · ворота публикации: %s\n" % (
            staryj["company"]["inn"], K.NET_FIN), encoding="utf-8")
        pisat(vhod, [anon, polnyj, staryj])
        novye, vsego = K.otsev(vhod, D, put)
        self.assertEqual(set(novye), {polnyj["company"]["inn"]}, "в отсев — только полный (служебный) ответ")
        self.assertEqual(vsego, 2, "прежнюю запись анонимный ответ не снимает")
        self.assertNotIn(anon["company"]["inn"], pathlib.Path(put).read_text(encoding="utf-8"))

    def test_bez_pometki_kak_ranshe(self):
        t = tempfile.mkdtemp()
        r = O.zapis(5, dohod=None)
        put, vhod = os.path.join(t, "otsev.txt"), os.path.join(t, "x.jsonl")
        pisat(vhod, [r])
        novye, _ = K.otsev(vhod, D, put)
        self.assertEqual(set(novye), {r["company"]["inn"]})

    def test_drugaya_prichina_anonimno_v_otsev(self):
        t = tempfile.mkdtemp()
        r = O.zapis(6)
        r["company"]["status"] = "LIQUIDATED"
        r["_dostup"] = "anonimno"
        put, vhod = os.path.join(t, "otsev.txt"), os.path.join(t, "x.jsonl")
        pisat(vhod, [r])
        ok, pr = K.vorota_zapisi(r)
        self.assertFalse(ok)
        self.assertNotEqual(pr, K.NET_FIN)
        novye, _ = K.otsev(vhod, D, put)
        self.assertEqual(set(novye), {r["company"]["inn"]}, "статус — сведения о компании, отсев в силе")


class TestIzApiDostup(unittest.TestCase):
    def zapusk(self, env, otsev_inn):
        t = tempfile.mkdtemp()
        sp = os.path.join(t, "sp.txt")
        pathlib.Path(sp).write_text(otsev_inn + "\n", encoding="utf-8")
        zvali = []

        def otvet(req, timeout=0):
            zvali.append(req.full_url)
            raise K.urllib.error.HTTPError(req.full_url, 429, "x", {}, None)

        with mock.patch.dict(os.environ, env, clear=False), mock.patch.object(K, "segodnya_msk", return_value=D), \
                mock.patch.object(K.urllib.request, "urlopen", otvet), mock.patch.object(K.time, "sleep", lambda s: None), \
                mock.patch.object(K, "otsev_net_fin", return_value={otsev_inn}), \
                mock.patch.object(kv, "ne_sprashivat", return_value=(set(), {otsev_inn})), redirect_stdout(io.StringIO()) as out:
            K.iz_api(sp, os.path.join(t, "x.jsonl"), pauza=0)
        return zvali, out.getvalue()

    def test_sluzhebnyj_sprashivaet_net_fin_snova(self):
        inn = "7706107510"
        bez = {k: "" for k in ("DELOSKOP_SERVICE_TOKEN", "DELOSKOP_COOKIE")}
        zvali, _ = self.zapusk(bez, inn)
        self.assertEqual(zvali, [], "анонимно отсев «нет финансов» в силе")
        zvali, out = self.zapusk(dict(bez, DELOSKOP_SERVICE_TOKEN="x"), inn)
        self.assertEqual(len(zvali), 1, "со служебным доступом — спросить снова")

    def test_pometka_dostupa_v_otvete(self):
        t = tempfile.mkdtemp()
        sp, vyhod = os.path.join(t, "sp.txt"), os.path.join(t, "x.jsonl")
        inn = O.zapis(7)["company"]["inn"]
        pathlib.Path(sp).write_text(inn + "\n", encoding="utf-8")

        class Otv(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        with mock.patch.dict(os.environ, {"DELOSKOP_SERVICE_TOKEN": "", "DELOSKOP_COOKIE": ""}), \
                mock.patch.object(K, "segodnya_msk", return_value=D), mock.patch.object(K.time, "sleep", lambda s: None), \
                mock.patch.object(kv, "ne_sprashivat", return_value=(set(), set())), \
                mock.patch.object(K.urllib.request, "urlopen", lambda req, timeout=0: Otv(json.dumps(O.zapis(7)).encode())), \
                redirect_stdout(io.StringIO()) as out:
            K.iz_api(sp, vyhod, pauza=0)
        r = K.chitat_jsonl(vyhod)[0]
        self.assertEqual(r["_dostup"], "anonimno")
        self.assertIn("анонимный /api/check отдаёт реестр без финансов", out.getvalue())


if __name__ == "__main__":
    unittest.main()
