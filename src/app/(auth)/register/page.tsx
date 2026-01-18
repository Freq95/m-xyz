'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setFieldErrors({});

    // Basic client-side validation
    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Parolele nu coincid' });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details) {
          const errors: Record<string, string> = {};
          Object.entries(data.details).forEach(([key, value]) => {
            errors[key] = Array.isArray(value) ? value[0] : String(value);
          });
          setFieldErrors(errors);
        }
        throw new Error(data.error || 'A apărut o eroare');
      }

      // Redirect to verification page or feed
      router.push('/verify-email?email=' + encodeURIComponent(formData.email));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Creează cont</h1>
        <p className="text-muted-foreground text-sm">
          Alătură-te comunității tale de cartier.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && !Object.keys(fieldErrors).length && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-1.5">
            Nume complet
          </label>
          <Input
            id="fullName"
            type="text"
            placeholder="Ion Popescu"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            error={fieldErrors.fullName}
            required
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1.5">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="nume@email.ro"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={fieldErrors.email}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1.5">
            Parolă
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Minim 8 caractere"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={fieldErrors.password}
            required
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cel puțin 8 caractere, o literă mare și o cifră
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">
            Confirmă parola
          </label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            error={fieldErrors.confirmPassword}
            required
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Creează cont
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ai deja cont?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Autentifică-te
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Prin crearea contului, accepți{' '}
        <Link href="/terms" className="underline hover:text-foreground">
          Termenii
        </Link>{' '}
        și{' '}
        <Link href="/privacy" className="underline hover:text-foreground">
          Politica de confidențialitate
        </Link>
        .
      </p>
    </div>
  );
}
