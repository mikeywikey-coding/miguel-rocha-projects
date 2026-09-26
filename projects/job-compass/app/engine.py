import html
import re
import unicodedata
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode


def plain(value):
    return re.sub(
        r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    ).strip()


def fold(value):
    return "".join(
        c
        for c in unicodedata.normalize("NFKD", value.lower())
        if not unicodedata.combining(c)
    )


def canonical_url(value):
    p = urlsplit(value)
    if p.scheme not in ("https", "http") or not p.hostname or p.username or p.password:
        raise ValueError("Use a public http(s) job URL")
    if p.hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        raise ValueError("A job must have a public URL")
    query = sorted(
        (k, v)
        for k, v in parse_qsl(p.query, keep_blank_values=True)
        if not k.lower().startswith("utm_")
        and k.lower() not in ("source", "ref", "referral", "trackingid", "trk", "src")
    )
    return urlunsplit(
        (
            p.scheme.lower(),
            p.netloc.lower(),
            p.path.rstrip("/") or "/",
            urlencode(query),
            "",
        )
    )


def assess(job, profile):
    title = fold(job.get("title", ""))
    location = fold(job.get("location", ""))
    body = fold(plain(job.get("description", "")))
    tech = bool(
        re.search(
            r"developer|engineer|programador|desenvolv|software|frontend|front.end|backend|back.end|full.stack|quality assurance|\bqa\b|\bit\b|informat|web",
            title,
        )
    )
    support = bool(
        re.search(
            r"support|suporte|help.?desk|service.?desk|customer service|apoio ao cliente",
            title,
        )
    )
    junior = bool(
        re.search(
            r"junior|\bjr\b|intern\b|internship|estagio|trainee|entry.level|graduate",
            title,
        )
    )
    senior = bool(
        re.search(
            r"senior|\bsr\b|staff|principal|director|head of|manager|lead\b|arquiteto|architect|tier\s*(?:iii|3)|level\s*(?:iii|3)",
            title,
        )
    )
    remote = bool(re.search(r"remote|remoto|anywhere|worldwide", location))
    lisbon = bool(
        re.search(r"lisbon|lisboa|oeiras|amadora|cascais|sintra|almada", location)
    )
    portugal = bool(re.search(r"portugal|\bpt\b", location))
    broad = bool(
        re.search(
            r"europe|european union|\beu\b|\bemea\b|worldwide|anywhere|global", location
        )
    )
    restricted = bool(
        re.search(
            r"\bus\b|usa|united states|canada|\buk\b|united kingdom|australia|india|germany|france|spain|poland|brazil|romania|netherlands",
            location,
        )
    ) and not (portugal or lisbon or broad)
    location_ok = lisbon or (remote and (portugal or broad))
    location_unknown = (
        (remote and not restricted and not location_ok)
        or not location.strip()
        or location == "not specified"
    )
    if remote and re.search(
        r"(?:must\s+(?:be\s+)?(?:based|located|reside|live)|residents?\s+only|only\s+(?:based|located)|restricted\s+to).{0,50}(?:united states|\busa\b|\bus\b|united kingdom|\buk\b|canada|australia)",
        body,
    ):
        location_ok = False
        location_unknown = False
    allowed_role = (
        (tech or support)
        and not senior
        and (not support or profile.get("support", True))
    )
    eligible = allowed_role and (location_ok or location_unknown)
    flags = []
    reasons = []
    if senior:
        flags.append("Seniority above the target level")
    if not location_ok:
        flags.append(
            "Confirm Portugal remote eligibility"
            if location_unknown
            else "Outside Lisbon / Portugal-compatible remote scope"
        )
    if re.search(
        r"currently enrolled|must be enrolled|enrolled in|matriculad|frequentar.*licenciatura",
        body,
    ):
        flags.append("Current student enrolment may be required")
    if re.search(
        r"(?:bachelor|master|degree|licenciatura).{0,45}(?:required|mandatory|obrigat)|(?:require|must have).{0,35}(?:degree|licenciatura)",
        body,
    ):
        flags.append("Degree requirement: course was not completed")
    years = None
    for candidate in re.finditer(
        r"(?<![\d-])([3-9]|1[0-9])\+?\s*(?:years|anos).{0,25}(?:experience|experiencia)",
        body,
    ):
        prefix = body[max(0, candidate.start() - 25) : candidate.start()]
        if re.search(
            r"(?:less than|fewer than|under|up to|at most|no more than)\s*$", prefix
        ):
            continue
        if re.search(r"(?:between|from)\s+\d+\s*(?:-|–|to)\s*$", prefix):
            continue
        years = candidate
        break
    if years:
        flags.append(f"Listing mentions {years[1]}+ years of experience")
    if years and not junior:
        eligible = False
    for language in ["french", "german", "dutch", "italian", "spanish"]:
        if language in title or re.search(
            rf"(?:fluent|native|proficien\w*).{{0,20}}\b{language}\b", body
        ):
            flags.append(f"Check {language.title()} language requirement")
    known = profile.get("skills", [])
    matched = [
        s
        for s in known
        if re.search(r"(?<!\w)" + re.escape(fold(s)) + r"(?!\w)", title + " " + body)
    ]
    if tech and not junior and not support and not matched:
        eligible = False
    gaps = [
        s
        for s in [
            "TypeScript",
            "SQL",
            "Java",
            "C#",
            "Docker",
            "Kubernetes",
            "AWS",
            "Active Directory",
        ]
        if fold(s) not in [fold(x) for x in known]
        and re.search(r"(?<!\w)" + re.escape(fold(s)) + r"(?!\w)", body)
    ]
    if junior:
        reasons.append("Junior / internship title")
    if lisbon:
        reasons.append("Lisbon area")
    elif location_ok:
        reasons.append(
            "Remote geography includes Portugal or a broader region; check employer details"
        )
    if matched:
        reasons.append("Skills overlap: " + ", ".join(matched[:5]))
    if support:
        reasons.append("Relevant customer-support background")
    if not junior and not support:
        flags.append("Entry-level suitability needs review")
    score = max(
        0,
        min(
            99,
            35
            + (25 if junior else 0)
            + (20 if location_ok else 0)
            + min(20, 5 * len(matched))
            - (10 if support and not tech else 0)
            - min(35, 7 * len(flags)),
        ),
    )
    return dict(
        eligible=eligible,
        score=score if eligible else min(score, 25),
        matched=matched,
        gaps=gaps,
        flags=flags,
        reasons=reasons,
        category="support" if support else "development",
        location_status=(
            "confirmed" if location_ok else "check" if location_unknown else "outside"
        ),
    )


def draft_letter(job, profile, language):
    name = profile.get("first_name", "") + " " + profile.get("last_name", "")
    result = assess(job, profile)
    skills = ", ".join(result["matched"][:4]) or ", ".join(
        profile.get("skills", [])[:3]
    )
    if language == "pt":
        return f"Olá equipa da {job['company']},\n\nGostaria de apresentar a minha candidatura à função de {job['title']}. Tenho experiência prática em {skills}, desenvolvida através de projetos pessoais. Criei aplicações web e extensões de navegador e participei num projeto de modelação 3D em Blender.\n\nNo Meta Business Support, desenvolvi competências de comunicação, documentação e resolução de problemas no apoio a clientes. Estou em Lisboa e procuro uma oportunidade para contribuir e continuar a aprender.\n\nAgradeço a consideração da minha candidatura.\n{name.strip()}"
    return f"Hello {job['company']} team,\n\nI would like to apply for the {job['title']} position. My personal projects have given me practical experience with {skills}, including web applications, browser extensions and collaborative Blender modelling work.\n\nMy experience in Meta Business Support developed my communication, documentation and problem-solving skills. I am based in Lisbon and looking for an opportunity to contribute while continuing to learn.\n\nThank you for considering my application.\n{name.strip()}"


def classify_reply(subject, body):
    text = fold(subject + " " + body)
    if re.search(
        r"not.{0,30}(?:moving forward|selected|proceed)|unfortunately|unsuccessful|nao.{0,30}(?:avancar|selecionad)",
        text,
    ):
        return "rejection"
    if re.search(r"interview|entrevista|schedule a call|agendar.*conversa", text):
        return "interview"
    if re.search(
        r"assessment|coding challenge|technical test|teste tecnico|take.home", text
    ):
        return "assessment"
    if re.search(
        r"application.{0,30}received|thanks? for applying|candidatura.{0,30}recebida",
        text,
    ):
        return "confirmation"
    return "reply"


def match_message(subject, body, jobs):
    text = fold(subject + " " + body)
    candidates = [
        j["id"]
        for j in jobs
        if j.get("status") in ("applied", "interview", "assessment")
        and len(j["company"]) > 2
        and fold(j["company"]) in text
        and fold(j["title"]) in text
    ]
    return candidates[0] if len(candidates) == 1 else None
