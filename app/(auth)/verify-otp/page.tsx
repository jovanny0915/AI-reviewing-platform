"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { verifyOtp, resendSignupOtp } from "@/lib/auth/client";

const OTP_LENGTH = 6;

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const redirect = searchParams.get("redirect") ?? "/documents";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>
            Missing email. Please start from{" "}
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
              Sign up
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.length !== OTP_LENGTH) return;
    setLoading(true);
    const result = await verifyOtp(email, otp);
    setLoading(false);
    if (result.ok) {
      router.push(redirect);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleResend() {
    setResendMessage(null);
    setResendLoading(true);
    const result = await resendSignupOtp(email);
    setResendLoading(false);
    if (result.ok) {
      setResendMessage("Verification code sent. Check your email.");
    } else {
      setError(result.error);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Verify your email</CardTitle>
        <CardDescription>
          We sent a 6-digit code to <strong className="text-foreground">{email}</strong>. Enter it below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {resendMessage && (
          <Alert>
            <AlertDescription>{resendMessage}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex justify-center">
            <InputOTP
              maxLength={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              disabled={loading}
            >
              <InputOTPGroup className="gap-1">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={otp.length !== OTP_LENGTH || loading}
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive the code?{" "}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-primary"
            disabled={resendLoading}
            onClick={handleResend}
          >
            {resendLoading ? "Sending…" : "Resend code"}
          </Button>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Wrong email?{" "}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Sign up again
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="pt-6">Loading…</CardContent>
        </Card>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
