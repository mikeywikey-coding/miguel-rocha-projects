const INDEED_SEARCHES = [
  ["junior developer", "Lisboa"],
  ["estágio informática", "Lisboa"],
  ["technical support", "Lisboa"],
  ["junior developer remote", "Portugal"],
].map(
  ([q, l]) =>
    "https://pt.indeed.com/jobs?q=" + encodeURIComponent(q) + "&l=" + encodeURIComponent(l),
);

function extractIndeed() {
  if (location.origin !== "https://pt.indeed.com" || location.pathname !== "/jobs")
    return { error: "blocked" };
  if (
    /security check|just a moment|verify you are human|verifique.*humano/i.test(document.title) ||
    document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="captcha"]')
  )
    return { error: "blocked" };
  const jobs = [];
  for (const link of document.querySelectorAll("a.jcs-JobTitle[data-jk]")) {
    const card = link.closest("li");
    const read = (selector) => card?.querySelector(selector)?.textContent.trim() || "";
    const key = link.getAttribute("data-jk");
    const title = link.textContent.trim();
    const company = read('[data-testid="company-name"]');
    if (!/^[a-f0-9]{16}$/.test(key) || !title || !company) continue;
    jobs.push({
      title: title.slice(0, 300),
      company: company.slice(0, 200),
      location: read('[data-testid="text-location"]').slice(0, 300) || "Not specified",
      description: read('[data-testid="belowJobSnippet"]').slice(0, 60000),
      url: "https://pt.indeed.com/viewjob?jk=" + key,
    });
  }
  if (jobs.length) return { jobs: jobs.slice(0, 30) };
  return { error: "unreadable" };
}

const indeedTick = registerDiscovery({
  id: "indeed",
  label: "Indeed",
  origin: "https://pt.indeed.com",
  searches: INDEED_SEARCHES,
  keys: ["q", "l"],
  extract: extractIndeed,
});
