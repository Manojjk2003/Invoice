import { Component, OnInit } from '@angular/core';
import { CustomerService } from '../customer.service';
import { InvoiceService } from '../invoice-form/invoice.service'; // Corrected path
import { CommonModule } from '@angular/common';
import { Customer, Invoice } from '../core/models/app.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  customers: Customer[] = [];
  invoices: Invoice[] = [];

  isLoadingCustomers = false;
  isLoadingInvoices = false;
  customerError: string | null = null;
  invoiceError: string | null = null;
  deleteError: string | null = null;
  deleteSuccess: string | null = null;


  constructor(
    private customerService: CustomerService,
    private invoiceService: InvoiceService
  ) {}

  ngOnInit() {
    this.loadCustomers();
    this.loadInvoices();
  }

  async loadCustomers() {
    this.isLoadingCustomers = true;
    this.customerError = null;
    try {
      this.customers = await this.customerService.getCustomers();
    } catch (error) {
      this.customerError = 'Failed to load customers.';
      console.error('Error loading customers:', error);
    } finally {
      this.isLoadingCustomers = false;
    }
  }

  async loadInvoices() {
    this.isLoadingInvoices = true;
    this.invoiceError = null;
    try {
      this.invoices = await this.invoiceService.getInvoices();
    } catch (error) {
      this.invoiceError = 'Failed to load invoices.';
      console.error('Error loading invoices:', error);
    } finally {
      this.isLoadingInvoices = false;
    }
  }

  async deleteInvoice(id: string | undefined) {
    if (!id) {
      this.deleteError = 'Cannot delete invoice: ID is missing.';
      return;
    }
    this.deleteError = null;
    this.deleteSuccess = null;

    // Optimistically remove from UI or add a specific loading state for the item
    // For simplicity here, we'll just show a general message and reload.

    try {
      await this.invoiceService.deleteInvoice(id);
      this.deleteSuccess = `Invoice (ID: ${id}) deleted successfully. Refreshing list...`;
      // Refresh invoices list
      await this.loadInvoices();
    } catch (error) {
      this.deleteError = `Failed to delete invoice (ID: ${id}). Please try again.`;
      console.error('Error deleting invoice:', error);
    }
  }
}
