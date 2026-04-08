# PiStation

Dual-display kiosk controller for Raspberry Pi 5.

- **27-inch monitor** — rotates between [weather.com/retro](https://weather.com/retro/) and
  [Google Maps](https://www.google.com/maps/@40.1365393,-83.1629969,11.25z) every 30 seconds;
  automatically clicks the *Retrocast* button on the weather page.
- **5-inch touchscreen** — kept available for future use.

---

## Hardware

| Component | Notes |
|-----------|-------|
| Raspberry Pi 5 | 4 GB or 8 GB RAM recommended |
| 27-inch HDMI monitor | Main display (`HDMI-1`) |
| 5-inch touchscreen | Secondary display (`HDMI-2` or `DSI-0`) |

---

## Repository layout

```
PiStation/
├── kiosk.py                  # Python/Selenium kiosk automation script
├── requirements.txt          # Python package dependencies
├── pistation-kiosk.service   # systemd service unit
├── setup.sh                  # One-shot installation script (run as root)
└── README.md
```

---

## Quick start

### 1. Flash the OS

Use **Raspberry Pi OS Desktop (64-bit)** (Bookworm or later).  
Enable SSH during imaging if you need remote access.

### 2. Clone this repository on the Pi

```bash
git clone https://github.com/DonaldoMoreno/PiStation.git
cd PiStation
```

### 3. Identify your display connectors

With both displays connected, run:

```bash
xrandr
```

Note the connector names (e.g. `HDMI-1`, `HDMI-2`, `DSI-0`).  
The 27-inch monitor should be the **primary** output.

If you need to set the 27-inch monitor as primary explicitly:

```bash
xrandr --output HDMI-1 --primary --mode 1920x1080 --rate 60 \
       --output HDMI-2 --mode 800x480
```

> **Note:** Adjust `HDMI-1` / `HDMI-2`, resolutions, and refresh rates to
> match your actual hardware.

### 4. Run the setup script

```bash
sudo bash setup.sh
```

The script will:

1. Update all system packages.
2. Install `chromium-browser`, `chromium-chromedriver`, Python 3, and X
   utilities.
3. Disable screen blanking / DPMS.
4. Create a dedicated `pistation` system user.
5. Install the kiosk script to `/opt/pistation/`.
6. Create a Python virtual environment and install `selenium`.
7. Install and **enable** the `pistation-kiosk` systemd service.
8. Configure `unclutter` to hide the mouse cursor.

### 5. Reboot

```bash
sudo reboot
```

The kiosk starts automatically after the graphical session is ready.

---

## Manual operation

```bash
# Start the kiosk
sudo systemctl start pistation-kiosk.service

# Stop the kiosk
sudo systemctl stop pistation-kiosk.service

# Follow live logs
sudo journalctl -u pistation-kiosk.service -f

# Restart after editing /opt/pistation/kiosk.py
sudo systemctl restart pistation-kiosk.service
```

---

## Configuration

Edit `/opt/pistation/kiosk.py` and adjust the constants near the top of the
file:

| Constant | Default | Description |
|----------|---------|-------------|
| `PAGES` | weather.com + Google Maps | URLs to rotate |
| `DISPLAY_DURATION` | `30` | Seconds per page |
| `PAGE_LOAD_TIMEOUT` | `20` | Max seconds to wait for a page |
| `RETROCAST_BUTTON_TIMEOUT` | `10` | Max seconds to wait for the Retrocast button |
| `MAIN_DISPLAY` | `":0"` (or `$KIOSK_DISPLAY` env var) | X display for the 27-inch monitor |
| `CHROMEDRIVER_PATH` | `/usr/bin/chromedriver` | Path to ChromeDriver |

After editing, restart the service:

```bash
sudo systemctl restart pistation-kiosk.service
```

---

## Troubleshooting

### Browser does not open on the right screen

1. Run `xrandr` to confirm connector names.
2. Set the correct display in the service file:

   ```
   Environment=DISPLAY=:0
   Environment=KIOSK_DISPLAY=:0
   ```

3. If using a multi-seat setup, ensure `XAUTHORITY` points to the right file.

### Retrocast button not found

The weather.com DOM may have changed.  Check the live page and update the
selectors in `click_retrocast()` inside `kiosk.py`.

### Service fails to start

```bash
sudo journalctl -u pistation-kiosk.service -n 50
```

Common causes:

- ChromeDriver version mismatch — update `chromium-browser` and
  `chromium-chromedriver` together (`sudo apt-get install --upgrade …`).
- X display not available — ensure `DISPLAY` and `XAUTHORITY` are set
  correctly in the service file.

---

## License

MIT