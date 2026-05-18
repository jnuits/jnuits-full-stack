-- Avoid rendering "Jagannath University" twice for the current Moderator/Mentor.
-- The designation already includes the institution, so department must stay null.

update public.advisor_profiles
set
  designation = 'Professor & Chairman, Department of Computer Science & Engineering and Director, Institutional Quality Assurance Cell (IQAC), Jagannath University',
  department = null,
  bio = 'Professor and Chairman, Department of Computer Science & Engineering, Jagannath University. Director, Institutional Quality Assurance Cell (IQAC).',
  updated_at = timezone('utc', now())
where advisor_jnuits_id = 'JNUITS-MOD0002';
