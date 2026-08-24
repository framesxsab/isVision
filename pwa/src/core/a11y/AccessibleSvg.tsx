import type { SVGProps } from "react";

interface AccessibleSvgProps extends SVGProps<SVGSVGElement> {
  title?: string;
  decorative?: boolean;
}

export function AccessibleSvg({ title, decorative, children, ...props }: AccessibleSvgProps) {
  if (decorative) {
    return (
      <svg aria-hidden="true" focusable="false" {...props}>
        {children}
      </svg>
    );
  }

  const titleId = title ? `svg-title-${title.replace(/\s+/g, "-").toLowerCase()}` : undefined;

  return (
    <svg role="img" aria-labelledby={titleId} focusable="false" {...props}>
      {title ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  );
}
