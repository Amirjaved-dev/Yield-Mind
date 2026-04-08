import { ConnectButton } from "@/components/ConnectButton";
import { VaultList } from "@/components/VaultList";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 dark:bg-black min-h-screen">
      <main className="flex-1 w-full max-w-5xl flex-col gap-8 py-16 px-8">
        <header className="text-center mb-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            YieldMind
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2">
            Discover high-yield DeFi vaults across chains
          </p>
        </header>
        <div className="flex justify-center mb-6">
          <ConnectButton />
        </div>
        <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Available Vaults
          </h2>
          <VaultList />
        </section>
      </main>
    </div>
  );
}
