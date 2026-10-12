import { createElement as h, Fragment } from "react";
import { describe, expect, it } from "vitest";
import { AnimalPortrait } from "./AnimalPortrait";
import { svgString } from "./svgString";

describe("svgString", () => {
  it("writes SVG attribute names and calls components", () => {
    const Dot = ({ r }: { r: number }) => h("circle", { r, strokeWidth: 2, fillOpacity: "0.5" });
    const out = svgString(
      h(
        "svg",
        { viewBox: "0 0 10 10", className: "x", style: { overflow: "visible", strokeLinecap: "round" } },
        h(Fragment, null, h(Dot, { r: 3 }), false, null, h("text", { textAnchor: "middle" }, 'a < "b"')),
      ),
    );
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" class="x" style="overflow:visible;stroke-linecap:round"><circle r="3" stroke-width="2" fill-opacity="0.5"></circle><text text-anchor="middle">a &lt; &quot;b&quot;</text></svg>',
    );
  });

  it("draws a portrait in plain SVG", () => {
    const out = svgString(h(AnimalPortrait, { animal: "fox", size: 100 }));
    expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 0 180 170" width="100"')).toBe(true);
    expect(out).toContain("<path");
    expect(out).not.toMatch(/strokeWidth=|fillOpacity=|strokeLinecap=/);
  });
});
