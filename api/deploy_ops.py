"""Deployment operations for Go Live"""
import subprocess
import shutil
import os
from datetime import datetime
from pathlib import Path
from typing import Optional
from config import settings
from models import DeployGoLiveRequest, DeployGoLiveResponse
from pm2_ops import restart_pm2_app


async def deploy_to_production(request: DeployGoLiveRequest) -> DeployGoLiveResponse:
    """
    Deploy build to production (Go Live)
    
    This function:
    1. Copies .next directory from dev to prod
    2. Copies other necessary files
    3. Restarts production PM2 process
    
    Args:
        request: Deploy request with optional build_id
        
    Returns:
        DeployGoLiveResponse with deployment result
    """
    dev_dir = Path(settings.DEV_DIR)
    prod_dir = Path(settings.PROD_DIR)
    
    if not dev_dir.exists():
        return DeployGoLiveResponse(
            success=False,
            message=f"Dev directory not found: {dev_dir}",
            deployed_at=datetime.utcnow()
        )
    
    if not prod_dir.exists():
        return DeployGoLiveResponse(
            success=False,
            message=f"Prod directory not found: {prod_dir}",
            deployed_at=datetime.utcnow()
        )
    
    # Check if .next directory exists in dev
    dev_next = dev_dir / ".next"
    if not dev_next.exists():
        return DeployGoLiveResponse(
            success=False,
            message="No build found in dev directory (.next not found)",
            deployed_at=datetime.utcnow()
        )
    
    try:
        # Create backup if requested
        if not request.skip_backup:
            backup_dir = prod_dir / f".next.backup.{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            prod_next = prod_dir / ".next"
            if prod_next.exists():
                shutil.copytree(prod_next, backup_dir)
        
        # Remove existing .next in prod
        prod_next = prod_dir / ".next"
        if prod_next.exists():
            shutil.rmtree(prod_next)
        
        # Copy .next from dev to prod
        shutil.copytree(dev_next, prod_next)
        
        # Copy package.json and other essential files if they differ
        essential_files = ["package.json", "package-lock.json", "pnpm-lock.yaml"]
        for file_name in essential_files:
            dev_file = dev_dir / file_name
            prod_file = prod_dir / file_name
            if dev_file.exists() and dev_file.is_file():
                shutil.copy2(dev_file, prod_file)
        
        # Copy public directory if it exists
        dev_public = dev_dir / "public"
        prod_public = prod_dir / "public"
        if dev_public.exists() and dev_public.is_dir():
            if prod_public.exists():
                shutil.rmtree(prod_public)
            shutil.copytree(dev_public, prod_public)
        
        # Copy Prisma schema and run migrations on prod database
        prisma_schema = dev_dir / "prisma" / "schema.prisma"
        if prisma_schema.exists():
            prod_prisma_dir = prod_dir / "prisma"
            prod_prisma_dir.mkdir(exist_ok=True)
            shutil.copy2(prisma_schema, prod_prisma_dir / "schema.prisma")
            
            # Copy migration files
            dev_migrations = dev_dir / "prisma" / "migrations"
            if dev_migrations.exists():
                prod_migrations = prod_dir / "prisma" / "migrations"
                if prod_migrations.exists():
                    shutil.rmtree(prod_migrations)
                shutil.copytree(dev_migrations, prod_migrations)
            
            # Run prisma migrate deploy on production
            migrate_result = subprocess.run(
                ["npx", "prisma", "migrate", "deploy"],
                cwd=str(prod_dir),
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if migrate_result.returncode != 0:
                # Log but don't fail - migrations might already be applied
                print(f"Prisma migrate warning: {migrate_result.stderr}")
        
        # Restart production PM2 process
        pm2_result = await restart_pm2_app(settings.PM2_PROD_APP)
        
        if not pm2_result.success:
            return DeployGoLiveResponse(
                success=False,
                message=f"Deployment copied but PM2 restart failed: {pm2_result.message}",
                build_id=request.build_id,
                deployed_at=datetime.utcnow()
            )
        
        return DeployGoLiveResponse(
            success=True,
            message="Successfully deployed to production",
            build_id=request.build_id,
            deployed_at=datetime.utcnow()
        )
        
    except Exception as e:
        return DeployGoLiveResponse(
            success=False,
            message=f"Deployment failed: {str(e)}",
            build_id=request.build_id,
            deployed_at=datetime.utcnow()
        )

