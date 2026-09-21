"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { performSignOut } from "@/app/(auth)/actions";

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
      // Server action signs out of Supabase AND clears the privileged
      // step-up / directory-verification cookies (httpOnly, so this must
      // not happen browser-side).
      await performSignOut(redirectTo);
    } finally {
      router.refresh();
      setPending(false);
    }
  }

  return (
    <button
      aria-label={pending ? "Signing out" : "Logout"}
      className={className}
      disabled={pending}
      onClick={() => {
        void handleSignOut();
      }}
      type="button"
    >
      <LogOut aria-hidden="true" size={14} />
      <span className="admin-logout-text">
        {pending ? "Signing out..." : "Logout"}
      </span>
    </button>
  );
}
