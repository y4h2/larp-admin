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

// Logs
import { DialogueLogs } from '@/pages/experiments';

// Debug
import { DialogueSimulation, ClueDebug } from '@/pages/debug';

// Settings
import { GlobalSettings } from '@/pages/settings';

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
      // Debug
      {
        path: 'debug/simulation',
        element: <DialogueSimulation />,
      },
      {
        path: 'debug/clue',
        element: <ClueDebug />,
      },
      {
        path: 'debug/logs',
        element: <DialogueLogs />,
      },
      // Settings
      {
        path: 'settings/global',
        element: <GlobalSettings />,
      },
    ],
  },
]);

export default router;
