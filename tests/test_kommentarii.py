"""python3 tests/test_kommentarii.py — Python-копия правила совпадает с js/kommentarii.js."""
import json
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kommentarii as K  # noqa: E402

KOREN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TITLES = ["Статус", "Возраст компании", "Адрес", "Недостоверность адреса или руководителя", "Руководитель",
          "Дисквалификация руководителя", "Задолженность по налогам", "Уплаченные налоги и взносы",
          "Среднесписочная численность", "Доходы и расходы", "ФССП", "Суды (арбитраж)", "Смена руководителя",
          "Перечень Росфинмониторинга", "Налоговый режим", "Приостановление операций по счетам", "Что-то новое"]


class T(unittest.TestCase):
    def test_sovpadaet_s_js(self):
        js = ("const K=require('./js/kommentarii.js');const S=require('./data/kommentarii.json');"
              "console.log(JSON.stringify(%s.map(t=>{const z=K.zapis(S,{title:t});return z?z.id:null})))" % json.dumps(TITLES))
        out = subprocess.run(["node", "-e", js], cwd=KOREN, capture_output=True, text=True, check=True).stdout
        sprav = K.zagruzit()
        py = [(K.zapis(sprav, {"title": t}) or {}).get("id") for t in TITLES]
        self.assertEqual(py, json.loads(out))
        self.assertIsNone(py[-1])

    def test_detal_i_kak_sovpadaet_s_js(self):
        sig = [{"title": "Адрес", "detail": "массовый адрес", "status": "warn"},
               {"title": "Адрес", "detail": "отметка о недостоверности", "status": "bad"},
               {"title": "Статус", "detail": "Банкротство", "status": "bad"},
               {"title": "Статус", "detail": "Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ", "status": "bad"},
               {"title": "Возраст компании", "detail": "8 месяцев", "status": "warn"},
               {"title": "Возраст компании", "detail": "1 год 8 месяцев", "status": "warn"},
               {"title": "Среднесписочная численность", "detail": "0 человек", "status": "warn"},
               {"title": "Доходы и расходы", "detail": "убыток 3 млн ₽", "status": "warn"},
               {"title": "Красная группа ЗСК Банка России", "detail": "", "status": "bad"},
               {"title": "Прогноз ЗСК (наша оценка): высокий уровень риска", "detail": "", "status": "bad"},
               {"title": "Долги по налогам", "detail": "нет", "status": "ok"}]
        js = ("const K=require('./js/kommentarii.js');const S=require('./data/kommentarii.json');"
              "console.log(JSON.stringify(%s.map(s=>{const k=K.najti(S,s);return k?[k.id,k.ton,k.sdelat]:null})))" % json.dumps(sig, ensure_ascii=False))
        out = subprocess.run(["node", "-e", js], cwd=KOREN, capture_output=True, text=True, check=True).stdout
        sprav = K.zagruzit()
        py = [(lambda k: [k["id"], k["ton"], k["sdelat"]] if k else None)(K.najti(sprav, s)) for s in sig]
        self.assertEqual(py, json.loads(out))
        self.assertEqual([x and x[0] for x in py], ["massovyj_adres", "nedostovernost", "bankrotstvo", None, "molodaya",
                                                     None, "net_sotrudnikov", "ubytok", "zsk", None, "nedoimka"])

    def test_tolko_utverzhdennye(self):
        sprav = K.zagruzit()
        for t in TITLES:
            for st in ("ok", "warn", "bad"):
                k = K.najti(sprav, {"title": t, "status": st})
                if k:
                    self.assertTrue(K.gotov(sprav["signaly"][[z["id"] for z in sprav["signaly"]].index(k["id"])]["tony"][k["ton"]]))
        s = {"podpis": "Команда Делоскопа · 115-ФЗ и налоги", "signaly": [{"id": "fssp", "re": "фссп", "norma": "229-ФЗ", "tony": {
            "zhel": {"status": "utverzhdeno", "proveril": "[Право]", "data_proverki": "2026-10-04", "bank": "б", "sdelat": "с"},
            "kras": {"status": "chernovik", "proveril": "[Право]", "data_proverki": "2026-10-04", "bank": "б", "sdelat": "с"}}}]}
        k = K.najti(s, {"title": "ФССП", "status": "warn"})
        self.assertEqual((k["id"], k["ton"], k["data"]), ("fssp", "zhel", "04.10.2026"))
        self.assertIsNone(K.najti(s, {"title": "ФССП", "status": "bad"}))


if __name__ == "__main__":
    unittest.main()
