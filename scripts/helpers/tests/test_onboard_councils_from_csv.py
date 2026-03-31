from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from scripts.helpers.onboard_councils_from_csv import OnboardCouncils


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


def test_init_paths_populate_expected_default_paths(dummy_input):
    # arrange & act
    onboarder = OnboardCouncils(
        input_file_path=dummy_input
    )

    # assert
    assert onboarder.councils_csv == Path("../../councils.csv")
    assert onboarder.output_path == Path("../../councils.csv")


def test_init_paths_populate_expected_custom_paths(dummy_input):
    # arrange & act
    onboarder = OnboardCouncils(
        input_file_path=dummy_input,
        councils_csv=Path("og-test-data.csv"),
        output_path=Path("new-test-data.csv"),
    )

    # assert
    assert onboarder.councils_csv == Path("og-test-data.csv")
    assert onboarder.output_path == Path("new-test-data.csv")


@patch.object(OnboardCouncils, "_save")
@patch.object(OnboardCouncils, "_merge", return_value=pd.DataFrame())
@patch.object(OnboardCouncils, "_clean_input_data", return_value=pd.DataFrame({"council_name": ["Portsmouth UA"], "lad_code": ["E06000044"]}))
@patch.object(OnboardCouncils, "_load_councils_file", return_value=pd.DataFrame({"council_name": ["Birmingham"], "lad_code": ["E08000025"]}))
@patch.object(OnboardCouncils, "_load_input_file", return_value=pd.DataFrame({"council_name": ["Portsmouth UA"], "lad_code": ["E06000044"]}))
def test_run_calls_merge_with_correct_parameter_order(
        _mock_load_input,
        mock_load_councils,
        mock_clean,
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


def test_load_input_file_reads_xlsx_to_dataframe(dummy_input):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path=dummy_input,
    )
    # act
    result = onboarder._load_input_file()

    # assert
    assert isinstance(result, pd.DataFrame)


def test_load_councils_file_reads_csv_to_dataframe(dummy_input, dummy_councils_csv):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path=dummy_input,
        councils_csv=dummy_councils_csv,
        output_path=dummy_councils_csv,
    )
    # act
    result = onboarder._load_councils_file()

    # assert
    assert isinstance(result, pd.DataFrame)


@pytest.mark.parametrize("input_text, expected", [
    ("PORTSMOUTH (CITY)", "PORTSMOUTH"),
    ("TEST {COUNCIL}", "TEST"),
    ("NO BRACKETS", "NO BRACKETS"),
    ("E07000154 (E07000154)", "E07000154"),
    ("MULTI (ONE) AND (TWO)", "MULTI AND"),
    ("Varied (Casing)", "Varied"),
])
def test_remove_brackets_removes_brackets_and_braces_as_expected(input_text, expected):
    # act
    result = OnboardCouncils._remove_brackets(input_text)

    # assert
    assert result == expected


@pytest.mark.parametrize("input_text, expected", [
("PORTSMOUTH UA", "Portsmouth UA"),
    ("ISLE OF WIGHT UA", "Isle Of Wight UA"),
    ("BIRMINGHAM", "Birmingham"),
    ("VALE OF WHITE HORSE", "Vale Of White Horse"),
    ("WEST NORTHAMPTONSHIRE", "West Northamptonshire"),
])
def test_apply_title_casing_returns_expected_text(input_text, expected):
    # act
    result = OnboardCouncils._apply_title_casing(input_text)

    # assert
    assert result == expected


@pytest.mark.parametrize("input_text, expected", [
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
def test_clean_input_data_cleans_data_as_expected(input_text, expected, dummy_input, dummy_councils_csv):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path=dummy_input,
        councils_csv=dummy_councils_csv,
        output_path=dummy_councils_csv,
    )
    input_df = pd.DataFrame(input_text)
    expected_df = pd.DataFrame(expected)

    # act
    result = onboarder._clean_input_data(input_df)

    # assert
    assert list(result["name"]) == list(expected_df["name"])
    assert list(result["lad_code"]) == list(expected_df["lad_code"])
