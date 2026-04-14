#!/usr/bin/env python3
"""
PiStation Kiosk Controller
--------------------------
Drives a dual-display Raspberry Pi 5 kiosk.

Main display (27-inch monitor):
  - Rotates between weather.com/retro and Google Maps every 30 seconds.
  - Automatically clicks the "Retrocast" button on the weather page.

Secondary display (5-inch touchscreen):
  - Not driven by this script; kept available for future UI.
"""

import logging
import os
import subprocess
import time
from urllib.parse import urlparse

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# URLs shown on the main display, in rotation order
PAGES = [
    "https://weather.com/retro/",
    "https://www.google.com/maps/@40.1365393,-83.1629969,11.25z",
]

# Seconds each page is displayed before switching
DISPLAY_DURATION = 30

# Maximum seconds to wait for a page to load before declaring it failed
PAGE_LOAD_TIMEOUT = 20

# Seconds to wait for the Retrocast button to appear after page load
RETROCAST_BUTTON_TIMEOUT = 10

# How many consecutive load failures are tolerated before a short pause
MAX_CONSECUTIVE_FAILURES = 3

# Pause (seconds) after reaching MAX_CONSECUTIVE_FAILURES
FAILURE_PAUSE = 60

# DISPLAY environment variable that points to the 27-inch monitor.
# Adjust if your X display is different (e.g. ":0.0", ":1").
MAIN_DISPLAY = os.environ.get("KIOSK_DISPLAY", ":0")

# Path to the ChromeDriver executable installed by setup.sh
CHROMEDRIVER_PATH = "/usr/bin/chromedriver"

# Kiosk mode:
# - selenium: existing behaviour (page rotation + Retrocast click)
# - web: launch a local web app in Chromium kiosk mode
KIOSK_MODE = os.environ.get("KIOSK_MODE", "selenium").strip().lower()

# URL used by web mode.
# Use a local file by default so it works without an additional web server.
WEB_APP_URL = os.environ.get("WEB_APP_URL", "file:///opt/pistation/web/index.html")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("pistation")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def build_driver() -> webdriver.Chrome:
    """Create and return a headless-free Chromium WebDriver for kiosk use."""
    options = Options()

    # --- Kiosk / display flags ---
    options.add_argument("--kiosk")                      # Full-screen, no chrome
    options.add_argument("--noerrdialogs")               # Suppress crash dialogs
    options.add_argument("--disable-infobars")           # Hide "Chrome is being controlled"
    options.add_argument("--disable-session-crashed-bubble")
    options.add_argument("--disable-restore-session-state")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")

    # --- Stability flags ---
    options.add_argument("--disable-hang-monitor")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-translate")
    options.add_argument("--disable-features=TranslateUI")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-plugins")

    # --- GPU / rendering (important on Pi 5) ---
    options.add_argument("--disable-gpu")                # Avoids GPU driver issues
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--ignore-gpu-blocklist")

    # --- Memory / performance ---
    options.add_argument("--disable-dev-shm-usage")      # Avoid /dev/shm limits
    options.add_argument("--no-sandbox")                  # Required in restricted/containerised environments

    # --- Display: target the 27-inch monitor only ---
    options.add_argument(f"--display={MAIN_DISPLAY}")

    # Use the system Chromium binary
    options.binary_location = "/usr/bin/chromium-browser"

    service = Service(executable_path=CHROMEDRIVER_PATH)
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
    return driver


def click_retrocast(driver: webdriver.Chrome) -> bool:
    """
    Attempt to locate and click the Retrocast button on weather.com/retro.

    Returns True on success, False if the button could not be found.
    The function tries several selector strategies in sequence so that
    minor DOM changes do not break the automation.
    """
    # Selectors tried in priority order
    selectors = [
        # Exact text match (most reliable when text is stable)
        (By.XPATH, "//button[normalize-space(text())='Retrocast']"),
        (By.XPATH, "//*[normalize-space(text())='Retrocast']"),
        # Partial text (handles minor wording changes)
        (By.XPATH, "//*[contains(translate(text(),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'),'RETROCAST')]"),
        # CSS class / aria hints (update if the site changes)
        (By.CSS_SELECTOR, "[data-testid='retrocast-button']"),
        (By.CSS_SELECTOR, "[aria-label*='Retrocast' i]"),
        (By.CSS_SELECTOR, "button.retrocast"),
    ]

    wait = WebDriverWait(driver, RETROCAST_BUTTON_TIMEOUT)

    # First, wait for the page body to be present
    try:
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    except TimeoutException:
        log.warning("Page body not found within timeout.")
        return False

    for by, selector in selectors:
        try:
            element = wait.until(EC.element_to_be_clickable((by, selector)))
            # Scroll into view and click via JavaScript for reliability
            driver.execute_script("arguments[0].scrollIntoView(true);", element)
            driver.execute_script("arguments[0].click();", element)
            log.info("Clicked Retrocast button using selector: %s = %s", by, selector)
            return True
        except (TimeoutException, NoSuchElementException):
            # Try next selector
            pass
        except WebDriverException as exc:
            log.debug("Selector %s failed: %s", selector, exc)

    log.warning("Retrocast button not found. Continuing without clicking.")
    return False


def load_page(driver: webdriver.Chrome, url: str) -> bool:
    """
    Navigate to *url*.  Returns True on success, False on failure.
    """
    try:
        log.info("Loading: %s", url)
        driver.get(url)
        return True
    except TimeoutException:
        log.error("Timeout loading %s", url)
    except WebDriverException as exc:
        log.error("WebDriver error loading %s: %s", url, exc)
    return False


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def run_selenium_kiosk() -> None:
    """Entry point for the selenium-based kiosk rotation loop."""
    driver: webdriver.Chrome | None = None
    consecutive_failures = 0

    log.info("PiStation kiosk starting (display=%s).", MAIN_DISPLAY)

    while True:
        # (Re-)create driver if it does not exist or has crashed
        if driver is None:
            try:
                driver = build_driver()
                log.info("WebDriver initialised.")
            except WebDriverException as exc:
                log.error("Failed to start WebDriver: %s", exc)
                log.info("Retrying in %d seconds…", FAILURE_PAUSE)
                time.sleep(FAILURE_PAUSE)
                continue

        for url in PAGES:
            success = load_page(driver, url)

            if not success:
                consecutive_failures += 1
                log.warning(
                    "Page load failed (%d/%d consecutive).",
                    consecutive_failures,
                    MAX_CONSECUTIVE_FAILURES,
                )
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    log.error(
                        "Too many consecutive failures. Pausing %d seconds.",
                        FAILURE_PAUSE,
                    )
                    time.sleep(FAILURE_PAUSE)
                    consecutive_failures = 0
                    # Restart the driver to clear any broken state
                    try:
                        driver.quit()
                    except Exception:
                        pass
                    driver = None
                    break  # Re-enter the outer loop to rebuild the driver
                continue  # Skip display timer for failed page

            consecutive_failures = 0  # Reset on any success

            # --- Post-load page-specific actions ---
            if urlparse(url).hostname in ("weather.com", "www.weather.com"):
                click_retrocast(driver)

            # Show the page for the configured duration
            log.info("Displaying %s for %d seconds.", url, DISPLAY_DURATION)
            time.sleep(DISPLAY_DURATION)

            # Check the driver is still alive before the next iteration
            try:
                _ = driver.current_url  # lightweight liveness probe
            except WebDriverException:
                log.error("WebDriver died unexpectedly. Restarting.")
                driver = None
                break


def run_web_kiosk() -> None:
    """Launch and supervise the standalone web kiosk app in Chromium."""
    cmd = [
        "/usr/bin/chromium-browser",
        "--kiosk",
        "--noerrdialogs",
        "--disable-infobars",
        "--disable-session-crashed-bubble",
        "--disable-restore-session-state",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-sync",
        "--disable-extensions",
        "--metrics-recording-only",
        "--process-per-site",
        "--renderer-process-limit=2",
        "--disk-cache-size=10485760",
        "--media-cache-size=10485760",
        "--disable-features=Translate,AutofillServerCommunication,MediaRouter,OptimizationHints",
        f"--display={MAIN_DISPLAY}",
        WEB_APP_URL,
    ]

    log.info("PiStation web kiosk starting (display=%s, url=%s).", MAIN_DISPLAY, WEB_APP_URL)

    while True:
        try:
            proc = subprocess.Popen(cmd)
            exit_code = proc.wait()
            log.warning("Chromium exited with code %s. Restarting in %d seconds.", exit_code, 5)
            time.sleep(5)
        except KeyboardInterrupt:
            log.info("Interrupted by user. Shutting down.")
            return
        except Exception as exc:
            log.error("Failed to launch web kiosk: %s", exc)
            log.info("Retrying in %d seconds.", FAILURE_PAUSE)
            time.sleep(FAILURE_PAUSE)


def main() -> None:
    try:
        if KIOSK_MODE == "web":
            run_web_kiosk()
        else:
            if KIOSK_MODE != "selenium":
                log.warning("Unknown KIOSK_MODE='%s'. Falling back to 'selenium'.", KIOSK_MODE)
            run_selenium_kiosk()
    except KeyboardInterrupt:
        log.info("Interrupted by user. Shutting down.")


if __name__ == "__main__":
    main()
