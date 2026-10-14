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
      admin_settings: {
        Row: {
          alerts_enabled: boolean
          do_max: number
          do_min: number
          id: string
          ph_max: number
          ph_min: number
          temp_max: number
          temp_min: number
          turbidity_max: number
          updated_at: string
        }
        Insert: {
          alerts_enabled?: boolean
          do_max?: number
          do_min?: number
          id?: string
          ph_max?: number
          ph_min?: number
          temp_max?: number
          temp_min?: number
          turbidity_max?: number
          updated_at?: string
        }
        Update: {
          alerts_enabled?: boolean
          do_max?: number
          do_min?: number
          id?: string
          ph_max?: number
          ph_min?: number
          temp_max?: number
          temp_min?: number
          turbidity_max?: number
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged: boolean
          category: string
          created_at: string
          id: string
          message: string
          pond_id: string | null
          recommendation: string | null
          severity: string
        }
        Insert: {
          acknowledged?: boolean
          category: string
          created_at?: string
          id?: string
          message: string
          pond_id?: string | null
          recommendation?: string | null
          severity?: string
        }
        Update: {
          acknowledged?: boolean
          category?: string
          created_at?: string
          id?: string
          message?: string
          pond_id?: string | null
          recommendation?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bangus_growth_records: {
        Row: {
          age_days: number | null
          avg_length_cm: number | null
          avg_weight_g: number | null
          feeding_notes: string | null
          growth_status: string | null
          id: string
          pond_condition: string | null
          pond_id: string | null
          recorded_at: string
        }
        Insert: {
          age_days?: number | null
          avg_length_cm?: number | null
          avg_weight_g?: number | null
          feeding_notes?: string | null
          growth_status?: string | null
          id?: string
          pond_condition?: string | null
          pond_id?: string | null
          recorded_at?: string
        }
        Update: {
          age_days?: number | null
          avg_length_cm?: number | null
          avg_weight_g?: number | null
          feeding_notes?: string | null
          growth_status?: string | null
          id?: string
          pond_condition?: string | null
          pond_id?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bangus_growth_records_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pond_profiles: {
        Row: {
          area_sqm: number | null
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          stocking_date: string | null
        }
        Insert: {
          area_sqm?: number | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          stocking_date?: string | null
        }
        Update: {
          area_sqm?: number | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          stocking_date?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          generated_by: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      sensor_readings: {
        Row: {
          do_mg_l: number | null
          id: string
          ph: number | null
          pond_id: string | null
          recorded_at: string
          temperature_c: number | null
          turbidity_ntu: number | null
        }
        Insert: {
          do_mg_l?: number | null
          id?: string
          ph?: number | null
          pond_id?: string | null
          recorded_at?: string
          temperature_c?: number | null
          turbidity_ntu?: number | null
        }
        Update: {
          do_mg_l?: number | null
          id?: string
          ph?: number | null
          pond_id?: string | null
          recorded_at?: string
          temperature_c?: number | null
          turbidity_ntu?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_status: {
        Row: {
          error_message: string | null
          id: string
          last_sync: string | null
          pond_id: string | null
          sensor_type: string
          status: string
          updated_at: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_sync?: string | null
          pond_id?: string | null
          sensor_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          last_sync?: string | null
          pond_id?: string | null
          sensor_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensor_status_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator"
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
      app_role: ["admin", "operator"],
    },
  },
} as const
