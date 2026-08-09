import katex from "katex";
import "katex/dist/katex.min.css";

export function Equation({
  latex,
  label,
  block = true,
  className = "",
}: {
  latex: string;
  label: string;
  block?: boolean;
  className?: string;
}) {
  const html = katex.renderToString(latex, {
    displayMode: block,
    throwOnError: false,
    strict: "warn",
    trust: false,
    output: "htmlAndMathml",
  });
  return (
    <div
      className={`overflow-x-auto py-2 ${className}`}
      role="math"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
