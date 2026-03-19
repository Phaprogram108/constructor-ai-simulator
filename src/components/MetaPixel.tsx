'use client';

import { useEffect } from 'react';

const META_PIXEL_ID = '897555616586950';

export default function MetaPixel() {
  useEffect(() => {
    // Avoid double-init
    if (typeof window.fbq === 'function') return;

    // Initialize fbq stub
    const fbq = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fbq as any).callMethod
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fbq as any).callMethod(...args)
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fbq as any).queue.push(args);
    } as unknown as typeof window.fbq;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fbq as any).push = fbq;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fbq as any).loaded = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fbq as any).version = '2.0';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fbq as any).queue = [];

    window.fbq = fbq;
    window._fbq = fbq;

    // Load the external script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    // Init + PageView
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }, []);

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
