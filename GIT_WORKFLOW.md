# Git Workflow Guide: Updating Master with New Commits

This guide explains how to update the master branch with new commits in the Diss_viewer repository.

## Table of Contents

1. [Understanding the Repository Structure](#understanding-the-repository-structure)
2. [Method 1: Pull Request Workflow (Recommended)](#method-1-pull-request-workflow-recommended)
3. [Method 2: Direct Merge](#method-2-direct-merge)
4. [Method 3: Rebase and Merge](#method-3-rebase-and-merge)
5. [Method 4: Updating Local Master from Remote](#method-4-updating-local-master-from-remote)
6. [Common Scenarios](#common-scenarios)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Understanding the Repository Structure

Before updating master, it's important to understand your current repository state:

```bash
# Check current branch
git branch

# Check all branches (local and remote)
git branch -a

# Check remote repositories
git remote -v

# View commit history
git log --oneline --graph --all
```

## Method 1: Pull Request Workflow (Recommended)

This is the safest and most collaborative approach for team projects.

### Step 1: Create a Feature Branch

```bash
# Make sure you're on master
git checkout master

# Pull latest changes
git pull origin master

# Create and switch to a new feature branch
git checkout -b feature/your-feature-name
```

### Step 2: Make Your Changes and Commit

```bash
# Make your changes to files
# ...

# Stage and commit changes
git add .
git commit -m "Add your descriptive commit message"

# Push feature branch to remote
git push origin feature/your-feature-name
```

### Step 3: Create Pull Request

1. Go to GitHub repository page
2. Click "Compare & pull request" button
3. Fill in pull request details
4. Submit pull request

### Step 4: Merge Pull Request

Once approved, merge the pull request on GitHub:
- Choose merge strategy (merge commit, squash and merge, or rebase and merge)
- Complete the merge

### Step 5: Update Local Master

```bash
# Switch to master
git checkout master

# Pull the updated master with your changes
git pull origin master

# Clean up feature branch (optional)
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## Method 2: Direct Merge

⚠️ **Use with caution** - Only for small teams or personal repositories.

### From Feature Branch to Master

```bash
# Make sure your feature branch is up to date
git checkout feature/your-feature-name
git push origin feature/your-feature-name

# Switch to master
git checkout master

# Pull latest changes
git pull origin master

# Merge feature branch
git merge feature/your-feature-name

# Push updated master
git push origin master
```

## Method 3: Rebase and Merge

This creates a cleaner commit history by avoiding merge commits.

```bash
# Switch to your feature branch
git checkout feature/your-feature-name

# Rebase onto latest master
git rebase master

# Switch to master
git checkout master

# Fast-forward merge
git merge feature/your-feature-name

# Push updated master
git push origin master
```

## Method 4: Updating Local Master from Remote

If others have updated master and you need to sync your local copy:

```bash
# Switch to master
git checkout master

# Fetch latest changes
git fetch origin

# Update master with remote changes
git pull origin master

# Alternative: reset to match remote exactly
git reset --hard origin/master
```

## Common Scenarios

### Scenario 1: You Have Commits on Master That Need to Go to Remote

```bash
# Check status
git status

# Push to remote master
git push origin master
```

### Scenario 2: Remote Master Has New Commits You Need Locally

```bash
# Switch to master
git checkout master

# Pull remote changes
git pull origin master
```

### Scenario 3: Merge Conflicts During Update

```bash
# If merge conflicts occur during pull
git pull origin master

# Edit conflicted files to resolve conflicts
# Look for conflict markers: <<<<<<<, =======, >>>>>>>

# After resolving conflicts
git add .
git commit -m "Resolve merge conflicts"
git push origin master
```

### Scenario 4: Multiple Feature Branches to Master

```bash
# For each feature branch:
git checkout feature/branch-1
git rebase master  # or merge master into feature branch first

git checkout master
git merge feature/branch-1
git push origin master

# Repeat for other branches
```

## Troubleshooting

### Problem: "Your branch is behind origin/master"

**Solution:**
```bash
git pull origin master
```

### Problem: "Your branch and origin/master have diverged"

**Solution:**
```bash
# Option 1: Merge (creates merge commit)
git pull origin master

# Option 2: Rebase (cleaner history)
git rebase origin/master
```

### Problem: "Failed to push some refs"

**Solution:**
```bash
# Pull first, then push
git pull origin master
git push origin master
```

### Problem: Accidentally Committed to Master Instead of Feature Branch

**Solution:**
```bash
# Create new branch from current position
git branch feature/accidental-commits

# Reset master to previous state
git reset --hard HEAD~n  # where n is number of commits to undo

# Switch to feature branch to continue work
git checkout feature/accidental-commits
```

### Problem: Need to Undo Last Commit on Master

**Solution:**
```bash
# Undo last commit but keep changes
git reset --soft HEAD~1

# Undo last commit and discard changes
git reset --hard HEAD~1

# If already pushed, you'll need force push (dangerous)
git push --force origin master  # Use with extreme caution
```

## Best Practices

### 1. Always Pull Before Pushing

```bash
git pull origin master
git push origin master
```

### 2. Use Descriptive Commit Messages

```bash
# Good
git commit -m "Add measurement tools functionality to BIM viewer"

# Bad
git commit -m "fixes"
```

### 3. Keep Master Stable

- Always test your code before merging to master
- Use feature branches for development
- Never force push to master in shared repositories
- Check for existing TypeScript/build errors before merging: `npm run build`
- Test the application locally: `npm run dev`

### 4. Regular Syncing

```bash
# Daily workflow
git checkout master
git pull origin master
git checkout your-feature-branch
git rebase master  # or merge master
```

### 5. Branch Naming Conventions

```bash
# Use descriptive names
feature/add-measurement-tools
bugfix/fix-model-loading
hotfix/security-update
```

### 6. Protect Master Branch

On GitHub, consider:
- Enabling branch protection rules
- Requiring pull request reviews
- Requiring status checks to pass

## Quick Reference Commands

### Using the Helper Script

For convenience, this repository includes a helper script that automates common Git workflow tasks:

```bash
# Show current status and branches
./git-workflow-helper.sh status

# Update master with latest changes
./git-workflow-helper.sh update-master

# Create new feature branch from master
./git-workflow-helper.sh create-branch feature/new-feature

# Merge feature branch to master
./git-workflow-helper.sh merge feature/new-feature
```

### Manual Commands

```bash
# Basic workflow
git checkout master
git pull origin master
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
# ... create pull request on GitHub ...
# ... after merge ...
git checkout master
git pull origin master

# Emergency fixes
git checkout master
git pull origin master
git checkout -b hotfix/urgent-fix
# ... make fix ...
git add .
git commit -m "Fix critical issue"
git push origin hotfix/urgent-fix
# ... create and merge pull request immediately ...
```

## Repository-Specific Notes

For the Diss_viewer repository:

- Master branch contains the stable BIM viewer application
- Feature branches should be used for new components or major changes
- Always test the application after merging (`npm run dev`)
- Consider the impact on the TypeScript build (`npm run build`)
- Update documentation if adding new features

### Current Repository Example

Based on the current state of this repository, here's how you would update master:

```bash
# Check current branches
git branch -a
# Shows: copilot/fix-a4512b25-b480-4488-885f-c6c6cb1a17b5 (current)
#        remotes/origin/copilot/fix-a4512b25-b480-4488-885f-c6c6cb1a17b5

# To get master branch locally
git fetch origin master:master

# Switch to master
git checkout master

# Pull latest changes
git pull origin master

# Now you can create feature branches from master
git checkout -b feature/your-new-feature

# Or merge your current branch to master (after testing)
git checkout master
git merge copilot/fix-a4512b25-b480-4488-885f-c6c6cb1a17b5
git push origin master
```

---

Remember: When in doubt, create a backup branch before making major changes:

```bash
git branch backup-$(date +%Y%m%d_%H%M%S)
```