import asyncio,contextlib,json,secrets,re,hashlib,os
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal
from urllib.parse import urlsplit
import httpx
from fastapi import FastAPI,HTTPException,Request,Depends
from fastapi.responses import FileResponse,JSONResponse,RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field
from . import store,sources,gmail
from .engine import canonical_url,assess,draft_letter

PORT=int(os.environ.get('COMPASS_PORT','8123'))
ORIGIN=f'http://127.0.0.1:{PORT}'
ROOT=Path(__file__).resolve().parent.parent

async def scheduler():
    while True:
        app.state.scheduler_last_check=store.now()
        try:
            if store.setting('automation',True):
                await sources.sync()
                await gmail.sync()
        except Exception:
            store.event('Background check failed. Check source and Gmail connection status.')
        await asyncio.sleep(300)

@asynccontextmanager
async def lifespan(app):
    store.init();sources.init_sources()
    sources.reconcile_new_jobs()
    task=asyncio.create_task(scheduler())
    app.state.scheduler_task=task
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):await task

app=FastAPI(lifespan=lifespan,docs_url=None,redoc_url=None)

@app.middleware('http')
async def local_only(request,call_next):
    if request.headers.get('host','') not in (f'127.0.0.1:{PORT}',f'localhost:{PORT}','testserver'):
        return JSONResponse({'detail':'Local access only'},status_code=403)
    origin=request.headers.get('origin')
    ext=request.url.path.startswith('/api/companion/')
    allowed=origin in (ORIGIN,f'http://localhost:{PORT}','http://testserver')
    is_extension=bool(origin and re.fullmatch(r'chrome-extension://[a-p]{32}',origin))
    if origin and not allowed and not (ext and is_extension):return JSONResponse({'detail':'Origin not allowed'},status_code=403)
    if request.method=='OPTIONS' and ext and is_extension:
        return JSONResponse({},headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'})
    if request.method in ('POST','PUT','PATCH','DELETE') and not ext:
        if not allowed or not request.headers.get('content-type','').startswith('application/json'):
            return JSONResponse({'detail':'Same-origin JSON request required'},status_code=403)
    if request.method=='GET' and request.url.path.startswith('/api/') and not ext and request.headers.get('sec-fetch-site')=='cross-site':
        return JSONResponse({'detail':'Cross-site request blocked'},status_code=403)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['Cache-Control']='no-store'
    response.headers['Content-Security-Policy']="default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if ext and is_extension:response.headers['Access-Control-Allow-Origin']=origin;response.headers['Vary']='Origin'
    return response

def find_job(ident):
    rows=store.query('SELECT * FROM jobs WHERE id=?',(ident,))
    if not rows:raise HTTPException(404,'Job not found')
    return store.job_view(rows[0])

def auth_companion(request:Request):
    expected='Bearer '+store.setting('extension_token','')
    if not secrets.compare_digest(request.headers.get('authorization',''),expected):raise HTTPException(401,'Pair the companion from Settings first.')

class JobInput(BaseModel):
    title:str=Field(min_length=2,max_length=300)
    company:str=Field(min_length=1,max_length=200)
    location:str=Field(default='Not specified',max_length=300)
    description:str=Field(default='',max_length=60000)
    url:str=Field(max_length=3000)

class Profile(BaseModel):
    first_name:str=Field(min_length=1,max_length=100)
    last_name:str=Field(min_length=1,max_length=100)
    email:str=Field(max_length=200)
    phone:str=Field(max_length=60)
    location:str=Field(max_length=200)
    skills:list[str]=Field(max_length=50)
    support:bool=True

class DraftInput(BaseModel):
    text:str=Field(max_length=15000)
    cv:Literal['general-en','general-pt','developer-en','developer-pt']
    revision:int

class ReviewInput(BaseModel):revision:int
class StatusInput(BaseModel):status:Literal['saved','archived','applied'];confirm:bool=False
class SourceInput(BaseModel):
    name:str=Field(min_length=2,max_length=100)
    kind:Literal['greenhouse','lever','ashby']
    board:str=Field(pattern=r'^[A-Za-z0-9_-]{1,100}$')
class Toggle(BaseModel):enabled:bool
class GoogleClient(BaseModel):
    client_id:str=Field(min_length=10,max_length=300)
    client_secret:str=Field(min_length=5,max_length=300)
class ITJobsKey(BaseModel):
    key:str=Field(min_length=8,max_length=300)
class MessageReview(BaseModel):
    job_id:str|None=None
    apply_status:bool=False

ANSWER_KEYS={'right_to_work_portugal','visa_sponsorship','availability','salary_expectations','linkedin_url','github_url','portfolio_url'}
class AnswersInput(BaseModel):
    answers:dict[str,str]
    confirmed:bool=False

CV_NAMES={'general-en':'Miguel_Rocha_CV_General.pdf','general-pt':'Miguel_Rocha_CV_General_PT.pdf','developer-en':'Miguel_Rocha_CV_Junior_Developer.pdf','developer-pt':'Miguel_Rocha_CV_Junior_Developer_PT.pdf'}

@app.get('/api/health')
def health():
    task=getattr(app.state,'scheduler_task',None)
    return dict(service='running',scheduler_running=bool(task and not task.done()),scheduler_last_check=getattr(app.state,'scheduler_last_check',None),checks_enabled=bool(store.setting('automation',True)))

@app.get('/api/state')
def state():
    return dict(profile=store.setting('profile'),application_answers=store.setting('application_answers',{}),health=health(),jobs=[store.job_view(r) for r in store.query('SELECT * FROM jobs ORDER BY score DESC,created DESC')],sources=store.query('SELECT * FROM sources'),messages=store.query('SELECT * FROM messages WHERE reviewed!=2 ORDER BY received DESC LIMIT 300'),activity=store.query('SELECT * FROM activity ORDER BY id DESC LIMIT 12'),gmail=gmail.status(),itjobs={'configured':bool(store.setting('itjobs_key'))},automation=store.setting('automation'),cvs=[dict(id=k,name=v,available=(store.DATA/'cvs'/v).is_file()) for k,v in CV_NAMES.items()])

@app.post('/api/answers')
def save_answers(data:AnswersInput):
    if not data.confirmed:raise HTTPException(422,'Confirm these answers before saving.')
    if set(data.answers)-ANSWER_KEYS:raise HTTPException(422,'Unknown application answer.')
    answers={key:value.strip() for key,value in data.answers.items() if value.strip()}
    if any(len(value)>500 for value in answers.values()):raise HTTPException(422,'An answer is too long.')
    if answers==store.setting('application_answers',{}):return {'ok':True}
    with store.db() as c:
        c.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',('application_answers',json.dumps(answers)))
        c.execute("UPDATE jobs SET approval=NULL,status='draft',revision=revision+1 WHERE status='approved'")
    store.event('Confirmed application answers changed. Existing approvals cleared for review.')
    return {'ok':True}

@app.post('/api/profile')
def profile(data:Profile):
    if any(len(x)>70 for x in data.skills):raise HTTPException(422,'Skill names are too long')
    store.save('profile',data.model_dump())
    for j in store.query('SELECT * FROM jobs'):
        analysis=assess(j,data.model_dump())
        store.execute("UPDATE jobs SET analysis=?,score=?,approval=NULL,revision=revision+1,status=CASE WHEN status='approved' THEN 'draft' ELSE status END WHERE id=?",(json.dumps(analysis),analysis['score'],j['id']))
    sources.reconcile_new_jobs()
    store.event('Profile updated. Existing application approvals cleared for review.')
    return {'ok':True}

def import_job(data):
    try:canonical_url(data.url)
    except ValueError as e:raise HTTPException(422,str(e))
    ident,created=sources.upsert_job(dict(data.model_dump(),source='Brave / manual import'),manual=True)
    if created:store.event('Imported '+data.title)
    return dict(id=ident,created=created)

@app.post('/api/jobs')
def job_import(data:JobInput):return import_job(data)

@app.post('/api/jobs/{ident}/prepare')
def prepare(ident:str,language:Literal['en','pt']='en'):
    j=find_job(ident)
    if j['status'] in ('applied','interview','assessment','rejected'):raise HTTPException(409,'This application is already in progress.')
    cv=('general' if j['analysis']['category']=='support' else 'developer')+'-'+language
    text=draft_letter(j,store.setting('profile'),language)
    store.execute("UPDATE jobs SET draft=?,cv=?,status='draft',approval=NULL,revision=revision+1 WHERE id=?",(text,cv,ident))
    return find_job(ident)

@app.put('/api/jobs/{ident}/draft')
def save_draft(ident:str,data:DraftInput):
    j=find_job(ident)
    if j['status'] not in ('draft','approved'):raise HTTPException(409,'Prepare a draft first.')
    with store.db() as c:
        updated=c.execute("UPDATE jobs SET draft=?,cv=?,revision=revision+1,approval=NULL,status='draft' WHERE id=? AND revision=?",(data.text,data.cv,ident,data.revision)).rowcount
    if not updated:raise HTTPException(409,'Draft changed. Refresh before saving.')
    return find_job(ident)

@app.post('/api/jobs/{ident}/approve')
def approve(ident:str,data:ReviewInput):
    j=find_job(ident);p=store.setting('profile')
    if j['status']!='draft' or j['revision']!=data.revision or not j['draft']:raise HTTPException(409,'Review the latest saved draft first.')
    if not p.get('email'):raise HTTPException(422,'Add your email in Settings before approving.')
    if not (store.DATA/'cvs'/CV_NAMES.get(j['cv'],'missing')).is_file():raise HTTPException(422,'The selected CV file is not available.')
    digest=hashlib.sha256((store.DATA/'cvs'/CV_NAMES[j['cv']]).read_bytes()).hexdigest()
    snapshot=dict(profile=p,letter=j['draft'],cv=j['cv'],cv_hash=digest,revision=j['revision'],url=j['url'],at=store.now())
    with store.db() as c:
        updated=c.execute("UPDATE jobs SET approval=?,status='approved' WHERE id=? AND revision=? AND status='draft'",(json.dumps(snapshot),ident,data.revision)).rowcount
    if not updated:raise HTTPException(409,'The draft changed; review again.')
    store.event('Approved application materials for '+j['company']+'. Submission still requires your action.')
    return find_job(ident)

@app.post('/api/jobs/{ident}/status')
def change_status(ident:str,data:StatusInput):
    j=find_job(ident)
    if data.status=='applied' and (not data.confirm or j['status']!='approved'):raise HTTPException(409,'Approve the application, submit on the employer site, then confirm it here.')
    stamp=store.now() if data.status=='applied' else j.get('applied_at')
    store.execute('UPDATE jobs SET status=?,approval=NULL,applied_at=? WHERE id=?',(data.status,stamp,ident))
    store.event(f"{j['company']}: marked {data.status} by you.")
    return {'ok':True}

@app.post('/api/sync/jobs')
async def job_sync():return await sources.sync()
@app.post('/api/sync/gmail')
async def mail_sync():return await gmail.sync()
@app.post('/api/automation')
def automation(data:Toggle):store.save('automation',data.enabled);return {'ok':True}

@app.post('/api/sources')
def add_source(data:SourceInput):
    ident=data.kind+'-'+data.board.lower()
    host={'greenhouse':'https://job-boards.greenhouse.io/','lever':'https://jobs.lever.co/','ashby':'https://jobs.ashbyhq.com/'}[data.kind]
    store.execute('INSERT OR IGNORE INTO sources(id,name,kind,board,url) VALUES(?,?,?,?,?)',(ident,data.name,data.kind,data.board,host+data.board))
    return {'ok':True}
@app.post('/api/sources/{ident}/toggle')
def toggle_source(ident:str,data:Toggle):store.execute('UPDATE sources SET enabled=? WHERE id=?',(int(data.enabled),ident));return {'ok':True}

@app.post('/api/itjobs/key')
def save_itjobs_key(data:ITJobsKey):
    if len(data.key.strip())<8:raise HTTPException(422,'Enter a valid ITJobs API key.')
    store.save('itjobs_key',store.encrypt(data.key.strip()))
    store.execute("UPDATE sources SET kind='itjobs',enabled=1,last_attempt=NULL,error=NULL WHERE id='itjobs'")
    return {'ok':True}

@app.delete('/api/itjobs/key')
def remove_itjobs_key():
    store.save('itjobs_key',None)
    store.execute("UPDATE sources SET kind='browser',enabled=1,last_attempt=NULL,error=NULL,count=0 WHERE id='itjobs'")
    return {'ok':True}

@app.get('/api/pairing')
def pairing():return {'token':store.setting('extension_token')}
@app.post('/api/pairing/rotate')
def rotate():store.save('extension_token',secrets.token_urlsafe(32));return {'ok':True}

@app.post('/api/companion/import',dependencies=[Depends(auth_companion)])
def companion_import(data:JobInput):return import_job(data)
@app.get('/api/companion/approved',dependencies=[Depends(auth_companion)])
def approved_applications():return [dict(id=j['id'],title=j['title'],company=j['company'],url=j['url']) for j in store.query("SELECT * FROM jobs WHERE status='approved' AND approval IS NOT NULL")]
@app.get('/api/companion/application/{ident}',dependencies=[Depends(auth_companion)])
def companion_application(ident:str):
    j=find_job(ident)
    if j['status']!='approved' or not j['approval'] or j['approval']['revision']!=j['revision']:raise HTTPException(409,'This application needs a fresh review.')
    cv_path=store.DATA/'cvs'/CV_NAMES[j['approval']['cv']]
    if not cv_path.is_file() or hashlib.sha256(cv_path.read_bytes()).hexdigest()!=j['approval'].get('cv_hash'):raise HTTPException(409,'The CV file changed. Save and approve the application again.')
    return j['approval']

def cv_response(kind):
    if kind not in CV_NAMES:raise HTTPException(404,'CV not found')
    path=store.DATA/'cvs'/CV_NAMES[kind]
    if not path.is_file():raise HTTPException(404,'CV file missing')
    return FileResponse(path,filename=path.name,media_type='application/pdf')
@app.get('/api/cvs/{kind}')
def download_cv(kind:str):return cv_response(kind)
@app.get('/api/companion/cv/{ident}',dependencies=[Depends(auth_companion)])
def companion_cv(ident:str):return cv_response(companion_application(ident)['cv'])

@app.post('/api/gmail/client')
def google_client(data:GoogleClient):
    if store.setting('gmail_token'):raise HTTPException(409,'Disconnect Gmail before changing its OAuth client.')
    store.save('google_client',store.encrypt(dict(id=data.client_id,secret=data.client_secret)))
    return {'ok':True}
@app.post('/api/gmail/connect')
def google_connect():
    try:url,state=gmail.connect_url()
    except ValueError as e:raise HTTPException(422,str(e))
    response=JSONResponse({'url':url});response.set_cookie('gmail_oauth_state',state,max_age=600,httponly=True,samesite='lax');return response
@app.get('/oauth/gmail/callback')
async def callback(request:Request,code:str='',state:str='',error:str=''):
    if error:return RedirectResponse('/?gmail=cancelled')
    try:await gmail.finish(code,state,request.cookies.get('gmail_oauth_state'))
    except (ValueError,httpx.HTTPError,KeyError):return RedirectResponse('/?gmail=error')
    response=RedirectResponse('/?gmail=connected');response.delete_cookie('gmail_oauth_state');return response
@app.post('/api/gmail/disconnect')
async def disconnect():
    async with gmail.lock:
        saved=store.setting('gmail_token')
        if saved:
            token=store.decrypt(saved)
            try:
                async with httpx.AsyncClient(timeout=10) as h:await h.post('https://oauth2.googleapis.com/revoke',data={'token':token.get('refresh_token','')})
            except httpx.HTTPError:pass
        for key in ('gmail_token','gmail_account','gmail_history','gmail_pending','gmail_sync','gmail_error','oauth_pending'):store.save(key,None)
    return {'ok':True}

@app.post('/api/messages/{ident}/review')
def review_message(ident:str,data:MessageReview):
    rows=store.query('SELECT * FROM messages WHERE id=?',(ident,))
    if not rows:raise HTTPException(404,'Message not found')
    m=rows[0]
    if data.job_id:find_job(data.job_id)
    if data.apply_status:
        if not data.job_id:raise HTTPException(422,'Select an application first.')
        status={'interview':'interview','assessment':'assessment','rejection':'rejected'}.get(m['kind'])
        if status:store.execute('UPDATE jobs SET status=?,approval=NULL WHERE id=?',(status,data.job_id))
    store.execute('UPDATE messages SET job_id=?,reviewed=1 WHERE id=?',(data.job_id,ident))
    return {'ok':True}

@app.post('/api/messages/{ident}/dismiss')
def dismiss_message(ident:str):
    if not store.query('SELECT id FROM messages WHERE id=?',(ident,)):
        raise HTTPException(404,'Message not found')
    store.execute('UPDATE messages SET reviewed=2 WHERE id=?',(ident,))
    return {'ok':True}

app.mount('/static',StaticFiles(directory=ROOT/'web'),name='static')
@app.get('/')
def index():return FileResponse(ROOT/'web/index.html')
