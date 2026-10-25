#!/usr/bin/env python3
"""Слияние ленты «Что нового» (obnovleniya.json) без ручной правки — lenta-slit-v1 (25.10.2026, [Ночные запуски]).

Зачем: каждый комплект добавляет запись в начало obnovleniya.json, поэтому любые две сборки
конфликтуют здесь, а git перемешивает строки двух записей. До сих пор Выкладка решала это
однострочником с ID вручную, а номера записей переписывала руками (случай -1535 в PR #204).
Этот скрипт сливает ленту по записям, а не по строкам:

  • берёт «нашу» ленту целиком (ветку, на которую кладём патч);
  • сверху добавляет записи, которые патч ДОБАВИЛ (их не было в общей базе), — в его порядке;
  • правку патчем старой записи переносит, если у нас её не трогали (иначе — честный конфликт);
  • удаление патчем записи переносит, если у нас её не трогали;
  • новая запись патча, чей номер занят или не больше верхнего номера ленты, получает
    следующий свободный номер (шаг 12, «номер — по порядку выкладки») — замена печатается;
    запись, у которой уже есть «vremya» (она на живом сайте), не перенумеровывается никогда —
    повтор её id остаётся конфликтом.

Как подключить (один раз на компьютере, в папке репозитория):
    git config merge.lenta.driver "python3 tests/lenta_slit.py %O %A %B"
После этого `git am -3`, `git merge`, `git rebase` сливают obnovleniya.json сами
(правило — в .gitattributes). Без этой настройки git сливает файл, как раньше, строками.

Если конфликт уже случился (настройка не сделана):
    python3 tests/lenta_slit.py --iz-indeksa     # возьмёт три версии из индекса git, запишет и сделает git add

Код выхода: 0 — слито; 1 — настоящий конфликт (одна запись по-разному изменена с обеих сторон
или файл не JSON) — тогда файл не трогается и git оставляет конфликт человеку.
"""
import json
import re
import subprocess
import sys

SHAG = 12          # сетка номеров ленты: ночные комплекты берут номера через 12
OSTATOK = 11       # …-1547, -1559, … -1679, -1691: номер % 12 == 11
ID = re.compile(r"^(\d{4}-\d{2}-\d{2})-(\d+)$")


def nomer(i):
    m = ID.match(i or "")
    return int(m.group(2)) if m else -1


def zapisi(d):
    return d.get("obnovleniya", []) if isinstance(d, dict) else []


def po_id(d):
    return {e.get("id"): e for e in zapisi(d)}


def sleduyushchij(zanyatye_nomera):
    n = max(zanyatye_nomera or [0]) + 1
    while n % SHAG != OSTATOK:
        n += 1
    return n


def slit(baza, nasha, ih):
    """Возвращает (лента, замены, конфликты). Ничего не пишет."""
    B, A, T = po_id(baza), po_id(nasha), po_id(ih)
    konflikty, zameny = [], []
    rez = [dict(e) for e in zapisi(nasha)]
    indeks = {e.get("id"): k for k, e in enumerate(rez)}

    # 1) правки и удаления старых записей
    udalit = set()
    for i, b in B.items():
        t = T.get(i)
        a = A.get(i)
        if t == b:
            continue                      # патч запись не трогал
        if a is None:
            continue                      # у нас её уже нет — нечего править
        if a == b:                        # у нас не трогали — берём сторону патча
            if t is None:
                udalit.add(i)
            else:
                rez[indeks[i]] = dict(t)
        elif t is not None and a == t:
            continue                      # одинаковая правка с обеих сторон
        else:
            konflikty.append(i)
    rez = [e for e in rez if e.get("id") not in udalit]

    # 2) новые записи патча — сверху, в его порядке
    novye = [dict(e) for e in zapisi(ih) if e.get("id") not in B]
    novye = [e for e in novye if not (e.get("id") in A and A[e["id"]] == e)]  # уже лежит у нас
    zanyato = {nomer(e.get("id")) for e in rez}
    verh = max([nomer(e.get("id")) for e in rez] or [-1])
    gotovye = []
    for e in reversed(novye):             # снизу вверх: нижняя новая получает меньший номер
        i = e.get("id") or ""
        m = ID.match(i)
        n = nomer(i)
        vylozhena = bool(e.get("vremya"))  # у записи с живого сайта номер не меняем никогда
        if m and not vylozhena and (n in zanyato or n <= verh):
            n2 = sleduyushchij(zanyato | {verh})
            novyj = "%s-%d" % (m.group(1), n2)
            zameny.append((i, novyj))
            e["id"] = novyj
            n = n2
        zanyato.add(n)
        verh = max(verh, n)
        gotovye.insert(0, e)
    lenta = dict(nasha) if isinstance(nasha, dict) else {"obnovleniya": []}
    lenta["obnovleniya"] = gotovye + rez
    ids = [e.get("id") for e in lenta["obnovleniya"]]
    if len(ids) != len(set(ids)):
        konflikty.append("повтор id после слияния")
    return lenta, zameny, konflikty


def tekst(d):
    return json.dumps(d, ensure_ascii=False, indent=2) + "\n"


def chitat(put):
    with open(put, encoding="utf-8") as f:
        s = f.read()
    return json.loads(s) if s.strip() else {"obnovleniya": []}


def iz_git(stadiya):
    try:
        s = subprocess.run(["git", "show", ":%d:obnovleniya.json" % stadiya], check=True,
                           capture_output=True).stdout.decode("utf-8")
    except subprocess.CalledProcessError:
        return {"obnovleniya": []}       # файла нет на этой стороне
    return json.loads(s)


def main(argv):
    try:
        if argv and argv[0] == "--iz-indeksa":
            baza, nasha, ih = iz_git(1), iz_git(2), iz_git(3)
            kuda = "obnovleniya.json"
        elif len(argv) >= 3:
            baza, nasha, ih = chitat(argv[0]), chitat(argv[1]), chitat(argv[2])
            kuda = argv[1]                # драйвер git: результат — в %A
        else:
            print(__doc__)
            return 2
    except (ValueError, OSError) as e:
        print("lenta_slit: не JSON — сливайте вручную:", e, file=sys.stderr)
        return 1
    lenta, zameny, konflikty = slit(baza, nasha, ih)
    if konflikty:
        print("lenta_slit: конфликт по записям " + ", ".join(konflikty) +
              " — изменены с обеих сторон; решите вручную", file=sys.stderr)
        return 1
    with open(kuda, "w", encoding="utf-8") as f:
        f.write(tekst(lenta))
    for a, b in zameny:
        print("lenta_slit: номер записи %s занят или ниже верха ленты → %s" % (a, b), file=sys.stderr)
    novyh = len(zapisi(lenta)) - len(zapisi(nasha))
    print("lenta_slit: obnovleniya.json слит, сверху %s, новых записей %d" %
          ((zapisi(lenta)[0].get("id") if zapisi(lenta) else "—"), max(novyh, 0)), file=sys.stderr)
    if argv and argv[0] == "--iz-indeksa":
        subprocess.run(["git", "add", kuda], check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
