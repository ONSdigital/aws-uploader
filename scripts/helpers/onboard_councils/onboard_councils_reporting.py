from dataclasses import dataclass, field


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