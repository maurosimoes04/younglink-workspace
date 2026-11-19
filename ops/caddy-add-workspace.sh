#!/bin/zsh
# Acrescenta workspace.younglink.net ao Caddy do Mac Mini. Correr com sudo.
set -euo pipefail

FILE=/etc/caddy/Caddyfile
DOMAIN=workspace.younglink.net
CADDY=/opt/homebrew/bin/caddy
BACKUP="$FILE.bak-$(date +%Y%m%d-%H%M%S)"

if grep -q "^$DOMAIN " "$FILE"; then
  echo "O Caddy já tem $DOMAIN."
else
  cp "$FILE" "$BACKUP"
  printf '\n%s {\n\treverse_proxy localhost:3100\n}\n' "$DOMAIN" >> "$FILE"
  if ! "$CADDY" validate --config "$FILE" --adapter caddyfile >/dev/null 2>&1; then
    cp "$BACKUP" "$FILE"
    echo "Configuração inválida; foi reposta a anterior ($BACKUP)." >&2
    exit 1
  fi
  echo "Acrescentado $DOMAIN (cópia de segurança: $BACKUP)."
fi

"$CADDY" reload --config "$FILE" --adapter caddyfile
echo "Caddy recarregado."
