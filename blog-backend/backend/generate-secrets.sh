#!/bin/bash

# Define the environment file
ENV_FILE=".env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found. Please copy .env.example to .env first."
    exit 1
fi

# List of keys to generate secrets for if they are empty
KEYS=(
    "BACKEND_SECRET_KEY"
    "BACKEND_KEY"
    "JWT_SECRET"
    "ADMIN_BEARER_TOKEN"
    "ADMIN_USERNAME"
    "ADMIN_PASSWORD"
    "MINIO_PASSWORD"
    "GRAFANA_PASSWORD"
    "PGADMIN_PASSWORD"
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
)

echo "Checking for empty secrets in $ENV_FILE..."

for KEY in "${KEYS[@]}"; do
    # Check if the key exists and is empty
    if grep -q "^${KEY}=$" "$ENV_FILE"; then
        echo "Generating secret for $KEY..."
        
        # Determine length/type based on key name
        if [[ "$KEY" == *"USERNAME"* ]]; then
             # Shorter hex for username (8 bytes = 16 chars) or just 'admin'
             # Using a random string confirms to "generate" request
             SECRET="admin-$(openssl rand -hex 4)"
        else
             # Generate a 32-byte hex secret for passwords
             SECRET=$(openssl rand -hex 32)
        fi
        
        # Escape the secret for sed just in case (though hex shouldn't need it)
        # Use sed to replace the empty key with the key=value
        # generic sed found on most linux systems
        sed -i "s/^${KEY}=$/${KEY}=${SECRET}/" "$ENV_FILE"
        
        echo "Updated $KEY"
    else
        # check if key is missing or already has a value
        if grep -q "^${KEY}=" "$ENV_FILE"; then
             echo "$KEY is already set (or formatted differently), skipping."
        else
             echo "Warning: $KEY not found in $ENV_FILE"
        fi
    fi
done

echo "Done! Secrets updated in $ENV_FILE."
