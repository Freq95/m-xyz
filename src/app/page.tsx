import Link from 'next/link';
import { ArrowRight, Users, Bell, ShoppingBag, Wrench } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">V</span>
            </div>
            <span className="font-semibold text-lg">Vecinu</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Autentificare
            </Link>
            <Link
              href="/register"
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Înregistrare
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="py-20 px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Comunitatea ta de cartier,
              <br />
              <span className="text-primary">la un click distanță</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Conectează-te cu vecinii, primește alerte locale, cumpără și vinde în cartier,
              descoperă servicii de încredere.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Începe acum
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-secondary/80 transition-colors"
              >
                Află mai multe
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-4 bg-card">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl font-bold text-center mb-12">
              Tot ce ai nevoie pentru cartierul tău
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard
                icon={<Bell className="w-5 h-5" />}
                title="Alerte locale"
                description="Fii la curent cu ce se întâmplă în zona ta. Avarii, incidente, anunțuri importante."
              />
              <FeatureCard
                icon={<ShoppingBag className="w-5 h-5" />}
                title="Marketplace"
                description="Cumpără și vinde local. Fără comisioane, fără bătăi de cap."
              />
              <FeatureCard
                icon={<Wrench className="w-5 h-5" />}
                title="Servicii locale"
                description="Găsește meșteri, bone, menajere recomandate de vecini."
              />
              <FeatureCard
                icon={<Users className="w-5 h-5" />}
                title="Comunitate"
                description="Cunoaște-ți vecinii. Întreabă, ajută, participă la viața cartierului."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold mb-4">Gata să începi?</h2>
            <p className="text-muted-foreground mb-8">
              Înregistrează-te gratuit și conectează-te cu cartierul tău.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Creează cont gratuit
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">V</span>
            </div>
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Vecinu
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Confidențialitate
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Termeni
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-background border border-border">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
