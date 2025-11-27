"""Git status operations with detailed information and suggestions"""
import subprocess
from pathlib import Path
from typing import Dict, List, Optional
from config import settings


async def get_detailed_git_status() -> Dict:
    """
    Get detailed git status with file changes and actionable suggestions
    
    Returns dict with:
    - status: clean/dirty/error
    - branch: current branch name
    - modified_files: list of modified files
    - untracked_files: list of untracked files
    - staged_files: list of staged files
    - file_count: total number of changed files
    - suggestions: list of actionable suggestions
    - current_commit: current commit hash
    - latest_remote_commit: latest remote commit hash
    """
    dev_dir = Path(settings.DEV_DIR)
    
    result = {
        "status": "unknown",
        "branch": "unknown",
        "modified_files": [],
        "untracked_files": [],
        "staged_files": [],
        "deleted_files": [],
        "file_count": 0,
        "suggestions": [],
        "has_stash": False,
        "stash_count": 0,
        "ahead": 0,
        "behind": 0,
        "current_commit": None,
        "current_commit_short": None,
        "latest_remote_commit": None,
        "latest_remote_commit_short": None,
        "commit_message": None,
        "commit_date": None,
        "prod_commit": None,
        "prod_commit_short": None,
        "commits_in_sync": False,
        "clean": False
    }
    
    if not dev_dir.exists():
        result["status"] = "error"
        result["suggestions"].append({
            "type": "error",
            "message": "Development directory not found",
            "action": None
        })
        return result
    
    try:
        # Get current branch
        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        if branch_result.returncode == 0:
            result["branch"] = branch_result.stdout.strip()
        
        # Get current commit
        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        if commit_result.returncode == 0:
            result["current_commit"] = commit_result.stdout.strip()
            result["current_commit_short"] = result["current_commit"][:8]
        
        # Get commit message
        message_result = subprocess.run(
            ["git", "log", "-1", "--pretty=%s"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        if message_result.returncode == 0:
            result["commit_message"] = message_result.stdout.strip()
        
        # Get commit date
        date_result = subprocess.run(
            ["git", "log", "-1", "--pretty=%ar"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        if date_result.returncode == 0:
            result["commit_date"] = date_result.stdout.strip()
        
        # Fetch latest from remote (non-blocking)
        try:
            subprocess.run(
                ["git", "fetch", "origin"],
                cwd=str(dev_dir),
                capture_output=True,
                timeout=10
            )
            
            # Get latest remote commit
            if result["branch"]:
                remote_commit_result = subprocess.run(
                    ["git", "rev-parse", f"origin/{result['branch']}"],
                    cwd=str(dev_dir),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if remote_commit_result.returncode == 0:
                    result["latest_remote_commit"] = remote_commit_result.stdout.strip()
                    result["latest_remote_commit_short"] = result["latest_remote_commit"][:8]
        except:
            pass  # Non-critical if fetch fails
        
        # Get git status --porcelain
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if status_result.returncode != 0:
            result["status"] = "error"
            result["suggestions"].append({
                "type": "error",
                "message": "Failed to get git status",
                "action": None
            })
            return result
        
        # Parse status output
        lines = status_result.stdout.strip().split('\n')
        for line in lines:
            if not line:
                continue
            
            status_code = line[:2]
            file_path = line[3:]
            
            # Modified files (M in index or working tree)
            if 'M' in status_code:
                result["modified_files"].append(file_path)
            
            # Untracked files
            if status_code == '??':
                result["untracked_files"].append(file_path)
            
            # Staged files (first character is not space or ?)
            if status_code[0] not in [' ', '?']:
                result["staged_files"].append(file_path)
            
            # Deleted files
            if 'D' in status_code:
                result["deleted_files"].append(file_path)
        
        result["file_count"] = len(result["modified_files"]) + len(result["untracked_files"]) + len(result["staged_files"]) + len(result["deleted_files"])
        
        # Determine overall status
        if result["file_count"] == 0:
            result["status"] = "clean"
        else:
            result["status"] = "dirty"
        
        # Check for stashes
        stash_result = subprocess.run(
            ["git", "stash", "list"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        if stash_result.returncode == 0:
            stash_lines = [l for l in stash_result.stdout.strip().split('\n') if l]
            result["stash_count"] = len(stash_lines)
            result["has_stash"] = result["stash_count"] > 0
        
        # Check ahead/behind remote
        try:
            ahead_behind_result = subprocess.run(
                ["git", "rev-list", "--left-right", "--count", f"HEAD...origin/{result['branch']}"],
                cwd=str(dev_dir),
                capture_output=True,
                text=True,
                timeout=5
            )
            if ahead_behind_result.returncode == 0:
                parts = ahead_behind_result.stdout.strip().split()
                if len(parts) == 2:
                    result["ahead"] = int(parts[0])
                    result["behind"] = int(parts[1])
        except:
            pass
        
        # Get prod commit for comparison
        prod_dir = Path(settings.PROD_DIR)
        if prod_dir.exists():
            try:
                prod_commit_result = subprocess.run(
                    ["git", "rev-parse", "HEAD"],
                    cwd=str(prod_dir),
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if prod_commit_result.returncode == 0:
                    result["prod_commit"] = prod_commit_result.stdout.strip()
                    result["prod_commit_short"] = result["prod_commit"][:8]
            except:
                pass
        
        # Check if commits are in sync
        result["commits_in_sync"] = (
            result["current_commit"] == result["latest_remote_commit"] and
            result["ahead"] == 0 and
            result["behind"] == 0
        )
        
        # Set clean flag (only clean if no file changes AND in sync with remote)
        result["clean"] = result["file_count"] == 0 and result["commits_in_sync"]
        
        # Generate suggestions based on status
        if result["status"] == "dirty":
            # Modified files suggestions
            if result["modified_files"]:
                result["suggestions"].append({
                    "type": "warning",
                    "message": f"{len(result['modified_files'])} modified file(s)",
                    "action": "stash",
                    "description": "Stash changes to save them temporarily"
                })
                result["suggestions"].append({
                    "type": "info",
                    "message": "Commit changes",
                    "action": "commit",
                    "description": "Commit changes to save them permanently"
                })
            
            # Untracked files suggestions
            if result["untracked_files"]:
                result["suggestions"].append({
                    "type": "info",
                    "message": f"{len(result['untracked_files'])} untracked file(s)",
                    "action": "remove",
                    "description": "Remove untracked files (use with caution)"
                })
            
            # Staged files suggestions
            if result["staged_files"]:
                result["suggestions"].append({
                    "type": "success",
                    "message": f"{len(result['staged_files'])} staged file(s) ready to commit",
                    "action": "commit",
                    "description": "Commit staged changes"
                })
        
        # Stash suggestions
        if result["has_stash"]:
            result["suggestions"].append({
                "type": "info",
                "message": f"{result['stash_count']} stash(es) available",
                "action": "pop",
                "description": "Apply and remove the latest stash"
            })
        
        # Sync suggestions
        if result["behind"] > 0:
            result["suggestions"].append({
                "type": "warning",
                "message": f"Behind remote by {result['behind']} commit(s)",
                "action": "pull",
                "description": "Pull latest changes from remote"
            })
        
        if result["ahead"] > 0:
            result["suggestions"].append({
                "type": "info",
                "message": f"Ahead of remote by {result['ahead']} commit(s)",
                "action": "push",
                "description": "Push local commits to remote"
            })
        
    except Exception as e:
        result["status"] = "error"
        result["suggestions"].append({
            "type": "error",
            "message": f"Error getting git status: {str(e)}",
            "action": None
        })
    
    return result


async def git_stash_changes() -> Dict:
    """Stash current changes"""
    dev_dir = Path(settings.DEV_DIR)
    
    try:
        result = subprocess.run(
            ["git", "stash", "push", "-m", f"Auto-stash from build dashboard"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Changes stashed successfully",
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "message": "Failed to stash changes",
                "error": result.stderr
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error stashing changes: {str(e)}",
            "error": str(e)
        }


async def git_pop_stash() -> Dict:
    """Pop the latest stash"""
    dev_dir = Path(settings.DEV_DIR)
    
    try:
        result = subprocess.run(
            ["git", "stash", "pop"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Stash applied successfully",
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "message": "Failed to pop stash (may have conflicts)",
                "error": result.stderr
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error popping stash: {str(e)}",
            "error": str(e)
        }


async def git_clean_untracked() -> Dict:
    """Remove untracked files (with dry-run first)"""
    dev_dir = Path(settings.DEV_DIR)
    
    try:
        # First do a dry run to see what would be removed
        dry_run_result = subprocess.run(
            ["git", "clean", "-fd", "--dry-run"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if dry_run_result.returncode == 0:
            files_to_remove = dry_run_result.stdout.strip().split('\n')
            files_to_remove = [f for f in files_to_remove if f]
            
            return {
                "success": True,
                "message": f"Would remove {len(files_to_remove)} file(s)",
                "files": files_to_remove,
                "dry_run": True
            }
        else:
            return {
                "success": False,
                "message": "Failed to check untracked files",
                "error": dry_run_result.stderr
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error checking untracked files: {str(e)}",
            "error": str(e)
        }


async def git_clean_untracked_confirm() -> Dict:
    """Actually remove untracked files"""
    dev_dir = Path(settings.DEV_DIR)
    
    try:
        result = subprocess.run(
            ["git", "clean", "-fd"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "Untracked files removed successfully",
                "output": result.stdout
            }
        else:
            return {
                "success": False,
                "message": "Failed to remove untracked files",
                "error": result.stderr
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error removing untracked files: {str(e)}",
            "error": str(e)
        }
