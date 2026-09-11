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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      room_player_states: {
        Row: {
          moving: boolean
          player_id: string
          pos_x: number
          pos_y: number
          pos_z: number
          room_code: string
          updated_at: string
          yaw: number
        }
        Insert: {
          moving?: boolean
          player_id: string
          pos_x: number
          pos_y: number
          pos_z: number
          room_code: string
          updated_at?: string
          yaw: number
        }
        Update: {
          moving?: boolean
          player_id?: string
          pos_x?: number
          pos_y?: number
          pos_z?: number
          room_code?: string
          updated_at?: string
          yaw?: number
        }
        Relationships: []
      }
      room_players: {
        Row: {
          color: string
          connected: boolean
          id: string
          is_host: boolean
          joined_at: string
          name: string
          player_id: string
          room_code: string
          slot: number
        }
        Insert: {
          color: string
          connected?: boolean
          id?: string
          is_host?: boolean
          joined_at?: string
          name: string
          player_id: string
          room_code: string
          slot: number
        }
        Update: {
          color?: string
          connected?: boolean
          id?: string
          is_host?: boolean
          joined_at?: string
          name?: string
          player_id?: string
          room_code?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_players_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      rooms: {
        Row: {
          bot_difficulty: string
          code: string
          core_restoration: boolean
          created_at: string
          fill_with_bots: boolean
          host_id: string
          max_players: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bot_difficulty?: string
          code: string
          core_restoration?: boolean
          created_at?: string
          fill_with_bots?: boolean
          host_id: string
          max_players?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bot_difficulty?: string
          code?: string
          core_restoration?: boolean
          created_at?: string
          fill_with_bots?: boolean
          host_id?: string
          max_players?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_room: {
        Args: {
          p_bot_difficulty: string
          p_code: string
          p_color: string
          p_core_restoration: boolean
          p_fill_with_bots: boolean
          p_host_id: string
          p_name: string
        }
        Returns: Json
      }
      join_room: {
        Args: {
          p_code: string
          p_color: string
          p_name: string
          p_player_id: string
        }
        Returns: Json
      }
      leave_room: {
        Args: { p_code: string; p_player_id: string }
        Returns: Json
      }
      start_room_match: {
        Args: { p_code: string; p_host_id: string }
        Returns: Json
      }
      update_room_settings: {
        Args: {
          p_bot_difficulty: string
          p_code: string
          p_core_restoration: boolean
          p_fill_with_bots: boolean
          p_host_id: string
        }
        Returns: Json
      }
      update_room_player_color: {
        Args: { p_code: string; p_color: string; p_player_id: string }
        Returns: Json
      }
      update_room_player_state: {
        Args: {
          p_code: string
          p_moving: boolean
          p_player_id: string
          p_pos_x: number
          p_pos_y: number
          p_pos_z: number
          p_yaw: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
