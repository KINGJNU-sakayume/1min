import { useState } from 'react';
import { copy } from '../../content/copy';
import { loadContent } from '../../content/load';
import { isValidSeedCode, normalizeSeedCode, type SeedSpec } from '../../engine/seed';
import { randomSeedCode } from '../seedCode';

export function Home({
  initial,
  onStart,
}: {
  initial: SeedSpec | null;
  onStart: (spec: SeedSpec) => void;
}) {
  const stages = [...loadContent().engine.stages.values()].filter((s) => !s.tutorial);
  const [stageId, setStageId] = useState(initial?.stageId ?? stages[0]?.id ?? '');
  const [level, setLevel] = useState(initial?.level && initial.level > 0 ? initial.level : 1);
  const [code, setCode] = useState(initial?.code ?? randomSeedCode());
  const valid = isValidSeedCode(code);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 px-5 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))] text-game-ink">
      <header className="flex flex-col gap-2">
        <h1 className="text-6xl font-black tracking-tight">{copy('app.title')}</h1>
        <p className="text-game-muted">{copy('ui.home.tagline')}</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-game-muted">{copy('ui.home.stage')}</h2>
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`stage-${s.id}`}
            onClick={() => setStageId(s.id)}
            aria-pressed={s.id === stageId}
            className={`flex min-h-14 flex-col items-start justify-center rounded-xl border-2 bg-game-paper px-4 py-3 text-left ${s.id === stageId ? 'border-game-ink' : 'border-game-line'}`}
          >
            <span className="font-bold">{copy(s.title)}</span>
            <span className="text-sm text-game-muted">{copy(`stage.${s.id}.concept`)}</span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-game-muted">{copy('ui.home.level')}</h2>
        <div className="grid grid-cols-5 gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={l === level}
              data-testid={`level-${l}`}
              onClick={() => setLevel(l)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-lg text-xs ${l === level ? 'bg-game-ink text-game-paper' : 'bg-game-paper text-game-ink'}`}
            >
              <span className="text-lg font-black">{l}</span>
              <span>{copy(`ui.level.${l}`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="seed" className="text-sm font-bold text-game-muted">
          {copy('ui.home.seed')}
        </label>
        <div className="flex gap-2">
          <input
            id="seed"
            data-testid="seed"
            value={code}
            onChange={(e) => setCode(normalizeSeedCode(e.target.value).slice(0, 6))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-game-line bg-game-paper px-3 text-lg font-bold tracking-[0.3em]"
          />
          <button
            type="button"
            onClick={() => setCode(randomSeedCode())}
            className="min-h-11 rounded-lg border border-game-line bg-game-paper px-3 text-sm"
          >
            {copy('ui.home.newSeed')}
          </button>
        </div>
        <p className={`text-xs ${valid ? 'text-game-muted' : 'text-game-danger'}`}>
          {valid ? copy('ui.home.seedHint') : copy('ui.home.invalidSeed')}
        </p>
      </section>

      <button
        type="button"
        data-testid="start"
        disabled={!valid || !stageId}
        onClick={() => onStart({ stageId, level, code })}
        className="min-h-14 rounded-xl bg-game-accent text-lg font-bold text-game-paper disabled:opacity-50"
      >
        {copy('ui.home.start')}
      </button>

      <footer className="mt-auto text-xs text-game-muted">{copy('common.parodyNotice')}</footer>
    </main>
  );
}
