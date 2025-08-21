#!/bin/bash

# Downloadarr Setup Script
# This script sets up the Downloadarr project with Docker and all required configuration
# It automatically pulls the latest Docker images to ensure you get the most recent version

# Note: We'll enable/disable set -e as needed to handle user input properly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# GitHub repository details
GITHUB_REPO="chrisdmacrae/downloadarr"
GITHUB_RAW_URL="https://raw.githubusercontent.com/${GITHUB_REPO}/refs/heads/main"
    
echo -e "${BLUE}🚀 Downloadarr Setup Script${NC}"
echo "=================================="

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Utility function to update environment variables in .env file
update_env_var() {
    local key="$1"
    local value="$2"
    local env_file=".env"

    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
        # Update existing variable
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$env_file"
        else
            # Linux
            sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
        fi
    else
        # Add new variable
        echo "${key}=${value}" >> "$env_file"
    fi
}

# Utility function to prompt user with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    local user_input=""

    echo -n -e "${BLUE}${prompt}${NC} [${default}]: "
    read -r user_input

    if [[ -z "$user_input" ]]; then
        eval "${var_name}=\"${default}\""
    else
        eval "${var_name}=\"${user_input}\""
    fi
}

# Check if Docker is installed
check_docker() {
    set -e  # Enable exit on error for this function
    print_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        echo
        echo "Please install Docker from: https://docs.docker.com/get-docker/"
        echo
        echo "Installation links:"
        echo "  - macOS: https://docs.docker.com/desktop/install/mac-install/"
        echo "  - Windows: https://docs.docker.com/desktop/install/windows-install/"
        echo "  - Linux: https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed!"
        echo
        echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed"
    set +e  # Disable exit on error after this function
}

# Download configuration files from GitHub
download_config_files() {
    set -e  # Enable exit on error for this function
    print_info "Downloading configuration files from GitHub..."
    

    
    if curl -fsSL "${GITHUB_RAW_URL}/docker-compose.yml" -o docker-compose.yml; then
        print_status "Downloaded docker-compose.yml"
    else
        print_error "Failed to download docker-compose.yml"
        exit 1
    fi

    # Download docker-compose.prod.vpn.yml for VPN support
    if curl -fsSL "${GITHUB_RAW_URL}/docker-compose.vpn.yml" -o docker-compose.vpn.yml; then
        print_status "Downloaded docker-compose.vpn.yml"
    else
        print_error "Failed to download docker-compose.vpn.yml"
        exit 1
    fi
    
    # Download .env.example as .env
    if curl -fsSL "${GITHUB_RAW_URL}/.env.example" -o .env; then
        print_status "Downloaded .env.example as .env"
    else
        print_error "Failed to download .env.example"
        exit 1
    fi
    set +e  # Disable exit on error after this function
}


# Configure environment variables
configure_environment() {
    print_info "Configuring environment variables..."
    
    # Set PUID and PGID
    print_info "Setting user permissions (PUID/PGID)..."
    update_env_var "PUID" "1000"
    update_env_var "PGID" "1000"
    print_status "Set PUID=1000 and PGID=1000"
    
    # API Keys information
    echo
    print_info "API Keys for Enhanced Discovery:"
    echo "  • API keys for OMDB, TMDB, and IGDB are now configured through the web interface"
    echo "  • You'll be guided through the setup during the onboarding process"
    echo "  • These are optional but recommended for the best experience"
    echo

    print_status "Environment variables configured"
}

# Configure VPN
configure_vpn() {
    echo
    print_info "VPN Configuration"
    echo "VPN provides secure and anonymous downloading through an encrypted tunnel."
    echo

    local enable_vpn=""
    echo -n -e "${BLUE}Do you want to enable VPN support?${NC} [y/N]: "
    read -r enable_vpn
    
    if [[ "$enable_vpn" =~ ^[Yy]$ ]]; then
        update_env_var "VPN_ENABLED" "true"
        print_status "VPN enabled"
        
        echo
        print_warning "VPN Setup Instructions:"
        echo "  1. Get an OpenVPN configuration file (.ovpn) from your VPN provider"
        echo "  2. Copy it to this directory as 'config.ovpn'"
        echo "  3. If your VPN requires username/password authentication:"
        echo "     - Create a file called 'credentials.txt'"
        echo "     - Put your username on the first line"
        echo "     - Put your password on the second line"
        echo "  4. Make sure your .ovpn file references 'credentials.txt' if needed"
        echo
        print_info "The setup will continue, but make sure to add your VPN config before starting!"
        
        return 0
    else
        update_env_var "VPN_ENABLED" "false"
        print_status "VPN disabled"
        return 1
    fi
}

# Pull latest Docker images
pull_latest_images() {
    set -e  # Enable exit on error for this function
    local use_vpn="$1"

    print_info "Pulling latest Docker images..."

    if [[ "$use_vpn" == "true" ]]; then
        docker compose -f docker-compose.yml -f docker-compose.vpn.yml pull
    else
        docker compose -f docker-compose.yml pull
    fi

    print_status "Latest Docker images pulled successfully!"
    set +e  # Disable exit on error after this function
}

# Start the application
start_application() {
    set -e  # Enable exit on error for this function
    local use_vpn="$1"

    # Always pull latest images before starting
    pull_latest_images "$use_vpn"

    print_info "Starting Downloadarr..."

    if [[ "$use_vpn" == "true" ]]; then
        print_info "Starting with VPN support..."
        docker compose -f docker-compose.yml -f docker-compose.vpn.yml up -d
    else
        print_info "Starting without VPN..."
        docker compose -f docker-compose.yml up -d
    fi

    print_status "Downloadarr started successfully!"
    set +e  # Disable exit on error after this function
}

# Display final information
show_final_info() {
    echo
    echo -e "${GREEN}🎉 Setup Complete!${NC}"
    echo "==================="
    echo
    echo "Downloadarr services are now running:"
    echo "  • Frontend:     http://localhost:3000"
    echo "  • API Server:   http://localhost:3001"
    echo "  • Jackett:      http://localhost:9117"
    echo "  • AriaNG:       http://localhost:6880"
    echo "  • FlareSolverr:  http://localhost:8191"
    echo
    echo "Next steps:"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Complete the onboarding process"
    echo "  3. Configure API keys for enhanced discovery (optional)"
    echo
    echo "Useful commands:"
    echo "  • View logs:    docker compose logs -f"
    echo "  • Stop:         docker compose down"
    echo "  • Restart:      docker compose restart"
    echo "  • Update:       docker compose pull && docker compose up -d"
    echo
    if [[ -f "config.ovpn" ]]; then
        print_status "VPN config file detected"
    else
        print_warning "Remember to add your VPN config file as 'config.ovpn' if using VPN"
    fi
    echo
    print_info "Latest Docker images have been pulled automatically"
    print_info "Check the logs if any services fail to start: docker compose logs -f"
}

# Main execution
main() {
    check_docker
    download_config_files
    configure_environment
    
    if configure_vpn; then
        start_application "true"
    else
        start_application "false"
    fi
    
    show_final_info
}

# Run main function
main "$@"
