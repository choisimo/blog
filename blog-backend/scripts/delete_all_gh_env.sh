#!/bin/bash

echo "Warning: This will delete ALL Secrets and Variables in this repository."
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "Deleting all Secrets..."
gh secret list --json name -q '.[].name' | while read name; do
    echo "Deleting Secret: $name"
    gh secret delete "$name"
done

echo "Deleting all Variables..."
gh variable list --json name -q '.[].name' | while read name; do
    echo "Deleting Variable: $name"
    gh variable delete "$name"
done

echo "All cleared!"
