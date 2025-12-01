"""
Sanity Checker Module
Comprehensive health checks for Nginx, React, Next.js server setups
"""

import os
import subprocess
import json
import re
import socket
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import aiohttp
import psutil


class CheckStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    SKIP = "skip"


class CheckCategory(str, Enum):
    NGINX = "nginx"
    REACT = "react"
    NODE = "node"
    SYSTEM = "system"
    NETWORK = "network"
    BUILD = "build"
    CONFIG = "config"


@dataclass
class CheckResult:
    name: str
    category: CheckCategory
    status: CheckStatus
    message: str
    details: Optional[str] = None
    suggestion: Optional[str] = None
    fix_command: Optional[str] = None
    duration_ms: float = 0


@dataclass
class SanityReport:
    environment: str
    project_path: str
    timestamp: str
    checks: List[CheckResult] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
    ai_suggestions: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "environment": self.environment,
            "project_path": self.project_path,
            "timestamp": self.timestamp,
            "checks": [
                {
                    "name": c.name,
                    "category": c.category.value,
                    "status": c.status.value,
                    "message": c.message,
                    "details": c.details,
                    "suggestion": c.suggestion,
                    "fix_command": c.fix_command,
                    "duration_ms": c.duration_ms
                }
                for c in self.checks
            ],
            "summary": self.summary,
            "ai_suggestions": self.ai_suggestions
        }


class SanityChecker:
    """Comprehensive sanity checker for web application stacks"""
    
    def __init__(self, project_path: str, environment: str = "dev"):
        self.project_path = Path(project_path)
        self.environment = environment
        self.checks: List[CheckResult] = []
        
    async def run_all_checks(self) -> SanityReport:
        """Run all sanity checks and return a comprehensive report"""
        import time
        from datetime import datetime
        
        # Run all check categories
        await self._check_system()
        await self._check_node()
        await self._check_nginx()
        await self._check_react()
        await self._check_build()
        await self._check_config()
        await self._check_network()
        
        # Generate summary
        summary = {
            "total": len(self.checks),
            "pass": sum(1 for c in self.checks if c.status == CheckStatus.PASS),
            "warn": sum(1 for c in self.checks if c.status == CheckStatus.WARN),
            "fail": sum(1 for c in self.checks if c.status == CheckStatus.FAIL),
            "skip": sum(1 for c in self.checks if c.status == CheckStatus.SKIP),
        }
        
        # Generate AI suggestions based on failures
        ai_suggestions = self._generate_ai_suggestions()
        
        return SanityReport(
            environment=self.environment,
            project_path=str(self.project_path),
            timestamp=datetime.now().isoformat(),
            checks=self.checks,
            summary=summary,
            ai_suggestions=ai_suggestions
        )
    
    def _add_check(self, result: CheckResult):
        """Add a check result"""
        self.checks.append(result)
    
    async def _check_system(self):
        """System-level checks"""
        import time
        
        # Check disk space
        start = time.time()
        try:
            disk = psutil.disk_usage(str(self.project_path))
            free_gb = disk.free / (1024 ** 3)
            if free_gb < 1:
                self._add_check(CheckResult(
                    name="Disk Space",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.FAIL,
                    message=f"Low disk space: {free_gb:.1f}GB free",
                    suggestion="Free up disk space. Build processes require at least 1GB free.",
                    fix_command="# Clean npm cache: npm cache clean --force"
                ))
            elif free_gb < 5:
                self._add_check(CheckResult(
                    name="Disk Space",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.WARN,
                    message=f"Disk space warning: {free_gb:.1f}GB free",
                    suggestion="Consider freeing up disk space for optimal build performance."
                ))
            else:
                self._add_check(CheckResult(
                    name="Disk Space",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.PASS,
                    message=f"Disk space OK: {free_gb:.1f}GB free",
                    duration_ms=(time.time() - start) * 1000
                ))
        except Exception as e:
            self._add_check(CheckResult(
                name="Disk Space",
                category=CheckCategory.SYSTEM,
                status=CheckStatus.FAIL,
                message=f"Failed to check disk space: {str(e)}"
            ))
        
        # Check memory
        start = time.time()
        try:
            mem = psutil.virtual_memory()
            available_gb = mem.available / (1024 ** 3)
            if available_gb < 2:
                self._add_check(CheckResult(
                    name="Available Memory",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.FAIL,
                    message=f"Low memory: {available_gb:.1f}GB available",
                    suggestion="Close other applications or increase system memory. Build requires at least 2GB.",
                    fix_command="# Increase Node memory: export NODE_OPTIONS='--max-old-space-size=4096'"
                ))
            elif available_gb < 4:
                self._add_check(CheckResult(
                    name="Available Memory",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.WARN,
                    message=f"Memory warning: {available_gb:.1f}GB available",
                    suggestion="Consider closing other applications for optimal build performance."
                ))
            else:
                self._add_check(CheckResult(
                    name="Available Memory",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.PASS,
                    message=f"Memory OK: {available_gb:.1f}GB available",
                    duration_ms=(time.time() - start) * 1000
                ))
        except Exception as e:
            self._add_check(CheckResult(
                name="Available Memory",
                category=CheckCategory.SYSTEM,
                status=CheckStatus.FAIL,
                message=f"Failed to check memory: {str(e)}"
            ))
        
        # Check CPU load
        start = time.time()
        try:
            cpu_percent = psutil.cpu_percent(interval=0.5)
            if cpu_percent > 90:
                self._add_check(CheckResult(
                    name="CPU Load",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.WARN,
                    message=f"High CPU load: {cpu_percent}%",
                    suggestion="High CPU usage may slow down builds. Consider waiting or reducing parallel processes."
                ))
            else:
                self._add_check(CheckResult(
                    name="CPU Load",
                    category=CheckCategory.SYSTEM,
                    status=CheckStatus.PASS,
                    message=f"CPU load OK: {cpu_percent}%",
                    duration_ms=(time.time() - start) * 1000
                ))
        except Exception as e:
            self._add_check(CheckResult(
                name="CPU Load",
                category=CheckCategory.SYSTEM,
                status=CheckStatus.SKIP,
                message=f"Could not check CPU: {str(e)}"
            ))
    
    async def _check_node(self):
        """Node.js environment checks"""
        import time
        
        # Check Node.js version
        start = time.time()
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                version = result.stdout.strip()
                major = int(version.replace('v', '').split('.')[0])
                if major < 18:
                    self._add_check(CheckResult(
                        name="Node.js Version",
                        category=CheckCategory.NODE,
                        status=CheckStatus.WARN,
                        message=f"Node.js {version} - Consider upgrading",
                        suggestion="Node.js 18+ is recommended for best compatibility.",
                        fix_command="# Install Node 20: nvm install 20 && nvm use 20"
                    ))
                else:
                    self._add_check(CheckResult(
                        name="Node.js Version",
                        category=CheckCategory.NODE,
                        status=CheckStatus.PASS,
                        message=f"Node.js {version}",
                        duration_ms=(time.time() - start) * 1000
                    ))
            else:
                self._add_check(CheckResult(
                    name="Node.js Version",
                    category=CheckCategory.NODE,
                    status=CheckStatus.FAIL,
                    message="Node.js not found",
                    suggestion="Install Node.js from https://nodejs.org",
                    fix_command="# Install via nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
                ))
        except Exception as e:
            self._add_check(CheckResult(
                name="Node.js Version",
                category=CheckCategory.NODE,
                status=CheckStatus.FAIL,
                message=f"Failed to check Node.js: {str(e)}"
            ))
        
        # Check pnpm
        start = time.time()
        try:
            result = subprocess.run(
                ["pnpm", "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                self._add_check(CheckResult(
                    name="pnpm Version",
                    category=CheckCategory.NODE,
                    status=CheckStatus.PASS,
                    message=f"pnpm {result.stdout.strip()}",
                    duration_ms=(time.time() - start) * 1000
                ))
            else:
                self._add_check(CheckResult(
                    name="pnpm Version",
                    category=CheckCategory.NODE,
                    status=CheckStatus.WARN,
                    message="pnpm not found",
                    suggestion="Install pnpm for faster package management.",
                    fix_command="npm install -g pnpm"
                ))
        except Exception as e:
            self._add_check(CheckResult(
                name="pnpm Version",
                category=CheckCategory.NODE,
                status=CheckStatus.WARN,
                message=f"pnpm not available: {str(e)}",
                fix_command="npm install -g pnpm"
            ))
        
        # Check node_modules
        start = time.time()
        node_modules = self.project_path / "node_modules"
        if node_modules.exists():
            # Check for common issues
            package_lock = self.project_path / "pnpm-lock.yaml"
            npm_lock = self.project_path / "package-lock.json"
            
            if package_lock.exists() or npm_lock.exists():
                self._add_check(CheckResult(
                    name="Dependencies Installed",
                    category=CheckCategory.NODE,
                    status=CheckStatus.PASS,
                    message="node_modules exists with lock file",
                    duration_ms=(time.time() - start) * 1000
                ))
            else:
                self._add_check(CheckResult(
                    name="Dependencies Installed",
                    category=CheckCategory.NODE,
                    status=CheckStatus.WARN,
                    message="node_modules exists but no lock file found",
                    suggestion="Run 'pnpm install' to generate lock file for reproducible builds."
                ))
        else:
            self._add_check(CheckResult(
                name="Dependencies Installed",
                category=CheckCategory.NODE,
                status=CheckStatus.FAIL,
                message="node_modules not found",
                suggestion="Run 'pnpm install' to install dependencies.",
                fix_command="cd " + str(self.project_path) + " && pnpm install"
            ))
    
    async def _check_nginx(self):
        """Nginx configuration checks"""
        import time
        
        # Check if nginx is installed
        start = time.time()
        try:
            result = subprocess.run(
                ["nginx", "-v"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0 or "nginx version" in result.stderr:
                version = result.stderr.strip() if result.stderr else result.stdout.strip()
                self._add_check(CheckResult(
                    name="Nginx Installed",
                    category=CheckCategory.NGINX,
                    status=CheckStatus.PASS,
                    message=version,
                    duration_ms=(time.time() - start) * 1000
                ))
                
                # Test nginx config
                start = time.time()
                try:
                    test_result = subprocess.run(
                        ["nginx", "-t"],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    if test_result.returncode == 0:
                        self._add_check(CheckResult(
                            name="Nginx Config Valid",
                            category=CheckCategory.NGINX,
                            status=CheckStatus.PASS,
                            message="Configuration syntax is OK",
                            duration_ms=(time.time() - start) * 1000
                        ))
                    else:
                        error_msg = test_result.stderr or test_result.stdout
                        self._add_check(CheckResult(
                            name="Nginx Config Valid",
                            category=CheckCategory.NGINX,
                            status=CheckStatus.FAIL,
                            message="Configuration has errors",
                            details=error_msg,
                            suggestion="Fix nginx configuration syntax errors.",
                            fix_command="nginx -t  # Run to see detailed errors"
                        ))
                except Exception as e:
                    self._add_check(CheckResult(
                        name="Nginx Config Valid",
                        category=CheckCategory.NGINX,
                        status=CheckStatus.SKIP,
                        message=f"Could not test config: {str(e)}"
                    ))
                
                # Check if nginx is running
                start = time.time()
                nginx_running = False
                for proc in psutil.process_iter(['name']):
                    if 'nginx' in proc.info['name'].lower():
                        nginx_running = True
                        break
                
                if nginx_running:
                    self._add_check(CheckResult(
                        name="Nginx Running",
                        category=CheckCategory.NGINX,
                        status=CheckStatus.PASS,
                        message="Nginx process is running",
                        duration_ms=(time.time() - start) * 1000
                    ))
                else:
                    self._add_check(CheckResult(
                        name="Nginx Running",
                        category=CheckCategory.NGINX,
                        status=CheckStatus.WARN if self.environment == "dev" else CheckStatus.FAIL,
                        message="Nginx is not running",
                        suggestion="Start nginx for production deployments.",
                        fix_command="sudo systemctl start nginx  # or: sudo nginx"
                    ))
            else:
                self._add_check(CheckResult(
                    name="Nginx Installed",
                    category=CheckCategory.NGINX,
                    status=CheckStatus.SKIP if self.environment == "dev" else CheckStatus.WARN,
                    message="Nginx not installed",
                    suggestion="Install nginx for production reverse proxy.",
                    fix_command="sudo apt install nginx  # Ubuntu/Debian"
                ))
        except FileNotFoundError:
            self._add_check(CheckResult(
                name="Nginx Installed",
                category=CheckCategory.NGINX,
                status=CheckStatus.SKIP if self.environment == "dev" else CheckStatus.WARN,
                message="Nginx not found in PATH",
                suggestion="Install nginx for production deployments."
            ))
        except Exception as e:
            self._add_check(CheckResult(
                name="Nginx Installed",
                category=CheckCategory.NGINX,
                status=CheckStatus.SKIP,
                message=f"Could not check nginx: {str(e)}"
            ))
    
    async def _check_react(self):
        """React configuration checks"""
        import time
        
        # Check for React
        start = time.time()
        package_json = self.project_path / "package.json"
        has_react = False
        
        if package_json.exists():
            try:
                pkg = json.loads(package_json.read_text())
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                has_react = "react" in deps
                
                if has_react:
                    react_version = deps.get("react", "unknown")
                    self._add_check(CheckResult(
                        name="React Installed",
                        category=CheckCategory.REACT,
                        status=CheckStatus.PASS,
                        message=f"React {react_version}",
                        duration_ms=(time.time() - start) * 1000
                    ))
                    
                    # Check React version
                    if react_version.startswith("^16") or react_version.startswith("16"):
                        self._add_check(CheckResult(
                            name="React Version",
                            category=CheckCategory.REACT,
                            status=CheckStatus.WARN,
                            message="React 16 detected - consider upgrading",
                            suggestion="React 18+ offers better performance and features.",
                            fix_command="pnpm add react@latest react-dom@latest"
                        ))
                else:
                    self._add_check(CheckResult(
                        name="React Installed",
                        category=CheckCategory.REACT,
                        status=CheckStatus.SKIP,
                        message="React not in dependencies"
                    ))
            except Exception as e:
                self._add_check(CheckResult(
                    name="React Installed",
                    category=CheckCategory.REACT,
                    status=CheckStatus.SKIP,
                    message=f"Could not check: {str(e)}"
                ))
        
        if not has_react:
            return
        
        # Check for TypeScript
        start = time.time()
        tsconfig = self.project_path / "tsconfig.json"
        if tsconfig.exists():
            self._add_check(CheckResult(
                name="TypeScript Config",
                category=CheckCategory.REACT,
                status=CheckStatus.PASS,
                message="tsconfig.json found",
                duration_ms=(time.time() - start) * 1000
            ))
            
            # Analyze tsconfig
            try:
                config = json.loads(tsconfig.read_text())
                compiler_opts = config.get("compilerOptions", {})
                
                issues = []
                if not compiler_opts.get("strict"):
                    issues.append("strict mode not enabled")
                if not compiler_opts.get("noUnusedLocals"):
                    issues.append("noUnusedLocals not enabled")
                if compiler_opts.get("skipLibCheck") is not True:
                    issues.append("skipLibCheck not enabled (slower builds)")
                
                if issues:
                    self._add_check(CheckResult(
                        name="TypeScript Optimization",
                        category=CheckCategory.REACT,
                        status=CheckStatus.WARN,
                        message=f"{len(issues)} suggestions",
                        details="\n".join(f"• {i}" for i in issues)
                    ))
            except:
                pass
        
        # Check for src folder structure
        start = time.time()
        src_folder = self.project_path / "src"
        if src_folder.exists():
            # Check for common React files
            has_app = any((src_folder / f).exists() for f in ["App.tsx", "App.jsx", "App.js"])
            has_main = any((src_folder / f).exists() for f in ["main.tsx", "main.jsx", "index.tsx", "index.jsx"])
            
            if has_app and has_main:
                self._add_check(CheckResult(
                    name="React Project Structure",
                    category=CheckCategory.REACT,
                    status=CheckStatus.PASS,
                    message="Standard React structure detected",
                    duration_ms=(time.time() - start) * 1000
                ))
            else:
                self._add_check(CheckResult(
                    name="React Project Structure",
                    category=CheckCategory.REACT,
                    status=CheckStatus.WARN,
                    message="Non-standard project structure",
                    suggestion="Consider using standard React project structure with App.tsx and main.tsx"
                ))
    
    async def _check_build(self):
        """Build-related checks"""
        import time
        
        # Check for build scripts
        start = time.time()
        package_json = self.project_path / "package.json"
        
        if package_json.exists():
            try:
                pkg = json.loads(package_json.read_text())
                scripts = pkg.get("scripts", {})
                
                required_scripts = ["build", "dev"]
                optional_scripts = ["start", "preview", "lint", "test"]
                
                missing_required = [s for s in required_scripts if s not in scripts]
                missing_optional = [s for s in optional_scripts if s not in scripts]
                
                if missing_required:
                    self._add_check(CheckResult(
                        name="Build Scripts",
                        category=CheckCategory.BUILD,
                        status=CheckStatus.FAIL,
                        message=f"Missing required scripts: {', '.join(missing_required)}",
                        suggestion="Add build and dev scripts to package.json"
                    ))
                elif missing_optional:
                    self._add_check(CheckResult(
                        name="Build Scripts",
                        category=CheckCategory.BUILD,
                        status=CheckStatus.WARN,
                        message=f"Missing optional scripts: {', '.join(missing_optional)}",
                        suggestion="Consider adding lint and test scripts."
                    ))
                else:
                    self._add_check(CheckResult(
                        name="Build Scripts",
                        category=CheckCategory.BUILD,
                        status=CheckStatus.PASS,
                        message="All recommended scripts present",
                        duration_ms=(time.time() - start) * 1000
                    ))
                
                # Check build script content
                build_script = scripts.get("build", "")
                if build_script:
                    if "tsc" in build_script and "vite" in build_script:
                        self._add_check(CheckResult(
                            name="Build Script Analysis",
                            category=CheckCategory.BUILD,
                            status=CheckStatus.PASS,
                            message="TypeScript + Vite build detected"
                        ))
                    elif "next" in build_script:
                        self._add_check(CheckResult(
                            name="Build Script Analysis",
                            category=CheckCategory.BUILD,
                            status=CheckStatus.PASS,
                            message="Next.js build detected"
                        ))
            except Exception as e:
                self._add_check(CheckResult(
                    name="Build Scripts",
                    category=CheckCategory.BUILD,
                    status=CheckStatus.FAIL,
                    message=f"Could not parse package.json: {str(e)}"
                ))
        
        # Check for .next or dist folder (build output)
        start = time.time()
        next_folder = self.project_path / ".next"
        dist_folder = self.project_path / "dist"
        build_folder = self.project_path / "build"
        
        if next_folder.exists():
            try:
                build_id = (next_folder / "BUILD_ID").read_text().strip() if (next_folder / "BUILD_ID").exists() else "unknown"
                self._add_check(CheckResult(
                    name="Next.js Build",
                    category=CheckCategory.BUILD,
                    status=CheckStatus.PASS,
                    message=f".next/ exists (Build ID: {build_id[:8]}...)",
                    duration_ms=(time.time() - start) * 1000
                ))
            except:
                self._add_check(CheckResult(
                    name="Next.js Build",
                    category=CheckCategory.BUILD,
                    status=CheckStatus.PASS,
                    message=".next/ exists"
                ))
        elif dist_folder.exists() or build_folder.exists():
            folder = dist_folder if dist_folder.exists() else build_folder
            self._add_check(CheckResult(
                name="Build Output",
                category=CheckCategory.BUILD,
                status=CheckStatus.PASS,
                message=f"{folder.name}/ exists",
                duration_ms=(time.time() - start) * 1000
            ))
        else:
            self._add_check(CheckResult(
                name="Build Output",
                category=CheckCategory.BUILD,
                status=CheckStatus.SKIP if self.environment == "dev" else CheckStatus.WARN,
                message="No build output folder found",
                suggestion="Run 'pnpm build' to create production build.",
                fix_command="pnpm build"
            ))
    
    async def _check_config(self):
        """Configuration file checks"""
        import time
        
        # Check for .env files
        start = time.time()
        env_files = [
            ".env",
            ".env.local",
            ".env.development",
            ".env.production",
        ]
        
        found_env = []
        for ef in env_files:
            if (self.project_path / ef).exists():
                found_env.append(ef)
        
        if found_env:
            self._add_check(CheckResult(
                name="Environment Files",
                category=CheckCategory.CONFIG,
                status=CheckStatus.PASS,
                message=f"Found: {', '.join(found_env)}",
                duration_ms=(time.time() - start) * 1000
            ))
            
            # Check .env.example
            if not (self.project_path / ".env.example").exists():
                self._add_check(CheckResult(
                    name="Environment Example",
                    category=CheckCategory.CONFIG,
                    status=CheckStatus.WARN,
                    message="No .env.example found",
                    suggestion="Create .env.example for team documentation."
                ))
        else:
            self._add_check(CheckResult(
                name="Environment Files",
                category=CheckCategory.CONFIG,
                status=CheckStatus.WARN,
                message="No .env files found",
                suggestion="Create .env file for environment configuration."
            ))
        
        # Check for .gitignore
        start = time.time()
        gitignore = self.project_path / ".gitignore"
        if gitignore.exists():
            try:
                content = gitignore.read_text()
                issues = []
                
                if "node_modules" not in content:
                    issues.append("node_modules not in .gitignore")
                if ".env" not in content and ".env.local" not in content:
                    issues.append(".env files not in .gitignore (security risk!)")
                if ".next" not in content and "dist" not in content:
                    issues.append("Build output not in .gitignore")
                
                if issues:
                    self._add_check(CheckResult(
                        name="Gitignore Config",
                        category=CheckCategory.CONFIG,
                        status=CheckStatus.WARN if ".env" not in str(issues) else CheckStatus.FAIL,
                        message=f"{len(issues)} issues found",
                        details="\n".join(f"• {i}" for i in issues),
                        suggestion="Update .gitignore to exclude sensitive files."
                    ))
                else:
                    self._add_check(CheckResult(
                        name="Gitignore Config",
                        category=CheckCategory.CONFIG,
                        status=CheckStatus.PASS,
                        message=".gitignore properly configured",
                        duration_ms=(time.time() - start) * 1000
                    ))
            except:
                pass
        else:
            self._add_check(CheckResult(
                name="Gitignore Config",
                category=CheckCategory.CONFIG,
                status=CheckStatus.FAIL,
                message="No .gitignore found",
                suggestion="Create .gitignore to prevent committing sensitive files.",
                fix_command="npx gitignore node"
            ))
    
    async def _check_network(self):
        """Network and port checks"""
        import time
        
        # Check common development ports
        start = time.time()
        ports_to_check = {
            3000: "React/Next.js dev server",
            3001: "Alternative dev server",
            4000: "GraphQL/API server",
            5000: "Flask/Express server",
            5173: "Vite dev server",
            5174: "Vite alternative",
            8000: "Django/FastAPI server",
            8080: "Alternative HTTP server",
        }
        
        open_ports = []
        for port, description in ports_to_check.items():
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.3)
                result = sock.connect_ex(('localhost', port))
                sock.close()
                if result == 0:
                    open_ports.append(f"{port} ({description})")
            except:
                pass
        
        if open_ports:
            self._add_check(CheckResult(
                name="Active Ports",
                category=CheckCategory.NETWORK,
                status=CheckStatus.PASS,
                message=f"Found {len(open_ports)} active ports",
                details="\n".join(f"• {p}" for p in open_ports),
                duration_ms=(time.time() - start) * 1000
            ))
        else:
            self._add_check(CheckResult(
                name="Active Ports",
                category=CheckCategory.NETWORK,
                status=CheckStatus.SKIP,
                message="No development servers detected",
                suggestion="Start your dev server with 'pnpm dev'"
            ))
        
        # Check internet connectivity
        start = time.time()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex(('8.8.8.8', 53))
            sock.close()
            if result == 0:
                self._add_check(CheckResult(
                    name="Internet Connection",
                    category=CheckCategory.NETWORK,
                    status=CheckStatus.PASS,
                    message="Internet connectivity OK",
                    duration_ms=(time.time() - start) * 1000
                ))
            else:
                self._add_check(CheckResult(
                    name="Internet Connection",
                    category=CheckCategory.NETWORK,
                    status=CheckStatus.WARN,
                    message="Internet connectivity issues",
                    suggestion="Check your network connection for npm/pnpm operations."
                ))
        except:
            self._add_check(CheckResult(
                name="Internet Connection",
                category=CheckCategory.NETWORK,
                status=CheckStatus.WARN,
                message="Could not verify internet connection"
            ))
    
    def _generate_ai_suggestions(self) -> List[str]:
        """Generate AI-powered suggestions based on check results"""
        suggestions = []
        
        # Analyze failures and warnings
        failures = [c for c in self.checks if c.status == CheckStatus.FAIL]
        warnings = [c for c in self.checks if c.status == CheckStatus.WARN]
        
        # Priority suggestions based on failures
        if any(c.category == CheckCategory.NODE and "node_modules" in c.message.lower() for c in failures):
            suggestions.append("🚨 CRITICAL: Run 'pnpm install' to install dependencies before any other action.")
        
        if any(c.category == CheckCategory.SYSTEM and "memory" in c.name.lower() for c in failures):
            suggestions.append("💾 MEMORY: Close other applications or use 'NODE_OPTIONS=--max-old-space-size=4096' for builds.")
        
        if any(c.category == CheckCategory.SYSTEM and "disk" in c.name.lower() for c in failures):
            suggestions.append("💿 DISK: Free up space by running 'pnpm store prune' and clearing .next/cache.")
        
        # Build suggestions
        build_issues = [c for c in self.checks if c.category == CheckCategory.BUILD and c.status in [CheckStatus.FAIL, CheckStatus.WARN]]
        if build_issues:
            suggestions.append("🔨 BUILD: Review your build configuration. Consider running 'pnpm build' with verbose logging.")
        
        # Security suggestions
        config_issues = [c for c in self.checks if c.category == CheckCategory.CONFIG and c.status == CheckStatus.FAIL]
        if any(".env" in c.message.lower() or "gitignore" in c.name.lower() for c in config_issues):
            suggestions.append("🔒 SECURITY: Ensure .env files are in .gitignore and never committed to version control.")
        
        # Performance suggestions
        if self.environment == "prod":
            if not any(c.category == CheckCategory.NGINX and c.status == CheckStatus.PASS for c in self.checks):
                suggestions.append("⚡ PERFORMANCE: Set up Nginx as a reverse proxy for better production performance.")
            
            if any(c.category == CheckCategory.EXPRESS and "compression" in str(c.details or "").lower() for c in warnings):
                suggestions.append("⚡ PERFORMANCE: Add compression middleware to Express for smaller response sizes.")
        
        # Development suggestions
        if self.environment == "dev":
            if not any(c.name == "Active Ports" and c.status == CheckStatus.PASS for c in self.checks):
                suggestions.append("🚀 DEV: Start your development server with 'pnpm dev' to begin coding.")
        
        # TypeScript suggestions
        ts_issues = [c for c in self.checks if "typescript" in c.name.lower() and c.status == CheckStatus.WARN]
        if ts_issues:
            suggestions.append("📝 TYPESCRIPT: Enable strict mode in tsconfig.json for better type safety.")
        
        # General health
        pass_rate = sum(1 for c in self.checks if c.status == CheckStatus.PASS) / max(len(self.checks), 1)
        if pass_rate >= 0.9:
            suggestions.append("✅ EXCELLENT: Your project is well configured! Ready for development/deployment.")
        elif pass_rate >= 0.7:
            suggestions.append("👍 GOOD: Most checks passed. Address warnings for optimal setup.")
        elif pass_rate >= 0.5:
            suggestions.append("⚠️ ATTENTION: Several issues detected. Review and fix before proceeding.")
        else:
            suggestions.append("❌ ACTION REQUIRED: Multiple critical issues. Fix failures before building.")
        
        return suggestions


async def run_sanity_check(project_path: str, environment: str = "dev") -> SanityReport:
    """Run sanity checks and return report"""
    checker = SanityChecker(project_path, environment)
    return await checker.run_all_checks()
