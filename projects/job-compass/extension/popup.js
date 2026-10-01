const BASE = "http://127.0.0.1:8123";
const $ = (s) => document.querySelector(s);
let approvedJobs = [];
const status = (text) => ($("#status").textContent = text);
async function api(path) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) throw Error("Paste your pairing key from dashboard Settings first.");
  return fetch(BASE + "/api/companion/" + path, { headers: { Authorization: "Bearer " + token } });
}
async function json(path) {
  const r = await api(path);
  const value = await r.json();
  if (!r.ok) throw Error(value.detail || "Request failed");
  return value;
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || ""))
    throw Error("Open a public job listing first.");
  return tab;
}
async function loadApproved() {
  approvedJobs = await json("approved");
  $("#approved").replaceChildren();
  const first = new Option(
    approvedJobs.length ? "Choose an approved application" : "No approved applications yet",
    "",
  );
  $("#approved").append(first);
  for (const j of approvedJobs)
    $("#approved").append(new Option(j.company + " · " + j.title, j.id));
  status("Paired. " + approvedJobs.length + " approved applications available.");
}
function extractListing() {
  const collect = (x) =>
    Array.isArray(x)
      ? x.flatMap(collect)
      : x && typeof x === "object"
        ? [x, ...collect(x["@graph"] || [])]
        : [];
  let posting = null;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const objects = collect(JSON.parse(script.textContent));
      posting = objects.find((x) => [x["@type"]].flat().includes("JobPosting"));
      if (posting) break;
    } catch {}
  }
  const plain = (html) => {
    const d = new DOMParser().parseFromString(String(html || ""), "text/html");
    return d.body.textContent.trim();
  };
  if (posting) {
    const locations = [posting.jobLocation]
      .flat()
      .filter(Boolean)
      .map((l) =>
        [l.address?.addressLocality, l.address?.addressCountry].filter(Boolean).join(", "),
      );
    const allowed = [posting.applicantLocationRequirements]
      .flat()
      .filter(Boolean)
      .map((x) => x.name)
      .filter(Boolean);
    return {
      title: posting.title || "",
      company: posting.hiringOrganization?.name || "",
      location:
        [posting.jobLocationType === "TELECOMMUTE" ? "Remote" : "", ...locations, ...allowed]
          .filter(Boolean)
          .join(" · ") || "Not specified",
      url: location.href,
      description: plain(posting.description).slice(0, 60000),
    };
  }
  return {
    title: document.querySelector("h1")?.innerText.trim() || document.title,
    company: "",
    location: "Not specified",
    url: location.href,
    description: (document.querySelector("main") || document.body).innerText.slice(0, 60000),
  };
}
// FORM_HELPERS
async function guarded(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    status(e.message || "Could not reach Job Compass. Start the local service.");
  } finally {
    button.disabled = false;
  }
}
$("#pair").onclick = (e) =>
  guarded(e.target, async () => {
    await chrome.storage.local.set({ token: $("#token").value.trim() });
    $("#token").value = "";
    await loadApproved();
    $("#pairing").open = false;
  });
$("#reload").onclick = (e) => guarded(e.target, loadApproved);
$("#open").onclick = (e) =>
  guarded(e.target, async () => {
    const job = approvedJobs.find((j) => j.id === $("#approved").value);
    if (!job) throw Error("Choose an approved application first.");
    await chrome.tabs.create({ url: job.url });
    status("Job opened. Go to its application form, then use Fill reviewed details & CV.");
  });
$("#capture").onclick = (e) =>
  guarded(e.target, async () => {
    const tab = await activeTab();
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractListing,
    });
    if (!result?.result)
      throw Error("Could not read this page. Import it manually in the dashboard.");
    for (const key of ["title", "company", "location", "url", "description"])
      $("#" + key).value = result.result[key];
    $("#import").hidden = false;
    status("Check the captured details, especially company and location, then confirm.");
  });
$("#import").onsubmit = (e) => {
  e.preventDefault();
  guarded(e.submitter, async () => {
    const { token } = await chrome.storage.local.get("token");
    const data = Object.fromEntries(
      ["title", "company", "location", "url", "description"].map((k) => [k, $("#" + k).value]),
    );
    const r = await fetch(BASE + "/api/companion/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (token || "") },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    if (!r.ok)
      throw Error(typeof result.detail === "string" ? result.detail : "Check the captured fields.");
    status(result.created ? "Added to your dashboard." : "Already in your dashboard.");
    $("#import").hidden = true;
  });
};
$("#fill").onclick = (e) =>
  guarded(e.target, async () => {
    const id = $("#approved").value;
    if (!id) throw Error("Approve an application in the dashboard, then select it here.");
    const tab = await activeTab();
    const snapshot = await json("application/" + id);
    if (!sameApplication(snapshot.url, tab.url))
      throw Error(
        "Open the exact approved listing or its application page. This tab does not match.",
      );
    const response = await api("cv/" + id);
    if (!response.ok) throw Error("The approved CV is unavailable.");
    const blob = await response.blob();
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const latest = await chrome.tabs.get(tab.id);
    if (!sameApplication(snapshot.url, latest.url))
      throw Error("The page changed. Check it and try again.");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillForm,
      args: [snapshot, { data, name: "Miguel_Rocha_" + snapshot.cv + ".pdf" }],
    });
    const report = result.result;
    $("#report").textContent =
      "Filled: " +
      (report.filled.join(", ") || "No supported fields found.") +
      "\nReview manually: " +
      (report.skipped.join(", ") || "All answers and attachments before submitting.") +
      "\nNothing was submitted.";
    status(
      report.filled.length
        ? "The employer tab is ready for your review. Check everything there, then submit it yourself."
        : "Open the employer application form in this tab, then try again.",
    );
  });
loadApproved().catch(() => {
  $("#pairing").open = true;
});
