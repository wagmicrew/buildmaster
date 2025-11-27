# Git Status & Database Health Enhancements

## Overview
Enhanced the Health/Status page with detailed Git status information, actionable suggestions, and comprehensive database health metrics.

## Features Implemented

### ✅ 1. Detailed Git Status (`/api/git/status/detailed`)

#### Information Displayed
- **Status**: clean/dirty/error
- **Current Branch**: Active git branch name
- **File Counts**:
  - Modified files
  - Untracked files
  - Staged files
  - Deleted files
- **Stash Information**:
  - Number of stashes available
  - Has stash indicator
- **Remote Sync**:
  - Commits ahead of remote
  - Commits behind remote

#### Actionable Suggestions
Based on the git status, the system provides context-aware suggestions:

**For Modified Files**:
- ⚠️ "X modified file(s)" → Suggest: **Stash changes**
- ℹ️ "Commit changes" → Suggest: **Commit to save permanently**

**For Untracked Files**:
- ℹ️ "X untracked file(s)" → Suggest: **Remove untracked files** (with caution)

**For Staged Files**:
- ✓ "X staged file(s) ready to commit" → Suggest: **Commit staged changes**

**For Stashes**:
- ℹ️ "X stash(es) available" → Suggest: **Pop to apply latest stash**

**For Remote Sync**:
- ⚠️ "Behind remote by X commit(s)" → Suggest: **Pull latest changes**
- ℹ️ "Ahead of remote by X commit(s)" → Suggest: **Push local commits**

---

### ✅ 2. Git Actions with User Confirmation

#### Stash Changes (`POST /api/git/stash`)
**Action**: Saves current changes temporarily
**Command**: `git stash push -m "Auto-stash from build dashboard"`
**Use Case**: Save work before pulling or switching branches
**Feedback**: Success/error message with stash details

#### Pop Stash (`POST /api/git/stash/pop`)
**Action**: Applies and removes the latest stash
**Command**: `git stash pop`
**Use Case**: Restore previously stashed changes
**Feedback**: Success message or conflict warning

#### Clean Untracked Files (`POST /api/git/clean`)
**Action**: Shows what files would be removed (dry-run)
**Command**: `git clean -fd --dry-run`
**Use Case**: Preview files to be removed
**Feedback**: List of files that would be removed

#### Confirm Clean (`POST /api/git/clean/confirm`)
**Action**: Actually removes untracked files
**Command**: `git clean -fd`
**Use Case**: Remove build artifacts, temp files, etc.
**Feedback**: Confirmation of files removed
**⚠️ Warning**: This action is destructive!

---

### ✅ 3. Enhanced Database Health

#### Additional Metrics
- **Version**: PostgreSQL version string
- **Database Size**: Total size in bytes (formatted as MB/GB)
- **Active Connections**: Number of current database connections
- **Table Count**: Number of tables in public schema
- **Response Time**: Connection latency in milliseconds

#### Display Format
```
┌─────────────────────────────────────────────────────────────┐
│ Database                                              ✓      │
├─────────────────────────────────────────────────────────────┤
│ Status: Connected                                            │
│ Version: PostgreSQL 14.x                                     │
│ Size: 245.67 MB                                              │
│ Connections: 12                                              │
│ Tables: 45                                                   │
│ Response Time: 15.32ms                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Components

### Git Status Card
```
┌─────────────────────────────────────────────────────────────┐
│ 🔀 Git Status                                Branch: V24     │
├─────────────────────────────────────────────────────────────┤
│ Status: Dirty (5 files changed)                             │
│                                                              │
│ File Changes:                                                │
│ • 3 modified files                                           │
│ • 2 untracked files                                          │
│ • 0 staged files                                             │
│                                                              │
│ Stashes: 2 available                                         │
│ Remote: 3 commits behind origin                              │
│                                                              │
│ Suggestions:                                                 │
│ ⚠️ 3 modified file(s) → Stash changes                       │
│ ℹ️ 2 untracked file(s) → Remove untracked files             │
│ ⚠️ Behind remote by 3 commit(s) → Pull latest changes       │
│                                                              │
│ Actions:                                                     │
│ [Stash Changes] [Pop Stash] [Clean Files]                   │
└─────────────────────────────────────────────────────────────┘
```

### Action Buttons
- **Stash Changes**: Archive icon, saves current work
- **Pop Stash**: Rotate icon, restores stashed work
- **Clean Files**: Trash icon, removes untracked files (with confirmation)

### Feedback Banner
```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Changes stashed successfully!                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Would remove 5 file(s). Confirm to proceed.              │
│ [Cancel] [Confirm Remove]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Backend - `git_status.py`

#### `get_detailed_git_status()`
```python
async def get_detailed_git_status() -> Dict:
    """
    Returns:
    - status: clean/dirty/error
    - branch: current branch name
    - modified_files: list of modified files
    - untracked_files: list of untracked files
    - staged_files: list of staged files
    - deleted_files: list of deleted files
    - file_count: total changed files
    - suggestions: actionable suggestions
    - has_stash: boolean
    - stash_count: number of stashes
    - ahead: commits ahead of remote
    - behind: commits behind remote
    """
```

#### Git Commands Used
```bash
# Get current branch
git rev-parse --abbrev-ref HEAD

# Get file changes
git status --porcelain

# List stashes
git stash list

# Check ahead/behind
git rev-list --left-right --count HEAD...origin/branch

# Stash changes
git stash push -m "message"

# Pop stash
git stash pop

# Clean (dry-run)
git clean -fd --dry-run

# Clean (actual)
git clean -fd
```

### Backend - Enhanced `health.py`

#### Database Health Queries
```sql
-- Get version
SELECT version()

-- Get database size
SELECT pg_database_size(current_database())

-- Get active connections
SELECT count(*) FROM pg_stat_activity

-- Get table count
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public'
```

### Frontend - Health.tsx

#### State Management
```tsx
const [gitActionFeedback, setGitActionFeedback] = useState<{
  action: string
  status: 'loading' | 'success' | 'error'
  message: string
} | null>(null)

const [showCleanConfirm, setShowCleanConfirm] = useState(false)
const [filesToClean, setFilesToClean] = useState<string[]>([])
```

#### Git Status Query
```tsx
const { data: gitStatus, refetch: refetchGitStatus } = useQuery({
  queryKey: ['git-status-detailed'],
  queryFn: async () => {
    const response = await api.get('/git/status/detailed')
    return response.data
  },
  refetchInterval: 15000, // Update every 15 seconds
})
```

#### Action Mutations
```tsx
const stashMutation = useMutation({
  mutationFn: async () => {
    const response = await api.post('/git/stash')
    return response.data
  },
  onSuccess: (data) => {
    setGitActionFeedback({ 
      action: 'stash', 
      status: 'success', 
      message: data.message 
    })
    refetchGitStatus()
  }
})
```

---

## API Endpoints

### Git Status Endpoints

#### `GET /api/git/status/detailed`
**Description**: Get detailed git status with suggestions
**Auth**: Required
**Response**:
```json
{
  "status": "dirty",
  "branch": "V24",
  "modified_files": ["file1.ts", "file2.ts"],
  "untracked_files": ["temp.log"],
  "staged_files": [],
  "deleted_files": [],
  "file_count": 3,
  "has_stash": true,
  "stash_count": 2,
  "ahead": 0,
  "behind": 3,
  "suggestions": [
    {
      "type": "warning",
      "message": "2 modified file(s)",
      "action": "stash",
      "description": "Stash changes to save them temporarily"
    }
  ]
}
```

#### `POST /api/git/stash`
**Description**: Stash current changes
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "message": "Changes stashed successfully",
  "output": "Saved working directory..."
}
```

#### `POST /api/git/stash/pop`
**Description**: Pop the latest stash
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "message": "Stash applied successfully",
  "output": "On branch V24..."
}
```

#### `POST /api/git/clean`
**Description**: Check what files would be removed (dry-run)
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "message": "Would remove 5 file(s)",
  "files": [
    "Would remove temp.log",
    "Would remove build/cache/"
  ],
  "dry_run": true
}
```

#### `POST /api/git/clean/confirm`
**Description**: Actually remove untracked files
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "message": "Untracked files removed successfully",
  "output": "Removing temp.log..."
}
```

### Enhanced Database Endpoint

#### `GET /api/health/database`
**Description**: Get database health with detailed metrics
**Auth**: Required
**Response**:
```json
{
  "connected": true,
  "response_time_ms": 15.32,
  "error": null,
  "timestamp": "2025-11-25T12:00:00Z",
  "version": "PostgreSQL 14.10",
  "size_bytes": 257489920,
  "connection_count": 12,
  "table_count": 45
}
```

---

## User Workflows

### Workflow 1: Stash Before Pull
**Scenario**: Developer has local changes and wants to pull latest code

1. View Health page
2. See "Git Status: Dirty (3 files changed)"
3. See suggestion: "⚠️ 3 modified file(s) → Stash changes"
4. Click "Stash Changes" button
5. See success message: "✓ Changes stashed successfully!"
6. Git status updates to "clean"
7. Navigate to Git Pull page
8. Pull latest changes
9. Return to Health page
10. Click "Pop Stash" to restore changes

### Workflow 2: Clean Build Artifacts
**Scenario**: Developer wants to remove temporary build files

1. View Health page
2. See "Git Status: Dirty (15 files changed)"
3. See "12 untracked files" (build artifacts)
4. Click "Clean Files" button
5. See confirmation dialog with list of files
6. Review files to be removed
7. Click "Confirm Remove"
8. See success message: "✓ Untracked files removed successfully!"
9. Git status updates with fewer files

### Workflow 3: Check Database Health
**Scenario**: Developer wants to verify database is healthy

1. View Health page
2. See Database card with:
   - ✓ Connected
   - Version: PostgreSQL 14.10
   - Size: 245.67 MB
   - Connections: 12
   - Tables: 45
   - Response Time: 15.32ms
3. All metrics green = healthy
4. If any issues, see red indicators and error messages

---

## Safety Features

### Git Clean Confirmation
- **Two-step process**: Dry-run first, then confirm
- **File preview**: Shows exactly what will be removed
- **Cancel option**: Easy to abort
- **Warning message**: Clear indication this is destructive

### Error Handling
- **Network errors**: Clear error messages
- **Git errors**: Detailed error output
- **Conflict detection**: Warns about merge conflicts
- **Timeout protection**: 10-second timeout on git operations

### Auto-refresh
- Git status: Every 15 seconds
- Database health: Every 10 seconds
- Server health: Every 5 seconds
- Feedback messages: Auto-dismiss after 5 seconds

---

## Benefits

### For Developers
✅ **Clear visibility** - See exact git status at a glance
✅ **Actionable suggestions** - Know what to do next
✅ **Safe operations** - Confirmation for destructive actions
✅ **Database insights** - Monitor database health and size
✅ **Time savings** - No need to SSH for git operations

### For System Monitoring
✅ **Comprehensive metrics** - Database size, connections, tables
✅ **Performance tracking** - Response times for all services
✅ **Proactive alerts** - Warnings for issues
✅ **Historical context** - Stash count, ahead/behind tracking

---

## Future Enhancements

### Git Features
- [ ] View stash contents before popping
- [ ] Create branches from UI
- [ ] View commit history
- [ ] Diff viewer for modified files
- [ ] Commit from UI with message
- [ ] Cherry-pick commits
- [ ] Rebase operations

### Database Features
- [ ] Query performance metrics
- [ ] Slow query log
- [ ] Index usage statistics
- [ ] Table size breakdown
- [ ] Connection pool stats
- [ ] Backup status
- [ ] Replication lag (if applicable)

### UI Improvements
- [ ] File tree view for changes
- [ ] Syntax highlighting for diffs
- [ ] Real-time git log stream
- [ ] Database query console
- [ ] Performance graphs over time

---

## Testing

### Manual Testing

**Git Status**:
1. Make file changes
2. Verify status shows "dirty"
3. Verify file counts are accurate
4. Verify suggestions appear

**Stash**:
1. Modify files
2. Click "Stash Changes"
3. Verify files are stashed
4. Verify working directory is clean
5. Click "Pop Stash"
6. Verify files are restored

**Clean**:
1. Create untracked files
2. Click "Clean Files"
3. Verify file list in confirmation
4. Click "Confirm Remove"
5. Verify files are removed

**Database**:
1. Check database metrics
2. Verify all fields populated
3. Check response time is reasonable
4. Verify connection count updates

---

## Summary

This enhancement transforms the Health page from a simple status display into a powerful operational tool with:

✅ **Detailed Git Status** - File-level visibility with actionable suggestions
✅ **Git Operations** - Stash, pop, and clean directly from UI
✅ **Enhanced Database Metrics** - Size, connections, tables, version
✅ **User-Friendly Interface** - Clear feedback and confirmations
✅ **Safe Operations** - Two-step confirmation for destructive actions
✅ **Real-Time Updates** - Auto-refresh every 5-15 seconds

**Result**: A professional, production-ready system health monitoring and management tool! 🚀
