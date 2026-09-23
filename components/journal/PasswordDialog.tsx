"use client";

import { useEffect, useState } from "react";
import { MdLockOutline } from "react-icons/md";

// Pops up when someone presses Edit or New entry without being logged in.
export function PasswordDialog({
  action,
  onSuccess,
  onClose,
}: {
  action: string; // e.g. "edit this entry"
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const res = await fetch("/api/journal/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          if (res.ok) return onSuccess();
          setError((await res.json().catch(() => ({}))).error || "Couldn't log in.");
          setBusy(false);
        }}
      >
        <MdLockOutline className="mb-3 text-3xl text-primary" />
        <h2 id="pw-title" className="mb-1 text-xl font-medium">
          Password needed
        </h2>
        <p className="mb-5 text-sm text-gray-600">Enter the password to {action}.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-primary"
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!password || busy}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
