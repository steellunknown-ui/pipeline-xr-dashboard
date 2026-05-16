"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

interface PreflightData {
  risk_level: "low" | "medium" | "high";
  reasons: string[];
  recommendation: string;
}

interface PreDeployWarningProps {
  projectId: string;
  source: 'github' | 'zip' | 'manual';
  commitSha?: string;
  onContinue: () => void;
  onCancel: () => void;
  isVisible: boolean;
}

export default function PreDeployWarning({
  projectId,
  source,
  commitSha,
  onContinue,
  onCancel,
  isVisible
}: PreDeployWarningProps) {
  const [preflightData, setPreflightData] = useState<PreflightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (isVisible) {
      checkRisks();
      setAcknowledged(false);
    }
  }, [isVisible, projectId, source, commitSha]);

  const checkRisks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/deployments/preflight-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          source,
          commit_sha: commitSha
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreflightData(data);
      }
    } catch (error) {
      console.error("Preflight check failed:", error);
      setPreflightData({
        risk_level: "medium",
        reasons: ["Unable to analyze deployment risks"],
        recommendation: "Proceed with caution - risk analysis unavailable"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible || loading) {
    return null;
  }

  if (!preflightData) {
    return null;
  }

  const { risk_level, reasons, recommendation } = preflightData;

  const getRiskConfig = () => {
    switch (risk_level) {
      case "high":
        return {
          icon: AlertTriangle,
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          iconColor: "text-red-500",
          titleColor: "text-red-800",
          textColor: "text-red-700"
        };
      case "medium":
        return {
          icon: AlertCircle,
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          iconColor: "text-yellow-500",
          titleColor: "text-yellow-800",
          textColor: "text-yellow-700"
        };
      default:
        return {
          icon: Info,
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          iconColor: "text-blue-500",
          titleColor: "text-blue-800",
          textColor: "text-blue-700"
        };
    }
  };

  const config = getRiskConfig();
  const Icon = config.icon;
  const requiresAcknowledgment = risk_level === "high";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className={`p-6 rounded-t-lg ${config.bgColor} border-b ${config.borderColor}`}>
          <div className="flex items-center space-x-3">
            <Icon className={`h-6 w-6 ${config.iconColor}`} />
            <div>
              <h3 className={`text-lg font-semibold ${config.titleColor}`}>
                Pre-Deploy Risk Analysis
              </h3>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${config.textColor} bg-white bg-opacity-50 mt-1`}>
                {risk_level.toUpperCase()} RISK
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-2">Risk Factors:</h4>
            <ul className="space-y-1">
              {reasons.map((reason, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Recommendation:</h4>
            <p className="text-sm text-gray-700">{recommendation}</p>
          </div>

          {requiresAcknowledgment && (
            <div className="mb-4">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-gray-700">
                  I understand the risks and want to proceed anyway
                </span>
              </label>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onContinue}
              disabled={requiresAcknowledgment && !acknowledged}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}