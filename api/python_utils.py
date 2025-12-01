"""Utility functions for executing Python scripts with UTF-8 encoding"""
import os
import platform
import subprocess
from typing import List, Dict, Any, Optional


def get_python_env_with_encoding(base_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Get environment dict with PYTHONIOENCODING set to utf-8"""
    env = os.environ.copy()
    if base_env:
        env.update(base_env)
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def format_python_command(command: str) -> str:
    """
    Format a Python command to include UTF-8 encoding.
    
    Always uses Windows PowerShell format as requested:
    $env:PYTHONIOENCODING='utf-8'; python script.py
    
    Args:
        command: The command string that may contain Python script execution
        
    Returns:
        Formatted command with UTF-8 encoding set (PowerShell format)
    """
    # Check if this is a Python command
    python_patterns = [
        r'\bpython\s+',
        r'\bpython3\s+',
        r'\bpy\s+',
        r'\.py\b'
    ]
    
    import re
    is_python_command = any(re.search(pattern, command, re.IGNORECASE) for pattern in python_patterns)
    
    if not is_python_command:
        return command
    
    # If already has PYTHONIOENCODING, don't modify
    if 'PYTHONIOENCODING' in command.upper() or '$env:PYTHONIOENCODING' in command:
        return command
    
    # Always use Windows PowerShell format as requested
    return f"$env:PYTHONIOENCODING='utf-8'; {command}"


def run_python_script(
    script_path: str,
    args: Optional[List[str]] = None,
    cwd: Optional[str] = None,
    env: Optional[Dict[str, str]] = None,
    **subprocess_kwargs
) -> subprocess.CompletedProcess:
    """
    Run a Python script with UTF-8 encoding set in environment.
    
    Args:
        script_path: Path to Python script
        args: Additional arguments to pass to script
        cwd: Working directory
        env: Base environment variables
        **subprocess_kwargs: Additional subprocess.run() arguments
        
    Returns:
        CompletedProcess from subprocess.run()
    """
    python_cmd = "python" if platform.system() == "Windows" else "python3"
    cmd = [python_cmd, script_path]
    if args:
        cmd.extend(args)
    
    # Set UTF-8 encoding in environment
    final_env = get_python_env_with_encoding(env)
    
    return subprocess.run(
        cmd,
        cwd=cwd,
        env=final_env,
        **subprocess_kwargs
    )

