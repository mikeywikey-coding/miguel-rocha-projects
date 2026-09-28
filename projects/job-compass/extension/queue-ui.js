(() => {
  const origins = ['https://boards.greenhouse.io/*', 'https://job-boards.greenhouse.io/*', 'https://jobs.lever.co/*', 'https://jobs.ashbyhq.com/*'];
  async function renderQueue() {
    const state = await chrome.storage.local.get(['queueEnabled', 'queueMessage', 'queueItems']);
    document.querySelector('#queue-status').textContent = state.queueEnabled ? (state.queueMessage || 'Queue enabled.') : 'Queue paused. Open tabs are kept.';
    const list = document.querySelector('#queue-list');
    list.replaceChildren();
    for (const [key, item] of Object.entries(state.queueItems || {}).reverse().slice(0, 20)) {
      const row = document.createElement('li');
      const text = document.createElement('p');
      text.textContent = `${item.company} · ${item.title}: ${item.status}. ${item.message || ''}`;
      row.append(text);
      if (item.report?.skipped?.length) {
        const details = document.createElement('p');
        details.textContent = 'Check: ' + item.report.skipped.join(', ');
        row.append(details);
      }
      if (item.tabId) {
        const open = document.createElement('button');
        open.textContent = 'Show application tab';
        open.onclick = async () => {
          try { await chrome.tabs.update(item.tabId, {active: true}); }
          catch { document.querySelector('#queue-status').textContent = 'That tab is closed.'; }
        };
        row.append(open);
      }
      if (item.status === 'attention') {
        const retry = document.createElement('button');
        retry.textContent = 'Retry this application';
        retry.onclick = async () => {
          if (!item.tabId && !confirm('Check for an already-open application tab first. Retry may open a new tab. Continue?')) return;
          await chrome.runtime.sendMessage({type: 'queue-retry', key});
          await renderQueue();
        };
        row.append(retry);
      }
      if (item.status === 'ready') {
        const submitted = document.createElement('button');
        submitted.textContent = 'Record submitted';
        submitted.onclick = async () => {
          if (!confirm('Did you submit this application and see a success confirmation on the employer website?')) return;
          const result = await chrome.runtime.sendMessage({type: 'queue-submitted', key, confirmed: true});
          if (!result?.ok) { document.querySelector('#queue-status').textContent = result?.error || 'Could not record submission.'; return; }
          await renderQueue();
        };
        row.append(submitted);
      }
      list.append(row);
    }
  }
  document.querySelector('#queue-enable').onclick = async () => {
    try {
      if (!await chrome.permissions.request({origins})) throw Error('Site access was not granted. Queue remains paused.');
      await chrome.storage.local.set({queueEnabled: true});
      await chrome.runtime.sendMessage({type: 'queue-tick'});
      await renderQueue();
    } catch (error) { document.querySelector('#queue-status').textContent = error.message; }
  };
  document.querySelector('#queue-pause').onclick = async () => {
    await chrome.storage.local.set({queueEnabled: false});
    await renderQueue();
  };
  chrome.storage.onChanged.addListener(renderQueue);
  renderQueue();
})();
