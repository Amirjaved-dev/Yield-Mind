"use client";

import { useState, useEffect } from "react";
import { Providers } from "./providers";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <Providers>{children}</Providers>;
}
