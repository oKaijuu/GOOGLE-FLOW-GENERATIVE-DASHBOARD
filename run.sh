#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo
echo "Google Flow Generative Dashboard"
echo "--------------------------------"
echo

command -v node >/dev/null 2>&1 || {
  echo "[ERRO] Node.js nao foi encontrado no PATH."
  exit 1
}

if [ ! -d "node_modules/playwright" ]; then
  echo "[INFO] Dependencias nao encontradas. Instalando..."
  npm install
fi

BROWSER=""

for candidate in \
  "/usr/bin/google-chrome" \
  "/usr/bin/google-chrome-stable" \
  "/usr/bin/chromium" \
  "/usr/bin/chromium-browser" \
  "/snap/bin/chromium" \
  "$HOME/.local/bin/chromium"
do
  if [ -x "$candidate" ]; then
    BROWSER="$candidate"
    break
  fi
done

if [ -z "$BROWSER" ]; then
  BROWSER="$(command -v google-chrome 2>/dev/null || true)"
fi

if [ -z "$BROWSER" ]; then
  BROWSER="$(command -v chromium 2>/dev/null || true)"
fi

if [ -n "$BROWSER" ]; then
  echo "[OK] Navegador encontrado:"
  echo "     $BROWSER"
  export FLOW_BROWSER_EXECUTABLE="$BROWSER"
else
  echo "[ERRO] Chrome/Chromium nao encontrado."
  echo "[ERRO] Instale o Google Chrome ou Chromium e execute novamente."
  exit 1
fi

COMMAND="${1:-open}"
echo "[INFO] Executando: npm run $COMMAND"
echo
npm run "$COMMAND"
