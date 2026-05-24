from selenium import webdriver
from selenium.webdriver.common.by import By


def test_fast_api_can_serve_content():
    browser = webdriver.Edge()

    try:
        browser.get("http://localhost:8000")

        body = browser.find_element(By.TAG_NAME, "body")

        assert "Hello World" in body.text

    finally:
        browser.quit()
