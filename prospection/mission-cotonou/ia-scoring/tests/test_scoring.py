import pytest

from noise_scoring.scoring import compute_score, priority, risk_level, risk_score


def test_control_case_of_the_brief_gives_79():
    assert compute_score(70, 4, 5, 4, 3) == 79


def test_score_bounds_are_14_and_100():
    assert compute_score(0, 1, 1, 1, 1) == 14
    assert compute_score(100, 5, 5, 5, 5) == 100


def test_missing_note_leaves_the_score_empty():
    assert compute_score(70, 4, None, 4, 3) is None


@pytest.mark.parametrize(
    ("score", "expected"),
    [(80, "Très élevée"), (79.99, "Élevée"), (65, "Élevée"), (64, "Moyenne"), (45, "Moyenne"), (44, "Basse")],
)
def test_priority_thresholds(score, expected):
    assert priority(score, "P4") == expected


def test_out_of_target_has_its_own_priority():
    assert priority(95, "HORS_CIBLE") == "Hors cible"


def test_undetermined_persona_is_capped_at_medium():
    assert priority(82, "INDETERMINE") == "Moyenne"
    assert priority(70, "INDETERMINE") == "Moyenne"
    assert priority(30, "INDETERMINE") == "Basse"


def test_beginner_with_proven_persona_is_not_capped():
    assert priority(82, "P2") == "Très élevée"


def test_empty_score_gives_empty_priority():
    assert priority(None, "P1") is None


def test_risk_example_of_the_brief():
    q = risk_score(40, 4)
    assert q == 1.6
    assert risk_level(q) == "Moyen"


@pytest.mark.parametrize(("q", "expected"), [(3, "Critique"), (2, "Élevé"), (1, "Moyen"), (0.99, "Faible")])
def test_risk_thresholds(q, expected):
    assert risk_level(q) == expected


def test_missing_risk_note_leaves_q_empty():
    assert risk_score(None, 4) is None
    assert risk_level(None) is None
