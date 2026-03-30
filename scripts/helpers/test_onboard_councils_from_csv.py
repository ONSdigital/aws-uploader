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
    df.to_excel(path, index=False, header=False)
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