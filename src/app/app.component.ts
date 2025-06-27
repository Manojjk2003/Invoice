import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideNavbarComponent } from './navigation/side-navbar/side-navbar.component'; // Import SideNavbarComponent
import { CommonModule } from '@angular/common'; // Often good to have for root component

@Component({
  selector: 'app-root',
  standalone: true, // Ensuring AppComponent is also standalone
  imports: [CommonModule, RouterOutlet, SideNavbarComponent], // Add SideNavbarComponent and CommonModule
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] // Correct to styleUrls
})
export class AppComponent {
  title = 'invoice-app';
  // This title is not currently used in the template, can be removed if not planned for use.
}
