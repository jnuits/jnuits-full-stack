"use client";

import { ChevronDown, Plus, Save } from "lucide-react";
import { useState } from "react";

import { saveCommitteeTermPosition } from "@/app/admin/committee/actions";
import type {
  CommitteeRoleClientShape,
  CommitteeTermPositionClientRecord,
} from "@/lib/committee/term-positions";
import { sortCommitteeTermPositions } from "@/lib/committee/term-positions";

export type { CommitteeTermPositionClientRecord } from "@/lib/committee/term-positions";

type PositionValues = {
  isPublic: boolean;
  maxSlots: number;
  minSlots: number;
  priority: number;
  publicLabel: string;
  publicLabelBn: null | string;
  roleGroup: string;
  roleId: string;
  targetSlots: number;
};

function PositionFields({
  legend,
  termId,
  values,
}: {
  legend: string;
  termId: string;
  values: PositionValues;
}) {
  return (
    <fieldset aria-label={legend} className="grid gap-4">
      <input name="roleId" type="hidden" value={values.roleId} />
      <input name="termId" type="hidden" value={termId} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="input-label sm:col-span-2">
          Public label
          <input defaultValue={values.publicLabel} maxLength={180} name="publicLabel" required />
        </label>
        <label className="input-label sm:col-span-2">
          Bengali label
          <input defaultValue={values.publicLabelBn || ""} maxLength={180} name="publicLabelBn" />
        </label>
        <label className="input-label">
          Group
          <select defaultValue={values.roleGroup} name="roleGroup">
            <option value="executive">Executive</option>
            <option value="sub_executive">Sub-executive</option>
            <option value="advisor">Advisor</option>
          </select>
        </label>
        <label className="input-label">
          Priority
          <input defaultValue={values.priority} max={9999} min={0} name="priority" required type="number" />
        </label>
        <label className="input-label">
          Visibility
          <select defaultValue={String(values.isPublic)} name="isPublic">
            <option value="true">Public</option>
            <option value="false">Hidden</option>
          </select>
        </label>
        <div aria-hidden="true" className="hidden xl:block" />
        <label className="input-label">
          Minimum seats
          <input defaultValue={values.minSlots} max={60} min={0} name="minSlots" required type="number" />
        </label>
        <label className="input-label">
          Target seats
          <input defaultValue={values.targetSlots} max={60} min={0} name="targetSlots" required type="number" />
        </label>
        <label className="input-label">
          Maximum seats
          <input defaultValue={values.maxSlots} max={60} min={0} name="maxSlots" required type="number" />
        </label>
      </div>
      <button className="admin-btn admin-btn--primary w-full sm:w-fit" type="submit">
        <Save aria-hidden="true" size={15} /> Save position
      </button>
    </fieldset>
  );
}

export function CommitteePositionEditor({
  positions,
  roles,
  term,
}: {
  positions: CommitteeTermPositionClientRecord[];
  roles: CommitteeRoleClientShape[];
  term: { id: string; title: string } | null | undefined;
}) {
  const termPositions = term
    ? sortCommitteeTermPositions(positions.filter((position) => position.termId === term.id))
    : [];
  const configuredRoleIds = new Set(termPositions.map((position) => position.roleId));
  const availableRoles = roles
    .filter((role) => !configuredRoleIds.has(role.id))
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  const [newRoleId, setNewRoleId] = useState(availableRoles[0]?.id || "");
  const newRole = availableRoles.find((role) => role.id === newRoleId) || availableRoles[0] || null;

  if (!term) {
    return (
      <p className="portal-message portal-message--error" role="alert">
        Select an executive committee term before editing its positions.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div>
        <h3 className="text-sm font-semibold">Positions for {term.title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Labels, ordering, visibility, and seat limits apply only to this committee term.
        </p>
      </div>

      <div className="grid gap-3">
        {termPositions.length > 0 ? (
          termPositions.map((position) => (
            <details className="rounded-xl border border-border bg-card" key={position.id}>
              <summary
                aria-label={`Edit ${position.publicLabel} position`}
                className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{position.publicLabel}</span>
                  <span className="block text-xs text-muted-foreground">
                    {position.roleCode} · priority {position.priority} · target {position.targetSlots}
                  </span>
                </span>
                <span className={`abadge ${position.isPublic ? "abadge--approved" : "abadge--draft"}`}>
                  {position.isPublic ? "public" : "hidden"}
                </span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
              </summary>
              <form action={saveCommitteeTermPosition} className="border-t border-border p-4">
                <PositionFields
                  legend={`Edit ${position.publicLabel} position`}
                  termId={term.id}
                  values={position}
                />
              </form>
            </details>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            This term has no configured positions yet. Add one from the canonical role dictionary below.
          </p>
        )}
      </div>

      {newRole ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Plus aria-hidden="true" className="size-4 text-primary" />
            <h4 className="text-sm font-semibold">Add a term position</h4>
          </div>
          <label className="input-label mb-4 max-w-xl">
            Canonical role
            <select onChange={(event) => setNewRoleId(event.currentTarget.value)} value={newRole.id}>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.title}</option>
              ))}
            </select>
          </label>
          <form action={saveCommitteeTermPosition} key={newRole.id}>
            <PositionFields
              legend={`Add ${newRole.title} position`}
              termId={term.id}
              values={{
                isPublic: true,
                maxSlots: newRole.maxSlots,
                minSlots: newRole.minSlots,
                priority: newRole.sortOrder,
                publicLabel: newRole.title,
                publicLabelBn: newRole.titleBn,
                roleGroup: newRole.roleGroup,
                roleId: newRole.id,
                targetSlots: Math.min(newRole.maxSlots, Math.max(newRole.minSlots, newRole.defaultSlots)),
              }}
            />
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Every canonical role is configured for this term.</p>
      )}
    </div>
  );
}
