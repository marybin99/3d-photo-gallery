import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
let loader: Promise<TurnstileApi> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;
  loader = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loader = null;
      reject(new Error('방문자 인증을 불러오지 못했습니다.'));
    };
    const timer = window.setTimeout(fail, 20000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loader;
}
export default function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    widget = useRef<string | null>(null);
  const [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let canceled = false;
    onToken('');
    setError('');
    void loadTurnstile()
      .then((api) => {
        if (canceled || !container.current) return;
        widget.current = api.render(container.current, {
          sitekey: siteKey,
          action: 'guestbook',
          size: 'compact',
          callback: (token: string) => {
            onToken(token);
            setError('');
          },
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            setError('방문자 인증에 실패했습니다. 다시 시도해 주세요.');
          },
        });
      })
      .catch(() => {
        if (!canceled) setError('방문자 인증을 불러오지 못했습니다.');
      });
    return () => {
      canceled = true;
      if (widget.current) {
        window.turnstile?.remove(widget.current);
        widget.current = null;
      }
    };
  }, [siteKey, onToken, retry]);
  useEffect(() => {
    if (widget.current) {
      onToken('');
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey, onToken]);
  return (
    <div className="guestbook-verification">
      <div ref={container} />
      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            다시 인증
          </button>
        </p>
      )}
    </div>
  );
}
