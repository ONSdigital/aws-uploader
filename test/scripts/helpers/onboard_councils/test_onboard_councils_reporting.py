import logging

from scripts.helpers.onboard_councils.onboard_councils_reporting import OnboardingReporter, AddedRow


class TestRecordDroppedRow:
    def test_record_dropped_row_appends_dropped_row_to_report(self):
        # arrange
        reporter = OnboardingReporter(
            input_file="input.xlsx",
            councils_csv="councils.csv",
        )

        # act
        reporter.record_dropped_row(
            idx=1,
            council_name="Beanbag Cunningscratch",
            lad_code=None,
            reason="Missing LAD code"
        )
        row = reporter.report.dropped_rows[0]

        # assert
        assert len(reporter.report.dropped_rows) == 1
        assert row.row_index == 1
        assert row.council_name == "Beanbag Cunningscratch"
        assert row.lad_code is None
        assert row.reason == "Missing LAD code"


class TestRecordDuplicateRow:
    def test_record_duplicate_row_appends_duplicate_row_to_report(self):
        # arrange
        reporter = OnboardingReporter(
            input_file="input.xlsx",
            councils_csv="councils.csv",
        )

        # act
        reporter.record_duplicate_row(
            idx=3,
            council_name="Beanbag Cunningscratch",
            lad_code="E07000089",
            stage="cleaned input"
        )
        row = reporter.report.duplicate_rows[0]

        # assert
        assert len(reporter.report.duplicate_rows) == 1
        assert row.row_index == 3
        assert row.council_name == "Beanbag Cunningscratch"
        assert row.lad_code == "E07000089"
        assert row.stage == "cleaned input"


class TestRecordCollision:
    def test_record_collision_appends_collision_row_to_report(self):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        reporter.record_collision(council_name="Hart", lad_code="E07000089", collision_type="lad_code and name")
        row = reporter.report.collision_rows[0]

        # assert
        assert len(reporter.report.collision_rows) == 1
        assert row.council_name == "Hart"
        assert row.lad_code == "E07000089"
        assert row.collision_type == "lad_code and name"


class TestReconcileRowCounts:
    def test_reconcile_row_count_sets_reconciliation_ok(self):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")
        # act
        reporter.reconcile_row_counts(
            input_count=10,
            cleaned_count=8,
            dropped_count=2,
            collision_count=3,
            added_count=5,
        )
        # assert
        assert reporter.report.reconciliation_ok is True
        assert reporter.report.reconciliation_message == "Row counts reconciled."

    def test_reconcile_row_counts_sets_reconciliation_failed_after_mismatch_in_cleaning(self):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        reporter.reconcile_row_counts(
            input_count=10,
            cleaned_count=9,  # should be 8 (10 - 2)
            dropped_count=2,
            collision_count=3,
            added_count=5,
        )

        # assert
        assert reporter.report.reconciliation_ok is False
        assert "Row count mismatch after cleaning" in reporter.report.reconciliation_message

    def test_reconcile_row_counts_mismatch_after_cleaning_logs_error(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act & assert
        with caplog.at_level(logging.ERROR):
            reporter.reconcile_row_counts(
                input_count=10,
                cleaned_count=9,
                dropped_count=2,
                collision_count=3,
                added_count=5,
            )
        assert any("Row count mismatch after cleaning" in msg for msg in caplog.messages)

    def test_reconcile_row_counts_mismatch_after_already_onboarded_check_sets_reconciliation_failed(self):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        reporter.reconcile_row_counts(
            input_count=10,
            cleaned_count=8,
            dropped_count=2,
            collision_count=3,
            added_count=3,  # should be 5 (8 - 3)
        )

        # assert
        assert reporter.report.reconciliation_ok is False
        assert "Row count mismatch after already-onboarded check" in reporter.report.reconciliation_message

    def test_reconcile_row_counts_mismatch_after_already_onboarded_check_logs_error(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        with caplog.at_level(logging.ERROR):
            reporter.reconcile_row_counts(
                input_count=10,
                cleaned_count=8,
                dropped_count=2,
                collision_count=3,
                added_count=3,
            )

        # assert
        assert any("Row count mismatch after already-onboarded check" in m for m in caplog.messages)

    def test_reconcile_row_counts_happy_path_logs_info(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        with caplog.at_level(logging.INFO):
            reporter.reconcile_row_counts(
                input_count=10,
                cleaned_count=8,
                dropped_count=2,
                collision_count=3,
                added_count=5,
            )

        # assert
        assert "Row counts reconciled." in caplog.messages


class TestLogSummary:
    def test_log_summary_output_when_no_councils_added(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        with caplog.at_level(logging.INFO):
            reporter.log_summary(original_row_count=10, new_row_count=10)

        # assert
        assert "No new councils added" in caplog.messages

    def test_log_summary_one_council_added(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")
        reporter.report.added_rows = [AddedRow(council_name="Hart", lad_code="E07000089")]

        # act
        with caplog.at_level(logging.INFO):
            reporter.log_summary(original_row_count=10, new_row_count=11)

        # assert
        assert "Added 1 new council: Hart (E07000089)" in caplog.messages

    def test_log_summary_logs_when_multiple_councils_were_added(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")
        reporter.report.added_rows = [
            AddedRow(council_name="Hart", lad_code="E07000089"),
            AddedRow(council_name="Adur", lad_code="E07000223"),
        ]

        # act
        with caplog.at_level(logging.INFO):
            reporter.log_summary(original_row_count=10, new_row_count=12)

        # assert
        assert "Added 2 new councils: Hart (E07000089), Adur (E07000223)" in caplog.messages

    def test_log_summary_logs_original_and_new_row_counts(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        with caplog.at_level(logging.INFO):
            reporter.log_summary(original_row_count=10, new_row_count=11)

        # assert
        assert "New councils.csv row count: 11" in caplog.messages
        assert "Original councils.csv row count: 10" in caplog.messages

    def test_log_summary_logs_error_when_row_count_drop_exists(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        with caplog.at_level(logging.ERROR):
            reporter.log_summary(original_row_count=10, new_row_count=8)

        # assert
        assert any("existing councils may have been lost" in m for m in caplog.messages)

    def test_log_summary_does_not_log_error_when_counts_equal(self, caplog):
        # arrange
        reporter = OnboardingReporter(input_file="input.xlsx", councils_csv="councils.csv")

        # act
        with caplog.at_level(logging.ERROR):
            reporter.log_summary(original_row_count=10, new_row_count=10)

        # assert
        assert not any("existing councils may have been lost" in m for m in caplog.messages)
