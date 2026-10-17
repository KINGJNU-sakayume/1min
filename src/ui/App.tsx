import { useCallback, useEffect, useState } from 'react';
import { copy, hasCopy } from '../content/copy';
import { loadContent } from '../content/load';
import { computeResult, type RunResult } from '../engine/result';
import { createRun, type RunSetup } from '../engine/run';
import { parseSeedString, seedString, type SeedSpec } from '../engine/seed';
import type { RunState } from '../engine/types';
import { RunScreen } from './game/RunScreen';
import { isUnlocked, stageOrder } from './progression';
import { Home } from './screens/Home';
import { ResultScreen } from './screens/ResultScreen';
import { randomSeedCode } from './seedCode';
import { buildShareText, shareOrCopy, shareUrl } from './share';
import { store, type Settings } from './storage';

type Screen =
  | { kind: 'home' }
  | { kind: 'run'; spec: SeedSpec; setup: RunSetup; key: number }
  | { kind: 'result'; spec: SeedSpec; setup: RunSetup; result: RunResult };

function fromUrl(): { spec: SeedSpec | null; version: string | null } {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('seed');
  return { spec: raw ? parseSeedString(raw) : null, version: q.get('v') };
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [url] = useState(fromUrl);
  const [settings, setSettings] = useState<Settings>(() => store.profile().settings);
  const content = loadContent().engine;

  useEffect(() => {
    document.documentElement.toggleAttribute('data-reduced-motion', settings.reducedMotion);
  }, [settings.reducedMotion]);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    store.saveSettings(s);
  }, []);

  const start = useCallback(
    (spec: SeedSpec) => {
      const setup = createRun(content, spec, { assist: settings.assist });
      setScreen({ kind: 'run', spec, setup, key: Date.now() });
    },
    [content, settings.assist],
  );

  const finish = useCallback(
    (spec: SeedSpec, setup: RunSetup) => (state: RunState) => {
      const result = computeResult(setup.ctx, state);
      store.recordRun(
        {
          at: new Date().toISOString(),
          seed: setup.ctx.schedule.seedString,
          stageId: spec.stageId,
          level: spec.level,
          titleId: result.titleId,
          outcome: result.outcome,
          remaining: result.remainingTicks,
          stars: result.stars,
          assist: setup.ctx.options.assist,
          contentVersion: content.contentVersion,
        },
        setup.ctx.stage.tutorial === true,
      );
      setScreen({ kind: 'result', spec, setup, result });
    },
    [content.contentVersion],
  );

  if (screen.kind === 'run') {
    return (
      <RunScreen
        key={screen.key}
        ctx={screen.setup.ctx}
        muted={settings.muted}
        onFinish={finish(screen.spec, screen.setup)}
      />
    );
  }
  if (screen.kind === 'result') {
    const { spec, setup, result } = screen;
    const order = stageOrder();
    const next = order[order.indexOf(spec.stageId) + 1];
    const share = async () => {
      // 공유 링크는 사용자가 넣은 시드(파생 시드 아님)로: 받은 쪽도 같은 검증 과정을 거친다
      const text = buildShareText({
        result,
        stage: setup.ctx.stage,
        spec,
        seedString: seedString(spec),
        contentVersion: content.contentVersion,
        url: shareUrl(
          window.location.origin,
          import.meta.env.BASE_URL,
          seedString(spec),
          content.contentVersion,
        ),
        copy,
        has: hasCopy,
      });
      const how = await shareOrCopy(text);
      return copy(
        how === 'share'
          ? 'ui.result.shared'
          : how === 'failed'
            ? 'ui.result.shareFailed'
            : 'ui.result.copied',
      );
    };
    return (
      <ResultScreen
        ctx={setup.ctx}
        result={result}
        code={spec.code}
        onAgain={() => start({ ...spec, code: randomSeedCode() })}
        onRevenge={() => start(spec)}
        onShare={share}
        onNext={
          next && isUnlocked(order, next, store)
            ? () => start({ stageId: next, level: Math.max(1, spec.level), code: randomSeedCode() })
            : null
        }
        onHome={() => setScreen({ kind: 'home' })}
      />
    );
  }
  return (
    <Home
      initial={url.spec}
      versionMismatch={url.version !== null && url.version !== content.contentVersion}
      store={store}
      settings={settings}
      onSettings={updateSettings}
      onStart={start}
    />
  );
}
