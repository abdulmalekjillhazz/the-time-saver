import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import './globals.css';
import { LoadingScreen } from '../components/StatusViews.jsx';

export default function RootLoading() {
  return <LoadingScreen fullPage />;
}
