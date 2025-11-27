/**
 * Database types for Supabase client.
 * Generated based on backend models.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type LLMConfigType = 'embedding' | 'chat';
export type TemplateType = 'clue_embedding' | 'npc_system_prompt' | 'clue_reveal' | 'custom';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Database {
  public: {
    Tables: {
      llm_configs: {
        Row: {
          id: string;
          name: string;
          type: LLMConfigType;
          model: string;
          base_url: string;
          api_key: string;
          is_default: boolean;
          options: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: LLMConfigType;
          model: string;
          base_url: string;
          api_key: string;
          is_default?: boolean;
          options?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          type?: LLMConfigType;
          model?: string;
          base_url?: string;
          api_key?: string;
          is_default?: boolean;
          options?: Json;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      prompt_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: TemplateType;
          content: string;
          is_default: boolean;
          variables: string[];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type: TemplateType;
          content: string;
          is_default?: boolean;
          variables?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: TemplateType;
          content?: string;
          is_default?: boolean;
          variables?: string[];
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      scripts: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          difficulty: Difficulty;
          player_count_min: number;
          player_count_max: number;
          duration_minutes: number;
          background_story: string | null;
          truth: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          difficulty?: Difficulty;
          player_count_min?: number;
          player_count_max?: number;
          duration_minutes?: number;
          background_story?: string | null;
          truth?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          difficulty?: Difficulty;
          player_count_min?: number;
          player_count_max?: number;
          duration_minutes?: number;
          background_story?: string | null;
          truth?: Json;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      npcs: {
        Row: {
          id: string;
          script_id: string;
          name: string;
          role: string | null;
          personality: string | null;
          appearance: string | null;
          knowledge_scope: Json;
          speaking_style: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          script_id: string;
          name: string;
          role?: string | null;
          personality?: string | null;
          appearance?: string | null;
          knowledge_scope?: Json;
          speaking_style?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          script_id?: string;
          name?: string;
          role?: string | null;
          personality?: string | null;
          appearance?: string | null;
          knowledge_scope?: Json;
          speaking_style?: string | null;
          updated_at?: string;
        };
      };
      clues: {
        Row: {
          id: string;
          script_id: string;
          npc_id: string;
          keywords: string[];
          detail: string;
          importance: number;
          is_public: boolean;
          prereq_clue_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          script_id: string;
          npc_id: string;
          keywords?: string[];
          detail: string;
          importance?: number;
          is_public?: boolean;
          prereq_clue_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          script_id?: string;
          npc_id?: string;
          keywords?: string[];
          detail?: string;
          importance?: number;
          is_public?: boolean;
          prereq_clue_ids?: string[];
          updated_at?: string;
        };
      };
      dialogue_logs: {
        Row: {
          id: string;
          session_id: string;
          script_id: string;
          npc_id: string;
          player_message: string;
          npc_response: string | null;
          context: Json;
          matched_clues: Json;
          triggered_clues: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          script_id: string;
          npc_id: string;
          player_message: string;
          npc_response?: string | null;
          context?: Json;
          matched_clues?: Json;
          triggered_clues?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          script_id?: string;
          npc_id?: string;
          player_message?: string;
          npc_response?: string | null;
          context?: Json;
          matched_clues?: Json;
          triggered_clues?: string[];
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      llm_config_type: LLMConfigType;
      template_type: TemplateType;
      difficulty: Difficulty;
    };
  };
}
