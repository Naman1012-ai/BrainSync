/**
 * BrainSync Analytics Service Layer
 * Supports Google Analytics (GA4), PostHog, Mixpanel, Plausible, and Microsoft Clarity.
 * Configured via Vite Environment Variables (No hardcoded credentials).
 */

class AnalyticsService {
  constructor() {
    this.initialized = false;
    this.gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    this.posthogKey = import.meta.env.VITE_POSTHOG_KEY;
    this.mixpanelToken = import.meta.env.VITE_MIXPANEL_TOKEN;
    this.plausibleDomain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;
    this.clarityId = import.meta.env.VITE_CLARITY_ID;
  }

  init() {
    if (this.initialized || typeof window === 'undefined') return;

    // 1. Google Analytics (GA4)
    if (this.gaId) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', this.gaId, { send_page_view: false });
      this.gtag = gtag;
    }

    // 2. Plausible Analytics
    if (this.plausibleDomain) {
      const script = document.createElement('script');
      script.defer = true;
      script.setAttribute('data-domain', this.plausibleDomain);
      script.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(script);
    }

    // 3. Microsoft Clarity
    if (this.clarityId) {
      (function (c, l, a, r, i, t, y) {
        c[a] =
          c[a] ||
          function () {
            (c[a].q = c[a].q || []).push(arguments);
          };
        t = l.createElement(r);
        t.async = 1;
        t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', this.clarityId);
    }

    this.initialized = true;
  }

  trackPageView(path) {
    if (!this.initialized) this.init();

    // GA4 PageView
    if (this.gtag && this.gaId) {
      this.gtag('event', 'page_view', {
        page_path: path,
      });
    }
  }

  trackEvent(eventName, properties = {}) {
    if (!this.initialized) this.init();

    // GA4 Event
    if (this.gtag && this.gaId) {
      this.gtag('event', eventName, properties);
    }
  }
}

export const analyticsService = new AnalyticsService();
