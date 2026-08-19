import { useEffect, useState } from "react";
import { API_BASE, detectCategory, getSignedUrl, rawUrl } from "./file-explorer/utils";
import { COUNTRY_CODE_BY_NAME } from "../../lib/countries";

interface RosterEntry {
  uid: string;
  name: string;
}

interface AssetItem {
  id: string;
  kind: string;
  label: string;
  meta: string;
  // Present once a real file has been uploaded for this item via the admin
  // form -- absent for the fictional seed data's placeholder assets, which
  // render the same "no file" note they always have.
  path?: string;
}

interface DossierField {
  id: string;
  label: string;
  value: string;
  sensitive: boolean;
  attachable: boolean;
  assets: AssetItem[];
}

type MediaItem = AssetItem;

interface DossierCategory {
  id: string;
  num: string;
  name: string;
  tone: "std" | "semi" | "sens";
  is_media: boolean;
  fields?: DossierField[];
  custom_fields?: DossierField[];
  media?: MediaItem[];
}

interface Profile {
  uid: string;
  name: string;
  categories: DossierCategory[];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("");
}

function toneLabel(tone: string): string {
  if (tone === "sens") return "REGULATED";
  if (tone === "semi") return "RESTRICTED";
  return "STANDARD";
}

function toneClass(tone: string): string {
  if (tone === "sens") return "is-running";
  if (tone === "semi") return "is-paused";
  return "is-expired";
}

function findFieldValue(profile: Profile, categoryId: string, fieldId: string): string | null {
  const field = profile.categories.find((c) => c.id === categoryId)?.fields?.find((f) => f.id === fieldId);
  if (!field || field.value === "NOT ON FILE") return null;
  return field.value;
}

export default function PersonnelDatabase() {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [openUid, setOpenUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("identity");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  // Keyed by "categoryId.fieldId", not just fieldId -- some field ids
  // (e.g. blood_type) appear in more than one category, so a bare fieldId
  // key would expand/collapse the wrong field's list.
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [viewingAsset, setViewingAsset] = useState<AssetItem | null>(null);
  // Only populated for a real, uploaded audio/video file -- getSignedUrl()
  // is async (a direct-to-GCS signed URL, since Cloud Run can't do the
  // Range requests playback/seeking needs), so it's fetched on open rather
  // than eagerly for every asset up front.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function toggleExpanded(key: string) {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    setPreviewUrl(null);
    if (!viewingAsset?.path) return;
    const category = detectCategory(viewingAsset.path);
    if (category !== "audio" && category !== "video") return;
    let cancelled = false;
    getSignedUrl(viewingAsset.path)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        /* leave previewUrl null -- falls back to the download link below */
      });
    return () => {
      cancelled = true;
    };
  }, [viewingAsset]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/dbs/personnel`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setRoster(body.people);
      })
      .catch(() => {
        if (!cancelled) setRosterError("Couldn't reach the personnel database.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!openUid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);
    setActiveCategoryId("identity");
    setRevealed({});
    setExpandedFields(new Set());
    setViewingAsset(null);
    fetch(`${API_BASE}/api/dbs/personnel/${encodeURIComponent(openUid)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((body: Profile) => {
        if (!cancelled) setProfile(body);
      })
      .catch(() => {
        if (!cancelled) setProfileError("Couldn't load this dossier.");
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openUid]);

  const filtered = (roster ?? []).filter((p) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (p.name + p.uid).toLowerCase().includes(q);
  });

  const activeCategory = profile?.categories.find((c) => c.id === activeCategoryId);
  const activeIsRevealed = activeCategoryId ? !!revealed[activeCategoryId] : false;
  const activeHasSensitive = [...(activeCategory?.fields ?? []), ...(activeCategory?.custom_fields ?? [])].some(
    (f) => f.sensitive
  );

  function renderAssetPreview(asset: AssetItem) {
    if (!asset.path) {
      return (
        <p className="dbs-asset-modal-note">
          No file is stored yet -- this is placeholder metadata for a future upload, not a real preview.
        </p>
      );
    }
    const category = detectCategory(asset.path);
    if (category === "image") {
      return <img className="dbs-asset-modal-preview" src={rawUrl(asset.path)} alt={asset.label} />;
    }
    if (category === "audio") {
      return previewUrl ? (
        <audio className="dbs-asset-modal-preview" controls src={previewUrl} />
      ) : (
        <p className="dbs-asset-modal-note">Loading preview...</p>
      );
    }
    if (category === "video") {
      return previewUrl ? (
        <video className="dbs-asset-modal-preview" controls src={previewUrl} />
      ) : (
        <p className="dbs-asset-modal-note">Loading preview...</p>
      );
    }
    return (
      <a className="dbs-asset-modal-download" href={`${rawUrl(asset.path)}&download=1`} target="_blank" rel="noreferrer">
        DOWNLOAD FILE
      </a>
    );
  }

  return (
    <div className="dbs-root">
      {!openUid && (
        <div className="dbs-topbar">
          <div className="timer-hud-status">
            <span className="timer-hud-status-dot" aria-hidden="true" />
            <span className="timer-hud-status-label">PERSONNEL DATABASE</span>
            <span className="timer-hud-status-count">
              {roster ? `${filtered.length} OF ${roster.length}` : "LOADING..."}
            </span>
          </div>
        </div>
      )}

      {!openUid && (
        <div className="dbs-searchbar">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SEARCH BY NAME OR ID..."
          />
        </div>
      )}

      {rosterError && <p className="dbs-error">{rosterError}</p>}

      {!openUid && roster && filtered.length === 0 && !rosterError && (
        <div className="dbs-empty">NO PERSONNEL FOUND</div>
      )}

      {!openUid && filtered.length > 0 && (
        <div className="timer-admin-grid">
          {filtered.map((p) => (
            <button
              key={p.uid}
              type="button"
              className="timer-admin-item timer-admin-item-editable dbs-card"
              onClick={() => setOpenUid(p.uid)}
            >
              <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
              <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />
              <div className="dbs-card-avatar">{initials(p.name)}</div>
              <div className="dbs-card-name">{p.name}</div>
              <div className="dbs-card-uid">ID {p.uid}</div>
            </button>
          ))}
        </div>
      )}

      {openUid && (
        <div className="dbs-dossier">
          <div className="dbs-dossier-topbar">
            <button
              type="button"
              className="dbs-filter-btn"
              onClick={() => setOpenUid(null)}
            >
              &larr; BACK TO ROSTER
            </button>
          </div>

          {profileLoading && <p className="dbs-loading">Loading dossier...</p>}
          {profileError && <p className="dbs-error">{profileError}</p>}

          {profile && (
            <div className="timer-admin-item dbs-panel">
              <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
              <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />

              <div className="dbs-identity-banner">
                {(() => {
                  const nationality = findFieldValue(profile, "identity", "nationality");
                  const code = nationality ? COUNTRY_CODE_BY_NAME[nationality] : undefined;
                  return code ? (
                    <span className="dbs-identity-flag" title={nationality ?? undefined}>
                      <span className={`fi fi-${code}`} />
                    </span>
                  ) : null;
                })()}
                <div className="dbs-identity-avatar">{initials(profile.name)}</div>
                <div className="dbs-identity-main">
                  <div className="dbs-identity-name">{profile.name}</div>
                </div>
                <div className="dbs-identity-meta">
                  <span className="dbs-identity-uid">ID {profile.uid}</span>
                </div>
              </div>

              <div className="dbs-body">
                <nav className="dbs-catnav">
                  {profile.categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`dbs-catnav-item ${c.id === activeCategoryId ? "is-active" : ""} dbs-tone-${c.tone}`}
                      onClick={() => setActiveCategoryId(c.id)}
                    >
                      <span className="dbs-catnav-num">{c.num}</span>
                      <span className="dbs-catnav-name">{c.name}</span>
                      {c.tone === "sens" && <span className="dbs-catnav-lock">&#9650;</span>}
                    </button>
                  ))}
                </nav>

                {activeCategory && (
                  <div className="dbs-catbody">
                    <div className="dbs-catbody-header">
                      <span className="dbs-catbody-num">{activeCategory.num}</span>
                      <span className="dbs-catbody-name">{activeCategory.name}</span>
                      <span className={`timer-hud-pill ${toneClass(activeCategory.tone)}`}>
                        {toneLabel(activeCategory.tone)}
                      </span>
                      <div className="dbs-catbody-spacer" />
                      {activeHasSensitive && (
                        <button
                          type="button"
                          className="dbs-reveal-btn"
                          onClick={() =>
                            setRevealed((r) => ({ ...r, [activeCategoryId]: !r[activeCategoryId] }))
                          }
                        >
                          {activeIsRevealed ? "MASK SENSITIVE" : "REVEAL SENSITIVE"}
                        </button>
                      )}
                    </div>

                    {activeCategory.tone === "sens" && (
                      <div className="dbs-regulated-banner">
                        REGULATED CATEGORY -- SPECIAL SAFEGUARDS APPLY (GDPR / HIPAA / CCPA)
                      </div>
                    )}

                    {activeCategory.is_media ? (
                      activeCategory.media && activeCategory.media.length > 0 ? (
                        <div className="dbs-media-grid">
                          {activeCategory.media.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="dbs-media-tile"
                              onClick={() => setViewingAsset(m)}
                            >
                              {m.path && detectCategory(m.path) === "image" ? (
                                <img className="dbs-media-tile-thumb" src={rawUrl(m.path)} alt={m.label} />
                              ) : (
                                <div className="dbs-media-tile-kind">{m.kind}</div>
                              )}
                              <div className="dbs-media-tile-footer">
                                <span className="dbs-media-tile-label">{m.label}</span>
                                <span className="dbs-media-tile-meta">{m.meta}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="dbs-media-empty">NO MEDIA ON FILE</div>
                      )
                    ) : (
                      <div className="dbs-fields">
                        {[...(activeCategory.fields ?? []), ...(activeCategory.custom_fields ?? [])].map((f) => {
                          const key = `${activeCategoryId}.${f.id}`;
                          const isExpanded = expandedFields.has(key);
                          return (
                            <div key={f.id} className="dbs-field">
                              <div className="dbs-field-label">
                                <span className="dbs-field-label-text">
                                  {f.label}
                                  {f.sensitive && <span className="dbs-field-sensitive-tag">SENSITIVE</span>}
                                </span>
                                {f.attachable && (
                                  <span className="dbs-field-assets-toggle">
                                    <span className="dbs-field-assets-count">
                                      {f.assets.length} ASSET{f.assets.length === 1 ? "" : "S"}
                                    </span>
                                    <button
                                      type="button"
                                      className="dbs-field-assets-btn"
                                      aria-label={isExpanded ? "Hide assets" : "Show assets"}
                                      onClick={() => toggleExpanded(key)}
                                    >
                                      {isExpanded ? "−" : "+"}
                                    </button>
                                  </span>
                                )}
                              </div>
                              <div className={`dbs-field-value ${f.sensitive && !activeIsRevealed ? "is-masked" : ""}`}>
                                {f.sensitive && !activeIsRevealed ? "----------" : f.value}
                              </div>
                              {f.attachable && isExpanded && (
                                <div className="dbs-field-assets-list">
                                  {f.assets.length === 0 ? (
                                    <div className="dbs-field-assets-empty">NO ASSETS ATTACHED</div>
                                  ) : (
                                    f.assets.map((a) => (
                                      <button
                                        key={a.id}
                                        type="button"
                                        className="dbs-field-asset-item"
                                        onClick={() => setViewingAsset(a)}
                                      >
                                        <span className="dbs-field-asset-kind">{a.kind}</span>
                                        <span className="dbs-field-asset-label">{a.label}</span>
                                        <span className="dbs-field-asset-meta">{a.meta}</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {viewingAsset && (
        <div className="dbs-asset-modal-backdrop" onClick={() => setViewingAsset(null)}>
          <div className="dbs-asset-modal" onClick={(e) => e.stopPropagation()}>
            <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
            <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />
            <div className="dbs-asset-modal-kind">{viewingAsset.kind}</div>
            <div className="dbs-asset-modal-label">{viewingAsset.label}</div>
            <div className="dbs-asset-modal-meta">{viewingAsset.meta}</div>
            {renderAssetPreview(viewingAsset)}
            <button type="button" className="dbs-filter-btn" onClick={() => setViewingAsset(null)}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
