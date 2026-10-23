"""Réglages de l'analyse : modèle local, colonnes du classeur, listes autorisées.

Les règles viennent de ../docs/brief.md (sections 5.1 à 5.9). Si une règle change
dans le brief, elle change ici, et les tests disent ce qui doit suivre.
"""

# Modèle local (Ollama). qwen3:8b pèse 5,2 Go : il tient presque entièrement dans 6 Go de VRAM.
OLLAMA_URL = "http://localhost:11434/api/chat"
DEFAULT_MODEL = "qwen3:8b"
REQUEST_TIMEOUT_SECONDS = 600  # environ 6 mots par seconde sur une RTX 3050, plus le chargement du modèle

# Structure du classeur : en-têtes sur la ligne 4, données à partir de la ligne 5.
HEADER_ROW = 4
FIRST_DATA_ROW = 5
PROSPECTS_SHEET = "Prospects"
SCORES_SHEET = "Scores"
EXAMPLE_ID_PREFIX = "EX-"

# Valeurs de la colonne de statut de l'onglet Prospects.
STATUS_TO_ANALYZE = "À analyser"
STATUS_UP_TO_DATE = "À jour"
STATUS_ERROR = "Erreur"
REVIEW_FLAG = "À RELIRE"

# Personas (brief, section 5.8).
PERSONAS = ("P1", "P2", "P3", "P4", "P5", "P6", "P7")
OUT_OF_TARGET = "HORS_CIBLE"
UNDETERMINED = "INDETERMINE"
ALLOWED_PERSONAS = PERSONAS + (OUT_OF_TARGET, UNDETERMINED)

CONFIDENCE_LEVELS = ("Faible", "Moyenne", "Élevée")
LOW_CONFIDENCE = "Faible"

# Garde-fous.
SHORT_TEXT_THRESHOLD = 200  # en dessous, confiance forcée à Faible
UNDETERMINED_PC_CAP = 40  # Pc maximal quand le persona est indéterminé
MAX_ITEMS = 3  # avantages et inconvénients gardés au plus
MIN_QUOTE_LENGTH = 8  # une citation plus courte ne prouve rien (« soirée »)
MAX_FREE_TEXT_LENGTH = 300  # longueur maximale d'un point, d'une justification
MAX_OBSERVATIONS_LENGTH = 6000  # texte envoyé au modèle, au-delà il est tronqué

# Notes attendues : clé JSON, minimum, maximum.
NOTES = (
    ("pc", 0, 100),
    ("i", 1, 5),
    ("r", 1, 5),
    ("n", 1, 5),
    ("f", 1, 5),
    ("pe", 0, 100),
    ("g", 1, 5),
)

# Colonnes repérées par le début de leur en-tête, sans tenir compte des accents ni de la casse.
# Repérer par le nom plutôt que par la lettre évite de tout casser quand une colonne est ajoutée.
PROSPECTS_COLUMNS = {
    "id": "ID prospect",
    "example": "Exemple fictif",
    "observations": "Observations publiques",
    "status": "Statut analyse IA",
}
SCORES_COLUMNS = {
    "id": "ID prospect",
    "pc": "Pc :",
    "i": "I :",
    "r": "R :",
    "n": "N :",
    "f": "F :",
    "pe": "Pe :",
    "g": "G :",
    "justification": "Justification",
    "unknowns": "Inconnues",
    "persona": "Persona",
    "persona_quote": "Citation du persona",
    "advantages": "Avantages",
    "drawbacks": "Inconvénients",
    "ai_confidence": "Confiance IA",
    "review": "Relecture",
}

# En-têtes complets créés par la commande --preparer quand ils manquent.
NEW_HEADERS = {
    PROSPECTS_SHEET: {
        "observations": "Observations publiques collées",
        "status": "Statut analyse IA",
    },
    SCORES_SHEET: {
        "pe": "Pe : probabilité d'échec (0 à 100)",
        "g": "G : gravité en cas d'échec (1 à 5)",
        "persona": "Persona",
        "persona_quote": "Citation du persona",
        "advantages": "Avantages",
        "drawbacks": "Inconvénients",
        "ai_confidence": "Confiance IA",
        "review": "Relecture",
    },
}
