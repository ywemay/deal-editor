#!/usr/bin/env bash
# register-linux.sh — Register .deal file association on Linux
#
# Usage: ./register-linux.sh /path/to/Deal-Editor-Linux

set -e

APP_BIN="${1:-$(dirname "$0")/../dist/Deal-Editor-Linux/Deal-Editor-Linux}"
APP_BIN="$(realpath "$APP_BIN" 2>/dev/null || echo "$APP_BIN")"

if [ ! -f "$APP_BIN" ]; then
    echo "❌ App binary not found at: $APP_BIN"
    echo "Usage: $0 /path/to/Deal-Editor-Linux"
    exit 1
fi

mkdir -p ~/.local/share/applications
mkdir -p ~/.local/share/mime/packages

# MIME type definition
cat > ~/.local/share/mime/packages/application-x-deal.xml << 'XMLEOF'
<?xml version="1.0"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-deal">
    <comment>Deal file</comment>
    <glob pattern="*.deal"/>
    <icon name="application-x-deal"/>
  </mime-type>
</mime-info>
XMLEOF

# Desktop entry
cat > ~/.local/share/applications/deal-editor.desktop << DESKTOPEOF
[Desktop Entry]
Type=Application
Name=Deal Editor
Comment=Edit .deal order files
Exec="$APP_BIN" %f
Icon=${APP_BIN}
Terminal=false
Categories=Office;Database;
MimeType=application/x-deal;
NoDisplay=false
DESKTOPEOF

# Apply
update-mime-database ~/.local/share/mime 2>/dev/null || true
update-desktop-database ~/.local/share/applications 2>/dev/null || true
xdg-mime default deal-editor.desktop application/x-deal 2>/dev/null || true

echo "✅ .deal file association registered for $(whoami)"
echo "   Double-click a .deal file to open with Deal Editor"
