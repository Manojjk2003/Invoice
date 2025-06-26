import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { InvoiceService } from './invoice.service';

@Component({
  standalone: true,
  selector: 'app-invoice-form',
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule,],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.css']
})
export class InvoiceFormComponent implements OnInit {
  invoiceForm!: FormGroup;
  newCustomerForm!: FormGroup;

  logoFile: File | null = null;

  customers: any[] = []; // Loaded from Firestore
  showNewCustomer = false;
 newCustomer = {
  name: '',
  address: '',
  gst: '',
  contact: ''
};

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit(): void {
    this.invoiceForm = this.fb.group({
      customer: ['', Validators.required],
      clientManager: ['', Validators.required],
      items: this.fb.array([]),
      logo: [''],
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

  // Load customers from Firestore
  async loadCustomers() {
    this.customers = await this.invoiceService.getCustomers();
  }

  // Line items
  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

addItem() {
  const itemGroup = this.fb.group({
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]]
  });
  this.items.push(itemGroup);
}


  removeItem(index: number) {
    this.items.removeAt(index);
  }

  // Toggle add new customer form
  toggleNewCustomer() {
    this.showNewCustomer = !this.showNewCustomer;
  }

async saveNewCustomer() {
  if (this.newCustomerForm.invalid) {
    alert('Please fill in the customer name.');
    return;
  }

  const customerData = this.newCustomerForm.value;

  const customerId = await this.invoiceService.addCustomer(customerData);
  await this.loadCustomers();
  this.invoiceForm.patchValue({ customer: customerId });
  this.showNewCustomer = false;
  this.newCustomerForm.reset(); // Clear new customer form
}


  // File upload
  async onLogoUpload(event: any) {
  this.logoFile = event.target.files[0];
  console.log('Selected file:', this.logoFile);
}

async saveInvoice() {
  if (this.logoFile) {
    const logoUrl = await this.invoiceService.uploadLogo(this.logoFile);
    this.invoiceForm.patchValue({ logo: logoUrl });
  }

  await this.invoiceService.createInvoice({
    ...this.invoiceForm.value,
    subtotal: this.subtotal,
    gst: this.gst,
    total: this.total,
    amountInWords: this.amountInWords
  });

  alert('Invoice saved successfully!');

  // Reset form and FormArray
  this.invoiceForm.reset({
    customer: '',
    clientManager: '',
    items: [],
    logo: ''
  });

  this.items.clear();
  this.addItem(); // Start fresh with one line item
}


  // Calculations
  get subtotal(): number {
    return this.items.value.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  }

  get gst(): number {
    return this.subtotal * 0.18;
  }

  get total(): number {
    return this.subtotal + this.gst;
  }

  get amountInWords(): string {
    return this.numberToWords(this.total);
  }

 numberToWords(amount: number): string {
  if (amount === 0) return '';
  return `${amount} rupees only`; // Replace with real logic if needed
}

}