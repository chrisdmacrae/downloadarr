#!/usr/bin/env bash
# Prints the release notes for a tag: the install, upgrade and rollback
# instructions from .github/release-notes.md, then GitHub's generated list of
# changes since the previous tag.
#
#   .github/scripts/release-notes.sh v1.2.3
#
# Needs the full history (for the previous tag) and, for the list of changes,
# `gh` with a token. Without one the instructions are still printed.
set -euo pipefail

TAG="${1:?usage: release-notes.sh <tag>}"
VERSION="${TAG#v}"
REPOSITORY="${GITHUB_REPOSITORY:-chrisdmacrae/downloadarr}"
IMAGE="ghcr.io/${REPOSITORY}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Files an install keeps its own copy of. An upgrade that only pulls the image
# would miss a change to them.
INSTALL_FILES=(docker-compose.yml docker-compose.vpn.yml .env.example)

PREVIOUS_TAG="$(git -C "$ROOT" describe --tags --abbrev=0 --match 'v*' "${TAG}^" 2>/dev/null || true)"

compose_changes=""
previous_version_hint=""
if [[ -n "$PREVIOUS_TAG" ]]; then
  previous_version_hint=" (the release before this one is \`${PREVIOUS_TAG#v}\`)"

  changed=()
  for file in "${INSTALL_FILES[@]}"; do
    if ! git -C "$ROOT" diff --quiet "$PREVIOUS_TAG" "$TAG" -- "$file"; then
      changed+=("$file")
    fi
  done

  if (( ${#changed[@]} > 0 )); then
    compose_changes="> [!IMPORTANT]"$'\n'
    compose_changes+="> This release changes files your install has its own copy of. Update them before pulling:"$'\n'
    for file in "${changed[@]}"; do
      compose_changes+="> - [\`${file}\`](https://github.com/${REPOSITORY}/blob/${TAG}/${file}) ([what changed](https://github.com/${REPOSITORY}/compare/${PREVIOUS_TAG}...${TAG}#files_bucket))"$'\n'
    done
    compose_changes+=">"$'\n'
    compose_changes+="> Download the new compose files over yours, and copy any new settings from \`.env.example\` into your \`.env\` (do not replace \`.env\`: it holds your passwords and paths)."$'\n\n'
  fi
fi

notes="$(cat "$ROOT/.github/release-notes.md")"
notes="${notes//'{{COMPOSE_CHANGES}}'/$compose_changes}"
notes="${notes//'{{PREVIOUS_VERSION_HINT}}'/$previous_version_hint}"
notes="${notes//'{{REPOSITORY}}'/$REPOSITORY}"
notes="${notes//'{{IMAGE}}'/$IMAGE}"
notes="${notes//'{{VERSION}}'/$VERSION}"
notes="${notes//'{{TAG}}'/$TAG}"
printf '%s\n' "$notes"

if command -v gh > /dev/null && gh auth status > /dev/null 2>&1; then
  args=(-f tag_name="$TAG")
  [[ -n "$PREVIOUS_TAG" ]] && args+=(-f previous_tag_name="$PREVIOUS_TAG")
  printf '\n'
  gh api "repos/${REPOSITORY}/releases/generate-notes" "${args[@]}" --jq .body
fi
