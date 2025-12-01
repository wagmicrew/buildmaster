"""Git commit tracking for test and dev environments"""
import subprocess
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from config import settings


async def get_git_commit_info(directory: str) -> Dict:
    """
    Get detailed git commit information for a directory
    
    Returns:
    - current_commit: Current commit hash
    - current_commit_short: Short commit hash
    - branch: Current branch
    - commit_message: Latest commit message
    - commit_author: Commit author
    - commit_date: Commit date
    - is_clean: Working directory clean
    - remote_url: Remote repository URL
    """
    dir_path = Path(directory)
    
    if not dir_path.exists():
        return {
            "error": "Directory not found",
            "directory": directory
        }
    
    result = {
        "directory": directory,
        "current_commit": None,
        "current_commit_short": None,
        "branch": None,
        "commit_message": None,
        "commit_author": None,
        "commit_date": None,
        "is_clean": False,
        "remote_url": None,
        "error": None
    }
    
    try:
        # Get current commit hash
        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if commit_result.returncode == 0:
            result["current_commit"] = commit_result.stdout.strip()
            result["current_commit_short"] = result["current_commit"][:8]
        
        # Get current branch
        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if branch_result.returncode == 0:
            result["branch"] = branch_result.stdout.strip()
        
        # Get commit message
        message_result = subprocess.run(
            ["git", "log", "-1", "--pretty=%B"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if message_result.returncode == 0:
            result["commit_message"] = message_result.stdout.strip()
        
        # Get commit author
        author_result = subprocess.run(
            ["git", "log", "-1", "--pretty=%an"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if author_result.returncode == 0:
            result["commit_author"] = author_result.stdout.strip()
        
        # Get commit date
        date_result = subprocess.run(
            ["git", "log", "-1", "--pretty=%ai"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if date_result.returncode == 0:
            result["commit_date"] = date_result.stdout.strip()
        
        # Check if working directory is clean
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if status_result.returncode == 0:
            result["is_clean"] = not bool(status_result.stdout.strip())
        
        # Get remote URL
        remote_result = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        if remote_result.returncode == 0:
            result["remote_url"] = remote_result.stdout.strip()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def compare_with_remote(directory: str, branch: str = None) -> Dict:
    """
    Compare local commits with remote
    
    Returns:
    - ahead: Number of commits ahead of remote
    - behind: Number of commits behind remote
    - commits_ahead: List of commits ahead
    - commits_behind: List of commits behind
    """
    dir_path = Path(directory)
    
    result = {
        "ahead": 0,
        "behind": 0,
        "commits_ahead": [],
        "commits_behind": [],
        "up_to_date": False,
        "error": None
    }
    
    try:
        # Fetch latest from remote
        subprocess.run(
            ["git", "fetch", "origin"],
            cwd=str(dir_path),
            capture_output=True,
            timeout=30
        )
        
        # Get current branch if not specified
        if not branch:
            branch_result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=str(dir_path),
                capture_output=True,
                text=True,
                timeout=5
            )
            if branch_result.returncode == 0:
                branch = branch_result.stdout.strip()
        
        if not branch:
            result["error"] = "Could not determine branch"
            return result
        
        # Get ahead/behind count
        count_result = subprocess.run(
            ["git", "rev-list", "--left-right", "--count", f"HEAD...origin/{branch}"],
            cwd=str(dir_path),
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if count_result.returncode == 0:
            parts = count_result.stdout.strip().split()
            if len(parts) == 2:
                result["ahead"] = int(parts[0])
                result["behind"] = int(parts[1])
                result["up_to_date"] = result["ahead"] == 0 and result["behind"] == 0
        
        # Get commits ahead
        if result["ahead"] > 0:
            ahead_result = subprocess.run(
                ["git", "log", f"origin/{branch}..HEAD", "--pretty=%h|%s|%an|%ar", "--no-merges"],
                cwd=str(dir_path),
                capture_output=True,
                text=True,
                timeout=5
            )
            if ahead_result.returncode == 0:
                for line in ahead_result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split('|')
                        if len(parts) >= 4:
                            result["commits_ahead"].append({
                                "hash": parts[0],
                                "message": parts[1],
                                "author": parts[2],
                                "date": parts[3]
                            })
        
        # Get commits behind
        if result["behind"] > 0:
            behind_result = subprocess.run(
                ["git", "log", f"HEAD..origin/{branch}", "--pretty=%h|%s|%an|%ar", "--no-merges"],
                cwd=str(dir_path),
                capture_output=True,
                text=True,
                timeout=5
            )
            if behind_result.returncode == 0:
                for line in behind_result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split('|')
                        if len(parts) >= 4:
                            result["commits_behind"].append({
                                "hash": parts[0],
                                "message": parts[1],
                                "author": parts[2],
                                "date": parts[3]
                            })
    
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def get_environment_comparison() -> Dict:
    """
    Compare dev and prod environments with remote
    
    Returns comprehensive comparison data
    """
    dev_dir = settings.DEV_DIR
    prod_dir = settings.PROD_DIR
    
    # Get commit info for both environments
    dev_info = await get_git_commit_info(dev_dir)
    prod_info = await get_git_commit_info(prod_dir)
    
    # Compare with remote
    dev_comparison = await compare_with_remote(dev_dir, dev_info.get("branch"))
    prod_comparison = await compare_with_remote(prod_dir, prod_info.get("branch"))
    
    # Determine sync status
    dev_status = "up-to-date" if dev_comparison.get("up_to_date") else \
                 "ahead" if dev_comparison.get("ahead", 0) > 0 else \
                 "behind" if dev_comparison.get("behind", 0) > 0 else "unknown"
    
    prod_status = "up-to-date" if prod_comparison.get("up_to_date") else \
                  "ahead" if prod_comparison.get("ahead", 0) > 0 else \
                  "behind" if prod_comparison.get("behind", 0) > 0 else "unknown"
    
    # Check if dev and prod are on same commit
    same_commit = dev_info.get("current_commit") == prod_info.get("current_commit")
    
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "dev": {
            "info": dev_info,
            "comparison": dev_comparison,
            "status": dev_status
        },
        "prod": {
            "info": prod_info,
            "comparison": prod_comparison,
            "status": prod_status
        },
        "same_commit": same_commit,
        "recommendations": []
    }
    
    # Generate recommendations
    if dev_comparison.get("behind", 0) > 0:
        result["recommendations"].append({
            "type": "warning",
            "environment": "dev",
            "message": f"Dev is {dev_comparison['behind']} commit(s) behind remote",
            "action": "pull",
            "priority": "high"
        })
    
    if prod_comparison.get("behind", 0) > 0:
        result["recommendations"].append({
            "type": "critical",
            "environment": "prod",
            "message": f"Production is {prod_comparison['behind']} commit(s) behind remote",
            "action": "deploy",
            "priority": "critical"
        })
    
    if not same_commit:
        result["recommendations"].append({
            "type": "info",
            "environment": "both",
            "message": "Dev and Production are on different commits",
            "action": "sync",
            "priority": "medium"
        })
    
    if dev_comparison.get("ahead", 0) > 0:
        result["recommendations"].append({
            "type": "info",
            "environment": "dev",
            "message": f"Dev has {dev_comparison['ahead']} unpushed commit(s)",
            "action": "push",
            "priority": "low"
        })
    
    # Save to JSON file
    try:
        status_file = Path("/var/www/build/data/git-status.json")
        status_file.parent.mkdir(parents=True, exist_ok=True)
        with open(status_file, "w") as f:
            json.dump(result, f, indent=2)
    except Exception as e:
        result["save_error"] = str(e)
    
    return result


async def get_commit_timeline() -> List[Dict]:
    """
    Get a timeline of recent commits from remote
    """
    dev_dir = Path(settings.DEV_DIR)
    
    timeline = []
    
    try:
        # Fetch latest
        subprocess.run(
            ["git", "fetch", "origin"],
            cwd=str(dev_dir),
            capture_output=True,
            timeout=30
        )
        
        # Get recent commits from remote
        result = subprocess.run(
            ["git", "log", "origin/V25", "--pretty=%H|%h|%s|%an|%ae|%ai|%ar", "-20", "--no-merges"],
            cwd=str(dev_dir),
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.split('|')
                    if len(parts) >= 7:
                        timeline.append({
                            "hash": parts[0],
                            "hash_short": parts[1],
                            "message": parts[2],
                            "author": parts[3],
                            "author_email": parts[4],
                            "date": parts[5],
                            "date_relative": parts[6]
                        })
    
    except Exception as e:
        return [{"error": str(e)}]
    
    return timeline
