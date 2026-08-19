import { useEffect, useRef, useState, type FormEvent } from "react";
import { adminFetch, API_BASE, uploadFile } from "./file-explorer/utils";
import { COUNTRIES } from "../../lib/countries";

interface RosterEntry {
  uid: string;
  name: string;
}

interface SchemaField {
  id: string;
  label: string;
  sensitive: boolean;
  attachable: boolean;
}

interface SchemaCategory {
  id: string;
  num: string;
  name: string;
  tone: string;
  is_media: boolean;
  fields?: SchemaField[];
}

interface AssetItem {
  id: string;
  kind: string;
  label: string;
  meta: string;
  // Set once a real file has been uploaded for this item (see
  // AttachmentEditor) -- the object's path under the shared GCS bucket,
  // relative to root_prefix. Absent for the ~90 pre-existing fictional
  // seeded assets, which stay metadata-only placeholders.
  path?: string;
}

interface ProfileField {
  id: string;
  value: string;
  assets?: AssetItem[];
}

// Ad-hoc, per-profile fields (see personnel_schema.py's shape_profile()
// docstring) -- unlike ProfileField, these have no SchemaField counterpart
// to source label/sensitive/attachable from, so they carry their own full
// set of properties, same shape as a built-in field's *shaped* output.
interface CustomField {
  id: string;
  label: string;
  value: string;
  sensitive: boolean;
  attachable: boolean;
  assets: AssetItem[];
}

// Same shape as AssetItem -- a media item and an attached asset are really
// the same kind of thing (a labeled, possibly-real-file attachment), just
// stored under different keys ("media.items" vs. a field's "_assets" entry).
type MediaItem = AssetItem;

interface ProfileCategory {
  id: string;
  is_media: boolean;
  fields?: ProfileField[];
  custom_fields?: CustomField[];
  media?: MediaItem[];
}

interface Profile {
  uid: string;
  name: string;
  categories: ProfileCategory[];
}

const ASSET_KINDS = ["PHOTO", "SCAN", "AUDIO", "VIDEO"];
const MEDIA_KINDS = ["PHOTO", "VIDEO", "AUDIO", "CCTV"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentEditorProps {
  items: AssetItem[];
  kinds: string[];
  // Where uploads for this field/media list get stored, e.g.
  // `personnel/${uid}/${categoryId}/${fieldId}`. Null when uploads aren't
  // possible yet (new profile, no uid typed in) -- the upload trigger stays
  // disabled with an explanatory title in that case, rather than silently
  // writing to a `personnel/undefined/...` path.
  pathPrefix: string | null;
  onAdd: (item: AssetItem) => void;
  onRemove: (itemId: string) => void;
}

// Shared by every attachable field's assets, every per-profile custom
// field's assets, and the Media & Visuals category's items -- all three are
// really the same thing (a labeled list of real uploaded files), so this is
// one component rather than three near-duplicates. Reuses the file-explorer
// island's own upload transport (uploadFile -> signed GCS PUT, the same
// flow /fm's admin upload button uses) rather than building a second one.
function AttachmentEditor({ items, kinds, pathPrefix, onAdd, onRemove }: AttachmentEditorProps) {
  const [kind, setKind] = useState(kinds[0]);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again still fires onChange
    if (!file || !pathPrefix) return;
    setUploading(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const path = `${pathPrefix}/${id}-${file.name}`;
      await uploadFile(path, file, "public", true);
      const dot = file.name.lastIndexOf(".");
      const nameSansExt = dot > 0 ? file.name.slice(0, dot) : file.name;
      onAdd({ id, kind, label: label.trim() || nameSansExt, meta: formatFileSize(file.size), path });
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="dbsa-assets">
      {items.map((a) => (
        <div key={a.id} className="dbsa-asset-row">
          <span className="dbsa-asset-kind">{a.kind}</span>
          <span className="dbsa-asset-label">{a.label}</span>
          <span className="dbsa-asset-meta">{a.meta}</span>
          <button type="button" className="dbsa-asset-remove" onClick={() => onRemove(a.id)} aria-label="Remove attachment">
            &times;
          </button>
        </div>
      ))}
      <div className="dbsa-asset-add">
        <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={uploading}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          disabled={uploading}
        />
        <input ref={fileInputRef} type="file" hidden onChange={handleFilePicked} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !pathPrefix}
          title={pathPrefix ? undefined : "Enter a UID first"}
        >
          {uploading ? "Uploading…" : "Choose file"}
        </button>
      </div>
      {error && <span className="dbsa-error">{error}</span>}
    </div>
  );
}

interface AddFieldFormProps {
  onAdd: (label: string, sensitive: boolean, attachable: boolean) => void;
}

// The "+ Add new field" trigger for a category's custom fields -- collapsed
// to a single dashed button until clicked, then reveals label/sensitive/
// attachable controls inline. Per-profile only (see personnel_schema.py's
// shape_profile() docstring): a field added here lives on just this one
// profile's document, not the shared schema.
function AddFieldForm({ onAdd }: AddFieldFormProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [attachable, setAttachable] = useState(false);

  function submit() {
    if (!label.trim()) return;
    onAdd(label.trim(), sensitive, attachable);
    setLabel("");
    setSensitive(false);
    setAttachable(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="dbsa-addfield-trigger" onClick={() => setOpen(true)}>
        + Add new field
      </button>
    );
  }

  return (
    <div className="dbsa-addfield-form">
      <input
        type="text"
        placeholder="Field label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={100}
        autoFocus
      />
      <label className="dbsa-addfield-toggle">
        <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
        Sensitive
      </label>
      <label className="dbsa-addfield-toggle">
        <input type="checkbox" checked={attachable} onChange={(e) => setAttachable(e.target.checked)} />
        Attachable
      </label>
      <button type="button" onClick={submit}>
        Add
      </button>
      <button type="button" className="dbsa-cancel" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

interface PersonnelFormProps {
  editingUid: string | null;
  schema: SchemaCategory[];
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

function PersonnelForm({ editingUid, schema, onSaved, onDeleted, onClose }: PersonnelFormProps) {
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  // category id -> field id -> value
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  // category id -> field id -> assets
  const [assets, setAssets] = useState<Record<string, Record<string, AssetItem[]>>>({});
  // category id -> this profile's ad-hoc fields for that category
  const [customFields, setCustomFields] = useState<Record<string, CustomField[]>>({});
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState(schema[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActiveCategoryId(schema[0]?.id ?? "");
    if (!editingUid) {
      setUid("");
      setName("");
      setValues({});
      setAssets({});
      setCustomFields({});
      setMediaItems([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/dbs/personnel/${encodeURIComponent(editingUid)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((profile: Profile) => {
        if (cancelled) return;
        setUid(profile.uid);
        setName(profile.name);
        const nextValues: Record<string, Record<string, string>> = {};
        const nextAssets: Record<string, Record<string, AssetItem[]>> = {};
        const nextCustomFields: Record<string, CustomField[]> = {};
        let nextMediaItems: MediaItem[] = [];
        for (const cat of profile.categories) {
          if (cat.is_media) {
            // Defensive id fallback: any pre-migration seeded item without
            // a stable id (see seed_personnel.py) still needs one to be
            // addable/removable by key here.
            nextMediaItems = (cat.media ?? []).map((m) => ({ ...m, id: m.id ?? crypto.randomUUID() }));
            continue;
          }
          if (!cat.fields) continue;
          nextValues[cat.id] = {};
          nextAssets[cat.id] = {};
          for (const f of cat.fields) {
            if (f.value && f.value !== "NOT ON FILE") nextValues[cat.id][f.id] = f.value;
            if (f.assets && f.assets.length > 0) nextAssets[cat.id][f.id] = f.assets;
          }
          if (cat.custom_fields && cat.custom_fields.length > 0) nextCustomFields[cat.id] = cat.custom_fields;
        }
        setValues(nextValues);
        setAssets(nextAssets);
        setCustomFields(nextCustomFields);
        setMediaItems(nextMediaItems);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingUid, schema]);

  function setFieldValue(catId: string, fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [catId]: { ...prev[catId], [fieldId]: value } }));
  }

  function addAsset(catId: string, fieldId: string, item: AssetItem) {
    setAssets((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [fieldId]: [...(prev[catId]?.[fieldId] ?? []), item] },
    }));
  }

  function removeAsset(catId: string, fieldId: string, assetId: string) {
    setAssets((prev) => ({
      ...prev,
      [catId]: { ...prev[catId], [fieldId]: (prev[catId]?.[fieldId] ?? []).filter((a) => a.id !== assetId) },
    }));
  }

  function addCustomField(catId: string, label: string, sensitive: boolean, attachable: boolean) {
    const field: CustomField = { id: crypto.randomUUID(), label, value: "", sensitive, attachable, assets: [] };
    setCustomFields((prev) => ({ ...prev, [catId]: [...(prev[catId] ?? []), field] }));
  }

  function removeCustomField(catId: string, fieldId: string) {
    setCustomFields((prev) => ({ ...prev, [catId]: (prev[catId] ?? []).filter((f) => f.id !== fieldId) }));
  }

  function setCustomFieldValue(catId: string, fieldId: string, value: string) {
    setCustomFields((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).map((f) => (f.id === fieldId ? { ...f, value } : f)),
    }));
  }

  function addCustomFieldAsset(catId: string, fieldId: string, item: AssetItem) {
    setCustomFields((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).map((f) => (f.id === fieldId ? { ...f, assets: [...f.assets, item] } : f)),
    }));
  }

  function removeCustomFieldAsset(catId: string, fieldId: string, assetId: string) {
    setCustomFields((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? []).map((f) =>
        f.id === fieldId ? { ...f, assets: f.assets.filter((a) => a.id !== assetId) } : f
      ),
    }));
  }

  function addMediaItem(item: MediaItem) {
    setMediaItems((prev) => [...prev, item]);
  }

  function removeMediaItem(itemId: string) {
    setMediaItems((prev) => prev.filter((m) => m.id !== itemId));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const categories: Record<string, Record<string, unknown>> = {};
      for (const cat of schema) {
        if (cat.is_media) {
          // JSON.stringify drops keys with an undefined value, so this
          // naturally omits "path" for items with no real file uploaded.
          categories[cat.id] = { items: mediaItems.map(({ id, kind, label, meta, path }) => ({ id, kind, label, meta, path })) };
          continue;
        }
        if (!cat.fields) continue;
        const catBody: Record<string, unknown> = {};
        const catAssets: Record<string, AssetItem[]> = {};
        for (const f of cat.fields) {
          const v = values[cat.id]?.[f.id];
          if (v) catBody[f.id] = v;
          if (f.attachable) {
            const a = assets[cat.id]?.[f.id];
            if (a && a.length > 0) catAssets[f.id] = a;
          }
        }
        if (Object.keys(catAssets).length > 0) catBody["_assets"] = catAssets;
        const custom = customFields[cat.id];
        if (custom && custom.length > 0) catBody["_custom"] = custom;
        categories[cat.id] = catBody;
      }

      const body = { uid, name, categories };
      const path = editingUid
        ? `/api/admin/dbs/personnel/${encodeURIComponent(editingUid)}`
        : "/api/admin/dbs/personnel";
      const resp = await adminFetch(path, {
        method: editingUid ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        setError(errBody.error ?? `Couldn't save profile (${resp.status})`);
        return;
      }
      onSaved();
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editingUid) return;
    if (!window.confirm(`Delete profile ${editingUid}? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch(`/api/admin/dbs/personnel/${encodeURIComponent(editingUid)}`, {
        method: "DELETE",
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        setError(errBody.error ?? `Couldn't delete profile (${resp.status})`);
        return;
      }
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  const activeCategory = schema.find((c) => c.id === activeCategoryId);

  return (
    <div className="dbsa-form-panel">
      <div className="dbsa-form-header">
        <span className="dbsa-form-title">{editingUid ? `Edit ${editingUid}` : "New Profile"}</span>
        <button type="button" className="dbsa-form-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>

      {loading ? (
        <p className="dbsa-loading">Loading profile...</p>
      ) : (
        <form className="dbsa-form" onSubmit={submit}>
          <div className="dbsa-top-fields">
            <label>
              UID
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                disabled={!!editingUid}
                maxLength={40}
                placeholder="e.g. A-0900"
                required
              />
            </label>
            <label>
              Name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            </label>
          </div>

          <div className="dbsa-body">
            <nav className="dbsa-catnav">
              {schema.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`dbsa-catnav-item ${cat.id === activeCategoryId ? "is-active" : ""}`}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  <span className="dbsa-catnav-num">{cat.num}</span>
                  <span className="dbsa-catnav-name">{cat.name}</span>
                </button>
              ))}
            </nav>

            <div className="dbsa-catbody">
              {activeCategory?.is_media ? (
                <AttachmentEditor
                  items={mediaItems}
                  kinds={MEDIA_KINDS}
                  pathPrefix={uid.trim() ? `personnel/${uid.trim()}/media` : null}
                  onAdd={addMediaItem}
                  onRemove={removeMediaItem}
                />
              ) : (
                activeCategory && (
                  <>
                    {activeCategory.fields?.map((f) => (
                      <div key={f.id} className="dbsa-field">
                        <label className="dbsa-field-label">
                          {f.label}
                          {f.sensitive && <span className="dbsa-field-sensitive-tag">SENSITIVE</span>}
                        </label>
                        {f.id === "nationality" ? (
                          <select
                            value={values[activeCategory.id]?.[f.id] ?? ""}
                            onChange={(e) => setFieldValue(activeCategory.id, f.id, e.target.value)}
                          >
                            <option value="">-- select a country --</option>
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={values[activeCategory.id]?.[f.id] ?? ""}
                            onChange={(e) => setFieldValue(activeCategory.id, f.id, e.target.value)}
                            maxLength={200}
                          />
                        )}
                        {f.attachable && (
                          <AttachmentEditor
                            items={assets[activeCategory.id]?.[f.id] ?? []}
                            kinds={ASSET_KINDS}
                            pathPrefix={uid.trim() ? `personnel/${uid.trim()}/${activeCategory.id}/${f.id}` : null}
                            onAdd={(item) => addAsset(activeCategory.id, f.id, item)}
                            onRemove={(assetId) => removeAsset(activeCategory.id, f.id, assetId)}
                          />
                        )}
                      </div>
                    ))}

                    {(customFields[activeCategory.id] ?? []).map((f) => (
                      <div key={f.id} className="dbsa-field">
                        <label className="dbsa-field-label">
                          {f.label}
                          {f.sensitive && <span className="dbsa-field-sensitive-tag">SENSITIVE</span>}
                          <button
                            type="button"
                            className="dbsa-field-remove"
                            onClick={() => removeCustomField(activeCategory.id, f.id)}
                            aria-label="Remove this field"
                          >
                            &times;
                          </button>
                        </label>
                        <input
                          type="text"
                          value={f.value}
                          onChange={(e) => setCustomFieldValue(activeCategory.id, f.id, e.target.value)}
                          maxLength={200}
                        />
                        {f.attachable && (
                          <AttachmentEditor
                            items={f.assets}
                            kinds={ASSET_KINDS}
                            pathPrefix={uid.trim() ? `personnel/${uid.trim()}/${activeCategory.id}/${f.id}` : null}
                            onAdd={(item) => addCustomFieldAsset(activeCategory.id, f.id, item)}
                            onRemove={(assetId) => removeCustomFieldAsset(activeCategory.id, f.id, assetId)}
                          />
                        )}
                      </div>
                    ))}

                    <AddFieldForm
                      onAdd={(label, sensitive, attachable) => addCustomField(activeCategory.id, label, sensitive, attachable)}
                    />
                  </>
                )
              )}
            </div>
          </div>

          <div className="dbsa-form-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : editingUid ? "Update profile" : "Create profile"}
            </button>
            {editingUid && (
              <button type="button" className="dbsa-delete" disabled={busy} onClick={handleDelete}>
                Delete
              </button>
            )}
            <button type="button" className="dbsa-cancel" disabled={busy} onClick={onClose}>
              Cancel
            </button>
          </div>
          {error && <span className="dbsa-error">{error}</span>}
        </form>
      )}
    </div>
  );
}

// The authenticated view -- everything the Personnel tab renders once
// AdminConsole.tsx has already confirmed a session. Same split as
// TimerAdminContent/DeadDropAdminContent, for the same reason (one shared
// login gate, not three independent ones).
export function PersonnelAdminContent() {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [schema, setSchema] = useState<SchemaCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function refreshRoster() {
    try {
      // Plain fetch, not adminFetch -- the roster list is public data (see
      // dbs_api.py's list_personnel), same reasoning as TimerAdminContent
      // originally used before /api/timers grew a visibility split.
      const resp = await fetch(`${API_BASE}/api/dbs/personnel`, { cache: "no-store" });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = (await resp.json()) as { people: RosterEntry[] };
      setRoster(data.people);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load personnel.");
    }
  }

  useEffect(() => {
    refreshRoster();
    fetch(`${API_BASE}/api/dbs/schema`)
      .then((r) => r.json())
      .then((data: { categories: SchemaCategory[] }) => setSchema(data.categories))
      .catch(() => setLoadError("Failed to load the field schema."));
  }, []);

  function closeForm() {
    setFormOpen(false);
    setEditingUid(null);
  }

  if (!schema) {
    return <p className="dbsa-loading">Loading…</p>;
  }

  return (
    <div className="dbsa-admin">
      {loadError && <p className="dbsa-error">{loadError}</p>}

      <div className="dbsa-listing">
        {roster.length === 0 && !formOpen && <p className="dbsa-empty">No profiles yet.</p>}
        <div className="dbsa-roster">
          {roster.map((p) => (
            <button
              key={p.uid}
              type="button"
              className="dbsa-roster-item"
              onClick={() => {
                setEditingUid(p.uid);
                setFormOpen(true);
              }}
            >
              <span className="dbsa-roster-name">{p.name}</span>
              <span className="dbsa-roster-uid">{p.uid}</span>
            </button>
          ))}
        </div>
      </div>

      {formOpen ? (
        <PersonnelForm
          editingUid={editingUid}
          schema={schema}
          onSaved={() => {
            closeForm();
            refreshRoster();
          }}
          onDeleted={() => {
            closeForm();
            refreshRoster();
          }}
          onClose={closeForm}
        />
      ) : (
        <button
          type="button"
          className="dbsa-add"
          onClick={() => {
            setEditingUid(null);
            setFormOpen(true);
          }}
        >
          + New Profile
        </button>
      )}
    </div>
  );
}
