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
    document.title = 'BrainSync — Universal Collaborative Innovation & AI Technical Blueprint Platform';

    // Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'BrainSync helps teams, startups, and open-source projects transform raw proposals into production-ready technical blueprints and task backlogs.';

    // Open Graph Title & Description
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = 'BrainSync — Universal Collaborative Innovation & AI Technical Blueprint Platform';

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
