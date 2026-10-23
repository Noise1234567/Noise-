"""Lecture et écriture du classeur NOISE_Prospection_Cotonou.xlsx.

Le script n'écrit que des saisies (notes, persona, textes, statuts). Score, priorité
et tableau de bord restent calculés par les formules du classeur.
"""

from copy import copy
from dataclasses import dataclass

from noise_scoring import config
from noise_scoring.text import header_key


class MissingColumns(Exception):
    def __init__(self, sheet, headers):
        self.sheet = sheet
        self.headers = headers
        super().__init__(f"onglet {sheet} : colonnes absentes : " + ", ".join(headers))


@dataclass
class ProspectRow:
    prospect_id: str
    row: int
    text: str


def find_columns(ws, wanted):
    """Associe chaque clé au numéro de la première colonne dont l'en-tête commence par le préfixe."""
    headers = {
        cell.column: header_key(cell.value) for cell in ws[config.HEADER_ROW] if cell.value
    }
    found, missing = {}, []
    for key, prefix in wanted.items():
        target = header_key(prefix)
        column = next((col for col, header in headers.items() if header.startswith(target)), None)
        if column is None:
            missing.append(prefix)
        else:
            found[key] = column
    if missing:
        raise MissingColumns(ws.title, missing)
    return found


def prepare(wb):
    """Ajoute à droite des en-têtes existants les colonnes dont l'analyse a besoin.

    Ne touche à aucune colonne existante. Renvoie la liste des en-têtes ajoutés.
    """
    added = []
    for sheet_name, new_headers in config.NEW_HEADERS.items():
        ws = wb[sheet_name]
        wanted = config.PROSPECTS_COLUMNS if sheet_name == config.PROSPECTS_SHEET else config.SCORES_COLUMNS
        try:
            find_columns(ws, wanted)
            continue
        except MissingColumns as error:
            missing_prefixes = {header_key(p) for p in error.headers}
        last = max(cell.column for cell in ws[config.HEADER_ROW] if cell.value)
        model_cell = ws.cell(row=config.HEADER_ROW, column=last)
        for key, header in new_headers.items():
            if header_key(wanted[key]) not in missing_prefixes:
                continue
            last += 1
            cell = ws.cell(row=config.HEADER_ROW, column=last, value=header)
            # Même apparence que les autres en-têtes.
            cell.font = copy(model_cell.font)
            cell.fill = copy(model_cell.fill)
            cell.border = copy(model_cell.border)
            cell.alignment = copy(model_cell.alignment)
            added.append(f"{sheet_name} / {header}")
    return added


def rows_to_analyze(wb):
    """Lignes de Prospects marquées « À analyser », hors exemples fictifs."""
    ws = wb[config.PROSPECTS_SHEET]
    cols = find_columns(ws, config.PROSPECTS_COLUMNS)
    wanted_status = header_key(config.STATUS_TO_ANALYZE)
    rows = []
    for row in range(config.FIRST_DATA_ROW, ws.max_row + 1):
        prospect_id = _text(ws.cell(row, cols["id"]).value)
        if not prospect_id or header_key(ws.cell(row, cols["status"]).value) != wanted_status:
            continue
        if _is_example(prospect_id, ws.cell(row, cols["example"]).value):
            continue
        rows.append(ProspectRow(prospect_id, row, _text(ws.cell(row, cols["observations"]).value)))
    return rows


def write_analysis(wb, prospect, analysis):
    """Écrit les notes et textes dans Scores, puis passe la ligne Prospects à « À jour »."""
    ws = wb[config.SCORES_SHEET]
    cols = find_columns(ws, config.SCORES_COLUMNS)
    row = _scores_row(ws, cols, prospect.prospect_id)
    values = {
        **analysis.notes,
        "persona": analysis.persona,
        "persona_quote": analysis.persona_quote,
        "advantages": _format_items(analysis.advantages),
        "drawbacks": _format_items(analysis.drawbacks),
        "justification": analysis.justification,
        "unknowns": analysis.unknowns,
        "ai_confidence": analysis.confidence,
        "review": _review_text(analysis),
    }
    for key, value in values.items():
        # None doit effacer la cellule : une valeur inconnue reste vide, jamais une ancienne note.
        # ws.cell(row, col, None) ne le fait pas (openpyxl ignore None), d'où l'affectation de .value.
        ws.cell(row, cols[key]).value = value
    _set_status(wb, prospect, config.STATUS_UP_TO_DATE)


def write_error(wb, prospect, message):
    """Passe la ligne en Erreur et note la raison dans la colonne Relecture de Scores."""
    ws = wb[config.SCORES_SHEET]
    cols = find_columns(ws, config.SCORES_COLUMNS)
    row = _scores_row(ws, cols, prospect.prospect_id)
    ws.cell(row, cols["review"], f"Erreur : {message}")
    _set_status(wb, prospect, config.STATUS_ERROR)


def _scores_row(ws, cols, prospect_id):
    """Ligne de Scores du prospect ; à défaut, la première ligne sans ID, où l'ID est écrit."""
    first_empty = None
    for row in range(config.FIRST_DATA_ROW, ws.max_row + 1):
        value = _text(ws.cell(row, cols["id"]).value)
        if value == prospect_id:
            return row
        if not value and first_empty is None:
            first_empty = row
    row = first_empty or ws.max_row + 1
    ws.cell(row, cols["id"], prospect_id)
    return row


def _set_status(wb, prospect, status):
    ws = wb[config.PROSPECTS_SHEET]
    cols = find_columns(ws, config.PROSPECTS_COLUMNS)
    ws.cell(prospect.row, cols["status"], status)


def _format_items(items):
    if not items:
        return None
    return "\n".join(f"- {item.point} (« {item.quote} »)" for item in items)


def _review_text(analysis):
    if not analysis.needs_review:
        return None
    return f"{config.REVIEW_FLAG} : " + " ; ".join(analysis.review_reasons)


def _is_example(prospect_id, example_flag):
    return prospect_id.upper().startswith(config.EXAMPLE_ID_PREFIX) or header_key(example_flag) == "oui"


def _text(value):
    return "" if value is None else str(value).strip()
