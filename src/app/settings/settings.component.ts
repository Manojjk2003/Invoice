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
  supportedCurrencies = SUPPORTED_CURRENCIES; // Already an array of Currency objects
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
    this.buildForm();
    this.loadSettings();
  }

  private buildForm(initialSettings?: AppSettings | null): void {
    const defaults = initialSettings || this.settingsService['getDefaultSettings'](); // Access private for defaults structure

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
        invoiceNumberPrefix: [defaults.invoiceSettings?.invoiceNumberPrefix || 'INV-'],
        nextInvoiceNumber: [defaults.invoiceSettings?.nextInvoiceNumber || 1, [Validators.required, Validators.min(1)]],
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
  }

  loadSettings(): void {
    this.isLoading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        if (settings) {
          // Re-build or patch form. Patching is fine if structure is consistent.
          // Using patchValue to ensure it only updates fields present in settings.
          this.settingsForm.patchValue(settings);
        } else {
          // Form is already built with defaults if settings are null
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = 'Failed to load settings. Using default values.';
        console.error('Error loading settings:', err);
        this.isLoading = false;
        // Form already initialized with defaults by buildForm() if initialSettings was null
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.settingsForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form.';
      this.settingsForm.markAllAsTouched(); // Show validation errors
      setTimeout(() => this.errorMessage = null, 5000);
      return;
    }

    this.isLoading = true;
    this.successMessage = null;
    this.errorMessage = null;

    const formValues = this.settingsForm.value;

    // Construct the AppSettings object carefully from form values
    const settingsToSave: AppSettings = {
      // id is not part of the form, it's managed by the service
      companyInformation: formValues.companyInformation,
      invoiceSettings: {
        ...formValues.invoiceSettings,
        // Ensure numbers are numbers
        defaultPaymentTermsDays: Number(formValues.invoiceSettings.defaultPaymentTermsDays),
        nextInvoiceNumber: Number(formValues.invoiceSettings.nextInvoiceNumber),
        defaultGstRate: Number(formValues.invoiceSettings.defaultGstRate),
      },
      paymentSettings: formValues.paymentSettings,
      userProfileSettings: formValues.userProfileSettings
    };

    try {
      await this.settingsService.saveSettings(settingsToSave);
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
