import { type MetadataRoute } from 'next';
import { getAppSettingsFS } from '@/lib/firebase/firestoreService';

// Default values in case settings are not found
const DEFAULT_SALON_NAME = "NailStudio AI";
const DEFAULT_THEME_COLOR = "#E62E7B";
const DEFAULT_BACKGROUND_COLOR = "#FFFFFF";
const DEFAULT_ICON_192_URL = "/android-chrome-192x192.png";
const DEFAULT_ICON_512_URL = "/android-chrome-512x512.png";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getAppSettingsFS();

  return {
    name: settings?.salonName || DEFAULT_SALON_NAME,
    short_name: settings?.salonName || DEFAULT_SALON_NAME,
    description: 'Painel de gestão para salão de beleza',
    start_url: '/',
    display: 'standalone',
    background_color: settings?.backgroundColor || DEFAULT_BACKGROUND_COLOR,
    theme_color: settings?.themeColor || DEFAULT_THEME_COLOR,
    icons: [
      {
        src: settings?.icon192Url || DEFAULT_ICON_192_URL,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: settings?.icon512Url || DEFAULT_ICON_512_URL,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
