#!/usr/bin/env python3
"""
TrafikApp Manager for BuildMaster
Handles Git sync, build, and deployment for TrafikApp project
"""

import os
import sys
import json
import time
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class ProjectStatus(Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    BUILDING = "building"
    DEPLOYING = "deploying"
    ERROR = "error"
    SUCCESS = "success"

@dataclass
class ProjectInfo:
    name: str
    path: str
    repo_url: str
    branch: str
    domain: str
    status: ProjectStatus = ProjectStatus.IDLE
    last_sync: Optional[float] = None
    last_build: Optional[float] = None
    build_command: str = "npm run build"
    deploy_command: str = "systemctl reload nginx"
    health_url: Optional[str] = None

class TrafikAppManager:
    def __init__(self, config_file: str = "trafikapp_config.json"):
        self.config_file = Path(config_file)
        self.projects: Dict[str, ProjectInfo] = {}
        self.logger = self._setup_logger()
        self.load_config()
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger("trafikapp_manager")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def load_config(self):
        """Load project configuration from file"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    for name, data in config.items():
                        self.projects[name] = ProjectInfo(
                            name=name,
                            path=data['path'],
                            repo_url=data['repo_url'],
                            branch=data.get('branch', 'main'),
                            domain=data['domain'],
                            build_command=data.get('build_command', 'npm run build'),
                            deploy_command=data.get('deploy_command', 'systemctl reload nginx'),
                            health_url=data.get('health_url')
                        )
                self.logger.info(f"Loaded {len(self.projects)} project configurations")
            except Exception as e:
                self.logger.error(f"Failed to load config: {e}")
        else:
            # Create default config
            self._create_default_config()
    
    def _create_default_config(self):
        """Create default project configuration"""
        default_config = {
            "dintrafikskola_dev": {
                "path": "/var/www/dintrafikskolax_dev",
                "repo_url": "https://github.com/your-org/dintrafikskola.git",
                "branch": "develop",
                "domain": "dev.dintrafikskolahlm.se",
                "build_command": "npm run build:dev",
                "deploy_command": "systemctl reload nginx",
                "health_url": "https://dev.dintrafikskolahlm.se/health"
            },
            "dintrafikskola_prod": {
                "path": "/var/www/dintrafikskolax_prod",
                "repo_url": "https://github.com/your-org/dintrafikskola.git",
                "branch": "main",
                "domain": "dintrafikskolahlm.se",
                "build_command": "npm run build:prod",
                "deploy_command": "systemctl reload nginx",
                "health_url": "https://dintrafikskolahlm.se/health"
            },
            "trafikapp": {
                "path": "/var/www/trafikapp",
                "repo_url": "https://github.com/your-org/trafikapp.git",
                "branch": "main",
                "domain": "app.dintrafikskolahlm.se",
                "build_command": "npm run build",
                "deploy_command": "systemctl reload nginx",
                "health_url": "https://app.dintrafikskolahlm.se/health"
            }
        }
        
        with open(self.config_file, 'w') as f:
            json.dump(default_config, f, indent=2)
            
        self.logger.info("Created default project configuration")
        self.load_config()
    
    def run_command(self, cmd: List[str], cwd: Optional[str] = None, timeout: int = 300) -> Tuple[bool, str, str]:
        """Run command with timeout and return success, stdout, stderr"""
        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            return result.returncode == 0, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out"
        except Exception as e:
            return False, "", str(e)
    
    def sync_project(self, project_name: str) -> bool:
        """Sync project with Git repository"""
        if project_name not in self.projects:
            self.logger.error(f"Project {project_name} not found")
            return False
            
        project = self.projects[project_name]
        project.status = ProjectStatus.SYNCING
        
        self.logger.info(f"Syncing {project_name} from {project.repo_url}")
        
        try:
            project_path = Path(project.path)
            
            # Clone if doesn't exist
            if not project_path.exists():
                self.logger.info(f"Cloning {project_name} to {project.path}")
                success, stdout, stderr = self.run_command([
                    'git', 'clone', project.repo_url, project.path
                ])
                if not success:
                    project.status = ProjectStatus.ERROR
                    self.logger.error(f"Failed to clone {project_name}: {stderr}")
                    return False
            
            # Pull latest changes
            success, stdout, stderr = self.run_command([
                'git', 'pull', 'origin', project.branch
            ], cwd=project.path)
            
            if not success:
                project.status = ProjectStatus.ERROR
                self.logger.error(f"Failed to pull {project_name}: {stderr}")
                return False
            
            project.last_sync = time.time()
            project.status = ProjectStatus.SUCCESS
            self.logger.info(f"Successfully synced {project_name}")
            return True
            
        except Exception as e:
            project.status = ProjectStatus.ERROR
            self.logger.error(f"Error syncing {project_name}: {e}")
            return False
    
    def build_project(self, project_name: str) -> bool:
        """Build project"""
        if project_name not in self.projects:
            self.logger.error(f"Project {project_name} not found")
            return False
            
        project = self.projects[project_name]
        project.status = ProjectStatus.BUILDING
        
        self.logger.info(f"Building {project_name}")
        
        try:
            project_path = Path(project.path)
            
            # Install dependencies
            self.logger.info(f"Installing dependencies for {project_name}")
            success, stdout, stderr = self.run_command([
                'npm', 'install'
            ], cwd=project_path)
            
            if not success:
                project.status = ProjectStatus.ERROR
                self.logger.error(f"Failed to install dependencies for {project_name}: {stderr}")
                return False
            
            # Build project
            self.logger.info(f"Running build command for {project_name}: {project.build_command}")
            build_cmd = project.build_command.split()
            success, stdout, stderr = self.run_command(build_cmd, cwd=project_path)
            
            if not success:
                project.status = ProjectStatus.ERROR
                self.logger.error(f"Failed to build {project_name}: {stderr}")
                return False
            
            project.last_build = time.time()
            project.status = ProjectStatus.SUCCESS
            self.logger.info(f"Successfully built {project_name}")
            return True
            
        except Exception as e:
            project.status = ProjectStatus.ERROR
            self.logger.error(f"Error building {project_name}: {e}")
            return False
    
    def deploy_project(self, project_name: str) -> bool:
        """Deploy project"""
        if project_name not in self.projects:
            self.logger.error(f"Project {project_name} not found")
            return False
            
        project = self.projects[project_name]
        project.status = ProjectStatus.DEPLOYING
        
        self.logger.info(f"Deploying {project_name}")
        
        try:
            # Run deploy command
            deploy_cmd = project.deploy_command.split()
            success, stdout, stderr = self.run_command(deploy_cmd)
            
            if not success:
                project.status = ProjectStatus.ERROR
                self.logger.error(f"Failed to deploy {project_name}: {stderr}")
                return False
            
            project.status = ProjectStatus.SUCCESS
            self.logger.info(f"Successfully deployed {project_name}")
            return True
            
        except Exception as e:
            project.status = ProjectStatus.ERROR
            self.logger.error(f"Error deploying {project_name}: {e}")
            return False
    
    def check_project_health(self, project_name: str) -> bool:
        """Check if project is healthy"""
        if project_name not in self.projects:
            return False
            
        project = self.projects[project_name]
        
        if not project.health_url:
            return True  # Skip health check if no URL configured
            
        try:
            import requests
            response = requests.get(project.health_url, timeout=10)
            return response.status_code == 200
        except Exception as e:
            self.logger.warning(f"Health check failed for {project_name}: {e}")
            return False
    
    def sync_build_deploy(self, project_name: str) -> bool:
        """Complete sync, build, and deploy pipeline"""
        self.logger.info(f"Starting complete pipeline for {project_name}")
        
        # Sync
        if not self.sync_project(project_name):
            return False
        
        # Build
        if not self.build_project(project_name):
            return False
        
        # Deploy
        if not self.deploy_project(project_name):
            return False
        
        # Health check
        time.sleep(5)  # Give deployment time to start
        if self.check_project_health(project_name):
            self.logger.info(f"Pipeline completed successfully for {project_name}")
            return True
        else:
            self.logger.warning(f"Pipeline completed but health check failed for {project_name}")
            return False
    
    def get_project_status(self, project_name: str) -> Optional[ProjectInfo]:
        """Get current status of a project"""
        if project_name in self.projects:
            self.check_project_health(project_name)
            return self.projects[project_name]
        return None
    
    def list_projects(self) -> Dict[str, ProjectInfo]:
        """List all projects and their status"""
        return self.projects
    
    def sync_all_projects(self) -> Dict[str, bool]:
        """Sync all configured projects"""
        results = {}
        for project_name in self.projects:
            results[project_name] = self.sync_project(project_name)
        return results
    
    def build_all_projects(self) -> Dict[str, bool]:
        """Build all configured projects"""
        results = {}
        for project_name in self.projects:
            results[project_name] = self.build_project(project_name)
        return results
    
    def deploy_all_projects(self) -> Dict[str, bool]:
        """Deploy all configured projects"""
        results = {}
        for project_name in self.projects:
            results[project_name] = self.deploy_project(project_name)
        return results

# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="TrafikApp Manager for BuildMaster")
    parser.add_argument("action", choices=[
        "sync", "build", "deploy", "pipeline", "status", "health", 
        "sync-all", "build-all", "deploy-all"
    ])
    parser.add_argument("--project", help="Project name")
    parser.add_argument("--config", default="trafikapp_config.json", help="Config file path")
    
    args = parser.parse_args()
    
    manager = TrafikAppManager(args.config)
    
    if args.action in ["sync", "build", "deploy", "pipeline", "status", "health"]:
        if not args.project:
            print(f"Error: --project required for {args.action} action")
            sys.exit(1)
        
        if args.action == "sync":
            success = manager.sync_project(args.project)
        elif args.action == "build":
            success = manager.build_project(args.project)
        elif args.action == "deploy":
            success = manager.deploy_project(args.project)
        elif args.action == "pipeline":
            success = manager.sync_build_deploy(args.project)
        elif args.action == "status":
            project = manager.get_project_status(args.project)
            if project:
                print(f"{project.name}: {project.status.value}")
                print(f"Path: {project.path}")
                print(f"Domain: {project.domain}")
                print(f"Last sync: {project.last_sync}")
                print(f"Last build: {project.last_build}")
            success = project is not None
        elif args.action == "health":
            healthy = manager.check_project_health(args.project)
            print(f"{args.project}: {'HEALTHY' if healthy else 'UNHEALTHY'}")
            success = healthy
        
        sys.exit(0 if success else 1)
    
    elif args.action in ["sync-all", "build-all", "deploy-all"]:
        if args.action == "sync-all":
            results = manager.sync_all_projects()
        elif args.action == "build-all":
            results = manager.build_all_projects()
        elif args.action == "deploy-all":
            results = manager.deploy_all_projects()
        
        for project, success in results.items():
            print(f"{project}: {'SUCCESS' if success else 'FAILED'}")
        
        sys.exit(0 if all(results.values()) else 1)
