importScripts('form.js');
importScripts('discovery.js', 'indeed.js', 'jobrapido.js');

const API = 'http://127.0.0.1:8123/api/companion/';
const ORIGINS = ['https://boards.greenhouse.io/*', 'https://job-boards.greenhouse.io/*', 'https://jobs.lever.co/*', 'https://jobs.ashbyhq.com/*'];
let running = false;

async function request(path, token) {
  let response;
  try { response = await fetch(API + path, {signal: AbortSignal.timeout(15000), headers: {Authorization: 'Bearer ' + token}}); }
  catch { const error = Error('Dashboard connection interrupted.'); error.retryable = true; throw error; }
  if (!response.ok) {
    const error = Error(response.status === 409 ? 'Approval changed. Review this application again.' : 'Dashboard unavailable or pairing needs attention.');
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }
  return response;
}

function applicationUrl(value) {
  const url = new URL(value);
  if (!ORIGINS.some(origin => new URL(origin).origin === url.origin)) return null;
  url.hash = '';
  if (url.hostname === 'jobs.lever.co' && !url.pathname.endsWith('/apply')) url.pathname = url.pathname.replace(/\/$/, '') + '/apply';
  if (url.hostname === 'jobs.ashbyhq.com' && !url.pathname.endsWith('/application')) url.pathname = url.pathname.replace(/\/$/, '') + '/application';
  return url.href;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const state = await chrome.storage.local.get(['queueEnabled', 'token', 'queueItems']);
    if (!state.queueEnabled || !state.token) return;
    if (!await chrome.permissions.contains({origins: ORIGINS})) {
      await chrome.storage.local.set({queueMessage: 'Enable queue access to the supported application sites.'});
      return;
    }
    const jobs = await (await request('approved', state.token)).json();
    const items = state.queueItems || {};
    // Closing a reviewed tab releases capacity, but never reopens that attempt.
    for (const item of Object.values(items)) {
      if (item.status === 'ready' && !jobs.some(job => job.id === item.id && job.revision === item.revision)) {
        item.status = 'attention';
        item.message = 'Approval changed. Do not submit the old filled tab; review this application again.';
      }
      if (item.status === 'ready') {
        try { await chrome.tabs.get(item.tabId); } catch { item.status = 'closed'; }
      }
      if (item.status === 'attention' && item.tabId) {
        try { await chrome.tabs.get(item.tabId); } catch { delete item.tabId; }
      }
      if (item.status === 'opening') {
        item.status = 'attention';
        item.message = 'Opening was interrupted. Check existing tabs before retrying.';
      }
    }
    const pending = Object.values(items).find(item => item.status === 'loading');
    if (pending) {
      try {
        const job = jobs.find(job => job.id === pending.id && job.revision === pending.revision);
        if (!job) throw Error('Approval changed. Review this application again.');
        const tab = await chrome.tabs.get(pending.tabId);
        pending.attempts = (pending.attempts || 0) + 1;
        if (!sameApplication(job.url, tab.url || 'about:blank')) throw Error('Tab moved away from the approved job. Check it manually.');
        if (tab.status !== 'complete') {
          if (pending.attempts >= 6) throw Error('The application page did not finish loading.');
        } else {
          const snapshot = await (await request('application/' + job.id, state.token)).json();
          const bytes = new Uint8Array(await (await request('cv/' + job.id, state.token)).arrayBuffer());
          let binary = '';
          for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
          // Revalidate approval and tab immediately before disclosing reviewed materials.
          const latest = await (await request('application/' + job.id, state.token)).json();
          if (latest.revision !== snapshot.revision || latest.cv_hash !== snapshot.cv_hash) throw Error('Approval changed while loading.');
          const current = await chrome.tabs.get(pending.tabId);
          if (!sameApplication(snapshot.url, current.url)) throw Error('Tab moved away from the approved job.');
          const controls = await chrome.storage.local.get(['queueEnabled', 'token']);
          if (!controls.queueEnabled || controls.token !== state.token) return;
          const results = await chrome.scripting.executeScript({target: {tabId: pending.tabId}, func: fillForm,
            args: [snapshot, {data: btoa(binary), name: 'Application_CV.pdf'}]});
          const report = results[0]?.result;
          if (!report && pending.attempts >= 6) throw Error('The application form could not be read. Check the open tab, then retry.');
          if (!report || (!report.filled.length && pending.attempts < 6 && report.skipped.some(text => text.includes('No clear application form')))) {
            pending.message = 'Waiting for the application form to appear.';
          } else {
            pending.status = report.filled.length ? 'ready' : 'attention';
            pending.message = report.filled.length ? 'Filled. Review fields and attachments in the open tab, then submit yourself.' : 'This form needs manual help.';
            pending.report = report;
          }
        }
      } catch (error) {
        pending.status = error.retryable && pending.attempts < 3 ? 'loading' : 'attention';
        pending.message = error.message + (pending.status === 'loading' ? ' Retrying on the next queue check.' : '');
      }
    } else if (Object.values(items).filter(item => item.tabId && item.status !== 'closed').length < 3) {
      const job = jobs.find(job => !items[job.id + ':' + job.revision]);
      if (job) {
        const key = job.id + ':' + job.revision;
        const item = items[key] = {id: job.id, revision: job.revision, title: job.title, company: job.company, status: 'opening'};
        const url = applicationUrl(job.url);
        if (!url) {
          item.status = 'attention';
          item.message = 'This website needs manual filling; automatic queue supports Greenhouse, Lever and Ashby.';
        } else {
          // Persist before creating a tab: worker interruption must not cause duplicates.
          await chrome.storage.local.set({queueItems: items});
          try {
            const tab = await chrome.tabs.create({url, active: false});
            item.tabId = tab.id;
            item.status = 'loading';
            item.attempts = 0;
          } catch {
            item.status = 'attention';
            item.message = 'Could not open the application tab.';
          }
        }
      }
    }
    await chrome.storage.local.set({queueItems: items, queueMessage: 'Queue running. Up to three review tabs stay open. Nothing is submitted.'});
  } catch (error) {
    await chrome.storage.local.set({queueMessage: error.message});
  } finally {
    running = false;
  }
}

async function schedule() {
  await chrome.alarms.create('application-queue', {periodInMinutes: 1});
}
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'application-queue') tick(); });
chrome.runtime.onStartup.addListener(schedule);
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'queue-submitted') {
    (async () => {
      if (running) return {ok: false, error: 'Queue is busy. Try again shortly.'};
      running = true;
      try {
        const {queueItems = {}, token} = await chrome.storage.local.get(['queueItems', 'token']);
        const item = queueItems[message.key];
        if (!item || item.status !== 'ready' || message.confirmed !== true) throw Error('Review and submit this application first.');
        const response = await fetch(API + 'submitted/' + item.id, {method: 'POST', signal: AbortSignal.timeout(15000), headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify({revision: item.revision, confirmed: true})});
        if (!response.ok) throw Error('Could not record submission. Check the dashboard before retrying.');
        item.status = 'submitted';
        item.message = 'Submission recorded from your confirmation.';
        delete item.tabId;
        await chrome.storage.local.set({queueItems});
        return {ok: true};
      } catch (error) { return {ok: false, error: error.message}; }
      finally { running = false; }
    })().then(respond);
    return true;
  }
  if (message.type === 'queue-retry') {
    (async () => {
      if (running) return {ok: false};
      running = true;
      try {
        const {queueItems = {}} = await chrome.storage.local.get('queueItems');
        const item = queueItems[message.key];
        if (item?.status === 'attention') {
          let tab;
          try { if (item.tabId) tab = await chrome.tabs.get(item.tabId); } catch {}
          if (tab) { item.status = 'loading'; item.attempts = 0; }
          else delete queueItems[message.key];
          await chrome.storage.local.set({queueItems});
        }
      } finally { running = false; }
      await tick();
      return {ok: true};
    })().then(respond);
    return true;
  }
  if (message.type !== 'queue-tick') return;
  tick().then(() => respond({ok: true}));
  return true;
});
