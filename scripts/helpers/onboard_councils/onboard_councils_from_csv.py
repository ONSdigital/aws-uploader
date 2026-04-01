import logging
import re
from datetime import datetime

import pandas as pd
from pathlib import Path

from scripts.helpers.onboard_councils.onboard_councils_logging import setup_logging
from scripts.helpers.onboard_councils.onboard_councils_reporting import OnboardingReport, AddedRow, DroppedRow, \
    DuplicateRow, CollisionRow


REQUIRED_COLUMNS = {"name", "lad_code"}

# TODO: Test data uploads in dev post csv formatting change
# TODO: Make unit tests more comprehensive - for onboarding and reporting
# TODO: I don't need an output file

class OnboardCouncils:
    def __init__(self,
                 input_file_path: str | Path,
                 councils_csv: str | Path = "../../councils.csv",
                 output_path: str | Path = "../../councils.csv"
                 ):
        self.input_file_path = Path(input_file_path)
        self.councils_csv = Path(councils_csv)
        self.output_path = Path(output_path)

        self._report = OnboardingReport(
            run_at=datetime.now().isoformat(timespec="seconds"),
            input_file=str(self.input_file_path),
            councils_csv=str(self.councils_csv),
            input_row_count=0,
            rows_after_cleaning=0,
            rows_added=0,
            output_row_count=0,
        )

    def run(self):
        logging.info("Council onboarding started")
        logging.info(f"Input file: {self.input_file_path}")
        logging.info(f"Councils csv: {self.councils_csv}")

        incoming_councils = self._load_input_file()
        existing_councils = self._load_councils_file()
        original_row_count = len(existing_councils)

        self._report.input_row_count = len(incoming_councils)
        logging.info(f"Input rows loaded: {self._report.input_row_count}")

        cleaned_incoming_councils = self._clean_input_data(incoming_councils)
        self._check_for_duplicates(cleaned_incoming_councils, stage="cleaned input")
        self._report.rows_after_cleaning = len(cleaned_incoming_councils)

        new_councils = self._remove_already_onboarded(cleaned_incoming_councils, existing_councils)
        self._report.rows_added = len(new_councils)

        self._report.added_rows = [
            AddedRow(council_name=r["name"], lad_code=r["lad_code"])
            for _, r in new_councils.iterrows()
        ]

        merged = self._merge(new_councils, existing_councils)
        self._report.output_row_count = len(merged)

        self._reconcile_row_counts(
            input_count=self._report.input_row_count,
            cleaned_count=self._report.rows_after_cleaning,
            dropped_count=len(self._report.dropped_rows),
            collision_count=len(self._report.collision_rows),
            added_count=self._report.rows_added,
        )

        self._save(merged)
        self._log_summary(original_row_count, merged)

        logging.info("Council onboarding complete")
        return self._report

    def _load_input_file(self) -> pd.DataFrame:
        logging.info("Loading input Excel file…")

        df = pd.read_excel(self.input_file_path, header=0)

        actual_cols = set(df.columns.str.strip().str.lower())
        missing = REQUIRED_COLUMNS - actual_cols
        if missing:
            raise ValueError(
                f"Input file is missing required columns: {missing}. "
                f"Columns found: {list(df.columns)}"
            )

        return df[["name", "lad_code"]].copy()

    def _load_councils_file(self) -> pd.DataFrame:
        logging.info("Loading councils CSV…")

        df = pd.read_csv(self.councils_csv, encoding="utf-8")

        actual_cols = set(df.columns.str.strip().str.lower())
        missing = REQUIRED_COLUMNS - actual_cols
        if missing:
            raise ValueError(
                f"Councils CSV is missing required columns: {missing}. "
                f"Columns found: {list(df.columns)}"
            )

        return df

    def _clean_input_data(self, df: pd.DataFrame) -> pd.DataFrame:
        logging.info("Cleaning input data…")

        df = df.copy()
        df["name"] = [
            self._clean_council_name(v, i) for i, v in enumerate(df["name"])
        ]
        df["lad_code"] = [
            self._clean_lad_code(v, i) for i, v in enumerate(df["lad_code"])
        ]
        df = self._drop_empty_rows(df)
        return df

    def _clean_council_name(self, value, row_index: int) -> str | None:
        cleaned = self._clean_value(value)
        if cleaned is None:
            if not pd.isna(value) and str(value).strip():
                logging.warning(
                    f"Row {row_index + 2}: council name '{value}' became empty after bracket removal"
                )
            return None
        return self._apply_title_casing(cleaned)

    def _clean_lad_code(self, value, row_index: int) -> str | None:
        cleaned = self._clean_value(value)
        if cleaned is None:
            if not pd.isna(value) and str(value).strip():
                logging.warning(
                f"Row {row_index + 2}: LAD code '{value}' became empty after bracket removal"
            )
        return cleaned

    def _clean_value(self, value) -> str | None:
        if pd.isna(value):
            return None
        stripped = self._remove_brackets(str(value))
        return stripped if stripped else None

    def _drop_empty_rows(self, df: pd.DataFrame) -> pd.DataFrame:
        original_count = len(df)

        missing_name = df["name"].isna() | (df["name"].str.strip() == "")
        missing_lad = df["lad_code"].isna() | (df["lad_code"].str.strip() == "")

        for idx, row in df[missing_lad & ~missing_name].iterrows():
            msg = f"Row {idx + 2}: '{row['name']}' dropped — missing LAD code"
            logging.warning(msg)
            self._report.dropped_rows.append(DroppedRow(
                row_index=idx,
                council_name=row["name"],
                lad_code=None,
                reason="Missing LAD code",
            ))

        for idx, row in df[missing_name & ~missing_lad].iterrows():
            msg = f"Row {idx}: LAD code '{row['lad_code']}' dropped — missing council name"
            logging.warning(msg)
            self._report.dropped_rows.append(DroppedRow(
                row_index=idx,
                council_name=None,
                lad_code=row["lad_code"],
                reason="Missing council name",
            ))

        both_missing = df[missing_name & missing_lad]
        if not both_missing.empty:
            logging.warning(f"{len(both_missing)} row/s dropped — both fields empty (Row/s: {list(both_missing.index + 2)})")
            for idx, row in both_missing.iterrows():
                self._report.dropped_rows.append(DroppedRow(
                    row_index=idx,
                    council_name=None,
                    lad_code=None,
                    reason="Both fields empty",
                ))

        df = df[~missing_name & ~missing_lad]
        dropped = original_count - len(df)
        logging.info(f"Drop filter: {original_count} → {len(df)} rows ({dropped} dropped)")
        return df

    def _check_for_duplicates(self, df: pd.DataFrame, stage: str) -> None:
        dup_names = df[df["name"].duplicated(keep=False)]
        dup_lads = df[df["lad_code"].duplicated(keep=False)]

        if not dup_names.empty:
            logging.warning(
                f"[{stage}] Duplicate council names detected:\n{dup_names.to_string()}"
            )
            for idx, row in dup_names.iterrows():
                self._report.duplicate_rows.append(DuplicateRow(
                    row_index=idx,
                    council_name=row["name"],
                    lad_code=row["lad_code"],
                    stage=stage,
                ))

        if not dup_lads.empty:
            logging.warning(
                f"[{stage}] Duplicate LAD codes detected:\n{dup_lads.to_string()}"
            )
            for idx, row in dup_lads.iterrows():
                already = any(
                    d.row_index == idx and d.stage == stage
                    for d in self._report.duplicate_rows
                )
                if not already:
                    self._report.duplicate_rows.append(DuplicateRow(
                        row_index=idx,
                        council_name=row["name"],
                        lad_code=row["lad_code"],
                        stage=stage,
                    ))

    def _remove_already_onboarded(
            self, new_df: pd.DataFrame, existing_df: pd.DataFrame
    ) -> pd.DataFrame:
        existing_lads = set(existing_df["lad_code"].str.strip())
        existing_names = set(existing_df["name"].str.strip().str.lower())

        rows_to_add = []
        for _, row in new_df.iterrows():
            lad_exists = row["lad_code"].strip() in existing_lads
            name_exists = row["name"].strip().lower() in existing_names

            if lad_exists and name_exists:
                collision_type = "lad_code and name"
            elif lad_exists:
                collision_type = "lad_code"
            elif name_exists:
                collision_type = "name"
            else:
                logging.info(f"ONBOARD: '{row['name']}' / '{row['lad_code']}'")
                rows_to_add.append(row)
                continue

            logging.warning(
                f"ALREADY EXISTS ({collision_type}): '{row['name']}' / "
                f"'{row['lad_code']}' — skipped"
            )
            self._report.collision_rows.append(CollisionRow(
                council_name=row["name"],
                lad_code=row["lad_code"],
                collision_type=collision_type,
            ))

        return pd.DataFrame(rows_to_add, columns=new_df.columns) if rows_to_add else pd.DataFrame(
            columns=new_df.columns)

    def _save(self, df: pd.DataFrame) -> None:
        df.to_csv(self.output_path, index=False, encoding="utf-8")

    def _reconcile_row_counts(
            self,
            input_count: int,
            cleaned_count: int,
            dropped_count: int,
            collision_count: int,
            added_count: int,
    ) -> None:
        expected_cleaned = input_count - dropped_count
        if cleaned_count != expected_cleaned:
            msg = (
                f"Row count mismatch after cleaning: "
                f"expected {expected_cleaned} (input {input_count} − dropped {dropped_count}), "
                f"got {cleaned_count}"
            )
            logging.error(msg)
            self._report.reconciliation_ok = False
            self._report.reconciliation_message = msg
            return

        expected_added = cleaned_count - collision_count
        if added_count != expected_added:
            msg = (
                f"Row count mismatch after collision filter: "
                f"expected {expected_added} (cleaned {cleaned_count} − collisions {collision_count}), "
                f"got {added_count}"
            )
            logging.error(msg)
            self._report.reconciliation_ok = False
            self._report.reconciliation_message = msg
            return

        msg = (
            f"Reconciliation OK — "
            f"{input_count} input rows → "
            f"{dropped_count} dropped, "
            f"{collision_count} collisions skipped, "
            f"{added_count} added"
        )
        self._report.reconciliation_ok = True
        self._report.reconciliation_message = msg

    def _log_summary(self, original_row_count: int, merged: pd.DataFrame) -> None:
        added = self._report.added_rows

        logging.info(f"Original councils.csv row count: {original_row_count}")

        if not added:
            logging.info("No new councils added")
        elif len(added) == 1:
            logging.info(f"Added 1 new council: {added[0].council_name} ({added[0].lad_code})")
        else:
            names = ", ".join(f"{r.council_name} ({r.lad_code})" for r in added)
            logging.info(f"Added {len(added)} new councils: {names}")

        logging.info(f"New councils.csv row count: {len(merged)}")

        if len(merged) < original_row_count:
            logging.error(
                f"Row count dropped from {original_row_count} to {len(merged)} — "
                f"existing councils may have been lost!"
            )

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
    def _merge(new_councils: pd.DataFrame, existing_councils: pd.DataFrame) -> pd.DataFrame:
        if new_councils.empty:
            return existing_councils
        merged = pd.concat([existing_councils, new_councils], ignore_index=True)
        merged = merged.drop_duplicates()
        return merged.sort_values("name", key=lambda s: s.str.lower(), ignore_index=True)


if __name__ == "__main__":
    setup_logging(log_dir="./logs")

    # Required: path to the input XLSX file
    input_file_path = "../tests/test_data/input (1).xlsx"

    # Optional: defaults to "../../councils.csv" if not set
    councils_csv = "../tests/test_data/councils (1).csv"

    # Optional: defaults to "../../councils.csv" if not set
    output_path = "../tests/test_data/councils (1).csv"

    OnboardCouncils(
        input_file_path=input_file_path,
        councils_csv=councils_csv,      # Uncomment this line for custom paths
        output_path=output_path         # Uncomment this line for custom paths
    ).run()
