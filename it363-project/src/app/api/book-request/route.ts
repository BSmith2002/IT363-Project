import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}));
    const name = String(data?.name || "").trim();
    const business = String(data?.business || "").trim();
    const town = String(data?.town || "").trim();
    const date = String(data?.date || "").trim();
    const description = String(data?.description || "").trim();
    const phone = String(data?.phone || "").trim();
    const email = String(data?.email || "").trim();
    const captchaToken = String(data?.captchaToken || "").trim();

    if (!name || !town || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!phone && !email) {
      return NextResponse.json({ error: "Please provide either a phone number or email" }, { status: 400 });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: "Please provide a valid email address (e.g., you@example.com)" }, { status: 400 });
      }
    }

    // Optional Cloudflare Turnstile verification if secret key present
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!captchaToken) {
        return NextResponse.json({ error: "Captcha verification required" }, { status: 400 });
      }
      try {
        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ secret: turnstileSecret, response: captchaToken })
        });
        const verifyJson: any = await verifyRes.json().catch(() => ({}));
        if (!verifyJson.success) {
          return NextResponse.json({ error: "Captcha failed. Please retry." }, { status: 400 });
        }
      } catch (e: any) {
        console.warn("[turnstile verify error]", e);
        return NextResponse.json({ error: "Captcha verification error. Try again." }, { status: 400 });
      }
    }

    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_SECURE,
      SMTP_FROM,
      BOOK_TO_EMAIL
    } = process.env as Record<string, string | undefined>;

    const to = BOOK_TO_EMAIL || "speck4193@gmail.com";
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      return NextResponse.json({ error: "Email transport not configured (SMTP_* env vars missing)." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE || "false").toLowerCase() === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const from = SMTP_FROM || `Bookings <${SMTP_USER}>`;

    const subject = `New Booking Request — ${name} (${business || "Personal"})`;
    const text = [
      `Name: ${name}`,
      `Business/Personal: ${business || "Personal"}`,
      `Town: ${town}`,
      `Requested Date: ${date}`,
      phone ? `Phone: ${phone}` : "",
      email ? `Email: ${email}` : "",
      "",
      "Description:",
      description || "(none)",
    ].filter(Boolean).join("\n");

    const html = `
      <h2>New Booking Request</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Business/Personal:</strong> ${escapeHtml(business || "Personal")}</p>
      <p><strong>Town:</strong> ${escapeHtml(town)}</p>
      <p><strong>Requested Date:</strong> ${escapeHtml(date)}</p>
      ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
      ${email ? `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` : ""}
      <p><strong>Description:</strong></p>
      <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace">${escapeHtml(description || "(none)")}</pre>
    `;

    await transporter.sendMail({ from, to, subject, text, html });

    // Save booking request to Firestore
    // Import Firestore only when needed (for edge compatibility)
    const { getFirestore, collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    const { getApps, getApp, initializeApp } = await import("firebase/app");
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FB_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FB_MEASUREMENT_ID,
    };
    const app = getApps().length ? getApp() : initializeApp(config);
    const db = getFirestore(app);
    await addDoc(collection(db, "bookingRequests"), {
      name,
      business,
      town,
      date,
      description,
      phone,
      email,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[book-request]", e);
    return NextResponse.json({ error: e?.message || "Failed to send" }, { status: 500 });
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
