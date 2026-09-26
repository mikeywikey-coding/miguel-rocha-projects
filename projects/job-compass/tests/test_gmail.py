import asyncio,base64,time
import httpx
from app import store,gmail

def setup(tmp_path,monkeypatch):
    monkeypatch.setattr(store,'DATA',tmp_path);store.init()
    store.save('gmail_token',store.encrypt({'access_token':'test-access','refresh_token':'test-refresh','expires_at':time.time()+3600}))
    store.save('gmail_account','test@example.com')

def message(ident='m1'):
    body=base64.urlsafe_b64encode(b'We would like to invite you to an interview.').decode()
    return {'id':ident,'threadId':'t1','labelIds':['INBOX'],'internalDate':'1700000000000','payload':{'mimeType':'text/plain','headers':[{'name':'Subject','value':'Interview invitation'},{'name':'From','value':'recruiter@example.com'}],'body':{'data':body}}}

def test_initial_sync_read_only_and_deduplicated(tmp_path,monkeypatch):
    setup(tmp_path,monkeypatch);seen=[];Original=httpx.AsyncClient
    def handler(request):
        seen.append(request)
        assert request.method=='GET'
        path=request.url.path
        if path.endswith('/profile'):return httpx.Response(200,json={'historyId':'20'})
        if path.endswith('/history'):return httpx.Response(200,json={'historyId':'21','history':[{'messagesAdded':[{'message':{'id':'m1'}}]}]})
        if path.endswith('/messages'):return httpx.Response(200,json={'messages':[{'id':'m1'}]})
        return httpx.Response(200,json=message())
    monkeypatch.setattr(gmail.httpx,'AsyncClient',lambda **kw:Original(transport=httpx.MockTransport(handler),**kw))
    async def check():
        assert (await gmail.sync())['added']==1
        assert (await gmail.sync())['added']==0
    asyncio.run(check())
    rows=store.query('SELECT * FROM messages')
    assert len(rows)==1 and rows[0]['kind']=='interview' and rows[0]['job_id'] is None
    assert store.setting('gmail_history')=='21' and store.setting('gmail_error') is None

def test_expired_cursor_requests_resync(tmp_path,monkeypatch):
    setup(tmp_path,monkeypatch);store.save('gmail_history','expired');Original=httpx.AsyncClient
    def handler(request):
        if request.url.path.endswith('/profile'):return httpx.Response(200,json={'historyId':'20'})
        return httpx.Response(404,json={})
    monkeypatch.setattr(gmail.httpx,'AsyncClient',lambda **kw:Original(transport=httpx.MockTransport(handler),**kw))
    result=asyncio.run(gmail.sync())
    assert result['resync'] and store.setting('gmail_history') is None

def test_failed_page_does_not_advance_cursor(tmp_path,monkeypatch):
    setup(tmp_path,monkeypatch);store.save('gmail_history','10');Original=httpx.AsyncClient
    def handler(request):
        if request.url.path.endswith('/profile'):return httpx.Response(200,json={'historyId':'20'})
        if request.url.path.endswith('/history'):return httpx.Response(200,json={'historyId':'20','history':[{'messagesAdded':[{'message':{'id':'m1'}}]}]})
        return httpx.Response(503,json={})
    monkeypatch.setattr(gmail.httpx,'AsyncClient',lambda **kw:Original(transport=httpx.MockTransport(handler),**kw))
    assert 'error' in asyncio.run(gmail.sync())
    assert store.setting('gmail_history')=='10'
