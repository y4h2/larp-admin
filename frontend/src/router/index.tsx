import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';

// Scripts
import { ScriptList, ScriptDetail } from '@/pages/scripts';

// NPCs
import { NpcList, NpcDetail } from '@/pages/npcs';

// Clues
import { ClueList, ClueDetail, ClueTree } from '@/pages/clues';

// Algorithms
import { ImplementationList, StrategyList, StrategyDetail } from '@/pages/algorithms';

// Experiments
import { DialogueLogs, ABTestConfig, OfflineEvaluation } from '@/pages/experiments';

// Debug
import { DialogueSimulation, ClueDebug } from '@/pages/debug';

// Settings
import { GlobalSettings, UserManagement, AuditLogs } from '@/pages/settings';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/scripts" replace />,
      },
      // Scripts
      {
        path: 'scripts',
        element: <ScriptList />,
      },
      {
        path: 'scripts/:id',
        element: <ScriptDetail />,
      },
      // NPCs
      {
        path: 'npcs',
        element: <NpcList />,
      },
      {
        path: 'npcs/:id',
        element: <NpcDetail />,
      },
      // Clues
      {
        path: 'clues',
        element: <ClueList />,
      },
      {
        path: 'clues/tree',
        element: <ClueTree />,
      },
      {
        path: 'clues/:id',
        element: <ClueDetail />,
      },
      // Algorithms
      {
        path: 'algorithms/implementations',
        element: <ImplementationList />,
      },
      {
        path: 'algorithms/strategies',
        element: <StrategyList />,
      },
      {
        path: 'algorithms/strategies/:id',
        element: <StrategyDetail />,
      },
      // Experiments
      {
        path: 'experiments/logs',
        element: <DialogueLogs />,
      },
      {
        path: 'experiments/evaluation',
        element: <OfflineEvaluation />,
      },
      {
        path: 'experiments/ab-tests',
        element: <ABTestConfig />,
      },
      // Debug
      {
        path: 'debug/simulation',
        element: <DialogueSimulation />,
      },
      {
        path: 'debug/clue',
        element: <ClueDebug />,
      },
      // Settings
      {
        path: 'settings/global',
        element: <GlobalSettings />,
      },
      {
        path: 'settings/users',
        element: <UserManagement />,
      },
      {
        path: 'settings/audit-logs',
        element: <AuditLogs />,
      },
    ],
  },
]);

export default router;
