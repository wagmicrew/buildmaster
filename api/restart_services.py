#!/usr/bin/env python3
"""
Service restart script for Python API
Can be called from build system or manually
"""

import sys
import os
import json
import time
import logging
from pathlib import Path
from service_manager import ServiceManager

def setup_logging():
    """Setup logging for restart operations"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('service_restart.log'),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)

def main():
    """Main restart function"""
    logger = setup_logging()
    
    # Parse command line arguments
    service_name = None
    if len(sys.argv) > 1:
        service_name = sys.argv[1]
    
    config_file = "service_config.json"
    if len(sys.argv) > 2:
        config_file = sys.argv[2]
    
    logger.info(f"Starting service restart process...")
    
    # Initialize service manager
    try:
        manager = ServiceManager(config_file)
    except Exception as e:
        logger.error(f"Failed to initialize service manager: {e}")
        sys.exit(1)
    
    # Restart services
    if service_name:
        logger.info(f"Restarting service: {service_name}")
        success = manager.restart_service(service_name)
        if success:
            logger.info(f"Service {service_name} restarted successfully")
        else:
            logger.error(f"Failed to restart service {service_name}")
            sys.exit(1)
    else:
        logger.info("Restarting all services...")
        results = manager.restart_all_services()
        
        for service, success in results.items():
            status = "SUCCESS" if success else "FAILED"
            logger.info(f"Service {service}: {status}")
        
        if not all(results.values()):
            logger.error("Some services failed to restart")
            sys.exit(1)
    
    # Health check after restart
    logger.info("Performing health checks...")
    time.sleep(2)  # Give services time to start
    
    health_results = manager.health_check_all()
    all_healthy = True
    
    for service, healthy in health_results.items():
        status = "HEALTHY" if healthy else "UNHEALTHY"
        logger.info(f"Service {service}: {status}")
        if not healthy:
            all_healthy = False
    
    if all_healthy:
        logger.info("All services are healthy!")
    else:
        logger.warning("Some services are not healthy")
        sys.exit(1)

if __name__ == "__main__":
    main()
