# Comprehensive Clue Tree (线索树) Functionality Analysis

## Executive Summary
The clue tree functionality is a core feature for managing hierarchical clue dependencies in a LARP (Live Action Role-Playing) game. It uses ReactFlow for visualization and provides a graph-based dependency management system with cycle detection and quality validation.

## 1. File Structure and Organization

### Frontend (React/TypeScript)
```
/frontend/src/
├── api/
│   └── clues.ts                 # API client for clue operations
├── hooks/
│   └── useClues.ts              # Custom hooks (useClues, useClueTree)
├── pages/clues/
│   ├── ClueList.tsx             # List view of clues
│   ├── ClueDetail.tsx           # Individual clue editor
│   ├── ClueTree.tsx             # Main tree visualization (838 lines)
│   └── index.ts                 # Exports
├── types/
│   └── index.ts                 # TypeScript interfaces
└── locales/
    ├── en.json                  # English translations
    └── zh.json                  # Chinese translations (线索树)
```

### Backend (Python/FastAPI)
```
/backend/app/
├── api/
│   └── clues.py                 # API endpoints (lines 1-324)
├── models/
│   └── clue.py                  # Clue model definition
├── schemas/
│   └── clue.py                  # Pydantic schemas
└── services/
    └── clue_tree.py             # Tree validation service (245 lines)
```

## 2. Data Structure and Relationships

### Core Clue Model (Backend)
**File:** `/backend/app/models/clue.py` (lines 26-119)

```python
class Clue(Base):
    id: str                              # UUID
    script_id: str                       # Foreign key to Script
    npc_id: str                          # Foreign key to NPC
    name: str                            # Clue title
    type: ClueType                       # 'text' or 'image'
    detail: str                          # Content for players
    detail_for_npc: str                  # Guidance for NPC
    trigger_keywords: list[str]          # For keyword matching
    trigger_semantic_summary: str        # For embedding matching
    prereq_clue_ids: list[str]           # CRITICAL: Dependencies
    created_at: datetime
    updated_at: datetime
```

### ClueTreeData Interface (Frontend)
**File:** `/frontend/src/api/clues.ts` (lines 13-34)

```typescript
export interface ClueTreeNode {
  id: string;
  name: string;
  type: Clue['type'];
  npc_id: string;
  prereq_clue_ids: string[];
  detail?: string;
  trigger_keywords?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ClueTreeData {
  nodes: ClueTreeNode[];
  edges: Array<{ source: string; target: string }>;
  issues: {
    dead_clues: string[];
    orphan_clues: string[];
    cycles: string[][];
  };
}
```

## 3. Frontend Components and Interactions

### Main Component: ClueTree (838 lines)
**File:** `/frontend/src/pages/clues/ClueTree.tsx`

#### Key Features:
1. **ReactFlow Visualization** (lines 22-36)
   - Uses @xyflow/react library
   - Interactive drag-and-drop for dependencies
   - MiniMap and Controls components
   - Smooth-step edge routing

2. **Custom ClueNode Component** (lines 93-187)
   - Displays configurable fields
   - Color-coded by type (purple for image, blue for text)
   - Shows preview of keywords, prerequisites, dependents

3. **State Management**
   - `treeData`: ClueTreeData from API
   - `pendingChanges`: Map<clueId, prereq_clue_ids> (line 248)
   - `visibleFields`: Selected fields to display (line 246)
   - `nodes` & `edges`: ReactFlow state

#### Critical Functions:

**Cycle Detection** (lines 194-232)
- Prevents circular dependencies before save
- Uses DFS algorithm
- Checks both existing edges and pending changes

**Layout Algorithm** (lines 314-391)
- BFS-based level assignment
- Groups nodes by level
- Spacing: 250px horizontal, 150px vertical

**Unsaved Changes Handling** (lines 512-546)
- Batch updates on save (lines 518-521)
- Discard with confirmation modal

#### Issues Found:

1. **Type Safety Issue** (lines 140-182)
   - Uses `as unknown as { ... }` for optional fields
   - Example: Line 143, 152, 169, 177, 179
   - Impact: Type safety lost at runtime

2. **Missing in Backend Response**
   - Detail, keywords, dates come from backend but not typed

3. **Edge ID Collision Risk** (line 395)
   - Edge IDs use `edge-${index}` which can cause mismatches
   - Should use `${source}-${target}`

4. **Missing Dependent Clues Handling** (line 813)
   - Uses `dependent_clue_ids` not in backend schema
   - Will cause undefined errors

### ClueDetail Component
**File:** `/frontend/src/pages/clues/ClueDetail.tsx` (236 lines)

- Prerequisites field incomplete (lines 218-220)
  - Comment: "Would need to fetch clues for this script to populate"
  - Empty Select component
  - Users cannot edit prerequisites from here

## 4. Backend API Integration

### API Endpoints

1. **Get Clue Tree**
   - Endpoint: `GET /scripts/{script_id}/clue-tree`
   - File: `/backend/app/api/clues.py` (lines 281-323)
   - Returns: `ClueTreeResponse` with nodes and edges only
   - **CRITICAL ISSUE**: Does not return validation/issues data

2. **Update Dependencies**
   - Endpoint: `PUT /clues/{clue_id}/dependencies`
   - File: `/backend/app/api/clues.py` (lines 177-254)
   - Includes cycle detection and validation

### Backend Service: ClueTreeService
**File:** `/backend/app/services/clue_tree.py` (245 lines)

Methods:
- `validate_clue_tree()`: Detects cycles, dead clues, orphans
- `_detect_cycles()`: DFS cycle detection
- `_find_root_clues()`: Finds clues with no prerequisites
- `_find_dead_clues()`: Finds unreachable clues
- `_find_orphan_clues()`: Finds isolated clues

## 5. CRITICAL BUG: API-Frontend Type Mismatch

**Frontend expects:**
```typescript
interface ClueTreeData {
  issues: {
    dead_clues: string[];
    orphan_clues: string[];
    cycles: string[][];
  };
}
```

**Backend returns:**
```python
ClueTreeResponse(nodes=nodes, edges=edges)
# NO 'issues' field!
```

**Usage** (lines 588-591 ClueTree.tsx):
```typescript
const hasIssues =
  treeData?.issues &&
  ((treeData.issues.dead_clues?.length ?? 0) > 0 || ...);
```

**Result**: Quality issues alert NEVER DISPLAYS because `issues` is undefined!

## 6. Localization

Key translation keys:
- `clue.treeTitle`: "Clue Tree Visualization" / "线索树可视化"
- `clue.qualityIssues`: "Quality Issues Detected"
- `clue.deadClues`: "Dead Clues (unreachable)"
- `clue.orphanClues`: "Orphan Clues (no dependencies)"
- `clue.circularDependencies`: "Circular Dependencies"

## 7. Summary of Issues

### CRITICAL (Must Fix):
1. **Missing `issues` field in API response** - Quality warnings never show
   - Fix: Update GET /scripts/{script_id}/clue-tree to include issues
   - Location: `/backend/app/api/clues.py` lines 281-323

2. **TypeScript casting issues** - Type safety lost
   - Lines 140, 143, 152, 169, 177, 179, 813 (ClueTree.tsx)
   - Fix: Create proper typed interfaces

### HIGH (Should Fix):
3. **Edge ID generation** - Uses index, can cause wrong edges deleted
   - Line 395: `id: \`edge-${index}\``
   - Fix: Use `\`${source}-${target}\``

4. **ClueDetail incomplete** - Can't edit prerequisites from detail view
   - Lines 218-220: Empty Select component

### MEDIUM:
5. **Unused useClueTree hook** - Defined but never used
6. **Performance** - No memoization of layout calculations
7. **Dependent clues field** - Not in backend schema, may cause undefined errors

## 8. Code Quality

### Strengths:
- Good component separation
- Comprehensive cycle detection
- Bilingual support
- User feedback on unsaved changes
- Well-structured validation service

### Weaknesses:
- Type safety gaps
- API-Frontend contract broken
- Large component file (838 lines)
- No input validation frontend-side
- Missing integration tests
