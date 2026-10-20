"use client";

type Props = {
  urls: string[];
  maxVisible?: number;
};

export function TireHotelIntakePhotos({ urls, maxVisible = 6 }: Props) {
  if (urls.length === 0) return null;

  const visible = urls.slice(0, maxVisible);
  const extra = urls.length - visible.length;

  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">Foto recepție</p>
      <ul className="flex flex-wrap gap-2">
        {visible.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-16 w-16 object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.parentElement?.classList.add("hidden");
                }}
              />
            </a>
          </li>
        ))}
        {extra > 0 ? (
          <li className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500">
            +{extra}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
