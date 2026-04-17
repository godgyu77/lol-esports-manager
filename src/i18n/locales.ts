export const resources = {
  ko: {
    errorBoundary: {
      title: {
        inline: '이 화면에서 오류가 발생했습니다',
        fullscreen: '오류가 발생했습니다',
      },
      defaultMessage: '알 수 없는 오류입니다.',
      retry: '다시 시도',
      defaultNavigate: '메인 화면으로 이동',
      backToDashboard: '대시보드로 돌아가기',
      backToProgress: '진행 화면으로 돌아가기',
      backToRoster: '로스터로 돌아가기',
    },
  },
  en: {
    errorBoundary: {
      title: {
        inline: 'Something went wrong in this view.',
        fullscreen: 'Something went wrong.',
      },
      defaultMessage: 'Unknown error.',
      retry: 'Try again',
      defaultNavigate: 'Go to main menu',
      backToDashboard: 'Back to dashboard',
      backToProgress: 'Back to progression',
      backToRoster: 'Back to roster',
    },
  },
} as const;

export type I18nLocale = keyof typeof resources;
export type I18nMessages = typeof resources.ko;
