import type { TicketCommentAttachment } from "@/lib/tickets-api";

type Props = {
  attachments: TicketCommentAttachment[];
};

function isImage(mimeType?: string, name?: string): boolean {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(name ?? "");
}

export function TicketAttachmentList({ attachments }: Props) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={`${a.url}-${a.name}`}>
          {isImage(a.mimeType, a.name) ? (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="max-h-32 max-w-[200px] object-cover" />
            </a>
          ) : (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-sky-300 hover:bg-zinc-900"
            >
              <span aria-hidden>📎</span>
              <span className="max-w-[160px] truncate">{a.name}</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
