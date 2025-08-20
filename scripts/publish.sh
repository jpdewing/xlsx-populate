#!/bin/bash
set -e -u -o pipefail

#version=$(cat package.json | jq -r '.version')
#publish_opts=$(echo $version | grep -q beta && echo "--tag beta" || true)
#echo "Publishing version $version with options: $publish_opts"
#yarn publish $publish_opts --new-version $version

pnpm publish

git tag v$version -f
git push --tags
