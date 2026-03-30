import re

import pandas as pd
from pathlib import Path

class OnboardCouncils:
    def __init__(self, input_file_path: str | Path, councils_csv: str | Path):
        self.input_file_path = input_file_path
        self.councils_csv = councils_csv

    def _load_input_file(self) -> pd.DataFrame:
        df = pd.read_excel(self.input_file_path, header=None, names=["lad_code", "name"])
        return df[["name", "lad_code"]]

    def _load_councils_file(self) -> pd.DataFrame:
        return pd.read_csv(self.councils_csv, encoding="utf-8")

    @staticmethod
    def _remove_brackets(text: str) -> str:
        text = re.sub(r'\([^)]*\)', '', text)
        text = re.sub(r'\{[^}]*}', '', text)
        text = re.sub(r' +', ' ', text)
        return text.strip()

    @staticmethod
    def _apply_title_casing(text: str) -> str:
        titled = text.title()                                   # "ISLE OF WIGHT UA" -> "Isle Of Wight Ua"
        titled = re.sub(r'\bUa\b', 'UA', titled)    # "Isle Of Wight Ua" -> "Isle Of Wight UA"
        return titled
