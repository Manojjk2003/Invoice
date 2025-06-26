import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { InvoiceService } from './invoice.service';
import { CustomerService } from '../customer.service';
import {
  Customer, Invoice, InvoiceItem,
  InvoiceTemplate, InvoiceTemplateId, DEFAULT_TEMPLATE_ID,
  Currency, CurrencyCode, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY_CODE
} from '../core/models/app.models'; // Import currency models

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

  // For user feedback
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoadingCustomers = false;
  isSavingCustomer = false;
  isSavingInvoice = false;

  invoiceTemplates: InvoiceTemplate[] = [
    { id: 'classic', name: 'Classic' },
    { id: 'modern', name: 'Modern' },
    { id: 'simple', name: 'Simple' }
  ];

  supportedCurrencies: Currency[] = SUPPORTED_CURRENCIES;

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.invoiceForm = this.fb.group({
      customer: ['', Validators.required],
      clientManager: ['', Validators.required],
      templateId: [DEFAULT_TEMPLATE_ID, Validators.required],
      currency: [DEFAULT_CURRENCY_CODE, Validators.required], // Added currency FormControl
      items: this.fb.array([]),
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

    this.loadCustomers();
    this.addItem(); // Add an initial line item
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

  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  createItem(): FormGroup {
    return this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]]
    });
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
      // if (this.logoFile) { // Removed
      //   logoUrl = await this.invoiceService.uploadLogo(this.logoFile);
      // }

      const formValue = this.invoiceForm.value;
      // Adjust type to match what InvoiceService.createInvoice expects
      const invoiceData: Omit<Invoice, 'id' | 'paymentStatus' | 'totalPaid'> = {
        customer: formValue.customer,
        clientManager: formValue.clientManager,
        templateId: formValue.templateId,
        currency: formValue.currency, // Include currency
        items: formValue.items as InvoiceItem[],
        subtotal: this.subtotal,
        gst: this.gst,
        total: this.total,
        amountInWords: this.amountInWords,
        date: new Date(),
      };

      await this.invoiceService.createInvoice(invoiceData);
      this.successMessage = 'Invoice saved successfully!';
      this.invoiceForm.reset({
        customer: '',
        clientManager: '',
        templateId: DEFAULT_TEMPLATE_ID,
        currency: DEFAULT_CURRENCY_CODE // Reset currency to default
      });
      this.items.clear();
      this.addItem();
      // Consider navigating away or showing a persistent success message
    } catch (error) {
      this.errorMessage = 'Failed to save invoice. Please try again.';
      console.error('Error saving invoice:', error);
    } finally {
      this.isSavingInvoice = false;
    }
  }

  get subtotal(): number {
    return this.items.value.reduce((sum: number, item: InvoiceItem) => sum + Number(item.amount || 0), 0);
  }

  get gstRate(): number {
    return 0.18; // Hardcoded, consider making this configurable
  }

  get gst(): number {
    return this.subtotal * this.gstRate;
  }

  get total(): number {
    return this.subtotal + this.gst;
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
}