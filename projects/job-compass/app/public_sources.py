"""Bounded collection of public listings; never treat a challenge as an empty feed."""

import asyncio
import json
import re
from urllib.parse import quote, quote_plus, urljoin, urlsplit

import httpx
from bs4 import BeautifulSoup

from .engine import canonical_url, plain

URLS = {
    "adecco": ["https://www.adecco.com/pt-pt/ofertas-emprego"],
    "linkedin": [
        "https://www.linkedin.com/jobs/search/?keywords=junior%20developer&location=Lisbon%2C%20Portugal",
        "https://www.linkedin.com/jobs/search/?keywords=technical%20support&location=Lisbon%2C%20Portugal",
        "https://www.linkedin.com/jobs/search/?keywords=internship&location=Lisbon%2C%20Portugal",
        "https://www.linkedin.com/jobs/search/?keywords=est%C3%A1gio&location=Lisbon%2C%20Portugal",
        # Trainee and graduate programmes are entry routes too.
        "https://www.linkedin.com/jobs/search/?keywords=trainee&location=Lisbon%2C%20Portugal",
        "https://www.linkedin.com/jobs/search/?keywords=graduate%20program&location=Lisbon%2C%20Portugal",
    ]
    +
    # The further areas chosen in Settings: customer service, content and ads operations, sales, back office, marketing.
    [
        f"https://www.linkedin.com/jobs/search/?keywords={quote(q)}&location=Lisbon%2C%20Portugal"
        for q in (
            "customer service",
            "content moderator",
            "sales development representative",
            "back office",
            "portuguese speaker",
            "digital marketing",
        )
    ],
    "netempregos": [
        f"https://www.net-empregos.com/pesquisa-empregos.asp?chaves={quote_plus(q)}&cidade=Lisboa"
        for q in (
            "junior",
            "informatica",
            "helpdesk",
            "estagio",
            "apoio ao cliente",
            "administrativo",
        )
    ],
    "teamlyzer": [
        "https://pt.teamlyzer.com/companies/jobs?address=lisboa&q=junior",
        "https://pt.teamlyzer.com/companies/jobs?address=lisboa&q=support",
        "https://pt.teamlyzer.com/companies/jobs?address=lisboa&q=trainee",
    ],
    "landing": ["https://landing.jobs/jobs"],
    "randstad": [
        f"https://www.randstad.pt/empregos/q-{q}/"
        for q in (
            "junior",
            "helpdesk",
            "developer",
            "apoio-ao-cliente",
            "administrativo",
            "backoffice",
            "comercial",
        )
    ],
    "portalemprego": [
        f"https://www.portalemprego.pt/anuncios/pesquisa-{q}/mostrar-20/"
        for q in (
            "junior",
            "informatica",
            "helpdesk",
            "estagio",
            "administrativo",
            "atendimento",
            "comercial",
        )
    ],
    # The site's IT category page is empty; its search path is /emprego/pesquisa/{query}/{location}.
    "expresso": [
        f"https://expressoemprego.pt/emprego/pesquisa/{q}/lisboa?order=data"
        for q in (
            "informatica",
            "junior",
            "suporte",
            "estagio",
            "administrativo",
            "atendimento",
            "comercial",
        )
    ],
    "sapo": ["https://emprego.sapo.pt/"],
    "iefp": [
        "https://iefponline.iefp.pt/IEFP/pesquisas/search.do?cat=ofertaEmprego&text=programador",
        "https://iefponline.iefp.pt/IEFP/pesquisas/search.do?cat=ofertaEmprego&text=informatica",
        # Paid professional internships (Estágios ATIVAR.PT), nationwide: the matcher keeps the Lisbon area.
        "https://iefponline.iefp.pt/IEFP/pesquisas/search.do?cat=ofertaEstagio&text=programador&resultsPerPage=50",
        "https://iefponline.iefp.pt/IEFP/pesquisas/search.do?cat=ofertaEstagio&text=informatica&resultsPerPage=50",
    ],
}
# LinkedIn answers "429 Too Many Requests" to about ten quick searches in a row: space them out.
PAUSE = {"linkedin": 4}
ADECCO_QUERIES = (
    "junior",
    "helpdesk",
    "developer",
    "apoio ao cliente",
    "administrativo",
    "comercial",
)


class SourceReadError(ValueError):
    pass


def text(node, selector):
    found = node.select_one(selector)
    return found.get_text(" ", strip=True) if found else ""


def postings(value):
    if isinstance(value, dict):
        if value.get("@type") == "JobPosting":
            yield value
        else:
            for child in value.values():
                yield from postings(child)
    elif isinstance(value, list):
        for child in value:
            yield from postings(child)


def parse_listings(ident, html):
    soup = BeautifulSoup(html, "html.parser")
    base = URLS[ident][0]
    jobs = []

    def add(title, company, location, description, url, posted=""):
        if not title or not url:
            return
        url = urljoin(base, url)
        # Only retain the source's own job links, never navigation or injected hosts.
        domain = urlsplit(base).hostname.removeprefix("www.")
        host = urlsplit(url).hostname or ""
        if host != domain and not host.endswith("." + domain):
            return
        jobs.append(
            dict(
                title=plain(title),
                company=plain(company) or "Employer not specified",
                location=plain(location),
                description=plain(description)[:60000],
                url=canonical_url(url),
                posted=plain(posted),
            )
        )

    if ident == "teamlyzer":
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                data = json.loads(script.string or script.get_text())
            except (ValueError, TypeError):
                continue
            for row in postings(data):
                places = row.get("jobLocation") or []
                if isinstance(places, dict):
                    places = [places]
                locations = []
                for place in places:
                    address = place.get("address") or {}
                    locations.extend(
                        str(address[k])
                        for k in ("addressLocality", "addressRegion", "addressCountry")
                        if address.get(k)
                    )
                if row.get("jobLocationType") == "TELECOMMUTE":
                    locations.insert(0, "Remote")
                    regions = row.get("applicantLocationRequirements") or []
                    if isinstance(regions, dict):
                        regions = [regions]
                    locations.extend(r["name"] for r in regions if r.get("name"))
                skills = row.get("skills") or []
                add(
                    row.get("title"),
                    (row.get("hiringOrganization") or {}).get("name"),
                    " · ".join(locations),
                    row.get("description", "")
                    + " "
                    + (" ".join(skills) if isinstance(skills, list) else skills),
                    row.get("url"),
                    row.get("datePosted", ""),
                )
        if not jobs:
            for card in soup.select(".jobcard__body"):
                link = card.select_one("a.jobcard__title-link[href]")
                if not link:
                    continue
                tags = ", ".join(
                    t.get_text(strip=True) for t in card.select(".jobcard__tag")
                )
                salary = (
                    text(card, ".jobcard__salary")
                    .replace(text(card, ".jobcard__salary-label"), "")
                    .strip()
                )
                level = text(card, ".jobcard__seniority")
                description = ". ".join(
                    filter(
                        None,
                        [
                            text(card, ".role-tag"),
                            level and "Seniority: " + level,
                            tags,
                            salary,
                        ],
                    )
                )
                add(
                    link.get_text(),
                    text(card, ".jobcard__company"),
                    text(card, ".jobcard__location"),
                    description,
                    link["href"],
                )
    elif ident == "linkedin":
        for card in soup.select(".base-search-card"):
            link = card.select_one("a.base-card__full-link[href]")
            date = card.select_one("time[datetime]")
            add(
                text(card, ".base-search-card__title"),
                text(card, ".base-search-card__subtitle"),
                text(card, ".job-search-card__location"),
                "",
                link["href"].split("?")[0] if link else "",
                date["datetime"] if date else "",
            )
    elif ident == "landing":
        script = soup.select_one("#initial-search-results")
        if script:
            for row in json.loads(script.string or script.get_text()).get("offers", []):
                location = (
                    " · ".join(
                        p["label"]
                        for p in row.get("office_locations", [])
                        if p.get("label")
                    )
                    or row.get("location")
                    or ""
                )
                if row.get("full_remote"):
                    location = " · ".join(
                        filter(
                            None,
                            [
                                "Remote",
                                "Worldwide" if row.get("global_remote") else location,
                            ],
                        )
                    )
                description = (
                    (row.get("experience_level") or "")
                    + " "
                    + " ".join(
                        s["name"] for s in row.get("skills", []) if s.get("name")
                    )
                )
                if row.get("experience_min"):
                    description += f". {row['experience_min']} years of experience"
                add(
                    row.get("title"),
                    row.get("company_name"),
                    location,
                    description,
                    row.get("url"),
                    row.get("published_at", ""),
                )
    elif ident == "netempregos":
        for card in soup.select(".media-body"):
            link = card.select_one("h2 a.oferta-link[href]")
            if not link:
                continue

            def item(icon):
                node = card.select_one(icon)
                return node.parent.get_text(" ", strip=True) if node else ""

            add(
                link.get_text(),
                item(".flaticon-work"),
                item(".flaticon-pin"),
                item(".fa-tags"),
                link["href"],
                item(".flaticon-calendar"),
            )
    elif ident == "randstad":
        for card in soup.select(".cards__item"):
            link = card.select_one("a.cards__link[href]")
            if link:
                # "porto, lisboa": the town, then the region of the Randstad branch that posted it, not of the job.
                add(
                    link.get_text(),
                    "Randstad",
                    text(card, ".cards__meta-item").split(",")[0],
                    text(card, ".cards__description"),
                    link["href"],
                    text(card, ".cards__date"),
                )
    elif ident == "portalemprego":
        for card in soup.select('a[href*="referencia-"]'):
            if card["href"].startswith("/formacao/"):
                continue
            add(
                text(card, "h5"),
                text(card, ".company"),
                text(card, ".city"),
                text(card, ".description"),
                card["href"],
                text(card, ".postedDate"),
            )
    elif ident == "expresso":
        for card in soup.select("div[onclick]"):
            link = card.select_one("h3 a[href]")
            if link and re.search(r"/emprego/(?:[^/]+/)+\d+$", link["href"]):
                # "02.10.2026 | Lisboa, Portugal"
                posted, _, location = text(card, "span.colorBlack").partition("|")
                add(
                    link.get_text(),
                    text(card, "h4"),
                    location.strip(),
                    text(card, "div.hidden-xs"),
                    link["href"],
                    posted.strip(),
                )
    elif ident == "sapo":
        for card in soup.select("article"):
            link = card.select_one('a[href*="/offers/"]')
            if link and "/company/" not in link["href"]:
                add(
                    text(card, "h3"),
                    text(card, ".company .name"),
                    text(card, ".company .location"),
                    "",
                    link["href"],
                )
    elif ident == "iefp":
        for card in soup.select("article.card-oferta"):
            link = card.select_one('a[href*="detalheOfertas"]')
            if link:
                # Internship offers name only the occupation ("Programador de Software"): say what they are.
                kind = (
                    "Seniority: Estágio profissional (IEFP). "
                    if "detalheOfertasEstagio" in link["href"]
                    else ""
                )
                add(
                    text(card, ".card-header strong"),
                    "",
                    text(card, ".card-body .row-flex strong").replace("---", ""),
                    kind + text(card, ".card-body"),
                    urljoin("https://iefponline.iefp.pt/", link["href"]),
                )
    if not jobs:
        raise SourceReadError(
            "No readable listings found; the page may have changed or require browser access"
        )
    return list({job["url"]: job for job in jobs}.values())


async def read_page(client, url):
    host = urlsplit(url).hostname
    for _ in range(4):
        response = await client.get(url, follow_redirects=False)
        if response.is_redirect:
            target = urljoin(url, response.headers.get("location", ""))
            if urlsplit(target).scheme != "https" or urlsplit(target).hostname != host:
                raise SourceReadError(
                    "Source redirected away from its public listing page"
                )
            url = target
            continue
        response.raise_for_status()
        # Several Portuguese sites declare their encoding only in the HTML.
        if host == "www.net-empregos.com":
            # UTF-8 page chrome is mixed with Windows-1252 listing text.
            try:
                return response.content.decode("utf-8")
            except UnicodeDecodeError:
                mixed = response.content.decode("utf-8", errors="surrogateescape")
                return re.sub(
                    r"[\udc80-\udcff]",
                    lambda m: bytes([ord(m[0]) - 0xDC00]).decode(
                        "cp1252", errors="replace"
                    ),
                    mixed,
                )
        return BeautifulSoup(response.content, "html.parser").decode()
    raise SourceReadError("Too many source redirects")


async def fetch_public(source, client):
    ident = source["id"]
    if ident == "adecco":
        jobs = {}
        for query in ADECCO_QUERIES:
            response = await client.post(
                "https://www.adecco.com/api/data/jobs/summarized",
                json=dict(
                    baseSearchQuery="",
                    filtersToDisplay="",
                    selectedFilters="",
                    queryString="&q=" + query,
                    range=0,
                    siteName="AdeccoPT",
                    brand="adecco",
                    countryCookie="PT",
                    langCookie="pt-PT",
                ),
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data.get("jobs"), list):
                raise SourceReadError("Adecco returned an unexpected search response")
            for row in data["jobs"]:
                link = row.get("applyUri") or ""
                if urlsplit(link).hostname != "candidatos.adecco.pt" or not row.get(
                    "jobTitle"
                ):
                    continue
                url = canonical_url(link)
                location = row.get("jobLocation") or ""
                jobs[url] = dict(
                    title=plain(row["jobTitle"]),
                    company="Adecco",
                    location=("Remote · " if row.get("isRemote") else "") + location,
                    description=plain(
                        row.get("description") or row.get("clientJobDescription")
                    ),
                    url=url,
                    source=source["name"],
                    posted=row.get("jobCreationDate") or "",
                )
        return list(jobs.values())
    if ident not in URLS:
        raise SourceReadError("No verified automatic collector for this source")
    jobs = {}
    empty = 0
    for index, url in enumerate(URLS[ident]):
        if index and PAUSE.get(ident):
            await asyncio.sleep(PAUSE[ident])
        try:
            html = await read_page(
                client, url
            )  # a redirect away or an HTTP error still fails the whole source
        except httpx.HTTPStatusError as exc:
            # Rate limited after some searches were read: keep those; the next check starts again from the first.
            if exc.response.status_code == 429 and jobs:
                break
            raise
        try:
            found = parse_listings(ident, html)
        except SourceReadError:
            # One search with no results today (Portal Emprego "helpdesk") is not a broken source.
            empty += 1
            continue
        for job in found:
            job["source"] = source["name"]
            jobs[job["url"]] = job
    if empty == len(URLS[ident]):
        raise SourceReadError(
            "No readable listings found; the page may have changed or require browser access"
        )
    return list(jobs.values())
