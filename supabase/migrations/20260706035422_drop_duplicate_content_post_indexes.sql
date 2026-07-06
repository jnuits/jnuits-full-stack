-- Drop duplicate content_posts indexes reported by Supabase advisors.
-- Keep the newer/descriptive names that match current review-state terminology.

drop index if exists public.content_posts_author_member_idx;
drop index if exists public.content_posts_review_queue_idx;

notify pgrst, 'reload schema';
