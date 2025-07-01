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
  ProductOrService, AppSettings // Added AppSettings
} from '../core/models/app.models'; // Import currency models
import { ProductService } from '../product.service'; // Added
import { SettingsService } from '../settings.service'; // Added SettingsService

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
  isLoadingSettings = false; // Added

  private appSettings: AppSettings | null = null; // Added

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
      discountValue: [null]  // Numerical value of the discount
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
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        this.appSettings = settings;
        if (settings) {
          // Patch form with settings defaults
          this.invoiceForm.patchValue({
            clientManager: settings.userProfileSettings?.userName || '',
            templateId: settings.invoiceSettings?.defaultTemplateId || DEFAULT_TEMPLATE_ID,
            currency: settings.invoiceSettings?.defaultCurrencyCode || DEFAULT_CURRENCY_CODE,
            // Due date will be calculated based on payment terms later or can be set here if simple
          });
          // Update gstRate based on settings
          // this.gstRate = (settings.invoiceSettings?.defaultGstRate || 0) / 100; // Getter will handle this
        }
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
      const formValue = this.invoiceForm.getRawValue(); // Use getRawValue to include disabled fields like lineTotal
      let invoiceNumber = '';
      let nextInvoiceNum = 1;

      if (this.appSettings && this.appSettings.invoiceSettings) {
        const prefix = this.appSettings.invoiceSettings.invoiceNumberPrefix || '';
        nextInvoiceNum = this.appSettings.invoiceSettings.nextInvoiceNumber || 1;
        invoiceNumber = `${prefix}${nextInvoiceNum}`;
      } else {
        // Fallback if settings not loaded (should ideally not happen or be handled more gracefully)
        invoiceNumber = `INV-${new Date().getTime()}`; // Simple fallback
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
        total: this.total,
        amountInWords: this.amountInWords,
      };

      const newInvoiceId = await this.invoiceService.createInvoice(invoiceData);
      this.successMessage = `Invoice ${invoiceNumber} saved successfully! (ID: ${newInvoiceId})`;

      // Increment next invoice number in settings if auto-increment is enabled
      if (this.appSettings?.invoiceSettings?.autoIncrementInvoiceNumber && this.appSettings?.invoiceSettings) {
        const newNextNumber = (this.appSettings.invoiceSettings.nextInvoiceNumber || 1) + 1;
        // Update the local cache first for immediate reflection if needed, then save
        this.appSettings.invoiceSettings.nextInvoiceNumber = newNextNumber;
        // This specific update is tricky; might be better to save the whole appSettings object
        // or have a dedicated method in SettingsService that handles this update robustly.
        // For now, we'll rely on a full settings save if this component had a save button for its own defaults.
        // Or, more simply, the SettingsComponent is responsible for updating nextInvoiceNumber.
        // Let's assume SettingsService.updateInvoiceNumberSetting is robust or we save full settings.
        try {
            // Create a new AppSettings object with the updated nextInvoiceNumber
            const updatedSettings: AppSettings = JSON.parse(JSON.stringify(this.appSettings)); // Deep copy
            if (updatedSettings.invoiceSettings) {
                updatedSettings.invoiceSettings.nextInvoiceNumber = newNextNumber;
            }
            await this.settingsService.saveSettings(updatedSettings);
        } catch (settingsError) {
            console.error("Failed to update next invoice number in settings:", settingsError);
            // Non-critical for invoice creation itself, but admin should be aware.
            this.errorMessage = "Invoice saved, but failed to update next invoice number in settings.";
        }
      }

      this.resetInvoiceForm(); // Call new reset method

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

  get total(): number {
    return this.subtotalAfterDiscount + this.gst;
  }

  get amountInWords(): string {
    return this.numberToWords(this.total);
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
    this.invoiceForm.reset({
      customer: '',
      // Apply defaults from settings again
      clientManager: this.appSettings?.userProfileSettings?.userName || '',
      templateId: this.appSettings?.invoiceSettings?.defaultTemplateId || DEFAULT_TEMPLATE_ID,
      currency: this.appSettings?.invoiceSettings?.defaultCurrencyCode || DEFAULT_CURRENCY_CODE,
      dueDate: null, // Clear due date
      discountType: null,
      discountValue: null
    });
    this.items.clear();
    this.addItem(); // Add one empty item back

    // Clear success/error messages for the form itself, but might leave saveInvoice related messages if they are separate
    // this.successMessage = null; // Handled by saveInvoice itself with timeout
    // this.errorMessage = null; // Handled by saveInvoice itself with timeout
  }
}