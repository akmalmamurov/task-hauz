export const PATH = {
  home: '/',
  signIn: '/signin',
  onboarding: '/onboarding',
  profile: '/profile',
  signInWithRedirect: (target: string) => `/signin?redirect=${encodeURIComponent(target)}`,
  onboardingWithRedirect: (target: string) =>
    `/onboarding?redirect=${encodeURIComponent(target)}`,
} as const
