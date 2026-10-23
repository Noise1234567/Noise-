"""Enchaînement d'une analyse : lire, masquer, interroger, valider, écrire.

Le modèle est passé en paramètre (ask_model) : en vrai c'est OllamaClient, dans les
tests c'est une fausse fonction qui renvoie une réponse écrite à l'avance.
"""

from dataclasses import dataclass, field

from noise_scoring import config
from noise_scoring.model import ModelUnavailable, build_messages
from noise_scoring.scoring import compute_score, priority, risk_level, risk_score
from noise_scoring.text import mask_private_data
from noise_scoring.validation import InvalidResponse, validate_response
from noise_scoring.workbook import rows_to_analyze, write_analysis, write_error


@dataclass
class Report:
    up_to_date: list = field(default_factory=list)
    to_review: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    lines: list = field(default_factory=list)
    stopped: str | None = None


def analyze_workbook(wb, ask_model, limit=None):
    report = Report()
    rows = rows_to_analyze(wb)
    if limit is not None:
        rows = rows[:limit]
    for prospect in rows:
        if not prospect.text.strip():
            write_error(wb, prospect, "aucune observation à analyser")
            report.errors.append(prospect.prospect_id)
            report.lines.append(f"{prospect.prospect_id} : Erreur, colonne des observations vide")
            continue
        # Le texte masqué est à la fois envoyé au modèle et utilisé pour vérifier les citations.
        text = mask_private_data(prospect.text)[: config.MAX_OBSERVATIONS_LENGTH]
        try:
            raw = ask_model(build_messages(text))
            analysis = validate_response(raw, text)
        except ModelUnavailable as error:
            # Inutile d'insister sur les lignes suivantes : on s'arrête proprement.
            report.stopped = str(error)
            break
        except InvalidResponse as error:
            write_error(wb, prospect, str(error))
            report.errors.append(prospect.prospect_id)
            report.lines.append(f"{prospect.prospect_id} : Erreur, {error}")
            continue
        write_analysis(wb, prospect, analysis)
        target = report.to_review if analysis.needs_review else report.up_to_date
        target.append(prospect.prospect_id)
        report.lines.append(_summary(prospect.prospect_id, analysis))
    return report


def _summary(prospect_id, analysis):
    notes = analysis.notes
    score = compute_score(notes["pc"], notes["i"], notes["r"], notes["n"], notes["f"])
    q = risk_score(notes["pe"], notes["g"])
    parts = [
        f"{prospect_id} : {analysis.persona}",
        f"S {score if score is not None else 'vide'}",
        f"priorité {priority(score, analysis.persona) or 'vide'}",
        f"Q {q if q is not None else 'vide'} ({risk_level(q) or 'vide'})",
        f"confiance {analysis.confidence or 'vide'}",
    ]
    if analysis.needs_review:
        parts.append(config.REVIEW_FLAG)
    return ", ".join(parts)
