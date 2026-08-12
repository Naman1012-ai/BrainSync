import React, { useEffect } from 'react';
import { analyticsService } from '../analytics/analyticsService';
import { LandingLayout } from '../layouts/LandingLayout';
import { HeroSection } from '../sections/HeroSection';
import { TrustSection } from '../sections/TrustSection';
import { FirstHourSection } from '../sections/FirstHourSection';
import { ToolComparisonSection } from '../sections/ToolComparisonSection';
import { ChaosToClaritySection } from '../sections/ChaosToClaritySection';
import { BrainSyncDifferenceSection } from '../sections/BrainSyncDifferenceSection';
import { InteractiveWorkflowTimeline } from '../sections/InteractiveWorkflowTimeline';
import { InteractiveProductPreview } from '../sections/InteractiveProductPreview';
import { CoreFeaturesGrid } from '../sections/CoreFeaturesGrid';
import { AiBlueprintShowcase } from '../sections/AiBlueprintShowcase';
import { TeamCollaborationSection } from '../sections/TeamCollaborationSection';
import { ExpandedUseCasesSection } from '../sections/ExpandedUseCasesSection';
import { LivePublicIdeasFeed } from '../sections/LivePublicIdeasFeed';
import { TrendingMvpsSection } from '../sections/TrendingMvpsSection';
import { RealtimePlatformStats } from '../sections/RealtimePlatformStats';
import { CommunityHighlightsSection } from '../sections/CommunityHighlightsSection';
import { SecurityReliabilitySection } from '../sections/SecurityReliabilitySection';
import { TestimonialsCarousel } from '../sections/TestimonialsCarousel';
import { SuccessStoriesSection } from '../sections/SuccessStoriesSection';
import { ComprehensiveFaqSection } from '../sections/ComprehensiveFaqSection';
import { PricingPreparationSection } from '../sections/PricingPreparationSection';
import { RoadmapSection } from '../sections/RoadmapSection';
import { FinalLandingCtaSection } from '../sections/FinalLandingCtaSection';

export default function LandingPage() {
  useEffect(() => {
    // Dynamic SEO Document Title & Meta Tags
    document.title = 'BrainSync — Decide What to Build Before Everyone Else';

    // Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = 'BrainSync helps hackathon teams transform scattered ideas into one winning project in minutes—not hours. Real-time proposal collection, peer refinement, democratic voting, and AI technical blueprints.';

    // Open Graph Title & Description
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = 'BrainSync — Decide What to Build Before Everyone Else';

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.content = 'BrainSync helps hackathon teams transform scattered ideas into one winning project in minutes—not hours.';

    // Track Pageview via Analytics Service Layer
    analyticsService.trackPageView('/');
  }, []);

  return (
    <LandingLayout>
      <HeroSection />
      <TrustSection />
      <FirstHourSection />
      <ToolComparisonSection />
      <ChaosToClaritySection />
      <BrainSyncDifferenceSection />
      <InteractiveWorkflowTimeline />
      <InteractiveProductPreview />
      <CoreFeaturesGrid />
      <AiBlueprintShowcase />
      <TeamCollaborationSection />
      <ExpandedUseCasesSection />
      <LivePublicIdeasFeed />
      <TrendingMvpsSection />
      <RealtimePlatformStats />
      <CommunityHighlightsSection />
      <SecurityReliabilitySection />
      <TestimonialsCarousel />
      <SuccessStoriesSection />
      <ComprehensiveFaqSection />
      <PricingPreparationSection />
      <RoadmapSection />
      <FinalLandingCtaSection />
    </LandingLayout>
  );
}
