"use client";

import { useEffect } from 'react';
import { initSessionRecovery } from '@/lib/session-recovery';

export function SessionRecoveryProvider() {
  useEffect(() => {
    initSessionRecovery();
  }, []);

  return null;
}