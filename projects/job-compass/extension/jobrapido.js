function extractJobrapido() {
  if (location.origin !== 'https://pt.jobrapido.com' || location.pathname !== '/') return {error:'blocked'};
  if (/security check|just a moment|verify you are human|verifique.*humano/i.test(document.title)) return {error:'blocked'};
  const jobs = [];
  for (const link of document.querySelectorAll('a.result-item__link')) {
    const url = new URL(link.href);
    if (url.origin !== 'https://open.app.jobrapido.com' || !/^\/pt\/\d{1,20}\/$/.test(url.pathname)) continue;
    const card = link.closest('.result-item__wrapper');
    const read = selector => card?.querySelector(selector)?.textContent.trim() || '';
    const title = read('.result-item__title'), company = read('.result-item__company-label');
    if (!title || !company) continue;
    jobs.push({title:title.slice(0,300),company:company.slice(0,200),
      location:read('.result-item__location-label').slice(0,300) || 'Not specified',
      description:'',url:url.origin+url.pathname});
  }
  return jobs.length ? {jobs:jobs.slice(0,30)} : {error:'unreadable'};
}
const jobrapidoTick = registerDiscovery({id:'jobrapido',label:'Jobrapido',origin:'https://pt.jobrapido.com',
  searches:[['junior developer','lisboa'],['estágio informática','lisboa'],
    ['technical support','lisboa'],['junior developer remote','Portugal']]
    .map(([w,l])=>'https://pt.jobrapido.com/?w='+encodeURIComponent(w)+'&l='+encodeURIComponent(l)+'&r=auto'),
  keys:['w','l'],extract:extractJobrapido});
