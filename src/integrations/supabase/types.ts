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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          alerts_enabled: boolean
          critical_do_high: number | null
          critical_ph_high: number | null
          critical_ph_low: number | null
          critical_temp_low: number | null
          critical_turbidity_high: number | null
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
          critical_do_high?: number | null
          critical_ph_high?: number | null
          critical_ph_low?: number | null
          critical_temp_low?: number | null
          critical_turbidity_high?: number | null
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
          critical_do_high?: number | null
          critical_ph_high?: number | null
          critical_ph_low?: number | null
          critical_temp_low?: number | null
          critical_turbidity_high?: number | null
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
      alert_notification_events: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          message: string
          notification_type: string
          pond_id: string
          recommendation: string | null
          severity: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          message: string
          notification_type: string
          pond_id: string
          recommendation?: string | null
          severity: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          message?: string
          notification_type?: string
          pond_id?: string
          recommendation?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_notification_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notification_events_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: string
          condition_key: string | null
          created_at: string
          id: string
          last_detected_at: string | null
          last_notified_at: string | null
          last_processed_reading_at: string | null
          last_reading_id: string | null
          last_sensor_value: number | null
          legacy_archived_at: string | null
          message: string
          normal_reading_streak: number
          pond_id: string | null
          recommendation: string | null
          reminder_count: number
          resolution_reason: string | null
          resolved_at: string | null
          sensor_type: string | null
          severity: string
          status: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category: string
          condition_key?: string | null
          created_at?: string
          id?: string
          last_detected_at?: string | null
          last_notified_at?: string | null
          last_processed_reading_at?: string | null
          last_reading_id?: string | null
          last_sensor_value?: number | null
          legacy_archived_at?: string | null
          message: string
          normal_reading_streak?: number
          pond_id?: string | null
          recommendation?: string | null
          reminder_count?: number
          resolution_reason?: string | null
          resolved_at?: string | null
          sensor_type?: string | null
          severity?: string
          status?: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string
          condition_key?: string | null
          created_at?: string
          id?: string
          last_detected_at?: string | null
          last_notified_at?: string | null
          last_processed_reading_at?: string | null
          last_reading_id?: string | null
          last_sensor_value?: number | null
          legacy_archived_at?: string | null
          message?: string
          normal_reading_streak?: number
          pond_id?: string | null
          recommendation?: string | null
          reminder_count?: number
          resolution_reason?: string | null
          resolved_at?: string | null
          sensor_type?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_last_reading_id_fkey"
            columns: ["last_reading_id"]
            isOneToOne: false
            referencedRelation: "sensor_readings"
            referencedColumns: ["id"]
          },
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
          fish_batch_id: string | null
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
          fish_batch_id?: string | null
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
          fish_batch_id?: string | null
          growth_status?: string | null
          id?: string
          pond_condition?: string | null
          pond_id?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bangus_growth_records_batch_pond_fkey"
            columns: ["fish_batch_id", "pond_id"]
            isOneToOne: false
            referencedRelation: "fish_batches"
            referencedColumns: ["id", "pond_id"]
          },
          {
            foreignKeyName: "bangus_growth_records_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fish_batches: {
        Row: {
          batch_name: string
          created_at: string
          id: string
          initial_length_cm: number | null
          initial_weight_g: number | null
          is_active: boolean
          pond_id: string
          stocked_fish_count: number | null
          stocking_date: string
        }
        Insert: {
          batch_name: string
          created_at?: string
          id?: string
          initial_length_cm?: number | null
          initial_weight_g?: number | null
          is_active?: boolean
          pond_id: string
          stocked_fish_count?: number | null
          stocking_date: string
        }
        Update: {
          batch_name?: string
          created_at?: string
          id?: string
          initial_length_cm?: number | null
          initial_weight_g?: number | null
          is_active?: boolean
          pond_id?: string
          stocked_fish_count?: number | null
          stocking_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fish_batches_pond_id_fkey"
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
      report_recipients: {
        Row: {
          report_id: string
          user_id: string
        }
        Insert: {
          report_id: string
          user_id: string
        }
        Update: {
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_recipients_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          file_path: string | null
          fish_batch_id: string | null
          generated_by: string | null
          id: string
          period_end: string | null
          period_start: string | null
          pond_id: string | null
          published_at: string | null
          report_data: Json | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          fish_batch_id?: string | null
          generated_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          pond_id?: string | null
          published_at?: string | null
          report_data?: Json | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string | null
          fish_batch_id?: string | null
          generated_by?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          pond_id?: string | null
          published_at?: string | null
          report_data?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_batch_pond_fkey"
            columns: ["fish_batch_id", "pond_id"]
            isOneToOne: false
            referencedRelation: "fish_batches"
            referencedColumns: ["id", "pond_id"]
          },
          {
            foreignKeyName: "reports_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      growth_records_with_water_averages: {
        Row: {
          age_days: number | null
          average_end_date: string | null
          average_start_date: string | null
          avg_do_mg_l: number | null
          avg_length_cm: number | null
          avg_ph: number | null
          avg_temperature_c: number | null
          avg_turbidity_ntu: number | null
          avg_weight_g: number | null
          batch_name: string | null
          do_reading_count: number | null
          do_source: string | null
          feeding_notes: string | null
          fish_batch_id: string | null
          growth_status: string | null
          id: string | null
          measurement_date: string | null
          ph_reading_count: number | null
          pond_condition: string | null
          pond_id: string | null
          pond_name: string | null
          recorded_at: string | null
          stocking_date: string | null
          temperature_reading_count: number | null
          turbidity_reading_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bangus_growth_records_batch_pond_fkey"
            columns: ["fish_batch_id", "pond_id"]
            isOneToOne: false
            referencedRelation: "fish_batches"
            referencedColumns: ["id", "pond_id"]
          },
          {
            foreignKeyName: "bangus_growth_records_pond_id_fkey"
            columns: ["pond_id"]
            isOneToOne: false
            referencedRelation: "pond_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_water_alert_condition: {
        Args: {
          p_alerts_enabled: boolean
          p_category: string
          p_condition_key: string
          p_is_abnormal: boolean
          p_message: string
          p_parameter_normal: boolean
          p_pond_id: string
          p_reading_id: string
          p_recommendation: string
          p_recorded_at: string
          p_sensor_type: string
          p_severity: string
          p_value: number
        }
        Returns: undefined
      }
      consume_password_reset_rate_limit: {
        Args: {
          p_email_digest: string
          p_ip_digest: string
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      create_pond_report: {
        Args: {
          p_batch_id: string | null
          p_description: string
          p_operator_ids: string[]
          p_period_end: string
          p_period_start: string
          p_pond_id: string
          p_title: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_report_recipients: {
        Args: {
          p_operator_ids: string[]
          p_report_id: string
        }
        Returns: undefined
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
    Enums: {
      app_role: ["admin", "operator"],
    },
  },
} as const
