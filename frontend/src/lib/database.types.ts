export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alembic_version: {
        Row: {
          version_num: string
        }
        Insert: {
          version_num: string
        }
        Update: {
          version_num?: string
        }
        Relationships: []
      }
      clues: {
        Row: {
          created_at: string
          detail: string
          detail_for_npc: string
          id: string
          name: string
          npc_id: string
          prereq_clue_ids: string[]
          script_id: string
          trigger_keywords: string[]
          trigger_semantic_summary: string
          type: Database["public"]["Enums"]["clue_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail: string
          detail_for_npc: string
          id: string
          name: string
          npc_id: string
          prereq_clue_ids: string[]
          script_id: string
          trigger_keywords: string[]
          trigger_semantic_summary: string
          type: Database["public"]["Enums"]["clue_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string
          detail_for_npc?: string
          id?: string
          name?: string
          npc_id?: string
          prereq_clue_ids?: string[]
          script_id?: string
          trigger_keywords?: string[]
          trigger_semantic_summary?: string
          type?: Database["public"]["Enums"]["clue_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clues_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clues_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_audit_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          request_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          context: Json
          created_at?: string
          id: string
          level: Database["public"]["Enums"]["log_level"]
          message: string
          request_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["log_level"]
          message?: string
          request_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dialogue_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          matched_clues: Json
          npc_id: string
          npc_response: string | null
          player_message: string
          script_id: string
          session_id: string
          triggered_clues: string[]
        }
        Insert: {
          context: Json
          created_at?: string
          id: string
          matched_clues: Json
          npc_id: string
          npc_response?: string | null
          player_message: string
          script_id: string
          session_id: string
          triggered_clues: string[]
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          matched_clues?: Json
          npc_id?: string
          npc_response?: string | null
          player_message?: string
          script_id?: string
          session_id?: string
          triggered_clues?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "dialogue_logs_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dialogue_logs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_configs: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          model: string
          name: string
          options: Json
          type: Database["public"]["Enums"]["llm_config_type"]
          updated_at: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          deleted_at?: string | null
          id: string
          is_default: boolean
          model: string
          name: string
          options: Json
          type: Database["public"]["Enums"]["llm_config_type"]
          updated_at?: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          model?: string
          name?: string
          options?: Json
          type?: Database["public"]["Enums"]["llm_config_type"]
          updated_at?: string
        }
        Relationships: []
      }
      npcs: {
        Row: {
          age: number | null
          background: string | null
          created_at: string
          id: string
          knowledge_scope: Json
          name: string
          personality: string | null
          script_id: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          background?: string | null
          created_at?: string
          id: string
          knowledge_scope: Json
          name: string
          personality?: string | null
          script_id: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          background?: string | null
          created_at?: string
          id?: string
          knowledge_scope?: Json
          name?: string
          personality?: string | null
          script_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "npcs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          type: Database["public"]["Enums"]["template_type"]
          updated_at: string
          variables: Json
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id: string
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          variables?: Json
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      scripts: {
        Row: {
          background: string | null
          created_at: string
          deleted_at: string | null
          difficulty: Database["public"]["Enums"]["script_difficulty"]
          id: string
          summary: string | null
          title: string
          truth: Json
          updated_at: string
        }
        Insert: {
          background?: string | null
          created_at?: string
          deleted_at?: string | null
          difficulty: Database["public"]["Enums"]["script_difficulty"]
          id: string
          summary?: string | null
          title: string
          truth: Json
          updated_at?: string
        }
        Update: {
          background?: string | null
          created_at?: string
          deleted_at?: string | null
          difficulty?: Database["public"]["Enums"]["script_difficulty"]
          id?: string
          summary?: string | null
          title?: string
          truth?: Json
          updated_at?: string
        }
        Relationships: []
      }
      session_embeddings: {
        Row: {
          clue_id: string
          content: string
          created_at: string | null
          embedding: string | null
          id: number
          npc_id: string
          session_key: string
        }
        Insert: {
          clue_id: string
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: number
          npc_id: string
          session_key: string
        }
        Update: {
          clue_id?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: number
          npc_id?: string
          session_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      clue_type: "text" | "image"
      llm_config_type: "embedding" | "chat"
      log_level: "debug" | "info" | "warn" | "error"
      script_difficulty: "easy" | "medium" | "hard"
      template_type:
        | "clue_embedding"
        | "npc_system_prompt"
        | "clue_reveal"
        | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      clue_type: ["text", "image"],
      llm_config_type: ["embedding", "chat"],
      log_level: ["debug", "info", "warn", "error"],
      script_difficulty: ["easy", "medium", "hard"],
      template_type: [
        "clue_embedding",
        "npc_system_prompt",
        "clue_reveal",
        "custom",
      ],
    },
  },
} as const
