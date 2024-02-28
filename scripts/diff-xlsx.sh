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

extract() {
    local file=$1
    name=$(basename "${file%.*}")
    unzip -q -o -d "$name" "$file"
    indent_folder "$name"
    echo "$name"
}

main() {
    local file1=$1 file2=$2
    folder1=$(extract "$file1")
    folder2=$(extract "$file2")
    cdiff -ur "$folder1" "$folder2"
}

main "$@"
