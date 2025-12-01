"use client";

import { useState } from "react";

export default function AboutPage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Add your image paths here
  const images = [
    { src: "/line.jpg", alt: "Line" },
    { src: "/foodtruck.jpg", alt: "Food Truck" },
    { src: "/line2.jpg", alt: "Another Line" },
  ];

  const milestones = [
    {
      year: "1980s",
      title: "Neighborhood roots",
      description: "Rita grew up in the kitchen at Haddad’s restaurant in Peoria, learning hospitality the slow, intentional way."
    },
    {
      year: "2000s",
      title: "Family-run diners",
      description: "Rita and Andy opened restaurants together, refining catering menus and serving comfort food to every table."
    },
    {
      year: "2021",
      title: "The Station hits the road",
      description: "The food truck launched to bring that same quality to festivals, workplaces, and celebrations across Illinois."
    },
    {
      year: "Today",
      title: "Catering, festivals, and more",
      description: "From corporate lunches to weddings, The Station continues to roll with new flavors and familiar favorites."
    }
  ];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-10 shadow-xl shadow-black/10 backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.35),transparent_55%)]" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-red-700">Our story</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-neutral-900">Family recipes on four wheels</h1>
              <p className="mt-5 text-neutral-700">
                For over three decades Rita and Andy have been feeding Central Illinois—from neighborhood diners to full-service catering. The Station Food Truck lets us carry that legacy anywhere people gather, so every event feels a little more like home.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-neutral-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100/80 px-4 py-2 text-red-700">
                  <span className="text-lg">🍲</span>
                  35+ years of hospitality
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-4 py-2 text-amber-700">
                  <span className="text-lg">🚚</span>
                  2021 truck launch
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2">
                  <span className="text-lg">🎉</span>
                  Weddings, festivals & pop-ups
                </span>
              </div>
            </div>
            <div className="relative h-72 overflow-hidden rounded-2xl shadow-lg shadow-black/15 lg:h-full">
              <img src="/truckimage.jpg" alt="The Station team" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 text-sm font-semibold text-white">
                Full-flavor cooking, flexible catering.
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.6fr_1.4fr]">
          <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-lg shadow-black/10 backdrop-blur">
            <h2 className="text-2xl font-semibold text-neutral-900">Timeline</h2>
            <p className="mt-3 text-sm text-neutral-600">A few stops along the way.</p>
            <ul className="mt-6 space-y-6">
              {milestones.map((milestone) => (
                <li key={milestone.year} className="relative pl-6">
                  <span className="absolute left-0 top-1 h-4 w-4 rounded-full bg-red-700" aria-hidden="true" />
                  <p className="text-xs uppercase tracking-wide text-red-700">{milestone.year}</p>
                  <h3 className="text-base font-semibold text-neutral-900">{milestone.title}</h3>
                  <p className="text-sm text-neutral-600">{milestone.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-lg shadow-black/10 backdrop-blur">
            <h2 className="text-2xl font-semibold text-neutral-900">Made with the crowd in mind</h2>
            <p className="mt-4 text-neutral-700 leading-relaxed">
              The Station thrives on feeding crowds that want something familiar but never boring. From slow-smoked meats to vegetarian wraps and loaded fries, our menus are flexible enough to match your vibe and your budget. We prep fresh for every stop so that each bite feels handcrafted.
            </p>
            <p className="mt-4 text-neutral-700 leading-relaxed">
              Beyond events, we work closely with local businesses for on-site lunches and appreciation days. Need a curated menu? We&apos;ll partner with you to create options that match dietary needs and service windows.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-neutral-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100/80 px-4 py-2 text-red-700">
                <span className="text-lg">🌶️</span>
                Flavor-forward menu rotations
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100/80 px-4 py-2 text-amber-700">
                <span className="text-lg">🤝</span>
                Flexible catering packages
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2">
                <span className="text-lg">✨</span>
                Awarded West Bluff Business of the Year 2025
              </span>
            </div>
            <a
              href="/book"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
            >
              Book the truck
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-lg shadow-black/10 backdrop-blur">
            <h2 className="text-2xl font-semibold text-neutral-900">Rolling gallery</h2>
            <p className="mt-2 text-sm text-neutral-600">Scenes from the road.</p>
            <div className="relative mt-6">
              <div className="w-full overflow-hidden rounded-2xl shadow-lg shadow-black/15">
                <img
                  src={images[currentImageIndex].src}
                  alt={images[currentImageIndex].alt}
                  className="h-72 w-full object-cover transition-all duration-500"
                />
              </div>
              <button
                onClick={prevImage}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                aria-label="Previous image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextImage}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                aria-label="Next image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 px-4 py-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition ${index === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/70"}`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-lg shadow-black/10 backdrop-blur">
            <h2 className="text-2xl font-semibold text-neutral-900">What drives us</h2>
            <blockquote className="mt-4 text-lg italic text-neutral-700">
              “At The Station we&apos;re committed to quick lines, hot plates, and the kind of hospitality that keeps people coming back for seconds.”
            </blockquote>
            <p className="mt-4 text-sm text-neutral-600">
              Rita & Andy · Owners
            </p>
            <div className="mt-8 space-y-4 text-sm text-neutral-700">
              <p>• Quality ingredients, handled with care.</p>
              <p>• A menu that travels well but always feels handcrafted.</p>
              <p>• Partnerships with local events, breweries, and community fundraisers.</p>
              <p>• A service team that remembers faces and favorites.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
