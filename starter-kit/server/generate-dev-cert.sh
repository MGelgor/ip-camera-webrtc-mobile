#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/certs/dev"
KEY_FILE="${CERT_DIR}/localhost-key.pem"
CERT_FILE="${CERT_DIR}/localhost-cert.pem"

mkdir -p "${CERT_DIR}"

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -days 365 \
  -subj "/C=TR/ST=Istanbul/L=Istanbul/O=Multitek/OU=Dev/CN=localhost"

echo "Olusturuldu:"
echo "  ${KEY_FILE}"
echo "  ${CERT_FILE}"
echo
echo ".env icine su alanlari eklenebilir:"
echo "  SIGNALING_TLS_KEY_PATH=${KEY_FILE}"
echo "  SIGNALING_TLS_CERT_PATH=${CERT_FILE}"
