#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
INTEGRATE_BRANCH="integrate-jules-prs-1-26"

resolve_conflicts() {
  local prefer=${1:-theirs}
  # Drop pnpm lockfiles per plan
  if [[ -f electron-app/pnpm-lock.yaml ]]; then
    git rm -f electron-app/pnpm-lock.yaml 2>/dev/null || rm -f electron-app/pnpm-lock.yaml
    git add -A electron-app/pnpm-lock.yaml 2>/dev/null || true
  fi

  local unmerged
  unmerged=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
  [[ -z "$unmerged" ]] && return 0

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    case "$f" in
      electron-app/pnpm-lock.yaml)
        git rm -f "$f" 2>/dev/null || rm -f "$f"
        git add -u "$f" 2>/dev/null || true
        continue
        ;;
      .jules/*|.Jules/*)
        git checkout --"$prefer" -- "$f" 2>/dev/null || true
        if grep -q '<<<<<<<' "$f" 2>/dev/null; then
          sed '/^<<<<<<< /,/^>>>>>>> /d' "$f" >"/tmp/jules-fixed-$$" || true
          [[ -s "/tmp/jules-fixed-$$" ]] && mv "/tmp/jules-fixed-$$" "$f"
        fi
        ;;
      *)
        git checkout --"$prefer" -- "$f" 2>/dev/null || true
        ;;
    esac
    git add "$f" 2>/dev/null || true
  done <<< "$unmerged"

  if git diff --name-only --diff-filter=U | grep -q .; then
    echo "Unresolved conflicts remain:"
    git diff --name-only --diff-filter=U
    return 1
  fi
  return 0
}

integrate_pr() {
  local n=$1
  local branch title
  branch=$(gh pr view "$n" --json headRefName -q .headRefName)
  title=$(gh pr view "$n" --json title -q .title)
  echo "=== PR #$n: $title ==="

  gh pr checkout "$n"
  if ! git merge "$INTEGRATE_BRANCH" -m "Merge $INTEGRATE_BRANCH into PR $n"; then
    resolve_conflicts ours || return 1
    git commit --no-edit || git commit -m "Merge $INTEGRATE_BRANCH into PR $n (resolved conflicts)"
  fi
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "chore: normalize merge artifacts for PR $n" || true
  fi

  git checkout "$INTEGRATE_BRANCH"
  if ! git merge --no-ff "$branch" -m "Merge PR #$n: $title"; then
    resolve_conflicts theirs || return 1
    git commit --no-edit || git commit -m "Merge PR #$n: $title (resolved conflicts)"
  fi

  # Ensure no pnpm lock on integration branch
  if [[ -f electron-app/pnpm-lock.yaml ]]; then
    git rm -f electron-app/pnpm-lock.yaml
    git commit -m "Remove pnpm-lock.yaml (npm is canonical)" || true
  fi

  echo "OK PR $n"
}

integrate_pr "$1"
