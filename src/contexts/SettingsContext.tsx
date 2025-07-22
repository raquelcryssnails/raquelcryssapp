
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { DayOpeningHours, AppSettings } from "@/types/firestore";
import { getAppSettingsFS, saveAppSettingsFS } from "@/lib/firebase/firestoreService";
import { useToast } from "@/hooks/use-toast";

// Default values
const initialOpeningHoursData: DayOpeningHours[] = [
  { id: "1", name: "Segunda-feira", dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "2", name: "Terça-feira", dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "3", name: "Quarta-feira", dayOfWeek: 3, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "4", name: "Quinta-feira", dayOfWeek: 4, isOpen: true, openTime: "09:00", closeTime: "18:00" },
  { id: "5", name: "Sexta-feira", dayOfWeek: 5, isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { id: "6", name: "Sábado", dayOfWeek: 6, isOpen: true, openTime: "08:00", closeTime: "17:00" },
  { id: "7", name: "Domingo", dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "18:00" },
];
const DEFAULT_USER_NAME = "Admin NailStudio";
const DEFAULT_SALON_TAGLINE = "Gestão Inteligente";
const DEFAULT_SALON_LOGO_URL = "";
const DEFAULT_WHATSAPP_SCHEDULING_MESSAGE = "Olá! Gostaria de agendar um horário no NailStudio AI.";
const DEFAULT_SALON_NAME = "NailStudio AI";
const DEFAULT_SALON_ADDRESS = "Rua das Palmeiras, 123, Centro";
const DEFAULT_SALON_PHONE = "19996959490";
const DEFAULT_THEME = "light";
const DEFAULT_CLIENT_LOGIN_TITLE = "Portal do Cliente";
const DEFAULT_CLIENT_LOGIN_DESCRIPTION = "Acesse para acompanhar seus selos de fidelidade e muito mais!";
const DEFAULT_STAMP_VALIDITY_MESSAGE = "Atenção: Os mimos não são acumulativos! Use seu mimo disponível antes de completar o próximo cartão.";
const DEFAULT_THEME_COLOR = "#E62E7B";
const DEFAULT_BACKGROUND_COLOR = "#FFFFFF";
const DEFAULT_APPLE_TOUCH_ICON_URL = "/apple-touch-icon.png";
const DEFAULT_ICON_192_URL = "/android-chrome-192x192.png";
const DEFAULT_ICON_512_URL = "/android-chrome-512x512.png";


export interface SettingsContextType {
  openingHours: DayOpeningHours[];
  userName: string;
  salonTagline: string;
  salonLogoUrl: string;
  whatsappSchedulingMessage: string;
  salonName: string;
  salonAddress: string;
  salonPhone: string;
  clientLoginTitle: string;
  clientLoginDescription: string;
  stampValidityMessage: string;
  theme: string;
  themeColor: string;
  backgroundColor: string;
  appleTouchIconUrl: string;
  icon192Url: string;
  icon512Url: string;
  setAppSettingsState: (newSettings: Partial<AppSettings>) => void;
  isLoadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [openingHours, setOpeningHoursInternal] = useState<DayOpeningHours[]>(initialOpeningHoursData);
  const [userName, setUserNameInternal] = useState<string>(DEFAULT_USER_NAME);
  const [salonTagline, setSalonTaglineInternal] = useState<string>(DEFAULT_SALON_TAGLINE);
  const [salonLogoUrl, setSalonLogoUrlInternal] = useState<string>(DEFAULT_SALON_LOGO_URL);
  const [whatsappSchedulingMessage, setWhatsappSchedulingMessageInternal] = useState<string>(DEFAULT_WHATSAPP_SCHEDULING_MESSAGE);
  const [salonName, setSalonNameInternal] = useState<string>(DEFAULT_SALON_NAME);
  const [salonAddress, setSalonAddressInternal] = useState<string>(DEFAULT_SALON_ADDRESS);
  const [salonPhone, setSalonPhoneInternal] = useState<string>(DEFAULT_SALON_PHONE);
  const [clientLoginTitle, setClientLoginTitleInternal] = useState<string>(DEFAULT_CLIENT_LOGIN_TITLE);
  const [clientLoginDescription, setClientLoginDescriptionInternal] = useState<string>(DEFAULT_CLIENT_LOGIN_DESCRIPTION);
  const [stampValidityMessage, setStampValidityMessageInternal] = useState<string>(DEFAULT_STAMP_VALIDITY_MESSAGE);
  const [theme, setThemeInternal] = useState<string>(DEFAULT_THEME);
  const [themeColor, setThemeColorInternal] = useState<string>(DEFAULT_THEME_COLOR);
  const [backgroundColor, setBackgroundColorInternal] = useState<string>(DEFAULT_BACKGROUND_COLOR);
  const [appleTouchIconUrl, setAppleTouchIconUrlInternal] = useState<string>(DEFAULT_APPLE_TOUCH_ICON_URL);
  const [icon192Url, setIcon192UrlInternal] = useState<string>(DEFAULT_ICON_192_URL);
  const [icon512Url, setIcon512UrlInternal] = useState<string>(DEFAULT_ICON_512_URL);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const appSettings = await getAppSettingsFS();
        let settingsToSave: Partial<AppSettings> = {};
        let defaultsUsed = false;

        const setField = <K extends keyof AppSettings>(
          setter: React.Dispatch<React.SetStateAction<any>>,
          appSettingsValue: AppSettings[K] | undefined,
          defaultValue: NonNullable<AppSettings[K]>,
          fieldName: K
        ) => {
          if (appSettings && appSettings.hasOwnProperty(fieldName) && appSettings[fieldName] !== undefined) {
            setter(appSettings[fieldName]);
          } else {
            setter(defaultValue);
            settingsToSave[fieldName] = defaultValue;
            defaultsUsed = true;
          }
        };
        
        setField(setOpeningHoursInternal, appSettings?.openingHours, initialOpeningHoursData, 'openingHours');
        setField(setUserNameInternal, appSettings?.userName, DEFAULT_USER_NAME, 'userName');
        setField(setSalonTaglineInternal, appSettings?.salonTagline, DEFAULT_SALON_TAGLINE, 'salonTagline');
        setField(setSalonLogoUrlInternal, appSettings?.salonLogoUrl, DEFAULT_SALON_LOGO_URL, 'salonLogoUrl');
        setField(setWhatsappSchedulingMessageInternal, appSettings?.whatsappSchedulingMessage, DEFAULT_WHATSAPP_SCHEDULING_MESSAGE, 'whatsappSchedulingMessage');
        setField(setSalonNameInternal, appSettings?.salonName, DEFAULT_SALON_NAME, 'salonName');
        setField(setSalonAddressInternal, appSettings?.salonAddress, DEFAULT_SALON_ADDRESS, 'salonAddress');
        setField(setSalonPhoneInternal, appSettings?.salonPhone, DEFAULT_SALON_PHONE, 'salonPhone');
        setField(setClientLoginTitleInternal, appSettings?.clientLoginTitle, DEFAULT_CLIENT_LOGIN_TITLE, 'clientLoginTitle');
        setField(setClientLoginDescriptionInternal, appSettings?.clientLoginDescription, DEFAULT_CLIENT_LOGIN_DESCRIPTION, 'clientLoginDescription');
        setField(setStampValidityMessageInternal, appSettings?.stampValidityMessage, DEFAULT_STAMP_VALIDITY_MESSAGE, 'stampValidityMessage');
        setField(setThemeInternal, appSettings?.theme, DEFAULT_THEME, 'theme');
        setField(setThemeColorInternal, appSettings?.themeColor, DEFAULT_THEME_COLOR, 'themeColor');
        setField(setBackgroundColorInternal, appSettings?.backgroundColor, DEFAULT_BACKGROUND_COLOR, 'backgroundColor');
        setField(setAppleTouchIconUrlInternal, appSettings?.appleTouchIconUrl, DEFAULT_APPLE_TOUCH_ICON_URL, 'appleTouchIconUrl');
        setField(setIcon192UrlInternal, appSettings?.icon192Url, DEFAULT_ICON_192_URL, 'icon192Url');
        setField(setIcon512UrlInternal, appSettings?.icon512Url, DEFAULT_ICON_512_URL, 'icon512Url');

        
        if (defaultsUsed && Object.keys(settingsToSave).length > 0) {
          await saveAppSettingsFS(settingsToSave);
        }

      } catch (error) {
        console.error("Error loading app settings from Firestore:", error);
        toast({
          variant: "destructive",
          title: "Erro ao Carregar Configurações",
          description: "Não foi possível carregar as configurações. Usando padrões.",
        });
        setOpeningHoursInternal(initialOpeningHoursData);
        setUserNameInternal(DEFAULT_USER_NAME);
        setSalonTaglineInternal(DEFAULT_SALON_TAGLINE);
        setSalonLogoUrlInternal(DEFAULT_SALON_LOGO_URL);
        setWhatsappSchedulingMessageInternal(DEFAULT_WHATSAPP_SCHEDULING_MESSAGE);
        setSalonNameInternal(DEFAULT_SALON_NAME);
        setSalonAddressInternal(DEFAULT_SALON_ADDRESS);
        setSalonPhoneInternal(DEFAULT_SALON_PHONE);
        setClientLoginTitleInternal(DEFAULT_CLIENT_LOGIN_TITLE);
        setClientLoginDescriptionInternal(DEFAULT_CLIENT_LOGIN_DESCRIPTION);
        setStampValidityMessageInternal(DEFAULT_STAMP_VALIDITY_MESSAGE);
        setThemeInternal(DEFAULT_THEME);
        setThemeColorInternal(DEFAULT_THEME_COLOR);
        setBackgroundColorInternal(DEFAULT_BACKGROUND_COLOR);
        setAppleTouchIconUrlInternal(DEFAULT_APPLE_TOUCH_ICON_URL);
        setIcon192UrlInternal(DEFAULT_ICON_192_URL);
        setIcon512UrlInternal(DEFAULT_ICON_512_URL);

      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
  }, [toast]);

  const setAppSettingsState = useCallback(async (newSettings: Partial<AppSettings>) => {
    if (newSettings.openingHours) setOpeningHoursInternal(newSettings.openingHours);
    if (newSettings.hasOwnProperty('userName')) setUserNameInternal(newSettings.userName ?? DEFAULT_USER_NAME);
    if (newSettings.hasOwnProperty('salonTagline')) setSalonTaglineInternal(newSettings.salonTagline ?? DEFAULT_SALON_TAGLINE);
    if (newSettings.hasOwnProperty('salonLogoUrl')) setSalonLogoUrlInternal(newSettings.salonLogoUrl ?? DEFAULT_SALON_LOGO_URL);
    if (newSettings.hasOwnProperty('whatsappSchedulingMessage')) setWhatsappSchedulingMessageInternal(newSettings.whatsappSchedulingMessage ?? DEFAULT_WHATSAPP_SCHEDULING_MESSAGE);
    if (newSettings.hasOwnProperty('salonName')) setSalonNameInternal(newSettings.salonName ?? DEFAULT_SALON_NAME);
    if (newSettings.hasOwnProperty('salonAddress')) setSalonAddressInternal(newSettings.salonAddress ?? DEFAULT_SALON_ADDRESS);
    if (newSettings.hasOwnProperty('salonPhone')) setSalonPhoneInternal(newSettings.salonPhone ?? DEFAULT_SALON_PHONE);
    if (newSettings.hasOwnProperty('clientLoginTitle')) setClientLoginTitleInternal(newSettings.clientLoginTitle ?? DEFAULT_CLIENT_LOGIN_TITLE);
    if (newSettings.hasOwnProperty('clientLoginDescription')) setClientLoginDescriptionInternal(newSettings.clientLoginDescription ?? DEFAULT_CLIENT_LOGIN_DESCRIPTION);
    if (newSettings.hasOwnProperty('stampValidityMessage')) setStampValidityMessageInternal(newSettings.stampValidityMessage ?? DEFAULT_STAMP_VALIDITY_MESSAGE);
    if (newSettings.hasOwnProperty('theme')) setThemeInternal(newSettings.theme ?? DEFAULT_THEME);
    if (newSettings.hasOwnProperty('themeColor')) setThemeColorInternal(newSettings.themeColor ?? DEFAULT_THEME_COLOR);
    if (newSettings.hasOwnProperty('backgroundColor')) setBackgroundColorInternal(newSettings.backgroundColor ?? DEFAULT_BACKGROUND_COLOR);
    if (newSettings.hasOwnProperty('appleTouchIconUrl')) setAppleTouchIconUrlInternal(newSettings.appleTouchIconUrl ?? DEFAULT_APPLE_TOUCH_ICON_URL);
    if (newSettings.hasOwnProperty('icon192Url')) setIcon192UrlInternal(newSettings.icon192Url ?? DEFAULT_ICON_192_URL);
    if (newSettings.hasOwnProperty('icon512Url')) setIcon512UrlInternal(newSettings.icon512Url ?? DEFAULT_ICON_512_URL);

    
    try {
      await saveAppSettingsFS(newSettings);
    } catch (error) {
      console.error("Error saving app settings to Firestore:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar Configurações",
        description: "Não foi possível salvar as configurações no banco de dados.",
      });
    }
  }, [toast]);


  return (
    <SettingsContext.Provider value={{ 
        openingHours, 
        userName, 
        salonTagline, 
        salonLogoUrl, 
        whatsappSchedulingMessage,
        salonName,
        salonAddress,
        salonPhone,
        clientLoginTitle,
        clientLoginDescription,
        stampValidityMessage,
        theme,
        themeColor,
        backgroundColor,
        appleTouchIconUrl,
        icon192Url,
        icon512Url,
        setAppSettingsState, 
        isLoadingSettings 
      }}>
      {children}
    </SettingsContext.Provider>
  );
}
