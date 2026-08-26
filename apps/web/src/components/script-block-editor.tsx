"use client";

import type { ScriptSection } from "@result/db";
import {
  Captions,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  MessageSquareQuote,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Text,
  Trash2,
  Video,
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, TextareaHTMLAttributes } from "react";
import { createScriptBlock, scriptBlockType, type ScriptBlockType } from "@/lib/script-blocks";

type Command = {
  id: ScriptBlockType | "reference" | "resource";
  label: string;
  hint: string;
  keywords: string;
  icon: ReactNode;
};

const commands: Command[] = [
  { id:"text", label:"Text", hint:"Plain script copy", keywords:"paragraph body", icon:<Text/> },
  { id:"heading_1", label:"Heading 1", hint:"Large section title", keywords:"title h1", icon:<Heading1/> },
  { id:"heading_2", label:"Heading 2", hint:"Medium section title", keywords:"subtitle h2", icon:<Heading2/> },
  { id:"heading_3", label:"Heading 3", hint:"Small section title", keywords:"subtitle h3", icon:<Heading3/> },
  { id:"beat", label:"Script beat", hint:"Timecode, direction and dialogue", keywords:"hook transition cta scene section", icon:<Captions/> },
  { id:"direction", label:"Stage direction", hint:"Italic filming or edit note", keywords:"visual camera b-roll action", icon:<Pilcrow/> },
  { id:"dialogue", label:"Dialogue", hint:"What the creator says", keywords:"speech spoken copy", icon:<MessageSquareQuote/> },
  { id:"bullet", label:"Bullet list", hint:"A scannable instruction", keywords:"list item", icon:<List/> },
  { id:"quote", label:"Quote", hint:"Call out an exact line", keywords:"pullquote callout", icon:<Quote/> },
  { id:"divider", label:"Divider", hint:"Separate script moments", keywords:"line separator", icon:<Minus/> },
  { id:"reference", label:"Reference video", hint:"Embed in the right rail", keywords:"video reel tiktok instagram youtube", icon:<Video/> },
  { id:"resource", label:"Editing resource", hint:"Add image, audio or file", keywords:"asset image audio file", icon:<ImageIcon/> },
];

export function ScriptBlockEditor({ sections, onChange, canEdit, onAddReference, onAddResource }: {
  sections: ScriptSection[];
  onChange: (sections:ScriptSection[]) => void;
  canEdit: boolean;
  onAddReference: () => void;
  onAddResource: () => void;
}) {
  const [menu, setMenu] = useState<{ index:number; query:string; mode:"insert"|"transform" } | null>(null);
  const [selected, setSelected] = useState(0);
  const editorSections = sections.length ? sections : [createScriptBlock("text", crypto.randomUUID())];
  const visibleCommands = useMemo(() => {
    const query = menu?.query.trim().toLowerCase() ?? "";
    if (!query) return commands;
    return commands.filter((command) => `${command.id} ${command.label} ${command.hint} ${command.keywords}`.toLowerCase().includes(query));
  },[menu?.query]);

  const openMenu = (index:number,query:string,mode:"insert"|"transform"="transform") => { setSelected(0); setMenu({index,query,mode}); };
  const focusBlock = (id:string) => window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`[data-script-block-id="${CSS.escape(id)}"]`)?.focus());

  const patch = (index:number, next:Partial<ScriptSection>) => onChange(editorSections.map((section,position) => position===index ? {...section,...next} : section));
  const insert = (index:number, type:ScriptBlockType="text") => {
    const next = createScriptBlock(type,crypto.randomUUID());
    onChange([...editorSections.slice(0,index+1),next,...editorSections.slice(index+1)]);
    setMenu(null);
    focusBlock(next.id);
  };
  const remove = (index:number) => {
    if (editorSections.length === 1) return patch(0,{copy:"",blockType:"text",label:"Text",timecode:"",visualDirection:"",delivery:""});
    const next = editorSections.filter((_,position)=>position!==index);
    onChange(next);
    setMenu(null);
    if (next[Math.max(0,index-1)]?.id) focusBlock(next[Math.max(0,index-1)]!.id);
  };
  const splitAtCursor = (index:number,offset:number) => {
    const current = editorSections[index]!;
    const currentType = scriptBlockType(current);
    const nextType:ScriptBlockType = currentType === "direction" ? "dialogue" : currentType === "bullet" ? "bullet" : "text";
    const next = {...createScriptBlock(nextType,crypto.randomUUID()),copy:current.copy.slice(offset)};
    onChange([...editorSections.slice(0,index),{...current,copy:current.copy.slice(0,offset)},next,...editorSections.slice(index+1)]);
    setMenu(null);
    focusBlock(next.id);
  };
  const apply = (command:Command,index:number) => {
    if (command.id === "reference" || command.id === "resource") {
      if (menu?.mode === "transform") patch(index,{copy:""});
      setMenu(null);
      if (command.id === "reference") onAddReference(); else onAddResource();
      return;
    }
    if (menu?.mode === "insert") {
      if (command.id === "divider") {
        const divider = createScriptBlock("divider",crypto.randomUUID());
        const trailing = createScriptBlock("text",crypto.randomUUID());
        onChange([...editorSections.slice(0,index+1),divider,trailing,...editorSections.slice(index+1)]);
        setMenu(null);
        focusBlock(trailing.id);
        return;
      }
      insert(index,command.id);
      return;
    }
    const current = editorSections[index]!;
    const next = {...createScriptBlock(command.id,current.id),copy:""};
    if (command.id === "divider") {
      const trailing = createScriptBlock("text",crypto.randomUUID());
      onChange([...editorSections.slice(0,index),next,trailing,...editorSections.slice(index+1)]);
      setMenu(null);
      focusBlock(trailing.id);
      return;
    }
    onChange(editorSections.map((section,position)=>position===index?next:section));
    setMenu(null);
    focusBlock(current.id);
  };
  const handleCopyChange = (index:number,value:string) => {
    patch(index,{copy:value});
    const trimmed = value.trimStart();
    if (trimmed.startsWith("/") && !trimmed.includes("\n")) openMenu(index,trimmed.slice(1));
    else if (menu?.index === index) setMenu(null);
  };
  const handleKey = (event:ReactKeyboardEvent<HTMLTextAreaElement>,index:number) => {
    if (menu?.index === index) {
      if (event.key === "ArrowDown") { event.preventDefault(); setSelected((current)=>Math.min(current+1,Math.max(0,visibleCommands.length-1))); return; }
      if (event.key === "ArrowUp") { event.preventDefault(); setSelected((current)=>Math.max(0,current-1)); return; }
      if (event.key === "Enter" && visibleCommands[selected]) { event.preventDefault(); apply(visibleCommands[selected],index); return; }
      if (event.key === "Escape") { event.preventDefault(); setMenu(null); return; }
    }
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); splitAtCursor(index,event.currentTarget.selectionStart); return; }
    if (event.key === "Backspace" && !editorSections[index]?.copy && editorSections.length>1) { event.preventDefault(); remove(index); }
  };
  const blockMenu = (index:number) => menu?.index===index ? <SlashMenu commands={visibleCommands} selected={selected} onSelect={(command)=>apply(command,index)}/> : null;

  return <section className="notion-script-editor" aria-label="Script document">
    {editorSections.map((section,index) => {
      const type = scriptBlockType(section);
      if (type === "divider") return <div className="notion-block notion-divider" key={section.id}><BlockHandle onOpen={()=>openMenu(index,"","insert")} onRemove={()=>remove(index)} canEdit={canEdit}/><hr/>{blockMenu(index)}</div>;
      if (type === "beat") return <article className="notion-block notion-beat" key={section.id}>
        <BlockHandle onOpen={()=>openMenu(index,"","insert")} onRemove={()=>remove(index)} canEdit={canEdit}/>
        <div className="notion-beat-heading"><AutoTextarea value={section.label} onChange={(event)=>patch(index,{label:event.target.value})} placeholder="Hook" aria-label={`Beat ${index+1} label`} disabled={!canEdit}/><AutoTextarea value={section.timecode} onChange={(event)=>patch(index,{timecode:event.target.value})} placeholder="0:00 to 0:06" aria-label={`Beat ${index+1} timecode`} disabled={!canEdit}/></div>
        <AutoTextarea className="notion-beat-direction" value={section.visualDirection} onChange={(event)=>patch(index,{visualDirection:event.target.value})} placeholder="Describe the shot, setting or edit…" aria-label={`Beat ${index+1} visual direction`} disabled={!canEdit}/>
        <AutoTextarea className="notion-beat-copy" data-script-block-id={section.id} value={section.copy} onChange={(event)=>handleCopyChange(index,event.target.value)} onKeyDown={(event)=>handleKey(event,index)} placeholder="What the creator says… Type / for commands" aria-label={`Beat ${index+1} dialogue`} disabled={!canEdit}/>
        {blockMenu(index)}
      </article>;
      const placeholder = type==="direction" ? "Describe the shot, action or edit…" : type==="dialogue" ? "What the creator says…" : "Type / for commands";
      return <div className={`notion-block notion-${type}`} key={section.id}>
        <BlockHandle onOpen={()=>openMenu(index,"","insert")} onRemove={()=>remove(index)} canEdit={canEdit}/>
        {type==="bullet"?<span className="notion-bullet-dot">•</span>:null}
        <AutoTextarea data-script-block-id={section.id} value={section.copy} onChange={(event)=>handleCopyChange(index,event.target.value)} onKeyDown={(event)=>handleKey(event,index)} placeholder={placeholder} aria-label={`${commands.find((command)=>command.id===type)?.label ?? "Text"} block ${index+1}`} disabled={!canEdit}/>
        {blockMenu(index)}
      </div>;
    })}
    {canEdit?<button className="notion-add-block" type="button" onClick={()=>insert(editorSections.length-1)}><Plus/>Add a block <span>or type /</span></button>:null}
  </section>;
}

function AutoTextarea(props:TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${Math.max(ref.current.scrollHeight,30)}px`;
  },[props.value]);
  return <textarea {...props} ref={ref} rows={1}/>;
}

function BlockHandle({ onOpen,onRemove,canEdit }:{ onOpen:()=>void;onRemove:()=>void;canEdit:boolean }) {
  if (!canEdit) return null;
  return <div className="notion-block-handle"><button type="button" onClick={onOpen} aria-label="Insert a block" title="Insert block or media"><Plus/></button><button type="button" onClick={onRemove} aria-label="Delete block" title="Delete block"><Trash2/></button></div>;
}

function SlashMenu({ commands:items,selected,onSelect }:{ commands:Command[];selected:number;onSelect:(command:Command)=>void }) {
  return <div className="slash-command-menu" role="listbox" aria-label="Block commands">
    <header><strong>Insert a block</strong><span>Keep typing to filter</span></header>
    <div>{items.length?items.map((command,index)=><button type="button" role="option" aria-selected={selected===index} data-selected={selected===index||undefined} key={command.id} onPointerDown={(event)=>event.preventDefault()} onClick={()=>onSelect(command)}><i>{command.icon}</i><span><strong>{command.label}</strong><small>{command.hint}</small></span><kbd>/{command.id.replace("heading_", "h")}</kbd></button>):<p>No matching commands</p>}</div>
  </div>;
}
