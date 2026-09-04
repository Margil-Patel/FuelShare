'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';

function LoginFormContent({ isRegistered }: { isRegistered?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const registered = isRegistered || searchParams.get('registered') === 'true';
    if (registered) {
      setSuccessMessage('Account registered successfully! Please log in below.');
    }
    if (user) {
      router.push('/dashboard');
    }
  }, [searchParams, isRegistered, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.push('/dashboard');
    } catch (err: any) {
      if (err.status === 401) {
        setError('Incorrect email or password. Please check your credentials.');
      } else if (err.status === 503) {
        setError('Network error. Unable to reach backend server.');
      } else {
        setError(err.detail || err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title="Log In to FuelShare" subtitle="Access your dashboard, manage trips, and split fuel costs">
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-xl mb-4">
          ✅ {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorAlert message={error} />}

        <Input
          label="Email Address"
          type="email"
          placeholder="margil@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Log In
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-500">
        Don&apos;t have an account yet?{' '}
        <Link href="/register" className="font-bold text-indigo-600 hover:text-indigo-800">
          Sign up here
        </Link>
      </div>
    </Card>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = searchParams ? React.use(searchParams) : undefined;
  const isRegistered = resolvedSearchParams?.registered === 'true';

  return (
    <div className="max-w-md mx-auto py-12 space-y-6">
      <Suspense fallback={<LoadingSpinner message="Loading login page..." />}>
        <LoginFormContent isRegistered={isRegistered} />
      </Suspense>
    </div>
  );
}
