import { TotpSettings } from "./file-explorer/AdminControls";
import { LogOutIcon } from "./file-explorer/icons";
import { adminFetch } from "./file-explorer/utils";

// Session/2FA management, split out from the File Manager tab's own admin
// bar -- logging out or managing 2FA has nothing to do with files, and
// living here means it applies to the whole /admin console (all three
// tools share one session) rather than looking like a File Manager
// feature.
export default function AdminSettings({ onLoggedOut }: { onLoggedOut: () => void }) {
  async function logout() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    onLoggedOut();
  }

  return (
    <div className="admin-settings">
      <div className="admin-settings-section">
        <h2 className="admin-settings-heading">Session</h2>
        <button type="button" className="file-explorer-icon-button" onClick={logout}>
          <LogOutIcon size={14} />
          Log out
        </button>
      </div>
      <div className="admin-settings-section">
        <h2 className="admin-settings-heading">Two-factor authentication</h2>
        <TotpSettings />
      </div>
    </div>
  );
}
