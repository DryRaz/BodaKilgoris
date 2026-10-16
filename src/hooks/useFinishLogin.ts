'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { isLocale } from '@/i18n/config';
import { useLocaleContext } from '@/i18n/provider';
import { adoptSession, type ApiOk } from '@/lib/api';

/** After a login/registration API call: hand the session to the browser, apply the account language, go home. */
export function useFinishLogin() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { setLocale } = useLocaleContext();
  return useCallback(
    async (res: ApiOk, home: string) => {
      await adoptSession(res.session);
      if (res.language && isLocale(res.language)) setLocale(res.language);
      await refresh();
      router.replace(home);
    },
    [refresh, router, setLocale],
  );
}
