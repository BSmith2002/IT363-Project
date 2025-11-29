"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useState } from "react";

export default function AboutPage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Add your image paths here
  const images = [
    { src: "/line.jpg", alt: "Line" },
    { src: "/foodtruck.jpg", alt: "Food Truck" },
    { src: "/line2.jpg", alt: "Another Line" },
  ];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col">
      <Header />
      
      <div className="content-wrapper flex-1 bg-white">
        <main className="pb-20 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-7xl mx-auto">

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-12 lg:mb-16">
              {/* Left Column - Image */}
              <div className="flex items-start">
                <div className="w-full rounded-xl overflow-hidden shadow-2xl border-4 border-red-700 transform hover:scale-[1.02] transition-transform duration-300">
                  <img 
                    src="/truckimage.jpg" 
                    alt="Our Team" 
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

              {/* Right Column - Our Journey Section */}
              <div className="flex flex-col justify-center">
                <h2 className="text-2xl lg:text-3xl font-bold text-neutral-800 mb-4">Experience and Heart</h2>
                <p className="text-neutral-600 leading-relaxed mb-4 italic text-lg">
                  Since 1999
                </p>
                <p className="text-neutral-700 leading-relaxed mb-4 text-base lg:text-lg">
                  [Your journey text here - describe how you started, your mission, and what makes you special]
                </p>
                <p className="text-neutral-700 leading-relaxed text-base lg:text-lg">
                  [Continue your story here - talk about your evolution, growth, and commitment to quality]
                </p>
              </div>
            </div>

            {/* Bottom Section - Mission and Additional Image */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Left Column - Mission Statement */}
              <div className="space-y-6 flex flex-col justify-center">
                <div>
                  <p className="text-neutral-700 leading-relaxed mb-4 text-base lg:text-lg">
                    [Your mission statement here - describe your commitment to quality food, friendly service, and customer value]
                  </p>
                  <p className="text-neutral-700 leading-relaxed mb-4 text-base lg:text-lg">
                    [Additional information about menu expansion, Mediterranean items, catering services, etc.]
                  </p>
                  <p className="text-neutral-700 leading-relaxed mb-6 text-base lg:text-lg">
                    [More details about your dining area, customer experience, and what sets you apart]
                  </p>
                </div>

                {/* Quote/Testimonial Box */}
                <div className="bg-gray-50 border-l-4 border-green-700 p-6 rounded-r-lg shadow-md">
                  <blockquote className="text-lg lg:text-xl italic text-neutral-700 mb-2">
                    "[Your mission statement or customer testimonial quote here]"
                  </blockquote>
                </div>
              </div>

              {/* Right Column - Location Image Slideshow */}
              <div className="flex flex-col items-center">
                <div className="w-full relative">
                  <div className="w-full rounded-xl overflow-hidden shadow-2xl border-4 border-red-700 h-64 sm:h-80 lg:h-96 xl:h-[500px]">
                    <img 
                      src={images[currentImageIndex].src}
                      alt={images[currentImageIndex].alt}
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                  </div>
                  
                  {/* Previous Button */}
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-red-700/90 hover:bg-red-700 text-white rounded-full p-3 transition-all shadow-lg hover:scale-110"
                    aria-label="Previous image"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  {/* Next Button */}
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-600/90 hover:bg-red-700 text-white rounded-full p-3 transition-all shadow-lg hover:scale-110"
                    aria-label="Next image"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  {/* Image Indicators */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                          index === currentImageIndex 
                            ? "bg-red-600 w-8 shadow-lg" 
                            : "bg-white/70 hover:bg-white"
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
                
                <p className="text-neutral-600 italic text-center mt-4">
                  Come Out to See our Truck!
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
