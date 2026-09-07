import {
  Bold, Code2, GitBranch, Grid2X2, Heading2, Image, Italic,
  Link, List, Maximize2, Minus, Network, Pin, Plus, Quote, Trash2, X,
  type LucideIcon,
} from 'lucide-react';
import type { ActionId } from './action-definitions';

/** Static imports only: no runtime icon lookup, remote SVG, or all-icons namespace. */
export const ACTION_ICONS = {
  heading: Heading2, bold: Bold, italic: Italic, quote: Quote,
  list: List, code: Code2, link: Link, attachImage: Image, close: X,
  viewList: List, viewFocus: GitBranch, viewMap: Network,
  zoomOut: Minus, resetView: Maximize2, zoomIn: Plus,
  stackGrid: Grid2X2, expandStack: Maximize2, pinStack: Pin, clearStack: Trash2,
} satisfies Record<ActionId, LucideIcon>;
