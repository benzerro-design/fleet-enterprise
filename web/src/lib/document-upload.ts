export async function uploadDocumentFile(file: File, label?: string | null): Promise<{ url: string; name: string }> {
  const fd = new FormData();
  fd.set("file", file);
  if (label?.trim()) fd.set("label", label.trim());
  const res = await fetch("/api/uploads/documents", { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const j = (await res.json()) as { url?: string; name?: string };
  if (!j.url) throw new Error("Upload response invalid.");
  return { url: j.url, name: j.name ?? file.name };
}
