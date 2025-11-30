import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';

// Auth
import { Login } from '@/pages/auth';

// Scripts
import { ScriptList, ScriptDetail } from '@/pages/scripts';

// NPCs
import { NpcList, NpcDetail } from '@/pages/npcs';

// Clues
import { ClueList, ClueDetail, ClueTree } from '@/pages/clues';

// Logs
import { DialogueLogs } from '@/pages/experiments';

// Debug
import { DialogueSimulation } from '@/pages/debug';

// Templates
import { TemplateList, TemplateDetail } from '@/pages/templates';

// LLM Configs
import { LLMConfigList } from '@/pages/llm-configs';

const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <Login />,
  },
  // Protected routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
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
      // Debug
      {
        path: 'debug/simulation',
        element: <DialogueSimulation />,
      },
      {
        path: 'debug/logs',
        element: <DialogueLogs />,
      },
      // Settings
      {
        path: 'settings/templates',
        element: <TemplateList />,
      },
      {
        path: 'settings/templates/:id',
        element: <TemplateDetail />,
      },
      {
        path: 'settings/llm-configs',
        element: <LLMConfigList />,
      },
    ],
  },
]);

export default router;
