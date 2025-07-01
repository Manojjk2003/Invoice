import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, DocumentReference } from '@angular/fire/firestore';
import { AppSettings, CompanyInformation, InvoiceSettings, PaymentSettings, UserProfileSettings, DEFAULT_TEMPLATE_ID, DEFAULT_CURRENCY_CODE } from './core/models/app.models'; // Ensure correct path
import { Observable, from, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private firestore: Firestore;
  private settingsDocRef: DocumentReference<AppSettings>;
  private readonly SETTINGS_DOC_ID = 'user_app_settings'; // Fixed ID for the single settings document
  private settingsCache$: Observable<AppSettings | null> | null = null;

  constructor() {
    this.firestore = inject(Firestore);
    // Note: Type casting to DocumentReference<AppSettings> for stronger type safety with Firestore v9
    this.settingsDocRef = doc(this.firestore, 'app_settings', this.SETTINGS_DOC_ID) as DocumentReference<AppSettings>;
  }

  private getDefaultSettings(): AppSettings {
    const defaultPrefixId = 'default_inv_prefix';
    return {
      id: this.SETTINGS_DOC_ID,
      companyInformation: {
        companyName: '',
        address: '',
        email: '',
        phone: '',
        gstOrTaxId: ''
      },
      invoiceSettings: {
        defaultTemplateId: DEFAULT_TEMPLATE_ID,
        defaultPaymentTermsDays: 0, // Due on receipt
        invoicePrefixes: [
          { id: defaultPrefixId, prefix: 'INV-', nextInvoiceNumber: 1 }
        ],
        defaultPrefixId: defaultPrefixId,
        autoIncrementInvoiceNumber: true,
        defaultGstRate: 18, // Default to 18%
        defaultCurrencyCode: DEFAULT_CURRENCY_CODE
      },
      paymentSettings: {
        acceptedPaymentMethodsDetails: 'Bank Transfer:\nAccount Name: \nAccount Number: \nBank: \nIFSC: \n\nUPI ID: '
      },
      userProfileSettings: {
        userName: '',
        userEmail: ''
      }
    };
  }

  // Get settings, using a cache to avoid multiple reads for the same session
  getSettings(): Observable<AppSettings | null> {
    if (!this.settingsCache$) {
      this.settingsCache$ = from(getDoc(this.settingsDocRef)).pipe(
        map(docSnap => {
          if (docSnap.exists()) {
            // Merge with defaults to ensure all properties are present if some were missing from DB
            const dbSettings = docSnap.data();
            const defaults = this.getDefaultSettings();
            return {
              ...defaults,
              ...dbSettings,
              companyInformation: { ...defaults.companyInformation, ...dbSettings.companyInformation },
              invoiceSettings: { ...defaults.invoiceSettings, ...dbSettings.invoiceSettings },
              paymentSettings: { ...defaults.paymentSettings, ...dbSettings.paymentSettings },
              userProfileSettings: { ...defaults.userProfileSettings, ...dbSettings.userProfileSettings },
            } as AppSettings;
          } else {
            // No settings found, return defaults (and perhaps save them for next time)
            console.warn('No settings document found, returning default settings. Consider saving them once initially.');
            return this.getDefaultSettings();
          }
        }),
        catchError(error => {
          console.error("Error fetching settings:", error);
          // Return defaults on error as well, so the app can function
          return of(this.getDefaultSettings());
        }),
        shareReplay(1) // Cache the last emitted value and replay for subsequent subscribers
      );
    }
    return this.settingsCache$;
  }

  // Save settings (creates or overwrites the document)
  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Ensure the ID is not part of the data being saved if it's on the object
      const { id, ...settingsData } = settings;
      await setDoc(this.settingsDocRef, settingsData, { merge: true }); // Use merge:true to be safe if document exists
      this.clearCache(); // Clear cache so next getSettings fetches fresh data
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  }

  // Utility to update only a part of the settings, e.g. nextInvoiceNumber
  // This method is no longer suitable as nextInvoiceNumber is per-prefix.
  // The InvoiceFormComponent will now be responsible for updating the specific prefix's
  // nextInvoiceNumber within the AppSettings object and calling saveSettings.
  // Consider removing this method or adapting it if a specific use case for updating
  // a single prefix's next number directly via the service is still needed.
  // For now, it will be commented out to avoid compilation errors and indicate it needs rethinking.
  /*
  async updateInvoiceNumberSetting(prefixId: string, nextInvoiceNumber: number): Promise<void> {
    try {
      // This is complex because invoicePrefixes is an array.
      // One would need to read the document, update the array, and write it back.
      // Or, structure Firestore data differently (e.g., prefixes as a subcollection).
      // For simplicity with the current structure, updating the whole settings object from
      // the component after modification is easier.
      console.warn('updateInvoiceNumberSetting is deprecated. Save the whole AppSettings object.');
      // Example of how it might be done if absolutely necessary (but error-prone and racy):
      // const currentSettings = await getDoc(this.settingsDocRef).then(d => d.data());
      // if (currentSettings && currentSettings.invoiceSettings && currentSettings.invoiceSettings.invoicePrefixes) {
      //   const prefixSetting = currentSettings.invoiceSettings.invoicePrefixes.find(p => p.id === prefixId);
      //   if (prefixSetting) {
      //     prefixSetting.nextInvoiceNumber = nextInvoiceNumber;
      //     await setDoc(this.settingsDocRef, currentSettings); // Overwrites entire settings
      //     this.clearCache();
      //   } else {
      //     throw new Error(`Prefix with ID ${prefixId} not found.`);
      //   }
      // } else {
      //   throw new Error('Settings or prefixes not found.');
      // }
      throw new Error('This method is deprecated. Save the full AppSettings from the component.');
    } catch (error) {
        console.error("Error updating next invoice number directly:", error);
        throw error;
    }
  }
  */

  clearCache(): void {
    this.settingsCache$ = null;
  }
}
