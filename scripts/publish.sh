#!/bin/bash
set -e -u -o pipefail

version=$(node -p "require('./package.json').version")
echo "Publishing version $version"

pnpm publish

git tag "v$version" -f
git push --tags
