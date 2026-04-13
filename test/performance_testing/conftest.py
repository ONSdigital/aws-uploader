import pytest
from config import BROWSER_CHANNEL, BASE_URL, EXTRACT_FILE_SIZE, EXTRACT_FILE_UNIT_SIZE, MANI_FILE_SIZE, MANI_FILE_UNIT_SIZE

@pytest.fixture(scope="session")
def browser_type_launch_args(browser_type_launch_args, browser_type):
    if BROWSER_CHANNEL and browser_type.name == "chromium":
        return {**browser_type_launch_args, "channel": BROWSER_CHANNEL}
    return browser_type_launch_args

@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


def to_bytes(size: float, unit: str) -> int:
    units = {
        "KB": 1024,
        "MB": 1024 * 1024,
        "GB": 1024 * 1024 * 1024,
    }
    if unit not in units:
        raise ValueError(f"Unrecognised unit '{unit}'. Must be one of: {list(units.keys())}")
    return int(size * units[unit])


def generate_csv(path, target_bytes):
    row = "dummy_col_1,dummy_col_2,dummy_col_3,dummy_col_4,dummy_col_5\n"
    row_bytes = len(row.encode("utf-8"))
    num_rows  = target_bytes // row_bytes

    with open(path, "w") as file:
        file.write(row)
        for _ in range(num_rows):
            file.write(row)


@pytest.fixture(scope="session")
def extract_file(tmp_path_factory):
    path = tmp_path_factory.mktemp("test_files") / "CTAX_EXTRACT_E00000000_20261231.csv"
    generate_csv(path, target_bytes=to_bytes(EXTRACT_FILE_SIZE, EXTRACT_FILE_UNIT_SIZE))
    return path


@pytest.fixture(scope="session")
def mani_file(tmp_path_factory):
    path = tmp_path_factory.mktemp("test_files") / "CTAX_MANI_E00000000_20261231.csv"
    generate_csv(path, target_bytes=to_bytes(MANI_FILE_SIZE, MANI_FILE_UNIT_SIZE))
    return path