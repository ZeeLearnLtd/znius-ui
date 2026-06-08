import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { getMe, logout as apiLogout } from './api';

export type UserRole = 'F' | 'BH' | 'ACC' | 'KAM' | '';
export type SessionSource = 'iframe' | 'login' | 'none';

export interface ZniusSession {
  userId:         number;
  userType:       UserRole;
  businessId:     number;
  zoneCode:       string;
  franchiseeCode: string;
  entityId:       number;
  fullName:       string;
  isExternal:     boolean;
  source:         SessionSource;
  isReady:        boolean;
}

const EMPTY: ZniusSession = {
  userId: 0, userType: '', businessId: 0, zoneCode: '',
  franchiseeCode: '', entityId: 0, fullName: '',
  isExternal: false, source: 'none', isReady: false,
};

export function useSession(): ZniusSession {
  const router = useRouter();
  const [session, setSession] = useState<ZniusSession>(EMPTY);

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;

    // CASE 1 — URL params present → came from ZniusFrame.aspx (eMountLitera)
    if (q.userId) {
      setSession({
        userId:         parseInt(q.userId as string)     || 0,
        userType:       ((q.userType as string) || '')   as UserRole,
        businessId:     parseInt(q.businessId as string) || 17,
        zoneCode:       (q.zoneCode as string)           || '',
        franchiseeCode: (q.franchiseeCode as string)     || '',
        entityId:       parseInt(q.entityId as string)   || 0,
        fullName:       (q.fullName as string)           || '',
        isExternal:     q.isExternal === '1',
        source:  'iframe',
        isReady: true,
      });
      return;
    }

    // CASE 2 — localStorage se user_id uthao
    let cancelled = false;

    const storedUserId = typeof window !== 'undefined'
      ? localStorage.getItem('znius_user_id')
      : null;

    if (!storedUserId) {
      setSession({ ...EMPTY, isReady: true, source: 'none' });
      return;
    }

    getMe(+storedUserId)
      .then(r => {
        if (cancelled) return;
        const u = r.data.user;
        setSession({
          userId:         u.User_ID         || 0,
          userType:       (u.User_Type      || '') as UserRole,
          businessId:     u.business_id     || 17,
          zoneCode:       '',
          franchiseeCode: u.Franchisee_Code || '',
          entityId:       u.Entity_ID       || 0,
          fullName:       u.Full_Name       || '',
          isExternal:     u.User_Type === 'F',
          source:  'login',
          isReady: true,
        });
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('znius_user_id');
        localStorage.removeItem('znius_user_type');
        setSession({ ...EMPTY, isReady: true, source: 'none' });
      });

    return () => { cancelled = true; };
  }, [router.isReady, router.query]);

  return session;
}

export function useRequireAuth(allowedRoles?: UserRole[]): ZniusSession {
  const session = useSession();
  const router  = useRouter();

  useEffect(() => {
    if (!session.isReady) return;
    if (session.userId && session.userType) return;
    if (session.source === 'iframe') return;
    const target = router.asPath && router.asPath !== '/login'
      ? `?redirect=${encodeURIComponent(router.asPath)}`
      : '';
    router.replace(`/login${target}`);
  }, [session.isReady, session.userId, session.userType, session.source]);

  return session;
}

export async function logoutAndRedirect(router: any) {
  try {
    const uid = typeof window !== 'undefined'
      ? localStorage.getItem('znius_user_id')
      : null;
    if (uid) await apiLogout({ user_id: +uid });
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('znius_user_id');
    localStorage.removeItem('znius_user_type');
  }
  router.replace('/login');
}