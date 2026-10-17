import type { ReactNode } from 'react';

/** 「딱표」 화면의 버튼. 기본 히트 영역 44px 이상 (difficulty §4.1) */
export function SiteButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'quiet' | 'muted';
  disabled?: boolean;
  className?: string;
  testId?: string;
}) {
  const tone =
    variant === 'primary'
      ? 'bg-[var(--c-primary)] text-[var(--c-primaryInk)] font-bold'
      : variant === 'muted'
        ? 'bg-[var(--c-seatTaken)] text-[var(--c-ink)] font-bold'
        : 'bg-[var(--c-paper)] text-[var(--c-ink)] border border-[var(--c-line)]';
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-[var(--radius)] px-4 text-base active:translate-y-px disabled:opacity-50 ${tone} ${className}`}
    >
      {children}
    </button>
  );
}

/** 「딱표」 화면 안의 흰 패널 */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[var(--radius)] border border-[var(--c-line)] bg-[var(--c-paper)] p-4 ${className}`}
    >
      {children}
    </section>
  );
}

/** 화면 위 팝업 (단계 자체의 알림: 좌석 충돌·수량 0매) */
export function SitePopup({
  children,
  onOk,
  okLabel,
}: {
  children: ReactNode;
  onOk: () => void;
  okLabel: string;
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[var(--c-ink)]/40 p-6"
      role="alertdialog"
    >
      <div className="w-full max-w-xs rounded-[var(--radius)] bg-[var(--c-paper)] p-5 text-center shadow-lg">
        <p className="mb-4 text-base">{children}</p>
        <SiteButton onClick={onOk} className="w-full">
          {okLabel}
        </SiteButton>
      </div>
    </div>
  );
}
