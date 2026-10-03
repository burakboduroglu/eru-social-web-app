import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Job, JobReference, JobShareSummary } from "../../shared/types";
import { api } from "../lib/api";
import { Icon } from "./icon";
import { Button } from "./ui/button";
import "./job-reference.css";

function summary(job: Job): JobShareSummary | null {
    if (job.status === "draft") return null;
    return { id: job.id, title: job.title, company: job.company, location: job.location, workMode: job.workMode, employmentType: job.employmentType, status: job.status, deadline: job.deadline };
}
const modes = { remote: "Uzaktan", onsite: "Ofiste", hybrid: "Hibrit" };
export function JobReferenceCard({ reference }: { reference: JobReference | null | undefined }) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => { const refresh = () => setNow(Date.now()); const timer = setInterval(refresh, 30_000); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, []);
    if (!reference) return null;
    if (reference.state === "unavailable") return <div className="job-reference is-unavailable"><Icon name="job" size={24} /><div><strong>İlan artık kullanılamıyor</strong><p>İlan silinmiş veya erişime kapalı olabilir.</p></div></div>;
    const job = reference.job, expired = !!job.deadline && Date.parse(job.deadline) <= now;
    const status = job.status === "closed" ? "Başvuru kapalı" : expired ? "Başvuru süresi doldu" : "Başvuru açık";
    return <div className="job-reference"><Icon name="job" size={24} /><div className="job-reference-copy"><span className="job-reference-label">İş ilanı · {status}</span><strong>{job.title}</strong><p>{job.company}{job.location ? ` · ${job.location}` : ""} · {modes[job.workMode]}</p><Link to={`/jobs/${job.id}`} className="job-reference-open">İlanı incele<Icon name="chevron" size={16} /></Link></div></div>;
}
export function ComposerJobAttachment({ accountId, attachment, requestedJobId, disabled, hasText, onChange, onSeedText, onReady }: {
    accountId: string; attachment: { jobId: string | null } | null; requestedJobId?: string; disabled: boolean; hasText: boolean;
    onChange: (attachment: { jobId: string | null } | null) => void; onSeedText: () => void; onReady: (key: string, ready: boolean) => void;
}) {
    const [current, setCurrent] = useState<{ key: string; reference: JobReference } | null>(null);
    const [candidate, setCandidate] = useState<{ id: string; job: JobShareSummary | null; error: string } | null>(null);
    const attempted = useRef("");
    const attachmentId = attachment?.jobId, key = attachmentId || "deleted";
    useEffect(() => {
        if (!attachment) return;
        let active = true;
        onReady(key, false);
        if (!attachmentId) { setCurrent({ key, reference: { state: "unavailable" } }); return; }
        const load = () => { void api<Job>(`/jobs/${attachmentId}`).then(job => {
            if (!active) return; const value = summary(job);
            setCurrent({ key, reference: value ? { state: "available", job: value } : { state: "unavailable" } });
            onReady(key, job.status === "published");
        }).catch(() => { if (active) { setCurrent({ key, reference: { state: "unavailable" } }); onReady(key, false); } }); };
        load(); window.addEventListener("focus", load);
        return () => { active = false; window.removeEventListener("focus", load); };
    }, [accountId, attachmentId, !!attachment, key, onReady]);
    useEffect(() => {
        if (!requestedJobId) return;
        let active = true;
        void api<Job>(`/jobs/${requestedJobId}`).then(job => {
            if (!active) return;
            const value = job.status === "published" ? summary(job) : null;
            setCandidate({ id: requestedJobId, job: value, error: value ? "" : "Bu ilan artık paylaşılabilir durumda değil." });
            const attempt = `${accountId}:${requestedJobId}`;
            if (attempted.current !== attempt) {
                attempted.current = attempt;
                // Existing text, target and attachments are never replaced by a prefill.
                if (value && !hasText && !attachment && !disabled) { onChange({ jobId: requestedJobId }); onSeedText(); }
            }
        }).catch(() => { if (active) setCandidate({ id: requestedJobId, job: null, error: "İlan yüklenemedi. Mevcut metnin korunuyor." }); });
        return () => { active = false; };
    }, [accountId, requestedJobId, hasText, !!attachment, disabled, onChange, onSeedText]);
    const reference = current?.key === key ? current.reference : null;
    return <div className="composer-job-attachment">
        {attachment && <div><div className="composer-job-attachment-heading"><span>Gönderideki ilan eki</span><button type="button" disabled={disabled} aria-label="İlan ekini kaldır; gönderi metnini koru" onClick={() => onChange(null)}><Icon name="close" size={18} />Eki kaldır</button></div>{reference ? <JobReferenceCard reference={reference} /> : <p role="status">İlan bilgileri yükleniyor…</p>}{reference && (reference.state === "unavailable" || reference.job.status === "closed") && <p className="composer-job-warning" role="status">İlan şu anda paylaşılamıyor. Devam etmek için eki kaldır; metnin korunur.</p>}</div>}
        {candidate?.id === requestedJobId && candidate?.job && attachmentId !== candidate.id && <div className="composer-job-candidate"><p>Mevcut taslağın korunuyor. Bu ilanı göndermeden önce inceleyip ekleyebilirsin.</p><JobReferenceCard reference={{ state: "available", job: candidate.job }} /><Button disabled={disabled} type="button" variant="outline" onClick={() => { onChange({ jobId: candidate.id }); if (!hasText) onSeedText(); }}>{attachment ? "İlan ekini bu ilanla değiştir" : "İlanı gönderiye ekle"}</Button></div>}
        {candidate?.id === requestedJobId && candidate?.error && <p role="alert" className="composer-job-warning">{candidate?.error}</p>}
    </div>;
}
