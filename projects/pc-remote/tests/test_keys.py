import pytest

import keys


@pytest.mark.parametrize(
    ("spec", "expected"),
    [
        ("ctrl+shift+s", (["ctrl", "shift"], "s")),
        ("win+d", (["cmd"], "d")),
        ("alt+f4", (["alt"], "f4")),
        ("pgup", ([], "page_up")),
        ("Ctrl+Alt+Delete", (["ctrl", "alt"], "delete")),
        ("+", ([], "+")),
        ("ctrl++", (["ctrl"], "+")),
        ("ctrl+=", (["ctrl"], "=")),
    ],
)
def test_hotkeys_parse_into_modifiers_and_a_key(spec, expected):
    assert keys.parse_hotkey(spec) == expected


@pytest.mark.parametrize(
    ("spec", "error"),
    [
        ("", "empty hotkey"),
        ("   ", "empty hotkey"),
        ("hyper+x", "unknown modifier"),
        ("ctrl+notakey", "unknown key"),
        ("x" * (keys.MAX_SPEC_LENGTH + 1), "too long"),
    ],
)
def test_bad_hotkeys_are_rejected(spec, error):
    with pytest.raises(ValueError, match=error):
        keys.parse_hotkey(spec)


def test_single_keys_resolve_to_names_or_characters():
    assert keys.key_name("Alt") == "alt"
    assert keys.key_name("escape") == "esc"
    assert keys.key_name("7") == "7"
    with pytest.raises(ValueError):
        keys.key_name("f99")
