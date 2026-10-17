import { useState } from 'react';
import { copy } from '../../content/copy';
import { loadContent } from '../../content/load';
import { isValidSeedCode, normalizeSeedCode, type SeedSpec } from '../../engine/seed';
import { randomSeedCode } from '../seedCode';
import { isUnlocked, stageOrder } from '../progression';
import type { Settings, Store } from '../storage';

export function Home({
  initial,
  versionMismatch,
  store,
  settings,
  onSettings,
  onStart,
}: {
  initial: SeedSpec | null;
  versionMismatch: boolean;
  store: Store;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onStart: (spec: SeedSpec) => void;
}) {
  const stages = loadContent().engine.stages;
  const order = stageOrder();
  const tutorialDone = store.profile().tutorialDone;
  const defaultStage =
    initial?.stageId ??
    (tutorialDone ? order.find((id) => !stages.get(id)?.tutorial) : order[0]) ??
    '';
  const [stageId, setStageId] = useState(defaultStage);
  const [level, setLevel] = useState(initial?.level && initial.level > 0 ? initial.level : 1);
  const [code, setCode] = useState(initial?.code ?? randomSeedCode());
  const stage = stages.get(stageId);
  const tutorial = stage?.tutorial === true;
  const valid = isValidSeedCode(code);
  // 공유받은 시드 링크의 스테이지는 잠겨 있어도 바로 할 수 있다 (결정 0002 #27)
  const unlocked = isUnlocked(order, stageId, store) || initial?.stageId === stageId;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 px-5 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))] text-game-ink">
      <header className="flex flex-col gap-2">
        <h1 className="text-6xl font-black tracking-tight">{copy('app.title')}</h1>
        <p className="text-game-muted">{copy('ui.home.tagline')}</p>
      </header>

      {versionMismatch && (
        <p className="rounded-lg bg-game-paper p-3 text-sm text-game-danger">
          {copy('ui.home.versionMismatch')}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-game-muted">{copy('ui.home.stage')}</h2>
        {order.map((id) => {
          const s = stages.get(id);
          if (!s) return null;
          const open = isUnlocked(order, id, store) || initial?.stageId === id;
          const best = store.stage(id).bestTitleId;
          const bestRule = best ? s.results.find((r) => r.id === best) : undefined;
          return (
            <button
              key={id}
              type="button"
              data-testid={`stage-${id}`}
              onClick={() => setStageId(id)}
              aria-pressed={id === stageId}
              className={`flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border-2 bg-game-paper px-4 py-3 text-left ${id === stageId ? 'border-game-ink' : 'border-game-line'} ${open ? '' : 'opacity-60'}`}
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="font-bold">
                  {copy(`stage.${id}.emoji`)} {copy(s.title)}
                </span>
                {s.tutorial && !tutorialDone && (
                  <span className="text-xs font-bold text-game-accent">
                    {copy('ui.home.recommended')}
                  </span>
                )}
              </span>
              <span className="text-sm text-game-muted">
                {open ? copy(`stage.${id}.concept`) : copy('ui.home.locked')}
              </span>
              {bestRule && (
                <span className="text-xs text-game-muted">
                  {copy('ui.home.best', { title: copy(bestRule.title) })}
                </span>
              )}
            </button>
          );
        })}
      </section>

      {!tutorial && (
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
      )}

      {!tutorial && (
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
      )}

      <button
        type="button"
        data-testid="start"
        disabled={!valid || !stage || !unlocked}
        onClick={() => onStart({ stageId, level: tutorial ? 0 : level, code })}
        className="min-h-14 rounded-xl bg-game-accent text-lg font-bold text-game-paper disabled:opacity-50"
      >
        {copy('ui.home.start')}
      </button>

      <section className="flex flex-col gap-1">
        <h2 className="text-sm font-bold text-game-muted">{copy('ui.home.settings')}</h2>
        {(['assist', 'reducedMotion', 'muted'] as const).map((key) => (
          <label
            key={key}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-game-paper px-3"
          >
            <span className="text-sm">{copy(`ui.settings.${key}`)}</span>
            <input
              type="checkbox"
              data-testid={`setting-${key}`}
              className="h-5 w-5 accent-[var(--color-game-ink)]"
              checked={settings[key]}
              onChange={(e) => onSettings({ ...settings, [key]: e.target.checked })}
            />
          </label>
        ))}
      </section>

      <footer className="mt-auto text-xs text-game-muted">{copy('common.parodyNotice')}</footer>
    </main>
  );
}
