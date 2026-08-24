"use client";

import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, ExternalLink, Filter, Instagram, RotateCcw, Search, VideoOff, X, Youtube } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AccountAssignmentButton } from "@/components/creator-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortalAccount, PortalCreator, PortalVideo } from "@/lib/portal-types";
import { formatDate, formatNumber, formatPercent, StateBadge, timeAgo, TrackingBadge } from "./ui";

function SortButton({ label, sorted, toggle }: { label: string; sorted: false | "asc" | "desc"; toggle: () => void }) { return <Button variant="ghost" size="xs" className="sort-button" onClick={toggle}>{label}{sorted === "asc" ? <ArrowUp /> : sorted === "desc" ? <ArrowDown /> : <ArrowUpDown />}</Button>; }
function TableToolbar({ search, setSearch, placeholder, children, columns, toggleColumn }: { search: string; setSearch: (value: string) => void; placeholder: string; children?: React.ReactNode; columns: Array<{ id: string; label: string; visible: boolean }>; toggleColumn: (id: string) => void }) { return <div className="table-toolbar"><div className="table-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} />{search ? <Button variant="ghost" size="icon-xs" onClick={() => setSearch("")} aria-label="Clear search"><X /></Button> : null}</div>{children}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="toolbar-button"><Columns3 /> Columns</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-44">{columns.map((column) => <DropdownMenuCheckboxItem key={column.id} checked={column.visible} onCheckedChange={() => toggleColumn(column.id)}>{column.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div>; }
function Pagination({ page, pages, rows, previous, next, canPrevious, canNext }: { page: number; pages: number; rows: number; previous: () => void; next: () => void; canPrevious: boolean; canNext: boolean }) { return <div className="table-pagination"><span>{formatNumber(rows)} rows</span><div><span>Page {page} of {Math.max(1, pages)}</span><Button variant="outline" size="icon-sm" disabled={!canPrevious} onClick={previous}><ChevronLeft /></Button><Button variant="outline" size="icon-sm" disabled={!canNext} onClick={next}><ChevronRight /></Button></div></div>; }
function Avatar({ src, name }: { src: string | null; name: string }) { return <span className="table-avatar">{src ? <img src={src} alt="" /> : name.slice(0, 1).toUpperCase()}</span>; }
function TikTokIcon() { return <svg viewBox="0 0 448 512" aria-hidden="true"><path fill="currentColor" d="M448 209.9a210.1 210.1 0 0 1-122.8-39.2v178.7A162.6 162.6 0 1 1 185 188.3v89.9a74.6 74.6 0 1 0 52.2 71.2V0h88a121.2 121.2 0 0 0 1.9 22.2A122.2 122.2 0 0 0 394.3 102a121.4 121.4 0 0 0 53.7 13.6z" /></svg>; }
function SocialPlatformIcon({ platform }: { platform: string }) {
  const normalized = platform.toLowerCase();
  if (normalized === "instagram") return <Instagram aria-hidden="true" />;
  if (normalized === "youtube") return <Youtube aria-hidden="true" />;
  if (normalized === "tiktok") return <TikTokIcon />;
  return <>{platform.slice(0, 2).toUpperCase()}</>;
}
function AccountPlatformIcons({ accounts }: { accounts: PortalAccount[] }) {
  return <div className="account-platforms"><strong>{accounts.length}</strong>{accounts.slice(0, 4).map((account) => <span key={account.id} data-platform={account.platform.toLowerCase()} title={account.platform} aria-label={account.platform}><SocialPlatformIcon platform={account.platform} /></span>)}</div>;
}

const creatorTabLifecycle: Record<string, PortalCreator["lifecycle"]> = { requests: "request", active: "active", watch: "watch", offboarded: "offboarded" };

export function CreatorRoster({ creators }: { creators: PortalCreator[] }) {
  const params = useSearchParams(); const pathname = usePathname(); const router = useRouter(); const tab = params.get("tab") ?? "active";
  const [search, setSearch] = useState(params.get("q") ?? ""); const [sorting, setSorting] = useState<SortingState>([{ id: "views30d", desc: true }]); const [visibility, setVisibility] = useState<VisibilityState>({}); const [selection, setSelection] = useState<RowSelectionState>({});
  const filtered = useMemo(() => creators.filter((creator) => creator.lifecycle === creatorTabLifecycle[tab] && `${creator.displayName} ${creator.discord.username ?? ""} ${creator.accounts.map((account) => account.username).join(" ")} ${creator.nextStep ?? ""}`.toLowerCase().includes(search.toLowerCase())), [creators, tab, search]);
  const columns = useMemo<ColumnDef<PortalCreator>[]>(() => [
    { id: "select", header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))} aria-label="Select page" />, cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))} aria-label={`Select ${row.original.displayName}`} />, enableSorting: false },
    { accessorKey: "displayName", header: "Creator", cell: ({ row }) => <Link className="creator-cell" href={`/creators/${row.original.id}`}><Avatar src={row.original.discord.avatarUrl ?? row.original.accounts[0]?.avatarUrl ?? null} name={row.original.displayName} /><span><strong>{row.original.displayName}</strong><small>{row.original.source === "viral_candidate" ? `@${row.original.accounts[0]?.username ?? "unknown"} · unconfirmed match` : row.original.email ?? row.original.discord.username ?? "No contact"}</small></span></Link> },
    { accessorKey: "lifecycle", header: "Lifecycle", cell: ({ getValue }) => <StateBadge label={String(getValue())} tone={getValue() === "active" ? "success" : getValue() === "watch" ? "attention" : "neutral"} /> },
    { id: "discord", accessorFn: (row) => row.discord.state, header: "Discord", cell: ({ row }) => <div className="stack-cell"><StateBadge label={row.original.discord.state} tone={row.original.discord.state === "connected" ? "success" : "neutral"} /><small>{row.original.discord.username ? `@${row.original.discord.username}` : "Not reconciled"}</small></div> },
    { id: "relationships", accessorFn: (row) => row.relationships.length, header: "Signing", cell: ({ row }) => row.original.relationships.length ? <div className="badge-row">{row.original.relationships.map((relationship) => <StateBadge key={relationship.id} label={relationship.provider} tone={relationship.state === "signed_active" ? "success" : "neutral"} />)}</div> : <span className="muted-cell">No relationship</span> },
    { id: "accounts", accessorFn: (row) => row.accounts.length, header: "Accounts", cell: ({ row }) => <AccountPlatformIcons accounts={row.original.accounts} /> },
    { accessorKey: "posts30d", header: "30d posts", cell: ({ getValue }) => formatNumber(Number(getValue())) }, { accessorKey: "views30d", header: "30d views", cell: ({ getValue }) => <strong>{formatNumber(Number(getValue()))}</strong> },
    { accessorKey: "engagementRate", header: "Engagement", cell: ({ getValue }) => formatPercent(Number(getValue())) }, { id: "tracking", accessorFn: (row) => row.trackingState, header: "Tracking", cell: ({ row }) => <TrackingBadge state={row.original.trackingState} /> },
    { accessorKey: "nextStep", header: "Next step", cell: ({ getValue }) => <span className="next-step-cell">{String(getValue() ?? "—")}</span> }, { accessorKey: "lastActivityAt", header: "Last activity", cell: ({ getValue }) => timeAgo(getValue() as string | null) },
  ], []);
  const table = useReactTable({ data: filtered, columns, state: { sorting, columnVisibility: visibility, rowSelection: selection }, onSortingChange: setSorting, onColumnVisibilityChange: setVisibility, onRowSelectionChange: setSelection, getRowId: (row) => row.id, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 20 } } });
  const setTab = (value: string) => { const next = new URLSearchParams(params.toString()); next.set("tab", value); router.replace(`${pathname}?${next.toString()}`); setSelection({}); };
  return <section className="data-panel"><Tabs value={tab} onValueChange={setTab}><TabsList className="roster-tabs">{["requests", "active", "watch", "offboarded"].map((item) => <TabsTrigger key={item} value={item}>{item}<span>{creators.filter((creator) => creator.lifecycle === creatorTabLifecycle[item]).length}</span></TabsTrigger>)}</TabsList></Tabs><TableToolbar search={search} setSearch={setSearch} placeholder="Search name, Discord, social account, provider, or notes…" columns={table.getAllLeafColumns().filter((column) => column.id !== "select").map((column) => ({ id: column.id, label: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id, visible: column.getIsVisible() }))} toggleColumn={(id) => table.getColumn(id)?.toggleVisibility()}><Button variant="outline" size="sm" className="toolbar-button"><Filter /> Filters</Button>{Object.keys(selection).length ? <span className="selection-count">{Object.keys(selection).length} selected</span> : null}</TableToolbar><DenseTable table={table} /><Pagination page={table.getState().pagination.pageIndex + 1} pages={table.getPageCount()} rows={filtered.length} previous={table.previousPage} next={table.nextPage} canPrevious={table.getCanPreviousPage()} canNext={table.getCanNextPage()} /></section>;
}

export function CreatorAccountsRoster({ creators }: { creators: PortalCreator[] }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tab = params.get("tab") ?? "active";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [sorting, setSorting] = useState<SortingState>([{ id: "views30d", desc: true }]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const assignmentCreators = useMemo(() => creators.filter((creator) => creator.source === "result" && creator.lifecycle !== "offboarded").map((creator) => ({ id: creator.id, displayName: creator.displayName, discordUsername: creator.discord.username })), [creators]);

  const filtered = useMemo(() => creators.filter((creator) => {
    const relationships = creator.relationships.map((relationship) => `${relationship.provider} ${relationship.program ?? ""}`).join(" ");
    const accounts = creator.accounts.map((account) => `${account.username} ${account.displayName} ${account.platform}`).join(" ");
    const haystack = `${creator.displayName} ${creator.discord.username ?? ""} ${creator.email ?? ""} ${relationships} ${accounts} ${creator.nextStep ?? ""}`.toLowerCase();
    return creator.lifecycle === creatorTabLifecycle[tab] && haystack.includes(search.toLowerCase());
  }), [creators, tab, search]);

  const columns = useMemo<ColumnDef<PortalCreator>[]>(() => [
    {
      id: "select",
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))} aria-label="Select page" />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))} aria-label={`Select ${row.original.displayName}`} />,
      enableSorting: false,
    },
    {
      accessorKey: "displayName",
      header: "Creator",
      cell: ({ row }) => (
        <div className="nested-creator-cell">
          <Button
            variant="ghost"
            size="icon-xs"
            className="creator-expand-button"
            disabled={!row.original.accounts.length}
            onClick={() => setExpanded((current) => ({ ...current, [row.original.id]: !current[row.original.id] }))}
            aria-label={`${expanded[row.original.id] ? "Collapse" : "Expand"} ${row.original.displayName} accounts`}
          >
            {expanded[row.original.id] ? <ChevronDown /> : <ChevronRight />}
          </Button>
          <Link className="creator-cell" href={`/creators/${row.original.id}`}>
            <Avatar src={row.original.discord.avatarUrl ?? row.original.accounts[0]?.avatarUrl ?? null} name={row.original.displayName} />
            <span>
              <strong>{row.original.displayName}</strong>
              <small>{row.original.discord.username ? `@${row.original.discord.username}` : row.original.email ?? "No Discord identity"}</small>
            </span>
          </Link>
        </div>
      ),
    },
    {
      id: "accounts",
      accessorFn: (row) => row.accounts.length,
      header: "Accounts",
      cell: ({ row }) => <AccountPlatformIcons accounts={row.original.accounts} />,
    },
    {
      id: "discord",
      accessorFn: (row) => row.discord.state,
      header: "Discord",
      cell: ({ row }) => <div className="stack-cell"><StateBadge label={row.original.discord.state} tone={row.original.discord.state === "connected" ? "success" : "neutral"} /><small>{row.original.discord.username ? `@${row.original.discord.username}` : "Not reconciled"}</small></div>,
    },
    {
      id: "relationships",
      accessorFn: (row) => row.relationships.length,
      header: "Signing",
      cell: ({ row }) => row.original.relationships.length ? (
        <div className="stack-cell"><div className="badge-row">{row.original.relationships.map((relationship) => <StateBadge key={relationship.id} label={relationship.provider} tone={relationship.state === "signed_active" ? "success" : "neutral"} />)}</div><small>{row.original.relationships[0]?.program ?? "Provider relationship"}</small></div>
      ) : <span className="muted-cell">Not connected</span>,
    },
    { accessorKey: "posts30d", header: "30d posts", cell: ({ getValue }) => formatNumber(Number(getValue())) },
    { accessorKey: "views30d", header: "30d views", cell: ({ getValue }) => <strong className="primary-metric-cell">{formatNumber(Number(getValue()))}</strong> },
    {
      id: "averageViews",
      accessorFn: (row) => {
        const posts = row.accounts.reduce((total, account) => total + account.posts, 0);
        const views = row.accounts.reduce((total, account) => total + account.views, 0);
        return posts ? views / posts : 0;
      },
      header: "Avg. views",
      cell: ({ getValue }) => formatNumber(Number(getValue())),
    },
    { accessorKey: "engagementRate", header: "Engagement", cell: ({ getValue }) => formatPercent(Number(getValue())) },
    { id: "tracking", accessorFn: (row) => row.trackingState, header: "Tracking", cell: ({ row }) => <TrackingBadge state={row.original.trackingState} /> },
    { accessorKey: "nextStep", header: "Next step", cell: ({ getValue }) => <span className="next-step-cell">{String(getValue() ?? "—")}</span> },
    { accessorKey: "lastActivityAt", header: "Updated", cell: ({ getValue }) => timeAgo(getValue() as string | null) },
  ], [expanded]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility: visibility, rowSelection: selection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    router.replace(`${pathname}?${next.toString()}`);
    setSelection({});
    setExpanded({});
  };
  const pageCreators = table.getRowModel().rows.map((row) => row.original);
  const allExpanded = pageCreators.filter((creator) => creator.accounts.length).every((creator) => expanded[creator.id]);
  const toggleAll = () => setExpanded(allExpanded ? {} : Object.fromEntries(pageCreators.filter((creator) => creator.accounts.length).map((creator) => [creator.id, true])));

  return (
    <section className="data-panel unified-creator-roster">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="roster-tabs">
          {["requests", "active", "watch", "offboarded"].map((item) => <TabsTrigger key={item} value={item}>{item}<span>{creators.filter((creator) => creator.lifecycle === creatorTabLifecycle[item]).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
      <TableToolbar
        search={search}
        setSearch={setSearch}
        placeholder="Search creators, Discord, accounts, or signing…"
        columns={table.getAllLeafColumns().filter((column) => column.id !== "select").map((column) => ({ id: column.id, label: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id, visible: column.getIsVisible() }))}
        toggleColumn={(id) => table.getColumn(id)?.toggleVisibility()}
      >
        <Button variant="outline" size="sm" className="toolbar-button"><Filter /> Filters</Button>
        <Button variant="outline" size="sm" className="toolbar-button" onClick={toggleAll}><ChevronsUpDown /> {allExpanded ? "Collapse all" : "Expand all"}</Button>
        {Object.keys(selection).length ? <span className="selection-count">{Object.keys(selection).length} selected</span> : null}
      </TableToolbar>
      <CreatorAccountsTable table={table} expanded={expanded} assignmentCreators={assignmentCreators} />
      <Pagination page={table.getState().pagination.pageIndex + 1} pages={table.getPageCount()} rows={filtered.length} previous={table.previousPage} next={table.nextPage} canPrevious={table.getCanPreviousPage()} canNext={table.getCanNextPage()} />
    </section>
  );
}

function CreatorAccountsTable({
  table,
  expanded,
  assignmentCreators,
}: {
  table: ReturnType<typeof useReactTable<PortalCreator>>;
  expanded: Record<string, boolean>;
  assignmentCreators: Array<{ id: string; displayName: string; discordUsername: string | null }>;
}) {
  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const nestedHeaders: Record<string, string> = {
    select: "",
    displayName: "Account",
    accounts: "Platform",
    discord: "Followers",
    relationships: "Posts",
    posts30d: "Views",
    views30d: "Avg. views",
    averageViews: "Engagement",
    engagementRate: "Latest post",
    tracking: "Status",
    nextStep: "Creator",
    lastActivityAt: "",
  };

  const nestedCell = (columnId: string, account: PortalAccount, creator: PortalCreator) => {
    const accountIdentity = <><span className="nested-branch" aria-hidden="true" /><Avatar src={account.avatarUrl} name={account.username} /><span className="nested-account-copy"><span className="nested-account-handle"><strong>@{account.username}</strong><ExternalLink /></span><small>{account.displayName || creator.displayName}</small></span></>;
    if (columnId === "displayName") return account.sourceUrl ? <a href={account.sourceUrl} target="_blank" rel="noreferrer" className="nested-account-identity" aria-label={`Open @${account.username} on ${account.platform}`}>{accountIdentity}</a> : <Link href={`/accounts/${encodeURIComponent(account.id)}`} className="nested-account-identity">{accountIdentity}</Link>;
    if (columnId === "accounts") return <StateBadge label={account.platform} tone="info" />;
    if (columnId === "discord") return formatNumber(account.followers ?? 0);
    if (columnId === "relationships") return formatNumber(account.posts);
    if (columnId === "posts30d") return <strong>{formatNumber(account.views)}</strong>;
    if (columnId === "views30d") return formatNumber(account.averageViews);
    if (columnId === "averageViews") return formatPercent(account.engagementRate);
    if (columnId === "engagementRate") return timeAgo(account.latestPostAt);
    if (columnId === "tracking") return <span className="nested-account-badges"><StateBadge label={account.linkState} tone={account.linkState === "confirmed" ? "success" : "attention"} /><TrackingBadge state={account.trackingState} /></span>;
    if (columnId === "nextStep") return <AccountAssignmentButton accountId={account.id} username={account.username} creators={assignmentCreators} currentCreatorId={creator.source === "result" ? creator.id : null} linkState={account.linkState} />;
    if (columnId === "lastActivityAt") return <Link href={`/accounts/${encodeURIComponent(account.id)}`} className="nested-account-details">Details <ChevronRight /></Link>;
    return null;
  };

  return (
    <div className="dense-table-wrap creator-tree-wrap">
      <Table className="dense-table creator-tree-table">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : header.column.getCanSort() ? <SortButton label={typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id} sorted={header.column.getIsSorted()} toggle={() => header.column.toggleSorting()} /> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow className="creator-parent-row" data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
              {expanded[row.original.id] ? <>
                <TableRow className="nested-account-header-row">
                  {visibleColumns.map((column) => <TableCell data-nested-column={column.id} key={`${row.id}-nested-header-${column.id}`}>{nestedHeaders[column.id] ?? ""}</TableCell>)}
                </TableRow>
                {row.original.accounts.length ? row.original.accounts.map((account) => (
                  <TableRow className="nested-account-row" data-link-state={account.linkState} key={account.id}>
                    {visibleColumns.map((column) => <TableCell data-nested-column={column.id} key={`${account.id}-${column.id}`}>{nestedCell(column.id, account, row.original)}</TableCell>)}
                  </TableRow>
                )) : <TableRow className="nested-account-empty-row"><TableCell colSpan={visibleColumns.length}>No posting accounts are connected to this creator.</TableCell></TableRow>}
              </> : null}
            </Fragment>
          )) : <TableRow><TableCell className="empty-table" colSpan={table.getVisibleLeafColumns().length}>No creators match this view.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

export function AccountTable({ accounts }: { accounts: PortalAccount[] }) {
  const params = useSearchParams(); const [search, setSearch] = useState(params.get("q") ?? ""); const [sorting, setSorting] = useState<SortingState>([{ id: "views", desc: true }]); const [visibility, setVisibility] = useState<VisibilityState>({});
  const filtered = useMemo(() => accounts.filter((account) => `${account.username} ${account.displayName} ${account.platform}`.toLowerCase().includes(search.toLowerCase())), [accounts, search]);
  const columns = useMemo<ColumnDef<PortalAccount>[]>(() => [
    { accessorKey: "username", header: "Account", cell: ({ row }) => <Link href={`/accounts/${encodeURIComponent(row.original.id)}`} className="creator-cell"><Avatar src={row.original.avatarUrl} name={row.original.username} /><span><strong>@{row.original.username}</strong><small>{row.original.displayName}</small></span></Link> }, { accessorKey: "platform", header: "Platform", cell: ({ getValue }) => <StateBadge label={String(getValue())} tone="info" /> },
    { accessorKey: "followers", header: "Followers", cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)) }, { accessorKey: "posts", header: "Posts", cell: ({ getValue }) => formatNumber(Number(getValue())) }, { accessorKey: "views", header: "Views", cell: ({ getValue }) => <strong>{formatNumber(Number(getValue()))}</strong> }, { accessorKey: "averageViews", header: "Avg. views", cell: ({ getValue }) => formatNumber(Number(getValue())) },
    { accessorKey: "engagementRate", header: "Engagement", cell: ({ getValue }) => formatPercent(Number(getValue())) }, { accessorKey: "latestPostAt", header: "Latest post", cell: ({ getValue }) => timeAgo(getValue() as string | null) }, { accessorKey: "linkState", header: "Creator link", cell: ({ getValue }) => <StateBadge label={String(getValue())} tone={getValue() === "confirmed" ? "success" : "attention"} /> }, { accessorKey: "trackingState", header: "Tracking", cell: ({ row }) => <div className="stack-cell"><TrackingBadge state={row.original.trackingState} /><small>{timeAgo(row.original.refreshedAt)}</small></div> },
  ], []);
  const table = useReactTable({ data: filtered, columns, state: { sorting, columnVisibility: visibility }, onSortingChange: setSorting, onColumnVisibilityChange: setVisibility, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 20 } } });
  return <section className="data-panel"><TableToolbar search={search} setSearch={setSearch} placeholder="Search username, creator, or platform…" columns={table.getAllLeafColumns().map((column) => ({ id: column.id, label: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id, visible: column.getIsVisible() }))} toggleColumn={(id) => table.getColumn(id)?.toggleVisibility()}><Button variant="outline" size="sm" className="toolbar-button"><Filter /> Platform</Button></TableToolbar><DenseTable table={table} /><Pagination page={table.getState().pagination.pageIndex + 1} pages={table.getPageCount()} rows={filtered.length} previous={table.previousPage} next={table.nextPage} canPrevious={table.getCanPreviousPage()} canNext={table.getCanNextPage()} /></section>;
}

export function VideoTable({ videos, visibility: visibilityMode = "included" }: { videos: PortalVideo[]; visibility?: "included" | "excluded" }) {
  const params = useSearchParams(); const [search, setSearch] = useState(params.get("q") ?? ""); const [sorting, setSorting] = useState<SortingState>([{ id: "publishedAt", desc: true }]); const [visibility, setVisibility] = useState<VisibilityState>({ bookmarks: false }); const [selection, setSelection] = useState<RowSelectionState>({}); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const filtered = useMemo(() => videos.filter((video) => video.included === (visibilityMode === "included") && `${video.caption} ${video.accountUsername} ${video.platform}`.toLowerCase().includes(search.toLowerCase())), [videos, search, visibilityMode]);
  const columns = useMemo<ColumnDef<PortalVideo>[]>(() => [
    { id: "select", header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))} aria-label="Select page" />, cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))} aria-label={`Select ${row.original.caption}`} /> },
    { accessorKey: "caption", header: "Video", cell: ({ row }) => <Link href={`/videos/${encodeURIComponent(row.original.id)}`} className="video-cell"><span className="video-thumb">{row.original.thumbnailUrl ? <img src={row.original.thumbnailUrl} alt="" /> : null}</span><span><strong>{row.original.caption}</strong><small>@{row.original.accountUsername} · {row.original.platform}</small></span></Link> }, { accessorKey: "publishedAt", header: "Published", cell: ({ getValue }) => formatDate(getValue() as string | null) }, { accessorKey: "durationSeconds", header: "Duration", cell: ({ getValue }) => getValue() == null ? "—" : `${getValue()}s` },
    { accessorKey: "views", header: "Views", cell: ({ getValue }) => <strong>{formatNumber(Number(getValue()))}</strong> }, { accessorKey: "baselineMultiplier", header: "Baseline", cell: ({ getValue }) => `${Number(getValue()).toFixed(1)}×` }, { accessorKey: "likes", header: "Likes", cell: ({ getValue }) => formatNumber(Number(getValue())) }, { accessorKey: "comments", header: "Comments", cell: ({ getValue }) => formatNumber(Number(getValue())) }, { accessorKey: "shares", header: "Shares", cell: ({ getValue }) => formatNumber(Number(getValue())) }, { accessorKey: "bookmarks", header: "Saves", cell: ({ getValue }) => formatNumber(Number(getValue())) }, { accessorKey: "engagementRate", header: "Engagement", cell: ({ getValue }) => formatPercent(Number(getValue())) }, { accessorKey: "included", header: "Visibility", cell: ({ getValue }) => <StateBadge label={getValue() ? "included" : "excluded"} tone={getValue() ? "success" : "neutral"} /> }, { accessorKey: "trackingState", header: "Tracking", cell: ({ row }) => <TrackingBadge state={row.original.trackingState} /> },
  ], []);
  const table = useReactTable({ data: filtered, columns, state: { sorting, columnVisibility: visibility, rowSelection: selection }, onSortingChange: setSorting, onColumnVisibilityChange: setVisibility, onRowSelectionChange: setSelection, getRowId: (row) => row.id, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize: 20 } } });
  const exclude = async () => { const selected = table.getSelectedRowModel().rows.map((row) => row.original); if (!selected.length) return; setPending(true); setMessage(null); const response = await fetch("/api/videos/exclude", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ videos: selected.map((video) => ({ accountId: video.accountId, platform: video.platform, platformAccountId: video.platformAccountId, platformVideoId: video.platformVideoId })), reason: "warmup_unpaid" }) }); setPending(false); if (response.ok) { setSelection({}); setMessage(`${selected.length} video${selected.length === 1 ? "" : "s"} excluded in Viral.`); window.location.reload(); } else setMessage("Exclusion failed. Nothing was hidden."); };
  const restore = async () => { const selected = table.getSelectedRowModel().rows.map((row) => row.original); if (!selected.length) return; setPending(true); setMessage(null); const response = await fetch("/api/videos/restore", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ videos: selected.map((video) => ({ accountId: video.accountId, platform: video.platform, platformVideoId: video.platformVideoId })) }) }); setPending(false); if (response.ok) { setSelection({}); setMessage(`${selected.length} video${selected.length === 1 ? "" : "s"} restored in Viral.`); window.location.reload(); } else setMessage("Restoration failed. The videos remain excluded."); };
  return <section className="data-panel"><TableToolbar search={search} setSearch={setSearch} placeholder="Search caption, account, or platform…" columns={table.getAllLeafColumns().filter((column) => column.id !== "select").map((column) => ({ id: column.id, label: typeof column.columnDef.header === "string" ? column.columnDef.header : column.id, visible: column.getIsVisible() }))} toggleColumn={(id) => table.getColumn(id)?.toggleVisibility()}><Button variant="outline" size="sm" className="toolbar-button"><Filter /> {visibilityMode === "included" ? "Included" : "Excluded"}</Button>{Object.keys(selection).length ? <><span className="selection-count">{Object.keys(selection).length} selected</span>{visibilityMode === "included" ? <Button variant="destructive" size="sm" className="toolbar-button danger-button" disabled={pending} onClick={exclude}><VideoOff />{pending ? "Excluding…" : "Exclude warmup / unpaid"}</Button> : <Button variant="outline" size="sm" className="toolbar-button" disabled={pending} onClick={restore}><RotateCcw />{pending ? "Restoring…" : "Restore to totals"}</Button>}</> : null}</TableToolbar>{message ? <div className="table-message">{message}</div> : null}<DenseTable table={table} /><Pagination page={table.getState().pagination.pageIndex + 1} pages={table.getPageCount()} rows={filtered.length} previous={table.previousPage} next={table.nextPage} canPrevious={table.getCanPreviousPage()} canNext={table.getCanNextPage()} /></section>;
}

function DenseTable<T>({ table }: { table: ReturnType<typeof useReactTable<T>> }) { return <div className="dense-table-wrap"><Table className="dense-table"><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}>{header.isPlaceholder ? null : header.column.getCanSort() ? <SortButton label={typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id} sorted={header.column.getIsSorted()} toggle={() => header.column.toggleSorting()} /> : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell className="empty-table" colSpan={table.getVisibleLeafColumns().length}>No rows match this view.</TableCell></TableRow>}</TableBody></Table></div>; }
