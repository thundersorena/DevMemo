import Image from "next/image";
import logoDark from "../../../public/brand/logo-dark.png";
import logoLight from "../../../public/brand/logo-light.png";
import logoMark from "../../../public/brand/logo-mark.png";

const SIZES = {
  sm: 24,
  md: 28,
  lg: 36,
} as const;

export function Logo({
  className = "",
  compact = false,
  size = "md",
  priority = false,
}: {
  className?: string;
  compact?: boolean;
  size?: keyof typeof SIZES;
  priority?: boolean;
}) {
  const height = SIZES[size];
  const wordmarkWidth = Math.round((logoLight.width / logoLight.height) * height);

  return (
    <span className={`inline-flex items-center ${className}`}>
      <span className={compact ? "hidden sm:inline-flex" : "inline-flex"}>
        <Image
          src={logoLight}
          alt="DevMemo"
          height={height}
          width={wordmarkWidth}
          priority={priority}
          className="dark:hidden"
        />
        <Image
          src={logoDark}
          alt="DevMemo"
          height={height}
          width={wordmarkWidth}
          priority={priority}
          className="hidden dark:block"
        />
      </span>
      {compact && (
        <Image
          src={logoMark}
          alt="DevMemo"
          height={height}
          width={height}
          priority={priority}
          className="sm:hidden"
        />
      )}
    </span>
  );
}
