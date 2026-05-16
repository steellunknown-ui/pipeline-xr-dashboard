import { Activity, Shield, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { type OperatorState } from "@/lib/deployment-operator-state";

interface OperatorStateHUDProps {
    state: OperatorState | null;
}

export function OperatorStateHUD({ state }: OperatorStateHUDProps) {
    if (!state) return null;

    let Icon = Activity;
    let colorStyles = "bg-slate-50 border-slate-200 text-slate-700";
    let iconColor = "text-slate-500";
    let accentBorder = "border-slate-300";

    switch (state.mode) {
        case "RUNNING":
            Icon = Loader2;
            colorStyles = "bg-blue-50/50 border-blue-200 text-slate-800";
            iconColor = "text-blue-500";
            accentBorder = "border-blue-200";
            break;
        case "FAILED":
            Icon = AlertCircle;
            colorStyles = "bg-red-50/30 border-red-200 text-slate-800";
            iconColor = "text-red-500";
            accentBorder = "border-red-200";
            break;
        case "RECOVERING":
            Icon = Activity;
            colorStyles = "bg-amber-50/50 border-amber-200 text-slate-800";
            iconColor = "text-amber-500";
            accentBorder = "border-amber-200";
            break;
        case "STABLE":
            Icon = Shield;
            colorStyles = "bg-emerald-50/30 border-emerald-200 text-slate-800";
            iconColor = "text-emerald-500";
            accentBorder = "border-emerald-200";
            break;
        case "IDLE":
            Icon = Activity;
            colorStyles = "bg-slate-50/50 border-slate-200 text-slate-600";
            iconColor = "text-slate-400";
            accentBorder = "border-slate-200";
            break;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 text-sm tracking-wide uppercase">Operator State</h3>
            </div>

            <div className={`p-4 rounded-lg border ${colorStyles} shadow-sm transition-all duration-300`}>
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${state.mode === 'RUNNING' ? 'animate-spin' : ''}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>

                    <div className="flex-1">
                        <h4 className="font-semibold text-base mb-2">{state.headline}</h4>

                        {state.signals.length > 0 && (
                            <ul className="space-y-1.5 mb-4">
                                {state.signals.map((signal, idx) => (
                                    <li key={idx} className="flex gap-2 text-sm opacity-90 text-slate-700">
                                        <span className={`opacity-60 ${iconColor}`}>•</span>
                                        <span>{signal}</span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className={`mt-3 pt-3 border-t ${accentBorder}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm font-medium opacity-90 text-slate-800">
                                <span className="uppercase text-[11px] tracking-wider font-bold opacity-60">Recommended Focus:</span>
                                <span>{state.recommendedFocus}</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
