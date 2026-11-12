"use client";

import { useState } from "react";

/**
 * Segmented control over two server-rendered lists. Only segments that have
 * content are passed in; with a single one there is no control, just the list.
 */
export function ProfileTabs({
  helps,
  requests,
  helpsLabel,
  requestsLabel,
}: {
  helps: React.ReactNode | null;
  requests: React.ReactNode | null;
  helpsLabel: string;
  requestsLabel: string;
}) {
  const [active, setActive] = useState<"helps" | "requests">(helps ? "helps" : "requests");

  if (helps && !requests) return <div>{helps}</div>;
  if (requests && !helps) return <div>{requests}</div>;
  if (!helps && !requests) return null;

  return (
    <div>
      <div role="tablist" className="segmented">
        <button type="button" role="tab" aria-selected={active === "helps"} onClick={() => setActive("helps")}>
          {helpsLabel}
        </button>
        <button type="button" role="tab" aria-selected={active === "requests"} onClick={() => setActive("requests")}>
          {requestsLabel}
        </button>
      </div>
      <div className="mt-4" role="tabpanel">
        {active === "helps" ? helps : requests}
      </div>
    </div>
  );
}
