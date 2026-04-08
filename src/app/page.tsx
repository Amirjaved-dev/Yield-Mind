import { ConnectButton } from "@/components/ConnectButton";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black min-h-screen">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-16">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          YieldMind
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 text-center">
          Connect your wallet to get started
        </p>
        <ConnectButton />
      </main>
    </div>
  );
}
