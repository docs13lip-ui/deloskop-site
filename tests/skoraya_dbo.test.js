// «Скорая 115-ФЗ», сценарий dbo — сверено по тексту определения СКЭС ВС от 16.02.2026 № 308-ЭС25-11615
// (vsrf.ru/lk/practice/stor_pdf_ec/2522258, 04.10.2026). node --test tests/*.test.*
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const js = fs.readFileSync(path.join(__dirname, "..", "skoraya-115-fz/engine.js"), "utf8");

test("dbo: без обещаний, которых нет в акте ВС", () => {
  assert.ok(!js.includes("без такой попытки убытки"), "акт не говорит, что попытка гарантирует убытки — только что компания в отделение не обращалась");
  assert.ok(!js.includes("где открыт счёт"), "в акте — «филиал или отделение банка», без привязки к месту открытия счёта");
});

test("dbo: позиция ВС — способ передачи распоряжений, отделение и представитель", () => {
  assert.ok(js.includes("меняет только способ передачи распоряжений"));
  assert.ok(js.includes("в филиал или отделение банка не обращалась"));
  assert.ok(js.includes("отправьте представителя по доверенности"));
  assert.ok(js.includes("308-ЭС25-11615"));
});
