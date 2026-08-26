export type ReferenceEmbedTarget = { kind: "iframe" | "video"; url: string };

export function referenceEmbedTarget(value: string): ReferenceEmbedTarget | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) {
      const id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
      return id ? { kind:"iframe", url:`https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (host.endsWith("instagram.com") && /\/(?:reel|p|tv)\//.test(url.pathname)) {
      return { kind:"iframe", url:`https://www.instagram.com${url.pathname.replace(/\/+$/, "")}/embed/` };
    }
    if (host.endsWith("tiktok.com")) {
      const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? { kind:"iframe", url:`https://www.tiktok.com/player/v1/${id}` } : null;
    }
    if (host.endsWith("vimeo.com")) {
      const id = url.pathname.match(/\/(\d+)/)?.[1];
      return id ? { kind:"iframe", url:`https://player.vimeo.com/video/${id}` } : null;
    }
    if (/\.(?:mp4|webm|mov)(?:$|\?)/i.test(url.pathname + url.search)) return { kind:"video", url:url.toString() };
    return null;
  } catch {
    return null;
  }
}
