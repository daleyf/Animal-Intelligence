import { formatDistanceToNow, parseISO } from "date-fns";

export function formatRelativeDate(isoString: string): string {
  try {
    return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
  } catch {
    return "";
  }
}
