/* eslint-disable react/function-component-definition */
import AuthWrapper from '@/auth/AuthWrapper';
import Voice from '@/components/Voice';

export default function Home() {
  return (
    <div className='relative flex flex-col w-full h-full min-h-screen overflow-hidden'>
      <div className='green-bubble-gradient absolute left-80 -bottom-73.75 -z-10 size-147.5 rounded-full blur-3xl' />
      <div className='grey-bubble-gradient absolute -right-20 -top-36 -z-10 size-147.5 rounded-full blur-3xl' />
      <div className='flex flex-row grow'>
        <AuthWrapper>
          <Voice />
        </AuthWrapper>
      </div>
    </div>
  );
}
