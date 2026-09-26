import asyncio,base64,hashlib,secrets,time,re
from urllib.parse import urlencode
from datetime import datetime,timezone
import httpx
from . import store
from .engine import plain,classify_reply,match_message

REDIRECT='http://127.0.0.1:8123/oauth/gmail/callback'
SCOPE='https://www.googleapis.com/auth/gmail.readonly'
lock=asyncio.Lock()

def status():
    return dict(configured=bool(store.setting('google_client')),connected=bool(store.setting('gmail_token')),account=store.setting('gmail_account',''),last_sync=store.setting('gmail_sync'),error=store.setting('gmail_error'),redirect=REDIRECT)

def connect_url():
    saved=store.setting('google_client')
    if not saved:raise ValueError('Save your Google OAuth client in Settings first.')
    client=store.decrypt(saved);state=secrets.token_urlsafe(32);verifier=secrets.token_urlsafe(48)
    store.save('oauth_pending',store.encrypt(dict(state=state,verifier=verifier,at=time.time())))
    challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    return 'https://accounts.google.com/o/oauth2/v2/auth?'+urlencode(dict(client_id=client['id'],redirect_uri=REDIRECT,response_type='code',scope=SCOPE,access_type='offline',prompt='consent',state=state,code_challenge=challenge,code_challenge_method='S256')),state

async def finish(code,state,cookie):
    saved=store.setting('oauth_pending')
    if not saved:raise ValueError('This connection request has expired. Try connecting again.')
    pending=store.decrypt(saved)
    if time.time()-pending['at']>600 or not secrets.compare_digest(pending['state'],state) or not secrets.compare_digest(state,cookie or ''):raise ValueError('Invalid or expired Google connection request.')
    store.save('oauth_pending',None)
    client=store.decrypt(store.setting('google_client'))
    async with httpx.AsyncClient(timeout=30) as http:
        response=await http.post('https://oauth2.googleapis.com/token',data=dict(client_id=client['id'],client_secret=client['secret'],redirect_uri=REDIRECT,grant_type='authorization_code',code=code,code_verifier=pending['verifier']))
        response.raise_for_status();token=response.json()
        if SCOPE not in token.get('scope','').split():raise ValueError('Gmail read permission was not granted.')
        if not token.get('refresh_token'):raise ValueError('Google did not grant background access. Reconnect with consent.')
        response=await http.get('https://gmail.googleapis.com/gmail/v1/users/me/profile',headers={'Authorization':'Bearer '+token['access_token']})
        response.raise_for_status();profile=response.json()
    token['expires_at']=time.time()+token.get('expires_in',3600)
    store.save('gmail_token',store.encrypt(token));store.save('gmail_account',profile['emailAddress'])
    store.save('gmail_history',None);store.save('gmail_pending',None);store.save('gmail_error',None)
    store.event('Gmail connected with read-only access.')

async def access_token(http):
    saved=store.setting('gmail_token')
    if not saved:raise ValueError('Connect Gmail first.')
    token=store.decrypt(saved)
    if token.get('expires_at',0)<time.time()+60:
        client=store.decrypt(store.setting('google_client'))
        response=await http.post('https://oauth2.googleapis.com/token',data=dict(client_id=client['id'],client_secret=client['secret'],grant_type='refresh_token',refresh_token=token['refresh_token']))
        response.raise_for_status();new=response.json();token.update(new);token['expires_at']=time.time()+new.get('expires_in',3600)
        store.save('gmail_token',store.encrypt(token))
    return token['access_token']

def text_parts(payload):
    if payload.get('mimeType') in ('text/plain','text/html') and payload.get('body',{}).get('data'):
        raw=payload['body']['data'];return plain(base64.urlsafe_b64decode(raw+'='*(-len(raw)%4)).decode('utf-8',errors='replace'))
    children=payload.get('parts',[])
    preferred=[p for p in children if p.get('mimeType')=='text/plain'] or children
    return ' '.join(text_parts(p) for p in preferred)[:24000]

async def sync():
    if not store.setting('gmail_token'):return {'connected':False,'added':0}
    if lock.locked():return {'busy':True}
    async with lock:
        added=0
        try:
            async with httpx.AsyncClient(timeout=30) as http:
                token=await access_token(http);headers={'Authorization':'Bearer '+token};base='https://gmail.googleapis.com/gmail/v1/users/me/'
                async def get(path,params=None):
                    r=await http.get(base+path,headers=headers,params=params);r.raise_for_status();return r.json()
                pending=store.setting('gmail_pending')
                cursor=store.setting('gmail_history')
                if not pending:
                    baseline=(await get('profile'))['historyId']
                    pending=dict(mode='history' if cursor else 'initial',start=cursor,baseline=baseline,page=None)
                    store.save('gmail_pending',pending)
                jobs=store.query("SELECT * FROM jobs WHERE status IN ('applied','interview','assessment')")
                for _ in range(5):
                    params={'maxResults':100}
                    if pending['page']:params['pageToken']=pending['page']
                    if pending['mode']=='initial':
                        params['q']='newer_than:30d -in:spam -in:trash {application interview assessment recruiter recruitment candidatura entrevista recrutamento}'
                        page=await get('messages',params);ids=[m['id'] for m in page.get('messages',[])]
                    else:
                        params.update(startHistoryId=pending['start'],historyTypes='messageAdded')
                        try:page=await get('history',params)
                        except httpx.HTTPStatusError as exc:
                            if exc.response.status_code==404:
                                store.save('gmail_history',None);store.save('gmail_pending',None);store.save('gmail_error','History expired; a recent-message resync will run on the next check.');return {'resync':True}
                            raise
                        ids=list(dict.fromkeys(m['message']['id'] for h in page.get('history',[]) for m in h.get('messagesAdded',[])))
                    for ident in ids:
                        if store.query('SELECT id FROM messages WHERE id=?',(ident,)):continue
                        message=await get('messages/'+ident,{'format':'full'})
                        if set(message.get('labelIds',[]))&{'SENT','DRAFT','TRASH','SPAM'}:continue
                        payload=message.get('payload',{});h={x['name'].lower():x['value'] for x in payload.get('headers',[])}
                        subject=h.get('subject','(No subject)');body=text_parts(payload) or plain(message.get('snippet',''))
                        known=store.query('SELECT DISTINCT job_id FROM messages WHERE thread=? AND job_id IS NOT NULL',(message['threadId'],))
                        job_id=known[0]['job_id'] if len(known)==1 else match_message(subject,body,jobs)
                        if not job_id and not re.search(r'application|interview|recruit|assessment|candidatura|entrevista|recrutamento',subject+' '+body,re.I):continue
                        kind=classify_reply(subject,body)
                        received=datetime.fromtimestamp(int(message.get('internalDate',0))/1000,timezone.utc).isoformat()
                        store.execute('INSERT OR IGNORE INTO messages(id,thread,subject,sender,excerpt,received,kind,job_id) VALUES(?,?,?,?,?,?,?,?)',(ident,message['threadId'],subject[:500],h.get('from','')[:500],body[:3000],received,kind,job_id))
                        # Classification is a suggestion. User confirms interview/rejection changes.
                        added+=1
                    pending['page']=page.get('nextPageToken')
                    if not pending['page']:
                        store.save('gmail_history',page.get('historyId',pending['baseline']));store.save('gmail_pending',None);break
                    store.save('gmail_pending',pending)
            store.save('gmail_sync',store.now());store.save('gmail_error',None)
            if added:store.event(f'Gmail found {added} recruitment messages to review.')
            return {'added':added,'connected':True,'more':bool(store.setting('gmail_pending'))}
        except (httpx.HTTPError,ValueError,KeyError) as exc:
            error='Google connection needs attention. Reconnect if access has expired.' if isinstance(exc,httpx.HTTPStatusError) and exc.response.status_code in (400,401,403) else 'Gmail sync failed; will retry without losing the saved position.'
            store.save('gmail_error',error)
            return {'added':added,'error':error}
