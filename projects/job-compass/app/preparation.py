"""Draft every untouched shortlisted job without approving or submitting it."""

from . import store
from .engine import assess, draft_letter


def prepare_matches(cv_names):
    if not store.setting('automation', True):
        return 0
    profile = store.setting('profile')
    prepared = 0
    missing_cv = 0
    for row in store.query("SELECT * FROM jobs WHERE status IN ('new','saved') AND draft IS NULL ORDER BY score DESC,created DESC"):
        analysis = assess(row, profile)
        cv = ('general' if analysis['category'] == 'support' else 'developer') + '-en'
        letter = draft_letter(row, profile, 'en')
        # A concurrent edit, archive or approval must win over preparation.
        with store.db() as connection:
            changed = connection.execute(
                "UPDATE jobs SET draft=?,cv=?,status='draft',approval=NULL,revision=revision+1 "
                "WHERE id=? AND revision=? AND status IN ('new','saved') AND draft IS NULL",
                (letter, cv, row['id'], row['revision']),
            ).rowcount
        prepared += changed
        if changed and not (store.DATA / 'cvs' / cv_names[cv]).is_file():
            missing_cv += changed
    if prepared:
        store.event(f'Prepared {prepared} applications for review. {missing_cv} need a CV file before approval. Nothing approved or submitted.')
    return prepared
