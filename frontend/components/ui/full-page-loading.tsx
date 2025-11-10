/**
 * Full-page loading spinner component
 *
 * Displays a centered loading spinner that covers the entire viewport.
 * Used during authentication checks and other full-page loading states.
 *
 * @example
 * ```typescript
 * <FullPageLoading />
 * ```
 */
export function FullPageLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#99B8F8] border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
