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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendances: {
        Row: {
          attendance_date: string
          check_in_time: string | null
          created_at: string
          id: string
          qr_token: string | null
          schedule_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
          validated_by: string | null
        }
        Insert: {
          attendance_date: string
          check_in_time?: string | null
          created_at?: string
          id?: string
          qr_token?: string | null
          schedule_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id: string
          validated_by?: string | null
        }
        Update: {
          attendance_date?: string
          check_in_time?: string | null
          created_at?: string
          id?: string
          qr_token?: string | null
          schedule_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendances_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          academic_year: string | null
          code: string
          created_at: string
          id: string
          name: string
          semester: string | null
        }
        Insert: {
          academic_year?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          semester?: string | null
        }
        Update: {
          academic_year?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          semester?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          created_at: string
          id: string
          schedule_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          schedule_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      elearning_progress: {
        Row: {
          id: string
          nim: string
          student_name: string | null
          completed_lessons: number
          total_lessons: number
          completion_percentage: number
          quiz_score: number | null
          quiz_attempts: number
          lesson_details: Json
          is_completed: boolean
          last_accessed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nim: string
          student_name?: string | null
          completed_lessons?: number
          total_lessons?: number
          completion_percentage?: number
          quiz_score?: number | null
          quiz_attempts?: number
          lesson_details?: Json
          is_completed?: boolean
          last_accessed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nim?: string
          student_name?: string | null
          completed_lessons?: number
          total_lessons?: number
          completion_percentage?: number
          quiz_score?: number | null
          quiz_attempts?: number
          lesson_details?: Json
          is_completed?: boolean
          last_accessed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          available_quantity: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          total_quantity: number
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          total_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          module_number: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          module_number: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          module_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          division: string | null
          full_name: string
          id: string
          npm: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          division?: string | null
          full_name: string
          id?: string
          npm?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          division?: string | null
          full_name?: string
          id?: string
          npm?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          actual_return_date: string | null
          created_at: string
          id: string
          item_id: string
          notes: string | null
          quantity: number
          rental_date: string
          return_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          actual_return_date?: string | null
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          quantity?: number
          rental_date: string
          return_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          actual_return_date?: string | null
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          rental_date?: string
          return_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          assistant_id: string
          created_at: string
          id: string
          schedule_id: string
          shift_date: string
          status: Database["public"]["Enums"]["shift_status"]
        }
        Insert: {
          assistant_id: string
          created_at?: string
          id?: string
          schedule_id: string
          shift_date: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Update: {
          assistant_id?: string
          created_at?: string
          id?: string
          schedule_id?: string
          shift_date?: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          feedback: string | null
          file_name: string
          file_size: number
          file_url: string
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          module_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          feedback?: string | null
          file_name: string
          file_size: number
          file_url: string
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          module_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          feedback?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          module_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_requests: {
        Row: {
          created_at: string
          id: string
          original_shift_id: string
          reason: string | null
          requester_id: string
          status: Database["public"]["Enums"]["swap_status"]
          target_id: string
          target_shift_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_shift_id: string
          reason?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["swap_status"]
          target_id: string
          target_shift_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          original_shift_id?: string
          reason?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["swap_status"]
          target_id?: string
          target_shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_original_shift_id_fkey"
            columns: ["original_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_target_shift_id_fkey"
            columns: ["target_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "mahasiswa" | "asisten" | "koordinator"
      attendance_status: "hadir" | "izin" | "alpha"
      shift_status: "pending" | "approved" | "rejected"
      swap_status: "pending" | "approved" | "rejected"
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
      app_role: ["mahasiswa", "asisten", "koordinator"],
      attendance_status: ["hadir", "izin", "alpha"],
      shift_status: ["pending", "approved", "rejected"],
      swap_status: ["pending", "approved", "rejected"],
    },
  },
} as const
export const MASTER_MENUS = [
  { key: "/absensi", label: "Absensi & Izin" },
  { key: "/jadwal-jaga", label: "Jadwal Jaga" },
  { key: "/validasi-absensi", label: "Validasi Absensi" },
  { key: "/inventaris", label: "Inventaris Barang" },
  { key: "/manajemen-user", label: "Manajemen User" },
  { key: "/laporan-keuangan", label: "Laporan Keuangan" },
];
