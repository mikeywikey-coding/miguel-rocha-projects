from app.engine import (
    canonical_url,
    assess,
    classify_reply,
    match_message,
    draft_letter,
)

PROFILE = {
    "first_name": "Miguel",
    "last_name": "Rocha",
    "skills": ["JavaScript", "Python", "React", "HTML", "CSS", "Blender", "Excel"],
    "support": True,
}


def job(
    title="Junior Frontend Developer",
    location="Lisbon, Portugal",
    description="React and JavaScript",
):
    return dict(
        title=title,
        company="Example",
        location=location,
        description=description,
        url="https://example.com/jobs/1",
    )


def test_tracking_dedup_preserves_job_identifiers():
    assert (
        canonical_url("https://example.com/jobs?job=1&utm_source=x#apply")
        == "https://example.com/jobs?job=1"
    )
    assert canonical_url("https://example.com/jobs?job=1") != canonical_url(
        "https://example.com/jobs?job=2"
    )


def test_entry_level_lisbon_is_relevant():
    result = assess(job(), PROFILE)
    assert result["eligible"] and result["score"] >= 70 and "React" in result["matched"]


def test_senior_not_a_match_even_when_description_mentions_juniors():
    assert not assess(
        job("Senior Software Engineer", description="Mentor junior React developers"),
        PROFILE,
    )["eligible"]


def test_nontechnical_intern_is_not_a_match():
    assert not assess(job("Marketing Intern"), PROFILE)["eligible"]


def test_experienced_roles_are_not_automatically_added():
    assert not assess(
        job("Service Desk Engineer", description="6+ years of experience"), PROFILE
    )["eligible"]
    assert not assess(job("Tier III Service Desk Engineer"), PROFILE)["eligible"]
    assert not assess(
        job("D365 F&O Developer", description="Dynamics administration"), PROFILE
    )["eligible"]


def test_experience_flags_ignore_company_age_and_entry_level_ranges():
    for description in (
        "Our company has over 25 years of solid experience.",
        "Requirements: Less than 3 years of professional experience.",
        "Between 1-3 years of experience in a support role.",
    ):
        result = assess(job(description=description), PROFILE)
        assert not any("years of experience" in flag for flag in result["flags"])
    result = assess(
        job(description="Requires 3+ years of professional experience."), PROFILE
    )
    assert any("years of experience" in flag for flag in result["flags"])


def test_remote_us_only_is_excluded():
    assert not assess(job(location="Remote - US only"), PROFILE)["eligible"]
    assert not assess(
        job(
            location="Remote worldwide",
            description="Applicants must be based in the United States.",
        ),
        PROFILE,
    )["eligible"]
    assert not assess(
        job(
            location="Remote Europe",
            description="Candidates must be located in the United States.",
        ),
        PROFILE,
    )["eligible"]


def test_support_opt_out_applies_to_technical_support_titles():
    profile = {**PROFILE, "support": False}
    assert not assess(job("IT Support Engineer"), profile)["eligible"]
    assert assess(job("Junior Frontend Developer"), profile)["eligible"]


def test_remote_unknown_is_flagged_not_confirmed():
    result = assess(job(location="Remote"), PROFILE)
    assert result["eligible"] and result["location_status"] == "check"


def test_degree_and_enrolment_are_flagged():
    result = assess(
        job(
            description="Must be currently enrolled. Bachelor's degree required. React."
        ),
        PROFILE,
    )
    assert len(result["flags"]) >= 2


def test_rejection_classification_does_not_send_or_apply():
    assert (
        classify_reply(
            "Your application", "Unfortunately we will not be moving forward."
        )
        == "rejection"
    )


def test_company_alone_is_not_enough_for_message_matching():
    jobs = [
        dict(job(), id="1", status="applied"),
        dict(job("Junior Backend Developer"), id="2", status="applied"),
    ]
    assert match_message("Example update", "Thanks for your interest", jobs) is None


def test_unambiguous_company_and_role_matches():
    jobs = [dict(job(), id="1", status="applied")]
    assert (
        match_message(
            "Example: Junior Frontend Developer", "Your application received", jobs
        )
        == "1"
    )


def test_draft_does_not_invent_degree_or_experience():
    text = draft_letter(job(), PROFILE, "en")
    assert (
        "degree" not in text.lower()
        and "years" not in text.lower()
        and "Miguel Rocha" in text
    )


def test_replies_are_sorted_by_what_they_ask_of_the_candidate():
    assert (
        classify_reply(
            "We have received your application!", "Thank you for your interest in Acme."
        )
        == "confirmation"
    )
    assert (
        classify_reply("Recebemos a sua candidatura!", "Olá Miguel") == "confirmation"
    )
    assert (
        classify_reply("¡Hemos recibido tu candidatura!", "Agradecemos tu interés")
        == "confirmation"
    )
    assert (
        classify_reply(
            "Complete the application for Support",
            "Verify your email to complete the application.",
        )
        == "action"
    )
    assert (
        classify_reply(
            "Completa la solicitud para Soporte", "Verifica tu correo electrónico"
        )
        == "action"
    )
    assert (
        classify_reply(
            "Welcome", "We would like to ask you to fill out this application form"
        )
        == "action"
    )
    assert (
        classify_reply(
            "Follow up on your application",
            "At this time, we are moving forward with other candidates whose experience better aligns.",
        )
        == "rejection"
    )
    assert (
        classify_reply(
            "Thank you for your interest!",
            "We felt it wasn't the perfect match for this role.",
        )
        == "rejection"
    )
    assert classify_reply("Start your free trial today", "Claim your credit") == "other"
    assert (
        classify_reply("Next steps", "Could we talk on Tuesday about the role?")
        == "reply"
    )


def test_receipts_that_only_mention_rejection_as_a_possibility_are_confirmations():
    assert (
        classify_reply(
            "Thank you for your application!",
            "Our recruitment team will carefully review yours. Despite our interest in each application, it is difficult for us to respond to all of them. Therefore, if you do not hear from us within three weeks, you can assume that your profile has unfortunately not been selected.",
        )
        == "confirmation"
    )
    assert (
        classify_reply(
            "Thank you for your application to Efficio",
            "We have received your application. Should your background be a match, someone will be in touch. Unfortunately, due to the number of applications we receive, we are unable to provide individual feedback.",
        )
        == "confirmation"
    )
    assert (
        classify_reply(
            "Your application",
            "Unfortunately your application was unsuccessful and we cannot provide individual feedback.",
        )
        == "rejection"
    )
    assert (
        classify_reply(
            "Your application",
            "We have decided to move forward with other candidates. If you do not hear from us about other roles, keep applying.",
        )
        == "rejection"
    )
    assert (
        classify_reply(
            "Noesis | Resposta à tua Candidatura",
            "Após uma avaliação cuidada do teu perfil, decidimos não dar continuidade à próxima fase.",
        )
        == "rejection"
    )
    assert (
        classify_reply(
            "Obrigado pelo teu interesse",
            "Concluímos que, neste momento, a tua experiência não se enquadra nos requisitos desta oportunidade.",
        )
        == "rejection"
    )


def test_platform_profile_notices_and_portuguese_submission_receipts_are_sorted():
    assert (
        classify_reply(
            "Seu perfil com a CVWarehouse foi criado com sucesso",
            "Com a sua candidatura ao emprego Técnico de Helpdesk, criou um perfil na CVWarehouse. A sua password inicial é: x",
        )
        == "other"
    )
    assert (
        classify_reply(
            "Confirmação de Candidatura",
            "Vimos desta forma confirmado que a sua candidatura à posição 'Técnico de Helpdesk' na Lusíadas foi submetida com sucesso.",
        )
        == "confirmation"
    )
    assert (
        classify_reply(
            "Complete your application with Concentrix Portugal",
            "If you wish to continue with your application, please click on the link below",
        )
        == "action"
    )


def test_a_finished_pre_screening_is_a_confirmation():
    assert (
        classify_reply(
            "Application Submission Confirmation",
            "Thank you for completing the pre-screening questions! We are reviewing your responses.",
        )
        == "confirmation"
    )


def test_business_development_is_not_software_development():
    profile = {"skills": ["JavaScript"], "support": True}
    result = assess(
        {
            "title": "Estágio - Comunicação, Eventos e Desenvolvimento de Negócio",
            "location": "Lisboa",
            "description": "Estágio",
        },
        profile,
    )
    assert not result["eligible"]
    assert assess(
        {
            "title": "Estágio em Desenvolvimento Web",
            "location": "Lisboa",
            "description": "JavaScript",
        },
        profile,
    )["eligible"]


def test_long_years_of_experience_asks_are_caught():
    for description in (
        "What you'll bring - 5+ years of professional software engineering experience, with genuine depth.",
        "What We Are Looking For: 5+ years as a software engineer with strong production experience.",
    ):
        result = assess(job("Full Stack Engineer II", description=description), PROFILE)
        assert (
            not result["eligible"]
            and "Listing mentions 5+ years of experience" in result["flags"]
        )
    # Another sentence's "experience" is not part of the ask.
    result = assess(
        job(
            "Full Stack Engineer",
            description="Founded 5 years ago. Great experience for customers.",
        ),
        PROFILE,
    )
    assert not any("years of experience" in flag for flag in result["flags"])


def test_internships_count_but_curricular_ones_and_non_software_roles_do_not():
    assert assess(job("Software Engineering Internship"), PROFILE)["eligible"]
    assert assess(
        job(
            "Programador de Software",
            description="Seniority: Estágio profissional (IEFP). Lisboa",
        ),
        PROFILE,
    )["eligible"]
    for title in (
        "Software Engineering Curricular Internship",
        "Estágio Curricular IT - Lisboa/Híbrido",
    ):
        result = assess(job(title), PROFILE)
        assert (
            not result["eligible"]
            and "Curricular internship: needs current school enrolment"
            in result["flags"]
        )
    for title in (
        "Facilities Engineering & Workplace Intern",
        "Analog/Mixed-Signal IC Design Engineering Intern",
        "JUNIOR PARTNERSHIP DEVELOPER - INTERNSHIP",
    ):
        assert not assess(job(title), PROFILE)["eligible"], title


def test_a_language_that_is_a_plus_is_not_a_requirement():
    plus = assess(
        job(
            "Order Support Specialist",
            description="Fluent in English, Italian and French a plus.",
        ),
        PROFILE,
    )
    assert not any("language requirement" in f for f in plus["flags"])
    needed = assess(
        job("Order Support Specialist", description="Fluent in Italian and English."),
        PROFILE,
    )
    assert "Check Italian language requirement" in needed["flags"]


def test_a_stated_mid_level_is_above_junior():
    assert not assess(
        job(
            "Full-Stack Engineer - React",
            description="Seniority: Mid-Senior Level. Engineering",
        ),
        PROFILE,
    )["eligible"]
    assert not assess(job("Mid Fullstack Java/React Developer"), PROFILE)["eligible"]
    assert assess(
        job("Service Desk Analyst", description="Seniority: Entry Level."), PROFILE
    )["eligible"]


def test_coordinators_and_supervisors_are_above_junior():
    assert not assess(job("Coordenador informática helpdesk (M/F)"), PROFILE)[
        "eligible"
    ]
    assert not assess(job("IT Support Supervisor"), PROFILE)["eligible"]


def test_recruiters_cleaning_and_intermediate_roles_are_not_junior_it_roles():
    for title in (
        "IT Talent Acquisition",
        "International IT Recruiter | Delivery",
        "Support & Cleaning",
        "Intermediate .NET Developer",
    ):
        assert not assess(job(title), PROFILE)["eligible"], title
    assert assess(job("Celfocus Academy | Application Security Trainee"), PROFILE)[
        "eligible"
    ]


def test_a_language_named_in_its_own_tongue_is_a_requirement():
    for title, language in (
        ("Customer Support Nederlandstalig - Lissabon", "Dutch"),
        ("Conseiller Clientèle Francophone", "French"),
        ("Suporte Técnico com Alemão", "German"),
    ):
        assert (
            f"Check {language} language requirement"
            in assess(job(title), PROFILE)["flags"]
        ), title
    # A country in the title is not a language requirement.
    assert not any(
        "language requirement" in f
        for f in assess(job("IT Support Engineer - Germany office"), PROFILE)["flags"]
    )


def test_a_place_abroad_in_the_title_is_where_the_job_is():
    assert not assess(job("Data Engineer (Brussels)", location=""), PROFILE)["eligible"]
    assert not assess(
        job("Junior Developer - Berlin", location="Not specified"), PROFILE
    )["eligible"]
    assert assess(job("Junior Developer (Lisbon or Brussels)", location=""), PROFILE)[
        "eligible"
    ]
    assert assess(job("Junior Developer (Brussels)", location="Lisboa, PT"), PROFILE)[
        "eligible"
    ]
    assert not assess(job("Cybersecurity Expert"), PROFILE)["eligible"]


def test_internships_and_entry_programmes_count_as_junior():
    for title in (
        "Estagiária de Desenvolvimento Web",
        "Software Engineering Interns 2027",
        "Deloitte Hello World IT 26/27 - New Grad",
        "Early Careers Software Engineer",
        "IT Apprentice",
        "Academia de Programação - Developer",
        "Estágio Extracurricular em Engenharia Informática",
    ):
        result = assess(job(title), PROFILE)
        assert (
            result["eligible"] and "Junior / internship title" in result["reasons"]
        ), title
    # Only a curricular internship needs enrolment; one also offered as a professional internship does not.
    assert not assess(job("Estágio Curricular IT"), PROFILE)["eligible"]
    assert assess(job("Estágio Curricular ou Profissional - Programador"), PROFILE)[
        "eligible"
    ]
    assert assess(
        job(
            "Estágio em Desenvolvimento",
            description="Estágio profissional ou estágio curricular.",
        ),
        PROFILE,
    )["eligible"]
    assert not assess(
        job(
            "Estágio em Desenvolvimento",
            description="Estágio curricular para estudantes.",
        ),
        PROFILE,
    )["eligible"]


def test_sales_engineers_sell_rather_than_build_software():
    assert not assess(job("Solar Sales Engineer Trainee"), PROFILE)["eligible"]
    assert assess(job("Software Engineer Trainee"), PROFILE)["eligible"]


def test_a_letter_stays_untouched_when_the_board_recases_the_title():
    from app.engine import draft_letter, untouched

    listing = job("Software Developer - Backend API Services")
    listing["company"] = "Intermedia"
    listing["draft"] = draft_letter(listing, PROFILE, "en")
    assert untouched(
        dict(listing, title="Software developer - backend api services"), PROFILE
    )
    assert not untouched(
        dict(listing, draft=listing["draft"] + "\nP.S. I love your product."), PROFILE
    )


def test_receipts_that_describe_the_process_or_link_their_questions_are_confirmations():
    assert (
        classify_reply(
            "Thank you for applying to Tabby",
            "We've received your application. Even if this position isn't the perfect fit, keep an eye on our career page.",
        )
        == "confirmation"
    )
    assert (
        classify_reply(
            "CELFOCUS | Thank you! We have received your application!",
            "Our recruitment process usually comprises of CV screening, Talent Acquisition Interview, Technical Interview and finally, a decision.",
        )
        == "confirmation"
    )
    assert (
        classify_reply(
            "Hira Talent : We have received your application!",
            "We will review your application. Show questions: https://hiratalent.teamtailor.com/questionnaires/2f2f/a484",
        )
        == "confirmation"
    )
    assert (
        classify_reply(
            "Interview invitation",
            "We would like to invite you to an interview. Please share your availability for next week.",
        )
        == "interview"
    )
    assert (
        classify_reply(
            "Thanks for your application",
            "We have received your application. Please complete the technical test using the link below; it expires in 5 days.",
        )
        == "assessment"
    )


def test_a_reply_naming_only_the_employer_belongs_to_its_one_open_application():
    jobs = [
        dict(job(), id="1", status="applied", company="Cofinpro"),
        dict(
            job("Junior Backend Developer"),
            id="2",
            status="applied",
            company="Acme Labs",
        ),
    ]
    body = "Dear Miguel, Thank you for your application to Cofinpro. After carefully reviewing your application documents, we regret to inform you that we are unable to take your application forward."
    assert match_message("Your application at Cofinpro", body, jobs) == "1"
    assert classify_reply("Your application at Cofinpro", body) == "rejection"
    # Two open applications at the employer: the role must be named.
    jobs.append(
        dict(job("Junior Java Developer"), id="3", status="applied", company="Cofinpro")
    )
    assert match_message("Your application at Cofinpro", body, jobs) is None


def test_a_sponsorship_refusal_is_a_rejection():
    body = "After carefully reviewing your profile, we truly appreciate your experience. Regrettably we're currently unable consider you for the position right now due having limitations around visa sponsorship."
    assert classify_reply("Thank you for your interest in Mollie!", body) == "rejection"
    assert (
        classify_reply(
            "Thanks for applying",
            "We have received your application. Regrettably, we cannot respond to every applicant individually.",
        )
        == "confirmation"
    )


def test_an_employer_with_a_name_in_two_scripts_is_matched_by_its_latin_part():
    jobs = [
        dict(
            job("ServiceDesk Engineer"),
            id="t",
            status="applied",
            company="Tabby | تابي",
        )
    ]
    body = "Hi Miguel, Thanks for considering our ServiceDesk Engineer opening at Tabby. However, we feel other candidates align more closely with our current needs."
    assert match_message("Thank you for considering Tabby!", body, jobs) == "t"
    assert classify_reply("Thank you for considering Tabby!", body) == "rejection"


def test_towns_around_lisbon_count_and_porto_does_not():
    for place in ("Sacavém, Lisboa", "Porto Salvo", "Linda-a-Velha", "Odivelas"):
        assert (
            assess(job(location=place), PROFILE)["location_status"] == "confirmed"
        ), place
    assert assess(job(location="porto"), PROFILE)["location_status"] != "confirmed"


def test_a_reply_signed_with_the_short_employer_name_finds_its_application():
    jobs = [
        dict(
            id="veeam",
            company="Veeam Software",
            title="Software Developer in Test (Python)",
            status="applied",
        ),
        dict(id="other", company="Acme", title="Support Engineer", status="applied"),
    ]
    body = "Thank you for your interest in the Software Developer in Test (Python) role at Veeam! We have received your application."
    assert match_message("Thank you for applying to Veeam!", body, jobs) == "veeam"


def test_customer_care_it_is_a_support_role():
    assert (
        assess(
            job(
                "Técnico de Customer Care IT - 140",
                description="Suporte de microinformática",
            ),
            PROFILE,
        )["category"]
        == "support"
    )


AREAS = ["content", "platforms", "marketing", "sales", "admin"]


def test_chosen_areas_bring_their_entry_roles_in():
    profile = {**PROFILE, "areas": AREAS}
    for title, category in (
        ("Content Moderator - Portuguese Market", "content"),
        ("Trust & Safety Analyst", "content"),
        ("AI Data Annotator (Portuguese)", "content"),
        ("Junior SAP Consultant", "development"),
        ("OutSystems Academy", "development"),
        ("Tibco júnior", "development"),
        ("Marketing Intern", "marketing"),
        ("Assistente de Marketing", "marketing"),
        ("Graduate Program, Marketing", "marketing"),
        ("Sales Development Representative", "sales"),
        ("Junior Account Manager", "sales"),
        ("Business Development Intern", "sales"),
        ("Assistente Administrativo(a) - Lisboa", "admin"),
        ("KYC Analyst", "admin"),
        ("Gestor/a de Backoffice", "admin"),
        ("AML Trainee - Academy Program", "admin"),
    ):
        result = assess(job(title, description=""), profile)
        assert result["eligible"] and result["category"] == category, title
        assert not assess(job(title, description=""), PROFILE)[
            "eligible"
        ], title  # only with the area chosen
    assert (
        "Chosen search area: sales & business development"
        in assess(job("Sales Development Representative", description=""), profile)[
            "reasons"
        ]
    )


def test_experienced_marketing_and_sales_roles_and_non_jobs_stay_out():
    profile = {**PROFILE, "areas": AREAS}
    for title in (
        "Digital Marketing Specialist",
        "Account Executive",
        "Account Manager",
        "Business Developer",
        "Associate Manager, Sales Operations",
        "Senior KYC Analyst",
        "Network Marketing - Rendimento Extra",
        "Comercial Porta a Porta",
        "Sales Associate - Lisbon Store",
        "Estágio Profissional | LOGÍSTICA - Veículos Comerciais",
        "Estágio IEFP de Engenharia – After-Sales Specialist",
        "Estágio (EXCLUSIVO PARA ALUNOS ULUSÓFONA) - Comunicação",
        "IT Recruiter",
        "Marketing Manager",
    ):
        assert not assess(job(title, description=""), profile)["eligible"], title


def test_wording_gaps_in_it_and_support_roles_are_closed():
    for title in (
        "Estágio de Cibersegurança",
        "Technology graduate programme - lisbon",
        "Estágios Profissionais Tecnologia",
        "Gen AI Trainee Program",
        "SecOps - 1ª Linha",
        "DBA Júnior (estágio profissional)",
        "Recém-Graduado IT - Monitorização & Observabilidade",
        "Associate Data Engineer",
        "Atendimento ao Cliente - Rent-a-Car",
        "Client Services Associate (Entry Level)",
        "Assistente de Contact Center",
        "Customer Success Associate",
    ):
        assert assess(job(title, description=""), PROFILE)["eligible"], title
    assert (
        assess(job("Tecnico de Informatica", description=""), PROFILE)["category"]
        == "support"
    )
    # A customer-facing practice named in a software title does not make it a support role.
    assert not assess(
        job("Salesforce Business Analyst (Customer Experience)", description=""),
        {**PROFILE, "areas": AREAS},
    )["eligible"]
    assert not assess(job("Software Sales Representative", description=""), PROFILE)[
        "eligible"
    ]


def test_further_areas_get_the_general_cv_and_a_client_focused_letter():
    from app.engine import cv_kind

    profile = {**PROFILE, "areas": AREAS}
    listing = job("Content Moderator", description="")
    assert (
        cv_kind(assess(listing, profile)["category"]) == "general"
        and cv_kind("development") == "developer"
        and cv_kind("support") == "general"
    )
    for language, phrase in (
        ("en", "while supporting clients"),
        ("pt", "no apoio a clientes"),
    ):
        text = draft_letter(listing, profile, language)
        assert (
            phrase in text
            and "Excel" in text
            and "Blender" not in text
            and "degree" not in text.lower()
        )
    assert draft_letter(job(), profile, "en") == draft_letter(job(), PROFILE, "en")


def test_jobs_the_areas_must_not_pull_in():
    profile = {**PROFILE, "areas": AREAS}
    for title in (
        "Enfermeiro/a - Atendimento Permanente - Lisboa",
        "Rececionista 2ª (M/F)",
        "Receptionist",
        "assistente comercial (m/f/x) full-time - cascaishopping",
        "assistente comercial (m/f/x) full time - strada",
        "Dinamizador/Promotor de vendas - Tecnologia",
        "Start-up CEO - AI Trainer - Freelance",
        "Salesforce consultants - join our talent community!",
        "Apoio ao cliente| Recrutamento Inclusivo",
        "Factory Squad Specialist",
        "Business Analyst for Credit Risk Stress Testing",
        "Datacenter & Private Cloud Team Leader",
        "Systems Administrator, Platforms & Operations",
        "auxiliar de armazém & backoffice (m/f/x)",
        "Dynamics 365",
    ):
        assert not assess(job(title, description="Excel and Windows"), profile)[
            "eligible"
        ], title
    for title, language in (
        ("Moderátor obsahu (česky mluvící) – Globální e-commerce", "Czech"),
        ("Tartalom moderátor (magyar anyanyelvű)", "Hungarian"),
        ("Agent Back Office - M/F/X - Lisbonne - CDI - Hybride", "French"),
    ):
        assert (
            f"Check {language} language requirement"
            in assess(job(title, description=""), profile)["flags"]
        ), title
    # Santiago do Cacém is in Alentejo, not Cacém near Lisbon; a remote role based in Singapore is not open to Portugal.
    assert not assess(
        job("Assistente Administrativo", location="santiago do cacém"), profile
    )["eligible"]
    assert assess(job("Assistente Administrativo", location="Cacém"), profile)[
        "eligible"
    ]
    assert not assess(
        job("Member of Client Experience, CXM", location="Remote · Singapore"), profile
    )["eligible"]
