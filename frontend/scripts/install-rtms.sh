#!/bin/bash
# Downloads the @zoom/rtms prebuilt native binary from GitHub releases.
# Runs as a postinstall hook to ensure the binary exists on Render (Linux x64).

RTMS_DIR="node_modules/@zoom/rtms"
BINARY="$RTMS_DIR/build/Release/rtms.node"

if [ -f "$BINARY" ]; then
  echo "[rtms-install] Native binary already exists, skipping download"
  exit 0
fi

# Detect platform and arch
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
  ARCH="x64"
fi

# Read version from package.json
VERSION=$(node -e "console.log(require('./$RTMS_DIR/package.json').version)")

# Try both NAPI versions (10 first, then 9)
for NAPI in 10 9; do
  URL="https://github.com/zoom/rtms/releases/download/v${VERSION}/rtms-v${VERSION}-napi-v${NAPI}-${OS}-${ARCH}.tar.gz"
  echo "[rtms-install] Trying: $URL"

  HTTP_CODE=$(curl -sL -w "%{http_code}" -o /tmp/rtms-prebuild.tar.gz "$URL")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "[rtms-install] Downloaded successfully (napi-v${NAPI}, ${OS}-${ARCH})"
    mkdir -p "$RTMS_DIR/build/Release"
    tar -xzf /tmp/rtms-prebuild.tar.gz -C "$RTMS_DIR"
    rm -f /tmp/rtms-prebuild.tar.gz
    if [ -f "$BINARY" ]; then
      echo "[rtms-install] Native binary installed at $BINARY"
      exit 0
    else
      echo "[rtms-install] Extracted but binary not found at expected path, listing:"
      find "$RTMS_DIR/build" -type f 2>/dev/null | head -20
    fi
  fi
done

echo "[rtms-install] WARNING: Could not download prebuilt binary for ${OS}-${ARCH}"
exit 0
