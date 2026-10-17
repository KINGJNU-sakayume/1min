import { useCallback, useState } from 'react';
import { loadContent } from '../content/load';
import { computeResult, type RunResult } from '../engine/result';
import { createRun, type RunSetup } from '../engine/run';
import { parseSeedString, type SeedSpec } from '../engine/seed';
import type { RunState } from '../engine/types';
import { RunScreen } from './game/RunScreen';
import { Home } from './screens/Home';
import { ResultScreen } from './screens/ResultScreen';
import { randomSeedCode } from './seedCode';

type Screen =
  | { kind: 'home' }
  | { kind: 'run'; spec: SeedSpec; setup: RunSetup; key: number }
  | { kind: 'result'; spec: SeedSpec; result: RunResult };

function seedFromUrl(): SeedSpec | null {
  const raw = new URLSearchParams(window.location.search).get('seed');
  return raw ? parseSeedString(raw) : null;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [initial] = useState(seedFromUrl);

  const start = useCallback((spec: SeedSpec) => {
    const setup = createRun(loadContent().engine, spec, { assist: false });
    setScreen({ kind: 'run', spec, setup, key: Date.now() });
  }, []);

  const finish = useCallback(
    (spec: SeedSpec, setup: RunSetup) => (state: RunState) => {
      setScreen({ kind: 'result', spec, result: computeResult(setup.ctx, state) });
    },
    [],
  );

  if (screen.kind === 'run') {
    return (
      <RunScreen
        key={screen.key}
        ctx={screen.setup.ctx}
        muted={false}
        onFinish={finish(screen.spec, screen.setup)}
      />
    );
  }
  if (screen.kind === 'result') {
    const { spec } = screen;
    return (
      <ResultScreen
        result={screen.result}
        onAgain={() => start({ ...spec, code: randomSeedCode() })}
        onRevenge={() => start(spec)}
        onHome={() => setScreen({ kind: 'home' })}
      />
    );
  }
  return <Home initial={initial} onStart={start} />;
}
