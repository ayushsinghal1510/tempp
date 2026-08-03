"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password input with a show/hide toggle.
 *
 * One component rather than the same eye button pasted into five forms
 * (/login, /practice/login, /practice/signup, /educator/login, /nimc/login),
 * which all render an identical field. The styling is copied from what those
 * forms already used, so swapping them over is not meant to change how any of
 * them look — only to add the button.
 *
 * The toggle is `type="button"`. Inside a form a bare <button> defaults to
 * `submit`, so without that attribute revealing your password would attempt a
 * login with it.
 *
 * `autoComplete` is required rather than defaulted: the correct value differs
 * between signing in ("current-password") and signing up ("new-password"), and
 * a wrong default is the kind of thing password managers get quietly wrong.
 */
export default function PasswordField({
  id = "password",
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
  minLength,
  required = true,
  label = "Password",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  label?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // pr-10 leaves room for the button; without it a long password runs
          // underneath the icon.
          className="w-full rounded-lg border border-line bg-card px-3 py-2 pr-10 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // The label says what the button DOES, which is what a screen reader
          // announces; `aria-pressed` carries the current state.
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-ink focus:outline-none focus-visible:text-ink"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
