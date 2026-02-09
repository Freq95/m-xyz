'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, Input, Textarea, Avatar } from '@/components/ui';
import { useToast } from '@/components/shared/toast';
import { AvatarPreviewModal } from '@/components/shared';

interface NotificationPreferences {
  email_comments: boolean;
  email_alerts: boolean;
  email_digest: 'daily' | 'weekly' | 'never';
  push_enabled: boolean;
}

interface Settings {
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  notificationPreferences: NotificationPreferences;
  language: string;
  neighborhood: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [initialSettings, setInitialSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Track if settings have changed
  const hasChanges = useMemo(() => {
    if (!settings || !initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;

          const settingsData = {
            ...data,
            notificationPreferences: data.notificationPreferences || {
              email_comments: true,
              email_alerts: true,
              email_digest: 'daily',
              push_enabled: true,
            },
          };

          setSettings(settingsData);
          setInitialSettings(JSON.parse(JSON.stringify(settingsData)));
        } else {
          toast.error('Nu s-au putut încărca setările');
        }
      } catch (err) {
        toast.error('Eroare de conexiune');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [toast]);

  // Check username availability
  useEffect(() => {
    if (!settings?.username || settings.username === initialSettings?.username) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/user/username/check?username=${encodeURIComponent(settings.username || '')}`);
        const data = await res.json();
        setUsernameAvailable(data.available ?? false);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [settings?.username, initialSettings?.username]);

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imaginea este prea mare. Mărimea maximă este 5MB');
      e.target.value = '';
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Te rugăm să încarci o imagine');
      e.target.value = '';
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setSettings({
          ...settings!,
          avatarUrl: data.avatarUrl,
        });
        toast.success('Avatar încărcat cu succes');
        // Refresh to update avatar everywhere
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Eroare la încărcarea avatarului');
      }
    } catch {
      toast.error('Eroare de conexiune');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    if (!settings?.avatarUrl) return;

    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
      });

      if (res.ok) {
        setSettings({
          ...settings,
          avatarUrl: null,
        });
        toast.success('Avatar șters cu succes');
        // Refresh to update avatar everywhere
        router.refresh();
      } else {
        toast.error('Eroare la ștergerea avatarului');
      }
    } catch {
      toast.error('Eroare de conexiune');
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!settings || !hasChanges) return;

    // Validate username availability
    if (settings.username !== initialSettings?.username && usernameAvailable === false) {
      toast.error('Username-ul nu este disponibil');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: settings.displayName,
          username: settings.username,
          bio: settings.bio,
          notificationPreferences: settings.notificationPreferences,
        }),
      });

      if (res.ok) {
        const response = await res.json();
        const updated = response.data || response;
        setSettings(updated);
        setInitialSettings(JSON.parse(JSON.stringify(updated)));
        toast.success('Setările au fost actualizate cu succes');
        // Refresh to update name/bio everywhere
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Nu s-au putut salva setările');
      }
    } catch (err) {
      toast.error('Eroare de conexiune. Verifică conexiunea la internet.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update notification preferences
  const updateNotificationPref = (key: keyof NotificationPreferences, value: boolean | string) => {
    if (!settings || !settings.notificationPreferences) return;
    setSettings({
      ...settings,
      notificationPreferences: {
        ...settings.notificationPreferences,
        [key]: value,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4">
          <div className="h-8 bg-muted animate-pulse rounded mb-6" />
          <div className="space-y-4">
            <div className="h-48 bg-muted animate-pulse rounded" />
            <div className="h-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Nu s-au putut încărca setările</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8 pt-16">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="font-semibold">Setări</h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || (usernameAvailable === false)}
            isLoading={isSaving}
          >
            Salvează
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        <div className="space-y-6">
          {/* Profile Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Profil</h2>
            <div className="space-y-4">
              {/* Avatar Upload */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Poză de profil
                </label>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="group relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
                  aria-label="Deschide previzualizare avatar"
                >
                  <Avatar
                    key={settings.avatarUrl || 'no-avatar'}
                    src={settings.avatarUrl || undefined}
                    alt={settings.displayName || settings.email}
                    size="lg"
                    fallback={settings.displayName?.[0] || settings.email[0]}
                    className="transition-opacity group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">
                      Schimbă
                    </span>
                  </div>
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  Apasă pe poză pentru a schimba sau șterge
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Nume afișat
                </label>
                <Input
                  value={settings.displayName || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      displayName: e.target.value,
                    })
                  }
                  placeholder="Cum vrei să fii cunoscut"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Acesta va fi afișat în loc de numele complet
                </p>
              </div>

              {/* Username */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Username
                </label>
                <Input
                  value={settings.username || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      username: e.target.value.toLowerCase(),
                    })
                  }
                  placeholder="username_unic"
                  maxLength={30}
                />
                {checkingUsername && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Verifică disponibilitatea...
                  </p>
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Username disponibil
                  </p>
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <p className="text-xs text-red-600 mt-1">
                    ✗ Username deja folosit
                  </p>
                )}
                {!checkingUsername && usernameAvailable === null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Doar litere mici, cifre și underscore (min. 3 caractere)
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Bio
                </label>
                <Textarea
                  value={settings.bio || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      bio: e.target.value,
                    })
                  }
                  placeholder="Câteva cuvinte despre tine"
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(settings.bio || '').length}/500 caractere
                </p>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="text-sm font-medium mb-1 block text-muted-foreground">
                  Email
                </label>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm">{settings.email}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Emailul nu poate fi modificat momentan
                </p>
              </div>
            </div>
          </Card>

          {/* Notifications Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Notificări Email</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="email_comments"
                  checked={settings.notificationPreferences?.email_comments ?? true}
                  onChange={(e) => updateNotificationPref('email_comments', e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-input"
                />
                <div className="flex-1">
                  <label htmlFor="email_comments" className="text-sm font-medium cursor-pointer">
                    Comentarii la postările mele
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Primește email când cineva comentează la postările tale
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="email_alerts"
                  checked={settings.notificationPreferences?.email_alerts ?? true}
                  onChange={(e) => updateNotificationPref('email_alerts', e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-input"
                />
                <div className="flex-1">
                  <label htmlFor="email_alerts" className="text-sm font-medium cursor-pointer">
                    Alerte în cartierul meu
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Primește email pentru alerte importante din cartier
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="email_digest" className="text-sm font-medium mb-2 block">
                  Sumar email
                </label>
                <select
                  id="email_digest"
                  value={settings.notificationPreferences?.email_digest ?? 'daily'}
                  onChange={(e) => updateNotificationPref('email_digest', e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="daily">Zilnic</option>
                  <option value="weekly">Săptămânal</option>
                  <option value="never">Niciodată</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Primește un rezumat al activității din cartierul tău
                </p>
              </div>
            </div>
          </Card>

          {/* Push Notifications (Coming Soon) */}
          <Card className="p-6 bg-muted/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notificări Push</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                🔜 În curând
              </span>
            </div>
            <div className="space-y-4 opacity-50">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="mt-1 w-4 h-4 rounded border-input"
                />
                <div className="flex-1">
                  <label className="text-sm font-medium">
                    Activează notificări push
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Primește notificări în browser pentru activitate importantă
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Location Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Locație</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Cartier</label>
              {settings.neighborhood ? (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium">{settings.neighborhood.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Aceasta este cartierul tău actual
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Niciun cartier selectat</p>
              )}
            </div>
          </Card>

          {/* Language Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Limbă</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Limba aplicației</label>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium">Română</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mai multe limbi vor fi disponibile în curând
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Avatar Preview Modal */}
        <AvatarPreviewModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          avatarUrl={settings.avatarUrl}
          displayName={settings.displayName}
          email={settings.email}
          onUpload={handleAvatarUpload}
          onRemove={handleRemoveAvatar}
          isUploading={isUploadingAvatar}
        />
      </div>
    </div>
  );
}


