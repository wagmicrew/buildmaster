# Frontend Updates Needed for Database Admin

## ✅ BACKEND COMPLETE
- Backup execution with download
- Sync execution 
- Upload & restore with sanity check
- Console output for all operations

## ⏳ FRONTEND NEEDED

### 1. Mutations (DONE)
- ✅ Added `executeBackupMutation`
- ✅ Added `executeSyncMutation`

### 2. Sync Tab - Add Execute Button (Line ~1254)
After the "Generate Sync Commands" button, add:

```tsx
<button
  onClick={() => executeSyncMutation.mutate({
    source_env: syncSource,
    target_env: syncTarget,
    options: { sync_type: syncType, tables: syncTables }
  })}
  disabled={executeSyncMutation.isPending}
  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
>
  {executeSyncMutation.isPending ? (
    <>
      <Loader className="animate-spin" size={18} />
      Executing Sync...
    </>
  ) : (
    <>
      <CheckCircle size={18} />
      Execute Sync Now
    </>
  )}
</button>
```

### 3. Sync Results - Add Console Output (Line ~1298)
Replace or enhance the sync results section to show console output if available:

```tsx
{syncResult?.console_output && syncResult.console_output.length > 0 && (
  <div className="bg-black/80 border border-green-500/30 rounded-xl p-4 font-mono text-sm max-h-96 overflow-y-auto mb-4">
    {syncResult.console_output.map((line: string, idx: number) => (
      <div key={idx} className="text-slate-300">{line}</div>
    ))}
  </div>
)}
```

### 4. Backup Tab - Add Execute Button (Find line with "Generate Backup Commands")
Similar pattern - add execute button next to generate button

### 5. Backup Results - Add Console Output
Same console output display pattern

## BUILD & DEPLOY
```bash
cd c:\projects\V24\Documentation_new\build-dashboard\web
npx vite build
scp -r build/* root@server:/var/www/build/web/build/
```

## KEY FEATURES TO SHOW
- Execute buttons are EMERALD green (vs sky blue for generate)
- Console output in terminal-style black box
- Download triggers automatically for backups
- Loading states with spinners
