import asyncio
import json

import httpx
import pytest

from app.public_sources import parse_listings, fetch_public, read_page, SourceReadError


def test_linkedin_extracts_real_fields_and_removes_tracking():
    html = """<div class="base-search-card"><a class="base-card__full-link" href="https://pt.linkedin.com/jobs/view/junior-123?position=1&amp;trackingId=x"></a>
    <h3 class="base-search-card__title">Junior Developer</h3><h4 class="base-search-card__subtitle">Example</h4>
    <span class="job-search-card__location">Lisboa</span><time datetime="2026-09-27"></time></div>"""
    (job,) = parse_listings("linkedin", html)
    assert job["url"] == "https://pt.linkedin.com/jobs/view/junior-123"
    assert (job["title"], job["company"], job["location"]) == (
        "Junior Developer",
        "Example",
        "Lisboa",
    )
    assert job["posted"] == "2026-09-27"


def test_nested_jobposting_preserves_remote_restrictions():
    posting = {
        "@type": "JobPosting",
        "title": "Junior Developer",
        "hiringOrganization": {"name": "Example"},
        "url": "https://pt.teamlyzer.com/companies/example/job/junior-1",
        "description": "<p>Python</p>",
        "jobLocationType": "TELECOMMUTE",
        "applicantLocationRequirements": {"name": "Germany"},
    }
    html = (
        '<script type="application/ld+json">'
        + json.dumps({"itemListElement": [{"item": posting}]})
        + "</script>"
    )
    (job,) = parse_listings("teamlyzer", html)
    assert job["location"] == "Remote · Germany"
    assert job["description"] == "Python"


def test_landing_keeps_experience_and_geography():
    data = {
        "offers": [
            {
                "title": "Developer",
                "company_name": "Example",
                "url": "https://landing.jobs/at/example/dev",
                "office_locations": [{"label": "Lisbon, Portugal"}],
                "skills": [{"name": "React"}],
                "experience_min": 4,
                "experience_level": "Intermediate",
                "full_remote": False,
            }
        ]
    }
    (job,) = parse_listings(
        "landing",
        '<script id="initial-search-results">' + json.dumps(data) + "</script>",
    )
    assert job["location"] == "Lisbon, Portugal"
    assert (
        "4 years of experience" in job["description"] and "React" in job["description"]
    )


@pytest.mark.parametrize(
    "html", ["<title>Security Check</title>", "<html>Something changed</html>"]
)
def test_missing_listings_are_errors_not_false_success(html):
    with pytest.raises(SourceReadError):
        parse_listings("linkedin", html)


def test_redirect_cannot_fetch_unapproved_host():
    requests = []

    def handle(request):
        requests.append(str(request.url))
        return httpx.Response(302, headers={"Location": "http://127.0.0.1/private"})

    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            with pytest.raises(SourceReadError):
                await fetch_public({"id": "linkedin", "name": "LinkedIn Jobs"}, client)

    asyncio.run(check())
    assert len(requests) == 1


def test_adecco_uses_public_search_and_preserves_apply_link():
    def handle(request):
        assert request.method == "POST"
        assert request.url.path == "/api/data/jobs/summarized"
        assert json.loads(request.content)["countryCookie"] == "PT"
        return httpx.Response(
            200,
            json={
                "jobs": [
                    {
                        "jobTitle": "Junior IT Support",
                        "jobLocation": "Lisboa",
                        "applyUri": "https://candidatos.adecco.pt/candidaturas/novo/123?source=SWP",
                        "isRemote": False,
                    }
                ]
            },
        )

    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            jobs = await fetch_public(
                {"id": "adecco", "name": "Adecco Portugal"}, client
            )
        assert len(jobs) == 1
        assert jobs[0]["url"] == "https://candidatos.adecco.pt/candidaturas/novo/123"
        assert jobs[0]["source"] == "Adecco Portugal"

    asyncio.run(check())


def test_landing_remote_without_location_is_not_invented():
    row = {
        "title": "Junior Developer",
        "company_name": "Example",
        "url": "https://landing.jobs/at/example/dev",
        "location": None,
        "full_remote": True,
        "experience_level": None,
    }
    (job,) = parse_listings(
        "landing",
        '<script id="initial-search-results">'
        + json.dumps({"offers": [row]})
        + "</script>",
    )
    assert job["location"] == "Remote"


@pytest.mark.parametrize(
    "title",
    [
        "Junior Structural Engineer",
        "Junior Civil Engineer",
        "Mechanical Engineer Intern",
    ],
)
def test_general_boards_do_not_turn_non_it_engineering_into_tech_matches(title):
    from app.engine import assess

    assert not assess(
        {"title": title, "location": "Lisboa", "description": ""}, {"skills": []}
    )["eligible"]


def test_netempregos_mixed_encoding_keeps_portuguese_accents():
    body = (
        '<meta charset="utf-8"><p>“Jobs”</p>'.encode()
        + b"<h2>Inform\xe1tico J\xfanior</h2>"
    )

    async def check():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, content=body))
        ) as client:
            html = await read_page(
                client, "https://www.net-empregos.com/pesquisa-empregos.asp"
            )
        assert "Informático Júnior" in html and "“Jobs”" in html

    asyncio.run(check())
