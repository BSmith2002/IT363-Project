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
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-10 shadow-xl shadow-black/10 backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.3),transparent_55%)]" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-red-700">Plan ahead</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-neutral-900">Bring The Station to your next event</h1>
            <p className="mt-4 text-neutral-700">
              Pop-ups, corporate lunches, weddings, or community nights—we tailor every menu and service window to fit your crowd.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-neutral-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100/80 px-4 py-2 text-red-700">
                <span className="text-lg">👥</span>
                Minimum 50 guests recommended
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-4 py-2 text-amber-700">
                <span className="text-lg">🍽️</span>
                Customizable menus
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2">
                <span className="text-lg">📆</span>
                Best to book 3-6 weeks out
              </span>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
          <form onSubmit={submit} className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-lg shadow-black/10 backdrop-blur sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-neutral-700">Your Name</label>
              <input
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-inner text-black"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Business (or Personal)</label>
              <input
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-inner text-black"
                value={business}
                onChange={e => setBusiness(e.target.value)}
                placeholder="Your business name or 'Personal'"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Location</label>
              <input
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-inner text-black"
                value={town}
                onChange={e => setTown(e.target.value)}
                placeholder="Peoria, IL"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-800">Requested Date</label>
              <input
                type="date"
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-inner text-black"
                value={date}
                min={todayISO}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Phone Number</label>
              <input
                type="tel"
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-inner text-black"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(309) 555-1234"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Email Address</label>
              <input
                type="email"
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 shadow-inner text-black"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <p className="text-xs text-neutral-500">* At least one contact method (phone or email) is required so we can reach you.</p>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium text-neutral-700">Event Description</label>
              <textarea
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 min-h-[140px] shadow-inner text-black"
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Briefly describe your event, expected crowd size, preferred time window, and any special notes."
              />
            </div>
          </div>

          {err && <div className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}
          {msg && <div className="mt-3 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{msg}</div>}

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
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || (Boolean(siteKey) && !captchaToken)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-red-800 px-5 py-2.5 text-white font-medium shadow-lg shadow-black/20 transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Submit Request"}
            </button>
            <a
              href={mailtoHref}
              className="text-sm font-medium text-red-800 hover:underline"
            >
              or email us directly
            </a>
          </div>
        </form>

        <aside className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-lg shadow-black/10 backdrop-blur h-fit">
          <h2 className="text-xl font-semibold text-neutral-900">Questions?</h2>
          <p className="mt-2 text-sm text-neutral-600">We&apos;re quick to respond during business hours.</p>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li>
              <span className="font-semibold text-neutral-900">Phone:</span> <a className="text-red-800 hover:underline" href="tel:+13094536700">(309) 453-6700</a>
            </li>
            <li>
              <span className="font-semibold text-neutral-900">Email:</span> <a className="text-red-800 hover:underline" href="mailto:speck4193@gmail.com">speck4193@gmail.com</a>
            </li>
            <li>
              <span className="font-semibold text-neutral-900">Turnaround:</span> We typically confirm within 2 business days.
            </li>
          </ul>
          <div className="mt-6 rounded-2xl bg-red-50/80 p-4 text-sm text-red-900">
            <p className="font-semibold">Helpful tips</p>
            <ul className="mt-2 space-y-1">
              <li>• Include rough headcount so we can right-size the menu.</li>
              <li>• Share load-in details if the truck spot is tricky.</li>
              <li>• Rain plan? Let us know so we can prep.</li>
            </ul>
          </div>
          <div className="mt-6 text-sm">
            <Link href="/" className="text-red-800 hover:underline">Back to Home</Link>
          </div>
        </aside>
        </section>

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
  );
}
