"use client";

import { HelpCircle } from "lucide-react";
import { openGuidedTour } from "./GuidedTour";

export default function TourTrigger() {
  return (
    <button
      type="button"
      onClick={openGuidedTour}
      aria-label="Take the tour"
      title="Take the tour"
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}
