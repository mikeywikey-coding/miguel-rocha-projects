function discoveryControls(id, label, origin) {
  const status = document.querySelector("#" + id + "-status");
  async function renderDiscovery() {
    const s = await chrome.storage.local.get([id + "Enabled", id + "Message"]);
    status.textContent = s[id + "Enabled"]
      ? s[id + "Message"] || "Waiting for the first search."
      : label + " discovery paused.";
  }
  document.querySelector("#" + id + "-enable").onclick = async () => {
    try {
      if (!(await chrome.permissions.request({ origins: [origin + "/*"] })))
        throw Error(label + " access was not granted.");
      const s = await chrome.storage.local.get([id + "State", "token"]);
      if (!s.token) throw Error("Pair with the dashboard first.");
      const progress = s[id + "State"] || {};
      progress.attention = false;
      progress.attempts = 0;
      if (progress.phase === "opening") delete progress.phase;
      if (progress.tabId && progress.phase === "loading") {
        try {
          await chrome.tabs.get(progress.tabId);
        } catch {
          delete progress.phase;
        }
      }
      await chrome.storage.local.set({ [id + "Enabled"]: true, [id + "State"]: progress });
      await chrome.runtime.sendMessage({ type: id + "-tick" });
      await renderDiscovery();
    } catch (error) {
      status.textContent = error.message;
    }
  };
  document.querySelector("#" + id + "-pause").onclick = async () => {
    await chrome.storage.local.set({ [id + "Enabled"]: false });
    await renderDiscovery();
  };
  document.querySelector("#" + id + "-show").onclick = async () => {
    const saved = await chrome.storage.local.get(id + "State");
    try {
      await chrome.tabs.update(saved[id + "State"].tabId, { active: true });
    } catch {
      status.textContent = "No open discovery tab.";
    }
  };
  chrome.storage.onChanged.addListener(renderDiscovery);
  renderDiscovery();
}
discoveryControls("indeed", "Indeed", "https://pt.indeed.com");
discoveryControls("jobrapido", "Jobrapido", "https://pt.jobrapido.com");
