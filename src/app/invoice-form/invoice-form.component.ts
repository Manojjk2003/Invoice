import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, FormControl } from '@angular/forms';
import { InvoiceService } from './invoice.service';
import jsPDF from 'jspdf';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

@Component({
  standalone: true,
  selector: 'app-invoice-form',
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.css']
})
export class InvoiceFormComponent {
  invoiceForm: FormGroup;
  logoFile: File | null = null;
  customers: any[] = []; // List of saved customers

  constructor(private fb: FormBuilder, private invoiceService: InvoiceService) {
    this.invoiceForm = this.fb.group({
      customer: [''],
      clientManager: [''],
      items: this.fb.array([]),
      logo: [null]
    });
  }

  get items() {
    return this.invoiceForm.get('items') as FormArray;
  }

  addItem() {
    this.items.push(this.fb.group({
      description: [''],
      amount: [0]
    }));
    this.updateCalculations();
  }

  removeItem(index: number) {
    this.items.removeAt(index);
    this.updateCalculations();
  }

  onLogoUpload(event: any) {
    this.logoFile = event.target.files[0];
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

    console.log('Invoice saved:', this.invoiceForm.value);
  }

  // Real-time calculations
  get subtotal() {
    return this.items.value.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  }

  get gst() {
    return this.subtotal * 0.18;
  }

  get total() {
    return this.subtotal + this.gst;
  }

  get amountInWords() {
    return this.numberToWords(this.total);
  }

  updateCalculations() {
    // Called after add/remove item to update totals
  }

  numberToWords(amount: number): string {
    // Convert number to words (simplified example)
    return 'One thousand rupees only';
  }

  // Add new customer (could be implemented later)
  addNewCustomer() {
    // e.g., this.router.navigate(['/add-customer']);
  }
  generatePDF() {
  const doc = new jsPDF();

  doc.text('Invoice', 10, 10);
  doc.text(`Customer: ${this.invoiceForm.value.customer}`, 10, 20);
  // ... Add more invoice details

  doc.save('invoice.pdf');
}

}
