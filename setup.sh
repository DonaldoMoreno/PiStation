#!/usr/bin/env bash
# =============================================================================
# PiStation Setup Script
# =============================================================================
# Run once as root (or with sudo) on a fresh Raspberry Pi 5 running
# Raspberry Pi OS (64-bit, Desktop).
#
# Usage:
#   sudo bash setup.sh
# =============================================================================

set -euo pipefail

PISTATION_USER="pistation"
INSTALL_DIR="/opt/pistation"
SERVICE_SRC="pistation-kiosk.service"
SERVICE_DEST="/etc/systemd/system/pistation-kiosk.service"

# ---------------------------------------------------------------------------
# 0. Ensure we are root
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root. Try: sudo bash setup.sh"
    exit 1
fi

echo "=== PiStation Setup ==="

# ---------------------------------------------------------------------------
# 1. System update
# ---------------------------------------------------------------------------
echo "[1/9] Updating system packages…"
apt-get update -qq
apt-get upgrade -y -qq

# ---------------------------------------------------------------------------
# 2. Install system dependencies
# ---------------------------------------------------------------------------
echo "[2/9] Installing Chromium, ChromeDriver, Python and X utilities…"
apt-get install -y -qq \
    chromium-browser \
    chromium-chromedriver \
    python3 \
    python3-pip \
    python3-venv \
    x11-xserver-utils \
    xdotool \
    unclutter \
    wmctrl

# ---------------------------------------------------------------------------
# 3. Disable screen blanking and power saving
# ---------------------------------------------------------------------------
echo "[3/9] Disabling screen blanking and power management…"

# Persist settings in /etc/X11/xorg.conf.d/
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/10-blanking.conf <<'EOF'
Section "ServerFlags"
    Option "BlankTime"   "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime"     "0"
EndSection
EOF

# Also disable via systemd logind (prevents DPMS on VT switch)
if grep -q "^#HandleLidSwitch" /etc/systemd/logind.conf 2>/dev/null; then
    sed -i 's/^#HandleLidSwitch.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
fi

# ---------------------------------------------------------------------------
# 4. Configure display with xrandr
#    The 27-inch monitor is expected on HDMI-1 (primary).
#    The 5-inch touchscreen is expected on HDMI-2 (or DSI-0).
#    Adjust connector names to match your hardware:
#      - Run `xrandr` on the Pi while both displays are connected.
#      - Replace HDMI-1 / HDMI-2 below with the actual connector names.
# ---------------------------------------------------------------------------
echo "[4/9] Writing xrandr autostart script…"
XRANDR_SCRIPT="/etc/X11/xinit/xinitrc.d/10-pistation-display.sh"
cat > "$XRANDR_SCRIPT" <<'XRANDREOF'
#!/usr/bin/env bash
# Configure displays for PiStation kiosk.
# Adjust connector names and resolutions to match your hardware.
# Run `xrandr` while both displays are connected to see current connector names.

# Set 27-inch monitor (HDMI-1) as the primary display at 1280x720@30Hz
# to reduce rendering load on low-power devices like Raspberry Pi 3.
xrandr --output HDMI-1 --primary --mode 1280x720 --rate 30 \
       --output HDMI-2 --mode 800x480 --right-of HDMI-1 || true
XRANDREOF
chmod +x "$XRANDR_SCRIPT"

# ---------------------------------------------------------------------------
# 5. Create kiosk system user
# ---------------------------------------------------------------------------
echo "[5/9] Creating kiosk user '${PISTATION_USER}'…"
if ! id "$PISTATION_USER" &>/dev/null; then
    # Create the user with a home directory so .Xauthority can be stored there
    adduser --system --group --shell /usr/sbin/nologin \
            --home "/home/${PISTATION_USER}" "$PISTATION_USER"
fi

# Add the kiosk user to the 'video' group (needed for GPU access on Pi)
usermod -aG video "$PISTATION_USER" || true

# ---------------------------------------------------------------------------
# 6. Install PiStation files
# ---------------------------------------------------------------------------
echo "[6/9] Installing PiStation to ${INSTALL_DIR}…"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/web"
mkdir -p "$INSTALL_DIR/web/vendor/leaflet/images"
cp kiosk.py "$INSTALL_DIR/kiosk.py"
cp requirements.txt "$INSTALL_DIR/requirements.txt"
cp web/index.html "$INSTALL_DIR/web/index.html"
cp web/styles.css "$INSTALL_DIR/web/styles.css"
cp web/app.js "$INSTALL_DIR/web/app.js"
cp web/vendor/leaflet/leaflet.css "$INSTALL_DIR/web/vendor/leaflet/leaflet.css"
cp web/vendor/leaflet/leaflet.js "$INSTALL_DIR/web/vendor/leaflet/leaflet.js"
cp web/vendor/leaflet/images/marker-icon.png "$INSTALL_DIR/web/vendor/leaflet/images/marker-icon.png"
cp web/vendor/leaflet/images/marker-icon-2x.png "$INSTALL_DIR/web/vendor/leaflet/images/marker-icon-2x.png"
cp web/vendor/leaflet/images/marker-shadow.png "$INSTALL_DIR/web/vendor/leaflet/images/marker-shadow.png"
cp web/vendor/leaflet/images/layers.png "$INSTALL_DIR/web/vendor/leaflet/images/layers.png"
cp web/vendor/leaflet/images/layers-2x.png "$INSTALL_DIR/web/vendor/leaflet/images/layers-2x.png"
chown -R "${PISTATION_USER}:${PISTATION_USER}" "$INSTALL_DIR"
chmod 750 "$INSTALL_DIR"
chmod 640 "$INSTALL_DIR/kiosk.py"
chmod 640 "$INSTALL_DIR/web/index.html" "$INSTALL_DIR/web/styles.css" "$INSTALL_DIR/web/app.js"
chmod 640 "$INSTALL_DIR/web/vendor/leaflet/leaflet.css" "$INSTALL_DIR/web/vendor/leaflet/leaflet.js"
chmod 640 \
    "$INSTALL_DIR/web/vendor/leaflet/images/marker-icon.png" \
    "$INSTALL_DIR/web/vendor/leaflet/images/marker-icon-2x.png" \
    "$INSTALL_DIR/web/vendor/leaflet/images/marker-shadow.png" \
    "$INSTALL_DIR/web/vendor/leaflet/images/layers.png" \
    "$INSTALL_DIR/web/vendor/leaflet/images/layers-2x.png"

# ---------------------------------------------------------------------------
# 7. Create Python virtual environment and install dependencies
# ---------------------------------------------------------------------------
echo "[7/9] Creating Python virtual environment…"
sudo -u "$PISTATION_USER" python3 -m venv "${INSTALL_DIR}/venv"
sudo -u "$PISTATION_USER" \
    "${INSTALL_DIR}/venv/bin/pip" install --quiet --upgrade pip
sudo -u "$PISTATION_USER" \
    "${INSTALL_DIR}/venv/bin/pip" install --quiet -r "${INSTALL_DIR}/requirements.txt"

# ---------------------------------------------------------------------------
# 8. Install and enable the systemd service
# ---------------------------------------------------------------------------
echo "[8/9] Installing systemd service…"
cp "$SERVICE_SRC" "$SERVICE_DEST"
chmod 644 "$SERVICE_DEST"
systemctl daemon-reload
systemctl enable pistation-kiosk.service
echo "    Service enabled. It will start automatically after next reboot."
echo "    To start now: sudo systemctl start pistation-kiosk.service"

# ---------------------------------------------------------------------------
# 9. Unclutter: hide the mouse cursor after 1 second of inactivity
# ---------------------------------------------------------------------------
echo "[9/9] Configuring unclutter (cursor hiding)…"
AUTOSTART_DIR="/etc/xdg/autostart"
mkdir -p "$AUTOSTART_DIR"
cat > "${AUTOSTART_DIR}/unclutter.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Unclutter
Exec=unclutter -idle 1 -root
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Connect both displays and reboot."
echo "  2. Verify display connectors:"
echo "       xrandr"
echo "  3. Check service status after boot:"
echo "       sudo systemctl status pistation-kiosk.service"
echo "  4. View live logs:"
echo "       sudo journalctl -u pistation-kiosk.service -f"
echo ""
