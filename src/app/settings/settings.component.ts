import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../settings.service';
import { AppSettings, InvoiceTemplateId, CurrencyCode, SUPPORTED_CURRENCIES, InvoiceTemplate } from '../core/models/app.models'; // Ensure correct path

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../settings.service';
import { AppSettings, InvoiceTemplateId, CurrencyCode, SUPPORTED_CURRENCIES, InvoiceTemplate, InvoicePrefixSetting } from '../core/models/app.models'; // Ensure correct path & InvoicePrefixSetting

// Helper to generate a simple unique ID (for demo purposes, use a robust library like nanoid in production)
function generateSimpleId(): string {
  return Math.random().toString(36).substring(2, 9);
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  private fb: FormBuilder = inject(FormBuilder);
  private settingsService: SettingsService = inject(SettingsService);

  settingsForm!: FormGroup;
  isLoading = false;
  successMessage: string | null = null;
  errorMessage: string | null = null;

  // For dropdowns
  invoiceTemplates: InvoiceTemplate[] = [
    { id: 'classic', name: 'Classic' },
    { id: 'modern', name: 'Modern' },
    { id: 'simple', name: 'Simple' }
  ];
  supportedCurrencies = SUPPORTED_CURRENCIES;
  paymentTermOptions = [
    { value: 0, label: 'Due on Receipt' },
    { value: 7, label: 'Net 7 Days' },
    { value: 15, label: 'Net 15 Days' },
    { value: 30, label: 'Net 30 Days' },
    { value: 45, label: 'Net 45 Days' },
    { value: 60, label: 'Net 60 Days' }
  ];

  constructor() {}

  ngOnInit(): void {
    this.buildForm(); // Build form with initial structure (empty or default)
    this.loadSettings(); // Load settings and populate/rebuild form
  }

  private buildForm(initialSettings?: AppSettings | null): void {
    const defaults = initialSettings || this.settingsService['getDefaultSettings']();

    this.settingsForm = this.fb.group({
      companyInformation: this.fb.group({
        companyName: [defaults.companyInformation?.companyName || '', Validators.required],
        address: [defaults.companyInformation?.address || ''],
        email: [defaults.companyInformation?.email || '', Validators.email],
        phone: [defaults.companyInformation?.phone || ''],
        gstOrTaxId: [defaults.companyInformation?.gstOrTaxId || '']
      }),
      invoiceSettings: this.fb.group({
        defaultTemplateId: [defaults.invoiceSettings?.defaultTemplateId || 'classic', Validators.required],
        defaultPaymentTermsDays: [defaults.invoiceSettings?.defaultPaymentTermsDays || 0, Validators.required],
        invoicePrefixes: this.fb.array([]), // Initialize as empty FormArray
        defaultPrefixId: [defaults.invoiceSettings?.defaultPrefixId || '', Validators.required],
        autoIncrementInvoiceNumber: [defaults.invoiceSettings?.autoIncrementInvoiceNumber !== undefined ? defaults.invoiceSettings.autoIncrementInvoiceNumber : true],
        defaultGstRate: [defaults.invoiceSettings?.defaultGstRate || 0, [Validators.min(0), Validators.max(100)]],
        defaultCurrencyCode: [defaults.invoiceSettings?.defaultCurrencyCode || 'INR', Validators.required]
      }),
      paymentSettings: this.fb.group({
        acceptedPaymentMethodsDetails: [defaults.paymentSettings?.acceptedPaymentMethodsDetails || '']
      }),
      userProfileSettings: this.fb.group({
        userName: [defaults.userProfileSettings?.userName || '', Validators.required],
        userEmail: [defaults.userProfileSettings?.userEmail || '', Validators.email]
      })
    });

    // Populate invoicePrefixes FormArray if initialSettings are provided
    if (initialSettings && initialSettings.invoiceSettings && initialSettings.invoiceSettings.invoicePrefixes) {
      initialSettings.invoiceSettings.invoicePrefixes.forEach(prefixSetting => {
        this.invoicePrefixesArray.push(this.createInvoicePrefixGroup(prefixSetting));
      });
    } else if (defaults.invoiceSettings && defaults.invoiceSettings.invoicePrefixes) {
      // Populate with default if no initial settings but defaults exist
      defaults.invoiceSettings.invoicePrefixes.forEach(prefixSetting => {
        this.invoicePrefixesArray.push(this.createInvoicePrefixGroup(prefixSetting));
      });
    }
  }

  // Getter for easy access to the FormArray
  get invoicePrefixesArray(): FormArray {
    return this.settingsForm.get('invoiceSettings.invoicePrefixes') as FormArray;
  }

  // Creates a FormGroup for an InvoicePrefixSetting
  private createInvoicePrefixGroup(prefixSetting?: InvoicePrefixSetting): FormGroup {
    const newId = prefixSetting?.id || generateSimpleId();
    return this.fb.group({
      id: [newId, Validators.required], // Keep ID, useful for tracking, especially if items can be reordered or specifically targeted.
      prefix: [prefixSetting?.prefix || '', Validators.required],
      nextInvoiceNumber: [prefixSetting?.nextInvoiceNumber || 1, [Validators.required, Validators.min(1)]]
    });
  }

  // Adds a new prefix configuration to the FormArray
  addInvoicePrefix(): void {
    this.invoicePrefixesArray.push(this.createInvoicePrefixGroup());
    // If this is the first prefix added, make it the default
    if (this.invoicePrefixesArray.length === 1) {
      this.settingsForm.get('invoiceSettings.defaultPrefixId')?.setValue(this.invoicePrefixesArray.at(0).get('id')?.value);
    }
  }

  // Removes a prefix configuration from the FormArray
  removeInvoicePrefix(index: number): void {
    const removedPrefixId = this.invoicePrefixesArray.at(index).get('id')?.value;
    this.invoicePrefixesArray.removeAt(index);

    // If the removed prefix was the default, and there are other prefixes, set the first one as new default.
    // If no prefixes left, clear defaultPrefixId.
    const currentDefaultPrefixId = this.settingsForm.get('invoiceSettings.defaultPrefixId')?.value;
    if (removedPrefixId === currentDefaultPrefixId) {
      if (this.invoicePrefixesArray.length > 0) {
        this.settingsForm.get('invoiceSettings.defaultPrefixId')?.setValue(this.invoicePrefixesArray.at(0).get('id')?.value);
      } else {
        this.settingsForm.get('invoiceSettings.defaultPrefixId')?.setValue('');
      }
    }
  }


  loadSettings(): void {
    this.isLoading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        if (settings) {
          // Rebuild the form with loaded settings to correctly initialize FormArray
          this.buildForm(settings);
        } else {
          // buildForm was already called in ngOnInit with defaults
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load settings. Using default values.';
        console.error('Error loading settings:', err);
        this.isLoading = false;
        // buildForm was already called in ngOnInit with defaults
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.settingsForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form. Note that a default prefix must be selected if prefixes are defined.';
      this.settingsForm.markAllAsTouched();
      setTimeout(() => this.errorMessage = null, 7000);
      return;
    }
     if (this.invoicePrefixesArray.length > 0 && !this.settingsForm.get('invoiceSettings.defaultPrefixId')?.value) {
      this.errorMessage = 'Please select a default invoice prefix if you have defined one or more prefixes.';
      this.settingsForm.get('invoiceSettings.defaultPrefixId')?.markAsTouched();
      setTimeout(() => this.errorMessage = null, 7000);
      return;
    }


    this.isLoading = true;
    this.successMessage = null;
    this.errorMessage = null;

    const formValues = this.settingsForm.getRawValue(); // Use getRawValue to include IDs from disabled fields if any

    const settingsToSave: AppSettings = {
      companyInformation: formValues.companyInformation,
      invoiceSettings: {
        ...formValues.invoiceSettings,
        invoicePrefixes: formValues.invoiceSettings.invoicePrefixes.map((p: any) => ({
          id: p.id, // Ensure ID is part of the saved data
          prefix: p.prefix,
          nextInvoiceNumber: Number(p.nextInvoiceNumber) // Ensure number
        })),
        defaultPaymentTermsDays: Number(formValues.invoiceSettings.defaultPaymentTermsDays),
        defaultGstRate: Number(formValues.invoiceSettings.defaultGstRate),
      },
      paymentSettings: formValues.paymentSettings,
      userProfileSettings: formValues.userProfileSettings
    };

    try {
      await this.settingsService.saveSettings(settingsToSave);
      this.settingsService.clearCache(); // Important: clear cache after saving
      this.successMessage = 'Settings saved successfully!';
      this.settingsService.clearCache(); // Ensure next load gets fresh data
      // Optionally, reload settings into the form if saveSettings modifies data (e.g. server-side changes)
      // this.loadSettings();
    } catch (err) {
      this.errorMessage = 'Failed to save settings. Please try again.';
      console.error('Error saving settings:', err);
    } finally {
      this.isLoading = false;
      setTimeout(() => {
        this.successMessage = null;
        this.errorMessage = null;
      }, 5000);
    }
  }
}
