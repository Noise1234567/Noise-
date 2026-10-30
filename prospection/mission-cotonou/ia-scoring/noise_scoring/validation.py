"""Garde-fous : la réponse du modèle est une proposition, jamais une vérité.

Chaque règle vient du brief (sections 5.5, 5.8, 5.9) et du README de ce dossier.
Principe : en cas de doute, une valeur reste vide et la ligne part en relecture.
"""

import json
from dataclasses import dataclass, field

from noise_scoring import config
from noise_scoring.text import contains_quote


class InvalidResponse(Exception):
    """Réponse inutilisable : la ligne passe en Erreur, rien n'est écrit dans les notes."""


@dataclass
class Item:
    point: str
    quote: str


@dataclass
class Analysis:
    notes: dict
    persona: str
    persona_quote: str | None
    advantages: list
    drawbacks: list
    justification: str | None
    unknowns: str | None
    confidence: str | None
    review_reasons: list = field(default_factory=list)

    @property
    def needs_review(self):
        return bool(self.review_reasons)


def validate_response(raw, text):
    """Transforme la réponse brute du modèle en Analysis sûre, ou lève InvalidResponse."""
    try:
        data = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as error:
        raise InvalidResponse("réponse non JSON") from error
    if not isinstance(data, dict):
        raise InvalidResponse("réponse JSON qui n'est pas un objet")

    persona = data.get("persona")
    if persona not in config.ALLOWED_PERSONAS:
        raise InvalidResponse(f"persona inconnu : {persona!r}")

    reasons = []
    notes = _read_notes(data, reasons)

    # Un persona (ou un hors cible) ne vaut que si sa preuve est dans le texte.
    persona_quote = data.get("persona_citation")
    if persona != config.UNDETERMINED and not contains_quote(
        text, persona_quote, config.MIN_QUOTE_LENGTH
    ):
        reasons.append(f"citation du persona {persona} introuvable dans le texte")
        persona = config.UNDETERMINED
    if persona == config.UNDETERMINED:
        persona_quote = None
        reasons.append("persona indéterminé")
        if notes["pc"] is not None and notes["pc"] > config.UNDETERMINED_PC_CAP:
            notes["pc"] = config.UNDETERMINED_PC_CAP

    advantages = _read_items(data.get("avantages"), text, "avantage", reasons)
    drawbacks = _read_items(data.get("inconvenients"), text, "inconvénient", reasons)

    confidence = data.get("confiance")
    if confidence not in config.CONFIDENCE_LEVELS:
        confidence = None
    if len(text.strip()) < config.SHORT_TEXT_THRESHOLD:
        confidence = config.LOW_CONFIDENCE
    if confidence == config.LOW_CONFIDENCE:
        reasons.append("confiance faible")

    return Analysis(
        notes=notes,
        persona=persona,
        persona_quote=persona_quote.strip() if persona_quote else None,
        advantages=advantages,
        drawbacks=drawbacks,
        justification=_free_text(data.get("justification")),
        unknowns=_free_text(data.get("inconnues")),
        confidence=confidence,
        review_reasons=reasons,
    )


def _read_notes(data, reasons):
    notes = {}
    for key, minimum, maximum in config.NOTES:
        value = data.get(key)
        notes[key] = _bounded_int(value, minimum, maximum)
        if value is not None and notes[key] is None:
            reasons.append(f"note {key} invalide ({value!r}), laissée vide")
    missing = [key for key, value in notes.items() if value is None]
    if missing:
        reasons.append("notes manquantes : " + ", ".join(missing))
    return notes


def _bounded_int(value, minimum, maximum):
    # bool est un sous-type de int en Python : True ne doit pas devenir la note 1.
    if isinstance(value, bool):
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if not isinstance(value, int) or not minimum <= value <= maximum:
        return None
    return value


def _read_items(raw_items, text, label, reasons):
    if raw_items is None:
        return []
    if not isinstance(raw_items, list):
        reasons.append(f"liste des {label}s illisible, ignorée")
        return []
    kept = []
    for raw in raw_items:
        point = raw.get("point") if isinstance(raw, dict) else None
        quote = raw.get("citation") if isinstance(raw, dict) else None
        if not _free_text(point) or not contains_quote(text, quote, config.MIN_QUOTE_LENGTH):
            reasons.append(f"{label} sans citation retrouvée, supprimé")
            continue
        if len(kept) == config.MAX_ITEMS:
            reasons.append(f"plus de {config.MAX_ITEMS} {label}s, les suivants sont ignorés")
            break
        kept.append(Item(point=_free_text(point), quote=quote.strip()))
    return kept


def _free_text(value):
    if not isinstance(value, str) or not value.strip():
        return None
    return value.strip()[: config.MAX_FREE_TEXT_LENGTH]
