"""System metrics and worker monitoring"""
import psutil
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from config import settings


class WorkerTracker:
    """Track build workers and their jobs"""
    
    def __init__(self):
        self.workers: Dict[str, Dict] = {}
        self.stalled_threshold = timedelta(minutes=5)  # Consider stalled after 5 minutes
    
    def update_worker(self, worker_id: str, job_name: str, status: str = "running"):
        """Update worker status"""
        self.workers[worker_id] = {
            "job_name": job_name,
            "status": status,
            "last_updated": datetime.utcnow(),
            "start_time": self.workers.get(worker_id, {}).get("start_time", datetime.utcnow())
        }
    
    def get_stalled_workers(self) -> List[str]:
        """Get list of stalled worker IDs"""
        now = datetime.utcnow()
        stalled = []
        
        for worker_id, worker_data in self.workers.items():
            if worker_data["status"] == "running":
                if now - worker_data["last_updated"] > self.stalled_threshold:
                    stalled.append(worker_id)
        
        return stalled
    
    def remove_worker(self, worker_id: str):
        """Remove worker from tracking"""
        self.workers.pop(worker_id, None)
    
    def clear_all_workers(self):
        """Clear all workers from tracking - called when new build starts"""
        self.workers.clear()
    
    def get_all_workers(self) -> List[Dict]:
        """Get all workers with their status"""
        now = datetime.utcnow()
        result = []
        
        for worker_id, worker_data in self.workers.items():
            is_stalled = now - worker_data["last_updated"] > self.stalled_threshold
            duration = now - worker_data["start_time"]
            
            result.append({
                "id": worker_id,
                "job_name": worker_data["job_name"],
                "status": "stalled" if is_stalled else worker_data["status"],
                "duration_seconds": int(duration.total_seconds()),
                "last_updated": worker_data["last_updated"].isoformat(),
                "is_stalled": is_stalled
            })
        
        return result


# Global worker tracker
_worker_tracker = WorkerTracker()


def get_system_metrics() -> Dict[str, Any]:
    """Get current system metrics"""
    try:
        # Memory info
        memory = psutil.virtual_memory()
        memory_total_mb = memory.total // (1024 * 1024)
        memory_available_mb = memory.available // (1024 * 1024)
        memory_used_mb = memory_used_mb = memory.used // (1024 * 1024)
        memory_percent = memory.percent
        
        # CPU info
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_cores = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # Load average (Linux only)
        try:
            load_avg = psutil.getloadavg()
        except AttributeError:
            load_avg = (0, 0, 0)
        
        # Disk info
        disk = psutil.disk_usage('/')
        disk_total_gb = disk.total // (1024 * 1024 * 1024)
        disk_free_gb = disk.free // (1024 * 1024 * 1024)
        disk_percent = (disk.used / disk.total) * 100
        
        # Process info
        process = psutil.Process()
        process_memory_mb = process.memory_info().rss // (1024 * 1024)
        process_cpu_percent = process.cpu_percent()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "memory": {
                "total_mb": memory_total_mb,
                "available_mb": memory_available_mb,
                "used_mb": memory_used_mb,
                "percent": memory_percent
            },
            "cpu": {
                "percent": cpu_percent,
                "cores": cpu_cores,
                "frequency_mhz": cpu_freq.current if cpu_freq else 0,
                "load_average": {
                    "1min": round(load_avg[0], 2),
                    "5min": round(load_avg[1], 2),
                    "15min": round(load_avg[2], 2)
                }
            },
            "disk": {
                "total_gb": disk_total_gb,
                "free_gb": disk_free_gb,
                "percent": disk_percent
            },
            "process": {
                "memory_mb": process_memory_mb,
                "cpu_percent": process_cpu_percent,
                "pid": process.pid
            },
            "platform": {
                "system": psutil.LINUX,
                "release": psutil.os.uname().release,
                "hostname": psutil.os.uname().nodename
            }
        }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


def get_build_metrics(build_id: Optional[str] = None) -> Dict[str, Any]:
    """Get build-specific metrics including workers"""
    try:
        metrics = get_system_metrics()
        
        # Add worker information from tracker
        workers = _worker_tracker.get_all_workers()
        
        # Also read worker status files created by build scripts
        status_dir = Path("/var/www/build/status")
        if status_dir.exists():
            for worker_file in status_dir.glob("*-workers.json"):
                try:
                    with open(worker_file, "r") as f:
                        worker_data = json.load(f)
                        if "workers" in worker_data:
                            for worker_id, worker_info in worker_data["workers"].items():
                                # Convert build script worker data to our format
                                if worker_info.get("status") == "completed":
                                    status = "completed"
                                    is_stalled = False
                                elif worker_info.get("status") == "failed":
                                    status = "failed"
                                    is_stalled = False
                                elif worker_info.get("status") == "stalled":
                                    status = "stalled"
                                    is_stalled = True
                                else:
                                    status = "running"
                                    is_stalled = False
                                
                                # Only add if not already tracked
                                if not any(w["id"] == worker_id for w in workers):
                                    workers.append({
                                        "id": worker_id,
                                        "job_name": worker_info.get("job_name", "Unknown Job"),
                                        "status": status,
                                        "duration_seconds": worker_info.get("duration", 0),
                                        "last_updated": worker_info.get("completed_at", worker_info.get("failed_at", datetime.utcnow().isoformat())),
                                        "is_stalled": is_stalled
                                    })
                except Exception as e:
                    print(f"Failed to read worker file {worker_file}: {e}")
        
        # Check for active builds
        active_builds = []
        build_dir = Path(settings.BUILD_DATA_DIR)
        if build_dir.exists():
            for status_file in build_dir.glob("*.json"):
                try:
                    with open(status_file, "r") as f:
                        build_status = json.load(f)
                        if build_status.get("status") in ["running", "pending"]:
                            active_builds.append({
                                "id": status_file.stem,
                                "status": build_status.get("status"),
                                "current_step": build_status.get("current_step"),
                                "progress": build_status.get("progress", 0),
                                "message": build_status.get("message"),
                                "start_time": build_status.get("start_time")
                            })
                except:
                    pass
        
        metrics.update({
            "workers": workers,
            "active_builds": active_builds,
            "total_workers": len(workers),
            "running_workers": len([w for w in workers if w["status"] == "running"]),
            "stalled_workers": len([w for w in workers if w["is_stalled"]])
        })
        
        return metrics
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


def update_build_worker(build_id: str, worker_id: str, job_name: str, status: str = "running"):
    """Update build worker status"""
    _worker_tracker.update_worker(worker_id, job_name, status)
    
    # Save to build status file
    try:
        status_file = Path(settings.BUILD_DATA_DIR) / f"{build_id}.json"
        if status_file.exists():
            with open(status_file, "r") as f:
                build_status = json.load(f)
            
            # Add workers to build status
            if "workers" not in build_status:
                build_status["workers"] = {}
            
            build_status["workers"][worker_id] = {
                "job_name": job_name,
                "status": status,
                "last_updated": datetime.utcnow().isoformat()
            }
            
            with open(status_file, "w") as f:
                json.dump(build_status, f, indent=2, default=str)
    except Exception as e:
        print(f"Failed to update build worker status: {e}")


def remove_build_worker(build_id: str, worker_id: str):
    """Remove worker from tracking"""
    _worker_tracker.remove_worker(worker_id)
    
    # Remove from build status file
    try:
        status_file = Path(settings.BUILD_DATA_DIR) / f"{build_id}.json"
        if status_file.exists():
            with open(status_file, "r") as f:
                build_status = json.load(f)
            
            if "workers" in build_status and worker_id in build_status["workers"]:
                del build_status["workers"][worker_id]
            
            with open(status_file, "w") as f:
                json.dump(build_status, f, indent=2, default=str)
    except Exception as e:
        print(f"Failed to remove build worker: {e}")


def get_stalled_workers() -> List[str]:
    """Get list of stalled workers"""
    return _worker_tracker.get_stalled_workers()


def clear_workers():
    """Clear all workers from tracking - called when new build starts"""
    _worker_tracker.clear_all_workers()
    
    # Also clear worker status files
    status_dir = Path("/var/www/build/status")
    if status_dir.exists():
        for worker_file in status_dir.glob("*-workers.json"):
            try:
                worker_file.unlink()
            except Exception as e:
                print(f"Warning: Could not delete {worker_file}: {e}")


def handle_stalled_workers():
    """Handle stalled workers - restart jobs and kill old workers"""
    stalled = get_stalled_workers()
    
    for worker_id in stalled:
        worker_data = _worker_tracker.workers.get(worker_id, {})
        job_name = worker_data.get("job_name", "unknown")
        
        # Try to restart the job (this would need implementation based on your build system)
        print(f"Worker {worker_id} stalled on job {job_name}, attempting recovery...")
        
        # Mark as stalled for UI visibility
        _worker_tracker.update_worker(worker_id, job_name, "stalled")
    
    return stalled
