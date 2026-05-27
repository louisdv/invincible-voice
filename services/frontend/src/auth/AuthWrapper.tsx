'use client';

import React, {
  ChangeEvent,
  FC,
  FormEvent,
  PropsWithChildren,
  useCallback,
  useState,
} from 'react';
import TermsOfServiceModal from '@/components/TermsOfServiceModal';
import { useTranslations } from '@/i18n';
import { AUTH_STATUSES, useAuthContext } from './authContext';

const AuthWrapper: FC<PropsWithChildren> = ({ children = null }) => {
  const {
    authStatus,
    authError,
    signIn,
    register,
    allowPassword,
    userData,
    signOut,
    acceptTermsOfServices,
  } = useAuthContext();
  const [displayRegisterScreen, setDisplayRegisterScreen] = useState(false);
  const toggleRegisterScreen = useCallback(() => {
    setDisplayRegisterScreen((prev) => !prev);
  }, []);

  const handleAcceptTerms = useCallback(async () => {
    await acceptTermsOfServices();
  }, [acceptTermsOfServices]);

  const handleRefuseTerms = useCallback(() => {
    signOut();
  }, [signOut]);

  if (authStatus === AUTH_STATUSES.NOT_CHECKED) {
    return (
      <div className='flex flex-col items-center justify-center w-full'>
        <h1 className='mb-4 text-xl text-voice-text'>Loading…</h1>
      </div>
    );
  }

  if (authStatus === AUTH_STATUSES.NOT_LOGGED) {
    return (
      <div className='flex flex-col items-center justify-center w-full'>
        {!displayRegisterScreen && (
          <SignInScreen
            authError={authError}
            allowPassword={allowPassword}
            onSignIn={signIn}
            onSwitchToRegister={toggleRegisterScreen}
          />
        )}
        {displayRegisterScreen && (
          <RegisterScreen
            allowPassword={allowPassword}
            onRegister={register}
            onSwitchToSignIn={toggleRegisterScreen}
          />
        )}
      </div>
    );
  }

  if (userData && !userData.user_settings.accepted_terms_of_services) {
    return (
      <TermsOfServiceModal
        onAccept={handleAcceptTerms}
        onRefuse={handleRefuseTerms}
      />
    );
  }

  return children;
};

export default AuthWrapper;

interface SignInScreenProps {
  authError: boolean;
  allowPassword: boolean;
  onSignIn: (email: string, password: string) => void;
  onSwitchToRegister: () => void;
}

const SignInScreen: FC<SignInScreenProps> = ({
  authError,
  allowPassword,
  onSignIn,
  onSwitchToRegister,
}) => {
  const t = useTranslations();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (formData.email && formData.password) {
        onSignIn(formData.email, formData.password);
      }
    },
    [formData, onSignIn],
  );
  const onChangeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, email: event.target.value }));
    },
    [setFormData],
  );
  const onChangePassword = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, password: event.target.value }));
    },
    [setFormData],
  );

  return (
    <div className='flex flex-col gap-3 max-w-md w-[90%] my-16'>
      <form
        className='flex flex-col gap-4 w-full bg-voice-surface px-11 py-9 rounded-4xl'
        onSubmit={onSubmit}
      >
        <h1 className='text-center text-[40px] font-bold tracking-tight text-voice-text leading-none pb-2'>
          Voice
        </h1>
        <h1 className='text-center text-xl font-bold mb-9 text-voice-text'>
          {t('common.signIn')}
        </h1>
        {allowPassword && (
          <React.Fragment>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='auth-email-input'
                className='block mb-1 text-sm font-medium text-voice-text-secondary'
              >
                {t('common.yourEmail')}
              </label>
              <input
                id='auth-email-input'
                type='email'
                onChange={onChangeEmail}
                className='w-full px-6 py-3 text-base bg-voice-elevated border border-voice-border text-voice-text placeholder:text-voice-text-tertiary rounded-2xl focus:outline-none focus:border-voice-accent'
                placeholder='prenom.nom@exemple.com'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='auth-password-input'
                className='block mb-1 text-sm font-medium text-voice-text-secondary'
              >
                {t('common.yourPassword')}
              </label>
              <input
                id='auth-password-input'
                type='password'
                onChange={onChangePassword}
                className='w-full px-6 py-3 text-base bg-voice-elevated border border-voice-border text-voice-text placeholder:text-voice-text-tertiary rounded-2xl focus:outline-none focus:border-voice-accent'
                placeholder='*********'
              />
            </div>
            <p className='block h-4 italic text-xs text-voice-danger'>
              {authError ? t('common.emailOrPasswordIncorrect') : ''}
            </p>
            <button
              type='submit'
              className='shrink-0 mt-4 cursor-pointer pointer-events-auto bg-voice-accent text-white rounded-2xl h-14 font-bold text-sm px-8 flex items-center justify-center'
            >
              {t('common.signIn')}
            </button>
          </React.Fragment>
        )}
      </form>
      <div className='flex flex-col gap-2 w-full bg-voice-surface px-11 py-9 rounded-4xl font-bold'>
        <p className='mb-4 font-bold text-sm text-center text-voice-text'>
          {t('common.noAccount')}
        </p>
        <button
          onClick={onSwitchToRegister}
          className='shrink-0 cursor-pointer pointer-events-auto bg-voice-elevated border border-voice-border text-voice-text rounded-2xl h-14 font-bold text-sm px-8 flex items-center justify-center'
        >
          {t('common.createAccount')}
        </button>
      </div>
    </div>
  );
};

interface RegisterScreenProps {
  allowPassword: boolean;
  onRegister: (email: string, password: string) => void;
  onSwitchToSignIn: () => void;
}

const RegisterScreen: FC<RegisterScreenProps> = ({
  allowPassword,
  onRegister,
  onSwitchToSignIn,
}) => {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (
        formData.email &&
        formData.password &&
        formData.confirmPassword === formData.password
      ) {
        onRegister(formData.email, formData.password);
      }
    },
    [formData, onRegister],
  );
  const onChangeEmail = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, email: event.target.value }));
    },
    [setFormData],
  );
  const onChangePassword = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, password: event.target.value }));
      if (formData.confirmPassword !== event.target.value) {
        setError(t('common.passwordMismatch'));
      } else {
        setError('');
      }
    },
    [formData, setFormData, setError, t],
  );
  const onChangeConfirmPassword = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }));
      if (formData.password !== event.target.value) {
        setError(t('common.passwordMismatch'));
      } else {
        setError('');
      }
    },
    [formData, setFormData, setError, t],
  );

  return (
    <div className='flex flex-col gap-3 max-w-md w-[90%] my-16'>
      <form
        className='flex flex-col gap-4 w-full bg-voice-surface px-11 py-9 rounded-4xl'
        onSubmit={onSubmit}
      >
        <h1 className='text-center text-[40px] font-bold tracking-tight text-voice-text leading-none pb-2'>
          Voice
        </h1>
        <h1 className='text-center text-xl font-bold mb-9 text-voice-text'>
          {t('common.createYourAccount')}
        </h1>
        {allowPassword && (
          <React.Fragment>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='register-email-input'
                className='block mb-1 text-sm font-medium text-voice-text-secondary'
              >
                {t('common.yourEmail')}
              </label>
              <input
                id='register-email-input'
                type='email'
                onChange={onChangeEmail}
                className='w-full px-6 py-3 text-base bg-voice-elevated border border-voice-border text-voice-text placeholder:text-voice-text-tertiary rounded-2xl focus:outline-none focus:border-voice-accent'
                placeholder='Email'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='register-password-input'
                className='block mb-1 text-sm font-medium text-voice-text-secondary'
              >
                {t('common.createYourPassword')}
              </label>
              <input
                id='register-password-input'
                type='password'
                onChange={onChangePassword}
                className='w-full px-6 py-3 text-base bg-voice-elevated border border-voice-border text-voice-text placeholder:text-voice-text-tertiary rounded-2xl focus:outline-none focus:border-voice-accent'
                placeholder='*********'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label
                htmlFor='register-confirm-password-input'
                className='block mb-1 text-sm font-medium text-voice-text-secondary'
              >
                {t('common.confirmPassword')}
              </label>
              <input
                id='register-confirm-password-input'
                type='password'
                onChange={onChangeConfirmPassword}
                className='w-full px-6 py-3 text-base bg-voice-elevated border border-voice-border text-voice-text placeholder:text-voice-text-tertiary rounded-2xl focus:outline-none focus:border-voice-accent'
                placeholder='*********'
              />
              <span className='block h-4 italic text-xs text-voice-danger'>{error}</span>
            </div>
            <button
              type='submit'
              className='shrink-0 cursor-pointer pointer-events-auto bg-voice-accent text-white rounded-2xl h-14 font-bold text-sm px-8 flex items-center justify-center'
            >
              {t('common.signUp')}
            </button>
          </React.Fragment>
        )}
      </form>
      <div className='flex flex-col gap-2 w-full bg-voice-surface px-11 py-9 rounded-4xl font-bold'>
        <p className='mb-4 font-bold text-sm text-center text-voice-text'>
          {t('common.alreadyHaveAccount')}
        </p>
        <button
          onClick={onSwitchToSignIn}
          className='shrink-0 cursor-pointer pointer-events-auto bg-voice-elevated border border-voice-border text-voice-text rounded-2xl h-14 font-bold text-sm px-8 flex items-center justify-center'
        >
          {t('common.signIn')}
        </button>
      </div>
    </div>
  );
};
