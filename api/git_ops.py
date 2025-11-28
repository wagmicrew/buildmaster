"""Git operations for pulling and managing repository state"""
import subprocess
import os
from typing import List, Optional, Dict
from config import settings
from models import GitPullRequest, GitPullResponse


def get_available_branches(working_dir: str) -> Dict[str, List[str]]:
    """Get list of available local and remote branches"""
    try:
        # Get current branch
        current_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        current_branch = current_result.stdout.strip() if current_result.returncode == 0 else None
        
        # Get all branches
        branches_result = subprocess.run(
            ["git", "branch", "-a"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if branches_result.returncode != 0:
            return {"current": current_branch, "local": [], "remote": []}
        
        local_branches = []
        remote_branches = []
        
        for line in branches_result.stdout.split("\n"):
            line = line.strip()
            if not line:
                continue
            
            # Remove * indicator for current branch
            line = line.lstrip("* ")
            
            if line.startswith("remotes/origin/"):
                # Extract remote branch name
                branch_name = line.replace("remotes/origin/", "")
                if branch_name != "HEAD" and "->" not in branch_name:
                    remote_branches.append(branch_name)
            elif not line.startswith("remotes/"):
                local_branches.append(line)
        
        return {
            "current": current_branch,
            "local": sorted(set(local_branches)),
            "remote": sorted(set(remote_branches))
        }
    except Exception as e:
        return {"current": None, "local": [], "remote": [], "error": str(e)}


def check_git_status(working_dir: str) -> dict:
    """Check git status and return information about changes"""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            return {"has_changes": False, "files": []}
        
        files = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
        return {
            "has_changes": len(files) > 0,
            "files": files
        }
    except Exception as e:
        return {"has_changes": False, "error": str(e)}


def stash_changes(working_dir: str) -> tuple[bool, str]:
    """Stash local changes"""
    try:
        result = subprocess.run(
            ["git", "stash", "push", "-m", "Build Dashboard Auto-Stash"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return True, "Changes stashed successfully"
        else:
            return False, result.stderr or "Failed to stash changes"
    except Exception as e:
        return False, str(e)


def delete_changes(working_dir: str) -> tuple[bool, str]:
    """Delete local changes (hard reset)"""
    try:
        # First, reset hard
        result = subprocess.run(
            ["git", "reset", "--hard", "HEAD"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0:
            return False, result.stderr or "Failed to reset changes"
        
        # Clean untracked files
        subprocess.run(
            ["git", "clean", "-fd"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        return True, "Local changes deleted successfully"
    except Exception as e:
        return False, str(e)


async def pull_from_git(request: GitPullRequest) -> GitPullResponse:
    """
    Pull latest changes from git repository
    
    Args:
        request: Git pull request with options
        
    Returns:
        GitPullResponse with pull result
    """
    working_dir = settings.DEV_DIR
    
    if not os.path.exists(working_dir):
        return GitPullResponse(
            success=False,
            message=f"Directory not found: {working_dir}"
        )
    
    # Check for local changes
    status = check_git_status(working_dir)
    
    if status.get("has_changes"):
        if request.force:
            # Delete changes
            success, message = delete_changes(working_dir)
            if not success:
                return GitPullResponse(
                    success=False,
                    message=f"Failed to delete changes: {message}",
                    changes=status.get("files", [])
                )
        elif request.stash_changes:
            # Stash changes
            success, message = stash_changes(working_dir)
            if not success:
                return GitPullResponse(
                    success=False,
                    message=f"Failed to stash changes: {message}",
                    changes=status.get("files", [])
                )
        else:
            return GitPullResponse(
                success=False,
                message="Local changes detected. Please stash or delete them first.",
                changes=status.get("files", [])
            )
    
    # Fetch latest
    try:
        fetch_result = subprocess.run(
            ["git", "fetch", "origin"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if fetch_result.returncode != 0:
            return GitPullResponse(
                success=False,
                message=f"Failed to fetch: {fetch_result.stderr}"
            )
    except Exception as e:
        return GitPullResponse(
            success=False,
            message=f"Fetch error: {str(e)}"
        )
    
    # Determine which branch to pull
    if request.branch:
        target_branch = request.branch
    else:
        # Get current branch if not specified
        try:
            branch_result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=10
            )
            target_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "main"
        except Exception:
            target_branch = "main"
    
    # Pull changes
    try:
        pull_result = subprocess.run(
            ["git", "pull", "origin", target_branch],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if pull_result.returncode != 0:
            # Check for conflicts
            if "CONFLICT" in pull_result.stdout or "conflict" in pull_result.stderr.lower():
                return GitPullResponse(
                    success=False,
                    message="Merge conflicts detected. Please resolve manually.",
                    conflicts=[line for line in pull_result.stdout.split("\n") if "CONFLICT" in line]
                )
            
            return GitPullResponse(
                success=False,
                message=f"Pull failed: {pull_result.stderr or pull_result.stdout}"
            )
        
        # Parse git output for changes
        git_output = pull_result.stdout.strip()
        changes_list = []
        has_changes = False
        sql_migrations = []
        build_dashboard_changes = []
        
        # Check if there were actually changes
        has_changes = "Already up to date" not in git_output
        
        if git_output and has_changes:
            # Get list of changed files
            try:
                diff_result = subprocess.run(
                    ["git", "diff", "--name-only", "HEAD@{1}", "HEAD"],
                    cwd=working_dir,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if diff_result.returncode == 0:
                    changed_files = diff_result.stdout.strip().split("\n")
                    changes_list = [f for f in changed_files if f.strip()]
                    
                    # Check for SQL migration files
                    for file in changes_list:
                        if file.endswith('.sql') and ('migration' in file.lower() or file.startswith('migrations/')):
                            sql_migrations.append(file)
                        
                        # Check for Build Dashboard changes
                        if file.startswith('Documentation_new/build-dashboard/'):
                            build_dashboard_changes.append(file)
            except:
                # Fallback to parsing git output
                for line in git_output.split("\n"):
                    line = line.strip()
                    if line and not line.startswith("From ") and not line.startswith("*"):
                        changes_list.append(line)
        
        # Build success message
        if not has_changes:
            message = "Already up to date - no changes to pull"
        elif changes_list:
            message = f"Successfully pulled {len(changes_list)} file(s) from {target_branch}"
            if sql_migrations:
                message += f" (includes {len(sql_migrations)} SQL migration(s))"
            if build_dashboard_changes:
                message += f" (includes {len(build_dashboard_changes)} Build Dashboard file(s))"
        else:
            message = f"Successfully pulled from {target_branch}"
        
        return GitPullResponse(
            success=True,
            message=message,
            changes=changes_list if changes_list else None,
            has_changes=has_changes,
            sql_migrations=sql_migrations if sql_migrations else None,
            build_dashboard_changes=build_dashboard_changes if build_dashboard_changes else None,
            should_reload=has_changes  # Only reload if there were actual changes
        )
        
    except subprocess.TimeoutExpired:
        return GitPullResponse(
            success=False,
            message="Pull operation timed out"
        )
    except Exception as e:
        return GitPullResponse(
            success=False,
            message=f"Pull error: {str(e)}"
        )


# BuildMaster directory for code detection
BUILDMASTER_DIR = "/var/www/build"
BUILDMASTER_PATTERNS = [
    "Documentation_new/build-dashboard/",
    "scripts/build-dashboard/",
    "build-dashboard/",
]


def get_incoming_changes(working_dir: str, branch: str = None) -> dict:
    """Fetch and check what changes would be pulled without actually pulling"""
    try:
        # Fetch first
        fetch_result = subprocess.run(
            ["git", "fetch", "origin"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if fetch_result.returncode != 0:
            return {"success": False, "error": f"Fetch failed: {fetch_result.stderr}"}
        
        # Get current branch if not specified
        if not branch:
            branch_result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=10
            )
            branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "main"
        
        # Get incoming changes (diff between local and remote)
        diff_result = subprocess.run(
            ["git", "log", f"HEAD..origin/{branch}", "--name-only", "--oneline"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if diff_result.returncode != 0:
            return {"success": False, "error": f"Diff failed: {diff_result.stderr}"}
        
        output = diff_result.stdout.strip()
        if not output:
            return {
                "success": True,
                "has_changes": False,
                "commits": [],
                "files": [],
                "buildmaster_files": [],
                "message": "Already up to date"
            }
        
        # Parse commits and files
        commits = []
        files = set()
        buildmaster_files = []
        
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            
            # Commit lines start with a hash
            if len(line.split()[0]) >= 7 and line.split()[0].isalnum():
                parts = line.split(" ", 1)
                if len(parts) == 2:
                    commits.append({"hash": parts[0], "message": parts[1]})
            else:
                # File path
                files.add(line)
                # Check if it's a BuildMaster file
                for pattern in BUILDMASTER_PATTERNS:
                    if line.startswith(pattern) or pattern in line:
                        buildmaster_files.append(line)
                        break
        
        return {
            "success": True,
            "has_changes": True,
            "commits": commits,
            "files": list(files),
            "buildmaster_files": buildmaster_files,
            "commit_count": len(commits),
            "file_count": len(files),
            "branch": branch
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_buildmaster_repo_status(files: list) -> dict:
    """Check if BuildMaster files from main repo exist in BuildMaster repo"""
    try:
        if not os.path.exists(BUILDMASTER_DIR):
            return {"success": False, "error": "BuildMaster directory not found"}
        
        # Get BuildMaster repo status
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=BUILDMASTER_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Get current commit hash
        hash_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=BUILDMASTER_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Check if BuildMaster has unpushed changes
        unpushed_result = subprocess.run(
            ["git", "log", "origin/main..HEAD", "--oneline"],
            cwd=BUILDMASTER_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        has_local_changes = bool(status_result.stdout.strip())
        unpushed_commits = [line for line in unpushed_result.stdout.strip().split("\n") if line]
        
        # Map main repo files to BuildMaster paths
        file_mapping = []
        for file in files:
            # Extract just the relative path within build-dashboard
            for pattern in BUILDMASTER_PATTERNS:
                if file.startswith(pattern):
                    relative_path = file[len(pattern):]
                    buildmaster_path = os.path.join(BUILDMASTER_DIR, relative_path)
                    exists_in_bm = os.path.exists(buildmaster_path)
                    file_mapping.append({
                        "main_repo_path": file,
                        "buildmaster_path": relative_path,
                        "exists_in_buildmaster": exists_in_bm
                    })
                    break
        
        return {
            "success": True,
            "has_local_changes": has_local_changes,
            "unpushed_commits": unpushed_commits,
            "current_hash": hash_result.stdout.strip() if hash_result.returncode == 0 else None,
            "file_mapping": file_mapping,
            "should_push_instead": has_local_changes or len(unpushed_commits) > 0
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


async def pull_with_env(env: str, branch: str = None, stash: bool = False, force: bool = False) -> dict:
    """Pull from git for a specific environment (dev or prod)"""
    working_dir = settings.DEV_DIR if env == "dev" else settings.PROD_DIR
    
    if not os.path.exists(working_dir):
        return {"success": False, "error": f"Directory not found: {working_dir}"}
    
    # Check for local changes
    status = check_git_status(working_dir)
    
    if status.get("has_changes"):
        if force:
            success, message = delete_changes(working_dir)
            if not success:
                return {"success": False, "error": f"Failed to delete changes: {message}", "files": status.get("files", [])}
        elif stash:
            success, message = stash_changes(working_dir)
            if not success:
                return {"success": False, "error": f"Failed to stash changes: {message}", "files": status.get("files", [])}
        else:
            return {
                "success": False,
                "error": "Local changes detected",
                "has_local_changes": True,
                "files": status.get("files", [])
            }
    
    # Fetch and pull
    try:
        fetch_result = subprocess.run(
            ["git", "fetch", "origin"],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if fetch_result.returncode != 0:
            return {"success": False, "error": f"Fetch failed: {fetch_result.stderr}"}
        
        # Get branch
        if not branch:
            branch_result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=working_dir,
                capture_output=True,
                text=True,
                timeout=10
            )
            branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "main"
        
        # Try pull with rebase first
        pull_result = subprocess.run(
            ["git", "pull", "--rebase", "origin", branch],
            cwd=working_dir,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        # If rebase fails due to divergent branches, try reset to origin
        if pull_result.returncode != 0:
            error_output = pull_result.stderr or pull_result.stdout
            if "divergent" in error_output.lower() or "need to specify" in error_output.lower():
                # Reset to origin branch (force sync)
                reset_result = subprocess.run(
                    ["git", "reset", "--hard", f"origin/{branch}"],
                    cwd=working_dir,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if reset_result.returncode != 0:
                    return {"success": False, "error": f"Reset failed: {reset_result.stderr}"}
                pull_result = reset_result  # Use reset result for success
            else:
                return {"success": False, "error": f"Pull failed: {error_output}"}
        
        # Check what was pulled
        output = pull_result.stdout.strip()
        already_up_to_date = "Already up to date" in output
        
        # Get changed files
        changed_files = []
        if not already_up_to_date:
            try:
                diff_result = subprocess.run(
                    ["git", "diff", "--name-only", "HEAD@{1}", "HEAD"],
                    cwd=working_dir,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if diff_result.returncode == 0:
                    changed_files = [f for f in diff_result.stdout.strip().split("\n") if f.strip()]
            except:
                pass
        
        return {
            "success": True,
            "message": "Already up to date" if already_up_to_date else f"Pulled {len(changed_files)} file(s)",
            "already_up_to_date": already_up_to_date,
            "changed_files": changed_files,
            "branch": branch,
            "env": env
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def push_to_buildmaster(commit_message: str = None) -> dict:
    """Push BuildMaster changes to its repo"""
    try:
        if not os.path.exists(BUILDMASTER_DIR):
            return {"success": False, "error": "BuildMaster directory not found"}
        
        # Check for changes
        status_result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=BUILDMASTER_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if status_result.stdout.strip():
            # Stage all changes
            subprocess.run(
                ["git", "add", "-A"],
                cwd=BUILDMASTER_DIR,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Commit
            msg = commit_message or "BuildMaster update from main repo"
            commit_result = subprocess.run(
                ["git", "commit", "-m", msg],
                cwd=BUILDMASTER_DIR,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if commit_result.returncode != 0:
                return {"success": False, "error": f"Commit failed: {commit_result.stderr}"}
        
        # Push
        push_result = subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=BUILDMASTER_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if push_result.returncode != 0:
            return {"success": False, "error": f"Push failed: {push_result.stderr}"}
        
        return {"success": True, "message": "Successfully pushed to BuildMaster repo"}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

