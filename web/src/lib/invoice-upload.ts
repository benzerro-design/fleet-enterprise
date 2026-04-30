export async function uploadInvoiceFile(
  file: File,
  invoiceNumber?: string | null,
): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  if (invoiceNumber?.trim()) {
    fd.set("invoiceNumber", invoiceNumber.trim());
  }
  const res = await fetch("/api/uploads/invoices", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const j = (await res.json()) as { url?: string };
  if (!j.url) throw new Error("Upload response invalid.");
  return j.url;
}
