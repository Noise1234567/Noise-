"""Traitements du texte : masquage des données privées, recherche des citations."""

import re
import unicodedata

EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# Au moins 8 chiffres, séparés ou non par des espaces, points ou tirets, avec un + facultatif.
PHONE_PATTERN = re.compile(r"(?<![\w+])\+?\d(?:[\s.\-]?\d){7,}(?!\w)")

_QUOTE_CHARS = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"'})


def mask_private_data(text):
    """Remplace e-mails et numéros de téléphone avant tout envoi au modèle.

    Le modèle n'en a pas besoin pour noter un prospect, et les envoyer serait contraire
    à la règle « aucune information privée ». Un grand nombre (12 000 000) peut être
    masqué à tort : c'est un défaut accepté, plus sûr que l'inverse.
    """
    text = EMAIL_PATTERN.sub("[e-mail masqué]", text)
    return PHONE_PATTERN.sub("[numéro masqué]", text)


def normalize(text):
    """Forme comparable d'un texte : apostrophes et guillemets unifiés, casse et espaces ignorés."""
    text = unicodedata.normalize("NFKC", text).translate(_QUOTE_CHARS)
    return " ".join(text.casefold().split())


def contains_quote(text, quote, min_length):
    """Vrai si la citation figure dans le texte, à la casse et aux espaces près."""
    if not isinstance(quote, str):
        return False
    # Points de suspension et guillemets aux extrémités : le modèle les ajoute souvent.
    needle = normalize(quote).strip("\"' .…")
    if len(needle) < min_length:
        return False
    return needle in normalize(text)


def header_key(text):
    """Clé de comparaison d'un en-tête : sans accents, sans casse, espaces réduits."""
    if text is None:
        return ""
    decomposed = unicodedata.normalize("NFKD", str(text))
    without_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(without_accents.casefold().split())
