import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { Vendor } from '../core/models/app.models'; // Correct path
import { VendorService } from '../vendor.service';   // Correct path
import { VendorFormComponent } from '../vendor-form/vendor-form.component'; // Correct path

@Component({
  selector: 'app-vendor-management',
  standalone: true,
  imports: [CommonModule, VendorFormComponent], // Import VendorFormComponent
  templateUrl: './vendor-management.component.html',
  styleUrls: ['./vendor-management.component.css']
})
export class VendorManagementComponent implements OnInit {
  private vendorService: VendorService = inject(VendorService);

  vendors$: Observable<Vendor[]>;

  isVendorFormVisible = false;
  currentVendor: Vendor | null = null;
  feedbackMessage: string | null = null;
  feedbackType: 'success' | 'error' = 'success';

  constructor() {
    this.vendors$ = this.vendorService.getVendors();
  }

  ngOnInit(): void {
    // Vendors are loaded via async pipe in the template
  }

  showAddVendorForm(): void {
    this.currentVendor = null;
    this.isVendorFormVisible = true;
    this.feedbackMessage = null;
  }

  showEditVendorForm(vendor: Vendor): void {
    this.currentVendor = { ...vendor }; // Clone to avoid issues if form is cancelled
    this.isVendorFormVisible = true;
    this.feedbackMessage = null;
  }

  async handleSaveVendor(vendor: Vendor): Promise<void> {
    // Firestore expects 'undefined' for fields to be removed, not 'null'.
    // However, our form might emit null for empty optional string fields.
    // For simplicity, we'll let Firestore handle nulls (it usually stores them as null).
    // If specific field deletion is needed, more processing would be required here.
    const vendorPayload: Partial<Vendor> = { ...vendor };
    if (vendorPayload.id === undefined) { // Ensure id is not part of payload for add operations
      delete vendorPayload.id;
    }


    try {
      if (vendor.id) { // Editing existing vendor
        await this.vendorService.updateVendor(vendor.id, vendorPayload);
        this.showFeedback('Vendor updated successfully!', 'success');
      } else { // Adding new vendor
        // The Omit<Vendor, 'id'> type is implicitly handled by vendorPayload if id was deleted
        const newVendorId = await this.vendorService.addVendor(vendorPayload as Omit<Vendor, 'id'>);
        this.showFeedback(`Vendor "${vendor.name}" added successfully!`, 'success');
      }
      this.closeVendorForm();
      this.vendors$ = this.vendorService.getVendors(); // Refresh list
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      this.showFeedback(`Error saving vendor: ${error.message || 'Unknown error'}`, 'error');
    }
  }

  async handleDeleteVendor(vendorId: string | undefined, vendorName: string): Promise<void> {
    if (!vendorId) {
      this.showFeedback('Cannot delete vendor: ID is missing.', 'error');
      return;
    }
    if (confirm(`Are you sure you want to delete the vendor "${vendorName}"? This action cannot be undone.`)) {
      try {
        await this.vendorService.deleteVendor(vendorId);
        this.showFeedback(`Vendor "${vendorName}" deleted successfully!`, 'success');
        this.vendors$ = this.vendorService.getVendors(); // Refresh list
      } catch (error: any) {
        console.error('Error deleting vendor:', error);
        this.showFeedback(`Error deleting vendor: ${error.message || 'Unknown error'}`, 'error');
      }
    }
  }

  closeVendorForm(): void {
    this.isVendorFormVisible = false;
    this.currentVendor = null;
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage = message;
    this.feedbackType = type;
    setTimeout(() => this.feedbackMessage = null, 5000);
  }
}
