"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { homePath, type SessionMe } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const me = await api<SessionMe>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace(homePath(me.role));
    } catch (err) {
      setError(errorMessage(err, "Email atau kata sandi salah"));
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-sm"
      >
        <p className="text-sm text-muted-foreground">PT KSA · Wood Finishing</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Masuk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Biaya operasional teknisi
        </p>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Kata sandi</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <FormError message={error} className="" />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>
        </div>
      </form>
    </main>
  );
}
