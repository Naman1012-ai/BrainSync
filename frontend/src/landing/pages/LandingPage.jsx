import React, { useEffect } from 'react';
import { analyticsService } from '../analytics/analyticsService';
import { LandingLayout } from '../layouts/LandingLayout';
import { HeroSection } from '../sections/HeroSection';
import { InteractiveProductPreview } from '../sections/InteractiveProductPreview';
import { CoreFeaturesGrid } from '../sections/CoreFeaturesGrid';
import { AiBlueprintShowcase } from '../sections/AiBlueprintShowcase';
import { ExpandedUseCasesSection } from '../sections/ExpandedUseCasesSection';
import { RealtimePlatformStats } from '../sections/RealtimePlatformStats';
import { ComprehensiveFaqSection } from '../sections/ComprehensiveFaqSection';
import { FinalLandingCtaSection } from '../sections/FinalLandingCtaSection';

export default function LandingPage() {
  useEffect(() => {
    // Dynamic SEO Document Title & Meta Tags
    document.title = 'Convia — Where Ideas Converge into Action.';

    // Meta Description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = 'Convia represents the convergence of different ideas, perspectives, discussions, and decisions into a clear direction that can be acted upon.';
    }

    // Open Graph Title & Description
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.content = 'Convia — Where Ideas Converge into Action.';
    }

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.content = 'Transform team ideas into production-ready technical blueprints, database schemas, and sprint backlogs.';

    // Track Pageview via Analytics Service Layer
    analyticsService.trackPageView('/');
  }, []);

  return (
    <LandingLayout>
      <HeroSection />
      <InteractiveProductPreview />
      <CoreFeaturesGrid />
      <AiBlueprintShowcase />
      <ExpandedUseCasesSection />
      <RealtimePlatformStats />
      <ComprehensiveFaqSection />
      <FinalLandingCtaSection />
    </LandingLayout>
  );
}
