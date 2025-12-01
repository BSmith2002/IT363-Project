  // --- Social Meta Tags for Facebook Sharing ---
  // Add these tags to the <head> using next/head
  // You can adjust the content as needed for your brand/page
export default function Head() {
  const metaTitle = "The Station Food Truck | Central Illinois Comfort Food";
  const metaDescription = "Smoked sandwiches, comfort classics, and daily specials. Find The Station Food Truck around Peoria or book us for your next event.";
  const metaImage = "/foodtruck.jpg";
  const metaUrl = "https://thestationfoodtruck.com/";

  return (
    <>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={metaUrl} />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
    </>
  );
}
