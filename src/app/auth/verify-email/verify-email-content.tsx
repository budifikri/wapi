"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("No verification token provided");
      setIsLoading(false);
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await fetch(`http://localhost:3001/auth/verify-email?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Email verification failed");
      }

      setSuccess(data.message);
      setVerifiedUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
            <CardTitle>Verifying Your Email</CardTitle>
            <CardDescription>
              Please wait while we verify your email address...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              We couldn't verify your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Possible reasons:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>The verification link has expired</li>
                <li>The link has already been used</li>
                <li>The link is invalid or corrupted</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to Home
                </Button>
              </Link>
              <Link href="/?tab=verify" className="w-full">
                <Button variant="ghost" className="w-full">
                  Request New Verification Email
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Email Verified Successfully!</CardTitle>
          <CardDescription>
            Your email address has been verified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
          
          {verifiedUser && (
            <div className="text-center space-y-2 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium">Account Details:</p>
              <p className="text-sm">{verifiedUser.name || verifiedUser.email}</p>
              <p className="text-sm text-muted-foreground">{verifiedUser.email}</p>
              <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span>Email Verified</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-center text-muted-foreground">
              You can now log in to your account with your credentials.
            </p>
            <Link href="/" className="w-full">
              <Button className="w-full">
                Continue to Login
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <Link 
              href="http://localhost:3001/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              View API Documentation
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}