/**
 * Diccionario de español — idioma por defecto de la app. Mismas claves
 * que en.js. Ver LanguageContext.jsx (t()) para cómo se usa esto y
 * ARQ/plan de idioma para qué pantallas están traducidas todavía (solo
 * las de mayor tráfico: menú, cabecera, Inicio, pop-ups de pendientes,
 * pantallas de acceso). El resto sigue en español a mano por ahora.
 */
export default {
  nav: {
    inicio: 'Inicio',
    calendario: 'Calendario',
    compras: 'Compras',
    muro: 'Muro',
    convives: 'Convives',
    recompensas: 'Recompensas',
    pote: 'Pote',
    piso: 'Piso',
    perfil: 'Perfil',
    more: 'Más'
  },
  splash: {
    loading: 'Cargando'
  },
  greeting: {
    morning: 'Buenos días',
    afternoon: 'Buenas tardes',
    evening: 'Buenas noches'
  },
  topbar: {
    notifications: 'Notificaciones',
    recent: 'Recientes',
    all: 'Todas',
    markRead: 'Marcar leídas',
    noNewNotifications: 'Sin notificaciones nuevas.',
    noNotificationsYet: 'Sin notificaciones todavía.',
    showPrevious: 'Ver notificaciones anteriores',
    hidePrevious: 'Ocultar anteriores',
    settingsAria: 'Ajustes',
    myProfile: 'Mi perfil',
    settings: 'Configuraciones',
    darkTheme: 'Tema oscuro',
    language: 'Idioma',
    logout: 'Cerrar sesión',
    admin: 'Admin',
    member: 'Miembro',
    exit: 'Salir'
  },
  auth: {
    tagline: 'Organizar el piso, sin dramas',
    login: {
      title: 'Bienvenido de nuevo',
      subtitle: 'Entra para ver las tareas de tu piso.',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Contraseña',
      forgotPassword: '¿Has olvidado tu contraseña?',
      submitting: 'Entrando…',
      submit: 'Entrar',
      noAccount: '¿No tienes cuenta?',
      registerLink: 'Regístrate'
    },
    register: {
      title: 'Crea tu cuenta',
      subtitle: 'Empieza un piso nuevo o únete a uno con un código.',
      createTab: 'Crear piso',
      joinTab: 'Unirme a un piso',
      namePlaceholder: 'Tu nombre',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Contraseña',
      floorNamePlaceholder: 'Nombre del piso (ej: Piso Malasaña 3ºB)',
      inviteCodePlaceholder: 'Código de invitación',
      joinNotice: 'Un miembro del piso deberá aprobar tu solicitud antes de que tengas acceso.',
      submitting: 'Creando…',
      submitCreate: 'Crear piso y cuenta',
      submitJoin: 'Solicitar unión',
      haveAccount: '¿Ya tienes cuenta?',
      loginLink: 'Inicia sesión'
    },
    forgot: {
      title: '¿Olvidaste tu contraseña?',
      subtitle: 'Escribe el email de tu cuenta y te enviaremos un código para restablecerla.',
      emailPlaceholder: 'Email',
      sending: 'Enviando…',
      submit: 'Enviar código',
      backToLogin: 'Volver a entrar',
      checkEmailTitle: 'Revisa tu correo',
      checkEmailBody:
        'Le enviamos a {{email}} un código de 6 dígitos. Escríbelo aquí junto con tu nueva contraseña — puede tardar unos minutos en llegar, revisa también la carpeta de spam.',
      codePlaceholder: '000000',
      newPasswordPlaceholder: 'Nueva contraseña',
      confirmPasswordPlaceholder: 'Confirmar nueva contraseña',
      checking: 'Comprobando…',
      changePassword: 'Cambiar contraseña',
      resent: 'Te mandamos otro código — el anterior ya no sirve.',
      resendPrompt: '¿No te llegó? Reenviar código',
      codeErrorFormat: 'El código son 6 números — revisa el correo que te enviamos.',
      passwordMismatch: 'Las contraseñas no coinciden.',
      updatedTitle: 'Contraseña actualizada',
      updatedBody: 'Ya puedes usarla la próxima vez que entres. Te llevamos dentro…'
    },
    reset: {
      title: 'Elige una nueva contraseña',
      subtitle: 'Mínimo 8 caracteres, con una mayúscula y un número.',
      newPasswordPlaceholder: 'Nueva contraseña',
      confirmPasswordPlaceholder: 'Confirmar nueva contraseña',
      passwordMismatch: 'Las contraseñas no coinciden.',
      saving: 'Guardando…',
      save: 'Guardar contraseña',
      updatedTitle: 'Contraseña actualizada',
      updatedBody: 'Ya puedes usarla la próxima vez que entres. Te llevamos dentro…',
      invalidTitle: 'Enlace no válido',
      invalidBody:
        'Este enlace de recuperación no es válido o ya caducó — a veces pasa porque el propio correo lo abre antes que tú, por seguridad. El mismo email trae también un código de 6 dígitos que puedes escribir a mano.',
      useCodeLink: 'Usar el código del correo'
    }
  },
  timeline: {
    subtitle: 'Esto es lo que pasa en {{floorName}}.',
    chips: {
      activities: 'Actividades',
      points: 'Puntos',
      pot: 'Pote',
      shopping: 'Compras'
    },
    roomiesTitle: 'Tu piso',
    streakTitle: 'Racha de la semana',
    streakWeek: 'semana',
    streakWeeks: 'semanas',
    potCardLabel: 'Pote de dinero',
    potAvailable: '{{amount}}€ disponibles',
    viewDetails: 'Ver detalles',
    notifications: 'Notificaciones',
    markRead: 'Marcar leídas',
    noNewNotifications: 'Sin notificaciones nuevas.',
    noNotificationsYet: 'Sin notificaciones todavía.',
    showPrevious: 'Ver notificaciones anteriores',
    hidePrevious: 'Ocultar anteriores',
    themesTitle: 'Temas',
    swipeHint: 'Desliza una tarjeta para ir más rápido.',
    themeActivities: 'Actividades',
    themeActivitiesStat: '{{done}}/{{total}} hecho',
    themeShopping: 'Compras',
    outOfStock: '{{count}} agotado{{plural}}',
    inList: '{{count}} en la lista',
    themePot: 'Pote de dinero',
    themePotStat: '{{amount}}€ disponibles',
    themeConvives: 'Convives',
    themeConvivesStat: '{{count}} en el piso',
    goTo: 'Ir a {{label}}'
  },
  pendingPopups: {
    attention: '¡Atención!',
    close: 'Cerrar',
    understood: 'Entendido',
    goToShopping: 'Ir a lista de compras',
    shoppingTitle: 'Tienes que comprar estos artículos',
    activitiesTitle: 'Debes realizar estas actividades',
    queueMoreSingular: 'Queda {{count}} más',
    queueMorePlural: 'Quedan {{count}} más',
    hideQueue: 'Ocultar'
  }
}
