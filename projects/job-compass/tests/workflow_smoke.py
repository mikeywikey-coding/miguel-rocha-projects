from pathlib import Path
import os,sys,subprocess,tempfile,time,json
import httpx
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
from app import store
from app.main import CV_NAMES

with tempfile.TemporaryDirectory(prefix='compass-workflow-',ignore_cleanup_errors=True) as tmp:
    store.DATA=Path(tmp);store.init();store.save('automation',False)
    p=store.setting('profile');p['email']='fixture@example.com';store.save('profile',p)
    for name in CV_NAMES.values():(store.DATA/'cvs'/name).write_bytes(b'%PDF-1.4 fixture')
    env=dict(os.environ,COMPASS_DATA=tmp,COMPASS_PORT='8124')
    proc=subprocess.Popen([sys.executable,'-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8124'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for _ in range(50):
            try:
                if httpx.get('http://127.0.0.1:8124/api/state').status_code==200:break
            except httpx.HTTPError:pass
            time.sleep(.1)
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless=True)
            page=browser.new_page(viewport={'width':1365,'height':1000})
            page.goto('http://127.0.0.1:8124');page.wait_for_load_state('networkidle')
            page.get_by_role('button',name='Add a job',exact=False).click()
            form=page.locator('#import-form')
            form.locator('[name=title]').fill('Junior Developer')
            form.locator('[name=company]').fill('Workflow Fixture')
            form.locator('[name=location]').fill('Lisbon')
            form.locator('[name=url]').fill('https://example.test/jobs/123')
            form.locator('[name=description]').fill('React JavaScript internship in Lisbon.')
            form.get_by_role('button',name='Add to my list').click()
            page.locator('#draft-language').select_option('pt')
            page.get_by_role('button',name='Prepare application').click()
            page.locator('#draft-text').wait_for()
            assert page.locator('#draft-text').input_value().startswith('Olá ')
            assert page.locator('#draft-cv').input_value()=='developer-pt'
            page.locator('#draft-text').fill('Reviewed fixture cover letter.')
            page.get_by_role('button',name='Approve saved materials').click()
            page.get_by_text('Save your changes before approving.',exact=True).wait_for()
            page.get_by_role('button',name='Save changes').click()
            page.get_by_text('Saved. Changes require a new approval.',exact=True).wait_for()
            page.get_by_role('button',name='Approve saved materials').click()
            page.get_by_text('Approved for Brave',exact=True).wait_for()
            page.get_by_role('button',name='Record as submitted').click()
            page.get_by_text('Confirm that you saw successful submission on the employer website.',exact=True).wait_for()
            page.locator('#submitted-confirm').check()
            page.get_by_role('button',name='Record as submitted').click()
            page.get_by_text('Application recorded.',exact=True).wait_for()
            data=httpx.get('http://127.0.0.1:8124/api/state').json()
            assert len(data['jobs'])==1 and data['jobs'][0]['status']=='applied'
            assert data['jobs'][0]['approval'] is None
            page.get_by_role('button',name='Close job').click()
            page.get_by_role('button',name='Settings',exact=False).click()
            page.get_by_role('heading',name='Confirmed application answers').wait_for()
            page.locator('#answer-availability').fill('Two weeks')
            page.locator('#answers-confirm').check()
            page.get_by_role('button',name='Save confirmed answers').click()
            page.get_by_text('Application answers saved.',exact=True).wait_for()
            assert httpx.get('http://127.0.0.1:8124/api/state').json()['application_answers']=={'availability':'Two weeks'}
            browser.close()
    finally:
        proc.terminate();proc.wait(timeout=10)
print('PASS: isolated Brave import, edit, stale-approval guard, save, approve and explicit submission confirmation. No real employer submission.')
