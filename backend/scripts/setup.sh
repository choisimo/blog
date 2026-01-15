#!/bin/bash

# ===================================
# Blog Backend Quick Setup Script
# ===================================
# This script helps set up the blog backend on Ubuntu
# Usage: bash setup.sh [--pm2|--systemd] [--cloudflare|--nginx]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
SERVICE_MANAGER="pm2"  # or "systemd"
PROXY_METHOD="cloudflare"  # or "nginx"
WORKING_DIR=$(pwd)
NODE_VERSION="20"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --pm2)
            SERVICE_MANAGER="pm2"
            shift
            ;;
        --systemd)
            SERVICE_MANAGER="systemd"
            shift
            ;;
        --cloudflare)
            PROXY_METHOD="cloudflare"
            shift
            ;;
        --nginx)
            PROXY_METHOD="nginx"
            shift
            ;;
        --help)
            echo "Usage: $0 [--pm2|--systemd] [--cloudflare|--nginx]"
            echo "  --pm2         Use PM2 for process management (default)"
            echo "  --systemd     Use systemd for process management"
            echo "  --cloudflare  Use Cloudflare Tunnel for HTTPS (default)"
            echo "  --nginx       Use Nginx + Let's Encrypt for HTTPS"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Blog Backend Setup Script${NC}"
echo -e "${GREEN}====================================${NC}"
echo "Service Manager: $SERVICE_MANAGER"
echo "Proxy Method: $PROXY_METHOD"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to prompt for input
prompt_input() {
    local prompt_text="$1"
    local var_name="$2"
    local default_value="$3"
    
    if [ -n "$default_value" ]; then
        read -p "$prompt_text [$default_value]: " input_value
        eval "$var_name=\${input_value:-$default_value}"
    else
        read -p "$prompt_text: " input_value
        while [ -z "$input_value" ]; do
            echo -e "${RED}This field is required${NC}"
            read -p "$prompt_text: " input_value
        done
        eval "$var_name=\$input_value"
    fi
}

# Function to generate random token
generate_token() {
    openssl rand -hex 32
}

# Step 1: Check Node.js installation
echo -e "${YELLOW}Step 1: Checking Node.js installation...${NC}"
if command_exists node; then
    NODE_INSTALLED_VERSION=$(node -v | sed 's/v//')
    echo "Node.js version $NODE_INSTALLED_VERSION is installed"
    
    # Check if version is >= 20
    REQUIRED_VERSION="20.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_INSTALLED_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        echo -e "${RED}Node.js version 20 or higher is required${NC}"
        echo "Would you like to install Node.js 20? (y/n)"
        read -r install_node
        if [ "$install_node" = "y" ]; then
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}Node.js is not installed. Installing Node.js ${NODE_VERSION}...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Step 2: Install dependencies
echo -e "${YELLOW}Step 2: Installing backend dependencies...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the backend directory${NC}"
    exit 1
fi
npm install

# Step 3: Create .env file
echo -e "${YELLOW}Step 3: Setting up environment configuration...${NC}"
if [ -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file already exists${NC}"
    echo "Would you like to backup and create a new one? (y/n)"
    read -r backup_env
    if [ "$backup_env" = "y" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo "Existing .env backed up"
    else
        echo "Keeping existing .env file"
        # Skip to next step
    fi
fi

if [ ! -f ".env" ] || [ "$backup_env" = "y" ]; then
    echo "Creating .env file..."
    
    # Collect required information
    prompt_input "GitHub username (repo owner)" GITHUB_OWNER
    prompt_input "GitHub repository name" GITHUB_REPO "blog"
    prompt_input "GitHub Personal Access Token (with repo permissions)" GITHUB_TOKEN
    prompt_input "Git commit author name" GIT_USER_NAME
    prompt_input "Git commit author email" GIT_USER_EMAIL
    prompt_input "Frontend domain (GitHub Pages URL)" FRONTEND_DOMAIN "https://noblog.nodove.com"
    
    # Generate admin token
    ADMIN_TOKEN=$(generate_token)
    echo "Generated Admin Bearer Token: $ADMIN_TOKEN"
    
    # Optional configurations
    echo ""
    echo "Optional configurations (press Enter to skip):"
    prompt_input "Gemini API Key" GEMINI_API_KEY ""
    
    # Create .env file
    cat > .env << EOF
# Generated by setup.sh on $(date)

# Server Configuration
APP_ENV=production
HOST=0.0.0.0
PORT=5080

# CORS
ALLOWED_ORIGINS=${FRONTEND_DOMAIN},http://localhost:5173

# GitHub Configuration
GITHUB_TOKEN=${GITHUB_TOKEN}
GITHUB_REPO_OWNER=${GITHUB_OWNER}
GITHUB_REPO_NAME=${GITHUB_REPO}
GIT_USER_NAME=${GIT_USER_NAME}
GIT_USER_EMAIL=${GIT_USER_EMAIL}

# Admin Protection
ADMIN_BEARER_TOKEN=${ADMIN_TOKEN}

# Optional Services
GEMINI_API_KEY=${GEMINI_API_KEY}
GEMINI_MODEL=gemini-1.5-flash

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
EOF
    
    echo -e "${GREEN}.env file created successfully${NC}"
    echo ""
    echo -e "${YELLOW}Important: Save your Admin Bearer Token:${NC}"
    echo "$ADMIN_TOKEN"
    echo ""
fi

# Step 4: Setup process manager
echo -e "${YELLOW}Step 4: Setting up process manager ($SERVICE_MANAGER)...${NC}"

if [ "$SERVICE_MANAGER" = "pm2" ]; then
    # Install PM2 globally if not installed
    if ! command_exists pm2; then
        echo "Installing PM2..."
        sudo npm install -g pm2
    fi
    
    # Start the application
    echo "Starting application with PM2..."
    pm2 start ecosystem.config.js --env production
    
    # Setup PM2 startup script
    pm2 startup systemd -u $USER --hp $HOME
    pm2 save
    
    echo -e "${GREEN}PM2 setup complete${NC}"
    echo "Useful PM2 commands:"
    echo "  pm2 status          - Check status"
    echo "  pm2 logs blog-backend - View logs"
    echo "  pm2 restart blog-backend - Restart service"
    
elif [ "$SERVICE_MANAGER" = "systemd" ]; then
    # Copy systemd service file
    echo "Setting up systemd service..."
    
    # Update paths in service file
    sed "s|/home/ubuntu|$HOME|g" deploy/blog-backend.service > /tmp/blog-backend.service
    
    sudo cp /tmp/blog-backend.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable blog-backend
    sudo systemctl start blog-backend
    
    echo -e "${GREEN}Systemd setup complete${NC}"
    echo "Useful systemd commands:"
    echo "  sudo systemctl status blog-backend  - Check status"
    echo "  sudo journalctl -u blog-backend -f  - View logs"
    echo "  sudo systemctl restart blog-backend - Restart service"
fi

# Step 5: Test backend
echo -e "${YELLOW}Step 5: Testing backend...${NC}"
sleep 3  # Wait for service to start
if curl -s http://localhost:5080/api/v1/healthz | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend is running successfully${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    echo "Check logs for errors:"
    if [ "$SERVICE_MANAGER" = "pm2" ]; then
        pm2 logs blog-backend --lines 20
    else
        sudo journalctl -u blog-backend -n 20
    fi
fi

# Step 6: Setup HTTPS proxy
echo -e "${YELLOW}Step 6: Setting up HTTPS proxy ($PROXY_METHOD)...${NC}"

if [ "$PROXY_METHOD" = "cloudflare" ]; then
    echo ""
    echo -e "${YELLOW}Cloudflare Tunnel Setup Instructions:${NC}"
    echo "1. Install cloudflared (if not installed):"
    echo "   curl -fsSL https://pkg.cloudflare.com/install.sh | sudo bash"
    echo "   sudo apt-get install -y cloudflared"
    echo ""
    echo "2. Authenticate with Cloudflare:"
    echo "   cloudflared tunnel login"
    echo ""
    echo "3. Create tunnel:"
    echo "   cloudflared tunnel create blog-api"
    echo ""
    echo "4. Route your domain:"
    echo "   cloudflared tunnel route dns blog-api api.yourdomain.com"
    echo ""
    echo "5. Copy the config file:"
    echo "   sudo cp deploy/cloudflared-config.yml /etc/cloudflared/config.yml"
    echo "   # Edit the file to add your tunnel UUID"
    echo ""
    echo "6. Start the tunnel service:"
    echo "   sudo systemctl enable --now cloudflared"
    echo ""
    
elif [ "$PROXY_METHOD" = "nginx" ]; then
    # Check if Nginx is installed
    if ! command_exists nginx; then
        echo "Installing Nginx..."
        sudo apt-get update
        sudo apt-get install -y nginx
    fi
    
    prompt_input "Enter your API domain (e.g., api.yourdomain.com)" API_DOMAIN
    
    # Copy and update Nginx config
    sed "s|api.yourdomain.com|$API_DOMAIN|g" deploy/nginx-blog-api.conf > /tmp/blog-api
    sudo cp /tmp/blog-api /etc/nginx/sites-available/blog-api
    sudo ln -sf /etc/nginx/sites-available/blog-api /etc/nginx/sites-enabled/blog-api
    
    # Test and reload Nginx
    sudo nginx -t
    sudo systemctl reload nginx
    
    echo ""
    echo -e "${YELLOW}Setting up SSL with Let's Encrypt...${NC}"
    echo "Installing Certbot..."
    sudo apt-get install -y certbot python3-certbot-nginx
    
    echo "Obtaining SSL certificate..."
    sudo certbot --nginx -d $API_DOMAIN --redirect --non-interactive --agree-tos -m $GIT_USER_EMAIL
    
    echo -e "${GREEN}Nginx and SSL setup complete${NC}"
fi

# Step 7: Final instructions
echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "Next steps:"
echo "1. Add VITE_API_BASE_URL to GitHub repository secrets:"
echo "   - Go to: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/settings/secrets/actions"
echo "   - Add new secret: VITE_API_BASE_URL"
if [ "$PROXY_METHOD" = "nginx" ]; then
    echo "   - Value: https://${API_DOMAIN}"
else
    echo "   - Value: https://api.yourdomain.com (your Cloudflare tunnel domain)"
fi
echo ""
echo "2. Trigger a GitHub Pages deployment:"
echo "   - Push to main branch or manually trigger the workflow"
echo ""
echo "3. Test the integration:"
echo "   - Visit your GitHub Pages site"
echo "   - Check browser console for API calls"
echo "   - Try posting a comment"
echo ""
echo -e "${YELLOW}Important information saved:${NC}"
echo "- Environment config: .env"
echo "- Admin Bearer Token: $ADMIN_TOKEN"
if [ "$SERVICE_MANAGER" = "pm2" ]; then
    echo "- PM2 config: ecosystem.config.js"
else
    echo "- Systemd service: /etc/systemd/system/blog-backend.service"
fi
echo ""
echo -e "${GREEN}Your backend is now running!${NC}"
