#!/usr/bin/env bash
# Deploy da landing institucional salonpass.com.br
#   S3: salonpass-landing-834424012647  ·  CloudFront: E3633NASX4A69Q
set -e
BUCKET=salonpass-landing-834424012647
DIST=E3633NASX4A69Q
HERE="$(cd "$(dirname "$0")" && pwd)"
aws s3 sync "$HERE" "s3://$BUCKET" --delete --exclude "deploy.sh"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" >/dev/null
echo "Landing deployada + cache invalidado."
