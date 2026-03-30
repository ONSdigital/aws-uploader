import pandas as pd
from pathlib import Path

class OnboardCouncils:
    def __init__(self, input_file_path: str | Path):
        self.input_file_path = input_file_path

    def _load_xlsx(self) -> pd.DataFrame:
        df = pd.read_excel(self.input_file_path, header=None, names=["lad_code", "name"])
        return df[["name", "lad_code"]]