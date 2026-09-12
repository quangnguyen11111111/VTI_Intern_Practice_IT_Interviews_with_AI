declare namespace google.accounts.id {
  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    prompt_parent_id?: string;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    allowed_parent_origin?: string | string[];
    intermediate_iframe_close_callback?: () => void;
  }

  interface CredentialResponse {
    credential: string;
    select_by?:
      | 'auto'
      | 'user'
      | 'user_1tap'
      | 'user_2tap'
      | 'btn'
      | 'btn_confirm'
      | 'btn_add_session';
    clientId?: string;
  }

  interface GsiButtonConfiguration {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number | string;
    locale?: string;
  }

  interface PromptMomentNotification {
    isDisplayMoment: () => boolean;
    isDisplayed: () => boolean;
    isNotDisplayed: () => boolean;
    getNotDisplayedReason: () => string;
    isSkippedMoment: () => boolean;
    getSkippedReason: () => string;
    isDismissedMoment: () => boolean;
    getDismissedReason: () => string;
    getMomentType: () => string;
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
  function prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
  function cancel(): void;
  function disableAutoSelect(): void;
  function revoke(hint: string, callback?: (response: { successful: boolean; error?: string }) => void): void;
}

interface Window {
  google?: {
    accounts?: {
      id?: typeof google.accounts.id;
    };
  };
}
