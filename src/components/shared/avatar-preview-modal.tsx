'use client';

import { useState, useRef } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { Button, Avatar } from '@/components/ui';

interface AvatarPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  displayName: string | null;
  email: string;
  onUpload: (_e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemove: () => Promise<void>;
  isUploading: boolean;
}

export function AvatarPreviewModal({
  isOpen,
  onClose,
  avatarUrl,
  displayName,
  email,
  onUpload,
  onRemove,
  isUploading,
}: AvatarPreviewModalProps) {
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewFile(file);
  };

  const handleSave = async () => {
    if (!previewFile) return;

    // Create a synthetic event with the file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(previewFile);

    const syntheticEvent = {
      target: {
        files: dataTransfer.files,
        value: '',
      },
    } as React.ChangeEvent<HTMLInputElement>;

    await onUpload(syntheticEvent);

    // Cleanup
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    onClose();
  };

  const handleCancel = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    onClose();
  };

  const handleRemove = async () => {
    await onRemove();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {previewFile ? 'Previzualizare avatar' : 'Poză de profil'}
          </h2>
          <button
            onClick={handleCancel}
            disabled={isUploading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Închide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview or Current */}
        <div className="p-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar
              src={previewUrl || avatarUrl || undefined}
              alt={previewFile ? 'Preview' : 'Current'}
              size="xl"
              fallback={displayName?.[0] || email[0]}
            />
            {previewFile && (
              <div className="text-center">
                <p className="text-sm font-medium">Avatar nou</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(previewFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 p-4 border-t">
          {previewFile ? (
            // Preview mode - Show Save/Cancel
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUploading}
                className="flex-1"
              >
                Anulează
              </Button>
              <Button
                onClick={handleSave}
                disabled={isUploading}
                isLoading={isUploading}
                className="flex-1"
              >
                Salvează
              </Button>
            </div>
          ) : (
            // Default mode - Show Upload/Remove
            <>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Încarcă avatar nou
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Șterge avatar
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
