import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { InvoiceService } from './invoice.service';
import { CustomerService } from '../customer.service';
import {
  Customer, Invoice, InvoiceItem,
  InvoiceTemplate, InvoiceTemplateId, DEFAULT_TEMPLATE_ID,
  Currency, CurrencyCode, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY_CODE,
  ProductOrService, AppSettings, InvoicePrefixSetting // Added AppSettings and InvoicePrefixSetting
} from '../core/models/app.models'; // Import currency models
import { ProductService } from '../product.service'; // Added
import { SettingsService } from '../settings.service'; // Added SettingsService
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-invoice-form',
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.css']
})
export class InvoiceFormComponent implements OnInit {
  invoiceForm!: FormGroup;
  newCustomerForm!: FormGroup;

  // logoFile: File | null = null; // Removed: Logo upload per invoice is removed
  customers: Customer[] = [];
  showNewCustomer = false;
  products: ProductOrService[] = []; // Added for product selection
  isLoadingProducts = false; // Added

  // For user feedback
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoadingCustomers = false;
  isSavingCustomer = false;
  isSavingInvoice = false;
  isLoadingSettings = false;

  appSettings: AppSettings | null = null; // Made public for template access
  availablePrefixes: InvoicePrefixSetting[] = [];
  private settingsSubscription!: Subscription;


  invoiceTemplates: InvoiceTemplate[] = [
    { id: 'classic', name: 'Classic' },
    { id: 'modern', name: 'Modern' },
    { id: 'simple', name: 'Simple' }
  ];

  supportedCurrencies: Currency[] = SUPPORTED_CURRENCIES;
  defaultCurrencyCode: CurrencyCode = DEFAULT_CURRENCY_CODE; // For template fallback

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService,
    private customerService: CustomerService,
    private productService: ProductService, // Added
    private settingsService: SettingsService // Added
  ) {}

  ngOnInit(): void {
    // Initialize form with basic structure first
    this.invoiceForm = this.fb.group({
      customer: ['', Validators.required],
      clientManager: ['', Validators.required], // Will be updated by settings
      templateId: [DEFAULT_TEMPLATE_ID, Validators.required], // Will be updated by settings
      currency: [DEFAULT_CURRENCY_CODE, Validators.required], // Will be updated by settings
      dueDate: [null], // Added for due date
      items: this.fb.array([]),
      discountType: [null], // 'percentage', 'fixed', or null for no discount
      discountValue: [null],  // Numerical value of the discount
      // New controls for invoice numbering
      selectedPrefixId: [''], // Will be patched by settings
      invoiceNumberGenerationMode: ['auto', Validators.required],
      manualInvoiceNumber: [{ value: '', disabled: true }],
      // New control for round-off
      applyRoundOff: [false]
    });

    // Subscribe to mode changes to enable/disable manualInvoiceNumber
    this.invoiceForm.get('invoiceNumberGenerationMode')?.valueChanges.subscribe(mode => {
      const manualInvoiceNumberControl = this.invoiceForm.get('manualInvoiceNumber');
      if (mode === 'manual') {
        manualInvoiceNumberControl?.enable();
        manualInvoiceNumberControl?.setValidators(Validators.required);
      } else {
        manualInvoiceNumberControl?.disable();
        manualInvoiceNumberControl?.clearValidators();
      }
      manualInvoiceNumberControl?.updateValueAndValidity();
    });

    this.newCustomerForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      address: [''],
      // Indian GSTIN: 15 alphanumeric characters.
      // Format: 2 state code digits, 10 PAN chars, 1 entity code, 1 checksum char 'Z', 1 checksum digit/char.
      // Simple pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      // For simplicity, a less strict pattern for now, can be refined.
      gst: ['', [Validators.pattern(/^[a-zA-Z0-9]{15}$/)]],
      phone: ['', [Validators.pattern(/^\d{10}$/)]], // Simple 10-digit phone number
      contact: [''] // General contact person, no specific validation here
    });

    this.loadAppSettings(); // Load settings first
    this.loadCustomers();
    this.loadProducts(); // Added
    this.addItem(); // Add an initial line item
  }

  loadAppSettings(): void {
    this.isLoadingSettings = true;
    // Unsubscribe from previous subscription if any, to prevent memory leaks
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }

    this.settingsSubscription = this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.appSettings = settings;
        this.availablePrefixes = settings?.invoiceSettings?.invoicePrefixes || [];
        let defaultPrefixIdToSet = '';

        if (settings && settings.invoiceSettings) {
          defaultPrefixIdToSet = settings.invoiceSettings.defaultPrefixId || '';
          // Ensure the defaultPrefixId actually exists in the available prefixes
          if (defaultPrefixIdToSet && !this.availablePrefixes.find(p => p.id === defaultPrefixIdToSet)) {
            console.warn(`Default prefix ID "${defaultPrefixIdToSet}" not found in available prefixes. Falling back.`);
            defaultPrefixIdToSet = this.availablePrefixes.length > 0 ? this.availablePrefixes[0].id : '';
          } else if (!defaultPrefixIdToSet && this.availablePrefixes.length > 0) {
            // If no default is set but prefixes exist, pick the first as default
            defaultPrefixIdToSet = this.availablePrefixes[0].id;
          }

          this.invoiceForm.patchValue({
            clientManager: settings.userProfileSettings?.userName || '',
            templateId: settings.invoiceSettings.defaultTemplateId || DEFAULT_TEMPLATE_ID,
            currency: settings.invoiceSettings.defaultCurrencyCode || DEFAULT_CURRENCY_CODE,
            selectedPrefixId: defaultPrefixIdToSet,
            // invoiceNumberGenerationMode and manualInvoiceNumber are handled by their own logic
          });
        } else {
          // Handle case where settings might be null (though service provides defaults)
           this.invoiceForm.patchValue({
            clientManager:  '',
            templateId: DEFAULT_TEMPLATE_ID,
            currency:  DEFAULT_CURRENCY_CODE,
            selectedPrefixId: this.availablePrefixes.length > 0 ? this.availablePrefixes[0].id : '',
          });
        }
        // Trigger manualInvoiceNumber enable/disable based on current mode
        this.invoiceForm.get('invoiceNumberGenerationMode')?.updateValueAndValidity({ emitEvent: true });
        this.isLoadingSettings = false;
      },
      error: (err) => {
        console.error('Error loading app settings for invoice form:', err);
        this.errorMessage = 'Failed to load application settings. Using defaults.';
        this.isLoadingSettings = false;
      }
    });
  }

  async loadCustomers() {
    this.isLoadingCustomers = true;
    this.errorMessage = null;
    try {
      this.customers = await this.customerService.getCustomers();
    } catch (error) {
      this.errorMessage = 'Failed to load customers. Please try again.';
      console.error('Error loading customers:', error);
    } finally {
      this.isLoadingCustomers = false;
    }
  }

  loadProducts(): void { // Added method
    this.isLoadingProducts = true;
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.isLoadingProducts = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.errorMessage = 'Failed to load products/services. Please try again.';
        this.isLoadingProducts = false;
      }
    });
  }

  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  createItem(): FormGroup {
    const itemGroup = this.fb.group({
      productId: [null], // Added for product selection
      description: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [null, [Validators.required, Validators.min(0.01)]],
      lineTotal: [{ value: 0, disabled: true }] // Calculated, so disabled
    });

    // Subscribe to quantity and unitPrice changes to update lineTotal
    itemGroup.get('quantity')?.valueChanges.subscribe(() => this.updateLineTotal(itemGroup));
    itemGroup.get('unitPrice')?.valueChanges.subscribe(() => this.updateLineTotal(itemGroup));

    return itemGroup;
  }

  onProductSelected(itemIndex: number, event: Event): void { // Added method
    const selectedProductId = (event.target as HTMLSelectElement).value;
    if (!selectedProductId) {
      // Optionally reset description and unit price if "Select Product" is chosen
      // Or, allow manual override by not doing anything here.
      // For now, let's clear them if the user deselects a product.
      const currentItem = this.items.at(itemIndex) as FormGroup;
      // currentItem.patchValue({
      //   description: '', // Or keep existing description if user wants to customize
      //   unitPrice: null
      // });
      return;
    }

    const product = this.products.find(p => p.id === selectedProductId);
    if (product) {
      const itemFormGroup = this.items.at(itemIndex) as FormGroup;
      itemFormGroup.patchValue({
        description: product.name + (product.description ? ` (${product.description})` : ''), // Combine name and description
        unitPrice: product.defaultUnitPrice,
        // productId is already set by the form control binding
      });
      this.updateLineTotal(itemFormGroup); // Ensure line total is updated
    }
  }

  updateLineTotal(itemGroup: FormGroup): void {
    const quantity = Number(itemGroup.get('quantity')?.value) || 0;
    const unitPrice = Number(itemGroup.get('unitPrice')?.value) || 0;
    itemGroup.get('lineTotal')?.setValue(quantity * unitPrice, { emitEvent: false });
  }

  addItem() {
    this.items.push(this.createItem());
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  toggleNewCustomer() {
    this.showNewCustomer = !this.showNewCustomer;
    this.newCustomerForm.reset();
    this.errorMessage = null; // Clear previous errors
  }

  async saveNewCustomer() {
    if (this.newCustomerForm.invalid) {
      this.errorMessage = 'Please fill in all required fields for the new customer (Name).';
      this.markFormGroupTouched(this.newCustomerForm);
      return;
    }
    this.isSavingCustomer = true;
    this.errorMessage = null;
    this.successMessage = null;

    const customerData: Omit<Customer, 'id'> = this.newCustomerForm.value;

    try {
      const customerId = await this.customerService.addCustomer(customerData);
      await this.loadCustomers(); // Refresh customer list
      this.invoiceForm.patchValue({ customer: customerId });
      this.showNewCustomer = false;
      this.newCustomerForm.reset();
      this.successMessage = 'New customer saved successfully!';
    } catch (error: any) {
      if (error.message?.startsWith('DUPLICATE_EMAIL:')) {
        this.errorMessage = error.message.replace('DUPLICATE_EMAIL: ', ''); // Show specific duplicate message
        // Optionally, mark the email field as invalid
        this.newCustomerForm.get('email')?.setErrors({ duplicate: true });
      } else {
        this.errorMessage = 'Failed to save new customer. Please try again.';
        console.error('Error saving new customer:', error);
      }
    } finally {
      this.isSavingCustomer = false;
    }
  }

  // onLogoUpload(event: Event) { // Removed
  //   const element = event.currentTarget as HTMLInputElement;
  //   const fileList: FileList | null = element.files;
  //   if (fileList && fileList.length > 0) {
  //     this.logoFile = fileList[0];
  //     this.invoiceForm.patchValue({ logo: '' }); // Clear any previous logo URL if a new file is chosen
  //     this.successMessage = `Selected logo: ${this.logoFile.name}`;
  //   } else {
  //     this.logoFile = null;
  //   }
  // }

  async saveInvoice() {
    if (this.invoiceForm.invalid) {
      this.errorMessage = 'Please fill in all required fields in the invoice.';
      this.markFormGroupTouched(this.invoiceForm);
      return;
    }
    if (this.items.length === 0) {
      this.errorMessage = 'Please add at least one item to the invoice.';
      return;
    }

    this.isSavingInvoice = true;
    this.errorMessage = null;
    this.successMessage = null;
    // let logoUrl = this.invoiceForm.get('logo')?.value || ''; // Logo URL is not set per invoice anymore

    try {
      const formValue = this.invoiceForm.getRawValue();
      let invoiceNumber = '';

      const generationMode = formValue.invoiceNumberGenerationMode;

      if (generationMode === 'auto') {
        if (!this.appSettings || !this.appSettings.invoiceSettings || !this.appSettings.invoiceSettings.invoicePrefixes) {
          this.errorMessage = 'Invoice prefix settings are not loaded. Cannot generate invoice number.';
          this.isSavingInvoice = false;
          return;
        }
        const selectedPrefixId = formValue.selectedPrefixId;
        const prefixSetting = this.appSettings.invoiceSettings.invoicePrefixes.find(p => p.id === selectedPrefixId);

        if (!prefixSetting) {
          this.errorMessage = 'Selected invoice prefix configuration not found. Please check settings.';
          this.isSavingInvoice = false;
          return;
        }
        invoiceNumber = `${prefixSetting.prefix}${prefixSetting.nextInvoiceNumber}`;
      } else { // Manual mode
        invoiceNumber = formValue.manualInvoiceNumber;
        if (!invoiceNumber || invoiceNumber.trim() === '') {
           this.errorMessage = 'Manual invoice number cannot be empty.';
           this.invoiceForm.get('manualInvoiceNumber')?.setErrors({ required: true });
           this.isSavingInvoice = false;
           return;
        }
      }

      let dueDate: Date | undefined = undefined;
      if (formValue.dueDate) {
        dueDate = new Date(formValue.dueDate);
      } else if (this.appSettings?.invoiceSettings?.defaultPaymentTermsDays !== undefined) {
        const paymentTermsDays = this.appSettings.invoiceSettings.defaultPaymentTermsDays;
        if (typeof paymentTermsDays === 'number' && paymentTermsDays >= 0) {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + paymentTermsDays);
        }
      }


      const invoiceData: Omit<Invoice, 'id' | 'paymentStatus' | 'totalPaid'> = {
        customer: formValue.customer,
        clientManager: formValue.clientManager,
        templateId: formValue.templateId,
        currency: formValue.currency,
        invoiceNumber: invoiceNumber, // Added generated invoice number
        date: new Date(), // Current date for invoice creation
        dueDate: dueDate, // Calculated or form-provided due date
        items: formValue.items.map((item: any) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          lineTotal: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        })),
        subtotal: this.subtotal,
        discountType: formValue.discountType,
        discountValue: formValue.discountValue ? Number(formValue.discountValue) : null,
        discountAmount: this.calculatedDiscountAmount,
        gst: this.gst,
        totalBeforeRoundOff: this.calculatedTotal, // Use the getter
        roundOffAmount: this.applyRoundOff?.value ? this.roundOffAmountValue : undefined, // Use getter, store only if applied
        grandTotal: this.grandTotalValue, // Use the getter
        amountInWords: this.amountInWords, // Already uses grandTotalValue
      };

      const newInvoiceId = await this.invoiceService.createInvoice(invoiceData);
      this.successMessage = `Invoice ${invoiceNumber} saved successfully! (ID: ${newInvoiceId})`;

      // Increment next invoice number in settings if auto-generation and auto-increment are enabled
      if (generationMode === 'auto' &&
          this.appSettings &&
          this.appSettings.invoiceSettings &&
          this.appSettings.invoiceSettings.autoIncrementInvoiceNumber) {

        const selectedPrefixId = formValue.selectedPrefixId;
        // Create a deep copy of appSettings to modify, ensuring invoicePrefixes is also copied.
        const updatedSettings: AppSettings = JSON.parse(JSON.stringify(this.appSettings));

        if (updatedSettings.invoiceSettings && updatedSettings.invoiceSettings.invoicePrefixes) {
          const prefixSettingToUpdate = updatedSettings.invoiceSettings.invoicePrefixes.find(p => p.id === selectedPrefixId);
          if (prefixSettingToUpdate) {
            prefixSettingToUpdate.nextInvoiceNumber += 1;
            try {
              await this.settingsService.saveSettings(updatedSettings);
              // Update the local appSettings to reflect the change for the next invoice within this session
              this.appSettings = updatedSettings;
              this.availablePrefixes = updatedSettings.invoiceSettings.invoicePrefixes; // Refresh available prefixes view if needed
            } catch (settingsError) {
              console.error("Failed to update next invoice number in settings:", settingsError);
              // Append to success message or set a separate warning
              this.successMessage += " (Warning: Failed to update next invoice number in settings.)";
            }
          } else {
            console.error("Selected prefix for increment not found in updatedSettings. This should not happen.");
          }
        }
      }

      this.resetInvoiceForm();

    } catch (error) {
      this.errorMessage = 'Failed to save invoice. Please try again.';
      console.error('Error saving invoice:', error);
    } finally {
      this.isSavingInvoice = false;
    }
  }

  get subtotal(): number {
    // Subtotal is sum of lineTotals
    return this.items.controls.reduce((sum, itemControl) => {
      const quantity = Number(itemControl.get('quantity')?.value) || 0;
      const unitPrice = Number(itemControl.get('unitPrice')?.value) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  }

  get calculatedDiscountAmount(): number {
    const type = this.invoiceForm.get('discountType')?.value;
    const value = Number(this.invoiceForm.get('discountValue')?.value) || 0;
    const currentSubtotal = this.subtotal;

    if (!type || value <= 0) {
      return 0;
    }

    if (type === 'percentage') {
      if (value > 100) return 0; // Cap percentage discount at 100%
      return (currentSubtotal * value) / 100;
    } else if (type === 'fixed') {
      return Math.min(currentSubtotal, value); // Fixed discount cannot exceed subtotal
    }
    return 0;
  }

  get subtotalAfterDiscount(): number {
    return this.subtotal - this.calculatedDiscountAmount;
  }

  get gstRate(): number {
    // Use rate from settings if available, otherwise fallback. Rate stored as e.g. 18 for 18%.
    const rate = this.appSettings?.invoiceSettings?.defaultGstRate;
    return (typeof rate === 'number' ? rate : 18) / 100; // Default to 18% if not set or invalid
  }

  get gst(): number {
    // GST should be calculated on the subtotal after discount
    return this.subtotalAfterDiscount * this.gstRate;
  }

  // Renamed from 'total'
  get calculatedTotal(): number {
    return this.subtotalAfterDiscount + this.gst;
  }

  get applyRoundOff(): AbstractControl | null {
    return this.invoiceForm.get('applyRoundOff');
  }

  get roundOffAmountValue(): number {
    if (this.applyRoundOff?.value) {
      // Ensure calculatedTotal is a number with at most 2 decimal places for precise rounding diff
      const total = parseFloat(this.calculatedTotal.toFixed(2));
      const roundedTotal = Math.round(total);
      return parseFloat((roundedTotal - total).toFixed(2));
    }
    return 0;
  }

  get grandTotalValue(): number {
    if (this.applyRoundOff?.value) {
      return Math.round(this.calculatedTotal);
    }
    return parseFloat(this.calculatedTotal.toFixed(2)); // Ensure consistent 2 decimal places if not rounding
  }

  get amountInWords(): string {
    return this.numberToWords(this.grandTotalValue); // Amount in words should reflect the final grand total
  }

  // Basic number to words converter for Indian numbering system (Lakhs, Crores) up to 99 Crores.
  // This is a simplified version. For production, a robust library is recommended.
  private numberToWords(num: number): string {
    if (num === 0) return 'Zero Rupees Only';
    if (num < 0) return 'Minus ' + this.numberToWords(Math.abs(num));

    const indianSystem = [
        {value: 10000000, str: "Crore"},
        {value: 100000, str: "Lakh"},
        {value: 1000, str: "Thousand"},
        {value: 100, str: "Hundred"},
    ];

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    let result = '';
    let number = Math.floor(num); // Integer part
    let decimalPart = Math.round((num - number) * 100);


    function convertLessThanOneThousand(n: number): string {
        let currentResult = '';
        if (n >= 100) {
            currentResult += ones[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            currentResult += tens[Math.floor(n / 10)] + ' ';
            n %= 10;
        }
        if (n > 0) {
            currentResult += ones[n] + ' ';
        }
        return currentResult.trim();
    }

    if (number === 0) {
        result = "Zero";
    } else {
        for (let i = 0; i < indianSystem.length; i++) {
            const {value, str} = indianSystem[i];
            if (number >= value) {
                result += convertLessThanOneThousand(Math.floor(number / value)) + ' ' + str + ' ';
                number %= value;
            }
        }
        if (number > 0) {
            result += convertLessThanOneThousand(number);
        }
    }

    result = result.trim() + ' Rupees';

    if (decimalPart > 0) {
        result += ' and ' + convertLessThanOneThousand(decimalPart) + ' Paise';
    }

    return result.trim() + ' Only';
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    (<any>Object).values(formGroup.controls).forEach((control: AbstractControl) => {
      control.markAsTouched();
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private resetInvoiceForm(): void {
    const defaultPrefixId = this.appSettings?.invoiceSettings?.defaultPrefixId ||
                           (this.availablePrefixes.length > 0 ? this.availablePrefixes[0].id : '');

    this.invoiceForm.reset({
      customer: '',
      clientManager: this.appSettings?.userProfileSettings?.userName || '',
      templateId: this.appSettings?.invoiceSettings?.defaultTemplateId || DEFAULT_TEMPLATE_ID,
      currency: this.appSettings?.invoiceSettings?.defaultCurrencyCode || DEFAULT_CURRENCY_CODE,
      dueDate: null,
      discountType: null,
      discountValue: null,
      selectedPrefixId: defaultPrefixId,
      invoiceNumberGenerationMode: 'auto',
      manualInvoiceNumber: '', // Will be disabled by the mode change subscription
      applyRoundOff: false // Reset round-off toggle
    });
    this.items.clear();
    this.addItem(); // Add one empty item back

    // Explicitly update the state of manualInvoiceNumber control based on the reset mode
     const manualInvoiceNumberControl = this.invoiceForm.get('manualInvoiceNumber');
    manualInvoiceNumberControl?.disable();
    manualInvoiceNumberControl?.clearValidators();
    manualInvoiceNumberControl?.updateValueAndValidity();
  }

  ngOnDestroy(): void {
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }
}