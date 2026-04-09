ENV     = "dev"  # Options: "dev", "preprod"
BASE_URL = f"https://uploader.ingest-{ENV}.aws.onsdigital.uk"

NUM_RUNS = 5

MAX_TTFB_MS               = 300
MAX_DOM_CONTENT_LOADED_MS = 1000
MAX_FCP_MS                = 2000
MAX_TTI_MS                = 4000
MAX_FULL_LOAD_MS          = 4000

EXTRACT_FILE_SIZE      = 20
EXTRACT_FILE_UNIT_SIZE = "MB"  # Options: "KB", "MB", "GB"

MANI_FILE_SIZE         = 1
MANI_FILE_UNIT_SIZE    = "KB"  # Options: "KB", "MB", "GB"