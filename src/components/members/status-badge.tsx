import type { MemberDirectoryEntry } from "@/lib/members/directory";

export function StatusBadge({
  memberType,
}: {
  memberType: MemberDirectoryEntry["memberType"];
}) {
  if (memberType === "alumni") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#92400E] dark:border-[#78350F] dark:bg-[#451A03] dark:text-[#FDE68A]">
        Alumni
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit items-center rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-xs font-semibold text-[#4338CA] dark:border-[#3730A3] dark:bg-[#1E1B4B] dark:text-[#C7D2FE]">
      Member
    </span>
  );
}
