import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InvoiceService } from '../invoice-form/invoice.service';
import { Payment } from '../core/models/app.models';

@Component({
  selector: 'app-record-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './record-payment.component.html',
  styleUrls: ['./record-payment.component.css'] // Corrected to styleUrls
})
export class RecordPaymentComponent implements OnInit {
  @Input() invoiceId!: string;
  @Input() invoiceTotal!: number; // To validate payment amount against remaining
  @Input() totalPaidSoFar!: number; // To calculate remaining amount

  @Output() paymentRecorded = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  paymentForm!: FormGroup;
  isSaving = false;
  errorMessage: string | null = null;

  paymentMethods: Payment['paymentMethod'][] = ['Cash', 'Credit Card', 'Bank Transfer', 'Cheque', 'Other'];

  constructor(
    private fb: FormBuilder,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10); // Default to today's date in YYYY-MM-DD

    this.paymentForm = this.fb.group({
      paymentDate: [today, Validators.required],
      amountPaid: [null, [Validators.required, Validators.min(0.01), Validators.max(this.remainingAmount)]],
      paymentMethod: [this.paymentMethods[0], Validators.required],
      notes: ['']
    });
  }

  get remainingAmount(): number {
    return Math.max(0, this.invoiceTotal - this.totalPaidSoFar);
  }

  async onSubmit(): Promise<void> {
    if (this.paymentForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form.';
      // Mark all fields as touched to show errors
      Object.values(this.paymentForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;

    const formValue = this.paymentForm.value;
    const paymentData: Omit<Payment, 'id'> = {
      invoiceId: this.invoiceId,
      paymentDate: formValue.paymentDate, // Already a string in YYYY-MM-DD from input[type=date]
      amountPaid: Number(formValue.amountPaid),
      paymentMethod: formValue.paymentMethod,
      notes: formValue.notes
    };

    try {
      await this.invoiceService.recordPayment(paymentData);
      this.paymentRecorded.emit();
      this.closeModal(); // Close after successful recording
    } catch (error) {
      this.errorMessage = 'Failed to record payment. Please try again.';
      console.error('Error recording payment:', error);
    } finally {
      this.isSaving = false;
    }
  }

  closeModal(): void {
    this.close.emit();
  }
}
