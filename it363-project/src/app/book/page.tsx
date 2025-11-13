"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import Link from "next/link";

export default function BookPage() {
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [town, setTown] = useState("");
  const [date, setDate] = useState<string>("");
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const todayISO = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (!name.trim() || !town.trim() || !date.trim()) {
      setErr("Please provide your name, town, and a requested date.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setErr("Please provide either a phone number or email so we can reach you.");
      return;
    }
    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErr("Please provide a valid email address (e.g., you@example.com).");
        return;
      }
    }
    setBusy(true);
    try {
      if (siteKey) {
        if (!captchaToken) {
          setErr("Please complete the verification challenge.");
          return;
        }
      }
      const res = await fetch("/api/book-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: name.trim(), 
          business: business.trim(), 
          town: town.trim(), 
          date: date.trim(), 
          description: details.trim(), 
          phone: phone.trim(),
          email: email.trim(),
          captchaToken 
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "We couldn't send your request. Try emailing us directly.");
      }
      setMsg("Thanks! Your booking request has been sent. We'll reach out soon.");
      setName(""); setBusiness(""); setTown(""); setDate(""); setDetails(""); setPhone(""); setEmail("");
      setCaptchaToken(null);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong sending your request.");
    } finally {
      setBusy(false);
    }
  }

  const mailtoHref = (() => {
    const subject = encodeURIComponent("Booking Request");
    const body = encodeURIComponent(`Name: ${name}\nBusiness/Personal: ${business}\nTown: ${town}\nRequested Date: ${date}\nPhone: ${phone}\nEmail: ${email}\n\nDetails:\n${details}`);
    return `mailto:speck4193@gmail.com?subject=${subject}&body=${body}`;
  })();

  return (
    <main className="min-h-screen w-full bg-white text-neutral-900">
      <div className="content-wrapper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900">Book with us!</h1>
        <p className="mt-2 text-neutral-600">Tell us a bit about your event and the date you're looking at. We'll follow up with you to confirm everything!</p>

        <div className="mt-8 grid gap-8 md:grid-cols-[2fr_1fr]">
        {/* Form */}
        <form onSubmit={submit} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm text-neutral-700">Your Name</label>
              <input
                className="rounded-md border border-neutral-300 px-3 py-2"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-700">Business (or Personal)</label>
              <input
                className="rounded-md border border-neutral-300 px-3 py-2"
                value={business}
                onChange={e => setBusiness(e.target.value)}
                placeholder="Your business name or 'Personal'"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-700">Location</label>
              <input
                className="rounded-md border border-neutral-300 px-3 py-2"
                value={town}
                onChange={e => setTown(e.target.value)}
                placeholder="Peoria, IL"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-700">Requested Date</label>
              <input
                type="date"
                className="rounded-md border border-neutral-300 px-3 py-2"
                value={date}
                min={todayISO}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-700">Phone Number</label>
              <input
                type="tel"
                className="rounded-md border border-neutral-300 px-3 py-2"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(309) 555-1234"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-neutral-700">Email Address</label>
              <input
                type="email"
                className="rounded-md border border-neutral-300 px-3 py-2"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <p className="text-xs text-neutral-500">* At least one contact method (phone or email) is required so we can reach you.</p>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm text-neutral-700">Event Description</label>
              <textarea
                className="rounded-md border border-neutral-300 px-3 py-2 min-h-[140px]"
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Briefly describe your event, expected crowd size, preferred time window, and any special notes."
              />
            </div>
          </div>

          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
          {msg && <div className="mt-3 text-sm text-green-700">{msg}</div>}

          {siteKey && (
            <div className="mt-4">
              {/* Cloudflare Turnstile widget */}
              <div
                className="cf-turnstile"
                data-sitekey={siteKey}
                data-callback="onTurnstileSuccess"
                data-theme="light"
              />
            </div>
          )}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || (Boolean(siteKey) && !captchaToken)}
              className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Submit Request"}
            </button>
            <a
              href={mailtoHref}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              or email us directly
            </a>
          </div>
        </form>

        {/* Contact info sidebar */}
        <aside className="rounded-2xl border border-neutral-200 bg-white p-6 h-fit">
          <h2 className="text-xl font-semibold text-neutral-900">Contact</h2>
          <p className="mt-2 text-neutral-600">Prefer to reach out yourself? Give us a call!</p>
          <ul className="mt-4 space-y-2 text-neutral-800">
            <li>
              <span className="font-medium">Phone:</span> <a className="hover:underline" href="tel:+13094536700">(309) 453-6700</a>
            </li>
            <li>
              <span className="font-medium">Email:</span> <a className="hover:underline" href="mailto:speck4193@gmail.com">speck4193@gmail.com</a>
            </li>
          </ul>
          <div className="mt-6 text-sm text-neutral-600">
            <p className="mt-1">Looking forward to serving your event!</p>
          </div>
          <div className="mt-6 text-sm">
            <Link href="/" className="text-red-600 hover:underline">Back to Home</Link>
          </div>
        </aside>
        </div>
        {siteKey && (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            async
            defer
            onLoad={() => {
              // Attach global callback expected by data-callback attribute.
              (window as any).onTurnstileSuccess = (token: string) => {
                setCaptchaToken(token);
              };
            }}
          />
        )}
        </div>
      </div>
    </main>
  );
}
