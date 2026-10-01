import asyncio
import httpx
from app.sources import fetch_source, reconcile_new_jobs, init_sources
from app import store
import json


def test_verified_collectors_are_automatic_and_keep_disabled_preference(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(store, "DATA", tmp_path)
    store.init()
    init_sources()
    store.execute("UPDATE sources SET enabled=0,kind='browser' WHERE id='randstad'")
    init_sources()
    rows = {row["id"]: row for row in store.query("SELECT id,kind,url FROM sources")}
    expected = {
        "indeed": "pt.indeed.com",
        "teamlyzer": "pt.teamlyzer.com",
        "expresso": "expressoemprego.pt",
        "jooble": "pt.jooble.org",
        "jobrapido": "pt.jobrapido.com",
        "portalemprego": "portalemprego.pt",
        "randstad": "randstad.pt",
        "adecco": "adecco.com/pt-pt",
    }
    for ident, host in expected.items():
        assert rows[ident]["kind"] == (
            "browser" if ident in {"indeed", "jooble", "jobrapido"} else "public"
        )
        assert host in rows[ident]["url"]
    assert (
        store.query("SELECT enabled FROM sources WHERE id='randstad'")[0]["enabled"]
        == 0
    )


def test_adapters_normalise_public_payloads():
    payloads = {
        "greenhouse": {
            "jobs": [
                {
                    "id": 1,
                    "internal_job_id": 1,
                    "title": "Junior Developer",
                    "location": {"name": "Lisbon"},
                    "content": "<p>React</p>",
                    "absolute_url": "https://example.com/jobs/1",
                }
            ]
        },
        "lever": [
            {
                "text": "Junior Developer",
                "categories": {"location": "Portugal"},
                "workplaceType": "remote",
                "descriptionPlain": "React",
                "hostedUrl": "https://example.com/jobs/1",
                "createdAt": 0,
            }
        ],
        "ashby": {
            "jobs": [
                {
                    "title": "Junior Developer",
                    "location": "Portugal",
                    "isRemote": True,
                    "descriptionPlain": "React",
                    "jobUrl": "https://example.com/jobs/1",
                    "isListed": True,
                }
            ]
        },
        "remotive": {
            "jobs": [
                {
                    "title": "Junior Developer",
                    "company_name": "Example",
                    "candidate_required_location": "Europe",
                    "description": "<p>React</p>",
                    "url": "https://example.com/jobs/1",
                }
            ]
        },
    }

    async def check():
        for kind, data in payloads.items():
            transport = httpx.MockTransport(lambda req: httpx.Response(200, json=data))
            async with httpx.AsyncClient(transport=transport) as client:
                jobs = await fetch_source(
                    {"kind": kind, "board": "example", "name": "Example"}, client
                )
                assert (
                    len(jobs) == 1
                    and jobs[0]["title"] == "Junior Developer"
                    and "<p>" not in jobs[0]["description"]
                )

    asyncio.run(check())


def test_itjobs_search_normalises_results_and_uses_saved_key(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA", tmp_path)
    store.init()
    store.save("itjobs_key", store.encrypt("test-read-only-key"))
    seen = []

    def handler(request):
        seen.append(request)
        junior = {
            "id": 516271,
            "slug": "junior-react-developer",
            "title": "Junior React Developer",
            "company": {"name": "Example PT"},
            "locations": [{"name": "Lisboa"}],
            "workModel": 2,
            "body": "<p>React and JavaScript</p>",
            "publishedAt": "2026-09-23 09:00:00",
        }
        internship = {
            "id": 516272,
            "slug": "estagio-web",
            "title": "Estágio Web Developer",
            "company": {"name": "Example PT"},
            "locations": [{"name": "Lisboa"}],
            "workModel": 1,
            "body": "<p>JavaScript</p>",
            "publishedAt": "2026-09-23 09:00:00",
        }
        rows = {"junior": [junior], "estágio": [junior, internship], "trainee": []}[
            request.url.params["q"]
        ]
        return httpx.Response(200, json={"results": rows})

    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            jobs = await fetch_source(
                {"kind": "itjobs", "board": "", "name": "ITJobs"}, client
            )
        assert len(jobs) == 2
        assert jobs[0]["title"] == "Junior React Developer"
        assert jobs[0]["company"] == "Example PT"
        assert jobs[0]["location"] == "Lisboa · Hybrid"
        assert jobs[0]["description"] == "React and JavaScript"
        assert (
            jobs[0]["url"]
            == "https://www.itjobs.pt/oferta/516271/junior-react-developer"
        )
        assert len(seen) == 3 and all(
            x.url.params["api_key"] == "test-read-only-key" for x in seen
        )
        assert [x.url.params["q"] for x in seen] == ["junior", "estágio", "trainee"]

    asyncio.run(check())


def test_reconcile_archives_only_unreviewed_jobs(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA", tmp_path)
    store.init()
    profile = store.setting("profile")
    profile["skills"] = ["React"]
    store.save("profile", profile)
    stamp = store.now()
    for ident, title, status in [
        ("old", "Tier III Service Desk Engineer", "new"),
        ("saved", "D365 F&O Developer", "saved"),
        ("good", "Junior React Developer", "new"),
    ]:
        store.execute(
            "INSERT INTO jobs(id,url,title,company,location,description,source,created,seen,status,score,analysis) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                ident,
                f"https://example.com/{ident}",
                title,
                "Example",
                "Lisbon, Portugal",
                "React",
                "fixture",
                stamp,
                stamp,
                status,
                90,
                json.dumps({"eligible": True, "score": 90}),
            ),
        )
    store.execute(
        "INSERT INTO sources(id,name,kind,board,url,last_attempt) VALUES(?,?,?,?,?,?)",
        ("example", "Example", "lever", "example", "https://example.com", stamp),
    )
    assert reconcile_new_jobs() == {"checked": 2, "archived": 1, "updated": 2}
    rows = {row["id"]: row for row in store.query("SELECT * FROM jobs")}
    assert rows["old"]["status"] == "archived" and rows["old"]["score"] <= 25
    assert rows["good"]["status"] == "new" and rows["good"]["score"] != 90
    assert rows["saved"]["status"] == "saved" and rows["saved"]["score"] == 90
    assert store.query("SELECT last_attempt FROM sources")[0]["last_attempt"] == stamp
    assert reconcile_new_jobs() == {"checked": 1, "archived": 0, "updated": 0}
