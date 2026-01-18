import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal header */}
      <header className="p-4">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">V</span>
          </div>
          <span className="font-semibold">Vecinu</span>
        </Link>
      </header>

      {/* Auth content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      {/* Minimal footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Vecinu
      </footer>
    </div>
  );
}
