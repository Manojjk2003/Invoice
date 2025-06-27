import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common'; // Added CurrencyPipe
import { RouterLink } from '@angular/router'; // For quick action links

import { CustomerService } from '../customer.service';
import { InvoiceService } from '../invoice-form/invoice.service';
import { ExpenseService } from '../expense.service';
import { Customer, Invoice, Expense, CurrencyCode, DEFAULT_CURRENCY_CODE } from '../core/models/app.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent implements OnInit {
  isLoadingMetrics = false;
  metricsError: string | null = null;

  totalCustomers = 0;
  totalInvoices = 0;
  totalUnpaidValue = 0;
  totalOverdueValue = 0;
  totalExpensesThisMonth = 0;

  // Assuming a default currency for displaying aggregated values if they are mixed.
  // For simplicity, using the app's default. A more complex app might need to handle multiple currencies here.
  displayCurrency: CurrencyCode = DEFAULT_CURRENCY_CODE;

  constructor(
    private customerService: CustomerService,
    private invoiceService: InvoiceService,
    private expenseService: ExpenseService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.isLoadingMetrics = true;
    this.metricsError = null;
    try {
      const [customers, invoices, expenses] = await Promise.all([
        this.customerService.getCustomers(),
        this.invoiceService.getInvoices(),
        this.expenseService.getExpenses()
      ]);

      // Calculate metrics
      this.totalCustomers = customers.length;
      this.totalInvoices = invoices.length;

      this.totalUnpaidValue = invoices
        .filter(inv => inv.paymentStatus === 'Unpaid' || inv.paymentStatus === 'Partially Paid')
        .reduce((sum, inv) => sum + (inv.total - inv.totalPaid), 0);

      this.totalOverdueValue = invoices
        .filter(inv => inv.paymentStatus === 'Overdue') // Assuming 'Overdue' status is set correctly
        .reduce((sum, inv) => sum + (inv.total - inv.totalPaid), 0);

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      this.totalExpensesThisMonth = expenses
        .filter(exp => {
          // Ensure exp.date is a JS Date object before calling getMonth/getFullYear
          const expenseDate = (exp.date as any).toDate ? (exp.date as any).toDate() : new Date(exp.date);
          return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.metricsError = 'Failed to load dashboard metrics. Please try again.';
    } finally {
      this.isLoadingMetrics = false;
    }
  }
}
