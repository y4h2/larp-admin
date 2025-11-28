# Collaborative Editing Implementation Plan

## Overview

Implementation of real-time collaborative editing using Supabase Presence and Realtime for the LARP Admin backend.

### Requirements
- Priority pages: Script, NPC, Clue detail pages
- Conflict resolution: Automatic merge
- Online status display: Header + Sidebar

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌──────────────────┐                   │
│  │PresenceProvider │    │ RealtimeProvider │                   │
│  │                 │    │                  │                   │
│  │ - Online users  │    │ - DB changes     │                   │
│  │ - Current page  │    │ - Auto merge     │                   │
│  │ - Editing state │    │ - Conflict UI    │                   │
│  └────────┬────────┘    └────────┬─────────┘                   │
│           │                      │                              │
│  ┌────────▼────────┐    ┌────────▼─────────┐                   │
│  │  usePresence    │    │ useRealtimeSync  │                   │
│  │  hook           │    │ hook             │                   │
│  └────────┬────────┘    └────────┬─────────┘                   │
│           │                      │                              │
│  ┌────────▼────────────────────▼─────────┐                    │
│  │           Detail Pages                  │                    │
│  │  - ScriptDetail                         │                    │
│  │  - NpcDetail                            │                    │
│  │  - ClueDetail                           │                    │
│  └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Realtime                             │
├─────────────────────────────────────────────────────────────────┤
│  Presence Channel          │  Postgres Changes                  │
│  - user join/leave         │  - INSERT/UPDATE/DELETE            │
│  - user state sync         │  - table subscriptions             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Presence Context & Online Users (3h)

### 1.1 Create PresenceContext

**File:** `frontend/src/contexts/PresenceContext.tsx`

```typescript
interface UserPresence {
  id: string;
  email: string;
  avatar?: string;
  currentPage: string;
  editing?: {
    type: 'script' | 'npc' | 'clue';
    id: string;
  } | null;
  lastSeen: string;
}

interface PresenceContextType {
  onlineUsers: UserPresence[];
  currentUser: UserPresence | null;
  trackPage: (page: string) => void;
  trackEditing: (type: string, id: string) => void;
  stopEditing: () => void;
  getUsersOnPage: (page: string) => UserPresence[];
  getUsersEditing: (type: string, id: string) => UserPresence[];
}
```

**Key implementation:**
- Subscribe to `presence` channel on mount
- Track user state changes (join, leave, sync)
- Auto-update currentPage on route change
- Cleanup on unmount

### 1.2 Create OnlineUsers Component

**File:** `frontend/src/components/common/OnlineUsers.tsx`

- Avatar group showing online users
- Tooltip showing user email and current page
- Click to show dropdown with full list
- Max 5 avatars visible, +N for overflow

### 1.3 Create SidebarOnlineUsers Component

**File:** `frontend/src/components/layout/SidebarOnlineUsers.tsx`

- Compact list view for sidebar
- Shows user name + current page indicator
- Collapsed state shows only count

### 1.4 Integrate into Layout

**Modify:** `frontend/src/components/layout/MainLayout.tsx`

- Add PresenceProvider wrapper
- Add OnlineUsers to Header
- Add SidebarOnlineUsers to Sider

---

## Phase 2: Editing State Awareness (2h)

### 2.1 Create EditingIndicator Component

**File:** `frontend/src/components/common/EditingIndicator.tsx`

- Shows who else is editing the same resource
- Badge/banner style: "张三 is editing this script"
- Auto-updates as users join/leave

### 2.2 Update Detail Pages

**Modify:**
- `frontend/src/pages/scripts/ScriptDetail.tsx`
- `frontend/src/pages/npcs/NpcDetail.tsx`
- `frontend/src/pages/clues/ClueDetail.tsx`

**Changes:**
- Call `trackEditing(type, id)` on mount
- Call `stopEditing()` on unmount
- Show EditingIndicator component
- Pass editing users to conflict handler

---

## Phase 3: Realtime Sync & Auto Merge (6h)

### 3.1 Create useRealtimeSync Hook

**File:** `frontend/src/hooks/useRealtimeSync.ts`

```typescript
interface UseRealtimeSyncOptions<T> {
  table: 'scripts' | 'npcs' | 'clues';
  id: string;
  currentData: T;
  onRemoteChange: (newData: T, changeType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onConflict?: (localData: T, remoteData: T) => T;  // Auto merge function
}

function useRealtimeSync<T>({
  table,
  id,
  currentData,
  onRemoteChange,
  onConflict
}: UseRealtimeSyncOptions<T>): {
  hasRemoteChanges: boolean;
  remoteData: T | null;
  lastSyncedAt: Date | null;
  conflictResolution: 'pending' | 'merged' | 'none';
}
```

### 3.2 Auto Merge Strategy

**File:** `frontend/src/utils/autoMerge.ts`

```typescript
// Field-level merge strategy
interface MergeResult<T> {
  merged: T;
  conflicts: string[];  // Field names with conflicts
  autoResolved: boolean;
}

function autoMerge<T>(
  base: T,           // Original data before edits
  local: T,          // Current user's changes
  remote: T,         // Other user's changes
  options?: {
    conflictFields?: string[];  // Fields that require manual resolution
    preferLocal?: string[];     // Fields where local wins
    preferRemote?: string[];    // Fields where remote wins
  }
): MergeResult<T>
```

**Merge rules:**
1. If only local changed → keep local
2. If only remote changed → take remote
3. If both changed same field →
   - Text fields: prefer most recent (by timestamp)
   - Arrays: merge unique values
   - Objects: recursive merge
4. Track all auto-resolved conflicts for display

### 3.3 Create ConflictNotification Component

**File:** `frontend/src/components/common/ConflictNotification.tsx`

- Toast notification when auto-merge happens
- Shows what fields were merged
- Option to view diff or revert
- Auto-dismiss after 5 seconds

### 3.4 Create SyncStatusIndicator Component

**File:** `frontend/src/components/common/SyncStatusIndicator.tsx`

- Shows sync status: "Synced" | "Syncing..." | "Conflict resolved"
- Green dot for synced
- Yellow dot for pending changes
- Blue pulse for auto-merge happened

### 3.5 Update Detail Pages for Realtime

**Modify:**
- `frontend/src/pages/scripts/ScriptDetail.tsx`
- `frontend/src/pages/npcs/NpcDetail.tsx`
- `frontend/src/pages/clues/ClueDetail.tsx`

**Changes:**
- Add useRealtimeSync hook
- Store base version for 3-way merge
- Handle remote changes with auto-merge
- Show ConflictNotification on merge
- Add SyncStatusIndicator to header
- Debounce save to reduce conflicts

---

## Phase 4: Database Updates (1h)

### 4.1 Add updated_by Column

**File:** `backend/alembic/versions/xxx_add_updated_by.py`

```sql
ALTER TABLE scripts ADD COLUMN updated_by UUID REFERENCES auth.users(id);
ALTER TABLE npcs ADD COLUMN updated_by UUID REFERENCES auth.users(id);
ALTER TABLE clues ADD COLUMN updated_by UUID REFERENCES auth.users(id);
```

### 4.2 Enable Realtime for Tables

```sql
-- In Supabase Dashboard or migration
ALTER PUBLICATION supabase_realtime ADD TABLE scripts;
ALTER PUBLICATION supabase_realtime ADD TABLE npcs;
ALTER PUBLICATION supabase_realtime ADD TABLE clues;
```

---

## Implementation Order

```
Week 1:
├── Day 1 (4h)
│   ├── Phase 1.1: PresenceContext
│   ├── Phase 1.2: OnlineUsers component
│   └── Phase 1.3: SidebarOnlineUsers
│
├── Day 2 (3h)
│   ├── Phase 1.4: Layout integration
│   ├── Phase 2.1: EditingIndicator
│   └── Phase 2.2: Detail pages editing tracking
│
├── Day 3 (4h)
│   ├── Phase 3.1: useRealtimeSync hook
│   ├── Phase 3.2: Auto merge utilities
│   └── Phase 4: Database updates
│
└── Day 4 (4h)
    ├── Phase 3.3: ConflictNotification
    ├── Phase 3.4: SyncStatusIndicator
    ├── Phase 3.5: Detail pages realtime
    └── Testing & polish
```

---

## File Changes Summary

### New Files (10)
```
frontend/src/contexts/PresenceContext.tsx
frontend/src/components/common/OnlineUsers.tsx
frontend/src/components/common/EditingIndicator.tsx
frontend/src/components/common/ConflictNotification.tsx
frontend/src/components/common/SyncStatusIndicator.tsx
frontend/src/components/layout/SidebarOnlineUsers.tsx
frontend/src/hooks/useRealtimeSync.ts
frontend/src/utils/autoMerge.ts
frontend/src/locales/en.json (add keys)
frontend/src/locales/zh.json (add keys)
backend/alembic/versions/xxx_add_updated_by.py
```

### Modified Files (5)
```
frontend/src/App.tsx (add PresenceProvider)
frontend/src/components/layout/MainLayout.tsx (add UI components)
frontend/src/pages/scripts/ScriptDetail.tsx (add realtime)
frontend/src/pages/npcs/NpcDetail.tsx (add realtime)
frontend/src/pages/clues/ClueDetail.tsx (add realtime)
```

---

## i18n Keys to Add

```json
{
  "presence": {
    "onlineUsers": "Online Users",
    "viewing": "Viewing",
    "editing": "Editing",
    "editingThis": "{{name}} is editing this {{type}}",
    "multipleEditing": "{{count}} people are editing this {{type}}",
    "lastSeen": "Last seen {{time}}"
  },
  "sync": {
    "synced": "Synced",
    "syncing": "Syncing...",
    "conflictResolved": "Changes merged",
    "autoMerged": "Auto-merged changes from {{name}}",
    "fieldsUpdated": "Updated fields: {{fields}}",
    "viewDiff": "View changes",
    "revert": "Revert"
  }
}
```

---

## Estimated Total Time

| Phase | Time |
|-------|------|
| Phase 1: Presence & Online Users | 3h |
| Phase 2: Editing Awareness | 2h |
| Phase 3: Realtime & Auto Merge | 6h |
| Phase 4: Database Updates | 1h |
| Testing & Polish | 3h |
| **Total** | **15h (~2 days)** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Merge conflicts on complex nested data | Medium | Implement field-level merge with timestamp comparison |
| Performance with many users | Low | Limit presence updates to 1/sec, use debouncing |
| Realtime connection drops | Medium | Implement reconnection logic with state recovery |
| Race conditions on save | Medium | Use optimistic locking with version field |

---

## Success Criteria

1. ✅ Users can see who else is online in header/sidebar
2. ✅ Users can see who is viewing/editing the same resource
3. ✅ Changes from other users appear automatically
4. ✅ Concurrent edits are auto-merged without data loss
5. ✅ Users are notified when auto-merge happens
6. ✅ No flickering or jarring UX during sync

---

## Phase 5: Collaborative Form Components

### 5.1 Component Strategy Overview

| Component | Strategy | Description |
|-----------|----------|-------------|
| **CollaborativeTextArea** | Yjs CRDT | Real-time character-level sync with cursor awareness |
| **CollaborativeInput** | Field Locking | Lock on focus, release on blur |
| **CollaborativeSelect** | Field Locking | Lock when dropdown opens, release on close |
| **CollaborativeMultiSelect** | Field Locking + Broadcast | Lock on focus, sync value via broadcast on blur |

### 5.2 CollaborativeMultiSelect Implementation

**File:** `frontend/src/components/collaborative/CollaborativeMultiSelect.tsx`

#### Key Features
- **Field-level locking**: Prevents concurrent edits to the same multi-select field
- **Data sync on blur**: Broadcasts value changes only when user finishes editing
- **Visual feedback**: Shows lock indicator and user color when locked by others

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   CollaborativeMultiSelect                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  State Management:                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ lockState       │  │ isEditing       │  │ currentValueRef │ │
│  │ (who has lock)  │  │ (local editing) │  │ (pending value) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  Event Handlers:                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ onFocus     │  │ onChange    │  │ onBlur      │             │
│  │ - Set lock  │  │ - Store val │  │ - Broadcast │             │
│  │ - Store val │  │ - Update UI │  │ - Release   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Realtime Channel                     │
│                 `multiselect:{docId}:{fieldName}`                │
├─────────────────────────────────────────────────────────────────┤
│  Presence (Locking)           │  Broadcast (Data Sync)          │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐   │
│  │ { id, name, color,      │  │  │ event: 'value-sync'     │   │
│  │   isEditing: boolean }  │  │  │ payload: { newValue,    │   │
│  │                         │  │  │   senderId }            │   │
│  └─────────────────────────┘  │  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**1. Channel Configuration**
```typescript
const channel = supabase.channel(roomName, {
  config: {
    presence: { key: user.id },
    broadcast: { self: true },  // Required to test broadcast locally
  },
});
```

**2. Event Registration Order (CRITICAL)**
```typescript
// ⚠️ IMPORTANT: Broadcast listener MUST be registered before subscribe()
// Using chain syntax to ensure correct order
channel
  .on('presence', { event: 'sync' }, handlePresenceSync)
  .on('broadcast', { event: 'value-sync' }, handleValueSync)
  .subscribe(handleSubscribed);

// ❌ WRONG: Separate registration may not work
channel.on('broadcast', { event: 'value-sync' }, handler);
channel.subscribe();  // Broadcast may not be received!
```

**3. Focus/Blur Lock Management**
```typescript
// onFocus: Acquire lock and store current value
const handleFocus = (e) => {
  if (isLockedByOther) return;
  currentValueRef.current = Array.isArray(value) ? [...value] : [];
  setIsEditing(true);
};

// onBlur: Check if truly leaving, then sync and release
const handleBlur = (e) => {
  const relatedTarget = e.relatedTarget;

  // Don't release if focus stays within container (clicking options)
  if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
    return;
  }

  // Delayed check for cases where relatedTarget is null
  setTimeout(() => {
    if (!containerRef.current?.contains(document.activeElement)) {
      // Sync value to other users
      channelRef.current.send({
        type: 'broadcast',
        event: 'value-sync',
        payload: { newValue: currentValueRef.current, senderId: user.id },
      });
      setIsEditing(false);
    }
  }, 50);
};
```

**4. Presence Sync for Lock State**
```typescript
channel.on('presence', { event: 'sync' }, () => {
  const presences = /* extract from presenceState */;

  // Only care about OTHER users' editing state
  const editingUser = presences.find(p => p.isEditing && p.id !== user.id);

  if (editingUser) {
    setLockState({ lockedBy: editingUser });
  } else {
    // Only clear if lock was held by someone else
    setLockState(prev =>
      prev.lockedBy?.id !== user.id ? { lockedBy: null } : prev
    );
  }
});
```

**5. Using Refs to Avoid Stale Closures**
```typescript
// Store onChange in ref to avoid dependency in useEffect
const onChangeRef = useRef(onChange);
useEffect(() => {
  onChangeRef.current = onChange;
}, [onChange]);

// Use ref in broadcast handler
channel.on('broadcast', { event: 'value-sync' }, (payload) => {
  onChangeRef.current?.(payload.payload.newValue, []);
});
```

#### Visual States

| State | Border Color | Icon | Tooltip |
|-------|--------------|------|---------|
| Normal | Default | Default | - |
| Self Editing | User's color | Default | - |
| Locked by Other | Other user's color | 🔒 Lock | "{name} 正在编辑" |
| Disabled | Default | Default | - |

#### Usage Example

```tsx
<Form.Item name="trigger_keywords" label={t('clue.triggerKeywords')}>
  <CollaborativeMultiSelect
    docId={`clue_${id}`}
    fieldName="trigger_keywords"
    mode="tags"
    placeholder={t('clue.triggerKeywordsPlaceholder')}
  />
</Form.Item>
```

### 5.3 Lessons Learned

1. **Supabase Broadcast Registration**: Event listeners must be chained before `.subscribe()` call
2. **Focus Management**: Use `relatedTarget` and `document.activeElement` to detect if focus truly left
3. **Debounce Presence Updates**: Prevent rapid presence track calls during selection
4. **Ref for Callbacks**: Store callbacks in refs to avoid stale closures in event handlers
5. **Value Storage**: Store current value on focus, update on change, sync on blur
