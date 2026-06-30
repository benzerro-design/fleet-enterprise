export type UploadedTicketAttachment = {
  url: string;
  name: string;
  mimeType: string;
};

export async function uploadTicketAttachment(
  file: File,
  ticketId?: string,
): Promise<UploadedTicketAttachment> {
  const fd = new FormData();
  fd.set("file", file);
  if (ticketId?.trim()) fd.set("ticketId", ticketId.trim());
  const res = await fetch("/api/uploads/tickets", { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const j = (await res.json()) as { url?: string; name?: string; mimeType?: string };
  if (!j.url || !j.name) throw new Error("Upload response invalid.");
  return {
    url: j.url,
    name: j.name,
    mimeType: j.mimeType ?? (file.type || "application/octet-stream"),
  };
}
