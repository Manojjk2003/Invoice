import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProductOrService } from '../core/models/app.models';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit, OnChanges {
  @Input() product: ProductOrService | null = null; // For editing
  @Input() isVisible: boolean = false; // To control modal visibility

  @Output() saveProduct = new EventEmitter<ProductOrService>();
  @Output() closeModal = new EventEmitter<void>();

  productForm: FormGroup;
  isEditMode = false;

  constructor(private fb: FormBuilder) {
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      defaultUnitPrice: [null, [Validators.required, Validators.min(0)]],
      defaultUnit: ['']
    });
  }

  ngOnInit(): void {
    // Handled by ngOnChanges for initial setup if product is provided
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.isEditMode = true;
      this.productForm.patchValue(this.product);
    } else if (changes['product'] && !this.product) {
      this.isEditMode = false;
      this.productForm.reset();
    }

    if (changes['isVisible'] && !this.isVisible) {
      // Reset form when modal is hidden, unless it's being hidden after a save.
      // The parent component should handle resetting the `product` input if needed.
    }
  }

  onSubmit(): void {
    if (this.productForm.valid) {
      const formData = this.productForm.value;
      const productToSave: ProductOrService = {
        ...this.product, // Keeps ID if editing
        ...formData
      };
      this.saveProduct.emit(productToSave);
      // Parent component will handle closing the modal and resetting
    } else {
      this.productForm.markAllAsTouched(); // Show validation errors
    }
  }

  onCancel(): void {
    this.closeModal.emit();
    // Parent component will handle resetting form state if needed
  }

  // Helper for template validation
  get name() { return this.productForm.get('name'); }
  get defaultUnitPrice() { return this.productForm.get('defaultUnitPrice'); }
}
