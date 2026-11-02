import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { localToday } from '../utils/dateUtils';

const STEPS = 3;

export function Onboarding() {
  const { t } = useTranslation();
  const settings = useAppStore((s) => s.settings);
  const markOnboardingDone = useAppStore((s) => s.markOnboardingDone);
  const openDaily = useAppStore((s) => s.openDaily);
  const [step, setStep] = useState(0);

  if (!settings || settings.onboardingDone) return null;

  const finish = () => void markOnboardingDone();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="mb-4 flex gap-2">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2 className="mb-2 text-xl font-bold">{t('onboarding.welcome')}</h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{t('onboarding.step1')}</p>
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="mb-2 text-xl font-bold">{t('onboarding.step2title')}</h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{t('onboarding.step2')}</p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
              <li><kbd className="rounded border border-[var(--border)] px-1">Ctrl+Shift+Space</kbd> — {t('nav.today')}</li>
              <li><kbd className="rounded border border-[var(--border)] px-1">Ctrl+K</kbd> — {t('commands.title')}</li>
              <li><kbd className="rounded border border-[var(--border)] px-1">Ctrl+Enter</kbd> — {t('commands.completeTask')}</li>
            </ul>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="mb-2 text-xl font-bold">{t('onboarding.step3title')}</h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{t('onboarding.step3')}</p>
          </>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <button type="button" onClick={finish} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            {t('onboarding.skip')}
          </button>
          <div className="flex gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={() => {
                  finish();
                  void openDaily(localToday());
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              >
                {t('nav.today')}
              </button>
            )}
            {step < STEPS - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-[var(--on-accent)]">
                {t('onboarding.next')}
              </button>
            ) : (
              <button type="button" onClick={finish} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-[var(--on-accent)]">
                {t('onboarding.start')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
