import re

import pandas as pd
from pathlib import Path

class OnboardCouncils:
    def __init__(self,
                 input_file_path: str | Path,
                 councils_csv: str | Path = "../../councils.csv",
                 output_path: str | Path = "../../councils.csv"
                 ):
        self.input_file_path = Path(input_file_path)
        self.councils_csv = Path(councils_csv)
        self.output_path = Path(output_path)

    def run(self):
        incoming_councils = self._load_input_file()
        existing_councils = self._load_councils_file()

        cleaned_incoming_councils = self._clean_input_data(incoming_councils)

        # TODO: Test parameters are called in the right order
        merged = self._merge(cleaned_incoming_councils, existing_councils)
        self._save(merged)
        # TODO: Log "Done"

    def _load_input_file(self) -> pd.DataFrame:
        df = pd.read_excel(self.input_file_path, header=0)
        return df[["name", "lad_code"]]

    def _load_councils_file(self) -> pd.DataFrame:
        return pd.read_csv(self.councils_csv, encoding="utf-8")

    def _clean_input_data(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["name"] = df["name"].apply(self._clean_council_name)
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
        df = df.dropna(subset=["name", "lad_code"])
        return df[(df["name"].str.strip() != "") & (df["lad_code"].str.strip() != "")]

    def _save(self, df: pd.DataFrame) -> None:
        df.to_csv(self.output_path, index=False)

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

    @staticmethod
    def _merge(cleaned_incoming_councils: pd.DataFrame, existing_councils: pd.DataFrame) -> pd.DataFrame:
        combined = pd.concat([existing_councils, cleaned_incoming_councils], ignore_index=True)
        combined = combined.drop_duplicates()
        return combined.sort_values("name", key=lambda s: s.str.lower(), ignore_index=True)


if __name__ == "__main__":
    # Required: path to the input XLSX file
    input_file_path = "test_data/input (1).xlsx"

    # Optional: defaults to "../../councils.csv" if not set
    councils_csv = "test_data/councils (1).csv"

    # Optional: defaults to "../../councils.csv" if not set
    output_path = "test_data/councils (1).csv"

    OnboardCouncils(
        input_file_path=input_file_path,
        councils_csv=councils_csv,      # Uncomment this line for custom paths
        output_path=output_path         # Uncomment this line for custom paths
    ).run()
