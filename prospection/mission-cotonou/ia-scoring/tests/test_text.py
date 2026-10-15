from noise_scoring.text import contains_quote, header_key, mask_private_data


def test_emails_and_phone_numbers_are_masked():
    text = "Contact : promo@example.com ou +229 01 97 00 00 00, ou 97000000."
    masked = mask_private_data(text)
    assert "example.com" not in masked
    assert "97" not in masked
    assert masked.count("[numéro masqué]") == 2


def test_short_numbers_are_kept():
    assert mask_private_data("Entrée 5 000 FCFA, 4e édition, 300 places") == (
        "Entrée 5 000 FCFA, 4e édition, 300 places"
    )


def test_quote_is_found_despite_case_spaces_and_apostrophes():
    text = "Soirée  organisée par l’équipe West Side"
    assert contains_quote(text, "ORGANISÉE PAR L'ÉQUIPE west side", min_length=8)


def test_ellipsis_around_a_quote_is_ignored():
    text = "Soirée Neon Vibes, 4e édition, complet la semaine dernière"
    assert contains_quote(text, "« ...4e édition, complet la semaine dernière »", min_length=8)
    assert contains_quote(text, "4e édition, complet…", min_length=8)


def test_invented_quote_is_rejected():
    assert not contains_quote("Soirée organisée par X", "complet en deux heures", min_length=8)


def test_too_short_or_missing_quote_is_rejected():
    assert not contains_quote("Soirée organisée par X", "Soirée", min_length=8)
    assert not contains_quote("Soirée organisée par X", None, min_length=8)


def test_header_key_ignores_accents_and_case():
    assert header_key("  Inconvénients ") == header_key("inconvenients")
