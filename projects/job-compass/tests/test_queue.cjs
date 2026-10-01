const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function harness({
  permission = true,
  closed = false,
  serviceFailure = false,
  missingReport = false,
} = {}) {
  const data = { queueEnabled: true, token: "fixture" };
  let created = 0,
    filled = 0;
  const job = { id: "one", revision: 1, url: "https://jobs.lever.co/example/one" };
  const event = { addListener() {} };
  const chrome = {
    storage: {
      local: {
        get: async () => structuredClone(data),
        set: async (v) => Object.assign(data, structuredClone(v)),
      },
    },
    permissions: { contains: async () => permission },
    alarms: { create: async () => {}, onAlarm: event },
    runtime: { onMessage: event, onStartup: event, onInstalled: event },
    tabs: {
      create: async ({ url }) => ({ id: ++created, url, status: "complete" }),
      get: async (id) => {
        if (closed) throw Error("closed");
        return { id, url: job.url + "/apply", status: "complete" };
      },
    },
    scripting: {
      executeScript: async () => {
        filled++;
        return missingReport ? [] : [{ result: { filled: ["Name"], skipped: [] } }];
      },
    },
  };
  const fetch = async (url) => ({
    ok: !serviceFailure || url.endsWith("/approved"),
    status: serviceFailure ? 503 : 200,
    json: async () =>
      url.endsWith("/approved") ? [job] : { ...job, profile: {}, cv: "developer-en" },
    arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer,
  });
  const context = vm.createContext({
    chrome,
    fetch,
    URL,
    AbortSignal,
    Uint8Array,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    console,
    importScripts() {},
    sameApplication: (a, b) => b === a + "/apply",
    fillForm() {},
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../extension/background.js"), "utf8"),
    context,
  );
  return { data, context, job, created: () => created, filled: () => filled };
}

test("opens once, fills on next tick, and keeps ready tabs without duplicates", async () => {
  const h = harness();
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 1);
  await vm.runInContext("tick()", h.context);
  assert.equal(h.filled(), 1);
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 1);
  assert.equal(Object.values(h.data.queueItems)[0].status, "ready");
});
test("paused queue and missing permission never open tabs", async () => {
  const h = harness({ permission: false });
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 0);
  h.data.queueEnabled = false;
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 0);
});
test("closed tabs become actionable without reopening automatically", async () => {
  const h = harness({ closed: true });
  await vm.runInContext("tick()", h.context);
  await vm.runInContext("tick()", h.context);
  assert.equal(Object.values(h.data.queueItems)[0].status, "attention");
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 1);
});
test("revoked approval is never filled", async () => {
  const h = harness();
  await vm.runInContext("tick()", h.context);
  h.job.revision = 2;
  await vm.runInContext("tick()", h.context);
  assert.equal(h.filled(), 0);
  assert.equal(Object.values(h.data.queueItems)[0].status, "attention");
});
test("unsupported sites remain visible without opening", async () => {
  const h = harness();
  h.job.url = "https://example.test/job";
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 0);
  assert.equal(Object.values(h.data.queueItems)[0].status, "attention");
});
test("interrupted opening is not duplicated after worker restart", async () => {
  const h = harness();
  h.data.queueItems = { "one:1": { id: "one", revision: 1, status: "opening" } };
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 0);
  assert.equal(h.data.queueItems["one:1"].status, "attention");
});
test("three open review tabs stop new openings", async () => {
  const h = harness();
  h.data.queueItems = Object.fromEntries([1, 2, 3].map((i) => [i, { status: "ready", tabId: i }]));
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 0);
});
test("temporary service errors retry with a finite limit", async () => {
  const h = harness({ serviceFailure: true });
  await vm.runInContext("tick()", h.context);
  await vm.runInContext("tick()", h.context);
  assert.equal(h.data.queueItems["one:1"].status, "loading");
  await vm.runInContext("tick()", h.context);
  await vm.runInContext("tick()", h.context);
  assert.equal(h.data.queueItems["one:1"].status, "attention");
  assert.equal(h.created(), 1);
  assert.equal(h.filled(), 0);
});

test("missing form reports stop after six checks and keep the review tab", async () => {
  const h = harness({ missingReport: true });
  for (let i = 0; i < 7; i++) await vm.runInContext("tick()", h.context);
  assert.equal(h.data.queueItems["one:1"].status, "attention");
  assert.equal(h.data.queueItems["one:1"].tabId, 1);
  assert.match(h.data.queueItems["one:1"].message, /form/i);
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 1);
});
test("a stalled dashboard request times out and permits a later queue check", async () => {
  const h = harness();
  const original = h.context.fetch;
  h.context.AbortSignal = { timeout: () => AbortSignal.timeout(5) };
  h.context.fetch = (url, options) =>
    new Promise((resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(Error("timeout")), { once: true });
    });
  const result = await Promise.race([
    vm.runInContext("tick()", h.context).then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 50)),
  ]);
  assert.equal(result, true, "queue must release its running lock after timeout");
  assert.match(h.data.queueMessage, /interrupted/i);
  h.context.fetch = original;
  await vm.runInContext("tick()", h.context);
  assert.equal(h.created(), 1);
});
