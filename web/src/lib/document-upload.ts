export async function uploadDocumentFile(file: File, label?: string | null): Promise<{ url: string; name: string }> {
  const fd = new FormData();
  fd.set("file", file);
  if (label?.trim()) fd.set("label", label.trim());
  const res = await fetch("/api/uploads/documents", { method: "POST", body: fd });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    const raw = await res.text().catch(() => "");
    if (raw) {
      try {
        const j = JSON.parse(raw) as { message?: string | string[] };
        if (typeof j.message === "string") msg = j.message;
        else if (Array.isArray(j.message)) msg = j.message.join(", ");
        else msg = raw.slice(0, 200);
      } catch {
        msg = raw.slice(0, 200);
      }
    }
    throw new Error(msg);
  }
  const j = (await res.json()) as { url?: string; name?: string };
  if (!j.url) throw new Error("Upload response invalid.");
  return { url: j.url, name: j.name ?? file.name };
}
