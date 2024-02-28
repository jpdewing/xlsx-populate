#!/bin/bash
set -e -u -o pipefail

main() {
    local root=$1
    find "$root" -name '*.xml' -o -name '*.vml' | while read -r file; do
        if test -s "$file"; then
            < "$file" xmllint --format - | sponge "$file"
        fi
    done
}

main "$@"
