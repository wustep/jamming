// A static drawing (no hooks) as SVG markup, for places that can't mount React: the server's link
// cards, which may not import react-dom/server. Function components are called, host elements are
// written out with React's camelCase attribute names put back into SVG's.

import { Fragment, isValidElement, type ReactNode } from "react";

/** SVG attributes that really are camelCase; every other camelCase prop is kebab-case in SVG. */
const CAMEL = new Set(["viewBox", "preserveAspectRatio", "patternUnits", "patternTransform", "gradientUnits", "gradientTransform", "baseFrequency", "numOctaves", "stdDeviation", "xChannelSelector", "yChannelSelector", "pathLength"]);

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function attrName(prop: string): string {
  if (prop === "className") return "class";
  if (CAMEL.has(prop)) return prop;
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function styleText(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
    .join(";");
}

export function svgString(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return escape(String(node));
  if (Array.isArray(node)) return node.map(svgString).join("");
  if (!isValidElement(node)) return "";
  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  if (node.type === Fragment) return svgString(props.children);
  if (typeof node.type === "function") return svgString((node.type as (p: unknown) => ReactNode)(props));
  if (typeof node.type !== "string") return "";
  let attrs = node.type === "svg" ? ' xmlns="http://www.w3.org/2000/svg"' : "";
  for (const [k, v] of Object.entries(props)) {
    if (k === "children" || k === "key" || k === "ref" || v === undefined || v === null || v === false || typeof v === "function") continue;
    const value = k === "style" && typeof v === "object" ? styleText(v as Record<string, unknown>) : String(v);
    attrs += ` ${attrName(k)}="${escape(value)}"`;
  }
  return `<${node.type}${attrs}>${svgString(props.children)}</${node.type}>`;
}
