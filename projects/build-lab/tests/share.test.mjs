import { test } from "node:test";
import assert from "node:assert/strict";

// share.js resolves links against the page's location.
globalThis.location = new URL("https://build-lab.example/app/?b=stale#old");

const { attributes, initial, normalizeBuild } = await import("../src/data.js");
const { buildUrl, parseBuildLink } = await import("../src/share.js");

test("a shared link round-trips the build", () => {
  const link = buildUrl(initial);
  assert.ok(!new URL(link).searchParams.has("b"));
  assert.deepEqual(parseBuildLink(link), normalizeBuild(initial));
});

test("pasted JSON is accepted and normalised", () => {
  assert.deepEqual(parseBuildLink(` ${JSON.stringify(initial)} `), normalizeBuild(initial));
});

test("original builder codes are imported", () => {
  const ratings = attributes.map(() => 60).join("-");
  const build = parseBuildLink(`https://builder.example/?b=SF.80.220.84.${ratings}`);
  assert.equal(build.body.position, "SF");
  assert.equal(build.name, "Imported build");
  assert.equal(Object.keys(build.ratings).length, attributes.length);
});

test("malformed links explain what is wrong", () => {
  assert.throws(() => parseBuildLink("https://builder.example/"), /No build found/);
  assert.throws(() => parseBuildLink("https://builder.example/?b=SF.80"), /unsupported format/);
  assert.throws(
    () => parseBuildLink("https://builder.example/?b=QB.80.220.84.1-2"),
    /missing or invalid/,
  );
});
