import assert from "node:assert/strict";
import { test } from "node:test";
import { loadScripts } from "./load-script.mjs";

const TSP = loadScripts(["settlement-planner/shared.js"]).get("TSP");
const DAY = TSP.SECS_PER_DAY;
// Values built inside the script context have that context's prototypes.
const plain = (value) => structuredClone(value);

test("parseGameNumber reads Travian's number formats", () => {
  assert.equal(TSP.parseGameNumber("3,500"), 3500);
  assert.equal(TSP.parseGameNumber("1.234.567"), 1234567);
  assert.equal(TSP.parseGameNumber("1,5k"), 1500);
  assert.equal(TSP.parseGameNumber("2.5M"), 2500000);
  assert.equal(TSP.parseGameNumber("‭12​000‬"), 12000);
  assert.equal(TSP.parseGameNumber(""), 0);
  assert.equal(TSP.parseGameNumber("n/a"), 0);
});

test("extractProgression pulls the nested array out of page HTML", () => {
  const html = `<script>var d = {"progression": {"perDay": [{"day":1,"culture_points":[9]}, {"day":2,"culture_points":120}], "x":1}};</script>`;
  assert.deepEqual(plain(TSP.extractProgression(html)), [
    { day: 1, culture_points: [9] },
    { day: 2, culture_points: 120 },
  ]);
  assert.equal(TSP.extractProgression("<html></html>"), null);
  assert.equal(TSP.extractProgression(`"progression": {"perDay": [1, 2`), null);
});

test("computeRateSlope fits growth and ignores flat or falling history", () => {
  const rising = [1, 2, 3, 4].map((day) => ({ day, culture_points: 100 + 10 * day }));
  assert.ok(Math.abs(TSP.computeRateSlope(rising) * DAY * DAY - 10) < 1e-9);
  const falling = [1, 2, 3].map((day) => ({ day, culture_points: 300 - day }));
  assert.equal(TSP.computeRateSlope(falling), 0);
  assert.equal(TSP.computeRateSlope(rising.slice(0, 2)), 0);
  assert.equal(TSP.computeRateSlope(null), 0);
});

test("predictSettlement matches the closed form for steady production", () => {
  const result = TSP.predictSettlement({
    totalCp: 1000,
    passiveRate: 500 / DAY,
    target: 3000,
  });
  assert.equal(result.reached, true);
  assert.ok(Math.abs(result.seconds - 4 * DAY) < 1e-6);
  assert.equal(result.ratePerDay, 500);
});

test("predictSettlement credits celebrations and handles unreachable targets", () => {
  const base = { totalCp: 0, passiveRate: 100 / DAY, target: 2000 };
  const passiveOnly = TSP.predictSettlement(base).seconds;
  const celebrating = TSP.predictSettlement({
    ...base,
    villages: [{ cpProduction: 100, townHall: 10, smallCel: true, timerSeconds: 60 }],
  }).seconds;
  assert.ok(celebrating < passiveOnly);

  const stalled = TSP.predictSettlement({ totalCp: 10, passiveRate: 0, target: 20 });
  assert.deepEqual(
    { ...stalled },
    { seconds: Infinity, currentCp: 10, ratePerDay: 0, reached: false },
  );
  assert.equal(TSP.predictSettlement({ totalCp: 50, target: 20 }).reached, true);
});

test("predictSettlement advances scraped values by the elapsed time", () => {
  const result = TSP.predictSettlement({
    totalCp: 0,
    passiveRate: 1,
    target: 1000,
    dt: 100,
  });
  assert.equal(result.currentCp, 100);
  assert.ok(Math.abs(result.seconds - 900) < 1e-6);
});

test("formatters render durations", () => {
  assert.equal(TSP.formatDuration(DAY + 2 * 3600 + 3 * 60 + 59), "1d 2h 3m");
  assert.equal(TSP.formatDuration(-5), "0d 0h 0m");
  assert.equal(TSP.formatHMS(3723), "01:02:03");
});

test("escapeHtml neutralises markup in village names", () => {
  assert.equal(
    TSP.escapeHtml(`<img src=x onerror="a('b')">&`),
    "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;",
  );
});
