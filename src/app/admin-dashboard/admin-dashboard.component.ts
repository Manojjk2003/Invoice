import { Component, OnInit } from '@angular/core';
import { CustomerService } from '../customer.service';
import { InvoiceService } from '../../app/invoice-form/invoice.service';
import { CommonModule } from '@angular/common';
import { InvoicePreviewComponent } from '../invoice-preview/invoice-preview.component';
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, InvoicePreviewComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  customers: any[] = [];
  invoices: any[] = [];
  selectedInvoice: any = null;

  constructor(
    private customerService: CustomerService,
    private invoiceService: InvoiceService
  ) {}

  async ngOnInit() {
    this.customers = await this.customerService.getCustomers();
    this.invoices = await this.invoiceService.getInvoices();
  }

  async deleteInvoice(id: string) {
    await this.invoiceService.deleteInvoice(id);
    this.invoices = await this.invoiceService.getInvoices();
  }
  viewInvoice(invoice: any) {
  this.selectedInvoice = invoice;
}

closeInvoice() {
  this.selectedInvoice = null;
}
generateInvoiceNumber(id: string): string {
  return `INV-${id.slice(-5).toUpperCase()}`;
}

}
