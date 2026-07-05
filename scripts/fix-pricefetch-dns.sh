#!/bin/bash
# Fix ERR_NAME_NOT_RESOLVED for PriceFetcher when Twingate (or similar VPN) blocks Railway DNS.
set -euo pipefail

HOST="mudrex-mark-price-fetcher-production.up.railway.app"
IP="69.46.46.125"
URL="https://${HOST}"

echo "Setting Wi-Fi DNS to Google + Cloudflare..."
networksetup -setdnsservers Wi-Fi 8.8.8.8 1.1.1.1

if ! grep -qF "${HOST}" /etc/hosts 2>/dev/null; then
  echo "Adding /etc/hosts entry (requires sudo)..."
  echo "${IP} ${HOST}" | sudo tee -a /etc/hosts >/dev/null
else
  echo "/etc/hosts already contains ${HOST}"
fi

sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder 2>/dev/null || true

echo ""
echo "Done. Open: ${URL}"
echo ""
echo "If the site still fails, quit Twingate from the menu bar and retry."
