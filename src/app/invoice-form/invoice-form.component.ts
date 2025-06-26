import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { InvoiceService } from './invoice.service';
import { CustomerService } from '../customer.service'; // Import CustomerService
import { Customer, Invoice, InvoiceItem } from '../core/models/app.models';

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

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService,
    private customerService: CustomerService // Inject CustomerService
  ) {}

  ngOnInit(): void {
    this.invoiceForm = this.fb.group({
      customer: ['', Validators.required], // Will store customer ID
      clientManager: ['', Validators.required],
      items: this.fb.array([]),
      // logo: [''] // Removed: Logo per invoice is handled by default now
    });

    this.newCustomerForm = this.fb.group({
      name: ['', Validators.required],
      address: [''],
      gst: [''],
      contact: ['']
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
    } catch (error) {
      this.errorMessage = 'Failed to save new customer. Please try again.';
      console.error('Error saving new customer:', error);
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
      const invoiceData: Omit<Invoice, 'id'> = {
        customer: formValue.customer, // This should be the customer ID string
        clientManager: formValue.clientManager,
        items: formValue.items as InvoiceItem[],
        // logo: logoUrl, // Removed: Default logo will be used at display time
        subtotal: this.subtotal,
        gst: this.gst,
        total: this.total,
        amountInWords: this.amountInWords,
        date: new Date(), // Set current date and time
        // invoiceNumber: could be generated here or by the service/backend
        // customer: this.customers.find(c => c.id === formValue.customer) // Optionally embed customer object
      };

      await this.invoiceService.createInvoice(invoiceData);
      this.successMessage = 'Invoice saved successfully!';
      this.invoiceForm.reset({ customer: '', clientManager: ''}); // Removed logo from reset
      this.items.clear();
      this.addItem(); // Add one fresh item
      // this.logoFile = null; // Removed
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