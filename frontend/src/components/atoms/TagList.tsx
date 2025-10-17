import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TagListProps {
  tags: string[];
  maxVisible?: number;
  showIcon?: boolean;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function TagList({
  tags,
  maxVisible = 2,
  showIcon = true,
  variant = "secondary",
  className = "",
  size = "default",
}: TagListProps) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 rounded-full",
    default: "text-xs px-2.5 py-0.5 rounded-full",
    lg: "text-sm px-3 py-1 rounded-full",};

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    default: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {showIcon && <Tag className={iconSizes[size]} />}
      {visibleTags.map((tag) => (
        <Badge
          key={tag}
          variant={variant}
          className={`${sizeClasses[size]} whitespace-nowrap bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200`}
        >
          {tag}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <span className={`${sizeClasses[size]} text-muted-foreground`}>
          +{remainingCount}
        </span>
      )}
    </div>
  );
}
