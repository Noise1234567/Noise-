"""Formules du brief (sections 5.1, 5.3, 5.6 et 5.7).

Le classeur calcule lui-même score, priorité et risque par formules. Ces fonctions
en sont la référence : le script les utilise pour son résumé, et les tests vérifient
qu'elles donnent les mêmes résultats que le brief (cas de contrôle : 79).
"""

from noise_scoring.config import OUT_OF_TARGET, UNDETERMINED

WEIGHTS = {"pc": 30, "i": 25, "r": 20, "n": 15, "f": 10}

PRIORITY_THRESHOLDS = (
    (80, "Très élevée"),
    (65, "Élevée"),
    (45, "Moyenne"),
    (0, "Basse"),
)

RISK_THRESHOLDS = (
    (3, "Critique"),
    (2, "Élevé"),
    (1, "Moyen"),
    (0, "Faible"),
)


def compute_score(pc, i, r, n, f):
    """S = 30×Pc/100 + 25×I/5 + 20×R/5 + 15×N/5 + 10×F/5, ou None si une note manque."""
    if None in (pc, i, r, n, f):
        return None
    score = (
        WEIGHTS["pc"] * pc / 100
        + WEIGHTS["i"] * i / 5
        + WEIGHTS["r"] * r / 5
        + WEIGHTS["n"] * n / 5
        + WEIGHTS["f"] * f / 5
    )
    return round(score, 2)


def priority(score, persona):
    """Priorité selon les règles de la section 5.6, appliquées avant les seuils."""
    if score is None:
        return None
    if persona == OUT_OF_TARGET:
        return "Hors cible"
    level = next(label for minimum, label in PRIORITY_THRESHOLDS if score >= minimum)
    # Sans persona prouvé, pas de priorité au-dessus de Moyenne.
    if persona == UNDETERMINED and level in ("Très élevée", "Élevée"):
        return "Moyenne"
    return level


def risk_score(pe, g):
    """Q = Pe/100 × G, de 0 à 5, ou None si une note manque."""
    if pe is None or g is None:
        return None
    return round(pe / 100 * g, 2)


def risk_level(q):
    """Seuils proposés dans le brief (section 5.7), encore à valider."""
    if q is None:
        return None
    return next(label for minimum, label in RISK_THRESHOLDS if q >= minimum)
