#!/usr/bin/env bash
set -euo pipefail

# ─── ConstChat Deploy Script ─────────────────────────────────────────────────
# Usage:
#   ./scripts/deploy.sh                  # Full deploy (all services)
#   ./scripts/deploy.sh web              # Deploy only web
#   ./scripts/deploy.sh api gateway      # Deploy specific services
#   ./scripts/deploy.sh --rollback       # Rollback to previous commit
#   ./scripts/deploy.sh --status         # Show service status
#   ./scripts/deploy.sh --logs web       # Tail logs for a service

# ─── Config ──────────────────────────────────────────────────────────────────
REPO_DIR="/opt/ConstChat"
COMPOSE_FILE="infra/docker/docker-compose.deploy.yml"
ENV_FILE=".env.production"
BRANCH="master"
REMOTE="origin"
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5
LOG_FILE="/var/log/constchat-deploy.log"
ENABLE_VOICE=0

# All deployable services
ALL_SERVICES=(api gateway web)

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────────────────────
log()   { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $*" | tee -a "$LOG_FILE"; }
err()   { echo -e "${RED}  ✗${NC} $*" | tee -a "$LOG_FILE"; }
info()  { echo -e "${CYAN}  ℹ${NC} $*" | tee -a "$LOG_FILE"; }

header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

dc() {
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

voice_env_ready() {
    local required=("LIVEKIT_URL" "LIVEKIT_WS_URL" "LIVEKIT_API_KEY" "LIVEKIT_API_SECRET")
    local missing=0
    for key in "${required[@]}"; do
        if ! grep -q "^${key}=.\+" "$ENV_FILE"; then
            err "Missing voice env: ${key}"
            missing=$((missing + 1))
        fi
    done
    [ $missing -eq 0 ]
}

publish_latest_installer() {
    local downloads_dir="$REPO_DIR/infra/docker/downloads"
    local latest_versioned=""

    if [ ! -d "$downloads_dir" ]; then
        warn "Installer downloads directory missing: $downloads_dir"
        return 0
    fi

    latest_versioned=$(ls -1 "$downloads_dir"/Swiip-Setup-*.exe 2>/dev/null | grep -v 'Swiip-Setup-latest\.exe$' | sort -V | tail -n 1 || true)
    if [ -z "$latest_versioned" ]; then
        warn "No versioned installer found; skipping latest installer publish"
        return 0
    fi

    cp -f "$latest_versioned" "$downloads_dir/Swiip-Setup-latest.exe"
    sha256sum "$downloads_dir/Swiip-Setup-latest.exe" | awk '{print $1}' > "$downloads_dir/Swiip-Setup-latest.exe.sha256"
    ok "Installer latest alias updated from $(basename "$latest_versioned")"
}

# ─── Pre-flight checks ──────────────────────────────────────────────────────
preflight() {
    log "Running pre-flight checks..."

    if [ ! -d "$REPO_DIR" ]; then
        err "Repo directory $REPO_DIR not found"; exit 1
    fi

    cd "$REPO_DIR"

    if [ ! -f "$ENV_FILE" ]; then
        err "$ENV_FILE not found"; exit 1
    fi

    if ! command -v docker &>/dev/null; then
        err "docker not found"; exit 1
    fi

    if ! docker info &>/dev/null; then
        err "Docker daemon not running"; exit 1
    fi

    ok "Pre-flight checks passed"
}

# ─── Show status ─────────────────────────────────────────────────────────────
show_status() {
    header "Service Status"
    cd "$REPO_DIR"
    dc ps -a
    echo ""
    log "Disk usage:"
    docker system df 2>/dev/null || true
}

# ─── Show logs ───────────────────────────────────────────────────────────────
show_logs() {
    local service="${1:-}"
    cd "$REPO_DIR"
    if [ -n "$service" ]; then
        dc logs --tail 100 -f "$service"
    else
        dc logs --tail 50 -f
    fi
}

# ─── Health check ────────────────────────────────────────────────────────────
health_check() {
    local service="$1"
    local url=""
    local container=""

    case "$service" in
        api)     container="swiip-api";     url="http://localhost:4000/health" ;;
        gateway) container="swiip-gateway"; url="http://localhost:4001/health" ;;
        media-signalling) container="swiip-media-signalling"; url="http://localhost:4002/docs" ;;
        livekit) container="swiip-livekit"; url="http://localhost:7880" ;;
        web)     container="swiip-web";     url="http://localhost:3000" ;;
        *)       warn "No health check defined for $service"; return 0 ;;
    esac

    log "Waiting for $service to become healthy..."
    local elapsed=0

    while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
        if docker exec "$container" sh -c "wget -q --spider $url 2>/dev/null || curl -sf $url >/dev/null 2>&1" 2>/dev/null; then
            ok "$service is healthy (${elapsed}s)"
            return 0
        fi

        local state
        state=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
        if [ "$state" = "exited" ] || [ "$state" = "dead" ]; then
            err "$service container $state — check logs: docker logs $container"
            return 1
        fi

        sleep "$HEALTH_INTERVAL"
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done

    err "$service failed health check after ${HEALTH_TIMEOUT}s"
    return 1
}

post_deploy_smoke() {
    log "Running external smoke checks..."
    local checks=(
      "https://swiip.app/login"
      "https://swiip.app/terms"
      "https://swiip.app/privacy"
      "https://swiip.app/forgot-password"
      "https://swiip.app/api/health"
      "https://swiip.app/downloads/Swiip-Setup-latest.exe"
    )

    local failed=0
    for url in "${checks[@]}"; do
      local code
      code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
      if [ "$code" = "200" ]; then
        ok "Smoke check passed: $url"
      else
        err "Smoke check failed: $url (HTTP $code)"
        failed=$((failed + 1))
      fi
    done

    local latest_hash_file="$REPO_DIR/infra/docker/downloads/Swiip-Setup-latest.exe.sha256"
    if [ -f "$latest_hash_file" ]; then
      local expected_sha
      local actual_sha
      expected_sha=$(cat "$latest_hash_file")
      actual_sha=$(curl -fsSL "https://swiip.app/downloads/Swiip-Setup-latest.exe" | sha256sum | awk '{print $1}' || echo "")

      if [ -n "$actual_sha" ] && [ "$actual_sha" = "$expected_sha" ]; then
        ok "Installer hash check passed for Swiip-Setup-latest.exe"
      else
        err "Installer hash mismatch (expected $expected_sha got ${actual_sha:-unavailable})"
        failed=$((failed + 1))
      fi
    else
      warn "Installer hash file missing, skipping installer hash smoke check"
    fi

    return "$failed"
}

# ─── Rollback ────────────────────────────────────────────────────────────────
rollback() {
    header "Rolling Back"
    cd "$REPO_DIR"

    local prev_commit
    prev_commit=$(git rev-parse HEAD~1 2>/dev/null)

    if [ -z "$prev_commit" ]; then
        err "Cannot determine previous commit"; exit 1
    fi

    warn "Rolling back to ${prev_commit:0:8}..."
    git checkout "$prev_commit" -- .

    log "Rebuilding all services..."
    dc up -d --build "${ALL_SERVICES[@]}"

    local failed=0
    for svc in "${ALL_SERVICES[@]}"; do
        health_check "$svc" || failed=$((failed + 1))
    done

    if [ $failed -gt 0 ]; then
        err "Rollback completed with $failed unhealthy service(s)"
        exit 1
    fi

    ok "Rollback to ${prev_commit:0:8} complete"
    git checkout "$BRANCH" -- . 2>/dev/null || true
}

# ─── Deploy ──────────────────────────────────────────────────────────────────
deploy() {
    local services=("$@")
    local start_time
    start_time=$(date +%s)

    if [ ${#services[@]} -eq 0 ]; then
        services=("${ALL_SERVICES[@]}")
    fi

    header "ConstChat Deploy"
    info "Services: ${services[*]}"
    info "Branch:   $BRANCH"
    echo ""

    preflight

    if [ "$ENABLE_VOICE" -eq 1 ]; then
        log "Voice mode enabled: validating voice environment..."
        if ! voice_env_ready; then
            err "Voice env is incomplete. Fix $ENV_FILE and retry with --voice."
            exit 1
        fi
    fi

    # Save current commit for rollback reference
    local prev_commit
    prev_commit=$(git rev-parse HEAD 2>/dev/null || echo "none")
    info "Current commit: ${prev_commit:0:8}"

    # Pull latest
    log "Pulling latest from $REMOTE/$BRANCH..."
    git fetch "$REMOTE" "$BRANCH"
    git reset --hard "$REMOTE/$BRANCH"
    local new_commit
    new_commit=$(git rev-parse HEAD)
    ok "Updated to ${new_commit:0:8}"

    if [ "$prev_commit" = "$new_commit" ]; then
        warn "No new commits — rebuilding anyway"
    else
        log "Changes:"
        git log --oneline "${prev_commit}..${new_commit}" 2>/dev/null | head -10 | while read -r line; do
            info "$line"
        done
    fi

    # Build & restart
    log "Building and deploying: ${services[*]}..."
    if [ "$ENABLE_VOICE" -eq 1 ]; then
        dc --profile voice up -d --build "${services[@]}" media-signalling livekit
        services+=("media-signalling" "livekit")
    else
        dc up -d --build "${services[@]}"
    fi

    publish_latest_installer

    # Health checks
    echo ""
    log "Running health checks..."
    local failed=0
    for svc in "${services[@]}"; do
        health_check "$svc" || failed=$((failed + 1))
    done

    # Cleanup old images
    log "Cleaning up dangling images..."
    docker image prune -f --filter "until=24h" >/dev/null 2>&1 || true
    ok "Cleanup done"

    # Summary
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    if [ $failed -gt 0 ]; then
        header "Deploy Complete (with issues)"
        err "$failed service(s) failed health check"
        warn "Run: ./scripts/deploy.sh --rollback"
        exit 1
    else
        if ! post_deploy_smoke; then
            header "Deploy Complete (smoke check issues)"
            warn "Services are healthy but smoke checks failed"
            warn "Run: ./scripts/deploy.sh --logs web"
            exit 1
        fi
        header "Deploy Successful"
        ok "All ${#services[@]} service(s) healthy"
        ok "Commit: ${new_commit:0:8}"
        ok "Duration: ${duration}s"
    fi

    echo ""
    dc ps
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    mkdir -p "$(dirname "$LOG_FILE")"

    case "${1:-}" in
        --rollback|-r)
            rollback
            ;;
        --status|-s)
            show_status
            ;;
        --logs|-l)
            shift
            show_logs "${1:-}"
            ;;
        --help|-h)
            echo "Usage: deploy.sh [OPTIONS] [SERVICES...]"
            echo ""
            echo "Options:"
            echo "  (no args)          Deploy all services"
            echo "  web api gateway    Deploy specific service(s)"
            echo "  --voice            Enable voice profile deploy checks"
            echo "  --rollback, -r     Rollback to previous commit"
            echo "  --status, -s       Show service status"
            echo "  --logs, -l [svc]   Tail logs (optionally for a service)"
            echo "  --help, -h         Show this help"
            ;;
        --voice)
            ENABLE_VOICE=1
            shift
            deploy "$@"
            ;;
        --*)
            err "Unknown option: $1"
            exit 1
            ;;
        *)
            deploy "$@"
            ;;
    esac
}

main "$@"
