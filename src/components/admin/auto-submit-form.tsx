"use client";

import {
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  useRef,
} from "react";

type AutoSubmitFormProps = ComponentPropsWithoutRef<"form"> & {
  debounceMs?: number;
};

function formSignature(form: HTMLFormElement) {
  const entries = Array.from(new FormData(form).entries())
    .filter(([key]) => key !== "__auto_submit")
    .map(([key, value]) => [key, String(value)]);

  return new URLSearchParams(entries).toString();
}

function immediateTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLSelectElement ||
    target instanceof HTMLInputElement &&
      ["checkbox", "radio"].includes(target.type)
  );
}

function ignoredTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement &&
    ["button", "file", "hidden", "reset", "submit"].includes(target.type)
  );
}

export function AutoSubmitForm({
  children,
  debounceMs = 350,
  onChange,
  ...props
}: AutoSubmitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastSignatureRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSubmit(event: ChangeEvent<HTMLFormElement>) {
    onChange?.(event);

    if (event.defaultPrevented || ignoredTarget(event.target)) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const delay = immediateTarget(event.target) ? 0 : debounceMs;
    timerRef.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) {
        return;
      }

      const signature = formSignature(form);
      if (signature === lastSignatureRef.current) {
        return;
      }

      lastSignatureRef.current = signature;
      form.requestSubmit();
    }, delay);
  }

  return (
    <form {...props} ref={formRef} onChange={scheduleSubmit}>
      {children}
      <button className="sr-only" type="submit">
        Apply filters
      </button>
    </form>
  );
}