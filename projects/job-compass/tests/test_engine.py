from app.engine import canonical_url, assess, classify_reply, match_message, draft_letter

PROFILE = {'first_name':'Miguel','last_name':'Rocha','skills':['JavaScript','Python','React','HTML','CSS','Blender','Excel'],'support':True}

def job(title='Junior Frontend Developer', location='Lisbon, Portugal', description='React and JavaScript'):
    return dict(title=title,company='Example',location=location,description=description,url='https://example.com/jobs/1')

def test_tracking_dedup_preserves_job_identifiers():
    assert canonical_url('https://example.com/jobs?job=1&utm_source=x#apply') == 'https://example.com/jobs?job=1'
    assert canonical_url('https://example.com/jobs?job=1') != canonical_url('https://example.com/jobs?job=2')

def test_entry_level_lisbon_is_relevant():
    result=assess(job(), PROFILE)
    assert result['eligible'] and result['score'] >= 70 and 'React' in result['matched']

def test_senior_not_a_match_even_when_description_mentions_juniors():
    assert not assess(job('Senior Software Engineer',description='Mentor junior React developers'),PROFILE)['eligible']

def test_nontechnical_intern_is_not_a_match():
    assert not assess(job('Marketing Intern'),PROFILE)['eligible']

def test_experienced_roles_are_not_automatically_added():
    assert not assess(job('Service Desk Engineer',description='6+ years of experience'),PROFILE)['eligible']
    assert not assess(job('Tier III Service Desk Engineer'),PROFILE)['eligible']
    assert not assess(job('D365 F&O Developer',description='Dynamics administration'),PROFILE)['eligible']

def test_experience_flags_ignore_company_age_and_entry_level_ranges():
    for description in ('Our company has over 25 years of solid experience.',
                        'Requirements: Less than 3 years of professional experience.',
                        'Between 1-3 years of experience in a support role.'):
        result=assess(job(description=description),PROFILE)
        assert not any('years of experience' in flag for flag in result['flags'])
    result=assess(job(description='Requires 3+ years of professional experience.'),PROFILE)
    assert any('years of experience' in flag for flag in result['flags'])

def test_remote_us_only_is_excluded():
    assert not assess(job(location='Remote - US only'),PROFILE)['eligible']
    assert not assess(job(location='Remote worldwide',description='Applicants must be based in the United States.'),PROFILE)['eligible']
    assert not assess(job(location='Remote Europe',description='Candidates must be located in the United States.'),PROFILE)['eligible']


def test_support_opt_out_applies_to_technical_support_titles():
    profile={**PROFILE,'support':False}
    assert not assess(job('IT Support Engineer'),profile)['eligible']
    assert assess(job('Junior Frontend Developer'),profile)['eligible']

def test_remote_unknown_is_flagged_not_confirmed():
    result=assess(job(location='Remote'),PROFILE)
    assert result['eligible'] and result['location_status']=='check'

def test_degree_and_enrolment_are_flagged():
    result=assess(job(description="Must be currently enrolled. Bachelor's degree required. React."),PROFILE)
    assert len(result['flags']) >= 2

def test_rejection_classification_does_not_send_or_apply():
    assert classify_reply('Your application','Unfortunately we will not be moving forward.')=='rejection'

def test_company_alone_is_not_enough_for_message_matching():
    jobs=[dict(job(),id='1',status='applied'),dict(job('Junior Backend Developer'),id='2',status='applied')]
    assert match_message('Example update','Thanks for your interest',jobs) is None

def test_unambiguous_company_and_role_matches():
    jobs=[dict(job(),id='1',status='applied')]
    assert match_message('Example: Junior Frontend Developer','Your application received',jobs)=='1'

def test_draft_does_not_invent_degree_or_experience():
    text=draft_letter(job(),PROFILE,'en')
    assert 'degree' not in text.lower() and 'years' not in text.lower() and 'Miguel Rocha' in text
