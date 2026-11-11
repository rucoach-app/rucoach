"use client"

import { cn } from "@/lib/utils"

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
  showValue?: boolean
  variant?: "default" | "primary"
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  className,
  children,
  showValue = true,
  variant = "primary",
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = Math.min(Math.max(value / max, 0), 1)
  const offset = circumference - progress * circumference

  return (
    <div
      className={cn("relative inline-flex items-center justify-center overflow-visible", className)}
      style={{ width: size, height: size }}
    >
      <svg
        className="transform -rotate-90 overflow-visible"
        width={size}
        height={size}
      >
        {/* Background track circle with very low opacity */}
        <circle
          className="text-primary/10"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle with smooth glow shadow */}
        <circle
          className={cn(
            "transition-all duration-300 ease-out",
            variant === "primary" ? "text-primary" : "text-muted-foreground"
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            filter: variant === "primary" ? "drop-shadow(0 0 10px hsl(var(--primary) / 0.55))" : "none",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {children || (showValue && (
          <span className="text-2xl font-black tabular-nums">{Math.round(progress * 100)}%</span>
        ))}
      </div>
    </div>
  )
}
