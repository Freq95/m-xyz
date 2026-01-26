'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Textarea } from '@/components/ui';
import { createPostSchema, type PostCategory, IMAGE_VALIDATION } from '@/lib/validations/post';
import { AlertTriangle, ShoppingBag, HelpCircle, Calendar, Search, Tag, Image as ImageIcon, X } from 'lucide-react';

const categories: { value: PostCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'ALERT', label: 'Alertă', icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  { value: 'SELL', label: 'Vând', icon: <Tag className="w-4 h-4" />, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  { value: 'BUY', label: 'Cumpăr', icon: <ShoppingBag className="w-4 h-4" />, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'SERVICE', label: 'Serviciu', icon: <Search className="w-4 h-4" />, color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { value: 'QUESTION', label: 'Întrebare', icon: <HelpCircle className="w-4 h-4" />, color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'EVENT', label: 'Eveniment', icon: <Calendar className="w-4 h-4" />, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { value: 'LOST_FOUND', label: 'Pierdut/Găsit', icon: <Search className="w-4 h-4" />, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
];

interface PostFormProps {
  onSuccess?: () => void;
}

export function PostForm({ onSuccess }: PostFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [category, setCategory] = useState<PostCategory | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const isMarketplace = category === 'SELL' || category === 'BUY' || category === 'SERVICE';

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > IMAGE_VALIDATION.MAX_SIZE) {
      setErrors({ image: `Imaginea este prea mare. Mărimea maximă este ${IMAGE_VALIDATION.MAX_SIZE / (1024 * 1024)}MB` });
      return;
    }

    // Validate file type
    if (!IMAGE_VALIDATION.ALLOWED_TYPES.includes(file.type as any)) {
      setErrors({ image: 'Format invalid. Folosește JPG, PNG sau WebP' });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedImage(file);
    setErrors({ ...errors, image: '' });
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);

    if (!category) {
      setErrors({ category: 'Selectează o categorie' });
      return;
    }

    // Validate with Zod
    const validationResult = createPostSchema.safeParse({
      title: title.trim() || undefined,
      body: body.trim(),
      category,
      priceCents: price ? Math.round(parseFloat(price) * 100) : undefined,
      isFree: isMarketplace ? isFree : undefined,
    });

    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach((err) => {
        const path = err.path.join('.');
        newErrors[path] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Use FormData if image is selected, otherwise JSON
      let response;

      if (selectedImage) {
        const formData = new FormData();
        formData.append('title', validationResult.data.title || '');
        formData.append('body', validationResult.data.body);
        formData.append('category', validationResult.data.category);
        if (validationResult.data.priceCents) {
          formData.append('priceCents', validationResult.data.priceCents.toString());
        }
        if (validationResult.data.isFree !== undefined) {
          formData.append('isFree', validationResult.data.isFree.toString());
        }
        formData.append('image', selectedImage);

        response = await fetch('/api/posts', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validationResult.data),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        if (result.details) {
          setErrors(
            Object.fromEntries(
              Object.entries(result.details).map(([key, messages]) => [
                key,
                (messages as string[])[0],
              ])
            )
          );
        } else {
          setGlobalError(result.error || 'A apărut o eroare');
        }
        return;
      }

      // Success - redirect to feed or call callback
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/feed');
        router.refresh();
      }
    } catch {
      setGlobalError('A apărut o eroare de conexiune');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Categorie <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                category === cat.value
                  ? `${cat.color} border-current`
                  : 'border-border hover:border-muted-foreground/50 text-muted-foreground'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
        {errors.category && (
          <p className="mt-1.5 text-xs text-destructive">{errors.category}</p>
        )}
      </div>

      {/* Title (optional) */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-2">
          Titlu <span className="text-muted-foreground">(opțional)</span>
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Adaugă un titlu scurt..."
          maxLength={200}
          error={errors.title}
        />
      </div>

      {/* Body */}
      <div>
        <label htmlFor="body" className="block text-sm font-medium mb-2">
          Conținut <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Descrie detaliat ce vrei să comunici vecinilor tăi..."
          rows={5}
          maxLength={5000}
          error={errors.body}
        />
        <p className="mt-1 text-xs text-muted-foreground text-right">
          {body.length}/5000
        </p>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Fotografie <span className="text-muted-foreground">(opțional, max 1)</span>
        </label>

        {imagePreview ? (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-w-sm h-48 object-cover rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              aria-label="Șterge imaginea"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              {(selectedImage!.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_VALIDATION.ALLOWED_TYPES.join(',')}
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-muted-foreground/50 transition-colors cursor-pointer text-sm"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Adaugă fotografie</span>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG sau WebP, max {IMAGE_VALIDATION.MAX_SIZE / (1024 * 1024)}MB
            </p>
          </div>
        )}

        {errors.image && (
          <p className="mt-1.5 text-xs text-destructive">{errors.image}</p>
        )}
      </div>

      {/* Price (for marketplace categories) */}
      {isMarketplace && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isFree"
              checked={isFree}
              onChange={(e) => {
                setIsFree(e.target.checked);
                if (e.target.checked) setPrice('');
              }}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="isFree" className="text-sm">
              {category === 'BUY' ? 'Negociabil / Oferă preț' : 'Gratuit'}
            </label>
          </div>

          {!isFree && (
            <div>
              <label htmlFor="price" className="block text-sm font-medium mb-2">
                Preț (RON)
              </label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                error={errors.priceCents}
              />
            </div>
          )}
        </div>
      )}

      {/* Global Error */}
      {globalError && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {globalError}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
          className="flex-1"
        >
          Anulează
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={!category || !body.trim()}
          className="flex-1"
        >
          Publică
        </Button>
      </div>
    </form>
  );
}
