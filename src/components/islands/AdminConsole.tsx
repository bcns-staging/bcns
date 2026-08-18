import { useEffect, useState } from "react";
import { LoginPanel } from "./file-explorer/AdminControls";
import { checkAdminSession } from "./file-explorer/utils";
import FileExplorer from "./FileExplorer";
import { TimerAdminContent } from "./TimerAdmin";
import { DeadDropAdminContent } from "./DeadDropAdmin";
import AdminSettings from "./AdminSettings";

// One login for all three admin tools -- checked exactly once here, rather
// than each tool's own component independently re-checking the session
// (and each briefly flashing its own login screen) every time it's the
// active tab. TimerAdminContent/DeadDropAdminContent are the "already
// authenticated" halves of TimerAdmin.tsx/DeadDropAdmin.tsx, split out for
// exactly this reason; FileExplorer.tsx isn't split the same way since its
// own internal admin check is soft (adminMode + a logged-out session just
// hides the mutating controls, it doesn't block the whole component the
// way the other two do), so embedding it as-is here is safe.
type Tab = "files" | "timers" | "deaddrop" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "files", label: "File Manager" },
  { id: "timers", label: "Timer Admin" },
  { id: "deaddrop", label: "Dead Drop" },
  { id: "settings", label: "Settings" },
];

function readTabFromUrl(): Tab {
  if (typeof window === "undefined") return "files";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return TABS.some((t) => t.id === requested) ? (requested as Tab) : "files";
}

export default function AdminConsole() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(readTabFromUrl);

  useEffect(() => {
    let cancelled = false;
    checkAdminSession().then((authenticated) => {
      if (!cancelled) setIsAdmin(authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    // Bookmarkable/shareable and survives a refresh, without a full page
    // navigation -- replaceState, not pushState: tab-switching isn't
    // meaningful browser-back history, the same way clicking between
    // panels in a settings dialog wouldn't be.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  if (isAdmin === null) return null;
  if (!isAdmin) {
    return (
      <div className="timer-admin-login-wrap">
        <LoginPanel onLoggedIn={() => setIsAdmin(true)} />
      </div>
    );
  }

  return (
    <div className="admin-console">
      <div className="admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inactive tabs unmount entirely, not just hidden via CSS -- each
          tool runs its own polling/countdown intervals, and there's no
          reason to keep three of those ticking in the background at once.
          Switching back in re-fetches fresh, which is a feature, not a
          cost, here. */}
      <div className="admin-tab-panel">
        {activeTab === "files" && (
          <div className="file-explorer-theme">
            <FileExplorer adminMode />
          </div>
        )}
        {activeTab === "timers" && <TimerAdminContent />}
        {activeTab === "deaddrop" && <DeadDropAdminContent />}
        {activeTab === "settings" && (
          // .file-explorer-theme, not because this is file-explorer content,
          // but because it's the wrapper that carries the HUD-repointed
          // --color-* tokens the reused file-explorer-icon-button/
          // TotpSettings classes render against (see file-explorer.css) --
          // without it they'd fall back to the site's unrelated default
          // theme, since custom properties only inherit to descendants of
          // wherever they're declared.
          <div className="file-explorer-theme">
            <AdminSettings onLoggedOut={() => setIsAdmin(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
