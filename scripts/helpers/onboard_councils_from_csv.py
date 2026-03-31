import re

import pandas as pd
from pathlib import Path

class OnboardCouncils:
    def __init__(self, input_file_path: str | Path, councils_csv: str | Path):
        self.input_file_path = input_file_path
        self.councils_csv = councils_csv

    def _load_input_file(self) -> pd.DataFrame:
        df = pd.read_excel(self.input_file_path, header=0)
        return df[["council_name", "lad_code"]]

    def _load_councils_file(self) -> pd.DataFrame:
        return pd.read_csv(self.councils_csv, encoding="utf-8")

    def _clean_input_data(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["council_name"] = df["council_name"].apply(self._clean_council_name)
        df["lad_code"] = df["lad_code"].apply(self._clean_lad_code)
        df = self._drop_empty_rows(df)
        return df

    def _clean_council_name(self, value) -> str | None:
        cleaned = self._clean_value(value)
        if cleaned is None:
            return None
        return self._apply_title_casing(cleaned)

    def _clean_lad_code(self, value) -> str | None:
        return self._clean_value(value)

    def _clean_value(self, value) -> str | None:
        if pd.isna(value):
            return None
        stripped = self._remove_brackets(str(value))
        return stripped if stripped else None

    def _drop_empty_rows(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.dropna(subset=["council_name", "lad_code"])
        return df[(df["council_name"].str.strip() != "") & (df["lad_code"].str.strip() != "")]

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
