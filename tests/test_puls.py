"""«Последние изменения» на /o-proekte/ не теряют якорь, когда лента растёт (12.10.2026).
Запуск из корня: python3 tests/test_puls.py

Ошибка, которую ловим: снимок пульса стоял руками (5 ссылок /obnovleniya/#id на 11.10), а /obnovleniya/ держит в HTML
только 20 последних записей. Новая запись ленты → postavit_vremya.py → sobrat_lentu.py вытесняет старый id →
tests/ssylki.test.js красный у любого комплекта с лентой (поймано [Выкладкой] на kartochki-1210-n6, лента -137).

Проверяем на копии во временной папке (настоящие файлы не трогаем):
  1) +25 новых записей ленты → после сборки все 5 якорей пульса есть среди id на /obnovleniya/;
  2) снимок = верхние 5 записей obnovleniya.json, в том же порядке;
  3) разметка снимка совпадает с тем, что рисует скрипт страницы (node, тот же код из o-proekte/index.html);
  4) повторная сборка ничего не меняет, --check зелёный; заголовок с < > & " экранируется;
  5) на настоящем сайте --check зелёный (снимок собран).
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R / "tests"))
import sobrat_lentu as S  # noqa: E402

n = 0


def ok(name, cond, extra=""):
    global n
    if not cond:
        print("✗", name, extra)
        sys.exit(1)
    n += 1
    print("✓", name)


def ids_puls(html):
    blok = S.PULS.search(html).group(2)
    return re.findall(r'href="/obnovleniya/#([^"]+)"', blok)


def ids_lenty(html):
    return re.findall(r'<section class="u" id="([^"]+)"', S.METKA.search(html).group(0))


tmp = pathlib.Path(tempfile.mkdtemp())
try:
    (tmp / "obnovleniya").mkdir()
    (tmp / "o-proekte").mkdir()
    shutil.copy(R / "obnovleniya.json", tmp / "obnovleniya.json")
    shutil.copy(R / "obnovleniya" / "index.html", tmp / "obnovleniya" / "index.html")
    shutil.copy(R / "o-proekte" / "index.html", tmp / "o-proekte" / "index.html")
    S.LENTA = tmp / "obnovleniya.json"
    S.STRANICA = tmp / "obnovleniya" / "index.html"
    S.PULS_STRANICA = tmp / "o-proekte" / "index.html"

    d = json.loads(S.LENTA.read_text(encoding="utf-8"))
    novye = [{"id": "2099-12-%02d-%d" % (1 + i % 28, 900 + i), "data": "1 декабря 2099", "vremya": "10:00",
              "zagolovok": 'Проверка <b>«кавычек»</b> & "двойных" № %d' % i, "chto_novogo": ["тест"]}
             for i in range(25)]
    d["obnovleniya"] = novye + d["obnovleniya"]
    S.LENTA.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")

    ok("сборка после +25 записей — без ошибок", S.main([]) == 0)
    lenta = (tmp / "obnovleniya" / "index.html").read_text(encoding="utf-8")
    proekt = (tmp / "o-proekte" / "index.html").read_text(encoding="utf-8")
    p, l = ids_puls(proekt), ids_lenty(lenta)
    ok("в HTML ленты — 20 записей", len(l) == S.SKOLKO, str(len(l)))
    ok("все 5 якорей пульса есть на /obnovleniya/", len(p) == 5 and all(i in l for i in p), str(p))
    ok("пульс = верхние 5 записей ленты по порядку", p == [u["id"] for u in d["obnovleniya"][:5]], str(p))
    ok("заголовок экранирован (< > & \")",
       "&lt;b&gt;«кавычек»&lt;/b&gt; &amp; &quot;двойных&quot;" in proekt and "<b>«кавычек»" not in proekt)
    ok("дата словами из id, неразрывный пробел сущностью",
       '<time datetime="2099-12-01">1&nbsp;декабря</time>' in proekt and "\u00a0" not in S.PULS.search(proekt).group(2))

    # 3) паритет со скриптом страницы: тот же map(), что в o-proekte/index.html
    skript = re.search(r"l\.innerHTML=a\.slice\(0,5\)\.map\((function\(u\)\{.*?\})\)\.join\(\"\"\)", proekt, re.S)
    ok("скрипт пульса на месте", bool(skript))
    js = ("var L='/obnovleniya/'+String.fromCharCode(35),M=%s;"
          "function e(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}"
          "var a=%s;process.stdout.write(a.slice(0,5).map(%s).join('\\n'))") % (
        json.dumps(S.MESYACY, ensure_ascii=False), json.dumps(d["obnovleniya"][:5], ensure_ascii=False), skript.group(1))
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
    nash = S.PULS.search(proekt).group(2).strip().replace("&nbsp;", "\u00a0")
    # tipograf-obolochka-v1 (19.10.2026): заголовки пульса — с типографикой статей (TS.tekst); скрипт страницы после
    # отрисовки зовёт DlkTipo.uzly (те же правила, obnovleniya.js) — сверяем разметку без учёта вида пробела.
    sp = lambda x: x.replace("\u00a0", " ")
    ok("разметка снимка = то, что рисует скрипт", sp(out) == sp(nash), "\nJS:  " + out[:300] + "\nPY:  " + nash[:300])
    ok("скрипт пульса типографит, как сборщик (DlkTipo.uzly)", "DlkTipo.uzly(l)" in proekt)

    ok("повторная сборка — без изменений, --check зелёный", S.main(["--check"]) == 0)
finally:
    shutil.rmtree(tmp)

S.LENTA, S.STRANICA, S.PULS_STRANICA = R / "obnovleniya.json", R / "obnovleniya" / "index.html", R / "o-proekte" / "index.html"
ok("на сайте снимок пульса собран (sobrat_lentu --check)", S.main(["--check"]) == 0)
print("Итого: %d ✓" % n)
