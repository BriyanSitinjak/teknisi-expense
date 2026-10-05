"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingScreen } from "@/components/app-ui";
import { api } from "@/lib/api";
import { homePath, type SessionMe } from "@/lib/constants";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    api<SessionMe>("/api/me")
      .then((me) => router.replace(homePath(me.role)))
      .catch(() => router.replace("/login"));
  }, [router]);

  return <LoadingScreen />;
}
