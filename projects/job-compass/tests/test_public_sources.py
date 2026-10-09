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


def test_teamlyzer_reads_job_cards_when_the_page_has_no_structured_postings():
    html = """<script type="application/ld+json">{"@type": "ItemList", "numberOfItems": 1}</script>
    <div class="jobcard__body"><span class="role-tag backend">Backend</span>
    <h4 class="jobcard__title"><a class="jobcard__title-link" href="/companies/olisipo/job/junior-net-developer-19729">Junior .net developer</a></h4>
    <div class="jobcard__meta"><a class="jobcard__company" href="/companies/olisipo">Olisipo</a></div>
    <div class="jobcard__meta"><span class="jobcard__location"><i class="fa fa-map-marker"></i> Lisboa (Regime: Híbrido)</span>
    <span class="jobcard__seniority">Júnior</span><span class="jobcard__salary">€24k - 30k <small class="jobcard__salary-label">Bruto anual</small></span></div>
    <div class="jobcard__tags"><span class="jobcard__tag">.net</span><span class="jobcard__tag">sql</span></div></div>"""
    (job,) = parse_listings("teamlyzer", html)
    assert (
        job["url"]
        == "https://pt.teamlyzer.com/companies/olisipo/job/junior-net-developer-19729"
    )
    assert (job["title"], job["company"], job["location"]) == (
        "Junior .net developer",
        "Olisipo",
        "Lisboa (Regime: Híbrido)",
    )
    assert job["description"] == "Backend. Seniority: Júnior. .net, sql. €24k - 30k"


def test_iefp_internship_offers_are_marked_as_internships():
    html = """<article class="card-oferta"><div class="card-header"><strong>Programador de Software</strong></div>
    <div class="card-body"><div class="row-flex"><strong>LISBOA</strong></div>Estágio ATIVAR.PT</div>
    <a href="/IEFP/pesquisas/detalheOfertasEstagio.do?idOferta=1105891&amp;isPesq=true">Ver</a></article>"""
    (job,) = parse_listings("iefp", html)
    assert job["title"] == "Programador de Software" and job["location"] == "LISBOA"
    assert job["description"].startswith("Seniority: Estágio profissional (IEFP).")


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


def test_expresso_reads_cards_with_location_in_the_link():
    html = """<div onclick="location.href='/emprego/tecnico-de-helpdesk/lisboa--portugal/2472257'">
    <h3><a href="/emprego/tecnico-de-helpdesk/lisboa--portugal/2472257">Técnico de Helpdesk</a></h3><h4>Adecco Recruitment</h4>
    <span class="px13 colorBlack">02.10.2026 <span class="colorBlue2">|</span> Lisboa, Portugal</span>
    <div class="px13 colorGray8 hidden-xs">Suporte a utilizadores</div></div>"""
    (job,) = parse_listings("expresso", html)
    assert (
        job["url"]
        == "https://expressoemprego.pt/emprego/tecnico-de-helpdesk/lisboa--portugal/2472257"
    )
    assert (job["title"], job["company"], job["location"], job["posted"]) == (
        "Técnico de Helpdesk",
        "Adecco Recruitment",
        "Lisboa, Portugal",
        "02.10.2026",
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


def test_randstad_location_is_the_town_not_the_branch_region():
    html = """<div class="cards__item"><a class="cards__link" href="/empregos/tecnico-de-helpdesk-de-ti_porto_DTS-1/">técnico de helpdesk de ti</a>
      <ul><li class="cards__meta-item">porto, lisboa</li><li class="cards__meta-item">contrato</li></ul><p class="cards__description">Suporte</p></div>"""
    assert [j["location"] for j in parse_listings("randstad", html)] == ["porto"]


def test_linkedin_keeps_searches_read_before_it_rate_limits(monkeypatch):
    import app.public_sources as sources

    monkeypatch.setitem(sources.PAUSE, "linkedin", 0)
    card = '<div class="base-search-card"><a class="base-card__full-link" href="https://pt.linkedin.com/jobs/view/{0}"></a><h3 class="base-search-card__title">Junior Developer {0}</h3></div>'
    calls = []

    def handle(request):
        calls.append(request)
        return (
            httpx.Response(429)
            if len(calls) > 2
            else httpx.Response(200, text=card.format(len(calls)))
        )

    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_public(
                {"id": "linkedin", "name": "LinkedIn Jobs"}, client
            )

    jobs = asyncio.run(check())
    assert [job["title"] for job in jobs] == [
        "Junior Developer 1",
        "Junior Developer 2",
    ] and len(calls) == 3
    # Rate limited from the first search: nothing was read, so the source reports the failure.
    calls.clear()
    calls.extend([None, None])
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(check())
