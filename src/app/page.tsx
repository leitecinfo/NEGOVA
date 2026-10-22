import { Navbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { ProductStorySection } from "@/components/landing/product-story-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { BusinessTypesSection } from "@/components/landing/business-types-section";
import { RealControlSection } from "@/components/landing/real-control-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustSection } from "@/components/landing/trust-section";
import { FaqLandingSection } from "@/components/landing/faq-landing-section";
import { BlogLandingSection } from "@/components/landing/blog-landing-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { BusinessDirectorySection } from "@/components/landing/business-directory-section";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden w-full">
      <Navbar />
      <main className="overflow-x-hidden w-full">
        <HeroSection />
        <ProductStorySection />
        <HowItWorksSection />
        <BusinessTypesSection />
        <RealControlSection />
        <PricingSection />
        <TrustSection />
        <FaqLandingSection />
        <BlogLandingSection />
        <FinalCtaSection />
        <BusinessDirectorySection />
      </main>
      <Footer />
    </div>
  );
}


