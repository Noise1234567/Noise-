import pytest

from conftest import model_answer
from noise_scoring.validation import InvalidResponse, validate_response


def test_valid_answer_is_kept_as_is(long_text):
    analysis = validate_response(model_answer(), long_text)
    assert analysis.persona == "P5"
    assert analysis.notes == {"pc": 70, "i": 4, "r": 5, "n": 4, "f": 3, "pe": 40, "g": 4}
    assert analysis.confidence == "Moyenne"
    assert len(analysis.advantages) == 1
    assert not analysis.needs_review


def test_persona_with_invented_quote_becomes_undetermined_and_pc_is_capped(long_text):
    analysis = validate_response(model_answer(persona_citation="complet en deux heures"), long_text)
    assert analysis.persona == "INDETERMINE"
    assert analysis.persona_quote is None
    assert analysis.notes["pc"] == 40
    assert analysis.needs_review


def test_out_of_target_also_needs_a_quote(long_text):
    analysis = validate_response(model_answer(persona="HORS_CIBLE", persona_citation="mariage privé"), long_text)
    assert analysis.persona == "INDETERMINE"


def test_out_of_target_with_quote_is_accepted(long_text):
    analysis = validate_response(
        model_answer(persona="HORS_CIBLE", persona_citation="Réservez vos places en message privé"),
        long_text,
    )
    assert analysis.persona == "HORS_CIBLE"


def test_unknown_persona_rejects_the_whole_answer(long_text):
    with pytest.raises(InvalidResponse, match="persona inconnu"):
        validate_response(model_answer(persona="P9"), long_text)


@pytest.mark.parametrize("raw", ["pas du JSON", "[1, 2]", None])
def test_unreadable_answer_is_rejected(raw, long_text):
    with pytest.raises(InvalidResponse):
        validate_response(raw, long_text)


def test_advantage_without_quote_is_removed(long_text):
    analysis = validate_response(
        model_answer(avantages=[{"point": "Très connu en ville", "citation": "100 000 abonnés"}]), long_text
    )
    assert analysis.advantages == []
    assert analysis.needs_review


def test_only_three_drawbacks_are_kept(long_text):
    quote = "entrée 5 000 FCFA"
    drawbacks = [{"point": f"Point {n}", "citation": quote} for n in range(5)]
    analysis = validate_response(model_answer(inconvenients=drawbacks), long_text)
    assert [item.point for item in analysis.drawbacks] == ["Point 0", "Point 1", "Point 2"]
    assert analysis.needs_review


def test_unknown_note_stays_empty(long_text):
    analysis = validate_response(model_answer(r=None), long_text)
    assert analysis.notes["r"] is None
    assert analysis.needs_review


@pytest.mark.parametrize("bad", [6, 0, True, "4", 3.5])
def test_out_of_range_or_wrong_type_note_stays_empty(bad, long_text):
    analysis = validate_response(model_answer(i=bad), long_text)
    assert analysis.notes["i"] is None


def test_integer_written_as_float_is_accepted(long_text):
    assert validate_response(model_answer(i=4.0), long_text).notes["i"] == 4


def test_short_text_forces_low_confidence():
    text = "Soirée organisée par Collectif Exemple samedi."
    analysis = validate_response(
        model_answer(confiance="Élevée", persona_citation="organisée par Collectif Exemple", avantages=[]), text
    )
    assert analysis.confidence == "Faible"
    assert analysis.needs_review
