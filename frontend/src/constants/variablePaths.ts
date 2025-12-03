/**
 * Script entity variable paths for template usage
 */
export const SCRIPT_VARIABLES = {
  title: 'script.title',
  summary: 'script.summary',
  background: 'script.background',
  difficulty: 'script.difficulty',
  'truth.murderer': 'script.truth.murderer',
  'truth.weapon': 'script.truth.weapon',
  'truth.motive': 'script.truth.motive',
  'truth.crime_method': 'script.truth.crime_method',
} as const;

/**
 * NPC entity variable paths for template usage
 */
export const NPC_VARIABLES = {
  name: 'npc.name',
  age: 'npc.age',
  background: 'npc.background',
  personality: 'npc.personality',
  'knowledge_scope.knows': 'npc.knowledge_scope.knows',
  'knowledge_scope.does_not_know': 'npc.knowledge_scope.does_not_know',
  'knowledge_scope.world_model_limits': 'npc.knowledge_scope.world_model_limits',
} as const;

/**
 * Clue entity variable paths for template usage
 */
export const CLUE_VARIABLES = {
  name: 'clue.name',
  type: 'clue.type',
  detail: 'clue.detail',
  detail_for_npc: 'clue.detail_for_npc',
  trigger_keywords: 'clue.trigger_keywords',
  trigger_semantic_summary: 'clue.trigger_semantic_summary',
} as const;
