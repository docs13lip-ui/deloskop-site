#!/usr/bin/env python3
"""Пакеты без комментариев (paket-legkij-v1, 25.10.2026).

Зачем: в пакетах js/b/*.js и css/b/*.css комментарии исходников — 25–30 % веса (отчёт 535 КБ, из них
~150 КБ — пояснения для команды). Сервер пока ничего не сжимает, и каждый посетитель качал эти пояснения.
Исходники js/*.js и css/*.css не трогаем — комментарии остаются там, где их читают люди.

Что убираем — только то, что не меняет смысла кода:
  • комментарии // … и /* … */ вне строк, шаблонов `…` и регулярных выражений;
  • отступы в начале строки и пустые строки — вне строк и шаблонов.
Перевод строки на месте комментария сохраняется (автоматическая «;» в JS работает как прежде).
Внутри строк, шаблонов `…` (включая ${…}) и регулярных выражений — ни одного изменённого знака.

Регулярное выражение отличаем от деления по предыдущему знаку (как это делают сами движки):
после ( , = : [ ! & | ? { } ; + - * % < > ~ ^ и после return/typeof/case/… — выражение, иначе — деление.
Сторож tests/paket_legkij.test.js: каждый пакет компилируется (vm.Script), а ключевые строки
исходников (тексты, регулярные выражения, шаблоны) дошли до пакета без изменений.
"""
import re

PERED_REGEX = set("(,=:[!&|?{};+-*%<>~^")
SLOVA_REGEX = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw",
               "case", "do", "else", "yield", "await"}
SLOVO = re.compile(r"[A-Za-z0-9_$\u0080-￿]")


class _Vyhod:
    """Выход с удалением пустых строк и отступов (только в «коде», не в строках и шаблонах)."""

    def __init__(self):
        self.ch = []
        self.nachalo_stroki = True  # ещё не было знаков кода в текущей строке

    def kod(self, s):
        self.ch.append(s)
        self.nachalo_stroki = False

    def probel(self, c):
        if self.nachalo_stroki:
            return  # отступ — не нужен
        self.ch.append(c)

    def perevod(self):
        if self.nachalo_stroki:
            return  # пустая строка — не нужна
        # хвостовые пробелы перед переводом строки
        while self.ch and self.ch[-1] in (" ", "\t"):
            self.ch.pop()
        self.ch.append("\n")
        self.nachalo_stroki = True

    def tekst(self):
        return "".join(self.ch)


def szhat_js(t):
    n = len(t)
    v = _Vyhod()
    i = 0
    posled = None  # последний значимый знак/слово: для «регулярка или деление»
    steki = []  # глубина фигурных скобок внутри ${ … } шаблонов

    def regex_mozhno():
        if posled is None:
            return True
        if posled in SLOVA_REGEX:
            return True
        return len(posled) == 1 and posled in PERED_REGEX

    def shablon(nach, i):
        """Читает шаблон: nach — откуда копировать (` или после «}»), i — откуда искать конец;
        возвращает (индекс после закрывающей `, True) или (индекс после «${», False) — дальше код до парной «}»."""
        while i < n:
            c = t[i]
            if c == "\\":
                i += 2
                continue
            if c == "`":
                v.kod(t[nach:i + 1])
                return i + 1, True
            if c == "$" and i + 1 < n and t[i + 1] == "{":
                v.kod(t[nach:i + 2])
                return i + 2, False
            i += 1
        raise ValueError("szhat_js: незакрытый шаблон `")

    while i < n:
        c = t[i]
        if c == "\n":
            v.perevod()
            i += 1
            continue
        if c in " \t\r":
            v.probel(c if c != "\r" else " ")
            i += 1
            continue
        if c == "/" and i + 1 < n and t[i + 1] == "/":
            j = t.find("\n", i)
            i = n if j < 0 else j  # перевод строки остаётся
            continue
        if c == "/" and i + 1 < n and t[i + 1] == "*":
            j = t.find("*/", i + 2)
            if j < 0:
                raise ValueError("szhat_js: незакрытый /* комментарий")
            if "\n" in t[i:j]:
                v.perevod()
            else:
                v.probel(" ")
            i = j + 2
            continue
        if c in "'\"":
            j = i + 1
            while j < n and t[j] != c:
                if t[j] == "\\":
                    j += 1
                elif t[j] == "\n":
                    raise ValueError("szhat_js: перевод строки внутри строки %r" % t[i:j][:60])
                j += 1
            v.kod(t[i:j + 1])
            posled = "str"
            i = j + 1
            continue
        if c == "`":
            i, zakryt = shablon(i, i + 1)
            if not zakryt:
                steki.append(0)
            posled = "str"
            continue
        if c == "/" and regex_mozhno():
            j = i + 1
            v_klasse = False
            while j < n:
                d = t[j]
                if d == "\\":
                    j += 2
                    continue
                if d == "\n":
                    raise ValueError("szhat_js: перевод строки в регулярном выражении %r" % t[i:j][:60])
                if d == "[":
                    v_klasse = True
                elif d == "]":
                    v_klasse = False
                elif d == "/" and not v_klasse:
                    break
                j += 1
            j += 1
            while j < n and SLOVO.match(t[j]):
                j += 1  # флаги
            v.kod(t[i:j])
            posled = "regex"
            i = j
            continue
        if steki and c == "{":
            steki[-1] += 1
        elif steki and c == "}":
            if steki[-1] == 0:
                steki.pop()
                i, zakryt = shablon(i, i + 1)
                if not zakryt:
                    steki.append(0)
                posled = "str"
                continue
            steki[-1] -= 1
        if SLOVO.match(c):
            j = i
            while j < n and SLOVO.match(t[j]):
                j += 1
            posled = t[i:j]
            v.kod(posled)
            i = j
            continue
        v.kod(c)
        posled = c
        i += 1
    if steki:
        raise ValueError("szhat_js: незакрытый ${ в шаблоне")
    return v.tekst()


def szhat_css(t):
    v = _Vyhod()
    i, n = 0, len(t)
    while i < n:
        c = t[i]
        if c == "\n":
            v.perevod()
            i += 1
            continue
        if c in " \t\r":
            v.probel(" ")
            i += 1
            continue
        if c == "/" and i + 1 < n and t[i + 1] == "*":
            j = t.find("*/", i + 2)
            if j < 0:
                raise ValueError("szhat_css: незакрытый /* комментарий")
            v.probel(" ")
            i = j + 2
            continue
        if c in "'\"":
            j = i + 1
            while j < n and t[j] != c:
                if t[j] == "\\":
                    j += 1
                j += 1
            v.kod(t[i:j + 1])
            i = j + 1
            continue
        v.kod(c)
        i += 1
    return v.tekst()
