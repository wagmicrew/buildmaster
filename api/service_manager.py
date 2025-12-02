#!/usr/bin/env python3
"""
Python API Service Manager
Handles service restart, health checks, and process management
"""

import os
import sys
import json
import time
import signal
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class ServiceStatus(Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    RESTARTING = "restarting"

@dataclass
class ServiceInfo:
    name: str
    pid: Optional[int] = None
    status: ServiceStatus = ServiceStatus.STOPPED
    port: Optional[int] = None
    restart_count: int = 0
    last_restart: Optional[float] = None
    health_check_url: Optional[str] = None

class ServiceManager:
    def __init__(self, config_file: str = "service_config.json"):
        self.config_file = Path(config_file)
        self.services: Dict[str, ServiceInfo] = {}
        self.logger = self._setup_logger()
        self.load_config()
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logging configuration"""
        logger = logging.getLogger("service_manager")
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
        """Load service configuration from file"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    for name, data in config.items():
                        self.services[name] = ServiceInfo(
                            name=name,
                            port=data.get('port'),
                            health_check_url=data.get('health_check_url')
                        )
                self.logger.info(f"Loaded {len(self.services)} service configurations")
            except Exception as e:
                self.logger.error(f"Failed to load config: {e}")
        else:
            # Create default config
            self._create_default_config()
    
    def _create_default_config(self):
        """Create default service configuration"""
        default_config = {
            "api": {
                "port": 8889,
                "health_check_url": "http://localhost:8889/health",
                "command": "python main.py",
                "working_directory": str(Path(__file__).parent),
                "env_file": ".env.production"
            }
        }
        
        with open(self.config_file, 'w') as f:
            json.dump(default_config, f, indent=2)
            
        self.logger.info("Created default service configuration")
        self.load_config()
    
    def start_service(self, service_name: str) -> bool:
        """Start a service"""
        if service_name not in self.services:
            self.logger.error(f"Service {service_name} not found")
            return False
            
        service = self.services[service_name]
        
        if service.status == ServiceStatus.RUNNING:
            self.logger.info(f"Service {service_name} already running")
            return True
            
        try:
            # Load service config
            with open(self.config_file, 'r') as f:
                config = json.load(f)
                service_config = config[service_name]
            
            # Prepare environment
            env = os.environ.copy()
            if service_config.get('env_file'):
                env_file = Path(service_config['env_file'])
                if env_file.exists():
                    with open(env_file, 'r') as f:
                        for line in f:
                            line = line.strip()
                            if line and '=' in line and not line.startswith('#'):
                                key, value = line.split('=', 1)
                                env[key] = value
            
            # Start the process
            cmd = service_config['command'].split()
            cwd = Path(service_config['working_directory'])
            
            process = subprocess.Popen(
                cmd,
                cwd=cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid
            )
            
            service.pid = process.pid
            service.status = ServiceStatus.RUNNING
            
            self.logger.info(f"Started service {service_name} with PID {process.pid}")
            return True
            
        except Exception as e:
            service.status = ServiceStatus.ERROR
            self.logger.error(f"Failed to start service {service_name}: {e}")
            return False
    
    def stop_service(self, service_name: str) -> bool:
        """Stop a service"""
        if service_name not in self.services:
            self.logger.error(f"Service {service_name} not found")
            return False
            
        service = self.services[service_name]
        
        if service.status != ServiceStatus.RUNNING or not service.pid:
            self.logger.info(f"Service {service_name} not running")
            return True
            
        try:
            # Send SIGTERM to process group
            os.killpg(os.getpgid(service.pid), signal.SIGTERM)
            
            # Wait for process to stop
            time.sleep(2)
            
            # Force kill if still running
            try:
                os.killpg(os.getpgid(service.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass  # Process already dead
            
            service.pid = None
            service.status = ServiceStatus.STOPPED
            
            self.logger.info(f"Stopped service {service_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to stop service {service_name}: {e}")
            return False
    
    def restart_service(self, service_name: str) -> bool:
        """Restart a service"""
        if service_name not in self.services:
            self.logger.error(f"Service {service_name} not found")
            return False
            
        service = self.services[service_name]
        service.status = ServiceStatus.RESTARTING
        service.restart_count += 1
        service.last_restart = time.time()
        
        self.logger.info(f"Restarting service {service_name}")
        
        # Stop and start
        if self.stop_service(service_name):
            time.sleep(1)
            return self.start_service(service_name)
        
        return False
    
    def check_service_health(self, service_name: str) -> bool:
        """Check if a service is healthy"""
        if service_name not in self.services:
            return False
            
        service = self.services[service_name]
        
        # Check if process is running
        if service.pid:
            try:
                os.kill(service.pid, 0)
            except ProcessLookupError:
                service.status = ServiceStatus.STOPPED
                service.pid = None
                return False
        
        # Check health endpoint if configured
        if service.health_check_url:
            try:
                import requests
                response = requests.get(service.health_check_url, timeout=5)
                if response.status_code == 200:
                    service.status = ServiceStatus.RUNNING
                    return True
                else:
                    service.status = ServiceStatus.ERROR
                    return False
            except Exception as e:
                self.logger.warning(f"Health check failed for {service_name}: {e}")
                service.status = ServiceStatus.ERROR
                return False
        
        return service.status == ServiceStatus.RUNNING
    
    def get_service_status(self, service_name: str) -> Optional[ServiceInfo]:
        """Get current status of a service"""
        if service_name in self.services:
            self.check_service_health(service_name)
            return self.services[service_name]
        return None
    
    def list_services(self) -> Dict[str, ServiceInfo]:
        """List all services and their status"""
        for name in self.services:
            self.check_service_health(name)
        return self.services
    
    def restart_all_services(self) -> Dict[str, bool]:
        """Restart all configured services"""
        results = {}
        for service_name in self.services:
            results[service_name] = self.restart_service(service_name)
        return results
    
    def health_check_all(self) -> Dict[str, bool]:
        """Health check all services"""
        results = {}
        for service_name in self.services:
            results[service_name] = self.check_service_health(service_name)
        return results

# CLI interface
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Python API Service Manager")
    parser.add_argument("action", choices=["start", "stop", "restart", "status", "health"])
    parser.add_argument("--service", help="Service name (optional for status/health)")
    parser.add_argument("--config", default="service_config.json", help="Config file path")
    
    args = parser.parse_args()
    
    manager = ServiceManager(args.config)
    
    if args.action == "start":
        if args.service:
            success = manager.start_service(args.service)
            sys.exit(0 if success else 1)
        else:
            print("Error: --service required for start action")
            sys.exit(1)
    
    elif args.action == "stop":
        if args.service:
            success = manager.stop_service(args.service)
            sys.exit(0 if success else 1)
        else:
            print("Error: --service required for stop action")
            sys.exit(1)
    
    elif args.action == "restart":
        if args.service:
            success = manager.restart_service(args.service)
            sys.exit(0 if success else 1)
        else:
            results = manager.restart_all_services()
            for service, success in results.items():
                print(f"{service}: {'OK' if success else 'FAILED'}")
            sys.exit(0 if all(results.values()) else 1)
    
    elif args.action == "status":
        services = manager.list_services()
        for name, service in services.items():
            print(f"{name}: {service.status.value} (PID: {service.pid})")
    
    elif args.action == "health":
        results = manager.health_check_all()
        for service, healthy in results.items():
            print(f"{service}: {'HEALTHY' if healthy else 'UNHEALTHY'}")
        sys.exit(0 if all(results.values()) else 1)
