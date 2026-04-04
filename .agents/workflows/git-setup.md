---
description: How to set up Git and push FeatherShot to GitHub for the first time
---

# First-Time Git & GitHub Setup

## 1. Fix Git Credentials (if needed)

If Git is using the wrong user or access token:

```bash
# Check current Git user
git config --global user.name
git config --global user.email
```

### Set correct identity

```bash
git config --global user.name "Kurt Steven Kainzmayer"
git config --global user.email "kurt.steven.kainzmayer@gmail.com"
```

### Fix GitHub access token

If using HTTPS and the token is wrong, clear the cached credential:

```bash
# Remove cached GitHub credentials from macOS Keychain
git credential-osxkeychain erase <<EOF
protocol=https
host=github.com
EOF
```

Next time you push, Git will prompt for the new token. Use a **Personal Access Token** (PAT) from [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

Alternatively, use SSH:

```bash
# Check if you have an SSH key
ls -la ~/.ssh/id_ed25519.pub

# If not, generate one
ssh-keygen -t ed25519 -C "kurt.steven.kainzmayer@gmail.com"

# Add the public key to GitHub → Settings → SSH Keys
cat ~/.ssh/id_ed25519.pub
```

## 2. Initialize the Repository

```bash
cd /path/to/FeatherShot
git init
git add -A
git commit -m "Initial commit — FeatherShot v1.0.1"
```

## 3. Create the GitHub Repository

You can create it via [github.com/new](https://github.com/new) or via the CLI:

```bash
# Using GitHub CLI (if installed)
gh repo create FeatherShot --public --source=. --remote=origin --push
```

Or manually:

```bash
git remote add origin https://github.com/KurtStevenK/FeatherShot.git
git branch -M main
git push -u origin main
```

## 4. Tag the Release

```bash
git tag v1.0.1
git push origin v1.0.1
```

## 5. Create a GitHub Release

1. Go to your repo → **Releases** → **Create a new release**
2. Select tag `v1.0.1`
3. Title: **FeatherShot v1.0.1**
4. Description: Copy from `CHANGELOG.md`
5. Attach: `FeatherShot 1.0.1.dmg`
6. **Publish release** 🎉
