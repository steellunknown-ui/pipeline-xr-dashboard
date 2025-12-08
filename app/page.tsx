import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { Greetings } from "@/components/home/Greetings";
import { AboutSection } from "@/components/home/AboutSection";
import { WhyPipelineXR } from "@/components/home/WhyPipelineXR";
import { FeaturesGrid } from "@/components/home/FeaturesGrid";
import { HowItWorks } from "@/components/home/HowItWorks";
import { DeploymentTypes } from "@/components/home/DeploymentTypes";
import { Testimonials } from "@/components/home/Testimonials";
import { FinalCTA } from "@/components/home/FinalCTA";
import { DarkThemeBackground } from "@/components/home/DarkThemeBackground";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <DarkThemeBackground />
      <Navbar />
      <Hero />
      <div className="relative w-full">
        <Greetings />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <AboutSection />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <WhyPipelineXR />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <FeaturesGrid />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <HowItWorks />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <DeploymentTypes />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <Testimonials />
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <FinalCTA />
      </div>
      <Footer />
    </main>
  );
}
