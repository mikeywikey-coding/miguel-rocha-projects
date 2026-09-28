import asyncio, json, re, uuid
from datetime import datetime,timezone
import httpx
from . import store
from .engine import plain,canonical_url,assess,fold
from .public_sources import URLS, fetch_public, SourceReadError

SEEDS=[
 ('remotive','Remotive','remotive','','https://remotive.com/remote-jobs'),
 ('dashlane','Dashlane · Greenhouse','greenhouse','dashlane','https://job-boards.greenhouse.io/dashlane'),
 ('pipedrive','Pipedrive · Lever','lever','pipedrive','https://jobs.lever.co/pipedrive'),
 ('emma','Emma · Lever','lever','emma-sleep','https://jobs.lever.co/emma-sleep'),
 ('cargo','cargo.one · Ashby','ashby','cargo-one','https://jobs.ashbyhq.com/cargo-one'),
 ('bounce','Bounce · Ashby','ashby','Bounce','https://jobs.ashbyhq.com/Bounce'),
 ('linkedin','LinkedIn Jobs','browser','','https://www.linkedin.com/jobs/search/?keywords=junior%20developer&location=Lisbon%2C%20Portugal'),
 ('indeed','Indeed Portugal','browser','','https://pt.indeed.com/jobs?q=junior+developer&l=Lisboa'),
 ('netempregos','Net-Empregos','browser','','https://www.net-empregos.com/'),
 ('itjobs','ITJobs','browser','','https://www.itjobs.pt/'),
 ('landing','Landing.Jobs','browser','','https://landing.jobs/'),
 ('sapo','SAPO Emprego','browser','','https://emprego.sapo.pt/'),
 ('iefp','IEFP Online','browser','','https://iefponline.iefp.pt/'),
 ('teamlyzer','Teamlyzer','browser','','https://pt.teamlyzer.com/companies/jobs?address=lisboa'),
 ('expresso','Expresso Emprego','browser','','https://expressoemprego.pt/'),
 ('jooble','Jooble Portugal','browser','','https://pt.jooble.org/'),
 ('jobrapido','Jobrapido Portugal','browser','','https://pt.jobrapido.com/'),
 ('portalemprego','Portal Emprego','browser','','https://www.portalemprego.pt/'),
 ('randstad','Randstad Portugal','browser','','https://www.randstad.pt/empregos/'),
 ('adecco','Adecco Portugal','browser','','https://www.adecco.com/pt-pt'),
]

def init_sources():
    for s in SEEDS:store.execute('INSERT OR IGNORE INTO sources(id,name,kind,board,url) VALUES(?,?,?,?,?)',s)
    for ident in URLS:
        store.execute("UPDATE sources SET kind='public',last_attempt=NULL,error=NULL WHERE id=? AND kind='browser'", (ident,))

def reconcile_new_jobs():
    """Refresh unreviewed matches after rule changes without touching user work."""
    profile=store.setting('profile')
    checked=archived=updated=0
    with store.db() as connection:
        for row in connection.execute("SELECT * FROM jobs WHERE status='new'").fetchall():
            checked+=1
            analysis=assess(dict(row),profile)
            new_status='new' if analysis['eligible'] else 'archived'
            if row['score']==analysis['score'] and json.loads(row['analysis'])==analysis and row['status']==new_status:
                continue
            connection.execute('UPDATE jobs SET score=?,analysis=?,status=? WHERE id=?',
                               (analysis['score'],json.dumps(analysis),new_status,row['id']))
            updated+=1
            archived+=int(new_status=='archived')
    if updated:store.event(f'Match rules refreshed {updated} new jobs; archived {archived} outside the current target.')
    return dict(checked=checked,archived=archived,updated=updated)

async def fetch_source(source,client):
    kind=source['kind']; board=source['board']; name=source['name'].split(' · ')[0]
    if kind=='public':return await fetch_public(source,client)
    if not re.fullmatch(r'[A-Za-z0-9_-]{0,100}',board):raise ValueError('Invalid company board identifier')
    if kind=='itjobs':
        saved=store.setting('itjobs_key')
        if not saved:raise ValueError('ITJobs API key is missing')
        result=[];seen=set();key=store.decrypt(saved)
        for query in ('junior','estágio','trainee'):
            response=await client.get('https://api.itjobs.pt/job/search.json',params={'api_key':key,'q':query,'limit':100,'page':1})
            response.raise_for_status();data=response.json()
            if 'error' in data:raise ValueError('ITJobs API rejected the request')
            for r in data.get('results',[]):
                if not r.get('id') or not r.get('title') or r['id'] in seen:continue
                seen.add(r['id']);company=r.get('company') or {}
                locations=', '.join(plain(x.get('name','')) for x in r.get('locations',[]) if x.get('name'))
                model={0:'On-site',1:'Remote',2:'Hybrid'}.get(int(r.get('workModel',0)),'')
                location=' · '.join(x for x in (locations or 'Portugal',model) if x)
                if model=='Remote':location='Remote · Portugal · '+locations if locations else 'Remote · Portugal'
                slug=str(r.get('slug') or '').strip('/')
                link=f"https://www.itjobs.pt/oferta/{r['id']}"+(f'/{slug}' if slug else '')
                result.append(dict(title=plain(r['title']),company=plain(company.get('name','ITJobs employer')),location=location,description=plain(r.get('body',''))[:60000],url=canonical_url(link),source=source['name'],posted=r.get('publishedAt','')))
        return result
    if kind=='remotive':url='https://remotive.com/api/remote-jobs'
    elif kind=='greenhouse':url=f'https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true'
    elif kind=='lever':url=f'https://api.lever.co/v0/postings/{board}?mode=json&limit=1000'
    elif kind=='ashby':url=f'https://api.ashbyhq.com/posting-api/job-board/{board}'
    else:return []
    response=await client.get(url)
    response.raise_for_status(); data=response.json(); result=[]
    rows=data if kind=='lever' else data.get('jobs',[])
    for r in rows:
        if kind=='remotive':
            title=r['title']; company=r['company_name']; location='Remote · '+r.get('candidate_required_location',''); description=r.get('description',''); link=r['url']; posted=r.get('publication_date','')
        elif kind=='greenhouse':
            if r.get('internal_job_id') is None:continue
            title=r['title'];company=name;location=r.get('location',{}).get('name','');description=r.get('content','');link=r['absolute_url'];posted=r.get('updated_at','')
        elif kind=='lever':
            title=r['text'];company=name;location=r.get('categories',{}).get('location','');description=r.get('descriptionPlain','')+' '+plain(r.get('description',''))+' '+' '.join(plain(x.get('content','')) for x in r.get('lists',[]));link=r['hostedUrl'];posted=datetime.fromtimestamp(r.get('createdAt',0)/1000,timezone.utc).isoformat()
            if r.get('workplaceType')=='remote':location='Remote · '+location
        else:
            if not r.get('isListed',True):continue
            title=r['title'];company=name;location=r.get('location','');description=r.get('descriptionPlain','') or plain(r.get('descriptionHtml',''));link=r.get('jobUrl','');posted=r.get('publishedAt','')
            if r.get('isRemote'):location='Remote · '+location
        try:link=canonical_url(link)
        except ValueError:continue
        result.append(dict(title=plain(title),company=plain(company),location=plain(location),description=plain(description)[:60000],url=link,source=source['name'],posted=posted))
    return result

def upsert_job(job,manual=False):
    profile=store.setting('profile'); analysis=assess(job,profile)
    url=canonical_url(job['url']); stamp=store.now()
    existing=store.query('SELECT * FROM jobs WHERE url=?',(url,))
    if not existing:
        # Merge only exact company/title/location matches. Retain the first application URL.
        existing=[r for r in store.query('SELECT * FROM jobs WHERE lower(company)=lower(?)',(job['company'],)) if fold(r['title'])==fold(job['title']) and fold(r['location'])==fold(job['location'])]
    if existing:
        row=existing[0]
        if row['status'] in ('new','saved','draft') and row['url']==url:
            changed=any(row[k]!=job.get(k,'') for k in ('title','company','location','description'))
            store.execute('UPDATE jobs SET title=?,company=?,location=?,description=?,score=?,analysis=?,seen=?,revision=revision+?,approval=NULL WHERE id=?',(job['title'],job['company'],job['location'],job['description'],analysis['score'],json.dumps(analysis),stamp,int(changed),row['id']))
        else:store.execute('UPDATE jobs SET seen=? WHERE id=?',(stamp,row['id']))
        return row['id'],False
    if not analysis['eligible'] and not manual:return None,False
    ident=uuid.uuid4().hex
    store.execute('INSERT INTO jobs(id,url,title,company,location,description,source,posted,created,seen,score,analysis) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(ident,url,job['title'],job['company'],job['location'],job['description'],job['source'],job.get('posted',''),stamp,stamp,analysis['score'],json.dumps(analysis)))
    return ident,True

sync_lock=asyncio.Lock()

async def sync():
    if sync_lock.locked():return {'busy':True,'added':0}
    async with sync_lock:
        added=0; fetched=0; failures=[]; checked=0
        async with httpx.AsyncClient(timeout=35,follow_redirects=False,headers={'User-Agent':'JobCompass/0.1 personal-job-search'}) as client:
            for source in store.query("SELECT * FROM sources WHERE enabled=1 AND kind NOT IN ('browser','companion')"):
                if source['last_attempt'] and (datetime.now(timezone.utc)-datetime.fromisoformat(source['last_attempt'])).total_seconds()<21600:continue
                checked+=1;store.execute('UPDATE sources SET last_attempt=? WHERE id=?',(store.now(),source['id']))
                try:
                    jobs=await fetch_source(source,client);fetched+=len(jobs)
                    for job in jobs:
                        _,new=upsert_job(job);added+=int(new)
                    store.execute('UPDATE sources SET last_success=?,error=NULL,count=? WHERE id=?',(store.now(),len(jobs),source['id']))
                except (httpx.HTTPError,ValueError,KeyError,TypeError) as exc:
                    error=str(exc) if isinstance(exc,SourceReadError) else 'HTTP '+str(exc.response.status_code) if isinstance(exc,httpx.HTTPStatusError) else type(exc).__name__+': source could not be read'
                    store.execute('UPDATE sources SET error=? WHERE id=?',(error,source['id']));failures.append(source['name'])
        if checked:store.event(f'Discovery checked {fetched} listings; added {added} matches. {len(failures)} source errors.')
        return dict(added=added,fetched=fetched,failures=failures,checked=checked,cooldown=checked==0)
