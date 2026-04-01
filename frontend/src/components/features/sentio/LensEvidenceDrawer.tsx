import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LensCard as LensCardData } from "@/services/chat";

type LensEvidenceDrawerProps = {
  card: LensCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function LensEvidenceDrawer({
  card,
  open,
  onOpenChange,
}: LensEvidenceDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="px-5 pb-3 pt-5 text-left">
          <DrawerTitle>{card?.title || "Lens Evidence"}</DrawerTitle>
          <DrawerDescription>
            {card?.summary || "현재 관점을 뒷받침하는 근거를 확인합니다."}
          </DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="max-h-[62vh] px-5 pb-6">
          <div className="space-y-5 pb-4">
            {card?.bullets && card.bullets.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Evidence Notes
                </h4>
                <ul className="space-y-2">
                  {card.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm leading-relaxed"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {card?.detail && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Detail
                </h4>
                <div className="rounded-3xl border border-border/60 bg-background px-4 py-4 text-sm leading-7 text-foreground/90 whitespace-pre-wrap">
                  {card.detail}
                </div>
              </section>
            )}

            {card?.tags && card.tags.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
