import Header from "@/components/Header";
import ClientHome from "@/components/ClientHome";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <Header />
      <main className="pt-20 pb-16 px-4 sm:px-6 flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">The Station Landing Site.</h1>
        <ClientHome />
      </main>
    </div>
  );
}
