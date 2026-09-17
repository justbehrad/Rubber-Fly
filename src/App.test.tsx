import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import { InfoModal } from './components/InfoModal';
import { readFileSync } from 'node:fs';

afterEach(() => vi.unstubAllGlobals());

describe('minimal game toolbar', () => {
  it('keeps only Help in the toolbar without removing the game or export controls', () => {
    vi.stubGlobal('location', { search: '?seed=34' });
    const markup = renderToStaticMarkup(<App />);
    const toolbar = markup.match(/<div class="arena-tools">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect([...toolbar.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1])).toEqual([
      'راهنمای بازی',
    ]);
    expect(toolbar.match(/<button/g)).toHaveLength(1);
    for (const removed of ['Share', 'Enable sound', 'Mute sound', 'Expand game'])
      expect(markup).not.toContain(`aria-label="${removed}"`);
    for (const kept of [
      'خانه Rubber Fly',
      'شروع دوباره',
      'توقف بازی',
      'ضبط ویدئو',
      'تصویر',
      'ذهن کوچک',
    ])
      expect(markup).toContain(kept);
    expect(markup).not.toContain('is-expanded');
  });

  it('omits the decorative deck/system/live tags without removing useful feedback', () => {
    vi.stubGlobal('location', { search: '?seed=34' });
    const markup = renderToStaticMarkup(<App />);
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
    for (const tag of ['arena-label', 'live-tag', 'all-on', 'status-dot']) {
      expect(markup).not.toContain(tag);
      expect(source).not.toContain(tag);
      expect(css).not.toContain(tag);
    }
    for (const text of ['FLIGHT DECK', 'All systems on', "'LIVE'"])
      expect(source).not.toContain(text);
    for (const kept of ['ذهن کوچک', 'نورون', 'اتصال واقعی', 'راهنمای بازی', 'در حال بارگذاری مدار'])
      expect(markup).toContain(kept);
    for (const feedback of ['replay-badge', 'brain-loading', 'error-overlay', 'pause-overlay'])
      expect(source).toContain(feedback);
  });

  it('opens welcome instructions on every fresh page entry with one enabled entry action', () => {
    vi.stubGlobal('location', { search: '?seed=34' });
    for (let visit = 0; visit < 2; visit++) {
      const markup = renderToStaticMarkup(<App />);
      const dialog = markup.match(/<dialog[\s\S]*?<\/dialog>/)?.[0] ?? '';
      expect(dialog).toContain('به Rubber Fly خوش آمدید.');
      expect(dialog).toContain('شروع کنیم');
      expect(dialog.match(/<button/g)).toHaveLength(1);
      expect(dialog).not.toContain('disabled');
      expect(dialog).not.toContain('بستن پنجره');
      expect(dialog).toContain('tabindex="-1"');
      expect(dialog).toContain('closedby="none"');
      expect(markup).toContain('Rubber Fly؛ اردک را بگیر، اگر می‌توانی.');
      expect(markup).not.toContain('Fruitfly');
    }
  });

  it('keeps reopened help and about dialogs normally dismissible', () => {
    for (const kind of ['help', 'about'] as const) {
      const markup = renderToStaticMarkup(
        <InfoModal kind={kind} circuit={null} onClose={() => {}} />,
      );
      expect(markup).toContain('بستن پنجره');
      expect(markup).toContain('closedby="closerequest"');
      expect(markup).not.toContain('به Rubber Fly خوش آمدید.');
      if (kind === 'help') expect(markup).toContain('شروع کنیم');
    }
  });

  it('explains swatter sensing and visible neural reactions in both welcome and help', () => {
    for (const kind of ['welcome', 'help'] as const) {
      const markup = renderToStaticMarkup(
        <InfoModal kind={kind} circuit={null} onClose={() => {}} />,
      );
      expect(markup).toContain('ذهن کوچک را ببین.');
      expect(markup).toContain('بینایی');
      expect(markup).toContain('نورون');
      expect(markup).toContain('شروع کنیم');
    }
  });

  it('uses Rubber Fly for browser titles and export branding', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(html.match(/Rubber Fly — اردک را بگیر/g)).toHaveLength(3);
    expect(html).toContain('https://github.com/justbehrad/Rubber-Fly');
    expect(source).toContain("ctx.fillText('Rubber Fly.'");
    expect(source).toContain('rubber-fly-snapshot.png');
    expect(source).toContain('rubber-fly-replay.');
    expect(source).not.toContain('fruitfly');
  });
});
