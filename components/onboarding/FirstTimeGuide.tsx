"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { OnboardingAction } from "@/lib/onboarding-rules";

interface FirstTimeGuideProps {
  action: OnboardingAction;
}

export function FirstTimeGuide({ action }: FirstTimeGuideProps) {
  const router = useRouter();

  const handlePrimaryAction = () => {
    router.push(action.route);
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Rocket className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-blue-900">{action.title}</CardTitle>
            <CardDescription className="text-blue-700">
              {action.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Button onClick={handlePrimaryAction} className="bg-blue-600 hover:bg-blue-700">
            {action.primaryCTA}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {action.secondaryCTA && (
            <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100">
              {action.secondaryCTA}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}