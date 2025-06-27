import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router'; // Import RouterLink and RouterLinkActive
import { CommonModule } from '@angular/common'; // Import CommonModule for *ngIf, *ngFor if needed later

@Component({
  selector: 'app-side-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive], // Add to imports
  templateUrl: './side-navbar.component.html',
  styleUrls: ['./side-navbar.component.css'] // Corrected to styleUrls
})
export class SideNavbarComponent {

}
