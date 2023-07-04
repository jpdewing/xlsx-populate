#!/bin/bash
set -e -u -o pipefail

indent_folder() {
    local root=$1
    find "$root" -name '*.xml' -o -name '*.vml' | while read -r file; do
        if test -s "$file"; then
            < "$file" xmllint --format - | sponge "$file"
        fi
    done
}


main() {
    local folder=$1 output=$2
    (
        cd "$folder"
        zip -q -r -D "../$output" *
    )
    echo "Written: $output"
}

main "$@"
