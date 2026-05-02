import { updateAdvisorProfileAction } from "@/app/(portal)/portal/advisor/profile/actions";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalUser } from "@/lib/auth/session";
import { getPortalAdvisorSnapshot } from "@/lib/portal/advisor";
import { BookOpen, GraduationCap, Info, MessageSquareText } from "lucide-react";

export const metadata = { title: "Advisor Profile | JnUITS Portal" };

const messageMap: Record<string, string> = {
  "profile-saved": "Advisor profile saved. Public committee pages will use the updated advisor information.",
};

const errorMap: Record<string, string> = {
  "advisor-required": "This account is not linked to an advisor profile.",
  "invalid-profile": "Check the profile fields and try again.",
  "save-failed": "The advisor profile could not be saved.",
};

export default async function AdvisorProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePortalUser({ fallbackPath: "/portal/advisor/profile" });
  if (!auth.user) return null;

  const params = await searchParams;
  const message =
    typeof params.message === "string" ? messageMap[params.message] || null : null;
  const error =
    typeof params.error === "string" ? errorMap[params.error] || null : null;
  const snapshot = await getPortalAdvisorSnapshot(auth.user.id);
  const advisor = snapshot.advisor;

  return (
    <PortalShell
      avatarUrl={advisor?.avatarSecureUrl ?? null}
      memberName={advisor?.fullName ?? null}
      portalRole="advisor"
    >
      <div className="portal-page-header">
        <div>
          <p className="portal-page-header__breadcrumb">Advisor Portal</p>
          <h1 className="portal-page-header__title">Advisor Profile</h1>
          <p className="portal-page-header__desc">
            Maintain your public advisor message, professional background, publications, and writing profile.
          </p>
        </div>
        {advisor ? (
          <span className="portal-badge portal-badge--member">
            {advisor.advisorType.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>

      {message ? (
        <div className="flash-panel" data-tone="success">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{message}</p>
        </div>
      ) : null}
      {error ? (
        <div className="flash-panel" data-tone="error">
          <p style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>{error}</p>
        </div>
      ) : null}

      {!advisor ? (
        <div className="portal-section">
          <div className="portal-section__header">
            <div className="portal-section__header-left">
              <div className="portal-section__icon"><Info size={14} /></div>
              <p className="portal-section__title">Advisor link required</p>
            </div>
          </div>
          <div className="portal-section__body">
            <p style={{ color: "var(--muted-foreground)", fontSize: "0.88rem", lineHeight: 1.7 }}>
              Ask an operator to create and link your advisor profile before you can maintain this workspace.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="portal-stat-grid">
            <div className="portal-stat-card" data-tone={advisor.isCurrent ? "success" : "warning"}>
              <div className="portal-stat-card__icon"><GraduationCap size={15} /></div>
              <p className="portal-stat-card__label">Advisor state</p>
              <p className="portal-stat-card__value">{advisor.isCurrent ? "Current" : "Former"}</p>
              <p className="portal-stat-card__sub">{advisor.department || "Department not set"}</p>
            </div>
            <div className="portal-stat-card" data-tone={advisor.isPublic ? "success" : "warning"}>
              <div className="portal-stat-card__icon"><Info size={15} /></div>
              <p className="portal-stat-card__label">Public profile</p>
              <p className="portal-stat-card__value">{advisor.isPublic ? "Visible" : "Private"}</p>
              <p className="portal-stat-card__sub">Controlled by committee admins</p>
            </div>
            <div className="portal-stat-card">
              <div className="portal-stat-card__icon"><BookOpen size={15} /></div>
              <p className="portal-stat-card__label">Publications</p>
              <p className="portal-stat-card__value">{advisor.publications.length}</p>
              <p className="portal-stat-card__sub">Listed profile highlights</p>
            </div>
            <div className="portal-stat-card">
              <div className="portal-stat-card__icon"><MessageSquareText size={15} /></div>
              <p className="portal-stat-card__label">Message</p>
              <p className="portal-stat-card__value">{advisor.speech ? "Set" : "Empty"}</p>
              <p className="portal-stat-card__sub">Advisor speech excerpt</p>
            </div>
          </div>

          <div className="portal-section">
            <div className="portal-section__header">
              <div className="portal-section__header-left">
                <div className="portal-section__icon"><GraduationCap size={14} /></div>
                <p className="portal-section__title">Public advisor profile</p>
              </div>
            </div>
            <div className="portal-section__body">
              <form action={updateAdvisorProfileAction} style={{ display: "grid", gap: "0.9rem" }}>
                <label className="input-label" htmlFor="advisor-speech">
                  Speech / message
                  <textarea
                    defaultValue={advisor.speech || ""}
                    id="advisor-speech"
                    name="speech"
                    placeholder="Write a short message for the public advisor board."
                    rows={5}
                  />
                </label>
                <label className="input-label" htmlFor="advisor-bio">
                  Bio
                  <textarea
                    defaultValue={advisor.bio || ""}
                    id="advisor-bio"
                    name="bio"
                    placeholder="Short academic or professional biography"
                    rows={5}
                  />
                </label>
                <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))" }}>
                  <label className="input-label" htmlFor="advisor-facebook">
                    Facebook URL
                    <input defaultValue={advisor.facebookUrl || ""} id="advisor-facebook" name="facebookUrl" />
                  </label>
                  <label className="input-label" htmlFor="advisor-linkedin">
                    LinkedIn URL
                    <input defaultValue={advisor.linkedinUrl || ""} id="advisor-linkedin" name="linkedinUrl" />
                  </label>
                  <label className="input-label" htmlFor="advisor-website">
                    Website URL
                    <input defaultValue={advisor.websiteUrl || ""} id="advisor-website" name="websiteUrl" />
                  </label>
                </div>
                <label className="input-label" htmlFor="advisor-work-experience">
                  Work experience
                  <textarea
                    defaultValue={advisor.workExperience.join("\n")}
                    id="advisor-work-experience"
                    name="workExperience"
                    placeholder="One item per line"
                    rows={5}
                  />
                </label>
                <label className="input-label" htmlFor="advisor-publications">
                  Publications
                  <textarea
                    defaultValue={advisor.publications.join("\n")}
                    id="advisor-publications"
                    name="publications"
                    placeholder="One item per line"
                    rows={5}
                  />
                </label>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button className="primary-button" type="submit">
                    Save advisor profile
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </PortalShell>
  );
}
