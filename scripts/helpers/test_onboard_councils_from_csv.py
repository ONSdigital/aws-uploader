import pandas as pd
import pytest

from scripts.helpers.onboard_councils_from_csv import OnboardCouncils


@pytest.fixture
def dummy_input(tmp_path):
    df = pd.DataFrame({
        "lad_code": ["E06000044", "E08000011"],
        "council_name": ["PORTSMOUTH UA", "KNOWSLEY"],
    })
    path = tmp_path / "input.xlsx"
    df.to_excel(path, index=False)
    return path


@pytest.fixture
def dummy_councils_csv(tmp_path):
    df = pd.DataFrame({
        "council_name": ["Portsmouth UA", "Knowsley"],
        "lad_code": ["E06000044", "E08000011"],
    })
    path = tmp_path / "councils.csv"
    df.to_csv(path, index=False, encoding="utf-8")
    return path


def test_load_input_file_reads_xlsx_to_dataframe(dummy_input):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path=dummy_input,
        councils_csv="",
    )
    # act
    result = onboarder._load_input_file()

    # assert
    assert isinstance(result, pd.DataFrame)


def test_load_councils_file_reads_csv_to_dataframe(dummy_councils_csv):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path="",
        councils_csv=dummy_councils_csv,
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
            {"council_name": ["PORTSMOUTH UA", "BIRMINGHAM"], "lad_code": ["E06000044", "E08000025"]},
            {"council_name": ["Portsmouth UA", "Birmingham"], "lad_code": ["E06000044", "E08000025"]},
    ),
    (
            {"council_name": ["ISLE OF WIGHT UA", "  "], "lad_code": ["E06000046", "E07000999"]},
            {"council_name": ["Isle Of Wight UA"], "lad_code": ["E06000046"]},
    ),
    (
            {"council_name": ["TEWKESBURY", None], "lad_code": ["E07000083", "E07000999"]},
            {"council_name": ["Tewkesbury"], "lad_code": ["E07000083"]},
    ),
    (
            {"council_name": ["VALE OF WHITE HORSE"], "lad_code": ["(E07000180)"]},
            {"council_name": [], "lad_code": []},
    ),
])
def test_clean_input_data_cleans_data_as_expected(input_text, expected, dummy_input, dummy_councils_csv):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path=dummy_input,
        councils_csv=dummy_councils_csv
    )
    input_df = pd.DataFrame(input_text)
    expected_df = pd.DataFrame(expected)

    # act
    result = onboarder._clean_input_data(input_df)

    # assert
    assert list(result["council_name"]) == list(expected_df["council_name"])
    assert list(result["lad_code"]) == list(expected_df["lad_code"])