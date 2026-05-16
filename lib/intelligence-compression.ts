import { type OperatorFocusLevel } from "./deployment-focus-level";

export type SectionVisibility = {
    summary: boolean;
    prediction: boolean;
    memory: boolean;
    trustSignals: boolean;
    confidence: boolean;
    envDrift: boolean;
    decision: boolean;
    fixAssistant: boolean;
};

export function deriveIntelligenceVisibility(
    focusLevel: OperatorFocusLevel | "WATCH"
): SectionVisibility {
    // HIGH_ATTENTION: Show everything
    if (focusLevel === "HIGH_ATTENTION") {
        return {
            summary: true,
            prediction: true,
            memory: true,
            trustSignals: true,
            confidence: true,
            envDrift: true,
            decision: true,
            fixAssistant: true,
        };
    }

    // FOCUS: Show summary, prediction, trust, confidence, decision
    if (focusLevel === "FOCUS") {
        return {
            summary: true,
            prediction: true,
            memory: false,
            trustSignals: true,
            confidence: true,
            envDrift: false,
            decision: true,
            fixAssistant: false, // Fix Assistant only available on HIGH_ATTENTION or failed states typically
        };
    }

    // WATCH: Show summary, prediction
    if (focusLevel === "WATCH") {
        return {
            summary: true,
            prediction: true,
            memory: false,
            trustSignals: false,
            confidence: false,
            envDrift: false,
            decision: false,
            fixAssistant: false,
        };
    }

    // STABLE: Show summary only
    return {
        summary: true,
        prediction: false,
        memory: false,
        trustSignals: false,
        confidence: false,
        envDrift: false,
        decision: false,
        fixAssistant: false,
    };
}
