import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component'; // Will likely be replaced or removed as default
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { InvoiceDetailComponent } from './invoice-detail/invoice-detail.component';
import { ExpenseDashboardComponent } from './expense-dashboard/expense-dashboard.component';
import { DashboardPageComponent } from './dashboard-page/dashboard-page.component'; // Import DashboardPageComponent
import { ProductManagementComponent } from './product-management/product-management.component'; // Import ProductManagementComponent
import { VendorManagementComponent } from './vendor-management/vendor-management.component'; // Import VendorManagementComponent

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }, // Redirect empty path to dashboard
  { path: 'dashboard', component: DashboardPageComponent },   // New default dashboard route
  { path: 'home', component: HomeComponent }, // Keep home accessible if needed, or remove
  { path: 'create-invoice', component: InvoiceFormComponent },
  { path: 'admin', component: AdminDashboardComponent }, // This might be refactored into specific Invoice/Customer lists later
  { path: 'invoice/:id', component: InvoiceDetailComponent },
  { path: 'expenses', component: ExpenseDashboardComponent },
  { path: 'products', component: ProductManagementComponent }, // Route for Product Management
  { path: 'vendors', component: VendorManagementComponent },   // Route for Vendor Management
];
