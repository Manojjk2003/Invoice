import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';

export const routes: Routes = [
     { path: '', component: HomeComponent },
  { path: 'create-invoice', component: InvoiceFormComponent },
  { path: 'admin', component: AdminDashboardComponent }, 

];
