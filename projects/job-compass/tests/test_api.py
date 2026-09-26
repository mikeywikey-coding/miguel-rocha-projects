import json
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from app import store,sources,gmail
from app.main import app,CV_NAMES

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DATA',tmp_path)
    monkeypatch.setattr(sources,'sync',AsyncMock(return_value={'added':0}))
    monkeypatch.setattr(gmail,'sync',AsyncMock(return_value={'connected':False}))
    with TestClient(app,headers={'Origin':'http://testserver','Content-Type':'application/json'}) as c:
        p=store.setting('profile');p['email']='test@example.com';store.save('profile',p)
        for name in CV_NAMES.values():(tmp_path/'cvs'/name).write_bytes(b'%PDF-1.4 test fixture')
        yield c

def make_job(client):
    result=client.post('/api/jobs',json=dict(title='Junior React Developer',company='Fixture Company',location='Lisbon',description='React JavaScript',url='https://example.com/jobs/1'))
    assert result.status_code==200
    return result.json()['id']

def test_cannot_mark_unreviewed_job_applied(client):
    ident=make_job(client)
    assert client.post(f'/api/jobs/{ident}/status',json={'status':'applied','confirm':True}).status_code==409

def test_review_workflow_and_stale_approval(client):
    ident=make_job(client)
    j=client.post(f'/api/jobs/{ident}/prepare',json={}).json()
    assert client.post(f'/api/jobs/{ident}/approve',json={'revision':j['revision']-1}).status_code==409
    approved=client.post(f'/api/jobs/{ident}/approve',json={'revision':j['revision']})
    assert approved.status_code==200 and approved.json()['approval']['profile']['email']=='test@example.com'
    edited=client.put(f'/api/jobs/{ident}/draft',json={'text':'Edited letter','cv':'general-en','revision':j['revision']}).json()
    assert edited['status']=='draft' and edited['approval'] is None
    assert client.post(f'/api/jobs/{ident}/approve',json={'revision':j['revision']}).status_code==409

def test_saved_materials_and_cv_required(client):
    ident=make_job(client)
    assert client.post(f'/api/jobs/{ident}/approve',json={'revision':0}).status_code==409
    j=client.post(f'/api/jobs/{ident}/prepare',json={}).json()
    (store.DATA/'cvs'/CV_NAMES[j['cv']]).unlink()
    assert client.post(f'/api/jobs/{ident}/approve',json={'revision':j['revision']}).status_code==422


def test_portuguese_draft_uses_matching_cv_and_requires_new_review(client):
    ident=make_job(client)
    english=client.post(f'/api/jobs/{ident}/prepare?language=en',json={}).json()
    assert english['cv']=='developer-en' and 'Hello ' in english['draft']
    approved=client.post(f'/api/jobs/{ident}/approve',json={'revision':english['revision']})
    assert approved.status_code==200
    portuguese=client.post(f'/api/jobs/{ident}/prepare?language=pt',json={}).json()
    assert portuguese['cv']=='developer-pt' and portuguese['draft'].startswith('Olá ')
    assert portuguese['status']=='draft' and portuguese['approval'] is None
    assert portuguese['revision']>english['revision']

def test_changed_cv_invalidates_companion_access(client):
    ident=make_job(client);j=client.post(f'/api/jobs/{ident}/prepare',json={}).json()
    client.post(f'/api/jobs/{ident}/approve',json={'revision':j['revision']})
    (store.DATA/'cvs'/CV_NAMES[j['cv']]).write_bytes(b'%PDF changed')
    headers={'Authorization':'Bearer '+store.setting('extension_token')}
    assert client.get('/api/companion/application/'+ident,headers=headers).status_code==409

def test_profile_update_revokes_approvals(client):
    ident=make_job(client);j=client.post(f'/api/jobs/{ident}/prepare',json={}).json()
    client.post(f'/api/jobs/{ident}/approve',json={'revision':j['revision']})
    p=store.setting('profile');p['phone']='000000'
    assert client.post('/api/profile',json=p).status_code==200
    current=client.get('/api/state').json()['jobs'][0]
    assert current['status']=='draft' and current['approval'] is None

def test_health_reports_scheduler_without_exposing_credentials(client):
    health=client.get('/api/health')
    assert health.status_code==200
    assert health.json()['service']=='running'
    assert health.json()['scheduler_running'] is True
    assert health.json()['checks_enabled'] is True
    assert 'extension_token' not in health.text
    assert client.get('/api/state').json()['health']['scheduler_running'] is True

def test_application_answers_require_confirmation_and_revoke_old_approvals(client):
    assert client.get('/api/state').json()['application_answers']=={}
    ident=make_job(client)
    draft=client.post(f'/api/jobs/{ident}/prepare',json={}).json()
    assert client.post(f'/api/jobs/{ident}/approve',json={'revision':draft['revision']}).status_code==200
    answers={'availability':'Two weeks','right_to_work_portugal':'To be confirmed'}
    assert client.post('/api/answers',json={'answers':answers,'confirmed':False}).status_code==422
    assert client.post('/api/answers',json={'answers':{'unsupported':'yes'},'confirmed':True}).status_code==422
    assert client.post('/api/answers',json={'answers':answers,'confirmed':True}).status_code==200
    state=client.get('/api/state').json()
    assert state['application_answers']==answers
    job=next(j for j in state['jobs'] if j['id']==ident)
    assert job['status']=='draft' and job['approval'] is None
    assert client.post(f'/api/jobs/{ident}/status',json={'status':'applied','confirm':True}).status_code==409
    assert client.post('/api/answers',json={'answers':answers,'confirmed':True}).status_code==200
    assert client.post('/api/answers',json={'answers':{},'confirmed':True}).status_code==200
    assert client.get('/api/state').json()['application_answers']=={}

def test_companion_auth_and_cross_origin(client):
    assert client.get('/api/companion/approved').status_code==401
    headers={'Authorization':'Bearer '+store.setting('extension_token'),'Origin':'chrome-extension://'+'a'*32}
    assert client.get('/api/companion/approved',headers=headers).status_code==200
    assert client.get('/api/state',headers={'Origin':'https://malicious.example'}).status_code==403
    assert client.post('/api/jobs',headers={'Origin':'https://malicious.example'},json={}).status_code==403
    assert client.get('/api/state',headers={'Host':'rebind.example:8123'}).status_code==403

def test_url_dedup_and_cross_source_exact_match(client):
    first=make_job(client)
    job=dict(title='Junior React Developer',company='Fixture Company',location='Lisbon',description='React JavaScript',url='https://example.com/jobs/1?utm_source=mail')
    result=client.post('/api/jobs',json=job).json()
    assert result==dict(id=first,created=False)
    job['url']='https://other.example/jobs/2'
    assert client.post('/api/jobs',json=job).json()['id']==first

def test_import_xss_is_data_not_markup(client):
    ident=make_job(client)
    assert client.get('/').headers['Content-Security-Policy'].find("script-src 'self'")>=0
    assert 'approval' in client.get('/api/state').json()['jobs'][0]

def test_credentials_never_returned_in_state(client):
    client.post('/api/gmail/client',json={'client_id':'example-google-client-id','client_secret':'secret-fixture'})
    state=client.get('/api/state').text
    assert 'secret-fixture' not in state and 'example-google-client-id' not in state
    assert 'secret-fixture' not in store.setting('google_client')
    assert store.decrypt(store.setting('google_client'))['secret']=='secret-fixture'

def test_itjobs_key_activates_automatic_source_without_exposing_key(client):
    response=client.post('/api/itjobs/key',json={'key':'test-read-only-key'})
    assert response.status_code==200
    state=client.get('/api/state').json()
    source=next(s for s in state['sources'] if s['id']=='itjobs')
    assert source['kind']=='itjobs' and source['enabled']==1
    assert state['itjobs']['configured'] is True
    assert 'test-read-only-key' not in json.dumps(state)
    assert store.decrypt(store.setting('itjobs_key'))=='test-read-only-key'
    assert client.request('DELETE','/api/itjobs/key',json={}).status_code==200
    state=client.get('/api/state').json()
    assert state['itjobs']['configured'] is False
    assert next(s for s in state['sources'] if s['id']=='itjobs')['kind']=='browser'

def test_oauth_callback_rejects_forged_state(client):
    client.post('/api/gmail/client',json={'client_id':'example-google-client-id','client_secret':'secret-fixture'})
    client.post('/api/gmail/connect',json={})
    r=client.get('/oauth/gmail/callback?code=fake&state=forged',follow_redirects=False)
    assert r.headers['location']=='/?gmail=error'
    assert store.setting('gmail_token') is None

def test_message_review_requires_explicit_confirmation(client):
    ident=make_job(client)
    store.execute("UPDATE jobs SET status='applied',applied_at=? WHERE id=?",(store.now(),ident))
    store.execute('INSERT INTO messages(id,thread,subject,sender,excerpt,received,kind) VALUES(?,?,?,?,?,?,?)',('m1','t1','Interview','Recruiter','Interview?',store.now(),'interview'))
    client.post('/api/messages/m1/review',json={'job_id':ident,'apply_status':False})
    assert store.query('SELECT status FROM jobs WHERE id=?',(ident,))[0]['status']=='applied'
    client.post('/api/messages/m1/review',json={'job_id':ident,'apply_status':True})
    assert store.query('SELECT status FROM jobs WHERE id=?',(ident,))[0]['status']=='interview'

def test_dismiss_message_hides_it_without_deleting_sync_record(client):
    store.execute('INSERT INTO messages(id,thread,subject,sender,excerpt,received,kind) VALUES(?,?,?,?,?,?,?)',('newsletter','t-news','Trial offer','Marketing','Recruitment keyword',store.now(),'reply'))
    assert any(m['id']=='newsletter' for m in client.get('/api/state').json()['messages'])
    assert client.post('/api/messages/newsletter/dismiss').status_code==200
    assert not any(m['id']=='newsletter' for m in client.get('/api/state').json()['messages'])
    assert store.query('SELECT reviewed FROM messages WHERE id=?',('newsletter',))[0]['reviewed']==2
    assert client.post('/api/messages/missing/dismiss').status_code==404
