#!/usr/bin/env python3
"""
TrafikApp API endpoints for BuildMaster
Integrates TrafikApp management into BuildMaster API
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging
from trafikapp_manager import TrafikAppManager, ProjectStatus

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/trafikapp", tags=["trafikapp"])

# Initialize manager
manager = TrafikAppManager()

# Pydantic models
class ProjectResponse(BaseModel):
    name: str
    path: str
    repo_url: str
    branch: str
    domain: str
    status: str
    last_sync: Optional[float] = None
    last_build: Optional[float] = None
    health_url: Optional[str] = None

class PipelineRequest(BaseModel):
    project: str
    sync: bool = True
    build: bool = True
    deploy: bool = True

class PipelineResponse(BaseModel):
    success: bool
    message: str
    project: str
    status: str

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects():
    """List all configured projects"""
    try:
        projects = manager.list_projects()
        return [
            ProjectResponse(
                name=proj.name,
                path=proj.path,
                repo_url=proj.repo_url,
                branch=proj.branch,
                domain=proj.domain,
                status=proj.status.value,
                last_sync=proj.last_sync,
                last_build=proj.last_build,
                health_url=proj.health_url
            )
            for proj in projects.values()
        ]
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}", response_model=ProjectResponse)
async def get_project(project_name: str):
    """Get project status"""
    try:
        project = manager.get_project_status(project_name)
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_name} not found")
        
        return ProjectResponse(
            name=project.name,
            path=project.path,
            repo_url=project.repo_url,
            branch=project.branch,
            domain=project.domain,
            status=project.status.value,
            last_sync=project.last_sync,
            last_build=project.last_build,
            health_url=project.health_url
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/sync")
async def sync_project(project_name: str, background_tasks: BackgroundTasks):
    """Sync project with Git repository"""
    try:
        # Run sync in background
        background_tasks.add_task(manager.sync_project, project_name)
        return {"message": f"Sync started for {project_name}", "project": project_name}
    except Exception as e:
        logger.error(f"Failed to start sync for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/build")
async def build_project(project_name: str, background_tasks: BackgroundTasks):
    """Build project"""
    try:
        background_tasks.add_task(manager.build_project, project_name)
        return {"message": f"Build started for {project_name}", "project": project_name}
    except Exception as e:
        logger.error(f"Failed to start build for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/projects/{project_name}/deploy")
async def deploy_project(project_name: str, background_tasks: BackgroundTasks):
    """Deploy project"""
    try:
        background_tasks.add_task(manager.deploy_project, project_name)
        return {"message": f"Deployment started for {project_name}", "project": project_name}
    except Exception as e:
        logger.error(f"Failed to start deployment for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pipeline", response_model=PipelineResponse)
async def run_pipeline(request: PipelineRequest, background_tasks: BackgroundTasks):
    """Run complete sync-build-deploy pipeline"""
    try:
        # Run pipeline in background
        background_tasks.add_task(manager.sync_build_deploy, request.project)
        
        return PipelineResponse(
            success=True,
            message=f"Pipeline started for {request.project}",
            project=request.project,
            status="running"
        )
    except Exception as e:
        logger.error(f"Failed to start pipeline for {request.project}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-all")
async def sync_all_projects(background_tasks: BackgroundTasks):
    """Sync all projects"""
    try:
        background_tasks.add_task(manager.sync_all_projects)
        return {"message": "Sync started for all projects"}
    except Exception as e:
        logger.error(f"Failed to start sync for all projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/build-all")
async def build_all_projects(background_tasks: BackgroundTasks):
    """Build all projects"""
    try:
        background_tasks.add_task(manager.build_all_projects)
        return {"message": "Build started for all projects"}
    except Exception as e:
        logger.error(f"Failed to start build for all projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deploy-all")
async def deploy_all_projects(background_tasks: BackgroundTasks):
    """Deploy all projects"""
    try:
        background_tasks.add_task(manager.deploy_all_projects)
        return {"message": "Deployment started for all projects"}
    except Exception as e:
        logger.error(f"Failed to start deployment for all projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_name}/health")
async def check_project_health(project_name: str):
    """Check project health"""
    try:
        healthy = manager.check_project_health(project_name)
        return {
            "project": project_name,
            "healthy": healthy,
            "message": "Healthy" if healthy else "Unhealthy"
        }
    except Exception as e:
        logger.error(f"Failed to check health for {project_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health-all")
async def check_all_projects_health():
    """Check health of all projects"""
    try:
        projects = manager.list_projects()
        results = {}
        for name, project in projects.items():
            results[name] = {
                "healthy": manager.check_project_health(name),
                "domain": project.domain,
                "status": project.status.value
            }
        return results
    except Exception as e:
        logger.error(f"Failed to check health for all projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add router to main app
def register_app(app):
    """Register TrafikApp routes with FastAPI app"""
    app.include_router(router)
    logger.info("TrafikApp routes registered")
