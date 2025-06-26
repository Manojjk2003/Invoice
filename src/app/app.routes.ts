import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';
import { ExpenseDashboardComponent } from './expense-dashboard/expense-dashboard.component'; // Import ExpenseDashboardComponent

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'create-invoice', component: InvoiceFormComponent },
  { path: 'admin', component: AdminDashboardComponent },
  { path: 'invoice/:id', component: InvoiceDetailComponent },
  { path: 'expenses', component: ExpenseDashboardComponent }, // Add new route for expenses
];
