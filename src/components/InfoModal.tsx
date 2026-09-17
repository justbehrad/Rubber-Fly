import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { canDismissInfo, type InfoModalDismissal, type InfoModalKind } from '../shared/infoModal';
import type { CircuitData } from '../shared/types';

const fmt = (value: number) => new Intl.NumberFormat('fa-IR').format(value);

export function InfoModal({
  kind,
  circuit,
  onClose,
  onEntered,
}: {
  kind: InfoModalKind;
  circuit: CircuitData | null;
  onClose: () => void;
  onEntered?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  const acknowledged = useRef(false);
  closeRef.current = onClose;
  useEffect(() => {
    const invoker = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    // Register directly before showModal: native cancellation must be stopped
    // synchronously, including on browsers without closedby support.
    const cancel = (event: Event) => {
      event.preventDefault();
      if (canDismissInfo(kind, 'escape')) closeRef.current();
    };
    element?.addEventListener('cancel', cancel);
    element?.showModal();
    if (kind === 'welcome') {
      if (element) element.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
    return () => {
      element?.removeEventListener('cancel', cancel);
      element?.close();
      if (kind === 'welcome') {
        if (acknowledged.current) onEntered?.();
      } else if (invoker?.isConnected) invoker.focus({ preventScroll: true });
    };
  }, [kind, onEntered]);
  const dismiss = (reason: InfoModalDismissal) => {
    if (!canDismissInfo(kind, reason)) return;
    if (kind === 'welcome' && reason === 'continue') acknowledged.current = true;
    onClose();
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop dismissal has native Escape cancellation and keyboard-accessible close/continue buttons.
    <dialog
      ref={dialog}
      className="info-dialog"
      closedby={kind === 'welcome' ? 'none' : 'closerequest'}
      aria-labelledby="dialog-title"
      onClick={(event) => {
        if (event.target === dialog.current) dismiss('backdrop');
      }}
    >
      <div className="dialog-content">
        {kind !== 'welcome' && (
          <button
            type="button"
            className="icon-button dialog-close"
            onClick={() => dismiss('close')}
            aria-label="بستن پنجره"
          >
            <X size={21} />
          </button>
        )}
        <h2 id="dialog-title" ref={heading} tabIndex={kind === 'welcome' ? -1 : undefined}>
          {kind === 'about'
            ? 'مدار واقعی؛ پرواز آرکید.'
            : kind === 'welcome'
              ? 'به Rubber Fly خوش آمدید.'
              : 'اردک را بگیر.'}
        </h2>
        {kind === 'about' ? (
          <>
            <p>
              نورون‌های واقعی MaleCNS سیگنال فرار را می‌سازند. حرکت عادی، فیزیک پرواز و انیمیشن
              بال‌های اردک بخشی از کد بازی‌اند و شبیه‌سازی زیستی پرواز نیستند. بازی دوبعدی و از نمای
              جانبی است؛ بدن قابل‌مشاهده‌ی اردک همان هدف واقعی شماست.
            </p>
            <div className="dialog-stat-row">
              <span>
                <b>{circuit ? fmt(circuit.neurons.length) : '—'}</b>نورون شبیه‌سازی‌شده
              </span>
              <span>
                <b>{circuit ? fmt(circuit.edges.length) : '—'}</b>اتصال واقعی
              </span>
            </div>
            <p>
              قرمز: ورودی‌های بینایی LC16. سفید: شبکه‌ی پیرامونی. قرمز روشن: چهار نورون MDN که خروجی
              آن‌ها جهش فرار و گردش اردک را تغییر می‌دهد. روشنایی، شلیک اخیرِ شبیه‌سازی‌شده است و یک
              انیمیشن ساختگی نیست.
            </p>
            <p>
              به‌طور پیش‌فرض بزرگ‌ترین مدار آماده با تمام نورون‌ها بارگذاری می‌شود: ۶٬۰۰۰ سلول و
              ۱٬۲۷۵٬۹۹۴ اتصال مشاهده‌شده. این کل مغز مگس یا هوشی هم‌سطح انسان نیست. همه‌چیز روی
              دستگاه شما اجرا می‌شود.
            </p>
            <details>
              <summary>فرض‌های مدل و یادداشت منبع</summary>
              <p>
                این داده‌ها موقعیت جسم سلولی و اتصال‌های مشاهده‌شده‌اند، نه بازسازی آکسون‌ها. رفتار
                الکتریکی نورون، بینایی و رمزگشای پرواز ساده‌سازی شده‌اند. برای مختصات مفقود از
                نقطه‌ی مرکزی جایگزین استفاده می‌شود و موارد حذف‌شده در مدل ثبت شده‌اند.
              </p>
              <ul>
                {(circuit?.manifest.assumptions || []).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
            <p className="attribution">
              MaleCNS v1.0 · پروژه‌ی FlyEM در HHMI Janelia، دانشگاه کمبریج، آزمایشگاه زیست‌شناسی
              مولکولی MRC و Google Research. داده‌ها تحت مجوز{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              .
            </p>
            <a
              className="external-link"
              href="https://male-cns.janelia.org/"
              target="_blank"
              rel="noreferrer"
            >
              مجموعه‌داده‌ی اصلی <ArrowUpRight size={15} />
            </a>
          </>
        ) : (
          <>
            <ol className="help-steps">
              <li>
                <strong>جلوتر از اردک نشانه بگیر.</strong> با کلیک، نقطه‌ی هدف قفل می‌شود و ضربه
                حدود ۲۴۰ میلی‌ثانیه بعد فرود می‌آید؛ پس اردک ممکن است کنار برود. نور لحظه‌ای محل
                واقعی برخورد را نشان می‌دهد.
              </li>
              <li>
                <strong>ماوس:</strong> حرکت و کلیک. <strong>لمس:</strong> برای هدف‌گیری بکشید و سپس
                «ضربه» را بزنید. <strong>صفحه‌کلید:</strong> کلیدهای جهت برای هدف‌گیری،
                <kbd>Space</kbd> برای ضربه و <kbd>R</kbd> برای شروع دوباره.
              </li>
              <li>
                <strong>هر بار یک ضربه.</strong> ابزار ضربه کمی بیش از نیم ثانیه پس از کلیک دوباره
                آماده می‌شود. حرکت عادی اردک هم می‌تواند باعث خطا شود.
              </li>
              <li>
                <strong>ذهن کوچک را ببین.</strong> اردک برای حس‌کردن ابزار شما از بینایی
                شبیه‌سازی‌شده استفاده می‌کند. نشانگر را نزدیک‌تر ببرید تا واکنش نورون‌ها را حتی پیش
                از کلیک ببینید.
              </li>
            </ol>
            <button
              type="button"
              className={`primary-button${kind === 'welcome' ? ' play-button' : ''}`}
              onClick={() => dismiss('continue')}
            >
              شروع کنیم <ArrowUpRight size={17} />
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
