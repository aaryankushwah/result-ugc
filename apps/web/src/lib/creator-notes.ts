export type CreatorPageView="creators"|"notes";
export function normalizeCreatorPageView(value?:string):CreatorPageView{return value==="notes"?"notes":"creators";}
export function noteInputPlaceholder(name:string):string{return `Write a note about ${name}…`;}
