"""BuildMaster operations - self-update and access control"""
import json
import os
import subprocess
import asyncio
import base64
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# BuildMaster settings file paths
BUILDMASTER_SETTINGS_FILE = "/var/www/build/buildmaster_settings.json"
VALID_EMAILS_FILE = "/var/www/build/valid_emails.enc"
BUILDMASTER_PATH = "/var/www/build"

# Default BuildMaster settings
DEFAULT_BUILDMASTER_SETTINGS = {
    "github": {
        "repo": "https://github.com/wagmicrew/buildmaster.git",
        "branch": "main"
    },
    "autoUpdate": False,
    "lastUpdateCheck": None,
    "lastUpdate": None,
    "currentVersion": "1.0.0"
}


def _get_encryption_key() -> bytes:
    """Generate encryption key from environment or create one"""
    # Try to get key from environment
    secret = os.environ.get("BUILDMASTER_SECRET", "")
    
    if not secret:
        # Use a combination of machine-specific values
        try:
            with open("/etc/machine-id", "r") as f:
                machine_id = f.read().strip()
        except:
            machine_id = "buildmaster-default-key"
        
        secret = f"buildmaster-{machine_id}"
    
    # Derive a key using PBKDF2
    salt = b"buildmaster_salt_v1"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    return key


def _encrypt_data(data: str) -> bytes:
    """Encrypt data using Fernet symmetric encryption"""
    key = _get_encryption_key()
    f = Fernet(key)
    return f.encrypt(data.encode())


def _decrypt_data(encrypted_data: bytes) -> str:
    """Decrypt data using Fernet symmetric encryption"""
    key = _get_encryption_key()
    f = Fernet(key)
    return f.decrypt(encrypted_data).decode()


async def load_buildmaster_settings() -> Dict[str, Any]:
    """Load BuildMaster settings"""
    try:
        if os.path.exists(BUILDMASTER_SETTINGS_FILE):
            with open(BUILDMASTER_SETTINGS_FILE, 'r') as f:
                settings = json.load(f)
                # Merge with defaults
                return {**DEFAULT_BUILDMASTER_SETTINGS, **settings}
        return DEFAULT_BUILDMASTER_SETTINGS.copy()
    except Exception as e:
        print(f"Error loading BuildMaster settings: {e}")
        return DEFAULT_BUILDMASTER_SETTINGS.copy()


async def save_buildmaster_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    """Save BuildMaster settings"""
    try:
        os.makedirs(os.path.dirname(BUILDMASTER_SETTINGS_FILE), exist_ok=True)
        with open(BUILDMASTER_SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
        return {"success": True, "message": "BuildMaster settings saved"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def load_valid_emails() -> List[str]:
    """Load and decrypt valid emails list"""
    try:
        if os.path.exists(VALID_EMAILS_FILE):
            with open(VALID_EMAILS_FILE, 'rb') as f:
                encrypted_data = f.read()
            decrypted = _decrypt_data(encrypted_data)
            data = json.loads(decrypted)
            return data.get("emails", [])
        return []
    except Exception as e:
        print(f"Error loading valid emails: {e}")
        return []


async def save_valid_emails(emails: List[str]) -> Dict[str, Any]:
    """Encrypt and save valid emails list"""
    try:
        os.makedirs(os.path.dirname(VALID_EMAILS_FILE), exist_ok=True)
        
        # Normalize emails to lowercase
        normalized_emails = [email.lower().strip() for email in emails if email.strip()]
        
        # Create data structure with metadata
        data = {
            "emails": normalized_emails,
            "updated_at": datetime.utcnow().isoformat(),
            "count": len(normalized_emails)
        }
        
        # Encrypt and save
        encrypted = _encrypt_data(json.dumps(data))
        with open(VALID_EMAILS_FILE, 'wb') as f:
            f.write(encrypted)
        
        return {
            "success": True,
            "message": f"Saved {len(normalized_emails)} valid email(s)",
            "count": len(normalized_emails)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def add_valid_email(email: str) -> Dict[str, Any]:
    """Add a single email to the valid emails list"""
    try:
        emails = await load_valid_emails()
        email_lower = email.lower().strip()
        
        if email_lower in emails:
            return {"success": False, "error": "Email already exists"}
        
        emails.append(email_lower)
        return await save_valid_emails(emails)
    except Exception as e:
        return {"success": False, "error": str(e)}


async def remove_valid_email(email: str) -> Dict[str, Any]:
    """Remove an email from the valid emails list"""
    try:
        emails = await load_valid_emails()
        email_lower = email.lower().strip()
        
        if email_lower not in emails:
            return {"success": False, "error": "Email not found"}
        
        emails.remove(email_lower)
        return await save_valid_emails(emails)
    except Exception as e:
        return {"success": False, "error": str(e)}


async def is_email_valid(email: str) -> bool:
    """Check if an email is in the valid emails list"""
    emails = await load_valid_emails()
    return email.lower().strip() in emails


async def check_for_updates() -> Dict[str, Any]:
    """Check if there are updates available from GitHub"""
    try:
        settings = await load_buildmaster_settings()
        repo_url = settings.get("github", {}).get("repo", "")
        branch = settings.get("github", {}).get("branch", "main")
        
        if not repo_url:
            return {"success": False, "error": "No GitHub repository configured"}
        
        # Get current commit
        current_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        current_commit = current_result.stdout.strip() if current_result.returncode == 0 else "unknown"
        
        # Fetch from remote
        fetch_result = subprocess.run(
            ["git", "fetch", "origin", branch],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        
        if fetch_result.returncode != 0:
            return {
                "success": False,
                "error": f"Failed to fetch from remote: {fetch_result.stderr}"
            }
        
        # Get remote commit
        remote_result = subprocess.run(
            ["git", "rev-parse", f"origin/{branch}"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        remote_commit = remote_result.stdout.strip() if remote_result.returncode == 0 else "unknown"
        
        # Check if there are commits behind
        behind_result = subprocess.run(
            ["git", "rev-list", "--count", f"HEAD..origin/{branch}"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        commits_behind = int(behind_result.stdout.strip()) if behind_result.returncode == 0 else 0
        
        # Get recent commit messages from remote
        log_result = subprocess.run(
            ["git", "log", "--oneline", "-5", f"origin/{branch}"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        recent_commits = []
        if log_result.returncode == 0:
            for line in log_result.stdout.strip().split('\n'):
                if line:
                    parts = line.split(' ', 1)
                    recent_commits.append({
                        "hash": parts[0],
                        "message": parts[1] if len(parts) > 1 else ""
                    })
        
        # Update last check time
        settings["lastUpdateCheck"] = datetime.utcnow().isoformat()
        await save_buildmaster_settings(settings)
        
        has_updates = commits_behind > 0
        
        return {
            "success": True,
            "hasUpdates": has_updates,
            "currentCommit": current_commit[:8],
            "remoteCommit": remote_commit[:8],
            "commitsBehind": commits_behind,
            "recentCommits": recent_commits,
            "branch": branch,
            "checkedAt": settings["lastUpdateCheck"]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def update_application() -> Dict[str, Any]:
    """Update BuildMaster application from GitHub"""
    steps = []
    try:
        settings = await load_buildmaster_settings()
        branch = settings.get("github", {}).get("branch", "main")
        
        steps.append({"step": "Starting update process", "status": "success"})
        
        # Step 1: Stash any local changes
        stash_result = subprocess.run(
            ["git", "stash"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        steps.append({
            "step": "Stash local changes",
            "status": "success" if stash_result.returncode == 0 else "warning",
            "output": stash_result.stdout.strip() or stash_result.stderr.strip()
        })
        
        # Step 2: Fetch from remote
        fetch_result = subprocess.run(
            ["git", "fetch", "origin", branch],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        if fetch_result.returncode != 0:
            return {
                "success": False,
                "error": f"Failed to fetch: {fetch_result.stderr}",
                "steps": steps
            }
        steps.append({"step": "Fetch from remote", "status": "success"})
        
        # Step 3: Reset to remote branch
        reset_result = subprocess.run(
            ["git", "reset", "--hard", f"origin/{branch}"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        if reset_result.returncode != 0:
            return {
                "success": False,
                "error": f"Failed to reset: {reset_result.stderr}",
                "steps": steps
            }
        steps.append({"step": "Reset to remote branch", "status": "success"})
        
        # Step 4: Install Python dependencies
        from python_utils import get_python_env_with_encoding
        env = get_python_env_with_encoding()
        pip_result = subprocess.run(
            ["pip3", "install", "-r", "requirements.txt"],
            cwd=f"{BUILDMASTER_PATH}/api",
            capture_output=True,
            text=True,
            env=env
        )
        steps.append({
            "step": "Install Python dependencies",
            "status": "success" if pip_result.returncode == 0 else "warning",
            "output": pip_result.stdout.strip()[-500:] if pip_result.stdout else ""
        })
        
        # Step 5: Install npm dependencies for web
        npm_install_result = subprocess.run(
            ["npm", "install"],
            cwd=f"{BUILDMASTER_PATH}/web",
            capture_output=True,
            text=True
        )
        steps.append({
            "step": "Install npm dependencies",
            "status": "success" if npm_install_result.returncode == 0 else "warning"
        })
        
        # Step 6: Build web application
        npm_build_result = subprocess.run(
            ["npm", "run", "build"],
            cwd=f"{BUILDMASTER_PATH}/web",
            capture_output=True,
            text=True
        )
        if npm_build_result.returncode != 0:
            return {
                "success": False,
                "error": f"Failed to build web app: {npm_build_result.stderr}",
                "steps": steps
            }
        steps.append({"step": "Build web application", "status": "success"})
        
        # Step 7: Restart systemd service
        service_result = subprocess.run(
            ["systemctl", "restart", "build-dashboard-api"],
            capture_output=True,
            text=True
        )
        steps.append({
            "step": "Restart API service",
            "status": "success" if service_result.returncode == 0 else "warning",
            "output": service_result.stdout.strip() or service_result.stderr.strip()
        })
        
        # Update last update time
        settings["lastUpdate"] = datetime.utcnow().isoformat()
        await save_buildmaster_settings(settings)
        
        # Get new commit hash
        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        new_commit = commit_result.stdout.strip()[:8] if commit_result.returncode == 0 else "unknown"
        
        steps.append({
            "step": f"Update complete - now at {new_commit}",
            "status": "success"
        })
        
        return {
            "success": True,
            "message": "Application updated successfully",
            "newCommit": new_commit,
            "steps": steps,
            "restartRequired": True
        }
    except Exception as e:
        steps.append({"step": f"Error: {str(e)}", "status": "error"})
        return {"success": False, "error": str(e), "steps": steps}


async def restart_buildmaster_service() -> Dict[str, Any]:
    """Restart the BuildMaster API service"""
    try:
        # Restart systemd service
        result = subprocess.run(
            ["systemctl", "restart", "build-dashboard-api"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "message": "BuildMaster service restarted",
                "output": result.stdout.strip()
            }
        else:
            return {
                "success": False,
                "error": result.stderr or "Failed to restart service"
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_buildmaster_status() -> Dict[str, Any]:
    """Get current BuildMaster status including version and service info"""
    try:
        settings = await load_buildmaster_settings()
        
        # Get current git info
        commit_result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        current_commit = commit_result.stdout.strip()[:8] if commit_result.returncode == 0 else "unknown"
        
        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=BUILDMASTER_PATH,
            capture_output=True,
            text=True
        )
        current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "unknown"
        
        # Get systemd service status
        service_result = subprocess.run(
            ["systemctl", "is-active", "build-dashboard-api"],
            capture_output=True,
            text=True
        )
        service_status = service_result.stdout.strip() if service_result.returncode == 0 else "inactive"
        
        # Get service uptime
        service_uptime = None
        if service_status == "active":
            uptime_result = subprocess.run(
                ["systemctl", "show", "build-dashboard-api", "--property=ActiveEnterTimestamp"],
                capture_output=True,
                text=True
            )
            if uptime_result.returncode == 0:
                timestamp_str = uptime_result.stdout.strip().replace("ActiveEnterTimestamp=", "")
                if timestamp_str:
                    service_uptime = timestamp_str
        
        # Count valid emails
        emails = await load_valid_emails()
        
        return {
            "success": True,
            "version": settings.get("currentVersion", "1.0.0"),
            "currentCommit": current_commit,
            "currentBranch": current_branch,
            "github": settings.get("github", {}),
            "lastUpdateCheck": settings.get("lastUpdateCheck"),
            "lastUpdate": settings.get("lastUpdate"),
            "serviceStatus": service_status,
            "serviceUptime": service_uptime,
            "validEmailsCount": len(emails)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# Initialize valid emails with default if file doesn't exist
async def initialize_valid_emails():
    """Initialize valid emails file with default email if it doesn't exist"""
    if not os.path.exists(VALID_EMAILS_FILE):
        default_emails = ["johaswe@gmail.com"]
        await save_valid_emails(default_emails)
        print(f"Initialized valid emails with: {default_emails}")


async def force_add_email(email: str):
    """Force add an email (for manual fixes)"""
    emails = await load_valid_emails()
    if email.lower() not in emails:
        emails.append(email.lower())
        await save_valid_emails(emails)
    return emails
