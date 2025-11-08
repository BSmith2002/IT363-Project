import ClientHome from "@/components/ClientHome";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <main className="pb-16 px-4 sm:px-6 flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-neutral-900">The Station Foodtruck Site</h1>
        <ClientHome />
      </main>
    </div>
  );
}
