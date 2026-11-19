#!/bin/zsh
# Envia o espaço de trabalho para o Mac Mini e reinicia o serviço.
# Uso: npm run deploy            (ou: scripts/deploy.sh utilizador@anfitrião)
set -euo pipefail

HOST="${1:-young-link@192.168.1.71}"
REMOTE_DIR="younglink-workspace"
LABEL="net.younglink.workspace"
PORT="${PORT:-3100}"
cd "$(dirname "$0")/.."

# Node instalado com nvm no Mac Mini (usa a versão mais recente que lá existir).
REMOTE_ENV='NODE_BIN=$(ls -d $HOME/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1); export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"'

echo "→ A copiar o código para $HOST:~/$REMOTE_DIR"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .claude \
  --exclude data --exclude .env.local \
  ./ "$HOST:$REMOTE_DIR/"

# Dados e configuração só na primeira vez: nunca se sobrepõem aos do Mac Mini.
node -e 'const D=require("better-sqlite3");const d=new D("data/younglink.db");d.pragma("wal_checkpoint(TRUNCATE)");d.close()'
ssh "$HOST" "mkdir -p $REMOTE_DIR/data"
rsync -az --ignore-existing data/younglink.db "$HOST:$REMOTE_DIR/data/"
if [ -f .env.local ]; then
  rsync -az --ignore-existing .env.local "$HOST:$REMOTE_DIR/"
  ssh "$HOST" "chmod 600 $REMOTE_DIR/.env.local"
fi

echo "→ A instalar e compilar no Mac Mini"
ssh "$HOST" "$REMOTE_ENV; cd $REMOTE_DIR && node -v && npm ci --no-audit --no-fund && npm run build"

echo "→ A (re)arrancar o serviço"
ssh "$HOST" "$REMOTE_ENV"'
  set -e
  PLIST=$HOME/Library/LaunchAgents/'"$LABEL"'.plist
  mkdir -p $HOME/Library/LaunchAgents $HOME/Library/Logs
  cat > $PLIST <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>'"$LABEL"'</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$PATH</string>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>WorkingDirectory</key><string>$HOME/'"$REMOTE_DIR"'</string>
  <key>ProgramArguments</key><array>
    <string>$NODE_BIN/npm</string><string>run</string><string>start</string><string>--</string><string>-p</string><string>'"$PORT"'</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/younglink-workspace.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/younglink-workspace.log</string>
</dict></plist>
EOF
  plutil -lint $PLIST >/dev/null
  SVC=gui/$(id -u)/'"$LABEL"'
  launchctl bootout $SVC 2>/dev/null || true
  for i in {1..20}; do launchctl print $SVC >/dev/null 2>&1 || break; sleep 0.5; done
  for i in {1..5}; do
    launchctl bootstrap gui/$(id -u) $PLIST 2>/dev/null && break
    launchctl print $SVC >/dev/null 2>&1 && break
    sleep 2
  done
  launchctl print $SVC >/dev/null 2>&1 || { echo "O serviço não arrancou." >&2; exit 1; }
'

echo "→ A verificar"
for i in {1..15}; do
  code=$(ssh "$HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/login" || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "login: $code"
[ "$code" = "200" ] && echo "Feito. Disponível em http://${HOST#*@}:$PORT" || { echo "A app não respondeu. Registo: ~/Library/Logs/younglink-workspace.log no Mac Mini"; exit 1; }
