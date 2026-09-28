"""Exercise the real extension worker against an intercepted employer fixture."""
from pathlib import Path
import json
import shutil
import tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='compass-queue-', ignore_cleanup_errors=True) as temp:
    extension = Path(temp) / 'extension'
    shutil.copytree(ROOT / 'extension', extension)
    manifest_path = extension / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    # In this isolated profile only, model the user's optional site-access grant.
    manifest['host_permissions'] += manifest.pop('optional_host_permissions')
    manifest_path.write_text(json.dumps(manifest))
    with sync_playwright() as pw:
        browser = pw.chromium.launch_persistent_context(
            str(Path(temp) / 'profile'), headless=True,
            executable_path='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
            ignore_default_args=['--disable-extensions'],
            args=['--host-resolver-rules=MAP jobs.lever.co ~NOTFOUND', f'--disable-extensions-except={extension}', f'--load-extension={extension}'])
        browser.set_default_timeout(8000)
        job_url = 'https://jobs.lever.co/fixture/queue-job'
        fixture = '''<form onsubmit="window.submitted++;return false">
        <label>First name<input name="first_name"></label>
        <label>Last name<input name="last_name"></label>
        <label>Email<input name="email"></label>
        <label>Resume<input name="resume" type="file"></label>
        <button>Submit</button></form><script>window.submitted=0</script>'''
        def route_fixture(route):
            if route.request.url == job_url + '/apply': route.fulfill(content_type='text/html', body=fixture)
            else: route.abort()
        browser.route('**/*', route_fixture)
        worker = browser.service_workers[0] if browser.service_workers else browser.wait_for_event('serviceworker')
        worker.evaluate('''async (url) => {
          globalThis.fixtureJob={id:'fixture',revision:1,title:'Junior Developer',company:'Fixture',url};
          globalThis.fetch=async (requestUrl)=>{
            if(requestUrl.endsWith('/approved'))return new Response(JSON.stringify([fixtureJob]));
            if(requestUrl.includes('/cv/'))return new Response('%PDF-1.4 fixture');
            return new Response(JSON.stringify({...fixtureJob,cv:'developer-en',cv_hash:'fixture',letter:'Test',profile:{first_name:'Test',last_name:'Person',email:'test@example.com',phone:''}}));
          };
          await chrome.storage.local.set({token:'fixture',queueEnabled:true});
          await tick();
        }''', job_url)
        page = next((p for p in browser.pages if p.url.startswith(job_url)), None)
        if page is None:
            page = browser.wait_for_event('page')
        # Chromium can miss routing the first extension-created navigation.
        # DNS is blocked above; reload through Playwright's fixture interception.
        page.goto(job_url + '/apply')
        page.wait_for_load_state('networkidle')
        worker.evaluate('tick()')
        assert page.locator('[name=first_name]').input_value() == 'Test'
        assert page.locator('[name=resume]').evaluate('(el)=>el.files.length') == 1
        assert page.evaluate('window.submitted') == 0
        state = worker.evaluate("chrome.storage.local.get('queueItems')")
        assert state['queueItems']['fixture:1']['status'] == 'ready'
        before = len(browser.pages)
        worker.evaluate('tick()')
        assert len(browser.pages) == before
        worker.evaluate("chrome.storage.local.set({queueEnabled:false})")
        worker.evaluate('tick()')
        assert len(browser.pages) == before
        browser.close()
print('PASS: real Brave worker opens and fills fixture, attaches CV, persists ready state, avoids duplicate tabs, pauses, and never submits.')
