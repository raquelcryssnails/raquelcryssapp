

import { db } from '@/lib/firebase/config';
import type {
  Appointment,
  Client,
  SalonService,
  SalonPackage,
  ClientPackageInstance,
  AppSettings, 
  DayOpeningHours, 
  FinancialTransaction,
  Professional,
  Product,
  Notification,
  ClientNotification,
  Conversation,
  Message,
} from '@/types/firestore';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  getDoc,
  serverTimestamp,
  setDoc,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { parseISO, isValid } from 'date-fns';


// Helper to convert Firestore doc to our data type
export const fromFirestore = <T extends { id: string }>(
  snapshot: any, // Firestore DocumentSnapshot
  options?: any // SnapshotOptions
): T => {
  const data = snapshot.data(options);
  const result: any = {
    id: snapshot.id,
    ...data,
  };

  // Default mimosRedeemed if Client type and field is missing
  if ('mimosRedeemed' in data === false && 'stampsEarned' in data) { // Heuristic for Client type
    result.mimosRedeemed = 0;
  }

  // Convert Timestamps to ISO strings if they exist and are Timestamps
  if (data?.createdAt && data.createdAt instanceof Timestamp) {
    result.createdAt = data.createdAt.toDate().toISOString();
  }
  if (data?.updatedAt && data.updatedAt instanceof Timestamp) {
    result.updatedAt = data.updatedAt.toDate().toISOString();
  }
  if (data?.lastMessageTimestamp && data.lastMessageTimestamp instanceof Timestamp) {
    result.lastMessageTimestamp = data.lastMessageTimestamp.toDate().toISOString();
  }
  // Handle specific date fields that might be Timestamps
  if (data?.date && data.date instanceof Timestamp) { // For Appointment.date or FinancialTransaction.date
    result.date = data.date.toDate().toISOString().split('T')[0];
  } else if (typeof data?.date === 'string' && data.date?.includes('T')) {
    // If it's already a string but in ISO format with time, just take the date part
    result.date = data.date.split('T')[0];
  }

  // Handle product lastRestockDate
  if (data?.lastRestockDate && data.lastRestockDate instanceof Timestamp) {
    result.lastRestockDate = data.lastRestockDate.toDate().toISOString().split('T')[0];
  } else if (typeof data?.lastRestockDate === 'string' && data.lastRestockDate?.includes('T')) {
    result.lastRestockDate = data.lastRestockDate.split('T')[0];
  }


  // Handle dates within purchasedPackages
  if (Array.isArray(data?.purchasedPackages)) {
    result.purchasedPackages = data.purchasedPackages.map((pkg: any) => ({
      ...pkg,
      ...(pkg.purchaseDate && pkg.purchaseDate instanceof Timestamp && {
        purchaseDate: pkg.purchaseDate.toDate().toISOString().split('T')[0],
      }),
      ...(pkg.expiryDate && pkg.expiryDate instanceof Timestamp && {
        expiryDate: pkg.expiryDate.toDate().toISOString().split('T')[0],
      }),
    }));
  }
  return result as T;
};


// ========== App Settings Functions ==========
const APP_CONFIG_COLLECTION = 'appConfiguration';
const MAIN_SETTINGS_DOC_ID = 'mainSettings';

export const getAppSettingsFS = async (): Promise<AppSettings | null> => {
  try {
    const docRef = doc(db, APP_CONFIG_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const appSettings: AppSettings = {
        id: docSnap.id,
        openingHours: data.openingHours, 
        userName: data.userName,
        salonTagline: data.salonTagline,
        salonLogoUrl: data.salonLogoUrl,
        whatsappSchedulingMessage: data.whatsappSchedulingMessage,
        salonName: data.salonName,
        salonAddress: data.salonAddress,
        salonPhone: data.salonPhone,
        clientLoginTitle: data.clientLoginTitle,
        clientLoginDescription: data.clientLoginDescription,
        stampValidityMessage: data.stampValidityMessage,
        theme: data.theme,
        themeColor: data.themeColor,
        backgroundColor: data.backgroundColor,
        appleTouchIconUrl: data.appleTouchIconUrl,
        icon192Url: data.icon192Url,
        icon512Url: data.icon512Url,
      };
      // Convert Timestamp to ISO string for updatedAt
      if (data.updatedAt && data.updatedAt instanceof Timestamp) {
        appSettings.updatedAt = data.updatedAt.toDate().toISOString();
      } else if (data.updatedAt) { 
        appSettings.updatedAt = data.updatedAt;
      }
      return appSettings;
    }
    console.log('No app settings document found in Firestore.');
    return null;
  } catch (error) {
    console.error('Error fetching app settings from Firestore:', error);
    throw error; 
  }
};

export const saveAppSettingsFS = async (settings: Partial<AppSettings>): Promise<void> => {
  try {
    const settingsDocRef = doc(db, APP_CONFIG_COLLECTION, MAIN_SETTINGS_DOC_ID);
    const dataToSave: Partial<AppSettings> & { updatedAt?: any } = { ...settings, updatedAt: serverTimestamp() };
    
    // Ensure all potentially configurable fields are included in dataToSave if they exist in settings
    if (settings.openingHours) dataToSave.openingHours = settings.openingHours;
    if (settings.hasOwnProperty('userName')) dataToSave.userName = settings.userName;
    if (settings.hasOwnProperty('salonTagline')) dataToSave.salonTagline = settings.salonTagline;
    if (settings.hasOwnProperty('salonLogoUrl')) dataToSave.salonLogoUrl = settings.salonLogoUrl;
    if (settings.hasOwnProperty('whatsappSchedulingMessage')) dataToSave.whatsappSchedulingMessage = settings.whatsappSchedulingMessage;
    if (settings.hasOwnProperty('salonName')) dataToSave.salonName = settings.salonName;
    if (settings.hasOwnProperty('salonAddress')) dataToSave.salonAddress = settings.salonAddress;
    if (settings.hasOwnProperty('salonPhone')) dataToSave.salonPhone = settings.salonPhone;
    if (settings.hasOwnProperty('clientLoginTitle')) dataToSave.clientLoginTitle = settings.clientLoginTitle;
    if (settings.hasOwnProperty('clientLoginDescription')) dataToSave.clientLoginDescription = settings.clientLoginDescription;
    if (settings.hasOwnProperty('stampValidityMessage')) dataToSave.stampValidityMessage = settings.stampValidityMessage;
    if (settings.hasOwnProperty('theme')) dataToSave.theme = settings.theme;
    if (settings.hasOwnProperty('themeColor')) dataToSave.themeColor = settings.themeColor;
    if (settings.hasOwnProperty('backgroundColor')) dataToSave.backgroundColor = settings.backgroundColor;
    if (settings.hasOwnProperty('appleTouchIconUrl')) dataToSave.appleTouchIconUrl = settings.appleTouchIconUrl;
    if (settings.hasOwnProperty('icon192Url')) dataToSave.icon192Url = settings.icon192Url;
    if (settings.hasOwnProperty('icon512Url')) dataToSave.icon512Url = settings.icon512Url;


    await setDoc(settingsDocRef, dataToSave, { merge: true });
    console.log('App settings saved to Firestore successfully:', dataToSave);
  } catch (error) {
    console.error('Error saving app settings to Firestore:', error);
    throw error; 
  }
};

// ========== Admin Status Check ==========
export const checkAdminStatusFS = async (uid: string): Promise<boolean> => {
  try {
    const adminDocRef = doc(db, 'admins', uid);
    const docSnap = await getDoc(adminDocRef);
    if (docSnap.exists()) {
      return true; 
    }
    return false; // User document does not exist in 'admins' collection
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false; // Default to not admin on error
  }
};


// ========== Client Functions ==========

export const addClientFS = async (
  clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Client> => {
  const dataToSave = {
    ...clientData,
    stampsEarned: clientData.stampsEarned || 0,
    mimosRedeemed: clientData.mimosRedeemed || 0,
    purchasedPackages: clientData.purchasedPackages || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'clients'), dataToSave);
  const docSnap = await getDoc(docRef); 
  return fromFirestore<Client>(docSnap);
};

export const getClientsFS = async (): Promise<Client[]> => {
  const querySnapshot = await getDocs(collection(db, 'clients'));
  return querySnapshot.docs.map((doc) => fromFirestore<Client>(doc));
};

export const getClientFS = async (id: string): Promise<Client | null> => {
   const docRef = doc(db, "clients", id);
   const docSnap = await getDoc(docRef);
   return docSnap.exists() ? fromFirestore<Client>(docSnap) : null;
}

export const updateClientFS = async (
  id: string,
  data: Partial<Omit<Client, 'id' | 'createdAt'>>
): Promise<void> => {
  const clientDoc = doc(db, 'clients', id);
  const dataToUpdate: any = { ...data, updatedAt: serverTimestamp() };
  if (data.purchasedPackages) {
    dataToUpdate.purchasedPackages = data.purchasedPackages.map(pkg => ({
      ...pkg,
      purchaseDate: typeof pkg.purchaseDate === 'string' ? Timestamp.fromDate(new Date(pkg.purchaseDate)) : pkg.purchaseDate,
      expiryDate: typeof pkg.expiryDate === 'string' ? Timestamp.fromDate(new Date(pkg.expiryDate)) : pkg.expiryDate,
    })) as ClientPackageInstance[];
  }
  await updateDoc(clientDoc, dataToUpdate);
};

export const deleteClientFS = async (id: string): Promise<void> => {
  const clientDoc = doc(db, 'clients', id);
  await deleteDoc(clientDoc);
};


// ========== Service Functions ==========

export const addServiceFS = async (
  serviceData: Omit<SalonService, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SalonService> => {
  const dataToSave = {
    ...serviceData,
    price: String(serviceData.price).replace(',', '.'),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'services'), dataToSave);
  const docSnap = await getDoc(docRef);
  return fromFirestore<SalonService>(docSnap);
};

export const getServicesFS = async (): Promise<SalonService[]> => {
  const querySnapshot = await getDocs(collection(db, 'services'));
  return querySnapshot.docs.map((doc) => fromFirestore<SalonService>(doc));
};

export const updateServiceFS = async (
  id: string,
  data: Partial<Omit<SalonService, 'id' | 'createdAt'>>
): Promise<void> => {
  const serviceDoc = doc(db, 'services', id);
  const updateData: Partial<SalonService> & { updatedAt?: any } = { ...data, updatedAt: serverTimestamp() };
  if (data.price) {
    updateData.price = String(data.price).replace(',', '.');
  }
  await updateDoc(serviceDoc, updateData as any);
};

export const deleteServiceFS = async (id: string): Promise<void> => {
  const serviceDoc = doc(db, 'services', id);
  await deleteDoc(serviceDoc);
};


// ========== Appointment Functions ==========

export const addAppointmentFS = async (
  appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Appointment> => {
  const dataToSave = {
    ...appointmentData,
    date: appointmentData.date, // Already YYYY-MM-DD string
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'appointments'), dataToSave);
  const docSnap = await getDoc(docRef);
  return fromFirestore<Appointment>(docSnap);
};

export const getAppointmentsFS = async (): Promise<Appointment[]> => {
  const q = query(collection(db, 'appointments'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => fromFirestore<Appointment>(doc));
};

export const getAppointmentFS = async (id: string): Promise<Appointment | null> => {
  const appointmentDoc = doc(db, 'appointments', id);
  const docSnap = await getDoc(appointmentDoc);
  return docSnap.exists() ? fromFirestore<Appointment>(docSnap) : null;
};


export const updateAppointmentFS = async (
  id: string,
  data: Partial<Omit<Appointment, 'id' | 'createdAt'>>
): Promise<void> => {
  const appointmentDoc = doc(db, 'appointments', id);
  await updateDoc(appointmentDoc, { ...data, updatedAt: serverTimestamp() });
};

export const deleteAppointmentFS = async (id: string): Promise<void> => {
  const appointmentDoc = doc(db, 'appointments', id);
  await deleteDoc(appointmentDoc);
};

// ========== Package Functions ==========

export const addPackageFS = async (
  packageData: Omit<SalonPackage, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SalonPackage> => {
  const dataToSave = {
    ...packageData,
    price: String(packageData.price).replace(',', '.'),
    originalPrice: packageData.originalPrice ? String(packageData.originalPrice).replace(',', '.') : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'packages'), dataToSave);
  const docSnap = await getDoc(docRef);
  return fromFirestore<SalonPackage>(docSnap);
};

export const getPackagesFS = async (): Promise<SalonPackage[]> => {
  const querySnapshot = await getDocs(collection(db, 'packages'));
  return querySnapshot.docs.map((doc) => fromFirestore<SalonPackage>(doc));
};

export const updatePackageFS = async (
  id: string,
  data: Partial<Omit<SalonPackage, 'id' | 'createdAt'>>
): Promise<void> => {
  const packageDoc = doc(db, 'packages', id);
  const updateData: any = { ...data, updatedAt: serverTimestamp() };
  if (data.price) {
    updateData.price = String(data.price).replace(',', '.');
  }
  if (data.hasOwnProperty('originalPrice')) { 
    updateData.originalPrice = data.originalPrice ? String(data.originalPrice).replace(',', '.') : null;
  }
  await updateDoc(packageDoc, updateData);
};

export const deletePackageFS = async (id: string): Promise<void> => {
  const packageDoc = doc(db, 'packages', id);
  await deleteDoc(packageDoc);
};


// ========== Professional Functions ==========
export const addProfessionalFS = async (
  professionalData: Omit<Professional, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Professional> => {
  const dataToSave = { 
    ...professionalData,
    commissionRate: professionalData.commissionRate === undefined || professionalData.commissionRate === null ? null : Number(professionalData.commissionRate),
    createdAt: serverTimestamp(), 
    updatedAt: serverTimestamp() 
  };
  const docRef = await addDoc(collection(db, 'professionals'), dataToSave);
  const docSnap = await getDoc(docRef);
  return fromFirestore<Professional>(docSnap);
};

export const getProfessionalsFS = async (): Promise<Professional[]> => {
  const querySnapshot = await getDocs(collection(db, 'professionals'));
  return querySnapshot.docs.map((doc) => fromFirestore<Professional>(doc));
};

export const getProfessionalFS = async (id: string): Promise<Professional | null> => {
  const docRef = doc(db, 'professionals', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore<Professional>(docSnap) : null;
};

export const updateProfessionalFS = async (
  id: string,
  data: Partial<Omit<Professional, 'id' | 'createdAt'>>
): Promise<void> => {
  const professionalDoc = doc(db, 'professionals', id);
  const dataToUpdate: Partial<Professional> & { updatedAt?: any } = { ...data, updatedAt: serverTimestamp() };
  if (data.hasOwnProperty('commissionRate')) {
    dataToUpdate.commissionRate = data.commissionRate === undefined || data.commissionRate === null ? null : Number(data.commissionRate);
  }
  await updateDoc(professionalDoc, dataToUpdate as any);
};

export const deleteProfessionalFS = async (id: string): Promise<void> => {
  const professionalDoc = doc(db, 'professionals', id);
  await deleteDoc(professionalDoc);
};


// ========== Financial Transaction Functions (formerly Expense) ==========

export const addFinancialTransactionFS = async (
  transactionData: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FinancialTransaction> => {
  const dataToSave = {
    ...transactionData,
    amount: String(transactionData.amount).replace(',', '.'),
    date: transactionData.date, // YYYY-MM-DD string
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'financialTransactions'), dataToSave); // Changed collection name
  const docSnap = await getDoc(docRef);
  return fromFirestore<FinancialTransaction>(docSnap);
};

export const getFinancialTransactionsFS = async (): Promise<FinancialTransaction[]> => {
  const q = query(collection(db, 'financialTransactions')); // Changed collection name
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => fromFirestore<FinancialTransaction>(doc));
};

// ========== Product (Inventory) Functions ==========

export const addProductFS = async (
  productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Product> => {
  const dataToSave = {
    ...productData,
    stock: Number(productData.stock) || 0,
    lowStockThreshold: Number(productData.lowStockThreshold) || 0,
    costPrice: productData.costPrice ? String(productData.costPrice).replace(',', '.') : null,
    sellingPrice: productData.sellingPrice ? String(productData.sellingPrice).replace(',', '.') : null,
    lastRestockDate: productData.lastRestockDate ? productData.lastRestockDate : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'products'), dataToSave);
  const docSnap = await getDoc(docRef);
  return fromFirestore<Product>(docSnap);
};

export const getProductsFS = async (): Promise<Product[]> => {
  const querySnapshot = await getDocs(collection(db, 'products'));
  return querySnapshot.docs.map((doc) => fromFirestore<Product>(doc));
};

export const updateProductFS = async (
  id: string,
  data: Partial<Omit<Product, 'id' | 'createdAt'>>
): Promise<void> => {
  const productDoc = doc(db, 'products', id);
  const docSnap = await getDoc(productDoc);
  if (!docSnap.exists()) {
    console.error(`Product with ID ${id} not found for update.`);
    return;
  }
  const oldData = docSnap.data() as Product;

  const dataToUpdate: any = { ...data, updatedAt: serverTimestamp() };

  if (data.hasOwnProperty('stock') && data.stock !== undefined) {
    dataToUpdate.stock = Number(data.stock);
    const newStock = dataToUpdate.stock;
    const threshold = Number(data.lowStockThreshold ?? oldData.lowStockThreshold);
    if (newStock <= threshold && oldData.stock > threshold) {
      await addNotificationFS({
        title: 'Estoque Baixo',
        description: `O produto "${oldData.name}" atingiu o nível baixo de estoque (${newStock} restantes).`,
        type: 'alert',
        linkTo: '/estoque',
      });
    }
  }
  if (data.hasOwnProperty('lowStockThreshold') && data.lowStockThreshold !== undefined) {
    dataToUpdate.lowStockThreshold = Number(data.lowStockThreshold);
  }
  if (data.hasOwnProperty('costPrice')) {
    dataToUpdate.costPrice = data.costPrice ? String(data.costPrice).replace(',', '.') : null;
  }
  if (data.hasOwnProperty('sellingPrice')) {
    dataToUpdate.sellingPrice = data.sellingPrice ? String(data.sellingPrice).replace(',', '.') : null;
  }
  if (data.hasOwnProperty('lastRestockDate')) {
    dataToUpdate.lastRestockDate = data.lastRestockDate || null;
  }

  await updateDoc(productDoc, dataToUpdate);
};

export const deleteProductFS = async (id: string): Promise<void> => {
  const productDoc = doc(db, 'products', id);
  await deleteDoc(productDoc);
};

export const clearAllFinancialTransactionsFS = async (): Promise<{ success: boolean, deletedCount: number, error?: string }> => {
  try {
    console.log('Attempting to clear all financial transactions...');
    const transactionsCollectionRef = collection(db, 'financialTransactions');
    const querySnapshot = await getDocs(transactionsCollectionRef);
    let deletedCount = 0;
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, 'financialTransactions', docSnapshot.id)));
      deletedCount++;
    });
    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${deletedCount} financial transactions.`);
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('Error clearing financial transactions:', error);
    return { success: false, deletedCount: 0, error: error.message || "Unknown error" };
  }
};

export const clearAllAppointmentsFS = async (): Promise<{ success: boolean, deletedCount: number, error?: string }> => {
  try {
    console.log('Attempting to clear all appointments...');
    const appointmentsCollectionRef = collection(db, 'appointments');
    const querySnapshot = await getDocs(appointmentsCollectionRef);
    let deletedCount = 0;
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnapshot) => {
      deletePromises.push(deleteDoc(doc(db, 'appointments', docSnapshot.id)));
      deletedCount++;
    });
    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${deletedCount} appointments.`);
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('Error clearing appointments:', error);
    return { success: false, deletedCount: 0, error: error.message || "Unknown error" };
  }
};

// ========== Admin Notification Functions ==========

export const addNotificationFS = async (
  notificationData: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<void> => {
  const dataToSave = {
    ...notificationData,
    read: false,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'notifications'), dataToSave);
};

export const getNotificationsFS = async (): Promise<Notification[]> => {
  const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => fromFirestore<Notification>(doc));
};

export const markNotificationAsReadFS = async (id: string): Promise<void> => {
  const notificationDoc = doc(db, 'notifications', id);
  await updateDoc(notificationDoc, { read: true });
};

export const markAllNotificationsAsReadFS = async (): Promise<void> => {
  const q = query(collection(db, 'notifications'), where('read', '==', false));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;
  const batch = writeBatch(db);
  querySnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { read: true });
  });
  await batch.commit();
};

export const clearReadNotificationsFS = async (): Promise<void> => {
  const q = query(collection(db, 'notifications'), where('read', '==', true));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;
  const batch = writeBatch(db);
  querySnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};


// ========== Client Notification Functions ==========

export const addClientNotificationFS = async (
  notificationData: Omit<ClientNotification, 'id' | 'createdAt' | 'read' | 'clientId'>,
  clientId: string
): Promise<void> => {
  const dataToSave = {
    ...notificationData,
    clientId,
    read: false,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'clientNotifications'), dataToSave);
};

export const addNotificationToAllClientsFS = async (
  notificationData: Omit<ClientNotification, 'id' | 'createdAt' | 'read' | 'clientId'>
): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    const clientsSnapshot = await getDocs(collection(db, 'clients'));
    if (clientsSnapshot.empty) {
      return { success: true, count: 0 };
    }

    const batch = writeBatch(db);
    clientsSnapshot.docs.forEach((clientDoc) => {
      const newNotificationRef = doc(collection(db, 'clientNotifications'));
      const dataToSave = {
        ...notificationData,
        clientId: clientDoc.id,
        read: false,
        createdAt: serverTimestamp(),
      };
      batch.set(newNotificationRef, dataToSave);
    });

    await batch.commit();
    return { success: true, count: clientsSnapshot.size };
  } catch (error: any) {
    console.error('Error sending notification to all clients:', error);
    return { success: false, count: 0, error: error.message };
  }
};

export const getClientNotificationsFS = async (clientId: string): Promise<ClientNotification[]> => {
  const q = query(collection(db, 'clientNotifications'), where('clientId', '==', clientId));
  const querySnapshot = await getDocs(q);
  const notifications = querySnapshot.docs.map((doc) => fromFirestore<ClientNotification>(doc));

  // Sort manually to avoid composite index on (clientId, createdAt)
  notifications.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
    return timeB - timeA;
  });

  return notifications;
};

export const markClientNotificationAsReadFS = async (id: string): Promise<void> => {
  const notificationDoc = doc(db, 'clientNotifications', id);
  await updateDoc(notificationDoc, { read: true });
};

export const clearReadClientNotificationsFS = async (clientId: string): Promise<void> => {
  // Query only by clientId to avoid composite index on (clientId, read)
  const q = query(collection(db, 'clientNotifications'), where('clientId', '==', clientId));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return;

  const batch = writeBatch(db);
  let hasDocsToDelete = false;
  querySnapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.read === true) {
      batch.delete(docSnap.ref);
      hasDocsToDelete = true;
    }
  });

  if (hasDocsToDelete) {
    await batch.commit();
  }
};


// ========== Messaging Functions ==========

export const sendMessageFS = async (
  conversationId: string, // This is the clientId
  clientName: string,
  text: string,
  senderType: 'admin' | 'client'
): Promise<void> => {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  // 1. Add new message to the messages subcollection
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  batch.set(messageRef, {
    conversationId,
    senderId: senderType === 'admin' ? 'admin' : conversationId,
    senderType,
    text,
    createdAt: now,
  });

  // 2. Update/create the conversation document
  const conversationRef = doc(db, 'conversations', conversationId);
  batch.set(conversationRef, {
    clientId: conversationId,
    clientName,
    lastMessage: text,
    lastMessageTimestamp: now,
    unreadByAdmin: senderType === 'client',
    unreadByClient: senderType === 'admin',
  }, { merge: true });

  await batch.commit();
};

export const markConversationAsReadByAdminFS = async (conversationId: string): Promise<void> => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const docSnap = await getDoc(conversationRef);
  if (docSnap.exists()) {
    await updateDoc(conversationRef, { unreadByAdmin: false });
  }
};

export const markConversationAsReadByClientFS = async (conversationId: string): Promise<void> => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const docSnap = await getDoc(conversationRef);
  if (docSnap.exists()) {
      await updateDoc(conversationRef, { unreadByClient: false });
  }
};

// ========== Backup & Restore Functions ==========

const collectionsToBackup = [
    'clients', 'appointments', 'services', 'packages', 'professionals',
    'products', 'financialTransactions', 'notifications', 'clientNotifications',
    'conversations', 'appConfiguration', 'admins'
];

export const backupAllDataFS = async (): Promise<void> => {
    console.log("Starting full data backup...");
    const backupData: Record<string, any[]> = {};

    for (const collectionName of collectionsToBackup) {
        console.log(`Backing up collection: ${collectionName}`);
        const collectionRef = collection(db, collectionName);
        const querySnapshot = await getDocs(collectionRef);
        
        const collectionData = querySnapshot.docs.map(docSnap => fromFirestore(docSnap));

        if (collectionName === 'conversations') {
            for (const convo of collectionData) {
                console.log(`Backing up messages for conversation: ${convo.id}`);
                const messagesRef = collection(db, 'conversations', convo.id, 'messages');
                const messagesSnapshot = await getDocs(messagesRef);
                (convo as any).messages = messagesSnapshot.docs.map(msgSnap => fromFirestore(msgSnap));
            }
        }
        
        backupData[collectionName] = collectionData;
        console.log(`Backed up ${collectionData.length} documents from ${collectionName}`);
    }
    
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    a.download = `nailstudio-ai-backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("Backup process completed.");
};


const rehydrateDocWithTimestamps = (docData: any): any => {
    const data = { ...docData };
    if (data.createdAt && typeof data.createdAt === 'string' && isValid(parseISO(data.createdAt))) {
        data.createdAt = Timestamp.fromDate(parseISO(data.createdAt));
    }
    if (data.updatedAt && typeof data.updatedAt === 'string' && isValid(parseISO(data.updatedAt))) {
        data.updatedAt = Timestamp.fromDate(parseISO(data.updatedAt));
    }
    if (data.lastMessageTimestamp && typeof data.lastMessageTimestamp === 'string' && isValid(parseISO(data.lastMessageTimestamp))) {
        data.lastMessageTimestamp = Timestamp.fromDate(parseISO(data.lastMessageTimestamp));
    }
    // Note: Other date fields like 'date', 'purchaseDate', 'expiryDate' are kept as strings.
    return data;
}

export const restoreAllDataFS = async (backupData: Record<string, any[]>): Promise<{ success: boolean; error?: string }> => {
    const collectionsToRestore = Object.keys(backupData);
    const BATCH_SIZE = 499;

    try {
        for (const collectionName of collectionsToRestore) {
            // Skip subcollections handled separately
            if (collectionName.includes('/')) continue;

            // 1. Clear the existing collection
            console.log(`Clearing collection: ${collectionName}...`);
            const existingDocsSnapshot = await getDocs(collection(db, collectionName));
            if (!existingDocsSnapshot.empty) {
                for (let i = 0; i < existingDocsSnapshot.docs.length; i += BATCH_SIZE) {
                    const chunk = existingDocsSnapshot.docs.slice(i, i + BATCH_SIZE);
                    const deleteBatch = writeBatch(db);
                    chunk.forEach(doc => deleteBatch.delete(doc.ref));
                    await deleteBatch.commit();
                }
            }
            console.log(`Collection ${collectionName} cleared.`);

            // 2. Restore the collection from backup data
            console.log(`Restoring collection: ${collectionName}...`);
            const documentsToRestore = backupData[collectionName];
            if (documentsToRestore && documentsToRestore.length > 0) {
                 for (let i = 0; i < documentsToRestore.length; i += BATCH_SIZE) {
                    const chunk = documentsToRestore.slice(i, i + BATCH_SIZE);
                    const restoreBatch = writeBatch(db);
                    for (const docData of chunk) {
                        const { id, messages, ...restOfData } = docData;
                        if (!id) continue;
                        const docRef = doc(db, collectionName, id);
                        const hydratedData = rehydrateDocWithTimestamps(restOfData);
                        restoreBatch.set(docRef, hydratedData);
                    }
                    await restoreBatch.commit();
                 }
                 console.log(`Restored ${documentsToRestore.length} documents to ${collectionName}.`);

                // 3. Handle subcollections (special case for 'conversations')
                if (collectionName === 'conversations') {
                    for (const convoData of documentsToRestore) {
                        if (convoData.id && convoData.messages && Array.isArray(convoData.messages) && convoData.messages.length > 0) {
                            console.log(`Restoring messages for conversation ${convoData.id}...`);
                            for (let i = 0; i < convoData.messages.length; i += BATCH_SIZE) {
                                const msgChunk = convoData.messages.slice(i, i + BATCH_SIZE);
                                const messagesBatch = writeBatch(db);
                                for (const msgData of msgChunk) {
                                    const { id: msgId, ...restOfMsgData } = msgData;
                                    if (!msgId) continue;
                                    const msgRef = doc(db, 'conversations', convoData.id, 'messages', msgId);
                                    const hydratedMsgData = rehydrateDocWithTimestamps(restOfMsgData);
                                    messagesBatch.set(msgRef, hydratedMsgData);
                                }
                                await messagesBatch.commit();
                            }
                            console.log(`Restored ${convoData.messages.length} messages for conversation ${convoData.id}.`);
                        }
                    }
                }
            }
        }
        return { success: true };
    } catch (e: any) {
        console.error("ERROR DURING BACKUP RESTORE:", e);
        return { success: false, error: e.message || "An unknown error occurred during restore." };
    }
};
