import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Vendor } from '../core/models/app.models'; // Correct path to models

@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vendor-form.component.html',
  styleUrls: ['./vendor-form.component.css']
})
export class VendorFormComponent implements OnInit, OnChanges {
  @Input() vendor: Vendor | null = null; // For editing
  @Input() isVisible: boolean = false; // To control modal visibility

  @Output() saveVendor = new EventEmitter<Vendor>();
  @Output() closeModal = new EventEmitter<void>();

  vendorForm: FormGroup;
  isEditMode = false;

  constructor(private fb: FormBuilder) {
    this.vendorForm = this.fb.group({
      name: ['', Validators.required],
      contactPerson: [''],
      // Basic email pattern, can be enhanced
      email: ['', [Validators.email]],
      // Simple 10-digit phone pattern, can be enhanced or made more flexible
      phone: ['', [Validators.pattern(/^\d{10}$/)]],
      address: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // Initial population handled by ngOnChanges if vendor data is provided
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vendor'] && this.vendor) {
      this.isEditMode = true;
      this.vendorForm.patchValue(this.vendor);
    } else if (changes['vendor'] && !this.vendor) {
      this.isEditMode = false;
      this.vendorForm.reset({ name: '', contactPerson: '', email: '', phone: '', address: '', notes: '' }); // Ensure form resets to default structure
    }
    // Note: isVisible changes don't reset the form here; parent should manage resetting 'vendor' input
  }

  onSubmit(): void {
    if (this.vendorForm.valid) {
      const formData = this.vendorForm.value;
      // Clean up empty optional fields to store null or not store them, instead of empty strings
      const processedFormData: any = {};
      for (const key in formData) {
        if (formData.hasOwnProperty(key)) {
          const value = formData[key];
          processedFormData[key] = value === '' ? null : value; // Convert empty strings to null
        }
      }

      const vendorToSave: Vendor = {
        ...(this.vendor || {}), // Keeps ID if editing, provides empty base if new
        ...processedFormData
      };
      // Ensure 'id' is not part of the payload if it's a new vendor without an ID from this.vendor
      if (!this.isEditMode || !vendorToSave.id) {
        delete vendorToSave.id;
      }


      this.saveVendor.emit(vendorToSave);
    } else {
      this.vendorForm.markAllAsTouched(); // Show validation errors
    }
  }

  onCancel(): void {
    this.closeModal.emit();
  }

  // Helpers for template validation messages
  get name() { return this.vendorForm.get('name'); }
  get email() { return this.vendorForm.get('email'); }
  get phone() { return this.vendorForm.get('phone'); }
}
