import pytest
from app import store, sources
from app.main import CV_NAMES


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA", tmp_path)
    store.init()
    (tmp_path / "cvs" / CV_NAMES["developer-en"]).write_bytes(b"%PDF-fixture")


def add_job(
    title="Junior React Developer", location="Lisbon", description="React JavaScript"
):
    ident, _ = sources.upsert_job(
        dict(
            title=title,
            company=title,
            location=location,
            description=description,
            url="https://example.test/" + title.replace(" ", "-"),
            source="Fixture",
        ),
        manual=True,
    )
    return ident


def test_prepares_once_without_approval_and_preserves_edits(workspace):
    from app.preparation import prepare_matches

    ident = add_job()
    assert prepare_matches(CV_NAMES) == 1
    job = store.query("SELECT * FROM jobs WHERE id=?", (ident,))[0]
    assert job["status"] == "draft" and job["cv"] == "developer-en"
    assert job["draft"] and job["approval"] is None
    store.execute("UPDATE jobs SET draft=? WHERE id=?", ("My edits", ident))
    assert prepare_matches(CV_NAMES) == 0
    assert (
        store.query("SELECT draft FROM jobs WHERE id=?", (ident,))[0]["draft"]
        == "My edits"
    )


def test_prepares_uncertain_roles_and_preserves_flags(workspace):
    from app.preparation import prepare_matches

    senior = add_job("Senior React Developer")
    add_job("Junior Python Developer", "Remote", "Python")
    add_job("Junior React Engineer", description="React JavaScript Docker")
    assert prepare_matches(CV_NAMES) == 3
    job = store.job_view(store.query("SELECT * FROM jobs WHERE id=?", (senior,))[0])
    assert job["analysis"]["flags"] and job["approval"] is None


def test_pause_is_respected_but_missing_cv_does_not_block_drafting(workspace):
    from app.preparation import prepare_matches

    ident = add_job()
    store.save("automation", False)
    assert prepare_matches(CV_NAMES) == 0
    store.save("automation", True)
    (store.DATA / "cvs" / CV_NAMES["developer-en"]).unlink()
    assert prepare_matches(CV_NAMES) == 1
    assert (
        store.query("SELECT status FROM jobs WHERE id=?", (ident,))[0]["status"]
        == "draft"
    )


def test_prepares_all_new_and_saved_jobs(workspace):
    from app.preparation import prepare_matches

    for i in range(7):
        add_job("Junior React Developer " + str(i))
    ident = add_job("Junior React Saved")
    store.execute("UPDATE jobs SET status='saved' WHERE id=?", (ident,))
    assert prepare_matches(CV_NAMES) == 8
    assert (
        store.query("SELECT status FROM jobs WHERE id=?", (ident,))[0]["status"]
        == "draft"
    )


def test_support_cv_and_archived_jobs(workspace):
    from app.preparation import prepare_matches

    ident = add_job("Technical Support")
    archived = add_job("Junior Archived Developer")
    store.execute("UPDATE jobs SET status='archived' WHERE id=?", (archived,))
    assert prepare_matches(CV_NAMES) == 1
    assert (
        store.query("SELECT cv FROM jobs WHERE id=?", (ident,))[0]["cv"] == "general-en"
    )
    assert (
        store.query("SELECT draft FROM jobs WHERE id=?", (archived,))[0]["draft"]
        is None
    )
