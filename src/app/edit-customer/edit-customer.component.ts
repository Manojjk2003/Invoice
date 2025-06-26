import { Component, EventEmitter, Input, OnInit, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CustomerService } from '../customer.service';
import { Customer } from '../core/models/app.models';

@Component({
  selector: 'app-edit-customer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-customer.component.html',
  styleUrls: ['./edit-customer.component.css'] // Corrected to styleUrls
})
export class EditCustomerComponent implements OnInit, OnChanges {
  @Input() customer!: Customer; // Expect customer data to be passed in

  @Output() customerUpdated = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  editCustomerForm!: FormGroup;
  isSaving = false;
  errorMessage: string | null = null;
  initialEmail: string | null = null; // To track if email has changed

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If customer input changes, re-initialize form (e.g. if modal is reused for different customers)
    if (changes['customer'] && this.customer) {
      this.initializeForm();
    }
  }

  private initializeForm(): void {
    if (!this.customer) return;

    this.initialEmail = this.customer.email;
    this.editCustomerForm = this.fb.group({
      name: [this.customer.name, Validators.required],
      email: [this.customer.email, [Validators.required, Validators.email]],
      address: [this.customer.address || ''],
      gst: [this.customer.gst || '', [Validators.pattern(/^[a-zA-Z0-9]{15}$/)]],
      phone: [this.customer.phone || '', [Validators.pattern(/^\d{10}$/)]],
      contact: [this.customer.contact || '']
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.customer || !this.customer.id) {
        this.errorMessage = "Customer data is missing. Cannot update.";
        return;
    }
    if (this.editCustomerForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form.';
      Object.values(this.editCustomerForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;

    const formValue = this.editCustomerForm.value;

    // Prepare only changed data to send for update if desired, or send all
    // For simplicity, sending all form values as Partial<Customer>
    const customerDataToUpdate: Partial<Customer> = {
        name: formValue.name,
        email: formValue.email,
        address: formValue.address || null, // Send null if empty to clear field
        gst: formValue.gst || null,
        phone: formValue.phone || null,
        contact: formValue.contact || null
    };

    // Check if email is being changed to perform unique check
    if (formValue.email !== this.initialEmail) {
        // Email has changed, unique check is needed by the service
    }


    try {
      await this.customerService.updateCustomer(this.customer.id, customerDataToUpdate);
      this.customerUpdated.emit();
      this.closeModal();
    } catch (error: any) {
      if (error.message?.includes('DUPLICATE_EMAIL')) { // Service should throw specific error
        this.errorMessage = error.message.replace('DUPLICATE_EMAIL_UPDATE: ', '');
        this.editCustomerForm.get('email')?.setErrors({ duplicate: true });
      } else {
        this.errorMessage = 'Failed to update customer. Please try again.';
        console.error('Error updating customer:', error);
      }
    } finally {
      this.isSaving = false;
    }
  }

  closeModal(): void {
    this.close.emit();
  }
}
