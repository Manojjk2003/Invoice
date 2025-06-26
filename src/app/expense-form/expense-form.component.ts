import { Component, EventEmitter, Input, OnInit, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../expense.service';
import { Expense } from '../core/models/app.models';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './expense-form.component.html',
  styleUrls: ['./expense-form.component.css'] // Corrected to styleUrls
})
export class ExpenseFormComponent implements OnInit, OnChanges {
  @Input() expenseToEdit: Expense | null = null; // If provided, component is in "edit" mode

  @Output() expenseSaved = new EventEmitter<void>(); // Emits on successful add or update
  @Output() close = new EventEmitter<void>(); // To close the form/modal

  expenseForm!: FormGroup;
  isSaving = false;
  errorMessage: string | null = null;
  receiptFile: File | null = null;
  existingReceiptUrl: string | null = null; // To show if editing and receipt exists

  // Example categories, could be fetched from a service or be a constant
  expenseCategories: string[] = ['Office Supplies', 'Travel', 'Software', 'Utilities', 'Meals', 'Marketing', 'Other'];

  constructor(
    private fb: FormBuilder,
    private expenseService: ExpenseService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expenseToEdit']) {
      this.initializeForm();
      if (this.expenseToEdit && this.expenseToEdit.receiptUrl) {
        this.existingReceiptUrl = this.expenseToEdit.receiptUrl;
      } else {
        this.existingReceiptUrl = null;
      }
      this.receiptFile = null; // Reset file input when expenseToEdit changes
    }
  }

  private initializeForm(): void {
    const today = new Date().toISOString().substring(0, 10);
    let initialDate = today;
    if (this.expenseToEdit?.date) {
      const d = this.expenseToEdit.date;
      // Handle both Firestore Timestamp and string/Date representations
      initialDate = new Date((d as any).toDate ? (d as any).toDate() : d).toISOString().substring(0,10);
    }

    this.expenseForm = this.fb.group({
      date: [initialDate, Validators.required],
      category: [this.expenseToEdit?.category || this.expenseCategories[0], Validators.required],
      description: [this.expenseToEdit?.description || '', Validators.required],
      amount: [this.expenseToEdit?.amount || null, [Validators.required, Validators.min(0.01)]],
      vendor: [this.expenseToEdit?.vendor || ''],
      receipt: [null] // For the file input, not directly part of Expense model
    });
    if (this.expenseToEdit) {
        this.existingReceiptUrl = this.expenseToEdit.receiptUrl || null;
    } else {
        this.existingReceiptUrl = null;
    }
    this.receiptFile = null;
  }

  onReceiptFileChange(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList.length > 0) {
      this.receiptFile = fileList[0];
      this.existingReceiptUrl = null; // Clear existing URL if new file is chosen
    } else {
      this.receiptFile = null;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.expenseForm.invalid) {
      this.errorMessage = 'Please correct the errors in the form.';
      Object.values(this.expenseForm.controls).forEach(control => control.markAsTouched());
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;
    let receiptUrlToSave = this.expenseToEdit?.receiptUrl || undefined; // Keep existing if not changed

    try {
      if (this.receiptFile) {
        // If there was an old receipt and a new one is uploaded, delete the old one from storage.
        if (this.expenseToEdit && this.expenseToEdit.receiptUrl) {
            try {
                await this.expenseService.deleteReceiptFile(this.expenseToEdit.receiptUrl);
            } catch (delFileError) {
                console.warn("Could not delete old receipt file from storage, proceeding with new upload:", delFileError);
                // This might not be critical enough to stop the whole process,
                // but it's good to be aware of (e.g. orphaned file).
            }
        }
        receiptUrlToSave = await this.expenseService.uploadReceipt(this.receiptFile);
      } else if (this.expenseToEdit && this.expenseToEdit.receiptUrl && !this.existingReceiptUrl && !this.receiptFile) {
        // This case means an existing receipt was present (expenseToEdit.receiptUrl),
        // but existingReceiptUrl is now null (meaning user might have cleared/cancelled selection of a new file)
        // AND no new receiptFile is selected. This implies the user wants to remove the existing receipt.
        try {
            await this.expenseService.deleteReceiptFile(this.expenseToEdit.receiptUrl);
            receiptUrlToSave = undefined; // Ensure it's cleared in Firestore
        } catch (delFileError) {
            console.warn("Could not delete existing receipt file when attempting to remove it:", delFileError);
            // Potentially keep receiptUrlToSave as is, or set to undefined and log error
            receiptUrlToSave = this.expenseToEdit.receiptUrl; // Fallback: keep old URL if deletion failed
        }
      }


      const formValue = this.expenseForm.value;
      const expenseData: Omit<Expense, 'id'> = {
        date: new Date(formValue.date), // Ensure date is a Date object
        category: formValue.category,
        description: formValue.description,
        amount: Number(formValue.amount),
        vendor: formValue.vendor || undefined, // Store undefined if empty
        receiptUrl: receiptUrlToSave
      };

      if (this.expenseToEdit && this.expenseToEdit.id) {
        // Update existing expense
        await this.expenseService.updateExpense(this.expenseToEdit.id, expenseData);
      } else {
        // Add new expense
        await this.expenseService.addExpense(expenseData);
      }

      this.expenseSaved.emit();
      this.closeModal();
    } catch (error) {
      this.errorMessage = 'Failed to save expense. Please try again.';
      console.error('Error saving expense:', error);
    } finally {
      this.isSaving = false;
    }
  }

  closeModal(): void {
    this.close.emit();
  }
}
