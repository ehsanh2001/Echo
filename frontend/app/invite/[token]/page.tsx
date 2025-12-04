"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAcceptWorkspaceInvite } from "@/lib/hooks/useInviteMutations";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: InvitePageProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const { mutate: acceptInvite, isPending } = useAcceptWorkspaceInvite();

  // Unwrap params (Next.js 15+ requirement)
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  // Check authentication
  useEffect(() => {
    const checkAuth = () => {
      const accessToken = localStorage.getItem("access_token");
      const authenticated = !!accessToken;
      setIsAuthenticated(authenticated);
      setIsCheckingAuth(false);

      if (!authenticated && token) {
        // Store token for after login and redirect
        localStorage.setItem("pending_invite_token", token);
        router.push(`/login`);
      }
    };

    if (token) {
      checkAuth();
    }
  }, [token, router]);

  const handleAccept = () => {
    if (!token) return;

    acceptInvite(
      { token },
      {
        onSuccess: (response) => {
          // Store success data for modal in app page
          localStorage.setItem(
            "invite_success",
            JSON.stringify({
              workspaceName:
                response.data.workspace.displayName ||
                response.data.workspace.name,
              channelCount: response.data.channels.length,
            })
          );
          // Clean up token
          localStorage.removeItem("pending_invite_token");
          // Navigate to app
          router.push("/app");
        },
        onError: (error: any) => {
          const errorMessage =
            error?.response?.data?.message ||
            error?.message ||
            "Failed to accept invite";

          // Store error for modal in app page
          localStorage.setItem(
            "invite_error",
            JSON.stringify({
              message: errorMessage,
            })
          );
          // Clean up token
          localStorage.removeItem("pending_invite_token");
          // Navigate to app
          router.push("/app");
        },
      }
    );
  };

  // Show loading while checking auth
  if (isCheckingAuth || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authenticated, will redirect to login (show loading)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">You've been invited!</h1>
          <p className="text-muted-foreground">
            Accept this invitation to join the workspace.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Click below to accept the invitation and join the workspace. You'll
            be added to all public channels automatically.
          </p>

          <Button
            onClick={handleAccept}
            disabled={isPending}
            className="w-full gap-2"
            size="lg"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Accept Invitation
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
