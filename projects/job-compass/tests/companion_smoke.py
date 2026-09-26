from pathlib import Path
import tempfile,json,re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
source=(ROOT/'extension/popup.js').read_text(encoding='utf-8')
extract=source[source.index('function extractListing()'):source.index('function sameApplication(')]
matching=source[source.index('function sameApplication('):source.index('function fillForm(')]
fill=source[source.index('function fillForm('):source.index('async function guarded(')]
with tempfile.TemporaryDirectory(prefix='compass-brave-',ignore_cleanup_errors=True) as temp, sync_playwright() as p:
    browser=p.chromium.launch_persistent_context(temp,executable_path='C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',headless=True,ignore_default_args=['--disable-extensions'],args=[f'--disable-extensions-except={ROOT / "extension"}',f'--load-extension={ROOT / "extension"}'])
    page=browser.new_page()
    page.goto('chrome://extensions/')
    page.wait_for_load_state('networkidle')
    items=page.locator('extensions-item')
    items.filter(has_text='Job Compass Companion').wait_for(timeout=15000)
    extension_id=items.filter(has_text='Job Compass Companion').evaluate('(el)=>el.data.id')
    assert extension_id,'Brave did not load the extension'
    popup=browser.new_page()
    # Pairing and refresh are exercised against a fixture API, not personal data.
    def mock_api(route):
        assert route.request.headers.get('authorization')=='Bearer fixture-pairing-key'
        route.fulfill(status=200,content_type='application/json',body='[]',headers={'Access-Control-Allow-Origin':'*'})
    browser.route('http://127.0.0.1:8123/api/companion/approved',mock_api)
    popup.goto(f'chrome-extension://{extension_id}/popup.html')
    popup.locator('#token').fill('fixture-pairing-key')
    popup.get_by_role('button',name='Save pairing').click()
    popup.get_by_text('Paired. 0 approved applications available.').wait_for()
    popup.get_by_role('button',name='Open selected job in Brave').click()
    popup.get_by_text('Choose an approved application first.').wait_for()
    popup.screenshot(path=str(OUT/'brave-companion.png'),full_page=True)
    fixture='''<!doctype html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Junior Developer","hiringOrganization":{"name":"Test Company"},"jobLocation":{"address":{"addressLocality":"Lisbon","addressCountry":"Portugal"}},"description":"<p>React developer</p>"}</script></head><body><h1>Junior Developer</h1><form><label>Newsletter email<input name="email" type="email"></label></form><form onsubmit="window.submitted++;return false"><label>First name<input name="candidate[first_name]"></label><label>Last name<input name="candidate[last_name]"></label><label>Email<input name="candidate[email]" type="email"></label><label>Phone<input name="candidate[phone_number]" type="tel"></label><label>Cover letter<textarea name="candidate[cover_letter]"></textarea></label><label>Reference full name<input name="reference_name"></label><label>Salary<input name="salary" required></label><label>Work authorisation<select name="work_auth" required><option value="">Choose</option><option>Yes</option></select></label><label>CV<input type="file" name="candidate[resume]" required hidden></label><label><input type="checkbox" name="consent" required>I consent</label><button type="submit">Submit</button></form><script>window.submitted=0</script></body></html>'''
    browser.route('https://example.test/jobs/123',lambda r:r.fulfill(content_type='text/html',body=fixture))
    page.goto('https://example.test/jobs/123')
    page.wait_for_load_state('networkidle')
    result=page.evaluate('('+extract+')()')
    assert result['company']=='Test Company' and result['location']=='Lisbon, Portugal'
    assert page.evaluate('('+matching+")( 'https://example.test/jobs/123', 'https://example.test/jobs/123/apply?utm_source=test')")
    assert not page.evaluate('('+matching+")( 'https://example.test/jobs/123', 'https://example.test/jobs/456')")
    assert page.evaluate('('+matching+")( 'https://jobs.ashbyhq.com/company/job-123', 'https://jobs.ashbyhq.com/company/job-123/application')")
    assert not page.evaluate('('+matching+")( 'https://jobs.ashbyhq.com/company/job-123', 'https://jobs.ashbyhq.com/company/job-456/application')")
    snapshot={'profile':{'first_name':'Test','last_name':'Person','email':'test@example.com','phone':'000'},'letter':'Test letter'}
    result=page.evaluate('args => ('+fill+')(args[0],args[1])',[snapshot,{'data':'JVBERi0xLjQ=','name':'test.pdf'}])
    assert page.locator('[name="candidate[first_name]"]').input_value()=='Test'
    assert page.locator('[name="candidate[last_name]"]').input_value()=='Person'
    assert page.locator('[name="candidate[email]"]').input_value()=='test@example.com'
    assert page.locator('[name="candidate[phone_number]"]').input_value()=='000'
    assert page.locator('[name="candidate[cover_letter]"]').input_value()=='Test letter'
    assert page.locator('[name=reference_name]').input_value()==''
    assert page.locator('form').first.locator('[name=email]').input_value()==''
    assert page.locator('[name=salary]').input_value()==''
    assert page.locator('[name=work_auth]').input_value()==''
    assert not page.locator('[name=consent]').is_checked()
    assert page.locator('[name="candidate[resume]"]').evaluate('(el)=>el.files[0].name')=='test.pdf'
    assert page.evaluate('window.submitted')==0
    assert result['skipped']
    ashby='''<!doctype html><html><body><form><label>Newsletter email<input name="email" type="email"></label></form><div id="form"><div class="ashby-application-form-container"><label>Name<input name="_systemfield_name"></label><label>Email<input name="_systemfield_email" type="email"></label><label>Resume<input id="_systemfield_resume" type="file" hidden></label><label>Salary expectations<input name="random_salary" required></label><button>Submit</button></div></div></body></html>'''
    page.set_content(ashby)
    ashby_result=page.evaluate('args => ('+fill+')(args[0],args[1])',[snapshot,{'data':'JVBERi0xLjQ=','name':'test.pdf'}])
    assert page.locator('[name=_systemfield_name]').input_value()=='Test Person'
    assert page.locator('[name=_systemfield_email]').input_value()=='test@example.com'
    assert page.locator('#_systemfield_resume').evaluate('(el)=>el.files[0].name')=='test.pdf'
    assert page.locator('[name=random_salary]').input_value()==''
    assert page.locator('form [name=email]').input_value()==''
    assert ashby_result['filled']
    browser.close()
print('PASS: extension loads in isolated Brave; pairing; JSON-LD capture; exact-job URL guard; approved contact/CV filling logic; sensitive fields untouched; zero submissions.')
