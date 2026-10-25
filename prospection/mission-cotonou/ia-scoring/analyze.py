"""Analyse des prospects « À analyser » du classeur par un modèle local.

Exemples :
    python analyze.py ../modele-prospection/NOISE_Prospection_Cotonou.xlsx --preparer
    python analyze.py CLASSEUR.xlsx --essai --limite 2
    python analyze.py CLASSEUR.xlsx --modele llama3.1:8b
"""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

from noise_scoring import config
from noise_scoring.model import OllamaClient
from noise_scoring.pipeline import analyze_workbook
from noise_scoring.workbook import MissingColumns, prepare


def main(argv=None):
    parser = argparse.ArgumentParser(description="Analyse des prospects par une IA locale (Ollama).")
    parser.add_argument("classeur", type=Path, help="chemin du classeur .xlsx")
    parser.add_argument("--modele", default=config.DEFAULT_MODEL, help="modèle Ollama à utiliser")
    parser.add_argument("--limite", type=int, help="nombre maximal de lignes à analyser")
    parser.add_argument("--essai", action="store_true", help="analyser sans enregistrer le classeur")
    parser.add_argument("--preparer", action="store_true",
                        help="ajouter les colonnes manquantes au classeur, puis s'arrêter")
    args = parser.parse_args(argv)

    if not args.classeur.exists():
        print(f"Classeur introuvable : {args.classeur}")
        return 1
    wb = load_workbook(args.classeur)

    if args.preparer:
        added = prepare(wb)
        if not added:
            print("Rien à ajouter : toutes les colonnes existent déjà.")
            return 0
        print("Colonnes ajoutées :\n- " + "\n- ".join(added))
        return _save(wb, args.classeur)

    try:
        report = analyze_workbook(wb, OllamaClient(model=args.modele), limit=args.limite)
    except MissingColumns as error:
        print(f"{error}\nLance d'abord la commande avec --preparer.")
        return 1

    for line in report.lines:
        print(line)
    print(f"\nÀ jour : {len(report.up_to_date)} · À relire : {len(report.to_review)} · "
          f"Erreurs : {len(report.errors)}")
    if report.stopped:
        print(f"Analyse interrompue : {report.stopped}")
    if args.essai:
        print("Mode essai : classeur non enregistré.")
        return 0
    if not report.lines:
        if report.stopped:
            return 1
        print("Aucune ligne « À analyser » : classeur non modifié.")
        return 0
    return _save(wb, args.classeur)


def _save(wb, path):
    """Copie de sauvegarde, puis enregistrement. Excel recalcule les formules à l'ouverture."""
    backup = path.with_name(f"{path.stem}.sauvegarde-{datetime.now():%Y%m%d-%H%M%S}{path.suffix}")
    shutil.copy2(path, backup)
    try:
        wb.save(path)
    except PermissionError:
        print("Impossible d'enregistrer : ferme le classeur dans Excel, puis relance.")
        return 1
    print(f"Classeur enregistré. Sauvegarde de l'ancienne version : {backup.name}")
    return 0


if __name__ == "__main__":
    # Accents corrects dans le terminal Windows.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
