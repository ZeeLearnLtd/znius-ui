import type { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right"
        toastOptions={{ style: { fontFamily: 'DM Sans,sans-serif', fontSize: 14, borderRadius: 12 } }} />
    </>
  );
}
