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

# Function to get the machine's LAN IP address
get_lan_ip() {
    local lan_ip=""

    # Try different methods to get LAN IP based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - try multiple methods
        lan_ip=$(route get default 2>/dev/null | grep interface | awk '{print $2}' | xargs ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
        if [[ -z "$lan_ip" ]]; then
            # Alternative method for macOS
            lan_ip=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | grep -E "192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\." | awk '{print $2}' | head -1)
        fi
        if [[ -z "$lan_ip" ]]; then
            # Fallback for macOS
            lan_ip=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux - try multiple methods
        lan_ip=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+')
        if [[ -z "$lan_ip" ]]; then
            # Alternative method for Linux
            lan_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        fi
        if [[ -z "$lan_ip" ]]; then
            # Another fallback for Linux
            lan_ip=$(ip addr show 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | grep -E "192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\." | awk '{print $2}' | cut -d'/' -f1 | head -1)
        fi
    else
        # Generic Unix/other systems
        lan_ip=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
    fi

    # Validate IP address format
    if [[ "$lan_ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$lan_ip"
    else
        echo "localhost"
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
        :  # Silent success
    else
        print_error "Failed to download docker-compose.yml"
        exit 1
    fi

    # Download docker-compose.prod.vpn.yml for VPN support
    if curl -fsSL "${GITHUB_RAW_URL}/docker-compose.vpn.yml" -o docker-compose.vpn.yml; then
        :  # Silent success
    else
        print_error "Failed to download docker-compose.vpn.yml"
        exit 1
    fi

    # Download .env.example as .env
    if curl -fsSL "${GITHUB_RAW_URL}/.env.example" -o .env; then
        :  # Silent success
    else
        print_error "Failed to download .env.example"
        exit 1
    fi

    print_status "Configuration files downloaded"
    set +e  # Disable exit on error after this function
}


# Configure environment variables
configure_environment() {
    print_info "Configuring environment variables..."

    # Set PUID and PGID
    update_env_var "PUID" "1000"
    update_env_var "PGID" "1000"

    # Configure CORS/Frontend URL
    local lan_ip=$(get_lan_ip)

    if [[ "$lan_ip" == "localhost" ]]; then
        local frontend_urls="http://localhost:3000,http://downloadarr:3000"
    else
        local frontend_urls="http://localhost:3000,http://${lan_ip}:3000,http://downloadarr:3000"
    fi

    update_env_var "FRONTEND_URL" "$frontend_urls"

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
        docker compose -f docker-compose.yml -f docker-compose.vpn.yml pull > /dev/null 2>&1
    else
        docker compose -f docker-compose.yml pull > /dev/null 2>&1
    fi

    print_status "Docker images pulled"
    set +e  # Disable exit on error after this function
}

# Start the application
start_application() {
    set -e  # Enable exit on error for this function
    local use_vpn="$1"

    # Always pull latest images before starting
    pull_latest_images "$use_vpn"

    print_info "Starting Downloadarr services..."

    if [[ "$use_vpn" == "true" ]]; then
        docker compose -f docker-compose.yml -f docker-compose.vpn.yml up -d > /dev/null 2>&1
    else
        docker compose -f docker-compose.yml up -d > /dev/null 2>&1
    fi

    print_status "Services started"
    set +e  # Disable exit on error after this function
}

# Display final information
show_final_info() {
    local lan_ip=$(get_lan_ip)

    echo
    echo -e "${GREEN}🎉 Setup Complete!${NC}"
    echo "==================="
    echo
    echo "Downloadarr services are now running:"
    echo "  • Frontend:     http://localhost:3000"
    if [[ "$lan_ip" != "localhost" ]]; then
        echo "  • Frontend (LAN): http://${lan_ip}:3000"
    fi
    echo "  • API Server:   http://localhost:3001"
    echo "  • Jackett:      http://localhost:9117"
    echo "  • AriaNG:       http://localhost:6880"
    echo "  • FlareSolverr:  http://localhost:8191"
    echo
    echo "Access Options:"
    echo "  • Local:        http://localhost:3000"
    if [[ "$lan_ip" != "localhost" ]]; then
        echo "  • From LAN:     http://${lan_ip}:3000"
    fi
    echo

    # CORS Configuration Information
    echo -e "${BLUE}CORS Configuration:${NC}"
    if [[ "$lan_ip" == "localhost" ]]; then
        print_warning "Could not detect LAN IP address"
        echo "  • Configured for localhost access only"
        echo "  • If you need LAN access, manually set FRONTEND_URL in .env"
    else
        print_status "Detected LAN IP: $lan_ip"
        echo "  • Configured to allow access from:"
        echo "    - http://localhost:3000 (local access)"
        echo "    - http://${lan_ip}:3000 (LAN access)"
        echo "    - http://downloadarr:3000 (Docker internal)"
        echo "  • This resolves CORS errors when accessing from different devices"
    fi
    echo

    # User Permissions Information
    echo -e "${BLUE}User Permissions:${NC}"
    echo "  • Set PUID=1000 and PGID=1000 for consistent file permissions"
    echo "  • Downloaded files will be owned by user ID 1000"
    echo

    # API Keys Information
    echo -e "${BLUE}API Keys for Enhanced Discovery:${NC}"
    echo "  • API keys for OMDB, TMDB, and IGDB are configured through the web interface"
    echo "  • You'll be guided through the setup during the onboarding process"
    echo "  • These are optional but recommended for the best experience"
    echo

    echo "Next steps:"
    echo "  1. Open http://localhost:3000 in your browser"
    if [[ "$lan_ip" != "localhost" ]]; then
        echo "     (or http://${lan_ip}:3000 from other devices on your network)"
    fi
    echo "  2. Complete the onboarding process"
    echo "  3. Configure API keys for enhanced discovery (optional)"
    echo
    echo "Useful commands:"
    echo "  • View logs:    docker compose logs -f"
    echo "  • Stop:         docker compose down"
    echo "  • Restart:      docker compose restart"
    echo "  • Update:       docker compose pull && docker compose up -d"
    echo

    # VPN Information
    if [[ -f "config.ovpn" ]]; then
        print_status "VPN config file detected"
    else
        if grep -q "VPN_ENABLED=true" .env 2>/dev/null; then
            print_warning "VPN is enabled but no config.ovpn file found"
            echo "  • Add your OpenVPN configuration file as 'config.ovpn'"
            echo "  • Create 'credentials.txt' if your VPN requires username/password"
        fi
    fi
    echo

    # Technical Information
    echo -e "${BLUE}Technical Notes:${NC}"
    echo "  • Latest Docker images have been pulled automatically"
    echo "  • All services are configured with consistent user permissions"
    echo "  • CORS is configured to allow access from detected network interfaces"
    echo "  • Check logs if any services fail to start: docker compose logs -f"
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
