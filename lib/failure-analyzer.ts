interface FailureRule {
  pattern: RegExp;
  type: string;
  confidence: number;
  shortReason: string;
  detailedReason: string;
  probableCause: string;
}

const FAILURE_RULES: FailureRule[] = [
  {
    pattern: /module not found|cannot find module|cannot resolve/i,
    type: 'BUILD_ERROR',
    confidence: 0.9,
    shortReason: 'Missing dependency or module',
    detailedReason: 'The build process failed because a required module or dependency could not be found. This usually happens when a package is not installed or the import path is incorrect.',
    probableCause: 'Missing npm package or incorrect import statement'
  },
  {
    pattern: /npm err!|yarn error|pnpm err/i,
    type: 'INSTALL_ERROR',
    confidence: 0.85,
    shortReason: 'Package installation failed',
    detailedReason: 'The package manager (npm/yarn/pnpm) encountered an error while installing dependencies. This could be due to network issues, version conflicts, or corrupted package files.',
    probableCause: 'Package manager installation failure'
  },
  {
    pattern: /missing environment variable|env.*not.*defined|undefined.*env/i,
    type: 'ENV_ERROR',
    confidence: 0.9,
    shortReason: 'Missing environment variables',
    detailedReason: 'The application requires environment variables that are not defined. These variables are needed for configuration, API keys, or database connections.',
    probableCause: 'Required environment variables not set'
  },
  {
    pattern: /permission denied|eacces|access denied/i,
    type: 'PERMISSION_ERROR',
    confidence: 0.8,
    shortReason: 'File permission error',
    detailedReason: 'The deployment process does not have sufficient permissions to read, write, or execute required files or directories.',
    probableCause: 'Insufficient file system permissions'
  },
  {
    pattern: /port.*already.*use|eaddrinuse|address already in use/i,
    type: 'PORT_ERROR',
    confidence: 0.9,
    shortReason: 'Port already in use',
    detailedReason: 'The application cannot start because the specified port is already being used by another process.',
    probableCause: 'Port conflict with existing service'
  },
  {
    pattern: /syntax error|unexpected token|parse error/i,
    type: 'SYNTAX_ERROR',
    confidence: 0.85,
    shortReason: 'Code syntax error',
    detailedReason: 'The code contains syntax errors that prevent it from being parsed or compiled correctly.',
    probableCause: 'Invalid JavaScript/TypeScript syntax'
  },
  {
    pattern: /timeout|timed out|connection timeout/i,
    type: 'TIMEOUT_ERROR',
    confidence: 0.7,
    shortReason: 'Operation timeout',
    detailedReason: 'A network operation or build process took too long to complete and was terminated.',
    probableCause: 'Network connectivity or performance issues'
  }
];

export interface DeploymentAnalysis {
  failure_type: string;
  short_reason: string;
  detailed_reason: string;
  probable_cause: string;
  fix_steps: string[];
  confidence: number;
}

export function analyzeFailure(logs: string[], source: string): DeploymentAnalysis {
  const logText = logs.join(' ').toLowerCase();
  
  // Check if logs are empty
  if (!logs.length || logText.trim() === '') {
    return {
      failure_type: 'UNKNOWN_ERROR',
      short_reason: 'No error logs available',
      detailed_reason: 'The deployment failed but no error logs were captured. This could indicate a system-level failure or logging configuration issue.',
      probable_cause: 'Missing or incomplete logging',
      fix_steps: generateFixSteps('UNKNOWN_ERROR', source),
      confidence: 0.3
    };
  }

  // Apply rules in order of confidence
  for (const rule of FAILURE_RULES.sort((a, b) => b.confidence - a.confidence)) {
    if (rule.pattern.test(logText)) {
      return {
        failure_type: rule.type,
        short_reason: rule.shortReason,
        detailed_reason: rule.detailedReason,
        probable_cause: rule.probableCause,
        fix_steps: generateFixSteps(rule.type, source),
        confidence: rule.confidence
      };
    }
  }

  // No rules matched
  return {
    failure_type: 'UNKNOWN_ERROR',
    short_reason: 'Unrecognized error pattern',
    detailed_reason: 'The deployment failed with an error pattern that is not recognized by the automated analysis system.',
    probable_cause: 'Unknown deployment issue',
    fix_steps: generateFixSteps('UNKNOWN_ERROR', source),
    confidence: 0.2
  };
}

function generateFixSteps(failureType: string, source: string): string[] {
  const baseSteps: Record<string, string[]> = {
    BUILD_ERROR: [
      'Check if all required dependencies are listed in package.json',
      'Verify import paths are correct and case-sensitive',
      'Run npm install or yarn install locally to test',
      'Check for typos in module names'
    ],
    INSTALL_ERROR: [
      'Clear package manager cache',
      'Delete node_modules and package-lock.json',
      'Run npm install or yarn install again',
      'Check for conflicting dependency versions'
    ],
    ENV_ERROR: [
      'Add missing environment variables to your deployment settings',
      'Check variable names for typos',
      'Ensure all required variables are defined',
      'Verify environment variable values are correct'
    ],
    PERMISSION_ERROR: [
      'Check file permissions in your project',
      'Ensure build scripts are executable',
      'Verify deployment has write access to required directories'
    ],
    PORT_ERROR: [
      'Change the port number in your application',
      'Use process.env.PORT for dynamic port assignment',
      'Check for port conflicts in your configuration'
    ],
    SYNTAX_ERROR: [
      'Review recent code changes for syntax errors',
      'Run your code locally to identify issues',
      'Check for missing brackets, quotes, or semicolons',
      'Validate JSON configuration files'
    ],
    TIMEOUT_ERROR: [
      'Check network connectivity',
      'Optimize build process to reduce time',
      'Increase timeout limits if possible',
      'Review resource-intensive operations'
    ],
    UNKNOWN_ERROR: [
      'Review deployment logs for specific error messages',
      'Test the deployment locally',
      'Check recent changes that might have caused the issue',
      'Contact support if the problem persists'
    ]
  };

  let steps = baseSteps[failureType] || baseSteps.UNKNOWN_ERROR;

  // Source-aware modifications
  if (source === 'github') {
    steps = [
      ...steps,
      'Push fixes to your repository',
      'Create a new commit with the changes',
      'Trigger a new deployment from the updated branch'
    ];
  } else if (source === 'zip') {
    steps = [
      ...steps,
      'Update your local project files',
      'Create a new ZIP file with the fixes',
      'Upload the corrected ZIP file for deployment'
    ];
  } else if (source === 'manual') {
    steps = [
      ...steps,
      'Update deployment configuration in dashboard',
      'Verify build commands and environment settings',
      'Retry deployment with corrected settings'
    ];
  }

  return steps;
}