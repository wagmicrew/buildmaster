"""Build intelligence for detecting changes and optimizing builds"""
import subprocess
import os
from datetime import datetime
from typing import Dict, Optional
from config import settings


def check_changes_since_last_build(working_dir: str) -> Dict:
    """
    Check if there are code changes since the last build
    
    Returns:
        Dict with has_changes, last_build_time, last_commit_time, files_changed
    """
    try:
        # Get last commit time
        commit_result = subprocess.run(
            ["git", "log", "-1", "--format=%cd", "--date=relative"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        last_commit_time = commit_result.stdout.strip() if commit_result.returncode == 0 else "Unknown"
        
        # Check for uncommitted changes
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        uncommitted_files = []
        if status_result.returncode == 0:
            uncommitted_files = [
                line.strip() for line in status_result.stdout.strip().split("\n") 
                if line.strip()
            ]
        
        # Check .next directory modification time (last build indicator)
        next_dir = os.path.join(working_dir, ".next")
        last_build_time = "Never"
        
        if os.path.exists(next_dir):
            mtime = os.path.getmtime(next_dir)
            build_datetime = datetime.fromtimestamp(mtime)
            now = datetime.now()
            diff = now - build_datetime
            
            if diff.days > 0:
                last_build_time = f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
            elif diff.seconds > 3600:
                hours = diff.seconds // 3600
                last_build_time = f"{hours} hour{'s' if hours > 1 else ''} ago"
            elif diff.seconds > 60:
                minutes = diff.seconds // 60
                last_build_time = f"{minutes} minute{'s' if minutes > 1 else ''} ago"
            else:
                last_build_time = "Just now"
        
        # Determine if there are meaningful changes
        has_changes = len(uncommitted_files) > 0
        
        # Get list of changed files since last commit
        diff_result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        changed_files = []
        if diff_result.returncode == 0:
            changed_files = [
                line.strip() for line in diff_result.stdout.strip().split("\n") 
                if line.strip()
            ]
        
        return {
            "has_changes": has_changes or len(changed_files) > 0,
            "last_build_time": last_build_time,
            "last_commit_time": last_commit_time,
            "files_changed": len(uncommitted_files) + len(changed_files),
            "uncommitted_files": uncommitted_files[:10],  # Limit to 10
            "changed_files": changed_files[:10]  # Limit to 10
        }
        
    except Exception as e:
        return {
            "has_changes": True,  # Default to allowing build if check fails
            "last_build_time": "Unknown",
            "last_commit_time": "Unknown",
            "files_changed": 0,
            "error": str(e)
        }


def get_build_disk_usage(working_dir: str) -> Dict:
    """Get disk usage for build artifacts and caches"""
    try:
        usage = {}
        
        # Check .next folder size
        next_dir = os.path.join(working_dir, ".next")
        if os.path.exists(next_dir):
            result = subprocess.run(
                ["du", "-sh", next_dir],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                usage["next_folder"] = result.stdout.split()[0]
        
        # Check node_modules size
        node_modules = os.path.join(working_dir, "node_modules")
        if os.path.exists(node_modules):
            result = subprocess.run(
                ["du", "-sh", node_modules],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                usage["node_modules"] = result.stdout.split()[0]
        
        return usage
    except Exception as e:
        return {"error": str(e)}
