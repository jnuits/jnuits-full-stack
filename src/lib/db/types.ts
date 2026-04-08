export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      certificate_import_batches: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          finished_at: string | null;
          id: string;
          inserted_count: number;
          rejected_count: number;
          report: Json;
          source_checksum: string | null;
          source_name: string;
          source_row_count: number;
          started_at: string;
          status: string;
          updated_count: number;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          finished_at?: string | null;
          id?: string;
          inserted_count?: number;
          rejected_count?: number;
          report?: Json;
          source_checksum?: string | null;
          source_name: string;
          source_row_count?: number;
          started_at?: string;
          status?: string;
          updated_count?: number;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          finished_at?: string | null;
          id?: string;
          inserted_count?: number;
          rejected_count?: number;
          report?: Json;
          source_checksum?: string | null;
          source_name?: string;
          source_row_count?: number;
          started_at?: string;
          status?: string;
          updated_count?: number;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          asset_url: string | null;
          certificate_id: string;
          created_at: string;
          details: string;
          exam_or_event: string;
          exam_or_event_name: string;
          first_name: string;
          id: string;
          issue_date: string;
          last_name: string;
          source_document_id: string | null;
          source_migrated_at: string;
          source_record_id: string | null;
          updated_at: string;
        };
        Insert: {
          asset_url?: string | null;
          certificate_id: string;
          created_at?: string;
          details?: string;
          exam_or_event: string;
          exam_or_event_name: string;
          first_name: string;
          id?: string;
          issue_date: string;
          last_name: string;
          source_document_id?: string | null;
          source_migrated_at?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Update: {
          asset_url?: string | null;
          certificate_id?: string;
          created_at?: string;
          details?: string;
          exam_or_event?: string;
          exam_or_event_name?: string;
          first_name?: string;
          id?: string;
          issue_date?: string;
          last_name?: string;
          source_document_id?: string | null;
          source_migrated_at?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      certificates_import_staging: {
        Row: {
          asset_url_raw: string | null;
          certificate_id_raw: string | null;
          details_raw: string | null;
          exam_or_event_name_raw: string | null;
          exam_or_event_raw: string | null;
          first_name_raw: string | null;
          id: string;
          import_batch_id: string;
          imported_at: string;
          issue_date_raw: string | null;
          last_name_raw: string | null;
          parse_error: string | null;
          row_number: number;
          source_document_id_raw: string | null;
          source_record_id_raw: string | null;
        };
        Insert: {
          asset_url_raw?: string | null;
          certificate_id_raw?: string | null;
          details_raw?: string | null;
          exam_or_event_name_raw?: string | null;
          exam_or_event_raw?: string | null;
          first_name_raw?: string | null;
          id?: string;
          import_batch_id: string;
          imported_at?: string;
          issue_date_raw?: string | null;
          last_name_raw?: string | null;
          parse_error?: string | null;
          row_number: number;
          source_document_id_raw?: string | null;
          source_record_id_raw?: string | null;
        };
        Update: {
          asset_url_raw?: string | null;
          certificate_id_raw?: string | null;
          details_raw?: string | null;
          exam_or_event_name_raw?: string | null;
          exam_or_event_raw?: string | null;
          first_name_raw?: string | null;
          id?: string;
          import_batch_id?: string;
          imported_at?: string;
          issue_date_raw?: string | null;
          last_name_raw?: string | null;
          parse_error?: string | null;
          row_number?: number;
          source_document_id_raw?: string | null;
          source_record_id_raw?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_import_staging_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "certificate_import_batches";
            referencedColumns: ["id"];
          },
        ];
      };
      committee_assignments: {
        Row: {
          bio: string | null;
          created_at: string;
          created_by_user_id: string | null;
          display_name: string | null;
          ends_on: string | null;
          id: string;
          member_id: string | null;
          role_id: string;
          rollover_source_assignment_id: string | null;
          sort_order: number;
          starts_on: string | null;
          status: string;
          term_id: string;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          display_name?: string | null;
          ends_on?: string | null;
          id?: string;
          member_id?: string | null;
          role_id: string;
          rollover_source_assignment_id?: string | null;
          sort_order?: number;
          starts_on?: string | null;
          status?: string;
          term_id: string;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          display_name?: string | null;
          ends_on?: string | null;
          id?: string;
          member_id?: string | null;
          role_id?: string;
          rollover_source_assignment_id?: string | null;
          sort_order?: number;
          starts_on?: string | null;
          status?: string;
          term_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "committee_assignments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "committee_assignments_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "committee_roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "committee_assignments_rollover_source_assignment_id_fkey";
            columns: ["rollover_source_assignment_id"];
            isOneToOne: false;
            referencedRelation: "committee_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "committee_assignments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "committee_terms";
            referencedColumns: ["id"];
          },
        ];
      };
      committee_roles: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_executive: boolean;
          is_public: boolean;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          is_executive?: boolean;
          is_public?: boolean;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          is_executive?: boolean;
          is_public?: boolean;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      committee_terms: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          ends_on: string | null;
          id: string;
          is_public: boolean;
          rollover_source_term_id: string | null;
          slug: string;
          starts_on: string;
          status: string;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          ends_on?: string | null;
          id?: string;
          is_public?: boolean;
          rollover_source_term_id?: string | null;
          slug: string;
          starts_on: string;
          status?: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          ends_on?: string | null;
          id?: string;
          is_public?: boolean;
          rollover_source_term_id?: string | null;
          slug?: string;
          starts_on?: string;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "committee_terms_rollover_source_term_id_fkey";
            columns: ["rollover_source_term_id"];
            isOneToOne: false;
            referencedRelation: "committee_terms";
            referencedColumns: ["id"];
          },
        ];
      };
      content_pages: {
        Row: {
          body: Json;
          created_at: string;
          created_by_user_id: string | null;
          eyebrow: string | null;
          id: string;
          slug: string;
          status: string;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          eyebrow?: string | null;
          id?: string;
          slug: string;
          status?: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          eyebrow?: string | null;
          id?: string;
          slug?: string;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_posts: {
        Row: {
          author_member_id: string | null;
          body: string | null;
          category: string | null;
          content_type: string;
          created_at: string;
          created_by_user_id: string | null;
          cta_href: string | null;
          ends_at: string | null;
          excerpt: string | null;
          id: string;
          location: string | null;
          media_asset_id: string | null;
          published_at: string | null;
          read_time: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by_user_id: string | null;
          slug: string;
          starts_at: string | null;
          status: string;
          submitted_at: string | null;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_member_id?: string | null;
          body?: string | null;
          category?: string | null;
          content_type: string;
          created_at?: string;
          created_by_user_id?: string | null;
          cta_href?: string | null;
          ends_at?: string | null;
          excerpt?: string | null;
          id?: string;
          location?: string | null;
          media_asset_id?: string | null;
          published_at?: string | null;
          read_time?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          slug: string;
          starts_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_member_id?: string | null;
          body?: string | null;
          category?: string | null;
          content_type?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          cta_href?: string | null;
          ends_at?: string | null;
          excerpt?: string | null;
          id?: string;
          location?: string | null;
          media_asset_id?: string | null;
          published_at?: string | null;
          read_time?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          slug?: string;
          starts_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_posts_author_member_id_fkey";
            columns: ["author_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_posts_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      developer_profiles: {
        Row: {
          bio: string;
          created_at: string;
          created_by_user_id: string | null;
          focus: string;
          id: string;
          is_lead: boolean;
          media_asset_id: string | null;
          name: string;
          role: string;
          sort_order: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          bio: string;
          created_at?: string;
          created_by_user_id?: string | null;
          focus: string;
          id?: string;
          is_lead?: boolean;
          media_asset_id?: string | null;
          name: string;
          role: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Update: {
          bio?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          focus?: string;
          id?: string;
          is_lead?: boolean;
          media_asset_id?: string | null;
          name?: string;
          role?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "developer_profiles_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      gallery_entries: {
        Row: {
          caption: string | null;
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          media_asset_id: string;
          sort_order: number;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          media_asset_id: string;
          sort_order?: number;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          media_asset_id?: string;
          sort_order?: number;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gallery_entries_media_asset_id_fkey";
            columns: ["media_asset_id"];
            isOneToOne: false;
            referencedRelation: "media_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      media_assets: {
        Row: {
          alt_text: string | null;
          bytes: number | null;
          created_at: string;
          created_by_user_id: string | null;
          duration_seconds: number | null;
          format: string | null;
          height: number | null;
          id: string;
          is_public: boolean;
          media_kind: string;
          metadata: Json;
          provider: string;
          public_id: string;
          resource_type: string;
          secure_url: string;
          thumbnail_url: string | null;
          title: string | null;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          bytes?: number | null;
          created_at?: string;
          created_by_user_id?: string | null;
          duration_seconds?: number | null;
          format?: string | null;
          height?: number | null;
          id?: string;
          is_public?: boolean;
          media_kind: string;
          metadata?: Json;
          provider?: string;
          public_id: string;
          resource_type: string;
          secure_url: string;
          thumbnail_url?: string | null;
          title?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          bytes?: number | null;
          created_at?: string;
          created_by_user_id?: string | null;
          duration_seconds?: number | null;
          format?: string | null;
          height?: number | null;
          id?: string;
          is_public?: boolean;
          media_kind?: string;
          metadata?: Json;
          provider?: string;
          public_id?: string;
          resource_type?: string;
          secure_url?: string;
          thumbnail_url?: string | null;
          title?: string | null;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [];
      };
      member_invitations: {
        Row: {
          code_hash: string;
          created_at: string;
          created_by_user_id: string | null;
          expires_at: string;
          id: string;
          is_active: boolean;
          last_used_at: string | null;
          max_uses: number;
          member_id: string;
          notes: string | null;
          revoked_at: string | null;
          updated_at: string;
          used_count: number;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at: string;
          id?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          max_uses?: number;
          member_id: string;
          notes?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
          used_count?: number;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          expires_at?: string;
          id?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          max_uses?: number;
          member_id?: string;
          notes?: string | null;
          revoked_at?: string | null;
          updated_at?: string;
          used_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "member_invitations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          alumni_since: string | null;
          batch_no: number | null;
          created_at: string;
          current_organization: string | null;
          department_code: string | null;
          designation: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_profile_claimed: boolean;
          jnuits_id: string;
          linkedin_url: string | null;
          member_type: string;
          phone: string | null;
          professional_visibility: string;
          profile_claimed_at: string | null;
          updated_at: string;
          user_id: string | null;
          verification_code_hash: string | null;
          website_url: string | null;
          work_location: string | null;
        };
        Insert: {
          alumni_since?: string | null;
          batch_no?: number | null;
          created_at?: string;
          current_organization?: string | null;
          department_code?: string | null;
          designation?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_profile_claimed?: boolean;
          jnuits_id: string;
          linkedin_url?: string | null;
          member_type?: string;
          phone?: string | null;
          professional_visibility?: string;
          profile_claimed_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
          verification_code_hash?: string | null;
          website_url?: string | null;
          work_location?: string | null;
        };
        Update: {
          alumni_since?: string | null;
          batch_no?: number | null;
          created_at?: string;
          current_organization?: string | null;
          department_code?: string | null;
          designation?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_profile_claimed?: boolean;
          jnuits_id?: string;
          linkedin_url?: string | null;
          member_type?: string;
          phone?: string | null;
          professional_visibility?: string;
          profile_claimed_at?: string | null;
          updated_at?: string;
          user_id?: string | null;
          verification_code_hash?: string | null;
          website_url?: string | null;
          work_location?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_department_code_fkey";
            columns: ["department_code"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["code"];
          },
        ];
      };
      membership_applications: {
        Row: {
          batch_label: string | null;
          created_at: string;
          department_code: string | null;
          email: string;
          facebook_url: string | null;
          id: string;
          invitation_id: string | null;
          linkedin_url: string | null;
          name: string;
          phone: string | null;
          photo_url: string | null;
          processed_member_id: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by_user_id: string | null;
          status: string;
          student_id: string | null;
          updated_at: string;
        };
        Insert: {
          batch_label?: string | null;
          created_at?: string;
          department_code?: string | null;
          email: string;
          facebook_url?: string | null;
          id?: string;
          invitation_id?: string | null;
          linkedin_url?: string | null;
          name: string;
          phone?: string | null;
          photo_url?: string | null;
          processed_member_id?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          status?: string;
          student_id?: string | null;
          updated_at?: string;
        };
        Update: {
          batch_label?: string | null;
          created_at?: string;
          department_code?: string | null;
          email?: string;
          facebook_url?: string | null;
          id?: string;
          invitation_id?: string | null;
          linkedin_url?: string | null;
          name?: string;
          phone?: string | null;
          photo_url?: string | null;
          processed_member_id?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          status?: string;
          student_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "membership_applications_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "member_invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "membership_applications_department_code_fkey";
            columns: ["department_code"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "membership_applications_processed_member_id_fkey";
            columns: ["processed_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      membership_lifecycle_events: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          event_type: string;
          id: string;
          member_id: string;
          metadata: Json;
          occurred_at: string;
          summary: string | null;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          event_type: string;
          id?: string;
          member_id: string;
          metadata?: Json;
          occurred_at?: string;
          summary?: string | null;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          event_type?: string;
          id?: string;
          member_id?: string;
          metadata?: Json;
          occurred_at?: string;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "membership_lifecycle_events_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_reports: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          id: string;
          report: Json;
          report_type: string;
          status: string;
          summary: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          report?: Json;
          report_type: string;
          status?: string;
          summary?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          id?: string;
          report?: Json;
          report_type?: string;
          status?: string;
          summary?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      profile_update_requests: {
        Row: {
          created_at: string;
          id: string;
          member_id: string;
          payload: Json;
          request_type: string;
          requested_at: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by_user_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          member_id: string;
          payload?: Json;
          request_type: string;
          requested_at?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          member_id?: string;
          payload?: Json;
          request_type?: string;
          requested_at?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by_user_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_update_requests_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          batch_no: number | null;
          created_at: string;
          department_code: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          batch_no?: number | null;
          created_at?: string;
          department_code?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          batch_no?: number | null;
          created_at?: string;
          department_code?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_code_fkey";
            columns: ["department_code"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["code"];
          },
        ];
      };
      rbac_platform_roles: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_system: boolean;
          title: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          is_system?: boolean;
          title: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          is_system?: boolean;
          title?: string;
        };
        Relationships: [];
      };
      rbac_user_platform_roles: {
        Row: {
          created_at: string;
          granted_at: string;
          granted_by: string | null;
          id: string;
          note: string | null;
          revoked_at: string | null;
          role_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          note?: string | null;
          revoked_at?: string | null;
          role_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          note?: string | null;
          revoked_at?: string | null;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rbac_user_platform_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "rbac_platform_roles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_platform_role: {
        Args: {
          role_code: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]
    )[TableName] extends {
      Row: infer RowType;
    }
    ? RowType
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer RowType;
      }
      ? RowType
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer InsertType;
    }
    ? InsertType
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer InsertType;
      }
      ? InsertType
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer UpdateType;
    }
    ? UpdateType
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer UpdateType;
      }
      ? UpdateType
      : never
    : never;
