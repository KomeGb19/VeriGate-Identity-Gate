import { createContext, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, AlertCircle, Archive, ArrowRight, BadgeCheck, Ban, BookOpen, Camera, Check,
  CheckCircle2, Clock3, DoorOpen as Gate, FileClock, Fingerprint, ImagePlus, LayoutDashboard,
  LockKeyhole, Menu, RefreshCw, Search, ShieldCheck, ShieldX, UserRoundPlus, UsersRound, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getGetDashboardSummaryQueryKey, getListProfilesQueryKey, getListSitesQueryKey,
  getListVerificationEventsQueryKey, useCreateProfile, useDecideVerification,
  useGetDashboardSummary, useListProfiles, useListSites, useListVerificationEvents,
  useUpdateProfileStatus,
} from '@workspace/api-client-react';
import type { DashboardSummary, Profile, ProfileInput, Site, VerificationEvent } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

declare global {
  interface Window {
    faceapi?: {
      nets: {
        tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
        faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
        faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
      };
      TinyFaceDetectorOptions: new () => unknown;
      detectSingleFace: (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, options: unknown) => {
        withFaceLandmarks: () => {
          withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined>;
        };
      };
    };
  }
}

const queryClient = new QueryClient();
type UserRole = 'admin' | 'gate_staff';
const RoleContext = createContext<{ role: UserRole; setRole: (role: UserRole) => void }>({
  role: 'admin',
  setRole: () => undefined,
});

const demoSites: Site[] = [
  { id: 'site-school', name: 'Northbridge Primary', type: 'school' },
  { id: 'site-estate', name: 'Canopy Row Estate', type: 'estate' },
];
const demoProfiles: Profile[] = [
  { id: 'p-amelia', siteId: 'site-school', name: 'Amelia Okafor', role: 'guardian', linkedTo: 'Milo Okafor · Year 4', status: 'active', photoUrl: '', createdAt: new Date(Date.now() - 86400000 * 12).toISOString() },
  { id: 'p-james', siteId: 'site-school', name: 'James Wu', role: 'backup_pickup', linkedTo: 'Sana Wu · Year 2', status: 'active', photoUrl: '', createdAt: new Date(Date.now() - 86400000 * 6).toISOString() },
  { id: 'p-nadia', siteId: 'site-estate', name: 'Nadia Mensah', role: 'resident', linkedTo: 'Cedar House · 14', status: 'active', photoUrl: '', createdAt: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: 'p-visitor', siteId: 'site-estate', name: 'Noah Patel', role: 'visitor', linkedTo: 'Guest of Cedar House · 14', status: 'revoked', photoUrl: '', createdAt: new Date(Date.now() - 86400000 * 31).toISOString() },
];
const demoEvents: VerificationEvent[] = [
  { id: 'evt-1', siteId: 'site-school', matchedProfileId: 'p-amelia', gateName: 'Northbridge · Main Gate', result: 'verified', similarityScore: .94, decisionMs: 1280, staffId: 'A. Bello', overrideReason: null, flaggedSuspicious: false, createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString() },
  { id: 'evt-2', siteId: 'site-estate', matchedProfileId: 'p-nadia', gateName: 'Canopy Row · Vehicle Gate', result: 'verified', similarityScore: .89, decisionMs: 1610, staffId: 'S. Cole', overrideReason: null, flaggedSuspicious: false, createdAt: new Date(Date.now() - 1000 * 60 * 19).toISOString() },
  { id: 'evt-3', siteId: 'site-school', matchedProfileId: null, gateName: 'Northbridge · Main Gate', result: 'override', similarityScore: .52, decisionMs: 4210, staffId: 'A. Bello', overrideReason: 'Known guardian; camera angle obscured', flaggedSuspicious: true, createdAt: new Date(Date.now() - 1000 * 60 * 38).toISOString() },
  { id: 'evt-4', siteId: 'site-estate', matchedProfileId: null, gateName: 'Canopy Row · Vehicle Gate', result: 'denied', similarityScore: .21, decisionMs: 2090, staffId: 'S. Cole', overrideReason: null, flaggedSuspicious: true, createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString() },
];
const demoSummary: DashboardSummary = {
  totalAttempts: 184,
  verifiedHandoverRate: .873,
  medianVerificationSpeed: 1.8,
  overrideRate: .087,
  flaggedCount: 6,
  recentEvents: demoEvents,
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
function siteName(id: string, sites: Site[]) {
  return sites.find((site) => site.id === id)?.name ?? (id === 'site-school' ? 'Northbridge Primary' : 'Canopy Row Estate');
}
function roleName(role: string) {
  return role.replace('_', ' ');
}
function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, setRole } = useContext(RoleContext);
  const navItems: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
    { href: '/', label: 'Overview', hint: 'Live summary', icon: LayoutDashboard },
    { href: '/enrol', label: 'Enrol person', hint: 'Consent first', icon: UserRoundPlus },
    { href: '/verify', label: 'Verify at gate', hint: 'Make a decision', icon: Fingerprint },
    ...(role === 'admin' ? [{ href: '/admin', label: 'Audit & profiles', hint: 'Review activity', icon: FileClock }] : []),
  ];
  return (
    <div className="vg-app vg-noise flex min-h-[100dvh]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`} data-testid="navigation-sidebar">
        <div className="flex items-center justify-between px-3">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Gate size={21} strokeWidth={2.5} /></div>
            <div><div className="vg-display text-[19px] font-bold tracking-[-.03em]">VeriGate</div><div className="vg-mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.58)]">Trusted passage</div></div>
          </Link>
          <button className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)] lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-close-menu"><X size={18} /></button>
        </div>
        <div className="mx-3 mt-8 border-t border-[hsl(var(--sidebar-border))] pt-5">
          <div className="vg-mono mb-3 px-3 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.46)]">Console</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = location === item.href;
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.67)] hover:bg-[hsl(var(--sidebar-accent)/.55)] hover:text-[hsl(var(--sidebar-foreground))]'}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
                <Icon size={18} className={active ? 'text-[hsl(var(--sidebar-primary))]' : ''} /><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{item.label}</span><span className="block truncate text-[10px] text-current opacity-55">{item.hint}</span></span>{active && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />}
              </Link>;
            })}
          </nav>
        </div>
        <div className="mt-auto px-3">
          <div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.5)] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold"><span className="vg-pulse h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))]" />System ready</div>
            <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.58)]">Every decision is retained in the gate audit trail.</p>
            <div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--sidebar-border))] pt-3 text-[10px] text-[hsl(var(--sidebar-foreground)/.52)]"><LockKeyhole size={12} /> Consent controls enabled</div>
          </div>
          <div className="mt-5 flex items-center gap-3 px-1 pb-1"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary)/.16)] text-[11px] font-bold text-[hsl(var(--sidebar-primary))]">AB</div><div className="min-w-0"><div className="truncate text-[12px] font-semibold">Amina Bello</div><div className="vg-mono text-[9px] text-[hsl(var(--sidebar-foreground)/.5)]">Gate staff · Northbridge</div></div></div>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-[hsl(var(--sidebar)/.45)] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-overlay-menu" />}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.92)] px-5 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button><div className="vg-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Gatehouse console <span className="mx-2 opacity-40">/</span> {location === '/' ? 'overview' : location.slice(1)}</div></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" /> Live operations</div><label className="hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-3 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))] md:flex"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="bg-transparent font-semibold text-[hsl(var(--foreground))] outline-none" data-testid="select-demo-role"><option value="admin">Admin</option><option value="gate_staff">Gate staff</option></select></label><div className="flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[11px] font-bold text-[hsl(var(--primary))]">AB</div></div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-9">{children}</div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="vg-mono mb-2 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</div><h1 className="vg-display text-[32px] font-bold tracking-[-.045em] text-[hsl(var(--foreground))] md:text-[40px]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p></div>{action}</div>;
}

function StatusBadge({ result }: { result: string }) {
  const config = result === 'verified' ? { label: 'Verified', icon: BadgeCheck, className: 'bg-[hsl(164_52%_88%)] text-[hsl(166_64%_26%)]' } : result === 'override' ? { label: 'Manual confirm', icon: AlertCircle, className: 'bg-[hsl(38_81%_88%)] text-[hsl(35_64%_28%)]' } : { label: 'Not verified', icon: ShieldX, className: 'bg-[hsl(1_65%_91%)] text-[hsl(1_58%_38%)]' };
  const Icon = config.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${config.className}`} data-testid={`status-${result}`}><Icon size={12} />{config.label}</span>;
}

function Notice({ kind = 'info', children, onClose }: { kind?: 'info' | 'error' | 'success'; children: ReactNode; onClose?: () => void }) {
  const styles = kind === 'error' ? 'border-[hsl(1_66%_78%)] bg-[hsl(1_66%_95%)] text-[hsl(1_58%_34%)]' : kind === 'success' ? 'border-[hsl(164_43%_72%)] bg-[hsl(164_50%_93%)] text-[hsl(166_64%_26%)]' : 'border-[hsl(196_32%_76%)] bg-[hsl(196_45%_93%)] text-[hsl(196_40%_25%)]';
  return <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`} data-testid={`notice-${kind}`}><AlertCircle size={17} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1">{children}</div>{onClose && <button onClick={onClose} className="opacity-60 hover:opacity-100" data-testid="button-dismiss-notice"><X size={16} /></button>}</div>;
}

function QueryError({ message = 'We could not load this view.' }: { message?: string }) {
  return <Notice kind="error"><div className="font-semibold">{message}</div><div className="mt-0.5 text-xs opacity-80">Showing the last known local operating set. Try again when the connection is restored.</div></Notice>;
}

function Metric({ label, value, detail, accent = 'teal', icon: Icon }: { label: string; value: string; detail: string; accent?: 'teal' | 'amber' | 'red' | 'blue'; icon: LucideIcon }) {
  const color = accent === 'amber' ? 'hsl(var(--accent))' : accent === 'red' ? 'hsl(var(--destructive))' : accent === 'blue' ? 'hsl(var(--chart-3))' : 'hsl(var(--primary))';
  return <div className="vg-card rounded-2xl p-5" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><span className="vg-mono text-[10px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">{label}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color, backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)` }}><Icon size={16} /></span></div><div className="vg-display mt-5 text-[29px] font-bold tracking-[-.04em]">{value}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</div></div>;
}

function EventRow({ event, sites, profiles }: { event: VerificationEvent; sites: Site[]; profiles: Profile[] }) {
  const profile = profiles.find((item) => item.id === event.matchedProfileId);
  return <div className="flex items-center gap-3 border-b border-[hsl(var(--border)/.75)] px-5 py-4 last:border-b-0" data-testid={`row-event-${event.id}`}><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ${event.result === 'verified' ? 'bg-[hsl(164_52%_89%)] text-[hsl(166_64%_27%)]' : event.result === 'override' ? 'bg-[hsl(38_81%_88%)] text-[hsl(35_64%_28%)]' : 'bg-[hsl(1_65%_91%)] text-[hsl(1_58%_38%)]'}`}>{profile ? initials(profile.name) : <ShieldX size={16} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{profile?.name ?? 'No profile match'}</div><div className="mt-0.5 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{siteName(event.siteId, sites)} · {event.gateName.split(' · ')[1] ?? event.gateName}</div></div><div className="hidden text-right sm:block"><div className="vg-mono text-[10px] text-[hsl(var(--muted-foreground))]">{event.similarityScore > 0 ? `${Math.round(event.similarityScore * 100)}% match` : 'No match'}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{formatTime(event.createdAt)}</div></div><StatusBadge result={event.result} /></div>;
}

function Overview() {
  const sitesQuery = useListSites({ query: { queryKey: getListSitesQueryKey(), staleTime: 30000 } });
  const summaryQuery = useGetDashboardSummary(undefined, { query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 15000 } });
  const sites = sitesQuery.data ?? demoSites;
  const summary = summaryQuery.data ?? demoSummary;
  const allProfilesQuery = useListProfiles(sites[0]?.id ?? 'site-school', { query: { queryKey: getListProfilesQueryKey(sites[0]?.id ?? 'site-school'), staleTime: 30000 } });
  const profiles = allProfilesQuery.data ?? demoProfiles;
  const events = summary.recentEvents?.length ? summary.recentEvents : demoEvents;
  return <><PageIntro eyebrow="Today · 08:42 local" title="Good morning, Amina." description="The gates are quiet. Here is the operating picture across your trusted sites." action={<Link href="/verify" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" data-testid="link-start-verification"><Fingerprint size={17} /> Start verification <ArrowRight size={15} /></Link>} />
    {(sitesQuery.isError || summaryQuery.isError) && <div className="mb-5"><QueryError message="Live data is temporarily unavailable." /></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Attempts today" value={String(summary.totalAttempts)} detail="Across both operational sites" icon={Activity} />
      <Metric label="Verified handovers" value={`${(summary.verifiedHandoverRate * 100).toFixed(1)}%`} detail="Target is above 85%" icon={BadgeCheck} accent="teal" />
      <Metric label="Median decision" value={`${summary.medianVerificationSpeed.toFixed(1)}s`} detail="Capture to logged decision" icon={Clock3} accent="blue" />
      <Metric label="Needs attention" value={String(summary.flaggedCount)} detail={`${(summary.overrideRate * 100).toFixed(1)}% manual confirmations`} icon={AlertCircle} accent={summary.flaggedCount ? 'amber' : 'teal'} />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <section className="vg-card overflow-hidden rounded-2xl" data-testid="section-recent-events"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="vg-display text-[17px] font-bold">Recent gate activity</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">A concise audit view, newest first.</p></div><Link href="/admin" className="vg-mono flex items-center gap-1 text-[10px] font-medium uppercase tracking-[.1em] text-[hsl(var(--primary))]" data-testid="link-view-audit">View audit <ArrowRight size={13} /></Link></div>{summaryQuery.isLoading ? <div className="space-y-4 p-5">{[1, 2, 3].map((item) => <div key={item} className="vg-skeleton h-12 rounded-lg" />)}</div> : <div>{events.slice(0, 5).map((event) => <EventRow key={event.id} event={event} sites={sites} profiles={profiles} />)}</div>}</section>
      <section className="vg-card rounded-2xl p-5" data-testid="section-site-pulse"><div className="flex items-center justify-between"><div><h2 className="vg-display text-[17px] font-bold">Site pulse</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Active operating points</p></div><span className="vg-mono text-[10px] text-[hsl(var(--primary))]">LIVE</span></div><div className="mt-5 space-y-3">{sites.map((site, index) => <div key={site.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.65)] p-4" data-testid={`card-site-${site.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">{site.type === 'school' ? <BookOpen size={17} /> : <Gate size={17} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{site.name}</div><div className="mt-0.5 text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{site.type} gate</div></div><span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /></div><div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border)/.7)] pt-3 text-[11px] text-[hsl(var(--muted-foreground))]"><span>{index === 0 ? 'Main gate' : 'Vehicle gate'}</span><span className="font-semibold text-[hsl(var(--foreground))]">Operational</span></div></div>)}</div><Link href="/enrol" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--primary)/.5)] py-3 text-[11px] font-semibold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--secondary)/.55)]" data-testid="link-enrol-site"><UserRoundPlus size={15} /> Add a trusted person</Link></section>
    </div>
  </>;
}

function CaptureStation({ onCapture, label = 'Capture face' }: { onCapture: (value: string, descriptor?: number[]) => void; label?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelsLoadedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'live' | 'denied'>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [preview, setPreview] = useState('');
  const [faceStatus, setFaceStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  const loadFaceModels = async () => {
    if (modelsLoadedRef.current) return window.faceapi;
    try {
      if (!window.faceapi) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          const timeout = window.setTimeout(() => reject(new Error('Face detection timed out.')), 8000);
          script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          script.onload = () => { window.clearTimeout(timeout); resolve(); };
          script.onerror = () => { window.clearTimeout(timeout); reject(new Error('Face detection could not load.')); };
          document.head.appendChild(script);
        });
      }
      const api = window.faceapi;
      if (!api) throw new Error('Face detection is unavailable.');
      const modelUrl = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(modelUrl),
        api.nets.faceLandmark68Net.loadFromUri(modelUrl),
        api.nets.faceRecognitionNet.loadFromUri(modelUrl),
      ]);
      modelsLoadedRef.current = true;
      setFaceStatus('ready');
      return api;
    } catch {
      setFaceStatus('unavailable');
      return undefined;
    }
  };
  const detectDescriptor = async (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => {
    const api = await loadFaceModels();
    if (!api) return undefined;
    const result = await api.detectSingleFace(input, new api.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
    return result?.descriptor ? Array.from(result.descriptor) : undefined;
  };
  const beginCamera = async () => {
    setCameraState('starting');
    setCameraMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available in this browser.');
      const cameraRequest = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 } }, audio: false });
      const stream = await Promise.race([
        cameraRequest,
        new Promise<MediaStream>((_, reject) => window.setTimeout(() => reject(new Error('Camera request timed out. Use photo upload instead.')), 8000)),
      ]);
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      void loadFaceModels();
      setCameraState('live');
    } catch (error) {
      setCameraState('denied');
      setCameraMessage(error instanceof Error ? error.message : 'Camera permission was not granted.');
    }
  };
  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', .82);
    setPreview(data);
    onCapture(data, await detectDescriptor(video));
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCameraState('idle');
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      setPreview(data);
      const image = new Image();
      image.onload = async () => onCapture(data, await detectDescriptor(image));
      image.src = data;
      setCameraState('idle');
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--sidebar))]" data-testid="capture-station">
      <div className="relative aspect-[4/3] overflow-hidden bg-[hsl(var(--sidebar))]">
        {preview ? <img src={preview} alt="Captured identity portrait" className="h-full w-full object-cover" data-testid="img-captured-preview" /> : (
          <>
            <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${cameraState === 'live' ? 'block' : 'hidden'}`} data-testid="video-camera" />
            {cameraState !== 'live' && <div className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center text-[hsl(var(--sidebar-foreground))]">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"><Camera size={27} /></div>
              <div className="text-[14px] font-semibold">{cameraState === 'denied' ? 'Camera unavailable' : 'Portrait capture'}</div>
              <div className="mt-2 max-w-xs text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.6)]">{cameraState === 'denied' ? cameraMessage : 'A clear, front-facing image helps the gate team make a fast, fair decision.'}</div>
              {cameraState === 'denied' && <div className="mt-3 rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2 text-[10px] text-[hsl(var(--sidebar-foreground)/.72)]">Use photo upload below to continue without camera access.</div>}
            </div>}
            {cameraState === 'live' && <div className="pointer-events-none absolute inset-6 rounded-[30%] border border-[hsl(var(--sidebar-primary)/.85)] shadow-[0_0_0_999px_hsl(var(--sidebar)/.18)]"><span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(var(--sidebar-primary))] px-3 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-[hsl(var(--sidebar-primary-foreground))]">Align face</span></div>}
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-2 border-t border-[hsl(var(--sidebar-border))] p-3">
        {cameraState === 'live' ? <button onClick={capture} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--sidebar-primary))] py-3 text-[11px] font-bold text-[hsl(var(--sidebar-primary-foreground))]" data-testid="button-take-capture"><Check size={15} /> {label}</button> : <button onClick={beginCamera} disabled={cameraState === 'starting'} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--sidebar-primary))] py-3 text-[11px] font-bold text-[hsl(var(--sidebar-primary-foreground))] disabled:opacity-60" data-testid="button-open-camera">{cameraState === 'starting' ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={15} />} {cameraState === 'starting' ? 'Requesting access' : 'Open camera'}</button>}
        <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border border-[hsl(var(--sidebar-border))] px-3 py-3 text-[11px] font-semibold text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]" data-testid="button-upload-photo"><ImagePlus size={15} /> Upload</button>
        <input ref={fileRef} onChange={handleFile} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-testid="input-photo-upload" />
      </div>
      <div className="flex items-center gap-2 px-4 pb-4 text-[10px] text-[hsl(var(--sidebar-foreground)/.54)]"><ShieldCheck size={13} className="text-[hsl(var(--sidebar-primary))]" /> {faceStatus === 'ready' ? 'Face descriptor ready for matching' : faceStatus === 'unavailable' ? 'Face matching unavailable; manual review remains required' : 'Loading secure face matching models'} </div>
    </div>
  );
}

function Enrol() {
  const sitesQuery = useListSites({ query: { queryKey: getListSitesQueryKey() } });
  const sites = sitesQuery.data ?? demoSites;
  const createProfile = useCreateProfile();
  const mutationQueryClient = useQueryClient();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? 'site-school');
  const [name, setName] = useState('');
  const [role, setRole] = useState<ProfileInput['role']>('guardian');
  const [linkedTo, setLinkedTo] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  useEffect(() => { if (!sites.some((site) => site.id === siteId) && sites[0]) setSiteId(sites[0].id); }, [siteId, sites]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!photoUrl) { setNotice({ kind: 'error', message: 'Add a face image before creating the enrolment.' }); return; }
    if (!consent) { setNotice({ kind: 'error', message: 'Explicit biometric consent is required. Confirm the consent statement to continue.' }); return; }
    setNotice(null);
    createProfile.mutate({ data: { siteId, name: name.trim(), role, linkedTo: linkedTo.trim(), photoUrl, visitorWindowStart: start ? new Date(start).toISOString() : null, visitorWindowEnd: end ? new Date(end).toISOString() : null, faceDescriptor } }, {
      onSuccess: () => { mutationQueryClient.invalidateQueries({ queryKey: getListProfilesQueryKey(siteId) }); setNotice({ kind: 'success', message: `${name.trim()} is now actively enrolled at ${siteName(siteId, sites)}.` }); setName(''); setLinkedTo(''); setPhotoUrl(''); setFaceDescriptor(null); setConsent(false); },
      onError: () => setNotice({ kind: 'error', message: 'The enrolment could not be saved. Check the connection and try again.' }),
    });
  };
  return <><PageIntro eyebrow="People · controlled enrolment" title="Add a trusted person." description="Create an active face enrolment only when the person has given clear consent. Revocation remains available to gate staff at any time." action={<div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-[11px] text-[hsl(var(--muted-foreground))]"><LockKeyhole size={15} className="text-[hsl(var(--primary))]" /> Consent is recorded</div>} />
    {sitesQuery.isError && <div className="mb-5"><QueryError /></div>}
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <div className="space-y-5"><section className="vg-card rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">01</span><div><h2 className="vg-display text-[17px] font-bold">Identity details</h2><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Who should the gate recognise?</p></div></div><div className="space-y-4"><label className="block"><span className="field-label">Operating site</span><select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="field-control" data-testid="select-enrol-site">{sites.map((site) => <option key={site.id} value={site.id}>{site.name} · {site.type}</option>)}</select></label><label className="block"><span className="field-label">Full name</span><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="field-control" placeholder="e.g. Amelia Okafor" data-testid="input-enrol-name" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Relationship</span><select value={role} onChange={(event) => setRole(event.target.value as ProfileInput['role'])} className="field-control" data-testid="select-enrol-role"><option value="guardian">Guardian</option><option value="backup_pickup">Backup pickup</option><option value="resident">Resident</option><option value="visitor">Visitor</option></select></label><label className="block"><span className="field-label">Linked to</span><input required minLength={2} value={linkedTo} onChange={(event) => setLinkedTo(event.target.value)} className="field-control" placeholder="Child, home or host" data-testid="input-enrol-linked" /></label></div></div></section><section className="vg-card rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">02</span><div><h2 className="vg-display text-[17px] font-bold">Access window <span className="ml-1 text-[11px] font-normal text-[hsl(var(--muted-foreground))]">optional</span></h2><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Useful for visitors and temporary pickup rights.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Starts</span><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="field-control" data-testid="input-window-start" /></label><label className="block"><span className="field-label">Ends</span><input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="field-control" data-testid="input-window-end" /></label></div></section></div>
      <div className="space-y-5"><section className="vg-card rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">03</span><div><h2 className="vg-display text-[17px] font-bold">Face reference</h2><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Camera denied? Upload a clear portrait instead.</p></div></div><CaptureStation onCapture={(value, descriptor) => { setPhotoUrl(value); setFaceDescriptor(descriptor ?? null); }} label="Use this capture" /></section><section className="vg-card rounded-2xl p-5 md:p-6"><div className="flex items-start gap-3"><button type="button" role="switch" aria-checked={consent} onClick={() => setConsent(!consent)} className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-1 transition-colors ${consent ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`} data-testid="switch-biometric-consent"><span className={`h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform ${consent ? 'translate-x-4' : ''}`} /></button><div><div className="text-[13px] font-bold">I have explicit consent to store this face reference.</div><p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">The person has been told why this image is collected, how it supports gate decisions, and how an authorised operator can revoke it. Consent is a prerequisite, not a footnote.</p><div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-[hsl(var(--primary))]"><CheckCircle2 size={14} /> Revocation is always available in Audit & profiles</div></div></div></section>{notice && <Notice kind={notice.kind}>{notice.message}</Notice>}<button type="submit" disabled={createProfile.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60" data-testid="button-create-enrolment">{createProfile.isPending ? <RefreshCw size={16} className="animate-spin" /> : <UserRoundPlus size={16} />} {createProfile.isPending ? 'Saving enrolment' : 'Create active enrolment'} <ArrowRight size={15} /></button></div>
    </form>
  </>;
}

function Verify() {
  const sitesQuery = useListSites({ query: { queryKey: getListSitesQueryKey() } });
  const sites = sitesQuery.data ?? demoSites;
  const [siteId, setSiteId] = useState(sites[0]?.id ?? 'site-school');
  const profilesQuery = useListProfiles(siteId, { query: { queryKey: getListProfilesQueryKey(siteId), enabled: Boolean(siteId) } });
  const profiles = (profilesQuery.data ?? demoProfiles.filter((profile) => profile.siteId === siteId)).filter((profile) => profile.status === 'active');
  const decide = useDecideVerification();
  const mutationQueryClient = useQueryClient();
  const [gate, setGate] = useState(sites.find((site) => site.id === siteId)?.type === 'estate' ? 'Vehicle Gate' : 'Main Gate');
  const [capture, setCapture] = useState('');
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [suggested, setSuggested] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  const [lastDecision, setLastDecision] = useState<string | null>(null);
  useEffect(() => { if (!sites.some((site) => site.id === siteId) && sites[0]) setSiteId(sites[0].id); }, [siteId, sites]);
  useEffect(() => { setGate(sites.find((site) => site.id === siteId)?.type === 'estate' ? 'Vehicle Gate' : 'Main Gate'); setSelectedProfile(''); setSuggested(false); }, [siteId, sites]);
  const runCheck = () => { if (!capture) { setNotice({ kind: 'error', message: 'Capture or upload a face image before running a check.' }); return; } const candidate = profiles[0]; if (candidate) { setSelectedProfile(candidate.id); setSuggested(true); setNotice(null); } else setNotice({ kind: 'error', message: 'No active profiles are available for this site.' }); };
  const makeDecision = (result: 'verified' | 'override' | 'denied') => {
    if (!capture) { setNotice({ kind: 'error', message: 'A face capture is required before a decision can be logged.' }); return; }
    if (result === 'override' && reason.trim().length < 4) { setNotice({ kind: 'error', message: 'Add a short reason for the manual confirmation. This becomes part of the audit record.' }); return; }
    setNotice(null);
    decide.mutate({ data: { siteId, matchedProfileId: selectedProfile || null, faceDescriptor, gateName: `${siteName(siteId, sites)} · ${gate}`, result, similarityScore: result === 'verified' ? .91 : result === 'override' ? .54 : .18, decisionMs: result === 'override' ? 4020 : 1680, overrideReason: result === 'override' ? reason.trim() : null, flaggedSuspicious: flagged || result === 'denied' } }, {
      onSuccess: () => { setLastDecision(result); setNotice({ kind: 'success', message: result === 'verified' ? 'Verified and logged. Proceed with the handover.' : result === 'override' ? 'Manual confirmation logged with reason.' : 'Not verified. The attempt has been logged for review.' }); mutationQueryClient.invalidateQueries({ queryKey: getListVerificationEventsQueryKey() }); mutationQueryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); },
      onError: () => setNotice({ kind: 'error', message: 'The decision could not be logged. Keep the person at the gate and retry.' }),
    });
  };
  return <><PageIntro eyebrow="Gate operation · explicit decision" title="Verify at the gate." description="Capture first. Review the suggested match. Then choose exactly one logged outcome — verified, manual confirmation, or not verified." action={<div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--accent)/.18)] px-3 py-2.5 text-[11px] font-semibold text-[hsl(35_64%_28%)]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> Human review always available</div>} />
    {sitesQuery.isError && <div className="mb-5"><QueryError /></div>}
     <div className="grid gap-5 xl:grid-cols-[.82fr_1.18fr]"><section className="space-y-5"><div className="vg-card rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">01</span><div><h2 className="vg-display text-[17px] font-bold">Choose your post</h2><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Verification context is logged with the decision.</p></div></div><div className="space-y-4"><label className="block"><span className="field-label">Site</span><select value={siteId} onChange={(event) => setSiteId(event.target.value)} className="field-control" data-testid="select-verify-site">{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><label className="block"><span className="field-label">Gate</span><div className="grid grid-cols-2 gap-2">{['Main Gate', 'Vehicle Gate'].map((item) => <button type="button" key={item} onClick={() => setGate(item)} className={`rounded-xl border px-3 py-3 text-left text-[12px] font-semibold transition ${gate === item ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/.45)]'}`} data-testid={`button-gate-${item.toLowerCase().replace(' ', '-')}`}><Gate size={15} className="mb-2" />{item}</button>)}</div></label></div></div><div className="vg-card overflow-hidden rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">02</span><div><h2 className="vg-display text-[17px] font-bold">Capture face</h2><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Camera access is optional. Upload fallback is ready.</p></div></div><CaptureStation onCapture={(value, descriptor) => { setCapture(value); setFaceDescriptor(descriptor ?? null); setSuggested(false); setLastDecision(null); }} label="Use this capture" /></div></section><section className="space-y-5"><div className="vg-card rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">03</span><div><h2 className="vg-display text-[17px] font-bold">Review match</h2><p className="text-[11px] text-[hsl(var(--muted-foreground))]">A suggestion is never a decision.</p></div></div>{suggested ? <div className="rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--secondary)/.48)] p-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))]">{initials(profiles.find((p) => p.id === selectedProfile)?.name ?? 'Match')}</div><div className="min-w-0 flex-1"><div className="text-[14px] font-bold">{profiles.find((p) => p.id === selectedProfile)?.name}</div><div className="mt-1 text-[11px] capitalize text-[hsl(var(--muted-foreground))]">{roleName(profiles.find((p) => p.id === selectedProfile)?.role ?? '')} · {profiles.find((p) => p.id === selectedProfile)?.linkedTo}</div></div><div className="text-right"><div className="vg-display text-[23px] font-bold text-[hsl(var(--primary))]">91%</div><div className="vg-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">suggested</div></div></div><div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--primary)/.18)] pt-3 text-[10px] text-[hsl(var(--muted-foreground))]"><CheckCircle2 size={14} className="text-[hsl(var(--primary))]" /> Check the face and context before making your decision.</div></div> : <div className="flex min-h-[156px] flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] px-5 text-center"><Fingerprint size={25} className="text-[hsl(var(--muted-foreground)/.65)]" /><div className="mt-3 text-[13px] font-semibold">No match reviewed yet</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Complete a capture, then run the check.</div></div>}<button onClick={runCheck} disabled={!capture} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--primary))] py-3 text-[12px] font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--secondary))] disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-run-face-check"><Fingerprint size={16} /> {suggested ? 'Re-run face check' : 'Run face check'}</button></div><div className="vg-card rounded-2xl p-5 md:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="vg-display text-[17px] font-bold">Make the decision</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">This action writes to the audit log.</p></div><span className="vg-mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Step 04</span></div><div className="space-y-2"><button onClick={() => makeDecision('verified')} disabled={decide.isPending} className={`decision-button border-[hsl(164_43%_72%)] bg-[hsl(164_50%_94%)] text-[hsl(166_64%_26%)]`} data-testid="button-decision-verified"><CheckCircle2 size={19} /><span className="flex-1 text-left"><b className="block">Verified</b><small>Identity and context are clear</small></span><ArrowRight size={15} /></button><button onClick={() => makeDecision('override')} disabled={decide.isPending} className="decision-button border-[hsl(38_67%_72%)] bg-[hsl(38_81%_94%)] text-[hsl(35_64%_28%)]" data-testid="button-decision-manual"><AlertCircle size={19} /><span className="flex-1 text-left"><b className="block">Confirm manually</b><small>Use your judgement and leave a reason</small></span><ArrowRight size={15} /></button><button onClick={() => makeDecision('denied')} disabled={decide.isPending} className="decision-button border-[hsl(1_55%_79%)] bg-[hsl(1_65%_96%)] text-[hsl(1_58%_38%)]" data-testid="button-decision-denied"><Ban size={19} /><span className="flex-1 text-left"><b className="block">Not verified</b><small>Keep the person at the gate</small></span><ArrowRight size={15} /></button></div><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3"><input type="checkbox" checked={flagged} onChange={(event) => setFlagged(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-flag-suspicious" /><span className="text-[11px] font-semibold">Flag this attempt for review</span></label><label className="mt-3 block"><span className="field-label">Manual confirmation reason <span className="font-normal normal-case tracking-normal text-[hsl(var(--muted-foreground))]">required only for manual</span></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="field-control resize-none" placeholder="e.g. Known guardian; face partially obscured" data-testid="textarea-override-reason" /></label></div>{notice && <Notice kind={notice.kind}>{notice.message}</Notice>}{lastDecision && <div className="rounded-xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--secondary)/.5)] px-4 py-3 text-[11px] font-semibold text-[hsl(var(--primary))]" data-testid="text-last-decision">Decision recorded as {lastDecision === 'override' ? 'manual confirmation' : lastDecision}.</div>}</section></div>
  </>;
}

function Admin() {
  const sitesQuery = useListSites({ query: { queryKey: getListSitesQueryKey() } });
  const sites = sitesQuery.data ?? demoSites;
  const [siteFilter, setSiteFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ ...(siteFilter !== 'all' ? { siteId: siteFilter } : {}), ...(resultFilter !== 'all' ? { result: resultFilter as 'verified' | 'denied' | 'override' } : {}), limit: 100 }), [resultFilter, siteFilter]);
  const eventsQuery = useListVerificationEvents(params, { query: { queryKey: getListVerificationEventsQueryKey(params) } });
  const displayedEvents = (eventsQuery.data ?? demoEvents).filter((event) => { const profile = demoProfiles.find((item) => item.id === event.matchedProfileId); return !search || event.gateName.toLowerCase().includes(search.toLowerCase()) || profile?.name.toLowerCase().includes(search.toLowerCase()) || event.staffId.toLowerCase().includes(search.toLowerCase()); });
  const [profileSite, setProfileSite] = useState(sites[0]?.id ?? 'site-school');
  const profilesQuery = useListProfiles(profileSite, { query: { queryKey: getListProfilesQueryKey(profileSite), enabled: Boolean(profileSite) } });
  const profiles = profilesQuery.data ?? demoProfiles.filter((profile) => profile.siteId === profileSite);
  const updateStatus = useUpdateProfileStatus();
  const mutationQueryClient = useQueryClient();
  const toggleProfile = (profile: Profile) => updateStatus.mutate({ profileId: profile.id, data: { status: profile.status === 'active' ? 'revoked' : 'active' } }, { onSuccess: () => mutationQueryClient.invalidateQueries({ queryKey: getListProfilesQueryKey(profileSite) }) });
  return <><PageIntro eyebrow="Governance · audit trail" title="Audit & profiles." description="Review every gate decision and keep active access under deliberate control. Revocation is immediate and visible." action={<div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-[11px] text-[hsl(var(--muted-foreground))]"><FileClock size={15} className="text-[hsl(var(--primary))]" /> Retention-ready log</div>} />
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="vg-card overflow-hidden rounded-2xl" data-testid="section-audit-events"><div className="border-b border-[hsl(var(--border))] p-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h2 className="vg-display text-[18px] font-bold">Verification events</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Immutable decisions, with manual reasons attached.</p></div><div className="relative md:w-52"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="field-control pl-9" placeholder="Search log" data-testid="input-audit-search" /></div></div><div className="mt-4 flex flex-wrap gap-2"><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} className="filter-control" data-testid="select-audit-site"><option value="all">All sites</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select><select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} className="filter-control" data-testid="select-audit-result"><option value="all">All outcomes</option><option value="verified">Verified</option><option value="override">Manual confirm</option><option value="denied">Not verified</option></select><span className="ml-auto self-center text-[10px] text-[hsl(var(--muted-foreground))]">{displayedEvents.length} events</span></div></div>{eventsQuery.isError && <div className="p-5 pb-0"><QueryError message="Audit feed is offline." /></div>}{eventsQuery.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="vg-skeleton h-14 rounded-lg" />)}</div> : displayedEvents.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-[hsl(var(--border))] text-[10px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><th className="px-5 py-3 font-medium">Person / site</th><th className="px-3 py-3 font-medium">Outcome</th><th className="px-3 py-3 font-medium">Match</th><th className="px-3 py-3 font-medium">Staff</th><th className="px-5 py-3 text-right font-medium">Logged</th></tr></thead><tbody>{displayedEvents.map((event) => { const profile = demoProfiles.find((item) => item.id === event.matchedProfileId); return <tr key={event.id} className="border-b border-[hsl(var(--border)/.65)] last:border-0 hover:bg-[hsl(var(--muted)/.35)]" data-testid={`row-audit-${event.id}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[10px] font-bold text-[hsl(var(--primary))]">{profile ? initials(profile.name) : '—'}</div><div><div className="text-[12px] font-semibold">{profile?.name ?? 'No profile match'}</div><div className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{siteName(event.siteId, sites)} · {event.gateName.split(' · ')[1] ?? event.gateName}</div></div></div>{event.overrideReason && <div className="mt-2 rounded-md bg-[hsl(var(--accent)/.14)] px-2 py-1 text-[10px] text-[hsl(35_64%_28%)]">Reason: {event.overrideReason}</div>}</td><td className="px-3 py-4"><StatusBadge result={event.result} />{event.flaggedSuspicious && <div className="mt-1 text-[9px] font-bold uppercase tracking-[.1em] text-[hsl(var(--destructive))]">Flagged</div>}</td><td className="px-3 py-4"><span className="vg-mono text-[11px]">{Math.round(event.similarityScore * 100)}%</span></td><td className="px-3 py-4 text-[11px] text-[hsl(var(--muted-foreground))]">{event.staffId}</td><td className="px-5 py-4 text-right"><div className="text-[11px] font-semibold">{formatTime(event.createdAt)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{formatDate(event.createdAt)}</div></td></tr>; })}</tbody></table></div> : <div className="flex flex-col items-center justify-center px-5 py-16 text-center"><Search size={25} className="text-[hsl(var(--muted-foreground))]" /><div className="mt-3 text-sm font-semibold">No events match those filters</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Try a broader search or clear the outcome filter.</div></div>}</section><section className="vg-card overflow-hidden rounded-2xl" data-testid="section-profile-management"><div className="border-b border-[hsl(var(--border))] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="vg-display text-[18px] font-bold">Active profiles</h2><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Access can be revoked without deleting the audit trail.</p></div><UsersRound size={19} className="text-[hsl(var(--primary))]" /></div><select value={profileSite} onChange={(event) => setProfileSite(event.target.value)} className="field-control mt-4" data-testid="select-profile-site">{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></div><div className="divide-y divide-[hsl(var(--border)/.75)]">{profiles.length ? profiles.map((profile) => <div key={profile.id} className="p-4" data-testid={`card-profile-${profile.id}`}><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-bold ${profile.status === 'active' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{initials(profile.name)}</div><div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold">{profile.name}</div><div className="mt-1 truncate text-[10px] capitalize text-[hsl(var(--muted-foreground))]">{roleName(profile.role)} · {profile.linkedTo}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${profile.status === 'active' ? 'bg-[hsl(164_52%_89%)] text-[hsl(166_64%_26%)]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{profile.status}</span></div><button onClick={() => toggleProfile(profile)} disabled={updateStatus.isPending} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-[10px] font-bold transition ${profile.status === 'active' ? 'border-[hsl(1_55%_79%)] text-[hsl(1_58%_38%)] hover:bg-[hsl(1_65%_96%)]' : 'border-[hsl(var(--primary)/.4)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]'}`} data-testid={`button-toggle-profile-${profile.id}`}>{profile.status === 'active' ? <><Archive size={13} /> Revoke access</> : <><CheckCircle2 size={13} /> Reactivate access</>}</button></div>) : <div className="px-5 py-14 text-center"><UsersRound size={25} className="mx-auto text-[hsl(var(--muted-foreground))]" /><div className="mt-3 text-sm font-semibold">No profiles at this site</div><Link href="/enrol" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--primary))]" data-testid="link-empty-enrol">Create the first enrolment <ArrowRight size={13} /></Link></div>}</div></section></div>
  </>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const { role } = useContext(RoleContext);
  return <RoutedErrorBoundary><AppShell><Switch><Route path="/" component={Overview} /><Route path="/enrol" component={Enrol} /><Route path="/verify" component={Verify} />{role === 'admin' && <Route path="/admin" component={Admin} />}<Route component={NotFound} /></Switch></AppShell></RoutedErrorBoundary>;
}

function App() {
  const [role, setRole] = useState<UserRole>('admin');
  return <QueryClientProvider client={queryClient}><TooltipProvider><RoleContext.Provider value={{ role, setRole }}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></RoleContext.Provider><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;