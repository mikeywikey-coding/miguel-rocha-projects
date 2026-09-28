function sameApplication(expected,actual){
  const clean=value=>{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(key.startsWith('utm_')||['source','ref','referral','trackingid','trk','src'].includes(key.toLowerCase()))u.searchParams.delete(key);u.pathname=u.pathname.replace(/\/$/,'').replace(/\/(?:apply|application)$/,'')||'/';u.searchParams.sort();return u;};
  const a=clean(expected),b=clean(actual);return a.origin===b.origin&&a.pathname===b.pathname&&a.search===b.search;
}
function fillForm(snapshot,pdf){
  // Invoked by the popup or enabled queue after server-side approval.
  // Check in the page as well: navigation can race the background tab check.
  const cleanUrl=value=>{const u=new URL(value);u.hash='';for(const key of [...u.searchParams.keys()])if(key.startsWith('utm_')||['source','ref','referral','trackingid','trk','src'].includes(key.toLowerCase()))u.searchParams.delete(key);u.pathname=u.pathname.replace(/\/$/,'').replace(/\/(?:apply|application)$/,'')||'/';u.searchParams.sort();return u.href;};
  try{if(!snapshot.url||cleanUrl(snapshot.url)!==cleanUrl(location.href))return {filled:[],skipped:['This page is not the approved application.']};}catch{return {filled:[],skipped:['The application URL could not be verified.']};}
  const p=snapshot.profile;
  const values={first:p.first_name,last:p.last_name,full:p.first_name+' '+p.last_name,email:p.email,phone:p.phone,letter:snapshot.letter};
  const fields={first:'first_name firstname given_name givenname'.split(' '),last:'last_name lastname family_name familyname surname'.split(' '),full:'full_name fullname name'.split(' '),email:['email','email_address'],phone:['phone','phone_number','telephone','mobile'],letter:['cover_letter','coverletter']};
  const autocomplete={'given-name':'first','family-name':'last','name':'full','email':'email','tel':'phone'};
  const normal=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  // Only use answers captured in the approved snapshot, never current settings.
  const answerFields={
    linkedin_url:['linkedin','linkedin_url','linkedin_profile','linkedin_profile_url'],
    github_url:['github','github_url','github_profile','github_profile_url'],
    portfolio_url:['portfolio','portfolio_url','portfolio_website','personal_website'],
    availability:['availability','notice_period','when_can_you_start','disponibilidade','prazo_de_pre_aviso']
  };
  function confirmedAnswer(el,label){
    const leaf=(el.name||el.id||'').match(/(?:^|\[)([^\[\]]+)\]?$/)?.[1]||el.name||el.id||'';
    const visibleLabel=[...(el.labels||[])].map(x=>x.innerText).join(' ').trim()||el.getAttribute('aria-label');
    const candidates=[normal(leaf),normal(label)];
    for(const [key,names] of Object.entries(answerFields)){
      if(!candidates.some(value=>names.includes(value)))continue;
      // A specific question overrides a generic field name (e.g. weekend availability).
      if(visibleLabel&&!names.includes(normal(visibleLabel)))continue;
      const value=snapshot.answers?.[key];
      if(typeof value!=='string'||!value.trim())return null;
      if(key.endsWith('_url')){
        try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;}catch{return null;}
      }
      return value.trim();
    }
    return null;
  }
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
    if(el.tagName==='SELECT'||!['text','email','tel','textarea','url'].includes(type)){if(el.required&&!['hidden','submit','button'].includes(type))skipped.push(label);continue;}
    const kind=fieldKind(el,label);const value=kind?values[kind]:confirmedAnswer(el,label);
    if(!value){if(el.required)skipped.push(label);continue;}
    if(el.value.trim()){skipped.push(label+' (kept existing value)');continue;}
    const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));filled.push(label);
  }
  return {filled,skipped};
}
