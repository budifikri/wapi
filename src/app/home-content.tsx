"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForms } from "@/components/auth/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Shield, Mail, Zap } from "lucide-react";

export default function HomeContent() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const searchParams = useSearchParams();

  // Check for email verification query parameters and auto-refresh status on load
  useEffect(() => {
    const verifyParam = searchParams.get("email-verified");
    const emailParam = searchParams.get("email");

    // Check current auth status
    checkAuthStatus();
    
    // Show success message if coming from email verification
    if (verifyParam === 'true' && emailParam) {
      // We could show a toast notification here if needed
      console.log(`Email ${emailParam} verified successfully!`);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("http://localhost:3001/users/me", {
        method: "GET",
        credentials: "include", // Important: include cookies
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }
  };

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:3001/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setCurrentUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Welcome Back!</CardTitle>
            <CardDescription>
              You are successfully logged in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="font-medium">{currentUser.name || currentUser.email}</p>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
              {currentUser.avatar && (
                <img
                  src={currentUser.avatar}
                  alt="Profile"
                  className="w-16 h-16 rounded-full mx-auto"
                />
              )}
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 p-4">
      <div className="text-center space-y-4 mb-8">
        <div className="relative w-24 h-24 md:w-32 md:h-32 mx-auto">
          <img
            src="/logo.svg"
            alt="Z.ai Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold">NextAuth with Email Verification</h1>
        <p className="text-muted-foreground max-w-md">
          Secure authentication system with email verification, Google OAuth, and comprehensive API documentation.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8 max-w-4xl w-full">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Email Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Secure your account with email verification to ensure valid user registration
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle className="text-lg">Secure Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              JWT-based authentication with secure cookie handling and token management
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Zap className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Fast API</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Built with Fastify and comprehensive Swagger documentation for easy integration
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <AuthForms onAuthSuccess={handleAuthSuccess} />

      <div className="text-center text-sm text-muted-foreground max-w-md">
        <p>
          This demo includes email verification. After registration, check your email for the verification link.
          For development, emails are logged to the console.
        </p>
        <p className="mt-2">
          <a 
            href="http://localhost:3001/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View API Documentation →
          </a>
        </p>
      </div>
    </div>
  );
}