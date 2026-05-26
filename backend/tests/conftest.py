import os

os.environ["TESTING"] = "1"

pytest_plugins = [
    "tests.fixtures.config",
]
