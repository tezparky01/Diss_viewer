#!/bin/bash

# Git Workflow Helper Script for Diss_viewer Repository
# This script demonstrates common commands for updating master with new commits

echo "=== Git Workflow Helper for Diss_viewer Repository ==="
echo ""

# Function to show current git status
show_status() {
    echo "Current Git Status:"
    echo "==================="
    echo "Current branch: $(git branch --show-current)"
    echo "Recent commits:"
    git log --oneline -5
    echo ""
    echo "Remote branches:"
    git branch -r
    echo ""
}

# Function to safely update master
update_master() {
    echo "Updating master branch with latest changes..."
    echo ""
    
    # Check if master exists locally
    if git branch | grep -q "master"; then
        echo "✓ Master branch exists locally"
        git checkout master
    else
        echo "ℹ Creating local master branch from remote"
        git fetch origin master:master
        git checkout master
    fi
    
    echo "Pulling latest changes from origin/master..."
    git pull origin master
    echo "✓ Master branch updated successfully"
    echo ""
}

# Function to merge feature branch to master
merge_to_master() {
    local feature_branch=$1
    
    if [ -z "$feature_branch" ]; then
        echo "❌ Error: Please provide a feature branch name"
        echo "Usage: merge_to_master <feature-branch-name>"
        return 1
    fi
    
    echo "Merging $feature_branch to master..."
    echo ""
    
    # Update master first
    update_master
    
    # Merge feature branch
    echo "Merging $feature_branch into master..."
    git merge "$feature_branch"
    
    if [ $? -eq 0 ]; then
        echo "✓ Merge successful"
        echo "Pushing updated master to remote..."
        git push origin master
        echo "✓ Master updated successfully with commits from $feature_branch"
    else
        echo "❌ Merge failed - please resolve conflicts manually"
        echo "After resolving conflicts, run:"
        echo "  git add ."
        echo "  git commit"
        echo "  git push origin master"
    fi
    echo ""
}

# Function to create and switch to feature branch
create_feature_branch() {
    local branch_name=$1
    
    if [ -z "$branch_name" ]; then
        echo "❌ Error: Please provide a branch name"
        echo "Usage: create_feature_branch <branch-name>"
        return 1
    fi
    
    echo "Creating feature branch: $branch_name"
    echo ""
    
    # Update master first
    update_master
    
    # Create and switch to feature branch
    git checkout -b "$branch_name"
    echo "✓ Created and switched to branch: $branch_name"
    echo "You can now make your changes and commit them."
    echo ""
}

# Main menu
case "$1" in
    "status")
        show_status
        ;;
    "update-master")
        update_master
        ;;
    "merge")
        merge_to_master "$2"
        ;;
    "create-branch")
        create_feature_branch "$2"
        ;;
    "help"|"")
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  status                    Show current git status and branches"
        echo "  update-master            Update master branch with latest changes"
        echo "  merge <branch-name>      Merge feature branch to master"
        echo "  create-branch <name>     Create new feature branch from master"
        echo "  help                     Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 status"
        echo "  $0 update-master"
        echo "  $0 merge feature/new-measurement-tool"
        echo "  $0 create-branch feature/quality-improvements"
        echo ""
        echo "For detailed documentation, see GIT_WORKFLOW.md"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac