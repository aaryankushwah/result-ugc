import { ExternalLink, Play } from "lucide-react";
import { referenceEmbedTarget } from "@/lib/reference-embed";

export function ReferenceEmbed({ url, title, compact = false }: { url:string; title:string; compact?:boolean }) {
  const target = referenceEmbedTarget(url);
  return <div className="reference-embed" data-compact={compact || undefined}>
    {target?.kind === "iframe" ? <iframe src={target.url} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/> : null}
    {target?.kind === "video" ? <video src={target.url} controls preload="metadata" playsInline/> : null}
    {!target ? <a className="reference-embed-fallback" href={url} target="_blank" rel="noreferrer"><span><Play/></span><strong>Open reference video</strong><small>This source does not offer an inline player.</small></a> : null}
    <a className="reference-embed-link" href={url} target="_blank" rel="noreferrer"><span>{title}</span><ExternalLink/></a>
  </div>;
}
