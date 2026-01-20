'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Textarea } from '@/components/ui';
import { createPostSchema, type PostCategory } from '@/lib/validations/post';
import { AlertTriangle, ShoppingBag, HelpCircle, Calendar, Search, Tag } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [category, setCategory] = useState<PostCategory | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);

  const isMarketplace = category === 'SELL' || category === 'BUY' || category === 'SERVICE';

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
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validationResult.data),
      });

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
