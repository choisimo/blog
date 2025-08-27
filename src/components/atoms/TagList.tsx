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
  variant = "outline",
  className = "",
  size = "default",
}: TagListProps) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = tags.slice(0, maxVisible);
  const remainingCount = tags.length - maxVisible;

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-xs",
    lg: "text-sm",
  };

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
          className={`${sizeClasses[size]} whitespace-nowrap`}
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
