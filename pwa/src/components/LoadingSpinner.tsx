interface LoadingSpinnerProps {
  label?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-5 h-5 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
};

export function LoadingSpinner({ label = "Loading", size = "md" }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <div
        className={`${sizes[size]} border-gray-600 border-t-primary-400 rounded-full motion-safe:animate-spin`}
        aria-hidden="true"
      />
      {label ? (
        <>
          <span className="text-gray-400 text-sm">{label}</span>
          <span className="sr-only">{label}, please wait.</span>
        </>
      ) : null}
    </div>
  );
}
