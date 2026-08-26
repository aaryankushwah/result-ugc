import Image from "next/image";

/**
 * Provider avatars and thumbnails come from Discord, Viral, and social CDNs
 * whose hostnames are not stable enough for a safe global Next.js allow-list.
 * Keep their intrinsic dimensions explicit to prevent layout shift while still
 * letting the browser lazy-load and asynchronously decode them.
 */
export function SourceImage({
  src,
  width,
  height,
  alt = "",
}: {
  src: string;
  width: number;
  height: number;
  alt?: string;
}) {
  return (
    <Image
      src={src}
      width={width}
      height={height}
      sizes={`${width}px`}
      alt={alt}
      loading="lazy"
      decoding="async"
      unoptimized
    />
  );
}
