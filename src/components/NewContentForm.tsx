"use client";
import { useState, useMemo, useEffect } from "react";
import {
  BRANDS,
  CONTENT_TYPES,
  LAYERS,
  ANGLES,
  Brand,
  ContentType,
  User,
} from "@/lib/config";
import { generateContentName } from "@/lib/naming";

type Props = {
  user: User;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onCreated: () => void;
  onClose: () => void;
};

export default function NewContentForm({
  user,
  authFetch,
  onCreated,
  onClose,
}: Props) {
  const defaultBrand = user.brand || BRANDS[0];
  const [brand, setBrand] = useState<Brand>(defaultBrand);
  const [contentType, setContentType] = useState<ContentType>("Video");
  const [description, setDescription] = useState("");
  const [layer, setLayer] = useState("Layer 1");
  const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newAngle, setNewAngle] = useState("");
  const [createdName, setCreatedName] = useState("");
  const [copied, setCopied] = useState(false);

  // Next sequence number for this brand, read from the sheet, so the preview
  // shows the real name. Re-read when the brand changes or after a submit.
  const [nextSeq, setNextSeq] = useState<number | null>(null);
  const [seqVersion, setSeqVersion] = useState(0);
  // The preview name at the moment of submit, to spot a number taken meanwhile
  const [submittedPreview, setSubmittedPreview] = useState("");
  useEffect(() => {
    let cancelled = false;
    setNextSeq(null);
    authFetch(`/api/content/next-seq?brand=${encodeURIComponent(brand)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.seqNo === "number") setNextSeq(data.seqNo);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authFetch, brand, seqVersion]);

  // Angles: try API (Config tab) first, fall back to hardcoded
  const [anglesMap, setAnglesMap] = useState<Record<string, string[]>>(ANGLES);
  useEffect(() => {
    authFetch("/api/angles")
      .then((res) => res.json())
      .then((data) => {
        if (data.angles) setAnglesMap(data.angles);
      })
      .catch(() => {}); // silently fall back to hardcoded
  }, [authFetch]);

  const availableAngles = anglesMap[brand] || [];

  // Live preview of auto-generated name
  const previewName = useMemo(() => {
    if (!description) return "";
    return generateContentName({
      creator: user.name,
      contentType,
      seqNo: nextSeq ?? 0, // 0 → shown as ___ until the number loads
      description,
      date: new Date(date),
    });
  }, [user.name, contentType, description, date, nextSeq]);

  const previewDisplay = nextSeq === null ? previewName.replace(" 0-", " ___-") : previewName;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleAngle = (angle: string) => {
    setSelectedAngles((prev) =>
      prev.includes(angle) ? prev.filter((a) => a !== angle) : [...prev, angle]
    );
  };

  // Upload file to Google Drive via resumable upload
  const uploadToDrive = async (
    file: File,
    brand: Brand,
  ): Promise<{ fileName: string; fileUrl: string }> => {
    // Some files (.mov on Windows, .heic, etc.) report an empty type,
    // which the upload route would reject — fall back to a generic one.
    const mimeType = file.type || "application/octet-stream";

    // Step 1: Get resumable upload URL from our API
    const initRes = await authFetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        fileName: file.name,
        mimeType,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json();
      throw new Error(`第1步 ${err.error || "上传初始化失败"}`);
    }

    const { uploadUrl } = await initRes.json();

    // Step 2: Upload file directly to Google Drive
    const xhr = new XMLHttpRequest();
    const uploadPromise = new Promise<string>((resolve, reject) => {
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response.id);
          } catch {
            // If response isn't JSON, the file was uploaded but we need ID
            resolve("");
          }
        } else {
          reject(new Error(`第2步 档案传进 Drive 失败: ${xhr.status} ${xhr.responseText.slice(0, 200)}`));
        }
      };

      xhr.onerror = () => reject(new Error("第2步 档案传进 Drive 被浏览器拦截（CORS）"));
      xhr.send(file);
    });

    const fileId = await uploadPromise;
    const fileUrl = fileId
      ? `https://drive.google.com/file/d/${fileId}/view`
      : "";

    return { fileName: file.name, fileUrl };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedPreview(nextSeq !== null ? previewName : "");
    setSubmitting(true);
    setUploadProgress(0);

    try {
      let fileName = "";
      let fileUrl = "";

      // Upload file to Drive if selected
      if (file) {
        const result = await uploadToDrive(file, brand);
        fileName = result.fileName;
        fileUrl = result.fileUrl;
      }

      // Create content record in Sheets
      const res = await authFetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          contentType,
          description,
          layer,
          angles: selectedAngles,
          date,
          fileName,
          fileUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const result = await res.json();
      // Show the final name so user can copy it for ads
      setCreatedName(result.name || result.entry?.name || "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Success screen — show final name with copy button
  if (createdName) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-lg">
          <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Content Created ✓
            </h2>
            <button
              type="button"
              onClick={() => {
                setCreatedName("");
                onCreated();
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Content name for ads:
            </p>

            {submittedPreview && submittedPreview !== createdName && (
              <div className="rounded-xl border border-yellow-400 bg-yellow-50 p-3 text-xs text-yellow-900">
                ⚠ 编号变了：刚才有人先提交了同品牌的 content。
                <br />
                如果你已经用 <code className="font-mono">{submittedPreview}</code> 开了广告，
                请把广告名字改成下面这个，不然广告数据配对不到。
              </div>
            )}

            {/* Name display with copy */}
            <div className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-4">
              <code className="text-sm text-[var(--text-primary)] font-mono break-all leading-relaxed block">
                {createdName}
              </code>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(createdName)}
                className="flex-1 px-5 py-3 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <span>✓</span> Copied!
                  </>
                ) : (
                  <>
                    <span>📋</span> Copy Name
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Reset form for another entry
                  setCreatedName("");
                  setSubmittedPreview("");
                  setSeqVersion((v) => v + 1);
                  setDescription("");
                  setSelectedAngles([]);
                  setFile(null);
                  setCopied(false);
                }}
                className="px-5 py-3 rounded-xl text-sm font-medium bg-[var(--bg-input)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
              >
                + Create Another
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setCreatedName("");
                onCreated();
              }}
              className="w-full px-5 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              New content
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              创建一条新内容记录
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Preview with copy */}
        {description && (
          <div className="mx-6 mt-4 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)]">
                PREVIEW · AUTO-BUILT NAME
              </span>
              {/* Only copyable once the real number is in: an ad named with
                  "___" would never match its content. */}
              {nextSeq !== null && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(previewName)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              )}
            </div>
            <code className="text-sm text-[var(--text-primary)] font-mono break-all">
              {previewDisplay}
            </code>
            {nextSeq === null && (
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">正在读取编号…</p>
            )}
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Brand */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Brand <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {(user.role === "master" ? BRANDS : [defaultBrand]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBrand(b);
                    setSelectedAngles([]);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    brand === b
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Content Type <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {Object.keys(CONTENT_TYPES).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContentType(t as ContentType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    contentType === t
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 中医师IP（备孕）"
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              广告日期
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Layer */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Layer <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {LAYERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    layer === l
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Angle */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Angle <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {availableAngles.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAngle(a)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    selectedAngles.includes(a)
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newAngle}
                onChange={(e) => setNewAngle(e.target.value)}
                placeholder="Add a new angle..."
                className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (newAngle.trim()) {
                    toggleAngle(newAngle.trim());
                    setNewAngle("");
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                + Add
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Video / Image files
            </label>
            <div
              className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--accent)] transition"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept="video/*,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="text-sm text-[var(--text-primary)]">
                  <span>📎 {file.name}</span>
                  <span className="text-[var(--text-secondary)] ml-2">
                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-2xl mb-2">⬆</div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Drop file here, or click to browse
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    支持大文件，直接上传到 Google Drive
                  </p>
                </>
              )}
            </div>

            {/* Upload progress */}
            {submitting && file && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>上传中...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !description || selectedAngles.length === 0}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting
              ? file
                ? `Uploading ${uploadProgress}%...`
                : "Creating..."
              : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
