let state = null,
  view = "discover",
  filter = "all",
  search = "",
  groupBy = "website";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const date = (v) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not yet checked";
const labels = {
  discover: "Discover",
  review: "Review queue",
  applications: "Applications",
  inbox: "Replies",
  sources: "Job sources",
  settings: "Settings",
};
async function api(path, method = "GET", data) {
  const r = await fetch("/api" + path, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await r.json();
  if (!r.ok)
    throw Error(
      typeof body.detail === "string" ? body.detail : "Check the information and try again.",
    );
  return body;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), 6500);
}
async function refresh(renderView = true) {
  state = await api("/state");
  $("#new-count").textContent = state.jobs.filter((j) => j.status === "new").length;
  $("#review-count").textContent = state.jobs.filter((j) =>
    ["saved", "draft", "approved"].includes(j.status),
  ).length;
  $("#mail-count").textContent = state.messages.filter((m) => !m.reviewed).length;
  $("#automation-status").textContent = !state.automation
    ? "Automatic checks paused"
    : state.health?.scheduler_running
      ? "Checks running · local service"
      : "Background checks need attention";
  if (renderView) render();
}
function heading(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="muted">${subtitle}</p></div><div class="button-row">${actions}</div></div>`;
}
const button = (action, text, cls = "secondary", id = "") =>
  `<button class="${cls}" data-action="${action}" ${id ? `data-id="${esc(id)}"` : ""}>${text}</button>`;
function empty(title, body, action = "") {
  return `<div class="empty"><div class="empty-icon">↗</div><h2>${title}</h2><p>${body}</p>${action}</div>`;
}
function tags(list, cls = "") {
  return list.map((t) => `<span class="tag ${cls}">${esc(t)}</span>`).join("");
}
function card(j) {
  return `<article class="job-card"><div class="company-avatar">${esc(j.company[0]?.toUpperCase() || "?")}</div><div><h3><button class="title-button" data-action="detail" data-id="${j.id}">${esc(j.title)}</button></h3><div class="company-line">${esc(j.company)} · ${esc(j.location)}</div><div class="tags">${tags(j.analysis.matched.slice(0, 4))}${j.analysis.flags.length ? tags([j.analysis.flags[0]], "warning") : ""}</div><div class="card-bottom"><span>${esc(j.source)} · ${esc(j.status.replace("_", " "))}</span><button class="small-link" data-action="detail" data-id="${j.id}">View opportunity ↗</button></div></div><div class="score">${j.score}<span>MATCH SCORE</span></div></article>`;
}
function websiteOf(job) {
  try {
    return new URL(job.url).hostname.replace(/^www\./, "").toLowerCase() || "Other websites";
  } catch {
    return job.source || "Other websites";
  }
}
function jobCards(jobs) {
  if (groupBy === "fit") return jobs.map(card).join("");
  const groups = new Map();
  for (const job of jobs) {
    const site = websiteOf(job);
    if (!groups.has(site)) groups.set(site, []);
    groups.get(site).push(job);
  }
  return [...groups]
    .map(
      ([site, items]) =>
        `<section class="website-group" aria-label="Jobs on ${esc(site)}"><div class="website-heading"><h2>${esc(site)}</h2><span>${items.length} ${items.length === 1 ? "job" : "jobs"}</span></div>${items.map(card).join("")}</section>`,
    )
    .join("");
}
function stats() {
  const jobs = state.jobs;
  return `<div class="stats">${[
    ["Matches to explore", jobs.filter((j) => j.status === "new").length, "your next step"],
    [
      "Ready for review",
      jobs.filter((j) => ["saved", "draft"].includes(j.status)).length,
      "you decide",
    ],
    ["Applications sent", jobs.filter((j) => j.applied_at).length, "confirmed by you"],
    [
      "Replies to review",
      state.messages.filter((m) => !m.reviewed).length,
      state.gmail.connected ? "Gmail connected" : "Gmail not connected",
    ],
  ]
    .map(
      ([a, b, c]) =>
        `<div class="stat"><div class="stat-label">${a}</div><div class="stat-value">${b}<small>${c}</small></div></div>`,
    )
    .join("")}</div>`;
}
function sidebarPanels() {
  return `<aside class="discovery-aside"><div class="side-panel"><p class="eyebrow">THE RIGHT DIRECTION</p><h3>Your search, in focus</h3><div class="line"><span>Primary</span><em>Junior dev / internship</em></div><div class="line"><span>Location</span><em>Lisbon + remote</em></div><div class="line"><span>Support roles</span><em>${state.profile.support ? "Included" : "Off"}</em></div><div class="line"><span>Submission</span><em>Your approval</em></div><p>Remote roles with unclear country eligibility are flagged for a closer look.</p></div><div class="side-panel"><h3>A little less inbox checking.</h3><p>${state.gmail.connected ? "Gmail is connected. Relevant replies appear here for review." : "Connect Gmail to bring recruitment replies into your workspace."}</p>${button("go-settings", state.gmail.connected ? "Connection settings" : "Connect Gmail ↗")}</div><div class="side-panel"><h3>Workspace activity</h3>${
    state.activity.length
      ? state.activity
          .slice(0, 4)
          .map((a) => `<p class="activity">${esc(a.text)}<br><small>${date(a.at)}</small></p>`)
          .join("")
      : "<p>Your next action will appear here.</p>"
  }</div></aside>`;
}
function jobsView() {
  let jobs = state.jobs.filter((j) =>
    view === "discover"
      ? ["new", "archived"].includes(j.status)
      : view === "review"
        ? ["saved", "draft", "approved"].includes(j.status)
        : ["applied", "interview", "assessment", "rejected"].includes(j.status),
  );
  if (view === "discover" && filter !== "archived")
    jobs = jobs.filter((j) => j.status !== "archived");
  if (filter === "archived") jobs = jobs.filter((j) => j.status === "archived");
  if (filter === "development" || filter === "support")
    jobs = jobs.filter((j) => j.analysis.category === filter);
  if (filter === "check") jobs = jobs.filter((j) => j.analysis.flags.length);
  if (search)
    jobs = jobs.filter((j) =>
      (j.title + " " + j.company + " " + j.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const intro =
    view === "discover"
      ? heading(
          "A NEW CHAPTER",
          "Good opportunities. Less searching.",
          "A focused search for your first step in tech.",
          button("import", "＋ Add a job") + button("sync-jobs", "↻ Find new matches", "primary"),
        )
      : view === "review"
        ? heading(
            "MAKE IT YOURS",
            "A thoughtful application starts here.",
            "Review the role, choose a CV and make the introduction yours.",
          )
        : heading(
            "KEEP THINGS MOVING",
            "Every application, in one place.",
            "Only applications you confirm as submitted appear here.",
          );
  return (
    intro +
    (view === "discover" ? stats() : "") +
    `<div class="discovery-layout"><div><div class="toolbar"><div class="filter-tabs">${[["all", "All roles"], ["development", "Development"], ["support", "Support"], ["check", "Needs a closer look"], ...(view === "discover" ? [["archived", "Archived"]] : [])].map(([id, t]) => `<button data-filter="${id}" class="chip ${filter === id ? "active" : ""}">${t}</button>`).join("")}</div><div class="group-tabs" aria-label="Group jobs"><span>Group by</span><button data-group="fit" class="chip ${groupBy === "fit" ? "active" : ""}" aria-pressed="${groupBy === "fit"}">Best match</button><button data-group="website" class="chip ${groupBy === "website" ? "active" : ""}" aria-pressed="${groupBy === "website"}">Website</button></div></div><input class="search" id="job-search" aria-label="Search jobs" placeholder="Search roles or companies…" value="${esc(search)}"><p class="result-count">${jobs.length} opportunities · ${groupBy === "website" ? "grouped by website" : "sorted by fit"}</p><div id="job-list">${jobs.length ? jobCards(jobs) : empty(view === "discover" ? "Let’s find your next opportunity." : "Nothing here just yet.", view === "discover" ? "Run discovery or import a listing. Only relevant matches are added; source errors are shown under Job sources." : "Save a job from Discover to start preparing an application.", view === "discover" ? button("sync-jobs", "Find new matches ↗", "primary") : "")}</div></div>${sidebarPanels()}</div>`
  );
}
function sourcesView() {
  return (
    heading(
      "CAST A SMARTER NET",
      "Your job-search toolkit.",
      "Automatic discovery and connection status for each website.",
      button("sync-jobs", "↻ Check sources", "primary"),
    ) +
    `<div class="notice">Automatic sources refresh every six hours while this PC is on. Public-page collectors scan bounded search results; they do not cover every listing. Sources needing access remain clearly marked below.</div><div class="source-grid">${state.sources.map((s) => `<article class="panel"><div class="source-title"><div><h3>${esc(s.name)}</h3><span class="source-kind">${s.kind === "browser" ? "SETUP NEEDED" : "AUTOMATIC · " + (s.kind === "public" ? "WEBSITE SEARCH" : s.kind === "companion" ? "BRAVE COMPANION" : esc(s.kind.toUpperCase()))}</span></div>${s.kind !== "browser" ? `<button class="chip ${s.enabled ? "active" : ""}" data-action="toggle-source" data-id="${esc(s.id)}">${s.enabled ? "On" : "Off"}</button>` : ""}</div><div class="source-meta">${s.kind === "browser" ? esc({ indeed: "Browser collector available. Reload the Brave companion, then choose Enable / resume Indeed and grant site access.", jobrapido: "Browser collector available. Reload the Brave companion, then choose Enable / resume Jobrapido and grant site access.", jooble: "A Portugal Jooble API key is required. Automatic search is not connected.", itjobs: "Add your ITJobs API key in Settings." }[s.id] || "Automatic collection is not connected.") : `${s.kind === "companion" ? "Requires Brave and enabled companion discovery.<br>" : ""}${s.count} listings in last successful response<br>Last success: ${date(s.last_success)}<br>Last attempt: ${date(s.last_attempt)}`}</div>${s.error ? `<p class="source-error">${esc(s.error)} · Other sources continue independently.</p>` : ""}<a href="${esc(s.url)}" target="_blank" rel="noreferrer">Open ${esc(s.name.split(" · ")[0])} ↗</a></article>`).join("")}</div><section class="panel section-heading"><h3>Add an employer board</h3><p>Use the company identifier from its Greenhouse, Lever or Ashby careers URL.</p><form id="source-form"><div class="form-row"><label>Company name<input name="name" required></label><label>Provider<select name="kind"><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option><option value="ashby">Ashby</option></select></label></div><label>Board identifier<input name="board" pattern="[A-Za-z0-9_-]+" required placeholder="company-name"></label><button class="primary">Add automatic source</button></form></section>`
  );
}
function inboxView() {
  return (
    heading(
      "STAY IN THE LOOP",
      "Replies that move you forward.",
      "Recruitment messages, linked to your applications.",
      button("sync-mail", "↻ Check Gmail", "primary"),
    ) +
    (!state.gmail.connected
      ? empty(
          "Your inbox, connected.",
          "Connect Gmail in Settings. The app requests read-only access; it cannot send, delete or mark messages as read.",
          button("go-settings", "Set up Gmail ↗", "primary"),
        )
      : `<div class="notice">Last check: ${date(state.gmail.last_sync)}. Categories are suggestions; confirm any application status changes below. Ambiguous messages stay unlinked.</div>${state.gmail.error ? `<div class="notice error">${esc(state.gmail.error)}</div>` : ""}${
          state.messages.length
            ? state.messages
                .map(
                  (m) =>
                    `<article class="panel inbox-message"><div class="source-title"><h3>${esc(m.subject)}</h3>${tags([m.kind, m.reviewed ? "Reviewed" : "Needs review"], m.reviewed ? "" : "warning")}</div><p>${esc(m.sender)} · ${date(m.received)}</p><p class="excerpt">${esc(m.excerpt)}</p><a href="https://mail.google.com/mail/u/0/#all/${encodeURIComponent(m.thread)}" target="_blank" rel="noreferrer">Open in Gmail ↗</a><form class="message-form" data-id="${esc(m.id)}"><label>Link to an application<select name="job_id"><option value="">Leave unlinked</option>${state.jobs
                      .filter((j) => j.applied_at)
                      .map(
                        (j) =>
                          `<option value="${j.id}" ${m.job_id === j.id ? "selected" : ""}>${esc(j.company + " · " + j.title)}</option>`,
                      )
                      .join(
                        "",
                      )}</select></label><label class="check-label"><input type="checkbox" name="apply_status">Apply suggested interview / assessment / rejection status</label><button class="secondary">Confirm review</button><button type="button" class="secondary" data-action="dismiss-message" data-id="${esc(m.id)}">Dismiss as unrelated</button></form></article>`,
                )
                .join("")
            : empty(
                "No recruitment replies yet.",
                "Checks run every five minutes while this service is running. The first sync looks for recruitment messages from the last 30 days.",
              )
        }`)
  );
}
const answerFields = [
  ["right_to_work_portugal", "Right to work in Portugal"],
  ["visa_sponsorship", "Visa sponsorship needed"],
  ["availability", "Availability / notice period"],
  ["salary_expectations", "Salary expectations"],
  ["linkedin_url", "LinkedIn profile URL"],
  ["github_url", "GitHub profile URL"],
  ["portfolio_url", "Recruiter-accessible portfolio URL"],
];
function answersPanel() {
  const answers = state.application_answers || {};
  return `<section class="panel"><h3>Confirmed application answers</h3><p>Add only answers you have checked. Leave anything uncertain blank. Approved profile links and availability can be filled into matching employer fields. Other answers still need manual review.</p><form id="answers-form"><div class="answer-fields">${answerFields.map(([key, label]) => `<label>${label}<input id="answer-${key.replaceAll("_", "-")}" name="${key}" maxlength="500" value="${esc(answers[key] || "")}"></label>`).join("")}</div><label class="check-label"><input id="answers-confirm" type="checkbox" required>I confirm these answers are accurate. Changing them clears existing application approvals.</label><button class="primary">Save confirmed answers</button></form></section>`;
}
function settingsView() {
  const p = state.profile,
    g = state.gmail;
  return (
    heading(
      "SET UP FOR YOUR NEXT STEP",
      "A workspace that knows your strengths.",
      "Your details stay in this local, private workspace.",
    ) +
    `<div class="settings-grid"><section class="panel"><h3>Your application profile</h3><p>These details fill approved applications. Changing them clears previous approvals.</p><form id="profile-form"><div class="form-row"><label>First name<input name="first_name" value="${esc(p.first_name)}" required></label><label>Last name<input name="last_name" value="${esc(p.last_name)}" required></label></div><label>Email<input name="email" type="email" value="${esc(p.email)}" required></label><label>Phone<input name="phone" value="${esc(p.phone)}"></label><label>Location<input name="location" value="${esc(p.location)}"></label><label>Confirmed skills, comma separated<textarea name="skills" rows="4">${esc(p.skills.join(", "))}</textarea></label><label class="check-label"><input type="checkbox" name="support" ${p.support ? "checked" : ""}>Include technical and customer-support roles</label><button class="primary">Save profile</button></form></section>${answersPanel()}<section class="panel"><h3>Gmail connection</h3><p>${g.connected ? "Connected as " + esc(g.account) : "Not connected. Your Google authorisation is required."}</p>${g.error ? `<div class="notice error">${esc(g.error)}</div>` : ""}<div class="notice">Read-only access covers your mailbox. The app filters recruitment messages and stores relevant excerpts locally. It never sends replies.</div>${g.connected ? button("disconnect-mail", "Disconnect Gmail", "danger") : `<details ${g.configured ? "" : "open"}><summary>Google OAuth setup</summary><p>Create a Google Cloud OAuth web client, enable the Gmail API, and add your Gmail account as a test user. Use this exact authorised redirect URI:</p><p class="code-inline">${esc(g.redirect)}</p><form id="google-form"><label>Client ID<input name="client_id" autocomplete="off" required></label><label>Client secret<input name="client_secret" type="password" autocomplete="off" required></label><button class="secondary">Save Google client</button></form><p class="privacy-note">Credentials and tokens are encrypted on disk. Google's testing configuration may require periodic reconnection. Do not paste credentials into chat.</p></details>`}${!g.connected && g.configured ? button("connect-mail", "Continue with Google ↗", "primary") : ""}<p>Last successful check: ${date(g.last_sync)}</p></section><section class="panel"><h3>Your CV library</h3><p>General and developer variants, in English and Portuguese.</p>${state.cvs.map((c) => `<div class="cv-row"><span>${esc(c.id.replace("-", " · ").toUpperCase())}</span>${c.available ? `<a href="/api/cvs/${c.id}">Download PDF ↗</a>` : '<span class="inline-error">Missing file</span>'}</div>`).join("")}<p class="privacy-note">Education: ISEL · Computer Science and Computer Engineering, course not completed. English: C2 level.</p></section><section class="panel"><h3>ITJobs automatic search</h3><p>${state.itjobs.configured ? "Connected. Job Compass searches ITJobs every six hours." : "Add a read-only API key to search Portuguese IT roles automatically."}</p><p><a href="https://www.itjobs.pt/api" target="_blank" rel="noreferrer">Request your free read-only key on ITJobs ↗</a></p><form id="itjobs-form"><label>ITJobs API key<input name="key" type="password" autocomplete="off" required minlength="8"></label><button class="secondary">${state.itjobs.configured ? "Replace key" : "Save key and enable search"}</button></form>${state.itjobs.configured ? button("remove-itjobs-key", "Remove key", "secondary") : ""}<p class="privacy-note">The key is encrypted on this PC and never shown again in the dashboard. Do not paste it into chat.</p></section><section class="panel"><h3>Brave companion</h3><p>In Brave, open <strong>brave://extensions</strong>, enable Developer mode and load the project's <strong>extension</strong> folder. Paste your pairing key into its popup.</p><div class="button-row">${button("show-token", "Show pairing key")}${button("rotate-token", "Reset pairing")}</div><div id="pairing-key"></div><p class="privacy-note">Treat this key as private: it grants access to approved application details and CVs. Resetting it disconnects paired copies.</p></section><section class="panel"><h3>Automatic checks</h3><p>Jobs: every six hours. Gmail: every five minutes. Each check prepares all untouched new and saved jobs as English drafts. Match concerns stay visible without blocking preparation. Checks run while this PC and service are on.</p><p>Background scheduler: ${state.health?.scheduler_running ? "Running" : "Needs attention"} · Last check started: ${date(state.health?.scheduler_last_check)}</p>${button("toggle-automation", state.automation ? "Pause automatic checks" : "Resume automatic checks", state.automation ? "secondary" : "primary")}<div class="notice">Submission mode: review required. Fully automatic submission is not enabled.</div></section></div>`
  );
}
function render() {
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#breadcrumb").textContent = "Workspace / " + labels[view];
  $("#content").innerHTML =
    view === "sources"
      ? sourcesView()
      : view === "settings"
        ? settingsView()
        : view === "inbox"
          ? inboxView()
          : jobsView();
}
function languageChoice(value = "en") {
  return `<label>Draft language<select id="draft-language"><option value="en" ${value === "en" ? "selected" : ""}>English</option><option value="pt" ${value === "pt" ? "selected" : ""}>Português</option></select></label>`;
}
function showJob(id) {
  const j = state.jobs.find((j) => j.id === id);
  if (!j) return;
  const editable = ["draft", "approved"].includes(j.status);
  $("#detail-content").innerHTML =
    `<div class="dialog-heading"><div><p class="eyebrow">${esc(j.company)} · ${j.score} MATCH SCORE</p><h2>${esc(j.title)}</h2><p class="detail-meta">${esc(j.location)} · ${esc(j.source)}</p></div><button data-action="close-detail" class="icon-button" aria-label="Close job">×</button></div><div class="button-row"><a class="secondary" href="${esc(j.url)}" target="_blank" rel="noreferrer">Original listing ↗</a>${["new", "archived"].includes(j.status) ? button("save-job", "Save to review", "primary", id) : ""}${!["applied", "interview", "assessment", "rejected"].includes(j.status) ? button("archive", "Archive", "secondary", id) : ""}</div><div class="detail-grid detail-section"><div><h3>Why it made your list</h3><ul class="detail-list">${j.analysis.reasons.map((x) => `<li>${esc(x)}</li>`).join("") || "<li>Manually imported for review.</li>"}</ul><div class="tags">${tags(j.analysis.matched)}</div><h3 class="section-heading">Check before applying</h3><ul class="detail-list">${[...j.analysis.flags, ...j.analysis.gaps.map((s) => "Listed skill not on your confirmed profile: " + s)].map((x) => `<li>${esc(x)}</li>`).join("") || "<li>No obvious flags detected. Read the full listing to confirm requirements.</li>"}</ul></div><div><h3>From the listing</h3><p class="detail-description">${esc(j.description || "No description imported yet. Check the original listing.")}</p></div></div><div class="detail-section"><h3>Application materials</h3>${editable ? `<p class="muted">Edit this template in your own voice. It is based on confirmed profile facts, not an AI-generated claim of experience.</p><label>CV<select id="draft-cv">${state.cvs.map((c) => `<option value="${c.id}" ${j.cv === c.id ? "selected" : ""}>${esc(c.id)}${c.available ? "" : " — missing"}</option>`).join("")}</select></label><label>Introduction / cover letter<textarea id="draft-text" class="draft-text">${esc(j.draft)}</textarea></label><div class="button-row section-heading">${button("save-draft", "Save changes", "secondary", id)}${j.status === "draft" ? button("approve", "Approve saved materials", "primary", id) : tags(["Approved for Brave"], "status")}</div>${languageChoice(j.cv?.endsWith("-pt") ? "pt" : "en")}<p class="privacy-note">Regenerating replaces the current letter and clears approval. Save a copy of any edits you want to keep.</p>${button("regenerate", "Regenerate draft", "secondary", id)}<p class="privacy-note">Approval covers the saved letter, CV and contact details. Unanswered questions, eligibility, salary and consent stay for your review on the employer website.</p>${j.status === "approved" ? `<div class="notice">Open the listing in Brave and use the companion to fill the approved details. You must review the form and click Submit yourself.</div><label class="check-label"><input id="submitted-confirm" type="checkbox">I submitted this application and saw confirmation on the employer website.</label>${button("mark-applied", "Record as submitted", "primary", id)}` : ""}` : !["applied", "interview", "assessment", "rejected"].includes(j.status) ? `<p class="muted">Choose a language. The matching CV is selected automatically.</p>${languageChoice()}${button("prepare", "Prepare application ↗", "primary", id)}` : `<p class="muted">Status: ${esc(j.status)} · Submitted ${date(j.applied_at)}</p>`}</div>`;
  if (!$("#detail").open) $("#detail").showModal();
}
async function act(action, id) {
  if (action === "import") {
    $("#import-dialog").showModal();
    return;
  }
  if (action === "close-import") {
    $("#import-dialog").close();
    return;
  }
  if (action === "close-detail") {
    $("#detail").close();
    return;
  }
  if (action === "detail") {
    showJob(id);
    return;
  }
  if (action === "go-settings") {
    view = "settings";
    render();
    return;
  }
  if (action === "sync-jobs") {
    toast("Checking available sources…");
    const r = await api("/sync/jobs", "POST", {});
    await refresh();
    toast(
      r.busy
        ? "A discovery check is already running."
        : r.cooldown
          ? "Sources are within their six-hour refresh window. You can still import jobs from Brave."
          : `Added ${r.added} matches from ${r.fetched} listings.${r.failures.length ? " Some sources need attention." : ""}`,
    );
    return;
  }
  if (action === "sync-mail") {
    const r = await api("/sync/gmail", "POST", {});
    await refresh();
    toast(
      r.error ||
        (!r.connected
          ? "Connect Gmail in Settings first."
          : `Found ${r.added || 0} new recruitment messages.`),
    );
    return;
  }
  if (action === "dismiss-message") {
    await api("/messages/" + id + "/dismiss", "POST", {});
    await refresh();
    toast("Removed from Replies. The email remains in Gmail.");
    return;
  }
  if (action === "toggle-source") {
    let s = state.sources.find((s) => s.id === id);
    await api("/sources/" + id + "/toggle", "POST", { enabled: !s.enabled });
    await refresh();
    return;
  }
  if (action === "toggle-automation") {
    await api("/automation", "POST", { enabled: !state.automation });
    await refresh();
    return;
  }
  if (action === "show-token") {
    const r = await api("/pairing");
    $("#pairing-key").innerHTML = `<p class="token">${esc(r.token)}</p>`;
    return;
  }
  if (action === "rotate-token") {
    await api("/pairing/rotate", "POST", {});
    $("#pairing-key").innerHTML = "";
    toast("Pairing reset. Existing companions are disconnected.");
    return;
  }
  if (action === "remove-itjobs-key") {
    await api("/itjobs/key", "DELETE", {});
    await refresh();
    toast("ITJobs automatic search disabled. The browse link remains.");
    return;
  }
  if (action === "connect-mail") {
    const r = await api("/gmail/connect", "POST", {});
    location.href = r.url;
    return;
  }
  if (action === "disconnect-mail") {
    await api("/gmail/disconnect", "POST", {});
    await refresh();
    return;
  }
  if (action === "save-job") await api("/jobs/" + id + "/status", "POST", { status: "saved" });
  if (action === "archive") await api("/jobs/" + id + "/status", "POST", { status: "archived" });
  if (action === "prepare" || action === "regenerate") {
    if (
      action === "regenerate" &&
      !window.confirm("Replace the current letter? Your edits and approval will be cleared.")
    )
      return;
    const language = $("#draft-language")?.value || "en";
    await api("/jobs/" + id + "/prepare?language=" + encodeURIComponent(language), "POST", {});
  }
  if (action === "save-draft") {
    let j = state.jobs.find((j) => j.id === id);
    await api("/jobs/" + id + "/draft", "PUT", {
      text: $("#draft-text").value,
      cv: $("#draft-cv").value,
      revision: j.revision,
    });
  }
  if (action === "approve") {
    let j = state.jobs.find((j) => j.id === id);
    if ($("#draft-text").value !== j.draft || $("#draft-cv").value !== j.cv)
      throw Error("Save your changes before approving.");
    await api("/jobs/" + id + "/approve", "POST", { revision: j.revision });
    toast("Materials approved. Submit only after reviewing the employer form.");
  }
  if (action === "mark-applied") {
    if (!$("#submitted-confirm").checked)
      throw Error("Confirm that you saw successful submission on the employer website.");
    await api("/jobs/" + id + "/status", "POST", { status: "applied", confirm: true });
    toast("Application recorded.");
  }
  await refresh();
  if (id) showJob(id);
  if (action === "save-draft") toast("Saved. Changes require a new approval.");
}
document.addEventListener("click", async (e) => {
  const v = e.target.closest("[data-view]");
  if (v) {
    view = v.dataset.view;
    filter = "all";
    search = "";
    render();
    return;
  }
  const f = e.target.closest("[data-filter]");
  if (f) {
    filter = f.dataset.filter;
    render();
    return;
  }
  const g = e.target.closest("[data-group]");
  if (g) {
    groupBy = g.dataset.group;
    render();
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  b.disabled = true;
  try {
    await act(b.dataset.action, b.dataset.id);
  } catch (err) {
    toast(err.message);
  } finally {
    b.disabled = false;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "job-search") {
    search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("#job-search").focus();
    $("#job-search").setSelectionRange(pos, pos);
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target,
    data = Object.fromEntries(new FormData(form));
  const b = form.querySelector("button[type=submit],button:not([type])");
  if (b) b.disabled = true;
  try {
    if (form.id === "answers-form") {
      const answers = Object.fromEntries(
        answerFields.map(([key]) => [key, (data[key] || "").trim()]).filter(([, value]) => value),
      );
      await api("/answers", "POST", {
        answers,
        confirmed: form.elements["answers-confirm"].checked,
      });
      await refresh();
      toast("Application answers saved.");
    } else if (form.id === "import-form") {
      const r = await api("/jobs", "POST", data);
      $("#import-dialog").close();
      form.reset();
      await refresh();
      showJob(r.id);
      toast(r.created ? "Job added." : "Already on your list.");
    } else if (form.id === "profile-form") {
      await api("/profile", "POST", {
        ...data,
        skills: data.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        support: form.elements.support.checked,
      });
      await refresh();
      toast("Profile saved.");
    } else if (form.id === "source-form") {
      await api("/sources", "POST", data);
      await refresh();
      toast("Source added. Run discovery to check it.");
    } else if (form.id === "itjobs-form") {
      await api("/itjobs/key", "POST", { key: data.key });
      form.reset();
      await refresh();
      toast("ITJobs automatic search enabled.");
    } else if (form.id === "google-form") {
      await api("/gmail/client", "POST", data);
      form.reset();
      await refresh();
      toast("Google client saved. Continue with Google to authorise access.");
    } else if (form.classList.contains("message-form")) {
      await api("/messages/" + form.dataset.id + "/review", "POST", {
        job_id: data.job_id || null,
        apply_status: form.elements.apply_status.checked,
      });
      await refresh();
      toast("Message review saved.");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (b) b.disabled = false;
  }
});
refresh()
  .then(() => {
    const result = new URLSearchParams(location.search).get("gmail");
    if (result) {
      view = "settings";
      render();
      toast(
        result === "connected"
          ? "Gmail connected."
          : result === "cancelled"
            ? "Google connection cancelled."
            : "Google connection could not be completed. Check OAuth settings and try again.",
      );
      history.replaceState({}, "", "/");
    }
  })
  .catch((err) => {
    $("#content").innerHTML = empty("Workspace unavailable.", esc(err.message));
  });
setInterval(() => {
  if (
    !document.querySelector("dialog[open]") &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  )
    refresh(!["settings", "sources", "inbox"].includes(view)).catch(() => {});
}, 60000);
