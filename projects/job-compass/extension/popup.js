const BASE='http://127.0.0.1:8123';
const $=s=>document.querySelector(s);
let approvedJobs=[];
const status=text=>$('#status').textContent=text;
async function api(path){const {token}=await chrome.storage.local.get('token');if(!token)throw Error('Paste your pairing key from dashboard Settings first.');return fetch(BASE+'/api/companion/'+path,{headers:{Authorization:'Bearer '+token}});}
async function json(path){const r=await api(path);const value=await r.json();if(!r.ok)throw Error(value.detail||'Request failed');return value;}
async function activeTab(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id||!/^https?:\/\//.test(tab.url||''))throw Error('Open a public job listing first.');return tab;}
async function loadApproved(){approvedJobs=await json('approved');$('#approved').replaceChildren();const first=new Option(approvedJobs.length?'Choose an approved application':'No approved applications yet','');$('#approved').append(first);for(const j of approvedJobs)$('#approved').append(new Option(j.company+' · '+j.title,j.id));status('Paired. '+approvedJobs.length+' approved applications available.');}
function extractListing(){
  const collect=x=>Array.isArray(x)?x.flatMap(collect):x&&typeof x==='object'?[x,...collect(x['@graph']||[])]:[];
  let posting=null;
  for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{const objects=collect(JSON.parse(script.textContent));posting=objects.find(x=>[x['@type']].flat().includes('JobPosting'));if(posting)break;}catch{}}
  const plain=html=>{const d=new DOMParser().parseFromString(String(html||''),'text/html');return d.body.textContent.trim();};
  if(posting){const locations=[posting.jobLocation].flat().filter(Boolean).map(l=>[l.address?.addressLocality,l.address?.addressCountry].filter(Boolean).join(', '));const allowed=[posting.applicantLocationRequirements].flat().filter(Boolean).map(x=>x.name).filter(Boolean);return {title:posting.title||'',company:posting.hiringOrganization?.name||'',location:[posting.jobLocationType==='TELECOMMUTE'?'Remote':'',...locations,...allowed].filter(Boolean).join(' · ')||'Not specified',url:location.href,description:plain(posting.description).slice(0,60000)};}
  return {title:document.querySelector('h1')?.innerText.trim()||document.title,company:'',location:'Not specified',url:location.href,description:(document.querySelector('main')||document.body).innerText.slice(0,60000)};
}
function sameApplication(expected,actual){
  const clean=value=>{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(key.startsWith('utm_')||['source','ref','referral','trackingid','trk','src'].includes(key.toLowerCase()))u.searchParams.delete(key);u.pathname=u.pathname.replace(/\/$/,'').replace(/\/(?:apply|application)$/,'')||'/';u.searchParams.sort();return u;};
  const a=clean(expected),b=clean(actual);return a.origin===b.origin&&a.pathname===b.pathname&&a.search===b.search;
}
function fillForm(snapshot,pdf){
  // Invoked only by an explicit popup click after server-side approval.
  const p=snapshot.profile;
  const values={first:p.first_name,last:p.last_name,full:p.first_name+' '+p.last_name,email:p.email,phone:p.phone,letter:snapshot.letter};
  const fields={first:'first_name firstname given_name givenname'.split(' '),last:'last_name lastname family_name familyname surname'.split(' '),full:'full_name fullname name'.split(' '),email:['email','email_address'],phone:['phone','phone_number','telephone','mobile'],letter:['cover_letter','coverletter']};
  const autocomplete={'given-name':'first','family-name':'last','name':'full','email':'email','tel':'phone'};
  const normal=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  function fieldKind(el,label){
    const raw=el.name||el.id||'';
    const leaf=raw.match(/(?:^|\[)([^\[\]]+)\]?$/)?.[1]||raw;
    const candidates=[normal(leaf),normal(label),normal(el.getAttribute('aria-label'))];
    const byAutocomplete=autocomplete[el.autocomplete];
    if(byAutocomplete)return byAutocomplete;
    for(const [kind,names] of Object.entries(fields))if(candidates.some(name=>names.includes(name)))return kind;
    return null;
  }
  const filled=[],skipped=[];
  const forms=[...document.querySelectorAll('form,[role="form"],.ashby-application-form-container')];
  const ranked=forms.map(form=>{const fields=[...form.querySelectorAll('input,textarea')];const kinds=new Set(fields.map(el=>fieldKind(el,[...(el.labels||[])].map(x=>x.innerText).join(' '))).filter(Boolean));const hasCV=fields.some(el=>el.type==='file'&&/resume|résumé|curr[ií]culo|\bcv\b/i.test((el.name||'')+' '+[...(el.labels||[])].map(x=>x.innerText).join(' ')));return {form,kinds,hasCV,score:kinds.size+(hasCV?2:0)};}).sort((a,b)=>b.score-a.score);
  const chosen=ranked.find(x=>x.score>=3&&(x.hasCV||x.kinds.has('first')||x.kinds.has('last')));
  if(!chosen)return {filled,skipped:['Open the employer application form, then try again. No clear application form was found.']};
  for(const el of chosen.form.querySelectorAll('input,textarea,select')){
    if((!el.getClientRects().length&&el.type!=='file')||el.disabled||el.readOnly)continue;
    const type=(el.type||'').toLowerCase();const key=(el.name||el.id||'').toLowerCase();const label=[...(el.labels||[])].map(x=>x.innerText).join(' ').trim()||el.getAttribute('aria-label')||key;
    if(type==='file'){
      if(!/resume|résumé|curr[ií]culo|\bcv\b/i.test(label+' '+key)){if(el.required)skipped.push(label);continue;}
      if(el.files?.length){skipped.push(label+' (already has a file)');continue;}
      const bytes=Uint8Array.from(atob(pdf.data),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],pdf.name,{type:'application/pdf'}));el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));filled.push(label+' (CV attached)');continue;
    }
    if(el.tagName==='SELECT'||!['text','email','tel','textarea'].includes(type)){if(el.required&&!['hidden','submit','button'].includes(type))skipped.push(label);continue;}
    const kind=fieldKind(el,label);const value=kind?values[kind]:null;
    if(!value){if(el.required)skipped.push(label);continue;}
    if(el.value.trim()){skipped.push(label+' (kept existing value)');continue;}
    const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));filled.push(label);
  }
  return {filled,skipped};
}
async function guarded(button,fn){button.disabled=true;try{await fn();}catch(e){status(e.message||'Could not reach Job Compass. Start the local service.');}finally{button.disabled=false;}}
$('#pair').onclick=e=>guarded(e.target,async()=>{await chrome.storage.local.set({token:$('#token').value.trim()});$('#token').value='';await loadApproved();$('#pairing').open=false;});
$('#reload').onclick=e=>guarded(e.target,loadApproved);
$('#open').onclick=e=>guarded(e.target,async()=>{const job=approvedJobs.find(j=>j.id===$('#approved').value);if(!job)throw Error('Choose an approved application first.');await chrome.tabs.create({url:job.url});status('Job opened. Go to its application form, then use Fill reviewed details & CV.');});
$('#capture').onclick=e=>guarded(e.target,async()=>{const tab=await activeTab();const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:extractListing});if(!result?.result)throw Error('Could not read this page. Import it manually in the dashboard.');for(const key of ['title','company','location','url','description'])$('#'+key).value=result.result[key];$('#import').hidden=false;status('Check the captured details, especially company and location, then confirm.');});
$('#import').onsubmit=e=>{e.preventDefault();guarded(e.submitter,async()=>{const {token}=await chrome.storage.local.get('token');const data=Object.fromEntries(['title','company','location','url','description'].map(k=>[k,$('#'+k).value]));const r=await fetch(BASE+'/api/companion/import',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(token||'')},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(typeof result.detail==='string'?result.detail:'Check the captured fields.');status(result.created?'Added to your dashboard.':'Already in your dashboard.');$('#import').hidden=true;});};
$('#fill').onclick=e=>guarded(e.target,async()=>{const id=$('#approved').value;if(!id)throw Error('Approve an application in the dashboard, then select it here.');const tab=await activeTab();const snapshot=await json('application/'+id);if(!sameApplication(snapshot.url,tab.url))throw Error('Open the exact approved listing or its application page. This tab does not match.');const response=await api('cv/'+id);if(!response.ok)throw Error('The approved CV is unavailable.');const blob=await response.blob();const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});const latest=await chrome.tabs.get(tab.id);if(!sameApplication(snapshot.url,latest.url))throw Error('The page changed. Check it and try again.');const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillForm,args:[snapshot,{data,name:'Miguel_Rocha_'+snapshot.cv+'.pdf'}]});const report=result.result;$('#report').textContent='Filled: '+(report.filled.join(', ')||'No supported fields found.')+'\nReview manually: '+(report.skipped.join(', ')||'All answers and attachments before submitting.')+'\nNothing was submitted.';status(report.filled.length?'The employer tab is ready for your review. Check everything there, then submit it yourself.':'Open the employer application form in this tab, then try again.');});
loadApproved().catch(()=>{$('#pairing').open=true;});
