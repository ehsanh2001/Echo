"use client";

import { AuthGuard } from "@/components/auth";
import { useLogout } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";

/**
 * Workspaces page content
 *
 * Protected content that shows user's workspaces and logout functionality.
 */
function WorkspacesContent() {
  const logoutMutation = useLogout();

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Your Workspaces</h1>
        <Button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          variant="outline"
        >
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">
          🎉 Success! This is a protected page. You can only see this if you're
          logged in.
        </p>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>• Your access token is valid</p>
          <p>• Session persistence is working</p>
          <p>• Try refreshing the page to test session persistence</p>
          <p>• Click "Logout" to test the logout flow</p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-[#99B8F8] bg-[#E8F0FF] p-6">
        <h2 className="font-semibold text-[#6B8DD6] mb-2">Testing Notes:</h2>
        <ul className="space-y-1 text-sm text-[#6B8DD6]">
          <li>
            ✓ AuthGuard automatically refreshed your token if it was expired
          </li>
          <li>✓ You were redirected here after login</li>
          <li>✓ Try opening /app/workspaces in a new tab when logged out</li>
          <li>✓ Token refresh happens automatically on 401 responses</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Workspaces page - Protected route
 *
 * Displays the user's workspaces. This is a protected route that requires authentication.
 * Users will be redirected to /login if not authenticated.
 */
export default function WorkspacesPage() {
  return (
    <AuthGuard>
      <WorkspacesContent />
    </AuthGuard>
  );
}
