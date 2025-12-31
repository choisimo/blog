#!/bin/bash
# =============================================================================
# SSL Certificate Generator for Cloudflare Full Mode
# =============================================================================
#
# Generates a self-signed certificate for use with Cloudflare Full SSL mode.
# The certificate is valid for 15 years and covers *.nodove.com and nodove.com.
#
# Usage:
#   ./generate-ssl-cert.sh [output_dir]
#
# Default output directory: ./ssl
#
# =============================================================================

set -euo pipefail

# Configuration
CERT_DAYS=5475  # 15 years
DOMAIN="*.nodove.com"
ALT_DOMAIN="nodove.com"
COUNTRY="KR"
ORG="Nodove"

# Output directory (default: ./ssl)
SSL_DIR="${1:-./ssl}"

echo "=== SSL Certificate Generator ==="
echo "Output directory: ${SSL_DIR}"
echo ""

# Create SSL directory if not exists
mkdir -p "${SSL_DIR}"

# Check if certificates already exist
if [[ -f "${SSL_DIR}/origin.crt" && -f "${SSL_DIR}/origin.key" ]]; then
    echo "SSL certificates already exist in ${SSL_DIR}"
    echo "Checking certificate validity..."
    
    # Check if certificate is still valid (at least 30 days remaining)
    if openssl x509 -checkend 2592000 -noout -in "${SSL_DIR}/origin.crt" 2>/dev/null; then
        echo "Certificate is still valid. Skipping generation."
        openssl x509 -in "${SSL_DIR}/origin.crt" -noout -subject -dates
        exit 0
    else
        echo "Certificate is expiring soon or invalid. Regenerating..."
    fi
fi

echo "Generating new SSL certificate..."
echo "  Domain: ${DOMAIN}"
echo "  Alt Domain: ${ALT_DOMAIN}"
echo "  Validity: ${CERT_DAYS} days"
echo ""

# Generate self-signed certificate
openssl req -x509 -nodes -days "${CERT_DAYS}" -newkey rsa:2048 \
    -keyout "${SSL_DIR}/origin.key" \
    -out "${SSL_DIR}/origin.crt" \
    -subj "/CN=${DOMAIN}/O=${ORG}/C=${COUNTRY}" \
    -addext "subjectAltName=DNS:${DOMAIN},DNS:${ALT_DOMAIN}" \
    2>/dev/null

# Set proper permissions
chmod 600 "${SSL_DIR}/origin.key"
chmod 644 "${SSL_DIR}/origin.crt"

echo "=== Certificate Generated Successfully ==="
openssl x509 -in "${SSL_DIR}/origin.crt" -noout -subject -dates
echo ""
echo "Files created:"
ls -la "${SSL_DIR}/"
