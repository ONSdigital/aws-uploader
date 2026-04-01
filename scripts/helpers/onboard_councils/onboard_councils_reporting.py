import logging
import pandas as pd
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DroppedRow:
    row_index: int
    council_name: str | None
    lad_code: str | None
    reason: str


@dataclass
class DuplicateRow:
    row_index: int
    council_name: str | None
    lad_code: str | None
    stage: str


@dataclass
class CollisionRow:
    council_name: str | None
    lad_code: str | None
    collision_type: str  # "lad_code" | "council_name" | "both"


@dataclass
class AddedRow:
    council_name: str
    lad_code: str


@dataclass
class OnboardingReport:
    run_at: str
    input_file: str
    councils_csv: str
    input_row_count: int
    rows_after_cleaning: int
    rows_added: int
    output_row_count: int
    dropped_rows: list[DroppedRow] = field(default_factory=list)
    duplicate_rows: list[DuplicateRow] = field(default_factory=list)
    collision_rows: list[CollisionRow] = field(default_factory=list)
    added_rows: list[AddedRow] = field(default_factory=list)
    reconciliation_ok: bool = True
    reconciliation_message: str = ""

class OnboardingReporter:
    def __init__(self, input_file: str, councils_csv: str):
        self.report = OnboardingReport(
            run_at=datetime.now().isoformat(timespec="seconds"),
            input_file=input_file,
            councils_csv=councils_csv,
            input_row_count=0,
            rows_after_cleaning=0,
            rows_added=0,
            output_row_count=0,
        )

    def record_dropped_row(self, idx: int, council_name: str | None, lad_code: str | None, reason: str) -> None:
        self.report.dropped_rows.append(DroppedRow(
            row_index=idx,
            council_name=council_name,
            lad_code=lad_code,
            reason=reason,
        ))

    def record_duplicate_row(self, idx: int, council_name: str | None, lad_code: str | None, stage: str) -> None:
        self.report.duplicate_rows.append(DuplicateRow(
            row_index=idx,
            council_name=council_name,
            lad_code=lad_code,
            stage=stage,
        ))

    def record_collision(self, council_name: str | None, lad_code: str | None, collision_type: str) -> None:
        self.report.collision_rows.append(CollisionRow(
            council_name=council_name,
            lad_code=lad_code,
            collision_type=collision_type,
        ))

    def reconcile_row_counts(
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
            self.report.reconciliation_ok = False
            self.report.reconciliation_message = msg
            return

        expected_added = cleaned_count - collision_count
        if added_count != expected_added:
            msg = (
                f"Row count mismatch after already-onboarded check: "
                f"expected {expected_added} (cleaned {cleaned_count} − already onboarded {collision_count}), "
                f"got {added_count}"
            )
            logging.error(msg)
            self.report.reconciliation_ok = False
            self.report.reconciliation_message = msg
            return

        self.report.reconciliation_ok = True
        self.report.reconciliation_message = "Row counts reconciled."
        logging.info("Row counts reconciled.")

    def log_summary(self, original_row_count: int, merged: pd.DataFrame) -> None:
        added = self.report.added_rows

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