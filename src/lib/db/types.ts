export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          claim_invitation_id: string | null
          created_at: string
          delivery_status: string
          email: string
          expires_at: string
          id: string
          invited_by_user_id: string | null
          invited_role_code: string
          last_sent_at: string | null
          note: string | null
          provider_message_id: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          send_attempts: number
          status: string
          target_admin_profile_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          claim_invitation_id?: string | null
          created_at?: string
          delivery_status?: string
          email: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string | null
          invited_role_code: string
          last_sent_at?: string | null
          note?: string | null
          provider_message_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          send_attempts?: number
          status?: string
          target_admin_profile_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          claim_invitation_id?: string | null
          created_at?: string
          delivery_status?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string | null
          invited_role_code?: string
          last_sent_at?: string | null
          note?: string | null
          provider_message_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          send_attempts?: number
          status?: string
          target_admin_profile_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_invitations_claim_invitation_id_fkey"
            columns: ["claim_invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_invitations_target_admin_profile_id_fkey"
            columns: ["target_admin_profile_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          admin_code: string
          avatar_bytes: number | null
          avatar_format: string | null
          avatar_height: number | null
          avatar_public_id: string | null
          avatar_secure_url: string | null
          avatar_updated_at: string | null
          avatar_updated_by_user_id: string | null
          avatar_width: number | null
          created_at: string
          created_by_user_id: string | null
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          linked_member_id: string | null
          status: string
          status_reason: string | null
          status_updated_at: string
          status_updated_by_user_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_code: string
          avatar_bytes?: number | null
          avatar_format?: string | null
          avatar_height?: number | null
          avatar_public_id?: string | null
          avatar_secure_url?: string | null
          avatar_updated_at?: string | null
          avatar_updated_by_user_id?: string | null
          avatar_width?: number | null
          created_at?: string
          created_by_user_id?: string | null
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          linked_member_id?: string | null
          status?: string
          status_reason?: string | null
          status_updated_at?: string
          status_updated_by_user_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_code?: string
          avatar_bytes?: number | null
          avatar_format?: string | null
          avatar_height?: number | null
          avatar_public_id?: string | null
          avatar_secure_url?: string | null
          avatar_updated_at?: string | null
          avatar_updated_by_user_id?: string | null
          avatar_width?: number | null
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          linked_member_id?: string | null
          status?: string
          status_reason?: string | null
          status_updated_at?: string
          status_updated_by_user_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_profiles_linked_member_id_fkey"
            columns: ["linked_member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_profiles: {
        Row: {
          advisor_jnuits_id: string | null
          advisor_type: string
          avatar_public_id: string | null
          avatar_secure_url: string | null
          bio: string | null
          created_at: string
          created_by_user_id: string | null
          date_confidence: string
          department: string | null
          designation: string | null
          email: string | null
          facebook_url: string | null
          former_title: string | null
          full_name: string
          id: string
          is_current: boolean
          is_public: boolean
          jnu_profile_url: string | null
          joined_on: string | null
          left_on: string | null
          linkedin_url: string | null
          phone: string | null
          publications: Json
          sort_order: number
          speech: string | null
          speech_updated_at: string | null
          status_note: string | null
          tenure_display: string | null
          title: string | null
          updated_at: string
          user_id: string | null
          website_url: string | null
          work_experience: Json
        }
        Insert: {
          advisor_jnuits_id?: string | null
          advisor_type?: string
          avatar_public_id?: string | null
          avatar_secure_url?: string | null
          bio?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_confidence?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          facebook_url?: string | null
          former_title?: string | null
          full_name: string
          id?: string
          is_current?: boolean
          is_public?: boolean
          jnu_profile_url?: string | null
          joined_on?: string | null
          left_on?: string | null
          linkedin_url?: string | null
          phone?: string | null
          publications?: Json
          sort_order?: number
          speech?: string | null
          speech_updated_at?: string | null
          status_note?: string | null
          tenure_display?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          work_experience?: Json
        }
        Update: {
          advisor_jnuits_id?: string | null
          advisor_type?: string
          avatar_public_id?: string | null
          avatar_secure_url?: string | null
          bio?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_confidence?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          facebook_url?: string | null
          former_title?: string | null
          full_name?: string
          id?: string
          is_current?: boolean
          is_public?: boolean
          jnu_profile_url?: string | null
          joined_on?: string | null
          left_on?: string | null
          linkedin_url?: string | null
          phone?: string | null
          publications?: Json
          sort_order?: number
          speech?: string | null
          speech_updated_at?: string | null
          status_note?: string | null
          tenure_display?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          website_url?: string | null
          work_experience?: Json
        }
        Relationships: []
      }
      alumni_onboarding_cases: {
        Row: {
          created_at: string
          email: string | null
          form_submission_id: string
          full_name: string | null
          id: string
          invitation_id: string | null
          jnuits_id: string | null
          processed_member_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          form_submission_id: string
          full_name?: string | null
          id?: string
          invitation_id?: string | null
          jnuits_id?: string | null
          processed_member_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          form_submission_id?: string
          full_name?: string | null
          id?: string
          invitation_id?: string | null
          jnuits_id?: string | null
          processed_member_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alumni_onboarding_cases_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: true
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_onboarding_cases_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_onboarding_cases_processed_member_id_fkey"
            columns: ["processed_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      blog_review_events: {
        Row: {
          action: string
          created_at: string
          id: string
          note: string | null
          post_id: string
          reviewer_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          note?: string | null
          post_id: string
          reviewer_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          note?: string | null
          post_id?: string
          reviewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_review_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_operation_rows: {
        Row: {
          created_at: string
          errors: Json
          excluded_at: string | null
          excluded_by_user_id: string | null
          exclusion_reason: string | null
          id: string
          is_excluded: boolean
          normalized_data: Json
          operation_id: string
          raw_data: Json
          result: Json
          row_number: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          excluded_at?: string | null
          excluded_by_user_id?: string | null
          exclusion_reason?: string | null
          id?: string
          is_excluded?: boolean
          normalized_data?: Json
          operation_id: string
          raw_data?: Json
          result?: Json
          row_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          errors?: Json
          excluded_at?: string | null
          excluded_by_user_id?: string | null
          exclusion_reason?: string | null
          id?: string
          is_excluded?: boolean
          normalized_data?: Json
          operation_id?: string
          raw_data?: Json
          result?: Json
          row_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_operation_rows_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "bulk_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_operations: {
        Row: {
          committed_at: string | null
          committed_by_user_id: string | null
          committed_rows: number
          created_at: string
          created_by_user_id: string | null
          draft_revision: number
          error_rows: number
          id: string
          metadata: Json
          operation_type: string
          original_filename: string | null
          previewed_at: string | null
          source_kind: string | null
          source_sha256: string | null
          status: string
          target_term_id: string | null
          total_rows: number
          updated_at: string
          valid_rows: number
          validated_at: string | null
          validated_revision: number | null
        }
        Insert: {
          committed_at?: string | null
          committed_by_user_id?: string | null
          committed_rows?: number
          created_at?: string
          created_by_user_id?: string | null
          draft_revision?: number
          error_rows?: number
          id?: string
          metadata?: Json
          operation_type: string
          original_filename?: string | null
          previewed_at?: string | null
          source_kind?: string | null
          source_sha256?: string | null
          status?: string
          target_term_id?: string | null
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validated_at?: string | null
          validated_revision?: number | null
        }
        Update: {
          committed_at?: string | null
          committed_by_user_id?: string | null
          committed_rows?: number
          created_at?: string
          created_by_user_id?: string | null
          draft_revision?: number
          error_rows?: number
          id?: string
          metadata?: Json
          operation_type?: string
          original_filename?: string | null
          previewed_at?: string | null
          source_kind?: string | null
          source_sha256?: string | null
          status?: string
          target_term_id?: string | null
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validated_at?: string | null
          validated_revision?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_operations_target_term_id_fkey"
            columns: ["target_term_id"]
            isOneToOne: false
            referencedRelation: "committee_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_import_batches: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          finished_at: string | null
          id: string
          inserted_count: number
          rejected_count: number
          report: Json
          source_checksum: string | null
          source_name: string
          source_row_count: number
          started_at: string
          status: string
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          rejected_count?: number
          report?: Json
          source_checksum?: string | null
          source_name: string
          source_row_count?: number
          started_at?: string
          status?: string
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          rejected_count?: number
          report?: Json
          source_checksum?: string | null
          source_name?: string
          source_row_count?: number
          started_at?: string
          status?: string
          updated_count?: number
        }
        Relationships: []
      }
      certificates: {
        Row: {
          asset_url: string | null
          certificate_id: string
          created_at: string
          details: string
          exam_or_event: string
          exam_or_event_name: string
          full_name: string
          id: string
          issue_date: string
          source_document_id: string | null
          source_migrated_at: string
          source_record_id: string | null
          updated_at: string
        }
        Insert: {
          asset_url?: string | null
          certificate_id: string
          created_at?: string
          details?: string
          exam_or_event: string
          exam_or_event_name: string
          full_name: string
          id?: string
          issue_date: string
          source_document_id?: string | null
          source_migrated_at?: string
          source_record_id?: string | null
          updated_at?: string
        }
        Update: {
          asset_url?: string | null
          certificate_id?: string
          created_at?: string
          details?: string
          exam_or_event?: string
          exam_or_event_name?: string
          full_name?: string
          id?: string
          issue_date?: string
          source_document_id?: string | null
          source_migrated_at?: string
          source_record_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      certificates_import_staging: {
        Row: {
          asset_url_raw: string | null
          certificate_id_raw: string | null
          details_raw: string | null
          exam_or_event_name_raw: string | null
          exam_or_event_raw: string | null
          first_name_raw: string | null
          full_name_raw: string | null
          id: string
          import_batch_id: string
          imported_at: string
          issue_date_raw: string | null
          last_name_raw: string | null
          parse_error: string | null
          row_number: number
          source_document_id_raw: string | null
          source_record_id_raw: string | null
        }
        Insert: {
          asset_url_raw?: string | null
          certificate_id_raw?: string | null
          details_raw?: string | null
          exam_or_event_name_raw?: string | null
          exam_or_event_raw?: string | null
          first_name_raw?: string | null
          full_name_raw?: string | null
          id?: string
          import_batch_id: string
          imported_at?: string
          issue_date_raw?: string | null
          last_name_raw?: string | null
          parse_error?: string | null
          row_number: number
          source_document_id_raw?: string | null
          source_record_id_raw?: string | null
        }
        Update: {
          asset_url_raw?: string | null
          certificate_id_raw?: string | null
          details_raw?: string | null
          exam_or_event_name_raw?: string | null
          exam_or_event_raw?: string | null
          first_name_raw?: string | null
          full_name_raw?: string | null
          id?: string
          import_batch_id?: string
          imported_at?: string
          issue_date_raw?: string | null
          last_name_raw?: string | null
          parse_error?: string | null
          row_number?: number
          source_document_id_raw?: string | null
          source_record_id_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_import_staging_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "certificate_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_assignments: {
        Row: {
          bio: string | null
          created_at: string
          created_by_user_id: string | null
          display_name: string | null
          ends_on: string | null
          id: string
          import_batch_id: string | null
          is_public: boolean
          member_id: string | null
          metadata: Json
          public_title_override: string | null
          role_id: string
          rollover_source_assignment_id: string | null
          sort_order: number
          source: string
          starts_on: string | null
          status: string
          term_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string | null
          ends_on?: string | null
          id?: string
          import_batch_id?: string | null
          is_public?: boolean
          member_id?: string | null
          metadata?: Json
          public_title_override?: string | null
          role_id: string
          rollover_source_assignment_id?: string | null
          sort_order?: number
          source?: string
          starts_on?: string | null
          status?: string
          term_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          created_by_user_id?: string | null
          display_name?: string | null
          ends_on?: string | null
          id?: string
          import_batch_id?: string | null
          is_public?: boolean
          member_id?: string | null
          metadata?: Json
          public_title_override?: string | null
          role_id?: string
          rollover_source_assignment_id?: string | null
          sort_order?: number
          source?: string
          starts_on?: string | null
          status?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "committee_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_rollover_source_assignment_id_fkey"
            columns: ["rollover_source_assignment_id"]
            isOneToOne: false
            referencedRelation: "committee_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_assignments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "committee_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_roles: {
        Row: {
          aliases: string[]
          code: string
          created_at: string
          default_slots: number
          id: string
          is_executive: boolean
          is_public: boolean
          max_slots: number
          min_slots: number
          role_group: string
          sort_order: number
          title: string
          title_bn: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          code: string
          created_at?: string
          default_slots?: number
          id?: string
          is_executive?: boolean
          is_public?: boolean
          max_slots?: number
          min_slots?: number
          role_group?: string
          sort_order?: number
          title: string
          title_bn?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          code?: string
          created_at?: string
          default_slots?: number
          id?: string
          is_executive?: boolean
          is_public?: boolean
          max_slots?: number
          min_slots?: number
          role_group?: string
          sort_order?: number
          title?: string
          title_bn?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      committee_term_positions: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          is_public: boolean
          max_slots: number
          min_slots: number
          priority: number
          public_label: string
          public_label_bn: string | null
          role_group: string
          role_id: string
          target_slots: number
          term_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_public?: boolean
          max_slots?: number
          min_slots?: number
          priority?: number
          public_label: string
          public_label_bn?: string | null
          role_group?: string
          role_id: string
          target_slots?: number
          term_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_public?: boolean
          max_slots?: number
          min_slots?: number
          priority?: number
          public_label?: string
          public_label_bn?: string | null
          role_group?: string
          role_id?: string
          target_slots?: number
          term_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_term_positions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "committee_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_term_positions_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "committee_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_terms: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          date_confidence: string
          election_date: string | null
          ends_on: string | null
          id: string
          is_current: boolean
          is_public: boolean
          rollover_source_term_id: string | null
          slug: string
          starts_on: string
          status: string
          summary: string | null
          target_executive_slots: number
          tenure_note: string | null
          term_kind: string
          term_number: number | null
          title: string
          updated_at: string
          voter_rule_note: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          date_confidence?: string
          election_date?: string | null
          ends_on?: string | null
          id?: string
          is_current?: boolean
          is_public?: boolean
          rollover_source_term_id?: string | null
          slug: string
          starts_on: string
          status?: string
          summary?: string | null
          target_executive_slots?: number
          tenure_note?: string | null
          term_kind?: string
          term_number?: number | null
          title: string
          updated_at?: string
          voter_rule_note?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          date_confidence?: string
          election_date?: string | null
          ends_on?: string | null
          id?: string
          is_current?: boolean
          is_public?: boolean
          rollover_source_term_id?: string | null
          slug?: string
          starts_on?: string
          status?: string
          summary?: string | null
          target_executive_slots?: number
          tenure_note?: string | null
          term_kind?: string
          term_number?: number | null
          title?: string
          updated_at?: string
          voter_rule_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_terms_rollover_source_term_id_fkey"
            columns: ["rollover_source_term_id"]
            isOneToOne: false
            referencedRelation: "committee_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_settings: {
        Row: {
          description: string | null
          group_name: string
          id: string
          input_type: string
          is_public: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          group_name?: string
          id?: string
          input_type?: string
          is_public?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          group_name?: string
          id?: string
          input_type?: string
          is_public?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          body: Json
          created_at: string
          created_by_user_id: string | null
          eyebrow: string | null
          id: string
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          created_at?: string
          created_by_user_id?: string | null
          eyebrow?: string | null
          id?: string
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          created_at?: string
          created_by_user_id?: string | null
          eyebrow?: string | null
          id?: string
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_posts: {
        Row: {
          author_advisor_profile_id: string | null
          author_member_id: string | null
          body: string | null
          category: string | null
          content_type: string
          created_at: string
          created_by_user_id: string | null
          cta_href: string | null
          ends_at: string | null
          event_capacity: number | null
          excerpt: string | null
          id: string
          location: string | null
          media_asset_id: string | null
          published_at: string | null
          read_time: string | null
          registration_closes_at: string | null
          registration_open: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          slug: string
          starts_at: string | null
          status: string
          submitted_at: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_advisor_profile_id?: string | null
          author_member_id?: string | null
          body?: string | null
          category?: string | null
          content_type: string
          created_at?: string
          created_by_user_id?: string | null
          cta_href?: string | null
          ends_at?: string | null
          event_capacity?: number | null
          excerpt?: string | null
          id?: string
          location?: string | null
          media_asset_id?: string | null
          published_at?: string | null
          read_time?: string | null
          registration_closes_at?: string | null
          registration_open?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          slug: string
          starts_at?: string | null
          status?: string
          submitted_at?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_advisor_profile_id?: string | null
          author_member_id?: string | null
          body?: string | null
          category?: string | null
          content_type?: string
          created_at?: string
          created_by_user_id?: string | null
          cta_href?: string | null
          ends_at?: string | null
          event_capacity?: number | null
          excerpt?: string | null
          id?: string
          location?: string | null
          media_asset_id?: string | null
          published_at?: string | null
          read_time?: string | null
          registration_closes_at?: string | null
          registration_open?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          slug?: string
          starts_at?: string | null
          status?: string
          submitted_at?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_author_advisor_profile_id_fkey"
            columns: ["author_advisor_profile_id"]
            isOneToOne: false
            referencedRelation: "advisor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_media_id"]
          },
          {
            foreignKeyName: "content_posts_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      department_aliases: {
        Row: {
          alias: string
          alias_kind: string
          created_at: string
          department_code: string
          is_active: boolean
          normalized_alias: string
          updated_at: string
        }
        Insert: {
          alias: string
          alias_kind: string
          created_at?: string
          department_code: string
          is_active?: boolean
          normalized_alias?: string
          updated_at?: string
        }
        Update: {
          alias?: string
          alias_kind?: string
          created_at?: string
          department_code?: string
          is_active?: boolean
          normalized_alias?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_aliases_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          short_code: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          short_code: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          short_code?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      developer_profiles: {
        Row: {
          bio: string
          created_at: string
          created_by_user_id: string | null
          focus: string
          id: string
          is_lead: boolean
          media_asset_id: string | null
          name: string
          role: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          bio: string
          created_at?: string
          created_by_user_id?: string | null
          focus: string
          id?: string
          is_lead?: boolean
          media_asset_id?: string | null
          name: string
          role: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          created_by_user_id?: string | null
          focus?: string
          id?: string
          is_lead?: boolean
          media_asset_id?: string | null
          name?: string
          role?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_profiles_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_media_id"]
          },
          {
            foreignKeyName: "developer_profiles_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_export_jobs: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          destination: string
          error_code: string | null
          event_id: string
          expires_at: string | null
          export_kind: string
          filter_metadata: Json
          format: string
          google_drive_file_id: string | null
          id: string
          requested_by_user_id: string
          row_count: number
          status: string
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          destination?: string
          error_code?: string | null
          event_id: string
          expires_at?: string | null
          export_kind?: string
          filter_metadata?: Json
          format: string
          google_drive_file_id?: string | null
          id?: string
          requested_by_user_id: string
          row_count?: number
          status?: string
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          destination?: string
          error_code?: string | null
          event_id?: string
          expires_at?: string | null
          export_kind?: string
          filter_metadata?: Json
          format?: string
          google_drive_file_id?: string | null
          id?: string
          requested_by_user_id?: string
          row_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_export_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_deliveries: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          id: string
          idempotency_key: string
          last_provider_event_at: string | null
          provider_message_id: string | null
          registration_code: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          id?: string
          idempotency_key: string
          last_provider_event_at?: string | null
          provider_message_id?: string | null
          registration_code: string
          sent_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          id?: string
          idempotency_key?: string
          last_provider_event_at?: string | null
          provider_message_id?: string | null
          registration_code?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_deliveries_registration_code_fkey"
            columns: ["registration_code"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["registration_code"]
          },
        ]
      }
      event_registration_delivery_webhook_events: {
        Row: {
          created_at: string
          delivery_status: string | null
          event_id: string
          event_registration_delivery_id: string
          event_type: string
          id: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string
          registration_code: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string | null
          event_id: string
          event_registration_delivery_id: string
          event_type: string
          id?: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string
          registration_code: string
        }
        Update: {
          created_at?: string
          delivery_status?: string | null
          event_id?: string
          event_registration_delivery_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          provider_event_id?: string
          provider_message_id?: string
          registration_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_delivery_w_event_registration_delivery__fkey"
            columns: ["event_registration_delivery_id"]
            isOneToOne: false
            referencedRelation: "event_registration_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_delivery_webhook_even_registration_code_fkey"
            columns: ["registration_code"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["registration_code"]
          },
          {
            foreignKeyName: "event_registration_delivery_webhook_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          cancelled_at: string | null
          checked_in_at: string | null
          created_at: string
          event_id: string | null
          event_post_id: string | null
          id: string
          member_id: string | null
          promoted_at: string | null
          promoted_by_user_id: string | null
          registrant_email: string
          registrant_name: string
          registrant_phone: string | null
          registration_code: string
          registration_status: string
          waitlisted_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id?: string | null
          event_post_id?: string | null
          id?: string
          member_id?: string | null
          promoted_at?: string | null
          promoted_by_user_id?: string | null
          registrant_email: string
          registrant_name: string
          registrant_phone?: string | null
          registration_code?: string
          registration_status?: string
          waitlisted_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id?: string | null
          event_post_id?: string | null
          id?: string
          member_id?: string | null
          promoted_at?: string | null
          promoted_by_user_id?: string | null
          registrant_email?: string
          registrant_name?: string
          registrant_phone?: string | null
          registration_code?: string
          registration_status?: string
          waitlisted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_post_id_fkey"
            columns: ["event_post_id"]
            isOneToOne: false
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_retention_jobs: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          archive_export_job_id: string | null
          archive_manifest: Json
          created_at: string
          error_code: string | null
          event_id: string
          id: string
          manifest_checksum_sha256: string | null
          requested_by_user_id: string
          retention_eligible_at: string
          source_pii_purged_at: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          archive_export_job_id?: string | null
          archive_manifest?: Json
          created_at?: string
          error_code?: string | null
          event_id: string
          id?: string
          manifest_checksum_sha256?: string | null
          requested_by_user_id: string
          retention_eligible_at: string
          source_pii_purged_at?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          archive_export_job_id?: string | null
          archive_manifest?: Json
          created_at?: string
          error_code?: string | null
          event_id?: string
          id?: string
          manifest_checksum_sha256?: string | null
          requested_by_user_id?: string
          retention_eligible_at?: string
          source_pii_purged_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_retention_jobs_archive_export_job_id_fkey"
            columns: ["archive_export_job_id"]
            isOneToOne: false
            referencedRelation: "event_export_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_retention_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          body_markdown: string | null
          capacity: number | null
          category: string
          cover_alt_text_override: string | null
          cover_media_asset_id: string | null
          created_at: string
          created_by_user_id: string | null
          cta_label: string | null
          cta_url: string | null
          delivery_mode: string
          ends_at: string | null
          id: string
          legacy_content_post_id: string | null
          location_label: string | null
          location_mode: string
          online_url: string | null
          published_at: string | null
          registration_closes_at: string | null
          registration_form_version_id: string | null
          registration_mode: string
          registration_open: boolean
          registration_url: string | null
          slug: string
          source: string
          source_metadata: Json
          starts_at: string
          status: string
          summary: string
          timezone: string
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          waitlist_enabled: boolean
        }
        Insert: {
          body_markdown?: string | null
          capacity?: number | null
          category: string
          cover_alt_text_override?: string | null
          cover_media_asset_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          cta_label?: string | null
          cta_url?: string | null
          delivery_mode: string
          ends_at?: string | null
          id?: string
          legacy_content_post_id?: string | null
          location_label?: string | null
          location_mode?: string
          online_url?: string | null
          published_at?: string | null
          registration_closes_at?: string | null
          registration_form_version_id?: string | null
          registration_mode?: string
          registration_open?: boolean
          registration_url?: string | null
          slug: string
          source?: string
          source_metadata?: Json
          starts_at: string
          status?: string
          summary: string
          timezone?: string
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          waitlist_enabled?: boolean
        }
        Update: {
          body_markdown?: string | null
          capacity?: number | null
          category?: string
          cover_alt_text_override?: string | null
          cover_media_asset_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          cta_label?: string | null
          cta_url?: string | null
          delivery_mode?: string
          ends_at?: string | null
          id?: string
          legacy_content_post_id?: string | null
          location_label?: string | null
          location_mode?: string
          online_url?: string | null
          published_at?: string | null
          registration_closes_at?: string | null
          registration_form_version_id?: string | null
          registration_mode?: string
          registration_open?: boolean
          registration_url?: string | null
          slug?: string
          source?: string
          source_metadata?: Json
          starts_at?: string
          status?: string
          summary?: string
          timezone?: string
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_cover_media_asset_id_fkey"
            columns: ["cover_media_asset_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_media_id"]
          },
          {
            foreignKeyName: "events_cover_media_asset_id_fkey"
            columns: ["cover_media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_legacy_content_post_id_fkey"
            columns: ["legacy_content_post_id"]
            isOneToOne: true
            referencedRelation: "content_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_registration_form_version_id_fkey"
            columns: ["registration_form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_archive_jobs: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          archive_manifest: Json
          created_at: string
          error_code: string | null
          form_definition_id: string
          id: string
          manifest_checksum_sha256: string | null
          requested_by_user_id: string
          retention_eligible_at: string
          source_pii_purged_at: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          archive_manifest?: Json
          created_at?: string
          error_code?: string | null
          form_definition_id: string
          id?: string
          manifest_checksum_sha256?: string | null
          requested_by_user_id: string
          retention_eligible_at: string
          source_pii_purged_at?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          archive_manifest?: Json
          created_at?: string
          error_code?: string | null
          form_definition_id?: string
          id?: string
          manifest_checksum_sha256?: string | null
          requested_by_user_id?: string
          retention_eligible_at?: string
          source_pii_purged_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_archive_jobs_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_confirmation_deliveries: {
        Row: {
          created_at: string
          error_message: string | null
          form_submission_id: string
          id: string
          idempotency_key: string
          last_provider_event_at: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          form_submission_id: string
          id?: string
          idempotency_key: string
          last_provider_event_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          form_submission_id?: string
          id?: string
          idempotency_key?: string
          last_provider_event_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_confirmation_deliveries_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_confirmation_delivery_webhook_events: {
        Row: {
          created_at: string
          delivery_status: string | null
          event_type: string
          form_confirmation_delivery_id: string
          form_submission_id: string
          id: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string | null
          event_type: string
          form_confirmation_delivery_id: string
          form_submission_id: string
          id?: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string
        }
        Update: {
          created_at?: string
          delivery_status?: string | null
          event_type?: string
          form_confirmation_delivery_id?: string
          form_submission_id?: string
          id?: string
          occurred_at?: string
          provider_event_id?: string
          provider_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_confirmation_delivery_we_form_confirmation_delivery_i_fkey"
            columns: ["form_confirmation_delivery_id"]
            isOneToOne: false
            referencedRelation: "form_confirmation_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_confirmation_delivery_webhook_even_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_definitions: {
        Row: {
          application_behavior: Json
          created_at: string
          current_published_version_id: string | null
          description: string | null
          id: string
          kind: string
          lifecycle: string
          linked_event_id: string | null
          owner_user_id: string
          payment_configuration: Json
          published_at: string | null
          published_by_user_id: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          application_behavior?: Json
          created_at?: string
          current_published_version_id?: string | null
          description?: string | null
          id?: string
          kind: string
          lifecycle?: string
          linked_event_id?: string | null
          owner_user_id: string
          payment_configuration?: Json
          published_at?: string | null
          published_by_user_id?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          application_behavior?: Json
          created_at?: string
          current_published_version_id?: string | null
          description?: string | null
          id?: string
          kind?: string
          lifecycle?: string
          linked_event_id?: string | null
          owner_user_id?: string
          payment_configuration?: Json
          published_at?: string | null
          published_by_user_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_definitions_current_published_version_id_fkey"
            columns: ["current_published_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_definitions_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      form_export_jobs: {
        Row: {
          checksum_sha256: string | null
          completed_at: string | null
          created_at: string
          destination: string
          error_code: string | null
          expires_at: string | null
          filter_metadata: Json
          form_definition_id: string
          form_version_id: string | null
          format: string
          google_drive_file_id: string | null
          id: string
          requested_by_user_id: string
          row_count: number
          status: string
        }
        Insert: {
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          destination: string
          error_code?: string | null
          expires_at?: string | null
          filter_metadata?: Json
          form_definition_id: string
          form_version_id?: string | null
          format: string
          google_drive_file_id?: string | null
          id?: string
          requested_by_user_id: string
          row_count?: number
          status?: string
        }
        Update: {
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          destination?: string
          error_code?: string | null
          expires_at?: string | null
          filter_metadata?: Json
          form_definition_id?: string
          form_version_id?: string | null
          format?: string
          google_drive_file_id?: string | null
          id?: string
          requested_by_user_id?: string
          row_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_export_jobs_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_export_jobs_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission_assets: {
        Row: {
          bytes: number
          cloudinary_asset_id: string
          cloudinary_folder: string
          cloudinary_public_id: string
          cloudinary_version: string
          content_type: string
          created_at: string
          field_id: string
          form_submission_id: string
          id: string
          sha256: string
        }
        Insert: {
          bytes: number
          cloudinary_asset_id: string
          cloudinary_folder: string
          cloudinary_public_id: string
          cloudinary_version: string
          content_type: string
          created_at?: string
          field_id: string
          form_submission_id: string
          id?: string
          sha256: string
        }
        Update: {
          bytes?: number
          cloudinary_asset_id?: string
          cloudinary_folder?: string
          cloudinary_public_id?: string
          cloudinary_version?: string
          content_type?: string
          created_at?: string
          field_id?: string
          form_submission_id?: string
          id?: string
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_assets_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers: Json
          confirmation_expires_at: string | null
          confirmation_resend_count: number
          confirmation_resend_window_started_at: string | null
          confirmation_sent_at: string | null
          confirmation_status: string
          confirmation_token_hash: string | null
          confirmed_at: string | null
          created_at: string
          event_registration_id: string | null
          form_definition_id: string
          form_version_id: string
          id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          source_metadata: Json
          submitter_email: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          confirmation_expires_at?: string | null
          confirmation_resend_count?: number
          confirmation_resend_window_started_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_status?: string
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          event_registration_id?: string | null
          form_definition_id: string
          form_version_id: string
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source_metadata?: Json
          submitter_email?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          confirmation_expires_at?: string | null
          confirmation_resend_count?: number
          confirmation_resend_window_started_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_status?: string
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          event_registration_id?: string | null
          form_definition_id?: string
          form_version_id?: string
          id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          source_metadata?: Json
          submitter_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_upload_sessions: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          form_definition_id: string
          form_version_id: string
          id: string
          manifest_sha256: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          form_definition_id: string
          form_version_id: string
          id: string
          manifest_sha256: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          form_definition_id?: string
          form_version_id?: string
          id?: string
          manifest_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_upload_sessions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_upload_sessions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          application_behavior: Json
          created_at: string
          created_by_user_id: string
          field_schema: Json
          form_definition_id: string
          id: string
          lifecycle: string
          payment_configuration: Json
          published_at: string | null
          published_by_user_id: string | null
          validation_snapshot: Json
          version_number: number
        }
        Insert: {
          application_behavior?: Json
          created_at?: string
          created_by_user_id: string
          field_schema: Json
          form_definition_id: string
          id?: string
          lifecycle?: string
          payment_configuration?: Json
          published_at?: string | null
          published_by_user_id?: string | null
          validation_snapshot?: Json
          version_number: number
        }
        Update: {
          application_behavior?: Json
          created_at?: string
          created_by_user_id?: string
          field_schema?: Json
          form_definition_id?: string
          id?: string
          lifecycle?: string
          payment_configuration?: Json
          published_at?: string | null
          published_by_user_id?: string | null
          validation_snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_album_items: {
        Row: {
          album_id: string
          alt_text: string | null
          blur_data_url: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          description: string | null
          height: number | null
          id: string
          is_cover: boolean
          media_asset_id: string
          restorable_until: string | null
          sort_order: number
          source_caption: string | null
          source_metadata: Json
          status: string
          title: string | null
          trash_metadata: Json
          trash_reason: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          album_id: string
          alt_text?: string | null
          blur_data_url?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          height?: number | null
          id?: string
          is_cover?: boolean
          media_asset_id: string
          restorable_until?: string | null
          sort_order?: number
          source_caption?: string | null
          source_metadata?: Json
          status?: string
          title?: string | null
          trash_metadata?: Json
          trash_reason?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          album_id?: string
          alt_text?: string | null
          blur_data_url?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          height?: number | null
          id?: string
          is_cover?: boolean
          media_asset_id?: string
          restorable_until?: string | null
          sort_order?: number
          source_caption?: string | null
          source_metadata?: Json
          status?: string
          title?: string | null
          trash_metadata?: Json
          trash_reason?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_album_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_album_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "gallery_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_album_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_media_id"]
          },
          {
            foreignKeyName: "gallery_album_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_albums: {
        Row: {
          category: string
          cloudinary_folder: string | null
          cover_item_id: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          description: string | null
          ends_on: string | null
          event_name: string | null
          featured: boolean
          id: string
          month: number | null
          restorable_until: string | null
          slug: string
          source: string
          source_metadata: Json
          starts_on: string | null
          status: string
          title: string
          trash_metadata: Json
          trash_reason: string | null
          updated_at: string
          year: number
        }
        Insert: {
          category?: string
          cloudinary_folder?: string | null
          cover_item_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          ends_on?: string | null
          event_name?: string | null
          featured?: boolean
          id?: string
          month?: number | null
          restorable_until?: string | null
          slug: string
          source?: string
          source_metadata?: Json
          starts_on?: string | null
          status?: string
          title: string
          trash_metadata?: Json
          trash_reason?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          category?: string
          cloudinary_folder?: string | null
          cover_item_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          ends_on?: string | null
          event_name?: string | null
          featured?: boolean
          id?: string
          month?: number | null
          restorable_until?: string | null
          slug?: string
          source?: string
          source_metadata?: Json
          starts_on?: string | null
          status?: string
          title?: string
          trash_metadata?: Json
          trash_reason?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_albums_cover_item_id_fkey"
            columns: ["cover_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_id"]
          },
          {
            foreignKeyName: "gallery_albums_cover_item_id_fkey"
            columns: ["cover_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_items"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_entries: {
        Row: {
          caption: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          media_asset_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          media_asset_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          media_asset_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_entries_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_media_id"]
          },
          {
            foreignKeyName: "gallery_entries_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_batches: {
        Row: {
          claimed_count: number
          created_at: string
          created_by_user_id: string | null
          cycle_id: string | null
          expires_at: string | null
          id: string
          issued_count: number
          label: string
          metadata: Json
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          claimed_count?: number
          created_at?: string
          created_by_user_id?: string | null
          cycle_id?: string | null
          expires_at?: string | null
          id?: string
          issued_count?: number
          label: string
          metadata?: Json
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_count?: number
          created_at?: string
          created_by_user_id?: string | null
          cycle_id?: string | null
          expires_at?: string | null
          id?: string
          issued_count?: number
          label?: string
          metadata?: Json
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_batches_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "membership_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_email_deliveries: {
        Row: {
          channel: string
          created_at: string
          created_by_user_id: string | null
          error_message: string | null
          id: string
          invitation_id: string
          last_provider_event_at: string | null
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by_user_id?: string | null
          error_message?: string | null
          id?: string
          invitation_id: string
          last_provider_event_at?: string | null
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by_user_id?: string | null
          error_message?: string | null
          id?: string
          invitation_id?: string
          last_provider_event_at?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_email_deliveries_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          bytes: number | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          duration_seconds: number | null
          format: string | null
          height: number | null
          id: string
          is_public: boolean
          media_kind: string
          metadata: Json
          provider: string
          public_id: string
          resource_type: string
          secure_url: string
          thumbnail_url: string | null
          title: string | null
          trash_moved_at: string | null
          trash_original_public_id: string | null
          trash_public_id: string | null
          trash_restore_deadline: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bytes?: number | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          duration_seconds?: number | null
          format?: string | null
          height?: number | null
          id?: string
          is_public?: boolean
          media_kind: string
          metadata?: Json
          provider?: string
          public_id: string
          resource_type: string
          secure_url: string
          thumbnail_url?: string | null
          title?: string | null
          trash_moved_at?: string | null
          trash_original_public_id?: string | null
          trash_public_id?: string | null
          trash_restore_deadline?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bytes?: number | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          duration_seconds?: number | null
          format?: string | null
          height?: number | null
          id?: string
          is_public?: boolean
          media_kind?: string
          metadata?: Json
          provider?: string
          public_id?: string
          resource_type?: string
          secure_url?: string
          thumbnail_url?: string | null
          title?: string | null
          trash_moved_at?: string | null
          trash_original_public_id?: string | null
          trash_public_id?: string | null
          trash_restore_deadline?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      member_invitations: {
        Row: {
          batch_id: string | null
          code_hash: string
          created_at: string
          created_by_user_id: string | null
          delivery_status: string
          expires_at: string
          id: string
          invitation_type: string
          is_active: boolean
          last_sent_at: string | null
          last_used_at: string | null
          max_uses: number
          member_id: string
          notes: string | null
          recipient_email_snapshot: string | null
          recipient_name_snapshot: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          send_attempts: number
          updated_at: string
          used_count: number
        }
        Insert: {
          batch_id?: string | null
          code_hash: string
          created_at?: string
          created_by_user_id?: string | null
          delivery_status?: string
          expires_at: string
          id?: string
          invitation_type?: string
          is_active?: boolean
          last_sent_at?: string | null
          last_used_at?: string | null
          max_uses?: number
          member_id: string
          notes?: string | null
          recipient_email_snapshot?: string | null
          recipient_name_snapshot?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          send_attempts?: number
          updated_at?: string
          used_count?: number
        }
        Update: {
          batch_id?: string | null
          code_hash?: string
          created_at?: string
          created_by_user_id?: string | null
          delivery_status?: string
          expires_at?: string
          id?: string
          invitation_type?: string
          is_active?: boolean
          last_sent_at?: string | null
          last_used_at?: string | null
          max_uses?: number
          member_id?: string
          notes?: string | null
          recipient_email_snapshot?: string | null
          recipient_name_snapshot?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          send_attempts?: number
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_invitations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "invitation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_invitations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          alumni_since: string | null
          avatar_bytes: number | null
          avatar_format: string | null
          avatar_height: number | null
          avatar_public_id: string | null
          avatar_secure_url: string | null
          avatar_updated_at: string | null
          avatar_updated_by_user_id: string | null
          avatar_width: number | null
          batch_no: number | null
          created_at: string
          current_membership_appeal_id: string | null
          current_membership_case_id: string | null
          current_membership_closed_by_user_id: string | null
          current_membership_closed_on: string | null
          current_membership_closure_reason: string | null
          current_membership_path_status: string
          current_organization: string | null
          department_code: string | null
          designation: string | null
          email: string | null
          facebook_url: string | null
          first_name: string | null
          full_name: string
          graduation_year: number | null
          id: string
          is_profile_claimed: boolean
          jnuits_id: string
          joined_on: string | null
          last_name: string | null
          lifecycle_changed_at: string | null
          lifecycle_changed_by_user_id: string | null
          lifecycle_note: string | null
          lifecycle_status: string
          linkedin_url: string | null
          member_type: string
          membership_revision: number
          phone: string | null
          portal_access_status: string
          professional_visibility: string
          profile_claimed_at: string | null
          renewal_due_on: string | null
          student_id: string | null
          updated_at: string
          user_id: string | null
          verification_code_hash: string | null
          website_url: string | null
          work_location: string | null
        }
        Insert: {
          alumni_since?: string | null
          avatar_bytes?: number | null
          avatar_format?: string | null
          avatar_height?: number | null
          avatar_public_id?: string | null
          avatar_secure_url?: string | null
          avatar_updated_at?: string | null
          avatar_updated_by_user_id?: string | null
          avatar_width?: number | null
          batch_no?: number | null
          created_at?: string
          current_membership_appeal_id?: string | null
          current_membership_case_id?: string | null
          current_membership_closed_by_user_id?: string | null
          current_membership_closed_on?: string | null
          current_membership_closure_reason?: string | null
          current_membership_path_status?: string
          current_organization?: string | null
          department_code?: string | null
          designation?: string | null
          email?: string | null
          facebook_url?: string | null
          first_name?: string | null
          full_name: string
          graduation_year?: number | null
          id?: string
          is_profile_claimed?: boolean
          jnuits_id: string
          joined_on?: string | null
          last_name?: string | null
          lifecycle_changed_at?: string | null
          lifecycle_changed_by_user_id?: string | null
          lifecycle_note?: string | null
          lifecycle_status?: string
          linkedin_url?: string | null
          member_type?: string
          membership_revision?: number
          phone?: string | null
          portal_access_status?: string
          professional_visibility?: string
          profile_claimed_at?: string | null
          renewal_due_on?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
          verification_code_hash?: string | null
          website_url?: string | null
          work_location?: string | null
        }
        Update: {
          alumni_since?: string | null
          avatar_bytes?: number | null
          avatar_format?: string | null
          avatar_height?: number | null
          avatar_public_id?: string | null
          avatar_secure_url?: string | null
          avatar_updated_at?: string | null
          avatar_updated_by_user_id?: string | null
          avatar_width?: number | null
          batch_no?: number | null
          created_at?: string
          current_membership_appeal_id?: string | null
          current_membership_case_id?: string | null
          current_membership_closed_by_user_id?: string | null
          current_membership_closed_on?: string | null
          current_membership_closure_reason?: string | null
          current_membership_path_status?: string
          current_organization?: string | null
          department_code?: string | null
          designation?: string | null
          email?: string | null
          facebook_url?: string | null
          first_name?: string | null
          full_name?: string
          graduation_year?: number | null
          id?: string
          is_profile_claimed?: boolean
          jnuits_id?: string
          joined_on?: string | null
          last_name?: string | null
          lifecycle_changed_at?: string | null
          lifecycle_changed_by_user_id?: string | null
          lifecycle_note?: string | null
          lifecycle_status?: string
          linkedin_url?: string | null
          member_type?: string
          membership_revision?: number
          phone?: string | null
          portal_access_status?: string
          professional_visibility?: string
          profile_claimed_at?: string | null
          renewal_due_on?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string | null
          verification_code_hash?: string | null
          website_url?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_current_membership_appeal_id_fkey"
            columns: ["current_membership_appeal_id"]
            isOneToOne: false
            referencedRelation: "profile_update_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_current_membership_case_id_fkey"
            columns: ["current_membership_case_id"]
            isOneToOne: false
            referencedRelation: "profile_update_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
        ]
      }
      membership_applications: {
        Row: {
          batch_label: string | null
          created_at: string
          department_code: string | null
          email: string
          facebook_url: string | null
          form_submission_id: string | null
          id: string
          invitation_id: string | null
          linkedin_url: string | null
          membership_cycle_id: string | null
          name: string
          phone: string | null
          photo_url: string | null
          processed_member_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          batch_label?: string | null
          created_at?: string
          department_code?: string | null
          email: string
          facebook_url?: string | null
          form_submission_id?: string | null
          id?: string
          invitation_id?: string | null
          linkedin_url?: string | null
          membership_cycle_id?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          processed_member_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_label?: string | null
          created_at?: string
          department_code?: string | null
          email?: string
          facebook_url?: string | null
          form_submission_id?: string | null
          id?: string
          invitation_id?: string | null
          linkedin_url?: string | null
          membership_cycle_id?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          processed_member_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_applications_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "membership_applications_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_membership_cycle_id_fkey"
            columns: ["membership_cycle_id"]
            isOneToOne: false
            referencedRelation: "membership_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_processed_member_id_fkey"
            columns: ["processed_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_cycle_memberships: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          cycle_id: string
          enrolled_at: string
          expires_on: string | null
          id: string
          member_id: string
          note: string | null
          renewed_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          cycle_id: string
          enrolled_at?: string
          expires_on?: string | null
          id?: string
          member_id: string
          note?: string | null
          renewed_at?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          cycle_id?: string
          enrolled_at?: string
          expires_on?: string | null
          id?: string
          member_id?: string
          note?: string | null
          renewed_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_cycle_memberships_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "membership_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_cycle_memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_cycles: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          ends_on: string | null
          id: string
          renewal_close_on: string | null
          renewal_open_on: string | null
          starts_on: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_user_id?: string | null
          ends_on?: string | null
          id?: string
          renewal_close_on?: string | null
          renewal_open_on?: string | null
          starts_on: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          ends_on?: string | null
          id?: string
          renewal_close_on?: string | null
          renewal_open_on?: string | null
          starts_on?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_id_sequences: {
        Row: {
          created_at: string
          last_serial: number
          updated_at: string
          year_block: string
        }
        Insert: {
          created_at?: string
          last_serial?: number
          updated_at?: string
          year_block: string
        }
        Update: {
          created_at?: string
          last_serial?: number
          updated_at?: string
          year_block?: string
        }
        Relationships: []
      }
      membership_lifecycle_events: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          event_type: string
          id: string
          member_id: string
          metadata: Json
          occurred_at: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          event_type: string
          id?: string
          member_id: string
          metadata?: Json
          occurred_at?: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          event_type?: string
          id?: string
          member_id?: string
          metadata?: Json
          occurred_at?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_lifecycle_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_renewals: {
        Row: {
          confirmed_by_user_id: string | null
          confirmed_on: string
          created_at: string
          due_on: string
          id: string
          member_id: string
          next_due_on: string
          note: string | null
          reference: string | null
          resolution: string
        }
        Insert: {
          confirmed_by_user_id?: string | null
          confirmed_on: string
          created_at?: string
          due_on: string
          id?: string
          member_id: string
          next_due_on: string
          note?: string | null
          reference?: string | null
          resolution: string
        }
        Update: {
          confirmed_by_user_id?: string | null
          confirmed_on?: string
          created_at?: string
          due_on?: string
          id?: string
          member_id?: string
          next_due_on?: string
          note?: string | null
          reference?: string | null
          resolution?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_renewals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_messages: {
        Row: {
          author_user_id: string
          body_markdown: string
          created_at: string
          id: string
          relationship_id: string
        }
        Insert: {
          author_user_id: string
          body_markdown: string
          created_at?: string
          id?: string
          relationship_id: string
        }
        Update: {
          author_user_id?: string
          body_markdown?: string
          created_at?: string
          id?: string
          relationship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_messages_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "mentorship_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_profiles: {
        Row: {
          availability_status: string
          bio: string
          created_at: string
          interests: string[]
          member_id: string
          opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string
          bio?: string
          created_at?: string
          interests?: string[]
          member_id: string
          opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string
          bio?: string
          created_at?: string
          interests?: string[]
          member_id?: string
          opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_relationships: {
        Row: {
          alumni_user_id: string
          closed_at: string | null
          created_at: string
          created_by_user_id: string
          id: string
          member_user_id: string
          status: string
        }
        Insert: {
          alumni_user_id: string
          closed_at?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          member_user_id: string
          status?: string
        }
        Update: {
          alumni_user_id?: string
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          member_user_id?: string
          status?: string
        }
        Relationships: []
      }
      operator_reports: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          report: Json
          report_type: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          report?: Json
          report_type: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          report?: Json
          report_type?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      portal_user_settings: {
        Row: {
          created_at: string
          member_id: string | null
          mentorship_opt_in: boolean
          notification_email_opt_in: boolean
          preferred_theme: string
          ticket_digest_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          member_id?: string | null
          mentorship_opt_in?: boolean
          notification_email_opt_in?: boolean
          preferred_theme?: string
          ticket_digest_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          member_id?: string | null
          mentorship_opt_in?: boolean
          notification_email_opt_in?: boolean
          preferred_theme?: string
          ticket_digest_opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_user_settings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_update_requests: {
        Row: {
          applied_payload_snapshot: Json
          created_at: string
          decision_reason: string | null
          id: string
          member_id: string
          metadata: Json
          payload: Json
          previous_payload_snapshot: Json
          request_source: string
          request_type: string
          requested_at: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          submitted_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          applied_payload_snapshot?: Json
          created_at?: string
          decision_reason?: string | null
          id?: string
          member_id: string
          metadata?: Json
          payload?: Json
          previous_payload_snapshot?: Json
          request_source?: string
          request_type: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          submitted_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          applied_payload_snapshot?: Json
          created_at?: string
          decision_reason?: string | null
          id?: string
          member_id?: string
          metadata?: Json
          payload?: Json
          previous_payload_snapshot?: Json
          request_source?: string
          request_type?: string
          requested_at?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          submitted_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_update_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          batch_no: number | null
          created_at: string
          department_code: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_no?: number | null
          created_at?: string
          department_code?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_no?: number | null
          created_at?: string
          department_code?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_code_fkey"
            columns: ["department_code"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["code"]
          },
        ]
      }
      project_contributors: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          member_id: string
          project_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          member_id: string
          project_id: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          member_id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contributors_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contributors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: string
          completed_at: string | null
          cover_image_url: string | null
          created_at: string
          created_by_user_id: string | null
          demo_url: string | null
          description: string
          github_url: string | null
          id: string
          is_featured: boolean
          slug: string
          started_at: string | null
          status: string
          tagline: string | null
          tech_stack: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by_user_id?: string | null
          demo_url?: string | null
          description?: string
          github_url?: string | null
          id?: string
          is_featured?: boolean
          slug: string
          started_at?: string | null
          status?: string
          tagline?: string | null
          tech_stack?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by_user_id?: string | null
          demo_url?: string | null
          description?: string
          github_url?: string | null
          id?: string
          is_featured?: boolean
          slug?: string
          started_at?: string | null
          status?: string
          tagline?: string | null
          tech_stack?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rbac_permissions: {
        Row: {
          code: string
          created_at: string
          description: string
          scope: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          scope: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          scope?: string
        }
        Relationships: []
      }
      rbac_platform_roles: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_assignable: boolean
          is_hidden: boolean
          is_system: boolean
          rank: number
          scope: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_assignable?: boolean
          is_hidden?: boolean
          is_system?: boolean
          rank?: number
          scope: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_assignable?: boolean
          is_hidden?: boolean
          is_system?: boolean
          rank?: number
          scope?: string
          title?: string
        }
        Relationships: []
      }
      rbac_role_permissions: {
        Row: {
          created_at: string
          permission_code: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_code: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_code?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "rbac_permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "rbac_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_user_claim_versions: {
        Row: {
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      rbac_user_platform_roles: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          role_id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_id: string
          scope: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_id?: string
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_platform_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      resend_delivery_webhook_events: {
        Row: {
          created_at: string
          delivery_status: string | null
          event_type: string
          id: string
          invitation_email_delivery_id: string
          invitation_id: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string | null
          event_type: string
          id?: string
          invitation_email_delivery_id: string
          invitation_id: string
          occurred_at: string
          provider_event_id: string
          provider_message_id: string
        }
        Update: {
          created_at?: string
          delivery_status?: string | null
          event_type?: string
          id?: string
          invitation_email_delivery_id?: string
          invitation_id?: string
          occurred_at?: string
          provider_event_id?: string
          provider_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resend_delivery_webhook_event_invitation_email_delivery_id_fkey"
            columns: ["invitation_email_delivery_id"]
            isOneToOne: false
            referencedRelation: "invitation_email_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resend_delivery_webhook_events_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          severity: string
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          severity?: string
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          severity?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      security_rate_limits: {
        Row: {
          count: number
          key_hash: string
          reset_at: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key_hash: string
          reset_at: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          key_hash?: string
          reset_at?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          admin_totp_enforced: boolean
          created_at: string
          id: boolean
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          admin_totp_enforced?: boolean
          created_at?: string
          id?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          admin_totp_enforced?: boolean
          created_at?: string
          id?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: []
      }
      support_ticket_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          ticket_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          ticket_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author_user_id: string
          body_markdown: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_user_id: string
          body_markdown: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_user_id?: string
          body_markdown?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_role_scope: string | null
          assigned_to_user_id: string | null
          audience_scope: string
          category: string
          created_at: string
          escalated_to_admin: boolean
          id: string
          member_id: string | null
          opened_by_user_id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          summary: string
          updated_at: string
        }
        Insert: {
          assigned_role_scope?: string | null
          assigned_to_user_id?: string | null
          audience_scope: string
          category: string
          created_at?: string
          escalated_to_admin?: boolean
          id?: string
          member_id?: string | null
          opened_by_user_id: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          summary: string
          updated_at?: string
        }
        Update: {
          assigned_role_scope?: string | null
          assigned_to_user_id?: string | null
          audience_scope?: string
          category?: string
          created_at?: string
          escalated_to_admin?: boolean
          id?: string
          member_id?: string | null
          opened_by_user_id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      gallery_album_cards: {
        Row: {
          category: string | null
          cloudinary_folder: string | null
          cover_alt_text: string | null
          cover_blur_data_url: string | null
          cover_description: string | null
          cover_height: number | null
          cover_id: string | null
          cover_item_id: string | null
          cover_media_alt_text: string | null
          cover_media_height: number | null
          cover_media_id: string | null
          cover_media_kind: string | null
          cover_media_public_id: string | null
          cover_media_secure_url: string | null
          cover_media_thumbnail_url: string | null
          cover_media_title: string | null
          cover_media_width: number | null
          cover_sort_order: number | null
          cover_source_caption: string | null
          cover_title: string | null
          cover_width: number | null
          description: string | null
          ends_on: string | null
          event_name: string | null
          featured: boolean | null
          id: string | null
          item_count: number | null
          month: number | null
          slug: string | null
          starts_on: string | null
          title: string | null
          updated_at: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_albums_cover_item_id_fkey"
            columns: ["cover_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_cards"
            referencedColumns: ["cover_id"]
          },
          {
            foreignKeyName: "gallery_albums_cover_item_id_fkey"
            columns: ["cover_item_id"]
            isOneToOne: false
            referencedRelation: "gallery_album_items"
            referencedColumns: ["id"]
          },
        ]
      }
      public_certificates: {
        Row: {
          asset_url: string | null
          certificate_id: string | null
          details: string | null
          exam_or_event: string | null
          exam_or_event_name: string | null
          full_name: string | null
          issue_date: string | null
        }
        Insert: {
          asset_url?: string | null
          certificate_id?: string | null
          details?: string | null
          exam_or_event?: string | null
          exam_or_event_name?: string | null
          full_name?: string | null
          issue_date?: string | null
        }
        Update: {
          asset_url?: string | null
          certificate_id?: string | null
          details?: string | null
          exam_or_event?: string | null
          exam_or_event_name?: string | null
          full_name?: string | null
          issue_date?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_verification_begin_email: { Args: { p_input: Json }; Returns: Json }
      admin_verification_check_read: { Args: { p_input: Json }; Returns: Json }
      admin_verification_context: { Args: { p_input: Json }; Returns: Json }
      admin_verification_issue_password: {
        Args: { p_input: Json }
        Returns: Json
      }
      admin_verification_load_email_challenge: {
        Args: { p_input: Json }
        Returns: Json
      }
      admin_verification_mark_email_delivery: {
        Args: { p_input: Json }
        Returns: Json
      }
      admin_verification_prepare: { Args: { p_input: Json }; Returns: Json }
      admin_verification_record_enrollment: {
        Args: { p_input: Json }
        Returns: Json
      }
      admin_verification_redeem_email: {
        Args: { p_input: Json }
        Returns: Json
      }
      admin_verification_reserve: { Args: { p_input: Json }; Returns: Json }
      admin_verification_reserve_password_attempt: {
        Args: { p_input: Json }
        Returns: Json
      }
      allocate_membership_id: { Args: { year_block: string }; Returns: string }
      approve_alumni_onboarding_case: {
        Args: {
          p_actor_user_id: string
          p_case_id: string
          p_invitation_code_hash: string
          p_invitation_expires_at: string
          p_review_note: string
        }
        Returns: {
          invitation_id: string
          jnuits_id: string
          member_id: string
          recipient_email: string
          result_status: string
        }[]
      }
      approve_membership_application: {
        Args: {
          p_actor_user_id: string
          p_application_id: string
          p_invitation_code_hash: string
          p_invitation_expires_at: string
          p_joined_on?: string
          p_review_note: string
        }
        Returns: {
          invitation_id: string
          jnuits_id: string
          member_id: string
          result_status: string
        }[]
      }
      bump_user_claim_version: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      can_access_mentorship_relationship: {
        Args: { target_relationship_id: string }
        Returns: boolean
      }
      can_access_support_ticket: {
        Args: { target_ticket_id: string }
        Returns: boolean
      }
      can_manage_bulk_operation_type: {
        Args: { target_operation_type: string }
        Returns: boolean
      }
      can_manage_support_ticket: {
        Args: { target_ticket_id: string }
        Returns: boolean
      }
      check_in_event_registration: {
        Args: {
          p_actor_user_id: string
          p_event_id: string
          p_registration_code: string
        }
        Returns: {
          checked_in_at: string
          registration_id: string
          result_status: string
        }[]
      }
      commit_bulk_membership_operation: {
        Args: { target_operation_id: string }
        Returns: Json
      }
      commit_onboarding_draft: {
        Args: {
          p_expected_revision: number
          p_make_current?: boolean
          p_operation_id: string
        }
        Returns: Json
      }
      confirm_form_submission: {
        Args: { p_confirmation_token_hash: string; p_submission_id: string }
        Returns: {
          form_kind: string
          form_submission_id: string
          result_status: string
          review_case_id: string
        }[]
      }
      confirm_membership_renewal: {
        Args: {
          p_effective_date?: string
          p_expected_due_on: string
          p_member_id: string
          p_note?: string
          p_reference?: string
          p_resolution: string
        }
        Returns: Json
      }
      consume_form_upload_session: {
        Args: {
          p_form_definition_id: string
          p_form_version_id: string
          p_manifest_sha256: string
          p_session_id: string
        }
        Returns: boolean
      }
      create_form_definition_draft: {
        Args: {
          p_actor_user_id: string
          p_application_behavior: Json
          p_description: string
          p_field_schema: Json
          p_kind: string
          p_linked_event_id: string
          p_slug: string
          p_title: string
        }
        Returns: {
          form_definition_id: string
          form_version_id: string
        }[]
      }
      create_form_draft_version: {
        Args: {
          p_actor_user_id: string
          p_application_behavior: Json
          p_field_schema: Json
          p_form_definition_id: string
        }
        Returns: {
          form_version_id: string
        }[]
      }
      current_admin_role: { Args: never; Returns: string }
      current_member_id: { Args: never; Returns: string }
      current_member_type: { Args: never; Returns: string }
      current_portal_role: { Args: never; Returns: string }
      current_rbac_claims_snapshot: { Args: never; Returns: Json }
      edit_onboarding_draft_row: {
        Args: {
          p_errors: Json
          p_expected_revision: number
          p_normalized_data: Json
          p_operation_id: string
          p_raw_data: Json
          p_row_id: string
          p_status: string
        }
        Returns: Json
      }
      finalize_member_invitation_claim: {
        Args: {
          target_email: string
          target_invitation_id: string
          target_member_id: string
          target_user_id: string
        }
        Returns: Json
      }
      find_auth_user_id_by_email: {
        Args: { target_email: string }
        Returns: string
      }
      format_jnuits_id: { Args: { raw_id: string }; Returns: string }
      get_event_registration_counts: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          registration_count: number
        }[]
      }
      get_member_directory_facets: {
        Args: {
          p_can_view_members_only: boolean
          p_department: string
          p_letter: string
          p_search: string
          p_type: string
        }
        Returns: {
          facet_group: string
          facet_key: string
          item_count: number
        }[]
      }
      get_member_membership_state: {
        Args: { p_member_id: string }
        Returns: Json
      }
      get_membership_admin_queue: {
        Args: {
          p_effective_date?: string
          p_page?: number
          p_page_size?: number
          p_queue: string
        }
        Returns: Json
      }
      has_permission: {
        Args: { requested_permission: string }
        Returns: boolean
      }
      has_platform_role: { Args: { role_code: string }; Returns: boolean }
      hit_rate_limit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number }
        Returns: {
          remaining: number
          reset_at: string
          success: boolean
        }[]
      }
      is_aal2: { Args: never; Returns: boolean }
      is_admin_totp_enforced: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_super_admin_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      jnuits_custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      membership_anniversary: {
        Args: { p_joined_on: string; p_year: number }
        Returns: string
      }
      membership_renewal_state: {
        Args: {
          p_due_on: string
          p_effective_date: string
          p_lifecycle_status: string
        }
        Returns: string
      }
      normalize_jnuits_id: { Args: { raw_id: string }; Returns: string }
      preview_bulk_membership_operation: {
        Args: { target_operation_id: string }
        Returns: Json
      }
      promote_event_waitlist_registration: {
        Args: {
          p_actor_user_id: string
          p_event_id: string
          p_registration_id: string
        }
        Returns: {
          registration_code: string
          result_status: string
        }[]
      }
      publish_form_version: {
        Args: {
          p_actor_user_id: string
          p_form_definition_id: string
          p_form_version_id: string
        }
        Returns: {
          form_definition_id: string
          form_version_id: string
        }[]
      }
      purge_retention_job: {
        Args: { p_actor_user_id: string; p_job_id: string; p_scope: string }
        Returns: Json
      }
      reconcile_membership_lifecycle: {
        Args: {
          p_batch_size?: number
          p_effective_date?: string
          p_member_id?: string
        }
        Returns: Json
      }
      record_event_registration_delivery_webhook_event: {
        Args: {
          p_delivery_status: string
          p_event_type: string
          p_occurred_at: string
          p_provider_event_id: string
          p_provider_message_id: string
        }
        Returns: {
          applied_status: string
          duplicate: boolean
          tracked: boolean
        }[]
      }
      record_form_confirmation_delivery_webhook_event: {
        Args: {
          p_delivery_status: string
          p_event_type: string
          p_occurred_at: string
          p_provider_event_id: string
          p_provider_message_id: string
        }
        Returns: {
          applied_status: string
          duplicate: boolean
          tracked: boolean
        }[]
      }
      record_invitation_delivery_webhook_event: {
        Args: {
          p_delivery_status: string
          p_event_type: string
          p_occurred_at: string
          p_provider_event_id: string
          p_provider_message_id: string
        }
        Returns: {
          applied_status: string
          duplicate: boolean
          tracked: boolean
        }[]
      }
      refresh_form_submission_confirmation: {
        Args: {
          p_form_definition_id: string
          p_next_expires_at: string
          p_next_token_hash: string
          p_submitter_email: string
        }
        Returns: {
          applicant_name: string
          form_submission_id: string
          result_status: string
        }[]
      }
      register_for_event_atomic: {
        Args: {
          p_event_id: string
          p_legacy_event_post_id: string
          p_member_id: string
          p_registrant_email: string
          p_registrant_name: string
          p_registrant_phone: string
        }
        Returns: {
          registration_code: string
          result_status: string
        }[]
      }
      register_for_event_with_form_assets_atomic: {
        Args: {
          p_answers: Json
          p_assets: Json
          p_event_id: string
          p_form_definition_id: string
          p_form_version_id: string
          p_legacy_event_post_id: string
          p_member_id: string
          p_registrant_email: string
          p_registrant_name: string
          p_registrant_phone: string
        }
        Returns: {
          registration_code: string
          result_status: string
        }[]
      }
      register_for_event_with_form_atomic: {
        Args: {
          p_answers: Json
          p_event_id: string
          p_form_definition_id: string
          p_form_version_id: string
          p_legacy_event_post_id: string
          p_member_id: string
          p_registrant_email: string
          p_registrant_name: string
          p_registrant_phone: string
        }
        Returns: {
          registration_code: string
          result_status: string
        }[]
      }
      reject_alumni_onboarding_case: {
        Args: {
          p_actor_user_id: string
          p_case_id: string
          p_review_note: string
        }
        Returns: {
          result_status: string
        }[]
      }
      request_membership_transition: {
        Args: {
          p_action: string
          p_confirmation?: string
          p_expected_revision: number
          p_note?: string
        }
        Returns: Json
      }
      review_membership_application: {
        Args: {
          p_actor_user_id: string
          p_application_id: string
          p_review_note: string
          p_target_status: string
        }
        Returns: {
          application_status: string
          result_status: string
        }[]
      }
      review_membership_request: {
        Args: {
          p_decision: string
          p_expected_updated_at: string
          p_note: string
          p_request_id: string
        }
        Returns: Json
      }
      set_member_lifecycle_status: {
        Args: {
          next_lifecycle_status: string
          next_portal_access_status: string
          reason?: string
          target_member_id: string
        }
        Returns: Json
      }
      set_onboarding_draft_row_excluded: {
        Args: {
          p_excluded: boolean
          p_expected_revision: number
          p_operation_id: string
          p_reason?: string
          p_row_id: string
        }
        Returns: Json
      }
      transition_form_definition_lifecycle: {
        Args: {
          p_actor_user_id: string
          p_form_definition_id: string
          p_target_lifecycle: string
        }
        Returns: {
          current_published_version_id: string
          form_definition_id: string
          lifecycle: string
        }[]
      }
      transition_membership_cycle: {
        Args: {
          p_actor_user_id: string
          p_cycle_id: string
          p_target_status: string
        }
        Returns: {
          cycle_id: string
          cycle_status: string
        }[]
      }
      update_form_draft_version: {
        Args: {
          p_actor_user_id: string
          p_application_behavior: Json
          p_field_schema: Json
          p_form_definition_id: string
          p_form_version_id: string
        }
        Returns: {
          form_version_id: string
        }[]
      }
      validate_onboarding_draft: {
        Args: { p_expected_revision: number; p_operation_id: string }
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
    Enums: {},
  },
} as const
