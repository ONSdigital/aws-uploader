from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from scripts.helpers.onboard_councils.onboard_councils_from_xlsx import OnboardCouncils


@pytest.fixture
def dummy_input(tmp_path):
    df = pd.DataFrame({
        "lad_code": ["E06000044", "E08000011"],
        "name": ["PORTSMOUTH UA", "KNOWSLEY"],
    })
    path = tmp_path / "input.xlsx"
    df.to_excel(path, index=False)
    return path


@pytest.fixture
def dummy_councils_csv(tmp_path):
    df = pd.DataFrame({
        "name": ["Portsmouth UA", "Knowsley"],
        "lad_code": ["E06000044", "E08000011"],
    })
    path = tmp_path / "councils.csv"
    df.to_csv(path, index=False, encoding="utf-8")
    return path


@pytest.fixture
def onboarder(dummy_input, dummy_councils_csv):
    return OnboardCouncils(
        input_file_path=dummy_input,
        councils_csv=dummy_councils_csv,
    )


class TestInit:
    def test_init_paths_populate_expected_default_paths(self, dummy_input, dummy_councils_csv):
        # arrange & act
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
        )

        # assert
        assert onboarder.councils_csv == Path("../../councils.csv")

    def test_init_paths_populate_expected_custom_paths(self, dummy_input):
        # arrange & act
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=Path("og-test-data.csv"),
        )

        # assert
        assert onboarder.councils_csv == Path("og-test-data.csv")

    def test_init_paths_are_stored_as_path_object(self, dummy_input):
        # arrange & act
        onboarder = OnboardCouncils(
            input_file_path=str(dummy_input),
        )

        # assert
        assert isinstance(onboarder.input_file_path, Path)
        assert onboarder.input_file_path == dummy_input

    def test_init_paths_are_coerced_to_path_objects(self, dummy_input):
        # arrange & act
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv="custom/councils.csv",
        )

        # assert
        assert isinstance(onboarder.councils_csv, Path)


class TestRun:
    @patch.object(OnboardCouncils, "_save")
    @patch.object(OnboardCouncils, "_merge", return_value=pd.DataFrame())
    @patch.object(OnboardCouncils, "_remove_already_onboarded", side_effect=lambda df, _: df)
    @patch.object(OnboardCouncils, "_clean_input_data", return_value=pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]}))
    @patch.object(OnboardCouncils, "_load_councils_file", return_value=pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]}))
    @patch.object(OnboardCouncils, "_load_input_file", return_value=pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]}))
    def test_run_calls_merge_with_correct_parameter_order(
            self,
            _mock_load_input,
            mock_load_councils,
            mock_clean,
            _mock_remove,
            mock_merge,
            _mock_save,
            dummy_input
        ):
        # arrange
        onboarder = OnboardCouncils(
            input_file_path=dummy_input
        )
        # act
        onboarder.run()

        # assert
        mock_merge.assert_called_once_with(mock_clean.return_value, mock_load_councils.return_value)

    @patch.object(OnboardCouncils, "_save")
    @patch.object(OnboardCouncils, "_merge",
                  return_value=pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]}))
    @patch.object(OnboardCouncils, "_remove_already_onboarded", side_effect=lambda df, _: df)
    @patch.object(OnboardCouncils, "_clean_input_data",
                  return_value=pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]}))
    @patch.object(OnboardCouncils, "_load_councils_file", return_value=pd.DataFrame({"name": [], "lad_code": []}))
    @patch.object(OnboardCouncils, "_load_input_file",
                  return_value=pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]}))
    def test_save_receives_merge_result(
            self,
            _load_input,
            _load_councils,
            _clean,
            _mock_remove,
            mock_merge,
            mock_save,
            dummy_input
    ):
        # arrange
        onboarder = OnboardCouncils(
            input_file_path=dummy_input
        )

        # act
        onboarder.run()

        # assert
        pd.testing.assert_frame_equal(mock_save.call_args[0][0], mock_merge.return_value)

    def test_run_end_to_end_produces_csv(self, dummy_input, tmp_path):
        # arrange
        councils_csv = tmp_path / "councils.csv"

        pd.DataFrame(
            {"name": ["Birmingham"],
             "lad_code": ["E08000025"]}
        ).to_csv(councils_csv, index=False)

        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=councils_csv,
        )

        # act
        onboarder.run()

        # assert
        assert councils_csv.exists()
        result = pd.read_csv(councils_csv)
        assert not result.empty


class TestLoadInputFile:
    def test_load_input_file_reads_xlsx_to_dataframe(self, dummy_input, onboarder):
        # arrange & act
        result = onboarder._load_input_file()

        # assert
        assert isinstance(result, pd.DataFrame)

    def test_load_input_file_returns_only_name_and_lad_code_columns(self, tmp_path, dummy_councils_csv):
        # arrange
        df = pd.DataFrame({
            "name": ["BIRMINGHAM", "PORTSMOUTH", "KNOWSLEY"],
            "lad_code": ["E08000025", "E06000044", "E08000011"],
            "these_should_be_dropped": ["Barnacle Cumbersniff", "Benadryl Cramplesnutch", "Bedlington Collywog"]
        })
        path = tmp_path / "benedict_cumberbatch.xlsx"
        df.to_excel(path, index=False)

        onboarder = OnboardCouncils(
            input_file_path=path,
            councils_csv=dummy_councils_csv,
        )

        # act
        result = onboarder._load_input_file()

        # assert
        assert list(result.columns) == ["name", "lad_code"]
        assert "these_should_be_dropped" not in result.columns

    def test_load_input_file_raises_on_missing_file_error(self):
        # arrange
        onboarder = OnboardCouncils(
            input_file_path=Path("Bumbling Chumpcamper.xlsx"),
        )

        # act & assert
        with pytest.raises(FileNotFoundError, match="Bumbling Chumpcamper.xlsx"):
            onboarder._load_input_file()


class TestLoadCouncilsFile:
    def test_load_councils_file_reads_csv_to_dataframe(self, onboarder):
        # arrange & act
        result = onboarder._load_councils_file()

        # assert
        assert isinstance(result, pd.DataFrame)

    def test_load_councils_file_preserves_all_columns_from_csv(self, onboarder):
        # arrange & act
        result = onboarder._load_councils_file()

        # assert
        assert "name" in result.columns
        assert "lad_code" in result.columns

    def test_load_councils_file_raises_file_not_found_error(self, dummy_input):
        # arrange
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=Path("Bulletin Cravingsnort.xlsx"),
        )

        # act & assert
        with pytest.raises(FileNotFoundError, match="Bulletin Cravingsnort.xlsx"):
            onboarder._load_councils_file()


class TestRemoveBrackets:
    @pytest.mark.parametrize("input_text, expected", [
        ("PORTSMOUTH (CITY)", "PORTSMOUTH"),
        ("TEST {COUNCIL}", "TEST"),
        ("NO BRACKETS", "NO BRACKETS"),
        ("E07000154 (E07000154)", "E07000154"),
        ("MULTI (ONE) AND (TWO)", "MULTI AND"),
        ("Varied (Casing)", "Varied"),
        ("(LEADING BRACKET) NAME", "NAME"),
        ("TRAILING (BRACKET)", "TRAILING"),
        ("(ENTIRELY IN BRACKETS)", ""),
        ("  spaces   (removed)  ", "spaces"),
        ("DOUBLE  SPACE (removed)", "DOUBLE SPACE"),
        ("MIXED {curly} and (round)", "MIXED and"),
        ("NESTED (outer (inner))", "NESTED"),  # outer bracket + leftovers handled
        ("EMPTY () BRACKETS", "EMPTY BRACKETS"),
        ("no-brackets-at-all", "no-brackets-at-all"),
    ])
    def test_remove_brackets_removes_brackets_and_braces_as_expected(self, input_text, expected):
        # act
        result = OnboardCouncils._remove_brackets(input_text)

        # assert
        assert result == expected


class TestApplyTitleCasing:
    @pytest.mark.parametrize("input_text, expected", [
    ("PORTSMOUTH UA", "Portsmouth UA"),
        ("ISLE OF WIGHT UA", "Isle Of Wight UA"),
        ("BIRMINGHAM", "Birmingham"),
        ("VALE OF WHITE HORSE", "Vale Of White Horse"),
        ("WEST NORTHAMPTONSHIRE", "West Northamptonshire"),
        ("COUNCIL UA UA", "Council UA UA"),
        ("already Title Case UA", "Already Title Case UA"),
        ("lowercase ua", "Lowercase UA"),
        ("SINGLE", "Single"),
        ("UA", "UA"),
    ])
    def test_apply_title_casing_returns_expected_text(self, input_text, expected):
        # act
        result = OnboardCouncils._apply_title_casing(input_text)

        # assert
        assert result == expected


class TestCleanValue:
    @pytest.mark.parametrize("input_lad_code, expected", [
        (None, None),
        (float("nan"), None),
        ("  ", None),
        ("(E06000044)", None),
        ("E06000044", "E06000044"),
        ("E06000044 (old)", "E06000044"),
    ])
    def test_clean_lad_code_cleans_value_as_expected(self, input_lad_code, expected, onboarder):
        # arrange & act
        result = onboarder._clean_lad_code(input_lad_code, 0)

        # assert
        assert result == expected

    @pytest.mark.parametrize("input_council_name, expected", [
        (None, None),
        (float("nan"), None),
        ("  ", None),
        ("PORTSMOUTH UA", "Portsmouth UA"),
        ("PORTSMOUTH (CITY) UA", "Portsmouth UA"),
    ])
    def test_clean_council_name_cleans_value_as_expected(self, input_council_name, expected, onboarder):
        # arrange & act
        result = onboarder._clean_council_name(input_council_name, 0)

        # assert
        assert result == expected


class TestDropEmptyRows:
    def test_drop_empty_rows_where_council_name_is_none_but_lad_code_exists(self, onboarder):
        # arrange
        input_df = pd.DataFrame({
            "name": [None, "Birmingham"],
            "lad_code": ["E06000044", "E08000025"]
        })
        expected_df = pd.DataFrame({
            "name": ["Birmingham"],
            "lad_code": ["E08000025"]
        })

        # act
        result = onboarder._drop_empty_rows(input_df)

        # assert
        assert list(result["name"]) == ["Birmingham"]
        pd.testing.assert_frame_equal(result.reset_index(drop=True), expected_df)


    def test_drop_empty_rows_where_council_name_exits_but_lad_code_is_none(self, onboarder):
        # arrange
        input_df = pd.DataFrame({
            "name": ["Portsmouth UA", "Birmingham"],
            "lad_code": [None, "E08000025"]
        })
        expected_df = pd.DataFrame({
            "name": ["Birmingham"],
            "lad_code": ["E08000025"]
        })

        # act
        result = onboarder._drop_empty_rows(input_df)

        # assert
        assert list(result["name"]) == ["Birmingham"]
        pd.testing.assert_frame_equal(result.reset_index(drop=True), expected_df)

    def test_drop_empty_rows_where_council_name_is_a_whitespace_but_lad_code_exists(self, onboarder):
        # arrange
        input_df = pd.DataFrame({
            "name": ["   ", "Birmingham"],
            "lad_code": ["E06000044", "E08000025"]
        })
        expected_df = pd.DataFrame({
            "name": ["Birmingham"],
            "lad_code": ["E08000025"]
        })

        # act
        result = onboarder._drop_empty_rows(input_df)

        # assert
        assert list(result["name"]) == ["Birmingham"]
        pd.testing.assert_frame_equal(result.reset_index(drop=True), expected_df)

    def test_drop_empty_rows_where_council_name_exits_but_lad_code_is_a_whitespace(self, onboarder):
        # arrange
        input_df = pd.DataFrame({
            "name": ["Portsmouth UA", "Birmingham"],
            "lad_code": ["   ", "E08000025"]
        })
        expected_df = pd.DataFrame({
            "name": ["Birmingham"],
            "lad_code": ["E08000025"]
        })

        # act
        result = onboarder._drop_empty_rows(input_df)

        # assert
        assert list(result["name"]) == ["Birmingham"]
        pd.testing.assert_frame_equal(result.reset_index(drop=True), expected_df)

    def test_drop_empty_rows_preserves_valid_rows(self, onboarder):
        # arrange
        df = pd.DataFrame({
            "name": ["Portsmouth UA", "Birmingham"],
            "lad_code": ["E06000044", "E08000025"]
        })

        # act
        result = onboarder._drop_empty_rows(df)

        # assert
        assert len(result) == 2
        pd.testing.assert_frame_equal(result.reset_index(drop=True), df)


    def test_drop_empty_rows_returns_empty_dataframe_when_all_rows_are_invalid(self, onboarder):
        # arrange
        df = pd.DataFrame({
            "name": ["   ", None],
            "lad_code": [None, "   "]
        })

        # act
        result = onboarder._drop_empty_rows(df)

        # assert
        assert result.empty


class TestCleanInputData:
    @pytest.mark.parametrize("input_data, expected", [
        (
                {"name": ["PORTSMOUTH UA", "BIRMINGHAM"], "lad_code": ["E06000044", "E08000025"]},
                {"name": ["Portsmouth UA", "Birmingham"], "lad_code": ["E06000044", "E08000025"]},
        ),
        (
                {"name": ["ISLE OF WIGHT UA", "  "], "lad_code": ["E06000046", "E07000999"]},
                {"name": ["Isle Of Wight UA"], "lad_code": ["E06000046"]},
        ),
        (
                {"name": ["TEWKESBURY", None], "lad_code": ["E07000083", "E07000999"]},
                {"name": ["Tewkesbury"], "lad_code": ["E07000083"]},
        ),
        (
                {"name": ["VALE OF WHITE HORSE"], "lad_code": ["(E07000180)"]},
                {"name": [], "lad_code": []},
        ),
    ])
    def test_clean_input_data_cleans_as_expected(self, input_data, expected, onboarder):
        # arrange
        expected_df = pd.DataFrame(expected)

        # act
        result = onboarder._clean_input_data(pd.DataFrame(input_data))

        # assert
        assert list(result["name"]) == list(expected_df["name"])
        assert list(result["lad_code"]) == list(expected_df["lad_code"])

    def test_clean_input_data_does_not_mutate_original_dataframe(self, onboarder):
        # arrange
        df = pd.DataFrame({
            "name": ["PORTSMOUTH UA"],
            "lad_code": ["E06000044"]
        })
        original_name = df["name"].iloc[0]

        # act
        onboarder._clean_input_data(df)

        # assert
        assert df["name"].iloc[0] == original_name


class TestMerge:
    def test_merge_combines_incoming_and_existing(self):
        # arrange
        incoming = pd.DataFrame({
            "name": ["PORTSMOUTH UA"],
            "lad_code": ["E06000044"]
        })
        existing = pd.DataFrame({
            "name": ["BIRMINGHAM"],
            "lad_code": ["E08000025"]
        })
        expected = pd.DataFrame({
            "name": ["BIRMINGHAM", "PORTSMOUTH UA"],
            "lad_code": ["E08000025", "E06000044"]
        })

        # act
        result = OnboardCouncils._merge(
            new_councils=incoming,
            existing_councils=existing
        )

        # assert
        assert len(result) == 2
        pd.testing.assert_frame_equal(result.reset_index(drop=True), expected)

    def test_merge_doesnt_add_duplicates(self):
        # arrange
        incoming = pd.DataFrame({
            "name": ["PORTSMOUTH UA"],
            "lad_code": ["E06000044"]
        })
        existing = pd.DataFrame({
            "name": ["PORTSMOUTH UA"],
            "lad_code": ["E06000044"]
        })
        expected = pd.DataFrame({
            "name": ["PORTSMOUTH UA"],
            "lad_code": ["E06000044"]
        })

        # act
        result = OnboardCouncils._merge(
            new_councils=incoming,
            existing_councils=existing
        )

        # assert
        assert len(result) == 1
        pd.testing.assert_frame_equal(result.reset_index(drop=True), expected)

    def test_merge_is_sorted_by_name_case_insensitively(self):
        # arrange
        incoming = pd.DataFrame({
            "name": ["portsmouth UA", "Birmingham"],
            "lad_code": ["E06000044", "E08000025"]
        })
        existing = pd.DataFrame({
            "name": ["Aylesbury"],
            "lad_code": ["E0700004"]
        })

        # act
        result = OnboardCouncils._merge(
            new_councils=incoming,
            existing_councils=existing
        )

        # assert
        names = list(result["name"])
        assert names == sorted(names, key=str.lower)

    def test_merge_returns_existing_councils_unchanged_when_incoming_is_empty(self):
        # arrange
        incoming = pd.DataFrame({"name": [], "lad_code": []})
        existing = pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]})

        # act
        result = OnboardCouncils._merge(
            new_councils=incoming,
            existing_councils=existing
        )

        # assert
        assert list(result["name"] == ["Birmingham"])

    def test_merge_returns_new_councils_from_incoming_when_existing_is_empty(self):
        # arrange
        incoming = pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]})
        existing = pd.DataFrame({"name": [], "lad_code": []})

        # act
        result = OnboardCouncils._merge(incoming, existing)

        # assert
        assert list(result["name"]) == ["Portsmouth UA"]

    def test_merge_returns_empty_dataframe_when_both_inputs_are_empty(self):
        # arrange
        incoming = pd.DataFrame({"name": [], "lad_code": []})
        existing = pd.DataFrame({"name": [], "lad_code": []})

        # act
        result = OnboardCouncils._merge(incoming, existing)

        # assert
        assert result.empty

    def test_merge_returns_a_dataframe(self):
        # arrange
        incoming = pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]})
        existing = pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]})

        # act
        result = OnboardCouncils._merge(incoming, existing)

        # assert
        assert isinstance(result, pd.DataFrame)

    def test_merge_treats_differing_data_in_any_column_as_distinct(self):
        # arrange
        incoming = pd.DataFrame({"name": ["Portsmouth"], "lad_code": ["E06000044"]})
        existing = pd.DataFrame({"name": ["Portsmouth UA"], "lad_code": ["E06000044"]})

        # act
        result = OnboardCouncils._merge(incoming, existing)

        # assert
        assert len(result) == 2


class TestSave:
    def test_save_saves_csv_to_output_path(self, tmp_path, dummy_input):
        # arrange
        output = tmp_path / "saved.csv"
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=output,
        )
        df = pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]})

        # act
        onboarder._save(df)

        # assert
        assert output.exists()

    def test_save_saves_csv_with_content_that_matches_dataframe(self, tmp_path, dummy_input):
        # arrange
        output = tmp_path / "saved.csv"
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=output,
        )
        df = pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]})
        onboarder._save(df)

        # act
        result = pd.read_csv(output)

        # assert
        pd.testing.assert_frame_equal(result, df)

    def test_save_does_not_write_index_column(self, tmp_path, dummy_input):
        # arrange
        output = tmp_path / "saved.csv"
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=output,
        )
        onboarder._save(pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]}))

        # act
        result = pd.read_csv(output)

        # assert
        assert "Unnamed: 0" not in result.columns

    def test_save_overwrites_existing_file(self, tmp_path, dummy_input):
        # arrange
        output = tmp_path / "saved.csv"
        output.write_text("old content")
        onboarder = OnboardCouncils(
            input_file_path=dummy_input,
            councils_csv=output,
        )

        # act
        onboarder._save(pd.DataFrame({"name": ["Birmingham"], "lad_code": ["E08000025"]}))
        content = output.read_text()

        # assert
        assert "old content" not in content
        assert "Birmingham" in content
