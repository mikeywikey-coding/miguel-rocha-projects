from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "test-results"
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
        headless=True,
    )
    page = browser.new_page(
        viewport={"width": 1440, "height": 1080}, device_scale_factor=1
    )
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:8123")
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name="Good opportunities. Less searching.").wait_for()
    assert (
        page.get_by_role("button", name="Website", exact=True).get_attribute(
            "aria-pressed"
        )
        == "true"
    )
    if page.locator(".job-card").count():
        assert page.locator(".website-group").count() > 0
        assert (
            page.locator(".website-group .job-card").count()
            == page.locator(".job-card").count()
        )
        page.get_by_role("button", name="Best match", exact=True).click()
        assert page.locator(".website-group").count() == 0
        page.get_by_role("button", name="Website", exact=True).click()
        page.get_by_role("button", name="Development", exact=True).click()
        assert (
            page.locator(".website-group .job-card").count()
            == page.locator(".job-card").count()
        )
        page.get_by_role("button", name="All roles", exact=True).click()
    page.screenshot(path=str(OUT / "dashboard-desktop.png"), full_page=True)
    page.get_by_role("button", name="Job sources", exact=False).click()
    page.get_by_role("heading", name="Your job-search toolkit.").wait_for()
    assert page.get_by_role("heading", name="LinkedIn Jobs", exact=True).count() == 1
    assert page.get_by_role("heading", name="Teamlyzer", exact=True).count() == 1
    assert page.get_by_role("heading", name="Expresso Emprego", exact=True).count() == 1
    assert page.get_by_role("heading", name="Indeed Portugal", exact=True).count() == 1
    assert page.get_by_role("heading", name="Adecco Portugal", exact=True).count() == 1
    page.get_by_role("button", name="Settings", exact=False).click()
    page.get_by_role("heading", name="Your application profile").wait_for()
    page.get_by_role("heading", name="ITJobs automatic search").wait_for()
    assert (
        page.get_by_role(
            "link", name="Request your free read-only key on ITJobs"
        ).count()
        == 1
    )
    assert page.get_by_role("link", name="Download PDF").count() == 4
    page.screenshot(path=str(OUT / "settings.png"), full_page=True)
    page.get_by_role("button", name="Replies", exact=False).click()
    page.get_by_role("heading", name="Replies that move you forward.").wait_for()
    page.get_by_role("button", name="Discover", exact=False).click()
    page.get_by_role("button", name="Review queue", exact=False).click()
    assert (
        page.get_by_role("button", name="Website", exact=True).get_attribute(
            "aria-pressed"
        )
        == "true"
    )
    if page.locator(".job-card").count():
        assert (
            page.locator(".website-group .job-card").count()
            == page.locator(".job-card").count()
        )
    page.get_by_role("button", name="Discover", exact=False).click()
    page.get_by_role("button", name="Add a job", exact=False).click()
    page.get_by_role("heading", name="Found something interesting?").wait_for()
    page.get_by_role("button", name="Close import").click()
    if page.locator(".title-button").count():
        page.locator(".title-button").first.click()
        page.get_by_role("heading", name="Why it made your list").wait_for()
        page.screenshot(path=str(OUT / "job-detail.png"), full_page=True)
        page.get_by_role("button", name="Close job").click()
    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path=str(OUT / "dashboard-mobile.png"), full_page=True)
    assert page.evaluate(
        "document.documentElement.scrollWidth <= window.innerWidth"
    ), "Mobile overflow"
    assert not errors, errors
    browser.close()
print(
    "PASS: Brave desktop/mobile, source directory, CV links, Replies, import dialog, job details, no browser errors."
)
