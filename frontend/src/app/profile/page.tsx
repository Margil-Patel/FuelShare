'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { updateUserProfileApi } from '@/lib/api/user';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setLoading(true);
    try {
      await updateUserProfileApi({ name, phone });
      await refreshUser();
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Account Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your contact information and preferences.</p>
        </div>

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold rounded-xl">
            ✅ {success}
          </div>
        )}

        {error && <ErrorAlert message={error} />}

        <Card title="Personal Details" subtitle={`User ID #${user?.id}`}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              type="email"
              value={user?.email || ''}
              disabled
              helperText="Email address cannot be changed."
            />

            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
            />

            <div className="text-xs text-slate-400 pt-2">
              Account created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button type="button" variant="danger" size="sm" onClick={logout}>
                Log Out
              </Button>

              <Button type="submit" isLoading={loading}>
                Save Profile
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
