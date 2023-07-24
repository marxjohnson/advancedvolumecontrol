#!/bin/bash

# Updates all translation-related files.

# Search for translatable strings and put them in po/messages.po
xgettext --from-code=UTF-8 \
         --add-comments="Translators" \
         --package-name="Advanced Volume Control" \
         --msgid-bugs-address="https://github.com/marxjohnson/advancedvolumecontrol/issues" \
         -o po/messages.pot -- *.js

# Check if any translations have changed and need an update
for file in po/*.po
do
    echo -n "Updating $(basename "$file" .po)"
    msgmerge -U "$file" po/messages.pot

    if grep --silent "#, fuzzy" "$file"; then
        fuzzy+=("$(basename "$file" .po)")
    fi
done

if [[ -v fuzzy ]]; then
    echo "WARNING: The following translations have fuzzy strings and need an update: ${fuzzy[*]}"
fi
