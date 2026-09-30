import { Illustration } from "../components/illustration";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Brand } from "../brand";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { ErrorNotice, errorMessage } from "../ui";

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(""); setMessage("");
    try {
      const credentials = { email: String(data.get("email")), password: String(data.get("password")) };
      const result = signup
        ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${location.origin}/auth/confirm`, data: { invite_code: String(data.get("invite")).trim() } } })
        : await supabase.auth.signInWithPassword(credentials);
      if (result.error) throw new Error(signup ? "Kayıt tamamlanamadı. Davet kodunu ve bilgilerini kontrol et." : "Giriş yapılamadı. E-posta, şifre ve hesap doğrulamanı kontrol et.");
      if (signup && !result.data.session) setMessage("Kaydını tamamlamak için e-postana gelen doğrulama bağlantısını aç.");
      else await navigate({ to: signup ? "/onboarding" : "/" });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <main className="auth-layout"><div className="auth-intro"><Brand /><h1>Birlikte daha<br />fazla şey paylaş.</h1><p className="muted">İnsanlarla tanış, topluluklara katıl ve sohbeti başlat.</p><Illustration name="people" className="auth-illustration" /></div>
    <section className="panel auth-card"><p className="eyebrow">{signup ? "DAVETLİSİN" : "TEKRAR MERHABA"}</p><h2>{signup ? "Hesabını oluştur" : "Giriş yap"}</h2>
      <p className="muted">{signup ? "social-web'e yalnızca geçerli bir davet koduyla katılabilirsin." : "Sohbet kaldığı yerden devam ediyor."}</p>
      <form className="stack" onSubmit={submit}>
        {signup && <label>Davet kodu<Input name="invite" required minLength={24} maxLength={128} autoComplete="off" spellCheck={false} /></label>}
        <label>E-posta<Input name="email" type="email" required autoComplete="email" /></label>
        <label>Şifre<Input name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} /></label>
        <Button className="bg-primary-500" disabled={busy}>{busy ? "Bekle…" : signup ? "Davetle katıl" : "Giriş yap"}</Button>
        <ErrorNotice message={error} /><p role="status">{message}</p>
      </form>
      <Link to={signup ? "/sign-in" : "/sign-up"}>{signup ? "Zaten hesabım var" : "Davet kodum var"}</Link>
    </section>
  </main>;
}
export function ConfirmPage() { return <main className="page-state"><p>Hesabın doğrulanıyor…</p></main>; }
