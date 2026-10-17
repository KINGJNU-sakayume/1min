import { copy } from '../content/copy';

export function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold">{copy('app.title')}</h1>
      <p className="text-slate-600">{copy('app.tagline')}</p>
      <footer className="mt-8 text-xs text-slate-500">{copy('common.parodyNotice')}</footer>
    </main>
  );
}
