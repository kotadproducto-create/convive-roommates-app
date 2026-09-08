/**
 * English dictionary — same keys as es.js. See LanguageContext.jsx
 * (t()) for how this is consumed, and the i18n plan for which screens
 * are translated so far (nav, header, Inicio/Home, pending popups,
 * auth screens). Everything else still renders in Spanish for now.
 */
export default {
  nav: {
    inicio: 'Home',
    actividades: 'Activities',
    calendario: 'Calendar',
    compras: 'Shopping',
    muro: 'Wall',
    convives: 'Roommates',
    recompensas: 'Rewards',
    pote: 'Pot',
    piso: 'Floor',
    perfil: 'Profile',
    more: 'More'
  },
  splash: {
    loading: 'Loading'
  },
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening'
  },
  topbar: {
    notifications: 'Notifications',
    recent: 'Recent',
    all: 'All',
    markRead: 'Mark read',
    noNewNotifications: 'No new notifications.',
    noNotificationsYet: 'No notifications yet.',
    showPrevious: 'Show previous notifications',
    hidePrevious: 'Hide previous',
    settingsAria: 'Settings',
    myProfile: 'My profile',
    settings: 'Settings',
    darkTheme: 'Dark theme',
    language: 'Language',
    logout: 'Log out',
    admin: 'Admin',
    member: 'Member',
    exit: 'Log out'
  },
  auth: {
    tagline: 'Run the flat, without the drama',
    login: {
      title: 'Welcome back',
      subtitle: 'Sign in to see your flat’s chores.',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      forgotPassword: 'Forgot your password?',
      submitting: 'Signing in…',
      submit: 'Sign in',
      noAccount: 'Don’t have an account?',
      registerLink: 'Sign up'
    },
    register: {
      title: 'Create your account',
      subtitle: 'Start a new flat or join one with a code.',
      createTab: 'Create flat',
      joinTab: 'Join a flat',
      namePlaceholder: 'Your name',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      floorNamePlaceholder: 'Flat name (e.g. Malasaña Flat 3B)',
      inviteCodePlaceholder: 'Invite code',
      joinNotice: 'A member of the flat will need to approve your request before you get access.',
      submitting: 'Creating…',
      submitCreate: 'Create flat and account',
      submitJoin: 'Request to join',
      haveAccount: 'Already have an account?',
      loginLink: 'Sign in'
    },
    forgot: {
      title: 'Forgot your password?',
      subtitle: 'Enter your account email and we’ll send you a code to reset it.',
      emailPlaceholder: 'Email',
      sending: 'Sending…',
      submit: 'Send code',
      backToLogin: 'Back to sign in',
      checkEmailTitle: 'Check your email',
      checkEmailBody:
        'We sent {{email}} a 6-digit code. Enter it here along with your new password — it can take a few minutes to arrive, check your spam folder too.',
      codePlaceholder: '000000',
      newPasswordPlaceholder: 'New password',
      confirmPasswordPlaceholder: 'Confirm new password',
      checking: 'Checking…',
      changePassword: 'Change password',
      resent: 'We sent you another code — the previous one no longer works.',
      resendPrompt: 'Didn’t get it? Resend code',
      codeErrorFormat: 'The code is 6 digits — check the email we sent you.',
      passwordMismatch: 'Passwords don’t match.',
      updatedTitle: 'Password updated',
      updatedBody: 'You can use it next time you sign in. Taking you inside…'
    },
    reset: {
      title: 'Choose a new password',
      subtitle: 'At least 8 characters, with one uppercase letter and one number.',
      newPasswordPlaceholder: 'New password',
      confirmPasswordPlaceholder: 'Confirm new password',
      passwordMismatch: 'Passwords don’t match.',
      saving: 'Saving…',
      save: 'Save password',
      updatedTitle: 'Password updated',
      updatedBody: 'You can use it next time you sign in. Taking you inside…',
      invalidTitle: 'Invalid link',
      invalidBody:
        'This recovery link isn’t valid or has expired — sometimes this happens because your email app opens it before you do, for security. The same email also includes a 6-digit code you can type in by hand.',
      useCodeLink: 'Use the code from the email'
    }
  },
  timeline: {
    subtitle: 'Here’s what’s going on in {{floorName}}.',
    chips: {
      activities: 'Chores',
      points: 'Points',
      pot: 'Pot',
      shopping: 'Shopping'
    },
    roomiesTitle: 'Your floor',
    streakTitle: 'Week streak',
    streakWeek: 'week',
    streakWeeks: 'weeks',
    potCardLabel: 'Money pot',
    potAvailable: '€{{amount}} available',
    viewDetails: 'View details',
    notifications: 'Notifications',
    markRead: 'Mark read',
    noNewNotifications: 'No new notifications.',
    noNotificationsYet: 'No notifications yet.',
    showPrevious: 'Show previous notifications',
    hidePrevious: 'Hide previous',
    themesTitle: 'Sections',
    swipeHint: 'Swipe a card for a shortcut.',
    themeActivities: 'Chores',
    themeActivitiesStat: '{{done}}/{{total}} done',
    themeShopping: 'Shopping',
    outOfStock: '{{count}} out of stock',
    inList: '{{count}} on the list',
    themePot: 'Money pot',
    themePotStat: '€{{amount}} available',
    themeConvives: 'Roommates',
    themeConvivesStat: '{{count}} on the floor',
    goTo: 'Go to {{label}}'
  },
  roomieOrb: {
    doneThisWeek: '{{done}}/{{total}} done this week',
    allDone: 'All caught up!',
    noTasks: 'No tasks assigned this week',
    pending: 'Pending',
    close: 'Close'
  },
  pendingPopups: {
    attention: 'Heads up!',
    close: 'Close',
    understood: 'Got it',
    goToShopping: 'Go to shopping list',
    shoppingTitle: 'You need to buy these items',
    activitiesTitle: 'You need to do these chores',
    queueMoreSingular: '{{count}} more waiting',
    queueMorePlural: '{{count}} more waiting',
    hideQueue: 'Hide'
  }
}
