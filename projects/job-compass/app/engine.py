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


# Languages a role may ask for, also as their speakers write them ("Nederlandstalig", "Francophone") and in Portuguese.
LANGUAGES = {
    "french": r"french|francais|frances|francophone|lisbonne|cdi|hybride|spontanee",
    "german": r"german|deutsch\w*|alemao|aleman",
    "dutch": r"dutch|nederlands\w*|flemish|vlaams|neerlandes|holandes",
    "italian": r"italian|italiano|italiana",
    "spanish": r"spanish|espanol|castellano|espanhol|hispanohablante",
    "swedish": r"swedish|svensk\w*|sueco",
    "danish": r"danish|dansk\w*|dinamarques",
    "norwegian": r"norwegian|norsk\w*|noruegues",
    "finnish": r"finnish|suomi|finlandes",
    "polish": r"polish|polski|polaco",
    "czech": r"czech|checo|cesk\w*|cestin\w*",
    "russian": r"russian|russo",
    "turkish": r"turkish|turco",
    "greek": r"greek|grego",
    "hungarian": r"hungarian|hungaro|magyar\w*",
    "romanian": r"romanian|romeno",
    "arabic": r"arabic|arabe",
    "mandarin": r"mandarin|mandarim",
    "chinese": r"chinese|chines",
    "japanese": r"japanese|japones",
    "korean": r"korean|coreano",
    "hebrew": r"hebrew|hebraico",
}

ABROAD = (
    r"\b(?:brussels|bruxelles|paris|amsterdam|rotterdam|berlin|munich|munchen|frankfurt|hamburg|cologne|madrid|barcelona|valencia|london|manchester|dublin|"
    r"warsaw|krakow|wroclaw|prague|brno|vienna|zurich|geneva|milan|rome|turin|stockholm|copenhagen|oslo|helsinki|luxembourg|bucharest|budapest|athens|sofia|"
    r"riga|vilnius|kaunas|tallinn|belgium|france|netherlands|germany|spain|ireland|poland|austria|switzerland|italy|sweden|denmark|norway|finland|romania|"
    r"hungary|greece|bulgaria|latvia|lithuania|estonia|czechia|united kingdom|\buk\b|usa|united states|canada|brazil|india)\b"
)

# Further areas the user chose to search besides development and support (profile "areas", set in Settings), read from the title.
AREAS = {
    # Moderation, trust & safety, ads policy and operations, AI data and language work: next to Meta Business Support.
    "content": r"content (?:moderat\w*|review\w*|analyst|evaluat\w*|specialist|curat\w*)|moderat(?:or|ion)\w*|moderac\w*|moderador\w*|\btrust (?:and |& )?safety|"
    r"integrity (?:analyst|specialist|operations|associate)|\b(?:ads?|advertising) (?:operations|ops|policy|quality|review\w*|specialist|evaluat\w*|analyst)|"
    r"digital ads|policy (?:enforcement|specialist|analyst|review\w*|associate)|annotat\w*|anotador\w*|anotacao|data label\w*|\bai (?:trainer|tutor|data|rater|writer)|"
    r"\brater\b|\b(?:search|internet) (?:quality|evaluat\w*|assessor)|linguist\w*|language (?:specialist|analyst|expert|associate)|locali[sz]ation|localizacao|"
    r"translat(?:or|ion)\w*|tradut\w*|traducao|transcri\w*|legendag\w*|subtitl\w*",
    # Business platforms whose consultancies train juniors in academies: software roles, so they count as development.
    "platforms": r"\bsap\b|salesforce|outsystems|servicenow|service now|dynamics|\bd365\b|power (?:platform|apps|automate)|mulesoft|tibco|mendix|\bpega\b|appian|workday|odoo|netsuite|"
    r"\berp\b|low.code|no.code|sharepoint|\bphc\b",
    "marketing": r"marketing|marketeer|\bseo\b|social media|redes sociais|community manager|\be.?commerce|comercio (?:eletronico|digital)|loja online|online store|marketplace|growth|"
    r"copywrit\w*|content (?:creator|writer|marketing|editor|producer)|criador\w* de conteudo|\bcomunicac\w*|\bcommunications?\b|google ads|paid (?:media|social|search)|"
    r"media buyer|brand (?:ambassador|assistant|activation)|influencer|web content|website (?:editor|content)|wordpress|shopify|digital (?:assistant|specialist|trainee|intern|analyst|content|producer)",
    "sales": r"\bsales\b|\bvendas\b|vendedor\w*|\bcomercia(?:l|is)\b|\bsdr\b|\bbdr\b|business develop\w*|desenvolvimento (?:de )?negocios?|partnerships? (?:develop\w*|sales|intern|associate|specialist)|"
    r"account (?:executive|manager)|pre.?sales|televend\w*|telemarketing|lead generation|key account",
    # Back office, administration and banking operations (KYC, AML, fraud, compliance).
    "admin": r"administrativ\w*|admin (?:assistant|officer|support)|office (?:assistant|administrator|clerk|support)|\bclerk\b|secretari\w*|executive assistant|"
    r"assistente (?:de )?(?:direcao|escritorio|executiv\w*)|back.?office|data entry|introducao de dados|carregamento de dados|"
    r"digitaliza\w*|gestao documental|operations? (?:assistant|associate|specialist|analyst|officer|trainee|intern)|\boperacoes\b|ordering|invoic\w*|fatura\w*|factura\w*|billing|"
    r"\bkyc\b|\baml\b|anti.money|know your customer|due diligence|onboarding (?:analyst|specialist|associate)|fraud\w*|compliance|sinistros|claims (?:handler|assistant|analyst|processor|specialist)",
}
AREA_NAMES = {
    "content": "content & ads operations",
    "platforms": "business platforms",
    "marketing": "digital marketing & e-commerce",
    "sales": "sales & business development",
    "admin": "admin, back office & banking operations",
}
# Marketing and sales roles above entry level ask for experience the user does not have: they need an entry-level title.
ENTRY = {
    "marketing": r"assistant|assistente|auxiliar",
    "sales": r"\bsdr\b|\bbdr\b|development representative|inside sales|representative|representante|assistente comercial|consultor\w* comercia\w*|televend\w*|telemarketing",
}
# Pyramid schemes, door-to-door selling and warehouse work are not what the user chose. Shop-floor selling (shops, malls) is
# retail, after-sales is a technical service, and "veículos comerciais" or "centro comercial" are things, not sales roles.
NOT_AREAS = r"network marketing|marketing de rede|multi.?nivel|multi.?level|\bmlm\b|porta.a.porta|door.to.door|auxiliar de armazem|operador\w* de armazem|warehouse (?:operative|associate|worker|operator)"
NOT_SALES = (
    r"\b(?:loja|lojas|store|stores|shop|boutique|retail)\b|shopping|outlet|\bubbo\b|\bstrada\b|\balegro\b|oeiras parque|(?<!torres do )colombo|vasco da gama|amoreiras|dolce vita|"
    r"\bforum\b|promotor\w*|dinamizador\w*|after.?sales|pos.?venda|veiculos comerciais|centro comercial|direito comercial"
)


def area_of(title, areas, junior):
    """The first chosen further area the title belongs to, at a level the user can apply for."""
    if re.search(NOT_AREAS, title):
        return None
    for area in ("content", "marketing", "sales", "admin"):
        if area not in areas or not re.search(AREAS[area], title):
            continue
        if area == "sales" and re.search(NOT_SALES, title):
            continue
        if area in ENTRY and not junior and not re.search(ENTRY[area], title):
            continue
        return area
    return None


def cv_kind(category):
    """The developer CV for software roles; the general CV for support and the further areas."""
    return "developer" if category == "development" else "general"


def assess(job, profile):
    title = fold(job.get("title", ""))
    location = fold(job.get("location", ""))
    body = fold(plain(job.get("description", "")))
    areas = set(profile.get("areas") or [])
    # Internships and entry programmes count too ("Estagiária", "Interns", "New Grad", "Early Careers", "Academy", "Recém-Graduado").
    junior = bool(
        re.search(
            r"junior|\bjr\b|\binterns?\b|internship|estagio|estagiari[oa]|trainee|apprentice|aprendiz|entry.level|graduate|new.grads?\b|early.careers?|young.talents?|\bacademy\b|\bacademia\b|"
            r"recem.(?:graduad|licenciad|formad|mestr)\w*|new joiners?|\bassociates?\b(?! (?:manager|director|partner|principal|vice|professor))|sem experiencia|no experience (?:required|needed)|"
            r"kickstart|start (?:your|a) career|primeiro emprego|first job|bootcamp|reconversao|"
            # First-line roles ("SecOps - 1ª Linha", "Service Desk L1", "Tier 1") are the entry level of support and operations.
            r"\b1a linha|primeira linha|first.line|1st line|\bl1\b|tier\s*(?:1|i)\b|level\s*(?:1|i)\b|nivel\s*(?:1|i)\b",
            title,
        )
    )
    # Boards that state the level separately (Teamlyzer cards) write it as "Seniority: …".
    level = re.search(r"seniority: ([a-z]+)", body)
    level = level.group(1) if level else ""
    junior = junior or level in (
        "junior",
        "trainee",
        "estagio",
        "entry",
        "internship",
        "intern",
    )
    tech = bool(
        re.search(
            r"developer|engineer|programador|programmer|desenvolv(?!imento (?:de )?(?:negocios?|comercial|pessoal|organizacional))|software|frontend|front.end|backend|back.end|full.stack|"
            r"quality assurance|\bqa\b|\bit\b|informat|web|cyber|application security|information security|security (?:analyst|trainee|intern)",
            title,
        )
    )
    # Entry routes into testing, infrastructure and operations, technology graduate programmes ("Technology New Joiners",
    # "Estágios Profissionais Tecnologia", "Gen AI Trainee Program") and, when chosen, business-platform academies. Only at
    # entry level: generic words like these in an experienced title ("Business Analyst for Credit Risk Stress Testing") are no match.
    if junior and re.search(
        r"\btesters?\b|\btesting\b|test (?:analyst|engineer|automation|specialist)|ciber|\bdba\b|database|base de dados|sysadmin|systems? administrat\w*|administrador de sistemas|"
        r"\bnoc\b|\bsoc\b|secops|devops|\bcloud\b|network (?:engineer|admin\w*|technician|monitoring|operations|security|support|analyst)|tecnico de redes|observabil\w*|"
        r"application management|\btech\b|technology|tecnologia|\bai\b|inteligencia artificial",
        title,
    ):
        tech = True
    if junior and "platforms" in areas and re.search(AREAS["platforms"], title):
        tech = True
    if re.search(
        r"\b(?:civil|structural|mechanical|chemical|estrutural|mecanico|quimico|facilities|electrical|electronics?|eletrotecnic\w*|analog|mixed.signal|ic design|hardware|food|alimentar\w*|textile?|textil)\b",
        title,
    ) and not re.search(r"software|informat|\bit\b", title):
        tech = False
    # A "partnership developer", "business developer" or "sales engineer" sells; it does not write software. Nor does a "software sales representative".
    if re.search(
        r"\b(?:business|partnership|partnerships|sales|commercial)\s+(?:develop|engineer)",
        title,
    ):
        tech = False
    elif re.search(
        r"\bsales\b|\bvendas\b|vendedor|\bcomercia(?:l|is)\b|account (?:executive|manager)|\bsdr\b|\bbdr\b|pre.?sales|televend|telemarketing",
        title,
    ) and not re.search(r"developer|programador|programmer|desenvolvedor", title):
        tech = False
    # Recruiters and cleaning staff are not IT or customer-support roles ("IT Talent Acquisition", "Support & Cleaning"), nor are
    # nurses ("Enfermeiro/a - Atendimento Permanente"), café and shop counter staff ("Empregado de Balcão / Atendimento Cliente") or trades. Talent-community sign-ups are not openings, and inclusive-recruitment
    # roles are reserved for candidates with a disability.
    other = bool(
        re.search(
            r"\b(?:recruiters?|recruitment consultant|talent acquisition|talent sourcer|sourcer|headhunter|recrutador\w*|human resources|recursos humanos|cleaning|cleaner|limpeza|housekeeping|"
            r"enfermeir\w*|nurses?|medic[oa]s?|doctor|farmaceutic\w*|fisioterapeut\w*|dentist\w*|cozinheir\w*|chef|vigilante|eletricista|electricista|canalizador\w*|serralheir\w*|soldador\w*|pedreir\w*|carpinteir\w*|"
            r"empregad[oa]s? de (?:balcao|mesa|bar|restauracao|copa|loja)|balconista|barista|ajudante de cozinha|operador\w* de caixa|cashier|waiter|waitress|"
            r"talent (?:community|pool|network)|bolsa de (?:talentos|candidatos|recrutamento)|recrutamento inclusivo|inclusive (?:recruitment|hiring)|pessoas com deficiencia|with disabilit\w*)\b",
            title,
        )
    )
    if other:
        tech = False
    support = not other and bool(
        re.search(
            r"support|suporte|help.?desk|service.?desk|customer service|customer care|apoio ao cliente|tecnico (?:de )?informatica|tecnico de redes|\bit technician|desktop technician",
            title,
        )
    )
    # Other customer-facing work counts as support, but not as a qualifier in a software, platform or analyst title ("Salesforce Business Analyst (Customer Experience)").
    if (
        not other
        and not tech
        and not re.search(AREAS["platforms"] + r"|analyst|consultant", title)
        and re.search(
            r"customer (?:success|experience|advisor|agent|representative|operations|specialist|associate)|consumer experience|client (?:services?|support|care|experience)|"
            r"apoio ao utilizador|atendimento|call.?cent(?:er|re)|contact.?cent(?:er|re)|teleoperador\w*",
            title,
        )
    ):
        support = True
    area = None if tech or support or other else area_of(title, areas, junior)
    # A stated mid level ("Mid-Senior Level", "Mid Fullstack Developer", "pleno") is above a junior's; a junior's manager title ("Junior Account Manager") is not.
    senior = (
        level
        in (
            "senior",
            "lead",
            "principal",
            "manager",
            "director",
            "executive",
            "mid",
            "intermedio",
        )
        or bool(
            re.search(
                r"senior|\bsr\b|staff|principal|director|head of|lead(?:er)?\b|\bresponsavel\b|\bceo\b|\bcto\b|\bcfo\b|chief|founder|arquiteto|architect|tier\s*(?:iii|3)|level\s*(?:iii|3)|\bmid\b|\bintermediate\b|\bintermedio\b|\bpleno\b|\bexpert\b|coordenador|coordinator|supervisor",
                title,
            )
        )
        or (not junior and "manager" in title)
    )
    remote = bool(re.search(r"remote|remoto|anywhere|worldwide", location))
    # Lisbon and the towns around it, as boards name them ("Porto Salvo", "Sacavém", "Linda-a-Velha").
    lisbon = bool(
        re.search(
            r"lisbon|lisboa|oeiras|amadora|cascais|sintra|almada|loures|odivelas|seixal|barreiro|vila franca de xira|alverca|"
            r"carnaxide|alges|linda.a.velha|paco de arcos|porto salvo|taguspark|queluz|(?<!santiago do )cacem|alfragide|sacavem|prior velho|"
            r"moscavide|estoril|carcavelos|parede\b|miraflores",
            location,
        )
    )
    portugal = bool(re.search(r"portugal|\bpt\b", location))
    broad = bool(
        re.search(
            r"europe|european union|\beu\b|\bemea\b|worldwide|anywhere|global", location
        )
    )
    restricted = bool(
        re.search(
            r"\bus\b|usa|united states|canada|\buk\b|united kingdom|australia|india|germany|france|spain|poland|brazil|romania|netherlands|ireland|italy|belgium|sweden|switzerland|austria|"
            r"singapore|japan|china|hong kong|philippines|mexico|argentina|colombia|chile|new zealand|south africa|dubai|united arab emirates|\buae\b|israel|turkey|ukraine",
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
    # A place abroad named in the title ("Data Engineer (Brussels)") is where the job is, unless Portugal or remote work is named too.
    if (
        not (lisbon or portugal)
        and re.search(ABROAD, title)
        and not re.search(r"lisbon|lisboa|portugal|remote|remoto", title)
    ):
        location_ok = False
        location_unknown = False
    allowed_role = (
        (tech or support or bool(area))
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
    # Curricular internships are part of a degree: only students enrolled at a school can take them.
    # Not an extracurricular one, nor one also offered as a professional internship ("Estágio Curricular/Profissional").
    other_kind = r"extracurricular|extra.curricular|profissional|professional"
    offered = re.search(other_kind, title) or re.search(
        r"estagio (?:extracurricular|extra.curricular|profissional)|(?:professional|extracurricular) internship",
        body,
    )
    # Offers reserved for a school's students ("EXCLUSIVO PARA ALUNOS ULUSÓFONA") need enrolment too.
    students = re.search(
        r"exclusiv\w* (?:para|a) (?:alunos|estudantes)|(?:only|exclusive) for students|students only",
        title,
    )
    if (
        (re.search(r"\bcurricular", title) and not re.search(other_kind, title))
        or (
            re.search(r"estagio curricular|curricular internship", body) and not offered
        )
        or students
    ):
        flags.append("Curricular internship: needs current school enrolment")
        eligible = False
    if re.search(
        r"(?:bachelor|master|degree|licenciatura).{0,45}(?:required|mandatory|obrigat)|(?:require|must have).{0,35}(?:degree|licenciatura)",
        body,
    ):
        flags.append("Degree requirement: course was not completed")
    years = None
    # "5+ years of professional software engineering experience": the ask can run long, but stays in one sentence.
    for candidate in re.finditer(
        r"(?<![\d-])([3-9]|1[0-9])\+?\s*(?:years|anos)[^.;\n]{0,60}?(?:experience|experiencia)",
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
    for language, names in LANGUAGES.items():
        asked = re.search(
            rf"(?:fluent|native|proficien\w*).{{0,20}}\b(?:{names})\b", body
        )
        # "Fluent in English, Italian and French a plus": a language that is a bonus is not a requirement.
        if asked and re.search(
            r"a plus|nice to have|an advantage|is preferred|bonus|mais.valia|valorizad",
            body[asked.start() : asked.end() + 60].split(".")[0],
        ):
            asked = None
        if re.search(rf"\b(?:{names})\b", title) or asked:
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
    if area:
        reasons.append("Chosen search area: " + AREA_NAMES[area])
    # Content and back-office roles are entry level by nature; marketing and sales ones passed with an entry-level title.
    if not junior and not support and not area:
        flags.append("Entry-level suitability needs review")
    score = max(
        0,
        min(
            99,
            35
            + (25 if junior else 0)
            + (20 if location_ok else 0)
            + min(20, 5 * len(matched))
            - (10 if (support or area) and not tech else 0)
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
        category="support" if support else area or "development",
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
    if result["category"] not in ("development", "support"):
        # The further areas lead with client experience and everyday digital tools rather than code.
        tools = ", ".join(result["matched"][:4]) or ", ".join(
            [
                s
                for s in profile.get("skills", [])
                if s in ("Excel", "Word", "PowerPoint", "Outlook")
            ][:3]
            or profile.get("skills", [])[:3]
        )
        if language == "pt":
            return f"Olá equipa da {job['company']},\n\nGostaria de apresentar a minha candidatura à função de {job['title']}. No Meta Business Support, desenvolvi competências de comunicação, documentação e resolução de problemas no apoio a clientes. Trabalho com ferramentas digitais como {tools} e, em projetos pessoais, criei aplicações web e extensões de navegador.\n\nEstou em Lisboa, falo português e inglês (nível C2) e procuro uma oportunidade para contribuir e continuar a aprender.\n\nAgradeço a consideração da minha candidatura.\n{name.strip()}"
        return f"Hello {job['company']} team,\n\nI would like to apply for the {job['title']} position. In Meta Business Support I developed my communication, documentation and problem-solving skills while supporting clients. I work comfortably with digital tools such as {tools}, and my personal projects include web applications and browser extensions.\n\nI am based in Lisbon, speak Portuguese and English (C2 level), and I am looking for an opportunity to contribute while continuing to learn.\n\nThank you for considering my application.\n{name.strip()}"
    if language == "pt":
        return f"Olá equipa da {job['company']},\n\nGostaria de apresentar a minha candidatura à função de {job['title']}. Tenho experiência prática em {skills}, desenvolvida através de projetos pessoais. Criei aplicações web e extensões de navegador e participei num projeto de modelação 3D em Blender.\n\nNo Meta Business Support, desenvolvi competências de comunicação, documentação e resolução de problemas no apoio a clientes. Estou em Lisboa e procuro uma oportunidade para contribuir e continuar a aprender.\n\nAgradeço a consideração da minha candidatura.\n{name.strip()}"
    return f"Hello {job['company']} team,\n\nI would like to apply for the {job['title']} position. My personal projects have given me practical experience with {skills}, including web applications, browser extensions and collaborative Blender modelling work.\n\nMy experience in Meta Business Support developed my communication, documentation and problem-solving skills. I am based in Lisbon and looking for an opportunity to contribute while continuing to learn.\n\nThank you for considering my application.\n{name.strip()}"


def untouched(job, profile):
    """The draft is still the app's own letter, in either language, whatever casing the listing's title has taken
    since it was written (boards re-case titles: "Backend API Services" became "backend api services").
    """
    same = lambda text: re.sub(r"\s+", " ", fold(text or "")).strip()
    return bool(job.get("draft")) and same(job["draft"]) in {
        same(draft_letter(job, profile, lang)) for lang in ("en", "pt")
    }


# Receipts often mention rejection only as a possibility ("if you do not hear from us, assume you were
# not selected") or regret not answering everyone ("unfortunately we cannot give individual feedback").
CONDITIONAL = r"\b(?:even if|mesmo que)\b|\b(?:if|should) you (?:do not|don.?t|have not|haven.?t|did not|didn.?t|not) (?:hear|receive|get)|\bin the absence of (?:a |any )?(?:response|reply|contact)|\b(?:se|caso) nao (?:receb|tiver|obtiver|for(?:es)? contactad|houver)|\bsi no (?:recib|has recibido|obtienes)"
NO_FEEDBACK = r"unable to (?:provide|give|respond|reply|answer)|(?:cannot|can ?not|can.?t|not able to) (?:respond|reply|answer|provide|give)|difficult for us to (?:respond|reply|answer)|individual(?:ised|ized)? feedback|nao (?:conseguimos|podemos|e possivel) (?:responder|dar)"
REJECTION = r"not.{0,30}(?:moving forward|selected|proceed)|unfortunately|unsuccessful|nao.{0,30}(?:avancar|selecionad)|mov(?:e|ing) forward with other|other candidates whose|other candidates (?:who )?(?:align|better|more closely|are a (?:better|closer))|(?:was|is)n.?t the (?:perfect|right) (?:match|fit)|decided (?:not to|to (?:pursue|proceed with) other)|decision not to take your application further|not (?:to )?take your application further|(?:unable|not able) to (?:take|move) your application (?:forward|further)|regret to inform|regrettably|(?:unable|not able) (?:to )?consider you|(?:experiencia|perfil) nao se enquadra|nao iremos avancar|nao dar (?:continuidade|seguimento)|lamentamos informar"


def decided(text):
    """The text without hypothetical rejections, so only an actual decision reads as one."""
    sentences = []
    for sentence in re.split(r"(?<=[.!?;])\s+|\n+", text):
        sentence = re.sub("(?:" + CONDITIONAL + ").*", "", sentence)
        if re.search(NO_FEEDBACK, sentence):
            sentence = re.sub(
                r"\b(?:unfortunately|regrettably|infelizmente|lamentavelmente|lamentablemente)\b",
                "",
                sentence,
            )
        sentences.append(sentence)
    return " ".join(sentences)


# Words that ask the candidate to take part in a step now, not a description of the process ahead.
INVITE = r"schedul|agend|invite you|invitation|convid|your availability|availabilit(?:y|ies) (?:for|to)|disponibilidade para|calendly|time slot|book a (?:time|slot|call)|marcar (?:uma |a )?(?:entrevista|conversa|reuniao)|would like to (?:meet|talk|speak|invite)|gostar(?:iamos|ia) de (?:o |te |lhe )?(?:convidar|conhecer)|please complete|complete (?:the|this|your|our) (?:assessment|test|challenge)|start (?:the|your) (?:assessment|test)|expires|prazo"
RECEIPT = r"application.{0,30}received|received your application|confirmacao de candidatura|application submission confirmation|thank you for completing (the|your) (pre.?screening|application|questions)|candidatura .{0,60}(?:foi )?submetida com sucesso|^application submitted\b|your application (?:has been|was) submitted|confirmacao de rece(?:p|c)cao da candidatura|candidatura (?:foi )?recebida com sucesso|thanks?( you)? for (applying|your application|submitting your application)|candidatura.{0,30}recebida|recebemos a (?:sua|tua) candidatura|hemos recibido (?:tu|su) (?:candidatura|solicitud)|obrigad[oa] pela (sua |tua )?candidatura|registered in our candidate database|resposta automatica|automatic reply|auto.?reply"


def classify_reply(subject, body):
    # Links are not words of the message ("…/questionnaires/…" behind a receipt's "Show questions").
    text = re.sub(r"https?://\S+", " ", fold(subject + " " + body))
    if re.search(REJECTION, decided(text)):
        return "rejection"
    # Something only the candidate can do: confirm their email, fill a follow-up form, give consent.
    if re.search(
        r"verify your e.?mail|complete (?:the|your) application|conclua a candidatura|confirme o seu e.?mail|completa la solicitud|verifica tu correo|fill (?:out|in) (?:this|the|our) (?:application )?form|preencha (?:este|o) (?:curto )?question|questionnaire|consent to (?:collect|process)",
        text,
    ):
        return "action"
    # Not about an application: newsletters, account and password notices, board promotions.
    if re.search(
        r"free trial|recover your password|reset.?password|new login details|perfis como o seu|juntar.se ao nosso portal|portal (do|de) candidatos?|join our candidate portal|set up your candidate (portal|account)|perfil .{0,40}(?:foi )?criado com sucesso|(?:profile|account) (?:has been|was) (?:successfully )?created|password inicial|initial password",
        text,
    ):
        return "other"
    # A receipt that describes the stages ahead ("CV screening, interview, technical test") is still a receipt.
    receipt = re.search(RECEIPT, text)
    if re.search(r"interview|entrevista|schedule a call|agendar.*conversa", text) and (
        not receipt or re.search(INVITE, text)
    ):
        return "interview"
    if re.search(
        r"assessment|coding challenge|technical test|teste tecnico|take.home", text
    ) and (not receipt or re.search(INVITE, text)):
        return "assessment"
    if receipt:
        return "confirmation"
    return "reply"


# Legal forms and generic words around an employer's name ("Veeam Software", "Axians Portugal").
LEGAL = r"\b(lda|limitada|unipessoal|s\.?a|sa|inc|llc|ltd|limited|gmbh|ag|bv|b\.v|srl|sl|plc|group|grupo|portugal|technologies|technology|tech|solutions|software|consulting|labs?)\b"


def match_message(subject, body, jobs):
    # Compared as plain words, so "Tabby | تابي" is found as "Tabby" and punctuation never decides a match.
    plainwords = (
        lambda value: " " + re.sub(r"[^a-z0-9]+", " ", fold(value)).strip() + " "
    )
    core = (
        lambda value: " "
        + " ".join(re.sub(LEGAL, " ", plainwords(value)).split())
        + " "
    )
    text = plainwords(subject + " " + body)
    active = [
        j
        for j in jobs
        if j.get("status") in ("applied", "interview", "assessment")
        and len(plainwords(j["company"]).strip()) > 2
    ]
    # The employer may sign with its name alone ("at Veeam!" for Veeam Software).
    named = (
        lambda j: plainwords(j["company"]) in text
        or len(core(j["company"]).strip()) > 3
        and core(j["company"]) in text
    )
    candidates = [
        j["id"] for j in active if named(j) and plainwords(j["title"]) in text
    ]
    if not candidates:
        # Replies that name only the employer ("Your application at Cofinpro") belong to its one open application.
        candidates = [
            j["id"]
            for j in active
            if len(plainwords(j["company"]).strip()) > 3
            and plainwords(j["company"]) in text
        ]
    return candidates[0] if len(candidates) == 1 else None
