"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton({
  className = "",
  redirectTo,
}: {
  className?: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.replace(redirectTo);
      router.refresh();
      setPending(false);
    }
  }

  return (
    <button
      className={className}
      disabled={pending}
      onClick={() => {
        void handleSignOut();
      }}
      type="button"
    >
      <LogOut aria-hidden="true" size={14} />
      {pending ? "Signing out..." : "Logout"}
    </button>
  );
}
