const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function harness({ blocked = false, permission = true, enabled = true, source = "indeed" } = {}) {
  const data = { [source + "Enabled"]: true, token: "test" },
    event = { addListener() {} };
  let created = 0,
    imports = 0,
    tab;
  const chrome = {
    storage: {
      local: {
        get: async () => structuredClone(data),
        set: async (v) => Object.assign(data, structuredClone(v)),
      },
    },
    permissions: { contains: async () => permission },
    alarms: { create: async () => {}, onAlarm: event },
    runtime: { onInstalled: event, onStartup: event, onMessage: event },
    tabs: {
      create: async ({ url }) => {
        created++;
        return (tab = { id: 1, url, status: "complete" });
      },
      get: async () => tab,
      update: async (id, { url }) => (tab = { ...tab, url }),
    },
    scripting: {
      executeScript: async () => [
        {
          result: blocked
            ? { error: "blocked" }
            : {
                jobs: [
                  {
                    title: "Junior Developer",
                    company: "Example",
                    location: "Lisboa",
                    description: "React",
                    url: "https://pt.indeed.com/viewjob?jk=0123456789abcdef",
                  },
                ],
              },
        },
      ],
    },
  };
  const fetch = async (url, opts) => {
    if (opts.method === "POST" && !JSON.parse(opts.body).error) imports++;
    return { ok: true, json: async () => (opts.method === "POST" ? { added: 1 } : { enabled }) };
  };
  const context = vm.createContext({ chrome, fetch, URL, Date, console, AbortSignal });
  if (fs.existsSync("extension/discovery.js"))
    vm.runInContext(fs.readFileSync("extension/discovery.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("extension/" + source + ".js", "utf8"), context);
  return {
    data,
    context,
    created: () => created,
    imports: () => imports,
    tick: () => vm.runInContext(source + "Tick()", context),
  };
}
test("one tab, deduplicated import, then six-hour cooldown", async () => {
  const h = harness();
  for (let i = 0; i < 9; i++) await h.tick();
  assert.equal(h.created(), 1);
  assert.equal(h.imports(), 1);
  assert.ok(h.data.indeedState.nextAt > Date.now());
  h.data.indeedState.nextAt = 0;
  for (let i = 0; i < 9; i++) await h.tick();
  assert.equal(h.created(), 1);
  assert.equal(h.imports(), 2);
});
test("challenge pauses without importing or repeatedly opening tabs", async () => {
  const h = harness({ blocked: true });
  for (let i = 0; i < 6; i++) await h.tick();
  assert.equal(h.created(), 1);
  assert.equal(h.imports(), 0);
  assert.equal(h.data.indeedState.attention, true);
});
test("local pause, denied access and dashboard pause never open searches", async () => {
  for (const options of [{ permission: false }, { enabled: false }, {}]) {
    const h = harness(options);
    if (!Object.keys(options).length) h.data.indeedEnabled = false;
    await h.tick();
    assert.equal(h.created(), 0);
  }
});

test("Jobrapido uses its own schedule and pauses on challenges", async () => {
  const h = harness({ source: "jobrapido" });
  for (let i = 0; i < 9; i++) await h.tick();
  assert.equal(h.created(), 1);
  assert.equal(h.imports(), 1);
  assert.ok(h.data.jobrapidoState.nextAt > Date.now());
  assert.equal(h.data.indeedState, undefined);
  const blocked = harness({ source: "jobrapido", blocked: true });
  for (let i = 0; i < 6; i++) await blocked.tick();
  assert.equal(blocked.imports(), 0);
  assert.equal(blocked.data.jobrapidoState.attention, true);
});

test("Jobrapido extraction reads cards, removes tracking and rejects foreign links", () => {
  const h = harness({ source: "jobrapido" });
  h.context.location = { origin: "https://pt.jobrapido.com", pathname: "/" };
  const card = {
    querySelector: (selector) => ({
      textContent: {
        ".result-item__title": "Junior Developer",
        ".result-item__company-label": "Example",
        ".result-item__location-label": "Lisboa",
      }[selector],
    }),
  };
  h.context.document = {
    title: "Emprego Junior Developer",
    querySelectorAll: () => [
      {
        href: "https://open.app.jobrapido.com/pt/3569571438094450688/?tracking=one",
        closest: () => card,
      },
      { href: "https://example.com/pt/123/", closest: () => card },
    ],
  };
  const result = vm.runInContext("extractJobrapido()", h.context);
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].url, "https://open.app.jobrapido.com/pt/3569571438094450688/");
  assert.equal(result.jobs[0].company, "Example");
  h.context.document.title = "Just a moment";
  assert.equal(vm.runInContext("extractJobrapido()", h.context).error, "blocked");
});
