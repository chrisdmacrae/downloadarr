#!/bin/bash

# Downloadarr Upgrade Script
# Upgrades an existing install in place: backs up the database, pulls the new
# images and restarts the stack, using the same compose files the stack is
# already running with.
#
# An install with VPN runs two compose files (docker-compose.yml plus the
# docker-compose.vpn.yml overlay). Upgrading it with the base file alone would
# bring aria2 back up OUTSIDE the VPN, so this script works out which set is in
# use before it touches anything.
#
#   ./upgrade.sh                 upgrade to the version .env asks for (latest by default)
#   ./upgrade.sh 0.18.0          pin APP_VERSION to that release and upgrade to it
#   ./upgrade.sh --compose       also refresh the compose files from GitHub first
#   ./upgrade.sh --vpn|--no-vpn  skip detection and say which it is
#   ./upgrade.sh --no-backup     skip the database backup
#
# Run it from the folder that holds docker-compose.yml.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

GITHUB_REPO="chrisdmacrae/downloadarr"
BASE_FILE="docker-compose.yml"
VPN_FILE="docker-compose.vpn.yml"
# Containers that only exist when the VPN overlay is in use
VPN_CONTAINERS=("downloadarr-vpn" "downloadarr-aria2-vpn" "downloadarr-app-vpn")

print_status() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1" >&2; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

usage() {
    cat <<'USAGE'
Usage: ./upgrade.sh [version] [options]

  version       pin APP_VERSION in .env to this release (e.g. 0.18.0) and upgrade to it;
                without one, upgrade to whatever .env asks for (latest by default)
  --compose     refresh docker-compose.yml and docker-compose.vpn.yml from GitHub first
  --vpn         use the VPN overlay, without detecting
  --no-vpn      do not use the VPN overlay, without detecting
  --no-backup   skip the database backup
  -h, --help    show this help

Run it from the folder that holds docker-compose.yml.
USAGE
}

VERSION=""
VPN_MODE="auto"
BACKUP="true"
REFRESH_COMPOSE="false"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --vpn) VPN_MODE="true" ;;
        --no-vpn) VPN_MODE="false" ;;
        --no-backup) BACKUP="false" ;;
        --compose) REFRESH_COMPOSE="true" ;;
        -h|--help) usage; exit 0 ;;
        -*) print_error "Unknown option: $1"; usage; exit 1 ;;
        *) VERSION="${1#v}" ;;
    esac
    shift
done

env_value() {
    # The last assignment wins, as it does for docker compose
    grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"'"'"' \r' || true
}

update_env_var() {
    local key="$1" value="$2"
    if grep -q "^${key}=" .env 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" .env
        else
            sed -i "s|^${key}=.*|${key}=${value}|" .env
        fi
    else
        echo "${key}=${value}" >> .env
    fi
}

check_install() {
    if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
        print_error "Docker with the compose plugin is required."
        exit 1
    fi

    if [[ ! -f "$BASE_FILE" ]]; then
        print_error "No $BASE_FILE here. Run this from your Downloadarr install folder."
        exit 1
    fi
}

# Decides whether this install runs with the VPN overlay. What is running
# counts for most: it is the stack this upgrade must not change the shape of.
# When the signs disagree the answer is VPN, since the wrong guess the other
# way would put download traffic outside the tunnel.
detect_vpn() {
    if [[ "$VPN_MODE" != "auto" ]]; then
        VPN_REASON="you said so"
        return
    fi

    local containers running_vpn="" container
    containers="$(docker ps -a --format '{{.Names}}')"
    for container in "${VPN_CONTAINERS[@]}"; do
        if grep -qx "$container" <<< "$containers"; then
            running_vpn="$container"
            break
        fi
    done

    local env_vpn
    env_vpn="$(env_value VPN_ENABLED | tr '[:upper:]' '[:lower:]')"

    if [[ -n "$running_vpn" ]]; then
        VPN_MODE="true"
        VPN_REASON="the $running_vpn container exists"
        if [[ "$env_vpn" != "true" ]]; then
            print_warning "VPN_ENABLED is not true in .env, but the stack runs with the VPN overlay. Keeping the VPN."
        fi
    elif [[ "$env_vpn" == "true" ]]; then
        VPN_MODE="true"
        VPN_REASON="VPN_ENABLED=true in .env"
        if grep -qx "downloadarr-aria2" <<< "$containers"; then
            print_warning "VPN_ENABLED=true, but the stack is running WITHOUT the VPN overlay. This upgrade will start it with the VPN."
        fi
    else
        VPN_MODE="false"
        VPN_REASON="no VPN containers, and VPN_ENABLED is not true in .env"
    fi
}

check_vpn_files() {
    [[ "$VPN_MODE" == "true" ]] || return 0

    if [[ ! -f "$VPN_FILE" ]]; then
        print_error "This install uses the VPN, but $VPN_FILE is missing. Re-run with --compose to download it."
        exit 1
    fi
    # Docker creates a missing bind-mount source as an empty folder, and the
    # VPN container then fails in a way that is hard to read
    if [[ ! -f "config.ovpn" ]]; then
        print_error "This install uses the VPN, but config.ovpn is missing from this folder."
        exit 1
    fi
    if [[ ! -e "credentials.txt" ]]; then
        print_warning "credentials.txt is missing. Creating an empty one so the VPN container can start; add your login if your provider needs it."
        touch credentials.txt
    fi
}

refresh_compose_files() {
    [[ "$REFRESH_COMPOSE" == "true" ]] || return 0

    local ref="refs/heads/main"
    [[ -n "$VERSION" ]] && ref="v${VERSION}"
    local url="https://raw.githubusercontent.com/${GITHUB_REPO}/${ref}"
    local stamp file
    stamp="$(date +%Y%m%d-%H%M%S)"

    print_info "Refreshing compose files from ${ref}..."
    mkdir -p backups
    for file in "$BASE_FILE" "$VPN_FILE"; do
        if curl -fsSL "${url}/${file}" -o "${file}.new"; then
            [[ -f "$file" ]] && cp "$file" "backups/${file}.${stamp}"
            mv "${file}.new" "$file"
        else
            rm -f "${file}.new"
            print_error "Failed to download ${file} from ${ref}"
            exit 1
        fi
    done
    print_status "Compose files refreshed (previous copies in backups/). Your .env is untouched."
}

backup_database() {
    if [[ "$BACKUP" != "true" ]]; then
        print_warning "Skipping the database backup"
        return 0
    fi

    print_info "Backing up the database..."
    if [[ -z "$("${COMPOSE[@]}" ps --status running -q postgres 2>/dev/null)" ]]; then
        "${COMPOSE[@]}" up -d postgres > /dev/null 2>&1
    fi

    local attempt
    for attempt in $(seq 1 30); do
        "${COMPOSE[@]}" exec -T postgres pg_isready -U downloadarr > /dev/null 2>&1 && break
        if [[ "$attempt" == "30" ]]; then
            print_error "The database did not come up, so it could not be backed up. Fix that, or re-run with --no-backup."
            exit 1
        fi
        sleep 1
    done

    mkdir -p backups
    BACKUP_FILE="backups/downloadarr-$(date +%Y%m%d-%H%M%S).sql"
    if ! "${COMPOSE[@]}" exec -T postgres pg_dump -U downloadarr downloadarr > "$BACKUP_FILE" || [[ ! -s "$BACKUP_FILE" ]]; then
        rm -f "$BACKUP_FILE"
        print_error "The database backup failed. Nothing has been upgraded. Re-run with --no-backup to go ahead without one."
        exit 1
    fi
    print_status "Database backed up to $BACKUP_FILE"
}

upgrade() {
    print_info "Pulling images..."
    "${COMPOSE[@]}" pull
    print_status "Images pulled"

    print_info "Restarting services..."
    "${COMPOSE[@]}" up -d --remove-orphans
    print_status "Services started"
}

wait_until_healthy() {
    print_info "Waiting for Downloadarr to come up..."

    local container health="" attempt
    for attempt in $(seq 1 60); do
        container="$("${COMPOSE[@]}" ps -q downloadarr 2>/dev/null | head -n 1)"
        if [[ -n "$container" ]]; then
            health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
            if [[ "$health" == "healthy" || "$health" == "running" ]]; then
                print_status "Downloadarr is up ($(docker inspect -f '{{.Config.Image}}' "$container"))"
                return 0
            fi
            if [[ "$health" == "exited" || "$health" == "dead" ]]; then
                break
            fi
        fi
        sleep 3
    done

    print_error "Downloadarr did not come up healthy (state: ${health:-unknown}). Its last log lines:"
    "${COMPOSE[@]}" logs --tail 40 downloadarr || true
    return 1
}

show_rollback() {
    echo
    echo "To go back:"
    echo "  1. Set APP_VERSION in .env to the version you were on${PREVIOUS_VERSION:+ (it was '${PREVIOUS_VERSION}')}"
    echo "  2. ${COMPOSE[*]} up -d"
    if [[ -n "${BACKUP_FILE:-}" ]]; then
        echo "  The database as it was before this upgrade is in ${BACKUP_FILE}"
    fi
}

main() {
    echo -e "${BLUE}⬆️  Downloadarr Upgrade${NC}"
    echo "======================"

    check_install
    detect_vpn
    refresh_compose_files
    check_vpn_files

    COMPOSE=(docker compose -f "$BASE_FILE")
    if [[ "$VPN_MODE" == "true" ]]; then
        COMPOSE+=(-f "$VPN_FILE")
        print_status "VPN: on (${VPN_REASON}). Using $BASE_FILE + $VPN_FILE"
    else
        print_status "VPN: off (${VPN_REASON}). Using $BASE_FILE"
    fi

    PREVIOUS_VERSION="$(env_value APP_VERSION)"
    BACKUP_FILE=""
    backup_database

    if [[ -n "$VERSION" ]]; then
        update_env_var "APP_VERSION" "$VERSION"
        print_status "APP_VERSION set to $VERSION in .env"
    else
        print_info "Upgrading to APP_VERSION=${PREVIOUS_VERSION:-latest}"
    fi

    upgrade

    if wait_until_healthy; then
        echo
        echo -e "${GREEN}🎉 Upgrade complete${NC}"
        show_rollback
    else
        show_rollback
        exit 1
    fi
}

main
