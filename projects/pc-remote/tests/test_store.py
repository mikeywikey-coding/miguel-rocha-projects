import json

import pytest


def test_first_run_generates_a_random_eight_digit_pin(isolated_store):
    config = isolated_store.load_config()
    assert len(config["pin"]) == 8 and config["pin"].isdigit()
    assert config["port"] == 8765
    assert isolated_store.load_config() == config  # kept, not regenerated


def test_existing_config_is_left_alone(isolated_store):
    isolated_store.CONFIG_PATH.write_text(json.dumps({"pin": "917305", "port": 9000}))
    assert isolated_store.load_config() == {"pin": "917305", "port": 9000}


def test_saved_hotkeys_are_trimmed_to_safe_sizes(isolated_store):
    pages = [
        {
            "id": "p" * 100,
            "name": "N" * 50,
            "buttons": [
                {"id": "b" * 100, "label": "L" * 50, "keys": "ctrl+" + "x" * 100},
                {"label": "", "keys": "ctrl+c"},  # no label: dropped
                "not a button",
            ],
        },
        {"name": "", "buttons": []},  # no name: dropped
    ] + [{"name": f"page {n}", "buttons": []} for n in range(30)]

    saved = isolated_store.save_hotkeys(pages)

    # Only the first 20 pages are read, and the unnamed one among them is dropped.
    assert len(saved["pages"]) == 19
    first = saved["pages"][0]
    assert len(first["id"]) == 32 and len(first["name"]) == 20
    assert first["buttons"] == [{"id": "b" * 32, "label": "L" * 24, "keys": ("ctrl+" + "x" * 100)[:64]}]
    assert json.loads(isolated_store.HOTKEYS_PATH.read_text()) == saved


def test_hotkey_pages_must_be_a_list(isolated_store):
    with pytest.raises(ValueError):
        isolated_store.save_hotkeys({"pages": "nope"})


def test_paired_devices_survive_a_restart_but_not_a_pin_change(isolated_store):
    devices = {"a" * 64: {"label": "iPhone", "paired": 1, "seen": 1}}
    isolated_store.save_devices("40718263", devices)

    assert isolated_store.load_devices("40718263") == devices
    assert isolated_store.load_devices("11112222") == {}


def test_a_damaged_devices_file_means_no_paired_devices(isolated_store):
    isolated_store.DEVICES_PATH.write_text("{not json")
    assert isolated_store.load_devices("40718263") == {}
    isolated_store.DEVICES_PATH.write_text(json.dumps({"salt": "zz", "devices": {}}))
    assert isolated_store.load_devices("40718263") == {}
