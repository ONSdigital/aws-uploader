import pandas as pd
import pytest

from scripts.helpers.onboard_councils_from_csv import OnboardCouncils


@pytest.fixture
def dummy_xlsx(tmp_path):
    df = pd.DataFrame({
        "lad_code": ["E06000044", "E08000011"],
        "name": ["PORTSMOUTH UA", "KNOWSLEY"],
    })
    path = tmp_path / "input.xlsx"
    df.to_excel(path, index=False, header=False)
    return path

def test_onboard_councils_from_csv_reads_xlsx_to_dataframe(dummy_xlsx):
    # arrange
    onboarder = OnboardCouncils(
        input_file_path=dummy_xlsx,
    )
    # act
    result = onboarder._load_xlsx()

    # assert
    assert isinstance(result, pd.DataFrame)
