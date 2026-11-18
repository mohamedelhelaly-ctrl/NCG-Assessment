import pytest

from app.core.i18n import parse_lang, pick


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        (None, "en"),
        ("", "en"),
        ("ar", "ar"),
        ("AR", "ar"),
        ("ar-KW,ar;q=0.9,en;q=0.8", "ar"),
        ("en-US,en;q=0.9,ar;q=0.8", "en"),  # only the first language counts
        ("fr", "en"),
        ("garbage;;;", "en"),
        ("arabic", "en"),  # not a language tag
    ],
)
def test_parse_lang(header, expected):
    assert parse_lang(header) == expected


def test_pick_uses_arabic_only_in_arabic_view_and_only_when_present():
    assert pick("en", "Gauze", "شاش") == "Gauze"
    assert pick("ar", "Gauze", "شاش") == "شاش"
    assert pick("ar", "Gauze", None) == "Gauze"
    assert pick("ar", "Gauze", "") == "Gauze"
    assert pick("ar", "Gauze", "   ") == "Gauze"
