import assert from "node:assert/strict";
import { test } from "node:test";
import { loadScripts } from "./load-script.mjs";

const saved = [];
const { get } = loadScripts(["travalarm/state.js", "travalarm/helpers.js"], {
  chrome: { storage: { local: { set: async (value) => saved.push(value) } } },
  window: { location: { hostname: "ts3.x1.europe.travian.com" } },
  getAlarmSvgIcon: () => "<svg></svg>",
});

test("server tag is a short, readable label for the game world", () => {
  assert.equal(get("serverTag"), "[ts3.x1.eur]");
});

test("parseSmartDuration accepts minutes, m:ss and h:mm:ss", () => {
  const parse = get("parseSmartDuration");
  assert.equal(parse("15"), 15 * 60_000);
  assert.equal(parse("1.5"), 60_000 + 5_000);
  assert.equal(parse("2:30"), 150_000);
  assert.equal(parse("1:02:03"), 3_723_000);
  assert.equal(parse(""), null);
  assert.equal(parse("soon"), null);
});

test("parseSmartDuration treats a clock time as the next time it occurs", () => {
  const ms = get("parseSmartDuration")("11:59pm");
  assert.ok(ms > 0 && ms <= 24 * 3600_000);
});

test("nextDailyOccurrence keeps the anchor's time of day", () => {
  const next = get("nextDailyOccurrence");
  const anchor = new Date(2026, 0, 1, 9, 30).getTime();
  const earlier = new Date(2026, 5, 10, 8, 0).getTime();
  const later = new Date(2026, 5, 10, 10, 0).getTime();
  assert.equal(next(anchor, earlier), new Date(2026, 5, 10, 9, 30).getTime());
  assert.equal(next(anchor, later), new Date(2026, 5, 11, 9, 30).getTime());
});

test("formatDurationForPrompt round-trips through parseSmartDuration", () => {
  const format = get("formatDurationForPrompt");
  const parse = get("parseSmartDuration");
  assert.equal(format(10 * 60_000), "10");
  assert.equal(format(90_000), "1:30");
  assert.equal(format(3_723_000), "1:02:03");
  assert.equal(format(-1), "0");
  for (const ms of [60_000, 90_000, 3_723_000]) assert.equal(parse(format(ms)), ms);
});

test("getStructuredName splits the label from its village", () => {
  const structured = get("getStructuredName");
  assert.deepEqual(
    { ...structured("🎉 [ts3.x1.eur] Town Hall | Rivertown", true) },
    { iconHtml: "<svg></svg>", name: "Town Hall", village: "Rivertown", isRecurring: true },
  );
  const parenthesised = structured("Main Building (Hilltop) #2", false);
  assert.equal(parenthesised.name, "Main Building #2");
  assert.equal(parenthesised.village, "Hilltop");
});

test("villageHue gives each village a stable, distinct colour", () => {
  const hue = get("villageHue");
  const first = hue("Alpha");
  const second = hue("Beta");
  assert.notEqual(first, second);
  assert.equal(hue("Alpha"), first);
  assert.equal(saved.length, 2);
});

test("escapeHtml neutralises markup from the page", () => {
  assert.equal(
    get("escapeHtml")(`<b onclick="x">'&'</b>`),
    "&lt;b onclick=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;",
  );
});
