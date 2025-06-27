import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule], // Import CommonModule if you plan to use *ngIf, *ngFor, etc.
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css'] // Correct to styleUrls
})
export class DashboardPageComponent {
  constructor() { }
}
