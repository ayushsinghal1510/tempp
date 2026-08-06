"use client";

import { useState } from "react";
import ScenarioCarousel from "./ScenarioCarousel";
import Reveal from "./Reveal";

export default function Session() {
  const [active, setActive] = useState(0);

  return (
    <section className="section shell-tight" id="session">
      <Reveal>
        <p className="eyebrow">One room</p>

        <div className="sec-head">
          <h2 className="h2">
            One session. <em>The scenario swaps</em>.
          </h2>
          <p className="lead">
            A configuration picks who the AI plays, what each turn scores, and what you call it.
            Everything else is shared.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <ScenarioCarousel active={active} onSelect={setActive} />
      </Reveal>
    </section>
  );
}
