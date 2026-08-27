"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api<{ role: string }>("/api/me")
      .then((me) => {
        router.replace(me.role === "branch_head" ? "/persetujuan" : "/beranda");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Memuat…
    </div>
  );
}
