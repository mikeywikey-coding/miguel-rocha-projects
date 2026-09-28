function registerDiscovery({id,label,origin,searches,keys,extract}) {
  let running = false;
  async function request(token, payload) {
    const response = await fetch('http://127.0.0.1:8123/api/companion/discovery/'+id, {method:payload ? 'POST' : 'GET',
      signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+token, 'Content-Type':'application/json'},
      ...(payload ? {body:JSON.stringify(payload)} : {})});
    if (!response.ok) throw Error('Dashboard unavailable, discovery paused, or pairing needs attention.');
    return response.json();
  }

  async function tick() {
    if (running) return;
    running = true;
    let progress;
    try {
      const saved = await chrome.storage.local.get([id+'Enabled',id+'State','token']);
      if (!saved[id+'Enabled'] || !saved.token) return;
      progress = saved[id+'State'] || {};
      if (progress.attention || (progress.nextAt || 0) > Date.now()) return;
      if (!await chrome.permissions.contains({origins:[origin+'/*']})) throw Error('Enable '+label+' site access in the companion.');
      if (!(await request(saved.token)).enabled) {
        await chrome.storage.local.set({[id+'Message']:'Discovery paused in the dashboard.'});
        return;
      }
      const index = progress.index || 0;
      const url = searches[index];
      if (progress.phase === 'opening') throw Error('Opening was interrupted. Check existing tabs before resuming.');
      if (progress.phase !== 'loading') {
        let existing;
        try { if (progress.tabId) existing = await chrome.tabs.get(progress.tabId); } catch {}
        if (existing && !searches.some(search => {
          const a = new URL(existing.url || 'about:blank'), b = new URL(search);
          return a.origin === b.origin && a.pathname === b.pathname && keys.every(k=>a.searchParams.get(k)===b.searchParams.get(k));
        })) throw Error('The discovery tab was used for another page. Close it before resuming.');
        progress = {index:0, jobs:[], phase:'opening'};
        await chrome.storage.local.set({[id+'State']:progress});
        const tab = existing ? await chrome.tabs.update(existing.id,{url:searches[0]}) : await chrome.tabs.create({url:searches[0], active:false});
        progress.tabId = tab.id; progress.phase = 'loading'; progress.attempts = 0;
      } else {
        const tab = await chrome.tabs.get(progress.tabId);
        const actual = new URL(tab.url || 'about:blank'), expected = new URL(url);
        if (actual.origin !== expected.origin || actual.pathname !== expected.pathname ||
            keys.some(key => actual.searchParams.get(key) !== expected.searchParams.get(key))) {
          throw Error('The discovery tab moved away from its search. Check it before resuming.');
        }
        progress.attempts = (progress.attempts || 0) + 1;
        let report;
        if (tab.status === 'complete') {
          const result = await chrome.scripting.executeScript({target:{tabId:tab.id},func:extract});
          report = result[0]?.result;
        }
        if (report?.error === 'blocked' || (!report?.jobs && progress.attempts >= 3)) {
          progress.attention = true;
          await request(saved.token,{error:report?.error === 'blocked' ? 'blocked' : 'unreadable'});
          await chrome.storage.local.set({[id+'State']:progress,[id+'Message']:label+' needs attention. Open the search tab, then resume. No jobs submitted.'});
          return;
        }
        if (report?.jobs) {
          progress.jobs = [...new Map([...(progress.jobs || []),...report.jobs].map(job=>[job.url,job])).values()].slice(0,60);
          const controls = await chrome.storage.local.get([id+'Enabled','token']);
          if (!controls[id+'Enabled'] || controls.token !== saved.token) return;
          if (index + 1 < searches.length) {
            // Save the next step before navigation; interruptions pause instead of skipping results.
            progress.index = index + 1; progress.attempts = 0;
            await chrome.storage.local.set({[id+'State']:progress});
            await chrome.tabs.update(tab.id,{url:searches[progress.index]});
          } else {
            const result = await request(saved.token,{jobs:progress.jobs});
            progress = {nextAt:Date.now()+6*60*60*1000,tabId:tab.id};
            await chrome.storage.local.set({[id+'State']:progress,[id+'Message']:`${label} checked. Added ${result.added} matches. Next check in six hours.`});
            return;
          }
        }
      }
      await chrome.storage.local.set({[id+'State']:progress,[id+'Message']:`Reading ${label} search ${(progress.index || 0)+1} of ${searches.length}.`});
    } catch (error) {
      await chrome.storage.local.set({[id+'State']:{...progress,attention:true},[id+'Message']:error.message + ' Use Enable / resume after resolving it.'});
    } finally { running = false; }
  }

  async function schedule() { await chrome.alarms.create(id+'-discovery',{periodInMinutes:1}); }
  chrome.runtime.onInstalled.addListener(schedule);
  chrome.runtime.onStartup.addListener(schedule);
  chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===id+'-discovery')tick();});
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message.type!==id+'-tick')return;
    tick().then(()=>respond({ok:true}));return true;
  });

  return tick;
}
