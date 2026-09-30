import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Button } from "../components/ui/button";
import { Illustration } from "../components/illustration";
export function SharePage() {
  const { id } = useParams({ strict: false });
  const url = `${location.origin}/thread/${id}`;
  const [message, setMessage] = useState("");
  return <section className="flex flex-col text-light-1"><h1 className="x-feed-heading">Gönderiyi Paylaş</h1><div className="p-5 flex gap-3 flex-wrap justify-center">
    <Button  onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage("Bağlantı kopyalandı."); } catch { setMessage("Bağlantı kopyalanamadı."); } }}>Bağlantıyı kopyala</Button>
    <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></Button>
    <Button variant="outline" asChild><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">Instagram</a></Button>
    {typeof navigator.share === "function" && <Button variant="outline" onClick={async () => { try { await navigator.share({ url, title: "social-web gönderisi" }); } catch { /* Dismissing the share sheet is not an error. */ } }}>Diğer uygulamalar</Button>}
  </div><p role="status" className="mt-4 text-light-3">{message}</p><Illustration name="messages" className="share-illustration" /></section>;
}
